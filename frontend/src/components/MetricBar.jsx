import { score } from './format';
export default function MetricBar({ value, kind }) {
  return <div className={'metric-bar ' + kind}><span>{score(value)}</span>{Number.isFinite(value) && <div className="track" aria-hidden="true"><i style={{ width: Math.max(0, Math.min(100, value)) + '%' }} /></div>}</div>;
}
