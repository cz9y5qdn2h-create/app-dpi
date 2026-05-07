const Anthropic = require('@anthropic-ai/sdk');
const {
  Document, Packer, Paragraph, TextRun, HeadingLevel,
  Table, TableRow, TableCell, WidthType, AlignmentType,
  BorderStyle, ShadingType, PageBreak
} = require('docx');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_OPUS   = 'claude-opus-4-7';   // Analyse juridique critique
const MODEL_SONNET = 'claude-sonnet-4-6'; // Génération et comparaison structurée
const MODEL_HAIKU  = 'claude-haiku-4-5';  // Vérifications simples

const callClaude = async (params) => {
  try {
    return await claude.messages.create(params);
  } catch (err) {
    if (err.status === 401 || /invalid.*api.?key/i.test(err.message || '')) {
      throw new Error('Clé Anthropic invalide ou manquante. Vérifiez ANTHROPIC_API_KEY dans Vercel.');
    }
    if (err.status === 429) {
      throw new Error('Quota Anthropic dépassé. Vérifiez votre facturation sur console.anthropic.com.');
    }
    if (err.status === 529 || err.status === 503) {
      throw new Error('Service Anthropic temporairement indisponible. Réessayez.');
    }
    throw err;
  }
};

const SECTION_TITLES = [
  '', // index 0 inutilisé
  'Identité du franchiseur',
  'Historique de l\'enseigne et du dirigeant',
  'État du réseau de franchisés',
  'Comptes annuels',
  'Marque et propriété intellectuelle',
  'Informations financières',
  'Territoire exclusif',
  'Contrat (durée, renouvellement, résiliation)',
  'Litiges en cours et passés',
  'Comptes prévisionnels'
];

const COMPLIANCE_CRITERIA = `
1. Identité → conforme si : raison sociale, forme juridique, capital, RCS, siège, dirigeants présents
2. Historique → conforme si : date création, parcours dirigeant (5 ans min), historique enseigne
3. Réseau → conforme si : liste franchisés avec adresses, ouvertures/fermetures sur 12 mois
4. Comptes annuels → conforme si : 2 derniers exercices comptables complets
5. Marque/PI → conforme si : n° INPI, date dépôt, territoire, validité
6. Financier → conforme si : droits d'entrée, redevances, conditions paiement explicites
7. Territoire → conforme si : zone géographique définie et exclusive clairement
8. Contrat → conforme si : durée, renouvellement, résiliation/cession détaillées
9. Litiges → conforme si : mention explicite litiges ou attestation d'absence
10. Prévisionnels → conforme si : projections 3 ans avec hypothèses`;

const CACHED_SYSTEM = [{
  type: 'text',
  text: `Tu es un agent juridique expert DIP — spécialiste de la Loi Doubin (Loi n°89-1008 du 31 décembre 1989) et de l'article L.330-3 du Code de commerce.

Critères de conformité par section :${COMPLIANCE_CRITERIA}

Valeurs possibles pour status : "conforme" | "a_verifier" | "non_conforme"
Réponds TOUJOURS en JSON valide, sans markdown, sans texte avant ou après.
Ne jamais inventer des données — écrire "Non renseigné" si une information est absente.`,
  cache_control: { type: 'ephemeral' }
}];

// ─── 1. ANALYSER UN DIP EXISTANT ────────────────────────────────────────────

const analyzeDIP = async (rawText) => {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Texte trop court. Vérifiez que le PDF n\'est pas scanné ou protégé.');
  }

  const message = await callClaude({
    model: MODEL_OPUS,
    thinking: { type: 'adaptive' },
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyse ce DIP et extrais les 10 sections réglementaires obligatoires selon la Loi Doubin.

TEXTE DU DIP :
${rawText.substring(0, 18000)}

Pour chaque section, extrais le contenu réel, évalue la conformité et liste les problèmes.
Retourne ce JSON :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "contenu extrait verbatim",
      "status": "conforme",
      "issues": [],
      "suggestions": []
    }
  ],
  "global_score": 75,
  "summary": "résumé des points forts, lacunes et risques juridiques",
  "critical_issues": ["liste des non-conformités bloquantes"]
}`
    }]
  });

  return parseAndCompleteResult(message.content[0].text);
};

// ─── 2. GÉNÉRER UN DIP DEPUIS FORMULAIRE + DOCUMENT SOURCE ──────────────────

const generateDIPFromForm = async (formData, sourceText = '') => {
  const sourceSection = sourceText
    ? `\nDOCUMENT SOURCE (à utiliser pour compléter les sections manquantes du formulaire) :\n${sourceText.substring(0, 12000)}\n`
    : '';

  const message = await callClaude({
    model: MODEL_SONNET,
    thinking: { type: 'adaptive' },
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Génère un DIP complet et conforme à la Loi Doubin à partir des données suivantes.

DONNÉES FORMULAIRE FRANCHISEUR :
${JSON.stringify(formData, null, 2)}
${sourceSection}
INSTRUCTIONS :
- Pour chaque section, génère un texte rédigé, professionnel et juridiquement rigoureux
- Utilise les données du formulaire en priorité
- Si le formulaire est incomplet, utilise le document source si disponible, sinon indique "À compléter"
- Le texte généré doit être directement utilisable dans le DIP officiel
- Évalue la conformité de chaque section après génération

Retourne ce JSON :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "texte rédigé pour cette section, prêt à intégrer dans le DIP",
      "status": "conforme",
      "issues": [],
      "suggestions": ["améliorations possibles"]
    }
  ],
  "global_score": 80,
  "summary": "état global du DIP généré",
  "missing_data": ["liste des informations manquantes à fournir avant envoi"]
}`
    }]
  });

  return parseAndCompleteResult(message.content[0].text);
};

