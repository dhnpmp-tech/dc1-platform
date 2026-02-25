// DC1 Provider Onboarding Backend Server
const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.DC1_PROVIDER_PORT || 8083;

// Middleware
app.use(cors());
app.use(express.json());
app.use(express.urlencoded({ extended: true }));

// Serve static files (provider-onboarding.html etc)
app.use(express.static(path.join(__dirname, '..', 'public')));

// Clean URL route for provider onboarding
app.get('/provider-onboarding', (req, res) => {
    res.sendFile(path.join(__dirname, '../public/provider-onboarding.html'));
});

// Serve installer files for download
app.use('/installers', express.static(path.join(__dirname, '..', 'installers')));

// API Routes
const providersRouter = require('./routes/providers');
app.use('/api/providers', providersRouter);

const standupRouter = require('./routes/standup');
app.use('/api/standup', standupRouter);
const securityRouter = require('./routes/security');
app.use('/api/security', securityRouter);
const intelligenceRouter = require('./routes/intelligence');
app.use('/api/intelligence', intelligenceRouter);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', service: 'dc1-provider-onboarding', timestamp: new Date().toISOString() });
});

// Default route -> onboarding form
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, '..', 'public', 'provider-onboarding.html'));
});

app.listen(PORT, () => {
  console.log(`DC1 Provider Onboarding server running on port ${PORT}`);
  console.log(`Form: http://localhost:${PORT}/provider-onboarding.html`);
  console.log(`API:  http://localhost:${PORT}/api/providers`);
});
