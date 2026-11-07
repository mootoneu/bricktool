package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
import org.springframework.http.MediaType;
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
    Files.writeString(dataDir.resolve("re/inventory_parts.csv"),
        "inventory_id,part_num,color_id,quantity,is_spare,img_url\n"
            + "1,3001,5,1,False,https://cdn.example.test/parts/photos/5/3001-5-abc.jpg\n"
            + "2,3002,5,1,False,https://cdn.example.test/parts/photos/5/3002-5-def.png\n"
            + "3,14728c21.6,5,1,False,https://cdn.example.test/parts/photos/5/14728c21.6-5-ghi.png\n");
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

  @Test
  void mainPartStarsCanBeUpdated() throws Exception {
    mvc.perform(post("/api/parts/main-parts/generate"))
        .andExpect(status().isOk());

    mvc.perform(put("/api/parts/main-parts/4001/stars")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stars\":4}"))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/parts/categories/1/main-parts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].partNumber").value("4001"))
        .andExpect(jsonPath("$[0].stars").value(4));
  }

  @Test
  void mainPartStarsRejectInvalidValues() throws Exception {
    mvc.perform(post("/api/parts/main-parts/generate"))
        .andExpect(status().isOk());

    mvc.perform(put("/api/parts/main-parts/3001/stars")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stars\":6}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/parts/main-parts/3001/stars")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stars\":-1}"))
        .andExpect(status().isBadRequest());
    mvc.perform(put("/api/parts/main-parts/9999/stars")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"stars\":3}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void mainPartAlternatesJoinRelationshipsAndParts() throws Exception {
    mvc.perform(post("/api/parts/main-parts/generate"))
        .andExpect(status().isOk());

    mvc.perform(get("/api/parts/main-parts/3001/alternates"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.partNumber").value("3001"))
        .andExpect(jsonPath("$.name").value("Brick 2 x 4"))
        .andExpect(jsonPath("$.alternates.length()").value(1))
        .andExpect(jsonPath("$.alternates[0].relType").value("P"))
        .andExpect(jsonPath("$.alternates[0].childPartNumber").value("3002"))
        .andExpect(jsonPath("$.alternates[0].childName").value("Brick 2 x 3"))
        .andExpect(jsonPath("$.alternates[0].childCategoryId").value(11))
        .andExpect(jsonPath("$.alternates[0].childMaterial").value("Plastic"))
        .andExpect(jsonPath("$.alternates[0].parentPartNumber").value("3001"))
        .andExpect(jsonPath("$.alternates[0].parentName").value("Brick 2 x 4"));
  }

  @Test
  void partColorUrlsCanBeGeneratedAndPartImagesServed() throws Exception {
    mvc.perform(post("/api/parts/part-color-urls/generate"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.total").value(3))
        .andExpect(jsonPath("$.kept").value(3))
        .andExpect(jsonPath("$.duplicates").value(0))
        .andExpect(jsonPath("$.noUrl").value(0));

    byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x10};
    byte[] png = {(byte) 0x89, 'P', 'N', 'G'};
    Files.createDirectories(dataDir.resolve("other/partimg/5"));
    Files.write(dataDir.resolve("other/partimg/5/3001.jpg"), jpeg);
    Files.write(dataDir.resolve("other/partimg/5/14728c21.6.png"), png);

    mvc.perform(get("/api/parts/3001/image").param("colorId", "5"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.IMAGE_JPEG))
        .andExpect(content().bytes(jpeg));

    mvc.perform(get("/api/parts/14728c21.6/image").param("colorId", "5"))
        .andExpect(status().isOk())
        .andExpect(content().contentType(MediaType.IMAGE_PNG))
        .andExpect(content().bytes(png));

    mvc.perform(get("/api/parts/3001/image").param("colorId", "6"))
        .andExpect(status().isNotFound());
    mvc.perform(get("/api/parts/3001/image").param("colorId", "-1"))
        .andExpect(status().isBadRequest());
  }
}
