package com.bricktools.setimg;

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
import java.util.HashSet;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Stream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

@Service
public class SetImageService {

  private static final Pattern SET_NUMBER = Pattern.compile("[A-Za-z0-9-]+");
  private static final Map<String, String> CONTENT_TYPES = Map.of(
      "jpg", "image/jpeg",
      "jpeg", "image/jpeg",
      "png", "image/png",
      "webp", "image/webp",
      "gif", "image/gif");
  private static final String DEFAULT_EXTENSION = "jpg";

  private final Path imagesDir;
  private final Path setsFile;
  private final HttpClient http = HttpClient.newBuilder().followRedirects(HttpClient.Redirect.NORMAL).build();

  public SetImageService(BrickToolsProperties props) {
    this.imagesDir = props.dataPath().resolve("bt/setsimg");
    this.setsFile = props.dataPath().resolve("re/sets.csv");
  }

  public synchronized Optional<Path> find(String setNumber) throws IOException {
    if (setNumber == null || !SET_NUMBER.matcher(setNumber).matches() || !Files.isDirectory(imagesDir)) {
      return Optional.empty();
    }
    try (Stream<Path> files = Files.list(imagesDir)) {
      return files.filter(p -> isImage(p) && setNumberOf(p).equals(setNumber)).findFirst();
    }
  }

  public synchronized Set<String> available() throws IOException {
    Set<String> numbers = new HashSet<>();
    if (Files.isDirectory(imagesDir)) {
      try (Stream<Path> files = Files.list(imagesDir)) {
        files.filter(SetImageService::isImage).map(SetImageService::setNumberOf).forEach(numbers::add);
      }
    }
    return numbers;
  }

  public synchronized boolean hasImageUrl(String setNumber) throws IOException {
    return imageUrl(setNumber).isPresent();
  }

  public synchronized Optional<Path> ensure(String setNumber) throws IOException, InterruptedException {
    if (setNumber == null || !SET_NUMBER.matcher(setNumber).matches()) {
      throw new IllegalArgumentException("Invalid set number: " + setNumber);
    }
    Optional<Path> existing = find(setNumber);
    if (existing.isPresent()) {
      return existing;
    }
    Optional<String> url = imageUrl(setNumber);
    if (url.isEmpty()) {
      return Optional.empty();
    }

    Path target = imagesDir.resolve(setNumber + "." + extensionOf(url.get()));
    Path partial = imagesDir.resolve(setNumber + ".part");
    Files.createDirectories(imagesDir);
    try {
      HttpRequest request = HttpRequest.newBuilder(URI.create(url.get())).build();
      HttpResponse<Path> response = http.send(request, HttpResponse.BodyHandlers.ofFile(partial));
      if (response.statusCode() != 200) {
        throw new IOException("Set image download failed with HTTP " + response.statusCode());
      }
      Files.move(partial, target, StandardCopyOption.REPLACE_EXISTING);
    } finally {
      Files.deleteIfExists(partial);
    }
    return Optional.of(target);
  }

  public FileSystemResource resource(Path image) {
    return new FileSystemResource(image);
  }

  public String contentType(Path image) {
    String name = image.getFileName().toString();
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    return CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
  }

  private Optional<String> imageUrl(String setNumber) throws IOException {
    String rebrickableNumber = setNumber + "-1";
    for (Map<String, String> set : Csv.read(setsFile)) {
      if (rebrickableNumber.equals(set.get("set_num"))) {
        String url = set.get("img_url");
        return url == null || url.isBlank() ? Optional.empty() : Optional.of(url.trim());
      }
    }
    return Optional.empty();
  }

  private static boolean isImage(Path file) {
    String name = file.getFileName().toString();
    return CONTENT_TYPES.containsKey(name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT));
  }

  private static String setNumberOf(Path image) {
    String name = image.getFileName().toString();
    int dot = name.lastIndexOf('.');
    return dot < 0 ? name : name.substring(0, dot);
  }

  private static String extensionOf(String urlOrName) {
    String path = urlOrName.contains("://") ? URI.create(urlOrName).getPath() : urlOrName;
    int dot = path.lastIndexOf('.');
    if (dot < 0) {
      return DEFAULT_EXTENSION;
    }
    String ext = path.substring(dot + 1).toLowerCase(Locale.ROOT);
    return CONTENT_TYPES.containsKey(ext) ? ext : DEFAULT_EXTENSION;
  }
}
