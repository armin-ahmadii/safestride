# ================== MAPBOX ADDRESS → ROUTE (with risk-aware detour) ==================
# Requires:
#   pip install requests
# Env:
#   export MAPBOX_TOKEN=pk.XXXXXXXXXXXXXXXX  (Windows PowerShell:  setx MAPBOX_TOKEN "pk....")

import os, math, requests
from typing import Tuple, List

MB_TOKEN = os.environ.get("MAPBOX_TOKEN")
if not MB_TOKEN:
    raise RuntimeError("Set MAPBOX_TOKEN env var (your Mapbox access token)")

# --- Risk fallback if you didn't wire risk_at yet ---
def risk_at_safe(lat: float, lon: float, window: str) -> float:
    try:
        return float(risk_at(lat, lon, window))  # your existing helper
    except Exception:
        return 0.0

# ------------------------ Mapbox helpers ------------------------

def mapbox_geocode(address: str) -> Tuple[float, float]:
    """Return (lon, lat) for a human-readable address."""
    url = f"https://api.mapbox.com/geocoding/v5/mapbox.places/{requests.utils.quote(address)}.json"
    params = {"access_token": MB_TOKEN, "limit": 1}
    r = requests.get(url, params=params, timeout=15)
    r.raise_for_status()
    feats = r.json().get("features", [])
    if not feats:
        raise ValueError(f"Could not geocode: {address}")
    lon, lat = feats[0]["center"]
    return float(lon), float(lat)

def mapbox_directions(coords: List[List[float]]) -> list:
    """
    coords = [[lon,lat], [lon,lat], ...], profile=walking, alternatives=true
    returns list of routes dicts with geometry + distance
    """
    base = "https://api.mapbox.com/directions/v5/mapbox/walking"
    coord_str = ";".join([f"{c[0]},{c[1]}" for c in coords])
    params = {
        "access_token": MB_TOKEN,
        "alternatives": "true",
        "geometries": "geojson",
        "overview": "full",
        "steps": "false"
    }
    r = requests.get(f"{base}/{coord_str}", params=params, timeout=25)
    r.raise_for_status()
    return r.json().get("routes", [])

# ------------------------ Risk scoring ------------------------

