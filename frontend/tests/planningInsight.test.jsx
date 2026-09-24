import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import PlanningInsight from '../src/components/PlanningInsight';

const row = {
  districtId: 2, planningProfile: 'HIGH_DEMAND_LOW_GAP',
  planningAction: { code: 'INVESTIGATE_SERVICE_RELIABILITY', title: 'Investigate localized water-supply reliability', description: 'Review local service evidence.' },
  rationale: ['Demand index is 100.', 'Coverage is 88.45%.', 'Investigate without assuming a cause.'],
  evidence: { demandIndex: 100, infrastructureGap: 11.55, ruralFhtcCoverage: 88.45, ruralWaterRequestCount: 2, ruralWaterRequestsPer100k: 0.28 },
  limitations: ['Synthetic demonstration requests.', 'Census 2011; JJM 21/09/2026.'],
};
const response = data => ({ ok: true, json: async () => ({ success: true, data }) });
beforeEach(() => vi.stubGlobal('fetch', vi.fn(async (url, options) => {
  expect(url.endsWith('/analytics/water-planning')).toBe(true);
  expect(options.method).toBeUndefined();
  return response([row]);
})));
afterEach(() => { cleanup(); vi.unstubAllGlobals(); });

test('renders backend planning profile, action, rationale, evidence and limitations without recalculating', async () => {
  render(<PlanningInsight districtId={2} />);
  expect(await screen.findByText(row.planningAction.title)).toBeTruthy();
  expect(screen.getByText('HIGH DEMAND LOW GAP')).toBeTruthy();
  for (const text of [...row.rationale, ...row.limitations, '100.00', '11.55', '88.45%', '0.28', '2', 'Prototype planning consideration', 'Not an official government recommendation.']) expect(screen.getByText(text)).toBeTruthy();
  expect(fetch).toHaveBeenCalledTimes(1);
});

test('selecting another district replaces the action and absent districts are not guessed', async () => {
  fetch.mockResolvedValue(response([row, { ...row, districtId: 7, planningProfile: 'LOW_DEMAND_HIGH_GAP', planningAction: { ...row.planningAction, title: 'Validate potentially under-reported access needs' } }]));
  const view = render(<PlanningInsight districtId={2} />);
  await screen.findByText(row.planningAction.title);
  view.rerender(<PlanningInsight districtId={7} />);
  await screen.findByText('Validate potentially under-reported access needs');
  expect(screen.queryByText(row.planningAction.title)).toBeNull();
  view.rerender(<PlanningInsight districtId={99} />);
  await screen.findByText(/Planning evidence is unavailable for this district/);
});

test('incomplete evidence shows review-data action and unavailable values, not zero', async () => {
  fetch.mockResolvedValue(response([{ ...row, planningProfile: 'INSUFFICIENT_DATA', planningAction: { code: 'REVIEW_DATA', title: 'Review available infrastructure data', description: 'Required data is incomplete.' }, evidence: { ...row.evidence, infrastructureGap: null, ruralFhtcCoverage: null } }]));
  render(<PlanningInsight districtId={2} />);
  await screen.findByText('Review available infrastructure data');
  expect(screen.getByText('INSUFFICIENT DATA')).toBeTruthy();
  expect(screen.queryByText('0.00%')).toBeNull();
});

test('failure is isolated and supports a GET-only retry', async () => {
  fetch.mockRejectedValueOnce(new Error('Private diagnostic'));
  render(<PlanningInsight districtId={2} />);
  await screen.findByText(/Other district information remains available/);
  expect(screen.queryByText(/Private diagnostic/)).toBeNull();
  fireEvent.click(screen.getByRole('button', { name: 'Retry planning' }));
  await screen.findByText(row.planningAction.title);
});

test('submission revision reloads planning and ignores a late aborted response', async () => {
  let resolveOld;
  fetch.mockImplementationOnce(() => new Promise(resolve => { resolveOld = resolve; }));
  const view = render(<PlanningInsight districtId={7} revision={0} />);
  view.rerender(<PlanningInsight districtId={2} revision={1} />);
  await screen.findByText(row.planningAction.title);
  resolveOld(response([]));
  await waitFor(() => expect(fetch).toHaveBeenCalledTimes(2));
  expect(screen.queryByText(/Planning evidence is unavailable/)).toBeNull();
  expect(fetch.mock.calls[0][1].signal.aborted).toBe(true);
});
