/**
 * SafeStride - Data-Driven Route Optimization Platform
 * 
 * Main React application component that integrates crime data analysis
 * with interactive mapping to provide optimized, safe walking routes.
 * 
 * Features:
 * - Vancouver crime data integration (22,932+ records)
 * - Multiple route alternatives with safety scoring
 * - Interactive route comparison
 * - Transparent algorithm metrics and documentation
 */

import { useEffect, useRef, useState } from "react";
import mapboxgl from "mapbox-gl";
import axios from "axios";
import AddressAutocomplete from './components/AddressAutocomplete';
import RouteComparison from './components/RouteComparison';
import MetricsPanel from './components/MetricsPanel';
import CrimeHeatmap from './components/CrimeHeatmap';
import { loadCrimeData, createSpatialIndex } from './utils/CrimeDataParser';
import { optimizeRoutes } from './utils/RouteOptimizer';

// Initialize Mapbox with your access token from environment variables
mapboxgl.accessToken = import.meta.env.VITE_MAPBOX_TOKEN;

export default function App() {
  // Map references
  const mapContainer = useRef(null);
  const map = useRef(null);

  // Address state (for autocomplete components)
  const [startAddress, setStartAddress] = useState('');
  const [endAddress, setEndAddress] = useState('');
  const [startCoords, setStartCoords] = useState(null);
  const [endCoords, setEndCoords] = useState(null);

  // Crime data state
  const [crimeData, setCrimeData] = useState(null);
  const [spatialIndex, setSpatialIndex] = useState(null);
  const [crimeDataLoading, setCrimeDataLoading] = useState(true);

  // Route state
  const [routes, setRoutes] = useState([]);
  const [selectedRoute, setSelectedRoute] = useState(null);
  const [status, setStatus] = useState("");
  const [isLoading, setIsLoading] = useState(false);

  // UI state
  const [showMetrics, setShowMetrics] = useState(false);
  const [showHeatmap, setShowHeatmap] = useState(true); // Show heatmap by default

  /**
   * Initialize the Mapbox map on component mount
   * Centered on Vancouver, BC
   */
  useEffect(() => {
    if (map.current) return; // Prevent re-initialization

    map.current = new mapboxgl.Map({
      container: mapContainer.current,
      style: "mapbox://styles/mapbox/streets-v12",
      center: [-123.1207, 49.2827], // Vancouver coordinates
      zoom: 12,
    });
  }, []);

  /**
   * Load crime data on component mount
   */
  useEffect(() => {
    async function loadData() {
      try {
        setStatus("Loading crime data...");

        // Load crime data from public folder
        const crimes = await loadCrimeData('/crimedata_csv_AllNeighbourhoods_2025.csv');
        setCrimeData(crimes);

        // Create spatial index for fast queries
        const index = createSpatialIndex(crimes);
        setSpatialIndex(index);

        setStatus(`✅ Loaded ${crimes.length} crime records`);
        setCrimeDataLoading(false);
      } catch (error) {
        console.error('Failed to load crime data:', error);
        setStatus(`Error loading crime data: ${error.message}`);
        setCrimeDataLoading(false);
      }
    }

    loadData();
  }, []);

  /* ============================================
   * GEOCODING HELPER
   * ============================================ */

  /**
   * Convert an address string to geographic coordinates
   * @param {string} query - The address to geocode
   * @returns {Promise<[number, number]>} - [longitude, latitude]
   */
  const geocode = async (query) => {
    const url = `https://api.mapbox.com/geocoding/v5/mapbox.places/${encodeURIComponent(query)}.json`;
    const { data } = await axios.get(url, {
      params: {
        access_token: mapboxgl.accessToken,
        limit: 1,
        country: "CA",
        proximity: "-123.1207,49.2827", // Prioritize results near Vancouver
      },
    });

    if (!data.features?.length) {
      throw new Error(`No results found for: ${query}`);
    }

    return data.features[0].center; // [longitude, latitude]
  };

  /* ============================================
   * MAP VISUALIZATION FUNCTIONS
   * ============================================ */

  /**
   * Add or update routes on the map with color coding
   * @param {Array} routes - Array of route objects
   * @param {string} selectedId - ID of selected route
   */
  const updateRoutesOnMap = (routes, selectedId) => {
    const mapInstance = map.current;

    // Remove existing route layers
    for (let i = 0; i < 3; i++) {
      const layerId = `route-${i}`;
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(layerId)) {
        mapInstance.removeSource(layerId);
      }
    }

    // Add new routes
    routes.forEach((routeData, index) => {
      const layerId = `route-${index}`;
      const isSelected = routeData.id === selectedId;
      const isRecommended = routeData.isRecommended;

      // Color code by rank and selection
      let color, width, opacity;
      if (isSelected) {
        color = '#1e40af'; // Dark blue for selected
        width = 6;
        opacity = 1;
      } else if (isRecommended) {
        color = '#3b82f6'; // Blue for recommended
        width = 4;
        opacity = 0.7;
      } else {
        color = '#94a3b8'; // Gray for alternatives
        width = 3;
        opacity = 0.5;
      }

      const featureCollection = {
        type: "FeatureCollection",
        features: [{
          type: "Feature",
          properties: {},
          geometry: routeData.route.geometry
        }]
      };

      mapInstance.addSource(layerId, {
        type: "geojson",
        data: featureCollection
      });

      mapInstance.addLayer({
        id: layerId,
        type: "line",
        source: layerId,
        layout: {
          "line-join": "round",
          "line-cap": "round"
        },
        paint: {
          "line-width": width,
          "line-color": color,
          "line-opacity": opacity
        }
      });
    });
  };

  /**
   * Add or update a marker on the map
   * @param {string} key - Unique identifier for the marker (e.g., 'start' or 'end')
   * @param {[number, number]} lngLat - [longitude, latitude]
   * @param {string} color - Hex color for the marker
   */
  const updateMarker = (key, lngLat, color) => {
    const mapInstance = map.current;

    // Store markers on the map instance for easy access
    mapInstance.__markers = mapInstance.__markers || {};

    if (!mapInstance.__markers[key]) {
      // Create new marker
      mapInstance.__markers[key] = new mapboxgl.Marker({ color })
        .setLngLat(lngLat)
        .addTo(mapInstance);
    } else {
      // Update existing marker position
      mapInstance.__markers[key].setLngLat(lngLat);
    }
  };

  /**
   * Fit the map view to show all coordinates
   * @param {Array<[number, number]>} coords - Array of coordinates to fit
   */
  const fitMapToCoordinates = (coords) => {
    const mapInstance = map.current;

    // Create bounding box that contains all coordinates
    const bounds = coords.reduce(
      (bounds, coord) => bounds.extend(coord),
      new mapboxgl.LngLatBounds(coords[0], coords[0])
    );

    mapInstance.fitBounds(bounds, {
      padding: 60,
      duration: 600 // Smooth animation
    });
  };

  /* ============================================
   * USER ACTION HANDLERS
   * ============================================ */

  /**
   * Main function to build and display optimized routes
   * Uses crime data to generate and rank multiple route alternatives
   */
  const buildOptimizedRoutes = async () => {
    if (!spatialIndex) {
      setStatus("Crime data not yet loaded. Please wait...");
      return;
    }

    try {
      setIsLoading(true);
      setStatus("Looking up addresses...");
      setRoutes([]);
      setSelectedRoute(null);

      // Check if addresses are provided
      if (!startAddress || !endAddress) {
        throw new Error("Please enter both start and end addresses.");
      }

      // Use coordinates from autocomplete if available, otherwise geocode
      let start = startCoords;
      let end = endCoords;

      if (!start) {
        start = await geocode(startAddress);
      }
      if (!end) {
        end = await geocode(endAddress);
      }

      // Place markers on the map
      updateMarker("start", start, "#10b981");
      updateMarker("end", end, "#ef4444");

      // Get optimized routes with safety analysis
      setStatus("Optimizing routes for safety...");
      const optimizedRoutes = await optimizeRoutes(
        start,
        end,
        spatialIndex,
        mapboxgl.accessToken
      );

      if (optimizedRoutes.length === 0) {
        throw new Error("No routes found");
      }

      // Update state
      setRoutes(optimizedRoutes);
      setSelectedRoute(optimizedRoutes[0]); // Auto-select recommended route

      // Display all routes on map
      updateRoutesOnMap(optimizedRoutes, optimizedRoutes[0].id);

      // Fit map to show the recommended route
      const recommendedRoute = optimizedRoutes[0];
      fitMapToCoordinates(recommendedRoute.route.geometry.coordinates);

      setStatus(`✅ Found ${optimizedRoutes.length} route alternatives`);
      setIsLoading(false);
    } catch (error) {
      console.error(error);
      setStatus(error.message || "Something went wrong. Please try again.");
      setIsLoading(false);
    }
  };

  /**
   * Handle route selection from comparison panel
   * @param {Object} routeData - Selected route data
   */
  const handleRouteSelect = (routeData) => {
    setSelectedRoute(routeData);
    updateRoutesOnMap(routes, routeData.id);
    fitMapToCoordinates(routeData.route.geometry.coordinates);
  };

  /**
   * Clear all routes from the map and reset UI
   */
  const clearRoutes = () => {
    const mapInstance = map.current;

    // Remove all route layers and sources
    for (let i = 0; i < 3; i++) {
      const layerId = `route-${i}`;
      if (mapInstance.getLayer(layerId)) {
        mapInstance.removeLayer(layerId);
      }
      if (mapInstance.getSource(layerId)) {
        mapInstance.removeSource(layerId);
      }
    }

    // Reset state
    setRoutes([]);
    setSelectedRoute(null);
    setStatus("");
  };

  /* ============================================
   * RENDER
   * ============================================ */

  return (
    <>
      {/* Header */}
      <header style={headerStyle}>
        <div>
          <p style={taglineStyle}>Data-Driven Safe Walking Routes</p>
          <p style={subtextStyle}>Powered by VPD Crime Data Analysis</p>
        </div>
        <div style={logoStyle}>SafeStride</div>
      </header>

      {/* Main Layout */}
      <div style={mainLayoutStyle}>
        {/* Left Panel - Inputs and Route Comparison */}
        <div style={leftPanelStyle}>
          <div style={inputPanelStyle}>
            <h3 style={{ margin: 0 }}>Plan Your Route</h3>

            {/* Crime Data Status */}
            {crimeDataLoading && (
              <div style={loadingBannerStyle}>
                Loading crime data... ({crimeData?.length || 0} records)
              </div>
            )}

            {/* Start Address Input */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={labelStyle}>Start Address</label>
              <AddressAutocomplete
                placeholder="e.g., 1055 Canada Place, Vancouver"
                onSelect={(address, coords) => {
                  setStartAddress(address);
                  setStartCoords(coords);
                }}
                disabled={crimeDataLoading}
                accessToken={mapboxgl.accessToken}
              />
            </div>

            {/* End Address Input */}
            <div style={{ display: "grid", gap: 6 }}>
              <label style={labelStyle}>Destination Address</label>
              <AddressAutocomplete
                placeholder="e.g., 800 Robson St, Vancouver"
                onSelect={(address, coords) => {
                  setEndAddress(address);
                  setEndCoords(coords);
                }}
                disabled={crimeDataLoading}
                accessToken={mapboxgl.accessToken}
              />
            </div>

            {/* Action Buttons */}
            <div style={{ display: "flex", gap: 8 }}>
              <button
                onClick={buildOptimizedRoutes}
                style={{ ...primaryButtonStyle, opacity: crimeDataLoading ? 0.5 : 1 }}
                disabled={crimeDataLoading || isLoading}
              >
                {isLoading ? 'Analyzing...' : 'Find Safe Routes'}
              </button>
              <button onClick={clearRoutes} style={secondaryButtonStyle}>
                Clear
              </button>
            </div>

            {/* Metrics Toggle */}
            {/* {routes.length > 0 && (
              <button
                onClick={() => setShowMetrics(!showMetrics)}
                style={metricsButtonStyle}
              >
                {showMetrics ? '📊 Hide' : '📊 Show'} Algorithm Details
              </button>
            )} */}

            {/* Heatmap Toggle */}
            {crimeData && (
              <button
                onClick={() => setShowHeatmap(!showHeatmap)}
                style={{
                  ...metricsButtonStyle,
                  borderColor: showHeatmap ? '#ef4444' : '#e5e7eb',
                  background: showHeatmap ? '#fee2e2' : '#ffffff',
                  color: showHeatmap ? '#991b1b' : '#6b7280'
                }}
              >
                {showHeatmap ? '🔥 Hide' : '🔥 Show'} Crime Hotspots
              </button>
            )}

            {/* Status Message */}
            <div style={statusStyle}>{status}</div>
          </div>

          {/* Route Comparison Panel */}
          {routes.length > 0 && (
            <RouteComparison
              routes={routes}
              onRouteSelect={handleRouteSelect}
              selectedRouteId={selectedRoute?.id}
            />
          )}

          {/* Metrics Panel */}
          {routes.length > 0 && (
            <MetricsPanel
              routes={routes}
              isVisible={showMetrics}
            />
          )}
        </div>

        {/* Map Container */}
        <div ref={mapContainer} style={mapStyle} />
      </div>

      {/* Crime Heatmap Layer */}
      <CrimeHeatmap
        map={map.current}
        crimeData={crimeData}
        isVisible={showHeatmap}
      />
    </>
  );
}

