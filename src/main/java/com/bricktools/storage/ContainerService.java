package com.bricktools.storage;

import com.bricktools.brickowl.BrickOwlService;
import com.bricktools.pab.PabService;
import java.io.IOException;
import java.util.ArrayList;
import java.util.LinkedHashMap;
import java.util.List;
import java.util.Map;
import org.springframework.stereotype.Service;

/**
 * Adds parts to the active container. A container is a part storage, a storage drawer, a
 * Pick-a-Brick purchase, or a BrickOwl order.
 */
@Service
public class ContainerService {

  private final PartStorageService storages;
  private final PabService pab;
  private final BrickOwlService brickOwl;

  public ContainerService(PartStorageService storages, PabService pab, BrickOwlService brickOwl) {
    this.storages = storages;
    this.pab = pab;
    this.brickOwl = brickOwl;
  }

  public synchronized Map<String, Object> addParts(AddToContainerRequest request) throws IOException {
    String type = clean(request == null ? null : request.type()).toLowerCase();
    List<String> partNumbers = new ArrayList<>();
    if (request != null && request.partNumbers() != null) {
      for (String partNumber : request.partNumbers()) {
        String number = clean(partNumber);
        if (!number.isEmpty()) {
          partNumbers.add(number);
        }
      }
    }
    if (partNumbers.isEmpty()) {
      throw new IllegalArgumentException("No part number provided");
    }

    int added;
    switch (type) {
      case "storage", "drawer" -> added = storages.addParts(request.storageId(),
          request.drawer(), partNumbers);
      case "pab" -> added = addToPab(request.purchaseId(), partNumbers);
      case "brickowl" -> added = addToBrickOwl(request.orderId(), partNumbers);
      default -> throw new IllegalArgumentException(
          "Unknown container type " + (type.isEmpty() ? "(empty)" : type));
    }

    Map<String, Object> result = new LinkedHashMap<>();
    result.put("added", added);
    result.put("type", type);
    result.put("partNumbers", partNumbers);
    return result;
  }

  private int addToPab(Integer purchaseId, List<String> partNumbers) throws IOException {
    if (purchaseId == null) {
      throw new IllegalArgumentException("A PaB purchase is required");
    }
    int added = 0;
    for (String partNumber : partNumbers) {
      Integer colorId = storages.defaultColorForPart(partNumber);
      if (colorId == null) {
        throw new IllegalArgumentException(
            "No color is available for part " + partNumber + "; add it from the PaB parts tab");
      }
      pab.addPart(purchaseId, partNumber, colorId);
      added++;
    }
    return added;
  }

  private int addToBrickOwl(String orderId, List<String> partNumbers) throws IOException {
    String key = clean(orderId);
    if (key.isEmpty()) {
      throw new IllegalArgumentException("A BrickOwl order is required");
    }
    int added = 0;
    for (String partNumber : partNumbers) {
      String name = storages.partName(partNumber);
      if (name.isEmpty()) {
        throw new IllegalArgumentException("Unknown part number " + partNumber);
      }
      Integer colorId = storages.defaultColorForPart(partNumber);
      String colorName = storages.defaultColorNameForPart(partNumber);
      brickOwl.addPart(key, partNumber, name, colorId, colorName);
      added++;
    }
    return added;
  }

  private static String clean(String value) {
    return value == null ? "" : value.trim();
  }
}
