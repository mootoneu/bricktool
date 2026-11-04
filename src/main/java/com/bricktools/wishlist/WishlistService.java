package com.bricktools.wishlist;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.time.LocalDate;
import java.time.format.DateTimeFormatter;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import java.util.Objects;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class WishlistService {

  private static final List<String> HEADERS = List.of("Id", "SetNumber", "WishlistDate", "Member", "Priority");
  private static final List<String> PRIORITIES = List.of("Favorite", "High", "Medium", "Low");
  private static final Pattern DATE = Pattern.compile("\\d{4}/\\d{2}/\\d{2}");
  private static final Pattern SET_NUMBER = Pattern.compile("[A-Za-z0-9-]+");
  private static final DateTimeFormatter DATE_FORMAT = DateTimeFormatter.ofPattern("yyyy/MM/dd");

  private final Path wishlistFile;
  private final Path purchasesFile;
  private final NewSetService newSets;

  public WishlistService(BrickToolsProperties props, NewSetService newSets) {
    this.wishlistFile = props.dataPath().resolve("bt/wishlist.csv");
    this.purchasesFile = props.dataPath().resolve("bt/purchased_sets.csv");
    this.newSets = newSets;
  }

  public synchronized List<Map<String, Object>> list() throws IOException {
    List<Map<String, String>> rows = load();
    List<String> setNumbers = rows.stream()
        .map(row -> clean(row.get("SetNumber")))
        .filter(number -> !number.isEmpty())
        .distinct()
        .toList();
    Map<String, Map<String, Object>> details = newSets.details(setNumbers);

    List<Map<String, Object>> result = new ArrayList<>();
    for (Map<String, String> row : rows) {
      String setNumber = clean(row.get("SetNumber"));
      Map<String, Object> entry = new LinkedHashMap<>();
      entry.put("id", toInt(row.get("Id")));
      entry.put("setNumber", setNumber);
      entry.put("wishlistDate", clean(row.get("WishlistDate")));
      entry.put("member", clean(row.get("Member")));
      entry.put("priority", clean(row.get("Priority")));
      entry.putAll(details.getOrDefault(setNumber, Map.of()));
      entry.put("setNumber", setNumber);
      result.add(entry);
    }
    return result;
  }

  public synchronized Map<String, Object> options() throws IOException {
    Set<String> members = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (Map<String, String> purchase : Csv.read(purchasesFile)) {
      String owner = clean(purchase.get("Owner"));
      if (!owner.isEmpty()) {
        members.add(owner);
      }
    }
    for (Map<String, String> row : load()) {
      String member = clean(row.get("Member"));
      if (!member.isEmpty()) {
        members.add(member);
      }
    }

    Map<String, Object> options = new LinkedHashMap<>();
    options.put("members", List.copyOf(members));
    options.put("priorities", PRIORITIES);
    return options;
  }

  public synchronized int create(WishlistRequest request) throws IOException {
    List<Map<String, String>> rows = load();
    String setNumber = validSetNumber(request == null ? null : request.setNumber());
    if (newSets.find(setNumber).isEmpty()) {
      throw new IllegalArgumentException("Unknown set " + setNumber);
    }
    for (Map<String, String> row : rows) {
      if (setNumber.equals(clean(row.get("SetNumber")))) {
        throw new IllegalArgumentException("Set " + setNumber + " is already in the wishlist");
      }
    }

    int id = rows.stream()
        .map(row -> toInt(row.get("Id")))
        .filter(Objects::nonNull)
        .max(Integer::compare)
        .orElse(0) + 1;
    rows.add(toRow(id, setNumber, request));
    Csv.write(wishlistFile, HEADERS, rows);
    return id;
  }

  public synchronized void update(int id, WishlistRequest request) throws IOException {
    List<Map<String, String>> rows = load();
    for (int i = 0; i < rows.size(); i++) {
      if (String.valueOf(id).equals(clean(rows.get(i).get("Id")))) {
        String setNumber = clean(request == null ? null : request.setNumber());
        if (setNumber.isEmpty()) {
          setNumber = clean(rows.get(i).get("SetNumber"));
        }
        setNumber = validSetNumber(setNumber);
        if (newSets.find(setNumber).isEmpty()) {
          throw new IllegalArgumentException("Unknown set " + setNumber);
        }
        for (int j = 0; j < rows.size(); j++) {
          if (j != i && setNumber.equals(clean(rows.get(j).get("SetNumber")))) {
            throw new IllegalArgumentException("Set " + setNumber + " is already in the wishlist");
          }
        }
        rows.set(i, toRow(id, setNumber, request));
        Csv.write(wishlistFile, HEADERS, rows);
        return;
      }
    }
    throw new IllegalArgumentException("Unknown wishlist id " + id);
  }

  public synchronized void delete(int id) throws IOException {
    List<Map<String, String>> rows = load();
    boolean removed = rows.removeIf(row -> String.valueOf(id).equals(clean(row.get("Id"))));
    if (!removed) {
      throw new IllegalArgumentException("Unknown wishlist id " + id);
    }
    Csv.write(wishlistFile, HEADERS, rows);
  }

  private List<Map<String, String>> load() throws IOException {
    List<Map<String, String>> rows = new ArrayList<>();
    for (Map<String, String> row : Csv.read(wishlistFile)) {
      Map<String, String> cleaned = new LinkedHashMap<>();
      row.forEach((column, value) -> cleaned.put(column, clean(value)));
      rows.add(cleaned);
    }
    return rows;
  }

  private static Map<String, String> toRow(int id, String setNumber, WishlistRequest request) {
    String date = clean(request == null ? null : request.wishlistDate());
    if (date.isEmpty()) {
      date = LocalDate.now().format(DATE_FORMAT);
    }
    if (!DATE.matcher(date).matches()) {
      throw new IllegalArgumentException("Wishlist date must use the yyyy/MM/dd format");
    }
    String member = clean(request == null ? null : request.member());
    if (member.isEmpty()) {
      throw new IllegalArgumentException("Member is required");
    }
    String priority = priority(request == null ? null : request.priority());

    Map<String, String> row = new LinkedHashMap<>();
    row.put("Id", String.valueOf(id));
    row.put("SetNumber", setNumber);
    row.put("WishlistDate", date);
    row.put("Member", member);
    row.put("Priority", priority);
    return row;
  }

  private static String priority(String value) {
    String priority = clean(value);
    for (String candidate : PRIORITIES) {
      if (candidate.equalsIgnoreCase(priority)) {
        return candidate;
      }
    }
    throw new IllegalArgumentException("Priority must be one of " + String.join(", ", PRIORITIES));
  }

  private static String validSetNumber(String value) {
    String setNumber = clean(value);
    if (setNumber.isEmpty()) {
      throw new IllegalArgumentException("Set number is required");
    }
    if (!SET_NUMBER.matcher(setNumber).matches()) {
      throw new IllegalArgumentException("Set number may only contain letters, digits and dashes");
    }
    return setNumber;
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
