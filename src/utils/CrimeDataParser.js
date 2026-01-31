/**
 * Crime Data Parser
 * 
 * Loads and parses Vancouver Police Department crime data CSV,
 * converting it into a structured format for route safety analysis.
 * 
 * Data Source: Vancouver Police Department Crime Data (2025)
 * Total Records: ~22,932 crime incidents
 */

import Papa from 'papaparse';
import proj4 from 'proj4';

// Define UTM Zone 10N NAD83 projection (used by Vancouver Police Department)
const utm10n = '+proj=utm +zone=10 +ellps=GRS80 +datum=NAD83 +units=m +no_defs';
// Define WGS84 (standard lat/lng used by Mapbox)
const wgs84 = '+proj=longlat +datum=WGS84 +no_defs';

/**
 * Crime severity classification based on VPD crime categories
 * Used to weight different crime types in safety calculations
 */
export const CRIME_SEVERITY = {
    // High severity crimes (weight: 3.0)
    HIGH: {
        weight: 3.0,
        types: [
            'Homicide',
            'Offence Against a Person',
            'Vehicle Collision or Pedestrian Struck (with Fatality)',
            'Vehicle Collision or Pedestrian Struck (with Injury)',
        ]
    },
    // Medium severity crimes (weight: 2.0)
    MEDIUM: {
        weight: 2.0,
        types: [
            'Break and Enter Commercial',
            'Break and Enter Residential/Other',
            'Theft of Vehicle',
        ]
    },
    // Low severity crimes (weight: 1.0)
    LOW: {
        weight: 1.0,
        types: [
            'Theft from Vehicle',
            'Theft of Bicycle',
            'Other Theft',
            'Mischief',
        ]
    }
};

/**
 * Get severity level and weight for a crime type
 * @param {string} crimeType - The crime type from the CSV
 * @returns {{level: string, weight: number}} Severity level and weight
 */
export function getCrimeSeverity(crimeType) {
    for (const [level, config] of Object.entries(CRIME_SEVERITY)) {
        if (config.types.includes(crimeType)) {
            return { level, weight: config.weight };
        }
    }
    // Default to LOW severity for unknown types
    return { level: 'LOW', weight: 1.0 };
}

/**
 * Convert UTM coordinates (NAD83) to latitude/longitude using proj4
 * Vancouver uses UTM Zone 10N NAD83
 * 
 * @param {number} x - UTM Easting (X coordinate)
 * @param {number} y - UTM Northing (Y coordinate)
 * @returns {[number, number]} [longitude, latitude]
 */
export function utmToLatLng(x, y) {
    // Use proj4 for accurate coordinate transformation
    // Input: [easting, northing] in UTM Zone 10N NAD83
    // Output: [longitude, latitude] in WGS84
    const [longitude, latitude] = proj4(utm10n, wgs84, [x, y]);
    return [longitude, latitude];
}

/**
 * Parse a single crime record from CSV
 * @param {Object} row - Raw CSV row object
 * @returns {Object} Parsed crime record
 */
function parseCrimeRecord(row) {
    const x = parseFloat(row.X);
    const y = parseFloat(row.Y);
    const [lng, lat] = utmToLatLng(x, y);

    const severity = getCrimeSeverity(row.TYPE);

    // Create date from components
    const date = new Date(
        parseInt(row.YEAR),
        parseInt(row.MONTH) - 1, // Month is 0-indexed in JS
        parseInt(row.DAY),
        parseInt(row.HOUR || 0),
        parseInt(row.MINUTE || 0)
    );

    return {
        type: row.TYPE,
        severity: severity.level,
        severityWeight: severity.weight,
        date: date,
        timestamp: date.getTime(),
        location: {
            address: row.HUNDRED_BLOCK,
            neighborhood: row.NEIGHBOURHOOD,
            coordinates: {
                lng,
                lat,
                utm: { x, y }
            }
        }
    };
}

/**
 * Load and parse crime data from CSV file
 * @param {string} csvPath - Path to the crime data CSV file
 * @returns {Promise<Array>} Array of parsed crime records
 */
export async function loadCrimeData(csvPath) {
    return new Promise((resolve, reject) => {
        Papa.parse(csvPath, {
            download: true,
            header: true,
            skipEmptyLines: true,
            complete: (results) => {
                try {
                    const crimes = results.data
                        .filter(row => row.TYPE && row.TYPE !== 'TYPE') // Filter out header/empty rows
                        .map(parseCrimeRecord);

                    console.log(`✅ Loaded ${crimes.length} crime records`);
                    resolve(crimes);
                } catch (error) {
                    reject(new Error(`Failed to parse crime data: ${error.message}`));
                }
            },
            error: (error) => {
                reject(new Error(`Failed to load crime data: ${error.message}`));
            }
        });
    });
}

