package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
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
class PabPartPriceApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) throws IOException {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
    Files.createDirectories(dataDir.resolve("le"));
    Files.writeString(dataDir.resolve("le/pab_part_prices.csv"),
        "DesignId,ColorId,Price\n"
            + "18980,26,0.18\n"
            + "18980,1,0.18\n"
            + "3001,5,0.12\n");
  }

  @Autowired
  MockMvc mvc;

  @Test
  void allPricesAreReturned() throws Exception {
    mvc.perform(get("/api/le/pab-part-prices"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(3))
        .andExpect(jsonPath("$[0].designId").value("18980"))
        .andExpect(jsonPath("$[0].colorId").value(26))
        .andExpect(jsonPath("$[0].price").value(0.18))
        .andExpect(jsonPath("$[2].designId").value("3001"))
        .andExpect(jsonPath("$[2].colorId").value(5))
        .andExpect(jsonPath("$[2].price").value(0.12));
  }

  @Test
  void pricesAreFilteredByDesignId() throws Exception {
    mvc.perform(get("/api/le/pab-part-prices/18980"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.length()").value(2))
        .andExpect(jsonPath("$[0].designId").value("18980"))
        .andExpect(jsonPath("$[0].colorId").value(26))
        .andExpect(jsonPath("$[1].colorId").value(1));
  }

  @Test
  void unknownDesignIdReturnsNotFound() throws Exception {
    mvc.perform(get("/api/le/pab-part-prices/9999"))
        .andExpect(status().isNotFound());
  }
}
