const express = require('express');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { encrypt, decrypt } = require('../config/encryption');
const { analyzeDocumentForDIPImpact } = require('../config/claude');
const pdfParse = require('pdf-parse');
const mammoth = require('mammoth');
const router = express.Router();

const GOOGLE_AUTH_URL = 'https://accounts.google.com/o/oauth2/v2/auth';
const GOOGLE_TOKEN_URL = 'https://oauth2.googleapis.com/token';
const GOOGLE_DRIVE_BASE = 'https://www.googleapis.com/drive/v3';
const DRIVE_SCOPE = 'https://www.googleapis.com/auth/drive.readonly https://www.googleapis.com/auth/userinfo.email';
const FREQUENCY_DAYS = { '2_days': 2, '3_days': 3, '1_week': 7 };
const VALID_FREQUENCIES = Object.keys(FREQUENCY_DAYS);
const MAX_TEXT_CHARS = 40000;

// ── Helpers ────────────────────────────────────────────────────────────────

async function getValidAccessToken(monitor) {
  const bufferMs = 60 * 1000;
  if (monitor.token_expires_at && new Date(monitor.token_expires_at) > new Date(Date.now() + bufferMs)) {
    return decrypt(monitor.access_token);
  }
  const refreshToken = decrypt(monitor.refresh_token);
  if (!refreshToken || !process.env.GOOGLE_CLIENT_ID) return null;

  const resp = await fetch(GOOGLE_TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      grant_type: 'refresh_token',
      refresh_token: refreshToken,
      client_id: process.env.GOOGLE_CLIENT_ID,
      client_secret: process.env.GOOGLE_CLIENT_SECRET,
    })
  });
  if (!resp.ok) return null;

  const tokens = await resp.json();
  const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
  await supabaseAdmin.from('document_monitors').update({
    access_token: encrypt(tokens.access_token),
    token_expires_at: expiresAt,
    ...(tokens.refresh_token ? { refresh_token: encrypt(tokens.refresh_token) } : {})
  }).eq('id', monitor.id);

  return tokens.access_token;
}

async function listDriveFiles(accessToken, folderId) {
  const mimeTypes = [
    'application/pdf',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.google-apps.document',
    'application/vnd.google-apps.spreadsheet',
  ];
  const mimeFilter = mimeTypes.map(m => `mimeType='${m}'`).join(' or ');
  const folderPart = folderId ? ` and '${folderId}' in parents` : '';
  const q = encodeURIComponent(`(${mimeFilter})${folderPart} and trashed=false`);

  const resp = await fetch(
    `${GOOGLE_DRIVE_BASE}/files?q=${q}&fields=files(id,name,mimeType,modifiedTime,md5Checksum,size)&pageSize=100`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return [];
  const data = await resp.json();
  return data.files || [];
}

async function extractTextFromDriveFile(accessToken, fileId, mimeType) {
  const isGoogleDoc = mimeType === 'application/vnd.google-apps.document' || mimeType === 'application/vnd.google-apps.spreadsheet';
  const url = isGoogleDoc
    ? `${GOOGLE_DRIVE_BASE}/files/${fileId}/export?mimeType=application/pdf`
    : `${GOOGLE_DRIVE_BASE}/files/${fileId}?alt=media`;

  const resp = await fetch(url, { headers: { Authorization: `Bearer ${accessToken}` } });
  if (!resp.ok) return '';

  const buffer = Buffer.from(await resp.arrayBuffer());
  const isPdf = mimeType.includes('pdf') || isGoogleDoc;

  try {
    if (isPdf) {
      const parsed = await pdfParse(buffer);
      return (parsed.text || '').substring(0, MAX_TEXT_CHARS);
    } else {
      const result = await mammoth.extractRawText({ buffer });
      return (result.value || '').substring(0, MAX_TEXT_CHARS);
    }
  } catch {
    return '';
  }
}

// ── Core check logic ───────────────────────────────────────────────────────

async function runChecksForUser(userId) {
  const { data: monitor } = await supabaseAdmin
    .from('document_monitors')
    .select('*')
    .eq('user_id', userId)
    .eq('source', 'google_drive')
    .eq('enabled', true)
    .single();

  if (!monitor) return { changes: 0, files_checked: 0 };

  const accessToken = await getValidAccessToken(monitor);
  if (!accessToken) return { changes: 0, files_checked: 0, error: 'Token invalide' };

  const driveFiles = await listDriveFiles(accessToken, monitor.folder_id);

  const { data: tracked } = await supabaseAdmin
    .from('monitored_files')
    .select('*')
    .eq('monitor_id', monitor.id);

  const trackedMap = Object.fromEntries((tracked || []).map(f => [f.file_id, f]));

  // Fetch active DIP once for all comparisons
  let dipSections = null;
  if (monitor.auto_analyze) {
    const { data: dip } = await supabaseAdmin
      .from('dip_documents')
      .select('id')
      .eq('user_id', userId)
      .eq('status', 'actif')
      .maybeSingle();

    if (dip) {
      const { data: secs } = await supabaseAdmin
        .from('dip_sections')
        .select('section_title, content')
        .eq('dip_id', dip.id)
        .order('section_number');
      if (secs?.length) {
        dipSections = secs.map(s => `${s.section_title}: ${(s.content || '').substring(0, 400)}`).join('\n\n');
      }
    }
  }

  let changedCount = 0;
  const tasks = [];

  for (const file of driveFiles) {
    const existing = trackedMap[file.id];
    const isNew = !existing;
    const isChanged = existing &&
      file.md5Checksum &&
      existing.content_hash !== file.md5Checksum;

    if (!isNew && !isChanged) continue;
    changedCount++;

    tasks.push((async () => {
      let summary = isNew ? `Nouveau document détecté : ${file.name}` : `Document modifié : ${file.name}`;

      if (monitor.auto_analyze && dipSections) {
        try {
          const text = await extractTextFromDriveFile(accessToken, file.id, file.mimeType);
          if (text.length > 100) {
            summary = await analyzeDocumentForDIPImpact(text, dipSections, file.name);
          }
        } catch { /* keep default summary */ }
      }

      await supabaseAdmin.from('monitored_files').upsert({
        monitor_id: monitor.id,
        user_id: userId,
        file_id: file.id,
        file_name: file.name,
        mime_type: file.mimeType,
        file_size: file.size ? parseInt(file.size) : null,
        last_modified: file.modifiedTime,
        content_hash: file.md5Checksum || null,
        last_analyzed_at: new Date().toISOString(),
        status: isNew ? 'new' : 'changed',
        change_summary: summary,
      }, { onConflict: 'monitor_id,file_id' });

      await supabaseAdmin.from('alerts').insert({
        user_id: userId,
        type: 'document_change',
        title: isNew ? `Nouveau document : ${file.name}` : `Document modifié : ${file.name}`,
        description: summary,
        status: 'pending',
        created_at: new Date().toISOString(),
      });
    })());
  }

  await Promise.allSettled(tasks);

  const days = FREQUENCY_DAYS[monitor.frequency] || 7;
  await supabaseAdmin.from('document_monitors').update({
    last_check_at: new Date().toISOString(),
    next_check_at: new Date(Date.now() + days * 24 * 3600 * 1000).toISOString(),
  }).eq('id', monitor.id);

  return { changes: changedCount, files_checked: driveFiles.length };
}

// ── Routes ─────────────────────────────────────────────────────────────────

// GET /api/monitor/config
router.get('/config', authMiddleware, requireFranchisor, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('document_monitors')
    .select('id,source,folder_id,folder_name,frequency,enabled,auto_analyze,last_check_at,next_check_at,drive_email')
    .eq('user_id', req.user.id);
  res.json({ monitors: data || [] });
});

