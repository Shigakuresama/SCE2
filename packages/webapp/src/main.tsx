import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import 'leaflet-draw/dist/leaflet.draw.css';
import './map-draw-fix.css';
import App from './App';

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
