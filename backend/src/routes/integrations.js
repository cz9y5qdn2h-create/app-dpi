const express = require('express');
const router = express.Router();
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const MICROSOFT_AUTH_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/authorize';
const MICROSOFT_TOKEN_URL = 'https://login.microsoftonline.com/common/oauth2/v2.0/token';

function getAppUrl() {
  return process.env.APP_URL || 'https://app-dpi.vercel.app';
}

// GET /api/integrations/status
router.get('/status', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('user_integrations')
      .select('provider, email, scopes, connected_at, token_expiry')
      .eq('user_id', req.user.id);
    if (error) throw error;

    const byProvider = {};
    (data || []).forEach(row => {
      byProvider[row.provider] = {
        connected: true,
        email: row.email,
        scopes: row.scopes,
        connectedAt: row.connected_at,
        expired: row.token_expiry ? new Date(row.token_expiry) < new Date() : false,
      };
    });
    res.json({
      google_drive: byProvider.google_drive || { connected: false },
      google_gmail: byProvider.google_gmail || { connected: false },
      microsoft_onedrive: byProvider.microsoft_onedrive || { connected: false },
      configured: {
        google: !!(process.env.GOOGLE_CLIENT_ID && process.env.GOOGLE_CLIENT_SECRET),
        microsoft: !!(process.env.MICROSOFT_CLIENT_ID && process.env.MICROSOFT_CLIENT_SECRET),
      }
    });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/integrations/google/connect?scope=drive|gmail
router.get('/google/connect', authMiddleware, async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google OAuth non configuré (GOOGLE_CLIENT_ID manquant)' });
  }

  const scope = req.query.scope === 'gmail'
    ? 'https://www.googleapis.com/auth/gmail.readonly https://www.googleapis.com/auth/userinfo.email'
    : 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';

  const provider = req.query.scope === 'gmail' ? 'google_gmail' : 'google_drive';
  const state = Buffer.from(JSON.stringify({ userId: req.user.id, provider })).toString('base64url');

  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: `${getAppUrl()}/api/integrations/google/callback`,
    response_type: 'code',
    scope,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.redirect(`${GOOGLE_AUTH_URL}?${params}`);
});

