package com.bricktools.purchase;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.BufferedReader;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Builds the inventory of a Lego set from the Rebrickable inventory files and stores the actual
 * quantity of each part in data/bt/SetInventory.csv.
 *
 * <p>The expected quantities are aggregated by part and color. Spare parts are included in the
 * expected quantity because they are physically present in the box.
 */
@Service
public class SetInventoryService {

  private static final List<String> HEADERS =
      List.of("SetNumber", "PartNumber", "ColorId", "ExpectedQut", "ActualQut");
  private static final Pattern SET_NUMBER = Pattern.compile("[A-Za-z0-9-]+");
  private static final Pattern PART_NUMBER = Pattern.compile("[A-Za-z0-9._-]+");

  private final Path setInventoryFile;
  private final Path inventoriesFile;
  private final Path inventoryPartsFile;
  private final Path partsFile;
  private final Path categoriesFile;
  private final Path colorsFile;

  private final Map<String, CachedParts> expectedCache = new HashMap<>();
  private Map<String, Map<String, String>> partsCatalog;
  private Map<String, Map<String, String>> colorsCatalog;
  private Map<String, String> categoryNames;
  private FileStamp partsStamp;
  private FileStamp colorsStamp;
  private FileStamp categoriesStamp;

  public SetInventoryService(BrickToolsProperties props) {
    Path data = props.dataPath();
    this.setInventoryFile = data.resolve("bt/SetInventory.csv");
    this.inventoriesFile = data.resolve("re/inventories.csv");
    this.inventoryPartsFile = data.resolve("re/inventory_parts.csv");
    this.partsFile = data.resolve("re/parts.csv");
    this.categoriesFile = data.resolve("re/part_categories.csv");
    this.colorsFile = data.resolve("re/colors.csv");
  }

  /**
   * Returns the parts of a set with their expected and actual quantities, part names and colors.
   * Parts without a stored actual quantity default to 0.
   */
  public synchronized List<Map<String, Object>> list(String setNumber) throws IOException {
    String set = cleanSetNumber(setNumber);
    Map<String, Integer> actual = actualQuantities(set);
    Map<String, Map<String, String>> parts = partsCatalog();
    Map<String, Map<String, String>> colors = colorsCatalog();
    Map<String, String> categories = categoryNames();

    List<Map<String, Object>> result = new ArrayList<>();
    for (ExpectedPart part : expectedParts(set)) {
      Map<String, String> partRow = parts.getOrDefault(part.partNumber(), Map.of());
      Map<String, String> colorRow = colors.getOrDefault(String.valueOf(part.colorId()), Map.of());
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("partNumber", part.partNumber());
      entry.put("colorId", part.colorId());
      entry.put("expectedQut", part.quantity());
      entry.put("actualQut", actual.getOrDefault(key(part.partNumber(), part.colorId()), 0));
      entry.put("partName", clean(partRow.get("name")));
      entry.put("partCategory", categories.getOrDefault(clean(partRow.get("part_cat_id")), ""));
      entry.put("colorName", clean(colorRow.get("name")));
      entry.put("colorRgb", clean(colorRow.get("rgb")));
      result.add(entry);
    }
    result.sort(Comparator
        .comparing(SetInventoryService::sortName, String.CASE_INSENSITIVE_ORDER)
        .thenComparing(row -> clean((String) row.get("partNumber")), String.CASE_INSENSITIVE_ORDER)
        .thenComparingInt(row -> (Integer) row.get("colorId")));
    return result;
  }

  /**
   * Creates or updates the actual quantity of one part of a set.
   */
  public synchronized void updateActual(String setNumber, String partNumber, int colorId, Integer actualQut)
      throws IOException {
    String set = cleanSetNumber(setNumber);
    String part = cleanPartNumber(partNumber);
    if (colorId < 0) {
      throw new IllegalArgumentException("Invalid color id: " + colorId);
    }
    if (actualQut == null || actualQut < 0) {
      throw new IllegalArgumentException("Actual quantity must be a non-negative integer");
    }
    ExpectedPart expected = expectedParts(set).stream()
        .filter(item -> item.partNumber().equals(part) && item.colorId() == colorId)
        .findFirst()
        .orElseThrow(() -> new IllegalArgumentException(
            "Part " + part + " of color " + colorId + " is not in set " + set));

    List<Map<String, String>> rows = loadRows();
    for (Map<String, String> row : rows) {
      if (matches(row, set, part, colorId)) {
        row.put("ExpectedQut", String.valueOf(expected.quantity()));
        row.put("ActualQut", String.valueOf(actualQut));
        Csv.write(setInventoryFile, HEADERS, rows);
        return;
      }
    }
    rows.add(row(set, expected, actualQut));
    Csv.write(setInventoryFile, HEADERS, rows);
  }

  /**
   * Sets the actual quantity of every stored part of a set to 0.
   */
  public synchronized int clear(String setNumber) throws IOException {
    String set = cleanSetNumber(setNumber);
    List<Map<String, String>> rows = loadRows();
    int updated = 0;
    for (Map<String, String> row : rows) {
      if (set.equals(clean(row.get("SetNumber")))) {
        row.put("ActualQut", "0");
        updated++;
      }
    }
    if (updated > 0) {
      Csv.write(setInventoryFile, HEADERS, rows);
    }
    return updated;
  }

