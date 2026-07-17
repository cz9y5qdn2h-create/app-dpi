const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// GET /api/monitoring/sources
router.get('/sources', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('monitoring_sources')
      .select('*, monitoring_results(id, impact_level, change_detected, checked_at)')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/monitoring/sources
router.post('/sources', authMiddleware, requireFranchisor, async (req, res) => {
  const { name, url, description, keywords } = req.body;
  if (!name || !url) return res.status(400).json({ error: 'name et url requis' });
  try {
    const { data, error } = await supabaseAdmin
      .from('monitoring_sources')
      .insert({ user_id: req.user.id, name, url, description, keywords: keywords || [] })
      .select()
      .single();
    if (error) throw error;
    res.status(201).json(data);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/monitoring/sources/:id
router.delete('/sources/:id', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { error } = await supabaseAdmin
      .from('monitoring_sources')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);
    if (error) throw error;
    res.status(204).send();
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/monitoring/check/:sourceId
router.post('/check/:sourceId', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { data: source, error: srcErr } = await supabaseAdmin
      .from('monitoring_sources')
      .select('*')
      .eq('id', req.params.sourceId)
      .eq('user_id', req.user.id)
      .single();
    if (srcErr || !source) return res.status(404).json({ error: 'Source introuvable' });

    let content = '';
    let fetchError = null;
    try {
      const controller = new AbortController();
      const timeout = setTimeout(() => controller.abort(), 15000);
      const response = await fetch(source.url, {
        signal: controller.signal,
        headers: { 'User-Agent': 'DIPpro-Monitor/1.0' }
      });
      clearTimeout(timeout);
      const html = await response.text();
      content = html
        .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, '')
        .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, '')
        .replace(/<[^>]+>/g, ' ')
        .replace(/\s+/g, ' ')
        .trim()
        .slice(0, 8000);
    } catch (e) {
      fetchError = e.message;
      content = '';
    }

    const contentHash = content ? Buffer.from(content).toString('base64').slice(0, 64) : '';
    const changeDetected = source.last_content_hash !== null && source.last_content_hash !== contentHash;

    let impactLevel = 'none';
    let impactSummary = null;
    let impactDetail = null;

    if (content && (!source.last_content_hash || changeDetected)) {
      const keywords = source.keywords?.length > 0 ? source.keywords.join(', ') : 'franchise, DIP, Loi Doubin';
      const aiResponse = await anthropic.messages.create({
        model: 'claude-opus-4-8',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `Tu es un expert en droit de la franchise française (Loi Doubin, art. L.330-3 Code de commerce).

Analyse ce contenu web extrait de "${source.url}" :

---
${content.slice(0, 6000)}
---

Mots-clés à surveiller : ${keywords}

Réponds en JSON avec exactement ce format :
{
  "impact_level": "none|low|medium|high|critical",
  "impact_summary": "Résumé court (1 phrase) de l'impact potentiel sur un DIP franchise",
  "impact_detail": "Explication détaillée (2-3 phrases) si impact > none, sinon null",
  "change_relevant": true/false
}

- "none" : aucune information pertinente pour un DIP
- "low" : information marginalement pertinente
- "medium" : changement notable qui pourrait nécessiter une mise à jour
- "high" : changement important qui nécessite probablement une révision du DIP
- "critical" : changement réglementaire ou légal qui impose une mise à jour immédiate du DIP`
        }]
      });

      try {
        const rawJson = aiResponse.content[0].text.trim();
        const parsed = JSON.parse(rawJson.replace(/```json\n?/g, '').replace(/```\n?/g, ''));
        impactLevel = parsed.impact_level || 'none';
        impactSummary = parsed.impact_summary;
        impactDetail = parsed.impact_detail;
      } catch {
        impactLevel = 'low';
        impactSummary = 'Contenu récupéré — analyse manuelle recommandée';
      }
    } else if (fetchError) {
      impactLevel = 'none';
      impactSummary = `Impossible de récupérer la page : ${fetchError}`;
    }

    const { data: result, error: resErr } = await supabaseAdmin
      .from('monitoring_results')
      .insert({
        source_id: source.id,
        user_id: req.user.id,
        change_detected: changeDetected,
        impact_level: impactLevel,
        impact_summary: impactSummary,
        impact_detail: impactDetail,
        content_snippet: content.slice(0, 500) || null
      })
      .select()
      .single();
    if (resErr) throw resErr;

    await supabaseAdmin
      .from('monitoring_sources')
      .update({
        last_checked_at: new Date().toISOString(),
        last_content_hash: contentHash || source.last_content_hash,
        updated_at: new Date().toISOString()
      })
      .eq('id', source.id);

    res.json({ result, changeDetected, fetchError: fetchError || null });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/monitoring/news — flux d'actualités franchise/juridique
router.get('/news', authMiddleware, async (req, res) => {
  const Parser = require('rss-parser');
  const parser = new Parser({ timeout: 8000, headers: { 'User-Agent': 'DIPpro-Monitor/1.0' } });

  const FEEDS = [
    { id: 'fff', name: 'Fédération Française de la Franchise', url: 'https://www.franchise-fff.com/feed/', category: 'franchise', color: '#F5C842' },
    { id: 'village_justice', name: 'Village de la Justice', url: 'https://www.village-justice.com/rss.php', category: 'juridique', color: '#60a5fa' },
    { id: 'legifrance', name: 'Légifrance — JORF', url: 'https://www.legifrance.gouv.fr/rss/jorf.xml', category: 'réglementaire', color: '#f87171' },
    { id: 'entreprendre', name: 'Entreprendre.fr', url: 'https://www.entreprendre.fr/feed/', category: 'franchise', color: '#34d399' },
    { id: 'toute_franchise', name: 'Toute la Franchise', url: 'https://www.toute-la-franchise.com/feed/', category: 'franchise', color: '#a78bfa' },
  ];

  const results = await Promise.allSettled(
    FEEDS.map(async (feed) => {
      const parsed = await parser.parseURL(feed.url);
      return parsed.items.slice(0, 5).map(item => ({
        id: `${feed.id}-${Buffer.from(item.link || item.title || '').toString('base64').slice(0, 12)}`,
        title: item.title?.trim() || 'Sans titre',
        url: item.link || '',
        date: item.pubDate || item.isoDate || null,
        summary: (item.contentSnippet || item.content || '').replace(/<[^>]+>/g, '').trim().slice(0, 200) || null,
        source: feed.name,
        sourceId: feed.id,
        category: feed.category,
        color: feed.color,
      }));
    })
  );

  const items = results
    .filter(r => r.status === 'fulfilled')
    .flatMap(r => r.value)
    .sort((a, b) => (b.date ? new Date(b.date) : 0) - (a.date ? new Date(a.date) : 0))
    .slice(0, 30);

  const successCount = results.filter(r => r.status === 'fulfilled').length;
  res.json({ items, feedsOk: successCount, feedsTotal: FEEDS.length });
});

// GET /api/monitoring/results
router.get('/results', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('monitoring_results')
      .select('*, monitoring_sources(name, url)')
      .eq('user_id', req.user.id)
      .order('checked_at', { ascending: false })
      .limit(50);
    if (error) throw error;
    res.json(data || []);
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
