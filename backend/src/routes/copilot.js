const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const Anthropic = require('@anthropic-ai/sdk');

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const SYSTEM = `Tu es DIPpro Copilot, l'assistant IA intégré à la plateforme DIPpro.

DIPpro aide les franchiseurs français à gérer leurs Documents d'Information Précontractuelle (DIP), obligatoires selon la Loi Doubin (art. L.330-3 Code de commerce).

Tu peux :
- Répondre aux questions sur le DIP, la Loi Doubin et les obligations légales franchise
- Consulter les données DIP de l'utilisateur en temps réel via tes outils
- Effectuer des actions : valider des corrections IA, ignorer des alertes, consulter l'état du compte
- Faire un checkup complet (score, alertes en attente, historique récent)

Règles :
- Sois concis, professionnel et direct
- Mentionne toujours l'impact légal quand pertinent
- Réponds en français (ou anglais si l'utilisateur parle anglais)
- Avant de modifier des données, informe clairement l'utilisateur de ce que tu vas faire`;

const TOOLS = [
  {
    name: 'get_dip_status',
    description: "Récupère le statut complet du DIP actif : score de conformité, sections conformes/non conformes, date du dernier import",
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_pending_alerts',
    description: "Récupère toutes les alertes et corrections IA en attente de validation",
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'validate_alert',
    description: "Valide et applique une correction IA sur le DIP",
    input_schema: {
      type: 'object',
      properties: { alert_id: { type: 'string', description: "UUID de l'alerte à valider" } },
      required: ['alert_id']
    }
  },
  {
    name: 'ignore_alert',
    description: "Ignore une alerte (la marque comme ignorée sans modifier le DIP)",
    input_schema: {
      type: 'object',
      properties: { alert_id: { type: 'string', description: "UUID de l'alerte à ignorer" } },
      required: ['alert_id']
    }
  },
  {
    name: 'get_franchisees',
    description: "Récupère la liste des franchisés avec statut et contact",
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'get_history',
    description: "Récupère les 10 derniers événements de l'historique des modifications",
    input_schema: { type: 'object', properties: {}, required: [] }
  },
  {
    name: 'full_checkup',
    description: "Lance un checkup complet : récupère le DIP, les alertes et l'historique pour dresser un bilan de conformité",
    input_schema: { type: 'object', properties: {}, required: [] }
  }
];

async function executeTool(name, input, userId) {
  try {
    switch (name) {
      case 'get_dip_status': {
        const { data: dip } = await supabaseAdmin
          .from('dip_documents')
          .select('id, name, score, status, created_at')
          .eq('user_id', userId)
          .eq('is_active', true)
          .maybeSingle();
        if (!dip) return { error: 'Aucun DIP actif. Importez votre premier DIP.' };
        const { data: sections } = await supabaseAdmin
          .from('dip_sections').select('status').eq('dip_id', dip.id);
        const stats = (sections || []).reduce((a, s) => { a[s.status] = (a[s.status] || 0) + 1; return a; }, {});
        return { name: dip.name, score: dip.score, status: dip.status, last_import: dip.created_at, sections: { total: sections?.length || 0, conforme: stats.conforme || 0, a_verifier: stats.a_verifier || 0, non_conforme: stats.non_conforme || 0 } };
      }
      case 'get_pending_alerts': {
        const { data } = await supabaseAdmin.from('alerts').select('id, title, section_number, impact_level, type, status').eq('user_id', userId).eq('status', 'pending').order('created_at', { ascending: false }).limit(10);
        return { alerts: data || [], count: data?.length || 0 };
      }
      case 'validate_alert': {
        const { error } = await supabaseAdmin.from('alerts').update({ status: 'validated', validated_at: new Date().toISOString() }).eq('id', input.alert_id).eq('user_id', userId);
        if (error) return { error: error.message };
        return { success: true, validated_id: input.alert_id };
      }
      case 'ignore_alert': {
        const { error } = await supabaseAdmin.from('alerts').update({ status: 'ignored' }).eq('id', input.alert_id).eq('user_id', userId);
        if (error) return { error: error.message };
        return { success: true, ignored_id: input.alert_id };
      }
      case 'get_franchisees': {
        const { data } = await supabaseAdmin.from('franchisees').select('id, name, email, territory, status').eq('franchiseur_id', userId).order('name');
        return { franchisees: data || [], count: data?.length || 0 };
      }
      case 'get_history': {
        const { data } = await supabaseAdmin.from('history_events').select('event_type, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(10);
        return { events: data || [] };
      }
      case 'full_checkup': {
        const [dipRes, alertsRes, historyRes] = await Promise.all([
          supabaseAdmin.from('dip_documents').select('id, name, score, status, created_at').eq('user_id', userId).eq('is_active', true).maybeSingle(),
          supabaseAdmin.from('alerts').select('id, title, impact_level, status').eq('user_id', userId).eq('status', 'pending').limit(20),
          supabaseAdmin.from('history_events').select('event_type, description, created_at').eq('user_id', userId).order('created_at', { ascending: false }).limit(5)
        ]);
        return {
          dip: dipRes.data || null,
          pending_alerts: { count: alertsRes.data?.length || 0, critical: (alertsRes.data || []).filter(a => a.impact_level === 'critical').length, items: alertsRes.data || [] },
          recent_history: historyRes.data || []
        };
      }
      default:
        return { error: `Outil inconnu: ${name}` };
    }
  } catch (e) {
    return { error: e.message };
  }
}

router.post('/chat', authMiddleware, requireFranchisor, async (req, res) => {
  const { messages } = req.body;
  if (!Array.isArray(messages) || messages.length === 0) {
    return res.status(400).json({ error: 'messages requis' });
  }

  try {
    let currentMessages = messages.slice(-20);
    const actions = [];

    for (let i = 0; i < 6; i++) {
      const response = await anthropic.messages.create({
        model: 'claude-opus-4-7',
        max_tokens: 1024,
        system: SYSTEM,
        tools: TOOLS,
        messages: currentMessages
      });

      if (response.stop_reason === 'end_turn') {
        const text = response.content.find(b => b.type === 'text')?.text || '';
        return res.json({ reply: text, actions });
      }

      if (response.stop_reason === 'tool_use') {
        const toolUses = response.content.filter(b => b.type === 'tool_use');
        const toolResults = [];
        for (const tu of toolUses) {
          const result = await executeTool(tu.name, tu.input, req.user.id);
          actions.push({ tool: tu.name, input: tu.input, result });
          toolResults.push({ type: 'tool_result', tool_use_id: tu.id, content: JSON.stringify(result) });
        }
        currentMessages = [...currentMessages, { role: 'assistant', content: response.content }, { role: 'user', content: toolResults }];
        continue;
      }
      break;
    }
    res.json({ reply: "Je n'ai pas pu traiter cette demande. Réessayez.", actions });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