// ─── 3. COMPARER DEUX VERSIONS ───────────────────────────────────────────────

const compareDIPVersions = async (previousText, newText) => {
  if (!previousText || !newText) {
    return { changements: [], resume: 'Texte manquant pour la comparaison', nb_changements_critiques: 0 };
  }

  const message = await callClaude({
    model: MODEL_SONNET,
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Compare ces deux versions d'un DIP et identifie tous les changements à impact légal.

VERSION PRÉCÉDENTE :
${previousText.substring(0, 9000)}

NOUVELLE VERSION :
${newText.substring(0, 9000)}

Niveaux d'impact :
- High : changement obligatoire à notifier (finances, contrat, réseau, litiges)
- Moderate : changement important non bloquant
- Low : changement mineur de forme

Retourne ce JSON :
{
  "changements": [
    {
      "id": "chgt_1",
      "type": "prix_franchise",
      "section": "Informations financières",
      "section_number": 6,
      "ancien": "valeur précédente",
      "nouveau": "nouvelle valeur",
      "impact_legal": "High",
      "recommandation_ia": "explication juridique",
      "proposition_texte": "reformulation conforme"
    }
  ],
  "resume": "synthèse des changements",
  "nb_changements_critiques": 1,
  "action_requise": "description de l'action légale requise"
}`
    }]
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { changements: [], resume: 'Analyse incomplète', nb_changements_critiques: 0 };

  const result = JSON.parse(match[0]);
  if (result.changements) {
    result.changements = result.changements.map((c, i) => ({ ...c, id: c.id || `chgt_${i + 1}` }));
  }
  return result;
};

// ─── 4. VÉRIFICATION DONNÉES LÉGALES ────────────────────────────────────────

const verifyLegalData = async (companyInfo) => {
  const message = await callClaude({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyse les informations légales de ce franchiseur et produis un rapport de vérification.

INFORMATIONS FRANCHISEUR :
${JSON.stringify(companyInfo, null, 2)}

Pour chaque élément, indique :
1. Ce qui doit être vérifié sur les registres officiels
2. Les points de vigilance juridiques
3. Les incohérences détectées dans les données fournies

Retourne ce JSON :
{
  "verifications": [
    {
      "element": "Numéro RCS",
      "valeur_declaree": "123 456 789 Paris",
      "statut": "a_verifier",
      "source_officielle": "Infogreffe.fr",
      "url_verification": "https://www.infogreffe.fr",
      "points_vigilance": ["Vérifier que le capital déclaré correspond au Kbis"]
    }
  ],
  "incoherences": ["liste des incohérences détectées entre les données"],
  "score_fiabilite": 85,
  "recommandations": ["actions à effectuer avant envoi du DIP aux candidats"]
}`
    }]
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { verifications: [], incoherences: [], score_fiabilite: 0, recommandations: [] };
  return JSON.parse(match[0]);
};

// ─── 5. GÉNÉRATION DOCX ─────────────────────────────────────────────────────

const STATUS_LABELS = {
  conforme: '✓ Conforme',
  a_verifier: '⚠ À vérifier',
  non_conforme: '✗ Non conforme'
};

const STATUS_COLORS = {
  conforme: '2D7D46',
  a_verifier: 'B45309',
  non_conforme: 'DC2626'
};

