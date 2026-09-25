import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import DistrictMap from '../src/components/DistrictMap';
import Home from '../src/pages/Home';
import { DISTRICT_LOCATIONS, getDistrictLocation } from '../src/config/districtLocations';

const mocked = vi.hoisted(() => ({ panTo: vi.fn(), invalidateSize: vi.fn(), markers: [], containers: [], tiles: [], fail: false }));
vi.mock('react-leaflet', () => ({
  MapContainer: props => { if (mocked.fail) throw new Error('Mock initialization failure'); mocked.containers.push(props); return <div data-testid="map">{props.children}</div>; },
  TileLayer: props => { mocked.tiles.push(props); return <span>Mock tiles — no network</span>; },
  Marker: props => { mocked.markers.push(props); return <div><button aria-label={props.title} onClick={props.eventHandlers.click}>{props.title}</button><div>{props.children}</div></div>; },
  Popup: ({ children }) => <div data-testid="popup">{children}</div>,
  useMap: () => ({ panTo: mocked.panTo, invalidateSize: mocked.invalidateSize, getContainer: () => document.body }),
}));
const districts = Object.keys(DISTRICT_LOCATIONS).map((name, i) => ({ id: i + 1, name, state: 'Karnataka' }));
const rows = districts.map(d => ({ districtId: d.id, districtName: d.name, state: d.state, ruralPopulation: 100000, ruralWaterRequestCount: 2, ruralWaterRequestsPer100k: 2, ruralFhtcCoverage: 80, infrastructureGap: 20, demandIndex: 50, priorityLevel: 'MEDIUM', priorityScore: 35, dataCompleteness: 'COMPLETE' }));
beforeEach(() => { mocked.markers = []; mocked.containers = []; mocked.tiles = []; mocked.fail = false; mocked.panTo.mockReset(); vi.stubGlobal('fetch', vi.fn(() => { throw Error('No external requests in tests'); })); });
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.restoreAllMocks(); });
function view(selected = 1, onSelect = vi.fn(), locations = DISTRICT_LOCATIONS) { return <DistrictMap districts={districts} rows={rows} selected={selected} onSelect={onSelect} locations={locations} />; }

test('all eight references have verified geographic sources, dates and valid coordinates', () => {
  expect(Object.keys(DISTRICT_LOCATIONS)).toEqual(['Bengaluru Urban', 'Bengaluru Rural', 'Mysuru', 'Mandya', 'Tumakuru', 'Hassan', 'Kolar', 'Ramanagara']);
  for (const d of districts) {
    const r = getDistrictLocation(d);
    expect(r).toBeTruthy(); expect(r.sourceUrl).toMatch(/^https:\/\/www.openstreetmap.org\/(node|way|relation)\/\d+$/);
    expect(r.verifiedAt).toBe('2026-09-25'); expect(r.referenceType).toBe('DISTRICT_HEADQUARTERS');
  }
  expect(DISTRICT_LOCATIONS['Bengaluru Rural'].osm).toBe('way/1193268145');
  expect(getDistrictLocation({ name: 'Mysore', state: 'Karnataka' })).toBeNull();
  expect(getDistrictLocation({ name: 'Mysuru', state: 'Other' })).toBeNull();
});

