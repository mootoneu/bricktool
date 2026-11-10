package com.bricktools.part;

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

class PartServiceTest {

  @TempDir
  Path dir;

  private PartService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("bt"));
    Files.createDirectories(dir.resolve("re"));
    Files.writeString(dir.resolve("bt/part_categories.csv"),
        "Id,Name,Group,Hidden\n"
            + "1,Baseplates,Baseplate,false\n"
            + "11,Bricks,Brick,false\n"
            + "12,Bricks Wedged,Brick,false\n"
            + "13,Technic Bricks,Technic,false\n"
            + "20,Duplo,Duplo,true\n");
    Files.writeString(dir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n"
            + "3003,Brick 2 x 2,11,Plastic\n"
            + "4001,Baseplate 32 x 32,1,Plastic\n"
            + "5001,Technic Brick 1 x 2,13,Plastic\n"
            + "9999,Duplo Brick,20,Plastic\n");
    Files.writeString(dir.resolve("re/part_relationships.csv"),
        "rel_type,child_part_num,parent_part_num\n"
            + "P,3002,3001\n"
            + "B,3003,3001\n");
    service = new PartService(props());
  }

  @Test
  void generateMainPartsExcludesHiddenCategoriesAndChildParts() throws IOException {
    Files.writeString(dir.resolve("bt/main_parts.csv"),
        "PartNumber,Name,CategoryId,Material,HasAlternates,Stars\n"
            + "3001,Old brick name,11,Plastic,false,5\n");

    Map<String, Object> result = service.generateMainParts();

    assertThat(result)
        .containsEntry("total", 3)
        .containsEntry("hiddenParts", 1)
        .containsEntry("childParts", 2)
        .containsEntry("withAlternates", 1);
    String csv = Files.readString(dir.resolve("bt/main_parts.csv"));
    assertThat(csv)
        .startsWith("PartNumber,Name,CategoryId,Material,HasAlternates,Stars")
        .contains("3001,Brick 2 x 4,11,Plastic,true,5")
        .doesNotContain("3002")
        .doesNotContain("3003")
        .doesNotContain("9999");
  }

  @Test
  void generateMainPartsDefaultsNewStarsToTwo() throws IOException {
    service.generateMainParts();

    assertThat(service.mainParts(1).get(0))
        .containsEntry("partNumber", "4001")
        .containsEntry("name", "Baseplate 32 x 32")
        .containsEntry("categoryId", 1)
        .containsEntry("material", "Plastic")
        .containsEntry("hasAlternates", false)
        .containsEntry("stars", 2);
  }

  @Test
  void categoriesAreGroupedAndHideHiddenCategories() throws IOException {
    List<Map<String, Object>> groups = service.categories();

    assertThat(groups).extracting("group").containsExactly("Baseplate", "Brick", "Technic");
    assertThat(groups.get(1)).containsEntry("group", "Brick");
    assertThat(categoriesOf(groups.get(1)))
        .extracting("name")
        .containsExactly("Bricks", "Bricks Wedged");
    assertThat(groups)
        .flatExtracting("categories")
        .extracting("id")
        .doesNotContain(20);
  }

  @Test
  void mainPartsAreFilteredByCategoryAndSortedByName() throws IOException {
    service.generateMainParts();

    assertThat(service.mainParts(11))
        .extracting("partNumber")
        .containsExactly("3001");
    assertThat(service.mainParts(13))
        .extracting("partNumber")
        .containsExactly("5001");
  }

  @Test
  void searchMainPartsMatchesNamesAndNumbersAcrossCategories() throws IOException {
    service.generateMainParts();

    Map<String, Object> result = service.searchMainParts("brick");

    assertThat(result)
        .containsEntry("query", "brick")
        .containsEntry("total", 2)
        .containsEntry("limit", 500);
    assertThat(partsOf(result))
        .extracting("partNumber")
        .containsExactly("3001", "5001");
    assertThat(partsOf(result).get(0))
        .containsEntry("name", "Brick 2 x 4")
        .containsEntry("categoryName", "Bricks")
        .containsEntry("material", "Plastic")
        .containsEntry("hasAlternates", true)
        .containsEntry("stars", 2);
    assertThat(partsOf(result).get(1))
        .containsEntry("categoryName", "Technic Bricks");

    Map<String, Object> byNumber = service.searchMainParts("4001");
    assertThat(byNumber).containsEntry("total", 1);
    assertThat(partsOf(byNumber))
        .extracting("partNumber")
        .containsExactly("4001");

    assertThat(service.searchMainParts("BRICK")).containsEntry("total", 2);
    assertThat(service.searchMainParts("  "))
        .containsEntry("total", 0)
        .containsEntry("query", "");
    assertThat(partsOf(service.searchMainParts("  "))).isEmpty();
    assertThat(service.searchMainParts("zzz")).containsEntry("total", 0);
  }

  @Test
  void updateStarsPersistsTheNewValue() throws IOException {
    service.generateMainParts();

    service.updateStars("3001", 4);

    assertThat(service.mainParts(11).get(0))
        .containsEntry("partNumber", "3001")
        .containsEntry("stars", 4);
    assertThat(Files.readString(dir.resolve("bt/main_parts.csv")))
        .contains("3001,Brick 2 x 4,11,Plastic,true,4");
  }

  @Test
  void updateStarsRejectsInvalidValues() throws IOException {
    service.generateMainParts();

    assertThatThrownBy(() -> service.updateStars("3001", 6))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("between 0 and 5");
    assertThatThrownBy(() -> service.updateStars("3001", -1))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("between 0 and 5");
    assertThatThrownBy(() -> service.updateStars("9999", 3))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown main part");
  }

  @Test
  void alternatesJoinRelationshipsAndPartDetails() throws IOException {
    service.generateMainParts();

    Map<String, Object> result = service.alternates("3001");

    assertThat(result)
        .containsEntry("partNumber", "3001")
        .containsEntry("name", "Brick 2 x 4");
    List<Map<String, Object>> alternates = alternatesOf(result);
    assertThat(alternates).hasSize(2);
    assertThat(alternates).extracting("childPartNumber")
        .containsExactlyInAnyOrder("3002", "3003");
    assertThat(alternates).extracting("relType").containsExactlyInAnyOrder("P", "B");

    Map<String, Object> alternate = alternates.stream()
        .filter(row -> "3002".equals(row.get("childPartNumber")))
        .findFirst()
        .orElseThrow();
    assertThat(alternate)
        .containsEntry("relType", "P")
        .containsEntry("childName", "Brick 2 x 3")
        .containsEntry("childCategoryId", 11)
        .containsEntry("childMaterial", "Plastic")
        .containsEntry("parentPartNumber", "3001")
        .containsEntry("parentName", "Brick 2 x 4");
  }

  @Test
  void infoReturnsMainPartDetails() throws IOException {
    service.generateMainParts();

    Map<String, Object> info = service.info("3001");

    assertThat(info)
        .containsEntry("partNumber", "3001")
        .containsEntry("name", "Brick 2 x 4")
        .containsEntry("material", "Plastic")
        .containsEntry("hasAlternates", true)
        .containsEntry("stars", 2)
        .containsEntry("inMainParts", true)
        .containsEntry("categoryId", 11)
        .containsEntry("categoryName", "Bricks")
        .containsEntry("categoryHidden", false);
  }

  @Test
  void infoFallsBackToRebrickablePartsForNonMainParts() throws IOException {
    service.generateMainParts();

    Map<String, Object> child = service.info("3002");
    assertThat(child)
        .containsEntry("partNumber", "3002")
        .containsEntry("name", "Brick 2 x 3")
        .containsEntry("material", "Plastic")
        .containsEntry("hasAlternates", false)
        .containsEntry("stars", 0)
        .containsEntry("inMainParts", false)
        .containsEntry("categoryId", 11)
        .containsEntry("categoryName", "Bricks")
        .containsEntry("categoryHidden", false);

    Map<String, Object> hidden = service.info("9999");
    assertThat(hidden)
        .containsEntry("categoryId", 20)
        .containsEntry("categoryName", "Duplo")
        .containsEntry("categoryHidden", true);

    Map<String, Object> unknown = service.info("unknown");
    assertThat(unknown).isNull();
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> partsOf(Map<String, Object> result) {
    return (List<Map<String, Object>>) result.get("parts");
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> alternatesOf(Map<String, Object> result) {
    return (List<Map<String, Object>>) result.get("alternates");
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> categoriesOf(Map<String, Object> group) {
    return (List<Map<String, Object>>) group.get("categories");
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
