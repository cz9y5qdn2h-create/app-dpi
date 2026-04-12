const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

// GET /api/history - Historique audit de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
  const { dip_id, limit = 50, offset = 0 } = req.query;

  let query = supabaseAdmin
    .from('audit_log')
    .select('*, dip_documents(title, user_id), dip_sections(section_title)')
    .order('timestamp', { ascending: false })
    .range(Number(offset), Number(offset) + Number(limit) - 1);

  if (dip_id) query = query.eq('dip_id', dip_id);

  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });

  const filtered = data.filter(log => log.dip_documents?.user_id === req.user.id);
  res.json({ history: filtered, total: filtered.length });
});

module.exports = router;
