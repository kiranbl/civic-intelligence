import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import DistrictMap from '../src/components/DistrictMap';
import Home from '../src/pages/Home';
import { DISTRICT_LOCATIONS } from '../src/config/districtLocations';
const state = vi.hoisted(() => ({ map: { fitBounds: vi.fn(), panTo: vi.fn(), invalidateSize: vi.fn(), getContainer: () => document.body }, tiles: null }));
vi.mock('react-leaflet', () => ({
 MapContainer: ({children}) => <div data-testid="leaflet-map">{children}</div>,
 TileLayer: props => { state.tiles=props; return null; },
 Marker: ({children,title,eventHandlers,position,icon}) => <div><button title={title} data-position={JSON.stringify(position)} data-icon={icon.options.html} onClick={eventHandlers.click}>{title}</button>{children}</div>,
 Popup: ({children}) => <div>{children}</div>, Tooltip: ({children}) => <span>{children}</span>, useMap: () => state.map,
}));
const districts=Object.keys(DISTRICT_LOCATIONS).map((name,i)=>({id:i+1,name,state:'Karnataka'}));
const rows=districts.map(d=>({districtId:d.id,districtName:d.name,priorityLevel:'HIGH',priorityScore:55,ruralFhtcCoverage:80,ruralWaterRequestCount:2}));
beforeEach(()=>{vi.stubGlobal('requestAnimationFrame',fn=>{fn();return 1;});vi.stubGlobal('cancelAnimationFrame',vi.fn());});
afterEach(()=>{cleanup();vi.clearAllMocks();vi.unstubAllGlobals();});
const view=(selected=1,onSelect=vi.fn(),viewKey=0,locations=DISTRICT_LOCATIONS)=><DistrictMap districts={districts} rows={rows} selected={selected} onSelect={onSelect} viewKey={viewKey} locations={locations}/>;
test('eight verified references and OSM attribution render without keys or tile requests',()=>{
 render(view());expect(screen.getAllByRole('button')).toHaveLength(8);expect(state.map.fitBounds).toHaveBeenCalledWith(districts.map(d=>[DISTRICT_LOCATIONS[d.name].latitude,DISTRICT_LOCATIONS[d.name].longitude]),{padding:[32,32],maxZoom:9,animate:false});
 expect(state.tiles.url).toBe('https://tile.openstreetmap.org/{z}/{x}/{y}.png');expect(screen.getByRole('link',{name:'OpenStreetMap contributors'}).href).toBe('https://www.openstreetmap.org/copyright');expect(state.map.panTo).not.toHaveBeenCalled();
});
test('selection pans without zoom, styles selected marker and marker forwards selection',()=>{
 const select=vi.fn(),v=render(view(1,select));fireEvent.click(screen.getByTitle('Mysuru district reference location'));expect(select).toHaveBeenCalledWith(3);
 v.rerender(view(3,select));expect(state.map.panTo).toHaveBeenCalledWith([DISTRICT_LOCATIONS.Mysuru.latitude,DISTRICT_LOCATIONS.Mysuru.longitude],{animate:false});expect(screen.getByTitle('Mysuru district reference location').dataset.icon).toContain('reference-selected');expect(state.map.fitBounds).toHaveBeenCalledTimes(1);
});
test('tab transitions and viewport resize invalidate size, with cleanup',()=>{
 let callback;const disconnect=vi.fn();vi.stubGlobal('ResizeObserver',class{constructor(fn){callback=fn;}observe(){}disconnect=disconnect;});
 const v=render(view());state.map.invalidateSize.mockClear();v.rerender(view(1,vi.fn(),3));expect(state.map.invalidateSize).toHaveBeenCalled();state.map.invalidateSize.mockClear();v.rerender(view(1,vi.fn(),0));expect(state.map.invalidateSize).toHaveBeenCalled();act(()=>callback());fireEvent(window,new Event('resize'));expect(state.map.invalidateSize.mock.calls.length).toBeGreaterThan(2);v.unmount();expect(disconnect).toHaveBeenCalled();state.map.invalidateSize.mockClear();fireEvent(window,new Event('resize'));expect(state.map.invalidateSize).not.toHaveBeenCalled();
});
test('missing references and tile errors preserve usable district context',()=>{
 render(view(8,vi.fn(),0,{...DISTRICT_LOCATIONS,Mysuru:null}));expect(screen.getAllByRole('button')).toHaveLength(7);expect(screen.getByText(/Geographic reference unavailable for: Mysuru/)).toBeTruthy();expect(screen.getAllByText(/Bengaluru South/).length).toBeGreaterThan(0);act(()=>state.tiles.eventHandlers.tileerror());expect(screen.getByRole('status').textContent).toContain('District references and selection remain available');
});
test('Home retains marker to intelligence and ranking to map synchronization',async()=>{
 vi.stubGlobal('fetch',vi.fn(async(url,options)=>{expect(options.method).toBeUndefined();return{ok:true,json:async()=>({success:true,data:url.endsWith('/districts')?districts:url.endsWith('/water-priority')?rows:[],methodology:{}})};}));
 render(<Home/>);await screen.findByTitle('Mysuru district reference location');fireEvent.click(screen.getByTitle('Mysuru district reference location'));fireEvent.click(screen.getByRole('tab',{name:'District Intelligence'}));expect(screen.getByRole('heading',{name:'Mysuru'})).toBeTruthy();fireEvent.click(screen.getByRole('tab',{name:'Rural Water'}));fireEvent.click(screen.getByRole('button',{name:'Mandya',exact:true}));expect(screen.getByTitle('Mandya district reference location').dataset.icon).toContain('reference-selected');
});
