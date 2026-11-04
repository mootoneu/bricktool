package com.bricktools.web;

import com.bricktools.brickonomics.BrickonomicsService;
import com.bricktools.brickowl.BrickOwlService;
import com.bricktools.brickwatch.BrickWatchService;
import com.bricktools.notification.NotificationService;
import com.bricktools.notification.NotificationService.Notification;
import com.bricktools.other.OtherImageService;
import com.bricktools.purchase.PurchaseRequest;
import com.bricktools.purchase.PurchaseService;
import com.bricktools.rebrickable.RebrickableService;
import com.bricktools.setimg.SetImageBackfill;
import com.bricktools.setimg.SetImageService;
import com.bricktools.theme.ThemeImageService;
import com.bricktools.wishlist.NewSetService;
import com.bricktools.wishlist.WishlistRequest;
import com.bricktools.wishlist.WishlistService;
import java.io.IOException;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import java.util.Optional;
import org.springframework.core.io.Resource;
import org.springframework.http.HttpStatus;
import org.springframework.http.MediaType;
import org.springframework.http.ResponseEntity;
import org.springframework.web.bind.annotation.DeleteMapping;
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
  private final BrickonomicsService brickonomics;
  private final BrickOwlService brickOwl;
  private final PurchaseService purchases;
  private final NotificationService notifications;
  private final SetImageService setImages;
  private final SetImageBackfill backfill;
  private final ThemeImageService themeImages;
  private final OtherImageService otherImages;
  private final NewSetService newSets;
  private final WishlistService wishlist;

  public ApiController(RebrickableService rebrickable, BrickWatchService brickWatch,
                       BrickonomicsService brickonomics, BrickOwlService brickOwl,
                       PurchaseService purchases, NotificationService notifications, SetImageService setImages,
                       SetImageBackfill backfill, ThemeImageService themeImages, OtherImageService otherImages,
                       NewSetService newSets, WishlistService wishlist) {
    this.rebrickable = rebrickable;
    this.brickWatch = brickWatch;
    this.brickonomics = brickonomics;
    this.brickOwl = brickOwl;
    this.purchases = purchases;
    this.notifications = notifications;
    this.setImages = setImages;
    this.backfill = backfill;
    this.themeImages = themeImages;
    this.otherImages = otherImages;
    this.newSets = newSets;
    this.wishlist = wishlist;
  }

  @PostMapping("/setimg/backfill")
  public ResponseEntity<SetImageBackfill.Progress> startSetImageBackfill() throws IOException {
    HttpStatus status = backfill.start() ? HttpStatus.ACCEPTED : HttpStatus.CONFLICT;
    return ResponseEntity.status(status).body(backfill.progress());
  }

  @GetMapping("/setimg/backfill")
  public SetImageBackfill.Progress setImageBackfillStatus() {
    return backfill.progress();
  }

  @GetMapping("/setimg/{setNumber}")
  public ResponseEntity<Resource> setImage(@PathVariable String setNumber) throws IOException {
    Optional<Path> image = setImages.find(setNumber);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(setImages.contentType(image.get())))
        .body(setImages.resource(image.get()));
  }

  @GetMapping("/themeimg/{imageName:.+}")
  public ResponseEntity<Resource> themeImage(@PathVariable String imageName) throws IOException {
    Optional<Path> image = themeImages.find(imageName);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(themeImages.contentType(image.get())))
        .body(themeImages.resource(image.get()));
  }

  @GetMapping("/vendorimg/{imageName:.+}")
  public ResponseEntity<Resource> vendorImage(@PathVariable String imageName) throws IOException {
    return otherImage("vendor", imageName);
  }

  @GetMapping("/peopleimg/{imageName:.+}")
  public ResponseEntity<Resource> peopleImage(@PathVariable String imageName) throws IOException {
    return otherImage("people", imageName);
  }

  private ResponseEntity<Resource> otherImage(String category, String imageName) {
    Optional<Path> image = otherImages.find(category, imageName);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(otherImages.contentType(image.get())))
        .body(otherImages.resource(image.get()));
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

  @PostMapping("/brickonomics/sets/{setNumber}/price")
  public Map<String, Object> fetchBrickonomicsPrice(@PathVariable String setNumber)
      throws IOException, InterruptedException {
    return brickonomics.fetchPrice(setNumber);
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

  @GetMapping("/purchases/options")
  public Map<String, List<String>> purchaseOptions() throws IOException {
    return purchases.options();
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

  @GetMapping("/newsets")
  public Map<String, Object> newSets() throws IOException {
    return newSets.catalog();
  }

  @GetMapping("/wishlist")
  public List<Map<String, Object>> wishlistEntries() throws IOException {
    return wishlist.list();
  }

  @GetMapping("/wishlist/options")
  public Map<String, Object> wishlistOptions() throws IOException {
    return wishlist.options();
  }

  @PostMapping("/wishlist")
  @ResponseStatus(HttpStatus.CREATED)
  public Map<String, Integer> createWishlistEntry(@RequestBody WishlistRequest request) throws IOException {
    return Map.of("id", wishlist.create(request));
  }

  @PutMapping("/wishlist/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void updateWishlistEntry(@PathVariable int id, @RequestBody WishlistRequest request) throws IOException {
    wishlist.update(id, request);
  }

  @DeleteMapping("/wishlist/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  public void deleteWishlistEntry(@PathVariable int id) throws IOException {
    wishlist.delete(id);
  }
}
