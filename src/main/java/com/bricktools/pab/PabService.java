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
  private static final Pattern DATE = Pattern.compile("\\d{4}/\\d{2}/\\d{2}");

  private final Path purchasesFile;
  private final Path partsFile;

  public PabService(BrickToolsProperties props) {
    this.purchasesFile = props.dataPath().resolve("bt/pab_purchases.csv");
    this.partsFile = props.dataPath().resolve("bt/pab_parts.csv");
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
