package com.bricktools.part;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeMap;
import org.springframework.stereotype.Service;

/**
 * Builds the Brick Tools main part catalogue and exposes the part categories used by the
 * Part explorer. Main parts are stored in data/bt/main_parts.csv.
 */
@Service
public class PartService {

  private static final List<String> MAIN_PART_HEADERS =
      List.of("PartNumber", "Name", "CategoryId", "Material", "HasAlternates", "Stars");
  private static final int SEARCH_LIMIT = 500;
  private static final Comparator<Map<String, String>> BY_NAME = Comparator
      .comparing((Map<String, String> row) -> clean(row.get("Name")), String.CASE_INSENSITIVE_ORDER)
      .thenComparing(row -> clean(row.get("PartNumber")), String.CASE_INSENSITIVE_ORDER);

  private final Path categoriesFile;
  private final Path partsFile;
  private final Path relationshipsFile;
  private final Path mainPartsFile;

  public PartService(BrickToolsProperties props) {
    this.categoriesFile = props.dataPath().resolve("bt/part_categories.csv");
    this.partsFile = props.dataPath().resolve("re/parts.csv");
    this.relationshipsFile = props.dataPath().resolve("re/part_relationships.csv");
    this.mainPartsFile = props.dataPath().resolve("bt/main_parts.csv");
  }

  /**
   * Rebuilds data/bt/main_parts.csv from the Rebrickable parts, excluding parts that belong to a
   * hidden category and parts that are children of another part. Existing star ratings are kept.
   */
  public synchronized Map<String, Object> generateMainParts() throws IOException {
    Set<String> hiddenCategories = new HashSet<>();
    for (Map<String, String> category : Csv.read(categoriesFile)) {
      if (isTrue(category.get("Hidden"))) {
        hiddenCategories.add(clean(category.get("Id")));
      }
    }

    Set<String> children = new HashSet<>();
    Set<String> parents = new HashSet<>();
    for (Map<String, String> relationship : Csv.read(relationshipsFile)) {
      String child = clean(relationship.get("child_part_num"));
      String parent = clean(relationship.get("parent_part_num"));
      if (!child.isEmpty()) {
        children.add(child);
      }
      if (!parent.isEmpty()) {
        parents.add(parent);
      }
    }

    Map<String, String> storedStars = new LinkedHashMap<>();
    for (Map<String, String> row : Csv.read(mainPartsFile)) {
      String number = clean(row.get("PartNumber"));
      if (!number.isEmpty()) {
        storedStars.put(number, validStars(row.get("Stars")));
      }
    }

    List<Map<String, String>> rows = new ArrayList<>();
    int hiddenParts = 0;
    int childParts = 0;
    int withAlternates = 0;
    for (Map<String, String> part : Csv.read(partsFile)) {
      String partNumber = clean(part.get("part_num"));
      if (partNumber.isEmpty()) {
        continue;
      }
      if (hiddenCategories.contains(clean(part.get("part_cat_id")))) {
        hiddenParts++;
        continue;
      }
      if (children.contains(partNumber)) {
        childParts++;
        continue;
      }

      boolean hasAlternates = parents.contains(partNumber);
      if (hasAlternates) {
        withAlternates++;
      }
      Map<String, String> row = new LinkedHashMap<>();
      row.put("PartNumber", partNumber);
      row.put("Name", clean(part.get("name")));
      row.put("CategoryId", clean(part.get("part_cat_id")));
      row.put("Material", clean(part.get("part_material")));
      row.put("HasAlternates", String.valueOf(hasAlternates));
      row.put("Stars", storedStars.getOrDefault(partNumber, "2"));
      rows.add(row);
    }
    rows.sort(BY_NAME);
    Csv.write(mainPartsFile, MAIN_PART_HEADERS, rows);

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("total", rows.size());
    result.put("hiddenParts", hiddenParts);
    result.put("childParts", childParts);
    result.put("withAlternates", withAlternates);
    return result;
  }

  /**
   * Returns the visible part categories grouped by their group name.
   */
  public List<Map<String, Object>> categories() throws IOException {
    Map<String, List<Map<String, Object>>> groups = new TreeMap<>(String.CASE_INSENSITIVE_ORDER);
    for (Map<String, String> row : Csv.read(categoriesFile)) {
      if (isTrue(row.get("Hidden"))) {
        continue;
      }
      String id = clean(row.get("Id"));
      if (id.isEmpty()) {
        continue;
      }
      String group = clean(row.get("Group"));
      if (group.isEmpty()) {
        group = "Other";
      }
      Map<String, Object> category = new LinkedHashMap<>();
      category.put("id", toInt(id));
      category.put("name", clean(row.get("Name")));
      groups.computeIfAbsent(group, key -> new ArrayList<>()).add(category);
    }

    List<Map<String, Object>> result = new ArrayList<>();
    groups.forEach((group, categories) -> {
      categories.sort(Comparator.comparing(
          category -> String.valueOf(category.get("name")), String.CASE_INSENSITIVE_ORDER));
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("group", group);
      entry.put("categories", categories);
      result.add(entry);
    });
    return result;
  }

