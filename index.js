const express = require('express');
const app = express();

app.use(express.json());

// Log systématique de chaque requête reçue
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] REQUÊTE : ${req.method} ${req.url}`);
  next();
});

const RELAY_SECRET = process.env.RELAY_SECRET || "zura_secret_relay_key_2026";

// Accepte TOUTES les routes (*), que Supabase appelle / ou /api/payout
app.all('*', async (req, res) => {
  if (req.method === 'GET') {
    return res.status(200).send('Relais Zura -> SaasPay OK');
  }

  const clientSecret = req.headers['x-relay-secret'];
  if (clientSecret !== RELAY_SECRET) {
    console.error('❌ Secret relais invalide');
    return res.status(401).json({ error: 'Accès refusé au relais Zura' });
  }

  const authHeader = req.headers['authorization'];
  if (!authHeader) {
    return res.status(401).json({ error: 'Clé API SaasPay manquante' });
  }

  try {
    console.log('🔄 Redirection vers SaasPay...', req.body);

    const saaspayResponse = await fetch('https://app.saspay.me/api/v1/payouts', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Idempotency-Key': req.headers['idempotency-key'] || ''
      },
      body: JSON.stringify(req.body)
    });

    const text = await saaspayResponse.text();
    let data;
    try { data = JSON.parse(text); } catch { data = { raw: text }; }

    console.log(`✅ Réponse SaasPay (${saaspayResponse.status}):`, data);
    return res.status(saaspayResponse.status).json(data);
  } catch (error) {
    console.error('❌ Erreur lors du transfert :', error);
    return res.status(500).json({ error: error.message });
  }
});

const PORT = process.env.PORT || 10000;
app.listen(PORT, () => {
  console.log(`Relais en ligne sur le port ${PORT}`);
});
