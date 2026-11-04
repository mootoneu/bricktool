package com.bricktools.brickonomics;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;
import org.junit.jupiter.api.io.TempDir;

/**
 * Hits the real Brickonomics site. Run with: mvn test -Dlive=true -Dtest=BrickonomicsLiveTest
 */
@EnabledIfSystemProperty(named = "live", matches = "true")
class BrickonomicsLiveTest {

  @TempDir
  Path dir;

  private BrickonomicsService service() {
    return new BrickonomicsService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")));
  }

  @Test
  void fetchesRetailPriceAndStoresIt() throws Exception {
    Map<String, Object> result = service().fetchPrice("75192");

    assertThat(result).containsEntry("setNumber", "75192").containsEntry("source", "brickonomics");
    assertThat((BigDecimal) result.get("legoPrice")).isPositive();
  }
}