  /**
   * Sets the actual quantity of every expected part of a set to its expected quantity.
   */
  public synchronized int fill(String setNumber) throws IOException {
    String set = cleanSetNumber(setNumber);
    List<ExpectedPart> expected = expectedParts(set);
    List<Map<String, String>> rows = loadRows();
    Map<String, Integer> index = new HashMap<>();
    for (int i = 0; i < rows.size(); i++) {
      Map<String, String> row = rows.get(i);
      if (set.equals(clean(row.get("SetNumber")))) {
        Integer colorId = toInt(row.get("ColorId"));
        String partNumber = clean(row.get("PartNumber"));
        if (colorId != null && !partNumber.isEmpty()) {
          index.put(key(partNumber, colorId), i);
        }
      }
    }
    for (ExpectedPart part : expected) {
      Integer position = index.get(key(part.partNumber(), part.colorId()));
      if (position == null) {
        rows.add(row(set, part, part.quantity()));
      } else {
        Map<String, String> row = rows.get(position);
        row.put("ExpectedQut", String.valueOf(part.quantity()));
        row.put("ActualQut", String.valueOf(part.quantity()));
      }
    }
    if (!expected.isEmpty()) {
      Csv.write(setInventoryFile, HEADERS, rows);
    }
    return expected.size();
  }

  /**
   * Removes every stored row of a set from data/bt/SetInventory.csv.
   */
  public synchronized int delete(String setNumber) throws IOException {
    String set = cleanSetNumber(setNumber);
    List<Map<String, String>> rows = loadRows();
    int before = rows.size();
    rows.removeIf(row -> set.equals(clean(row.get("SetNumber"))));
    int removed = before - rows.size();
    if (removed > 0) {
      Csv.write(setInventoryFile, HEADERS, rows);
    }
    return removed;
  }

  private List<ExpectedPart> expectedParts(String setNumber) throws IOException {
    FileStamp inventoriesStamp = FileStamp.of(inventoriesFile);
    FileStamp partsStamp = FileStamp.of(inventoryPartsFile);
    CachedParts cached = expectedCache.get(setNumber);
    if (cached != null
        && cached.inventories().equals(inventoriesStamp)
        && cached.inventoryParts().equals(partsStamp)) {
      return cached.parts();
    }

    String inventoryId = findInventoryId(setNumber);
    List<ExpectedPart> parts = inventoryId == null ? List.of() : scanInventoryParts(inventoryId);
    expectedCache.put(setNumber, new CachedParts(inventoriesStamp, partsStamp, parts));
    return parts;
  }

  /**
   * Finds the inventory id of a set. Purchase set numbers use the "7922" form while Rebrickable
   * set numbers use the "7922-1" form. When several inventories exist for a set, the one with the
   * highest version and then the highest id is used.
   */
  private String findInventoryId(String setNumber) throws IOException {
    String variant = setNumber.contains("-") ? setNumber : setNumber + "-1";
    String bestId = null;
    int bestVersion = Integer.MIN_VALUE;
    int bestIdValue = Integer.MIN_VALUE;
    for (Map<String, String> row : Csv.read(inventoriesFile)) {
      String setNum = clean(row.get("set_num"));
      if (!setNum.equals(setNumber) && !setNum.equals(variant)) {
        continue;
      }
      int version = Objects.requireNonNullElse(toInt(row.get("version")), 0);
      int id = Objects.requireNonNullElse(toInt(row.get("id")), 0);
      if (version > bestVersion || (version == bestVersion && id > bestIdValue)) {
        bestVersion = version;
        bestIdValue = id;
        bestId = clean(row.get("id"));
      }
    }
    return bestId;
  }

  /**
   * Streams data/re/inventory_parts.csv and aggregates the quantities of one inventory by part and
   * color. The file is too large to be read in full for every request.
   */
  private List<ExpectedPart> scanInventoryParts(String inventoryId) throws IOException {
    Map<String, Integer> quantities = new LinkedHashMap<>();
    Map<String, ExpectedPart> parts = new LinkedHashMap<>();
    if (!Files.isRegularFile(inventoryPartsFile)) {
      return List.of();
    }
    String prefix = inventoryId + ",";
    try (BufferedReader reader = Files.newBufferedReader(inventoryPartsFile, StandardCharsets.UTF_8)) {
      String line;
      while ((line = reader.readLine()) != null) {
        if (!line.startsWith(prefix)) {
          continue;
        }
        String[] fields = line.split(",", 6);
        if (fields.length < 4) {
          continue;
        }
        String partNumber = clean(fields[1]);
        Integer colorId = toInt(fields[2]);
        Integer quantity = toInt(fields[3]);
        if (partNumber.isEmpty() || colorId == null || quantity == null || quantity <= 0) {
          continue;
        }
        String key = key(partNumber, colorId);
        quantities.merge(key, quantity, Integer::sum);
        parts.putIfAbsent(key, new ExpectedPart(partNumber, colorId, 0));
      }
    }
    List<ExpectedPart> result = new ArrayList<>();
    for (Map.Entry<String, Integer> entry : quantities.entrySet()) {
      ExpectedPart part = parts.get(entry.getKey());
      result.add(new ExpectedPart(part.partNumber(), part.colorId(), entry.getValue()));
    }
    return result;
  }

