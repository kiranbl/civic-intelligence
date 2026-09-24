import AnalysisPreview from './AnalysisPreview';
export default function SubmissionSuccess({ result, districtName, preview, onNew }) {
  const changed = ['language', 'category', 'subcategory', 'urgency', 'areaType', 'summaryEnglish', 'locationText'].some(key => result[key] !== preview[key])
    || result.aiModel !== preview.model || result.aiConfidence !== preview.confidence;
  return <div className="submission-success">
    <div role="status"><h3>Request submitted successfully</h3><p>Request #{result.id} · {districtName}</p><p>Final category: <strong>{result.category}</strong> · Final urgency: <strong>{result.urgency}</strong> · Final AI model: <strong>{result.aiModel}</strong></p></div>
    <p>{changed ? 'The stored result differs from the preview because the backend analyzed the text again. The final stored result below is authoritative for this application.' : 'The backend analyzed the text again. The final stored interpretation is shown below.'}</p>
    <AnalysisPreview analysis={result} title="Final stored interpretation" />
    <button type="button" className="secondary" onClick={onNew}>Start another request</button>
  </div>;
}
