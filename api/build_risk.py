# Usage:
#   cd api
#   python -m venv .venv && source .venv/bin/activate
#   pip install -r requirements.txt
#   python build_risk.py

import os, json
import numpy as np
import pandas as pd
from pyproj import Transformer

# --- CONFIG ---
CSV_PATH = "/crimedata_csv_AllNeighbourhoods_2025.csv"  # put your CSV here
OUT_JSON = "./data/risk_grid.json"
CELL_DEG = 0.0016  # ~175 m at Vancouver lat; keep simple for MVP

#/crimedata_csv_AllNeighbourhoods_2025.csv
SEVERITY = {
    "Assault": 1.0,
    "Robbery": 0.9,
    "Break and Enter Residential/Other": 0.7,
    "Break and Enter Commercial": 0.6,
    "Theft of Vehicle": 0.5,
    "Theft from Auto": 0.3,
    "Theft of Bicycle": 0.2,
    "Mischief": 0.2
}

# --- 1) Load CSV ---
df = pd.read_csv(CSV_PATH).rename(columns={
    "TYPE":"type","YEAR":"year","MONTH":"month","DAY":"day",
    "HOUR":"hour","MINUTE":"minute","X":"x","Y":"y"
})
df = df.dropna(subset=["x","y"]).copy()

# --- 2) Projected -> lat/lon ---
# Vancouver GeoDASH uses projected X/Y. Convert to WGS84 lat/lon.
# Most exports are UTM Zone 10N (EPSG:32610) or NAD83 / UTM10 (EPSG:26910). 32610 is fine for MVP.
transformer = Transformer.from_crs("EPSG:32610", "EPSG:4326", always_xy=True)
lon, lat = transformer.transform(df["x"].values, df["y"].values)
df["lat"] = lat
df["lon"] = lon

# --- 3) Datetime + daypart buckets ---
df["hour"] = df["hour"].fillna(0).astype(int)
df["minute"] = df["minute"].fillna(0).astype(int)
df["dt"] = pd.to_datetime(dict(
    year=df["year"], month=df["month"], day=df["day"], hour=df["hour"], minute=df["minute"]
), errors="coerce")
df = df.dropna(subset=["dt"]).copy()

bins = [0,6,18,24]; labels = ["night","day","evening"]
df["window"] = pd.cut(df["hour"], bins=bins, labels=labels, right=False).astype(str)

# --- 4) Weights + recency decay ---
df["w"] = df["type"].map(SEVERITY).fillna(0.3)
days_ago = (df["dt"].max() - df["dt"]).dt.days.clip(lower=0)
df["decay"] = np.exp(-days_ago / 90.0)
df["score"] = df["w"] * df["decay"]

# --- 5) Simple square grid (~175 m cells) ---
def key_for(lat, lon, cell=CELL_DEG):
    lat_bin = float(np.floor(lat / cell) * cell)
    lon_bin = float(np.floor(lon / cell) * cell)
    return f"{lat_bin:.6f}_{lon_bin:.6f}"

df["cell_key"] = [key_for(a, b) for a, b in zip(df["lat"], df["lon"])]

grp = (df.groupby(["window","cell_key"])
         .agg(risk=("score","sum"), n=("score","size"))
         .reset_index())

# Normalize risk to [0,1] per time window
grp["norm"] = grp.groupby("window")["risk"].transform(
    lambda s: (s - s.min()) / (s.max() - s.min() + 1e-9)
)

# --- 6) Save compact JSON for the backend ---
os.makedirs("./data", exist_ok=True)
risk_json = { w: { r.cell_key: float(r.norm) for _, r in sub.iterrows() }
              for w, sub in grp.groupby("window") }

with open(OUT_JSON, "w") as f:
    json.dump({
        "meta": { "grid": "latlon_square", "cell_size_deg": CELL_DEG },
        "risk": risk_json
    }, f)

print(f"Wrote {OUT_JSON} with {sum(len(v) for v in risk_json.values())} cells")
