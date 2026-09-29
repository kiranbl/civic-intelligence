import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, render, screen, fireEvent, within } from '@testing-library/react';
import CitizenDemand from '../src/components/CitizenDemand';
const categories=['WATER','ROADS','HEALTHCARE','EDUCATION','SANITATION','TRANSPORT','ELECTRICITY','OTHER'];
const data={totalRequests:8,categoryBreakdown:categories.map(category=>({category,count:1,percentage:12.5})),
  areaTypeBreakdown:['RURAL','URBAN','UNKNOWN'].map(areaType=>({areaType,count:areaType==='UNKNOWN'?2:3,percentage:areaType==='UNKNOWN'?25:37.5})),
  urgencyBreakdown:['LOW','MEDIUM','HIGH','CRITICAL','UNSPECIFIED'].map(urgency=>({urgency,count:urgency==='HIGH'?4:1,percentage:urgency==='HIGH'?50:12.5})),
  districtBreakdown:[{districtId:1,districtName:'Mandya',totalRequests:8}],recentRequests:[]};
afterEach(cleanup);
test('general demand displays every category, area, urgency, district and prototype context',()=>{
  render(<CitizenDemand data={data} onRetry={vi.fn()}/>);
  expect(screen.getByRole('heading',{name:'Citizen Demand Intelligence'})).toBeTruthy();
  for(const value of categories) expect(screen.getAllByText(value[0]+value.slice(1).toLowerCase()).length).toBeGreaterThan(0);
  for(const title of ['Area type','Urgency','District demand']) expect(screen.getByRole('heading',{name:title})).toBeTruthy();
  const area=screen.getByRole('heading',{name:'Area type'}).parentElement;
  for(const name of ['Urban','Rural','Unknown']) expect(within(area).getByText(name)).toBeTruthy();
  expect(screen.getByText('Mandya')).toBeTruthy();expect(screen.getByText(/Prototype citizen-request dataset/)).toBeTruthy();
  expect(screen.getByText(/does not represent Karnataka/)).toBeTruthy();expect(screen.getByText(/not a district performance score/)).toBeTruthy();
});
test('empty and failed demand remain honest and retryable',()=>{
  const retry=vi.fn();const view=render(<CitizenDemand data={null} onRetry={retry}/>);
  fireEvent.click(screen.getByRole('button',{name:'Retry citizen demand'}));expect(retry).toHaveBeenCalledTimes(1);
  view.rerender(<CitizenDemand data={{...data,totalRequests:0,categoryBreakdown:data.categoryBreakdown.map(r=>({...r,count:0,percentage:0})),districtBreakdown:[]}}/>);
  expect(screen.getByText('No citizen requests yet.')).toBeTruthy();expect(screen.getByText('None yet')).toBeTruthy();
});
