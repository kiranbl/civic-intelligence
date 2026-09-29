import { afterEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import Home from '../src/pages/Home';
import { loadDashboard } from '../src/services/api';
vi.mock('../src/services/api', () => ({ loadDashboard: vi.fn(), getDistrictRequests: vi.fn(async () => []), getWaterPlanning: vi.fn(async () => []), analyzeRequest: vi.fn(async () => ({ language: 'en', category: 'WATER', areaType: 'RURAL', urgency: 'HIGH', subcategory: 'WATER_SUPPLY_INTERRUPTION', summaryEnglish: 'Water stopped', locationText: null, confidence: .9, model: 'mock' })) }));
vi.mock('../src/components/DistrictMap', () => ({ default: ({ selected, onSelect }) => <div data-testid="shared-map">Map selection: {selected}<button onClick={() => onSelect(2)}>Map selects Kolar</button></div> }));
afterEach(() => { cleanup(); vi.clearAllMocks(); });
async function mount() {
  loadDashboard.mockResolvedValue({ connected: true, districts: [{ id: 1, name: 'Mandya' }, { id: 2, name: 'Kolar' }], analytics: { data: [1, 2].map(id => ({ districtId: id, districtName: id === 1 ? 'Mandya' : 'Kolar', dataCompleteness: 'INCOMPLETE' })) }, citizenDemand: { totalRequests: 0, categoryBreakdown: [], urgencyBreakdown: [], areaTypeBreakdown: [], districtBreakdown: [], recentRequests: [] } });
  render(<Home />); await screen.findByText('From citizen voices to development intelligence');
}
const tab = name => fireEvent.click(screen.getByRole('tab', { name }));
test('Overview is default; each tab exposes only its content and retains footer', async () => {
  await mount(); expect(screen.getByRole('tab', { name: 'Overview' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.queryByRole('heading', { name: 'Citizen Demand Intelligence' })).toBeNull();
  tab('Citizen Demand'); expect(screen.getByRole('heading', { name: 'Citizen Demand Intelligence' })).toBeTruthy();
  expect(screen.queryByRole('heading', { name: 'Rural Water Evidence Analysis' })).toBeNull();
  tab('Rural Water'); expect(screen.getByRole('heading', { name: 'Rural Water Evidence Analysis' })).toBeTruthy();
  tab('District Intelligence'); expect(screen.getByLabelText('Explore district')).toBeTruthy();
  tab('Submit Request'); expect(screen.getByLabelText(/Request text/)).toBeTruthy();
  tab('Methodology'); expect(screen.getByRole('heading', { name: 'Data & Methodology' })).toBeTruthy();
  expect(screen.getByText(/Primary Census Abstract/)).toBeTruthy(); expect(screen.getByText(/not official government rankings/)).toBeTruthy();
  expect(screen.getByText('Built by Kiran Bhaskaran Lakshman')).toBeTruthy(); expect(loadDashboard).toHaveBeenCalledTimes(1);
});
test('draft, selected form district and AI preview survive navigation', async () => {
  await mount(); tab('Submit Request');
  fireEvent.change(screen.getByRole('combobox', { name: /District/ }), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Our village water stopped.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze Request' })); await screen.findByRole('heading', { name: 'AI Interpretation' });
  tab('Overview'); tab('Submit Request');
  expect(screen.getByLabelText(/Request text/).value).toBe('Our village water stopped.'); expect(screen.getByRole('combobox', { name: /District/ }).value).toBe('1');
  expect(screen.getByRole('heading', { name: 'AI Interpretation' })).toBeTruthy();
});
test('one map instance and shared district survive view changes', async () => {
  await mount(); const map = screen.getByTestId('shared-map'); fireEvent.click(screen.getByText('Map selects Kolar'));
  tab('District Intelligence'); expect(screen.getByLabelText('Explore district').value).toBe('2');
  fireEvent.change(screen.getByLabelText('Explore district'), { target: { value: '1' } });
  tab('Overview'); expect(screen.getByTestId('shared-map')).toBe(map); expect(map.textContent).toContain('Map selection: 1'); expect(loadDashboard).toHaveBeenCalledTimes(1);
});
test('arrow keys, Home and End move tab focus and selection', async () => {
  await mount(); const first = screen.getByRole('tab', { name: 'Overview' }); first.focus(); fireEvent.keyDown(first, { key: 'ArrowRight' });
  expect(document.activeElement.textContent).toBe('Citizen Demand'); expect(document.activeElement.getAttribute('aria-selected')).toBe('true');
  fireEvent.keyDown(document.activeElement, { key: 'End' }); expect(document.activeElement.textContent).toBe('Methodology');
  fireEvent.keyDown(document.activeElement, { key: 'Home' }); expect(document.activeElement).toBe(first);
});


test('all district and voice selects share native styling, labels and change behavior', async () => {
 await mount(); tab('District Intelligence');
 const exploration=screen.getByLabelText('Explore district');expect(exploration.classList.contains('civic-select')).toBe(true);
 fireEvent.change(exploration,{target:{value:'2'}});expect(exploration.value).toBe('2');
 tab('Submit Request');
 const district=screen.getByRole('combobox',{name:/District/});
 const language=screen.getByRole('combobox',{name:/language/i});
 for(const select of [district,language]){expect(select.tagName).toBe('SELECT');expect(select.classList.contains('civic-select')).toBe(true);expect(select.labels.length).toBeGreaterThan(0);select.focus();expect(document.activeElement).toBe(select);}
 fireEvent.change(district,{target:{value:'1'}});expect(district.value).toBe('1');
 fireEvent.change(language,{target:{value:'kn-IN'}});expect(language.value).toBe('kn-IN');
});

test('Overview action reuses primary action styling and opens Citizen Demand', async () => {
  await mount();
  const button = screen.getByRole('button', { name: 'Explore Citizen Demand', exact: true });
  expect(button.classList.contains('retry')).toBe(true);
  expect(button.type).toBe('button');
  button.focus(); expect(document.activeElement).toBe(button);
  fireEvent.click(button);
  expect(screen.getByRole('tab', { name: 'Citizen Demand' }).getAttribute('aria-selected')).toBe('true');
  expect(screen.getByRole('heading', { name: 'Citizen Demand Intelligence' })).toBeTruthy();
  expect(loadDashboard).toHaveBeenCalledTimes(1);
});
