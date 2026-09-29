import { Open } from 'unzipper-esm';
import { Parser } from 'saxen';

function parse(xml, hooks) {
  const parser = new Parser();
  parser.on('error', error => { throw error; });
  for (const [name, callback] of Object.entries(hooks)) parser.on(name, callback);
  parser.parse(xml);
}

export function parseCells(xml, strings) {
  const cells = {}; let cell, tag, value;
  parse(xml, {
    openTag(name, attrs) { tag = name; if (name === 'c') { cell = attrs(); value = ''; } if (name === 'f') throw Error('Formula in Census source'); },
    text(text, decode) { if (tag === 'v' || tag === 't') value += decode(text); },
    closeTag(name) {
      if (name === 'c') {
        const column = cell.r.replace(/\d+$/, '');
        if (cell.t === 's' && strings[Number(value)] === undefined) throw Error('Invalid shared string');
        cells[column] = cell.t === 's' ? strings[Number(value)] : value;
      }
      tag = '';
    },
  });
  return cells;
}

// Stream the inspected worksheet's unprefixed row elements. Never inflate its
// 2.2 GB XML into a single string. Each row is parsed by the XML parser.
export async function* rowFragments(stream) {
  stream.setEncoding('utf8'); let pending = '';
  for await (const chunk of stream) {
    pending += chunk;
    let end;
    while ((end = pending.indexOf('</row>')) !== -1) {
      const start = pending.search(/<row(?:\s|>)/);
      if (start < 0 || start > end) throw Error('Unsupported worksheet row format');
      yield pending.slice(start, end + 6); pending = pending.slice(end + 6);
    }
    if (pending.length > 2 * 1024 * 1024) throw Error('Unsupported oversized worksheet row');
  }
  if (/<row(?:\s|>)/.test(pending) || !pending.includes('</worksheet>')) throw Error('Truncated worksheet');
}

export async function* readSettlementRows(file) {
  const archive = await Open.file(file);
  const entry = path => { const item = archive.files.find(f => f.path === path); if (!item) throw Error(`Missing workbook member ${path}`); return item; };
  const sheets = {}, relationships = {};
  parse((await entry('xl/workbook.xml').buffer()).toString(), { openTag(name, attrs) { if (name === 'sheet') { const a = attrs(); sheets[a.name] = a['r:id']; } } });
  parse((await entry('xl/_rels/workbook.xml.rels').buffer()).toString(), { openTag(name, attrs) { if (name === 'Relationship') { const a = attrs(); relationships[a.Id] = a.Target; } } });
  const sheetPath = name => { const target = relationships[sheets[name]]; if (!/^worksheets\/sheet\d+\.xml$/.test(target || '')) throw Error(`Missing/unsupported sheet ${name}`); return `xl/${target}`; };
  const strings = []; let value = '', inText = false;
  parse((await entry('xl/sharedStrings.xml').buffer()).toString(), {
    openTag(name) { if (name === 'si') value = ''; if (name === 't') inText = true; },
    text(text, decode) { if (inText) value += decode(text); },
    closeTag(name) { if (name === 't') inText = false; if (name === 'si') strings.push(value); },
  });
  const structure = (await entry(sheetPath('Record Structure')).buffer()).toString();
  const firstRow = structure.match(/<row\b[^>]*>[\s\S]*?<\/row>/)?.[0];
  if (!firstRow || !Object.values(parseCells(firstRow, strings)).includes('Census 2011 - Primary Census Abstract - Record Structure')) throw Error('Wrong Census record dictionary');
  let columns;
  const required = ['State', 'District', 'Subdistt', 'Town/Village', 'Ward', 'EB', 'Level', 'Name', 'TRU'];
  for await (const xml of rowFragments(entry(sheetPath('Data')).stream())) {
    if (!columns) {
      const header = parseCells(xml, strings);
      columns = Object.fromEntries(required.map(name => {
        const matches = Object.entries(header).filter(([, value]) => value === name);
        if (matches.length !== 1) throw Error(`Missing/duplicate header ${name}`);
        return [name, matches[0][0]];
      }));
      continue;
    }
    // Parse only named geographic columns, avoiding 95 irrelevant demographic cells per row.
    const geographic = [...xml.matchAll(/<c\b[^>]*\br="([A-Z]+)\d+"[^>]*>[\s\S]*?<\/c>/g)]
      .filter(match => Object.values(columns).includes(match[1])).map(match => match[0]).join('');
    const cells = parseCells(`<row>${geographic}</row>`, strings);
    yield Object.fromEntries(required.map(name => [name, cells[columns[name]]?.trim() ?? '']));
  }
}
