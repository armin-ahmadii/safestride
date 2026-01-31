/**
 * CrimeHeatmap Component
 * 
 * React component that manages the crime heatmap layer on Mapbox.
 * Visualizes crime density and hotspots across Vancouver.
 */

import { useEffect } from 'react';
import './CrimeHeatmap.css';

export default function CrimeHeatmap({
    map,
    crimeData,
    isVisible = true
}) {
    useEffect(() => {
        if (!map || !crimeData || crimeData.length === 0) return;

        const HEATMAP_SOURCE_ID = 'crime-heatmap-source';
        const HEATMAP_LAYER_ID = 'crime-heatmap-layer';
        const CRIME_POINTS_LAYER_ID = 'crime-points-layer';

        // Convert crime data to GeoJSON format
        const geojsonData = {
            type: 'FeatureCollection',
            features: crimeData.map(crime => ({
                type: 'Feature',
                properties: {
                    severity: crime.severityWeight,  // Use severityWeight (1.0, 2.0, 3.0)
                    type: crime.type
                },
                geometry: {
                    type: 'Point',
                    coordinates: [crime.location.coordinates.lng, crime.location.coordinates.lat]
                }
            }))
        };

        // Remove existing layers if they exist
        if (map.getLayer(HEATMAP_LAYER_ID)) {
            map.removeLayer(HEATMAP_LAYER_ID);
        }
        if (map.getLayer(CRIME_POINTS_LAYER_ID)) {
            map.removeLayer(CRIME_POINTS_LAYER_ID);
        }
        if (map.getSource(HEATMAP_SOURCE_ID)) {
            map.removeSource(HEATMAP_SOURCE_ID);
        }

        // Add source
        map.addSource(HEATMAP_SOURCE_ID, {
            type: 'geojson',
            data: geojsonData
        });

        // Add heatmap layer
        map.addLayer({
            id: HEATMAP_LAYER_ID,
            type: 'heatmap',
            source: HEATMAP_SOURCE_ID,
            maxzoom: 15,
            paint: {
                // Increase weight for higher severity crimes
                'heatmap-weight': [
                    'interpolate',
                    ['linear'],
                    ['get', 'severity'],
                    1.0, 0.3,  // Low severity
                    2.0, 0.6,  // Medium severity
                    3.0, 1.0   // High severity
                ],
                // Increase intensity as zoom increases
                'heatmap-intensity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 0.5,
                    15, 1.5
                ],
                // Color ramp: blue -> yellow -> orange -> red
                'heatmap-color': [
                    'interpolate',
                    ['linear'],
                    ['heatmap-density'],
                    0, 'rgba(33, 102, 172, 0)',
                    0.2, 'rgb(103, 169, 207)',
                    0.4, 'rgb(209, 229, 240)',
                    0.6, 'rgb(253, 219, 199)',
                    0.8, 'rgb(239, 138, 98)',
                    1, 'rgb(178, 24, 43)'
                ],
                // Radius of each point
                'heatmap-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    0, 2,
                    15, 20
                ],
                // Opacity
                'heatmap-opacity': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    7, 0.7,
                    15, 0.5
                ]
            }
        });

        // Add circle layer for individual crimes at high zoom
        map.addLayer({
            id: CRIME_POINTS_LAYER_ID,
            type: 'circle',
            source: HEATMAP_SOURCE_ID,
            minzoom: 13,
            paint: {
                // Color based on severity
                'circle-color': [
                    'match',
                    ['get', 'severity'],
                    3.0, '#ef4444', // High - red
                    2.0, '#f97316', // Medium - orange
                    '#fbbf24'       // Low - yellow
                ],
                'circle-radius': [
                    'interpolate',
                    ['linear'],
                    ['zoom'],
                    13, 3,
                    16, 6
                ],
                'circle-opacity': 0.6,
                'circle-stroke-width': 1,
                'circle-stroke-color': '#ffffff'
            }
        });

        // Toggle visibility based on prop
        map.setLayoutProperty(
            HEATMAP_LAYER_ID,
            'visibility',
            isVisible ? 'visible' : 'none'
        );
        map.setLayoutProperty(
            CRIME_POINTS_LAYER_ID,
            'visibility',
            isVisible ? 'visible' : 'none'
        );

        // Add popup on click
        map.on('click', CRIME_POINTS_LAYER_ID, (e) => {
            if (e.features && e.features.length > 0) {
                const feature = e.features[0];
                const coordinates = feature.geometry.coordinates.slice();
                const { type, severity } = feature.properties;

                const severityLabel = severity === 3 ? 'High' : severity === 2 ? 'Medium' : 'Low';

                new window.mapboxgl.Popup()
                    .setLngLat(coordinates)
                    .setHTML(`
            <div style="padding: 4px;">
              <strong>${type}</strong><br/>
              <span style="color: ${severity === 3 ? '#ef4444' : severity === 2 ? '#f97316' : '#fbbf24'}">
                ${severityLabel} Severity
              </span>
            </div>
          `)
                    .addTo(map);
            }
        });

        // Change cursor on hover
        map.on('mouseenter', CRIME_POINTS_LAYER_ID, () => {
            map.getCanvas().style.cursor = 'pointer';
        });

        map.on('mouseleave', CRIME_POINTS_LAYER_ID, () => {
            map.getCanvas().style.cursor = '';
        });

        // Cleanup
        return () => {
            if (map.getLayer(HEATMAP_LAYER_ID)) {
                map.off('click', CRIME_POINTS_LAYER_ID);
                map.off('mouseenter', CRIME_POINTS_LAYER_ID);
                map.off('mouseleave', CRIME_POINTS_LAYER_ID);
            }
        };
    }, [map, crimeData, isVisible]);

    return null; // This component doesn't render any DOM elements
}