/**
 * Create a spatial index for fast proximity queries
 * Groups crimes into a grid for efficient "find crimes near point" queries
 * 
 * @param {Array} crimes - Array of crime records
 * @param {number} gridSize - Size of grid cells in degrees (default: 0.01 ≈ 1km)
 * @returns {Map} Spatial index mapping grid cells to crimes
 */
export function createSpatialIndex(crimes, gridSize = 0.01) {
    const index = new Map();

    for (const crime of crimes) {
        const { lng, lat } = crime.location.coordinates;

        // Calculate grid cell
        const cellX = Math.floor(lng / gridSize);
        const cellY = Math.floor(lat / gridSize);
        const cellKey = `${cellX},${cellY}`;

        if (!index.has(cellKey)) {
            index.set(cellKey, []);
        }
        index.get(cellKey).push(crime);
    }

    console.log(`📍 Created spatial index with ${index.size} grid cells`);
    return index;
}

/**
 * Find crimes within a radius of a point using spatial index
 * @param {Map} spatialIndex - Spatial index created by createSpatialIndex
 * @param {number} lng - Longitude
 * @param {number} lat - Latitude
 * @param {number} radiusMeters - Search radius in meters
 * @param {number} gridSize - Grid size used in index (must match createSpatialIndex)
 * @returns {Array} Crimes within radius
 */
export function findCrimesNearPoint(spatialIndex, lng, lat, radiusMeters = 100, gridSize = 0.01) {
    const nearbyCrimes = [];

    // Convert radius to degrees (approximate)
    const radiusDegrees = radiusMeters / 111000; // 1 degree ≈ 111km

    // Check this cell and adjacent cells
    const centerX = Math.floor(lng / gridSize);
    const centerY = Math.floor(lat / gridSize);
    const cellsToCheck = Math.ceil(radiusDegrees / gridSize);

    for (let dx = -cellsToCheck; dx <= cellsToCheck; dx++) {
        for (let dy = -cellsToCheck; dy <= cellsToCheck; dy++) {
            const cellKey = `${centerX + dx},${centerY + dy}`;
            const crimesInCell = spatialIndex.get(cellKey) || [];

            // Filter by actual distance
            for (const crime of crimesInCell) {
                const distance = calculateDistance(
                    lat, lng,
                    crime.location.coordinates.lat,
                    crime.location.coordinates.lng
                );

                if (distance <= radiusMeters) {
                    nearbyCrimes.push({ ...crime, distanceMeters: distance });
                }
            }
        }
    }

    return nearbyCrimes;
}

/**
 * Calculate distance between two lat/lng points using Haversine formula
 * @param {number} lat1 - Latitude of point 1
 * @param {number} lng1 - Longitude of point 1
 * @param {number} lat2 - Latitude of point 2
 * @param {number} lng2 - Longitude of point 2
 * @returns {number} Distance in meters
 */
export function calculateDistance(lat1, lng1, lat2, lng2) {
    const R = 6371000; // Earth radius in meters
    const φ1 = lat1 * Math.PI / 180;
    const φ2 = lat2 * Math.PI / 180;
    const Δφ = (lat2 - lat1) * Math.PI / 180;
    const Δλ = (lng2 - lng1) * Math.PI / 180;

    const a = Math.sin(Δφ / 2) * Math.sin(Δφ / 2) +
        Math.cos(φ1) * Math.cos(φ2) *
        Math.sin(Δλ / 2) * Math.sin(Δλ / 2);
    const c = 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

    return R * c;
}

/**
 * Get crime statistics by neighborhood
 * @param {Array} crimes - Array of crime records
 * @returns {Object} Statistics by neighborhood
 */
export function getCrimeStatsByNeighborhood(crimes) {
    const stats = {};

    for (const crime of crimes) {
        const hood = crime.location.neighborhood;
        if (!stats[hood]) {
            stats[hood] = {
                total: 0,
                high: 0,
                medium: 0,
                low: 0,
                types: {}
            };
        }

        stats[hood].total++;
        stats[hood][crime.severity.toLowerCase()]++;

        if (!stats[hood].types[crime.type]) {
            stats[hood].types[crime.type] = 0;
        }
        stats[hood].types[crime.type]++;
    }

    return stats;
}
