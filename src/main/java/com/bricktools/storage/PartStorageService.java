package com.bricktools.storage;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.LinkedHashSet;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import org.springframework.stereotype.Service;

/**
 * Stores the physical part storages and the part collection rules, and expands the rules into
 * drawer contents. Data lives in data/bt/part_storage.csv and data/bt/part_collection.csv.
 */
@Service
public class PartStorageService {

  private static final List<String> STORAGE_HEADERS =
      List.of("Id", "Model", "DrawersCount", "Location", "Description");
  private static final List<String> COLLECTION_HEADERS =
      List.of("Parts", "Colors", "StorageId", "Drawer", "Amount");
  private static final int MATCH_LIMIT = 3000;
  private static final int DRAWER_MATCH_LIMIT = 200;

  private final Path storageFile;
  private final Path collectionFile;
  private final Path categoriesFile;
  private final Path rebrickableCategoriesFile;
  private final Path partsFile;
  private final Path colorsFile;
  private final Path partColorsFile;
  private final Path defaultColorsFile;

  private Catalog catalog;
  private long catalogStamp = Long.MIN_VALUE;

  public PartStorageService(BrickToolsProperties props) {
    Path data = props.dataPath();
    this.storageFile = data.resolve("bt/part_storage.csv");
    this.collectionFile = data.resolve("bt/part_collection.csv");
    this.categoriesFile = data.resolve("bt/part_categories.csv");
    this.rebrickableCategoriesFile = data.resolve("re/part_categories.csv");
    this.partsFile = data.resolve("re/parts.csv");
    this.colorsFile = data.resolve("re/colors.csv");
    this.partColorsFile = data.resolve("bt/part_color_url.csv");
    this.defaultColorsFile = data.resolve("bt/part_default_color.csv");
  }

  // ============================================================================
  // Storages
  // ============================================================================

