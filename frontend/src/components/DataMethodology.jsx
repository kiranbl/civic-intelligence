export default function DataMethodology() {
  return <section className="sources" aria-labelledby="sources-title"><p className="eyebrow">UNDERSTAND THE CONTEXT</p><h2 id="sources-title">Data & Methodology</h2><div className="source-grid">
    <div><h3>Census of India</h3><p>District demographic context</p><strong>Reference year: 2011</strong><p>Historical population context, not a current population estimate.</p></div>
    <div><h3>Jal Jeevan Mission</h3><p>Reported rural household tap-connection coverage</p><strong>Snapshot: 21 September 2026</strong><p>Reported connections, not independently verified service functionality.</p></div>
    <div><h3>Citizen demand</h3><p>Prototype citizen-demand dataset</p><p>Synthetic demo requests, plus locally created AI-processed demonstration requests where present. These are not live public submissions.</p></div>
  </div><div className="notice"><strong>Priority scores are prototype relative indicators for demonstration. They are not official government rankings or policy recommendations.</strong><p>Demand is normalized relative to the districts currently analysed. Adding citizen requests to one district can therefore change normalized demand scores for other districts.</p></div></section>;
}
