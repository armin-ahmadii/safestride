# SafeStride 🚶‍♂️

**Data-Driven Safe Walking Routes for Vancouver**

SafeStride is a web application that uses Vancouver Police Department crime data to optimize walking routes for safety, helping you make informed decisions about your route based on crime patterns, distance, and time.

Built for the **2025 Fall Hacks Hackathon**.

---

## ✨ Features

### 🛡️ Safety-First Routing
- **Crime Data Integration**: Analyzes 22,932+ Vancouver crime records
- **Safety Scoring**: Routes scored 0-100 based on crime exposure
- **Multi-Route Analysis**: Compare up to 3 alternative routes
- **Smart Optimization**: Balances safety (40%), time (30%), and distance (30%)

### 📊 Transparent Analytics
- **Crime Severity Tiers**: High/Medium/Low classification system
- **Explainable Results**: Clear explanations of why routes are recommended
- **Algorithm Documentation**: Full transparency on assumptions and trade-offs
- **Performance Metrics**: ~25% safety improvement over baseline routing

### 🗺️ Interactive Mapping
- **Real-time Visualization**: See all route alternatives on the map
- **Color-Coded Routes**: Instantly identify recommended vs. alternative routes
- **Address Autocomplete**: Easy address entry with Mapbox integration
- **Route Comparison**: Side-by-side metrics for informed decisions

---

## 🚀 Getting Started

### Prerequisites

- **Node.js** (version 16+) - [Download](https://nodejs.org/)
- **Mapbox Account** - [Sign up free](https://account.mapbox.com/auth/signup/)

### Installation

1. **Clone this repository**
   ```bash
   git clone git@github.com:USERNAME/safestride.git
   ```
   or use GitHub Desktop

2. **Install dependencies**
   ```bash
   npm install
   ```

3. **Set up environment variables**
   
   Create a `.env` file:
   ```bash
   touch .env
   ```
   
   Edit `.env` and add the following line:
   ```
   VITE_MAPBOX_TOKEN=your_mapbox_token_here
   ```
   
   Get a token at: [https://account.mapbox.com/access-tokens/](https://account.mapbox.com/access-tokens/)

4. **Start the development server**
   ```bash
   npm run dev
   ```

5. **Open your browser** to `http://localhost:5173`

---

## 📖 How to Use

1. **Enter addresses**: Add your starting point and destination in The City of Vancouver
2. **Click "Find Safe Routes"**: The app analyzes crime data and generates 3 optimized routes
3. **Compare routes**: View safety scores, distance, time, and crime exposure for each option
4. **Select your route**: Click on any route card to see it highlighted on the map
5. **View algorithm details**: Click "Show Algorithm Details" for transparency

---

## 🧮 Algorithm Overview

### Safety Scoring

```
1. Sample points along route (every 50m)
2. Find crimes within 100m of each point  
3. Calculate exposure:
   exposure = Σ(severity_weight × distance_decay × time_decay)
4. Generate safety score (0-100)
```

### Crime Severity Tiers

- **High (3.0x)**: Violent crimes, collisions with injury
- **Medium (2.0x)**: Break & enter, vehicle theft
- **Low (1.0x)**: Property theft, mischief

### Composite Ranking

Routes ranked by: `(0.4 × safety) + (0.3 × time) + (0.3 × distance)`

**Result**: ~25% safer routes on average vs. distance-only routing

---

## 📁 Project Structure

```
safestride/
├── src/
│   ├── App.jsx                  # Main React application
│   ├── components/              # React UI components
│   │   ├── RouteComparison.jsx  # Route alternatives panel
│   │   ├── SafetyScoreCard.jsx  # Safety score display
│   │   ├── MetricsPanel.jsx     # Algorithm documentation
│   │   └── components.css       # Component styles
│   ├── utils/                   # Data processing utilities
│   │   ├── CrimeDataParser.js   # CSV parsing & spatial indexing
│   │   ├── SafetyScorer.js      # Safety score calculation
│   │   └── RouteOptimizer.js    # Multi-route optimization
│   ├── main.jsx                 # React entry point
│   └── index.css                # Global styles
├── public/
│   └── crimedata_csv_*.csv      # VPD crime data
├── docs/
│   └── ALGORITHM_DOCS.md        # Technical documentation
├── package.json
└── README.md
```

---

## 🛠️ Technologies

- **React 19** - UI framework with hooks
- **Vite** - Build tool and dev server
- **Mapbox GL JS** - Interactive maps and routing
- **PapaParse** - CSV parsing for crime data
- **Axios** - HTTP requests
- **Tailwind CSS** - Utility-first styling

---

## 📊 Technical Documentation

For detailed algorithm documentation, see: [`docs/ALGORITHM_DOCS.md`](docs/ALGORITHM_DOCS.md)

Covers:
- Crime severity classification methodology
- Safety scoring algorithm parameters
- Composite ranking weights and justification
- Assumptions, limitations, and trade-offs
- Validation approach and performance metrics

<!-- ---

## 🎯 Key Metrics

| Metric | Value |
|--------|-------|
| Crime Records | 22,932+ |
| Route Alternatives | 3 per search |
| Safety Improvement | ~25% vs baseline |
| Processing Time | < 3 seconds |
| Safety Score Range | 0-100 | -->

<!-- ---

## 🔒 Privacy & Data

- **Data Source**: Vancouver Police Department Open Data
- **Anonymization**: Crime locations anonymized to "hundred blocks"
- **Local Processing**: All analysis done client-side
- **No Tracking**: No user route data collected or stored -->

<!-- ---

## 🤝 Team

- **Role**: Team Lead
- **Team Size**: 4 members
- **Duration**: Fall 2025
- **Stack**: JavaScript, React, REST APIs, PostgreSQL -->
<!-- 
---

## 📄 License

Created for the 2025 Fall Hacks Hackathon. -->

<!-- ---

## 🙏 Acknowledgments

- **Vancouver Police Department** - Crime data
- **Mapbox** - Mapping and routing APIs
- **Fall Hacks 2025** - Hackathon organizers

--- -->

**Built with ❤️ and lots of ☕ for safer walking in Vancouver**
