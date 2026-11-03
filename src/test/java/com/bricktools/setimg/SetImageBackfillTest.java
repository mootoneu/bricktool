package com.bricktools.setimg;

import static org.assertj.core.api.Assertions.assertThat;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.purchase.PurchaseService;
import com.bricktools.support.TestHttpServer;
import com.bricktools.theme.ThemeImageService;
import com.sun.net.httpserver.HttpExchange;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.concurrent.CopyOnWriteArrayList;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class SetImageBackfillTest {

  private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, 1, 2, 3};

  @TempDir
  Path dir;

  private TestHttpServer server;
  private final List<Long> downloadStarts = new CopyOnWriteArrayList<>();

  @BeforeEach
  void setUp() throws IOException {
    server = new TestHttpServer();
    server.handle("/img/a.jpg", exchange -> image(exchange, 200, JPEG));
    server.handle("/img/b.jpg", exchange -> image(exchange, 200, JPEG));
    server.handle("/img/broken.jpg", exchange -> image(exchange, 404, new byte[0]));
    server.handle("/img/unused.jpg", exchange -> image(exchange, 200, JPEG));

    Files.createDirectories(dir.resolve("re"));
    Files.createDirectories(dir.resolve("bt/setsimg"));
    Files.writeString(dir.resolve("re/sets.csv"), String.join("\n",
        "set_num,name,year,theme_id,num_parts,img_url",
        "10001-1,Set A,2020,1,10," + server.baseUrl() + "/img/a.jpg",
        "10002-1,Set B,2020,1,10," + server.baseUrl() + "/img/b.jpg",
        "10003-1,Set C,2020,1,10,",
        "10004-1,Set D,2020,1,10," + server.baseUrl() + "/img/broken.jpg",
        "10005-1,Set E,2020,1,10," + server.baseUrl() + "/img/unused.jpg") + "\n");
    Files.writeString(dir.resolve("bt/purchased_sets.csv"), String.join("\n",
        "Id,SetNumber,PurchasePrice,PurchaseDate,Vendor,BroughtBy,Owner,PartMissings,Owned,Reason",
        "1,10002,10,2024/01/01,Lego,Duncan,Duncan,,true,",
        "2,10001,10,2024/01/01,Lego,Duncan,Duncan,,true,",
        "3,10003,10,2024/01/01,Lego,Duncan,Duncan,,true,",
        "4,10004,10,2024/01/01,Lego,Duncan,Duncan,,true,",
        "5,10005,10,2024/01/01,Lego,Duncan,Duncan,,true,",
        "6,10001,10,2024/01/02,Lego,Duncan,Duncan,,true,") + "\n");
    Files.write(dir.resolve("bt/setsimg/10005.jpg"), JPEG);
  }

  @AfterEach
  void tearDown() {
    server.close();
  }

  private void image(HttpExchange exchange, int status, byte[] body) throws IOException {
    downloadStarts.add(System.currentTimeMillis());
    exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(body);
    }
  }

  private SetImageBackfill backfill() {
    BrickToolsProperties props = new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", ""));
    SetImageService images = new SetImageService(props);
    return new SetImageBackfill(images, new PurchaseService(props, images, new ThemeImageService(props)));
  }

  private static SetImageBackfill.Progress awaitFinished(SetImageBackfill backfill) throws InterruptedException {
    long deadline = System.currentTimeMillis() + 30_000;
    while (backfill.progress().running()) {
      if (System.currentTimeMillis() > deadline) {
        throw new AssertionError("backfill did not finish: " + backfill.progress());
      }
      Thread.sleep(50);
    }
    return backfill.progress();
  }

  @Test
  void downloadsMissingImagesAndReportsEveryOutcome() throws Exception {
    SetImageBackfill backfill = backfill();

    assertThat(backfill.start()).isTrue();
    SetImageBackfill.Progress result = awaitFinished(backfill);

    assertThat(result.running()).isFalse();
    assertThat(result.total()).isEqualTo(5);
    assertThat(result.processed()).isEqualTo(5);
    assertThat(result.downloaded()).isEqualTo(2);
    assertThat(result.skipped()).isEqualTo(1);
    assertThat(result.noImage()).isEqualTo(1);
    assertThat(result.failed()).isEqualTo(1);
    assertThat(result.lastError()).startsWith("10004");

    assertThat(Files.readAllBytes(dir.resolve("bt/setsimg/10001.jpg"))).isEqualTo(JPEG);
    assertThat(Files.readAllBytes(dir.resolve("bt/setsimg/10002.jpg"))).isEqualTo(JPEG);
    assertThat(Files.exists(dir.resolve("bt/setsimg/10003.jpg"))).isFalse();
    assertThat(Files.exists(dir.resolve("bt/setsimg/10004.jpg"))).isFalse();
  }

  @Test
  void waitsAtLeastOneSecondBetweenDownloads() throws Exception {
    SetImageBackfill backfill = backfill();

    backfill.start();
    awaitFinished(backfill);

    assertThat(downloadStarts).hasSize(3);
    for (int i = 1; i < downloadStarts.size(); i++) {
      long gap = downloadStarts.get(i) - downloadStarts.get(i - 1);
      assertThat(gap).as("gap between download %d and %d", i, i + 1).isGreaterThanOrEqualTo(990);
    }
  }

  @Test
  void onlyOneBackfillRunsAtATime() throws Exception {
    SetImageBackfill backfill = backfill();

    assertThat(backfill.start()).isTrue();
    assertThat(backfill.start()).isFalse();
    awaitFinished(backfill);
  }

  @Test
  void statusBeforeAnyRunIsIdle() {
    SetImageBackfill.Progress progress = backfill().progress();

    assertThat(progress.running()).isFalse();
    assertThat(progress.total()).isZero();
  }
}
