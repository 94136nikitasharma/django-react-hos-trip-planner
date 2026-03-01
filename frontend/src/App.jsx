import { useMemo, useState } from "react";
import RouteMap from "./components/RouteMap";
import DailyLogSheet from "./components/DailyLogSheet";

const initialForm = {
  current_location: "Dallas, TX",
  pickup_location: "Oklahoma City, OK",
  dropoff_location: "Denver, CO",
  current_cycle_used_hours: "22"
};

const assumptions = [
  "Property-carrying driver under 70 hrs / 8 days cycle.",
  "11-hour driving, 14-hour duty window, and 30-minute break rules are enforced.",
  "No adverse driving-condition exceptions are applied.",
  "Pickup and dropoff are modeled as 1 hour on-duty each.",
  "Fueling is modeled every 1,000 miles."
];

function App() {
  const [form, setForm] = useState(initialForm);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [result, setResult] = useState(null);

  const summaryItems = useMemo(() => {
    if (!result) return [];
    return [
      ["Distance", `${result.summary.distance_miles} mi`],
      ["Driving Time", `${result.summary.driving_hours} hrs`],
      ["Fuel Stops", `${result.summary.fuel_stops}`],
      ["ETA (UTC)", new Date(result.summary.estimated_completion_utc).toLocaleString()]
    ];
  }, [result]);

  async function handleSubmit(event) {
    event.preventDefault();
    setLoading(true);
    setError("");

    try {
      const response = await fetch("/api/plan-trip", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          ...form,
          current_cycle_used_hours: Number(form.current_cycle_used_hours)
        })
      });
      const contentType = response.headers.get("content-type") || "";
      let data = null;
      if (contentType.includes("application/json")) {
        data = await response.json();
      } else {
        const raw = await response.text();
        throw new Error(
          `Backend returned non-JSON response (${response.status}). Check backend server and Vite proxy target. First 120 chars: ${raw.slice(0, 120)}`
        );
      }
      if (!response.ok) {
        throw new Error(data.error || "Unable to generate trip plan");
      }
      setResult(data);
    } catch (err) {
      setError(err.message);
    } finally {
      setLoading(false);
    }
  }

  function updateField(key, value) {
    setForm((prev) => ({ ...prev, [key]: value }));
  }

  return (
    <div className="page">
      <header className="hero">
        <h1>Trip Planner + ELD Daily Logs</h1>
        <p>Generate route guidance, required stops, and FMCSA-style duty logs from one trip request.</p>
      </header>

      <main className="layout">
        <section className="card">
          <h2>Trip Inputs</h2>
          <form onSubmit={handleSubmit} className="trip-form">
            <label>
              Current Location
              <input value={form.current_location} onChange={(e) => updateField("current_location", e.target.value)} required />
            </label>
            <label>
              Pickup Location
              <input value={form.pickup_location} onChange={(e) => updateField("pickup_location", e.target.value)} required />
            </label>
            <label>
              Dropoff Location
              <input value={form.dropoff_location} onChange={(e) => updateField("dropoff_location", e.target.value)} required />
            </label>
            <label>
              Current 70/8 Cycle Used (hours)
              <input
                type="number"
                min="0"
                max="70"
                step="0.5"
                value={form.current_cycle_used_hours}
                onChange={(e) => updateField("current_cycle_used_hours", e.target.value)}
                required
              />
            </label>
            <button type="submit" disabled={loading}>{loading ? "Planning..." : "Generate Plan"}</button>
          </form>
          {error && <p className="error">{error}</p>}
        </section>

        <section className="card">
          <h2>Route Map</h2>
          {result ? <RouteMap route={result.route} stops={result.stops} locations={result.locations} /> : <p>Submit a trip to render map.</p>}
        </section>

        <section className="card full-width assumptions">
          <h2>Assumptions Used</h2>
          <ul>
            {assumptions.map((item) => <li key={item}>{item}</li>)}
          </ul>
        </section>

        <section className="card full-width">
          <h2>Summary</h2>
          {result ? (
            <>
              <div className="summary-grid">
                {summaryItems.map(([label, value]) => (
                  <article key={label} className="stat">
                    <p className="label">{label}</p>
                    <p className="value">{value}</p>
                  </article>
                ))}
              </div>
              <h3>Stops and Rests</h3>
              <ul className="stops">
                {result.stops.map((stop, index) => (
                  <li key={`${stop.reason}-${index}`}>
                    <strong>{stop.reason}</strong>
                    {stop.location ? ` at ${stop.location}` : ""}
                    {stop.time_utc ? ` (${new Date(stop.time_utc).toLocaleString()})` : ""}
                  </li>
                ))}
              </ul>
            </>
          ) : (
            <p>Summary will appear after route generation.</p>
          )}
        </section>

        <section className="card full-width">
          <h2>Daily Log Sheets</h2>
          {result ? (
            <div className="logs">
              {result.day_logs.map((log) => (
                <DailyLogSheet key={log.date} date={log.date} segments={log.segments} />
              ))}
            </div>
          ) : (
            <p>Daily logs will be generated automatically.</p>
          )}
        </section>
      </main>
    </div>
  );
}

export default App;
