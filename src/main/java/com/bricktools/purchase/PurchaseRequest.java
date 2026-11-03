package com.bricktools.purchase;

import java.math.BigDecimal;

public record PurchaseRequest(
    String setNumber,
    BigDecimal purchasePrice,
    String purchaseDate,
    String vendor,
    String broughtBy,
    String owner,
    Integer partMissings,
    Boolean owned) {}
