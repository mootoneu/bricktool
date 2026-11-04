package com.bricktools.backup;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.stream.Collectors;
import java.util.zip.ZipFile;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BackupServiceTest {

  @TempDir
  Path dir;

  private BackupService service() {
    return new BackupService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")));
  }

  private void write(String relative) throws IOException {
    Path file = dir.resolve(relative);
    Files.createDirectories(file.getParent());
    Files.writeString(file, "data", StandardCharsets.UTF_8);
  }

  @Test
  void backsUpOnlyLocallyCreatedFiles() throws IOException {
    write("bt/purchased_sets.csv");
    write("bw/setprices.csv");
    write("other/people/people.csv");
    write("re/sets.csv");
    write("le/themes/star-wars.svg");
    write("bt/setsimg/75192.jpg");
    write("other/people/Duncan.webp");

    Map<String, Object> result = service().create();

    Path zipFile = dir.resolve("backups").resolve((String) result.get("name"));
    try (ZipFile zip = new ZipFile(zipFile.toFile())) {
      List<String> entries = zip.stream().map(entry -> entry.getName()).collect(Collectors.toList());
      assertThat(entries).containsExactlyInAnyOrder(
          "bt/purchased_sets.csv", "bw/setprices.csv", "other/people/people.csv");
    }
    assertThat(result.get("files")).isEqualTo(List.of(
        "bt/purchased_sets.csv", "bw/setprices.csv", "other/people/people.csv"));
  }

  @Test
  void keepsOnlyTheThreeMostRecentBackups() throws IOException {
    write("bt/purchased_sets.csv");
    Path backups = dir.resolve("backups");
    Files.createDirectories(backups);
    for (String stamp : List.of("20200101-000000", "20200102-000000", "20200103-000000", "20200104-000000")) {
      Files.writeString(backups.resolve("backup-" + stamp + ".zip"), "old");
    }

    Map<String, Object> created = service().create();

    List<String> names = service().list().stream().map(b -> (String) b.get("name")).toList();
    assertThat(names).hasSize(3)
        .containsExactly((String) created.get("name"), "backup-20200104-000000.zip", "backup-20200103-000000.zip");
  }

  @Test
  void refusesToCreateEmptyBackup() {
    assertThatThrownBy(() -> service().create())
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("No data");
  }
}
