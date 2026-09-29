import assert from 'node:assert/strict';
import { test } from 'node:test';
import { Readable } from 'node:stream';
import { extractSettlements } from '../scripts/import/settlementRegistry.js';
import { parseCells, rowFragments } from '../scripts/import/settlementWorkbook.js';
const parent = { State:'29', District:'573', Subdistt:'00000', 'Town/Village':'000000', Ward:'0000', EB:'000000', Level:'DISTRICT', Name:'Mandya', TRU:'Total' };
const sub = {...parent,Subdistt:'05547',Level:'SUB-DISTRICT',Name:'Malavalli'};
const village = {...sub,Level:'VILLAGE',Name:'Fixture village',TRU:'Rural','Town/Village':'999001'};
test('Census extraction uses level/type/state and coded parents, not population or patterns',async()=>{
 const result=await extractSettlements([parent,sub,{...village,State:'28'},village,{...village,Level:'WARD',Ward:'0001'}],'RURAL');
 assert.equal(result.records.length,1);assert.equal(result.records[0].censusDistrictName,'Mandya');assert.equal(result.records[0].censusSubDistrictName,'Malavalli');assert.equal(result.records[0].settlementType,'RURAL');
});
test('duplicate rows, contradictory file type, missing parents, ward/EB geography fail',async()=>{
 for(const rows of [[parent,sub,village,village],[parent,sub,{...village,Level:'TOWN',TRU:'Urban'}],[village],[parent,sub,{...village,Ward:'0001'}]]) await assert.rejects(()=>extractSettlements(rows,'RURAL'));
});
test('town aggregate and core rows retain distinct source names and a safe base alias',async()=>{
 const town={...village,Level:'TOWN',TRU:'Urban',Name:'Fixture (CMC + OG)'};
 const result=await extractSettlements([parent,sub,town,{...town,Name:'Fixture (CMC)'}],'URBAN');
 assert.equal(result.records.length,2);assert.deepEqual(result.records[0].aliases,['Fixture']);
});
test('streamed worksheet rows survive arbitrary chunk splits and reject truncation',async()=>{
 const xml='<worksheet><sheetData><row r="1"><c r="B1" t="s"><v>0</v></c><c r="AA1"><v>29</v></c></row></sheetData></worksheet>';
 const result=[];for await(const row of rowFragments(Readable.from([...xml].map(c=>Buffer.from(c)))))result.push(parseCells(row,['State']));
 assert.deepEqual(result,[{B:'State',AA:'29'}]);
 await assert.rejects(async()=>{for await(const row of rowFragments(Readable.from([Buffer.from('<worksheet><row>')])))void row;});
});
