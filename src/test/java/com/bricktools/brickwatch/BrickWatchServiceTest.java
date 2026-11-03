package com.bricktools.brickwatch;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import com.bricktools.support.TestHttpServer;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BrickWatchServiceTest {

  private static final String PAGE = """
      <html><head><meta charset="UTF-8"></head><body>
      <table><tr><td>Other</td><td>1 €</td></tr></table>
      <table>
        <tr><th>Information sur le prix</th><th></th></tr>
        <tr><td>Lego prix conseillé</td><td>Prix</td><td>849,99 €</td></tr>
      </table>
      </body></html>
      """;

  @TempDir
  Path dir;

  TestHttpServer server;

  @BeforeEach
  void startServer() throws IOException {
    server = new TestHttpServer();
  }

  @AfterEach
  void stopServer() {
    server.close();
  }

  private BrickWatchService service(long minDelayMs) {
    BrickToolsProperties props = new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch(server.baseUrl() + "/fr-FR/set/", minDelayMs),
        new BrickToolsProperties.BrickOwl("", ""));
    return new BrickWatchService(props);
  }

  @Test
  void parsesFrenchPriceFormat() {
    assertThat(BrickWatchService.parsePrice("849,99 €")).isEqualByComparingTo("849.99");
    assertThat(BrickWatchService.parsePrice("1 299,50 €")).isEqualByComparingTo("1299.50");
  }

  @Test
  void unparseablePriceIsNull() {
    assertThat(BrickWatchService.parsePrice("n/a")).isNull();
    assertThat(BrickWatchService.parsePrice("")).isNull();
  }

  @Test
  void returnsStoredPriceWithoutCallingBrickWatch() throws IOException, InterruptedException {
    Path prices = dir.resolve("bw/setprices.csv");
    Csv.write(prices, java.util.List.of("SetNumber", "LegoPrice"), java.util.List.of(Map.of("SetNumber", "75192", "LegoPrice", "849.99")));

    Map<String, Object> result = service(1000).price("75192");

    assertThat(result).containsEntry("source", "stored");
    assertThat((BigDecimal) result.get("legoPrice")).isEqualByComparingTo("849.99");
  }

  @Test
  void scrapesPriceAndStoresItWhenNotKnown() throws IOException, InterruptedException {
    server.respond("/fr-FR/set/75192", "text/html; charset=UTF-8", PAGE);

    Map<String, Object> result = service(0).price("75192");

    assertThat(result).containsEntry("source", "brickwatch").containsEntry("setNumber", "75192");
    assertThat((BigDecimal) result.get("legoPrice")).isEqualByComparingTo("849.99");

    String stored = Files.readString(dir.resolve("bw/setprices.csv"));
    assertThat(stored).contains("75192,849.99");
  }

  @Test
  void secondLookupIsServedFromStorage() throws IOException, InterruptedException {
    server.respond("/fr-FR/set/75192", "text/html; charset=UTF-8", PAGE);
    BrickWatchService service = service(0);

    service.price("75192");
    Map<String, Object> second = service.price("75192");

    assertThat(second).containsEntry("source", "stored");
  }

  @Test
  void pageWithoutPriceTableFails() {
    server.respond("/fr-FR/set/99999", "text/html; charset=UTF-8", "<html><body>Nothing</body></html>");

    assertThatThrownBy(() -> service(0).price("99999"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("99999");
  }

  @Test
  void rejectsInvalidSetNumbers() {
    assertThatThrownBy(() -> service(0).price("../etc/passwd"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void enforcesDelayBetweenRequests() throws IOException, InterruptedException {
    server.respond("/fr-FR/set/1001", "text/html; charset=UTF-8", PAGE);
    server.respond("/fr-FR/set/1002", "text/html; charset=UTF-8", PAGE);
    BrickWatchService service = service(300);

    long start = System.nanoTime();
    service.price("1001");
    service.price("1002");
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertThat(elapsedMs).isGreaterThanOrEqualTo(280);
  }
}
