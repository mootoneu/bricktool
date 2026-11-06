package com.bricktools.pab;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PabServiceTest {

  @TempDir
  Path dir;

  private PabService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("bt"));
    service = new PabService(props());
  }

  @Test
  void createWritesThePurchasesFileAndReturnsTheId() throws IOException {
    int id = service.create(new PabPurchaseRequest("2026/02/03", 2, new BigDecimal("24.90")));

    assertThat(id).isEqualTo(1);
    assertThat(Files.readString(dir.resolve("bt/pab_purchases.csv")))
        .startsWith("Id,PurchaseDate,BoxQuantity,Price")
        .contains("1,2026/02/03,2,24.9");

    assertThat(service.purchases().get(0))
        .containsEntry("id", 1)
        .containsEntry("purchaseDate", "2026/02/03")
        .containsEntry("boxQuantity", 2)
        .containsEntry("price", 24.9)
        .containsEntry("totalParts", 0);
  }

  @Test
  void totalPartsSumsTheQuantityOfRelatedParts() throws IOException {
    int first = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));
    int second = service.create(new PabPurchaseRequest("2026/02/04", 1, BigDecimal.ONE));
    Files.writeString(dir.resolve("bt/pab_parts.csv"),
        "Id,PaBPurchaseId,PartNumber,PartColor,Quantity\n"
            + "1," + first + ",3001,5,20\n"
            + "2," + first + ",3002,5,30\n"
            + "3," + second + ",3003,1,7\n");

    List<Map<String, Object>> purchases = service.purchases();

    assertThat(purchases.get(0)).containsEntry("totalParts", 50);
    assertThat(purchases.get(1)).containsEntry("totalParts", 7);
  }

  @Test
  void updateChangesThePurchaseAndKeepsItsId() throws IOException {
    int id = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));

    service.update(id, new PabPurchaseRequest("2026/03/04", 3, new BigDecimal("12.50")));

    assertThat(service.purchases().get(0))
        .containsEntry("id", id)
        .containsEntry("purchaseDate", "2026/03/04")
        .containsEntry("boxQuantity", 3)
        .containsEntry("price", 12.5);
  }

  @Test
  void invalidPurchaseIsRejected() throws IOException {
    assertThatThrownBy(() -> service.create(new PabPurchaseRequest("03/02/2026", 1, BigDecimal.TEN)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("date");
    assertThatThrownBy(() -> service.create(new PabPurchaseRequest("2026/02/03", 0, BigDecimal.TEN)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Box quantity");
    assertThatThrownBy(() -> service.create(new PabPurchaseRequest("2026/02/03", 1, new BigDecimal("-1"))))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Price");
  }

  @Test
  void updateRejectsUnknownIds() {
    assertThatThrownBy(() -> service.update(42, new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown PaB purchase id");
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
