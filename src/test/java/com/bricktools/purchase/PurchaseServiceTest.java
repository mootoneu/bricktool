package com.bricktools.purchase;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.assertj.core.api.Assertions.within;

import com.bricktools.config.BrickToolsProperties;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PurchaseServiceTest {

  @TempDir
  Path dir;

  private PurchaseService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bw"));
    Files.writeString(dir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts\n75192-1,Millennium Falcon,2017,171,7541\n");
    Files.writeString(dir.resolve("re/themes.csv"), "id,name,parent_id\n171,Star Wars,\n");
    Files.writeString(dir.resolve("bw/setprices.csv"), "SetNumber,LegoPrice\n75192,849.99\n");

    service = new PurchaseService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")));
  }

  private static PurchaseRequest request(String setNumber, String price, String date, Integer missing) {
    return new PurchaseRequest(setNumber, new BigDecimal(price), date, "Amazon", "Me", "Me", missing, true);
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
        .containsEntry("partsMissing", 0);
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
    assertThat(row).containsEntry("partsMissing", 0);
  }

  @Test
  void updateReplacesExistingPurchase() throws IOException {
    service.create(request("75192", "700.00", "2024/05/01", 0));

    service.update(1, new PurchaseRequest("75192", new BigDecimal("650"), "2024/06/02",
        "Shop", "Other", "Me", 3, false));

    Map<String, Object> row = service.list().get(0);
    assertThat(row).containsEntry("price", 650.0)
        .containsEntry("purchaseDate", "2024/06/02")
        .containsEntry("vendor", "Shop")
        .containsEntry("broughtBy", "Other")
        .containsEntry("owned", false)
        .containsEntry("partsMissing", 3);
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
  void ownedDefaultsToTrueWhenNotProvided() throws IOException {
    service.create(new PurchaseRequest("75192", BigDecimal.TEN, "2024/01/01", null, null, null, null, null));

    assertThat(service.list().get(0)).containsEntry("owned", true).containsEntry("partsMissing", 0);
  }

  @Test
  void listKeepsEveryPurchase() throws IOException {
    service.create(request("75192", "700", "2024/05/01", 0));
    service.create(request("75192", "800", "2024/05/02", 754));

    List<Map<String, Object>> rows = service.list();

    assertThat(rows).hasSize(2);
    assertThat(rows.get(1)).containsEntry("id", 2);
  }
}
