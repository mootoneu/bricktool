package com.bricktools.web;

import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.get;
import static org.springframework.test.web.servlet.request.MockMvcRequestBuilders.post;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.jsonPath;
import static org.springframework.test.web.servlet.result.MockMvcResultMatchers.status;

import com.jayway.jsonpath.JsonPath;
import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import org.junit.jupiter.api.BeforeEach;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;
import org.springframework.beans.factory.annotation.Autowired;
import org.springframework.boot.test.autoconfigure.web.servlet.AutoConfigureMockMvc;
import org.springframework.boot.test.context.SpringBootTest;
import org.springframework.http.MediaType;
import org.springframework.test.context.DynamicPropertyRegistry;
import org.springframework.test.context.DynamicPropertySource;
import org.springframework.test.web.servlet.MockMvc;

@SpringBootTest
@AutoConfigureMockMvc
class PartStorageApiTest {

  @TempDir
  static Path dataDir;

  @DynamicPropertySource
  static void properties(DynamicPropertyRegistry registry) throws IOException {
    registry.add("bricktools.data-dir", () -> dataDir.toString());
    registry.add("bricktools.brickowl.api-key", () -> "");
    Files.createDirectories(dataDir.resolve("bt"));
    Files.createDirectories(dataDir.resolve("re"));
    Files.createDirectories(dataDir.resolve("bo"));
    Files.writeString(dataDir.resolve("re/parts.csv"),
        "part_num,name,part_cat_id,part_material\n"
            + "3001,Brick 2 x 4,11,Plastic\n"
            + "3002,Brick 2 x 3,11,Plastic\n");
    Files.writeString(dataDir.resolve("bt/part_categories.csv"),
        "Id,Name,Group,Hidden\n"
            + "11,Bricks,Brick,false\n");
    Files.writeString(dataDir.resolve("re/colors.csv"),
        "id,name,rgb,is_trans,num_parts,num_sets,y1,y2\n"
            + "1,White,FFFFFF,False,0,0,0,0\n"
            + "5,Red,C91A09,False,0,0,0,0\n");
    Files.writeString(dataDir.resolve("bt/part_color_url.csv"),
        "PartNumber,ColorId,ItemNumber,ImgUrl\n"
            + "3001,5,1,url\n"
            + "3002,1,2,url\n");
    Files.writeString(dataDir.resolve("bt/part_default_color.csv"),
        "PartNumber,ColorId\n"
            + "3001,5\n");
    Files.writeString(dataDir.resolve("bo/orders.csv"),
        "Id,OrderTime,StoreName,StoreUrl,Weight,ShippingTotal,TotalParts,TotalLots,PaidTotal,RefundTotal,Total\n"
            + "42,2026-01-01T10:00:00+01:00,Store,https://store.example,,0,0,0,0,0,0\n");
    Files.writeString(dataDir.resolve("bo/order_items.csv"),
        "OrderId,BOID,DesignIds,ItemNumbers,Condition,Name,Type,Weight,ColorId,ColorName,"
            + "OrderedQuantity,RefundQuantity,Quantity,ItemPrice,TotalPrice\n");
  }

  @Autowired
  MockMvc mvc;

  @BeforeEach
  void cleanMutableFiles() throws IOException {
    Files.deleteIfExists(dataDir.resolve("bt/part_storage.csv"));
    Files.deleteIfExists(dataDir.resolve("bt/part_collection.csv"));
    Files.deleteIfExists(dataDir.resolve("bt/pab_purchases.csv"));
    Files.deleteIfExists(dataDir.resolve("bt/pab_parts.csv"));
    Files.writeString(dataDir.resolve("bo/order_items.csv"),
        "OrderId,BOID,DesignIds,ItemNumbers,Condition,Name,Type,Weight,ColorId,ColorName,"
            + "OrderedQuantity,RefundQuantity,Quantity,ItemPrice,TotalPrice\n");
  }