test('renders eight markers using reference coordinates with bounded initial fit and no API key or tile requests', () => {
  render(view()); expect(mocked.markers).toHaveLength(8);
  expect(mocked.containers[0].bounds).toHaveLength(8);
  expect(mocked.containers[0].boundsOptions.maxZoom).toBe(9);
  mocked.markers.forEach((m, i) => expect(m.position).toEqual([DISTRICT_LOCATIONS[districts[i].name].latitude, DISTRICT_LOCATIONS[districts[i].name].longitude]));
  expect(mocked.tiles[0].url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');
  expect(mocked.tiles[0].attribution).toContain('OpenStreetMap');
  expect(screen.getByRole('link', { name: 'OpenStreetMap contributors' })).toBeTruthy();
  expect(fetch).not.toHaveBeenCalled(); expect(mocked.panTo).not.toHaveBeenCalled();
});

test('marker selects a district and external selection pans without zooming', () => {
  const onSelect = vi.fn(); const mounted = render(view(1, onSelect));
  fireEvent.click(screen.getByRole('button', { name: 'Mysuru district reference location' }));
  expect(onSelect).toHaveBeenCalledWith(3);
  mounted.rerender(view(3, onSelect));
  const r = DISTRICT_LOCATIONS.Mysuru;
  expect(mocked.panTo).toHaveBeenLastCalledWith([r.latitude, r.longitude], { animate: false });
  expect(mocked.markers.at(-6).icon.options.className).toContain('reference-selected');
  expect(mocked.markers.at(-6).icon.options.html).toContain('★');
});

test('popups include district intelligence and reference-only language', () => {
  render(view()); const popup = within(screen.getAllByTestId('popup')[1]);
  expect(popup.getByText('Bengaluru Rural')).toBeTruthy();
  expect(popup.getByText(/Devanahalli DC Office administrative reference/)).toBeTruthy();
  expect(popup.getByText('District reference location')).toBeTruthy();
  expect(popup.getByText('MEDIUM')).toBeTruthy();
  expect(popup.getByText(/35.00/)).toBeTruthy();
  expect(popup.getByText(/80.00%.*Rural WATER requests: 2/)).toBeTruthy();
  expect(screen.getByText(/They are not citizen complaint locations, infrastructure project locations, or exact district centroids/)).toBeTruthy();
});

test('Ramanagara retains its name and current administrative naming note', () => {
  render(view(8));
  const panel = within(screen.getByLabelText('Selected district map reference'));
  expect(panel.getByText('Ramanagara')).toBeTruthy();
  expect(panel.getByText(/Bengaluru South \/ Bangalore South/)).toBeTruthy();
});

test('missing/invalid reference omits only that marker', () => {
  render(view(2, vi.fn(), { ...DISTRICT_LOCATIONS, 'Bengaluru Rural': { latitude: null, longitude: 77 } }));
  expect(mocked.markers).toHaveLength(7);
  expect(screen.getByText(/Geographic reference unavailable for: Bengaluru Rural/)).toBeTruthy();
});

test('no available references leaves a graceful supplementary map state', () => {
  render(view(1, vi.fn(), {}));
  expect(screen.getByText('Map unavailable. No verified district reference locations are available.')).toBeTruthy();
  expect(mocked.markers).toHaveLength(0);
});

test('initialization failure stays within map boundary', () => {
  mocked.fail = true; vi.spyOn(console, 'error').mockImplementation(() => {});
  render(view()); expect(screen.getByRole('alert').textContent).toContain('District Intelligence and the ranking remain available');
  expect(screen.getByLabelText('Selected district map reference')).toBeTruthy();
});

test('tile failure shows a friendly notice without removing markers', () => {
  render(view()); fireEvent.click(screen.getByRole('button', { name: 'Mysuru district reference location' }));
  // Trigger only the mocked Leaflet event; no external tile calls.
  const handler = mocked.tiles[0].eventHandlers.tileerror;
  fireEvent(window, new Event('mock-tile-error'));
  // React batches the event through a test button.
  const helper = render(<button onClick={handler}>Simulate tile failure</button>);
  fireEvent.click(screen.getByText('Simulate tile failure'));
  expect(screen.getByRole('status').textContent).toContain('Some map tiles could not be loaded');
  expect(screen.getAllByTestId('popup')).toHaveLength(8); helper.unmount();
});

test('Home synchronizes marker -> District Intelligence and ranking -> map; GET only', async () => {
  fetch.mockImplementation(async (url, options) => {
    expect(options.method).toBeUndefined();
    return { ok: true, json: async () => ({ success: true, data: url.endsWith('/districts') ? districts : url.endsWith('/water-priority') ? rows : [], methodology: { demandWeight: .5, infrastructureGapWeight: .5 } }) };
  });
  render(<Home />);
  fireEvent.click(await screen.findByRole('button', { name: 'Mysuru district reference location' }));
  expect(screen.getByRole('heading', { name: 'Mysuru' })).toBeTruthy();
  fireEvent.click(screen.getByRole('button', { name: 'Mandya', exact: true }));
  await waitFor(() => expect(screen.getByRole('heading', { name: 'Mandya' })).toBeTruthy());
  expect(screen.getByRole('button', { name: 'Mandya district reference location' })).toBeTruthy();
  expect(mocked.panTo).toHaveBeenLastCalledWith([DISTRICT_LOCATIONS.Mandya.latitude, DISTRICT_LOCATIONS.Mandya.longitude], { animate: false });
});
