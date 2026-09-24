import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CitizenRequestForm from '../src/components/CitizenRequestForm';
import Home from '../src/pages/Home';

const districts = [{ id: 2, name: 'Bengaluru Rural', state: 'Karnataka' }, { id: 7, name: 'Kolar', state: 'Karnataka' }];
const analysis = { language: 'en', category: 'WATER', subcategory: 'WATER_SUPPLY_INTERRUPTION', urgency: 'HIGH', areaType: 'RURAL', summaryEnglish: 'Village water supply is interrupted.', locationText: null, confidence: 0.95, model: 'gemini-3.6-flash' };
const final = { ...analysis, id: 123, districtId: 2, urgency: 'MEDIUM', aiModel: 'gemini-3.5-flash-lite', aiConfidence: .9 };
delete final.model; delete final.confidence;
let calls, onSubmitted;
const response = (data, status = 200) => ({ ok: status < 400, status, json: async () => ({ success: status < 400, data }) });
beforeEach(() => {
  calls = []; onSubmitted = vi.fn();
  vi.stubGlobal('fetch', vi.fn(async (url, options = {}) => {
    calls.push({ url, options });
    if (url.endsWith('/citizen-requests/analyze')) return response(analysis);
    if (url.endsWith('/citizen-requests')) return response(final, 201);
    throw Error('Unexpected HTTP call');
  }));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });
