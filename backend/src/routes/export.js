const express = require('express');
const PDFDocument = require('pdfkit');
const { Document, Packer, Paragraph, TextRun, HeadingLevel, AlignmentType, PageBreak } = require('docx');
const { supabaseAdmin } = require('../config/supabase');
const { authMiddleware } = require('../middleware/auth');
const router = express.Router();

const STATUS_LABEL = { conforme: 'Conforme', a_verifier: 'À vérifier', non_conforme: 'Non conforme' };

async function loadDip(dipId, userId) {
  const { data: dip, error } = await supabaseAdmin
    .from('dip_documents')
    .select('*, dip_sections(*)')
    .eq('id', dipId)
    .eq('user_id', userId)
    .single();
  if (error || !dip) return null;

  const sections = (dip.dip_sections || []).sort((a, b) => a.section_number - b.section_number);
  return { ...dip, dip_sections: sections };
}

async function loadUser(userId) {
  const { data } = await supabaseAdmin.from('users')
    .select('company_name, email, siret').eq('id', userId).single();
  return data || {};
}

// GET /api/export/:dipId/json
router.get('/:dipId/json', authMiddleware, async (req, res) => {
  const dip = await loadDip(req.params.dipId, req.user.id);
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const { data: history } = await supabaseAdmin
    .from('audit_log').select('*').eq('dip_id', req.params.dipId)
    .order('timestamp', { ascending: false });

  res.json({
    dip,
    sections: dip.dip_sections,
    history: history || [],
    exported_at: new Date().toISOString()
  });
});

// GET /api/export/:dipId/pdf — Rapport de conformité PDF
router.get('/:dipId/pdf', authMiddleware, async (req, res) => {
  const dip = await loadDip(req.params.dipId, req.user.id);
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const user = await loadUser(req.user.id);
  const sections = dip.dip_sections || [];
  const conforme = sections.filter(s => s.status === 'conforme').length;
  const aVerifier = sections.filter(s => s.status === 'a_verifier').length;
  const nonConforme = sections.filter(s => s.status === 'non_conforme').length;
  const score = sections.length ? Math.round((conforme / sections.length) * 100) : 0;

  const doc = new PDFDocument({ size: 'A4', margin: 50, bufferPages: true });
  res.setHeader('Content-Type', 'application/pdf');
  res.setHeader('Content-Disposition',
    `attachment; filename="rapport-conformite-${dip.id.substring(0, 8)}.pdf"`);
  doc.pipe(res);

  // En-tête
  doc.fillColor('#C8A96E').fontSize(24).font('Helvetica-Bold').text('Rapport de Conformité DIP', { align: 'center' });
  doc.moveDown(0.3);
  doc.fillColor('#666').fontSize(10).font('Helvetica').text('Loi Doubin — Article L.330-3 du Code de commerce', { align: 'center' });
  doc.moveDown(2);

  // Bloc info
  doc.fillColor('#000').fontSize(11).font('Helvetica-Bold').text(user.company_name || 'Franchiseur');
  doc.font('Helvetica').fillColor('#444');
  doc.text(user.email || '');
  if (user.siret) doc.text('SIRET : ' + user.siret);
  doc.moveDown(0.5);
  doc.fontSize(9).fillColor('#666').text('Document : ' + (dip.title || 'DIP'));
  doc.text('Date : ' + new Date().toLocaleDateString('fr-FR'));
  doc.text('Statut : ' + (dip.status || 'actif'));
  doc.moveDown(2);

  // Score global
  const scoreColor = score >= 80 ? '#22c55e' : score >= 50 ? '#C8A96E' : '#ef4444';
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Score de conformité global', { underline: false });
  doc.moveDown(0.4);
  doc.fillColor(scoreColor).fontSize(48).font('Helvetica-Bold').text(score + '%', { align: 'center' });
  doc.moveDown(1);

  // Stats
  const statY = doc.y;
  const colW = (doc.page.width - 100) / 3;
  const drawStat = (x, value, label, color) => {
    doc.fillColor(color).fontSize(20).font('Helvetica-Bold').text(value, x, statY, { width: colW, align: 'center' });
    doc.fillColor('#666').fontSize(9).font('Helvetica').text(label, x, statY + 28, { width: colW, align: 'center' });
  };
  drawStat(50, conforme, 'Conformes', '#22c55e');
  drawStat(50 + colW, aVerifier, 'À vérifier', '#C8A96E');
  drawStat(50 + colW * 2, nonConforme, 'Non conformes', '#ef4444');

  doc.moveDown(4);
  doc.fillColor('#000').fontSize(14).font('Helvetica-Bold').text('Détail par section');
  doc.moveDown(0.5);

  for (const s of sections) {
    if (doc.y > 700) doc.addPage();
    const sColor = s.status === 'conforme' ? '#22c55e' : s.status === 'non_conforme' ? '#ef4444' : '#C8A96E';
    doc.fillColor('#C8A96E').fontSize(11).font('Helvetica-Bold')
      .text(`Section ${s.section_number} — ${s.section_title}`, { continued: false });
    doc.fillColor(sColor).fontSize(9).font('Helvetica-Bold').text(STATUS_LABEL[s.status] || s.status);
    doc.fillColor('#333').fontSize(9).font('Helvetica')
      .text(s.content || '— Section non renseignée —', { align: 'justify' });
    doc.moveDown(0.8);
  }

  // Pied de page sur toutes les pages
  const range = doc.bufferedPageRange();
  for (let i = 0; i < range.count; i++) {
    doc.switchToPage(range.start + i);
    doc.fillColor('#999').fontSize(8).font('Helvetica')
      .text(`DIPpro by Iralink — Page ${i + 1} / ${range.count} — Généré le ${new Date().toLocaleDateString('fr-FR')}`,
        50, doc.page.height - 35, { align: 'center', width: doc.page.width - 100 });
  }

  doc.end();
});

