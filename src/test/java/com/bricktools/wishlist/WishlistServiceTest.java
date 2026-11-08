package com.bricktools.wishlist;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.other.OtherImageService;
import com.bricktools.other.PeopleService;
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

class WishlistServiceTest {

  @TempDir
  Path dir;

  private WishlistService service;
  private final int currentYear = LocalDate.now().getYear();

  @BeforeEach
  void setUp() throws IOException {
    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bt"));
    Files.createDirectories(dir.resolve("bw"));
    Files.createDirectories(dir.resolve("le/themes"));
    Files.createDirectories(dir.resolve("other/people"));
    Files.writeString(dir.resolve("other/people/people.csv"),
        "name,image,color\n"
            + "Duncan,Duncan.webp,#2563eb\n"
            + "Eglantine,Eglantine.webp,#db2777\n"
            + "Alice,Default.webp,#059669\n");
    Files.writeString(dir.resolve("other/people/Duncan.webp"), "webp", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("other/people/Eglantine.webp"), "webp", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("other/people/Default.webp"), "webp", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("re/sets.csv"),
        "set_num,name,year,theme_id,num_parts,img_url\n"
            + "75192-1,Millennium Falcon," + currentYear + ",171,7541,https://cdn.example/75192-1.jpg\n");
    Files.writeString(dir.resolve("re/themes.csv"), "id,name,parent_id\n171,Star Wars,\n");
    Files.writeString(dir.resolve("bt/themes.csv"),
        "id,name,parent_id,parent_name,theme_uid,color_primary,color_secondary,image\n"
            + "171,Star Wars,,,star-wars,#141414,#3d3d3d,star-wars.svg\n");
    Files.writeString(dir.resolve("le/themes/star-wars.svg"), "<svg/>", StandardCharsets.UTF_8);
    Files.writeString(dir.resolve("bw/setprices.csv"), "SetNumber,LegoPrice\n75192,849.99\n");
    Files.writeString(dir.resolve("bt/purchased_sets.csv"),
        "Id,SetNumber,PurchasePrice,PurchaseDate,Vendor,BroughtBy,Owner,PartMissings,Owned,Reason\n"
            + "1,75192,700,2024/05/01,Amazon,Duncan,Eglantine,0,true,\n"
            + "2,75192,700,2024/05/02,Amazon,Duncan,Duncan,0,true,\n");

    BrickToolsProperties props = props();
    NewSetService newSets = new NewSetService(props, new SetImageService(props), new ThemeImageService(props));
    service = new WishlistService(props, newSets,
        new PeopleService(props, new OtherImageService(props)));
  }

  @Test
  void createWritesTheWishlistFileAndReturnsTheId() throws IOException {
    int id = service.create(request("75192", "2026/02/03", "Duncan", "High"));

    assertThat(id).isEqualTo(1);
    assertThat(Files.readString(dir.resolve("bt/wishlist.csv")))
        .startsWith("Id,SetNumber,WishlistDate,Member,Priority")
        .contains("1,75192,2026/02/03,Duncan,High");

    Map<String, Object> entry = service.list().get(0);
    assertThat(entry).containsEntry("id", 1)
        .containsEntry("setNumber", "75192")
        .containsEntry("wishlistDate", "2026/02/03")
        .containsEntry("member", "Duncan")
        .containsEntry("priority", "High")
        .containsEntry("name", "Millennium Falcon")
        .containsEntry("year", currentYear)
        .containsEntry("numParts", 7541)
        .containsEntry("theme", "Star Wars")
        .containsEntry("officialPrice", 849.99);
  }

  @Test
  void missingDateDefaultsToToday() throws IOException {
    service.create(request("75192", "", "Duncan", "Medium"));

    LocalDate today = LocalDate.now();
    String expected = today.getYear() + "/" + String.format("%02d/%02d", today.getMonthValue(), today.getDayOfMonth());
    assertThat(service.list().get(0)).containsEntry("wishlistDate", expected);
  }

