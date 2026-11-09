package com.bricktools.le;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Provides the Pick a Brick part prices published by LEGO.
 * Data lives in data/le/pab_part_prices.csv.
 */
@Service
public class PabPartPriceService {

  private final Path pricesFile;

  public PabPartPriceService(BrickToolsProperties props) {
    this.pricesFile = props.dataPath().resolve("le/pab_part_prices.csv");
  }

  /**
   * Return every Pick a Brick part price.
   */
  public synchronized List<Map<String, Object>> prices() throws IOException {
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(pricesFile)) {
      result.add(toPrice(row));
    }
    return result;
  }

  /**
   * Return the Pick a Brick prices of a LEGO design ID.
   */
  public synchronized List<Map<String, Object>> prices(String designId) throws IOException {
    String key = clean(designId);
    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : Csv.read(pricesFile)) {
      if (key.equals(clean(row.get("DesignId")))) {
        result.add(toPrice(row));
      }
    }
    return result;
  }

  private static Map<String, Object> toPrice(Map<String, String> row) {
    Map<String, Object> entry = new LinkedHashMap<>();
    entry.put("designId", clean(row.get("DesignId")));
    entry.put("colorId", toInt(row.get("ColorId")));
    entry.put("price", toDouble(row.get("Price")));
    return entry;
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
