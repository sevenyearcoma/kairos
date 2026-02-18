
const express = require('express');
const path = require('path');
const app = express();

// Cloud Run requires the server to listen on the port provided by the PORT environment variable.
const port = process.env.PORT || 8080;

// SECURITY MIDDLEWARE
app.use((req, res, next) => {
  // 1. HTTP Security Headers
  res.setHeader('X-Content-Type-Options', 'nosniff');
  res.setHeader('X-Frame-Options', 'DENY');
  res.setHeader('Referrer-Policy', 'strict-origin-when-cross-origin');
  
  // 2. Block access to sensitive files (dotfiles, package.json, server logic)
  if (req.path.startsWith('/.') || 
      req.path.includes('package.json') || 
      req.path.includes('server.js') ||
      req.path.includes('tsconfig.json')) {
    return res.status(403).send('Forbidden');
  }
  next();
});

// Serve static files from the current directory.
app.use(express.static(__dirname));

// Specific route for Privacy Policy
app.get('/privacy', (req, res) => {
  res.sendFile(path.join(__dirname, 'privacy.html'));
});

// Handle client-side routing by serving index.html for all non-static file requests.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on 0.0.0.0 as required by container environments.
app.listen(port, '0.0.0.0', () => {
  console.log(`Kairos application listening on port ${port}`);
});