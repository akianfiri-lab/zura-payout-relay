const express = require('express');
const axios = require('axios');
const app = express();

app.use(express.json());

// Clé de sécurité interne entre Zura et ce relais
const RELAY_SECRET = process.env.RELAY_SECRET || "zura_secret_relay_key_2026";

app.get('/', (req, res) => {
  res.send('Relais Zura -> SaasPay OK');
});

app.post('/api/payout', async (req, res) => {
  const clientSecret = req.headers['x-relay-secret'];
  if (clientSecret !== RELAY_SECRET) {
    return res.status(403).json({ error: "Accès refusé au relais Zura" });
  }

  try {
    const response = await axios.post('https://api.saspay.me/v1/payouts', req.body, {
      headers: {
        'Authorization': req.headers['authorization'],
        'Content-Type': 'application/json'
      }
    });
    res.status(response.status).json(response.data);
  } catch (error) {
    res.status(error.response?.status || 500).json(
      error.response?.data || { error: error.message }
    );
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => console.log(`Relais en ligne sur le port ${PORT}`));
