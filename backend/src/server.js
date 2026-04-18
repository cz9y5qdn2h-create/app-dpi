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
app.set('trust proxy', 1);

app.use(helmet({ crossOriginResourcePolicy: { policy: 'cross-origin' }, contentSecurityPolicy: false }));

const ALLOWED_ORIGINS = [
  'http://localhost:5173', 'http://localhost:3000', 'http://localhost:4173',
  process.env.FRONTEND_URL,
].filter(Boolean);

app.use(cors({
  origin: (origin, callback) => {
    if (!origin || ALLOWED_ORIGINS.some(o => origin.startsWith(o))) return callback(null, true);
    if (process.env.NODE_ENV !== 'production') return callback(null, true);
    console.warn('[CORS] Origine non autorisée:', origin);
    callback(null, true);
  },
  credentials: true,
  methods: ['GET', 'POST', 'PUT', 'PATCH', 'DELETE', 'OPTIONS'],
  allowedHeaders: ['Content-Type', 'Authorization', 'X-Requested-With']
}));
app.options('*', cors());

const limiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  max: process.env.NODE_ENV === 'production' ? 300 : 1000,
  standardHeaders: true, legacyHeaders: false,
  message: { error: 'Trop de requêtes — réessayez dans 15 minutes.' },
  skip: (req) => req.path === '/api/health'
});
app.use('/api/', limiter);

app.use(express.json({ limit: '15mb' }));
app.use(express.urlencoded({ extended: true, limit: '15mb' }));

app.use('/api/auth', authRoutes);
app.use('/api/dip', dipRoutes);
app.use('/api/alerts', alertRoutes);
app.use('/api/franchisees', franchiseeRoutes);
app.use('/api/export', exportRoutes);
app.use('/api/history', historyRoutes);
app.use('/api/settings', settingsRoutes);

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString(), services: { supabase: !!process.env.SUPABASE_URL, anthropic: !!process.env.ANTHROPIC_API_KEY } });
});

app.get('/', (req, res) => res.json({ name: 'DIP Pilot API', version: '1.0.0', status: 'ok' }));

app.use((req, res) => res.status(404).json({ error: `Route introuvable : ${req.method} ${req.path}` }));

app.use((err, req, res, next) => {
  console.error('[ERROR]', err.stack || err.message);
  const status = err.status || (err.type === 'entity.too.large' ? 413 : 500);
  res.status(status).json({ error: status === 413 ? 'Fichier trop volumineux (max 15 Mo)' : err.message || 'Erreur interne' });
});

module.exports = app;

if (require.main === module) {
  const PORT = process.env.PORT || 3001;
  app.listen(PORT, () => console.log(`DIP Pilot API sur port ${PORT}`));
}
