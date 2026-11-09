package com.bricktools.part;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.net.URI;
import java.net.http.HttpClient;
import java.net.http.HttpRequest;
import java.net.http.HttpResponse;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Optional;
import java.util.TreeSet;
import java.util.regex.Pattern;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

/**
 * Builds data/bt/part_color_url.csv from the Rebrickable inventory parts and serves the matching
 * part images, downloading them from the Rebrickable CDN when they are not stored yet.
 */
@Service
public class PartImageService {

  static final long DOWNLOAD_DELAY_MS = 200;

  private static final List<String> INDEX_HEADERS =
      List.of("PartNumber", "ColorId", "ItemNumber", "ImgUrl");
  private static final List<String> DEFAULT_COLOR_HEADERS =
      List.of("PartNumber", "ColorId");
  private static final Pattern PART_NUMBER = Pattern.compile("[A-Za-z0-9._-]+");
  private static final List<String> EXTENSIONS = List.of("jpg", "png");
  private static final Map<String, String> CONTENT_TYPES = Map.of(
      "jpg", "image/jpeg",
      "jpeg", "image/jpeg",
      "png", "image/png");
  private static final String DEFAULT_EXTENSION = "jpg";
  private static final String MISSING_IMAGE = "part_img_missing.png";
  private static final Comparator<Map<String, String>> BY_PART_AND_COLOR = Comparator
      .comparing((Map<String, String> row) -> clean(row.get("PartNumber")),
          String.CASE_INSENSITIVE_ORDER)
      .thenComparingInt(row -> toInt(row.get("ColorId")));

  private final Path inventoryPartsFile;
  private final Path partColorUrlFile;
  private final Path defaultColorFile;
  private final Path imagesDir;
  private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();

  private Map<String, String> urlCache;
  private Map<String, List<Integer>> colorsCache;
  private Map<String, PartColorKey> itemCache;
  private Map<String, Integer> defaultColorCache;
  private long urlCacheModified = Long.MIN_VALUE;
  private long defaultColorCacheModified = Long.MIN_VALUE;
  private long lastDownloadEndedAt;

  private record PartColorKey(String partNumber, int colorId) {}

  public PartImageService(BrickToolsProperties props) {
    Path data = props.dataPath();
    this.inventoryPartsFile = data.resolve("re/inventory_parts.csv");
    this.partColorUrlFile = data.resolve("bt/part_color_url.csv");
    this.defaultColorFile = data.resolve("bt/part_default_color.csv");
    this.imagesDir = data.resolve("other/partimg");
  }

  /**
   * Rebuilds data/bt/part_color_url.csv from data/re/inventory_parts.csv. The first inventory row
   * of each part/color pair with an image URL is kept; rows without an image URL are skipped.
   */
  public synchronized Map<String, Object> generatePartColorUrls() throws IOException {
    Map<String, Map<String, String>> kept = new LinkedHashMap<>();
    int total = 0;
    int duplicates = 0;
    int noUrl = 0;
    for (Map<String, String> row : Csv.read(inventoryPartsFile)) {
      total++;
      String partNumber = clean(row.get("part_num"));
      String colorId = clean(row.get("color_id"));
      String url = clean(row.get("img_url"));
      if (partNumber.isEmpty() || colorId.isEmpty()) {
        continue;
      }
      String key = key(partNumber, colorId);
      if (kept.containsKey(key)) {
        duplicates++;
        continue;
      }
      if (url.isEmpty()) {
        noUrl++;
        continue;
      }
      Map<String, String> entry = new LinkedHashMap<>();
      entry.put("PartNumber", partNumber);
      entry.put("ColorId", colorId);
      entry.put("ItemNumber", itemNumber(url));
      entry.put("ImgUrl", url);
      kept.put(key, entry);
    }

    List<Map<String, String>> rows = new ArrayList<>(kept.values());
    rows.sort(BY_PART_AND_COLOR);
    Csv.write(partColorUrlFile, INDEX_HEADERS, rows);
    urlCache = null;
    colorsCache = null;
    itemCache = null;

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("total", total);
    result.put("kept", rows.size());
    result.put("duplicates", duplicates);
    result.put("noUrl", noUrl);
    return result;
  }

  /**
   * Returns the stored image of a part color, if a jpg or png file already exists.
   */
  public synchronized Optional<Path> find(String partNumber, int colorId) {
    if (!isSafeId(partNumber) || colorId < 0) {
      return Optional.empty();
    }
    Path folder = imagesDir.resolve(String.valueOf(colorId));
    for (String extension : EXTENSIONS) {
      Path image = folder.resolve(partNumber + "." + extension);
      if (Files.isRegularFile(image)) {
        return Optional.of(image);
      }
    }
    return Optional.empty();
  }

