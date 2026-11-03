package com.bricktools.purchase;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import com.bricktools.other.OtherImageService;
import com.bricktools.setimg.SetImageService;
import com.bricktools.theme.ThemeImageService;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

@Service
public class PurchaseService {

  private static final List<String> HEADERS = List.of(
      "Id", "SetNumber", "PurchasePrice", "PurchaseDate", "Vendor", "BroughtBy", "Owner", "PartMissings", "Owned",
      "Reason");
  private static final Pattern DATE = Pattern.compile("\\d{4}/\\d{2}/\\d{2}");
  private static final Pattern SET_NUMBER = Pattern.compile("[A-Za-z0-9-]+");
  private static final Pattern COLOR = Pattern.compile("#[0-9A-Fa-f]{3,8}");
  private static final String VENDOR_IMAGE_BASE = "/api/vendorimg/";
  private static final String PEOPLE_IMAGE_BASE = "/api/peopleimg/";

  private static final Logger log = LoggerFactory.getLogger(PurchaseService.class);

  private final Path purchasesFile;
  private final Path setsFile;
  private final Path themesFile;
  private final Path themeDetailsFile;
  private final Path pricesFile;
  private final Path vendorImagesFile;
  private final Path peopleImagesFile;
  private final SetImageService setImages;
  private final ThemeImageService themeImages;
  private final OtherImageService otherImages;

  public PurchaseService(BrickToolsProperties props, SetImageService setImages, ThemeImageService themeImages,
                         OtherImageService otherImages) {
    Path data = props.dataPath();
    this.purchasesFile = data.resolve("bt/purchased_sets.csv");
    this.setsFile = data.resolve("re/sets.csv");
    this.themesFile = data.resolve("re/themes.csv");
    this.themeDetailsFile = data.resolve("bt/themes.csv");
    this.pricesFile = data.resolve("bw/setprices.csv");
    this.vendorImagesFile = data.resolve("other/vendor/vendors.csv");
    this.peopleImagesFile = data.resolve("other/people/people.csv");
    this.setImages = setImages;
    this.themeImages = themeImages;
    this.otherImages = otherImages;
  }

