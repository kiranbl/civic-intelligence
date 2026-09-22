# Census 2011 source workbook

Place `2011-IndiaStateDist-0000.xlsx` here without editing it.

- Dataset: Census 2011 - Primary Census Abstract, India/State/District data.
- Publisher: Office of the Registrar General & Census Commissioner, India.
- Official download: https://censusindia.gov.in/nada/index.php/catalog/42557/download/46183/2011-IndiaStateDist-0000.xlsx
- Catalog: https://censusindia.gov.in/nada/index.php/catalog/42557
- Source year: **2011**, not a current population estimate.
- Inspected file size: 1,381,659 bytes (about 1.32 MiB).
- Inspected SHA-256: `acb01ddb965be41cf22a20f0e641fdbcc1f4a16e6b7bc9cf91478ce289f853e8`.

The workbook is modest in size, but a national binary dataset is unnecessary for an eight-row application extract. Keep it external and Git-ignored; track this source documentation and the processed CSV instead. Download manually from the official link, retain the original filename, and optionally check `Get-FileHash` against the checksum above. The importer does not scrape or download anything.

Inspection found `Data` (2,029 rows including one header, 94 columns) and `Record Structure` (96 rows, 4 columns). `State` is a code, not a name. The Karnataka STATE/Total row identifies code `29`. District rows have `Level=DISTRICT`, one row each for `TRU=Total`, `Rural`, and `Urban`, a nonzero three-digit `District` code, and zero `Subdistt`, `Town/Village`, `Ward`, and `EB` codes. `TOT_P` in column K means Total Population (Persons); neither `TOT_M`, `TOT_F`, nor household counts are population totals. The file contains India, state, and district levels and separate Total/Rural/Urban rows. No sub-district, town, or village rows are present in this particular file; the importer explicitly excludes those levels if encountered.

The rural-water refinement reads all three TRU population values from TOT_P, never from household or sex-specific counts. All eight target districts satisfy Rural + Urban = Total exactly. Missing components, duplicates, or failed reconciliation stop the importer without imputation.
