package com.bricktools.purchase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.other.OtherImageService;
import com.bricktools.other.PeopleService;
import com.bricktools.setimg.SetImageService;
import com.bricktools.support.TestHttpServer;
import com.bricktools.theme.ThemeImageService;
import java.io.IOException;
import java.io.OutputStream;
import java.math.BigDecimal;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.concurrent.atomic.AtomicInteger;
import java.util.stream.Stream;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PurchaseServiceTest {

  @TempDir
  Path dir;

  private PurchaseService service;
  private TestHttpServer server;
  private final AtomicInteger imageRequests = new AtomicInteger();

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bw"));
    Files.createDirectories(dir.resolve("bt"));
    Files.createDirectories(dir.resolve("le/themes"));
    Files.createDirectories(dir.resolve("other/vendor"));
    Files.createDirectories(dir.resolve("other/people"));
    Files.writeString(dir.resolve("bt/themes.csv"),
        "id,name,parent_id,parent_name,theme_uid,color_primary,color_secondary,image\n"
            + "171,Star Wars,,,star-wars,#141414,#3d3d3d,star-wars.svg\n");
    Files.writeString(dir.resolve("le/themes/star-wars.svg"), "<svg/>", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("other/vendor/vendors.csv"), "name,image\nAmazon,amazon.svg\n");
    Files.writeString(dir.resolve("other/people/people.csv"), "name,image,color\nMe,me.webp,#2563eb\n");
    Files.writeString(dir.resolve("other/vendor/amazon.svg"), "<svg/>", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("other/people/me.webp"), "webp", StandardCharsets.UTF_8);
    server = new TestHttpServer();
    server.handle("/img/75192-1.jpg", exchange -> {
      imageRequests.incrementAndGet();
      byte[] bytes = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3};
      exchange.sendResponseHeaders(200, bytes.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(bytes);
      }
    });
    Files.writeString(dir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon,2017,171,7541," + server.baseUrl() + "/img/75192-1.jpg\n");
    Files.writeString(dir.resolve("re/themes.csv"), "id,name,parent_id\n171,Star Wars,\n");
    Files.writeString(dir.resolve("bw/setprices.csv"), "SetNumber,LegoPrice\n75192,849.99\n");

    BrickToolsProperties props = new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
    service = new PurchaseService(props, new SetImageService(props), new ThemeImageService(props),
        new OtherImageService(props), new PeopleService(props, new OtherImageService(props)));
  }

  @AfterEach
  void tearDown() {
    server.close();
  }

  @Test
  void addingPurchaseFetchesSetImageOnce() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));
    service.update(1, request("75192", "650.00", "2024/05/02", 0));
    service.create(request("75192", "600.00", "2024/05/03", 0));

    assertThat(Files.readAllBytes(dir.resolve("bt/setsimg/75192.jpg")))
        .startsWith((byte) 0xFF, (byte) 0xD8);
    assertThat(imageRequests.get()).isEqualTo(1);
  }

  @Test
  void listExposesImageUrlOnlyWhenImageIsStored() throws IOException {
    assertThat(service.list()).isEmpty();
    service.create(request("75192", "700.00", "2024/05/01", 0));
    service.create(request("99999", "10", "2024/05/01", 0));

    List<Map<String, Object>> rows = service.list();

    assertThat(rows.get(0)).containsEntry("imageUrl", "/api/setimg/75192");
    assertThat(rows.get(1).get("imageUrl")).isNull();
  }

  @Test
  void failedImageDownloadDoesNotBlockSaving() throws IOException {
    server.handle("/img/broken.jpg", exchange -> {
      exchange.sendResponseHeaders(404, -1);
      exchange.close();
    });
    Files.writeString(dir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon,2017,171,7541," + server.baseUrl() + "/img/broken.jpg\n");

    int id = service.create(request("75192", "700.00", "2024/05/01", 0));

    assertThat(id).isEqualTo(1);
    assertThat(service.list().get(0).get("imageUrl")).isNull();
    assertThat(storedImages()).isZero();
  }

  private long storedImages() throws IOException {
    Path images = dir.resolve("bt/setsimg");
    if (!Files.isDirectory(images)) {
      return 0;
    }
    try (Stream<Path> files = Files.list(images)) {
      return files.count();
    }
  }

  @Test
  void rejectsSetNumbersThatAreNotSafeFileNames() {
    assertThatThrownBy(() -> service.create(request("../75192", "1", "2024/01/01", 0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("letters, digits and dashes");
  }

  private PurchaseRequest request(String setNumber, String price, String date, Integer missing) {
    return new PurchaseRequest(setNumber, new BigDecimal(price), date, "Amazon", "Me", "Me", missing, true, "Noel");
  }

  private void writePurchases(String... lines) throws IOException {
    Files.createDirectories(dir.resolve("bt"));
    Files.writeString(dir.resolve("bt/purchased_sets.csv"), String.join("\n", lines) + "\n");
  }

  @Test
  void listIsEmptyWhenNoPurchasesExist() throws IOException {
    assertThat(service.list()).isEmpty();
  }

  @Test
  void createdPurchaseIsJoinedWithSetPriceAndRebrickableData() throws IOException {
    int id = service.create(request("75192", "700.00", "2024/05/01", 0));

    assertThat(id).isEqualTo(1);
    Map<String, Object> row = service.list().get(0);
    assertThat(row).containsEntry("id", 1)
        .containsEntry("setNumber", "75192")
        .containsEntry("name", "Millennium Falcon")
        .containsEntry("numParts", 7541)
        .containsEntry("year", 2017)
        .containsEntry("theme", "Star Wars")
        .containsEntry("officialPrice", 849.99)
        .containsEntry("price", 700.0)
        .containsEntry("purchaseDate", "2024/05/01")
        .containsEntry("owned", true)
        .containsEntry("partsMissing", 0)
        .containsEntry("reason", "Noel");
  }

  @Test
  void themeImageAndColorComeFromBrickToolsThemeData() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));

    Map<String, Object> row = service.list().get(0);

    assertThat(row).containsEntry("theme", "Star Wars")
        .containsEntry("themeImageUrl", "/api/themeimg/star-wars.svg")
        .containsEntry("themeColor", "#141414");
  }

  @Test
  void missingThemeImageFileLeavesThemeImageUrlEmpty() throws IOException {
    Files.delete(dir.resolve("le/themes/star-wars.svg"));
    service.create(request("75192", "700.00", "2024/05/01", 0));

    Map<String, Object> row = service.list().get(0);

    assertThat(row.get("themeImageUrl")).isNull();
    assertThat(row).containsEntry("themeColor", "#141414");
  }

  @Test
  void vendorAndPeopleImagesComeFromOtherData() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));

    Map<String, Object> row = service.list().get(0);

    assertThat(row).containsEntry("vendorImageUrl", "/api/vendorimg/amazon.svg")
        .containsEntry("broughtByImageUrl", "/api/peopleimg/me.webp")
        .containsEntry("ownerImageUrl", "/api/peopleimg/me.webp")
        .containsEntry("broughtByColor", "#2563eb")
        .containsEntry("ownerColor", "#2563eb");
  }

  @Test
  void namesWithoutImageMappingHaveNoImageUrl() throws IOException {
    service.create(new PurchaseRequest("75192", new BigDecimal("700"), "2024/05/01",
        "Unknown Shop", "Nobody", "Nobody", 0, true, "Noel"));

    Map<String, Object> row = service.list().get(0);

    assertThat(row.get("vendorImageUrl")).isNull();
    assertThat(row.get("broughtByImageUrl")).isNull();
    assertThat(row.get("ownerImageUrl")).isNull();
  }

  @Test
  void missingOtherImageFileLeavesImageUrlEmpty() throws IOException {
    Files.delete(dir.resolve("other/vendor/amazon.svg"));
    Files.delete(dir.resolve("other/people/me.webp"));
    service.create(request("75192", "700.00", "2024/05/01", 0));

    Map<String, Object> row = service.list().get(0);

    assertThat(row.get("vendorImageUrl")).isNull();
    assertThat(row.get("broughtByImageUrl")).isNull();
    assertThat(row.get("ownerImageUrl")).isNull();
  }

  @Test
  void promoIsPriceRelativeToOfficialPriceInPercent() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));

    double promo = (Double) service.list().get(0).get("promo");
    assertThat(promo).isCloseTo(82.35, within(0.01));
  }

  @Test
  void completenessIsOneMinusMissingPartsRatio() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 754));

    Map<String, Object> row = service.list().get(0);
    assertThat((Double) row.get("complete")).isCloseTo(90.0, within(0.01));
    assertThat(row).containsEntry("partsMissing", 754);
  }

  @Test
  void unknownSetLeavesJoinedFieldsEmpty() throws IOException {
    service.create(request("99999", "10", "2024/05/01", null));

    Map<String, Object> row = service.list().get(0);
    assertThat(row.get("name")).isNull();
    assertThat(row.get("promo")).isNull();
    assertThat(row.get("complete")).isNull();
    assertThat(row.get("themeImageUrl")).isNull();
    assertThat(row.get("themeColor")).isNull();
    assertThat(row).containsEntry("partsMissing", 0);
  }

  @Test
  void updateReplacesExistingPurchase() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));

    service.update(1, new PurchaseRequest("75192", new BigDecimal("650"), "2024/06/02",
        "Shop", "Other", "Me", 3, false, "Anniversaire"));

    Map<String, Object> row = service.list().get(0);
    assertThat(row).containsEntry("price", 650.0)
        .containsEntry("purchaseDate", "2024/06/02")
        .containsEntry("vendor", "Shop")
        .containsEntry("broughtBy", "Other")
        .containsEntry("owned", false)
        .containsEntry("partsMissing", 3)
        .containsEntry("reason", "Anniversaire");
  }

  @Test
  void updateOfUnknownIdFails() {
    assertThatThrownBy(() -> service.update(42, request("75192", "1", "2024/01/01", 0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("42");
  }

  @Test
  void rejectsInvalidDateFormat() {
    assertThatThrownBy(() -> service.create(request("75192", "1", "2024-01-01", 0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("yyyy/MM/dd");
  }

  @Test
  void rejectsMissingSetNumber() {
    assertThatThrownBy(() -> service.create(request(" ", "1", "2024/01/01", 0)))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Set number");
  }

  @Test
  void ownedDefaultsToTrueAndReasonIsOptional() throws IOException {
    service.create(new PurchaseRequest("75192", BigDecimal.TEN, "2024/01/01", null, null, null, null, null, null));

    assertThat(service.list().get(0))
        .containsEntry("owned", true)
        .containsEntry("partsMissing", 0)
        .containsEntry("reason", "");
  }

  @Test
  void listKeepsEveryPurchase() throws IOException {
    service.create(request("75192", "700", "2024/05/01", 0));
    service.create(request("75192", "800", "2024/05/02", 754));

    List<Map<String, Object>> rows = service.list();

    assertThat(rows).hasSize(2);
    assertThat(rows.get(1)).containsEntry("id", 2);
  }

  @Test
  void legacyRowsWithPaddedDatesAreTrimmedAndReasonIsKeptOnSave() throws IOException {
    writePurchases(
        "Id,SetNumber,PurchasePrice,PurchaseDate,Vendor,BroughtBy,Owner,PartMissings,Owned,Reason",
        "1,75192,700.00,  2024/05/01,Amazon,Duncan,Valerian,,true,Noel",
        "2,75192,650.00,2024/05/02,Lego Store,Eglantine,,,false,");

    service.create(request("75192", "600", "2024/06/01", 0));

    List<Map<String, Object>> rows = service.list();
    assertThat(rows.get(0)).containsEntry("purchaseDate", "2024/05/01").containsEntry("reason", "Noel");
    assertThat(rows.get(1)).containsEntry("owner", "").containsEntry("reason", "").containsEntry("owned", false);
    assertThat(Files.readString(dir.resolve("bt/purchased_sets.csv")).lines().findFirst().orElseThrow())
        .endsWith(",Reason");
    assertThat(Files.readString(dir.resolve("bt/purchased_sets.csv"))).contains("1,75192,700.00,2024/05/01,Amazon,Duncan,Valerian,,true,Noel");
  }

  @Test
  void optionsListExistingValuesDistinctSortedAndWithoutBlanks() throws IOException {
    writePurchases(
        "Id,SetNumber,PurchasePrice,PurchaseDate,Vendor,BroughtBy,Owner,PartMissings,Owned,Reason",
        "1,75192,1,2024/01/01,Lego,Duncan,Valerian,,true,",
        "2,75192,1,2024/01/02,Amazon,Eglantine,,,true,Noel",
        "3,75192,1,2024/01/03,Lego,Duncan,Duncan,,true,",
        "4,75192,1,2024/01/04,  Vinted  ,Autre,Valerian,,true,");

    Map<String, List<String>> options = service.options();

    assertThat(options.get("vendors")).containsExactly("Amazon", "Lego", "Vinted");
    assertThat(options.get("buyers")).containsExactly("Autre", "Duncan", "Eglantine");
    assertThat(options.get("owners")).containsExactly("Duncan", "Valerian");
  }

  @Test
  void newValueBecomesAnExistingOptionOnceSaved() throws IOException {
    service.create(new PurchaseRequest("75192", BigDecimal.ONE, "2024/01/01",
        "Brand New Shop", "New Buyer", "New Owner", 0, true, ""));

    Map<String, List<String>> options = service.options();

    assertThat(options.get("vendors")).contains("Brand New Shop");
    assertThat(options.get("buyers")).contains("New Buyer");
    assertThat(options.get("owners")).contains("New Owner");
  }
}
