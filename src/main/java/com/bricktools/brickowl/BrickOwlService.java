package com.bricktools.brickowl;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import com.fasterxml.jackson.databind.JsonNode;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeMap;
import java.util.stream.Collectors;
import org.springframework.stereotype.Service;
import org.springframework.web.client.RestClient;

@Service
public class BrickOwlService {

  private static final List<String> ORDER_HEADERS = List.of(
      "Id", "OrderTime", "StoreName", "StoreUrl", "Weight", "ShippingTotal", "TotalParts", "TotalLots",
      "PaidTotal", "RefundTotal", "Total");
  private static final List<String> ITEM_HEADERS = List.of(
      "OrderId", "BOID", "DesignIds", "ItemNumbers", "Condition", "Name", "Type", "Weight", "ColorId",
      "ColorName", "OrderedQuantity", "RefundQuantity", "Quantity", "ItemPrice", "TotalPrice");
  private static final List<String> METRIC_KEYS =
      List.of("amount", "pieces", "pricePerPiece", "pricePerKg", "minifigs", "sets");

  private final BrickToolsProperties props;
  private final RestClient rest;
  private final Path ordersFile;
  private final Path itemsFile;

  public BrickOwlService(BrickToolsProperties props, RestClient.Builder builder) {
    this.props = props;
    this.rest = builder.baseUrl(props.brickowl().baseUrl()).build();
    this.ordersFile = props.dataPath().resolve("bo/orders.csv");
    this.itemsFile = props.dataPath().resolve("bo/order_items.csv");
  }

  public synchronized Map<String, Object> update() throws IOException {
    String apiKey = props.brickowl().apiKey();
    if (apiKey == null || apiKey.isBlank()) {
      throw new IllegalStateException("BrickOwl API key is not configured (set BRICKOWL_API_KEY)");
    }

    List<Map<String, String>> orders = new ArrayList<>(Csv.read(ordersFile));
    List<Map<String, String>> items = new ArrayList<>(Csv.read(itemsFile));
    Set<String> known = new HashSet<>();
    String latest = null;
    for (Map<String, String> order : orders) {
      known.add(order.get("Id"));
      String time = order.get("OrderTime");
      if (time != null && !time.isBlank() && (latest == null || time.compareTo(latest) > 0)) {
        latest = time;
      }
    }

    int added = 0;
    try {
      JsonNode list = get("/order/list", latest == null ? Map.of("list_type", "customer") : Map.of("list_type", "customer", "order_time", latest));
      for (JsonNode ref : list) {
        String id = ref.isValueNode() ? ref.asText() : ref.path("order_id").asText();
        if (id.isBlank() || known.contains(id)) {
          continue;
        }
        orders.add(orderRow(firstObject(get("/order/view", Map.of("order_id", id))), id));
        for (JsonNode item : get("/order/items", Map.of("order_id", id))) {
          items.add(itemRow(id, item));
        }
        known.add(id);
        added++;
      }
    } finally {
      Csv.write(ordersFile, ORDER_HEADERS, orders);
      Csv.write(itemsFile, ITEM_HEADERS, items);
    }
    return Map.of("added", added, "total", orders.size());
  }

  public List<Map<String, String>> orders() throws IOException {
    List<Map<String, String>> orders = new ArrayList<>(Csv.read(ordersFile));
    orders.sort(Comparator.comparing((Map<String, String> o) -> o.getOrDefault("OrderTime", "")).reversed());
    return orders;
  }

  public List<Map<String, String>> items(String orderId) throws IOException {
    return Csv.read(itemsFile).stream().filter(i -> orderId.equals(i.get("OrderId"))).toList();
  }

