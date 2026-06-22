require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
// removed path import because static serving is handled differently on serverless

const app = express();
app.use(cors());
app.use(express.json());
// Note: express.static removed because Vercel serverless does not serve static files this way

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: process.env.EMAIL_USER,
    pass: process.env.EMAIL_PASS
  }
});

// Store latest data in memory
let latestLocation = null;
let alertHistory = [];
let safeZoneInfo = null;
let patientStatus = 'unknown';

// Send emergency email
app.post('/send-email', async (req, res) => {
  const { to, subject, body } = req.body;
  if (!to || !subject || !body) {
    return res.status(400).json({ success: false, message: 'Missing fields' });
  }
  try {
    await transporter.sendMail({
      from: '"Safe Step Alert" <kishanpujar67@gmail.com>',
      to: to,
      subject: subject,
      text: body,
      html: `
        <div style="font-family: Arial, sans-serif; max-width: 600px; margin: 0 auto;">
          <div style="background-color: #2C3E50; padding: 20px; border-radius: 8px 8px 0 0;">
            <h1 style="color: #F5EDD6; margin: 0;">🚨 Safe Step Emergency Alert</h1>
          </div>
          <div style="background-color: #F5EDD6; padding: 20px; border-radius: 0 0 8px 8px;">
            <pre style="font-family: Arial; white-space: pre-wrap; color: #0C0C00;">${body}</pre>
            <br/>
            <a href="https://safestep-server.vercel.app/dashboard" 
               style="background-color: #2C3E50; color: #F5EDD6; padding: 12px 24px; 
                      border-radius: 8px; text-decoration: none; font-weight: bold;">
              View Live Dashboard →
            </a>
          </div>
        </div>
      `
    });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    res.status(500).json({ success: false, message: error.message });
  }
});

// Flutter updates location
app.post('/update-location', (req, res) => {
  const { lat, lon, distance, timestamp, isInsideBoundary } = req.body;
  latestLocation = { lat, lon, distance, timestamp, isInsideBoundary };
  patientStatus = isInsideBoundary ? 'safe' : 'outside';
  res.json({ success: true });
});

// Flutter updates safe zone info
app.post('/update-safezone', (req, res) => {
  const { centerLat, centerLon, radius } = req.body;
  safeZoneInfo = { centerLat, centerLon, radius };
  res.json({ success: true });
});

// Flutter adds alert to history
app.post('/add-alert', (req, res) => {
  const { type, lat, lon, distance, timestamp, message } = req.body;
  alertHistory.unshift({ type, lat, lon, distance, timestamp, message });
  if (alertHistory.length > 50) alertHistory.pop(); // keep last 50
  res.json({ success: true });
});

// Dashboard data API
app.get('/api/status', (req, res) => {
  res.json({
    latestLocation,
    alertHistory,
    safeZoneInfo,
    patientStatus,
    serverTime: new Date().toISOString()
  });
});

