package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

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
class PabPurchaseApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
  }

  @Autowired
  MockMvc mvc;

  @Test
  void purchasesCanBeCreatedListedAndUpdated() throws Exception {
    mvc.perform(post("/api/pab/purchases").contentType(MediaType.APPLICATION_JSON)
            .content("{\"purchaseDate\":\"2026/02/03\",\"boxQuantity\":2,\"minifigQuantity\":1,\"price\":24.90}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1));

    mvc.perform(get("/api/pab/purchases"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].purchaseDate").value("2026/02/03"))
        .andExpect(jsonPath("$[0].boxQuantity").value(2))
        .andExpect(jsonPath("$[0].minifigQuantity").value(1))
        .andExpect(jsonPath("$[0].price").value(24.9))
        .andExpect(jsonPath("$[0].totalParts").value(0));

    mvc.perform(put("/api/pab/purchases/1").contentType(MediaType.APPLICATION_JSON)
            .content("{\"purchaseDate\":\"2026/03/04\",\"boxQuantity\":3,\"minifigQuantity\":2,\"price\":12.50}"))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/pab/purchases"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].purchaseDate").value("2026/03/04"))
        .andExpect(jsonPath("$[0].boxQuantity").value(3))
        .andExpect(jsonPath("$[0].minifigQuantity").value(2))
        .andExpect(jsonPath("$[0].price").value(12.5));
  }

  @Test
  void invalidPurchaseIsRejected() throws Exception {
    mvc.perform(post("/api/pab/purchases").contentType(MediaType.APPLICATION_JSON)
            .content("{\"purchaseDate\":\"03/02/2026\",\"boxQuantity\":1,\"price\":10}"))
        .andExpect(status().isBadRequest());
  }
}