// PUT /api/monitor/config/:id
router.put('/config/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { frequency, enabled, auto_analyze, folder_id, folder_name } = req.body;
  const updates = {};

  if (frequency !== undefined) {
    if (!VALID_FREQUENCIES.includes(frequency)) return res.status(400).json({ error: 'Fréquence invalide' });
    updates.frequency = frequency;
    updates.next_check_at = new Date(Date.now() + FREQUENCY_DAYS[frequency] * 24 * 3600 * 1000).toISOString();
  }
  if (enabled !== undefined) updates.enabled = Boolean(enabled);
  if (auto_analyze !== undefined) updates.auto_analyze = Boolean(auto_analyze);
  if (folder_id !== undefined) updates.folder_id = folder_id || null;
  if (folder_name !== undefined) updates.folder_name = folder_name || null;

  const { data, error } = await supabaseAdmin
    .from('document_monitors')
    .update(updates)
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .select('id,source,folder_id,folder_name,frequency,enabled,auto_analyze,last_check_at,next_check_at,drive_email')
    .single();

  if (error) return res.status(500).json({ error: error.message });
  res.json({ monitor: data });
});

// GET /api/monitor/google/auth — lance l'OAuth
router.get('/google/auth', authMiddleware, requireFranchisor, async (req, res) => {
  if (!process.env.GOOGLE_CLIENT_ID) {
    return res.status(503).json({ error: 'Google Drive non configuré — ajoutez GOOGLE_CLIENT_ID dans Vercel' });
  }
  const redirectUri = `${process.env.BACKEND_URL || 'https://dippro.business'}/api/monitor/google/callback`;
  const state = Buffer.from(req.token).toString('base64url');
  const params = new URLSearchParams({
    client_id: process.env.GOOGLE_CLIENT_ID,
    redirect_uri: redirectUri,
    response_type: 'code',
    scope: DRIVE_SCOPE,
    access_type: 'offline',
    prompt: 'consent',
    state,
  });
  res.json({ auth_url: `${GOOGLE_AUTH_URL}?${params}` });
});

