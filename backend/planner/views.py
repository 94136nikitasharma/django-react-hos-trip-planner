import json
from typing import Any

from django.http import HttpRequest, JsonResponse
from django.views.decorators.csrf import csrf_exempt
from django.views.decorators.http import require_http_methods

from .services import PlannerError, build_trip_plan


@csrf_exempt
@require_http_methods(["POST"])
def plan_trip(request: HttpRequest) -> JsonResponse:
    try:
        payload: dict[str, Any] = json.loads(request.body.decode("utf-8"))
    except json.JSONDecodeError:
        return JsonResponse({"error": "Invalid JSON"}, status=400)

    required = [
        "current_location",
        "pickup_location",
        "dropoff_location",
        "current_cycle_used_hours",
    ]

    missing = [field for field in required if field not in payload]
    if missing:
        return JsonResponse({"error": f"Missing fields: {', '.join(missing)}"}, status=400)

    try:
        plan = build_trip_plan(
            current_location=str(payload["current_location"]),
            pickup_location=str(payload["pickup_location"]),
            dropoff_location=str(payload["dropoff_location"]),
            current_cycle_used_hours=float(payload["current_cycle_used_hours"]),
        )
    except PlannerError as exc:
        return JsonResponse({"error": str(exc)}, status=400)
    except Exception as exc:
        return JsonResponse({"error": f"Unexpected error: {str(exc)}"}, status=500)

    return JsonResponse(plan)
