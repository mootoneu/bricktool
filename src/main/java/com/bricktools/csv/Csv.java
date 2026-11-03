package com.bricktools.csv;

import java.io.IOException;
import java.io.Reader;
import java.io.Writer;
import java.nio.charset.StandardCharsets;
import java.nio.file.Files;
import java.nio.file.Path;
import java.nio.file.StandardCopyOption;
import java.util.ArrayList;
import java.util.List;
import java.util.Map;
import org.apache.commons.csv.CSVFormat;
import org.apache.commons.csv.CSVParser;
import org.apache.commons.csv.CSVPrinter;
import org.apache.commons.csv.CSVRecord;

public final class Csv {

  private Csv() {}

  public static List<Map<String, String>> read(Path file) throws IOException {
    if (!Files.exists(file)) {
      return new ArrayList<>();
    }
    try (Reader reader = Files.newBufferedReader(file, StandardCharsets.UTF_8);
         CSVParser parser = CSVFormat.DEFAULT.builder().setHeader().setSkipHeaderRecord(true).build().parse(reader)) {
      List<Map<String, String>> rows = new ArrayList<>();
      for (CSVRecord record : parser) {
        rows.add(record.toMap());
      }
      return rows;
    }
  }

  public static void write(Path file, List<String> headers, List<Map<String, String>> rows) throws IOException {
    Files.createDirectories(file.toAbsolutePath().getParent());
    Path tmp = file.resolveSibling(file.getFileName() + ".tmp");
    try (Writer writer = Files.newBufferedWriter(tmp, StandardCharsets.UTF_8);
         CSVPrinter printer = new CSVPrinter(writer,
             CSVFormat.DEFAULT.builder().setHeader(headers.toArray(String[]::new)).build())) {
      for (Map<String, String> row : rows) {
        printer.printRecord(headers.stream().map(h -> row.getOrDefault(h, "")).toList());
      }
    }
    Files.move(tmp, file, StandardCopyOption.REPLACE_EXISTING);
  }
}
