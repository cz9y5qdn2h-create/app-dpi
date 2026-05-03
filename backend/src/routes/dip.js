const express = require('express');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { parseDIPSections, compareDIPVersions } = require('../config/claude');
const errMsg = require('../config/errorMessage');
const router = express.Router();

const BUCKET = 'dip-files';

const extractText = async (buffer, filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
    // Use internal module to avoid test-file loading crash in serverless
    const pdfParse = require('pdf-parse/lib/pdf-parse.js');
    const data = await pdfParse(buffer);
    return data.text;
  } else if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Format non supporté (PDF ou DOCX requis)');
};

// S'assurer que le bucket existe (créé automatiquement si absent)
const ensureBucket = async () => {
  const { data: buckets } = await supabaseAdmin.storage.listBuckets();
  const exists = buckets?.some(b => b.id === BUCKET);
  if (!exists) {
    await supabaseAdmin.storage.createBucket(BUCKET, {
      public: true,
      fileSizeLimit: 52428800,
      allowedMimeTypes: [
        'application/pdf',
        'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
        'application/msword'
      ]
    });
  }
};

// GET /api/dip/upload-url — génère une URL signée pour upload direct vers Supabase Storage
router.get('/upload-url', authMiddleware, requireFranchisor, async (req, res) => {
  const { filename } = req.query;
  if (!filename) return res.status(400).json({ error: 'filename requis' });

  const ext = path.extname(filename).toLowerCase();
  if (!['.pdf', '.docx', '.doc'].includes(ext)) {
    return res.status(400).json({ error: 'Format non supporté. Utilisez PDF ou DOCX.' });
  }

  try {
    await ensureBucket();

    const storagePath = `${req.user.id}/${Date.now()}_${filename}`;

    const { data, error } = await supabaseAdmin.storage
      .from(BUCKET)
      .createSignedUploadUrl(storagePath);

    if (error) return res.status(500).json({ error: 'Impossible de générer le lien upload: ' + error.message });

    res.json({ signed_url: data.signedUrl, storage_path: storagePath });
  } catch (err) {
    console.error('upload-url error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// POST /api/dip/process — télécharge depuis Storage, extrait le texte, analyse avec Claude
router.post('/process', authMiddleware, requireFranchisor, async (req, res) => {
  const { storage_path, title } = req.body;
  if (!storage_path) return res.status(400).json({ error: 'storage_path requis' });

  try {
    // Télécharger le fichier depuis Supabase Storage (pas de limite de taille côté backend)
    const { data: fileBlob, error: dlError } = await supabaseAdmin.storage
      .from(BUCKET)
      .download(storage_path);

    if (dlError) throw new Error('Téléchargement impossible: ' + dlError.message);

    const arrayBuffer = await fileBlob.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);

    const rawText = await extractText(buffer, storage_path);

    if (!rawText || rawText.trim().length < 50) {
      throw new Error('Le fichier ne contient pas assez de texte lisible. Vérifiez que le PDF n\'est pas scanné (image) ou protégé.');
    }

    const fileUrl = supabaseAdmin.storage.from(BUCKET).getPublicUrl(storage_path).data.publicUrl;
    const docTitle = title || path.basename(storage_path).replace(/^\d+_/, '').replace(/\.(pdf|docx|doc)$/i, '');

    // Vérifier s'il existe déjà un DIP actif
    const { data: existingDips } = await supabaseAdmin
      .from('dip_documents')
      .select('id, raw_text, title, conformity_score')
      .eq('user_id', req.user.id)
      .eq('status', 'actif')
      .order('created_at', { ascending: false })
      .limit(1);

    const previousDip = existingDips?.[0];

    // MODE COMPARAISON : DIP existant détecté
    if (previousDip && previousDip.raw_text) {
      const comparison = await compareDIPVersions(previousDip.raw_text, rawText);

      const { data: draftDip, error: draftError } = await supabaseAdmin
        .from('dip_documents')
        .insert({
          user_id: req.user.id,
          title: docTitle,
          file_url: fileUrl,
          status: 'brouillon',
          conformity_score: previousDip.conformity_score,
          raw_text: rawText.substring(0, 50000)
        })
        .select()
        .single();

      if (draftError) throw new Error(draftError.message);

      await supabaseAdmin.from('audit_log').insert({
        dip_id: draftDip.id,
        action: 'upload_nouvelle_version',
        user_id: req.user.id,
        new_content: JSON.stringify({
          filename: path.basename(storage_path),
          nb_changements: comparison.changements?.length || 0,
          previous_dip_id: previousDip.id
        }),
        timestamp: new Date().toISOString()
      });

      return res.json({
        mode: 'comparison',
        draft_dip_id: draftDip.id,
        previous_dip_id: previousDip.id,
        changements: comparison.changements || [],
        resume: comparison.resume,
        nb_changements_critiques: comparison.nb_changements_critiques || 0
      });
    }

    // MODE INITIAL : premier DIP
    const parsed = await parseDIPSections(rawText);

    const { data: dipDoc, error: dipError } = await supabaseAdmin
      .from('dip_documents')
      .insert({
        user_id: req.user.id,
        title: docTitle,
        file_url: fileUrl,
        status: 'actif',
        conformity_score: parsed.global_score || 0,
        raw_text: rawText.substring(0, 50000)
      })
      .select()
      .single();

    if (dipError) throw new Error(dipError.message);

    const sectionsToInsert = (parsed.sections || []).map(s => ({
      dip_id: dipDoc.id,
      section_number: s.section_number,
      section_title: s.section_title,
      content: s.content,
      status: s.status || 'a_verifier',
      last_checked: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }));

    if (sectionsToInsert.length > 0) {
      await supabaseAdmin.from('dip_sections').insert(sectionsToInsert);
    }

    await supabaseAdmin.from('audit_log').insert({
      dip_id: dipDoc.id,
      action: 'upload_initial',
      user_id: req.user.id,
      new_content: JSON.stringify({
        filename: path.basename(storage_path),
        score: parsed.global_score,
        sections: sectionsToInsert.length
      }),
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      mode: 'initial',
      dip: dipDoc,
      sections_count: sectionsToInsert.length,
      conformity_score: parsed.global_score,
      summary: parsed.summary
    });

  } catch (err) {
    console.error('DIP process error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// POST /api/dip/approve-changes
router.post('/approve-changes', authMiddleware, requireFranchisor, async (req, res) => {
  const { draft_dip_id, previous_dip_id, approved_changes } = req.body;
  if (!draft_dip_id || !previous_dip_id) {
    return res.status(400).json({ error: 'draft_dip_id et previous_dip_id requis' });
  }

  try {
    await supabaseAdmin
      .from('dip_documents')
      .update({ status: 'archive' })
      .eq('id', previous_dip_id)
      .eq('user_id', req.user.id);

    const { data: newDip, error: activateError } = await supabaseAdmin
      .from('dip_documents')
      .update({ status: 'actif' })
      .eq('id', draft_dip_id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (activateError) throw new Error(activateError.message);

    const { data: previousSections } = await supabaseAdmin
      .from('dip_sections')
      .select('*')
      .eq('dip_id', previous_dip_id)
      .order('section_number');

    if (previousSections?.length > 0) {
      const newSections = previousSections.map(s => ({
        dip_id: draft_dip_id,
        section_number: s.section_number,
        section_title: s.section_title,
        content: s.content,
        status: s.status,
        last_checked: new Date().toISOString(),
        last_updated: new Date().toISOString()
      }));

      if (approved_changes?.length > 0) {
        approved_changes.forEach(change => {
          const section = newSections.find(s => s.section_number === change.section_number);
          if (section && change.proposition_texte) {
            section.content = change.proposition_texte;
            section.status = 'a_verifier';
            section.last_updated = new Date().toISOString();
          }
        });
      }

      await supabaseAdmin.from('dip_sections').insert(newSections);

      const conformeCount = newSections.filter(s => s.status === 'conforme').length;
      const score = Math.round((conformeCount / newSections.length) * 100);
      await supabaseAdmin.from('dip_documents').update({ conformity_score: score }).eq('id', draft_dip_id);
    }

    await supabaseAdmin.from('audit_log').insert({
      dip_id: draft_dip_id,
      action: 'version_approved',
      user_id: req.user.id,
      new_content: JSON.stringify({ nb_changes_approved: approved_changes?.length || 0, previous_dip_id }),
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Nouvelle version activée', dip: newDip });
  } catch (err) {
    console.error('Approve changes error:', err.message);
    res.status(500).json({ error: errMsg(err) });
  }
});

// GET /api/dip — liste
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, dip_sections(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: errMsg(error) });
  res.json({ dips: data });
});

// GET /api/dip/:id — détail
router.get('/:id', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, dip_sections(*)')
    .eq('id', req.params.id)
    .eq('user_id', req.user.id)
    .single();
  if (error || !data) return res.status(404).json({ error: 'DIP introuvable' });
  res.json({ dip: data });
});

// PUT /api/dip/:id/sections/:sectionId
router.put('/:id/sections/:sectionId', authMiddleware, requireFranchisor, async (req, res) => {
  const { content, status } = req.body;
  const { data: existing } = await supabaseAdmin
    .from('dip_sections').select('*').eq('id', req.params.sectionId).single();
  if (!existing) return res.status(404).json({ error: 'Section introuvable' });

  await supabaseAdmin.from('audit_log').insert({
    dip_id: req.params.id,
    section_id: req.params.sectionId,
    action: 'section_update',
    old_content: existing.content,
    new_content: content,
    user_id: req.user.id,
    timestamp: new Date().toISOString()
  });

  const { data, error } = await supabaseAdmin
    .from('dip_sections')
    .update({ content, status, last_updated: new Date().toISOString() })
    .eq('id', req.params.sectionId)
    .select().single();

  if (error) return res.status(500).json({ error: errMsg(error) });

  const { data: allSections } = await supabaseAdmin
    .from('dip_sections').select('status').eq('dip_id', req.params.id);
  const conformeCount = allSections.filter(s => s.status === 'conforme').length;
  const score = Math.round((conformeCount / allSections.length) * 100);
  await supabaseAdmin.from('dip_documents').update({ conformity_score: score }).eq('id', req.params.id);

  res.json({ section: data, conformity_score: score });
});

// POST /api/dip/check/:id
router.post('/check/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('id').eq('id', req.params.id).eq('user_id', req.user.id).single();
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  await supabaseAdmin.from('dip_sections')
    .update({ last_checked: new Date().toISOString() })
    .eq('dip_id', req.params.id);

  res.json({ message: 'Vérification lancée', checked_at: new Date().toISOString() });
});

module.exports = router;
