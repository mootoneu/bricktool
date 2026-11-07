package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
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
class SetInventoryApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
  }

  @Autowired
  MockMvc mvc;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dataDir.resolve("re"));
    Files.createDirectories(dataDir.resolve("bt"));
    Files.deleteIfExists(dataDir.resolve("bt/SetInventory.csv"));
    Files.writeString(dataDir.resolve("re/inventories.csv"),
        "id,version,set_num\n1,1,7922-1\n");
    Files.writeString(dataDir.resolve("re/inventory_parts.csv"),
        "inventory_id,part_num,color_id,quantity,is_spare,img_url\n"
            + "1,3001,5,2,False,https://example.test/3001-5.jpg\n"
            + "1,3002,1,4,False,https://example.test/3002-1.jpg\n");
    Files.writeString(dataDir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Plate 2 x 4,11,Plastic\n");
    Files.writeString(dataDir.resolve("re/part_categories.csv"), "id,name\n11,Bricks\n");
    Files.writeString(dataDir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans\n1,White,FFFFFF,False\n5,Red,C91A09,False\n");
  }

  @Test
  void returnsThePartsOfASet() throws Exception {
    mvc.perform(get("/api/sets/7922/inventory"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].partNumber").value("3001"))
        .andExpect(jsonPath("$[0].expectedQut").value(2))
        .andExpect(jsonPath("$[0].actualQut").value(0))
        .andExpect(jsonPath("$[0].partName").value("Brick 2 x 4"))
        .andExpect(jsonPath("$[0].partCategory").value("Bricks"))
        .andExpect(jsonPath("$[0].colorName").value("Red"));
  }

  @Test
  void unknownSetReturnsAnEmptyInventory() throws Exception {
    mvc.perform(get("/api/sets/9999/inventory"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(0));
  }

  @Test
  void actualQuantityCanBeUpdated() throws Exception {
    mvc.perform(put("/api/sets/7922/inventory/3001/5")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"actualQut\":2}"))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/sets/7922/inventory"))
        .andExpect(jsonPath("$[0].actualQut").value(2));
  }

  @Test
  void negativeActualQuantityIsRejected() throws Exception {
    mvc.perform(put("/api/sets/7922/inventory/3001/5")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"actualQut\":-1}"))
        .andExpect(status().isBadRequest());
  }

  @Test
  void inventoryCanBeFilledAndCleared() throws Exception {
    mvc.perform(post("/api/sets/7922/inventory/fill"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.updated").value(2));

    mvc.perform(get("/api/sets/7922/inventory"))
        .andExpect(jsonPath("$[0].actualQut").value(2))
        .andExpect(jsonPath("$[1].actualQut").value(4));

    mvc.perform(post("/api/sets/7922/inventory/clear"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.updated").value(2));

    mvc.perform(get("/api/sets/7922/inventory"))
        .andExpect(jsonPath("$[0].actualQut").value(0))
        .andExpect(jsonPath("$[1].actualQut").value(0));
  }

  @Test
  void storedInventoryCanBeDeleted() throws Exception {
    mvc.perform(post("/api/sets/7922/inventory/fill"))
        .andExpect(status().isOk());

    mvc.perform(delete("/api/sets/7922/inventory"))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/sets/7922/inventory"))
        .andExpect(jsonPath("$[0].actualQut").value(0));
    org.assertj.core.api.Assertions.assertThat(
            Files.readString(dataDir.resolve("bt/SetInventory.csv")))
        .doesNotContain("7922,");
  }
}
