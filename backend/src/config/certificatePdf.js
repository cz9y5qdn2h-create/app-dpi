const PDFDocument = require('pdfkit');

const COLOR = {
  black:      '#0F172A',
  gold:       '#B89357',
  goldLight:  '#D4AA6A',
  muted:      '#64748B',
  border:     '#E2E8F0',
  white:      '#FFFFFF',
  conforme:   '#16A34A',
  revisions:  '#D97706',
  bloquant:   '#DC2626',
  bgLight:    '#F8FAFC',
  bgGold:     '#FBF7EE',
};

const COMPLIANCE_COLOR = {
  'CONFORME':               COLOR.conforme,
  'RÉVISIONS_MINEURES':     COLOR.revisions,
  'RÉVISIONS_MAJEURES':     COLOR.revisions,
  'BLOQUANT_NON_ENVOYABLE': COLOR.bloquant,
};

const COMPLIANCE_LABEL = {
  'CONFORME':               '✓  CONFORME — Envoi autorisé',
  'RÉVISIONS_MINEURES':     '⚠  RÉVISIONS MINEURES',
  'RÉVISIONS_MAJEURES':     '⚠  RÉVISIONS MAJEURES',
  'BLOQUANT_NON_ENVOYABLE': '✗  BLOQUANT — Ne pas envoyer',
};

const IMPACT_COLOR = {
  'High':     COLOR.bloquant,
  'Moderate': COLOR.revisions,
  'Low':      COLOR.muted,
};

/**
 * Génère le PDF d'un certificat DIPpro.
 * @param {object} cert  — enregistrement dip_certificates complet
 * @returns {Promise<Buffer>}
 */
