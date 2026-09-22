// Small synthetic HTML fixtures reproducing the inspected header structure.
// Counts are invented for tests; no raw government export is committed.
const names = ['Bengaluru Urban', 'BENGALURU RURAL', 'Mysuru', 'Mandya', 'TUMAKURU', 'Hassan', 'Kolar', 'RAMANAGARA'];
const escape = value => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const th = (value, attrs = '') => `<th ${attrs}>${escape(value)}</th>`;
const tr = cells => `<tr>${cells.join('')}</tr>`;
const row = values => tr(values.map(value => `<td>${escape(value)}</td>`));

export function jjmFixture(format, { mutateRows = () => {}, date = '21/09/2026', year = '2026-2027', state = 'Karnataka' } = {}) {
  const isJ1 = format === 'J1';
  const rows = names.map((name, i) => isJ1
    ? [i + 1, name, 7, 1, 20, 0, 6, 600, 290, 1, 5]
    : [i + 1, name, 7, 1, 1, 100, 0, 1, 100, 10, 1, 100, 30, 1, 100, 60, 1, 100, 90, 1, 100, 100]);
  mutateRows(rows);
  const first = isJ1
    ? tr([th('S. No.', 'rowspan="2"'), th('District Name', 'rowspan="2"'), th('Total no. of Villages', 'rowspan="2"'), th('Villages without PWS', 'colspan="3"'), th('Villages with PWS', 'colspan="5"')])
    : tr([th('S.No.', 'rowspan="3"'), th('District Name', 'rowspan="3"'), th('Total Habitations as on 01/04/2026', 'rowspan="3"'), th('Non PWS Habitations', 'rowspan="3"'), th('PWS Habitations', 'colspan="18"')]);
  const second = isJ1
    ? tr(['No. of Village', 'No. of households (without Household tap connections)', 'No. of households (with private connections)', 'No. of Village', 'Total No. of households', 'No. of Households with Household tap Connection', 'Number of villages having 100% FHTC', 'Number of villages having < 100% FHTC'].map(v => th(v)))
    : tr(['With FHTC Coverage = 0 %', 'With FHTC Coverage >0 and <25 %', 'With FHTC Coverage >=25 and <50 %', 'With FHTC Coverage >=50 and <75 %', 'With FHTC Coverage >=75 and <100 %', 'With FHTC Coverage >=100 %'].map(v => th(v, 'colspan="3"')));
  const third = isJ1 ? '' : tr(Array.from({ length: 6 }, () => ['Habs', 'House Holds', 'House Connectons']).flat().map(v => th(v)));
  const title = isJ1 ? 'State wise PWS and FHTC Coverage' : `Habitation wise FHTC Coverage( Reported Till ${date})`;
  const parameters = isJ1 ? `State : ${state}, Category : All Districts` : `Financial Year: ${year},State: ${state},District: All District,Category: All Districts`;
  return `<html xmlns:x="urn:schemas-microsoft-com:office:excel"><body><div id="ReportHeading">${title}</div><div>${parameters}</div><div>Format- ${format}</div><table id="tableReportTable">${first}${second}${third}${row(['Total'])}${rows.map(row).join('')}${row(['Total'])}</table></body></html>`;
}