  @Test
  void storagesAndCollectionRowsCanBeCreatedAndSearched() throws Exception {
    mvc.perform(post("/api/part-storage").contentType(MediaType.APPLICATION_JSON)
            .content("{\"id\":\"A\",\"model\":\"Cabinet\",\"drawersCount\":2,"
                + "\"location\":\"Desk\",\"description\":\"Bricks\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.id").value("A"))
        .andExpect(jsonPath("$.drawersCount").value(2));

    mvc.perform(get("/api/part-storage"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].id").value("A"));

    mvc.perform(post("/api/part-collection").contentType(MediaType.APPLICATION_JSON)
            .content("{\"parts\":\"3001;§Bricks\",\"colors\":\"5;Any\",\"storageId\":\"A\","
                + "\"drawer\":\"A\",\"amount\":\"10\"}"))
        .andExpect(status().isCreated())
        .andExpect(jsonPath("$.index").value(0))
        .andExpect(jsonPath("$.parts").value("3001;§Bricks"));

    mvc.perform(get("/api/part-collection/drawers"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].storageId").value("A"))
        .andExpect(jsonPath("$[0].drawer").value("A"))
        .andExpect(jsonPath("$[0].rows[0].amount").value("10"))
        .andExpect(jsonPath("$[0].rows[0].partChips[0].partNumber").value("3001"))
        .andExpect(jsonPath("$[0].rows[0].categoryChips[0].name").value("Bricks"));

    mvc.perform(get("/api/part-collection/drawers").param("query", "Red"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].drawer").value("A"))
        .andExpect(jsonPath("$[0].matchedParts[0].partNumber").value("3001"));

    mvc.perform(get("/api/part-collection/drawers").param("query", "missing"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$").isEmpty());
  }

  @Test
  void partsCanBeAddedToEveryContainerType() throws Exception {
    mvc.perform(post("/api/part-storage").contentType(MediaType.APPLICATION_JSON)
            .content("{\"id\":\"B\",\"model\":\"Box\",\"drawersCount\":1}"))
        .andExpect(status().isCreated());

    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"drawer\",\"storageId\":\"B\",\"drawer\":\"A\","
                + "\"partNumbers\":[\"3001\",\"3002\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.added").value(2));

    mvc.perform(get("/api/part-collection"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].parts").value("3001"))
        .andExpect(jsonPath("$[1].parts").value("3002"));

    String purchaseBody = mvc.perform(post("/api/pab/purchases").contentType(MediaType.APPLICATION_JSON)
            .content("{\"purchaseDate\":\"2026/02/03\",\"boxQuantity\":1,\"price\":10}"))
        .andExpect(status().isCreated())
        .andReturn().getResponse().getContentAsString();
    int purchaseId = JsonPath.read(purchaseBody, "$.id");

    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"pab\",\"purchaseId\":" + purchaseId
                + ",\"partNumbers\":[\"3001\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.added").value(1));

    mvc.perform(get("/api/pab/purchases/" + purchaseId + "/parts"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].partNumber").value("3001"))
        .andExpect(jsonPath("$[0].partColorId").value(5))
        .andExpect(jsonPath("$[0].quantity").value(1));

    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"brickowl\",\"orderId\":\"42\",\"partNumbers\":[\"3002\"]}"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$.added").value(1));

    mvc.perform(get("/api/brickowl/orders/42/items"))
        .andExpect(status().isOk())
        .andExpect(jsonPath("$[0].DesignIds").value("3002"))
        .andExpect(jsonPath("$[0].Condition").value("Added"))
        .andExpect(jsonPath("$[0].Quantity").value("1"));
  }

  @Test
  void invalidContainerRequestsAreRejected() throws Exception {
    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"drawer\",\"storageId\":\"missing\",\"partNumbers\":[\"3001\"]}"))
        .andExpect(status().isBadRequest());

    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"unknown\",\"partNumbers\":[\"3001\"]}"))
        .andExpect(status().isBadRequest());

    mvc.perform(post("/api/part-collection/add").contentType(MediaType.APPLICATION_JSON)
            .content("{\"type\":\"pab\",\"purchaseId\":999,\"partNumbers\":[\"3001\"]}"))
        .andExpect(status().isBadRequest());
  }
}
