package com.bricktools.purchase;

/**
 * Request body used to update the actual quantity of a part in a set inventory.
 */
public record SetInventoryRequest(Integer actualQut) {}