// Dashboard page - inlined HTML to work in serverless environments
app.get('/dashboard', (req, res) => {
  res.setHeader('Content-Type', 'text/html');
  res.send(`
<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>Safe Step — Caregiver Dashboard</title>
  <link rel="stylesheet" href="https://unpkg.com/leaflet@1.9.4/dist/leaflet.css"/>
  <script src="https://unpkg.com/leaflet@1.9.4/dist/leaflet.js"><\/script>
  <style>
    * { margin: 0; padding: 0; box-sizing: border-box; }
    body { font-family: Arial, sans-serif; background: #F5EDD6; color: #0C0C00; }
    .header { background: #2C3E50; color: #F5EDD6; padding: 16px 24px; display: flex; align-items: center; justify-content: space-between; }
    .header h1 { font-size: 22px; }
    .status-badge { padding: 6px 16px; border-radius: 20px; font-weight: bold; font-size: 14px; }
    .safe { background: #2D4A2D; color: white; }
    .outside { background: #7A2C2C; color: white; }
    .unknown { background: #5A5A4A; color: white; }
    .grid { display: grid; grid-template-columns: 1fr 1fr 1fr; gap: 16px; padding: 16px; }
    @media (max-width: 768px) { .grid { grid-template-columns: 1fr; } }
    .card { background: #EDE0C4; border-radius: 16px; padding: 20px; border: 1px solid #D4C5A0; }
    .card h3 { color: #5A5A4A; font-size: 12px; text-transform: uppercase; letter-spacing: 1px; margin-bottom: 8px; }
    .card .value { font-size: 28px; font-weight: 800; color: #0C0C00; }
    .card .sub { font-size: 13px; color: #5A5A4A; margin-top: 4px; }
    #map { height: 400px; border-radius: 16px; margin: 0 16px; border: 2px solid #D4C5A0; }
    .alerts-section { padding: 16px; }
    .alerts-section h2 { font-size: 18px; font-weight: 800; margin-bottom: 12px; }
    .alert-item { background: #EDE0C4; border-radius: 12px; padding: 14px; margin-bottom: 8px; border-left: 4px solid #7A2C2C; display: flex; justify-content: space-between; align-items: center; }
    .alert-type { font-weight: 700; color: #7A2C2C; }
    .alert-time { font-size: 12px; color: #5A5A4A; }
    .refresh-bar { background: #2C3E50; color: #F5EDD6; text-align: center; padding: 8px; font-size: 13px; }
    .maps-btn { display: inline-block; background: #2C3E50; color: #F5EDD6; padding: 8px 16px; border-radius: 8px; text-decoration: none; font-size: 13px; margin-top: 8px; }
    .no-data { text-align: center; color: #5A5A4A; padding: 40px; font-size: 16px; }
  </style>
</head>
<body>
<div class="header">
  <div>
    <h1>🛡️ Safe Step</h1>
    <div style="font-size: 13px; opacity: 0.7;">Caregiver Dashboard</div>
  </div>
  <div id="statusBadge" class="status-badge unknown">Loading...</div>
</div>
<div class="refresh-bar" id="refreshBar">Last updated: Loading... | Auto-refreshes every 30 seconds</div>
<div class="grid" style="margin-top: 16px;">
  <div class="card">
    <h3>Patient Status</h3>
    <div class="value" id="patientStatus">—</div>
    <div class="sub" id="lastUpdate">No data yet</div>
  </div>
  <div class="card">
    <h3>Distance from Safe Zone</h3>
    <div class="value" id="distance">—</div>
    <div class="sub">meters from boundary center</div>
  </div>
  <div class="card">
    <h3>Safe Zone Radius</h3>
    <div class="value" id="radius">—</div>
    <div class="sub">meters</div>
  </div>
</div>
<div id="map"></div>
<div style="padding: 8px 16px;">
  <a id="mapsLink" class="maps-btn" href="#" target="_blank">📍 Open in Google Maps</a>
</div>
<div class="alerts-section">
  <h2>Recent Alerts</h2>
  <div id="alertsList"><div class="no-data">No alerts yet</div></div>
</div>
<script>
  const map = L.map('map').setView([12.3697, 76.6263], 15);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
    attribution: '© OpenStreetMap'
  }).addTo(map);

  let patientMarker = null;
  let safeZoneCircle = null;
  let centerMarker = null;

  async function fetchData() {
    try {
      const res = await fetch('/api/status');
      const data = await res.json();

      const badge = document.getElementById('statusBadge');
      const statusEl = document.getElementById('patientStatus');

      if (data.patientStatus === 'safe') {
        badge.className = 'status-badge safe';
        badge.textContent = '✅ Inside Safe Zone';
        statusEl.textContent = 'SAFE';
        statusEl.style.color = '#2D4A2D';
      } else if (data.patientStatus === 'outside') {
        badge.className = 'status-badge outside';
        badge.textContent = '🚨 Outside Safe Zone!';
        statusEl.textContent = 'OUTSIDE!';
        statusEl.style.color = '#7A2C2C';
      } else {
        badge.className = 'status-badge unknown';
        badge.textContent = '⏳ Unknown';
        statusEl.textContent = '—';
      }

      if (data.latestLocation) {
        const loc = data.latestLocation;
        const lat = parseFloat(loc.lat);
        const lon = parseFloat(loc.lon);

        document.getElementById('distance').textContent =
          loc.distance ? \`\${parseFloat(loc.distance).toFixed(0)}m\` : '—';

        const time = new Date(loc.timestamp);
        document.getElementById('lastUpdate').textContent =
          \`Last seen: \${time.toLocaleTimeString()} on \${time.toLocaleDateString()}\`;

        document.getElementById('mapsLink').href =
          \`https://www.google.com/maps?q=\${lat},\${lon}\`;

        if (patientMarker) {
          patientMarker.setLatLng([lat, lon]);
        } else {
          patientMarker = L.marker([lat, lon], {
            icon: L.divIcon({ html: '👤', className: '', iconSize: [30, 30] })
          }).addTo(map).bindPopup('Patient location');
        }
        map.setView([lat, lon], 15);
      }

      if (data.safeZoneInfo) {
        const sz = data.safeZoneInfo;
        document.getElementById('radius').textContent = \`\${sz.radius}m\`;
        if (safeZoneCircle) {
          safeZoneCircle.setLatLng([sz.centerLat, sz.centerLon]);
          safeZoneCircle.setRadius(sz.radius);
        } else {
          safeZoneCircle = L.circle([sz.centerLat, sz.centerLon], {
            radius: sz.radius,
            color: '#2C3E50',
            fillColor: '#2C3E50',
            fillOpacity: 0.1,
          }).addTo(map);
          centerMarker = L.marker([sz.centerLat, sz.centerLon], {
            icon: L.divIcon({ html: '🏠', className: '', iconSize: [30, 30] })
          }).addTo(map).bindPopup('Safe Zone Center');
        }
      }

      document.getElementById('refreshBar').textContent =
        \`Last updated: \${new Date().toLocaleTimeString()} | Auto-refreshes every 30 seconds\`;

      const alertsList = document.getElementById('alertsList');
      if (data.alertHistory && data.alertHistory.length > 0) {
        alertsList.innerHTML = data.alertHistory.map(alert => \`
          <div class="alert-item">
            <div>
              <div class="alert-type">\${alert.type === 'geofence' ? '🚧 Safe Zone Breach' : '🤸 Fall Detected'}</div>
              <div class="alert-time">\${alert.message || ''}</div>
            </div>
            <div style="text-align: right;">
              <div class="alert-time">\${new Date(alert.timestamp).toLocaleTimeString()}</div>
              <div class="alert-time">\${new Date(alert.timestamp).toLocaleDateString()}</div>
              \${alert.lat ? \`<a href="https://www.google.com/maps?q=\${alert.lat},\${alert.lon}" target="_blank" style="color: #2C3E50; font-size: 12px;">📍 View</a>\` : ''}
            </div>
          </div>
        \`).join('');
      } else {
        alertsList.innerHTML = '<div class="no-data">No alerts yet</div>';
      }
    } catch (e) {
      console.error('Error fetching data:', e);
    }
  }

  fetchData();
  setInterval(fetchData, 30000);
<\/script>
</body>
</html>
  `);
});

app.get('/', (req, res) => {
  res.json({ status: 'Safe Step Server running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
