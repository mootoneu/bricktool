package com.bricktools.storage;

/**
 * Request used to create or update a physical part storage.
 */
public record PartStorageRequest(String id, String model, Integer drawersCount, String location,
                                 String description) {
}
