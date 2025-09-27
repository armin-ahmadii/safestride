import { useEffect, useRef } from 'react';
import mapboxgl from 'mapbox-gl';
import axios from 'axios';

mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  const mapContainer = useRef(null);
  const map = useRef(null);

  useEffect(() => {
  if (map.current) return;

  map.current = new mapboxgl.Map({
    container: mapContainer.current,
    style: 'mapbox://styles/mapbox/streets-v11',
    center: [-123.1207, 49.2827],
    zoom: 12
  });

async function getRoute(start, end) {
  const url = `https://api.mapbox.com/directions/v5/mapbox/walking/${start.lng},${start.lat};${end.lng},${end.lat}?geometries=geojson&access_token=${mapboxgl.accessToken}`;
  const res = await fetch(url);
  const data = await res.json();
  const route = data.routes[0].geometry;
  map.current.addSource('route', {
    type: 'geojson',
    data: { type: 'Feature', geometry: route }
  });
  map.current.addLayer({
    id: 'route',
    type: 'line',
    source: 'route',
    paint: { 'line-color': '#007AFF', 'line-width': 4 }
  });
}

}, []);


  return <div ref={mapContainer} style={{width:'100%', height:'100vh'}} />;
}