  /**
   * Returns the main parts of a category, sorted by name.
   */
  public List<Map<String, Object>> mainParts(int categoryId) throws IOException {
    String category = String.valueOf(categoryId);
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(mainPartsFile)) {
      if (category.equals(clean(row.get("CategoryId")))) {
        rows.add(row);
      }
    }
    rows.sort(BY_NAME);

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : rows) {
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("partNumber", clean(row.get("PartNumber")));
      entry.put("name", clean(row.get("Name")));
      entry.put("categoryId", toInt(row.get("CategoryId")));
      entry.put("material", clean(row.get("Material")));
      entry.put("hasAlternates", isTrue(row.get("HasAlternates")));
      entry.put("stars", toInt(row.get("Stars")));
      result.add(entry);
    }
    return result;
  }

  /**
   * Searches the main parts by part number or name across all categories. The query is matched
   * case-insensitively; an empty query returns no part. At most {@value #SEARCH_LIMIT} parts are
   * returned, while the total number of matches is reported.
   */
  public Map<String, Object> searchMainParts(String query) throws IOException {
    String cleaned = clean(query);
    Map<String, String> categoryNames = new HashMap<>();
    for (Map<String, String> category : Csv.read(categoriesFile)) {
      categoryNames.put(clean(category.get("Id")), clean(category.get("Name")));
    }

    String needle = cleaned.toLowerCase(Locale.ROOT);
    List<Map<String, String>> rows = new ArrayList<>();
    if (!needle.isEmpty()) {
      for (Map<String, String> row : Csv.read(mainPartsFile)) {
        String number = clean(row.get("PartNumber"));
        String name = clean(row.get("Name"));
        if (number.toLowerCase(Locale.ROOT).contains(needle)
            || name.toLowerCase(Locale.ROOT).contains(needle)) {
          rows.add(row);
        }
      }
    }
    rows.sort(BY_NAME);

    List<Map<String, Object>> parts = new ArrayList<>();
    for (Map<String, String> row : rows) {
      if (parts.size() >= SEARCH_LIMIT) {
        break;
      }
      String categoryId = clean(row.get("CategoryId"));
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("partNumber", clean(row.get("PartNumber")));
      entry.put("name", clean(row.get("Name")));
      entry.put("categoryId", toInt(categoryId));
      entry.put("categoryName", categoryNames.getOrDefault(categoryId, ""));
      entry.put("material", clean(row.get("Material")));
      entry.put("hasAlternates", isTrue(row.get("HasAlternates")));
      entry.put("stars", toInt(row.get("Stars")));
      parts.add(entry);
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("query", cleaned);
    result.put("total", rows.size());
    result.put("limit", SEARCH_LIMIT);
    result.put("parts", parts);
    return result;
  }

  /**
   * Returns the information shown in the part information modal. Main parts provide their name,
   * material, alternates and stars; other Rebrickable parts fall back to data.re.parts and
   * data.re.part_relationships. Returns null when the part is unknown.
   */
  public Map<String, Object> info(String partNumber) throws IOException {
    String key = clean(partNumber);
    if (key.isEmpty()) {
      return null;
    }

    Map<String, String> main = null;
    for (Map<String, String> row : Csv.read(mainPartsFile)) {
      if (key.equals(clean(row.get("PartNumber")))) {
        main = row;
        break;
      }
    }
    Map<String, String> part = null;
    for (Map<String, String> row : Csv.read(partsFile)) {
      if (key.equals(clean(row.get("part_num")))) {
        part = row;
        break;
      }
    }
    if (main == null && part == null) {
      return null;
    }

    boolean hasAlternates;
    if (main != null) {
      hasAlternates = isTrue(main.get("HasAlternates"));
    } else {
      hasAlternates = false;
      for (Map<String, String> relationship : Csv.read(relationshipsFile)) {
        if (key.equals(clean(relationship.get("parent_part_num")))) {
          hasAlternates = true;
          break;
        }
      }
    }

    int categoryId = main == null
        ? toInt(part.get("part_cat_id")) : toInt(main.get("CategoryId"));
    String categoryName = "";
    boolean categoryHidden = false;
    for (Map<String, String> category : Csv.read(categoriesFile)) {
      if (String.valueOf(categoryId).equals(clean(category.get("Id")))) {
        categoryName = clean(category.get("Name"));
        categoryHidden = isTrue(category.get("Hidden"));
        break;
      }
    }

    Integer stars = main == null ? null : toInt(main.get("Stars"));
    Map<String, Object> result = new LinkedHashMap<>();
    result.put("partNumber", key);
    result.put("name", main == null ? clean(part.get("name")) : clean(main.get("Name")));
    result.put("material", main == null ? clean(part.get("part_material")) : clean(main.get("Material")));
    result.put("hasAlternates", hasAlternates);
    result.put("stars", stars == null ? 0 : stars);
    result.put("inMainParts", main != null);
    result.put("categoryId", categoryId);
    result.put("categoryName", categoryName);
    result.put("categoryHidden", categoryHidden);
    return result;
  }

  /**
   * Sets the star rating of a main part.
   */
  public synchronized void updateStars(String partNumber, Integer stars) throws IOException {
    if (stars == null || stars < 0 || stars > 5) {
      throw new IllegalArgumentException("Stars must be between 0 and 5");
    }
    String key = clean(partNumber);
    List<Map<String, String>> rows = new ArrayList<>();
    boolean found = false;
    for (Map<String, String> row : Csv.read(mainPartsFile)) {
      Map<String, String> copy = new LinkedHashMap<>(row);
      if (key.equals(clean(copy.get("PartNumber")))) {
        copy.put("Stars", String.valueOf(stars));
        found = true;
      }
      rows.add(copy);
    }
    if (!found) {
      throw new IllegalArgumentException("Unknown main part " + key);
    }
    Csv.write(mainPartsFile, MAIN_PART_HEADERS, rows);
  }

  /**
   * Sets the star rating of several main parts at once. Unknown part numbers are ignored.
   *
   * @return the number of main parts that were updated
   */
  public synchronized int updateStars(List<String> partNumbers, Integer stars) throws IOException {
    if (stars == null || stars < 0 || stars > 5) {
      throw new IllegalArgumentException("Stars must be between 0 and 5");
    }
    Set<String> keys = new HashSet<>();
    if (partNumbers != null) {
      for (String partNumber : partNumbers) {
        String key = clean(partNumber);
        if (!key.isEmpty()) {
          keys.add(key);
        }
      }
    }
    if (keys.isEmpty()) {
      throw new IllegalArgumentException("No part numbers provided");
    }

    int updated = 0;
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(mainPartsFile)) {
      Map<String, String> copy = new LinkedHashMap<>(row);
      if (keys.contains(clean(copy.get("PartNumber")))) {
        copy.put("Stars", String.valueOf(stars));
        updated++;
      }
      rows.add(copy);
    }
    if (updated > 0) {
      Csv.write(mainPartsFile, MAIN_PART_HEADERS, rows);
    }
    return updated;
  }

  /**
   * Returns the parts related to a main part through data.re.part_relationships, joined with the
   * matching data.re.parts rows.
   */
  public Map<String, Object> alternates(String partNumber) throws IOException {
    String key = clean(partNumber);
    Map<String, Map<String, String>> catalog = new LinkedHashMap<>();
    for (Map<String, String> part : Csv.read(partsFile)) {
      String number = clean(part.get("part_num"));
      if (!number.isEmpty()) {
        catalog.put(number, part);
      }
    }
    Map<String, String> main = catalog.get(key);

    List<Map<String, Object>> alternates = new ArrayList<>();
    for (Map<String, String> relationship : Csv.read(relationshipsFile)) {
      if (!key.equals(clean(relationship.get("parent_part_num")))) {
        continue;
      }
      String childNumber = clean(relationship.get("child_part_num"));
      Map<String, String> child = catalog.getOrDefault(childNumber, Map.of());
      Map<String, Object> row = new LinkedHashMap<>();
      row.put("relType", clean(relationship.get("rel_type")));
      row.put("childPartNumber", childNumber);
      row.put("childName", clean(child.get("name")));
      row.put("childCategoryId", toInt(child.get("part_cat_id")));
      row.put("childMaterial", clean(child.get("part_material")));
      row.put("parentPartNumber", key);
      row.put("parentName", main == null ? "" : clean(main.get("name")));
      alternates.add(row);
    }
    alternates.sort(Comparator
        .comparing((Map<String, Object> row) -> String.valueOf(row.get("childName")),
            String.CASE_INSENSITIVE_ORDER)
        .thenComparing(row -> String.valueOf(row.get("childPartNumber")),
            String.CASE_INSENSITIVE_ORDER));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("partNumber", key);
    result.put("name", main == null ? "" : clean(main.get("name")));
    result.put("alternates", alternates);
    return result;
  }

  private static String validStars(String value) {
    Integer stars = toInt(value);
    return stars == null || stars < 0 || stars > 5 ? "2" : String.valueOf(stars);
  }

  private static boolean isTrue(String value) {
    String cleaned = clean(value);
    return cleaned.equalsIgnoreCase("true") || cleaned.equals("1");
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
}
