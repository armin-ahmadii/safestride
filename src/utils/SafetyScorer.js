/**
 * Safety Scorer
 * 
 * Calculates safety scores for walking routes based on crime data analysis.
 * Uses crime density, severity, proximity, and temporal decay to generate
 * a normalized safety score (0-100, where 100 is safest).
 * 
 * Algorithm:
 * 1. Sample points along the route (every 50 meters)
 * 2. For each point, find crimes within specified radius (default: 100m)
 * 3. Calculate crime exposure based on severity, distance, and recency
 * 4. Normalize by route length
 * 5. Convert to 0-100 safety score
 */

import { findCrimesNearPoint, calculateDistance } from './CrimeDataParser.js';

/**
 * Configuration for safety scoring algorithm
 * 
 * This configuration controls how we analyze walking routes for safety.
 * Think of it like a risk assessment tool - we're looking at how many crimes
 * happened nearby, how serious they were, and how recently they occurred.
 */
export const SAFETY_CONFIG = {
    // How often to sample points along the route (meters)
    // We check crime density every 50 meters - like taking safety "snapshots"
    SAMPLE_INTERVAL_METERS: 50,

    // Search radius around each sample point (meters)
    // We look at crimes within 100 meters of each point (about 1 city block)
    CRIME_SEARCH_RADIUS: 100,

    // Time decay parameters (crimes get less weight over time)
    // Newer crimes are more relevant for predicting current safety
    TIME_DECAY: {
        // Half-life in days (crimes older than this are weighted 50%)
        // After 90 days, a crime's relevance drops by half
        HALF_LIFE_DAYS: 90,
        // Maximum age to consider (crimes older than this are ignored)
        // We only look at crimes from the past year
        MAX_AGE_DAYS: 365
    },

    // Calibration factor to convert exposure to safety score
    // This is tuned based on Vancouver's actual crime density patterns
    // Higher value = more sensitive to crime (lower scores in high-crime areas)
    // With inverse-distance weighting, exposure values can reach 1000+
    // A factor of 20.0 creates meaningful differentiation between routes:
    // - Very low crime (exposure ~20): ~100/100 (Excellent - Very safe route)
    // - Low crime route (exposure ~50): ~80/100 (Good - Generally safe)
    // - Medium crime route (exposure ~100): ~60/100 (Fair - Moderate concerns)
    // - High crime route (exposure ~200): ~40/100 (Caution - Higher risk)
    // - Very high crime route (exposure ~300+): ~20/100 or less (High Risk - Avoid)
    CALIBRATION_FACTOR: 20.0,

    // Composite scoring weights (must sum to 1.0)
    // When comparing routes, we balance safety, time, and distance
    COMPOSITE_WEIGHTS: {
        safety: 0.4,    // 40% weight on safety score
        time: 0.3,      // 30% weight on duration
        distance: 0.3   // 30% weight on distance
    }
};

/**
 * Calculate temporal decay factor for a crime
 * 
 * Think of this like milk expiring - recent crimes are "fresher" and more
 * relevant to today's safety. A crime from last week tells us more about
 * current conditions than a crime from 11 months ago.
 * 
 * We use exponential decay, which is like radioactive half-life:
 * - After 90 days, a crime is 50% as relevant
 * - After 180 days, it's 25% as relevant
 * - After 1 year, we ignore it completely
 * 
 * @param {number} crimeTimestamp - When the crime occurred (milliseconds since epoch)
 * @param {number} currentTimestamp - Current time (defaults to now)
 * @returns {number} Decay factor between 0 and 1 (1 = very recent, 0 = too old)
 */
function calculateTimeDecay(crimeTimestamp, currentTimestamp = Date.now()) {
    const ageMs = currentTimestamp - crimeTimestamp;
    const ageDays = ageMs / (1000 * 60 * 60 * 24);

    // Ignore very old crimes (over 1 year)
    // They're too outdated to reflect current safety conditions
    if (ageDays > SAFETY_CONFIG.TIME_DECAY.MAX_AGE_DAYS) {
        return 0;
    }

    // Exponential decay formula: weight = 0.5^(age / half_life)
    // This creates a smooth curve where relevance decreases over time
    const halfLife = SAFETY_CONFIG.TIME_DECAY.HALF_LIFE_DAYS;
    return Math.pow(0.5, ageDays / halfLife);
}

/**
 * Sample points along a route at regular intervals
 * @param {Array<[number, number]>} coordinates - Route coordinates [[lng, lat], ...]
 * @param {number} intervalMeters - Distance between samples
 * @returns {Array<{lng: number, lat: number, distance: number}>} Sample points
 */