/* ============================================
 * STYLES
 * ============================================ */

const headerStyle = {
  display: "flex",
  justifyContent: "space-between",
  alignItems: "center",
  padding: "1rem 1.5rem",
  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
  boxShadow: "0 2px 8px rgba(0,0,0,0.15)",
  borderRadius: "12px",
};

const taglineStyle = {
  color: "#ffffff",
  fontSize: "1.1rem",
  fontWeight: "bold",
  margin: 0,
};

const subtextStyle = {
  color: "#dbeafe",
  fontSize: "0.85rem",
  margin: "4px 0 0 0",
};

const logoStyle = {
  fontWeight: "bold",
  fontSize: "1.8rem",
  color: "#ffffff",
};

const mainLayoutStyle = {
  display: "grid",
  gridTemplateColumns: "420px 1fr",
  gap: 16,
  height: "calc(100vh - 100px)",
  width: "100vw",
  padding: 16,
  boxSizing: "border-box",
};

const leftPanelStyle = {
  display: "flex",
  width: 500,
  flexDirection: "column",
  gap: 16,
  overflowY: "auto",
  maxHeight: "100%",
};

const inputPanelStyle = {
  background: "#ffffff",
  borderRadius: 12,
  padding: 16,
  boxShadow: "0 2px 8px rgba(0,0,0,0.1)",
  display: "grid",
  gap: 12,
};

