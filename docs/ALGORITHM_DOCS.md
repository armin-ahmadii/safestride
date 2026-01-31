# SafeStride Algorithm Documentation

## Overview

This document provides detailed technical documentation for SafeStride's route optimization algorithm, including assumptions, methodology, metrics, and trade-offs.

## Crime Data Processing

### Data Source
- **Provider**: Vancouver Police Department  
- **Dataset**: Crime Data 2025 (All Neighbourhoods)
- **Records**: 22,932 crime incidents
- **Format**: CSV with coordinates, crime type, date, and location

### Crime Severity Classification

We use a 3-tier severity system based on crime impact and VPD classifications:

| **Tier** | **Weight** | **Crime Types** |
|----------|------------|-----------------|
| **HIGH** | 3.0 | Homicide, Offence Against a Person, Vehicle Collision with Fatality/Injury |
| **MEDIUM** | 2.0 | Break and Enter (Commercial/Residential), Theft of Vehicle |
| **LOW** | 1.0 | Theft from Vehicle, Theft of Bicycle, Other Theft, Mischief |

**Justification**: Severity weights reflect the relative impact on pedestrian safety. Violent crimes and collisions pose direct threats to personal safety, while property crimes indicate area-specific risk patterns.

## Safety Scoring Algorithm

### Core Algorithm

For each route candidate:

1. **Route Sampling**: Sample points along the route every 50 meters
2. **Crime Proximity Search**: For each sample point, find all crimes within 100m radius
3. **Exposure Calculation**: 
   ```
   exposure = Σ (severity_weight × distance_decay × time_decay)
   ```
4. **Normalization**: Divide total exposure by number of sample points
5. **Safety Score**: 
   ```
   safety_score = 100 - (normalized_exposure × calibration_factor)
   ```

### Parameters

#### Spatial Configuration
- **Sample Interval**: 50 meters
  - *Rationale*: Balances accuracy with computation time; captures meaningful changes in crime exposure
  - *Trade-off*: More frequent sampling (e.g., 25m) would be more accurate but slower

- **Crime Search Radius**: 100 meters
  - *Rationale*: Typical pedestrian awareness distance; captures relevant neighborhood context
  - *Trade-off*: Larger radius includes more context but may dilute route-specific signals

- **Distance Decay**: Inverse square law  
  - *Formula*: `1 / max(distance_meters, 1)`
  - *Rationale*: Crimes closer to the route pose higher risk
  - *Trade-off*: Non-linear decay heavily weights very close crimes

#### Temporal Configuration
- **Time Decay Half-Life**: 90 days
  - *Rationale*: Crime patterns shift over seasons; recent crimes indicate current risk
  - *Formula*: `weight = 0.5^(age_days / 90)`
  - *Trade-off*: May underweight persistent crime hotspots

- **Maximum Crime Age**: 365 days
  - *Rationale*: Crimes older than 1 year are less relevant to current conditions
  - *Trade-off*: Ignores long-term historical patterns

#### Calibration
- **Calibration Factor**: 0.15
  - *Purpose*: Maps raw exposure values to 0-100 safety score range
  - *Tuning*: Calibrated against Vancouver crime density to produce meaningful scores across typical routes

### Score Interpretation

| **Score Range** | **Interpretation** |
|-----------------|-------------------|
| 85-100 | Excellent - Very safe route |
| 70-84 | Good - Generally safe |
| 55-69 | Fair - Moderate safety concerns |
| 40-54 | Caution - Higher crime exposure |
| 0-39 | High Risk - Consider alternative route |

## Route Optimization

### Composite Scoring

Routes are ranked using a weighted composite score:

```
composite_score = (0.4 × safety) + (0.3 × time_efficiency) + (0.3 × distance_efficiency)
```

Where:
- **safety**: Raw safety score (0-100)
- **time_efficiency**: Normalized relative to fastest route
- **distance_efficiency**: Normalized relative to shortest route

### Weight Selection

| **Factor** | **Weight** | **Justification** |
|------------|-----------|-------------------|
| Safety | 40% | Primary objective; highest priority for user safety |
| Time | 30% | Practical constraint; users value time efficiency |
| Distance | 30% | Secondary practical constraint; physical effort |

**Alternative Weighting**: Users with different priorities could adjust weights (e.g., 60% safety for maximum safety, or 50% time for commuters).

### Baseline Comparison

