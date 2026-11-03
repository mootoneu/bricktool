package com.bricktools.brickowl;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;
import static org.hamcrest.Matchers.allOf;
import static org.hamcrest.Matchers.containsString;
import static org.springframework.test.web.client.match.MockRestRequestMatchers.requestTo;
import static org.springframework.test.web.client.response.MockRestResponseCreators.withSuccess;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.http.MediaType;
import org.springframework.test.web.client.MockRestServiceServer;
import org.springframework.web.client.RestClient;

class BrickOwlServiceTest {

  private static final String ORDER_HEADER =
      "Id,OrderTime,StoreName,StoreUrl,Weight,ShippingTotal,TotalParts,TotalLots,PaidTotal,RefundTotal,Total";
  private static final String ITEM_HEADER =
      "OrderId,BOID,DesignIds,ItemNumbers,Condition,Name,Type,Weight,ColorId,ColorName,OrderedQuantity,RefundQuantity,Quantity,ItemPrice,TotalPrice";

  @TempDir
  Path dir;

  private BrickToolsProperties props(String apiKey) {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("https://api.brickowl.com/v1", apiKey));
  }

  private static String order(String id, String time, String store, String weight, String total) {
    return String.join(",", id, time, store, "", weight, "", "", "", total, "0", total);
  }

  private static String item(String orderId, String type, String qty) {
    return String.join(",", orderId, "", "", "", "", "", type, "", "", "", qty, "0", qty, "", "");
  }

  private void writeFixture() throws IOException {
    Files.createDirectories(dir.resolve("bo"));
    Files.writeString(dir.resolve("bo/orders.csv"), String.join("\n", ORDER_HEADER,
        order("1", "2024-03-01T10:00:00Z", "Shop A", "2", "10"),
        order("2", "2024-05-01T10:00:00Z", "Shop A", "0", "20"),
        order("3", "2025-01-01T10:00:00Z", "Shop B", "4", "30")) + "\n");
    Files.writeString(dir.resolve("bo/order_items.csv"), String.join("\n", ITEM_HEADER,
        item("1", "Part", "10"),
        item("1", "Minifig", "2"),
        item("1", "Set", "1"),
        item("2", "Part", "5"),
        item("2", "Part", "5"),
        item("3", "Part", "20")) + "\n");
  }

  @Test
  void statisticsTotalsAndAveragesAreComputed() throws IOException {
    writeFixture();

    Map<String, Object> stats = new BrickOwlService(props("KEY"), RestClient.builder()).stats();

    @SuppressWarnings("unchecked")
    Map<String, Object> totals = (Map<String, Object>) stats.get("totals");
    assertThat(totals).containsEntry("amount", 60.0)
        .containsEntry("pieces", 40.0)
        .containsEntry("minifigs", 2.0)
        .containsEntry("sets", 1.0)
        .containsEntry("orders", 3);

    @SuppressWarnings("unchecked")
    Map<String, Map<String, Double>> averages = (Map<String, Map<String, Double>>) stats.get("averages");
    assertThat(averages.get("amount")).containsEntry("mean", 20.0).containsEntry("median", 20.0);
    assertThat(averages.get("pricePerPiece")).containsEntry("mean", 1.5).containsEntry("median", 1.5);
    assertThat(averages.get("pricePerKg")).containsEntry("mean", 6.25).containsEntry("median", 6.25);
  }

  @Test
  void statisticsAreGroupedByStoreAndYear() throws IOException {
    writeFixture();

    Map<String, Object> stats = new BrickOwlService(props("KEY"), RestClient.builder()).stats();

    @SuppressWarnings("unchecked")
    List<Map<String, Object>> rows = (List<Map<String, Object>>) stats.get("byStoreYear");
    assertThat(rows).hasSize(2);

    Map<String, Object> shopA = rows.get(0);
    assertThat(shopA).containsEntry("store", "Shop A").containsEntry("year", "2024")
        .containsEntry("amount", 30.0).containsEntry("pieces", 20.0);
    assertThat((Double) shopA.get("pricePerKg")).isEqualTo(15.0);
    assertThat(shopA.get("pricePerPiece")).isEqualTo(1.5);

    Map<String, Object> shopB = rows.get(1);
    assertThat(shopB).containsEntry("store", "Shop B").containsEntry("year", "2025");
  }

  @Test
  void emptyDataGivesZeroedStatistics() throws IOException {
    Map<String, Object> stats = new BrickOwlService(props("KEY"), RestClient.builder()).stats();

    @SuppressWarnings("unchecked")
    Map<String, Object> totals = (Map<String, Object>) stats.get("totals");
    assertThat(totals).containsEntry("orders", 0).containsEntry("amount", 0.0);
    assertThat((List<?>) stats.get("byStoreYear")).isEmpty();
  }

  @Test
  void ordersAreListedMostRecentFirstAndItemsFilteredByOrder() throws IOException {
    writeFixture();
    BrickOwlService service = new BrickOwlService(props("KEY"), RestClient.builder());

    assertThat(service.orders().get(0)).containsEntry("Id", "3");
    assertThat(service.items("1")).hasSize(3);
    assertThat(service.items("3")).hasSize(1);
  }

  @Test
  void updateRequiresApiKey() {
    BrickOwlService service = new BrickOwlService(props(""), RestClient.builder());

    assertThatThrownBy(service::update)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("API key");
  }

  @Test
  void updateFetchesNewOrdersAndItsItemsIncrementally() throws IOException {
    RestClient.Builder builder = RestClient.builder();
    MockRestServiceServer server = MockRestServiceServer.bindTo(builder).build();
    BrickOwlService service = new BrickOwlService(props("KEY"), builder);

    server.expect(requestTo("https://api.brickowl.com/v1/order/list?key=KEY&list_type=customer"))
        .andRespond(withSuccess("[{\"order_id\": 101}, {\"order_id\": 102}]", MediaType.APPLICATION_JSON));
    server.expect(requestTo("https://api.brickowl.com/v1/order/view?key=KEY&order_id=101"))
        .andRespond(withSuccess("""
            {"order_id":101,"iso_order_time":"2025-02-01T00:00:00Z","store_name":"Shop C",
             "weight":"1.5","ship_total":"3","payment_total":"12","refund_total":"2",
             "total_quantity":"4","total_lots":"2"}""", MediaType.APPLICATION_JSON));
    server.expect(requestTo("https://api.brickowl.com/v1/order/items?key=KEY&order_id=101"))
        .andRespond(withSuccess("""
            [{"order_item_id":1,"boid":"BO1",
              "ids":[{"type":"design_id","id":"3001"},{"type":"item_no","id":"300121"}],
              "condition":"N","name":"Brick 2x4","type":"Part","weight":"2",
              "color_id":"1","color_name":"White",
              "ordered_quantity":"5","refunded_quantity":"1","base_price":"0.5"}]""",
            MediaType.APPLICATION_JSON));
    server.expect(requestTo("https://api.brickowl.com/v1/order/view?key=KEY&order_id=102"))
        .andRespond(withSuccess("{\"order_id\":102,\"iso_order_time\":\"2025-03-01T00:00:00Z\","
            + "\"store_name\":\"Shop C\",\"payment_total\":\"5\",\"refund_total\":\"0\"}", MediaType.APPLICATION_JSON));
    server.expect(requestTo("https://api.brickowl.com/v1/order/items?key=KEY&order_id=102"))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

    Map<String, Object> result = service.update();

    assertThat(result).containsEntry("added", 2).containsEntry("total", 2);
    server.verify();

    List<Map<String, String>> orders = Csv.read(dir.resolve("bo/orders.csv"));
    Map<String, String> first = orders.stream().filter(o -> o.get("Id").equals("101")).findFirst().orElseThrow();
    assertThat(first).containsEntry("StoreName", "Shop C")
        .containsEntry("PaidTotal", "12").containsEntry("RefundTotal", "2").containsEntry("Total", "10");

    List<Map<String, String>> items = service.items("101");
    assertThat(items).hasSize(1);
    assertThat(items.get(0))
        .containsEntry("DesignIds", "3001")
        .containsEntry("ItemNumbers", "300121")
        .containsEntry("Quantity", "4")
        .containsEntry("ItemPrice", "0.5")
        .containsEntry("TotalPrice", "2.0");

    RestClient.Builder secondBuilder = RestClient.builder();
    MockRestServiceServer secondServer = MockRestServiceServer.bindTo(secondBuilder).build();
    secondServer.expect(requestTo(allOf(
            containsString("/order/list?key=KEY"),
            containsString("list_type=customer"),
            containsString("order_time="))))
        .andRespond(withSuccess("[]", MediaType.APPLICATION_JSON));

    assertThat(new BrickOwlService(props("KEY"), secondBuilder).update()).containsEntry("added", 0);
    secondServer.verify();
  }
}
