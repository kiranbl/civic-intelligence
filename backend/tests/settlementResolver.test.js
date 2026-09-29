import assert from 'node:assert/strict';
import { test } from 'node:test';
import { readFileSync } from 'node:fs';
import { buildSettlementResolver } from '../src/services/settlementResolver.service.js';
import { normalizeSettlementName } from '../src/config/settlementNames.js';
const registry=JSON.parse(readFileSync(new URL('../data/processed/census2011-karnataka-settlements.json',import.meta.url)));
const resolve=buildSettlementResolver(registry);
const classify=(locationText,district,areaType='UNKNOWN')=>resolve({areaType,locationText},{name:district,state:'Karnataka'}).areaType;
for(const [district,town,village] of [['Mandya','Hongalli','Madapuranala'],['Mysuru','Elwala','K. Basavanahalli'],['Hassan','Satyamangala','Hirimande'],['Belagavi','Kakati','Hadnal'],['Kalaburagi','Kurgunta','Jamga Khandala']]) test(`official ${district} town and village resolve`,()=>{
 assert.equal(classify(town,district),'URBAN');assert.equal(classify(village,district),'RURAL');
});
test('registry has complete historical Karnataka coverage and valid provenance',()=>{
 assert.equal(registry.sourceYear,2011);assert.equal(registry.source,'Census of India 2011 PCA');assert.equal(registry.districts.length,30);
 assert.equal(registry.records.filter(r=>r.settlementType==='RURAL').length,29340);
 assert.equal(registry.records.filter(r=>r.settlementType==='URBAN').length,371);
 assert(registry.records.every(r=>r.censusStateCode==='29'&&r.normalizedSettlementName===normalizeSettlementName(r.canonicalSettlementName)));
});
test('municipal overrides are district-scoped, exact and never override explicit AI',()=>{
 for(const place of ['Uttarahalli','Jayanagar']) {
  assert.equal(classify(place,'Bengaluru Urban'),'URBAN');assert.equal(classify(place,'Bangalore'),'URBAN');
  assert.equal(classify(place,'Kolar'),'UNKNOWN');assert.equal(classify(place,'Bengaluru Urban','RURAL'),'RURAL');
 }
 assert.equal(classify('near Uttarahalli','Bengaluru Urban'),'UNKNOWN');
 assert.equal(classify('Unlisted locality','Mandya','URBAN'),'URBAN');
});
test('Unicode, whitespace and punctuation normalize; no authoritative transliteration',()=>{
 assert.equal(classify('  Ｊａｙａｎａｇａｒ！ ','Bengaluru Urban'),'URBAN');
 assert.equal(classify('k.   basavanahalli','Mysore'),'RURAL');
 for(const name of ['ಉತ್ತರಹಳ್ಳಿ','उत्तरहल्ली','Unlisted locality']) assert.equal(classify(name,'Bengaluru Urban'),'UNKNOWN');
 assert.equal(normalizeSettlementName('Cafe\u0301'),normalizeSettlementName('Café'));
});
test('wrong district, missing context and Vijayanagara do not guess geography',()=>{
 assert.equal(classify('Jamga Khandala','Mandya'),'UNKNOWN');
 assert.equal(classify('Hospet','Vijayanagara'),'UNKNOWN');
 assert.equal(resolve({areaType:'UNKNOWN',locationText:'Jayanagar'},null).areaType,'UNKNOWN');
 assert.equal(resolve({areaType:'UNKNOWN',locationText:'Jayanagar'},{name:'Bangalore',state:'Other'}).areaType,'UNKNOWN');
});
test('distinct same-type codes reach type consensus, same code variants are one identity',()=>{
 const example={censusDistrictCode:'573',normalizedSettlementName:'fixture',settlementCode:'1',settlementType:'URBAN'};
 const make=records=>buildSettlementResolver({districts:[{code:'573',name:'Mandya'}],records});
 const input={areaType:'UNKNOWN',locationText:'Fixture'},district={name:'Mandya',state:'Karnataka'};
 assert.equal(make([example,{...example,settlementCode:'2'}])(input,district).areaType,'URBAN');
 assert.equal(make([example,{...example}])(input,district).areaType,'URBAN');
 assert.equal(classify('Mysore','Mysuru'),'URBAN');
});

