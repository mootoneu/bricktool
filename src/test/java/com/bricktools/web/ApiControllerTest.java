package com.bricktools.web;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
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
class ApiControllerTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
  }

  @Autowired
  MockMvc mvc;

  private static final String PURCHASE =
      "{\"setNumber\":\"75192\",\"purchasePrice\":700.00,\"purchaseDate\":\"2024/05/01\","
          + "\"vendor\":\"Amazon\",\"broughtBy\":\"Me\",\"owner\":\"Me\",\"partMissings\":0,\"owned\":true}";

  @Test
  void servesLandingPage() throws Exception {
    mvc.perform(get("/index.html"))
        .andExpect(status().isOk())
        .andExpect(content().string(containsString("Brick Tools")));
  }

  @Test
  void servesFeaturePages() throws Exception {
    mvc.perform(get("/admin.html")).andExpect(status().isOk());
    mvc.perform(get("/brickowl.html")).andExpect(status().isOk());
    mvc.perform(get("/purchases.html")).andExpect(status().isOk());
  }

  @Test
  void staleRebrickableDataIsNotifiedAtStartup() throws Exception {
    mvc.perform(get("/api/notifications"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("rebrickable-stale"))
        .andExpect(jsonPath("$[0].link").value("/admin.html#rebrickable"));
  }

  @Test
  void rebrickableStatusReportsNeverDownloaded() throws Exception {
    mvc.perform(get("/api/rebrickable/status"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.canUpdate").value(true))
        .andExpect(jsonPath("$.stale").value(true));
  }

  @Test
  void purchaseCanBeCreatedListedAndUpdated() throws Exception {
    mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(PURCHASE))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1));

    mvc.perform(get("/api/purchases"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].setNumber").value("75192"))
        .andExpect(jsonPath("$[0].price").value(700.0))
        .andExpect(jsonPath("$[0].owned").value(true));

    mvc.perform(put("/api/purchases/1").contentType(MediaType.APPLICATION_JSON)
            .content(PURCHASE.replace("700.00", "650.00")))
        .andExpect(status().isNoContent());

    mvc.perform(get("/api/purchases"))
        .andExpect(jsonPath("$[0].price").value(650.0));
  }

  @Test
  void purchaseOptionsProposeValuesCreatedThroughTheApi() throws Exception {
    String body = "{\"setNumber\":\"10281\",\"purchasePrice\":34.99,\"purchaseDate\":\"2024/05/02\","
        + "\"vendor\":\"Brand New Shop\",\"broughtBy\":\"Christine\",\"owner\":\"Valerian\","
        + "\"partMissings\":0,\"owned\":true,\"reason\":\"Anniversaire\"}";
    mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated());

    mvc.perform(get("/api/purchases/options"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.vendors", hasItem("Brand New Shop")))
        .andExpect(jsonPath("$.buyers", hasItem("Christine")))
        .andExpect(jsonPath("$.owners", hasItem("Valerian")));

    mvc.perform(get("/api/purchases"))
        .andExpect(jsonPath("$[*].reason", hasItem("Anniversaire")));
  }

  @Test
  void invalidPurchaseDateIsRejectedWithMessage() throws Exception {
    mvc.perform(post("/api/purchases").contentType(MediaType.APPLICATION_JSON)
            .content(PURCHASE.replace("2024/05/01", "2024-05-01")))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("Purchase date must use the yyyy/MM/dd format"));
  }

  @Test
  void updatingUnknownPurchaseIsBadRequest() throws Exception {
    mvc.perform(put("/api/purchases/999").contentType(MediaType.APPLICATION_JSON).content(PURCHASE))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value("Unknown purchase id 999"));
  }

  @Test
  void brickOwlUpdateWithoutApiKeyIsBadRequest() throws Exception {
    mvc.perform(post("/api/brickowl/update"))
        .andExpect(status().isBadRequest())
        .andExpect(jsonPath("$.error").value(containsString("API key")));
  }

  @Test
  void brickOwlStatsOnEmptyDataAreZero() throws Exception {
    mvc.perform(get("/api/brickowl/stats"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.totals.orders").value(0));
  }

  @Test
  void invalidSetNumberIsRejectedBeforeScraping() throws Exception {
    mvc.perform(get("/api/brickwatch/sets/{set}/price", "bad set!"))
        .andExpect(status().isBadRequest());
  }
}