const generateDocx = async (sections, companyName = 'Franchiseur') => {
  const date = new Date().toLocaleDateString('fr-FR', { day: '2-digit', month: 'long', year: 'numeric' });

  const children = [
    // Page de garde
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { before: 2000, after: 400 },
      children: [
        new TextRun({ text: 'DOCUMENT D\'INFORMATION PRÉCONTRACTUELLE', bold: true, size: 32, color: '1a1a2e' })
      ]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: companyName, bold: true, size: 40, color: 'C8A96E' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 },
      children: [new TextRun({ text: `Établi conformément à la Loi Doubin — Article L.330-3 du Code de commerce`, size: 22, color: '6B7280' })]
    }),
    new Paragraph({
      alignment: AlignmentType.CENTER,
      spacing: { after: 600 },
      children: [new TextRun({ text: `Document généré le ${date}`, size: 20, color: '9CA3AF', italics: true })]
    }),

    // Séparateur
    new Paragraph({ children: [new PageBreak()] }),

    // Score global
    ...(sections.global_score !== undefined ? [
      new Paragraph({
        spacing: { before: 400, after: 200 },
        children: [
          new TextRun({ text: 'SCORE DE CONFORMITÉ GLOBAL : ', bold: true, size: 24 }),
          new TextRun({
            text: `${sections.global_score}/100`,
            bold: true,
            size: 28,
            color: sections.global_score >= 70 ? '2D7D46' : sections.global_score >= 40 ? 'B45309' : 'DC2626'
          })
        ]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: sections.summary || '', size: 20, italics: true, color: '374151' })]
      })
    ] : [])
  ];

  // 10 sections
  for (const section of (sections.sections || [])) {
    const status = section.status || 'a_verifier';
    const statusColor = STATUS_COLORS[status] || 'B45309';

    children.push(
      new Paragraph({ children: [new PageBreak()] }),
      new Paragraph({
        heading: HeadingLevel.HEADING_1,
        spacing: { before: 600, after: 200 },
        children: [
          new TextRun({ text: `Section ${section.section_number} — `, bold: true, size: 28, color: '1a1a2e' }),
          new TextRun({ text: section.section_title, bold: true, size: 28, color: 'C8A96E' })
        ]
      }),
      new Paragraph({
        spacing: { after: 300 },
        children: [
          new TextRun({ text: STATUS_LABELS[status] || status, bold: true, size: 20, color: statusColor })
        ]
      }),
      new Paragraph({
        spacing: { after: 400 },
        children: [new TextRun({ text: section.content || 'Non renseigné', size: 22, color: '111827' })]
      })
    );

    if (section.issues && section.issues.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: 'Points à corriger :', bold: true, size: 20, color: 'DC2626' })]
        }),
        ...section.issues.map(issue => new Paragraph({
          indent: { left: 400 },
          spacing: { after: 100 },
          children: [new TextRun({ text: `• ${issue}`, size: 20, color: 'DC2626' })]
        }))
      );
    }

    if (section.suggestions && section.suggestions.length > 0) {
      children.push(
        new Paragraph({
          spacing: { before: 200, after: 100 },
          children: [new TextRun({ text: 'Suggestions d\'amélioration :', bold: true, size: 20, color: 'B45309' })]
        }),
        ...section.suggestions.map(s => new Paragraph({
          indent: { left: 400 },
          spacing: { after: 100 },
          children: [new TextRun({ text: `→ ${s}`, size: 20, color: 'B45309' })]
        }))
      );
    }
  }

  // Pied de page légal
  children.push(
    new Paragraph({ children: [new PageBreak()] }),
    new Paragraph({
      spacing: { before: 400, after: 200 },
      children: [new TextRun({ text: 'MENTIONS LÉGALES', bold: true, size: 24, color: '6B7280' })]
    }),
    new Paragraph({
      spacing: { after: 200 },
      children: [new TextRun({
        text: `Ce document a été établi conformément aux dispositions de la Loi n°89-1008 du 31 décembre 1989 (Loi Doubin) et de l'article L.330-3 du Code de commerce. Il doit être remis au candidat franchisé au moins 20 jours avant la signature de tout contrat et tout versement de fonds.`,
        size: 18, color: '9CA3AF', italics: true
      })]
    }),
    new Paragraph({
      children: [new TextRun({
        text: `Document généré par DIPpro — Iralink Agency — ${date}`,
        size: 16, color: 'C8A96E', italics: true
      })]
    })
  );

  const doc = new Document({
    creator: 'DIPpro by Iralink',
    title: `DIP — ${companyName}`,
    description: 'Document d\'Information Précontractuelle conforme Loi Doubin',
    sections: [{ children }]
  });

  return Packer.toBuffer(doc);
};

// ─── UTILS ───────────────────────────────────────────────────────────────────

const parseAndCompleteResult = (rawText) => {
  const raw = rawText.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  const result = JSON.parse(match[0]);

  if (!result.sections || result.sections.length < 10) {
    const existing = new Set((result.sections || []).map(s => s.section_number));
    result.sections = result.sections || [];
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        result.sections.push({
          section_number: i,
          section_title: SECTION_TITLES[i],
          content: 'Section non trouvée dans le document',
          status: 'non_conforme',
          issues: ['Section obligatoire absente du DIP — non conforme Loi Doubin'],
          suggestions: []
        });
      }
    }
    result.sections.sort((a, b) => a.section_number - b.section_number);
  }

  result.global_score = result.global_score ?? Math.round(
    (result.sections.filter(s => s.status === 'conforme').length / 10) * 100
  );

  return result;
};

module.exports = { analyzeDIP, generateDIPFromForm, compareDIPVersions, verifyLegalData, generateDocx };