// GET /api/export/:dipId/docx — DIP reformulé en DOCX
router.get('/:dipId/docx', authMiddleware, async (req, res) => {
  const dip = await loadDip(req.params.dipId, req.user.id);
  if (!dip) return res.status(404).json({ error: 'DIP introuvable' });

  const user = await loadUser(req.user.id);
  const sections = dip.dip_sections || [];

  const children = [];

  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'DOCUMENT D\'INFORMATION PRÉCONTRACTUELLE', bold: true, size: 36, color: 'C8A96E' })]
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Loi Doubin — Article L.330-3 du Code de commerce', italics: true, size: 20, color: '666666' })],
    spacing: { after: 400 }
  }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: user.company_name || 'Franchiseur', bold: true, size: 28 })]
  }));
  if (user.email) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: user.email, size: 20 })] }));
  }
  if (user.siret) {
    children.push(new Paragraph({ alignment: AlignmentType.CENTER, children: [new TextRun({ text: 'SIRET : ' + user.siret, size: 20 })] }));
  }
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Date : ' + new Date().toLocaleDateString('fr-FR'), size: 20, color: '666666' })],
    spacing: { after: 600 }
  }));
  children.push(new Paragraph({ children: [new PageBreak()] }));

  for (const s of sections) {
    children.push(new Paragraph({
      heading: HeadingLevel.HEADING_1,
      children: [new TextRun({ text: `Section ${s.section_number} — ${s.section_title}`, bold: true, color: 'C8A96E', size: 28 })],
      spacing: { before: 400, after: 200 }
    }));

    const content = (s.content || '— Section non renseignée —').split('\n');
    for (const line of content) {
      if (line.trim()) {
        children.push(new Paragraph({
          children: [new TextRun({ text: line, size: 22 })],
          spacing: { after: 120 }
        }));
      } else {
        children.push(new Paragraph({ children: [new TextRun({ text: '' })] }));
      }
    }
  }

  children.push(new Paragraph({ children: [new PageBreak()] }));
  children.push(new Paragraph({
    alignment: AlignmentType.CENTER,
    children: [new TextRun({ text: 'Document généré par DIPpro by Iralink', size: 18, color: '999999', italics: true })]
  }));

  const docDocx = new Document({
    creator: 'DIPpro',
    title: dip.title || 'DIP',
    sections: [{ properties: {}, children }]
  });

  const buffer = await Packer.toBuffer(docDocx);

  res.setHeader('Content-Type', 'application/vnd.openxmlformats-officedocument.wordprocessingml.document');
  res.setHeader('Content-Disposition',
    `attachment; filename="dip-${(user.company_name || 'document').replace(/\s+/g, '_').toLowerCase()}-${dip.id.substring(0, 8)}.docx"`);
  res.send(buffer);
});

// Backward compat HTML
router.get('/:dipId/report', authMiddleware, async (req, res) => {
  res.redirect('/api/export/' + req.params.dipId + '/pdf');
});

module.exports = router;
