package com.bricktools.storage;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PartStorageServiceTest {

  @TempDir
  Path dir;

  private PartStorageService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("bt"));
    Files.createDirectories(dir.resolve("re"));
    Files.writeString(dir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n"
            + "3003,Plate 1 x 2,12,Plastic\n"
            + "87079pr0001,Tile 2 x 4 with Print,12,Plastic\n");
    Files.writeString(dir.resolve("bt/part_categories.csv"),
        "Id,Name,Group,Hidden\n"
            + "11,Bricks,Brick,false\n"
            + "12,Plates,Plate,false\n");
    Files.writeString(dir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans,num_parts,num_sets,y1,y2\n"
            + "1,White,FFFFFF,False,0,0,0,0\n"
            + "5,Red,C91A09,False,0,0,0,0\n"
            + "7,Blue,0055BF,False,0,0,0,0\n");
    Files.writeString(dir.resolve("bt/part_color_url.csv"),
        "PartNumber,ColorId,ItemNumber,ImgUrl\n"
            + "3001,5,1,url\n"
            + "3001,1,2,url\n"
            + "3002,1,3,url\n"
            + "3003,7,4,url\n"
            + "87079pr0001,5,5,url\n");
    Files.writeString(dir.resolve("bt/part_default_color.csv"),
        "PartNumber,ColorId\n"
            + "3001,5\n");
    service = new PartStorageService(props());
  }

  @Test
  void createStorageWritesTheFileAndListsTheStorage() throws IOException {
    Map<String, Object> created = service.createStorage(
        new PartStorageRequest("A", "IKEA Alex", 6, "Desk", "Bricks"));

    assertThat(created)
        .containsEntry("id", "A")
        .containsEntry("model", "IKEA Alex")
        .containsEntry("drawersCount", 6)
        .containsEntry("location", "Desk")
        .containsEntry("description", "Bricks");
    assertThat(Files.readString(dir.resolve("bt/part_storage.csv")))
        .startsWith("Id,Model,DrawersCount,Location,Description")
        .contains("A,IKEA Alex,6,Desk,Bricks");
    assertThat(service.storages()).hasSize(1);
  }

  @Test
  void updateStorageChangesTheStorage() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Box", 0, "", ""));

    service.updateStorage("A", new PartStorageRequest("A", "Cabinet", 4, "Attic", "Plates"));

    assertThat(service.storages().get(0))
        .containsEntry("id", "A")
        .containsEntry("model", "Cabinet")
        .containsEntry("drawersCount", 4)
        .containsEntry("location", "Attic")
        .containsEntry("description", "Plates");
  }

  @Test
  void storageValidationRejectsInvalidValues() throws IOException {
    assertThatThrownBy(() -> service.createStorage(new PartStorageRequest("", "Box", 0, "", "")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("id");
    service.createStorage(new PartStorageRequest("A", "Box", 0, "", ""));
    assertThatThrownBy(() -> service.createStorage(new PartStorageRequest("A", "Box", 0, "", "")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("already exists");
    assertThatThrownBy(() -> service.createStorage(new PartStorageRequest("B", "Box", -1, "", "")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("negative");
    assertThatThrownBy(() -> service.updateStorage("Z", new PartStorageRequest("Z", "Box", 0, "", "")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown storage");
  }

  @Test
  void collectionRowsResolvePartCategoryAndColorChips() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 2, "", ""));
    service.createCollectionRow(new PartCollectionRequest("3001;§Plates", "5;Any", "A", "a", "10"));

    List<Map<String, Object>> drawers = service.drawers("");

    assertThat(drawers).hasSize(2);
    Map<String, Object> drawer = drawers.get(0);
    assertThat(drawer).containsEntry("storageId", "A").containsEntry("drawer", "a");
    List<Map<String, Object>> rows = cast(drawer.get("rows"));
    assertThat(rows).hasSize(1);
    assertThat(rows.get(0)).containsEntry("parts", "3001;§Plates")
        .containsEntry("colors", "5;Any").containsEntry("amount", "10");
    assertThat(cast(rows.get(0).get("partChips"))).extracting("partNumber").containsExactly("3001");
    assertThat(cast(rows.get(0).get("categoryChips"))).extracting("name").containsExactly("Plates");
    assertThat(cast(rows.get(0).get("colorChips"))).extracting("name").containsExactly("Red", "Any");
  }

  @Test
  void drawersCanBeSearchedByPartNumberNameColorAndCategory() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 1, "", ""));
    service.createCollectionRow(new PartCollectionRequest("§Plates", "Any", "A", "a", "10"));
    service.createCollectionRow(new PartCollectionRequest("3001", "5", "A", "a", "2"));

    assertThat(service.drawers("3001")).extracting("drawer").containsExactly("a");
    assertThat(cast(service.drawers("3001").get(0).get("matchedParts")))
        .extracting("partNumber").contains("3001");
    assertThat(cast(service.drawers("Plate 1 x 2").get(0).get("matchedParts")))
        .extracting("partNumber").contains("3003");
    assertThat(cast(service.drawers("Blue").get(0).get("matchedParts")))
        .extracting("partNumber").contains("3003");
    assertThat(cast(service.drawers("Plates").get(0).get("matchedParts")))
        .extracting("partNumber").contains("3003");
    assertThat(service.drawers("DoesNotExist")).isEmpty();
  }

  @Test
  void drawerLabelsUseLowercaseThenUppercaseAndStopAt52() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 52, "", ""));

    List<String> labels = service.drawers("").stream()
        .map(drawer -> (String) drawer.get("drawer"))
        .toList();

    assertThat(labels).hasSize(52);
    assertThat(labels.get(0)).isEqualTo("a");
    assertThat(labels.get(25)).isEqualTo("z");
    assertThat(labels.get(26)).isEqualTo("A");
    assertThat(labels.get(51)).isEqualTo("Z");
  }

  @Test
  void drawerLabelsAreValidatedAndLimitedTo52() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 52, "", ""));

    assertThatThrownBy(() -> service.createStorage(
        new PartStorageRequest("B", "Cabinet", 53, "", "")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("52");
    assertThatThrownBy(() -> service.createCollectionRow(
        new PartCollectionRequest("3001", "Any", "A", "AA", "1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not valid");
    assertThatThrownBy(() -> service.addParts("A", "AA", List.of("3001")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("not valid");

    service.createCollectionRow(new PartCollectionRequest("3001", "Any", "A", "A", "1"));
    assertThat(service.drawers("3001")).extracting("drawer").containsExactly("A");
  }

  @Test
  void addPartsCreatesAndIncrementsRows() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 1, "", ""));

    assertThat(service.addParts("A", "a", List.of("3001", "3002"))).isEqualTo(2);
    assertThat(service.addParts("A", "a", List.of("3001"))).isEqualTo(1);

    List<Map<String, Object>> rows = service.collectionRows();
    assertThat(rows).hasSize(2);
    assertThat(rows.get(0)).containsEntry("parts", "3001").containsEntry("amount", "2")
        .containsEntry("colors", "Any");
    assertThat(rows.get(1)).containsEntry("parts", "3002").containsEntry("amount", "1");
  }

  @Test
  void collectionValidationRejectsInvalidRows() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Box", 0, "", ""));
    assertThatThrownBy(() -> service.createCollectionRow(
        new PartCollectionRequest("", "Any", "A", "", "1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Parts");
    assertThatThrownBy(() -> service.createCollectionRow(
        new PartCollectionRequest("3001", "", "A", "", "1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Colors");
    assertThatThrownBy(() -> service.createCollectionRow(
        new PartCollectionRequest("3001", "Any", "A", "B", "1")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("no drawer");

    service.createCollectionRow(new PartCollectionRequest("3001", "Any", "A", "", "1"));
    assertThatThrownBy(() -> service.createCollectionRow(
        new PartCollectionRequest(" 3001 ", "Any", "A", "", "2")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("already exists");
  }

  @Test
  void collectionRowsCanBeUpdatedAndDeleted() throws IOException {
    service.createStorage(new PartStorageRequest("A", "Cabinet", 1, "", ""));
    service.createCollectionRow(new PartCollectionRequest("3001", "Any", "A", "a", "1"));

    service.updateCollectionRow(0, new PartCollectionRequest("3002", "5", "A", "a", "4"));

    assertThat(service.collectionRows().get(0))
        .containsEntry("parts", "3002")
        .containsEntry("colors", "5")
        .containsEntry("amount", "4");

    service.deleteCollectionRow(0);
    assertThat(service.collectionRows()).isEmpty();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> cast(Object value) {
    return (List<Map<String, Object>>) value;
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
