const express = require('express');
const app = express();

app.use(express.json());

// Log systématique de chaque requête reçue
app.use((req, res, next) => {
  console.log(`[${new Date().toLocaleTimeString()}] REQUÊTE : ${req.method} ${req.url}`);
  next();
});

const RELAY_SECRET = process.env.RELAY_SECRET || "zura_secret_relay_key_2026";

// Affiche directement l'IP publique dans ton navigateur
app.get('/', async (req, res) => {
  try {
    const ipRes = await fetch('https://api.ipify.org?format=json');
    const ipData = await ipRes.json();
    console.log(`🌐 IP PUBLIQUE RENDER : ${ipData.ip}`);
    
    return res.status(200).send(`
      <div style="font-family: Arial, sans-serif; padding: 40px; text-align: center; background: #0f172a; color: white; min-height: 100vh;">
        <h2>Relais Zura ➔ SaasPay OK ✅</h2>
        <p style="font-size: 18px; color: #94a3b8;">Adresse IP publique de ton serveur Render :</p>
        <h1 style="color: #38bdf8; background: #1e293b; display: inline-block; padding: 15px 30px; border-radius: 12px; font-size: 36px; letter-spacing: 2px;">${ipData.ip}</h1>
        <p style="color: #cbd5e1; margin-top: 20px;">Copie cette adresse IP et colle-la dans la whitelist Payout de SaasPay.</p>
      </div>
    `);
  } catch (err) {
    return res.status(200).send('Relais Zura -> SaasPay OK (Erreur lors de la récupération de l\'IP)');
  }
});

app.all('*', async (req, res) => {
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
    const baseKey = req.headers['idempotency-key'] || 'payout';
    const uniqueIdempotencyKey = `${baseKey}_${Date.now()}_${Math.floor(Math.random() * 1000)}`;

    console.log(`🔄 Redirection vers SaasPay API [Key: ${uniqueIdempotencyKey}]...`, req.body);

    const saaspayResponse = await fetch('https://api.saspay.me/api/v1/payouts/initialize/', {
      method: 'POST',
      headers: {
        'Authorization': authHeader,
        'Content-Type': 'application/json',
        'Idempotency-Key': uniqueIdempotencyKey
      },
      body: JSON.stringify(req.body)
    });

    const text = await saaspayResponse.text();
    let data;
    try { 
      data = JSON.parse(text); 
    } catch { 
      data = { raw: text }; 
    }

    console.log(`✅ Réponse SaasPay (${saaspayResponse.status}):`, data);

    if (!saaspayResponse.ok) {
      let extractedError = 'Erreur inconnue de SaasPay';
      if (typeof data === 'object' && data !== null) {
        if (typeof data.error === 'object' && data.error !== null) {
          extractedError = data.error.message || JSON.stringify(data.error);
        } else {
          extractedError = data.message || data.error || data.detail || JSON.stringify(data);
        }
      } else {
        extractedError = String(data);
      }

      return res.status(saaspayResponse.status).json({
        error: extractedError,
        raw: data
      });
    }

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
