package com.bricktools.part;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.Comparator;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
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