  /**
   * Returns the image of a part color, downloading it from the Rebrickable CDN when needed. When
   * {@code colorId} is null the first color available for the part is used. At most one download is
   * started every {@value #DOWNLOAD_DELAY_MS} ms so the CDN is not overloaded.
   */
  public synchronized Optional<Path> ensure(String partNumber, Integer colorId)
      throws IOException, InterruptedException {
    if (!isSafeId(partNumber)) {
      throw new IllegalArgumentException("Invalid part number: " + partNumber);
    }
    if (colorId != null && colorId < 0) {
      throw new IllegalArgumentException("Invalid color id: " + colorId);
    }
    int color = colorId == null ? defaultColor(partNumber) : colorId;
    if (color < 0) {
      return Optional.empty();
    }
    Optional<Path> existing = find(partNumber, color);
    if (existing.isPresent()) {
      return existing;
    }
    Optional<String> url = imageUrl(partNumber, color);
    if (url.isEmpty()) {
      return Optional.empty();
    }

    Path folder = imagesDir.resolve(String.valueOf(color));
    String extension = extensionOf(url.get());
    Path target = folder.resolve(partNumber + "." + extension);
    Path partial = folder.resolve(partNumber + ".part");
    Files.createDirectories(folder);
    pauseBeforeDownload();
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url.get())).build();
      HttpResponse<Path> response = http.send(request, HttpResponse.BodyHandlers.ofFile(partial));
      if (response.statusCode() != 200) {
        throw new IOException("Part image download failed with HTTP " + response.statusCode());
      }
      Files.move(partial, target, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      lastDownloadEndedAt = System.currentTimeMillis();
      Files.deleteIfExists(partial);
    }
    return Optional.of(target);
  }

  /**
   * Returns the image of a part color with a fallback. When the part/color pair has no image URL,
   * the first other color of the part that has an image is used. When the part has no image at
   * all, the missing part image is returned.
   */
  public synchronized Optional<Path> ensureWithFallback(String partNumber, Integer colorId)
      throws IOException, InterruptedException {
    Optional<Path> image = ensure(partNumber, colorId);
    if (image.isPresent()) {
      return image;
    }
    int fallback = defaultColor(partNumber);
    if (fallback >= 0) {
      image = ensure(partNumber, fallback);
      if (image.isPresent()) {
        return image;
      }
    }
    return missingImage();
  }

  /**
   * Returns the colors available for a part, read from data/bt/part_color_url.csv and sorted by
   * color id.
   */
  public synchronized List<Integer> colors(String partNumber) throws IOException {
    if (!isSafeId(partNumber)) {
      return List.of();
    }
    urls();
    return colorsCache.getOrDefault(partNumber, List.of());
  }

  /**
   * Returns the default color of a part: the color stored in data/bt/part_default_color.csv when
   * it is still available, or the first available color otherwise. Returns -1 when the part has
   * no color.
   */
  public synchronized int defaultColor(String partNumber) throws IOException {
    if (!isSafeId(partNumber)) {
      return -1;
    }
    List<Integer> available = colors(partNumber);
    if (available.isEmpty()) {
      return -1;
    }
    Integer stored = defaultColors().get(partNumber);
    return stored != null && available.contains(stored) ? stored : available.get(0);
  }

  /**
   * Stores the default color of a part in data/bt/part_default_color.csv.
   */
  public synchronized void setDefaultColor(String partNumber, Integer colorId) throws IOException {
    if (!isSafeId(partNumber)) {
      throw new IllegalArgumentException("Invalid part number: " + partNumber);
    }
    if (colorId == null || colorId < 0) {
      throw new IllegalArgumentException("Invalid color id: " + colorId);
    }
    if (!colors(partNumber).contains(colorId)) {
      throw new IllegalArgumentException(
          "Color " + colorId + " is not available for part " + partNumber);
    }

    Map<String, Integer> defaults = new LinkedHashMap<>(defaultColors());
    if (Objects.equals(defaults.get(partNumber), colorId)) {
      return;
    }
    defaults.put(partNumber, colorId);

    List<Map<String, String>> rows = new ArrayList<>();
    defaults.entrySet().stream()
        .sorted(Map.Entry.comparingByKey(String.CASE_INSENSITIVE_ORDER))
        .forEach(entry -> {
          Map<String, String> row = new LinkedHashMap<>();
          row.put("PartNumber", entry.getKey());
          row.put("ColorId", String.valueOf(entry.getValue()));
          rows.add(row);
        });
    Csv.write(defaultColorFile, DEFAULT_COLOR_HEADERS, rows);
    defaultColorCache = null;
    defaultColorCacheModified = Long.MIN_VALUE;
  }

  /**
   * Returns the missing part image stored in data/other/partimg, if it exists.
   */
  public Optional<Path> missingImage() {
    Path image = imagesDir.resolve(MISSING_IMAGE);
    return Files.isRegularFile(image) ? Optional.of(image) : Optional.empty();
  }

  /**
   * Returns the image matching a Lego item number (element id). The part and color are read from
   * data/bt/part_color_url.csv.
   */
  public synchronized Optional<Path> ensureByItemNumber(String itemNumber)
      throws IOException, InterruptedException {
    if (!isSafeId(itemNumber)) {
      throw new IllegalArgumentException("Invalid item number: " + itemNumber);
    }
    urls();
    PartColorKey partColor = itemCache.get(itemNumber);
    if (partColor == null) {
      return Optional.empty();
    }
    return ensure(partColor.partNumber(), partColor.colorId());
  }

  public FileSystemResource resource(Path image) {
    return new FileSystemResource(image);
  }

  public String contentType(Path image) {
    String name = image.getFileName().toString();
    String extension = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    return CONTENT_TYPES.getOrDefault(extension, "application/octet-stream");
  }

  private Optional<String> imageUrl(String partNumber, int colorId) throws IOException {
    return Optional.ofNullable(urls().get(key(partNumber, String.valueOf(colorId))));
  }

  private Map<String, Integer> defaultColors() throws IOException {
    long modified = Files.isRegularFile(defaultColorFile)
        ? Files.getLastModifiedTime(defaultColorFile).toMillis() : -1;
    if (defaultColorCache == null || modified != defaultColorCacheModified) {
      Map<String, Integer> defaults = new HashMap<>();
      for (Map<String, String> row : Csv.read(defaultColorFile)) {
        String partNumber = clean(row.get("PartNumber"));
        String colorId = clean(row.get("ColorId"));
        if (!partNumber.isEmpty() && !colorId.isEmpty()) {
          defaults.put(partNumber, toInt(colorId));
        }
      }
      defaultColorCache = defaults;
      defaultColorCacheModified = modified;
    }
    return defaultColorCache;
  }

  private Map<String, String> urls() throws IOException {
    long modified = Files.isRegularFile(partColorUrlFile)
        ? Files.getLastModifiedTime(partColorUrlFile).toMillis() : -1;
    if (urlCache == null || modified != urlCacheModified) {
      Map<String, String> urls = new HashMap<>();
      Map<String, TreeSet<Integer>> colors = new HashMap<>();
      Map<String, PartColorKey> items = new HashMap<>();
      for (Map<String, String> row : Csv.read(partColorUrlFile)) {
        String partNumber = clean(row.get("PartNumber"));
        String colorId = clean(row.get("ColorId"));
        String itemNumber = clean(row.get("ItemNumber"));
        String url = clean(row.get("ImgUrl"));
        if (!partNumber.isEmpty() && !colorId.isEmpty() && !url.isEmpty()) {
          int color = toInt(colorId);
          urls.put(key(partNumber, colorId), url);
          colors.computeIfAbsent(partNumber, key -> new TreeSet<>()).add(color);
          if (!itemNumber.isEmpty()) {
            items.putIfAbsent(itemNumber, new PartColorKey(partNumber, color));
          }
        }
      }
      Map<String, List<Integer>> colorLists = new HashMap<>();
      colors.forEach((partNumber, values) -> colorLists.put(partNumber, List.copyOf(values)));
      urlCache = urls;
      colorsCache = colorLists;
      itemCache = items;
      urlCacheModified = modified;
    }
    return urlCache;
  }

  private void pauseBeforeDownload() throws InterruptedException {
    long wait = lastDownloadEndedAt + DOWNLOAD_DELAY_MS - System.currentTimeMillis();
    if (wait > 0) {
      Thread.sleep(wait);
    }
  }

  private static boolean isSafeId(String value) {
    return value != null
        && PART_NUMBER.matcher(value).matches()
        && !value.contains("..");
  }

  private static String itemNumber(String url) {
    int slash = url.lastIndexOf('/');
    int dot = url.lastIndexOf('.');
    int start = slash + 1;
    int end = dot > slash ? dot : url.length();
    return url.substring(start, end);
  }

  private static String extensionOf(String url) {
    String path = url.contains("://") ? URI.create(url).getPath() : url;
    int dot = path.lastIndexOf('.');
    String extension = dot < 0 ? "" : path.substring(dot + 1).toLowerCase(Locale.ROOT);
    return extension.equals("png") ? "png" : DEFAULT_EXTENSION;
  }

  private static String key(String partNumber, String colorId) {
    return partNumber + '\u0000' + colorId;
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }

  private static int toInt(String value) {
    try {
      return value == null || value.isBlank() ? 0 : Integer.parseInt(value.trim());
    } catch (NumberFormatException e) {
      return 0;
    }
  }
}