const loadingBannerStyle = {
  background: "#dbeafe",
  color: "#1e40af",
  padding: "8px 12px",
  borderRadius: 8,
  fontSize: 13,
  fontWeight: 500,
  textAlign: "center",
};

const labelStyle = {
  fontSize: 14,
  fontWeight: 600,
  color: "#374151",
};

const primaryButtonStyle = {
  flex: 1,
  padding: "12px 16px",
  border: 0,
  borderRadius: 8,
  background: "linear-gradient(135deg, #1e40af 0%, #3b82f6 100%)",
  color: "#fff",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
  transition: "transform 0.1s",
};

const secondaryButtonStyle = {
  padding: "12px 16px",
  border: "2px solid #e5e7eb",
  borderRadius: 8,
  background: "#ffffff",
  color: "#374151",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 14,
};

const metricsButtonStyle = {
  padding: "10px 14px",
  border: "2px solid #3b82f6",
  borderRadius: 8,
  background: "#eff6ff",
  color: "#1e40af",
  cursor: "pointer",
  fontWeight: 600,
  fontSize: 13,
  width: "100%",
};

const statusStyle = {
  fontSize: 12,
  color: "#6b7280",
  minHeight: 18,
  fontWeight: 500,
};

const mapStyle = {
  width: "95%",
  height: "100%",
  marginLeft: "auto",
  borderRadius: 12,
  overflow: "hidden",
  boxShadow: "0 4px 16px rgba(0,0,0,0.15)",
};
