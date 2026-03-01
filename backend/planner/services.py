from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime, timedelta, timezone
from typing import Any

import requests

NOMINATIM_URL = "https://nominatim.openstreetmap.org/search"
OSRM_URL = "https://router.project-osrm.org/route/v1/driving"
MILES_PER_METER = 0.000621371


@dataclass
class Segment:
    start: datetime
    end: datetime
    status: str
    note: str = ""


class PlannerError(Exception):
    pass


def geocode_location(query: str) -> dict[str, Any]:
    response = requests.get(
        NOMINATIM_URL,
        params={"q": query, "format": "json", "limit": 1},
        headers={"User-Agent": "spotter-assessment-app/1.0"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload:
        raise PlannerError(f"Could not geocode location: {query}")
    item = payload[0]
    return {
        "name": item.get("display_name", query),
        "lat": float(item["lat"]),
        "lon": float(item["lon"]),
    }


def fetch_route(origin: dict[str, Any], destination: dict[str, Any]) -> dict[str, Any]:
    coord_path = f"{origin['lon']},{origin['lat']};{destination['lon']},{destination['lat']}"
    response = requests.get(
        f"{OSRM_URL}/{coord_path}",
        params={"overview": "full", "geometries": "geojson"},
        timeout=20,
    )
    response.raise_for_status()
    payload = response.json()
    if not payload.get("routes"):
        raise PlannerError("No route found for provided locations")
    route = payload["routes"][0]
    return {
        "distance_meters": route["distance"],
        "duration_seconds": route["duration"],
        "geometry": route["geometry"]["coordinates"],
    }


def _hour_fraction(dt: datetime) -> float:
    return dt.hour + (dt.minute / 60.0)


def _append_segment(
    segments: list[Segment],
    day_logs: dict[str, list[dict[str, Any]]],
    start: datetime,
    end: datetime,
    status: str,
    note: str = "",
) -> None:
    segments.append(Segment(start=start, end=end, status=status, note=note))

    cursor = start
    while cursor < end:
        day_start = datetime(cursor.year, cursor.month, cursor.day, tzinfo=timezone.utc)
        day_end = day_start + timedelta(days=1)
        chunk_end = min(day_end, end)
        day_key = day_start.date().isoformat()
        day_logs.setdefault(day_key, []).append(
            {
                "status": status,
                "start_hour": round(_hour_fraction(cursor), 2),
                "end_hour": round(_hour_fraction(chunk_end), 2),
                "note": note,
            }
        )
        cursor = chunk_end


def _interpolate_point(points: list[list[float]], fraction: float) -> list[float] | None:
    if not points:
        return None
    if fraction <= 0:
        return points[0]
    if fraction >= 1:
        return points[-1]

    idx = int((len(points) - 1) * fraction)
    return points[idx]


def build_trip_plan(
    current_location: str,
    pickup_location: str,
    dropoff_location: str,
    current_cycle_used_hours: float,
) -> dict[str, Any]:
    current = geocode_location(current_location)
    pickup = geocode_location(pickup_location)
    dropoff = geocode_location(dropoff_location)

    leg1 = fetch_route(current, pickup)
    leg2 = fetch_route(pickup, dropoff)

    total_distance_meters = leg1["distance_meters"] + leg2["distance_meters"]
    total_duration_seconds = leg1["duration_seconds"] + leg2["duration_seconds"]

    total_miles = total_distance_meters * MILES_PER_METER
    drive_hours = total_duration_seconds / 3600.0

    # Operational assumptions from prompt.
    pickup_hours = 1.0
    dropoff_hours = 1.0
    fuel_events = int(total_miles // 1000)
    fuel_hours_total = fuel_events * 0.5

    cycle_remaining = max(0.0, 70.0 - current_cycle_used_hours)

    now = datetime.now(timezone.utc).replace(second=0, microsecond=0)
    start_time = now.replace(hour=6, minute=0)
    if now > start_time:
        start_time = now

    segments: list[Segment] = []
    day_logs: dict[str, list[dict[str, Any]]] = {}
    stops: list[dict[str, Any]] = []

    cursor = start_time
    driving_left = drive_hours
    driving_today = 0.0
    onduty_today = 0.0
    drive_since_break = 0.0

    def add_stop(reason: str, location: dict[str, Any] | None, when: datetime) -> None:
        entry = {
            "reason": reason,
            "time_utc": when.isoformat(),
        }
        if location:
            entry["location"] = location["name"]
            entry["lat"] = location["lat"]
            entry["lon"] = location["lon"]
        stops.append(entry)

    # Initial pickup on-duty work.
    _append_segment(
        segments,
        day_logs,
        cursor,
        cursor + timedelta(hours=pickup_hours),
        "on_duty",
        "Pickup",
    )
    cursor += timedelta(hours=pickup_hours)
    onduty_today += pickup_hours
    cycle_remaining -= pickup_hours
    add_stop("Pickup", pickup, cursor)

    elapsed_drive = 0.0
    total_geometry = leg1["geometry"] + leg2["geometry"]

    while driving_left > 0.01:
        # If the 70/8 cycle is exhausted, enforce a 34-hour restart.
        if cycle_remaining <= 0:
            restart_end = cursor + timedelta(hours=34)
            _append_segment(segments, day_logs, cursor, restart_end, "off_duty", "34-hour restart")
            add_stop("34-hour restart", None, restart_end)
            cursor = restart_end
            driving_today = 0.0
            onduty_today = 0.0
            drive_since_break = 0.0
            cycle_remaining = 70.0
            continue

        allowed = min(
            driving_left,
            11.0 - driving_today,
            14.0 - onduty_today,
            8.0 - drive_since_break,
            cycle_remaining,
        )

        if allowed <= 0.01:
            # No driving time left right now: either take a 30-min break
            # (if 8+ hrs continuous driving reached) or end duty day with 10 hrs off.
            if drive_since_break >= 8.0:
                break_end = cursor + timedelta(minutes=30)
                _append_segment(segments, day_logs, cursor, break_end, "off_duty", "30-min break")
                add_stop("30-minute break", None, break_end)
                cursor = break_end
                drive_since_break = 0.0
                continue

            off_end = cursor + timedelta(hours=10)
            _append_segment(segments, day_logs, cursor, off_end, "off_duty", "10-hour reset")
            add_stop("10-hour reset", None, off_end)
            cursor = off_end
            driving_today = 0.0
            onduty_today = 0.0
            drive_since_break = 0.0
            continue

        drive_end = cursor + timedelta(hours=allowed)
        _append_segment(segments, day_logs, cursor, drive_end, "driving")

        cursor = drive_end
        driving_left -= allowed
        driving_today += allowed
        onduty_today += allowed
        drive_since_break += allowed
        cycle_remaining -= allowed
        elapsed_drive += allowed

        # Approximate current position along the geometry to plot HOS stop markers.
        point = _interpolate_point(total_geometry, min(1.0, elapsed_drive / max(drive_hours, 0.01)))
        if point and (drive_since_break >= 8.0 or driving_today >= 11.0):
            stops.append(
                {
                    "reason": "HOS stop",
                    "time_utc": cursor.isoformat(),
                    "lat": point[1],
                    "lon": point[0],
                }
            )

    # Fueling stops (informational)
    for i in range(1, fuel_events + 1):
        fraction = min(0.99, (i * 1000.0) / max(total_miles, 1.0))
        point = _interpolate_point(total_geometry, fraction)
        if point:
            stops.append(
                {
                    "reason": "Fuel stop",
                    "lat": point[1],
                    "lon": point[0],
                }
            )

    # Drop-off work.
    _append_segment(
        segments,
        day_logs,
        cursor,
        cursor + timedelta(hours=dropoff_hours),
        "on_duty",
        "Dropoff",
    )
    cursor += timedelta(hours=dropoff_hours)
    add_stop("Dropoff", dropoff, cursor)

    if fuel_hours_total > 0:
        _append_segment(
            segments,
            day_logs,
            cursor,
            cursor + timedelta(hours=fuel_hours_total),
            "on_duty",
            "Fueling",
        )
        cursor += timedelta(hours=fuel_hours_total)

    output_day_logs = [
        {"date": date_key, "segments": segments_for_day}
        for date_key, segments_for_day in sorted(day_logs.items())
    ]

    return {
        "inputs": {
            "current_location": current_location,
            "pickup_location": pickup_location,
            "dropoff_location": dropoff_location,
            "current_cycle_used_hours": current_cycle_used_hours,
        },
        "summary": {
            "distance_miles": round(total_miles, 1),
            "driving_hours": round(drive_hours, 2),
            "fuel_stops": fuel_events,
            "estimated_completion_utc": cursor.isoformat(),
        },
        "locations": {
            "current": current,
            "pickup": pickup,
            "dropoff": dropoff,
        },
        "route": {
            "coordinates": total_geometry,
        },
        "stops": stops,
        "day_logs": output_day_logs,
        "segments": [
            {
                "status": s.status,
                "start_utc": s.start.isoformat(),
                "end_utc": s.end.isoformat(),
                "note": s.note,
            }
            for s in segments
        ],
    }
