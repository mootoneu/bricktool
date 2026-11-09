package com.bricktools.le;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
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
   * Return the Pick a Brick price per colorIds of a LEGO design ID, formatted in euros.
   * When a color appears several times, the lowest price is kept.
   */
  public synchronized Map<Integer, String> prices(String designId) throws IOException {
    String key = clean(designId);
    Map<Integer, Double> lowest = new LinkedHashMap<>();
    for (Map<String, String> row : Csv.read(pricesFile)) {
      if (!key.equals(clean(row.get("DesignId")))) {
        continue;
      }
      Integer colorId = toInt(row.get("ColorId"));
      Double price = toDouble(row.get("Price"));
      if (colorId != null && price != null) {
        lowest.merge(colorId, price, Math::min);
      }
    }

    Map<Integer, String> result = new LinkedHashMap<>();
    lowest.forEach((colorId, price) -> result.put(colorId, formatEuro(price)));
    return result;
  }

  private static String formatEuro(double price) {
    return String.format(Locale.FRANCE, "%.2f €", price);
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
