const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

router.get('/', authMiddleware, async (req, res) => {
  const { dip_id } = req.query;
  const limit = Math.min(Math.max(Number(req.query.limit) || 50, 1), 500);
  const offset = Math.max(Number(req.query.offset) || 0, 0);
  let query = supabaseAdmin
    .from('audit_log')
    .select('*, dip_documents(title), dip_sections(section_title)')
    .eq('user_id', req.user.id)
    .order('timestamp', { ascending: false })
    .range(offset, offset + limit - 1);
  if (dip_id) query = query.eq('dip_id', dip_id);
  const { data, error } = await query;
  if (error) return res.status(500).json({ error: error.message });
  res.json({ history: data || [], total: data?.length || 0 });
});

module.exports = router;
