package com.bricktools.web;

import static org.hamcrest.Matchers.containsString;
import static org.hamcrest.Matchers.hasItem;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.delete;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.put;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.content;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import java.nio.charset.StandardCharsets;
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
    mvc.perform(get("/newsets.html")).andExpect(status().isOk());
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
  void storedSetImageIsServedWithItsContentType() throws Exception {
    byte[] jpeg = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3};
    Files.createDirectories(dataDir.resolve("bt/setsimg"));
    Files.write(dataDir.resolve("bt/setsimg/55555.jpg"), jpeg);

    mvc.perform(get("/api/setimg/55555"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("image/jpeg"))
        .andExpect(content().bytes(jpeg));
  }

  @Test
  void unknownSetImageIsNotFound() throws Exception {
    mvc.perform(get("/api/setimg/88888")).andExpect(status().isNotFound());
  }

  @Test
  void storedThemeImageIsServedWithItsContentType() throws Exception {
    byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
    Files.createDirectories(dataDir.resolve("le/themes"));
    Files.write(dataDir.resolve("le/themes/technic.svg"), svg);

    mvc.perform(get("/api/themeimg/technic.svg"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("image/svg+xml"))
        .andExpect(content().bytes(svg));
  }

  @Test
  void unknownThemeImageIsNotFound() throws Exception {
    mvc.perform(get("/api/themeimg/unknown.svg")).andExpect(status().isNotFound());
  }

  @Test
  void storedVendorImageIsServedWithItsContentType() throws Exception {
    byte[] svg = "<svg xmlns=\"http://www.w3.org/2000/svg\"/>".getBytes(StandardCharsets.UTF_8);
    Files.createDirectories(dataDir.resolve("other/vendor"));
    Files.write(dataDir.resolve("other/vendor/amazon.svg"), svg);

    mvc.perform(get("/api/vendorimg/amazon.svg"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("image/svg+xml"))
        .andExpect(content().bytes(svg));
  }

  @Test
  void storedPeopleImageIsServedWithItsContentType() throws Exception {
    byte[] webp = {'R', 'I', 'F', 'F', 1, 2, 3, 4};
    Files.createDirectories(dataDir.resolve("other/people"));
    Files.write(dataDir.resolve("other/people/Duncan.webp"), webp);

    mvc.perform(get("/api/peopleimg/Duncan.webp"))
        .andExpect(status().isOk())
        .andExpect(content().contentType("image/webp"))
        .andExpect(content().bytes(webp));
  }

  @Test
  void unknownOtherImagesAreNotFound() throws Exception {
    mvc.perform(get("/api/vendorimg/unknown.svg")).andExpect(status().isNotFound());
    mvc.perform(get("/api/peopleimg/unknown.webp")).andExpect(status().isNotFound());
  }

  @Test
  void newSetsCatalogueIsExposedForTheCurrentYearByDefaultAndCanSelectAnotherYear() throws Exception {
    int currentYear = java.time.LocalDate.now().getYear();
    Files.createDirectories(dataDir.resolve("re"));
    Files.writeString(dataDir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon," + currentYear
            + ",171,7541,https://cdn.example/75192-1.jpg\n"
            + "10000-1,Old Set," + (currentYear - 1)
            + ",171,10,https://cdn.example/10000-1.jpg\n");

    mvc.perform(get("/api/newsets"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.year").value(currentYear))
        .andExpect(jsonPath("$.sets[0].setNumber").value("75192"))
        .andExpect(jsonPath("$.sets[0].name").value("Millennium Falcon"));

    mvc.perform(get("/api/newsets").param("year", String.valueOf(currentYear - 1)))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.year").value(currentYear - 1))
        .andExpect(jsonPath("$.sets[0].setNumber").value("10000"))
        .andExpect(jsonPath("$.sets[0].name").value("Old Set"));
  }

  @Test
  void wishlistCanBeCreatedListedUpdatedAndDeleted() throws Exception {
    Files.createDirectories(dataDir.resolve("re"));
    Files.writeString(dataDir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon," + java.time.LocalDate.now().getYear()
            + ",171,7541,https://cdn.example/75192-1.jpg\n");
    String body = "{\"setNumber\":\"75192\",\"wishlistDate\":\"2026/02/03\","
        + "\"member\":\"Duncan\",\"priority\":\"High\"}";

    mvc.perform(post("/api/wishlist").contentType(MediaType.APPLICATION_JSON).content(body))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value(1));

    mvc.perform(get("/api/wishlist"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].setNumber").value("75192"))
        .andExpect(jsonPath("$[0].name").value("Millennium Falcon"))
        .andExpect(jsonPath("$[0].member").value("Duncan"))
        .andExpect(jsonPath("$[0].priority").value("High"));

    mvc.perform(put("/api/wishlist/1").contentType(MediaType.APPLICATION_JSON)
            .content(body.replace("\"High\"", "\"Low\"")))
        .andExpect(status().isNoContent());
    mvc.perform(get("/api/wishlist"))
        .andExpect(jsonPath("$[0].priority").value("Low"));

    mvc.perform(delete("/api/wishlist/1")).andExpect(status().isNoContent());
    mvc.perform(get("/api/wishlist")).andExpect(status().isOk()).andExpect(jsonPath("$").isEmpty());
  }

  @Test
  void wishlistPrioritiesAreExposed() throws Exception {
    mvc.perform(get("/api/wishlist/options"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.priorities", hasItem("Favorite")));
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
