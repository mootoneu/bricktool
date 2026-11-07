package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PartApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) throws IOException {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
    Files.createDirectories(dataDir.resolve("bt"));
    Files.createDirectories(dataDir.resolve("re"));
    Files.writeString(dataDir.resolve("bt/part_categories.csv"),
        "Id,Name,Group,Hidden\n"
            + "1,Baseplates,Baseplate,false\n"
            + "11,Bricks,Brick,false\n"
            + "12,Bricks Wedged,Brick,false\n"
            + "20,Duplo,Duplo,true\n");
    Files.writeString(dataDir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n"
            + "4001,Baseplate 32 x 32,1,Plastic\n"
            + "9999,Duplo Brick,20,Plastic\n");
    Files.writeString(dataDir.resolve("re/part_relationships.csv"),
        "rel_type,child_part_num,parent_part_num\n"
            + "P,3002,3001\n");
  }

  @Autowired
  MockMvc mvc;

  @Test
  void mainPartsCanBeGeneratedAndExplored() throws Exception {
    mvc.perform(post("/api/parts/main-parts/generate"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(2))
        .andExpect(jsonPath("$.hiddenParts").value(1))
        .andExpect(jsonPath("$.childParts").value(1))
        .andExpect(jsonPath("$.withAlternates").value(1));

    mvc.perform(get("/api/parts/categories"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].group").value("Baseplate"))
        .andExpect(jsonPath("$[1].group").value("Brick"))
        .andExpect(jsonPath("$[1].categories[0].name").value("Bricks"))
        .andExpect(jsonPath("$[1].categories[1].name").value("Bricks Wedged"));

    mvc.perform(get("/api/parts/categories/11/main-parts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].partNumber").value("3001"))
        .andExpect(jsonPath("$[0].name").value("Brick 2 x 4"))
        .andExpect(jsonPath("$[0].categoryId").value(11))
        .andExpect(jsonPath("$[0].material").value("Plastic"))
        .andExpect(jsonPath("$[0].hasAlternates").value(true))
        .andExpect(jsonPath("$[0].stars").value(2));
  }
}
