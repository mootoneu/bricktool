package com.bricktools.web;

import java.io.IOException;
import java.util.Map;
import java.util.Objects;
import org.springframework.http.HttpStatus;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.ExceptionHandler;
import org.springframework.web.bind.annotation.RestControllerAdvice;
import org.springframework.web.client.RestClientException;

@RestControllerAdvice
public class ApiExceptionHandler {

  @ExceptionHandler({IllegalArgumentException.class, IllegalStateException.class})
  public ResponseEntity<Map<String, String>> badRequest(RuntimeException e) {
    return ResponseEntity.badRequest().body(error(e.getMessage()));
  }

  @ExceptionHandler(RestClientException.class)
  public ResponseEntity<Map<String, String>> upstreamFailure(RestClientException e) {
    return ResponseEntity.status(HttpStatus.BAD_GATEWAY).body(error("External service error: " + e.getMessage()));
  }

  @ExceptionHandler(IOException.class)
  public ResponseEntity<Map<String, String>> ioFailure(IOException e) {
    return ResponseEntity.status(HttpStatus.INTERNAL_SERVER_ERROR).body(error(e.getMessage()));
  }

  private static Map<String, String> error(String message) {
    return Map.of("error", Objects.requireNonNullElse(message, "Unexpected error"));
  }
}
