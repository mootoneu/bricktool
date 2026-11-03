package com.bricktools.other;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.regex.Pattern;
import java.util.stream.Collectors;
import java.util.stream.Stream;
import org.springframework.core.io.FileSystemResource;
import org.springframework.stereotype.Service;

@Service
public class OtherImageService {

  private static final Pattern IMAGE_NAME =
      Pattern.compile("[A-Za-z0-9._-]+\\.(?:svg|png|jpg|jpeg|webp|gif)");
  private static final Map<String, String> CONTENT_TYPES = Map.of(
      "svg", "image/svg+xml",
      "png", "image/png",
      "jpg", "image/jpeg",
      "jpeg", "image/jpeg",
      "webp", "image/webp",
      "gif", "image/gif");

  private final Map<String, Path> folders;

  public OtherImageService(BrickToolsProperties props) {
    Path other = props.dataPath().resolve("other");
    this.folders = Map.of(
        "vendor", other.resolve("vendor"),
        "people", other.resolve("people"));
  }

  public synchronized Optional<Path> find(String category, String imageName) {
    Path folder = folders.get(category);
    if (folder == null || imageName == null || !IMAGE_NAME.matcher(imageName).matches()) {
      return Optional.empty();
    }
    Path image = folder.resolve(imageName).normalize();
    if (!image.startsWith(folder.normalize()) || !Files.isRegularFile(image)) {
      return Optional.empty();
    }
    return Optional.of(image);
  }

  public synchronized Set<String> available(String category) throws IOException {
    Path folder = folders.get(category);
    if (folder == null || !Files.isDirectory(folder)) {
      return Set.of();
    }
    try (Stream<Path> files = Files.list(folder)) {
      return files.filter(Files::isRegularFile)
          .map(file -> file.getFileName().toString())
          .filter(name -> IMAGE_NAME.matcher(name).matches())
          .collect(Collectors.toUnmodifiableSet());
    }
  }

  public FileSystemResource resource(Path image) {
    return new FileSystemResource(image);
  }

  public String contentType(Path image) {
    String name = image.getFileName().toString();
    String ext = name.substring(name.lastIndexOf('.') + 1).toLowerCase(Locale.ROOT);
    return CONTENT_TYPES.getOrDefault(ext, "application/octet-stream");
  }
}
