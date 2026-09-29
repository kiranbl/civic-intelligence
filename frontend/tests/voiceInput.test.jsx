import { afterEach, beforeEach, expect, test, vi } from 'vitest';
import { act, cleanup, fireEvent, render, screen, waitFor } from '@testing-library/react';
import CitizenRequestForm from '../src/components/CitizenRequestForm';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
const districts = [{ id: 1, name: 'Mandya', state: 'Karnataka' }];
let recorder, track, permission;
beforeEach(() => {
  track = { stop: vi.fn(), onended: null };
  permission = vi.fn(async () => ({ getTracks: () => [track] }));
  vi.stubGlobal('navigator', { mediaDevices: { getUserMedia: permission } });
  vi.stubGlobal('MediaRecorder', class {
    static isTypeSupported = () => true;
    constructor() { recorder = this; this.state = 'inactive'; }
    start() { this.state = 'recording'; }
    stop() { this.state = 'inactive'; this.ondataavailable?.({ data: new Blob(['mock-webm'], { type: 'audio/webm' }) }); this.onstop?.(); }
  });
  vi.stubGlobal('fetch', vi.fn(async () => ({ ok: true, status: 200, json: async () => ({ success: true, data: { transcript: 'Water has stopped.' } }) })));
});
afterEach(() => { cleanup(); vi.unstubAllGlobals(); vi.useRealTimers(); });
const mount = () => render(<CitizenRequestForm districts={districts} onSubmitted={vi.fn()} />);
test('Type and Speak share a desktop grid with a narrow-screen stack rule', () => {
  const { container } = mount();
  const layout = container.querySelector('.request-input-layout');
  expect(layout.querySelector('.typed-input').contains(screen.getByLabelText(/Request text/))).toBe(true);
  expect(layout.querySelector('.voice-input').contains(screen.getByText('Speak your request'))).toBe(true);
  const css = readFileSync(resolve(process.cwd(), 'src/styles.css'), 'utf8');
  expect(css).toMatch(/\.request-input-layout\s*\{[^}]*display:\s*grid/);
  expect(css).toMatch(/@media\s*\(max-width:\s*700px\)\s*\{\s*\.request-input-layout\s*\{\s*grid-template-columns:\s*minmax\(0,\s*1fr\)/);
});
test('selected district is captured at recording start and sent only as metadata', async () => {
  mount(); fireEvent.change(screen.getByLabelText(/District/), { target: { value: '1' } });
  await start();
  fireEvent.change(screen.getByLabelText(/District/), { target: { value: '' } });
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  await screen.findByText(/Transcript added/);
  expect(fetch).toHaveBeenCalledTimes(1);
  expect(fetch.mock.calls[0][1].body.get('districtName')).toBe('Mandya');
  expect(permission.mock.calls[0][0].audio.sampleRate).toBeUndefined();
  expect(screen.getByLabelText(/District/).value).toBe('');
});
async function start() { fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); await screen.findByText('Recording…'); }
test('unsupported recorder leaves typed request workflow available', () => {
  vi.stubGlobal('MediaRecorder', undefined); mount();
  expect(screen.getByText(/Recording unsupported/)).toBeTruthy(); expect(screen.getByRole('button', { name: 'Start recording' }).disabled).toBe(true);
  fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Typed request' } }); expect(screen.getByLabelText(/Request text/).value).toBe('Typed request');
});
for (const language of ['en-IN', 'kn-IN', 'hi-IN']) test(`records ${language}, appends text, does not analyze/submit`, async () => {
  mount(); fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Existing request.' } });
  fireEvent.change(screen.getByLabelText('Voice language'), { target: { value: language } });
  await start(); expect(permission).toHaveBeenCalledTimes(1); expect(fetch).not.toHaveBeenCalled();
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  await waitFor(() => expect(screen.getByLabelText(/Request text/).value).toBe('Existing request.\nWater has stopped.'));
  expect(fetch).toHaveBeenCalledTimes(1); const [url, options] = fetch.mock.calls[0];
  expect(url.endsWith('/speech/transcribe')).toBe(true); expect(options.body.get('languageCode')).toBe(language); expect(options.body.get('audio')).toBeTruthy();
  expect(options.headers).toBeUndefined(); expect(track.stop).toHaveBeenCalled();
  expect(options.body.get('districtName')).toBeNull();
  expect(screen.queryByRole('button', { name: 'Submit Request' })).toBeNull();
});
test('transcribing is visible and analysis stays disabled until completion', async () => {
  let resolve; fetch.mockReturnValue(new Promise(r => { resolve = r; })); mount(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' })); expect(screen.getByText('Transcribing…')).toBeTruthy();
  expect(screen.getByRole('button', { name: 'Analyze Request' }).disabled).toBe(true);
  resolve({ ok: true, status: 200, json: async () => ({ success: true, data: { transcript: '' } }) }); await screen.findByText('No speech detected');
});
test('permission denial is safe and never uploads', async () => {
  permission.mockRejectedValue(Object.assign(Error('PRIVATE'), { name: 'NotAllowedError' })); mount();
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); await screen.findByText('Microphone permission denied'); expect(fetch).not.toHaveBeenCalled();
});
test('provider details are never displayed', async () => {
  fetch.mockResolvedValue({ ok: false, status: 503, json: async () => ({ message: 'PRIVATE' }) }); mount(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' })); await screen.findByText('Transcription temporarily unavailable'); expect(screen.queryByText('PRIVATE')).toBeNull();
});
test('unmount stops tracks and recorder without uploading', async () => {
  const view = mount(); await start(); view.unmount(); expect(track.stop).toHaveBeenCalled(); expect(recorder.state).toBe('inactive'); expect(fetch).not.toHaveBeenCalled();
});
test('late microphone permission after unmount releases tracks', async () => {
  let resolve; permission.mockReturnValue(new Promise(r => { resolve = r; })); const view = mount();
  fireEvent.click(screen.getByRole('button', { name: 'Start recording' })); view.unmount();
  await act(async () => resolve({ getTracks: () => [track] })); expect(track.stop).toHaveBeenCalled(); expect(fetch).not.toHaveBeenCalled();
});
test('unmount during transcription aborts upload and ignores late transcript', async () => {
  let resolve; fetch.mockReturnValue(new Promise(r => { resolve = r; })); const view = mount(); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  const signal = fetch.mock.calls[0][1].signal; view.unmount(); expect(signal.aborted).toBe(true);
  await act(async () => resolve({ ok: true, json: async () => ({ success: true, data: { transcript: 'Late text' } }) }));
  expect(fetch).toHaveBeenCalledTimes(1); expect(track.stop).toHaveBeenCalled();
});
test('oversized combined text is preserved without truncation or analysis', async () => {
  mount(); const original = 'x'.repeat(4999);
  fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: original } }); await start();
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  await screen.findByText(/Transcript would exceed 5,000/);
  expect(screen.getByLabelText(/Request text/).value).toBe(original); expect(fetch).toHaveBeenCalledTimes(1);
});
test('maximum 45 seconds stops recording automatically', async () => {
  vi.useFakeTimers(); mount(); await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start recording' })));
  expect(screen.getByText('Recording…')).toBeTruthy(); await act(async () => vi.advanceTimersByTimeAsync(45000));
  expect(recorder.state).toBe('inactive'); expect(track.stop).toHaveBeenCalled(); expect(fetch).toHaveBeenCalledTimes(1);
});
test('transcript invalidates an existing analysis preview', async () => {
  fetch.mockImplementation(async url => ({ ok: true, status: 200, json: async () => ({ success: true, data: url.endsWith('/analyze')
    ? { language: 'en', category: 'WATER', subcategory: 'WATER_SUPPLY_INTERRUPTION', areaType: 'RURAL', urgency: 'HIGH', summaryEnglish: 'Water stopped', confidence: .9, model: 'mock' }
    : { transcript: 'Additional detail.' } }) }));
  mount(); fireEvent.change(screen.getByLabelText(/District/), { target: { value: '1' } });
  fireEvent.change(screen.getByLabelText(/Request text/), { target: { value: 'Water stopped.' } });
  fireEvent.click(screen.getByRole('button', { name: 'Analyze Request' })); await screen.findByRole('button', { name: 'Submit Request' });
  await start(); expect(screen.getByRole('button', { name: 'Submit Request' }).disabled).toBe(true);
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  await waitFor(() => expect(screen.queryByRole('button', { name: 'Submit Request' })).toBeNull()); expect(fetch).toHaveBeenCalledTimes(2);
});


