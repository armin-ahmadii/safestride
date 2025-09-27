import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  // NEW: refs for inputs (uncontrolled)
  const startRef = useRef(null);
  const endRef   = useRef(null);

  const [status, setStatus] = useState("");
  const [stats, setStats]   = useState(null); // { km, min }

  useEffect(() => {
    if (map.current) return;
    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-123.1207, 49.2827],
      zoom: 12,
    });
  }, []);

  // --- helpers ---
  const geocode = async (q) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(q)}.json`;
    const { data } = await axios.get(url, {
      params: {
        access_token: mapboxgl.accessToken,
        limit: 1,
        country: "CA",
        proximity: "-123.1207,49.2827",
      },
    });
    if (!data.features?.length) throw new Error(`No results for: ${q}`);
    return data.features[0].center; // [lng, lat]
  };

  const getWalkingRoute = async ([lon1, lat1], [lon2, lat2]) => {
    const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${lon1},${lat1};${lon2},${lat2}`;
    const { data } = await axios.get(url, {
      params: {
        access_token: mapboxgl.accessToken,
        geometries: "geojson",
        overview: "full",
        alternatives: true,
        steps: false,
        exclude: "ferry",
      },
    });
    return data.routes?.[0] ?? null;
  };

  const upsertRoute = (feature) => {
    const m = map.current;
    const id = "route";
    const fc = { type: "FeatureCollection", features: [feature] };
    if (!m.getSource(id)) {
      m.addSource(id, { type: "geojson", data: fc });
      m.addLayer({
        id,
        type: "line",
        source: id,
        layout: { "line-join": "round", "line-cap": "round" },
        paint: { "line-width": 4, "line-color": "#1e40af" },
      });
    } else {
      m.getSource(id).setData(fc);
    }
  };

  const upsertMarker = (key, lngLat, color) => {
    const m = map.current;
    m.__markers = m.__markers || {};
    if (!m.__markers[key]) {
      m.__markers[key] = new mapboxgl.Marker({ color }).setLngLat(lngLat).addTo(m);
    } else {
      m.__markers[key].setLngLat(lngLat);
    }
  };

  const fitTo = (coords) => {
    const m = map.current;
    const b = coords.reduce(
      (bounds, c) => bounds.extend(c),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );
    m.fitBounds(b, { padding: 60, duration: 600 });
  };

  const buildRoute = async () => {
    try {
      setStatus("Geocoding…");
      setStats(null);

      const startAddr = startRef.current?.value?.trim();
      const endAddr   = endRef.current?.value?.trim();
      if (!startAddr || !endAddr) throw new Error("Enter both start and end addresses.");

      const start = await geocode(startAddr);
      const end   = await geocode(endAddr);

      upsertMarker("start", start, "#111");
      upsertMarker("end",   end,   "#666");

      setStatus("Requesting walking route…");
      const best = await getWalkingRoute(start, end);
      if (!best) return setStatus("No pedestrian route found.");

      const coords = best.geometry.coordinates;

      setStatus("Finding neighborhoods along route…");
      const hoods = await getRouteNeighborhoods(coords);

      upsertRoute({
        type: "Feature",
        properties: {
          distance_km: best.distance / 1000,
          duration_min: best.duration / 60,
        },
        geometry: { type: "LineString", coordinates: coords },
      });
      // Get neighborhoods for start and end
      const startHood = await getNeighborhood(start);
      const endHood   = await getNeighborhood(end);

      fitTo(coords);
      setStats({
        km: best.distance / 1000,
        min: best.duration / 60,
        neighborhoods: hoods
      });
      setStatus("Done ✅");
    } catch (err) {
      console.error(err);
      setStatus(err.message || "Something went wrong");
    }
  };

  const clearRoute = () => {
    const m = map.current;
    if (m.getLayer("route")) m.removeLayer("route");
    if (m.getSource("route")) m.removeSource("route");
    setStats(null);
    setStatus("");
  };

  const getNeighborhood = async ([lon, lat]) => {
  const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${lon},${lat}.json`;
  const { data } = await axios.get(url, {
    params: {
      access_token: mapboxgl.accessToken,
      types: "neighborhood,locality", // you can add place, region, postcode
    },
    });
    if (data.features?.length) {
      return data.features[0].text; // e.g., "Kitsilano"
    }
    return null;
  };

  const getRouteNeighborhoods = async (coords) => {
    const sampleEvery = 15; // pick every 5th coordinate (tweak for density)
    const samples = coords.filter((_, i) => i % sampleEvery === 0);

    const names = [];
    for (let point of samples) {
      const name = await getNeighborhood(point);
      if (name && !names.includes(name)) {
        names.push(name);
      }
    }
    return names;
  };



  return (
    <>
    <header style={{display:"flex", justifyContent:"space-between", alignItems:"center", padding:"1rem", background:"#0000004d", boxShadow:"0 2px 4px rgba(0,0,0,0.1)", borderRadius:"12px"}}>
      <p style={{ color: "#ff3232ff", fontSize:"1.0rem", fontWeight:"bold"}}>Run Smarter. Run Faster.</p>
      <nav style={{display:"flex", gap:"1rem"}}>
        <div style={{fontWeight:"bold", fontSize:"1.5rem", color:"#ff3232ff"}}>SafeStride</div>
      </nav>
    </header>
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "minmax(320px, 360px) 1fr",
        gap: 16,
        height: "100vh",
        width: "100vw",
        padding: 16,
        boxSizing: "border-box",
      }}
    >
      {/* Left panel */}
      <div
        style={{
          background: "#00000020",
          borderRadius: 12,
          padding: 12,
          boxShadow: "0 4px 12px rgba(0,0,0,0.15)",
          display: "grid",
          gap: 10,
          alignContent: "start",
        }}
      >
        <h3 style={{ margin: 0 }}>Where are you running to?</h3>

        {/* START (input must be direct child of mapbox-address-autofill) */}
        <div style={{ display: "grid", gap: 6 }}>
          <label>Start</label>
          <mapbox-address-autofill
            access-token={mapboxgl.accessToken}
            country="CA"
            options='{"language":"en"}'
          >
            <input
              ref={startRef}
              placeholder="123 Main St, Vancouver"
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8, width: "100%" }}
            />
          </mapbox-address-autofill>
        </div>

        {/* END (same structure) */}
        <div style={{ display: "grid", gap: 6 }}>
          <label>End</label>
          <mapbox-address-autofill
            access-token={mapboxgl.accessToken}
            country="CA"
            options='{"language":"en"}'
          >
            <input
              ref={endRef}
              placeholder="456 Kingsway, Vancouver"
              style={{ padding: 8, border: "1px solid #ddd", borderRadius: 8, width: "100%" }}
            />
          </mapbox-address-autofill>
        </div>

        <div style={{ display: "flex", gap: 8 }}>
          <button onClick={buildRoute} style={btnStyle}>Show Walking Route</button>
          <button onClick={clearRoute} style={{ ...btnStyle, background: "#eee", color: "#111" }}>
            Clear
          </button>
        </div>

        <div style={{ fontSize: 12, color: "#444", minHeight: 18 }}>{status}</div>
        {stats && (
          <div style={{ fontSize: 14 }}>
            <div><b>Distance:</b> {stats.km.toFixed(2)} km</div>
            <div><b>Duration:</b> {Math.round(stats.min)} min</div>
            <div><b>Neighbourhoods:</b> {stats.neighborhoods.join(" → ")}</div>
          </div>
        )}
      </div>

      {/* Map */}
      <div
        ref={mapContainer}
        style={{
          width: "100%",
          height: "100%",
          borderRadius: 12,
          overflow: "hidden",
          boxShadow: "0 4px 12px #0000004d",
        }}
      />
    </div>
    </>
  );
}

const btnStyle = {
  padding: "10px 12px",
  border: 0,
  borderRadius: 10,
  background: "#111",
  color: "#fff",
  cursor: "pointer",
};
