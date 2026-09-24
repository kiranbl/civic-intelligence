import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import { setOptions, importLibrary } from '@googlemaps/js-api-loader';
import DistrictMap from '../src/components/DistrictMap';
import { mapsConfig, resolvePlaceLocation, PLACE_DETAILS_TIMEOUT_MS } from '../src/services/maps';
import { DISTRICT_MAP_REFERENCES, getMapReference, validateMapReferences } from '../src/config/districtMapReferences';

vi.mock('@googlemaps/js-api-loader', () => ({ setOptions: vi.fn(), importLibrary: vi.fn() }));
const districts = ['Bengaluru Rural', 'Mysuru', 'Mandya', 'Ramanagara'].map((name, i) => ({ id: i + 1, name, state: 'Karnataka', latitude: null, longitude: null }));
const references = districts.map(d => ({ districtName: d.name, state: d.state, mapPlaceId: `mock-place-${d.id}`, mapReferenceLabel: d.name + ' headquarters reference' }));
const rows = districts.map(d => ({ districtId: d.id, priorityLevel: 'LOW', priorityScore: 10, ruralFhtcCoverage: 80, ruralWaterRequestCount: 1 }));
let markers, places, failed, panTo, fitBounds, onSelect, mapOptions;
// Deliberately artificial SDK location objects: never saved as district data.
const locations = Object.fromEntries(references.map((r, i) => [r.mapPlaceId, { lat: () => i + 1, lng: () => i + 2 }]));
class Place {
  constructor({ id }) { this.id = id; places.push(this); }
  fetchFields = vi.fn(async ({ fields }) => {
    expect(fields).toEqual(['location']);
    if (failed.has(this.id)) throw new Error('Mock private SDK details');
    this.location = locations[this.id];
  });
}
class Marker {
  constructor(options) { Object.assign(this, options); markers.push(this); }
  append(element) { this.element = element; }
  addEventListener(type, callback) { expect(type).toBe('gmp-click'); this.click = callback; }
  removeEventListener() {}
}
beforeEach(() => {
  markers = []; places = []; failed = new Set(); panTo = vi.fn(); fitBounds = vi.fn(); onSelect = vi.fn();
  mapsConfig.key = 'mock-browser-key'; mapsConfig.mapId = 'mock-map-id';
  vi.stubGlobal('fetch', vi.fn(() => { throw new Error('Real network is forbidden in map tests'); }));
  importLibrary.mockImplementation(async library => {
    if (library === 'maps') return { Map: class { constructor(_, options) { mapOptions = options; } panTo = panTo; fitBounds = fitBounds; } };
    if (library === 'marker') return { AdvancedMarkerElement: Marker };
    if (library === 'places') return { Place };
    if (library === 'core') return { LatLngBounds: class { extend() {} getCenter() { return {}; } } };
    throw new Error('Unexpected library');
  });
});
afterEach(() => { cleanup(); vi.useRealTimers(); vi.unstubAllGlobals(); mapsConfig.key = ''; mapsConfig.mapId = ''; });
function view(selected = 1, refs = references) { return <DistrictMap districts={districts} references={refs} rows={rows} selected={selected} onSelect={onSelect} />; }

test('current v2 loader and Places resolve IDs; markers use the exact runtime location, no storage or API writes', async () => {
  const storage = vi.spyOn(Storage.prototype, 'setItem');
  render(view());
  await waitFor(() => expect(markers).toHaveLength(4));
  expect(setOptions).toHaveBeenCalledWith({ key: 'mock-browser-key', v: 'weekly' });
  expect(importLibrary.mock.calls.map(([name]) => name).sort()).toEqual(['core', 'maps', 'marker', 'places']);
  expect(places.map(p => p.id)).toEqual(references.map(r => r.mapPlaceId));
  markers.forEach((m, i) => expect(m.position).toBe(locations[references[i].mapPlaceId]));
  expect(mapOptions.mapId).toBe('mock-map-id');
  expect(fitBounds).toHaveBeenCalledTimes(1);
  expect(panTo).not.toHaveBeenCalled();
  expect(storage).not.toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled(); storage.mockRestore();
});

test('selection pans without re-resolving Places; marker click selects district and selected style updates', async () => {
  const mounted = render(view());
  await waitFor(() => expect(markers).toHaveLength(4));
  act(() => markers[2].click()); expect(onSelect).toHaveBeenCalledWith(3);
  mounted.rerender(view(3));
  expect(panTo).toHaveBeenLastCalledWith(locations['mock-place-3']);
  expect(markers[2].element.classList.contains('map-selected')).toBe(true);
  expect(markers[0].element.classList.contains('map-selected')).toBe(false);
  expect(places).toHaveLength(4);
  expect(fitBounds).toHaveBeenCalledTimes(1);
  mounted.unmount(); expect(markers.every(m => m.map === null)).toBe(true);
});

