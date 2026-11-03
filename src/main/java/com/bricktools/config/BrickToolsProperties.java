package com.bricktools.config;

import java.nio.file.Path;
import org.springframework.boot.context.properties.ConfigurationProperties;

@ConfigurationProperties(prefix = "bricktools")
public record BrickToolsProperties(String dataDir, Rebrickable rebrickable, BrickWatch brickwatch, BrickOwl brickowl) {

  public Path dataPath() {
    return Path.of(dataDir);
  }

  public record Rebrickable(String downloadUrl) {}

  public record BrickWatch(String baseUrl, long minDelayMs) {}

  public record BrickOwl(String baseUrl, String apiKey) {}
}
