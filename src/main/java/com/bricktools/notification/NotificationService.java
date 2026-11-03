package com.bricktools.notification;

import java.util.List;
import java.util.Map;
import java.util.concurrent.ConcurrentHashMap;
import org.springframework.stereotype.Service;

@Service
public class NotificationService {

  public record Notification(String id, String message, String link) {}

  private final Map<String, Notification> active = new ConcurrentHashMap<>();

  public void raise(String id, String message, String link) {
    active.put(id, new Notification(id, message, link));
  }

  public void dismiss(String id) {
    active.remove(id);
  }

  public List<Notification> list() {
    return List.copyOf(active.values());
  }
}
