package com.bricktools.color;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.regex.Matcher;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Exposes the Rebrickable color catalogue and the color identifiers used by external systems.
 *
 * <p>Both CSV files are read once and kept in memory because they are reference data.</p>
 */
@Service
public class ColorService {

  private static final Pattern QUOTED = Pattern.compile("\"([^\"]*)\"");

  private final Path colorsFile;
  private final Path mappingsFile;

  private List<Map<String, Object>> colors;
  private List<Map<String, Object>> mappings;

  public ColorService(BrickToolsProperties props) {
    Path data = props.dataPath();
    this.colorsFile = data.resolve("re/colors.csv");
    this.mappingsFile = data.resolve("re/color_mappings.csv");
  }

  public synchronized List<Map<String, Object>> colors() throws IOException {
    if (colors == null) {
      colors = loadColors();
    }
    return colors;
  }

  public synchronized List<Map<String, Object>> mappings() throws IOException {
    if (mappings == null) {
      mappings = loadMappings();
    }
    return mappings;
  }

  private List<Map<String, Object>> loadColors() throws IOException {
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(colorsFile)) {
      Map<String, Object> color = new LinkedHashMap<>();
      color.put("id", toInt(row.get("id")));
      color.put("name", clean(row.get("name")));
      color.put("rgb", clean(row.get("rgb")));
      color.put("isTrans", toBoolean(row.get("is_trans")));
      color.put("numParts", toInt(row.get("num_parts")));
      color.put("numSets", toInt(row.get("num_sets")));
      color.put("y1", toInt(row.get("y1")));
      color.put("y2", toInt(row.get("y2")));
      result.add(color);
    }
    return List.copyOf(result);
  }

  private List<Map<String, Object>> loadMappings() throws IOException {
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(mappingsFile)) {
      Map<String, Object> mapping = new LinkedHashMap<>();
      mapping.put("id", toInt(row.get("id")));
      mapping.put("extSystem", clean(row.get("ext_system")).toUpperCase());
      mapping.put("extId", clean(row.get("ext_id")));
      mapping.put("extDescr", clean(row.get("ext_descr")));
      mapping.put("extNames", names(row.get("ext_descr")));
      mapping.put("exportId", toBoolean(row.get("is_export_id")));
      mapping.put("importId", toBoolean(row.get("is_import_id")));
      result.add(mapping);
    }
    return List.copyOf(result);
  }

  private static List<String> names(String value) {
    List<String> names = new ArrayList<>();
    Matcher matcher = QUOTED.matcher(clean(value));
    while (matcher.find()) {
      String name = matcher.group(1).trim();
      if (!name.isEmpty()) {
        names.add(name);
      }
    }
    return List.copyOf(names);
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }

  private static Integer toInt(String value) {
    String text = clean(value);
    if (text.isEmpty()) {
      return null;
    }
    try {
      return Integer.valueOf(text);
    } catch (NumberFormatException e) {
      return null;
    }
  }

  private static boolean toBoolean(String value) {
    return "true".equalsIgnoreCase(clean(value));
  }
}
