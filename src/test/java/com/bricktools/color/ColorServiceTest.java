package com.bricktools.color;

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

class ColorServiceTest {

  @TempDir
  Path dir;

  private ColorService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.writeString(dir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans,num_parts,num_sets,y1,y2\n"
            + "0,Black,05131D,False,851062,235496,1957,2027\n"
            + "47,Trans-Clear,FCFCFC,True,48645,15679,1954,2026\n");
    Files.writeString(dir.resolve("re/color_mappings.csv"),
        "id,ext_system,ext_id,ext_descr,is_export_id,is_import_id\n"
            + "0,BL,11,\"[\"\"Black\"\"]\",True,True\n"
            + "0,BO,38,\"[\"\"Black\"\"]\",True,True\n"
            + "0,LD,256,\"[\"\"Rubber_Black\"\"]\",False,True\n"
            + "0,LE,342,\"[\"\"CONDUCT. BLACK\"\"]\",False,True\n"
            + "0,LE,26,\"[\"\"Black\"\", \"\"BLACK\"\"]\",True,True\n"
            + "47,BL,12,\"[\"\"Trans-Clear\"\"]\",True,True\n");
    service = new ColorService(new BrickToolsProperties(dir.toString(), null, null, null));
  }

  @Test
  void colorsExposeTheCatalogueWithTypedFields() throws IOException {
    List<Map<String, Object>> colors = service.colors();

    assertThat(colors).hasSize(2);
    Map<String, Object> black = colors.get(0);
    assertThat(black).containsEntry("id", 0)
        .containsEntry("name", "Black")
        .containsEntry("rgb", "05131D")
        .containsEntry("isTrans", false)
        .containsEntry("numParts", 851062)
        .containsEntry("numSets", 235496)
        .containsEntry("y1", 1957)
        .containsEntry("y2", 2027);
    assertThat(colors.get(1)).containsEntry("id", 47).containsEntry("isTrans", true);
  }

  @Test
  void mappingsExposeExternalIdentifiersAndNames() throws IOException {
    List<Map<String, Object>> mappings = service.mappings();

    assertThat(mappings).hasSize(6);
    Map<String, Object> lego = mappings.stream()
        .filter(row -> "LE".equals(row.get("extSystem")) && "26".equals(row.get("extId")))
        .findFirst()
        .orElseThrow();
    assertThat(lego).containsEntry("id", 0)
        .containsEntry("extSystem", "LE")
        .containsEntry("extId", "26")
        .containsEntry("extDescr", "[\"Black\", \"BLACK\"]")
        .containsEntry("extNames", List.of("Black", "BLACK"))
        .containsEntry("exportId", true)
        .containsEntry("importId", true);
  }

  @Test
  void referenceDataIsCachedAfterTheFirstRead() throws IOException {
    service.colors();
    service.mappings();

    Files.delete(dir.resolve("re/colors.csv"));
    Files.delete(dir.resolve("re/color_mappings.csv"));

    assertThat(service.colors()).hasSize(2);
    assertThat(service.mappings()).hasSize(6);
  }

  @Test
  void missingFilesProduceEmptyLists() throws IOException {
    ColorService empty = new ColorService(
        new BrickToolsProperties(dir.resolve("missing").toString(), null, null, null));

    assertThat(empty.colors()).isEmpty();
    assertThat(empty.mappings()).isEmpty();
  }
}
