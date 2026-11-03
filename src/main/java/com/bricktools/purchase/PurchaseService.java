package com.bricktools.purchase;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class PurchaseService {

  private static final List<String> HEADERS = List.of(
      "Id", "SetNumber", "PurchasePrice", "PurchaseDate", "Vendor", "BroughtBy", "Owner", "PartMissings", "Owned");
  private static final Pattern DATE = Pattern.compile("\\d{4}/\\d{2}/\\d{2}");

  private final Path purchasesFile;
  private final Path setsFile;
  private final Path themesFile;
  private final Path pricesFile;

  public PurchaseService(BrickToolsProperties props) {
    Path data = props.dataPath();
    this.purchasesFile = data.resolve("bt/purchased_sets.csv");
    this.setsFile = data.resolve("re/sets.csv");
    this.themesFile = data.resolve("re/themes.csv");
    this.pricesFile = data.resolve("bw/setprices.csv");
  }

  public synchronized List<Map<String, Object>> list() throws IOException {
    Map<String, Map<String, String>> sets = new HashMap<>();
    for (Map<String, String> set : Csv.read(setsFile)) {
      sets.put(set.get("set_num"), set);
    }
    Map<String, String> themes = new HashMap<>();
    for (Map<String, String> theme : Csv.read(themesFile)) {
      themes.put(theme.get("id"), theme.get("name"));
    }
    Map<String, String> prices = new HashMap<>();
    for (Map<String, String> price : Csv.read(pricesFile)) {
      prices.put(price.get("SetNumber"), price.get("LegoPrice"));
    }

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> purchase : Csv.read(purchasesFile)) {
      String setNumber = purchase.get("SetNumber");
      Map<String, String> set = sets.getOrDefault(setNumber + "-1", Map.of());
      Integer numParts = toInt(set.get("num_parts"));
      int missing = Objects.requireNonNullElse(toInt(purchase.get("PartMissings")), 0);
      Double price = toDouble(purchase.get("PurchasePrice"));
      Double official = toDouble(prices.get(setNumber));

      Map<String, Object> row = new LinkedHashMap<>();
      row.put("id", toInt(purchase.get("Id")));
      row.put("setNumber", setNumber);
      row.put("name", set.get("name"));
      row.put("numParts", numParts);
      row.put("year", toInt(set.get("year")));
      row.put("theme", themes.get(set.get("theme_id")));
      row.put("officialPrice", official);
      row.put("price", price);
      row.put("promo", price != null && official != null && official > 0 ? price / official * 100 : null);
      row.put("purchaseDate", purchase.get("PurchaseDate"));
      row.put("vendor", purchase.get("Vendor"));
      row.put("broughtBy", purchase.get("BroughtBy"));
      row.put("owner", purchase.get("Owner"));
      row.put("partsMissing", missing);
      row.put("complete", numParts != null && numParts > 0 ? (1.0 - (double) missing / numParts) * 100 : null);
      row.put("owned", Boolean.parseBoolean(purchase.get("Owned")));
      result.add(row);
    }
    return result;
  }

  public synchronized int create(PurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = new ArrayList<>(Csv.read(purchasesFile));
    int id = rows.stream()
        .map(r -> toInt(r.get("Id")))
        .filter(Objects::nonNull)
        .max(Integer::compare)
        .orElse(0) + 1;
    rows.add(toRow(id, request));
    Csv.write(purchasesFile, HEADERS, rows);
    return id;
  }

  public synchronized void update(int id, PurchaseRequest request) throws IOException {
    List<Map<String, String>> rows = new ArrayList<>(Csv.read(purchasesFile));
    for (int i = 0; i < rows.size(); i++) {
      if (String.valueOf(id).equals(rows.get(i).get("Id"))) {
        rows.set(i, toRow(id, request));
        Csv.write(purchasesFile, HEADERS, rows);
        return;
      }
    }
    throw new IllegalArgumentException("Unknown purchase id " + id);
  }

  private static Map<String, String> toRow(int id, PurchaseRequest request) {
    if (request.setNumber() == null || request.setNumber().isBlank()) {
      throw new IllegalArgumentException("Set number is required");
    }
    if (request.purchaseDate() == null || !DATE.matcher(request.purchaseDate()).matches()) {
      throw new IllegalArgumentException("Purchase date must use the yyyy/MM/dd format");
    }
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", String.valueOf(id));
    row.put("SetNumber", request.setNumber().trim());
    row.put("PurchasePrice", request.purchasePrice() == null ? "0" : request.purchasePrice().toPlainString());
    row.put("PurchaseDate", request.purchaseDate());
    row.put("Vendor", trimOrEmpty(request.vendor()));
    row.put("BroughtBy", trimOrEmpty(request.broughtBy()));
    row.put("Owner", trimOrEmpty(request.owner()));
    row.put("PartMissings", String.valueOf(request.partMissings() == null ? 0 : request.partMissings()));
    row.put("Owned", String.valueOf(request.owned() == null || request.owned()));
    return row;
  }

  private static String trimOrEmpty(String value) {
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
