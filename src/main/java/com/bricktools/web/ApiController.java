package com.bricktools.web;

import com.bricktools.backup.BackupService;
import com.bricktools.brickonomics.BrickonomicsService;
import com.bricktools.brickowl.BrickOwlService;
import com.bricktools.brickwatch.BrickWatchService;
import com.bricktools.color.ColorService;
import com.bricktools.notification.NotificationService;
import com.bricktools.notification.NotificationService.Notification;
import com.bricktools.other.OtherImageService;
import com.bricktools.pab.PabPartRequest;
import com.bricktools.pab.PabPurchaseRequest;
import com.bricktools.pab.PabService;
import com.bricktools.part.MainPartStarsRequest;
import com.bricktools.part.PartImageService;
import com.bricktools.part.PartService;
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
import java.time.LocalDate;
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
import org.springframework.web.bind.annotation.RequestParam;
import org.springframework.web.bind.annotation.ResponseStatus;
import org.springframework.web.bind.annotation.RestController;

import io.swagger.v3.oas.annotations.Operation;
import io.swagger.v3.oas.annotations.Parameter;
import io.swagger.v3.oas.annotations.responses.ApiResponse;
import io.swagger.v3.oas.annotations.tags.Tag;

@Tag(name = "Brick Tools API", description = "Endpoints exposed by the Brick Tools application")
@RestController
@RequestMapping("/api")
public class ApiController {

  private final RebrickableService rebrickable;
  private final BrickWatchService brickWatch;
  private final BrickonomicsService brickonomics;
  private final BackupService backup;
  private final BrickOwlService brickOwl;
  private final PurchaseService purchases;
  private final NotificationService notifications;
  private final SetImageService setImages;
  private final SetImageBackfill backfill;
  private final ThemeImageService themeImages;
  private final OtherImageService otherImages;
  private final NewSetService newSets;
  private final WishlistService wishlist;
  private final ColorService colors;
  private final PabService pab;
  private final PartService partService;
  private final PartImageService partImages;

  public ApiController(RebrickableService rebrickable, BrickWatchService brickWatch,
                       BrickonomicsService brickonomics, BackupService backup, BrickOwlService brickOwl,
                       PurchaseService purchases, NotificationService notifications, SetImageService setImages,
                       SetImageBackfill backfill, ThemeImageService themeImages, OtherImageService otherImages,
                       NewSetService newSets, WishlistService wishlist, ColorService colors, PabService pab,
                       PartService partService, PartImageService partImages) {
    this.rebrickable = rebrickable;
    this.brickWatch = brickWatch;
    this.brickonomics = brickonomics;
    this.backup = backup;
    this.brickOwl = brickOwl;
    this.purchases = purchases;
    this.notifications = notifications;
    this.setImages = setImages;
    this.backfill = backfill;
    this.themeImages = themeImages;
    this.otherImages = otherImages;
    this.newSets = newSets;
    this.wishlist = wishlist;
    this.colors = colors;
    this.pab = pab;
    this.partService = partService;
    this.partImages = partImages;
  }

  /**
   * Start the set image backfill process.
   */
  @PostMapping(path = "/setimg/backfill", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Start Set Image Backfill",
      description = "Initiates a background job to download missing set images. Returns progress information."
  )
  @ApiResponse(responseCode = "202", description = "Backfill started")
  @ApiResponse(responseCode = "409", description = "A backfill is already running")
  public ResponseEntity<SetImageBackfill.Progress> startSetImageBackfill() throws IOException {
    HttpStatus status = backfill.start() ? HttpStatus.ACCEPTED : HttpStatus.CONFLICT;
    return ResponseEntity.status(status).body(backfill.progress());
  }

  /**
   * Get the current progress of the set image backfill job.
   */
  @GetMapping(path = "/setimg/backfill", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Backfill Status",
      description = "Returns the current progress of the background image backfill job."
  )
  public SetImageBackfill.Progress setImageBackfillStatus() {
    return backfill.progress();
  }