export function sampleRoutePoints(coordinates, intervalMeters = SAFETY_CONFIG.SAMPLE_INTERVAL_METERS) {
    const samples = [];
    let accumulatedDistance = 0;

    // Always include first point
    samples.push({
        lng: coordinates[0][0],
        lat: coordinates[0][1],
        distance: 0
    });

    // Sample along the route
    for (let i = 1; i < coordinates.length; i++) {
        const [lng1, lat1] = coordinates[i - 1];
        const [lng2, lat2] = coordinates[i];

        const segmentDistance = calculateDistance(lat1, lng1, lat2, lng2);
        const segmentStart = accumulatedDistance;
        const segmentEnd = accumulatedDistance + segmentDistance;

        // Add samples within this segment
        let nextSampleDistance = Math.ceil(segmentStart / intervalMeters) * intervalMeters;

        while (nextSampleDistance < segmentEnd) {
            const fraction = (nextSampleDistance - segmentStart) / segmentDistance;
            const lng = lng1 + (lng2 - lng1) * fraction;
            const lat = lat1 + (lat2 - lat1) * fraction;

            samples.push({
                lng,
                lat,
                distance: nextSampleDistance
            });

            nextSampleDistance += intervalMeters;
        }

        accumulatedDistance = segmentEnd;
    }

    // Always include last point
    const lastCoord = coordinates[coordinates.length - 1];
    samples.push({
        lng: lastCoord[0],
        lat: lastCoord[1],
        distance: accumulatedDistance
    });

    return samples;
}

/**
 * Calculate crime exposure for a single point on the route
 * 
 * This is the heart of our safety scoring. We're asking: "If I'm standing
 * at this exact spot, how much crime risk am I exposed to?"
 * 
 * We consider three factors:
 * 1. Distance - Crimes right next to you are scarier than crimes a block away
 * 2. Time - Recent crimes matter more than old ones
 * 3. Severity - Violent crimes are more concerning than minor incidents
 * 
 * @param {Object} spatialIndex - Our fast lookup table of crimes by location
 * @param {number} lng - Longitude of the point we're checking
 * @param {number} lat - Latitude of the point we're checking
 * @returns {Object} How much crime exposure this point has, plus details
 */
function calculatePointExposure(spatialIndex, lng, lat) {
    // Find all crimes within 100 meters (about 1 city block)
    const nearbyCrimes = findCrimesNearPoint(
        spatialIndex,
        lng,
        lat,
        SAFETY_CONFIG.CRIME_SEARCH_RADIUS
    );

    let totalExposure = 0;
    const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    // For each nearby crime, calculate how much it affects our safety score
    for (const crime of nearbyCrimes) {
        // Distance factor: Use inverse distance (not inverse square)
        // A crime 1 meter away contributes 1.0, a crime 10 meters away contributes 0.1
        // We use Math.max(1) to avoid division by zero if crime is at exact same spot
        const distanceFactor = 1 / Math.max(crime.distanceMeters, 1);

        // Time decay factor: Recent crimes are more relevant
        // A crime from yesterday gets full weight, a crime from 6 months ago gets less
        const timeFactor = calculateTimeDecay(crime.timestamp);

        // Severity weight: How serious was this crime?
        // Assault (3.0) > Theft (2.0) > Mischief (1.0)
        const severityWeight = crime.severityWeight;

        // Multiply all three factors together to get this crime's contribution
        // High severity + Close distance + Recent = high exposure
        // Low severity + Far distance + Old = low exposure
        const crimeExposure = severityWeight * distanceFactor * timeFactor;
        totalExposure += crimeExposure;

        // Keep track of crime types for reporting
        severityCounts[crime.severity]++;
    }

    return {
        exposure: totalExposure,          // Total "danger score" for this point
        crimeCount: nearbyCrimes.length,  // How many crimes we found
        severityCounts                     // Breakdown by severity (HIGH/MEDIUM/LOW)
    };
}

/**
 * Calculate safety score for a route
 * @param {Object} route - Route object with geometry coordinates
 * @param {Object} spatialIndex - Crime data spatial index
 * @returns {Object} Safety score and detailed metrics
 */
