package com.bricktools.backup;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardOpenOption;
import java.time.LocalDateTime;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import java.util.stream.Stream;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;
import org.springframework.stereotype.Service;

/**
 * Creates zip backups of the data created locally. Downloaded data (Rebrickable files, images) is not backed up.
 */
@Service
public class BackupService {

  static final List<String> INCLUDED = List.of(
      "bt/purchased_sets.csv",
      "bt/wishlist.csv",
      "bt/state.properties",
      "bt/themes.csv",
      "bt/theme_colors.csv",
      "bt/part_default_color.csv",
      "bw/setprices.csv",
      "bo/orders.csv",
      "bo/order_items.csv",
      "other/people/people.csv",
      "other/vendor/vendors.csv");
  static final int KEEP = 3;

  private static final String PREFIX = "backup-";
  private static final String SUFFIX = ".zip";
  private static final DateTimeFormatter STAMP = DateTimeFormatter.ofPattern("yyyyMMdd-HHmmss");

  private final Path dataDir;
  private final Path backupsDir;

  public BackupService(BrickToolsProperties props) {
    this.dataDir = props.dataPath();
    this.backupsDir = dataDir.resolve("backups");
  }

  public synchronized Map<String, Object> create() throws IOException {
    Files.createDirectories(backupsDir);
    String name = PREFIX + LocalDateTime.now().format(STAMP) + SUFFIX;
    Path target = backupsDir.resolve(name);
    List<String> files = new ArrayList<>();
    try (ZipOutputStream zip = new ZipOutputStream(Files.newOutputStream(target, StandardOpenOption.CREATE_NEW))) {
      for (String relative : INCLUDED) {
        Path file = dataDir.resolve(relative);
        if (!Files.isRegularFile(file)) {
          continue;
        }
        zip.putNextEntry(new ZipEntry(relative));
        Files.copy(file, zip);
        zip.closeEntry();
        files.add(relative);
      }
    } catch (IOException | RuntimeException e) {
      Files.deleteIfExists(target);
      throw e;
    }
    if (files.isEmpty()) {
      Files.deleteIfExists(target);
      throw new IllegalStateException("No data to back up");
    }
    prune();
    return Map.of("name", name, "files", files);
  }

  public synchronized List<Map<String, Object>> list() throws IOException {
    List<Map<String, Object>> backups = new ArrayList<>();
    for (Path backup : backups()) {
      backups.add(Map.of("name", backup.getFileName().toString(), "size", Files.size(backup)));
    }
    return backups;
  }

  private void prune() throws IOException {
    List<Path> backups = backups();
    for (Path old : backups.subList(Math.min(KEEP, backups.size()), backups.size())) {
      Files.deleteIfExists(old);
    }
  }

  /** Backups sorted from the most recent to the oldest, relying on the sortable timestamp in their names. */
  private List<Path> backups() throws IOException {
    if (!Files.isDirectory(backupsDir)) {
      return List.of();
    }
    try (Stream<Path> files = Files.list(backupsDir)) {
      return files
          .filter(p -> p.getFileName().toString().startsWith(PREFIX)
              && p.getFileName().toString().endsWith(SUFFIX))
          .sorted((a, b) -> b.getFileName().toString().compareTo(a.getFileName().toString()))
          .toList();
    }
  }
}