  public synchronized List<Map<String, Object>> storages() throws IOException {
    List<Map<String, String>> rows = loadStorages();
    rows.sort(Comparator.comparing(row -> clean(row.get("Id")), String.CASE_INSENSITIVE_ORDER));
    List<Map<String, String>> collection = loadCollection();
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : rows) {
      Map<String, Object> entry = storageEntry(row);
      long rowCount = collection.stream()
          .filter(item -> clean(item.get("StorageId")).equalsIgnoreCase(clean(row.get("Id"))))
          .count();
      entry.put("rowCount", rowCount);
      result.add(entry);
    }
    return result;
  }

  public synchronized Map<String, Object> createStorage(PartStorageRequest request) throws IOException {
    List<Map<String, String>> rows = loadStorages();
    String id = clean(request == null ? null : request.id());
    if (id.isEmpty()) {
      throw new IllegalArgumentException("Storage id is required");
    }
    if (rows.stream().anyMatch(row -> clean(row.get("Id")).equalsIgnoreCase(id))) {
      throw new IllegalArgumentException("Storage id " + id + " already exists");
    }
    Map<String, String> row = toStorageRow(id, request);
    rows.add(row);
    Csv.write(storageFile, STORAGE_HEADERS, rows);
    return storageEntry(row);
  }

  public synchronized Map<String, Object> updateStorage(String id, PartStorageRequest request)
      throws IOException {
    String key = clean(id);
    List<Map<String, String>> rows = loadStorages();
    for (int i = 0; i < rows.size(); i++) {
      if (clean(rows.get(i).get("Id")).equalsIgnoreCase(key)) {
        Map<String, String> row = toStorageRow(clean(rows.get(i).get("Id")), request);
        rows.set(i, row);
        Csv.write(storageFile, STORAGE_HEADERS, rows);
        return storageEntry(row);
      }
    }
    throw new IllegalArgumentException("Unknown storage id " + key);
  }

  // ============================================================================
  // Collection rules
  // ============================================================================

  public synchronized List<Map<String, Object>> collectionRows() throws IOException {
    List<Map<String, String>> rows = loadCollection();
    List<Map<String, Object>> result = new ArrayList<>();
    for (int i = 0; i < rows.size(); i++) {
      result.add(collectionEntry(i, rows.get(i)));
    }
    return result;
  }

  public synchronized Map<String, Object> createCollectionRow(PartCollectionRequest request)
      throws IOException {
    List<Map<String, String>> rows = loadCollection();
    Map<String, String> row = toCollectionRow(request);
    ensureUnique(rows, row, -1);
    rows.add(row);
    Csv.write(collectionFile, COLLECTION_HEADERS, rows);
    return collectionEntry(rows.size() - 1, row);
  }

  public synchronized Map<String, Object> updateCollectionRow(int index, PartCollectionRequest request)
      throws IOException {
    List<Map<String, String>> rows = loadCollection();
    if (index < 0 || index >= rows.size()) {
      throw new IllegalArgumentException("Unknown part collection row " + index);
    }
    Map<String, String> row = toCollectionRow(request);
    ensureUnique(rows, row, index);
    rows.set(index, row);
    Csv.write(collectionFile, COLLECTION_HEADERS, rows);
    return collectionEntry(index, row);
  }

  public synchronized void deleteCollectionRow(int index) throws IOException {
    List<Map<String, String>> rows = loadCollection();
    if (index < 0 || index >= rows.size()) {
      throw new IllegalArgumentException("Unknown part collection row " + index);
    }
    rows.remove(index);
    Csv.write(collectionFile, COLLECTION_HEADERS, rows);
  }

  // ============================================================================
  // Drawer expansion and search
  // ============================================================================

  /**
   * Returns one card per drawer of every storage. When a query is given, only the drawers that
   * contain at least one matching part are returned and their matching parts are resolved.
   */
  public synchronized List<Map<String, Object>> drawers(String query) throws IOException {
    Catalog data = catalog();
    String cleaned = clean(query);
    MatchContext context = cleaned.isEmpty() ? null : match(data, cleaned);
    List<Map<String, String>> storages = loadStorages();
    List<Map<String, String>> collection = loadCollection();
    storages.sort(Comparator.comparing(row -> clean(row.get("Id")), String.CASE_INSENSITIVE_ORDER));

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> storage : storages) {
      String storageId = clean(storage.get("Id"));
      for (String drawer : drawerLabels(storage, collection)) {
        List<Integer> indexes = new ArrayList<>();
        List<Map<String, String>> rows = new ArrayList<>();
        for (int i = 0; i < collection.size(); i++) {
          Map<String, String> row = collection.get(i);
          if (clean(row.get("StorageId")).equalsIgnoreCase(storageId)
              && clean(row.get("Drawer")).equals(drawer)) {
            indexes.add(i);
            rows.add(row);
          }
        }

        List<Map<String, Object>> matched = new ArrayList<>();
        if (context != null) {
          matched = matchedParts(data, collection, rows, context);
          if (matched.isEmpty()) {
            continue;
          }
        }

        Map<String, Object> card = new LinkedHashMap<>();
        card.put("storageId", storageId);
        card.put("storageModel", clean(storage.get("Model")));
        card.put("storageLocation", clean(storage.get("Location")));
        card.put("drawersCount", toInt(storage.get("DrawersCount")));
        card.put("drawer", drawer);
        card.put("rows", resolvedRows(data, collection, indexes, rows));
        card.put("matchedParts", matched);
        result.add(card);
      }
    }
    return result;
  }

  // ============================================================================
  // Add parts to a storage / drawer
  // ============================================================================

  public synchronized int addParts(String storageId, String drawer, List<String> partNumbers)
      throws IOException {
    Catalog data = catalog();
    Map<String, String> storage = requireStorage(storageId);
    String drawerValue = clean(drawer);
    if (toInt(storage.get("DrawersCount")) == null || toInt(storage.get("DrawersCount")) <= 0) {
      if (!drawerValue.isEmpty()) {
        throw new IllegalArgumentException("Storage " + clean(storage.get("Id")) + " has no drawer");
      }
    }

    List<String> numbers = cleanPartNumbers(partNumbers);
    if (numbers.isEmpty()) {
      throw new IllegalArgumentException("No part number provided");
    }
    List<Map<String, String>> rows = loadCollection();
    int added = 0;
    for (String partNumber : numbers) {
      if (!data.parts.containsKey(partNumber)) {
        throw new IllegalArgumentException("Unknown part number " + partNumber);
      }
      Map<String, String> existing = null;
      for (Map<String, String> row : rows) {
        if (clean(row.get("StorageId")).equalsIgnoreCase(clean(storage.get("Id")))
            && clean(row.get("Drawer")).equals(drawerValue)
            && normalizeParts(row.get("Parts")).equals(partNumber)
            && isAnyColors(row.get("Colors"))) {
          existing = row;
          break;
        }
      }
      if (existing != null) {
        Integer amount = toInt(existing.get("Amount"));
        if (amount != null) {
          existing.put("Amount", String.valueOf(amount + 1));
        }
        added++;
        continue;
      }
      Map<String, String> row = new LinkedHashMap<>();
      row.put("Parts", partNumber);
      row.put("Colors", "Any");
      row.put("StorageId", clean(storage.get("Id")));
      row.put("Drawer", drawerValue);
      row.put("Amount", "1");
      rows.add(row);
      added++;
    }
    Csv.write(collectionFile, COLLECTION_HEADERS, rows);
    return added;
  }

  /**
   * Returns the default color of a part, or the first color it is available in.
   */
  public Integer defaultColorForPart(String partNumber) throws IOException {
    Catalog data = catalog();
    PartInfo part = data.parts.get(clean(partNumber));
    if (part == null) {
      return null;
    }
    ColorInfo color = colorFor(data, part, null);
    return color == null ? null : toInt(color.id());
  }

  public String defaultColorNameForPart(String partNumber) throws IOException {
    Catalog data = catalog();
    PartInfo part = data.parts.get(clean(partNumber));
    if (part == null) {
      return "";
    }
    ColorInfo color = colorFor(data, part, null);
    return color == null ? "" : color.name();
  }

  public String partName(String partNumber) throws IOException {
    PartInfo part = catalog().parts.get(clean(partNumber));
    return part == null ? "" : part.name();
  }

  // ============================================================================
  // Catalog
  // ============================================================================

  private Catalog catalog() throws IOException {
    long stamp = catalogStamp();
    if (catalog != null && stamp == catalogStamp) {
      return catalog;
    }
    Catalog data = new Catalog();
    for (Map<String, String> row : Csv.read(rebrickableCategoriesFile)) {
      String id = clean(row.get("id"));
      if (!id.isEmpty()) {
        data.categoryNames.put(id, clean(row.get("name")));
      }
    }
    for (Map<String, String> row : Csv.read(categoriesFile)) {
      String id = clean(row.get("Id"));
      if (!id.isEmpty()) {
        data.categoryNames.put(id, clean(row.get("Name")));
      }
    }
    for (Map<String, String> row : Csv.read(colorsFile)) {
      String id = clean(row.get("id"));
      if (!id.isEmpty()) {
        data.colors.put(id, new ColorInfo(id, clean(row.get("name")), clean(row.get("rgb"))));
      }
    }
    for (Map<String, String> row : Csv.read(defaultColorsFile)) {
      String partNumber = clean(row.get("PartNumber"));
      String colorId = clean(row.get("ColorId"));
      if (!partNumber.isEmpty() && !colorId.isEmpty()) {
        data.defaultColors.put(partNumber, colorId);
      }
    }
    for (Map<String, String> row : Csv.read(partsFile)) {
      String number = clean(row.get("part_num"));
      if (number.isEmpty()) {
        continue;
      }
      String categoryId = clean(row.get("part_cat_id"));
      String name = clean(row.get("name"));
      String categoryName = data.categoryNames.getOrDefault(categoryId, "");
      data.parts.put(number, new PartInfo(number, name, categoryId, categoryName, decorated(number, name)));
    }
    for (Map<String, String> row : Csv.read(partColorsFile)) {
      String partNumber = clean(row.get("PartNumber"));
      String colorId = clean(row.get("ColorId"));
      if (partNumber.isEmpty() || colorId.isEmpty()) {
        continue;
      }
      data.partColorIds.computeIfAbsent(partNumber, key -> new ArrayList<>()).add(colorId);
    }
    catalog = data;
    catalogStamp = stamp;
    return data;
  }

  private long catalogStamp() throws IOException {
    long stamp = 17;
    for (Path file : List.of(categoriesFile, rebrickableCategoriesFile, partsFile, colorsFile,
        partColorsFile, defaultColorsFile)) {
      if (Files.isRegularFile(file)) {
        stamp = stamp * 31 + Files.getLastModifiedTime(file).toMillis();
        stamp = stamp * 31 + Files.size(file);
      }
    }
    return stamp;
  }

  private MatchContext match(Catalog data, String query) {
    String needle = query.toLowerCase(Locale.ROOT);
    Set<String> colorIds = new LinkedHashSet<>();
    for (ColorInfo color : data.colors.values()) {
      if (color.id().equals(query) || color.name().toLowerCase(Locale.ROOT).contains(needle)) {
        colorIds.add(color.id());
      }
    }

    Map<String, String> colorByPart = new HashMap<>();
    LinkedHashSet<String> numbers = new LinkedHashSet<>();
    for (PartInfo part : data.parts.values()) {
      if (numbers.size() >= MATCH_LIMIT) {
        break;
      }
      if (part.number().toLowerCase(Locale.ROOT).contains(needle)
          || part.name().toLowerCase(Locale.ROOT).contains(needle)
          || part.categoryName().toLowerCase(Locale.ROOT).contains(needle)) {
        numbers.add(part.number());
      }
    }
    if (!colorIds.isEmpty()) {
      for (Map.Entry<String, List<String>> entry : data.partColorIds.entrySet()) {
        if (numbers.size() >= MATCH_LIMIT) {
          break;
        }
        for (String colorId : entry.getValue()) {
          if (colorIds.contains(colorId)) {
            numbers.add(entry.getKey());
            colorByPart.putIfAbsent(entry.getKey(), colorId);
            break;
          }
        }
      }
    }
    return new MatchContext(numbers, colorByPart);
  }

  private List<Map<String, Object>> matchedParts(Catalog data, List<Map<String, String>> allRows,
                                                 List<Map<String, String>> rows, MatchContext context) {
    List<Map<String, Object>> result = new ArrayList<>();
    Set<String> seen = new HashSet<>();
    for (String number : context.numbers()) {
      if (result.size() >= DRAWER_MATCH_LIMIT) {
        break;
      }
      PartInfo part = data.parts.get(number);
      if (part == null) {
        continue;
      }
      for (Map<String, String> row : rows) {
        if (!matchesRow(data, allRows, row, part, context.colorByPart().get(number))) {
          continue;
        }
        String queryColor = context.colorByPart().get(number);
        ColorInfo color = colorFor(data, part, queryColor);
        String key = number + "\u0000" + (color == null ? "" : color.id());
        if (seen.add(key)) {
          result.add(partEntry(data, part, color));
        }
        break;
      }
    }
    return result;
  }

  private boolean matchesRow(Catalog data, List<Map<String, String>> allRows, Map<String, String> row,
                             PartInfo part, String requiredColor) {
    if (!partsMatch(data, row.get("Parts"), part)) {
      return false;
    }
    if (requiredColor != null && !colorsOf(data, part).contains(requiredColor)) {
      return false;
    }
    return colorsMatch(data, allRows, row, part);
  }

  private boolean partsMatch(Catalog data, String value, PartInfo part) {
    List<String> tokens = split(value);
    if (tokens.isEmpty()) {
      return false;
    }
    for (String token : tokens) {
      if (token.startsWith("§")) {
        String category = clean(token.substring(1));
        if (!category.isEmpty() && categoryMatches(data, category, part.categoryId())) {
          return true;
        }
      } else if (token.startsWith("#")) {
        String tag = clean(token.substring(1)).toLowerCase(Locale.ROOT);
        if (!tag.isEmpty()
            && (part.name().toLowerCase(Locale.ROOT).contains(tag)
                || part.number().toLowerCase(Locale.ROOT).equals(tag))) {
          return true;
        }
      } else if (token.equalsIgnoreCase(part.number())) {
        return true;
      }
    }
    return false;
  }

  private boolean categoryMatches(Catalog data, String category, String categoryId) {
    if (category.equals(categoryId)) {
      return true;
    }
    return data.categoryNames.entrySet().stream()
        .anyMatch(entry -> entry.getKey().equals(categoryId)
            && entry.getValue().equalsIgnoreCase(category));
  }

  private boolean colorsMatch(Catalog data, List<Map<String, String>> allRows, Map<String, String> row,
                              PartInfo part) {
    List<String> tokens = split(row.get("Colors"));
    if (tokens.isEmpty()) {
      return false;
    }
    for (String token : tokens) {
      if (token.equalsIgnoreCase("Any")) {
        return true;
      }
      if (token.equalsIgnoreCase("Decorated")) {
        if (part.decorated()) {
          return true;
        }
      } else if (token.equalsIgnoreCase("Other")) {
        if (!part.decorated() && !explicitlyListed(data, allRows, row, part)) {
          return true;
        }
      } else if (colorsOf(data, part).contains(token)) {
        return true;
      }
    }
    return false;
  }

  private boolean explicitlyListed(Catalog data, List<Map<String, String>> allRows,
                                   Map<String, String> current, PartInfo part) {
    for (Map<String, String> row : allRows) {
      if (row == current || !partsMatch(data, row.get("Parts"), part)) {
        continue;
      }
      for (String token : split(row.get("Colors"))) {
        if (isNumeric(token)) {
          return true;
        }
      }
    }
    return false;
  }

  private List<String> colorsOf(Catalog data, PartInfo part) {
    return data.partColorIds.getOrDefault(part.number(), List.of());
  }

  private ColorInfo colorFor(Catalog data, PartInfo part, String requiredColor) {
    List<String> colorIds = colorsOf(data, part);
    String selected = requiredColor;
    if (selected == null || !colorIds.contains(selected)) {
      selected = data.defaultColors.get(part.number());
    }
    if (selected == null || (!colorIds.isEmpty() && !colorIds.contains(selected))) {
      selected = colorIds.isEmpty() ? null : colorIds.get(0);
    }
    return selected == null ? null : data.colors.get(selected);
  }

  private List<Map<String, Object>> resolvedRows(Catalog data, List<Map<String, String>> allRows,
                                                 List<Integer> indexes, List<Map<String, String>> rows) {
    List<Map<String, Object>> result = new ArrayList<>();
    for (int i = 0; i < rows.size(); i++) {
      Map<String, String> row = rows.get(i);
      Map<String, Object> entry = collectionEntry(indexes.get(i), row);
      entry.put("partChips", partChips(data, row.get("Parts")));
      entry.put("categoryChips", categoryChips(data, row.get("Parts")));
      entry.put("tagChips", tagChips(row.get("Parts")));
      entry.put("colorChips", colorChips(data, row.get("Colors")));
      result.add(entry);
    }
    return result;
  }

  private List<Map<String, Object>> partChips(Catalog data, String value) {
    List<Map<String, Object>> chips = new ArrayList<>();
    for (String token : split(value)) {
      if (token.startsWith("§") || token.startsWith("#")) {
        continue;
      }
      PartInfo part = data.parts.get(token);
      Map<String, Object> chip = new LinkedHashMap<>();
      chip.put("partNumber", token);
      chip.put("name", part == null ? "" : part.name());
      chip.put("categoryName", part == null ? "" : part.categoryName());
      ColorInfo color = part == null ? null : colorFor(data, part, null);
      chip.put("colorId", color == null ? null : toInt(color.id()));
      chips.add(chip);
    }
    return chips;
  }

  private List<Map<String, Object>> categoryChips(Catalog data, String value) {
    List<Map<String, Object>> chips = new ArrayList<>();
    for (String token : split(value)) {
      if (!token.startsWith("§")) {
        continue;
      }
      String category = clean(token.substring(1));
      String id = category;
      String name = data.categoryNames.getOrDefault(category, "");
      if (name.isEmpty()) {
        for (Map.Entry<String, String> entry : data.categoryNames.entrySet()) {
          if (entry.getValue().equalsIgnoreCase(category)) {
            id = entry.getKey();
            name = entry.getValue();
            break;
          }
        }
      }
      Map<String, Object> chip = new LinkedHashMap<>();
      chip.put("id", toInt(id));
      chip.put("value", category);
      chip.put("name", name.isEmpty() ? category : name);
      chips.add(chip);
    }
    return chips;
  }

  private List<String> tagChips(String value) {
    List<String> chips = new ArrayList<>();
    for (String token : split(value)) {
      if (token.startsWith("#")) {
        String tag = clean(token.substring(1));
        if (!tag.isEmpty()) {
          chips.add(tag);
        }
      }
    }
    return chips;
  }

  private List<Map<String, Object>> colorChips(Catalog data, String value) {
    List<Map<String, Object>> chips = new ArrayList<>();
    for (String token : split(value)) {
      Map<String, Object> chip = new LinkedHashMap<>();
      if (isNumeric(token)) {
        ColorInfo color = data.colors.get(token);
        chip.put("id", toInt(token));
        chip.put("name", color == null ? token : color.name());
        chip.put("rgb", color == null ? "" : color.rgb());
        chip.put("keyword", false);
      } else {
        chip.put("id", null);
        chip.put("name", canonicalKeyword(token));
        chip.put("rgb", "");
        chip.put("keyword", true);
      }
      chips.add(chip);
    }
    return chips;
  }

  private Map<String, Object> partEntry(Catalog data, PartInfo part, ColorInfo color) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("partNumber", part.number());
    entry.put("name", part.name());
    entry.put("categoryId", toInt(part.categoryId()));
    entry.put("categoryName", part.categoryName());
    entry.put("colorId", color == null ? null : toInt(color.id()));
    entry.put("colorName", color == null ? "" : color.name());
    entry.put("colorRgb", color == null ? "" : color.rgb());
    return entry;
  }

  // ============================================================================
  // Loading and validation
  // ============================================================================

  private List<Map<String, String>> loadStorages() throws IOException {
    return load(storageFile);
  }

  private List<Map<String, String>> loadCollection() throws IOException {
    return load(collectionFile);
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

  private Map<String, String> requireStorage(String storageId) throws IOException {
    String key = clean(storageId);
    if (key.isEmpty()) {
      throw new IllegalArgumentException("Storage id is required");
    }
    for (Map<String, String> row : loadStorages()) {
      if (clean(row.get("Id")).equalsIgnoreCase(key)) {
        return row;
      }
    }
    throw new IllegalArgumentException("Unknown storage id " + key);
  }

  private static Map<String, String> toStorageRow(String id, PartStorageRequest request) {
    int drawers = request == null || request.drawersCount() == null ? 0 : request.drawersCount();
    if (drawers < 0) {
      throw new IllegalArgumentException("Drawers count must not be negative");
    }
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", id);
    row.put("Model", clean(request == null ? null : request.model()));
    row.put("DrawersCount", String.valueOf(drawers));
    row.put("Location", clean(request == null ? null : request.location()));
    row.put("Description", clean(request == null ? null : request.description()));
    return row;
  }

  private Map<String, String> toCollectionRow(PartCollectionRequest request) throws IOException {
    String parts = normalizeParts(request == null ? null : request.parts());
    String colors = normalizeColors(request == null ? null : request.colors());
    String storageId = clean(request == null ? null : request.storageId());
    String drawer = clean(request == null ? null : request.drawer());
    String amount = clean(request == null ? null : request.amount());
    if (parts.isEmpty()) {
      throw new IllegalArgumentException("Parts are required");
    }
    if (colors.isEmpty()) {
      throw new IllegalArgumentException("Colors are required");
    }
    if (storageId.isEmpty()) {
      throw new IllegalArgumentException("Storage is required");
    }
    if (amount.isEmpty()) {
      throw new IllegalArgumentException("Amount is required");
    }
    Map<String, String> storage = requireStorage(storageId);
    if (toInt(storage.get("DrawersCount")) != null && toInt(storage.get("DrawersCount")) == 0
        && !drawer.isEmpty()) {
      throw new IllegalArgumentException("Storage " + clean(storage.get("Id")) + " has no drawer");
    }
    Map<String, String> row = new LinkedHashMap<>();
    row.put("Parts", parts);
    row.put("Colors", colors);
    row.put("StorageId", clean(storage.get("Id")));
    row.put("Drawer", drawer);
    row.put("Amount", amount);
    return row;
  }

  private static void ensureUnique(List<Map<String, String>> rows, Map<String, String> row, int index) {
    for (int i = 0; i < rows.size(); i++) {
      if (i == index) {
        continue;
      }
      Map<String, String> other = rows.get(i);
      if (clean(other.get("StorageId")).equalsIgnoreCase(row.get("StorageId"))
          && clean(other.get("Drawer")).equals(row.get("Drawer"))
          && normalizeParts(other.get("Parts")).equals(row.get("Parts"))
          && normalizeColors(other.get("Colors")).equals(row.get("Colors"))) {
        throw new IllegalArgumentException(
            "A row with the same parts and colors already exists in this drawer");
      }
    }
  }

  private static Map<String, Object> storageEntry(Map<String, String> row) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("id", clean(row.get("Id")));
    entry.put("model", clean(row.get("Model")));
    entry.put("drawersCount", toInt(row.get("DrawersCount")));
    entry.put("location", clean(row.get("Location")));
    entry.put("description", clean(row.get("Description")));
    return entry;
  }

  private static Map<String, Object> collectionEntry(int index, Map<String, String> row) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("index", index);
    entry.put("parts", clean(row.get("Parts")));
    entry.put("colors", clean(row.get("Colors")));
    entry.put("storageId", clean(row.get("StorageId")));
    entry.put("drawer", clean(row.get("Drawer")));
    entry.put("amount", clean(row.get("Amount")));
    return entry;
  }

  private static List<String> drawerLabels(Map<String, String> storage,
                                           List<Map<String, String>> collection) {
    LinkedHashSet<String> labels = new LinkedHashSet<>();
    Integer count = toInt(storage.get("DrawersCount"));
    if (count != null && count > 0) {
      for (int i = 0; i < count; i++) {
        labels.add(drawerLabel(i));
      }
    } else {
      labels.add("");
    }
    String storageId = clean(storage.get("Id"));
    for (Map<String, String> row : collection) {
      if (clean(row.get("StorageId")).equalsIgnoreCase(storageId)) {
        labels.add(clean(row.get("Drawer")));
      }
    }
    return new ArrayList<>(labels);
  }

  private static String drawerLabel(int index) {
    StringBuilder label = new StringBuilder();
    int value = index + 1;
    while (value > 0) {
      int remainder = (value - 1) % 26;
      label.insert(0, (char) ('A' + remainder));
      value = (value - 1) / 26;
    }
    return label.toString();
  }

  private static List<String> cleanPartNumbers(List<String> partNumbers) {
    LinkedHashSet<String> numbers = new LinkedHashSet<>();
    if (partNumbers != null) {
      for (String value : partNumbers) {
        String number = clean(value);
        if (!number.isEmpty()) {
          numbers.add(number);
        }
      }
    }
    return new ArrayList<>(numbers);
  }

  private static String normalizeParts(String value) {
    return String.join(";", split(value));
  }

  private static String normalizeColors(String value) {
    List<String> tokens = new ArrayList<>();
    for (String token : split(value)) {
      tokens.add(canonicalKeyword(token));
    }
    return String.join(";", tokens);
  }

  private static String canonicalKeyword(String token) {
    if (token.equalsIgnoreCase("Any")) {
      return "Any";
    }
    if (token.equalsIgnoreCase("Other")) {
      return "Other";
    }
    if (token.equalsIgnoreCase("Decorated")) {
      return "Decorated";
    }
    return token;
  }

  private static boolean isAnyColors(String value) {
    return split(value).stream().anyMatch(token -> token.equalsIgnoreCase("Any"));
  }

  private static List<String> split(String value) {
    List<String> tokens = new ArrayList<>();
    if (value == null) {
      return tokens;
    }
    for (String token : value.split(";")) {
      String cleaned = clean(token);
      if (!cleaned.isEmpty()) {
        tokens.add(cleaned);
      }
    }
    return tokens;
  }

  private static boolean isNumeric(String value) {
    return value != null && value.matches("-?\\d+");
  }

  private static boolean decorated(String number, String name) {
    String lowerName = name == null ? "" : name.toLowerCase(Locale.ROOT);
    String lowerNumber = number == null ? "" : number.toLowerCase(Locale.ROOT);
    return lowerName.contains("print")
        || lowerName.contains("pattern")
        || lowerName.contains("sticker")
        || lowerNumber.matches(".*(pr|pat)\\d+.*");
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

  private record PartInfo(String number, String name, String categoryId, String categoryName,
                          boolean decorated) {
  }

  private record ColorInfo(String id, String name, String rgb) {
  }

  private record MatchContext(Set<String> numbers, Map<String, String> colorByPart) {
  }

  private static final class Catalog {
    private final Map<String, PartInfo> parts = new LinkedHashMap<>();
    private final Map<String, String> categoryNames = new LinkedHashMap<>();
    private final Map<String, ColorInfo> colors = new LinkedHashMap<>();
    private final Map<String, List<String>> partColorIds = new HashMap<>();
    private final Map<String, String> defaultColors = new HashMap<>();
  }
}