// GET /api/monitor/google/callback — reçoit le code OAuth
router.get('/google/callback', async (req, res) => {
  const { code, state, error: oauthError } = req.query;
  const frontendUrl = process.env.FRONTEND_URL || 'https://dippro.business';

  if (oauthError || !code || !state) {
    return res.redirect(`${frontendUrl}/monitor?error=oauth_denied`);
  }

  try {
    const token = Buffer.from(String(state), 'base64url').toString('utf8');
    const { data: { user }, error: authErr } = await supabaseAdmin.auth.getUser(token);
    if (authErr || !user) return res.redirect(`${frontendUrl}/monitor?error=invalid_session`);

    const redirectUri = `${process.env.BACKEND_URL || 'https://dippro.business'}/api/monitor/google/callback`;
    const tokenResp = await fetch(GOOGLE_TOKEN_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({
        code, grant_type: 'authorization_code',
        client_id: process.env.GOOGLE_CLIENT_ID,
        client_secret: process.env.GOOGLE_CLIENT_SECRET,
        redirect_uri: redirectUri,
      })
    });
    if (!tokenResp.ok) return res.redirect(`${frontendUrl}/monitor?error=token_failed`);

    const tokens = await tokenResp.json();
    const userInfoResp = await fetch('https://www.googleapis.com/oauth2/v2/userinfo', {
      headers: { Authorization: `Bearer ${tokens.access_token}` }
    });
    const userInfo = userInfoResp.ok ? await userInfoResp.json() : {};

    const expiresAt = new Date(Date.now() + (tokens.expires_in || 3600) * 1000).toISOString();
    const nextCheck = new Date(Date.now() + 7 * 24 * 3600 * 1000).toISOString();

    await supabaseAdmin.from('document_monitors').upsert({
      user_id: user.id,
      source: 'google_drive',
      access_token: encrypt(tokens.access_token),
      refresh_token: tokens.refresh_token ? encrypt(tokens.refresh_token) : undefined,
      token_expires_at: expiresAt,
      drive_email: userInfo.email || null,
      enabled: true,
      frequency: '1_week',
      next_check_at: nextCheck,
    }, { onConflict: 'user_id,source' });

    res.redirect(`${frontendUrl}/monitor?connected=google`);
  } catch (err) {
    console.error('OAuth callback:', err.message);
    res.redirect(`${frontendUrl}/monitor?error=server_error`);
  }
});

// DELETE /api/monitor/google/disconnect
router.delete('/google/disconnect', authMiddleware, requireFranchisor, async (req, res) => {
  await supabaseAdmin.from('document_monitors')
    .delete().eq('user_id', req.user.id).eq('source', 'google_drive');
  res.json({ message: 'Google Drive déconnecté' });
});

// GET /api/monitor/google/folders — liste les dossiers Drive
router.get('/google/folders', authMiddleware, requireFranchisor, async (req, res) => {
  const { data: monitor } = await supabaseAdmin
    .from('document_monitors').select('*')
    .eq('user_id', req.user.id).eq('source', 'google_drive').single();
  if (!monitor) return res.status(404).json({ error: 'Google Drive non connecté' });

  const accessToken = await getValidAccessToken(monitor);
  if (!accessToken) return res.status(401).json({ error: 'Reconnectez Google Drive' });

  const resp = await fetch(
    `${GOOGLE_DRIVE_BASE}/files?q=${encodeURIComponent("mimeType='application/vnd.google-apps.folder' and trashed=false")}&fields=files(id,name)&pageSize=50&orderBy=name`,
    { headers: { Authorization: `Bearer ${accessToken}` } }
  );
  if (!resp.ok) return res.status(502).json({ error: 'Impossible de lister les dossiers' });
  const data = await resp.json();
  res.json({ folders: [{ id: null, name: 'Tout Mon Drive' }, ...(data.files || [])] });
});

// GET /api/monitor/files — liste les fichiers surveillés
router.get('/files', authMiddleware, requireFranchisor, async (req, res) => {
  const { data } = await supabaseAdmin
    .from('monitored_files')
    .select('id,file_name,mime_type,file_size,last_modified,status,change_summary,last_analyzed_at')
    .eq('user_id', req.user.id)
    .order('last_modified', { ascending: false })
    .limit(100);
  res.json({ files: data || [] });
});

// POST /api/monitor/check-now — vérification manuelle
router.post('/check-now', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const result = await runChecksForUser(req.user.id);
    res.json(result);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/monitor/run — endpoint cron Vercel
router.get('/run', async (req, res) => {
  const secret = process.env.MONITOR_CRON_SECRET;
  if (secret && req.headers.authorization !== `Bearer ${secret}`) {
    return res.status(401).json({ error: 'Unauthorized' });
  }

  const { data: due } = await supabaseAdmin
    .from('document_monitors')
    .select('user_id')
    .eq('enabled', true)
    .lte('next_check_at', new Date().toISOString());

  if (!due?.length) return res.json({ checked: 0 });

  let totalChanges = 0;
  for (const { user_id } of due) {
    try {
      const r = await runChecksForUser(user_id);
      totalChanges += r.changes || 0;
    } catch (err) {
      console.error(`Monitor cron error user=${user_id}:`, err.message);
    }
  }
  res.json({ checked: due.length, totalChanges });
});

module.exports = router;
