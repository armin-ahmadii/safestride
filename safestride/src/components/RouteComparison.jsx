/**
 * RouteComparison Component
 * 
 * React component for displaying multiple route alternatives side-by-side
 * with their safety scores, metrics, and trade-offs.
 * Enhanced to show relative differences and best-in-category badges.
 */

import React, { useState } from 'react';
import SafetyScoreCard from './SafetyScoreCard';
import { generateRouteExplanation } from '../utils/RouteOptimizer';
import './components.css';

export default function RouteComparison({ routes, onRouteSelect, selectedRouteId }) {
    const [expandedRoute, setExpandedRoute] = useState(null);

    if (!routes || routes.length === 0) {
        return null;
    }

    const handleRouteClick = (route) => {
        setExpandedRoute(expandedRoute === route.id ? null : route.id);
        onRouteSelect(route);
    };

    // Find best in each category for comparison
    const safestRoute = [...routes].sort((a, b) => b.safetyScore - a.safetyScore)[0];
    const shortestRoute = [...routes].sort((a, b) => a.distance - b.distance)[0];
    const fastestRoute = [...routes].sort((a, b) => a.duration - b.duration)[0];

    return (
        <div className="route-comparison">
            <h3>Route Alternatives</h3>
            <p className="comparison-subtitle">
                Comparing {routes.length} distinct route{routes.length > 1 ? 's' : ''} with different paths
            </p>

            <div className="routes-list">
                {routes.map((routeData) => {
                    const isSelected = selectedRouteId === routeData.id;
                    const isExpanded = expandedRoute === routeData.id;
                    const explanation = generateRouteExplanation(routeData, routes);

                    // Calculate relative differences
                    const isSafest = routeData.id === safestRoute.id;
                    const isShortest = routeData.id === shortestRoute.id;
                    const isFastest = routeData.id === fastestRoute.id;

                    const safetyDiff = isSafest ? 0 : safestRoute.safetyScore - routeData.safetyScore;
                    const distanceDiff = isShortest ? 0 : ((routeData.distance - shortestRoute.distance) / 1000).toFixed(2);
                    const timeDiff = isFastest ? 0 : Math.round((routeData.duration - fastestRoute.duration) / 60);

                    return (
                        <div
                            key={routeData.id}
                            className={`route-card ${isSelected ? 'selected' : ''} ${isExpanded ? 'expanded' : ''}`}
                            onClick={() => handleRouteClick(routeData)}
                        >
                            <div className="route-header">
                                <div className="route-title">
                                    <span className="route-number">Route {routeData.rank}</span>
                                    {routeData.isRecommended && (
                                        <span className="recommended-tag">⭐ Recommended</span>
                                    )}
                                </div>
                                <div className="composite-score">
                                    Score: {routeData.compositeScore}/100
                                </div>
                            </div>

                            <div className="route-quick-stats">
                                <div className="quick-stat">
                                    <div className="stat-header">
                                        <span className="stat-icon">🛡️</span>
                                        <span className="stat-label">Safety</span>
                                        {isSafest && <span className="best-badge">★ Best</span>}
                                    </div>
                                    <span className="stat-value">{routeData.safetyScore}/100</span>
                                    {!isSafest && (
                                        <span className="stat-diff negative">-{safetyDiff.toFixed(1)} pts</span>
                                    )}
                                </div>

                                <div className="quick-stat">
                                    <div className="stat-header">
                                        <span className="stat-icon">📏</span>
                                        <span className="stat-label">Distance</span>
                                        {isShortest && <span className="best-badge">★ Best</span>}
                                    </div>
                                    <span className="stat-value">{(routeData.distance / 1000).toFixed(2)} km</span>
                                    {!isShortest && (
                                        <span className="stat-diff negative">+{distanceDiff} km</span>
                                    )}
                                </div>

                                <div className="quick-stat">
                                    <div className="stat-header">
                                        <span className="stat-icon">⏱️</span>
                                        <span className="stat-label">Time</span>
                                        {isFastest && <span className="best-badge">★ Best</span>}
                                    </div>
                                    <span className="stat-value">{Math.round(routeData.duration / 60)} min</span>
                                    {!isFastest && (
                                        <span className="stat-diff negative">+{timeDiff} min</span>
                                    )}
                                </div>
                            </div>

                            {/* Route type indicator */}
                            {routeData.routeType && (
                                <div className="route-type-indicator">
                                    {routeData.routeType === 'direct' && '🎯 Direct route'}
                                    {routeData.routeType === 'alternative' && '🔄 Alternative path'}
                                    {routeData.routeType === 'waypoint-variant' && '🗺️ Strategic variant'}
                                </div>
                            )}

                            {isExpanded && (
                                <div className="route-details">
                                    <div className="explanation-section">
                                        <p className="explanation-summary">{explanation.summary}</p>

                                        {explanation.strengths.length > 0 && (
                                            <div className="explanation-block">
                                                <h4>✓ Strengths</h4>
                                                <ul>
                                                    {explanation.strengths.map((strength, i) => (
                                                        <li key={i}>{strength}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}

                                        {explanation.tradeoffs.length > 0 && (
                                            <div className="explanation-block">
                                                <h4>⚖️ Trade-offs</h4>
                                                <ul>
                                                    {explanation.tradeoffs.map((tradeoff, i) => (
                                                        <li key={i}>{tradeoff}</li>
                                                    ))}
                                                </ul>
                                            </div>
                                        )}
                                    </div>

                                    <SafetyScoreCard
                                        safetyMetrics={routeData.safetyMetrics}
                                        isRecommended={routeData.isRecommended}
                                    />
                                </div>
                            )}

                            <div className="expand-indicator">
                                {isExpanded ? '▼ Click to collapse' : '▶ Click for details'}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
}
