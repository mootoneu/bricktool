package com.bricktools.part;

import static org.assertj.core.api.Assertions.assertThat;
import static org.assertj.core.api.Assertions.assertThatThrownBy;

import com.bricktools.config.BrickToolsProperties;
import com.bricktools.support.TestHttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.Map;
import java.util.Optional;
import java.util.concurrent.atomic.AtomicInteger;
import org.junit.jupiter.api.AfterEach;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class PartImageServiceTest {

  private static final byte[] JPEG = {(byte) 0xFF, (byte) 0xD8, (byte) 0xFF, 0x10};
  private static final byte[] PNG = {(byte) 0x89, 'P', 'N', 'G'};

  @TempDir
  Path dir;

  private TestHttpServer server;
  private final AtomicInteger photoRequests = new AtomicInteger();
  private final AtomicInteger pngRequests = new AtomicInteger();
  private final AtomicInteger elementRequests = new AtomicInteger();

  @BeforeEach
  void setUp() throws IOException {
    server = new TestHttpServer();
    server.handle("/photos/5/3001-5-abc.jpg", exchange -> {
      photoRequests.incrementAndGet();
      send(exchange, 200, JPEG);
    });
    server.handle("/photos/5/3002-5-def.png", exchange -> {
      pngRequests.incrementAndGet();
      send(exchange, 200, PNG);
    });
    server.handle("/photos/5/missing.jpg", exchange -> send(exchange, 404, new byte[0]));
    server.handle("/elements/6166107.jpg", exchange -> {
      elementRequests.incrementAndGet();
      send(exchange, 200, JPEG);
    });

    Files.createDirectories(dir.resolve("re"));
    Files.writeString(dir.resolve("re/inventory_parts.csv"), String.join("\n",
        "inventory_id,part_num,color_id,quantity,is_spare,img_url",
        "1,3001,5,1,False," + server.baseUrl() + "/photos/5/3001-5-abc.jpg",
        "2,3001,5,2,False," + server.baseUrl() + "/photos/5/3001-5-duplicate.jpg",
        "3,3001,7,1,False," + server.baseUrl() + "/elements/6166107.jpg",
        "4,3002,5,1,False,",
        "5,3002,5,1,False," + server.baseUrl() + "/photos/5/3002-5-def.png",
        "6,3003,5,1,False,") + "\n");
  }

  @AfterEach
  void tearDown() {
    server.close();
  }

  private PartImageService service() {
    return new PartImageService(new BrickToolsProperties(
        dir.toString(),
        new BrickToolsProperties.Rebrickable(""),
        new BrickToolsProperties.BrickWatch("", 0),
        new BrickToolsProperties.BrickOwl("", "")));
  }

  private static void send(com.sun.net.httpserver.HttpExchange exchange, int status, byte[] body)
      throws IOException {
    exchange.sendResponseHeaders(status, body.length == 0 ? -1 : body.length);
    try (OutputStream out = exchange.getResponseBody()) {
      out.write(body);
    }
  }

  @Test
  void generateMapsColumnsAndKeepsTheFirstRowOfEachPartColor() throws Exception {
    Map<String, Object> result = service().generatePartColorUrls();

    assertThat(result)
        .containsEntry("total", 6)
        .containsEntry("kept", 3)
        .containsEntry("duplicates", 1)
        .containsEntry("noUrl", 2);
    assertThat(Files.readString(dir.resolve("bt/part_color_url.csv")))
        .startsWith("PartNumber,ColorId,ItemNumber,ImgUrl")
        .contains("3001,5,3001-5-abc," + server.baseUrl() + "/photos/5/3001-5-abc.jpg")
        .contains("3001,7,6166107," + server.baseUrl() + "/elements/6166107.jpg")
        .contains("3002,5,3002-5-def," + server.baseUrl() + "/photos/5/3002-5-def.png")
        .doesNotContain("3001-5-duplicate")
        .doesNotContain("3003");
  }

  @Test
  void downloadsTheImageOnceAndReusesIt() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    Optional<Path> first = service.ensure("3001", 5);
    Optional<Path> second = service.ensure("3001", 5);

    assertThat(first).contains(dir.resolve("other/partimg/5/3001.jpg"));
    assertThat(second).isEqualTo(first);
    assertThat(Files.readAllBytes(dir.resolve("other/partimg/5/3001.jpg"))).isEqualTo(JPEG);
    assertThat(photoRequests.get()).isEqualTo(1);
    assertThat(service.contentType(first.orElseThrow())).isEqualTo("image/jpeg");
  }

  @Test
  void usesTheFirstAvailableColorWhenNoColorIsGiven() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensure("3001", null)).contains(dir.resolve("other/partimg/5/3001.jpg"));
    assertThat(photoRequests.get()).isEqualTo(1);
    assertThat(service.ensure("3003", null)).isEmpty();
  }

  @Test
  void resolvesAnImageFromItsItemNumber() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensureByItemNumber("6166107"))
        .contains(dir.resolve("other/partimg/7/3001.jpg"));
    assertThat(service.ensureByItemNumber("3001-5-abc"))
        .contains(dir.resolve("other/partimg/5/3001.jpg"));
    assertThat(elementRequests.get()).isEqualTo(1);
    assertThat(photoRequests.get()).isEqualTo(1);

    assertThat(service.ensureByItemNumber("unknown")).isEmpty();
    assertThatThrownBy(() -> service.ensureByItemNumber("../3001"))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void fallsBackToAnotherColorWhenTheRequestedColorHasNoUrl() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensureWithFallback("3001", 9))
        .contains(dir.resolve("other/partimg/5/3001.jpg"));
    assertThat(photoRequests.get()).isEqualTo(1);
  }

  @Test
  void returnsTheMissingImageWhenThePartHasNoImage() throws Exception {
    Files.createDirectories(dir.resolve("other/partimg"));
    Files.write(dir.resolve("other/partimg/part_img_missing.png"), PNG);
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensureWithFallback("3003", 5))
        .contains(dir.resolve("other/partimg/part_img_missing.png"));
    assertThat(service.ensureWithFallback("9999", null))
        .contains(dir.resolve("other/partimg/part_img_missing.png"));
    assertThat(service.missingImage())
        .contains(dir.resolve("other/partimg/part_img_missing.png"));
  }

  @Test
  void missingImageIsEmptyWhenTheFileIsAbsent() {
    assertThat(service().missingImage()).isEmpty();
  }

  @Test
  void keepsThePngExtensionOfTheSourceImage() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensure("3002", 5)).contains(dir.resolve("other/partimg/5/3002.png"));
    assertThat(service.find("3002", 5)).contains(dir.resolve("other/partimg/5/3002.png"));
    assertThat(Files.readAllBytes(dir.resolve("other/partimg/5/3002.png"))).isEqualTo(PNG);
    assertThat(service.contentType(dir.resolve("3002.png"))).isEqualTo("image/png");
  }

  @Test
  void findReturnsAnAlreadyStoredImageWithoutDownloading() throws Exception {
    Files.createDirectories(dir.resolve("other/partimg/9"));
    Files.write(dir.resolve("other/partimg/9/3001.png"), PNG);

    PartImageService service = service();

    assertThat(service.find("3001", 9)).contains(dir.resolve("other/partimg/9/3001.png"));
    assertThat(service.ensure("3001", 9)).contains(dir.resolve("other/partimg/9/3001.png"));
    assertThat(photoRequests.get()).isZero();
  }

  @Test
  void returnsEmptyWhenThePartColorHasNoImageUrl() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.ensure("3003", 5)).isEmpty();
    assertThat(service.ensure("9999", 5)).isEmpty();
    assertThat(service.find("9999", 5)).isEmpty();
    assertThat(Files.exists(dir.resolve("other/partimg/5/9999.jpg"))).isFalse();
  }

  @Test
  void failedDownloadStoresNothingAndCanBeRetried() throws Exception {
    Files.writeString(dir.resolve("re/inventory_parts.csv"),
        "inventory_id,part_num,color_id,quantity,is_spare,img_url\n"
            + "1,4000,5,1,False," + server.baseUrl() + "/photos/5/missing.jpg\n");
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThatThrownBy(() -> service.ensure("4000", 5))
        .isInstanceOf(IOException.class)
        .hasMessageContaining("404");
    assertThat(service.find("4000", 5)).isEmpty();
    assertThat(Files.exists(dir.resolve("other/partimg/5/4000.part"))).isFalse();
  }

  @Test
  void rejectsUnsafePartNumbersAndColorIds() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();

    assertThat(service.find("../3001", 5)).isEmpty();
    assertThatThrownBy(() -> service.ensure("../3001", 5))
        .isInstanceOf(IllegalArgumentException.class);
    assertThatThrownBy(() -> service.ensure("3001", -1))
        .isInstanceOf(IllegalArgumentException.class);
  }

  @Test
  void waitsBetweenTwoDownloads() throws Exception {
    PartImageService service = service();
    service.generatePartColorUrls();
    service.ensure("3001", 5);

    long start = System.nanoTime();
    service.ensure("3002", 5);
    long elapsedMs = (System.nanoTime() - start) / 1_000_000;

    assertThat(elapsedMs).isGreaterThanOrEqualTo(180);
  }
}
