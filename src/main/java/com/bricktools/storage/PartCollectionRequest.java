package com.bricktools.storage;

/**
 * Request used to create or update a rule of the part collection.
 */
public record PartCollectionRequest(String parts, String colors, String storageId, String drawer,
                                    String amount) {
}
