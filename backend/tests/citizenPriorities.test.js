import assert from 'node:assert/strict';
import { test, before, after, afterEach } from 'node:test';
import { once } from 'node:events';
import app from '../src/app.js';
import prisma from '../src/config/prisma.js';
import { summarizeCitizenDemand } from '../src/services/citizenPriorities.service.js';
const categories = ['WATER','ROADS','HEALTHCARE','EDUCATION','SANITATION','TRANSPORT','ELECTRICITY','OTHER'];
const requests = categories.map((category, i) => ({ id:i+1, category, urgency:['LOW','MEDIUM','HIGH','CRITICAL',null][i%5], areaType:['URBAN','RURAL','UNKNOWN'][i%3], createdAt:'2026-09-21T00:00:00Z' }));
const districts = [{id:2,name:'Kolar',requests:requests.slice(4)}, {id:1,name:'Mandya',requests:requests.slice(0,4)}, {id:3,name:'Hassan',requests:[]}];
test('all civic categories and urban/rural/unknown demand count with exact percentages', () => {
  const result=summarizeCitizenDemand(districts);
  assert.equal(result.totalRequests,8);
  assert.deepEqual(result.categoryBreakdown,categories.map(category=>({category,count:1,percentage:12.5})));
  assert.deepEqual(result.areaTypeBreakdown,[{areaType:'RURAL',count:3,percentage:37.5},{areaType:'URBAN',count:3,percentage:37.5},{areaType:'UNKNOWN',count:2,percentage:25}]);
  assert.deepEqual(result.urgencyBreakdown.map(r=>r.count),[2,2,2,1,1]);
  assert.deepEqual(result.districtBreakdown.map(d=>[d.districtId,d.totalRequests]),[[1,4],[2,4],[3,0]]);
  assert.equal(result.districtBreakdown[0].categoryCounts.WATER,1);
  assert.equal(result.districtBreakdown[1].categoryCounts.ELECTRICITY,1);
});
test('ordering is deterministic and recent metadata is limited without private text',()=>{
  const result=summarizeCitizenDemand(districts);
  assert.deepEqual(summarizeCitizenDemand([...districts].reverse()),result);
  assert.deepEqual(result.recentRequests.map(r=>r.id),[8,7,6,5,4]);
  assert.deepEqual(Object.keys(result.recentRequests[0]),['id','districtId','districtName','category','urgency','areaType','createdAt']);
});
test('empty requests preserve zero buckets and avoid nonfinite percentages',()=>{
  for(const input of [[],[{id:1,name:'Mandya',requests:[]}]]) {
    const result=summarizeCitizenDemand(input); assert.equal(result.totalRequests,0); assert.deepEqual(result.recentRequests,[]);
    for(const row of [...result.categoryBreakdown,...result.urgencyBreakdown,...result.areaTypeBreakdown]) {assert.equal(row.count,0);assert.equal(row.percentage,0);}
  }
});
let server,url;const original=prisma.district.findMany;
before(async()=>{server=app.listen(0,'127.0.0.1');await once(server,'listening');url=`http://127.0.0.1:${server.address().port}/api/analytics/citizen-priorities`;});
afterEach(()=>{prisma.district.findMany=original;});
after(async()=>{await new Promise(resolve=>server.close(resolve));await prisma.$disconnect();});
test('read-only endpoint selects only required metadata with no category/area filter',async()=>{
  let query;prisma.district.findMany=async q=>{query=q;return districts;};
  const response=await fetch(url);assert.equal(response.status,200);assert.deepEqual(await response.json(),{success:true,data:summarizeCitizenDemand(districts)});
  assert.equal(query.where,undefined);assert.equal(query.select.requests.where,undefined);
  assert.deepEqual(query.select.requests.select,{id:true,category:true,urgency:true,areaType:true,createdAt:true});
});
test('database errors use controlled central response',async()=>{
  prisma.district.findMany=async()=>{throw Error('PRIVATE_DATABASE_DETAILS');};
  const response=await fetch(url);assert.equal(response.status,500);assert.deepEqual(await response.json(),{success:false,message:'Internal server error'});
});
