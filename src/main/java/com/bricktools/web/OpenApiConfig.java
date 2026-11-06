package com.bricktools.web;

import io.swagger.v3.oas.annotations.OpenAPIDefinition;
import io.swagger.v3.oas.annotations.info.Info;
import org.springframework.context.annotation.Configuration;

/**
 * OpenAPI metadata for the Brick Tools REST API.
 * Swagger UI is available at /swagger-ui.html and the specification at /v3/api-docs.
 */
@Configuration
@OpenAPIDefinition(
    info = @Info(
        title = "Brick Tools API",
        version = "0.1.0",
        description = "REST API for the Brick Tools personal Lego collection manager."))
public class OpenApiConfig {
}
