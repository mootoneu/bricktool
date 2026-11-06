package com.bricktools.pab;

import java.math.BigDecimal;

public record PabPurchaseRequest(String purchaseDate, Integer boxQuantity, BigDecimal price) {}
