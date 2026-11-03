package com.bricktools.brickwatch;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.junit.jupiter.api.condition.EnabledIfSystemProperty;

/**
 * Hits the real BrickWatch site. Run with: mvn test -Dlive=true -Dtest=BrickWatchLiveTest
 */
@EnabledIfSystemProperty(named = "live", matches = "true")
class BrickWatchLiveTest {

  @TempDir
  Path dir;

  private BrickWatchService service() {
    return new BrickWatchService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("https://www.brickwatch.net/fr-FR/set/", 1000),
        new BrickToolsProperties.BrickOwl("", "")));
  }

  @Test
  void fetchesOfficialPriceForRedirectingSet() throws Exception {
    Map<String, Object> result = service().price("31387");

    assertThat(result).containsEntry("setNumber", "31387").containsEntry("source", "brickwatch");
    assertThat((BigDecimal) result.get("legoPrice")).isPositive();
  }

  @Test
  void fetchesOfficialPriceForSecondSetAndStoresBoth() throws Exception {
    BrickWatchService service = service();

    Map<String, Object> first = service.price("75192");
    Map<String, Object> second = service.price("31387");

    assertThat((BigDecimal) first.get("legoPrice")).isPositive();
    assertThat((BigDecimal) second.get("legoPrice")).isPositive();
    assertThat(service.price("31387")).containsEntry("source", "stored");
  }
}
