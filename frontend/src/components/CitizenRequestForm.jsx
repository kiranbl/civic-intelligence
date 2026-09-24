import { useRef, useState } from 'react';
import { analyzeRequest, submitRequest } from '../services/api';
import AnalysisPreview from './AnalysisPreview';
import SubmissionSuccess from './SubmissionSuccess';

// Matches backend MAX_REQUEST_TEXT_LENGTH (JavaScript string length / UTF-16).
const MAX_LENGTH = 5000;
const samples = {
  English: 'The drinking water pipeline in our village has been broken for two weeks and around 40 houses are not getting water.',
  Kannada: 'ನಮ್ಮ ಗ್ರಾಮದ ಕುಡಿಯುವ ನೀರಿನ ಪೈಪ್ ಎರಡು ವಾರಗಳಿಂದ ಕೆಲಸ ಮಾಡುತ್ತಿಲ್ಲ. ಸುಮಾರು 40 ಮನೆಗಳಿಗೆ ನೀರು ಬರುತ್ತಿಲ್ಲ.',
  Hindi: 'हमारे गांव में दो हफ्तों से पीने के पानी की पाइपलाइन खराब है और लगभग 40 घरों में पानी नहीं आ रहा है।',
};
export default function CitizenRequestForm({ districts, onSubmitted }) {
  const [districtId, setDistrictId] = useState('');
  const [text, setText] = useState('');
  const [preview, setPreview] = useState(null);
  const [saved, setSaved] = useState(null);
  const [pending, setPending] = useState('');
  const [error, setError] = useState('');
  const lock = useRef(false), textarea = useRef(null);
  const validDistrict = districts.some(d => d.id === Number(districtId));
  function edit(value) { setText(value); setPreview(null); setError(''); }
  function clear() { setText(''); setDistrictId(''); setPreview(null); setSaved(null); setError(''); }
  function valid() {
    if (!validDistrict || !text.trim() || text.length > MAX_LENGTH) {
      setError('Choose a district and enter a request between 1 and 5,000 characters.'); return false;
    }
    return true;
  }
  async function analyze(event) {
    event.preventDefault();
    if (lock.current || !valid()) return;
    lock.current = true; setPending('analyze'); setError(''); setPreview(null);
    const reviewedText = text.trim();
    try { const analysis = await analyzeRequest(reviewedText); setPreview({ analysis, text: reviewedText }); }
    catch (failure) { setError(failure.message); }
    finally { lock.current = false; setPending(''); }
  }
  async function submit() {
    if (lock.current || !preview || !valid() || text.trim() !== preview.text) return;
    lock.current = true; setPending('submit'); setError('');
    let result;
    try { result = await submitRequest(Number(districtId), preview.text); }
    catch (failure) { setError(failure.message); }
    finally { lock.current = false; setPending(''); }
    if (result) {
      setSaved({ result, districtName: districts.find(d => d.id === Number(districtId)).name });
      onSubmitted();
    }
  }
  return <section className="card citizen-form" aria-labelledby="request-title">
    <p className="eyebrow">CITIZEN DEMAND · DEMONSTRATION</p><h2 id="request-title">Submit a Citizen Request</h2>
    <p>Describe a local infrastructure problem in English, Kannada, or Hindi.</p>
    {saved ? <SubmissionSuccess {...saved} preview={preview.analysis} onNew={clear} /> : <>
      <form onSubmit={analyze}>
        <fieldset disabled={Boolean(pending)}><label htmlFor="request-district">District <span>(required)</span></label>
          <select id="request-district" required value={districtId} onChange={e => { setDistrictId(e.target.value); setError(''); }}>
            <option value="">Select a district</option>{districts.map(d => <option key={d.id} value={d.id}>{d.name} · {d.state}</option>)}
          </select>
          <label htmlFor="request-text">Request text <span>(required)</span></label>
          <textarea ref={textarea} id="request-text" rows="4" required maxLength={MAX_LENGTH} value={text} onChange={e => edit(e.target.value)} aria-describedby="request-counter request-help" />
          <div className="request-tools"><small id="request-counter">{text.length.toLocaleString('en-IN')} / {MAX_LENGTH.toLocaleString('en-IN')} characters</small><div className="examples"><span>Demo examples:</span>{Object.entries(samples).map(([language, sample]) => <button type="button" className="sample" key={language} onClick={() => edit(sample)}>{language}</button>)}</div></div>
          <p id="request-help" className="fine">You choose the district. Analyze previews the interpretation without saving. This is a prototype demonstration dataset.</p>
          {!preview && <div className="form-actions"><button className="retry" type="submit" disabled={!validDistrict || !text.trim() || text.length > MAX_LENGTH}>Analyze Request</button><button className="secondary" type="button" onClick={clear}>Clear</button></div>}
        </fieldset>
      </form>
      <div aria-live="polite" role="status">{pending === 'analyze' ? 'Analyzing request with Gemini...' : pending === 'submit' ? 'Submitting request — Gemini is analyzing it again...' : ''}</div>
      {error && <p className="form-error" role="alert">{error}</p>}
      {preview && <><AnalysisPreview analysis={preview.analysis} /><p className="notice">Please review this interpretation before submitting. AI classifications may be imperfect. Submitting runs a fresh analysis; the stored result may differ.</p><div className="form-actions"><button type="button" className="retry" disabled={Boolean(pending) || !validDistrict} onClick={submit}>Submit Request</button><button type="button" className="secondary" disabled={Boolean(pending)} onClick={() => { setPreview(null); setError(''); textarea.current?.focus(); }}>Edit Request</button></div></>}
    </>}
  </section>;
}
