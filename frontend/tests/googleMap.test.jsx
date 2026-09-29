import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import DistrictMap from '../src/components/DistrictMap';
import Home from '../src/pages/Home';
import { mapsConfig, loadMaps } from '../src/services/maps';
import { DISTRICT_LOCATIONS } from '../src/config/districtLocations';
vi.mock('../src/services/maps', () => ({ mapsConfig: { key: '', mapId: '' }, loadMaps: vi.fn() }));
const districts = Object.keys(DISTRICT_LOCATIONS).map((name, i) => ({ id: i + 1, name, state: 'Karnataka' }));
const rows = districts.map(d => ({ districtId: d.id, districtName: d.name, priorityLevel: 'HIGH', priorityScore: 55, ruralFhtcCoverage: 80, ruralWaterRequestCount: 2 }));
let markers, panTo, info;
beforeEach(() => {
  markers = []; panTo = vi.fn(); info = { setContent: vi.fn(), open: vi.fn(), close: vi.fn() };
  mapsConfig.key = 'mock'; mapsConfig.mapId = 'mock';
  class Map { fitBounds = vi.fn(); panTo = panTo; setOptions = vi.fn(); addListener = () => ({ remove: vi.fn() }); }
  class Marker { constructor(options) { Object.assign(this, options); markers.push(this); } append(node) { this.node = node; } addListener(_, cb) { this.click = cb; return { remove: vi.fn() }; } }
  loadMaps.mockResolvedValue({ Map, AdvancedMarkerElement: Marker, InfoWindow: class { constructor() { return info; } }, LatLngBounds: class { extend() {} } });
});
afterEach(() => { cleanup(); vi.clearAllMocks(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const view = (selected = 1, onSelect = vi.fn(), locations = DISTRICT_LOCATIONS) => <DistrictMap districts={districts} rows={rows} selected={selected} onSelect={onSelect} locations={locations} />;
test('missing Maps configuration never loads SDK and keeps reference text', () => {
  mapsConfig.key = ''; render(view()); expect(screen.getByText(/Configure the Google Maps browser API key and Map ID/)).toBeTruthy(); expect(loadMaps).not.toHaveBeenCalled();
});
test('missing Map ID is handled without SDK', () => { mapsConfig.mapId = ''; render(view()); expect(loadMaps).not.toHaveBeenCalled(); });
test('eight verified references render and selection updates marker/pan without reloading', async () => {
  const onSelect = vi.fn(); const v = render(view(1, onSelect));
  await waitFor(() => expect(markers).toHaveLength(8));
  expect(Object.values(DISTRICT_LOCATIONS).every(r => r.sourceUrl && r.verifiedAt)).toBe(true);
  expect(markers[2].position).toEqual({ lat: DISTRICT_LOCATIONS.Mysuru.latitude, lng: DISTRICT_LOCATIONS.Mysuru.longitude });
  markers[2].click(); expect(onSelect).toHaveBeenCalledWith(3); expect(info.setContent.mock.calls[0][0].textContent).toContain('JJM coverage: 80.00%');
  v.rerender(view(3, onSelect)); expect(panTo).toHaveBeenCalledWith(markers[2].position); expect(markers[2].node.textContent).toContain('★'); expect(loadMaps).toHaveBeenCalledTimes(1);
  v.unmount(); expect(markers.every(m => m.map === null)).toBe(true);
});
test('map loads with status and fails safely without provider internals', async () => {
  loadMaps.mockRejectedValue(Error('PRIVATE')); render(view()); expect(screen.getByRole('status').textContent).toContain('Loading');
  expect((await screen.findByRole('alert')).textContent).not.toContain('PRIVATE');
});
test('a stalled Maps loader produces a bounded friendly failure', async () => {
  vi.useFakeTimers(); loadMaps.mockReturnValue(new Promise(() => {})); render(view());
  const { act } = await import('@testing-library/react'); await act(async () => vi.advanceTimersByTimeAsync(20000));
  expect(screen.getByRole('alert').textContent).toContain('map could not be loaded');
});
test('missing reference skips only one marker and preserves district naming/provenance', async () => {
  render(view(8, vi.fn(), { ...DISTRICT_LOCATIONS, Mysuru: null }));
  await waitFor(() => expect(markers).toHaveLength(7)); expect(screen.getByText(/Geographic reference unavailable for: Mysuru/)).toBeTruthy();
  expect(screen.getByText(/Bengaluru South \/ Bangalore South/)).toBeTruthy();
  expect(screen.getByText(/not citizen complaint locations, infrastructure project locations, or exact district centroids/)).toBeTruthy();
});
test('Home keeps map to intelligence and ranking to map selection; credit is visible', async () => {
  vi.stubGlobal('fetch', vi.fn(async (url, options) => { expect(options.method).toBeUndefined(); return { ok: true, json: async () => ({ success: true, data: url.endsWith('/districts') ? districts : url.endsWith('/water-priority') ? rows : [], methodology: {} }) }; }));
  render(<Home />); await waitFor(() => expect(markers).toHaveLength(8));
  const { act } = await import('@testing-library/react'); act(() => markers[2].click());
  fireEvent.click(screen.getByRole('tab', { name: 'District Intelligence' })); expect(screen.getByRole('heading', { name: 'Mysuru' })).toBeTruthy();
  fireEvent.click(screen.getByRole('tab', { name: 'Rural Water' })); fireEvent.click(screen.getByRole('button', { name: 'Mandya', exact: true }));
  expect(markers[3].node.textContent).toContain('★');
  expect(screen.getByText('Built by Kiran Bhaskaran Lakshman')).toBeTruthy();
});

