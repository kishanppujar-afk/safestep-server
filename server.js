const express = require('express');
const nodemailer = require('nodemailer');
const cors = require('cors');

const app = express();
app.use(cors());
app.use(express.json());

const transporter = nodemailer.createTransport({
  service: 'gmail',
  auth: {
    user: 'kishanpujar67@gmail.com',
    pass: 'gpbddpaowxhajebc'
  }
});

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
          </div>
        </div>
      `
    });
    res.json({ success: true, message: 'Email sent successfully' });
  } catch (error) {
    console.error('Email error:', error);
    res.status(500).json({ success: false, message: error.message });
  }
});

app.get('/', (req, res) => {
  res.json({ status: 'Safe Step Email Server running' });
});

const PORT = process.env.PORT || 3000;
app.listen(PORT, () => console.log(`Server running on port ${PORT}`));