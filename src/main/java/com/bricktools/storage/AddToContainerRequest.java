package com.bricktools.storage;

import java.util.List;

/**
 * Request used to add one or several parts to the active container. The type selects which
 * container field is used: {@code storage} and {@code drawer} use storageId/drawer, {@code pab}
 * uses purchaseId, and {@code brickowl} uses orderId.
 */
public record AddToContainerRequest(String type, String storageId, String drawer, Integer purchaseId,
                                    String orderId, List<String> partNumbers) {
}
