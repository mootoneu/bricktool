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
    Files.createDirectories(dir.resolve("re"));
    Files.writeString(dir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n"
            + "3003,Brick 2 x 2,11,Plastic\n");
    Files.writeString(dir.resolve("re/part_categories.csv"),
        "id,name\n"
            + "11,Bricks\n");
    Files.writeString(dir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans,num_parts,num_sets,y1,y2\n"
            + "1,White,FFFFFF,False,0,0,0,0\n"
            + "5,Red,C91A09,False,0,0,0,0\n");
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

  @Test
  void createPartAddsThePartAndListsTheCatalogInformation() throws IOException {
    int purchaseId = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));

    int partId = service.createPart(purchaseId, new PabPartRequest("3001", 5, 20));

    assertThat(partId).isEqualTo(1);
    assertThat(Files.readString(dir.resolve("bt/pab_parts.csv")))
        .startsWith("Id,PaBPurchaseId,PartNumber,PartColor,Quantity")
        .contains("1," + purchaseId + ",3001,5,20");

    List<Map<String, Object>> parts = service.parts(purchaseId);
    assertThat(parts).hasSize(1);
    assertThat(parts.get(0))
        .containsEntry("id", 1)
        .containsEntry("paBPurchaseId", purchaseId)
        .containsEntry("partNumber", "3001")
        .containsEntry("partColor", 5)
        .containsEntry("quantity", 20)
        .containsEntry("partName", "Brick 2 x 4")
        .containsEntry("partCategory", "Bricks")
        .containsEntry("colorName", "Red")
        .containsEntry("colorRgb", "C91A09");
  }

  @Test
  void partsAreFilteredByPurchase() throws IOException {
    int first = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));
    int second = service.create(new PabPurchaseRequest("2026/02/04", 1, BigDecimal.ONE));
    service.createPart(first, new PabPartRequest("3001", 5, 2));
    service.createPart(second, new PabPartRequest("3002", 1, 7));

    assertThat(service.parts(first)).extracting("partNumber").containsExactly("3001");
    assertThat(service.parts(second)).extracting("partNumber").containsExactly("3002");
  }

  @Test
  void updatePartChangesThePartAndKeepsThePurchase() throws IOException {
    int purchaseId = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));
    int partId = service.createPart(purchaseId, new PabPartRequest("3001", 5, 2));

    service.updatePart(partId, new PabPartRequest("3002", 1, 9));

    assertThat(service.parts(purchaseId).get(0))
        .containsEntry("id", partId)
        .containsEntry("paBPurchaseId", purchaseId)
        .containsEntry("partNumber", "3002")
        .containsEntry("partColor", 1)
        .containsEntry("quantity", 9)
        .containsEntry("partName", "Brick 2 x 3")
        .containsEntry("colorName", "White");
  }

  @Test
  void invalidPartIsRejected() throws IOException {
    int purchaseId = service.create(new PabPurchaseRequest("2026/02/03", 1, BigDecimal.TEN));

    assertThatThrownBy(() -> service.createPart(42, new PabPartRequest("3001", 5, 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown PaB purchase id");
    assertThatThrownBy(() -> service.createPart(purchaseId, new PabPartRequest("9999", 5, 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown part number");
    assertThatThrownBy(() -> service.createPart(purchaseId, new PabPartRequest("3001", 99, 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown part color");
    assertThatThrownBy(() -> service.createPart(purchaseId, new PabPartRequest("3001", 5, 0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Quantity");
  }

  @Test
  void updatePartRejectsUnknownIds() {
    assertThatThrownBy(() -> service.updatePart(42, new PabPartRequest("3001", 5, 1)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown PaB part id");
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
