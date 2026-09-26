// The corridor drawn as a road: pickup points along a dashed centre line.
export default function RouteStrip({ points, destination, selectedId, onSelect }) {
  return (
    <ol className="road">
      {points.map((p) => (
        <li key={p.id} className={p.id === selectedId ? 'stop picked' : 'stop'}>
          {onSelect ? (
            <button type="button" onClick={() => onSelect(p.id)} aria-pressed={p.id === selectedId}>
              {p.name}
            </button>
          ) : (
            <span>{p.name}</span>
          )}
        </li>
      ))}
      <li className="stop end"><span>{destination}</span></li>
    </ol>
  )
}
