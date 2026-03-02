# Spotter AI Assignment: Trip Planner + ELD Log Generator

Production-style full-stack submission for the Spotter AI Full Stack Developer assessment.

## Live Demo
- Frontend (Vercel): [https://django-react-hos-trip-pl-git-f8a6a6-94136nikitasharmas-projects.vercel.app](https://django-react-hos-trip-pl-git-f8a6a6-94136nikitasharmas-projects.vercel.app)
- Backend API (Render): [https://django-react-hos-trip-planner.onrender.com](https://django-react-hos-trip-planner.onrender.com)

## What This Project Solves
Given trip inputs:
- Current location
- Pickup location
- Dropoff location
- Current cycle used (hours)

The app returns:
- Route guidance from free map APIs
- HOS-aware stop/rest planning
- Multi-day FMCSA-style daily log sheets

## Why This Implementation
I prioritized:
- Clear API contract between frontend and backend
- Separated backend layers (HTTP handling vs business logic)
- Explainable HOS scheduling logic
- Reviewer-friendly UI with visible assumptions and generated logs

## Tech Stack
- Frontend: React + Vite
- Backend: Django
- Routing/Geocoding: OpenStreetMap Nominatim + OSRM

## Project Structure
```text
backend/
  planner/
    views.py       # Request validation + JSON responses
    services.py    # Trip planning + HOS logic
    urls.py
  tripplanner/
    settings.py
    urls.py
frontend/
  src/
    App.jsx
    components/
      RouteMap.jsx
      DailyLogSheet.jsx
    styles/app.css
```

## Core Backend Flow
1. `POST /api/plan-trip` receives trip input.
2. `views.py` validates payload and calls `build_trip_plan(...)`.
3. `services.py`:
   - Geocodes addresses
   - Fetches route geometry + distance/time
   - Applies HOS assumptions/rules
   - Produces summary, stops, and day-by-day log segments
4. API returns JSON consumed by React UI.

## HOS Assumptions Applied
- Property-carrying driver
- 70 hours / 8 days cycle
- 11-hour driving limit
- 14-hour on-duty window
- 30-minute break after 8 hours driving
- 10-hour reset when daily limits reached
- 34-hour restart when cycle exhausted
- 1 hour pickup + 1 hour dropoff
- Fueling every 1,000 miles

## API Contract
### Endpoint
`POST /api/plan-trip`

### Request
```json
{
  "current_location": "Dallas, TX",
  "pickup_location": "Oklahoma City, OK",
  "dropoff_location": "Denver, CO",
  "current_cycle_used_hours": 22
}
```

### Response (shape)
```json
{
  "summary": {
    "distance_miles": 0,
    "driving_hours": 0,
    "fuel_stops": 0,
    "estimated_completion_utc": "..."
  },
  "locations": {
    "current": {"lat": 0, "lon": 0, "name": "..."},
    "pickup": {"lat": 0, "lon": 0, "name": "..."},
    "dropoff": {"lat": 0, "lon": 0, "name": "..."}
  },
  "route": {
    "coordinates": [[0, 0], [0, 0]]
  },
  "stops": [],
  "day_logs": [
    {
      "date": "YYYY-MM-DD",
      "segments": [
        {"status": "driving", "start_hour": 8.0, "end_hour": 12.5, "note": ""}
      ]
    }
  ]
}
```

## Local Setup
## 1) Backend
```bash
cd "/Users/nikita/Desktop/Spotter AI Second assignment/backend"
python3 -m venv .venv
source .venv/bin/activate
pip install -r requirements.txt
python manage.py migrate
python manage.py runserver 127.0.0.1:8001
```

## 2) Frontend
Make sure `frontend/vite.config.js` proxies `/api` to `http://127.0.0.1:8001`.

```bash
cd "/Users/nikita/Desktop/Spotter AI Second assignment/frontend"
npm install
npm run dev
```

Open `http://localhost:5173`.

## Quick Health Checks
```bash
curl -i http://127.0.0.1:5173/
curl -i -X POST http://127.0.0.1:8001/api/plan-trip \
  -H "Content-Type: application/json" \
  -d '{"current_location":"Dallas, TX","pickup_location":"Oklahoma City, OK","dropoff_location":"Denver, CO","current_cycle_used_hours":22}'
```

## Deployment Recommendation
- Frontend: Vercel (`frontend/`)
- Backend: Render or Railway (`backend/`)
- Set frontend API base/proxy to deployed backend URL

## Loom Demo Checklist (3-5 min)
1. Show requirements and input/output mapping.
2. Run one trip end-to-end on UI.
3. Explain route map, stop list, and daily logs.
4. Open `backend/planner/services.py` and explain HOS logic loop.
5. Open `frontend/src/components/DailyLogSheet.jsx` for log rendering.

## Known Limitations / Next Improvements
- Add automated tests (unit + integration)
- Add retry/rate-limit strategy for external APIs
- Persist trip history to database
- Add broader FMCSA edge-case handling

## Submission Links
- Live App: [https://django-react-hos-trip-pl-git-f8a6a6-94136nikitasharmas-projects.vercel.app](https://django-react-hos-trip-pl-git-f8a6a6-94136nikitasharmas-projects.vercel.app)

- GitHub Repo: [https://github.com/94136nikitasharma/django-react-hos-trip-planner](https://github.com/94136nikitasharma/django-react-hos-trip-planner)