export function calculateRouteSafetyScore(route, spatialIndex) {
    const coordinates = route.geometry.coordinates;
    const routeLengthMeters = route.distance;

    // Sample points along the route
    const samplePoints = sampleRoutePoints(coordinates);

    // Calculate exposure for each sample point
    let totalExposure = 0;
    let totalCrimes = 0;
    const severityCounts = { HIGH: 0, MEDIUM: 0, LOW: 0 };

    for (const point of samplePoints) {
        const pointExposure = calculatePointExposure(
            spatialIndex,
            point.lng,
            point.lat
        );

        totalExposure += pointExposure.exposure;
        totalCrimes += pointExposure.crimeCount;

        // Aggregate severity counts
        severityCounts.HIGH += pointExposure.severityCounts.HIGH;
        severityCounts.MEDIUM += pointExposure.severityCounts.MEDIUM;
        severityCounts.LOW += pointExposure.severityCounts.LOW;
    }

    // Normalize by number of samples (exposure per sample point)
    const normalizedExposure = totalExposure / samplePoints.length;

    // Convert to safety score (0-100)
    // Lower exposure = higher safety score
    // Use calibration factor to map exposure to reasonable score range
    const rawScore = 100 - (normalizedExposure * SAFETY_CONFIG.CALIBRATION_FACTOR);
    const safetyScore = Math.max(0, Math.min(100, rawScore));

    // Calculate crimes per kilometer for context
    const crimesPerKm = (totalCrimes / (routeLengthMeters / 1000)).toFixed(1);

    return {
        safetyScore: Math.round(safetyScore),
        rawExposure: totalExposure,
        normalizedExposure,
        totalCrimes,
        crimesPerKm,
        severityCounts,
        samplePointCount: samplePoints.length,
        // Provide interpretation
        interpretation: getScoreInterpretation(safetyScore)
    };
}

/**
 * Get human-readable interpretation of safety score
 * @param {number} score - Safety score (0-100)
 * @returns {string} Interpretation
 */
function getScoreInterpretation(score) {
    if (score >= 85) return 'Excellent - Very safe route';
    if (score >= 70) return 'Good - Generally safe';
    if (score >= 55) return 'Fair - Moderate safety concerns';
    if (score >= 40) return 'Caution - Higher crime exposure';
    return 'High Risk - Consider alternative route';
}

/**
 * Calculate composite score for route ranking
 * Combines safety, time, and distance into single score
 * 
 * @param {Object} routeMetrics - Route metrics including safety score
 * @param {Object} baseline - Baseline values for normalization
 * @returns {number} Composite score (0-100)
 */
export function calculateCompositeScore(routeMetrics, baseline) {
    const weights = SAFETY_CONFIG.COMPOSITE_WEIGHTS;

    // Normalize safety score (already 0-100)
    const safetyComponent = routeMetrics.safetyScore;

    // Normalize time (lower is better, invert so higher score is better)
    // Baseline is the shortest duration
    const timeRatio = baseline.duration / routeMetrics.duration;
    const timeComponent = Math.min(100, timeRatio * 100);

    // Normalize distance (lower is better, invert so higher score is better)
    // Baseline is the shortest distance
    const distanceRatio = baseline.distance / routeMetrics.distance;
    const distanceComponent = Math.min(100, distanceRatio * 100);

    // Weighted combination
    const composite =
        (safetyComponent * weights.safety) +
        (timeComponent * weights.time) +
        (distanceComponent * weights.distance);

    return Math.round(composite);
}

/**
 * Compare multiple routes and rank by composite score
 * @param {Array} routes - Array of route objects
 * @param {Object} spatialIndex - Crime data spatial index
 * @returns {Array} Ranked routes with scores and metrics
 */
export function compareRoutes(routes, spatialIndex) {
    if (!routes || routes.length === 0) {
        return [];
    }

    // Calculate safety scores for all routes
    const scoredRoutes = routes.map(route => {
        const safetyMetrics = calculateRouteSafetyScore(route, spatialIndex);

        return {
            route,
            safetyMetrics,
            duration: route.duration,
            distance: route.distance,
            safetyScore: safetyMetrics.safetyScore
        };
    });

    // Find baseline (shortest) for normalization
    const baseline = {
        duration: Math.min(...scoredRoutes.map(r => r.duration)),
        distance: Math.min(...scoredRoutes.map(r => r.distance))
    };

    // Calculate composite scores
    const rankedRoutes = scoredRoutes.map(routeData => ({
        ...routeData,
        compositeScore: calculateCompositeScore(routeData, baseline)
    }));

    // Sort by safety score first (highest first), then by composite score as tiebreaker
    // This ensures the safest route is always the primary recommendation
    rankedRoutes.sort((a, b) => {
        // Primary: Sort by safety score
        if (b.safetyScore !== a.safetyScore) {
            return b.safetyScore - a.safetyScore;
        }
        // Secondary: If safety scores are equal, use composite score
        return b.compositeScore - a.compositeScore;
    });

    return rankedRoutes;
}
