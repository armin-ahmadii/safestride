/**
 * Application Entry Point
 * 
 * This file initializes the React application and mounts it to the DOM.
 * It wraps the App component in StrictMode for additional development checks.
 */

import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
