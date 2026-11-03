package com.bricktools.support;

import com.sun.net.httpserver.HttpHandler;
import com.sun.net.httpserver.HttpServer;
import java.io.IOException;
import java.io.OutputStream;
import java.io.ByteArrayOutputStream;
import java.net.InetSocketAddress;
import java.nio.charset.StandardCharsets;
import java.util.Map;
import java.util.zip.ZipEntry;
import java.util.zip.ZipOutputStream;

public final class TestHttpServer implements AutoCloseable {

  private final HttpServer server;

  public TestHttpServer() throws IOException {
    server = HttpServer.create(new InetSocketAddress("127.0.0.1", 0), 0);
    server.start();
  }

  public void respond(String path, String contentType, byte[] body) {
    server.createContext(path, exchange -> {
      exchange.getResponseHeaders().add("Content-Type", contentType);
      exchange.sendResponseHeaders(200, body.length);
      try (OutputStream out = exchange.getResponseBody()) {
        out.write(body);
      }
    });
  }

  public void respond(String path, String contentType, String body) {
    respond(path, contentType, body.getBytes(StandardCharsets.UTF_8));
  }

  public void handle(String path, HttpHandler handler) {
    server.createContext(path, handler);
  }

  public String baseUrl() {
    return "http://127.0.0.1:" + server.getAddress().getPort();
  }

  public static byte[] zip(Map<String, String> entries) throws IOException {
    ByteArrayOutputStream bytes = new ByteArrayOutputStream();
    try (ZipOutputStream zip = new ZipOutputStream(bytes)) {
      for (Map.Entry<String, String> entry : entries.entrySet()) {
        zip.putNextEntry(new ZipEntry(entry.getKey()));
        zip.write(entry.getValue().getBytes(StandardCharsets.UTF_8));
        zip.closeEntry();
      }
    }
    return bytes.toByteArray();
  }

  @Override
  public void close() {
    server.stop(0);
  }
}
