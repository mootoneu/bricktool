package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
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
class PabPartApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) throws IOException {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
    Files.createDirectories(dataDir.resolve("re"));
    Files.writeString(dataDir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n");
    Files.writeString(dataDir.resolve("re/part_categories.csv"),
        "id,name\n"
            + "11,Bricks\n");
    Files.writeString(dataDir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans,num_parts,num_sets,y1,y2\n"
            + "1,White,FFFFFF,False,0,0,0,0\n"
            + "5,Red,C91A09,False,0,0,0,0\n");
  }

  @Autowired
  MockMvc mvc;

  @Test
  void partsCanBeCreatedListedAndUpdated() throws Exception {
    int purchaseId = createPurchase();

    String partBody = mvc.perform(post("/api/pab/purchases/" + purchaseId + "/parts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"3001\",\"partColorId\":5,\"quantity\":20}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString();
    int partId = JsonPath.read(partBody, "$.id");

    mvc.perform(get("/api/pab/purchases/" + purchaseId + "/parts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value(partId))
        .andExpect(jsonPath("$[0].paBPurchaseId").value(purchaseId))
        .andExpect(jsonPath("$[0].partNumber").value("3001"))
        .andExpect(jsonPath("$[0].partColorId").value(5))
        .andExpect(jsonPath("$[0].quantity").value(20))
        .andExpect(jsonPath("$[0].partName").value("Brick 2 x 4"))
        .andExpect(jsonPath("$[0].partCategory").value("Bricks"))
        .andExpect(jsonPath("$[0].colorName").value("Red"))
        .andExpect(jsonPath("$[0].colorRgb").value("C91A09"));

    mvc.perform(put("/api/pab/parts/" + partId).contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"3002\",\"partColorId\":1,\"quantity\":9}"))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/pab/purchases/" + purchaseId + "/parts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].partNumber").value("3002"))
        .andExpect(jsonPath("$[0].partColorId").value(1))
        .andExpect(jsonPath("$[0].quantity").value(9))
        .andExpect(jsonPath("$[0].partName").value("Brick 2 x 3"))
        .andExpect(jsonPath("$[0].colorName").value("White"));
  }

  @Test
  void invalidPartIsRejected() throws Exception {
    int purchaseId = createPurchase();

    mvc.perform(post("/api/pab/purchases/9999/parts").contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"3001\",\"partColorId\":5,\"quantity\":1}"))
        .andExpect(status().isBadRequest());

    mvc.perform(post("/api/pab/purchases/" + purchaseId + "/parts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"9999\",\"partColorId\":5,\"quantity\":1}"))
        .andExpect(status().isBadRequest());

    mvc.perform(post("/api/pab/purchases/" + purchaseId + "/parts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"3001\",\"partColorId\":99,\"quantity\":1}"))
        .andExpect(status().isBadRequest());

    mvc.perform(post("/api/pab/purchases/" + purchaseId + "/parts")
            .contentType(MediaType.APPLICATION_JSON)
            .content("{\"partNumber\":\"3001\",\"partColorId\":5,\"quantity\":0}"))
        .andExpect(status().isBadRequest());
  }

  private int createPurchase() throws Exception {
    String body = mvc.perform(post("/api/pab/purchases").contentType(MediaType.APPLICATION_JSON)
            .content("{\"purchaseDate\":\"2026/02/03\",\"boxQuantity\":1,\"price\":10}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString();
    return JsonPath.read(body, "$.id");
  }
}
