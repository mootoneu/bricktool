package com.bricktools.other;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.csv.Csv;
import java.io.IOException;
import java.nio.file.Path;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Locale;
import java.util.Map;
import java.util.Set;
import java.util.TreeSet;
import java.util.regex.Pattern;
import org.springframework.stereotype.Service;

@Service
public class PeopleService {

  private static final Pattern COLOR = Pattern.compile("#[0-9A-Fa-f]{3,8}");
  private static final String PEOPLE_IMAGE_BASE = "/api/peopleimg/";

  private final Path peopleFile;
  private final OtherImageService images;

  public PeopleService(BrickToolsProperties props, OtherImageService images) {
    this.peopleFile = props.dataPath().resolve("other/people/people.csv");
    this.images = images;
  }

  public synchronized List<String> names() throws IOException {
    Set<String> names = new TreeSet<>(String.CASE_INSENSITIVE_ORDER);
    for (Map<String, String> person : Csv.read(peopleFile)) {
      String name = clean(person.get("name"));
      if (!name.isEmpty()) {
        names.add(name);
      }
    }
    return List.copyOf(names);
  }

  public synchronized Map<String, String> imageUrls() throws IOException {
    Map<String, String> urls = new LinkedHashMap<>();
    Set<String> available = images.available("people");
    for (Map<String, String> person : Csv.read(peopleFile)) {
      String name = clean(person.get("name"));
      String image = clean(person.get("image"));
      if (!name.isEmpty() && available.contains(image)) {
        urls.putIfAbsent(key(name), PEOPLE_IMAGE_BASE + image);
      }
    }
    return urls;
  }

  public synchronized Map<String, String> colors() throws IOException {
    Map<String, String> colors = new LinkedHashMap<>();
    for (Map<String, String> person : Csv.read(peopleFile)) {
      String name = clean(person.get("name"));
      String color = clean(person.get("color"));
      if (!name.isEmpty() && COLOR.matcher(color).matches()) {
        colors.putIfAbsent(key(name), color);
      }
    }
    return colors;
  }

  private static String key(String value) {
    return clean(value).toLowerCase(Locale.ROOT);
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }
}
