package com.bricktools.wishlist;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import com.bricktools.setimg.SetImageService;
import com.bricktools.theme.ThemeImageService;
import java.io.IOException;
import java.nio.file.Path;
import java.text.Collator;
import java.time.LocalDate;
import java.util.ArrayList;
import java.util.Collection;
import java.util.Comparator;
import java.util.HashMap;
import java.util.HashSet;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Optional;
import java.util.Set;
import java.util.TreeMap;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

/**
 * Builds the catalogue of recently released sets shown on the New Sets page.
 */
@Service
public class NewSetService {

  private static final Pattern COLOR = Pattern.compile("#[0-9A-Fa-f]{3,8}");
  private static final Collator TEXT_COLLATOR = Collator.getInstance(Locale.FRANCE);
  private static final Comparator<String> TEXT_ORDER = TEXT_COLLATOR::compare;

  private final Path setsFile;
  private final Path themesFile;
  private final Path themeDetailsFile;
  private final Path pricesFile;
  private final SetImageService setImages;
  private final ThemeImageService themeImages;

  public NewSetService(BrickToolsProperties props, SetImageService setImages, ThemeImageService themeImages) {
    Path data = props.dataPath();
    this.setsFile = data.resolve("re/sets.csv");
    this.themesFile = data.resolve("re/themes.csv");
    this.themeDetailsFile = data.resolve("bt/themes.csv");
    this.pricesFile = data.resolve("bw/setprices.csv");
    this.setImages = setImages;
    this.themeImages = themeImages;
  }

  public synchronized Map<String, Object> catalog() throws IOException {
    Context context = context();
    LocalDate today = LocalDate.now();
    int currentYear = today.getYear();
    boolean afterJuly = today.isAfter(LocalDate.of(currentYear, 7, 31));
    int fromYear = afterJuly ? currentYear : currentYear - 1;
    int toYear = currentYear;

    List<Map<String, Object>> sets = new ArrayList<>();
    Map<String, Map<String, Object>> themes = new TreeMap<>(TEXT_ORDER);
    Map<String, Map<String, Object>> rootThemes = new TreeMap<>(TEXT_ORDER);
    for (Map<String, String> set : context.setsByNumber().values()) {
      Integer year = toInt(set.get("year"));
      if (year == null || year < fromYear || year > toYear || isHidden(set.get("theme_id"), context)) {
        continue;
      }
      Map<String, Object> card = card(set, context);
      sets.add(card);
      String themeId = clean(set.get("theme_id"));
      Object themeName = card.get("theme");
      if (themeName != null && !String.valueOf(themeName).isBlank()) {
        themes.computeIfAbsent(String.valueOf(themeName), name -> theme(themeId, name, context));
      }
      Object rootName = card.get("rootTheme");
      if (rootName != null && !String.valueOf(rootName).isBlank()) {
        rootThemes.computeIfAbsent(String.valueOf(rootName),
            name -> theme(rootOf(themeId, context), name, context));
      }
    }
    sets.sort(Comparator
        .comparing((Map<String, Object> row) -> String.valueOf(row.get("name")), TEXT_ORDER)
        .thenComparing(row -> String.valueOf(row.get("setNumber")), TEXT_ORDER));

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("fromYear", fromYear);
    result.put("toYear", toYear);
    result.put("sets", sets);
    result.put("themes", List.copyOf(themes.values()));
    result.put("rootThemes", List.copyOf(rootThemes.values()));
    return result;
  }

  /**
   * Returns the display data of the given set numbers, keyed by set number.
   */
  public synchronized Map<String, Map<String, Object>> details(Collection<String> setNumbers) throws IOException {
    if (setNumbers == null || setNumbers.isEmpty()) {
      return Map.of();
    }
    Context context = context();
    Map<String, Map<String, Object>> result = new HashMap<>();
    for (String setNumber : setNumbers) {
      Map<String, String> set = context.setsByNumber().get(clean(setNumber));
      if (set != null) {
        result.put(clean(setNumber), card(set, context));
      }
    }
    return result;
  }

  public synchronized Optional<Map<String, Object>> find(String setNumber) throws IOException {
    return Optional.ofNullable(details(List.of(clean(setNumber))).get(clean(setNumber)));
  }