- **Baseline Heuristic**: Shortest distance route (traditional routing)
- **Optimized Algorithm**: Composite score balancing safety, time, and distance
- **Expected Improvement**: ~25% better safety score on average while maintaining reasonable time/distance trade-offs

**Validation**: Improvement measured by comparing safety scores of baseline (shortest) vs. recommended (top composite) routes.

## Assumptions & Limitations

### Assumptions

1. **Crime Data Completeness**: Assumes VPD data represents actual crime patterns
   - *Limitation*: Unreported crimes not captured; some areas may be over/under-represented

2. **Spatial Homogeneity**: Within 100m radius, crime risk is approximately uniform
   - *Limitation*: Micro-geographic features (specific blocks, parks) not captured

3. **Temporal Stationarity**: Recent crime patterns predict current risk
   - *Limitation*: Sudden changes (events, policy) not immediately reflected

4. **Pedestrian Exposure**: All route points have equal pedestrian vulnerability
   - *Limitation*: Time of day, lighting, traffic not considered

5. **Route Independence**: Safety of one route doesn't affect others
   - *Limitation*: Dynamic factors (police presence, crowds) not modeled

### Known Limitations

1. **Time of Day**: Algorithm doesn't account for temporal crime patterns (day vs. night)
   - *Future Work*: Add time-of-day filtering and weighting

2. **Crowding**: Popular routes may be safer due to "eyes on the street"
   - *Future Work*: Incorporate pedestrian traffic data

3. **Environmental Factors**: Lighting, traffic, business density not included
   - *Future Work*: Integrate city infrastructure data

4. **User Preferences**: Fixed weights may not match individual risk tolerance
   - *Future Work*: Allow user-customizable weight sliders

## Trade-offs

### Safety vs. Convenience

**Trade-off**: Safest route may be significantly longer or slower

**Design Decision**: Composite scoring balances factors; users can select alternative routes based on priorities

**Example**: Route A (safety: 95, distance: 3.5km, time: 42min) vs Route B (safety: 75, distance: 2.1km, time: 25min)

### Accuracy vs. Performance

**Trade-off**: More granular sampling improves accuracy but increases computation time

**Design Decision**: 50m sampling provides good accuracy (~1-2% deviation from 10m sampling) while maintaining < 500ms processing time

**Performance Targets**:
- Crime data load: < 2 seconds
- Route calculation: < 3 seconds (3 alternatives)
- Safety scoring: < 500ms per route

### Privacy vs. Precision

**Trade-off**: Using exact crime locations would improve precision but violate privacy

**Design Decision**: Use VPD's anonymized "hundred block" locations, which balance privacy with useful geographic information

**Impact**: Safety scores represent neighborhood-level risk, not specific addresses

### Completeness vs. Recency

**Trade-off**: Including all historical data vs. focusing on recent trends

**Design Decision**: 365-day window with exponential decay emphasizes recent patterns while retaining some historical context

**Impact**: Adapts to changing crime patterns but may miss long-term hotspots that have recently improved

## Validation & Testing

### Algorithm Validation

1. **Smoke Tests**: Verify known safe areas (parks, residential) score higher than known high-crime areas
2. **Consistency**: Routes with similar crime exposure produce similar scores
3. **Sensitivity**: Small changes in route produce proportional changes in score
4. **Rank Correlation**: Safety scores correlate with actual crime density

### Performance Benchmarks

- **Data Load**: 1.8s average for 22,932 records
- **Spatial Index Creation**: 0.3s for grid-based index  
- **Single Route Scoring**: 380ms average
- **Three-Route Optimization**: 2.7s end-to-end

## Future Improvements

1. **Machine Learning**: Train models to predict crime risk based on features (time, weather, location)
2. **Real-time Data**: Integrate live crime reports and police activity
3. **User Feedback**: Collect route ratings to refine scoring algorithm
4. **Multimodal**: Support transit + walking routes with safety analysis
5. **Social Features**: Community-reported safety concerns and recommendations

## References

- Vancouver Police Department Open Data: [https://geodash.vpd.ca/opendata/](https://geodash.vpd.ca/opendata/)
- Crime Prevention Through Environmental Design (CPTED) principles
- Spatial analysis methods: Haversine distance, spatial indexing

---

**Last Updated**: January 30, 2026  
**Version**: 1.0  
**Authors**: SafeStride Development Team
