const STATUSES = [
  { key: "off_duty", label: "1. Off Duty", row: 0, color: "#6c6f70" },
  { key: "sleeper", label: "2. Sleeper", row: 1, color: "#5a7ca5" },
  { key: "driving", label: "3. Driving", row: 2, color: "#c74f34" },
  { key: "on_duty", label: "4. On Duty", row: 3, color: "#294f3f" }
];

function findRow(status) {
  const match = STATUSES.find((s) => s.key === status);
  return match || STATUSES[0];
}

function calculateHours(segments, key) {
  return segments
    .filter((segment) => segment.status === key)
    .reduce((sum, segment) => sum + Math.max(0, segment.end_hour - segment.start_hour), 0);
}

export default function DailyLogSheet({ date, segments }) {
  const offDutyHours = calculateHours(segments, "off_duty");
  const sleeperHours = calculateHours(segments, "sleeper");
  const drivingHours = calculateHours(segments, "driving");
  const onDutyHours = calculateHours(segments, "on_duty");

  return (
    <article className="log-sheet">
      <header className="log-header-top">
        <h3>Driver Daily Log</h3>
        <p>{date}</p>
      </header>

      <div className="log-meta">
        <div><span>From:</span> Home Terminal</div>
        <div><span>To:</span> Trip Destination</div>
        <div><span>24-hour date:</span> {date}</div>
      </div>

      <div className="grid-wrap">
        <svg viewBox="0 0 960 330" className="log-grid" role="img" aria-label={`Daily log for ${date}`}>
          <rect x="0" y="0" width="960" height="330" fill="#fff" stroke="#111" strokeWidth="1" />
          <rect x="120" y="34" width="804" height="24" fill="#111" />

          {Array.from({ length: 25 }).map((_, i) => (
            <line key={`v-${i}`} x1={120 + i * 33.5} y1="58" x2={120 + i * 33.5} y2="258" stroke="#d4d4d4" strokeWidth={i % 4 === 0 ? 1.6 : 1} />
          ))}

          {Array.from({ length: 5 }).map((_, i) => (
            <line key={`h-${i}`} x1="120" y1={58 + i * 50} x2="924" y2={58 + i * 50} stroke="#bbb" strokeWidth="1" />
          ))}

          {STATUSES.map((status, idx) => (
            <text key={status.key} x="14" y={90 + idx * 50} fontSize="18" fill="#111">{status.label}</text>
          ))}

          {[0, 2, 4, 6, 8, 10, 12, 14, 16, 18, 20, 22, 24].map((hour) => (
            <text key={hour} x={120 + hour * 33.5 - 9} y="28" fontSize="13" fill="#111">{hour}</text>
          ))}

          {segments.map((segment, idx) => {
            const row = findRow(segment.status);
            const start = Math.max(0, Math.min(24, segment.start_hour));
            const end = Math.max(0, Math.min(24, segment.end_hour));
            const wrappedEnd = end < start ? 24 : end;
            const x = 120 + (start / 24) * 804;
            const width = ((wrappedEnd - start) / 24) * 804;
            const y = 70 + row.row * 50;
            return <rect key={`${segment.status}-${idx}`} x={x} y={y} width={Math.max(width, 3)} height="24" fill={row.color} rx="3" />;
          })}

          <text x="10" y="286" fontSize="14" fill="#222">Remarks:</text>
          <line x1="120" y1="282" x2="924" y2="282" stroke="#bcbcbc" strokeWidth="1" />
          <line x1="120" y1="302" x2="924" y2="302" stroke="#bcbcbc" strokeWidth="1" />
          <line x1="120" y1="322" x2="924" y2="322" stroke="#bcbcbc" strokeWidth="1" />
        </svg>
      </div>

      <div className="log-recap">
        <span>Off Duty: {offDutyHours.toFixed(2)}h</span>
        <span>Sleeper: {sleeperHours.toFixed(2)}h</span>
        <span>Driving: {drivingHours.toFixed(2)}h</span>
        <span>On Duty: {onDutyHours.toFixed(2)}h</span>
      </div>
    </article>
  );
}
