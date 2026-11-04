package com.bricktools.brickonomics;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import com.bricktools.support.TestHttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class BrickonomicsServiceTest {

  private static final String PAGE = """
      <html><body>
      <div class="py-3"><h2 class="h4">Set details</h2>
      <b>Name:</b> Millennium Falcon<br/>
      <b>Number of parts:</b> 7541<br/>
      <b>Retail price:</b> €849.99<br/>
      <b>Retirement date:</b> 31-12-2026
      </div>
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

  private BrickonomicsService service() {
    BrickToolsProperties props = new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
    return new BrickonomicsService(props, server.baseUrl() + "/set/");
  }

  @Test
  void parsesRetailPriceWithDotDecimal() {
    assertThat(BrickonomicsService.parsePrice("€849.99")).isEqualByComparingTo("849.99");
    assertThat(BrickonomicsService.parsePrice("n/a")).isNull();
  }

  @Test
  void fetchesRetailPriceWithFrenchEuroCookiesAndStoresIt() throws IOException, InterruptedException {
    String[] cookie = new String[1];
    server.handle("/set/75192-1", exchange -> {
      cookie[0] = exchange.getRequestHeaders().getFirst("Cookie");
      byte[] bytes = PAGE.getBytes(StandardCharsets.UTF_8);
      exchange.getResponseHeaders().add("Content-Type", "text/html; charset=UTF-8");
      exchange.sendResponseHeaders(200, bytes.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(bytes);
      }
    });

    Map<String, Object> result = service().fetchPrice("75192");

    assertThat(result).containsEntry("source", "brickonomics").containsEntry("setNumber", "75192");
    assertThat((BigDecimal) result.get("legoPrice")).isEqualByComparingTo("849.99");
    assertThat(cookie[0]).contains("country=fr").contains("currency=EUR");
    assertThat(Files.readString(dir.resolve("bw/setprices.csv"))).contains("75192,849.99");
  }

  @Test
  void replacesExistingPriceOfTheSameSet() throws IOException, InterruptedException {
    Path prices = dir.resolve("bw/setprices.csv");
    Csv.write(prices, List.of("SetNumber", "LegoPrice"), List.of(
        Map.of("SetNumber", "75192", "LegoPrice", "799.00"),
        Map.of("SetNumber", "31387", "LegoPrice", "99.99")));
    server.respond("/set/75192-1", "text/html; charset=UTF-8", PAGE);

    service().fetchPrice("75192-1");

    List<Map<String, String>> rows = Csv.read(prices);
    assertThat(rows).hasSize(2);
    assertThat(rows).anyMatch(r -> "75192".equals(r.get("SetNumber")) && "849.99".equals(r.get("LegoPrice")));
    assertThat(rows).anyMatch(r -> "31387".equals(r.get("SetNumber")) && "99.99".equals(r.get("LegoPrice")));
  }

  @Test
  void pageWithoutRetailPriceFails() {
    server.respond("/set/99999-1", "text/html; charset=UTF-8", "<html><body>Nothing</body></html>");

    assertThatThrownBy(() -> service().fetchPrice("99999"))
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("99999");
  }

  @Test
  void rejectsInvalidSetNumbers() {
    assertThatThrownBy(() -> service().fetchPrice("../etc/passwd"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void waitsOneSecondBetweenRequests() throws IOException, InterruptedException {
    server.respond("/set/1001-1", "text/html; charset=UTF-8", PAGE);
    server.respond("/set/1002-1", "text/html; charset=UTF-8", PAGE);
    BrickonomicsService service = service();

    long start = System.nanoTime();
    service.fetchPrice("1001");
    service.fetchPrice("1002");
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertThat(elapsedMs).isGreaterThanOrEqualTo(990);
  }
}
