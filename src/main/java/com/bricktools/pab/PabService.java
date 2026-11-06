package com.bricktools.pab;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Stores the Pick a Brick purchases made in a Lego store and the parts bought with them.
 * Data lives in data/bt/pab_purchases.csv and data/bt/pab_parts.csv.
 */
@Service
public class PabService {

  private static final List<String> PURCHASE_HEADERS = List.of("Id", "PurchaseDate", "BoxQuantity", "Price");
  private static final List<String> PART_HEADERS =
      List.of("Id", "PaBPurchaseId", "PartNumber", "PartColor", "Quantity");
  private static final Pattern DATE = Pattern.compile("\\d{4}/\\d{2}/\\d{2}");

  private final Path purchasesFile;
  private final Path partsFile;
  private final Path partsCatalogFile;
  private final Path categoriesCatalogFile;
  private final Path colorsCatalogFile;

  public PabService(BrickToolsProperties props) {
    this.purchasesFile = props.dataPath().resolve("bt/pab_purchases.csv");
    this.partsFile = props.dataPath().resolve("bt/pab_parts.csv");
    this.partsCatalogFile = props.dataPath().resolve("re/parts.csv");
    this.categoriesCatalogFile = props.dataPath().resolve("re/part_categories.csv");
    this.colorsCatalogFile = props.dataPath().resolve("re/colors.csv");
  }