test('one failed Place detail does not stop the other markers; retry recovers', async () => {
  failed.add('mock-place-2'); render(view());
  await screen.findByText(/Place details unavailable for: Mysuru/);
  expect(markers).toHaveLength(3);
  expect(screen.queryByText(/Mock private SDK details/)).toBeNull();
  failed.clear(); fireEvent.click(screen.getByRole('button', { name: 'Retry map references' }));
  await waitFor(() => expect(places).toHaveLength(8));
  await waitFor(() => expect(markers.filter(m => m.map)).toHaveLength(4));
});

test('all details failing leaves a graceful disabled view', async () => {
  references.forEach(r => failed.add(r.mapPlaceId)); render(view());
  await screen.findByText('Map unavailable. No district reference locations could be resolved.');
  expect(markers).toHaveLength(0);
});

test('Places library failure is separate from Maps failure', async () => {
  const original = importLibrary.getMockImplementation();
  importLibrary.mockImplementation(name => name === 'places' ? Promise.reject(new Error('Private access error')) : original(name));
  render(view()); await screen.findByText(/Places API is unavailable/);
  expect(markers).toHaveLength(0);
});

test('Google authentication failure removes markers without exposing diagnostics', async () => {
  const previous = window.gm_authFailure;
  const mounted = render(view()); await waitFor(() => expect(markers).toHaveLength(4));
  act(() => window.gm_authFailure());
  expect(screen.getByText(/Google Maps could not be loaded/)).toBeTruthy();
  expect(markers.every(m => m.map === null)).toBe(true);
  mounted.unmount(); expect(window.gm_authFailure).toBe(previous);
});

test('a missing ID skips only that district, never falling back to latitude/longitude', async () => {
  const refs = references.map((r, i) => i === 0 ? { ...r, mapPlaceId: null } : r);
  render(view(1, refs)); await waitFor(() => expect(markers).toHaveLength(3));
  expect(screen.getByText(/Place IDs still needed for: Bengaluru Rural/)).toBeTruthy();
  expect(places.some(p => p.id === 'mock-place-1')).toBe(false);
});

test('Ramanagara keeps dataset name, headquarters label and administrative naming note', async () => {
  render(view(4)); await waitFor(() => expect(markers).toHaveLength(4));
  expect(screen.getByText(/Current administrative name: Bengaluru South \(renamed in 2025\)/)).toBeTruthy();
  expect(screen.getByText('Reference: Ramanagara headquarters reference')).toBeTruthy();
  expect(markers[3].title).toContain('Ramanagara district headquarters reference');
  expect(screen.getByText(/not citizen complaint locations or exact district centroids/)).toBeTruthy();
});

test('unmount while Places is loading does not create markers later', async () => {
  let resolve;
  const original = importLibrary.getMockImplementation();
  importLibrary.mockImplementation(name => name === 'places' ? new Promise(r => { resolve = r; }) : original(name));
  const mounted = render(view()); await waitFor(() => expect(resolve).toBeTypeOf('function'));
  mounted.unmount(); await act(async () => resolve({ Place })); expect(markers).toHaveLength(0);
});

test('Place details timeout is bounded and invalid returned locations are rejected', async () => {
  vi.useFakeTimers();
  class StalledPlace { fetchFields() { return new Promise(() => {}); } }
  const pending = expect(resolvePlaceLocation(StalledPlace, 'mock')).rejects.toThrow('timed out');
  await vi.advanceTimersByTimeAsync(PLACE_DETAILS_TIMEOUT_MS); await pending;
  class EmptyPlace { async fetchFields() {} }
  await expect(resolvePlaceLocation(EmptyPlace, 'mock')).rejects.toThrow('location unavailable');
});

test('mapping contains exactly eight deterministic nullable references without coordinates', () => {
  expect(validateMapReferences(DISTRICT_MAP_REFERENCES)).toBe(DISTRICT_MAP_REFERENCES);
  expect(DISTRICT_MAP_REFERENCES).toHaveLength(8);
  expect(DISTRICT_MAP_REFERENCES.every(r => r.mapPlaceId === null && !('latitude' in r) && !('longitude' in r))).toBe(true);
  expect(getMapReference({ name: 'Mysore', state: 'Karnataka' })).toBeNull();
  expect(getMapReference({ name: 'Mysuru', state: 'Other' })).toBeNull();
});

test('mapping rejects unknown/duplicate districts, duplicate IDs and coordinate storage', () => {
  const changed = patch => DISTRICT_MAP_REFERENCES.map((r, i) => i === 0 ? { ...r, ...patch } : r);
  expect(() => validateMapReferences(changed({ districtName: 'Unknown' }))).toThrow('Unknown');
  expect(() => validateMapReferences(changed({ districtName: 'Bengaluru Rural' }))).toThrow('Duplicate');
  expect(() => validateMapReferences(changed({ latitude: 1 }))).toThrow('Unexpected');
  expect(() => validateMapReferences(DISTRICT_MAP_REFERENCES.map(r => ({ ...r, mapPlaceId: 'same-mock-id' })))).toThrow('Duplicate Place ID');
});
