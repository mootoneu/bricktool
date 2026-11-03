package com.bricktools.web;

import com.bricktools.brickowl.BrickOwlService;
import com.bricktools.brickwatch.BrickWatchService;
import com.bricktools.notification.NotificationService;
import com.bricktools.notification.NotificationService.Notification;
import com.bricktools.purchase.PurchaseRequest;
import com.bricktools.purchase.PurchaseService;
import com.bricktools.rebrickable.RebrickableService;
import java.io.IOException;
import java.util.List;
import java.util.Map;
import org.springframework.http.HttpStatus;
import org.springframework.web.bind.annotation.GetMapping;
import org.springframework.web.bind.annotation.PathVariable;
import org.springframework.web.bind.annotation.PostMapping;
import org.springframework.web.bind.annotation.PutMapping;
import org.springframework.web.bind.annotation.RequestBody;
import org.springframework.web.bind.annotation.RequestMapping;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

@RestController
@RequestMapping("/api")
public class ApiController {

  private final RebrickableService rebrickable;
  private final BrickWatchService brickWatch;
  private final BrickOwlService brickOwl;
  private final PurchaseService purchases;
  private final NotificationService notifications;

  public ApiController(RebrickableService rebrickable, BrickWatchService brickWatch, BrickOwlService brickOwl,
                       PurchaseService purchases, NotificationService notifications) {
    this.rebrickable = rebrickable;
    this.brickWatch = brickWatch;
    this.brickOwl = brickOwl;
    this.purchases = purchases;
    this.notifications = notifications;
  }

  @GetMapping("/notifications")
  public List<Notification> notifications() {
    return notifications.list();
  }

  @GetMapping("/rebrickable/status")
  public Map<String, Object> rebrickableStatus() throws IOException {
    return rebrickable.status();
  }

  @PostMapping("/rebrickable/update")
  public Map<String, Object> rebrickableUpdate() throws IOException, InterruptedException {
    return Map.of("lastDownload", rebrickable.update().toString());
  }

  @GetMapping("/brickwatch/sets/{setNumber}/price")
  public Map<String, Object> setPrice(@PathVariable String setNumber) throws IOException, InterruptedException {
    return brickWatch.price(setNumber);
  }

  @GetMapping("/brickowl/stats")
  public Map<String, Object> brickOwlStats() throws IOException {
    return brickOwl.stats();
  }

  @PostMapping("/brickowl/update")
  public Map<String, Object> brickOwlUpdate() throws IOException {
    return brickOwl.update();
  }

  @GetMapping("/brickowl/orders")
  public List<Map<String, String>> brickOwlOrders() throws IOException {
    return brickOwl.orders();
  }

  @GetMapping("/brickowl/orders/{orderId}/items")
  public List<Map<String, String>> brickOwlItems(@PathVariable String orderId) throws IOException {
    return brickOwl.items(orderId);
  }

  @GetMapping("/purchases")
  public List<Map<String, Object>> purchases() throws IOException {
    return purchases.list();
  }

  @PostMapping("/purchases")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Integer> createPurchase(@RequestBody PurchaseRequest request) throws IOException {
    return Map.of("id", purchases.create(request));
  }

  @PutMapping("/purchases/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void updatePurchase(@PathVariable int id, @RequestBody PurchaseRequest request) throws IOException {
    purchases.update(id, request);
  }
}
