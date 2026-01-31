/**
 * MetricsPanel Component
 * 
 * React component displaying algorithm assumptions, metrics, and trade-offs
 * for transparency and explainability.
 */

import React, { useState } from 'react';
import { SAFETY_CONFIG } from '../utils/SafetyScorer';
import { CRIME_SEVERITY } from '../utils/CrimeDataParser';
import { calculateSafetyImprovement } from '../utils/RouteOptimizer';
import './components.css';

export default function MetricsPanel({ routes, isVisible }) {
    const [activeTab, setActiveTab] = useState('assumptions');

    if (!isVisible || !routes || routes.length === 0) {
        return null;
    }

    const improvement = calculateSafetyImprovement(routes);

    return (
        <div className="metrics-panel">
            <div className="metrics-header">
                <h3>📊 Algorithm Documentation</h3>
                <p>Transparent metrics and assumptions for route safety analysis</p>
            </div>

            <div className="metrics-tabs">
                <button
                    className={`tab ${activeTab === 'assumptions' ? 'active' : ''}`}
                    onClick={() => setActiveTab('assumptions')}
                >
                    Assumptions
                </button>
                <button
                    className={`tab ${activeTab === 'metrics' ? 'active' : ''}`}
                    onClick={() => setActiveTab('metrics')}
                >
                    Metrics
                </button>
                <button
                    className={`tab ${activeTab === 'tradeoffs' ? 'active' : ''}`}
                    onClick={() => setActiveTab('tradeoffs')}
                >
                    Trade-offs
                </button>
            </div>

            <div className="metrics-content">
                {activeTab === 'assumptions' && (
                    <div className="tab-content">
                        <h4>Algorithm Assumptions</h4>

                        <div className="assumption-block">
                            <h5>Crime Severity Classification</h5>
                            <div className="severity-weights">
                                {Object.entries(CRIME_SEVERITY).map(([level, config]) => (
                                    <div key={level} className="severity-weight-row">
                                        <span className="severity-name">{level}:</span>
                                        <span className="severity-value">Weight = {config.weight}</span>
                                        <div className="severity-types">
                                            {config.types.slice(0, 2).join(', ')}
                                            {config.types.length > 2 && ` (+${config.types.length - 2} more)`}
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>

                        <div className="assumption-block">
                            <h5>Spatial Parameters</h5>
                            <ul>
                                <li>Sample Interval: {SAFETY_CONFIG.SAMPLE_INTERVAL_METERS}m along route</li>
                                <li>Crime Search Radius: {SAFETY_CONFIG.CRIME_SEARCH_RADIUS}m around each point</li>
                                <li>Distance Decay: Inverse square law (closer crimes weighted more)</li>
                            </ul>
                        </div>

                        <div className="assumption-block">
                            <h5>Temporal Parameters</h5>
                            <ul>
                                <li>Time Decay Half-life: {SAFETY_CONFIG.TIME_DECAY.HALF_LIFE_DAYS} days</li>
                                <li>Maximum Crime Age: {SAFETY_CONFIG.TIME_DECAY.MAX_AGE_DAYS} days</li>
                                <li>Recent crimes weighted more heavily than older incidents</li>
                            </ul>
                        </div>

                        <div className="assumption-block">
                            <h5>Composite Scoring Weights</h5>
                            <ul>
                                <li>Safety: {SAFETY_CONFIG.COMPOSITE_WEIGHTS.safety * 100}%</li>
                                <li>Time: {SAFETY_CONFIG.COMPOSITE_WEIGHTS.time * 100}%</li>
                                <li>Distance: {SAFETY_CONFIG.COMPOSITE_WEIGHTS.distance * 100}%</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'metrics' && (
                    <div className="tab-content">
                        <h4>Performance Metrics</h4>

                        <div className="metric-card">
                            <h5>Safety Improvement vs. Baseline</h5>
                            <div className="improvement-display">
                                {improvement.improvement > 0 ? (
                                    <>
                                        <span className="improvement-positive">
                                            +{improvement.improvement}%
                                        </span>
                                        <p>safer than distance-only routing</p>
                                    </>
                                ) : improvement.isSameRoute ? (
                                    <>
                                        <span className="improvement-neutral">✓</span>
                                        <p>Shortest route is also the safest!</p>
                                    </>
                                ) : (
                                    <>
                                        <span className="improvement-info">
                                            Analysis Complete
                                        </span>
                                        <p>Multiple factors optimized</p>
                                    </>
                                )}
                            </div>
                            <div className="improvement-details">
                                <div>Baseline (shortest): {improvement.baselineSafety}/100</div>
                                <div>Optimized (recommended): {improvement.optimizedSafety}/100</div>
                            </div>
                        </div>

                        <div className="metric-card">
                            <h5>Route Analysis</h5>
                            <ul>
                                <li>Routes Analyzed: {routes.length}</li>
                                <li>Sample Points: {routes[0]?.safetyMetrics?.samplePointCount || 'N/A'}</li>
                                <li>Data Source: Vancouver PD Crime Data 2025</li>
                                <li>Total Crime Records: 22,932+</li>
                            </ul>
                        </div>
                    </div>
                )}

                {activeTab === 'tradeoffs' && (
                    <div className="tab-content">
                        <h4>Design Trade-offs</h4>

                        <div className="tradeoff-block">
                            <h5>Safety vs. Convenience</h5>
                            <p>
                                The safest route may not always be the shortest or fastest. Our algorithm
                                balances all three factors, but you can choose alternative routes based
                                on your priorities.
                            </p>
                        </div>

                        <div className="tradeoff-block">
                            <h5>Spatial Resolution</h5>
                            <p>
                                Using a {SAFETY_CONFIG.CRIME_SEARCH_RADIUS}m search radius provides good
                                coverage while avoiding overcounting. Larger radii would include more crimes
                                but may not accurately reflect route-specific risk.
                            </p>
                        </div>

                        <div className="tradeoff-block">
                            <h5>Temporal Decay</h5>
                            <p>
                                Recent crimes are weighted more heavily (half-life: {SAFETY_CONFIG.TIME_DECAY.HALF_LIFE_DAYS} days).
                                This assumes crime patterns change over time, but may not capture seasonal variations.
                            </p>
                        </div>

                        <div className="tradeoff-block">
                            <h5>Computation vs. Accuracy</h5>
                            <p>
                                Sampling every {SAFETY_CONFIG.SAMPLE_INTERVAL_METERS}m balances accuracy with
                                performance. More frequent sampling would be more precise but slower.
                            </p>
                        </div>

                        <div className="tradeoff-block">
                            <h5>Privacy Considerations</h5>
                            <p>
                                Crime data is aggregated to "hundred blocks" by VPD to protect privacy.
                                Our analysis uses these anonymized locations, which provides general
                                safety guidance while respecting individual privacy.
                            </p>
                        </div>
                    </div>
                )}
            </div>
        </div>
    );
}
