package com.bricktools.setimg;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;

/**
 * Downloads a real set image from the Rebrickable CDN into a temporary folder, using the real sets.csv.
 * Run with: mvn test -Dlive=true -Dtest=SetImageLiveTest
 */
@EnabledIfSystemProperty(named = "live", matches = "true")
class SetImageLiveTest {

  @TempDir
  Path dir;

  @Test
  void downloadsRealSetImage() throws Exception {
    Files.createDirectories(dir.resolve("re"));
    Files.copy(Path.of("data/re/sets.csv"), dir.resolve("re/sets.csv"));
    SetImageService service = new SetImageService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")));

    Path image = service.ensure("75192").orElseThrow();

    assertThat(image.getFileName().toString()).isEqualTo("75192.jpg");
    byte[] bytes = Files.readAllBytes(image);
    assertThat(bytes.length).isGreaterThan(1000);
    assertThat(bytes[0]).isEqualTo((byte) 0xFF);
    assertThat(bytes[1]).isEqualTo((byte) 0xD8);
  }
}
