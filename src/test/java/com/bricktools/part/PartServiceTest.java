package com.bricktools.part;

import static org.assertj.core.api.Assertions.assertThat;

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
