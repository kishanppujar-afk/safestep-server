require('dotenv').config();
const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');
const path = require('path');

const app = express();
app.use(cors());
app.use(express.json());
app.use(express.static('public'));

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

// Dashboard page
app.get('/dashboard', (req, res) => {
  res.sendFile(path.join(__dirname, 'public', 'dashboard.html'));
});

app.get('/', (req, res) => {
  res.json({ status: 'Safe Step Server running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));