  /**
   * Groups every order item by brick/color/condition across all orders, so the
   * same part ordered several times is shown once with its orders and total quantity.
   */
  public List<Map<String, Object>> parts() throws IOException {
    Map<String, Map<String, String>> ordersById = new HashMap<>();
    for (Map<String, String> order : Csv.read(ordersFile)) {
      ordersById.put(order.get("Id"), order);
    }

    Map<String, PartAggregate> parts = new LinkedHashMap<>();
    for (Map<String, String> item : Csv.read(itemsFile)) {
      String boid = value(item, "BOID");
      String name = value(item, "Name");
      if (boid.isBlank() && name.isBlank()) {
        // BrickOwl sometimes returns empty item lines (removed lots). They carry
        // no useful part information, so do not display them.
        continue;
      }
      String key = boid.isBlank()
          ? String.join("\u0000", value(item, "Type"), name, value(item, "ColorId"),
              value(item, "DesignIds"), value(item, "ItemNumbers"), value(item, "Condition"))
          : String.join("\u0000", value(item, "Type"), boid, value(item, "Condition"));
      parts.computeIfAbsent(key, k -> new PartAggregate()).add(item);
    }

    return parts.values().stream()
        .map(aggregate -> aggregate.toRow(ordersById))
        .sorted(Comparator
            .comparing((Map<String, Object> row) -> String.valueOf(row.getOrDefault("name", "")),
                String.CASE_INSENSITIVE_ORDER)
            .thenComparing(row -> String.valueOf(row.getOrDefault("colorName", "")),
                String.CASE_INSENSITIVE_ORDER)
            .thenComparing(row -> String.valueOf(row.getOrDefault("condition", "")),
                String.CASE_INSENSITIVE_ORDER))
        .toList();
  }

  public Map<String, Object> stats() throws IOException {
    Map<String, double[]> counts = new HashMap<>();
    for (Map<String, String> item : Csv.read(itemsFile)) {
      double[] c = counts.computeIfAbsent(item.get("OrderId"), k -> new double[3]);
      double qty = num(item.get("Quantity"));
      switch (item.getOrDefault("Type", "")) {
        case "Part" -> c[0] += qty;
        case "Minifig" -> c[1] += qty;
        case "Set" -> c[2] += qty;
        default -> { }
      }
    }

    List<OrderMetrics> metrics = new ArrayList<>();
    for (Map<String, String> order : Csv.read(ordersFile)) {
      double[] c = counts.getOrDefault(order.get("Id"), new double[3]);
      metrics.add(new OrderMetrics(
          order.get("StoreName"),
          yearOf(order.get("OrderTime")),
          num(order.get("Total")),
          c[0],
          c[1],
          c[2],
          num(order.get("Weight"))));
    }

    OrderMetrics total = OrderMetrics.sum("", "", metrics);
    Map<String, Object> totals = new LinkedHashMap<>(total.values());
    totals.put("orders", metrics.size());

    Map<String, Map<String, Double>> averages = new LinkedHashMap<>();
    for (String key : METRIC_KEYS) {
      List<Double> values = metrics.stream()
          .map(m -> m.values().get(key))
          .filter(Objects::nonNull)
          .sorted()
          .toList();
      averages.put(key, Map.of("mean", mean(values), "median", median(values)));
    }

    var grouped = metrics.stream().collect(Collectors.groupingBy(
        OrderMetrics::store, TreeMap::new,
        Collectors.groupingBy(OrderMetrics::year, TreeMap::new, Collectors.toList())));
    List<Map<String, Object>> byStoreYear = new ArrayList<>();
    grouped.forEach((store, years) -> years.forEach((year, list) -> {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("store", store);
      row.put("year", year);
      row.putAll(OrderMetrics.sum(store, year, list).values());
      byStoreYear.add(row);
    }));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("totals", totals);
    result.put("averages", averages);
    result.put("byStoreYear", byStoreYear);
    return result;
  }

