package com.bricktools.setimg;

import com.bricktools.purchase.PurchaseService;
import java.io.IOException;
import java.util.List;
import java.util.concurrent.ExecutorService;
import java.util.concurrent.Executors;
import org.slf4j.Logger;
import org.slf4j.LoggerFactory;
import org.springframework.stereotype.Service;

/**
 * One-off job that downloads the missing picture of every purchased set. Runs in the background because it can
 * take several minutes; at most one download happens per second so Rebrickable does not ban the application.
 */
@Service
public class SetImageBackfill {

  static final long DELAY_MS = 1000;

  private static final Logger log = LoggerFactory.getLogger(SetImageBackfill.class);

  public record Progress(boolean running, int total, int processed, int downloaded, int skipped, int noImage,
                         int failed, String lastError) {}

  private final SetImageService images;
  private final PurchaseService purchases;
  private final ExecutorService executor = Executors.newSingleThreadExecutor(runnable -> {
    Thread thread = new Thread(runnable, "set-image-backfill");
    thread.setDaemon(true);
    return thread;
  });
  private volatile Progress progress = new Progress(false, 0, 0, 0, 0, 0, 0, null);
  private long lastDownloadEndedAt;

  public SetImageBackfill(SetImageService images, PurchaseService purchases) {
    this.images = images;
    this.purchases = purchases;
  }

  public synchronized boolean start() throws IOException {
    if (progress.running()) {
      return false;
    }
    List<String> setNumbers = purchases.setNumbers();
    progress = new Progress(true, setNumbers.size(), 0, 0, 0, 0, 0, null);
    executor.submit(() -> run(setNumbers));
    return true;
  }

  public Progress progress() {
    return progress;
  }

  private void run(List<String> setNumbers) {
    int total = setNumbers.size();
    int processed = 0;
    int downloaded = 0;
    int skipped = 0;
    int noImage = 0;
    int failed = 0;
    String lastError = null;
    try {
      for (String setNumber : setNumbers) {
        processed++;
        try {
          if (images.find(setNumber).isPresent()) {
            skipped++;
          } else if (!images.hasImageUrl(setNumber)) {
            noImage++;
          } else {
            pauseBeforeDownload();
            try {
              if (images.ensure(setNumber).isPresent()) {
                downloaded++;
              } else {
                noImage++;
              }
            } finally {
              lastDownloadEndedAt = System.currentTimeMillis();
            }
          }
        } catch (IOException | IllegalArgumentException e) {
          failed++;
          lastError = setNumber + ": " + e.getMessage();
          log.warn("Image backfill failed for set {}: {}", setNumber, e.getMessage());
        }
        progress = new Progress(true, total, processed, downloaded, skipped, noImage, failed, lastError);
      }
    } catch (InterruptedException e) {
      Thread.currentThread().interrupt();
      lastError = "Interrupted";
    } finally {
      progress = new Progress(false, total, processed, downloaded, skipped, noImage, failed, lastError);
      log.info("Image backfill finished: {} downloaded, {} already stored, {} without picture, {} failed",
          downloaded, skipped, noImage, failed);
    }
  }

  private void pauseBeforeDownload() throws InterruptedException {
    long wait = lastDownloadEndedAt + DELAY_MS - System.currentTimeMillis();
    if (wait > 0) {
      Thread.sleep(wait);
    }
  }
}