// GET /api/integrations/google/callback
router.get('/google/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${getAppUrl()}/integrations?error=${encodeURIComponent(error)}`);
  if (!code || !state) return res.redirect(`${getAppUrl()}/integrations?error=invalid_callback`);

  try {
    const { userId, provider } = JSON.parse(Buffer.from(state, 'base64url').toString());

    const tokenRes = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: `${getAppUrl()}/api/integrations/google/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const userInfoRes = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await supabaseAdmin.from('user_integrations').upsert({
      user_id: userId,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expiry: expiresAt,
      email: userInfo.email || null,
      scopes: tokens.scope || null,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    res.redirect(`${getAppUrl()}/integrations?connected=${provider}`);
  } catch (e) {
    res.redirect(`${getAppUrl()}/integrations?error=${encodeURIComponent(e.message)}`);
  }
});

// DELETE /api/integrations/google
router.delete('/google', authMiddleware, async (req, res) => {
  const provider = req.query.scope === 'gmail' ? 'google_gmail' : 'google_drive';
  try {
    await supabaseAdmin.from('user_integrations')
      .delete()
      .eq('user_id', req.user.id)
      .eq('provider', provider);
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/integrations/microsoft/connect
router.get('/microsoft/connect', authMiddleware, async (req, res) => {
  if (!process.env.MICROSOFT_CLIENT_ID) {
    return res.status(503).json({ error: 'Microsoft OAuth non configuré (MICROSOFT_CLIENT_ID manquant)' });
  }

  const state = Buffer.from(JSON.stringify({ userId: req.user.id, provider: 'microsoft_onedrive' })).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.MICROSOFT_CLIENT_ID,
    redirect_uri: `${getAppUrl()}/api/integrations/microsoft/callback`,
    response_type: 'code',
    scope: 'Files.Read.All User.Read offline_access',
    state,
  });
  res.redirect(`${MICROSOFT_AUTH_URL}?${params}`);
});

// GET /api/integrations/microsoft/callback
router.get('/microsoft/callback', async (req, res) => {
  const { code, state, error } = req.query;
  if (error) return res.redirect(`${getAppUrl()}/integrations?error=${encodeURIComponent(req.query.error_description || error)}`);
  if (!code || !state) return res.redirect(`${getAppUrl()}/integrations?error=invalid_callback`);

  try {
    const { userId, provider } = JSON.parse(Buffer.from(state, 'base64url').toString());

    const tokenRes = await fetch(MICROSOFT_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code,
        client_id: process.env.MICROSOFT_CLIENT_ID,
        client_secret: process.env.MICROSOFT_CLIENT_SECRET,
        redirect_uri: `${getAppUrl()}/api/integrations/microsoft/callback`,
        grant_type: 'authorization_code',
      }),
    });
    const tokens = await tokenRes.json();
    if (tokens.error) throw new Error(tokens.error_description || tokens.error);

    const userInfoRes = await fetch('https://graph.microsoft.com/v1.0/me', {
      headers: { Authorization: `Bearer ${tokens.access_token}` },
    });
    const userInfo = await userInfoRes.json();

    const expiresAt = tokens.expires_in
      ? new Date(Date.now() + tokens.expires_in * 1000).toISOString()
      : null;

    await supabaseAdmin.from('user_integrations').upsert({
      user_id: userId,
      provider,
      access_token: tokens.access_token,
      refresh_token: tokens.refresh_token || null,
      token_expiry: expiresAt,
      email: userInfo.mail || userInfo.userPrincipalName || null,
      scopes: tokens.scope || null,
      connected_at: new Date().toISOString(),
    }, { onConflict: 'user_id,provider' });

    res.redirect(`${getAppUrl()}/integrations?connected=${provider}`);
  } catch (e) {
    res.redirect(`${getAppUrl()}/integrations?error=${encodeURIComponent(e.message)}`);
  }
});

// DELETE /api/integrations/microsoft
router.delete('/microsoft', authMiddleware, async (req, res) => {
  try {
    await supabaseAdmin.from('user_integrations')
      .delete()
      .eq('user_id', req.user.id)
      .eq('provider', 'microsoft_onedrive');
    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// GET /api/integrations/local-files — liste les documents locaux de l'utilisateur
router.get('/local-files', authMiddleware, async (req, res) => {
  try {
    const { data, error } = await supabaseAdmin
      .from('local_user_files')
      .select('*')
      .eq('user_id', req.user.id)
      .order('created_at', { ascending: false });
    if (error) throw error;
    res.json({ files: data || [] });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// POST /api/integrations/local-files — enregistre un fichier uploadé + lance l'analyse IA
router.post('/local-files', authMiddleware, async (req, res) => {
  const { name, storage_path, file_url, mime_type, size_bytes } = req.body;
  if (!name || !storage_path) {
    return res.status(400).json({ error: 'name et storage_path requis' });
  }

  try {
    const { data: fileRow, error: insertErr } = await supabaseAdmin
      .from('local_user_files')
      .insert({
        user_id: req.user.id,
        name,
        storage_path,
        file_url: file_url || null,
        mime_type: mime_type || null,
        size_bytes: size_bytes || null,
        status: 'analyzing',
      })
      .select()
      .single();

    if (insertErr) throw new Error(insertErr.message);

    res.status(201).json({ file: fileRow });

    // Analyse asynchrone (ne bloque pas la réponse)
    setImmediate(async () => {
      try {
        const { data: blob, error: dlErr } = await supabaseAdmin.storage
          .from('user-documents')
          .download(storage_path);

        if (dlErr || !blob) throw new Error('Téléchargement impossible');

        const arrayBuffer = await blob.arrayBuffer();
        const buffer = Buffer.from(arrayBuffer);

        let text = '';
        if (mime_type?.includes('pdf') || name.toLowerCase().endsWith('.pdf')) {
          const pdfParse = require('pdf-parse/lib/pdf-parse.js');
          const parsed = await pdfParse(buffer);
          text = parsed.text;
        } else if (name.toLowerCase().endsWith('.docx')) {
          const mammoth = require('mammoth');
          const result = await mammoth.extractRawText({ buffer });
          text = result.value;
        }

        text = text.slice(0, 8000);

        let impactLevel = 'none';
        let impactSummary = null;

        if (text.trim().length > 50) {
          const Anthropic = require('@anthropic-ai/sdk');
          const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
          const aiResp = await client.messages.create({
            model: 'claude-sonnet-4-6',
            max_tokens: 512,
            messages: [{
              role: 'user',
              content: `Expert droit franchise française. Document : "${name}". Mots-clés : franchise, DIP, Loi Doubin.

Contenu :
${text}

Réponds UNIQUEMENT en JSON (sans markdown) :
{"impact_level":"none|low|medium|high|critical","impact_summary":"1 phrase max"}`,
            }],
          });
          const raw = aiResp.content[0].text.trim().replace(/```json?\n?/g, '').replace(/```\n?/g, '');
          try {
            const parsed = JSON.parse(raw);
            impactLevel = parsed.impact_level || 'none';
            impactSummary = parsed.impact_summary || null;
          } catch {}
        }

        await supabaseAdmin.from('local_user_files').update({
          status: 'done',
          impact_level: impactLevel,
          impact_summary: impactSummary,
          analyzed_at: new Date().toISOString(),
        }).eq('id', fileRow.id);

      } catch (analyzeErr) {
        await supabaseAdmin.from('local_user_files').update({
          status: 'error',
          impact_summary: analyzeErr.message?.slice(0, 200),
        }).eq('id', fileRow.id);
      }
    });

  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

// DELETE /api/integrations/local-files/:id
router.delete('/local-files/:id', authMiddleware, async (req, res) => {
  try {
    const { data: row } = await supabaseAdmin
      .from('local_user_files')
      .select('storage_path')
      .eq('id', req.params.id)
      .eq('user_id', req.user.id)
      .single();

    if (row?.storage_path) {
      await supabaseAdmin.storage.from('user-documents').remove([row.storage_path]);
    }

    await supabaseAdmin.from('local_user_files')
      .delete()
      .eq('id', req.params.id)
      .eq('user_id', req.user.id);

    res.json({ ok: true });
  } catch (e) {
    res.status(500).json({ error: e.message });
  }
});

module.exports = router;