const generateCertificatePDF = (cert) => new Promise((resolve, reject) => {
  const doc = new PDFDocument({ size: 'A4', margin: 0, bufferPages: true });
  const chunks = [];
  doc.on('data',  c => chunks.push(c));
  doc.on('end',   () => resolve(Buffer.concat(chunks)));
  doc.on('error', reject);

  const W = doc.page.width;   // 595.28
  const M = 48;                // marge horizontale
  const CW = W - M * 2;       // largeur de contenu

  let y = 0;

  // ─── Helpers ────────────────────────────────────────────────────────────────

  const rule = (yPos, color = COLOR.border, thickness = 0.5) => {
    doc.save().strokeColor(color).lineWidth(thickness)
       .moveTo(M, yPos).lineTo(W - M, yPos).stroke().restore();
    return yPos + thickness;
  };

  const rect = (x, yPos, w, h, fill, radius = 4) => {
    doc.save().roundedRect(x, yPos, w, h, radius).fill(fill).restore();
  };

  const field = (label, value, yPos, labelW = 120) => {
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR.muted)
       .text(label.toUpperCase(), M, yPos, { width: labelW });
    doc.font('Helvetica').fontSize(9).fillColor(COLOR.black)
       .text(value || '—', M + labelW, yPos, { width: CW - labelW });
    return yPos + 16;
  };

  const sectionHeader = (title, yPos) => {
    doc.save().fillColor(COLOR.bgGold)
       .rect(M, yPos, CW, 22).fill().restore();
    doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR.gold)
       .text(title.toUpperCase(), M + 10, yPos + 7, { width: CW - 20 });
    return yPos + 30;
  };

  const fmt = (iso) => {
    if (!iso) return '—';
    const d = new Date(iso);
    return d.toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' })
      + ' à '
      + d.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit', timeZone: 'Europe/Paris' })
      + ' (heure de Paris)';
  };

  // ─── BANDE HEADER ──────────────────────────────────────────────────────────
  rect(0, 0, W, 72, COLOR.black, 0);

  // Titre gauche
  doc.font('Helvetica-Bold').fontSize(18).fillColor(COLOR.gold)
     .text('DIPpro', M, 18, { continued: true })
     .font('Helvetica').fontSize(10).fillColor(COLOR.white)
     .text('  —  Document d\'Information Précontractuelle', { continued: false });

  doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.goldLight)
     .text('CERTIFICAT DE ' + (cert.certificate_type === 'INITIAL'
       ? 'CONFORMITÉ ET DE REMISE INITIALE'
       : cert.certificate_type === 'MISE_A_JOUR'
         ? 'MISE À JOUR ET DE NOTIFICATION'
         : 'REMISE DU DIP'), M, 40);

  // Référence droite
  const ref = `Réf. CERT-${cert.id.split('-')[0].toUpperCase()}-${cert.id.split('-')[1].toUpperCase()}`;
  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
     .text(ref, 0, 26, { align: 'right', width: W - M });
  doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
     .text('Généré le ' + fmt(cert.generated_at), 0, 38, { align: 'right', width: W - M });

  y = 88;

  // ─── BLOC STATUT CONFORMITÉ ────────────────────────────────────────────────
  const compLevel = cert.compliance_level || '';
  const compColor = COMPLIANCE_COLOR[compLevel] || COLOR.muted;
  const compLabel = COMPLIANCE_LABEL[compLevel] || compLevel;

  rect(M, y, CW, 36, compLevel === 'BLOQUANT_NON_ENVOYABLE' ? '#FEF2F2' : '#F0FDF4', 6);
  doc.save().roundedRect(M, y, CW, 36, 6).strokeColor(compColor).lineWidth(1).stroke().restore();

  doc.font('Helvetica-Bold').fontSize(11).fillColor(compColor)
     .text(compLabel, M + 12, y + 8, { width: CW / 2 });

  const scoreLabel = `Score de conformité : ${cert.global_score ?? '—'}/100`;
  doc.font('Helvetica').fontSize(9).fillColor(COLOR.muted)
     .text(scoreLabel, M + CW / 2, y + 13, { width: CW / 2, align: 'right' });

  y += 48;

  // ─── IDENTIFICATION ────────────────────────────────────────────────────────
  y = sectionHeader('1. Identification du document et du franchiseur', y);

  const deliveries = cert.deliveries || [];
  const changes    = cert.changes_snapshot || [];

  y = field('DIP concerné',     cert.dip_id,      y);
  y = field('Type de certificat', cert.certificate_type, y);
  y = field('Date de génération', fmt(cert.generated_at), y);
  y = field('Empreinte SHA-256',  cert.sha256_dip || 'Non calculée', y);
  y += 8;

  // Avertissements
  const warnings = cert.warnings || [];
  if (warnings.length > 0) {
    rect(M, y, CW, 14 + warnings.length * 14, '#FFFBEB', 4);
    doc.save().roundedRect(M, y, CW, 14 + warnings.length * 14, 4)
       .strokeColor(COLOR.revisions).lineWidth(0.5).stroke().restore();
    doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.revisions)
       .text('⚠  Points d\'attention', M + 10, y + 5);
    warnings.forEach((w, i) => {
      doc.font('Helvetica').fontSize(8).fillColor(COLOR.black)
         .text('• ' + w, M + 10, y + 18 + i * 14, { width: CW - 20 });
    });
    y += 14 + warnings.length * 14 + 10;
  }

  y += 4;
  rule(y);
  y += 12;

  // ─── TEXTE JURIDIQUE ──────────────────────────────────────────────────────
  y = sectionHeader('2. Attestation juridique', y);

  doc.font('Helvetica').fontSize(9).fillColor(COLOR.black)
     .text(cert.certificate_text || cert.legal_summary || '—', M, y, {
       width: CW, lineGap: 3, paragraphGap: 6
     });
  y = doc.y + 16;

  // ─── MODIFICATIONS (si MISE_A_JOUR) ───────────────────────────────────────
  if (changes.length > 0) {
    rule(y); y += 12;
    y = sectionHeader(`3. Modifications documentées (${changes.length})`, y);

    changes.forEach((c, i) => {
      if (y > 720) { doc.addPage(); y = M; }

      const impactColor = IMPACT_COLOR[c.impact_legal] || COLOR.muted;
      rect(M, y, 3, 42, impactColor, 0);

      doc.font('Helvetica-Bold').fontSize(8).fillColor(COLOR.black)
         .text(`§${c.section_number || i + 1} — ${c.section || ''}`, M + 10, y + 2, { width: CW - 60 });

      const impTag = c.impact_legal || '';
      doc.font('Helvetica-Bold').fontSize(7).fillColor(impactColor)
         .text(impTag, M + CW - 50, y + 2, { width: 50, align: 'right' });

      doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
         .text('Avant : ', M + 10, y + 16, { continued: true })
         .fillColor(COLOR.black).text(c.ancien || '—', { width: CW - 60 });

      doc.font('Helvetica').fontSize(7.5).fillColor(COLOR.muted)
         .text('Après : ', M + 10, y + 28, { continued: true })
         .fillColor(COLOR.black).text(c.nouveau || '—', { width: CW - 60 });

      y += 52;
      if (i < changes.length - 1) rule(y - 4, COLOR.border, 0.3);
    });
    y += 8;
  }

  // ─── REMISES ─────────────────────────────────────────────────────────────
  if (deliveries.length > 0) {
    if (y > 660) { doc.addPage(); y = M; }
    rule(y); y += 12;
    const secNum = changes.length > 0 ? '4' : '3';
    y = sectionHeader(`${secNum}. Remises aux franchisés (${deliveries.length})`, y);

    // En-têtes du tableau
    const cols = [M, M + 160, M + 330, M + 480];
    doc.font('Helvetica-Bold').fontSize(7.5).fillColor(COLOR.muted);
    ['Franchisé', 'Email', 'Envoyé le', 'Lu le'].forEach((h, i) => {
      doc.text(h, cols[i], y, { width: cols[i + 1] ? cols[i + 1] - cols[i] - 4 : 80 });
    });
    y += 14;
    rule(y - 2, COLOR.border);

    deliveries.forEach((d, i) => {
      if (y > 720) { doc.addPage(); y = M; }
      const bg = i % 2 === 0 ? COLOR.bgLight : COLOR.white;
      rect(M, y - 2, CW, 16, bg, 2);
      doc.font('Helvetica').fontSize(8).fillColor(COLOR.black);
      doc.text(d.franchisee_name || '—', cols[0], y, { width: 156 });
      doc.text(d.email || '—',           cols[1], y, { width: 166 });
      doc.text(fmt(d.sent_at),           cols[2], y, { width: 146 });
      doc.fillColor(d.read_at ? COLOR.conforme : COLOR.muted)
         .text(d.read_at ? fmt(d.read_at) : 'En attente', cols[3], y, { width: 80 });
      y += 18;
    });
    y += 8;
  }

  // ─── VALEUR PROBATOIRE ────────────────────────────────────────────────────
  if (y > 660) { doc.addPage(); y = M; }
  rule(y); y += 12;

  rect(M, y, CW, 54, COLOR.bgGold, 6);
  doc.font('Helvetica-Bold').fontSize(8.5).fillColor(COLOR.gold)
     .text('VALEUR PROBATOIRE DE CE DOCUMENT', M + 12, y + 8);
  doc.font('Helvetica').fontSize(8).fillColor(COLOR.black)
     .text(
       'Ce certificat constitue une pièce de traçabilité générée automatiquement par DIPpro. '
       + 'L\'empreinte SHA-256 permet de vérifier l\'intégrité du fichier DIP au moment de la remise. '
       + 'Les horodatages sont exprimés en heure de Paris (Europe/Paris). '
       + 'Ce document peut être produit en justice pour attester de la remise du DIP au sens de l\'article L.330-3 du Code de commerce.',
       M + 12, y + 22, { width: CW - 24, lineGap: 2 }
     );
  y += 66;

  // ─── PIED DE PAGE (toutes les pages) ─────────────────────────────────────
  const pageCount = doc.bufferedPageRange().count;
  for (let i = 0; i < pageCount; i++) {
    doc.switchToPage(i);
    const footerY = doc.page.height - 28;
    doc.save().fillColor(COLOR.black).rect(0, footerY - 1, W, 29).fill().restore();
    doc.font('Helvetica').fontSize(7).fillColor(COLOR.muted)
       .text('DIPpro — Conformité DIP Loi Doubin (art. L.330-3 Code de commerce)', M, footerY + 6, { width: CW / 2 });
    doc.text(`Page ${i + 1} / ${pageCount}  —  ${ref}`, M, footerY + 6, { width: CW, align: 'right' });
  }

  doc.end();
});

module.exports = { generateCertificatePDF };
