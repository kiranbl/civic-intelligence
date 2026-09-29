import { useEffect, useRef, useState } from 'react';
import { transcribeRecording } from '../services/api';

const MIME = 'audio/webm;codecs=opus';
const MAX_MS = 45000, MAX_BYTES = 1024 * 1024;
export default function VoiceInput({ disabled, districtName, onTranscript, onBusyChange }) {
  const [language, setLanguage] = useState('en-IN'), [status, setStatus] = useState('Ready'), [busy, setBusy] = useState(false);
  const [phase, setPhase] = useState('idle'), [elapsed, setElapsed] = useState(0);
  const successTimer = useRef(null);
  const session = useRef(null), callbacks = useRef({ onTranscript, onBusyChange });
  callbacks.current = { onTranscript, onBusyChange };
  const supported = Boolean(navigator.mediaDevices?.getUserMedia && globalThis.MediaRecorder?.isTypeSupported?.(MIME));
  function release(s) { clearTimeout(s.timer); clearInterval(s.interval); s.stream?.getTracks().forEach(track => { track.onended = null; track.stop(); }); }
  function finish(s, message, outcome = 'error') {
    release(s);
    if (session.current !== s || s.cancelled) return;
    session.current = null; setBusy(false); callbacks.current.onBusyChange(false); setStatus(message);
    setPhase(outcome);
    if (outcome === 'success') successTimer.current = setTimeout(() => { setPhase('idle'); setStatus('Ready'); }, 3000);
  }
  function stop() { const s = session.current; if (s?.recorder?.state === 'recording') { s.recorder.stop(); release(s); } }
  useEffect(() => () => {
    clearTimeout(successTimer.current);
    const s = session.current; if (!s) return;
    s.cancelled = true; s.abort.abort(); release(s);
    if (s.recorder?.state === 'recording') s.recorder.stop();
    session.current = null;
  }, []);
  async function start() {
    if (!supported || disabled || session.current) return;
    clearTimeout(successTimer.current); setElapsed(0); setPhase('permission');
    const s = { abort: new AbortController(), chunks: [], bytes: 0, language, districtName };
    session.current = s; setBusy(true); callbacks.current.onBusyChange(true); setStatus('Requesting microphone permission…');
    try {
      s.stream = await navigator.mediaDevices.getUserMedia({ audio: { channelCount: 1 }, video: false });
      if (s.cancelled || session.current !== s) { release(s); return; }
      s.recorder = new MediaRecorder(s.stream, { mimeType: MIME, audioBitsPerSecond: 64000 });
      s.recorder.ondataavailable = event => {
        if (!event.data.size) return;
        s.bytes += event.data.size;
        if (s.bytes > MAX_BYTES) { s.tooLarge = true; stop(); return; }
        s.chunks.push(event.data);
      };
      s.recorder.onerror = () => { s.failed = true; stop(); finish(s, 'Recording failed. Please try again.'); };
      s.recorder.onstop = async () => {
        release(s);
        if (s.cancelled || s.failed || session.current !== s) return;
        if (s.tooLarge) { finish(s, 'Recording is too large. Please record a shorter message.'); return; }
        const audio = new Blob(s.chunks, { type: MIME }); s.chunks = [];
        if (!audio.size) { finish(s, 'No speech detected'); return; }
        setPhase('transcribing'); setStatus('Transcribing…');
        try {
          const transcript = await transcribeRecording(audio, s.language, s.abort.signal, s.districtName);
          if (s.cancelled || session.current !== s) return;
          if (!transcript.trim()) { finish(s, 'No speech detected'); return; }
          const accepted = callbacks.current.onTranscript(transcript.trim());
          finish(s, accepted ? 'Transcript added. Review before analysis.' : 'Transcript would exceed 5,000 characters. Shorten your request and record again.', accepted ? 'success' : 'error');
        } catch (error) { finish(s, error.message); }
      };
      s.stream.getTracks().forEach(track => { track.onended = stop; });
      s.recorder.start(1000); setPhase('recording'); setStatus('Recording…');
      s.startedAt = Date.now();
      s.interval = setInterval(() => setElapsed(Math.min(45, Math.floor((Date.now() - s.startedAt) / 1000))), 250);
      s.timer = setTimeout(stop, MAX_MS);
    } catch (error) {
      finish(s, error.name === 'NotAllowedError' ? 'Microphone permission denied' : 'Recording unavailable. Check your microphone and browser.');
    }
  }
  return <div className={`voice-input voice-${phase}`} aria-label="Voice input">
    <h3>Speak your request</h3>
    <label htmlFor="voice-language">Voice language</label>
    <select className="civic-select" id="voice-language" value={language} disabled={disabled || busy} onChange={e => setLanguage(e.target.value)}>
      <option value="en-IN">English</option><option value="kn-IN">ಕನ್ನಡ</option><option value="hi-IN">हिन्दी</option>
    </select>
    <button type="button" className="secondary voice-start" disabled={!supported || disabled || busy} onClick={start}>
      <svg aria-hidden="true" width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><rect x="9" y="2" width="6" height="12" rx="3" /><path d="M5 10v2a7 7 0 0 0 14 0v-2M12 19v3M8 22h8" /></svg>
      Start recording</button>
    {phase === 'recording' && <button type="button" className="secondary" onClick={stop}>Stop recording</button>}
    <div className="voice-feedback">
      {phase === 'recording' && <><span className="voice-bars" aria-hidden="true">{[0, 1, 2, 3, 4].map(i => <i key={i} style={{ animationDelay: `${i * 0.13}s` }} />)}</span><span className="voice-timer" role="timer" aria-label="Elapsed recording time">00:{String(elapsed).padStart(2, '0')} / 00:45</span></>}
      {phase === 'transcribing' && <span className="voice-spinner" aria-hidden="true" />}
      {phase === 'success' && <span aria-hidden="true">✓</span>}
      {phase === 'error' && <span aria-hidden="true">!</span>}
      <p role="status" aria-live="polite" aria-atomic="true">{supported ? <>{status}{phase === 'recording' && <span className="voice-instruction">Speak now</span>}</> : 'Recording unsupported in this browser. You can still type your request.'}</p>
    </div>
    <p className="fine">Maximum 45 seconds. Voice is converted to text using Google Cloud Speech-to-Text. Review the transcription before analysis.</p>
  </div>;
}