test('real Census duplicate villages reach consensus; mixed types remain UNKNOWN',()=>{
 assert.equal(classify('Gondihalli','Mandya'),'RURAL');
 assert.equal(classify('Haralahalli','Hassan'),'UNKNOWN');
 assert.equal(classify('Haralahalli (CT)','Hassan'),'URBAN');
});

for (const [locationText, locationTextLatin, expected] of [
 ['Byrasandra', undefined, 'RURAL'], ['ಬೈರಸಂದ್ರ', 'Bairasandra', 'RURAL'], ['Bairasandra', undefined, 'RURAL'],
 ['Malur', undefined, 'URBAN'], ['ಮಾಲೂರು', 'Malur', 'URBAN'], ['मालूर', 'Malur', 'URBAN'],
 ['CompletelyFakeSettlementName', undefined, 'UNKNOWN'], ['Xyrasandra', undefined, 'UNKNOWN'],
]) test(`district-scoped multilingual matching: ${locationText}`, () => {
 assert.equal(resolve({areaType:'UNKNOWN',locationText,locationTextLatin},{name:'Kolar',state:'Karnataka'}).areaType,expected);
});
test('explain exact, fuzzy, explicit and municipal precedence without exposing diagnostics',()=>{
 const district={name:'Kolar',state:'Karnataka'};
 const input={areaType:'UNKNOWN',locationText:'Bairasandra'};
 const info=resolve.explain(input,district);
 assert.equal(info.areaType,'RURAL');assert(info.similarityScore>=.8);assert(info.candidateCount>=1);
 assert.equal('method' in resolve(input,district),false);
 assert.equal(resolve.explain({...input,locationText:'Byrasandra'},district).similarityScore,null);
 assert.equal(resolve.explain({...input,areaType:'URBAN'},district).method,'AI_EXPLICIT');
 assert.equal(resolve.explain({...input,locationText:'Jayanagar'},{name:'Bengaluru Urban',state:'Karnataka'}).method,'MUNICIPAL_OVERRIDE');
});
test('synthetic candidates enforce district boundary, duplicates, mixed types and margin',()=>{
 const row=(code,name,type='RURAL',district='581')=>({censusDistrictCode:district,settlementCode:code,canonicalSettlementName:name,settlementType:type,aliases:[]});
 const district={name:'Kolar',state:'Karnataka'}, input={areaType:'UNKNOWN',locationText:'Bairasandra'};
 const make=records=>buildSettlementResolver({districts:[{code:'581',name:'Kolar'},{code:'572',name:'Other'}],records});
 assert.equal(make([row('1','Byrasandra','RURAL','572')])(input,district).areaType,'UNKNOWN');
 let resolver=make([row('1','Byrasandra'),row('2','Byrasandra')]);
 let info=resolver.explain(input,district);assert.equal(info.method,'CENSUS_TYPE_CONSENSUS');assert.equal(info.areaType,'RURAL');assert.equal(info.matchedSettlementCode,null);assert.equal(info.candidateCount,2);
 resolver=make([row('1','Byrasandra'),row('2','Byrasandra','URBAN')]);assert.equal(resolver(input,district).areaType,'UNKNOWN');
 resolver=make([row('1','Bairasandra','URBAN'),row('2','Byrasandra')]);assert.equal(resolver.explain(input,district).method,'CENSUS_EXACT');assert.equal(resolver(input,district).areaType,'URBAN');
 resolver=make([row('1','Byrasandra')]);info=resolver.explain(input,district);assert.equal(info.method,'CENSUS_FUZZY');assert.equal(info.matchedSettlementCode,'1');
 assert.equal(resolver({...input,locationText:'Bai ra-sandra'},district).areaType,'RURAL');
 assert.equal(make([row('1','Malur')])({...input,locationText:'Malor'},district).areaType,'UNKNOWN');
 // Near ties of different types fail closed even if a runner is just below threshold.
 resolver=make([row('1','abcdefghxy','RURAL'),row('2','abcdefgxy','URBAN')]);
 assert.equal(resolver({...input,locationText:'abcdefgh'},district).areaType,'UNKNOWN');
});
