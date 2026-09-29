import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import Home from '../src/pages/Home';
import DistrictDetail from '../src/components/DistrictDetail';
vi.mock('../src/components/DistrictMap', () => ({ default: () => <section>District map (mocked)</section> }));
const districts = ['Bengaluru Rural', 'Kolar', 'Mandya'].map((name, i) => ({ id: i + 1, name, state: 'Karnataka', latitude: null, longitude: null }));
const rows = districts.map((d, i) => ({ districtId: d.id, districtName: d.name, state: d.state, ruralPopulation: 1000 + i, ruralWaterRequestCount: 2 + i, ruralWaterRequestsPer100k: 200, demandIndex: 80 - i * 10, infrastructureGap: 20, ruralFhtcCoverage: 80, priorityScore: 56 - i, priorityLevel: 'HIGH', dataCompleteness: 'COMPLETE' }));
const methodology = { demandWeight: 0.6, infrastructureGapWeight: 0.4, description: 'Prototype relative infrastructure-priority heuristic' };
const history = [
  { id: 101, category: 'WATER', subcategory: 'WATER_SUPPLY_INTERRUPTION', urgency: 'HIGH', areaType: 'RURAL', language: 'en', summaryEnglish: 'Example AI summary', originalText: 'Example text', aiModel: 'mock-model', createdAt: '2026-09-24T00:00:00Z' },
  { id: 102, category: 'WATER', urgency: 'LOW', areaType: 'RURAL', language: 'kn', originalText: '[DEMO ONLY] Synthetic fixture', createdAt: '2026-09-23T00:00:00Z' },
];
function mockApi(failing = '') {
  vi.stubGlobal('fetch', vi.fn(async (url, options) => {
    // Every interaction in this suite must remain read-only.
    expect(options?.method).toBeUndefined();
    if (url.endsWith(failing) && failing) throw new Error('Mock unavailable');
    const data = url.endsWith('/districts') ? districts : url.endsWith('/water-priority') ? rows : url.endsWith('/requests') ? history : [];
    return { ok: true, json: async () => ({ success: true, data, methodology }) };
  }));
}
function detail() { return render(<DistrictDetail district={rows[0]} rows={rows} districts={districts} methodology={methodology} onSelect={vi.fn()} />); }
beforeEach(() => { mockApi(); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

describe('District Intelligence', () => {
  it('ranking selection updates intelligence and loads each selected district history without writes', async () => {
    render(<Home />);
    await screen.findByText('From citizen voices to development intelligence'); fireEvent.click(screen.getByRole('tab', { name: 'Rural Water' })); await screen.findByRole('heading', { name: 'District Intelligence' });
    for (const d of districts) {
      fireEvent.click(screen.getByRole('button', { name: d.name }));
      const panel = screen.getByRole('region', { name: 'District Intelligence' });
      expect(within(panel).getByRole('heading', { name: d.name })).toBeTruthy();
      await waitFor(() => expect(fetch.mock.calls.some(([url]) => url.endsWith(`/districts/${d.id}/requests`))).toBe(true));
    }
  });
  it('uses backend weights and displays selected metrics, source dates and relative normalization', async () => {
    detail();
    expect(screen.getByText(/Prototype rank 1/)).toBeTruthy();
    expect(screen.getByText('2 rural WATER requests')).toBeTruthy();
    expect(screen.getByText(/80.00 × 0.6/)).toBeTruthy();
    expect(screen.getByText('48.00')).toBeTruthy();
    expect(screen.getByText('8.00')).toBeTruthy();
    expect(screen.getByText('Census of India · Reference year: 2011')).toBeTruthy();
    expect(screen.getByText('Jal Jeevan Mission · Snapshot: 21 Sep 2026')).toBeTruthy();
    expect(screen.getByText(/Adding requests to one district/)).toBeTruthy();
    await screen.findByText('Example AI summary');
  });
  it('distinguishes AI provenance from seeded synthetic requests', async () => {
    detail();
    expect(await screen.findByText('AI-processed demonstration request')).toBeTruthy();
    expect(screen.getAllByText('AI-processed demonstration request')).toHaveLength(1);
    expect(screen.getByText('Seeded synthetic demo request')).toBeTruthy();
    expect(screen.getByText(/AI model: mock-model/)).toBeTruthy();
    expect(screen.getByText('[DEMO ONLY] Synthetic fixture')).toBeTruthy();
  });
  it('isolates missing history and can retry an empty history', async () => {
    mockApi('/requests'); detail();
    await screen.findByText(/Request history is unavailable/);
    expect(screen.getByRole('heading', { name: 'Why this district has this score' })).toBeTruthy();
    fetch.mockImplementation(async () => ({ ok: true, json: async () => ({ success: true, data: [] }) }));
    fireEvent.click(screen.getByRole('button', { name: 'Retry request history' }));
    expect(await screen.findByText('No requests recorded for this district.')).toBeTruthy();
  });
  it.each([['/districts', 'Retry districts'], ['/water-priority', 'Retry analytics']])('isolates %s failure', async (path, retry) => {
    mockApi(path); render(<Home />); await screen.findByText('From citizen voices to development intelligence'); fireEvent.click(screen.getByRole('tab', { name: 'Rural Water' }));
    expect(await screen.findByRole('button', { name: retry })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Rural Water Evidence Analysis' })).toBeTruthy();
    if (path === '/districts') expect(screen.getByRole('heading', { name: 'District Intelligence' })).toBeTruthy();
    else { fireEvent.click(screen.getByRole('tab', { name: 'Submit Request' })); expect(screen.getByRole('button', { name: 'Analyze Request' })).toBeTruthy(); }
  });
});