  @Test
  void createRejectsUnknownSetAndDuplicates() throws IOException {
    assertThatThrownBy(() -> service.create(request("99999", "2026/02/03", "Duncan", "High")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown set");

    service.create(request("75192", "2026/02/03", "Duncan", "High"));
    assertThatThrownBy(() -> service.create(request("75192", "2026/02/04", "Eglantine", "Low")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("already in the wishlist");
  }

  @Test
  void createValidatesPriorityMemberAndDate() throws IOException {
    assertThatThrownBy(() -> service.create(request("75192", "2026/02/03", "Duncan", "Urgent")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Priority");
    assertThatThrownBy(() -> service.create(request("75192", "2026/02/03", " ", "High")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Member");
    assertThatThrownBy(() -> service.create(request("75192", "03/02/2026", "Duncan", "High")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("date");
  }

  @Test
  void optionsUsePeopleFileAndThePriorityList() throws IOException {
    Map<String, Object> options = service.options();

    assertThat(strings(options.get("members"))).containsExactly("Alice", "Duncan", "Eglantine");
    assertThat(strings(options.get("priorities")))
        .containsExactly("Favorite", "High", "Medium", "Low");
  }

  @Test
  void updateChangesMemberPriorityAndDateThenDeleteRemovesTheEntry() throws IOException {
    int id = service.create(request("75192", "2026/02/03", "Duncan", "High"));

    service.update(id, request("75192", "2026/02/10", "Eglantine", "Favorite"));
    assertThat(service.list().get(0)).containsEntry("member", "Eglantine")
        .containsEntry("priority", "Favorite")
        .containsEntry("wishlistDate", "2026/02/10");

    service.delete(id);
    assertThat(service.list()).isEmpty();
    assertThatThrownBy(() -> service.delete(id))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown wishlist id");
  }

  @Test
  void buyerIsStoredInTheCsvAndCanBeUpdated() throws IOException {
    int id = service.create(request("75192", "2026/02/03", "Duncan", "High", "Eglantine"));

    assertThat(Files.readString(dir.resolve("bt/wishlist.csv")))
        .startsWith("Id,SetNumber,WishlistDate,Member,Priority,Buyer")
        .contains("1,75192,2026/02/03,Duncan,High,Eglantine");
    assertThat(service.list().get(0)).containsEntry("buyer", "Eglantine")
        .containsEntry("memberImageUrl", "/api/peopleimg/Duncan.webp")
        .containsEntry("memberColor", "#2563eb")
        .containsEntry("buyerImageUrl", "/api/peopleimg/Eglantine.webp")
        .containsEntry("buyerColor", "#db2777");

    service.update(id, request("75192", "2026/02/03", "Duncan", "High", "Duncan"));
    assertThat(service.list().get(0)).containsEntry("buyer", "Duncan")
        .containsEntry("buyerImageUrl", "/api/peopleimg/Duncan.webp");
  }

  @Test
  void buyerIsOptional() throws IOException {
    service.create(request("75192", "2026/02/03", "Duncan", "High"));

    assertThat(service.list().get(0)).containsEntry("buyer", "");
  }

  @Test
  void updateRejectsUnknownIds() {
    assertThatThrownBy(() -> service.update(42, request("75192", "2026/02/03", "Duncan", "High")))
        .isInstanceOf(IllegalArgumentException.class)
        .hasMessageContaining("Unknown wishlist id");
  }

  private static WishlistRequest request(String setNumber, String date, String member, String priority) {
    return request(setNumber, date, member, priority, "");
  }

  private static WishlistRequest request(String setNumber, String date, String member, String priority, String buyer) {
    return new WishlistRequest(setNumber, date, member, priority, buyer);
  }

  @SuppressWarnings("unchecked")
  private static List<String> strings(Object value) {
    return (List<String>) value;
  }

  private BrickToolsProperties props() {
    return new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
  }
}
