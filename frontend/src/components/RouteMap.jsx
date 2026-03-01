function normalizePoints(coordinates) {
  if (!coordinates?.length) {
    return { points: "", x: () => 0, y: () => 0 };
  }

  const lons = coordinates.map((c) => c[0]);
  const lats = coordinates.map((c) => c[1]);
  const minLon = Math.min(...lons);
  const maxLon = Math.max(...lons);
  const minLat = Math.min(...lats);
  const maxLat = Math.max(...lats);

  const width = Math.max(maxLon - minLon, 0.01);
  const height = Math.max(maxLat - minLat, 0.01);

  const x = (lon) => ((lon - minLon) / width) * 96 + 2;
  const y = (lat) => 98 - ((lat - minLat) / height) * 96;

  const points = coordinates.map((c) => `${x(c[0]).toFixed(2)},${y(c[1]).toFixed(2)}`).join(" ");
  return { points, x, y };
}

export default function RouteMap({ route, stops, locations }) {
  const coordinates = route?.coordinates || [];
  const { points, x, y } = normalizePoints(coordinates);
  const start = locations?.current ? [locations.current.lon, locations.current.lat] : (coordinates.length ? coordinates[0] : null);
  const end = coordinates.length ? coordinates[coordinates.length - 1] : null;
  const pickup = locations?.pickup || stops?.find((stop) => stop.reason === "Pickup" && typeof stop.lon === "number" && typeof stop.lat === "number");
  const dropoff = locations?.dropoff || stops?.find((stop) => stop.reason === "Dropoff" && typeof stop.lon === "number" && typeof stop.lat === "number");

  return (
    <div className="route-map-wrap">
      <svg viewBox="0 0 100 100" className="route-map" role="img" aria-label="Trip route map">
        <rect x="0" y="0" width="100" height="100" fill="#f4f7e9" />
        <path d="M 0 90 C 20 80, 30 65, 50 60 C 75 53, 80 30, 100 25" stroke="#d9debf" strokeWidth="8" fill="none" />
        {points && <polyline points={points} fill="none" stroke="#22452f" strokeWidth="1.8" />}
        {start && <circle cx={x(start[0])} cy={y(start[1])} r="1.6" fill="#1d5eb8" />}
        {pickup && <rect x={x(pickup.lon) - 1.5} y={y(pickup.lat) - 1.5} width="3" height="3" fill="#8d2fb2" />}
        {dropoff && <polygon points={`${x(dropoff.lon)},${y(dropoff.lat) - 1.9} ${x(dropoff.lon) - 1.9},${y(dropoff.lat) + 1.7} ${x(dropoff.lon) + 1.9},${y(dropoff.lat) + 1.7}`} fill="#1f6a40" />}
        {end && <circle cx={x(end[0])} cy={y(end[1])} r="1.3" fill="#1f6a40" opacity="0.35" />}
        {stops?.map((stop, idx) => (
          typeof stop.lon === "number" && typeof stop.lat === "number" ? (
            <g key={`${stop.reason}-${idx}`}>
              {stop.reason !== "Pickup" && stop.reason !== "Dropoff" ? (
                <circle cx={x(stop.lon)} cy={y(stop.lat)} r="1.2" fill="#b2462d" />
              ) : null}
            </g>
          ) : null
        ))}
      </svg>
      <div className="map-legend">
        <span><i className="dot start"></i>Start</span>
        <span><i className="dot pickup"></i>Pickup</span>
        <span><i className="dot dropoff"></i>Dropoff</span>
        <span><i className="dot stop"></i>Break/Fuel/HOS Stop</span>
      </div>
      <p className="map-note">Free route source: OpenStreetMap Nominatim + OSRM.</p>
    </div>
  );
}
