const express = require('express');
const multer = require('multer');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { parseDIPSections, compareDIPVersions } = require('../config/claude');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 },
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez PDF ou DOCX.'));
  }
});

const extractText = async (buffer, originalname) => {
  const ext = path.extname(originalname).toLowerCase();
  if (ext === '.pdf') {
    const pdfParse = require('pdf-parse');
    const data = await pdfParse(buffer);
    return data.text;
  } else if (ext === '.docx' || ext === '.doc') {
    const mammoth = require('mammoth');
    const result = await mammoth.extractRawText({ buffer });
    return result.value;
  }
  throw new Error('Format non supporté');
};

// GET /api/dip - Liste des DIPs de l'utilisateur
router.get('/', authMiddleware, async (req, res) => {
  const { data, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, dip_sections(*)')
    .eq('user_id', req.user.id)
    .order('created_at', { ascending: false });
  if (error) return res.status(500).json({ error: error.message });
  res.json({ dips: data });
});

// GET /api/dip/:id - Détail d'un DIP
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

// POST /api/dip/upload - Upload, parsing ou comparaison de version DIP
router.post('/upload', authMiddleware, requireFranchisor, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });

  try {
    const rawText = await extractText(req.file.buffer, req.file.originalname);

    // Vérifier si un DIP actif existe déjà pour comparer les versions
    const { data: existingDips } = await supabaseAdmin
      .from('dip_documents')
      .select('id, raw_text, title, conformity_score')
      .eq('user_id', req.user.id)
      .eq('status', 'actif')
      .order('created_at', { ascending: false })
      .limit(1);

    const previousDip = existingDips?.[0];

    // Upload du fichier dans Supabase Storage
    const fileName = `${req.user.id}/${Date.now()}_${req.file.originalname}`;
    const { data: storageData } = await supabaseAdmin.storage
      .from('dip-files')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    const fileUrl = storageData
      ? supabaseAdmin.storage.from('dip-files').getPublicUrl(fileName).data.publicUrl
      : null;

    // Mode comparaison : DIP existant → retourner les deltas pour approbation
    if (previousDip && previousDip.raw_text) {
      const comparison = await compareDIPVersions(previousDip.raw_text, rawText);

      // Stocker le nouveau fichier en brouillon en attente d'approbation
      const { data: draftDip, error: draftError } = await supabaseAdmin
        .from('dip_documents')
        .insert({
          user_id: req.user.id,
          title: req.body.title || req.file.originalname,
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
          filename: req.file.originalname,
          nb_changements: comparison.changements?.length || 0,
          previous_dip_id: previousDip.id
        }),
        timestamp: new Date().toISOString()
      });

      return res.status(200).json({
        mode: 'comparison',
        draft_dip_id: draftDip.id,
        previous_dip_id: previousDip.id,
        changements: comparison.changements || [],
        resume: comparison.resume,
        nb_changements_critiques: comparison.nb_changements_critiques || 0
      });
    }

    // Mode initial : premier DIP → parser les sections
    const parsed = await parseDIPSections(rawText);

    const { data: dipDoc, error: dipError } = await supabaseAdmin
      .from('dip_documents')
      .insert({
        user_id: req.user.id,
        title: req.body.title || req.file.originalname,
        file_url: fileUrl,
        status: 'actif',
        conformity_score: parsed.global_score || 0,
        raw_text: rawText.substring(0, 50000)
      })
      .select()
      .single();

    if (dipError) throw new Error(dipError.message);

    const sectionsToInsert = parsed.sections.map(s => ({
      dip_id: dipDoc.id,
      section_number: s.section_number,
      section_title: s.section_title,
      content: s.content,
      status: s.status || 'a_verifier',
      last_checked: new Date().toISOString(),
      last_updated: new Date().toISOString()
    }));

    await supabaseAdmin.from('dip_sections').insert(sectionsToInsert);

    await supabaseAdmin.from('audit_log').insert({
      dip_id: dipDoc.id,
      action: 'upload_initial',
      user_id: req.user.id,
      new_content: JSON.stringify({ filename: req.file.originalname, score: parsed.global_score }),
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
    console.error('Upload DIP error:', err);
    res.status(500).json({ error: err.message });
  }
});

// POST /api/dip/approve-changes - Approuver les changements d'une nouvelle version
router.post('/approve-changes', authMiddleware, requireFranchisor, async (req, res) => {
  const { draft_dip_id, previous_dip_id, approved_changes } = req.body;
  if (!draft_dip_id || !previous_dip_id) {
    return res.status(400).json({ error: 'draft_dip_id et previous_dip_id requis' });
  }

  try {
    // Archiver l'ancien DIP actif
    await supabaseAdmin
      .from('dip_documents')
      .update({ status: 'archive' })
      .eq('id', previous_dip_id)
      .eq('user_id', req.user.id);

    // Activer le nouveau DIP
    const { data: newDip, error: activateError } = await supabaseAdmin
      .from('dip_documents')
      .update({ status: 'actif' })
      .eq('id', draft_dip_id)
      .eq('user_id', req.user.id)
      .select()
      .single();

    if (activateError) throw new Error(activateError.message);

    // Copier les sections de l'ancien DIP et les mettre à jour avec les changements approuvés
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

      // Appliquer les changements approuvés aux sections correspondantes
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

      // Recalculer le score
      const conformeCount = newSections.filter(s => s.status === 'conforme').length;
      const score = Math.round((conformeCount / newSections.length) * 100);
      await supabaseAdmin.from('dip_documents').update({ conformity_score: score }).eq('id', draft_dip_id);
    }

    await supabaseAdmin.from('audit_log').insert({
      dip_id: draft_dip_id,
      action: 'version_approved',
      user_id: req.user.id,
      new_content: JSON.stringify({
        nb_changes_approved: approved_changes?.length || 0,
        previous_dip_id
      }),
      timestamp: new Date().toISOString()
    });

    res.json({ message: 'Nouvelle version activée', dip: newDip });
  } catch (err) {
    console.error('Approve changes error:', err);
    res.status(500).json({ error: err.message });
  }
});

// PUT /api/dip/:id/sections/:sectionId - Mettre à jour une section
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

  if (error) return res.status(500).json({ error: error.message });

  const { data: allSections } = await supabaseAdmin
    .from('dip_sections').select('status').eq('dip_id', req.params.id);
  const conformeCount = allSections.filter(s => s.status === 'conforme').length;
  const score = Math.round((conformeCount / allSections.length) * 100);
  await supabaseAdmin.from('dip_documents').update({ conformity_score: score }).eq('id', req.params.id);

  res.json({ section: data, conformity_score: score });
});

// POST /api/dip/check/:id - Lancer une vérification manuelle
router.post('/check/:id', authMiddleware, requireFranchisor, async (req, res) => {
  const { data: dip } = await supabaseAdmin
    .from('dip_documents').select('*, dip_sections(*)').eq('id', req.params.id).single();
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  await supabaseAdmin.from('dip_sections').update({ last_checked: new Date().toISOString() })
    .eq('dip_id', req.params.id);

  res.json({ message: 'Vérification lancée', checked_at: new Date().toISOString() });
});

module.exports = router;
