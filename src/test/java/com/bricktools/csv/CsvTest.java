package com.bricktools.csv;

import static org.assertj.core.api.Assertions.assertThat;

import java.io.IOException;
import java.nio.file.Files;
import java.nio.file.Path;
import java.util.List;
import java.util.Map;
import org.junit.jupiter.api.Test;
import org.junit.jupiter.api.io.TempDir;

class CsvTest {

  @TempDir
  Path dir;

  @Test
  void roundTripsValuesContainingSeparatorsAndQuotes() throws IOException {
    Path file = dir.resolve("nested/data.csv");
    Map<String, String> row = Map.of("A", "hello, world", "B", "say \"hi\"");

    Csv.write(file, List.of("A", "B"), List.of(row));

    assertThat(Csv.read(file)).containsExactly(row);
  }

  @Test
  void missingFileReadsAsEmptyList() throws IOException {
    assertThat(Csv.read(dir.resolve("absent.csv"))).isEmpty();
  }

  @Test
  void missingValuesAreWrittenAsEmptyStrings() throws IOException {
    Path file = dir.resolve("partial.csv");

    Csv.write(file, List.of("A", "B"), List.of(Map.of("A", "1")));

    assertThat(Csv.read(file)).containsExactly(Map.of("A", "1", "B", ""));
  }

  @Test
  void headerIsWrittenEvenWithoutRows() throws IOException {
    Path file = dir.resolve("empty.csv");

    Csv.write(file, List.of("Id", "Name"), List.of());

    assertThat(Files.readString(file).trim()).isEqualTo("Id,Name");
    assertThat(Csv.read(file)).isEmpty();
  }
}
