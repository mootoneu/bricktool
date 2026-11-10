package com.bricktools.part;

import java.util.List;

public record MainPartStarsBulkRequest(List<String> partNumbers, Integer stars) {}
