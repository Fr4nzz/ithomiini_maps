library(flextable)
library(officer)

# ── Table 1: Data sources integrated in Ithomiini Maps ──────────────────────

table1_data <- data.frame(
  `Data Source` = c(
    "Doré et al. (2023)",
    "Sanger Institute",
    "iNaturalist",
    "GBIF (UNAM)",
    "GBIF (Other Institutions)",
    "Total (merged)"
  ),
  Records = c("28,927", "7,265", "19,901", "21,586", "28,182", "105,861"),
  Species = c("387", "513", "252", "35", "428", "849"),
  Subspecies = c("999", "597", "175", "25", "469", "1,380"),
  Genera = c("48", "175", "41", "19", "43", "184"),
  Countries = c("23", "8", "25", "1", "32", "33"),
  check.names = FALSE
)

ft1 <- flextable(table1_data) |>
  set_header_labels(
    Data.Source = "Data Source",
    Records = "Records",
    Species = "Species",
    Subspecies = "Subspecies",
    Genera = "Genera",
    Countries = "Countries"
  ) |>
  border_remove() |>
  hline_top(border = fp_border(color = "black", width = 2), part = "header") |>
  hline_bottom(border = fp_border(color = "black", width = 1), part = "header") |>
  hline_bottom(border = fp_border(color = "black", width = 2), part = "body") |>
  hline(i = 5, border = fp_border(color = "black", width = 0.5), part = "body") |>
  bold(i = 6, part = "body") |>
  font(fontname = "Arial", part = "all") |>
  fontsize(size = 10, part = "all") |>
  bold(part = "header") |>
  align(j = 2:6, align = "center", part = "all") |>
  align(j = 1, align = "left", part = "all") |>
  valign(valign = "top", part = "body") |>
  padding(padding = 5, part = "all") |>
  width(j = 1, width = 2.2) |>
  width(j = 2, width = 0.9) |>
  width(j = 3:6, width = 0.9)

# ── Table 2: Taxonomic curation results ─────────────────────────────────────

table2_data <- data.frame(
  `Curation Basis` = c(
    "Synonym resolution",
    "Typographical error detection",
    "Subspecies synonym resolution",
    "Literature-based correction",
    "Total unique corrected"
  ),
  Species = c("52", "16", "4", "3", "69"),
  Subspecies = c("59", "18", "4", "2", "82"),
  `Records Affected` = c("2,142", "202", "48", "6", "2,398"),
  check.names = FALSE
)

ft2 <- flextable(table2_data) |>
  set_header_labels(
    Curation.Basis = "Curation Basis",
    Species = "Species",
    Subspecies = "Subspecies",
    Records.Affected = "Records Affected"
  ) |>
  border_remove() |>
  hline_top(border = fp_border(color = "black", width = 2), part = "header") |>
  hline_bottom(border = fp_border(color = "black", width = 1), part = "header") |>
  hline_bottom(border = fp_border(color = "black", width = 2), part = "body") |>
  hline(i = 4, border = fp_border(color = "black", width = 0.5), part = "body") |>
  bold(i = 5, part = "body") |>
  font(fontname = "Arial", part = "all") |>
  fontsize(size = 10, part = "all") |>
  bold(part = "header") |>
  align(j = 2:4, align = "center", part = "all") |>
  align(j = 1, align = "left", part = "all") |>
  valign(valign = "top", part = "body") |>
  padding(padding = 5, part = "all") |>
  width(j = 1, width = 2.8) |>
  width(j = 2:3, width = 1.0) |>
  width(j = 4, width = 1.2)

# ── Save to Word ────────────────────────────────────────────────────────────

caption1 <- paste(
  "Table 1. Data sources integrated in Ithomiini Maps.",
  "GBIF data (DOI: https://doi.org/10.15468/dl.pbs3eu)",
  "were pre-filtered for valid coordinates, no geospatial issues,",
  "confirmed presence, and excluding fossils and living specimens."
)

caption2 <- paste(
  "Table 2. Taxonomic curation results.",
  "Curation basis indicates the method used to resolve each",
  "record's taxonomy."
)

doc <- read_docx() |>
  body_add_par(caption1, style = "Normal") |>
  body_add_par("") |>
  body_add_flextable(ft1) |>
  body_add_par("") |>
  body_add_par("") |>
  body_add_par(caption2, style = "Normal") |>
  body_add_par("") |>
  body_add_flextable(ft2)

output_path <- "paper/manuscript_tables.docx"
print(doc, target = output_path)
cat("Saved:", output_path, "\n")