  public synchronized List<Map<String, Object>> purchases() throws IOException {
    Map<String, Integer> totals = partTotals();
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(purchasesFile)) {
      String id = clean(row.get("Id"));
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("id", toInt(id));
      entry.put("purchaseDate", clean(row.get("PurchaseDate")));
      entry.put("boxQuantity", toInt(row.get("BoxQuantity")));
      entry.put("price", toDouble(row.get("Price")));
      entry.put("totalParts", totals.getOrDefault(id, 0));
      result.add(entry);
    }
    return result;
  }

  public synchronized int create(PabPurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = load(purchasesFile);
    int id = nextId(rows);
    rows.add(toRow(id, request));
    Csv.write(purchasesFile, PURCHASE_HEADERS, rows);
    return id;
  }

  public synchronized void update(int id, PabPurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = load(purchasesFile);
    for (int i = 0; i < rows.size(); i++) {
      if (String.valueOf(id).equals(clean(rows.get(i).get("Id")))) {
        rows.set(i, toRow(id, request));
        Csv.write(purchasesFile, PURCHASE_HEADERS, rows);
        return;
      }
    }
    throw new IllegalArgumentException("Unknown PaB purchase id " + id);
  }

  public synchronized List<Map<String, Object>> parts(int purchaseId) throws IOException {
    requirePurchase(purchaseId);
    Map<String, Map<String, String>> partCatalog = catalog(partsCatalogFile, "part_num");
    Map<String, String> categoryNames = categoryNames();
    Map<String, Map<String, String>> colorCatalog = catalog(colorsCatalogFile, "id");
    String purchaseKey = String.valueOf(purchaseId);

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(partsFile)) {
      if (!purchaseKey.equals(clean(row.get("PaBPurchaseId")))) {
        continue;
      }
      String partNumber = clean(row.get("PartNumber"));
      String colorId = clean(row.get("PartColor"));
      Map<String, String> part = partCatalog.getOrDefault(partNumber, Map.of());
      Map<String, String> color = colorCatalog.getOrDefault(colorId, Map.of());

      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("id", toInt(row.get("Id")));
      entry.put("paBPurchaseId", toInt(row.get("PaBPurchaseId")));
      entry.put("partNumber", partNumber);
      entry.put("partColor", toInt(colorId));
      entry.put("quantity", toInt(row.get("Quantity")));
      entry.put("partName", clean(part.get("name")));
      entry.put("partCategory", categoryNames.getOrDefault(clean(part.get("part_cat_id")), ""));
      entry.put("colorName", clean(color.get("name")));
      entry.put("colorRgb", clean(color.get("rgb")));
      result.add(entry);
    }
    return result;
  }

  public synchronized int createPart(int purchaseId, PabPartRequest request) throws IOException {
    requirePurchase(purchaseId);
    List<Map<String, String>> rows = load(partsFile);
    int id = nextId(rows);
    rows.add(toPartRow(id, purchaseId, request));
    Csv.write(partsFile, PART_HEADERS, rows);
    return id;
  }

  public synchronized void updatePart(int id, PabPartRequest request) throws IOException {
    List<Map<String, String>> rows = load(partsFile);
    for (int i = 0; i < rows.size(); i++) {
      if (String.valueOf(id).equals(clean(rows.get(i).get("Id")))) {
        Integer purchaseId = toInt(rows.get(i).get("PaBPurchaseId"));
        if (purchaseId == null) {
          throw new IllegalArgumentException("Unknown PaB purchase for part id " + id);
        }
        rows.set(i, toPartRow(id, purchaseId, request));
        Csv.write(partsFile, PART_HEADERS, rows);
        return;
      }
    }
    throw new IllegalArgumentException("Unknown PaB part id " + id);
  }

  private void requirePurchase(int purchaseId) throws IOException {
    for (Map<String, String> row : Csv.read(purchasesFile)) {
      if (String.valueOf(purchaseId).equals(clean(row.get("Id")))) {
        return;
      }
    }
    throw new IllegalArgumentException("Unknown PaB purchase id " + purchaseId);
  }

  private Map<String, String> toPartRow(int id, int purchaseId, PabPartRequest request) throws IOException {
    String partNumber = clean(request == null ? null : request.partNumber());
    if (partNumber.isEmpty()) {
      throw new IllegalArgumentException("Part number is required");
    }
    if (!catalog(partsCatalogFile, "part_num").containsKey(partNumber)) {
      throw new IllegalArgumentException("Unknown part number " + partNumber);
    }
    Integer color = request == null ? null : request.partColor();
    if (color == null) {
      throw new IllegalArgumentException("Part color is required");
    }
    if (!catalog(colorsCatalogFile, "id").containsKey(String.valueOf(color))) {
      throw new IllegalArgumentException("Unknown part color " + color);
    }
    int quantity = request == null || request.quantity() == null ? 1 : request.quantity();
    if (quantity < 1) {
      throw new IllegalArgumentException("Quantity must be at least 1");
    }

    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", String.valueOf(id));
    row.put("PaBPurchaseId", String.valueOf(purchaseId));
    row.put("PartNumber", partNumber);
    row.put("PartColor", String.valueOf(color));
    row.put("Quantity", String.valueOf(quantity));
    return row;
  }

  private static Map<String, Map<String, String>> catalog(Path file, String key) throws IOException {
    Map<String, Map<String, String>> result = new LinkedHashMap<>();
    for (Map<String, String> row : Csv.read(file)) {
      String value = clean(row.get(key));
      if (!value.isEmpty()) {
        result.put(value, row);
      }
    }
    return result;
  }

  private Map<String, String> categoryNames() throws IOException {
    Map<String, String> names = new LinkedHashMap<>();
    for (Map<String, String> row : Csv.read(categoriesCatalogFile)) {
      String id = clean(row.get("id"));
      if (!id.isEmpty()) {
        names.put(id, clean(row.get("name")));
      }
    }
    return names;
  }

  private Map<String, Integer> partTotals() throws IOException {
    Map<String, Integer> totals = new LinkedHashMap<>();
    for (Map<String, String> part : Csv.read(partsFile)) {
      String purchaseId = clean(part.get("PaBPurchaseId"));
      Integer quantity = toInt(part.get("Quantity"));
      if (!purchaseId.isEmpty() && quantity != null) {
        totals.merge(purchaseId, quantity, Integer::sum);
      }
    }
    return totals;
  }

  private static Map<String, String> toRow(int id, PabPurchaseRequest request) {
    String date = clean(request == null ? null : request.purchaseDate());
    if (!DATE.matcher(date).matches()) {
      throw new IllegalArgumentException("Purchase date must use the yyyy/MM/dd format");
    }
    int boxes = request == null || request.boxQuantity() == null ? 1 : request.boxQuantity();
    if (boxes < 1) {
      throw new IllegalArgumentException("Box quantity must be at least 1");
    }
    BigDecimal price = request == null || request.price() == null ? BigDecimal.ZERO : request.price();
    if (price.signum() < 0) {
      throw new IllegalArgumentException("Price must not be negative");
    }
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", String.valueOf(id));
    row.put("PurchaseDate", date);
    row.put("BoxQuantity", String.valueOf(boxes));
    row.put("Price", price.stripTrailingZeros().toPlainString());
    return row;
  }

  private static List<Map<String, String>> load(Path file) throws IOException {
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(file)) {
      Map<String, String> cleaned = new LinkedHashMap<>();
      row.forEach((column, value) -> cleaned.put(column, clean(value)));
      rows.add(cleaned);
    }
    return rows;
  }

  private static int nextId(List<Map<String, String>> rows) {
    return rows.stream()
        .map(row -> toInt(row.get("Id")))
        .filter(Objects::nonNull)
        .max(Integer::compare)
        .orElse(0) + 1;
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }

  private static Integer toInt(String value) {
    try {
      return value == null || value.isBlank() ? null : Integer.valueOf(value.trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static Double toDouble(String value) {
    try {
      return value == null || value.isBlank() ? null : Double.valueOf(value.trim());
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
