export default function PriorityBadge({ level }) {
  return <span className={'badge ' + (['LOW', 'MEDIUM', 'HIGH', 'VERY_HIGH'].includes(level) ? level.toLowerCase() : 'incomplete')}>{level || 'INCOMPLETE'}</span>;
}
