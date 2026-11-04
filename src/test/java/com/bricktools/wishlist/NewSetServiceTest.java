package com.bricktools.wishlist;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.setimg.SetImageService;
import com.bricktools.theme.ThemeImageService;
import java.io.IOException;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class NewSetServiceTest {

  @TempDir
  Path dir;

  private final LocalDate today = LocalDate.now();
  private final int currentYear = today.getYear();
  private final int fromYear =
      today.isAfter(LocalDate.of(currentYear, 7, 31)) ? currentYear : currentYear - 1;

  private NewSetService service;

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bt/setsimg"));
    Files.createDirectories(dir.resolve("bw"));
    Files.createDirectories(dir.resolve("le/themes"));

    Files.writeString(dir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon," + currentYear + ",171,7541,https://cdn.example/75192-1.jpg\n"
            + "75192-2,Millennium Falcon Variant," + currentYear + ",171,7541,https://cdn.example/75192-2.jpg\n"
            + "10291-1,Queer Eye," + currentYear + ",172,974,https://cdn.example/10291-1.jpg\n"
            + "50000-1,Gear Set," + currentYear + ",173,5,https://cdn.example/50000-1.jpg\n"
            + "10000-1,Old Set," + (fromYear - 1) + ",171,10,https://cdn.example/10000-1.jpg\n");
    Files.writeString(dir.resolve("re/themes.csv"),
        "id,name,parent_id\n171,Star Wars,\n172,City,\n173,Gear,\n");
    Files.writeString(dir.resolve("bt/themes.csv"),
        "id,name,parent_id,parent_name,theme_uid,color_primary,color_secondary,image,hidden\n"
            + "171,Star Wars,,,star-wars,#141414,#3d3d3d,star-wars.svg,false\n"
            + "172,City,,,city,#003290,#ffd500,,false\n"
            + "173,Gear,,,gear,#3b3d4c,#606274,,true\n");
    Files.writeString(dir.resolve("le/themes/star-wars.svg"), "<svg/>", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("bt/setsimg/75192.jpg"), "jpg", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("bw/setprices.csv"), "SetNumber,LegoPrice\n75192,849.99\n");

    BrickToolsProperties props = props();
    service = new NewSetService(props, new SetImageService(props), new ThemeImageService(props));
  }

  @Test
  void catalogOnlyContainsCanonicalSetsOfTheCurrentPeriod() throws IOException {
    Map<String, Object> catalog = service.catalog();

    assertThat(catalog).containsEntry("fromYear", fromYear).containsEntry("toYear", currentYear);
    List<Map<String, Object>> sets = list(catalog, "sets");
    assertThat(sets).extracting(row -> row.get("setNumber"))
        .containsExactlyInAnyOrder("75192", "10291");
    assertThat(sets).allSatisfy(row -> assertThat(row.get("year")).isEqualTo(currentYear));
  }

  @Test
  void cardExposesThemeImageColorPriceAndStoredImage() throws IOException {
    List<Map<String, Object>> sets = list(service.catalog(), "sets");
    Map<String, Object> falcon = sets.stream()
        .filter(row -> "75192".equals(row.get("setNumber")))
        .findFirst()
        .orElseThrow();

    assertThat(falcon).containsEntry("name", "Millennium Falcon")
        .containsEntry("numParts", 7541)
        .containsEntry("theme", "Star Wars")
        .containsEntry("themeImageUrl", "/api/themeimg/star-wars.svg")
        .containsEntry("themeColor", "#141414")
        .containsEntry("officialPrice", 849.99)
        .containsEntry("imageUrl", "/api/setimg/75192");
  }

  @Test
  void cardsFallBackToCdnImageWhenNoStoredImageExists() throws IOException {
    List<Map<String, Object>> sets = list(service.catalog(), "sets");
    Map<String, Object> queerEye = sets.stream()
        .filter(row -> "10291".equals(row.get("setNumber")))
        .findFirst()
        .orElseThrow();

    assertThat(queerEye).containsEntry("imageUrl", "https://cdn.example/10291-1.jpg")
        .containsEntry("themeColor", "#003290");
    assertThat(queerEye.get("themeImageUrl")).isNull();
  }

  @Test
  void themesAreAlphabeticalAndUnique() throws IOException {
    List<Map<String, Object>> themes = list(service.catalog(), "themes");

    assertThat(themes).extracting(row -> row.get("name")).containsExactly("City", "Star Wars");
    assertThat(themes.get(1)).containsEntry("imageUrl", "/api/themeimg/star-wars.svg")
        .containsEntry("color", "#141414");
  }

  @Test
  void hiddenThemesAreExcludedButStillResolvedForWishlists() throws IOException {
    Map<String, Object> catalog = service.catalog();

    assertThat(list(catalog, "sets")).extracting(row -> row.get("name")).doesNotContain("Gear Set");
    assertThat(list(catalog, "themes")).extracting(row -> row.get("name")).doesNotContain("Gear");
    assertThat(service.details(List.of("50000")).get("50000"))
        .containsEntry("name", "Gear Set")
        .containsEntry("theme", "Gear");
  }

  @Test
  void detailsReturnsOnlyKnownSets() throws IOException {
    Map<String, Map<String, Object>> details = service.details(List.of("75192", "unknown"));

    assertThat(details).containsOnlyKeys("75192");
    assertThat(details.get("75192")).containsEntry("name", "Millennium Falcon");
    assertThat(service.find("unknown")).isEmpty();
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }

  @SuppressWarnings("unchecked")
  private static List<Map<String, Object>> list(Map<String, Object> catalog, String key) {
    return (List<Map<String, Object>>) catalog.get(key);
  }
}