  /**
   * Download a set image for the given set number.
   */
  @GetMapping(path = "/setimg/{setNumber}", produces = "image/*")
  @Operation(
      summary = "Get Set Image",
      description = "Returns the image for a Lego set."
  )
  @ApiResponse(responseCode = "200", description = "Image returned")
  @ApiResponse(responseCode = "404", description = "Set image not found")
  public ResponseEntity<Resource> setImage(
      @Parameter(name = "setNumber", description = "Lego set number") @PathVariable String setNumber)
      throws IOException {
    Optional<Path> image = setImages.find(setNumber);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(setImages.contentType(image.get())))
        .body(setImages.resource(image.get()));
  }

  /**
   * Download a theme image by its internal name.
   */
  @GetMapping(path = "/themeimg/{imageName:.+}", produces = "image/*")
  @Operation(
      summary = "Get Theme Image",
      description = "Returns the image for a Lego theme."
  )
  @ApiResponse(responseCode = "200", description = "Image returned")
  @ApiResponse(responseCode = "404", description = "Theme image not found")
  public ResponseEntity<Resource> themeImage(
      @Parameter(name = "imageName", description = "Internal name of the theme image") @PathVariable String imageName)
      throws IOException {
    Optional<Path> image = themeImages.find(imageName);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(themeImages.contentType(image.get())))
        .body(themeImages.resource(image.get()));
  }

  /**
   * Download a vendor image by its internal name.
   */
  @GetMapping(path = "/vendorimg/{imageName:.+}", produces = "image/*")
  @Operation(
      summary = "Get Vendor Image",
      description = "Returns the logo/image for a set vendor."
  )
  @ApiResponse(responseCode = "200", description = "Image returned")
  @ApiResponse(responseCode = "404", description = "Vendor image not found")
  public ResponseEntity<Resource> vendorImage(
      @Parameter(name = "imageName", description = "Internal name of the vendor image") @PathVariable String imageName)
      throws IOException {
    Optional<Path> image = otherImages.find("vendor", imageName);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(otherImages.contentType(image.get())))
        .body(otherImages.resource(image.get()));
  }

  /**
   * Download a people image by its internal name.
   */
  @GetMapping(path = "/peopleimg/{imageName:.+}", produces = "image/*")
  @Operation(
      summary = "Get People Image",
      description = "Returns the image for a person (family member, friend, etc.)."
  )
  @ApiResponse(responseCode = "200", description = "Image returned")
  @ApiResponse(responseCode = "404", description = "People image not found")
  public ResponseEntity<Resource> peopleImage(
      @Parameter(name = "imageName", description = "Internal name of the people image") @PathVariable String imageName)
      throws IOException {
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

  /**
   * Get the list of application notifications.
   */
  @GetMapping(path = "/notifications", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Notifications",
      description = "Returns all current notifications in the system."
  )
  public List<Notification> notifications() {
    return notifications.list();
  }

  /**
   * Check the status of the rebrickable sync service.
   */
  @GetMapping(path = "/rebrickable/status", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Rebrickable Status",
      description = "Returns information about the last successful download from rebrickable.com."
  )
  public Map<String, Object> rebrickableStatus() throws IOException {
    return rebrickable.status();
  }

  /**
   * Trigger a full data sync with rebrickable.com.
   */
  @PostMapping(path = "/rebrickable/update", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Update Rebrickable Data",
      description = "Starts downloading the latest data from rebrickable.com."
  )
  public Map<String, Object> rebrickableUpdate() throws IOException, InterruptedException {
    return Map.of("lastDownload", rebrickable.update().toString());
  }

  /**
   * Fetch the official Lego price for a set from BrickWatch.
   */
  @GetMapping(path = "/brickwatch/sets/{setNumber}/price", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Set Price from BrickWatch",
      description = "Fetches the official Lego price for a specific set number."
  )
  public Map<String, Object> setPrice(@PathVariable(name = "setNumber") String setNumber) throws IOException, InterruptedException {
    return brickWatch.price(setNumber);
  }

  /**
   * Get list of available backups and their details.
   */
  @GetMapping(path = "/backups", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List Backups",
      description = "Returns information about all existing data backups."
  )
  public List<Map<String, Object>> backups() throws IOException {
    return backup.list();
  }

  /**
   * Create a new backup of the application data.
   */
  @PostMapping(path = "/backups", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Create Backup",
      description = "Creates a new backup of all stored data."
  )
  public Map<String, Object> createBackup() throws IOException {
    return backup.create();
  }

  /**
   * Fetch the official Lego price for a set from Brickonomics.
   */
  @PostMapping(path = "/brickonomics/sets/{setNumber}/price", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Set Price from Brickonomics",
      description = "Fetches the official Lego price for a specific set number from brickonomics.com."
  )
  public Map<String, Object> fetchBrickonomicsPrice(@PathVariable(name = "setNumber") String setNumber)
      throws IOException, InterruptedException {
    return brickonomics.fetchPrice(setNumber);
  }

  /**
   * Get statistics about BrickOwl integration.
   */
  @GetMapping(path = "/brickowl/stats", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get BrickOwl Stats",
      description = "Returns cached statistics from BrickOwl."
  )
  public Map<String, Object> brickOwlStats() throws IOException {
    return brickOwl.stats();
  }

  /**
   * Trigger a refresh of BrickOwl data.
   */
  @PostMapping(path = "/brickowl/update", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Update BrickOwl Data",
      description = "Starts downloading the latest data from BrickOwl."
  )
  public Map<String, Object> brickOwlUpdate() throws IOException {
    return brickOwl.update();
  }

  /**
   * Get list of all BrickOwl orders.
   */
  @GetMapping(path = "/brickowl/orders", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List BrickOwl Orders",
      description = "Returns a list of all BrickOwl catalog orders."
  )
  public List<Map<String, String>> brickOwlOrders() throws IOException {
    return brickOwl.orders();
  }

  /**
   * Get the items in a specific BrickOwl order.
   */
  @GetMapping(path = "/brickowl/orders/{orderId}/items", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Order Items",
      description = "Returns all items for a specific BrickOwl order."
  )
  public List<Map<String, String>> brickOwlItems(@Parameter(name = "orderId", description = "BrickOwl order ID") @PathVariable String orderId) throws IOException {
    return brickOwl.items(orderId);
  }

  /**
   * Get all parts from BrickOwl.
   */
  @GetMapping(path = "/brickowl/parts", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List Parts",
      description = "Returns a list of all Lego parts tracked by BrickOwl."
  )
  public List<Map<String, Object>> brickOwlParts() throws IOException {
    return brickOwl.parts();
  }

  /**
   * Get all purchases (owned sets).
   */
  @GetMapping(path = "/purchases", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List Purchases",
      description = "Returns all set purchases recorded in the database."
  )
  public List<Map<String, Object>> purchases() throws IOException {
    return purchases.list();
  }

  /**
   * Get available options for purchase creation (family members, etc.).
   */
  @GetMapping(path = "/purchases/options", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Purchase Options",
      description = "Returns the dropdown options used when creating a new purchase record."
  )
  public Map<String, List<String>> purchaseOptions() throws IOException {
    return purchases.options();
  }

  /**
   * Create a new purchase record for a set.
   */
  @PostMapping(path = "/purchases", produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create Purchase",
      description = "Records the purchase of a Lego set."
  )
  @ApiResponse(responseCode = "201", description = "Purchase created")
  public Map<String, Integer> createPurchase(@RequestBody PurchaseRequest request) throws IOException {
    return Map.of("id", purchases.create(request));
  }

  /**
   * Update an existing purchase record.
   */
  @PutMapping(path = "/purchases/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Update Purchase",
      description = "Updates information for an existing purchase record."
  )
  @ApiResponse(responseCode = "204", description = "Purchase updated")
  public void updatePurchase(@Parameter(name = "id", description = "Purchase ID") @PathVariable int id, @RequestBody PurchaseRequest request) throws IOException {
    purchases.update(id, request);
  }

  /**
   * Get recently released sets (catalog).
   */
  @GetMapping(path = "/newsets", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List New Sets",
      description = "Returns sets released in a specific year or the current year."
  )
  public Map<String, Object> newSets(@Parameter(name = "year", description = "Release year (optional)") @RequestParam(required = false) Integer year) throws IOException {
    return newSets.catalog(year == null ? LocalDate.now().getYear() : year);
  }

  /**
   * Get all available colors.
   */
  @GetMapping(path = "/colors", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List Colors",
      description = "Returns all Lego colors tracked by the application."
  )
  public List<Map<String, Object>> colors() throws IOException {
    return colors.colors();
  }

  /**
   * Get color mappings between different identifier systems.
   */
  @GetMapping(path = "/color-mappings", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Color Mappings",
      description = "Returns mappings that link Lego color IDs to external identifiers (BrickOwl, BrickLink, LDraw, etc.)."
  )
  public List<Map<String, Object>> colorMappings() throws IOException {
    return colors.mappings();
  }

  /**
   * Get all wishlisted sets.
   */
  @GetMapping(path = "/wishlist", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List Wishlist",
      description = "Returns all items currently in the wishlist."
  )
  public List<Map<String, Object>> wishlistEntries() throws IOException {
    return wishlist.list();
  }

  /**
   * Get available options for wishlist creation (family members, priorities, etc.).
   */
  @GetMapping(path = "/wishlist/options", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Get Wishlist Options",
      description = "Returns the dropdown options used when creating a new wishlist entry."
  )
  public Map<String, Object> wishlistOptions() throws IOException {
    return wishlist.options();
  }

  /**
   * Add a new set to the wishlist.
   */
  @PostMapping(path = "/wishlist", produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Add to Wishlist",
      description = "Adds a Lego set to the personal wishlist with ownership and priority information."
  )
  @ApiResponse(responseCode = "201", description = "Wishlist entry created")
  public Map<String, Integer> createWishlistEntry(@RequestBody WishlistRequest request) throws IOException {
    return Map.of("id", wishlist.create(request));
  }

  /**
   * Update an existing wishlist entry.
   */
  @PutMapping(path = "/wishlist/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Update Wishlist Entry",
      description = "Updates information for an existing wishlist item."
  )
  @ApiResponse(responseCode = "204", description = "Wishlist entry updated")
  public void updateWishlistEntry(@Parameter(name = "id", description = "Wishlist entry ID") @PathVariable int id, @RequestBody WishlistRequest request) throws IOException {
    wishlist.update(id, request);
  }

  /**
   * Remove a set from the wishlist.
   */
  @DeleteMapping(path = "/wishlist/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Remove from Wishlist",
      description = "Removes a Lego set from the personal wishlist."
  )
  @ApiResponse(responseCode = "204", description = "Wishlist entry removed")
  public void deleteWishlistEntry(@Parameter(name = "id", description = "Wishlist entry ID") @PathVariable int id) throws IOException {
    wishlist.delete(id);
  }

  @GetMapping(path = "/pab/purchases", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List PaB purchases",
      description = "Returns the Pick a Brick purchases with the total quantity of their parts."
  )
  public List<Map<String, Object>> pabPurchases() throws IOException {
    return pab.purchases();
  }

  @PostMapping(path = "/pab/purchases", produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create PaB purchase",
      description = "Records a Pick a Brick purchase made in a Lego store."
  )
  @ApiResponse(responseCode = "201", description = "PaB purchase created")
  public Map<String, Integer> createPabPurchase(@RequestBody PabPurchaseRequest request) throws IOException {
    return Map.of("id", pab.create(request));
  }

  @PutMapping(path = "/pab/purchases/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Update PaB purchase",
      description = "Updates an existing Pick a Brick purchase."
  )
  @ApiResponse(responseCode = "204", description = "PaB purchase updated")
  public void updatePabPurchase(
      @Parameter(name = "id", description = "PaB purchase ID") @PathVariable int id,
      @RequestBody PabPurchaseRequest request) throws IOException {
    pab.update(id, request);
  }

  @GetMapping(path = "/pab/purchases/{purchaseId}/parts", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List PaB parts",
      description = "Returns the parts of a Pick a Brick purchase with their name, category and color."
  )
  public List<Map<String, Object>> pabParts(
      @Parameter(name = "purchaseId", description = "PaB purchase ID") @PathVariable int purchaseId)
      throws IOException {
    return pab.parts(purchaseId);
  }

  @PostMapping(path = "/pab/purchases/{purchaseId}/parts", produces = MediaType.APPLICATION_JSON_VALUE)
  @ResponseStatus(HttpStatus.CREATED)
  @Operation(
      summary = "Create PaB part",
      description = "Adds a part to an existing Pick a Brick purchase."
  )
  @ApiResponse(responseCode = "201", description = "PaB part created")
  public Map<String, Integer> createPabPart(
      @Parameter(name = "purchaseId", description = "PaB purchase ID") @PathVariable int purchaseId,
      @RequestBody PabPartRequest request) throws IOException {
    return Map.of("id", pab.createPart(purchaseId, request));
  }

  @PutMapping(path = "/pab/parts/{id}")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Update PaB part",
      description = "Updates an existing part of a Pick a Brick purchase."
  )
  @ApiResponse(responseCode = "204", description = "PaB part updated")
  public void updatePabPart(
      @Parameter(name = "id", description = "PaB part ID") @PathVariable int id,
      @RequestBody PabPartRequest request) throws IOException {
    pab.updatePart(id, request);
  }

  @GetMapping(path = "/parts/categories", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List part categories",
      description = "Returns the visible Brick Tools part categories grouped by category group."
  )
  public List<Map<String, Object>> partCategories() throws IOException {
    return partService.categories();
  }

  @GetMapping(path = "/parts/categories/{categoryId}/main-parts", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List main parts",
      description = "Returns the main parts of a Brick Tools part category."
  )
  public List<Map<String, Object>> mainParts(
      @Parameter(name = "categoryId", description = "Part category ID") @PathVariable int categoryId)
      throws IOException {
    return partService.mainParts(categoryId);
  }

  @PostMapping(path = "/parts/main-parts/generate", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Generate main parts",
      description = "Rebuilds data/bt/main_parts.csv from the Rebrickable parts and the Brick Tools part categories."
  )
  public Map<String, Object> generateMainParts() throws IOException {
    return partService.generateMainParts();
  }

  @PutMapping(path = "/parts/main-parts/{partNumber}/stars")
  @ResponseStatus(HttpStatus.NO_CONTENT)
  @Operation(
      summary = "Update main part stars",
      description = "Sets the star rating (0 to 5) of a main part."
  )
  @ApiResponse(responseCode = "204", description = "Main part stars updated")
  public void updateMainPartStars(
      @Parameter(name = "partNumber", description = "Main part number") @PathVariable String partNumber,
      @RequestBody MainPartStarsRequest request) throws IOException {
    partService.updateStars(partNumber, request.stars());
  }

  @GetMapping(path = "/parts/main-parts/{partNumber}/alternates", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "List main part alternates",
      description = "Returns the part relationships and related parts of a main part."
  )
  public Map<String, Object> mainPartAlternates(
      @Parameter(name = "partNumber", description = "Main part number") @PathVariable String partNumber)
      throws IOException {
    return partService.alternates(partNumber);
  }

  @PostMapping(path = "/parts/part-color-urls/generate", produces = MediaType.APPLICATION_JSON_VALUE)
  @Operation(
      summary = "Generate part color URLs",
      description = "Rebuilds data/bt/part_color_url.csv from the Rebrickable inventory parts. "
          + "The first inventory row of each part/color pair with an image URL is kept."
  )
  public Map<String, Object> generatePartColorUrls() throws IOException {
    return partImages.generatePartColorUrls();
  }

  @GetMapping(path = "/parts/{partNumber}/image", produces = "image/*")
  @Operation(
      summary = "Get Part Image",
      description = "Returns the image of a part color, downloading it from the Rebrickable CDN "
          + "into data/other/partimg/{colorId}/ when it is not stored yet."
  )
  @ApiResponse(responseCode = "200", description = "Image returned")
  @ApiResponse(responseCode = "404", description = "Part image not found")
  public ResponseEntity<Resource> partImage(
      @Parameter(name = "partNumber", description = "Lego part number") @PathVariable String partNumber,
      @Parameter(name = "colorId", description = "Lego color ID") @RequestParam int colorId)
      throws IOException, InterruptedException {
    Optional<Path> image = partImages.ensure(partNumber, colorId);
    if (image.isEmpty()) {
      return ResponseEntity.notFound().build();
    }
    return ResponseEntity.ok()
        .contentType(MediaType.parseMediaType(partImages.contentType(image.get())))
        .body(partImages.resource(image.get()));
  }
}
