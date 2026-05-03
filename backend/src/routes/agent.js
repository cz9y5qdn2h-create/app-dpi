const express = require('express');
const path = require('path');
const { authMiddleware, requireFranchisor } = require('../middleware/auth');
const { analyzeDIP, generateDIPFromForm, compareDIPVersions, verifyLegalData, generateDocx } = require('../config/dipAgent');

const router = express.Router();

const extractText = async (buffer, filename) => {
  const ext = path.extname(filename).toLowerCase();
  if (ext === '.pdf') {
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

// POST /api/agent/analyze
// Body: { text: string } OU { file: base64, filename: string }
router.post('/analyze', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    let rawText = req.body.text;

    if (!rawText && req.body.file) {
      const buffer = Buffer.from(req.body.file, 'base64');
      rawText = await extractText(buffer, req.body.filename || 'document.pdf');
    }

    if (!rawText) return res.status(400).json({ error: 'text ou file requis' });

    const result = await analyzeDIP(rawText);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/generate
// Body: { formData: object, file?: base64, filename?: string }
router.post('/generate', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { formData, file, filename } = req.body;
    if (!formData) return res.status(400).json({ error: 'formData requis' });

    let sourceText = '';
    if (file) {
      const buffer = Buffer.from(file, 'base64');
      sourceText = await extractText(buffer, filename || 'document.pdf');
    }

    const result = await generateDIPFromForm(formData, sourceText);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/compare
// Body: { previousText: string, newText: string }
// OU   { previousFile: base64, newFile: base64, filename: string }
router.post('/compare', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    let { previousText, newText } = req.body;

    if (!previousText && req.body.previousFile) {
      const buf = Buffer.from(req.body.previousFile, 'base64');
      previousText = await extractText(buf, req.body.filename || 'document.pdf');
    }
    if (!newText && req.body.newFile) {
      const buf = Buffer.from(req.body.newFile, 'base64');
      newText = await extractText(buf, req.body.filename || 'document.pdf');
    }

    if (!previousText || !newText) return res.status(400).json({ error: 'previousText et newText requis' });

    const result = await compareDIPVersions(previousText, newText);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/verify
// Body: { companyInfo: object }
router.post('/verify', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { companyInfo } = req.body;
    if (!companyInfo) return res.status(400).json({ error: 'companyInfo requis' });

    const result = await verifyLegalData(companyInfo);
    res.json({ success: true, ...result });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// POST /api/agent/docx
// Body: { sections: object (résultat d'analyze ou generate), companyName?: string }
// Retourne le fichier DOCX en téléchargement
router.post('/docx', authMiddleware, requireFranchisor, async (req, res) => {
  try {
    const { sections, companyName } = req.body;
    if (!sections) return res.status(400).json({ error: 'sections requis' });

    const buffer = await generateDocx(sections, companyName || 'Franchiseur');
    const filename = `DIP_${(companyName || 'franchiseur').replace(/[^a-z0-9]/gi, '_')}_${Date.now()}.docx`;

    res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
    res.setHeader('Content-Disposition', `attachment; filename="${filename}"`);
    res.send(buffer);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
