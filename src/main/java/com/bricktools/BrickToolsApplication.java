package com.bricktools;

import com.bricktools.config.BrickToolsProperties;
import org.springframework.boot.SpringApplication;
import org.springframework.boot.autoconfigure.SpringBootApplication;
import org.springframework.boot.context.properties.EnableConfigurationProperties;
import org.springframework.scheduling.annotation.EnableScheduling;

@SpringBootApplication
@EnableScheduling
@EnableConfigurationProperties(BrickToolsProperties.class)
public class BrickToolsApplication {

  public static void main(String[] args) {
    SpringApplication.run(BrickToolsApplication.class, args);
  }
}