  private Context context() throws IOException {
    Map<String, Map<String, String>> setsByNumber = new HashMap<>();
    for (Map<String, String> set : Csv.read(setsFile)) {
      String number = clean(set.get("set_num"));
      if (number.endsWith("-1")) {
        setsByNumber.put(number.substring(0, number.length() - 2), set);
      }
    }
    Map<String, String> themes = new HashMap<>();
    Map<String, String> parents = new HashMap<>();
    for (Map<String, String> theme : Csv.read(themesFile)) {
      themes.put(clean(theme.get("id")), clean(theme.get("name")));
      parents.put(clean(theme.get("id")), clean(theme.get("parent_id")));
    }
    Map<String, Map<String, String>> themeDetails = new HashMap<>();
    for (Map<String, String> theme : Csv.read(themeDetailsFile)) {
      themeDetails.put(clean(theme.get("id")), theme);
    }
    Map<String, String> prices = new HashMap<>();
    for (Map<String, String> price : Csv.read(pricesFile)) {
      prices.put(clean(price.get("SetNumber")), clean(price.get("LegoPrice")));
    }
    return new Context(setsByNumber, themes, parents, themeDetails, themeImages.available(), setImages.available(),
        prices);
  }

  private static String rootOf(String themeId, Context context) {
    String current = clean(themeId);
    Set<String> visited = new HashSet<>();
    while (visited.add(current)) {
      String parent = context.parents().getOrDefault(current, "");
      if (parent.isEmpty()) {
        break;
      }
      current = parent;
    }
    return current;
  }

  private static Map<String, Object> card(Map<String, String> set, Context context) {
    String setNumber = clean(set.get("set_num"));
    if (setNumber.endsWith("-1")) {
      setNumber = setNumber.substring(0, setNumber.length() - 2);
    }
    String themeId = clean(set.get("theme_id"));
    Map<String, String> themeDetails = context.themeDetails().getOrDefault(themeId, Map.of());
    String themeImage = clean(themeDetails.get("image"));
    String themeColor = clean(themeDetails.get("color_primary"));
    String imageUrl = clean(set.get("img_url"));

    Map<String, Object> card = new LinkedHashMap<>();
    card.put("setNumber", setNumber);
    card.put("name", clean(set.get("name")));
    card.put("year", toInt(set.get("year")));
    card.put("numParts", toInt(set.get("num_parts")));
    card.put("theme", context.themes().get(themeId));
    String rootName = context.themes().get(rootOf(themeId, context));
    card.put("rootTheme", rootName != null ? rootName : context.themes().get(themeId));
    card.put("themeImageUrl",
        !themeImage.isEmpty() && context.themeImages().contains(themeImage) ? "/api/themeimg/" + themeImage : null);
    card.put("themeColor", COLOR.matcher(themeColor).matches() ? themeColor : null);
    card.put("officialPrice", toDouble(context.prices().get(setNumber)));
    card.put("imageUrl", context.storedImages().contains(setNumber) ? "/api/setimg/" + setNumber
        : imageUrl.isEmpty() ? null : imageUrl);
    return card;
  }

  private static Map<String, Object> theme(String themeId, String name, Context context) {
    Map<String, String> details = context.themeDetails().getOrDefault(themeId, Map.of());
    String image = clean(details.get("image"));
    String color = clean(details.get("color_primary"));
    Map<String, Object> theme = new LinkedHashMap<>();
    theme.put("name", name);
    theme.put("imageUrl",
        !image.isEmpty() && context.themeImages().contains(image) ? "/api/themeimg/" + image : null);
    theme.put("color", COLOR.matcher(color).matches() ? color : null);
    return theme;
  }

  private static boolean isHidden(String themeId, Context context) {
    Map<String, String> details = context.themeDetails().getOrDefault(clean(themeId), Map.of());
    return Boolean.parseBoolean(clean(details.get("hidden")));
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

  private record Context(Map<String, Map<String, String>> setsByNumber, Map<String, String> themes,
                         Map<String, String> parents, Map<String, Map<String, String>> themeDetails,
                         Set<String> themeImages, Set<String> storedImages, Map<String, String> prices) {}
}