test('idle panel has a keyboard-accessible microphone button without animation', () => {
  const { container } = mount();
  expect(screen.getByRole('button', { name: 'Start recording' }).disabled).toBe(false);
  expect(screen.getByText('Ready')).toBeTruthy();
  expect(container.querySelector('.voice-bars, .voice-spinner')).toBeNull();
});
test('recording timer advances, stops during transcription, and success returns to idle', async () => {
  vi.useFakeTimers();
  let complete; fetch.mockReturnValue(new Promise(resolve => { complete = resolve; }));
  const { container, unmount } = mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start recording' })));
  expect(screen.getByText('Speak now')).toBeTruthy();
  expect(container.querySelector('.voice-bars')).toBeTruthy();
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByRole('timer').textContent).toBe('00:03 / 00:45');
  fireEvent.click(screen.getByRole('button', { name: 'Stop recording' }));
  expect(screen.getByText('Transcribing…')).toBeTruthy();
  expect(container.querySelector('.voice-bars')).toBeNull();
  expect(container.querySelector('.voice-spinner')).toBeTruthy();
  expect(screen.queryByRole('timer')).toBeNull();
  expect(screen.getByRole('button', { name: 'Start recording' }).disabled).toBe(true);
  await act(async () => complete({ ok: true, status: 200, json: async () => ({ success: true, data: { transcript: 'Clean drinking water needed.' } }) }));
  expect(screen.getByText('Transcript added. Review before analysis.')).toBeTruthy();
  expect(container.querySelector('.voice-success')).toBeTruthy();
  expect(screen.getByLabelText(/Request text/).value).toBe('Clean drinking water needed.');
  await act(async () => vi.advanceTimersByTimeAsync(3000));
  expect(screen.getByText('Ready')).toBeTruthy();
  expect(container.querySelector('.voice-spinner')).toBeNull();
  unmount();
});
test('unmount clears the recording interval and maximum-duration timer', async () => {
  vi.useFakeTimers(); const view = mount();
  await act(async () => fireEvent.click(screen.getByRole('button', { name: 'Start recording' })));
  expect(vi.getTimerCount()).toBeGreaterThan(0);
  view.unmount(); expect(vi.getTimerCount()).toBe(0); expect(fetch).not.toHaveBeenCalled();
});