def route_avg_risk(route_coords: List[List[float]], window: str) -> float:
    """
    Sample along the line ~every 40–60 points (capped) to estimate avg risk in [0,1].
    """
    npts = len(route_coords)
    if npts == 0:
        return 0.0
    step = max(1, npts // 60)
    total = 0.0; n = 0
    for i in range(0, npts, step):
        lon, lat = route_coords[i]
        total += risk_at_safe(lat, lon, window)
        n += 1
    return (total / n) if n else 0.0

def worst_point(route_coords: List[List[float]], window: str) -> Tuple[int, float, Tuple[float,float]]:
    """Return (index, risk_value, (lon,lat)) of the highest-risk sampled vertex."""
    worst_i, worst_r, worst_ll = 0, -1.0, (route_coords[0][0], route_coords[0][1])
    for i, (lon, lat) in enumerate(route_coords):
        r = risk_at_safe(lat, lon, window)
        if r > worst_r:
            worst_i, worst_r, worst_ll = i, r, (lon, lat)
    return worst_i, float(worst_r), worst_ll

# ------------------------ Simple detour waypoint ------------------------

def bearing_between(a: Tuple[float,float], b: Tuple[float,float]) -> float:
    """Initial bearing (deg) from point a to b; points are (lon,lat)."""
    (lon1, lat1), (lon2, lat2) = (math.radians(a[0]), math.radians(a[1])), (math.radians(b[0]), math.radians(b[1]))
    dlon = lon2 - lon1
    x = math.sin(dlon) * math.cos(lat2)
    y = math.cos(lat1)*math.sin(lat2) - math.sin(lat1)*math.cos(lat2)*math.cos(dlon)
    br = (math.degrees(math.atan2(x, y)) + 360) % 360
    return br

def offset_point(lat: float, lon: float, bearing_deg: float, dist_m: float) -> Tuple[float,float]:
    """Offset point along a given bearing by dist_m on sphere."""
    R = 6371000.0
    br = math.radians(bearing_deg)
    dR = dist_m / R
    lat1, lon1 = math.radians(lat), math.radians(lon)
    lat2 = math.asin(math.sin(lat1)*math.cos(dR) + math.cos(lat1)*math.sin(dR)*math.cos(br))
    lon2 = lon1 + math.atan2(math.sin(br)*math.sin(dR)*math.cos(lat1), math.cos(dR)-math.sin(lat1)*math.sin(lat2))
    return (math.degrees(lat2), math.degrees(lon2))

def propose_detour_waypoint(route_coords: List[List[float]], window: str, offset_m: float = 200.0) -> List[float]:
    """
    Find the highest-risk vertex; place a perpendicular offset waypoint (±90°) to go around it.
    Pick the side with lower sampled risk.
    """
    idx, _, (worst_lon, worst_lat) = worst_point(route_coords, window)
    # pick a neighbor to get local bearing; fall back to mid if at ends
    j = idx-1 if idx > 0 else min(idx+1, len(route_coords)-1)
    neighbor = route_coords[j]
    br = bearing_between((worst_lon, worst_lat), (neighbor[0], neighbor[1]))
    # perpendicular left/right
    left_b = (br + 90) % 360
    right_b = (br + 270) % 360
    ly, lx = offset_point(worst_lat, worst_lon, left_b, offset_m)
    ry, rx = offset_point(worst_lat, worst_lon, right_b, offset_m)
    # choose the lower risk side
    left_r = risk_at_safe(ly, lx, window)
    right_r = risk_at_safe(ry, rx, window)
    if left_r <= right_r:
        return [lx, ly]  # [lon,lat]
    else:
        return [rx, ry]

# ------------------------ Public FastAPI endpoint ------------------------

class AddressRouteReq(BaseModel):
    start_address: str
    end_address: str
    time_window: Literal["day","evening","night"] = "day"
    alpha: float = Field(1.0, ge=0, le=5)
    risk_threshold: float = Field(0.35, ge=0, le=1)   # if avg risk above this, try a detour
    detour_offset_m: float = Field(220.0, ge=50, le=600)

@app.post("/route/addresses", response_model=RouteResp)
def route_by_addresses(req: AddressRouteReq):
    """
    1) Geocode start & end
    2) Get Mapbox routes (with alternatives)
    3) Pick lowest (distance*0.7 + risk*alpha*0.3)
    4) If avg risk > threshold -> insert 1 detour waypoint around worst block and retry; pick best of original vs detoured
    """
    # 1) Geocode
    s_lon, s_lat = mapbox_geocode(req.start_address)
    e_lon, e_lat = mapbox_geocode(req.end_address)
    base_coords = [[s_lon, s_lat], [e_lon, e_lat]]

    # 2) Request routes
    routes = mapbox_directions(base_coords)
    if not routes:
        raise HTTPException(status_code=404, detail="No route found between addresses.")

    # 3) Score originals
    scored = []
    for r in routes[:3]:
        geom = r["geometry"]["coordinates"]
        dist_km = r["distance"] / 1000.0
        r_avg = route_avg_risk(geom, req.time_window)
        score = (dist_km * 0.7) + (r_avg * req.alpha * 0.3)
        scored.append(("orig", score, dist_km, r_avg, geom))

    # 4) If best original is too risky, try one detour via waypoint near the worst block
    best_orig = sorted(scored, key=lambda x: x[1])[0]
    _, _, dist_km_best, risk_avg_best, geom_best = best_orig

    if risk_avg_best >= req.risk_threshold:
        # Propose waypoint and call directions with waypoint
        wp = propose_detour_waypoint(geom_best, req.time_window, req.detour_offset_m)
        routes2 = mapbox_directions([ [s_lon, s_lat], wp, [e_lon, e_lat] ])
        for r in routes2[:3]:
            geom = r["geometry"]["coordinates"]
            dist_km = r["distance"] / 1000.0
            r_avg = route_avg_risk(geom, req.time_window)
            score = (dist_km * 0.7) + (r_avg * req.alpha * 0.3)
            scored.append(("detour", score, dist_km, r_avg, geom))

    # 5) Pick best overall
    best = sorted(scored, key=lambda x: x[1])[0]
    _, _, dist_km, risk_avg, geom = best
    steps = [Step(lat=lat, lon=lon) for lon, lat in geom]
    return RouteResp(geometry=steps, distance_km=round(dist_km,3), safety_score=round(risk_avg,3))
