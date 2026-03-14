const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();
const PORT = process.env.PORT || 3001;

app.use(cors());
app.use(express.json());

app.get('/', (req, res) => {
  res.json({ message: 'Drone Cloud API' });
});

// Placeholder routes
app.get('/drones', (req, res) => {
  res.json({ drones: [] });
});

app.get('/nodes', (req, res) => {
  res.json({ nodes: [] });
});

app.get('/companies', (req, res) => {
  res.json({ companies: [] });
});

app.listen(PORT, () => {
  console.log(`API server running on port ${PORT}`);
});