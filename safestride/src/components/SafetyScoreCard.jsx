/**
 * SafetyScoreCard Component
 * 
 * Displays a route's safety score with visual indicators,
 * interpretation, and crime severity breakdown.
 */

import React from 'react';
import './components.css';

export default function SafetyScoreCard({ safetyMetrics, isRecommended = false }) {
    const { safetyScore, interpretation, severityCounts, crimesPerKm, totalCrimes } = safetyMetrics;

    // Determine color based on score
    const getScoreColor = (score) => {
        if (score >= 85) return '#10b981'; // green
        if (score >= 70) return '#3b82f6'; // blue
        if (score >= 55) return '#f59e0b'; // amber
        if (score >= 40) return '#f97316'; // orange
        return '#ef4444'; // red
    };

    const scoreColor = getScoreColor(safetyScore);

    return (
        <div className="safety-score-card">
            {isRecommended && (
                <div className="recommended-badge">
                    ⭐ Recommended
                </div>
            )}

            <div className="score-display" style={{ borderColor: scoreColor }}>
                <div className="score-number" style={{ color: scoreColor }}>
                    {safetyScore}
                </div>
                <div className="score-label">Safety Score</div>
            </div>

            <div className="score-interpretation" style={{ color: scoreColor }}>
                {interpretation}
            </div>

            <div className="crime-breakdown">
                <div className="breakdown-title">Crime Exposure</div>
                <div className="breakdown-stats">
                    <div className="stat-row">
                        <span className="stat-label">Total Crimes:</span>
                        <span className="stat-value">{totalCrimes}</span>
                    </div>
                    <div className="stat-row">
                        <span className="stat-label">Per Kilometer:</span>
                        <span className="stat-value">{crimesPerKm}</span>
                    </div>
                </div>

                <div className="severity-breakdown">
                    <div className="severity-item high">
                        <span className="severity-label">High Severity:</span>
                        <span className="severity-count">{severityCounts.HIGH}</span>
                    </div>
                    <div className="severity-item medium">
                        <span className="severity-label">Medium Severity:</span>
                        <span className="severity-count">{severityCounts.MEDIUM}</span>
                    </div>
                    <div className="severity-item low">
                        <span className="severity-label">Low Severity:</span>
                        <span className="severity-count">{severityCounts.LOW}</span>
                    </div>
                </div>
            </div>
        </div>
    );
}
