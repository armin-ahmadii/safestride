# ⚠️ IMPORTANT: Mapbox Token Required

The map and routing features will **not work** without a valid Mapbox access token.

## Quick Setup

1. **Get a FREE Mapbox token**:
   - Visit: https://account.mapbox.com/auth/signup/
   - Sign up (it's free!)
   - Go to: https://account.mapbox.com/access-tokens/
   - Copy your **Default public token**

2. **Add it to your `.env` file**:
   ```bash
   # Open the .env file
   nano .env
   
   # Replace the placeholder with your actual token:
   VITE_MAPBOX_TOKEN=pk.eyJ1IjoieW91ci11c2VybmFtZSIsImEiOiJjbHh4eHh4eHh4eHh4In0.your_actual_token_here
   ```

3. **Restart the dev server**:
   ```bash
   # Press Ctrl+C to stop the current server
   # Then restart:
   npm run dev
   ```

## Verify It's Working

1. The map should display and be interactive (draggable, zoomable)
2. You should be able to type addresses and click "Find Safe Routes"
3. Routes will appear on the map with safety scores

## Still Not Working?

Check the browser console (F12) for errors. Common issues:
- Token not set correctly (should start with `pk.`)
- Token has wrong permissions (needs Geocoding + Directions API)
- Browser cache (try hard refresh: Ctrl+Shift+R)