  private JsonNode get(String path, Map<String, String> params) {
    JsonNode body = rest.get()
        .uri(uri -> {
          uri.path(path).queryParam("key", props.brickowl().apiKey());
          for (Map.Entry<String, String> param : params.entrySet()) {
            uri.queryParam(param.getKey(), param.getValue());
          }
          return uri.build();
        })
        .retrieve()
        .body(JsonNode.class);
    if (body == null) {
      throw new IllegalStateException("Empty response from BrickOwl " + path);
    }
    return body;
  }

  private static JsonNode firstObject(JsonNode node) {
    return node.isArray() && node.size() > 0 ? node.get(0) : node;
  }

  private static Map<String, String> orderRow(JsonNode o, String id) {
    BigDecimal paid = dec(o.path("payment_total").asText());
    BigDecimal refund = dec(o.path("refund_total").asText());
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", id);
    row.put("OrderTime", o.path("iso_order_time").asText());
    row.put("StoreName", o.path("store_name").asText());
    row.put("StoreUrl", o.path("store_url").asText());
    row.put("Weight", o.path("weight").asText());
    row.put("ShippingTotal", o.path("ship_total").asText());
    row.put("TotalParts", o.path("total_quantity").asText());
    row.put("TotalLots", o.path("total_lots").asText());
    row.put("PaidTotal", paid.toPlainString());
    row.put("RefundTotal", refund.toPlainString());
    row.put("Total", paid.subtract(refund).toPlainString());
    return row;
  }

  private static Map<String, String> itemRow(String orderId, JsonNode i) {
    BigDecimal ordered = dec(i.path("ordered_quantity").asText());
    BigDecimal refunded = dec(i.path("refunded_quantity").asText());
    BigDecimal quantity = ordered.subtract(refunded);
    BigDecimal unitPrice = dec(i.path("base_price").asText());
    Map<String, String> row = new LinkedHashMap<>();
    row.put("OrderId", orderId);
    row.put("BOID", i.path("boid").asText());
    row.put("DesignIds", idsOfType(i.path("ids"), "design_id"));
    row.put("ItemNumbers", idsOfType(i.path("ids"), "item_no"));
    row.put("Condition", i.path("condition").asText());
    row.put("Name", i.path("name").asText());
    row.put("Type", i.path("type").asText());
    row.put("Weight", i.path("weight").asText());
    row.put("ColorId", i.path("color_id").asText());
    row.put("ColorName", i.path("color_name").asText());
    row.put("OrderedQuantity", ordered.toPlainString());
    row.put("RefundQuantity", refunded.toPlainString());
    row.put("Quantity", quantity.toPlainString());
    row.put("ItemPrice", unitPrice.toPlainString());
    row.put("TotalPrice", unitPrice.multiply(quantity).toPlainString());
    return row;
  }

  private static String idsOfType(JsonNode ids, String type) {
    List<String> values = new ArrayList<>();
    for (JsonNode node : ids) {
      if (type.equals(node.path("type").asText())) {
        String value = node.path("id").asText(node.path("value").asText(""));
        if (!value.isEmpty()) {
          values.add(value);
        }
      }
    }
    return String.join(",", values);
  }

  private static String value(Map<String, String> row, String key) {
    String value = row.get(key);
    return value == null ? "" : value.trim();
  }

  private static String firstNonBlank(String current, String candidate) {
    if (current != null && !current.isBlank()) {
      return current;
    }
    return candidate == null ? "" : candidate.trim();
  }

  private static void addIds(Set<String> target, String values) {
    if (values == null) {
      return;
    }
    for (String value : values.split(",")) {
      String id = value.trim();
      if (!id.isEmpty()) {
        target.add(id);
      }
    }
  }

  private static final class PartAggregate {

    private String type = "";
    private String name = "";
    private String colorId = "";
    private String colorName = "";
    private String condition = "";
    private final Set<String> designIds = new LinkedHashSet<>();
    private final Set<String> itemNumbers = new LinkedHashSet<>();
    private final Set<String> orderIds = new LinkedHashSet<>();
    private double totalQuantity;

