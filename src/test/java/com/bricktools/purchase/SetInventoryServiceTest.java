package com.bricktools.purchase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SetInventoryServiceTest {

  @TempDir
  Path dir;

  private SetInventoryService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bt"));
    Files.writeString(dir.resolve("re/inventories.csv"),
        "id,version,set_num\n"
            + "1,1,7922-1\n"
            + "2,1,100-1\n"
            + "3,2,100-1\n"
            + "4,1,200-1\n");
    Files.writeString(dir.resolve("re/inventory_parts.csv"),
        "inventory_id,part_num,color_id,quantity,is_spare,img_url\n"
            + "1,3001,5,2,False,https://example.test/3001-5.jpg\n"
            + "1,3001,5,1,True,https://example.test/3001-5.jpg\n"
            + "1,3002,1,4,False,https://example.test/3002-1.jpg\n"
            + "2,3001,5,5,False,https://example.test/3001-5.jpg\n"
            + "3,3001,5,7,False,https://example.test/3001-5.jpg\n"
            + "4,3003,2,1,False,\n");
    Files.writeString(dir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Plate 2 x 4,11,Plastic\n"
            + "3003,Brick 2 x 2,11,Plastic\n");
    Files.writeString(dir.resolve("re/part_categories.csv"), "id,name\n11,Bricks\n");
    Files.writeString(dir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans\n"
            + "1,White,FFFFFF,False\n"
            + "2,Tan,E4CD9E,False\n"
            + "5,Red,C91A09,False\n");

    service = new SetInventoryService(
        new BrickToolsProperties(dir.toString(), null, null, null));
  }

  @Test
  void listAggregatesExpectedQuantitiesAndDefaultsActualToZero() throws IOException {
    List<Map<String, Object>> rows = service.list("7922");

    assertThat(rows).hasSize(2);
    assertThat(rows.get(0))
        .containsEntry("partNumber", "3001")
        .containsEntry("colorId", 5)
        .containsEntry("expectedQut", 3)
        .containsEntry("actualQut", 0)
        .containsEntry("partName", "Brick 2 x 4")
        .containsEntry("partCategory", "Bricks")
        .containsEntry("colorName", "Red")
        .containsEntry("colorRgb", "C91A09");
    assertThat(rows.get(1))
        .containsEntry("partNumber", "3002")
        .containsEntry("expectedQut", 4);
  }

  @Test
  void listUsesTheHighestVersionInventoryOfASet() throws IOException {
    List<Map<String, Object>> rows = service.list("100");

    assertThat(rows).hasSize(1);
    assertThat(rows.get(0)).containsEntry("partNumber", "3001").containsEntry("expectedQut", 7);
  }

  @Test
  void setNumberWithVariantIsAccepted() throws IOException {
    assertThat(service.list("7922-1")).hasSize(2);
  }

  @Test
  void listReturnsEmptyWhenTheSetHasNoInventory() throws IOException {
    assertThat(service.list("9999")).isEmpty();
  }

  @Test
  void updateActualCreatesThenUpdatesTheStoredRow() throws IOException {
    service.updateActual("7922", "3001", 5, 2);

    assertThat(Files.readString(dir.resolve("bt/SetInventory.csv")))
        .contains("SetNumber,PartNumber,ColorId,ExpectedQut,ActualQut")
        .contains("7922,3001,5,3,2");
    assertThat(service.list("7922").get(0)).containsEntry("actualQut", 2);

    service.updateActual("7922", "3001", 5, 1);

    assertThat(Files.readString(dir.resolve("bt/SetInventory.csv")))
        .contains("7922,3001,5,3,1");
    assertThat(service.list("7922").get(0)).containsEntry("actualQut", 1);
  }

  @Test
  void updateActualRejectsUnknownPartAndNegativeQuantity() {
    assertThatThrownBy(() -> service.updateActual("7922", "3001", 9, 1))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not in set");
    assertThatThrownBy(() -> service.updateActual("7922", "3001", 5, -1))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("non-negative");
  }

  @Test
  void clearResetsTheStoredActualQuantities() throws IOException {
    assertThat(service.clear("7922")).isZero();
    assertThat(Files.exists(dir.resolve("bt/SetInventory.csv"))).isFalse();

    service.updateActual("7922", "3001", 5, 2);
    service.updateActual("7922", "3002", 1, 4);

    assertThat(service.clear("7922")).isEqualTo(2);
    assertThat(Files.readString(dir.resolve("bt/SetInventory.csv")))
        .contains("7922,3001,5,3,0")
        .contains("7922,3002,1,4,0");
    assertThat(service.list("7922")).allSatisfy(row -> assertThat(row).containsEntry("actualQut", 0));
  }

  @Test
  void fillStoresEveryExpectedPartAtItsExpectedQuantity() throws IOException {
    assertThat(service.fill("7922")).isEqualTo(2);

    assertThat(Files.readString(dir.resolve("bt/SetInventory.csv")))
        .contains("7922,3001,5,3,3")
        .contains("7922,3002,1,4,4");
    assertThat(service.list("7922")).allSatisfy(row ->
        assertThat(row).containsEntry("actualQut", row.get("expectedQut")));

    service.updateActual("7922", "3001", 5, 1);
    service.fill("7922");

    assertThat(service.list("7922").get(0)).containsEntry("actualQut", 3);
  }

  @Test
  void deleteRemovesOnlyTheRowsOfTheSet() throws IOException {
    service.fill("7922");
    service.fill("200");

    assertThat(service.delete("7922")).isEqualTo(2);

    String content = Files.readString(dir.resolve("bt/SetInventory.csv"));
    assertThat(content).doesNotContain("7922,");
    assertThat(content).contains("200,3003,2,1,1");
    assertThat(service.delete("7922")).isZero();
  }

  @Test
  void expectedPartsAreRecomputedWhenTheInventoryFileChanges() throws IOException {
    assertThat(service.list("7922").get(0)).containsEntry("expectedQut", 3);

    String inventory = "inventory_id,part_num,color_id,quantity,is_spare,img_url\n"
        + "1,3001,5,9,False,https://example.test/3001-5.jpg\n"
        + "1,3002,1,4,False,https://example.test/3002-1.jpg\n";
    Files.writeString(dir.resolve("re/inventory_parts.csv"), inventory, StandardCharsets.UTF_8);

    assertThat(service.list("7922").get(0)).containsEntry("expectedQut", 9);
  }
}
