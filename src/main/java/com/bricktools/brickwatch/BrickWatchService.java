package com.bricktools.brickwatch;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.math.BigDecimal;
import java.nio.file.Path;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.jsoup.Jsoup;
import org.jsoup.nodes.Document;
import org.jsoup.nodes.Element;
import org.jsoup.select.Elements;
import org.springframework.stereotype.Service;

@Service
public class BrickWatchService {

  private static final String USER_AGENT = "Mozilla/5.0 (compatible; BrickTools/0.1)";
  private static final String TABLE_MARKER = "Information sur le prix";
  private static final String PRICE_LABEL = "Lego prix conseill";
  private static final List<String> HEADERS = List.of("SetNumber", "LegoPrice");

  private final BrickToolsProperties props;
  private final Path pricesFile;
  private long lastRequestAt;

  public BrickWatchService(BrickToolsProperties props) {
    this.props = props;
    this.pricesFile = props.dataPath().resolve("bw/setprices.csv");
  }

  public synchronized Map<String, Object> price(String setNumber) throws IOException, InterruptedException {
    String key = setNumber == null ? "" : setNumber.trim();
    if (!key.matches("[A-Za-z0-9-]+")) {
      throw new IllegalArgumentException("Invalid set number: " + setNumber);
    }

    for (Map<String, String> row : Csv.read(pricesFile)) {
      if (key.equals(row.get("SetNumber"))) {
        return Map.of("setNumber", key, "legoPrice", new BigDecimal(row.get("LegoPrice")), "source", "stored");
      }
    }

    BigDecimal price = scrape(key);
    if (price == null) {
      throw new IllegalStateException("No official price found on BrickWatch for set " + key);
    }

    List<Map<String, String>> rows = new ArrayList<>(Csv.read(pricesFile));
    Map<String, String> row = new LinkedHashMap<>();
    row.put("SetNumber", key);
    row.put("LegoPrice", price.toPlainString());
    rows.add(row);
    Csv.write(pricesFile, HEADERS, rows);

    return Map.of("setNumber", key, "legoPrice", price, "source", "brickwatch");
  }

  private BigDecimal scrape(String setNumber) throws IOException, InterruptedException {
    throttle();
    Document doc = Jsoup.connect(props.brickwatch().baseUrl() + setNumber)
        .userAgent(USER_AGENT)
        .timeout(15_000)
        .get();

    for (Element table : doc.select("table")) {
      if (!table.text().contains(TABLE_MARKER)) {
        continue;
      }
      for (Element row : table.select("tr")) {
        Elements cells = row.select("td, th");
        if (cells.size() > 1 && cells.first().text().trim().startsWith(PRICE_LABEL)) {
          return parsePrice(cells.last().text());
        }
      }
    }
    return null;
  }

  private void throttle() throws InterruptedException {
    long wait = props.brickwatch().minDelayMs() - (System.currentTimeMillis() - lastRequestAt);
    if (wait > 0) {
      Thread.sleep(wait);
    }
    lastRequestAt = System.currentTimeMillis();
  }

  static BigDecimal parsePrice(String text) {
    String cleaned = text.replaceAll("[^0-9,.]", "").replace(',', '.');
    if (cleaned.isEmpty()) {
      return null;
    }
    try {
      return new BigDecimal(cleaned);
    } catch (NumberFormatException e) {
      return null;
    }
  }
}