  private Map<String, Integer> actualQuantities(String setNumber) throws IOException {
    Map<String, Integer> result = new HashMap<>();
    for (Map<String, String> row : Csv.read(setInventoryFile)) {
      if (!setNumber.equals(clean(row.get("SetNumber")))) {
        continue;
      }
      String partNumber = clean(row.get("PartNumber"));
      Integer colorId = toInt(row.get("ColorId"));
      if (partNumber.isEmpty() || colorId == null) {
        continue;
      }
      result.put(key(partNumber, colorId), Objects.requireNonNullElse(toInt(row.get("ActualQut")), 0));
    }
    return result;
  }

  private Map<String, Map<String, String>> partsCatalog() throws IOException {
    FileStamp stamp = FileStamp.of(partsFile);
    if (partsCatalog == null || !stamp.equals(partsStamp)) {
      partsCatalog = catalog(partsFile, "part_num");
      partsStamp = stamp;
    }
    return partsCatalog;
  }

  private Map<String, Map<String, String>> colorsCatalog() throws IOException {
    FileStamp stamp = FileStamp.of(colorsFile);
    if (colorsCatalog == null || !stamp.equals(colorsStamp)) {
      colorsCatalog = catalog(colorsFile, "id");
      colorsStamp = stamp;
    }
    return colorsCatalog;
  }

  private Map<String, String> categoryNames() throws IOException {
    FileStamp stamp = FileStamp.of(categoriesFile);
    if (categoryNames == null || !stamp.equals(categoriesStamp)) {
      Map<String, String> names = new HashMap<>();
      for (Map<String, String> row : Csv.read(categoriesFile)) {
        String id = clean(row.get("id"));
        if (!id.isEmpty()) {
          names.put(id, clean(row.get("name")));
        }
      }
      categoryNames = names;
      categoriesStamp = stamp;
    }
    return categoryNames;
  }

  private static Map<String, Map<String, String>> catalog(Path file, String key) throws IOException {
    Map<String, Map<String, String>> result = new HashMap<>();
    for (Map<String, String> row : Csv.read(file)) {
      String value = clean(row.get(key));
      if (!value.isEmpty()) {
        result.put(value, row);
      }
    }
    return result;
  }

  private List<Map<String, String>> loadRows() throws IOException {
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(setInventoryFile)) {
      Map<String, String> cleaned = new LinkedHashMap<>();
      for (String header : HEADERS) {
        cleaned.put(header, clean(row.get(header)));
      }
      rows.add(cleaned);
    }
    return rows;
  }

  private static Map<String, String> row(String setNumber, ExpectedPart part, int actualQut) {
    Map<String, String> row = new LinkedHashMap<>();
    row.put("SetNumber", setNumber);
    row.put("PartNumber", part.partNumber());
    row.put("ColorId", String.valueOf(part.colorId()));
    row.put("ExpectedQut", String.valueOf(part.quantity()));
    row.put("ActualQut", String.valueOf(actualQut));
    return row;
  }

  private static boolean matches(Map<String, String> row, String setNumber, String partNumber, int colorId) {
    return setNumber.equals(clean(row.get("SetNumber")))
        && partNumber.equals(clean(row.get("PartNumber")))
        && Objects.equals(toInt(row.get("ColorId")), colorId);
  }

  private static String sortName(Map<String, Object> row) {
    String name = clean((String) row.get("partName"));
    return name.isEmpty() ? clean((String) row.get("partNumber")) : name;
  }

  private static String cleanSetNumber(String value) {
    String setNumber = clean(value);
    if (setNumber.isEmpty() || !SET_NUMBER.matcher(setNumber).matches()) {
      throw new IllegalArgumentException("Invalid set number: " + value);
    }
    return setNumber;
  }

  private static String cleanPartNumber(String value) {
    String partNumber = clean(value);
    if (partNumber.isEmpty() || !PART_NUMBER.matcher(partNumber).matches() || partNumber.contains("..")) {
      throw new IllegalArgumentException("Invalid part number: " + value);
    }
    return partNumber;
  }

  private static String key(String partNumber, int colorId) {
    return partNumber + "\u0000" + colorId;
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

  private record ExpectedPart(String partNumber, int colorId, int quantity) {}

  private record CachedParts(FileStamp inventories, FileStamp inventoryParts, List<ExpectedPart> parts) {}

  private record FileStamp(long modified, long size) {
    static FileStamp of(Path file) throws IOException {
      return Files.exists(file)
          ? new FileStamp(Files.getLastModifiedTime(file).toMillis(), Files.size(file))
          : new FileStamp(-1, -1);
    }
  }
}
