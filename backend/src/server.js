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
const adminRoutes = require('./routes/admin');
const notificationRoutes = require('./routes/notifications');

const app = express();

// CRITIQUE: Necesaire sur Vercel (proxy) sinon express-rate-limit bloque tout
app.set('trust proxy', 1);

// Securite (assouplie pour Vercel)
app.use(helmet({
  crossOriginResourcePolicy: { policy: 'cross-origin' },
  contentSecurityPolicy: false
}));

// CORS ouvert pour la beta
app.use(cors({
  origin: true,
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

// Rate limiting (desactive en dev)
if (process.env.NODE_ENV === 'production') {
  const limiter = rateLimit({
    windowMs: 15 * 60 * 1000,
    max: 300,
    standardHeaders: true,
    legacyHeaders: false,
    message: { error: 'Trop de requetes, reessayez dans 15 minutes.' }
  });
  app.use('/api/', limiter);
}

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
app.use('/api/admin', adminRoutes);
app.use('/api/notifications', notificationRoutes);

// Health check
app.get('/api/health', (req, res) => {
  res.json({
    status: 'ok',
    timestamp: new Date().toISOString(),
    env: {
      supabase: !!process.env.SUPABASE_URL,
      anthropic: !!process.env.ANTHROPIC_API_KEY,
      service_role: !!process.env.SUPABASE_SERVICE_ROLE_KEY
    }
  });
});

app.get('/', (req, res) => {
  res.json({ name: 'DIP Pilot API', version: '1.0.0', status: 'ok' });
});

// 404 handler
app.use((req, res) => {
  res.status(404).json({ error: 'Route non trouvee: ' + req.method + ' ' + req.path });
});

// Erreurs globales
app.use((err, req, res, next) => {
  console.error('[ERROR]', err.message);
  res.status(err.status || 500).json({ error: err.message || 'Erreur interne' });
});

// Export pour Vercel serverless
module.exports = app;

// Demarrage local uniquement
if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log('DIP Pilot API sur port ' + PORT));
}
