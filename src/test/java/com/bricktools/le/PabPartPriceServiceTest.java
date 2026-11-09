package com.bricktools.le;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PabPartPriceServiceTest {

  @TempDir
  Path dir;

  private PabPartPriceService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("le"));
    Files.writeString(dir.resolve("le/pab_part_prices.csv"),
        "DesignId,ColorId,Price\n"
            + "18980,26,0.18\n"
            + "18980,1,0.18\n"
            + "3001,5,0.12\n");
    service = new PabPartPriceService(props());
  }

  @Test
  void pricesReturnsTheWholeFile() throws IOException {
    assertThat(service.prices())
        .containsExactly(
            row("18980", 26, 0.18),
            row("18980", 1, 0.18),
            row("3001", 5, 0.12));
  }

  @Test
  void pricesFiltersByDesignIdAndFormatsEuros() throws IOException {
    assertThat(service.prices("18980"))
        .containsEntry(26, "0,18 €")
        .containsEntry(1, "0,18 €")
        .hasSize(2);
    assertThat(service.prices("3001"))
        .containsEntry(5, "0,12 €")
        .hasSize(1);
  }

  @Test
  void duplicateColorKeepsTheLowestPrice() throws IOException {
    Files.writeString(dir.resolve("le/pab_part_prices.csv"),
        "DesignId,ColorId,Price\n"
            + "49612,0,0.58\n"
            + "49612,0,1.14\n");

    assertThat(service.prices("49612"))
        .containsEntry(0, "0,58 €")
        .hasSize(1);
  }

  @Test
  void unknownDesignIdReturnsNoPrices() throws IOException {
    assertThat(service.prices("9999")).isEmpty();
  }

  @Test
  void missingFileReturnsNoPrices() throws IOException {
    Files.delete(dir.resolve("le/pab_part_prices.csv"));

    assertThat(service.prices()).isEmpty();
    assertThat(service.prices("18980")).isEmpty();
  }

  private static java.util.Map<String, Object> row(String designId, int colorId, double price) {
    java.util.Map<String, Object> row = new java.util.LinkedHashMap<>();
    row.put("designId", designId);
    row.put("colorId", colorId);
    row.put("price", price);
    return row;
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
