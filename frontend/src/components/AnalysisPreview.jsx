import { percent } from './format';
export default function AnalysisPreview({ analysis, title = 'AI Interpretation' }) {
  return <section className="analysis-preview" aria-label={title}>
    <h3>{title}</h3><p className="eyebrow">AI-assisted interpretation</p>
    <dl className="analysis-fields">{[
      ['Detected language', analysis.language], ['Category', analysis.category], ['Subcategory', analysis.subcategory || 'Not specified'],
      ['Urgency', analysis.urgency], ['Area type', analysis.areaType], ['Location mentioned', analysis.locationText || 'No specific location mentioned'],
      ['Confidence', percent(Number.isFinite(analysis.confidence ?? analysis.aiConfidence) ? (analysis.confidence ?? analysis.aiConfidence) * 100 : null)],
      ['Model used', analysis.model || analysis.aiModel],
    ].map(([label, value]) => <div key={label}><dt>{label}</dt><dd>{value}</dd></div>)}</dl>
    <h4>English summary</h4><p>{analysis.summaryEnglish}</p>
    <p className="fine">Confidence is the model's self-assessment, not a verified accuracy measure. This is not an official government decision.</p>
  </section>;
}