    void add(Map<String, String> item) {
      type = firstNonBlank(type, item.get("Type"));
      name = firstNonBlank(name, item.get("Name"));
      colorId = firstNonBlank(colorId, item.get("ColorId"));
      colorName = firstNonBlank(colorName, item.get("ColorName"));
      condition = firstNonBlank(condition, item.get("Condition"));
      addIds(designIds, item.get("DesignIds"));
      addIds(itemNumbers, item.get("ItemNumbers"));
      String orderId = value(item, "OrderId");
      if (!orderId.isEmpty()) {
        orderIds.add(orderId);
      }
      totalQuantity += num(item.get("Quantity"));
    }

    Map<String, Object> toRow(Map<String, Map<String, String>> ordersById) {
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("type", type);
      row.put("name", name);
      row.put("colorId", colorId);
      row.put("colorName", colorName);
      row.put("designIds", String.join(",", designIds));
      row.put("itemNumbers", String.join(",", itemNumbers));
      row.put("condition", condition);
      row.put("orders", orders(ordersById));
      row.put("totalQuantity", totalQuantity);
      return row;
    }

    private List<Map<String, Object>> orders(Map<String, Map<String, String>> ordersById) {
      List<Map<String, Object>> orders = new ArrayList<>();
      for (String orderId : orderIds) {
        Map<String, String> order = ordersById.get(orderId);
        Map<String, Object> entry = new LinkedHashMap<>();
        entry.put("id", orderId);
        entry.put("orderTime", order == null ? "" : order.getOrDefault("OrderTime", ""));
        entry.put("storeName", order == null ? "" : order.getOrDefault("StoreName", ""));
        orders.add(entry);
      }
      orders.sort(Comparator
          .comparing((Map<String, Object> order) -> String.valueOf(order.get("orderTime")))
          .reversed());
      return orders;
    }
  }

  private static String yearOf(String isoTime) {
    return isoTime == null || isoTime.length() < 4 ? "unknown" : isoTime.substring(0, 4);
  }

  private static BigDecimal dec(String value) {
    try {
      return value == null || value.isBlank() ? BigDecimal.ZERO : new BigDecimal(value.trim());
    } catch (NumberFormatException e) {
      return BigDecimal.ZERO;
    }
  }

  private static double num(String value) {
    try {
      return value == null || value.isBlank() ? 0 : Double.parseDouble(value.trim());
    } catch (NumberFormatException e) {
      return 0;
    }
  }

  private static double mean(List<Double> values) {
    return values.isEmpty() ? 0 : values.stream().mapToDouble(Double::doubleValue).average().orElse(0);
  }

  private static double median(List<Double> sorted) {
    int n = sorted.size();
    if (n == 0) {
      return 0;
    }
    return n % 2 == 1 ? sorted.get(n / 2) : (sorted.get(n / 2 - 1) + sorted.get(n / 2)) / 2;
  }

  private record OrderMetrics(String store, String year, double amount, double pieces,
                              double minifigs, double sets, double kg) {

    static OrderMetrics sum(String store, String year, List<OrderMetrics> list) {
      double amount = 0, pieces = 0, minifigs = 0, sets = 0, kg = 0;
      for (OrderMetrics o : list) {
        amount += o.amount;
        pieces += o.pieces;
        minifigs += o.minifigs;
        sets += o.sets;
        kg += o.kg;
      }
      return new OrderMetrics(store, year, amount, pieces, minifigs, sets, kg);
    }

    Map<String, Double> values() {
      Map<String, Double> values = new LinkedHashMap<>();
      values.put("amount", amount);
      values.put("pieces", pieces);
      values.put("pricePerPiece", pieces > 0 ? amount / pieces : null);
      values.put("pricePerKg", kg > 0 ? amount / kg : null);
      values.put("minifigs", minifigs);
      values.put("sets", sets);
      return values;
    }
  }
}