function mount() { render(<CitizenRequestForm districts={districts} onSubmitted={onSubmitted} />); }
async function enter() {
  fireEvent.change(screen.getByRole('combobox', { name: /District/ }), { target: { value: '2' } });
  fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Village water has stopped.' } });
}
async function preview() { await enter(); fireEvent.click(screen.getByRole('button', { name: 'Analyze Request' })); await screen.findByRole('heading', { name: 'AI Interpretation' }); }
test('districts populate with explicit selection; empty and whitespace text blocked', async () => {
  mount(); expect(screen.getByRole('option', { name: 'Kolar · Karnataka' })).toBeTruthy();
  expect(screen.getByRole('combobox', { name: /District/ }).value).toBe('');
  expect(screen.getByRole('button', { name: 'Analyze Request' }).disabled).toBe(true);
  await enter(); fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: '  ' } });
  expect(screen.getByRole('button', { name: 'Analyze Request' }).disabled).toBe(true); expect(calls).toHaveLength(0);
});
test('analyze sends only text and shows preview/null location with zero creates', async () => {
  mount(); await preview(); expect(calls).toHaveLength(1);
  expect(calls[0].url.endsWith('/citizen-requests/analyze')).toBe(true);
  expect(JSON.parse(calls[0].options.body)).toEqual({ text: 'Village water has stopped.' });
  expect(screen.getByText('No specific location mentioned')).toBeTruthy(); expect(screen.getByText('gemini-3.6-flash')).toBeTruthy(); expect(onSubmitted).not.toHaveBeenCalled();
});
test('text changes invalidate preview and require reanalysis', async () => {
  mount(); await preview(); fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Different water problem' } });
  expect(screen.queryByRole('button', { name: 'Submit Request' })).toBeNull(); expect(screen.queryByRole('heading', { name: 'AI Interpretation' })).toBeNull();
});
test('submit uses exact reviewed text and latest district, not preview metadata; shows final differences', async () => {
  mount(); await preview(); fireEvent.change(screen.getByRole('combobox', { name: /District/ }), { target: { value: '7' } });
  fireEvent.click(screen.getByRole('button', { name: 'Submit Request' })); await screen.findByText('Request submitted successfully');
  expect(JSON.parse(calls[1].options.body)).toEqual({ districtId: 7, text: 'Village water has stopped.', channel: 'TEXT' });
  expect(calls).toHaveLength(2); expect(onSubmitted).toHaveBeenCalledTimes(1);
  expect(screen.getByText(/Request #123 · Kolar/)).toBeTruthy(); expect(screen.getByText(/stored result differs/)).toBeTruthy();
  expect(screen.queryByRole('button', { name: 'Submit Request' })).toBeNull();
});
for (const language of ['English', 'Kannada', 'Hindi']) test(`${language} example only populates text`, () => {
  mount(); fireEvent.click(screen.getByRole('button', { name: language })); expect(screen.getByLabelText(/Request text/).value.length).toBeGreaterThan(20); expect(calls).toHaveLength(0);
});
for (const status of [400, 404, 429, 503, 502, 500]) test(`HTTP ${status} is safe with manual retry only`, async () => {
  fetch.mockResolvedValue(response({ message: 'PRIVATE DATABASE OR SDK ERROR' }, status)); mount(); await enter();
  fireEvent.click(screen.getByRole('button', { name: 'Analyze Request' })); const alert = await screen.findByRole('alert');
  expect(alert.textContent).not.toContain('PRIVATE'); if (status === 503 || status === 429) expect(alert.textContent).toContain('temporarily busy');
  expect(fetch).toHaveBeenCalledTimes(1);
});
test('unreachable backend is safe', async () => {
  fetch.mockRejectedValue(Error('PRIVATE STACK')); mount(); await enter(); fireEvent.click(screen.getByRole('button', { name: 'Analyze Request' }));
  expect((await screen.findByRole('alert')).textContent).toContain('Could not reach the backend');
});
test('pending analysis prevents duplicate calls', async () => {
  let resolve; fetch.mockReturnValue(new Promise(r => { resolve = r; })); mount(); await enter(); const button = screen.getByRole('button', { name: 'Analyze Request' });
  fireEvent.click(button); fireEvent.click(button); expect(fetch).toHaveBeenCalledTimes(1); expect(button.matches(':disabled')).toBe(true);
  resolve(response(analysis)); await screen.findByRole('heading', { name: 'AI Interpretation' });
});
test('ambiguous create failure warns against duplicates and does not refresh or retry automatically', async () => {
  mount(); await preview(); fetch.mockRejectedValue(Error('network')); fireEvent.click(screen.getByRole('button', { name: 'Submit Request' }));
  expect((await screen.findByRole('alert')).textContent).toContain('avoid a duplicate'); expect(onSubmitted).not.toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(2);
});
test('successful create refreshes dashboard count and analytics without losing success', async () => {
  let created = false; const hits = [];
  fetch.mockImplementation(async (url, options = {}) => {
    hits.push(url);
    if (url.endsWith('/analyze')) return response(analysis);
    if (options.method === 'POST') { created = true; return response(final, 201); }
    if (url.endsWith('/districts')) return response([districts[0]]);
    if (url.endsWith('/requests')) return response(created ? [{id:1},{id:123}] : [{id:1}]);
    if (url.endsWith('/water-priority')) return { ok:true, json:async()=>({success:true,data:[{districtId:2,districtName:'Bengaluru Rural',state:'Karnataka',ruralPopulation:1000,ruralWaterRequestCount:created?2:1,ruralWaterRequestsPer100k:created?200:100,ruralFhtcCoverage:50,infrastructureGap:50,demandIndex:100,priorityScore:created?75:60,priorityLevel:created?'VERY_HIGH':'HIGH',dataCompleteness:'COMPLETE'}],methodology:{demandWeight:.5,infrastructureGapWeight:.5}}) };
    return response([]);
  });
  render(<Home />); await screen.findByRole('combobox', { name: /District/ }); await preview(); fireEvent.click(screen.getByRole('button',{name:'Submit Request'})); await screen.findByText('Request submitted successfully');
  await waitFor(() => expect(document.querySelector('.priority-score').textContent).toBe('75.00'));
  expect(document.querySelectorAll('.summary-card strong')[1].textContent).toBe('2');
  expect(hits.filter(u=>u.endsWith('/water-priority'))).toHaveLength(2);
  expect(hits.filter(u=>u.endsWith('/requests'))).toHaveLength(2);
});
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

test('frontend source contains no embedded API key or database credentials', () => {
  function scan(directory) {
    return readdirSync(directory, { withFileTypes: true }).flatMap(entry => entry.isDirectory() ? scan(join(directory, entry.name)) : [readFileSync(join(directory, entry.name), 'utf8')]);
  }
  const source = scan('src').join('\n');
  expect(source).not.toMatch(/AIza[\w-]{30,}|mysql:\/\/|GEMINI_API_KEY|DATABASE_URL/);
});
test('pending create prevents duplicate saves', async () => {
  mount(); await preview(); let resolve;
  fetch.mockReturnValue(new Promise(r => { resolve = r; })); const button = screen.getByRole('button', { name: 'Submit Request' });
  fireEvent.click(button); fireEvent.click(button); expect(fetch).toHaveBeenCalledTimes(2); expect(button.disabled).toBe(true);
  resolve(response(final, 201)); await screen.findByText('Request submitted successfully'); expect(onSubmitted).toHaveBeenCalledTimes(1);
});
