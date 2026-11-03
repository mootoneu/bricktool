package com.bricktools.rebrickable;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.notification.NotificationService;
import com.bricktools.support.TestHttpServer;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.time.LocalDate;
import java.util.Map;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class RebrickableServiceTest {

  private static final String STALE = "rebrickable-stale";

  @TempDir
  Path dir;

  TestHttpServer server;
  NotificationService notifications;

  @BeforeEach
  void setUp() throws IOException {
    server = new TestHttpServer();
    notifications = new NotificationService();
  }

  @AfterEach
  void tearDown() {
    server.close();
  }

  private RebrickableService service() {
    return new RebrickableService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(server.baseUrl() + "/rebrickable.zip"),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")), notifications);
  }

  private void writeState(LocalDate lastDownload) throws IOException {
    Files.createDirectories(dir.resolve("bt"));
    Files.writeString(dir.resolve("bt/state.properties"),
        "rebrickable.lastDownload=" + lastDownload + "\n");
  }

  @Test
  void neverDownloadedIsStaleAndUpdatable() throws IOException {
    Map<String, Object> status = service().status();

    assertThat(status).containsEntry("lastDownload", null)
        .containsEntry("canUpdate", true)
        .containsEntry("stale", true);
  }

  @Test
  void recentDownloadDisablesUpdateForTheDay() throws IOException {
    writeState(LocalDate.now());

    Map<String, Object> status = service().status();

    assertThat(status).containsEntry("canUpdate", false).containsEntry("stale", false);
  }

  @Test
  void downloadOlderThanAMonthIsStale() throws IOException {
    writeState(LocalDate.now().minusMonths(2));

    Map<String, Object> status = service().status();

    assertThat(status).containsEntry("canUpdate", true).containsEntry("stale", true);
  }

  @Test
  void staleDataRaisesNotificationLinkingToAdminCard() throws IOException {
    writeState(LocalDate.now().minusMonths(2));

    service().checkStaleness();

    assertThat(notifications.list()).singleElement()
        .satisfies(n -> {
          assertThat(n.id()).isEqualTo(STALE);
          assertThat(n.link()).isEqualTo("/admin.html#rebrickable");
        });
  }

  @Test
  void freshDataDoesNotRaiseNotification() throws IOException {
    writeState(LocalDate.now());

    service().checkStaleness();

    assertThat(notifications.list()).isEmpty();
  }

  @Test
  void updateDownloadsZipExtractsCsvFilesAndRecordsDate() throws IOException, InterruptedException {
    server.respond("/rebrickable.zip", "application/zip", TestHttpServer.zip(Map.of(
        "sets.csv", "set_num,name\n1-1,Test\n",
        "themes.csv", "id,name\n1,Theme\n",
        "readme.txt", "ignored")));
    RebrickableService service = service();

    service.checkStaleness();
    assertThat(notifications.list()).hasSize(1);

    LocalDate updated = service.update();

    assertThat(updated).isEqualTo(LocalDate.now());
    assertThat(Files.readString(dir.resolve("re/sets.csv"))).contains("1-1,Test");
    assertThat(Files.exists(dir.resolve("re/themes.csv"))).isTrue();
    assertThat(Files.exists(dir.resolve("re/readme.txt"))).isFalse();
    assertThat(Files.readString(dir.resolve("bt/state.properties"))).contains("rebrickable.lastDownload=" + LocalDate.now());
    assertThat(service.status()).containsEntry("canUpdate", false).containsEntry("stale", false);
    assertThat(notifications.list()).isEmpty();
  }

  @Test
  void secondUpdateOnSameDayIsRefused() throws IOException, InterruptedException {
    server.respond("/rebrickable.zip", "application/zip", TestHttpServer.zip(Map.of("sets.csv", "a\n")));
    RebrickableService service = service();
    service.update();

    assertThatThrownBy(service::update)
        .isInstanceOf(IllegalStateException.class)
        .hasMessageContaining("already been downloaded today");
  }

  @Test
  void failedDownloadDoesNotRecordDate() throws IOException {
    RebrickableService service = new RebrickableService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(server.baseUrl() + "/missing.zip"),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")), notifications);

    assertThatThrownBy(service::update).isInstanceOf(IOException.class).hasMessageContaining("404");
    assertThat(service.status()).containsEntry("lastDownload", null);
  }
}
