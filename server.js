
const express = require('express');
const path = require('path');
const app = express();

// Cloud Run requires the server to listen on the port provided by the PORT environment variable.
const port = process.env.PORT || 8080;

// Serve static files from the current directory.
app.use(express.static(__dirname));

// Handle client-side routing by serving index.html for all non-static file requests.
app.get('*', (req, res) => {
  res.sendFile(path.join(__dirname, 'index.html'));
});

// Listen on 0.0.0.0 as required by container environments.
app.listen(port, '0.0.0.0', () => {
  console.log(`Kairos application listening on port ${port}`);
});
