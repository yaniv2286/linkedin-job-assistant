const express = require('express');
const path = require('path');

const app = express();
const PORT = 3000;

// Middleware
app.use(express.json());
app.use(express.static(path.join(__dirname, 'web-ui')));

// Routes
app.get('/', (req, res) => {
  res.sendFile(path.join(__dirname, 'web-ui', 'index.html'));
});

app.get('/api/test', (req, res) => {
  res.json({ message: 'Server is working!', timestamp: new Date().toISOString() });
});

// Start server
app.listen(PORT, () => {
  console.log(`LinkedIn Job Assistant running on http://localhost:${PORT}`);
  console.log('Server started successfully!');
});
