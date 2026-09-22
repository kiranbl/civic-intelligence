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

## JJM exports (local, immutable, excluded from Git)

The `jjm/` subdirectory contains two manually supplied official exports. They are HTML documents with `urn:schemas-microsoft-com:office:excel`, despite their `.xls` extensions. Retain the original bytes and filenames. No automated download, scraping, or authenticated API is used.

| File | Bytes | SHA-256 |
| --- | ---: | --- |
| `State wise PWS and FHTC Coverage.xls` | 172584 | `97aec2f6a98d629dc98a7f5d455abfdd75800d40a254583af497ad98ad82d32d` |
| `Habitation wise FHTC Coverage( Reported Till 21_09.xls` | 298832 | `42ad260c0ec9b077c9a4c39dedc12973eaa5d6d3afe8a38122127608a623df51` |

Official J1 report: https://ejalshakti.gov.in/JJM/JJMReports/Physical/Rpt_JJM_VillageWisePWSReport.aspx

For replacement exports, manually open the official JJM reports portal and select Karnataka / All Districts for Format J1 and Format J5. The inspected J1 export's form action is `rpt_JJM_VillageWisePWSReport_D.aspx`; J5's is `JJMRep_FHTCCoverage.aspx`. The importer accepts only the inspected J5 snapshot: Financial Year 2026-2027, Reported Till 21/09/2026. Do not substitute a current download with another date; a new snapshot requires explicit validation and a code/configuration update. The J1 source URL stored in metrics identifies the official report, not an immutable download or independently dated J1 snapshot.

Both exports have one `tableReportTable` table, 31 district rows and repeated state totals. J1 has two header rows and 11 data columns; J5 has three header rows and 22 data columns. J5 has four identifying/count columns followed by six groups of three: Habs, House Holds, House Connectons (source typo retained). Sum only the six household and connection columns for J1 reconciliation; villages and habitations are different units. The exact target spellings match between sources, including uppercase BENGALURU RURAL, TUMAKURU and RAMANAGARA.

The validated eight-district totals reconcile exactly. For this source pair all private-connection counts are zero, and the adopted household denominator is J1 PWS households plus non-PWS unconnected households. This explicit import rule includes non-PWS households; it is not a general rule for exports with private connections. See the project README for calculation, date attribution to J5, boundary limitations and pending real-import status.
