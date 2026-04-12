const express = require('express');
const multer = require('multer');
const path = require('path');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { parseDIPSections } = require('../config/claude');
const router = express.Router();

const upload = multer({
  storage: multer.memoryStorage(),
  limits: { fileSize: 20 * 1024 * 1024 }, // 20MB
  fileFilter: (req, file, cb) => {
    const allowed = ['.pdf', '.docx', '.doc'];
    const ext = path.extname(file.originalname).toLowerCase();
    if (allowed.includes(ext)) cb(null, true);
    else cb(new Error('Format non supporté. Utilisez PDF ou DOCX.'));
  }
});

// Extraire le texte d'un fichier
const extractText = async (buffer, mimetype, originalname) => {
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

// POST /api/dip/upload - Upload et parsing d'un DIP
router.post('/upload', authMiddleware, requireFranchisor, upload.single('file'), async (req, res) => {
  if (!req.file) return res.status(400).json({ error: 'Fichier requis' });

  try {
    // 1. Extraire le texte
    const rawText = await extractText(req.file.buffer, req.file.mimetype, req.file.originalname);

    // 2. Upload du fichier dans Supabase Storage
    const fileName = `${req.user.id}/${Date.now()}_${req.file.originalname}`;
    const { data: storageData, error: storageError } = await supabaseAdmin.storage
      .from('dip-files')
      .upload(fileName, req.file.buffer, { contentType: req.file.mimetype });

    if (storageError) console.warn('Storage error:', storageError.message);

    const fileUrl = storageData
      ? supabaseAdmin.storage.from('dip-files').getPublicUrl(fileName).data.publicUrl
      : null;

    // 3. Parser avec Claude
    const parsed = await parseDIPSections(rawText);

    // 4. Créer le document DIP
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

    // 5. Insérer les sections
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

    // 6. Log audit
    await supabaseAdmin.from('audit_log').insert({
      dip_id: dipDoc.id,
      action: 'upload_initial',
      user_id: req.user.id,
      new_content: JSON.stringify({ filename: req.file.originalname, score: parsed.global_score }),
      timestamp: new Date().toISOString()
    });

    res.status(201).json({
      message: 'DIP analysé avec succès',
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

  // Recalculer le score
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

  // Mettre à jour last_checked pour toutes les sections
  await supabaseAdmin.from('dip_sections').update({ last_checked: new Date().toISOString() })
    .eq('dip_id', req.params.id);

  res.json({ message: 'Vérification lancée', checked_at: new Date().toISOString() });
});

module.exports = router;
