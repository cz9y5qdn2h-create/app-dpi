require('dotenv').config();
const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');

const authRoutes = require('./routes/auth');
const dipRoutes = require('./routes/dip');
const alertRoutes = require('./routes/alerts');
const franchiseeRoutes = require('./routes/franchisees');
const exportRoutes = require('./routes/export');
const historyRoutes = require('./routes/history');
const settingsRoutes = require('./routes/settings');

const app = express();

// Securite
app.use(helmet({ crossOriginResourcePolicy: false }));

// CORS - accepte toutes les origines en beta
app.use(cors({
  origin: true, // accepte toutes les origines
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization']
}));
app.options('*', cors()); // preflight

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: 200,
  message: { error: 'Trop de requetes, reessayez dans 15 minutes.' }
});
app.use('/api/', limiter);

app.use(express.json({ limit: '50mb' }));
app.use(express.urlencoded({ extended: true, limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/dip', dipRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/franchisees', franchiseeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Route racine
app.get('/', (req, res) => {
  res.json({ name: 'DIP Pilot API', version: '1.0.0', status: 'running' });
});

// Gestion erreurs globale
app.use((err, req, res, next) => {
  console.error(err.stack);
  res.status(err.status || 500).json({
    error: err.message || 'Erreur interne du serveur'
  });
});

// Pour Vercel serverless ET local
const PORT = process.env.PORT || 3001;
if (process.env.NODE_ENV !== 'production' || process.env.VERCEL !== '1') {
  app.listen(PORT, () => {
    console.log('DIP Pilot API demarree sur le port ' + PORT);
  });
}

// IMPORTANT: exporter pour Vercel serverless
module.exports = app;