  public synchronized List<Map<String, Object>> list() throws IOException {
    Set<String> images = setImages.available();
    Map<String, Map<String, String>> sets = new HashMap<>();
    for (Map<String, String> set : Csv.read(setsFile)) {
      sets.put(set.get("set_num"), set);
    }
    Map<String, String> themes = new HashMap<>();
    for (Map<String, String> theme : Csv.read(themesFile)) {
      themes.put(theme.get("id"), theme.get("name"));
    }
    Map<String, Map<String, String>> themeDetails = new HashMap<>();
    for (Map<String, String> theme : Csv.read(themeDetailsFile)) {
      themeDetails.put(theme.get("id"), theme);
    }
    Set<String> availableThemeImages = themeImages.available();
    Map<String, String> vendorImages = imageUrls(vendorImagesFile, otherImages.available("vendor"), VENDOR_IMAGE_BASE);
    Map<String, String> peopleImages = imageUrls(peopleImagesFile, otherImages.available("people"), PEOPLE_IMAGE_BASE);
    Map<String, String> prices = new HashMap<>();
    for (Map<String, String> price : Csv.read(pricesFile)) {
      prices.put(price.get("SetNumber"), price.get("LegoPrice"));
    }

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> purchase : Csv.read(purchasesFile)) {
      String setNumber = clean(purchase.get("SetNumber"));
      Map<String, String> set = sets.getOrDefault(setNumber + "-1", Map.of());
      Integer numParts = toInt(set.get("num_parts"));
      int missing = Objects.requireNonNullElse(toInt(purchase.get("PartMissings")), 0);
      Double price = toDouble(purchase.get("PurchasePrice"));
      Double official = toDouble(prices.get(setNumber));
      Map<String, String> theme = themeDetails.getOrDefault(clean(set.get("theme_id")), Map.of());
      String themeImage = clean(theme.get("image"));
      String themeColor = clean(theme.get("color_primary"));
      String vendor = clean(purchase.get("Vendor"));
      String broughtBy = clean(purchase.get("BroughtBy"));
      String owner = clean(purchase.get("Owner"));

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", toInt(purchase.get("Id")));
      row.put("setNumber", setNumber);
      row.put("name", set.get("name"));
      row.put("numParts", numParts);
      row.put("year", toInt(set.get("year")));
      row.put("theme", themes.get(set.get("theme_id")));
      row.put("themeImageUrl",
          !themeImage.isEmpty() && availableThemeImages.contains(themeImage) ? "/api/themeimg/" + themeImage : null);
      row.put("themeColor", COLOR.matcher(themeColor).matches() ? themeColor : null);
      row.put("vendorImageUrl", vendorImages.get(key(vendor)));
      row.put("broughtByImageUrl", peopleImages.get(key(broughtBy)));
      row.put("ownerImageUrl", peopleImages.get(key(owner)));
      row.put("officialPrice", official);
      row.put("price", price);
      row.put("promo", price != null && official != null && official > 0 ? price / official * 100 : null);
      row.put("purchaseDate", clean(purchase.get("PurchaseDate")));
      row.put("vendor", vendor);
      row.put("broughtBy", broughtBy);
      row.put("owner", owner);
      row.put("partsMissing", missing);
      row.put("complete", numParts != null && numParts > 0 ? (1.0 - (double) missing / numParts) * 100 : null);
      row.put("owned", Boolean.parseBoolean(clean(purchase.get("Owned"))));
      row.put("reason", clean(purchase.get("Reason")));
      row.put("imageUrl", images.contains(setNumber) ? "/api/setimg/" + setNumber : null);
      result.add(row);
    }
    return result;
  }

  public synchronized List<String> setNumbers() throws IOException {
    Set<String> numbers = new TreeSet<>();
    for (Map<String, String> purchase : Csv.read(purchasesFile)) {
      String setNumber = clean(purchase.get("SetNumber"));
      if (!setNumber.isEmpty()) {
        numbers.add(setNumber);
      }
    }
    return List.copyOf(numbers);
  }

  public synchronized Map<String, List<String>> options() throws IOException {
    List<Map<String, String>> purchases = Csv.read(purchasesFile);
    Map<String, List<String>> options = new LinkedHashMap<>();
    options.put("vendors", distinct(purchases, "Vendor"));
    options.put("buyers", distinct(purchases, "BroughtBy"));
    options.put("owners", distinct(purchases, "Owner"));
    return options;
  }

  public synchronized int create(PurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = loadForWrite();
    int id = rows.stream()
        .map(r -> toInt(r.get("Id")))
        .filter(Objects::nonNull)
        .max(Integer::compare)
        .orElse(0) + 1;
    rows.add(toRow(id, request));
    Csv.write(purchasesFile, HEADERS, rows);
    fetchImage(clean(request.setNumber()));
    return id;
  }

  public synchronized void update(int id, PurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = loadForWrite();
    for (int i = 0; i < rows.size(); i++) {
      if (String.valueOf(id).equals(clean(rows.get(i).get("Id")))) {
        rows.set(i, toRow(id, request));
        Csv.write(purchasesFile, HEADERS, rows);
        fetchImage(clean(request.setNumber()));
        return;
      }
    }
    throw new IllegalArgumentException("Unknown purchase id " + id);
  }

  private void fetchImage(String setNumber) {
    try {
      setImages.ensure(setNumber);
    } catch (IOException e) {
      log.warn("Could not fetch the image of set {}: {}", setNumber, e.getMessage());
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      log.warn("Interrupted while fetching the image of set {}", setNumber);
    }
  }

  private List<Map<String, String>> loadForWrite() throws IOException {
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(purchasesFile)) {
      Map<String, String> cleaned = new LinkedHashMap<>();
      row.forEach((column, value) -> cleaned.put(column, clean(value)));
      rows.add(cleaned);
    }
    return rows;
  }

  private static Map<String, String> toRow(int id, PurchaseRequest request) {
    String setNumber = clean(request.setNumber());
    String date = clean(request.purchaseDate());
    if (setNumber.isEmpty()) {
      throw new IllegalArgumentException("Set number is required");
    }
    if (!SET_NUMBER.matcher(setNumber).matches()) {
      throw new IllegalArgumentException("Set number may only contain letters, digits and dashes");
    }
    if (!DATE.matcher(date).matches()) {
      throw new IllegalArgumentException("Purchase date must use the yyyy/MM/dd format");
    }
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", String.valueOf(id));
    row.put("SetNumber", setNumber);
    row.put("PurchasePrice", request.purchasePrice() == null ? "0" : request.purchasePrice().toPlainString());
    row.put("PurchaseDate", date);
    row.put("Vendor", clean(request.vendor()));
    row.put("BroughtBy", clean(request.broughtBy()));
    row.put("Owner", clean(request.owner()));
    row.put("PartMissings", String.valueOf(request.partMissings() == null ? 0 : request.partMissings()));
    row.put("Owned", String.valueOf(request.owned() == null || request.owned()));
    row.put("Reason", clean(request.reason()));
    return row;
  }

  private static List<String> distinct(List<Map<String, String>> rows, String column) {
    Set<String> values = new TreeSet<>();
    for (Map<String, String> row : rows) {
      String value = clean(row.get(column));
      if (!value.isEmpty()) {
        values.add(value);
      }
    }
    return List.copyOf(values);
  }

  private static Map<String, String> imageUrls(Path mappingFile, Set<String> available, String base)
      throws IOException {
    Map<String, String> urls = new HashMap<>();
    for (Map<String, String> mapping : Csv.read(mappingFile)) {
      String name = clean(mapping.get("name"));
      String image = clean(mapping.get("image"));
      if (!name.isEmpty() && available.contains(image)) {
        urls.putIfAbsent(key(name), base + image);
      }
    }
    return urls;
  }

  private static String key(String value) {
    return clean(value).toLowerCase(Locale.ROOT);
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }

  private static Integer toInt(String value) {
    try {
      return value == null || value.isBlank() ? null : Integer.valueOf(value.trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static Double toDouble(String value) {
    try {
      return value == null || value.isBlank() ? null : Double.valueOf(value.trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
