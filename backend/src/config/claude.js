const Anthropic = require('@anthropic-ai/sdk');

if (!process.env.ANTHROPIC_API_KEY) {
  console.error('FATAL: ANTHROPIC_API_KEY manquante dans les variables d\'environnement.');
}

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

const MODEL_OPUS   = 'claude-opus-4-8';
const MODEL_SONNET = 'claude-sonnet-4-6';
const MODEL_HAIKU  = 'claude-haiku-4-5';

// Wrapper pour donner des messages d'erreur explicites
const callClaude = async (params) => {
  try {
    return await claude.messages.create(params);
  } catch (err) {
    if (err.status === 401 || /invalid.*api.?key/i.test(err.message || '')) {
      throw new Error('Clé Anthropic invalide ou manquante. Vérifiez ANTHROPIC_API_KEY dans les variables Vercel.');
    }
    if (err.status === 429) {
      throw new Error('Quota Anthropic dépassé. Vérifiez votre facturation sur console.anthropic.com.');
    }
    if (err.status === 529 || err.status === 503) {
      throw new Error('Service Anthropic temporairement indisponible. Réessayez dans quelques secondes.');
    }
    throw err;
  }
};

const extractText = (msg) => {
  const block = msg.content.find(b => b.type === 'text');
  return block?.text?.trim() ?? '';
};

const callClaudeJSON = async (params, retries = 1) => {
  for (let i = 0; i <= retries; i++) {
    const msg = await callClaude(params);
    const raw = extractText(msg);
    const match = raw.match(/\{[\s\S]*\}/);
    if (match) {
      try { return JSON.parse(match[0]); } catch {}
    }
    if (i < retries) await new Promise(r => setTimeout(r, 900 * (i + 1)));
  }
  return null;
};

const callClaudeToolUse = async (params, toolName, schema, retries = 1) => {
  for (let i = 0; i <= retries; i++) {
    const msg = await callClaude({
      ...params,
      tools: [{ name: toolName, description: 'Submit the structured analysis result', input_schema: schema }],
      tool_choice: { type: 'tool', name: toolName },
    });
    const block = msg.content.find(b => b.type === 'tool_use' && b.name === toolName);
    if (block?.input) return block.input;
    if (i < retries) await new Promise(r => setTimeout(r, 900 * (i + 1)));
  }
  return null;
};

const _COMPLIANCE_ENUM = ['CONFORME', 'RÉVISIONS_MINEURES', 'RÉVISIONS_MAJEURES', 'BLOQUANT_NON_ENVOYABLE'];

const DIP_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    sections: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section_number: { type: 'integer' },
          section_title: { type: 'string' },
          content: { type: 'string' },
          status: { type: 'string', enum: ['conforme', 'a_verifier', 'non_conforme'] },
          legal_blocking: { type: 'boolean' },
          mandatory_elements_found: { type: 'array', items: { type: 'string' } },
          mandatory_elements_missing: { type: 'array', items: { type: 'string' } },
          issues: { type: 'array', items: { type: 'string' } },
          legal_reference: { type: 'string' },
        },
        required: ['section_number', 'section_title', 'content', 'status', 'legal_blocking'],
      },
    },
    compliance_level: { type: 'string', enum: _COMPLIANCE_ENUM },
    blocking_issues: { type: 'array', items: { type: 'string' } },
    global_score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
  },
  required: ['sections', 'compliance_level', 'blocking_issues', 'global_score', 'summary'],
};

const SECTION_CORRECTION_SCHEMA = {
  type: 'object',
  properties: {
    needs_info: { type: 'boolean' },
    questions: { type: 'array', items: { type: 'string' } },
    corrected_content: { type: ['string', 'null'] },
    corrections_made: { type: 'array', items: { type: 'string' } },
    remaining_issues: { type: 'array', items: { type: 'string' } },
    confidence: { type: ['string', 'null'] },
  },
  required: ['needs_info', 'questions', 'corrections_made', 'remaining_issues'],
};

const CONTRACT_ANALYSIS_SCHEMA = {
  type: 'object',
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clause_number: { type: 'integer' },
          clause_title: { type: 'string' },
          content: { type: 'string' },
          status: { type: 'string', enum: ['conforme', 'a_verifier', 'non_conforme'] },
          legal_blocking: { type: 'boolean' },
          mandatory_elements_found: { type: 'array', items: { type: 'string' } },
          mandatory_elements_missing: { type: 'array', items: { type: 'string' } },
          issues: { type: 'array', items: { type: 'string' } },
        },
        required: ['clause_number', 'clause_title', 'content', 'status'],
      },
    },
    compliance_level: { type: 'string', enum: _COMPLIANCE_ENUM },
    blocking_issues: { type: 'array', items: { type: 'string' } },
    global_score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
  },
  required: ['clauses', 'compliance_level', 'blocking_issues', 'global_score', 'summary'],
};

const CONTRACT_GENERATION_SCHEMA = {
  type: 'object',
  properties: {
    clauses: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          clause_number: { type: 'integer' },
          clause_title: { type: 'string' },
          content: { type: 'string' },
          status: { type: 'string', enum: ['conforme', 'a_verifier', 'non_conforme'] },
          issues: { type: 'array', items: { type: 'string' } },
          suggestions: { type: 'array', items: { type: 'string' } },
        },
        required: ['clause_number', 'clause_title', 'content', 'status'],
      },
    },
    global_score: { type: 'integer', minimum: 0, maximum: 100 },
    summary: { type: 'string' },
    missing_data: { type: 'array', items: { type: 'string' } },
  },
  required: ['clauses', 'global_score', 'summary', 'missing_data'],
};

const DIP_COMPARISON_SCHEMA = {
  type: 'object',
  properties: {
    changements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          section: { type: 'string' },
          section_number: { type: 'integer' },
          ancien: { type: 'string' },
          nouveau: { type: 'string' },
          impact_legal: { type: 'string', enum: ['High', 'Moderate', 'Low'] },
          recommandation_ia: { type: 'string' },
          proposition_texte: { type: 'string' },
        },
        required: ['type', 'section', 'ancien', 'nouveau', 'impact_legal', 'recommandation_ia'],
      },
    },
    resume: { type: 'string' },
    nb_changements_critiques: { type: 'integer' },
  },
  required: ['changements', 'resume', 'nb_changements_critiques'],
};

const CONTRACT_COMPARISON_SCHEMA = {
  type: 'object',
  properties: {
    changements: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          id: { type: 'string' },
          type: { type: 'string' },
          clause: { type: 'string' },
          clause_number: { type: 'integer' },
          ancien: { type: 'string' },
          nouveau: { type: 'string' },
          impact_legal: { type: 'string', enum: ['High', 'Moderate', 'Low'] },
          recommandation_ia: { type: 'string' },
        },
        required: ['type', 'clause', 'ancien', 'nouveau', 'impact_legal', 'recommandation_ia'],
      },
    },
    resume: { type: 'string' },
    nb_changements_critiques: { type: 'integer' },
  },
  required: ['changements', 'resume', 'nb_changements_critiques'],
};

const DETECT_CHANGES_SCHEMA = {
  type: 'object',
  properties: {
    has_changes: { type: 'boolean' },
    changes: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          field: { type: 'string' },
          old_value: { type: 'string' },
          new_value: { type: 'string' },
          suggestion: { type: 'string' },
        },
        required: ['field', 'old_value', 'new_value'],
      },
    },
    urgency: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
  },
  required: ['has_changes', 'changes'],
};

const CERTIFICATE_SCHEMA = {
  type: 'object',
  properties: {
    certificate_text: { type: 'string' },
    certificate_title: { type: 'string' },
    legal_summary: { type: 'string' },
    warnings: { type: 'array', items: { type: 'string' } },
  },
  required: ['certificate_text', 'certificate_title', 'legal_summary', 'warnings'],
};

const SECTION_WITH_ANSWERS_SCHEMA = {
  type: 'object',
  properties: {
    corrected_content: { type: 'string' },
    corrections_made: { type: 'array', items: { type: 'string' } },
    remaining_issues: { type: 'array', items: { type: 'string' } },
    confidence: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
  },
  required: ['corrected_content', 'corrections_made', 'remaining_issues', 'confidence'],
};

const CROSS_IMPACT_SCHEMA = {
  type: 'object',
  properties: {
    impacts: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          target_item_number: { type: 'integer' },
          target_item_title: { type: 'string' },
          reason: { type: 'string' },
          suggestion: { type: 'string' },
          urgency: { type: 'string', enum: ['haute', 'moyenne', 'faible'] },
        },
        required: ['target_item_number', 'target_item_title', 'reason', 'urgency'],
      },
    },
  },
  required: ['impacts'],
};

const LITIGATION_ASSESSMENT_SCHEMA = {
  type: 'object',
  properties: {
    overall_risk: { type: 'string', enum: ['CRITIQUE', 'ELEVE', 'MODERE', 'FAIBLE'] },
    risk_score: { type: 'integer', minimum: 0, maximum: 100 },
    risks: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          section_number: { type: 'integer' },
          section_title: { type: 'string' },
          risk_type: { type: 'string', enum: [
            'nullite_consentement',
            'responsabilite_precontractuelle',
            'dol_previsionnel',
            'desequilibre_significatif',
            'rupture_brutale',
            'ordre_public_l330_3'
          ]},
          risk_label: { type: 'string' },
          legal_basis: { type: 'string' },
          jurisprudence: { type: 'string' },
          description: { type: 'string' },
          severity: { type: 'string', enum: ['critique', 'eleve', 'modere'] },
          recommended_action: { type: 'string' },
        },
        required: ['section_number', 'section_title', 'risk_type', 'risk_label', 'legal_basis', 'description', 'severity', 'recommended_action'],
      },
    },
    coherence_issues: {
      type: 'array',
      items: {
        type: 'object',
        properties: {
          description: { type: 'string' },
          sections_involved: { type: 'array', items: { type: 'integer' } },
          severity: { type: 'string', enum: ['critique', 'eleve', 'modere'] },
        },
        required: ['description', 'sections_involved', 'severity'],
      },
    },
    previsionnel_analysis: {
      type: 'object',
      properties: {
        has_projections: { type: 'boolean' },
        disclaimer_present: { type: 'boolean' },
        risk_level: { type: 'string', enum: ['critique', 'eleve', 'modere', 'faible'] },
        observations: { type: 'string' },
      },
      required: ['has_projections', 'disclaimer_present', 'risk_level', 'observations'],
    },
    recommended_actions: { type: 'array', items: { type: 'string' } },
  },
  required: ['overall_risk', 'risk_score', 'risks', 'coherence_issues', 'previsionnel_analysis', 'recommended_actions'],
};

const SYSTEM_DIP_EXPERT = `Tu es un expert juridique senior spécialisé en droit de la franchise française.
Tu maîtrises parfaitement :
- La Loi Doubin (Loi n°89-1008 du 31 décembre 1989) et l'article L.330-3 du Code de commerce
- Les obligations d'information précontractuelle du franchiseur envers les candidats franchisés
- Les 10 sections réglementaires obligatoires du DIP (Document d'Information Précontractuelle)
- La jurisprudence récente sur la nullité des contrats de franchise pour DIP incomplet ou inexact

Règles absolues :
- Réponds TOUJOURS en JSON valide, sans markdown, sans texte avant ou après
- Si une information est absente du document, indique "Non renseigné" (ne pas inventer)
- Applique les critères de conformité de la Loi Doubin strictement`;

const CACHED_SYSTEM = [{ type: 'text', text: SYSTEM_DIP_EXPERT, cache_control: { type: 'ephemeral' } }];

/**
 * Analyser et extraire les 10 sections réglementaires d'un DIP
 * Scoring à deux niveaux : conformité bloquante (légale) + qualité globale
 */
const parseDIPSections = async (rawText) => {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Le texte extrait du fichier est trop court. Vérifiez que le PDF n\'est pas scanné ou protégé.');
  }

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Analyse ce DIP selon les exigences strictes de la Loi Doubin (art. L.330-3 Code de commerce) et du Décret n°91-337 du 4 avril 1991.

TEXTE DU DIP :
${rawText.substring(0, 18000)}

DEUX NIVEAUX D'ANALYSE :

NIVEAU 1 — ÉLÉMENTS LÉGALEMENT BLOQUANTS
Leur absence rend le DIP invalide et expose le franchiseur à la nullité du contrat + dommages-intérêts.
→ legal_blocking: true sur la section concernée.

NIVEAU 2 — QUALITÉ ET COMPLÉTUDE
Améliore la robustesse du DIP mais ne bloque pas l'envoi immédiat.
→ legal_blocking: false, status: "a_verifier".

GRILLE DE CONFORMITÉ OBLIGATOIRE PAR SECTION (Art. R.330-1 Code de commerce, codifiant le Décret n°91-337 du 4 avril 1991) :

SECTION 1 — Identité du franchiseur [Réf. Art. R.330-1 C. com. §1]
BLOQUANT si absent : dénomination sociale, forme juridique, numéro RCS + ville, adresse siège, nom du dirigeant responsable
À VÉRIFIER : capital social, date immatriculation

SECTION 2 — Historique dirigeant et enseigne [Réf. Art. R.330-1 C. com. §2]
BLOQUANT si absent : historique professionnel du dirigeant sur 5 ans minimum (exigence légale explicite), date de création de l'enseigne
À VÉRIFIER : parcours détaillé, expériences antérieures dans la franchise

SECTION 3 — État du réseau [Réf. Art. R.330-1 C. com. §3 — jurisprudence Cass. com.]
BLOQUANT si absent : nombre exact de franchisés actifs, nombre exact d'entrées sur 12 mois, nombre exact de sorties sur 12 mois avec motifs (résiliation, non-renouvellement, cession, fermeture volontaire, autre)
À VÉRIFIER : adresses des franchisés ou liste disponible sur demande, nombre d'établissements en propre

SECTION 4 — Comptes annuels [Réf. Art. R.330-1 C. com. §4 — BLOQUANT absolu]
BLOQUANT si absent : résultats des 2 derniers exercices comptables clos (chiffre d'affaires ET résultat net pour chaque exercice), dates de clôture
Les bilans complets peuvent être en annexe mais les chiffres clés doivent figurer dans le DIP.

SECTION 5 — Marque et propriété intellectuelle [Réf. Art. R.330-1 C. com. §5]
BLOQUANT si absent : numéro de dépôt INPI de la marque principale, statut de la marque (déposée/enregistrée)
À VÉRIFIER : date de dépôt, classes de protection, date d'expiration, marques secondaires

SECTION 6 — Informations financières [Réf. Art. R.330-1 C. com. §6 — BLOQUANT absolu]
BLOQUANT si absent : montant du droit d'entrée (ou mention explicite "aucun droit d'entrée"), taux ou montant de la redevance d'exploitation, taux ou montant de la redevance publicitaire (ou "aucune"), estimation de l'investissement global requis
À VÉRIFIER : conditions de paiement détaillées, aides au financement

SECTION 7 — Territoire exclusif [Réf. Art. R.330-1 C. com. §7]
BLOQUANT si absent : définition du périmètre territorial (même si non exclusif, la mention doit être explicite), mention du caractère exclusif ou non
À VÉRIFIER : critères de délimitation précis, conditions de modification

SECTION 8 — Contrat [Réf. Art. R.330-1 C. com. §8 — BLOQUANT absolu]
BLOQUANT si absent : durée du contrat en années, conditions de renouvellement, conditions et motifs de résiliation par chaque partie
À VÉRIFIER : conditions de cession du fonds, droit de préemption, clause de non-concurrence post-contractuelle

SECTION 9 — Litiges [Réf. Art. R.330-1 C. com. §9 — BLOQUANT absolu]
BLOQUANT si absent : TOUTE mention de litiges passés et en cours est obligatoire. Si aucun litige : la phrase "Aucun litige en cours à la date de remise du présent document" ou équivalent doit figurer explicitement. L'absence totale de cette section est un motif régulier d'annulation.
À VÉRIFIER : précision sur la nature des litiges mentionnés

SECTION 10 — Comptes prévisionnels [Réf. Art. R.330-1 C. com. §10]
BLOQUANT si absent : aucun prévisionnel = non bloquant si les 9 autres sections sont conformes, mais fortement recommandé
À VÉRIFIER : présence de projections sur 2-3 ans, hypothèses documentées, avertissement sur le caractère prévisionnel (non-garantie)

RETOURNE CE JSON EXACTEMENT — sans markdown, sans texte avant ou après :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "Texte extrait verbatim du document pour cette section",
      "status": "conforme",
      "legal_blocking": false,
      "mandatory_elements_found": ["dénomination sociale", "RCS", "siège", "dirigeant"],
      "mandatory_elements_missing": [],
      "issues": [],
      "legal_reference": "Art. R.330-1 C. com. (Décret 91-337 art.1 §1)"
    }
  ],
  "compliance_level": "CONFORME",
  "blocking_issues": [],
  "global_score": 85,
  "summary": "Analyse synthétique : points conformes, lacunes bloquantes, risques juridiques prioritaires"
}

Valeurs pour status : "conforme" | "a_verifier" | "non_conforme"
Valeurs pour compliance_level :
  "CONFORME"                → DIP envoyable légalement, toutes sections conformes ou a_verifier sans blocking
  "RÉVISIONS_MINEURES"      → Quelques a_verifier sans blocking — envoyable mais améliorations recommandées
  "RÉVISIONS_MAJEURES"      → Une ou plusieurs non_conforme sans blocking légal immédiat
  "BLOQUANT_NON_ENVOYABLE"  → Au moins une section legal_blocking:true — NE PAS ENVOYER CE DIP
global_score : 0-100. Pénalités : -20 par section non_conforme, -8 par a_verifier, -0 si conforme.`
    }]
  }, 'analyze_dip', DIP_ANALYSIS_SCHEMA, 2);
  if (!result) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  const SECTIONS_DEFAULT = [
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

  const LEGAL_REFS = [
    'Art. R.330-1 C. com. (Décret 91-337 art.1 §1)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §2)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §3)',
    'Art. R.330-1 C. com. (Décret 91-337 art.1 §4)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §5)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §6)',
    'Art. R.330-1 C. com. (Décret 91-337 art.1 §7)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §8)', 'Art. R.330-1 C. com. (Décret 91-337 art.1 §9)',
    'Art. R.330-1 C. com. (Décret 91-337 art.1 §10)'
  ];

  // Compléter les sections manquantes
  if (!result.sections || result.sections.length < 10) {
    const existing = new Set((result.sections || []).map(s => s.section_number));
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        const isHardBlocking = [1,3,4,6,8,9].includes(i);
        result.sections.push({
          section_number: i,
          section_title: SECTIONS_DEFAULT[i - 1],
          content: 'Section non trouvée dans le document',
          status: 'non_conforme',
          legal_blocking: isHardBlocking,
          mandatory_elements_found: [],
          mandatory_elements_missing: ['Section entière absente'],
          issues: ['Section obligatoire absente du DIP — non conforme Loi Doubin'],
          legal_reference: LEGAL_REFS[i - 1]
        });
      }
    }
    result.sections.sort((a, b) => a.section_number - b.section_number);
  }

  // Normaliser les champs nouveaux sur les sections retournées par l'IA
  result.sections = result.sections.map((s, idx) => ({
    legal_blocking: false,
    mandatory_elements_found: [],
    mandatory_elements_missing: [],
    legal_reference: LEGAL_REFS[s.section_number - 1] || LEGAL_REFS[idx],
    ...s
  }));

  // Recalculer compliance_level si absent
  if (!result.compliance_level) {
    const hasBlocking = result.sections.some(s => s.legal_blocking);
    const nonConformes = result.sections.filter(s => s.status === 'non_conforme').length;
    const aVerifier    = result.sections.filter(s => s.status === 'a_verifier').length;
    if (hasBlocking)        result.compliance_level = 'BLOQUANT_NON_ENVOYABLE';
    else if (nonConformes)  result.compliance_level = 'RÉVISIONS_MAJEURES';
    else if (aVerifier)     result.compliance_level = 'RÉVISIONS_MINEURES';
    else                    result.compliance_level = 'CONFORME';
  }

  if (!result.blocking_issues) {
    result.blocking_issues = result.sections
      .filter(s => s.legal_blocking)
      .map(s => `Section ${s.section_number} (${s.section_title}) : ${(s.issues || []).join('; ') || 'éléments obligatoires manquants'}`);
  }

  result.global_score = result.global_score ?? Math.max(0,
    100
    - result.sections.filter(s => s.status === 'non_conforme').length * 20
    - result.sections.filter(s => s.status === 'a_verifier').length * 8
  );

  return result;
};

/**
 * Générer un DIP complet à partir du formulaire guidé (8 étapes) rempli par le
 * franchiseur, avec la même grille de conformité stricte Loi Doubin que
 * parseDIPSections (bloquant légal vs qualité), pour garantir un niveau de
 * rigueur juridique identique quelle que soit la voie d'entrée (upload ou
 * génération assistée).
 */
const generateDIPFromForm = async (formData, sourceText = '') => {
  const sourceSection = sourceText
    ? `\nDOCUMENT SOURCE FOURNI EN COMPLÉMENT (à utiliser pour enrichir les sections insuffisamment couvertes par le formulaire) :\n${sourceText.substring(0, 12000)}\n`
    : '';

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Rédige un DIP complet et conforme à la Loi Doubin (art. L.330-3 Code de commerce, Décret n°91-337 du 4 avril 1991) à partir des données ci-dessous, en respectant strictement la grille de conformité par section.

DONNÉES DU FORMULAIRE FRANCHISEUR :
${JSON.stringify(formData, null, 2)}
${sourceSection}
GRILLE DE CONFORMITÉ OBLIGATOIRE PAR SECTION (Art. R.330-1 Code de commerce, codifiant le Décret n°91-337 du 4 avril 1991) :

SECTION 1 — Identité du franchiseur [Réf. Art. R.330-1 C. com. §1]
BLOQUANT si absent : dénomination sociale, forme juridique, numéro RCS + ville, adresse siège, nom du dirigeant responsable

SECTION 2 — Historique dirigeant et enseigne [Réf. Art. R.330-1 C. com. §2]
BLOQUANT si absent : historique professionnel du dirigeant sur 5 ans minimum, date de création de l'enseigne

SECTION 3 — État du réseau [Réf. Art. R.330-1 C. com. §3]
BLOQUANT si absent : nombre exact de franchisés actifs, entrées/sorties sur 12 mois avec motifs

SECTION 4 — Comptes annuels [Réf. Art. R.330-1 C. com. §4 — BLOQUANT absolu]
BLOQUANT si absent : résultats des 2 derniers exercices clos (CA et résultat net), dates de clôture

SECTION 5 — Marque et propriété intellectuelle [Réf. Art. R.330-1 C. com. §5]
BLOQUANT si absent : numéro de dépôt INPI de la marque principale, statut de la marque

SECTION 6 — Informations financières [Réf. Art. R.330-1 C. com. §6 — BLOQUANT absolu]
BLOQUANT si absent : droit d'entrée (ou mention explicite "aucun"), redevance d'exploitation, redevance publicitaire, investissement global estimé

SECTION 7 — Territoire exclusif [Réf. Art. R.330-1 C. com. §7]
BLOQUANT si absent : définition du périmètre territorial, mention du caractère exclusif ou non

SECTION 8 — Contrat [Réf. Art. R.330-1 C. com. §8 — BLOQUANT absolu]
BLOQUANT si absent : durée du contrat, conditions de renouvellement, conditions et motifs de résiliation

SECTION 9 — Litiges [Réf. Art. R.330-1 C. com. §9 — BLOQUANT absolu]
BLOQUANT si absent : toute mention de litiges est obligatoire ; si aucun, la phrase "Aucun litige en cours à la date de remise du présent document" doit figurer explicitement

SECTION 10 — Comptes prévisionnels [Réf. Art. R.330-1 C. com. §10]
Non bloquant si absent, mais fortement recommandé. Si présent, DOIT inclure un avertissement explicite sur le caractère non garanti des projections (Cass. com. 1er juin 2022 — dol sur prévisionnels grossièrement erronés sans réserve).

INSTRUCTIONS :
- Rédige un texte complet, professionnel et directement utilisable dans le DIP officiel pour chaque section
- Utilise les données du formulaire en priorité absolue ; le document source ne sert qu'à compléter ce qui manque
- Si une donnée obligatoire reste introuvable après formulaire et document source, écris "Non renseigné — à compléter avant remise" dans le contenu et liste-la dans mandatory_elements_missing
- N'invente JAMAIS une donnée factuelle (chiffres, dates, numéros RCS/INPI) absente des sources fournies

RETOURNE CE JSON EXACTEMENT — sans markdown, sans texte avant ou après :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "texte rédigé pour cette section, prêt à intégrer dans le DIP",
      "status": "conforme",
      "legal_blocking": false,
      "mandatory_elements_found": ["dénomination sociale", "RCS"],
      "mandatory_elements_missing": [],
      "issues": [],
      "legal_reference": "Art. R.330-1 C. com. (Décret 91-337 art.1 §1)"
    }
  ],
  "compliance_level": "CONFORME",
  "blocking_issues": [],
  "global_score": 85,
  "summary": "état global du DIP généré, lacunes bloquantes éventuelles"
}

Valeurs pour status : "conforme" | "a_verifier" | "non_conforme"
Valeurs pour compliance_level : "CONFORME" | "RÉVISIONS_MINEURES" | "RÉVISIONS_MAJEURES" | "BLOQUANT_NON_ENVOYABLE"
global_score : 0-100. Pénalités : -20 par section non_conforme, -8 par a_verifier.`
    }]
  }, 'generate_dip_from_form', DIP_ANALYSIS_SCHEMA, 2);
  if (!result) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  if (!result.compliance_level) {
    const hasBlocking = (result.sections || []).some(s => s.legal_blocking);
    const nonConformes = (result.sections || []).filter(s => s.status === 'non_conforme').length;
    const aVerifier = (result.sections || []).filter(s => s.status === 'a_verifier').length;
    if (hasBlocking) result.compliance_level = 'BLOQUANT_NON_ENVOYABLE';
    else if (nonConformes) result.compliance_level = 'RÉVISIONS_MAJEURES';
    else if (aVerifier) result.compliance_level = 'RÉVISIONS_MINEURES';
    else result.compliance_level = 'CONFORME';
  }

  result.global_score = result.global_score ?? Math.round(
    ((result.sections || []).filter(s => s.status === 'conforme').length / Math.max(1, (result.sections || []).length)) * 100
  );

  return result;
};

/**
 * Rédige le texte d'un champ du formulaire DIP à partir de réponses à des
 * sous-questions guidées (widget "Rédiger avec l'assistant IA").
 */
const formulateField = async (fieldLabel, answers) => {
  const qaBlock = (answers || [])
    .filter(qa => qa.answer?.trim())
    .map(qa => `Q : ${qa.question}\nR : ${qa.answer}`)
    .join('\n\n');

  if (!qaBlock) throw new Error('Aucune réponse fournie.');

  const message = await callClaude({
    model: MODEL_SONNET,
    max_tokens: 1024,
    system: [{ type: 'text', text: 'Tu es un rédacteur juridique spécialisé en droit de la franchise française (Loi Doubin, art. L.330-3 Code de commerce). Tu rédiges des textes factuels, professionnels, directement utilisables dans un DIP officiel — jamais de donnée inventée.', cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Rédige le texte du champ "${fieldLabel}" à partir des réponses suivantes du franchiseur :

${qaBlock}

INSTRUCTIONS :
- Un paragraphe fluide et professionnel, pas une liste de questions/réponses
- Utilise UNIQUEMENT les informations fournies ci-dessus — n'invente aucune donnée
- Si une réponse est vide ou insuffisante, n'en fais pas mention plutôt que d'inventer
- Réponds uniquement avec le texte rédigé, sans préambule ni guillemets`
    }]
  });

  return extractText(message);
};

/**
 * Comparer deux versions d'un DIP — détecter les changements à valider légalement
 */
const compareDIPVersions = async (previousText, newText) => {
  if (!previousText || !newText) {
    return { changements: [], resume: 'Texte manquant pour la comparaison', nb_changements_critiques: 0 };
  }

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 8192,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Compare ces deux versions d'un DIP et identifie tous les changements qui ont un impact légal.

VERSION PRÉCÉDENTE :
${previousText.substring(0, 9000)}

NOUVELLE VERSION :
${newText.substring(0, 9000)}

INSTRUCTIONS :
- Identifie UNIQUEMENT les changements réels et significatifs (pas les reformulations cosmétiques)
- Pour chaque changement, évalue l'impact selon la Loi Doubin
- Propose une reformulation légalement conforme
- Classe les changements par ordre d'importance légale (High en premier)

NIVEAUX D'IMPACT :
- High : changement obligatoire à notifier aux franchisés (données financières, conditions contrat, fermetures réseau, litiges nouveaux)
- Moderate : changement important mais non bloquant (coordonnées, dates, territoires)
- Low : changement mineur de forme ou de présentation

TYPES DE CHANGEMENTS :
- prix_franchise : droits d'entrée, redevances, investissements
- conditions : modalités contractuelles, durée, résiliation
- equipe : dirigeants, responsables, contacts
- resultats_financiers : chiffres d'affaires, bilans, résultats
- reseau : ouvertures, fermetures, nombre de franchisés
- litiges : procédures judiciaires, contentieux
- contrat : clauses contractuelles, obligations
- territoire : zones exclusives, périmètres
- marque : dépôts, validité, licences
- autre : tout autre changement significatif

Exemples d'impact High : modification du droit d'entrée, nouvelle redevance, fermetures réseau, nouveaux litiges.`
    }]
  }, 'compare_dip_versions', DIP_COMPARISON_SCHEMA, 2);

  if (!result) return { changements: [], resume: 'Analyse indisponible — réessayez ultérieurement', nb_changements_critiques: 0 };

  if (result.changements) {
    result.changements = result.changements.map((c, i) => ({
      ...c,
      id: c.id || `chgt_${i + 1}`
    }));
  }

  return result;
};

/**
 * Détecter les changements entre un document source et une section DIP
 */
const detectChanges = async (sectionContent, newDocumentText, sectionTitle) => {
  const result = await callClaudeToolUse({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Compare la section DIP existante avec un nouveau document source et détecte les mises à jour nécessaires.

SECTION DIP ACTUELLE — ${sectionTitle} :
${sectionContent}

NOUVEAU DOCUMENT SOURCE :
${newDocumentText.substring(0, 5000)}`
    }]
  }, 'detect_changes', DETECT_CHANGES_SCHEMA, 1);

  return result ?? { has_changes: false, changes: [] };
};

/**
 * Générer un message de notification pour les franchisés
 */
const generateUpdateSummary = async (updatedSections) => {
  const message = await callClaude({
    model: MODEL_HAIKU,
    max_tokens: 1024,
    system: [{ type: 'text', text: 'Tu es un expert en communication juridique franchise. Tu rédiges des messages clairs, professionnels et rassurants.', cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Rédige un message de notification professionnel à envoyer aux franchisés pour les informer des mises à jour du DIP.

Sections mises à jour :
${JSON.stringify(updatedSections, null, 2)}

Contraintes :
- Ton professionnel et rassurant
- Mentionner les sections modifiées sans détails confidentiels
- Rappeler l'obligation de consulter le nouveau DIP avant toute décision
- Maximum 150 mots
- Commencer par "Madame, Monsieur,"

Réponds uniquement avec le texte du message.`
    }]
  });

  return extractText(message);
};

/**
 * Générer une correction IA pour une section non conforme ou à vérifier.
 * Retourne needs_info: true + questions si le contenu est trop vide pour corriger.
 */
const correctSection = async (section) => {
  const { section_number, section_title, content, issues = [], status } = section;

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Tu dois corriger cette section du DIP pour la rendre conforme à la Loi Doubin.

SECTION ${section_number} — ${section_title}
Statut actuel : ${status}
Problèmes : ${issues.length > 0 ? issues.join('; ') : 'Section incomplète ou insuffisante'}

CONTENU ACTUEL :
${content || '(Section vide ou non renseignée)'}

RÈGLE CRITIQUE — ÉVALUE D'ABORD :
Si le contenu actuel est vide ou trop vague pour produire une correction utile (moins de 3 informations factuelles exploitables), tu DOIS demander des informations au franchiseur plutôt que de générer une correction remplie de placeholders.

CAS 1 — Tu as assez d'informations → corrige directement :
{
  "needs_info": false,
  "questions": [],
  "corrected_content": "Texte complet et corrigé, prêt à intégrer dans le DIP",
  "corrections_made": ["liste des améliorations apportées"],
  "remaining_issues": ["données spécifiques encore manquantes"],
  "confidence": "haute|moyenne|faible"
}

CAS 2 — Le contenu est trop vide pour corriger correctement → pose des questions :
{
  "needs_info": true,
  "questions": ["Question précise 1 ?", "Question précise 2 ?", "Question précise 3 ?"],
  "corrected_content": null,
  "corrections_made": [],
  "remaining_issues": [],
  "confidence": null
}

RÈGLES pour les questions (CAS 2) :
- Maximum 4 questions, courtes et précises
- Chaque question cible une donnée factuelle manquante indispensable
- Questions en français, formulées pour un franchiseur non juriste
- Ne pose des questions QUE si le contenu est vraiment insuffisant

Retourne uniquement le JSON, sans markdown.`
    }]
  }, 'submit_correction', SECTION_CORRECTION_SCHEMA, 1);
  if (!result) {
    return {
      needs_info: false,
      questions: [],
      corrected_content: content,
      corrections_made: [],
      remaining_issues: ['Correction IA indisponible — réessayez'],
      confidence: 'faible'
    };
  }
  return result;
};

/**
 * Générer une correction en utilisant les réponses du franchiseur aux questions posées.
 */
const correctSectionWithAnswers = async (section, questionsAndAnswers) => {
  const { section_number, section_title, content, status } = section;

  const qaBlock = questionsAndAnswers
    .map((qa, i) => `Q${i + 1} : ${qa.question}\nRéponse : ${qa.answer}`)
    .join('\n\n');

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Tu dois rédiger le contenu complet de cette section du DIP en intégrant les informations fournies par le franchiseur.

SECTION ${section_number} — ${section_title}
Statut actuel : ${status}

CONTENU EXISTANT (peut être vide) :
${content || '(Section vide)'}

INFORMATIONS FOURNIES PAR LE FRANCHISEUR :
${qaBlock}

INSTRUCTIONS :
- Rédige un texte complet, professionnel et conforme à la Loi Doubin
- Intègre toutes les informations fournies ci-dessus
- Si une donnée est encore manquante, indique "[À COMPLÉTER : description]"
- Le texte doit être directement utilisable dans le DIP officiel`
    }]
  }, 'submit_correction_with_answers', SECTION_WITH_ANSWERS_SCHEMA, 2);

  if (!result) {
    return {
      corrected_content: content || '',
      corrections_made: [],
      remaining_issues: ['Correction IA indisponible — réessayez'],
      confidence: 'faible'
    };
  }
  return result;
};

const analyzeDocumentForDIPImpact = async (documentText, currentDipContext, fileName) => {
  const message = await callClaude({
    model: MODEL_HAIKU,
    max_tokens: 400,
    messages: [{
      role: 'user',
      content: `Tu es expert en conformité DIP (Loi Doubin, art. L.330-3 Code de commerce).

Le document "${fileName}" a été modifié dans le drive du franchiseur.

EXTRAIT DU DOCUMENT :
${documentText.substring(0, 3000)}

SECTIONS ACTUELLES DU DIP :
${currentDipContext.substring(0, 2000)}

En 3 phrases max, réponds :
1. Ce que contient ce document
2. Quelles sections du DIP sont potentiellement impactées (cite les numéros)
3. Urgence : IMMÉDIATE / À VÉRIFIER / NON URGENT

Sois direct et factuel.`
    }]
  });
  return extractText(message);
};

// Types de pièces sources que le franchiseur peut fournir dans sa bibliothèque
// de documents, mappés sur la section DIP qu'ils permettent de renseigner.
// Source de vérité unique — réutilisée par la route documents.js et le frontend.
const DOCUMENT_TYPES = [
  { key: 'kbis',                label: 'Extrait Kbis / RCS',                          section_number: 1,    required: true  },
  { key: 'statuts',              label: 'Statuts de la société',                       section_number: 1,    required: true  },
  { key: 'parcours_dirigeant',   label: 'CV / parcours du dirigeant (5 ans)',          section_number: 2,    required: false },
  { key: 'liste_franchises',     label: 'Liste des franchisés et succursales',          section_number: 3,    required: true  },
  { key: 'comptes_n1',           label: 'Comptes annuels — dernier exercice clos',      section_number: 4,    required: true  },
  { key: 'comptes_n2',           label: 'Comptes annuels — avant-dernier exercice',     section_number: 4,    required: true  },
  { key: 'depot_inpi',           label: 'Certificat de dépôt de marque (INPI)',          section_number: 5,    required: true  },
  { key: 'grille_tarifaire',     label: 'Grille tarifaire (droit d\'entrée, redevances)', section_number: 6,   required: true  },
  { key: 'territoire',           label: 'Carte ou description de la zone territoriale', section_number: 7,    required: false },
  { key: 'contrat_type',         label: 'Contrat de franchise type',                    section_number: 8,    required: true  },
  { key: 'attestation_litiges',  label: 'Attestation d\'absence de litige ou jugements', section_number: 9,   required: false },
  { key: 'business_plan',        label: 'Business plan prévisionnel type',              section_number: 10,   required: false },
  { key: 'autre',                label: 'Autre document justificatif',                  section_number: null, required: false },
];

/**
 * Extrait les données factuelles utiles d'une pièce source (Kbis, comptes
 * annuels, INPI...) uploadée dans la bibliothèque de documents du
 * franchiseur. Le résumé produit est réinjecté comme contexte lors de la
 * génération d'un DIP (generateDIPFromForm), pour réduire la saisie manuelle.
 */
const extractDocumentData = async (documentText, documentType, fileName) => {
  const typeInfo = DOCUMENT_TYPES.find(t => t.key === documentType);
  const typeLabel = typeInfo?.label || 'Document justificatif';

  const message = await callClaude({
    model: MODEL_HAIKU,
    max_tokens: 800,
    system: [{ type: 'text', text: 'Tu extrais des données factuelles de documents juridiques et comptables français pour alimenter un Document d\'Information Précontractuelle (Loi Doubin). Tu ne retiens que ce qui est explicitement écrit dans le document — jamais d\'invention ni d\'estimation.', cache_control: { type: 'ephemeral' } }],
    messages: [{
      role: 'user',
      content: `Document fourni : "${fileName}" — type déclaré : ${typeLabel}.

CONTENU DU DOCUMENT :
${documentText.substring(0, 15000)}

Extrais en 5 à 10 lignes maximum les données factuelles utiles à la rédaction d'un DIP (chiffres, dates, numéros, noms, montants — verbatim autant que possible). N'inclus que ce qui est explicitement présent dans le document. Si le document ne correspond pas au type "${typeLabel}" annoncé, indique-le clairement en premier.

Réponds uniquement avec le résumé factuel, sans préambule.`
    }]
  });

  return extractText(message);
};

/**
 * Générer un certificat de conformité et de remise pour un DIP ou une modification.
 * Ce certificat constitue une pièce de traçabilité opposable en cas de litige.
 *
 * @param {object} params
 *   dipVersion       — objet version DIP (numéro, date, hash SHA-256, compliance_level)
 *   changes          — tableau de changements (depuis compareDIPVersions) ou []
 *   franchiseur      — { nom, rcs, siège }
 *   deliveries       — [{ franchisee_name, sent_at, read_at, email }] ou []
 *   certificateType  — "INITIAL" | "MISE_A_JOUR" | "REMISE"
 */
const generateChangesCertificate = async ({ dipVersion, changes = [], franchiseur, deliveries = [], certificateType }) => {
  const now = new Date().toISOString();

  const changesBlock = changes.length
    ? changes.map(c =>
        `- [${c.impact_legal}] ${c.section} : "${c.ancien}" → "${c.nouveau}" (${c.type})`
      ).join('\n')
    : 'Aucune modification — certificat de remise initiale.';

  const deliveryBlock = deliveries.length
    ? deliveries.map(d =>
        `- ${d.franchisee_name} <${d.email}> : envoyé le ${d.sent_at}${d.read_at ? `, lu le ${d.read_at}` : ' — lecture non confirmée'}`
      ).join('\n')
    : 'Aucune remise enregistrée à ce stade.';

  const result = await callClaudeToolUse({
    model: MODEL_SONNET,
    max_tokens: 4096,
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Rédige un certificat juridique de ${certificateType === 'INITIAL' ? 'conformité et de remise initiale' : certificateType === 'MISE_A_JOUR' ? 'mise à jour et de notification' : 'remise'} d'un Document d'Information Précontractuelle (DIP) au sens de l'article L.330-3 du Code de commerce.

DONNÉES DU CERTIFICAT :
Franchiseur : ${franchiseur.nom} — RCS ${franchiseur.rcs} — ${franchiseur.siege}
Version DIP  : n°${dipVersion.version} — créée le ${dipVersion.created_at}
Empreinte SHA-256 : ${dipVersion.sha256 || 'non calculée'}
Niveau de conformité : ${dipVersion.compliance_level}
Score de conformité  : ${dipVersion.global_score}/100
Date d'émission du certificat : ${now}

MODIFICATIONS DOCUMENTÉES :
${changesBlock}

REMISES EFFECTUÉES :
${deliveryBlock}

INSTRUCTIONS DE RÉDACTION :
- Rédige un document formel en français juridique
- Commence par "CERTIFICAT DE ${certificateType === 'INITIAL' ? 'CONFORMITÉ ET DE REMISE' : 'MISE À JOUR ET DE NOTIFICATION'}"
- Atteste de : l'intégrité du document (hash), la conformité légale au moment de la remise, les modifications et leur nature, la liste des destinataires et les dates de remise
- Inclus une clause sur le délai réglementaire des 20 jours (art. L.330-3)
- Termine par une section "Valeur probatoire" expliquant en quoi ce certificat constitue une preuve opposable
- Ton : professionnel, précis, sobre — maximum 400 mots`
    }]
  }, 'submit_certificate', CERTIFICATE_SCHEMA, 2);

  if (!result) {
    return {
      certificate_text: `CERTIFICAT DE REMISE DIP\n\nVersion : ${dipVersion.version}\nDate : ${now}\nFranchiseur : ${franchiseur.nom}\nConformité : ${dipVersion.compliance_level}\n\nCe certificat atteste de la remise du DIP ci-dessus référencé.`,
      certificate_title: `Certificat DIP v${dipVersion.version}`,
      legal_summary: 'Certificat de remise du DIP.',
      warnings: ['Certificat généré en mode dégradé — régénérez pour un document complet']
    };
  }

  result.generated_at = now;
  result.certificate_type = certificateType;
  result.dip_version = dipVersion.version;
  result.sha256 = dipVersion.sha256 || null;
  return result;
};

const SYSTEM_CONTRACT_EXPERT = `Tu es un expert juridique senior spécialisé en droit de la franchise française.
Tu maîtrises parfaitement :
- Le droit commun des contrats (articles 1103, 1104, 1217 du Code civil)
- Le contrat de franchise et ses clauses essentielles (durée, redevances, territoire, non-concurrence, résiliation, cession)
- L'articulation entre le DIP (art. L.330-3, R.330-1 Code de commerce) et le contrat de franchise qui lui succède : le DIP doit être remis 20 jours avant la signature du contrat ; le franchiseur reste tenu de transmettre au candidat toute information déterminante de son consentement survenue entre la remise du DIP et la signature (y compris si elle diverge de ce que le DIP indiquait), sous peine de dol par réticence engageant sa responsabilité (Cass. com., 26 juin 2024, n°23-14.085)
- La jurisprudence sur les clauses abusives ou déséquilibrées en matière de franchise

Règles absolues :
- Réponds TOUJOURS en JSON valide, sans markdown, sans texte avant ou après
- Si une information est absente du document, indique "Non renseigné" (ne pas inventer)
- Sois rigoureux sur la cohérence entre le contrat et le DIP qui le précède`;

const CACHED_SYSTEM_CONTRACT = [{ type: 'text', text: SYSTEM_CONTRACT_EXPERT, cache_control: { type: 'ephemeral' } }];

// Clauses standards d'un contrat de franchise, mappées sur les sections DIP correspondantes
// pour permettre l'analyse d'impact croisé (le "tunnel" DIP <-> Contrat)
const CONTRACT_CLAUSES_DEFAULT = [
  'Objet et durée du contrat',
  'Droit d\'entrée et redevances',
  'Territoire et exclusivité',
  'Obligations du franchiseur',
  'Obligations du franchisé',
  'Propriété intellectuelle et savoir-faire',
  'Clause de non-concurrence',
  'Conditions de résiliation',
  'Conditions de cession et transmission',
  'Règlement des litiges'
];

// Section DIP correspondant à chaque clause (index 0 = clause 1)
const CLAUSE_DIP_SECTION_MAP = [8, 6, 7, 1, 8, 5, 8, 8, 8, 9];

/**
 * Générer une correction IA pour une clause de contrat non conforme ou à vérifier.
 * Retourne needs_info: true + questions si le contenu est trop vide pour corriger —
 * équivalent contrat de correctSection.
 */
const correctClause = async (clause) => {
  const { clause_number, clause_title, content, issues = [], status } = clause;

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Tu dois corriger cette clause du contrat de franchise pour la rendre juridiquement rigoureuse.

CLAUSE ${clause_number} — ${clause_title}
Statut actuel : ${status}
Problèmes : ${issues.length > 0 ? issues.join('; ') : 'Clause incomplète ou insuffisante'}

CONTENU ACTUEL :
${content || '(Clause vide ou non renseignée)'}

RÈGLE CRITIQUE — ÉVALUE D'ABORD :
Si le contenu actuel est vide ou trop vague pour produire une correction utile (moins de 3 informations factuelles exploitables), tu DOIS demander des informations au franchiseur plutôt que de générer une clause remplie de placeholders.

CAS 1 — Tu as assez d'informations → corrige directement :
{
  "needs_info": false,
  "questions": [],
  "corrected_content": "Texte complet et corrigé, prêt à intégrer dans le contrat",
  "corrections_made": ["liste des améliorations apportées"],
  "remaining_issues": ["données spécifiques encore manquantes"],
  "confidence": "haute|moyenne|faible"
}

CAS 2 — Le contenu est trop vide pour corriger correctement → pose des questions :
{
  "needs_info": true,
  "questions": ["Question précise 1 ?", "Question précise 2 ?", "Question précise 3 ?"],
  "corrected_content": null,
  "corrections_made": [],
  "remaining_issues": [],
  "confidence": null
}

RÈGLES pour les questions (CAS 2) :
- Maximum 4 questions, courtes et précises
- Chaque question cible une donnée factuelle manquante indispensable
- Questions en français, formulées pour un franchiseur non juriste
- Ne pose des questions QUE si le contenu est vraiment insuffisant

Retourne uniquement le JSON, sans markdown.`
    }]
  }, 'submit_clause_correction', SECTION_CORRECTION_SCHEMA, 1);
  if (!result) {
    return {
      needs_info: false,
      questions: [],
      corrected_content: content,
      corrections_made: [],
      remaining_issues: ['Correction IA indisponible — réessayez'],
      confidence: 'faible'
    };
  }
  return result;
};

/**
 * Générer une correction de clause en utilisant les réponses du franchiseur
 * aux questions posées — équivalent contrat de correctSectionWithAnswers.
 */
const correctClauseWithAnswers = async (clause, questionsAndAnswers) => {
  const { clause_number, clause_title, content, status } = clause;

  const qaBlock = questionsAndAnswers
    .map((qa, i) => `Q${i + 1} : ${qa.question}\nRéponse : ${qa.answer}`)
    .join('\n\n');

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 4096,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Tu dois rédiger le contenu complet de cette clause du contrat de franchise en intégrant les informations fournies par le franchiseur.

CLAUSE ${clause_number} — ${clause_title}
Statut actuel : ${status}

CONTENU EXISTANT (peut être vide) :
${content || '(Clause vide)'}

INFORMATIONS FOURNIES PAR LE FRANCHISEUR :
${qaBlock}

INSTRUCTIONS :
- Rédige un texte complet, professionnel et juridiquement rigoureux
- Intègre toutes les informations fournies ci-dessus
- Si une donnée est encore manquante, indique "[À COMPLÉTER : description]"
- Le texte doit être directement utilisable dans le contrat officiel`
    }]
  }, 'submit_clause_correction_with_answers', SECTION_WITH_ANSWERS_SCHEMA, 2);

  if (!result) {
    return {
      corrected_content: content || '',
      corrections_made: [],
      remaining_issues: ['Correction IA indisponible — réessayez'],
      confidence: 'faible'
    };
  }
  return result;
};

/**
 * Analyser et extraire les clauses d'un contrat de franchise
 */
const parseContractClauses = async (rawText) => {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Le texte extrait du fichier est trop court. Vérifiez que le PDF n\'est pas scanné ou protégé.');
  }

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 16000,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Analyse ce contrat de franchise et extrait son contenu selon les 10 clauses standards suivantes.

TEXTE DU CONTRAT :
${rawText.substring(0, 18000)}

CLAUSES À IDENTIFIER :
1. Objet et durée du contrat — durée en années, date de prise d'effet, conditions de renouvellement
2. Droit d'entrée et redevances — montant du droit d'entrée, taux de redevance d'exploitation, taux de redevance publicitaire
3. Territoire et exclusivité — périmètre territorial, caractère exclusif ou non
4. Obligations du franchiseur — transmission du savoir-faire, formation, assistance continue
5. Obligations du franchisé — respect des normes, redevances, approvisionnement, reporting
6. Propriété intellectuelle et savoir-faire — licence de marque, confidentialité du savoir-faire
7. Clause de non-concurrence — durée, périmètre géographique post-contractuel
8. Conditions de résiliation — motifs, préavis, conséquences pour chaque partie
9. Conditions de cession et transmission — droit de préemption, agrément du cessionnaire
10. Règlement des litiges — juridiction compétente, clause de médiation/arbitrage

Pour chaque clause, indique si elle est légalement bloquante (legal_blocking: true) lorsque son absence totale expose à un déséquilibre contractuel manifeste ou une nullité (clauses 1, 2, 8 sont structurellement bloquantes si totalement absentes).

RETOURNE CE JSON EXACTEMENT — sans markdown, sans texte avant ou après :
{
  "clauses": [
    {
      "clause_number": 1,
      "clause_title": "Objet et durée du contrat",
      "content": "Texte extrait verbatim du document pour cette clause",
      "status": "conforme",
      "legal_blocking": false,
      "mandatory_elements_found": ["durée 7 ans", "renouvellement tacite"],
      "mandatory_elements_missing": [],
      "issues": []
    }
  ],
  "compliance_level": "CONFORME",
  "blocking_issues": [],
  "global_score": 85,
  "summary": "Analyse synthétique : points conformes, lacunes, risques juridiques prioritaires"
}

Valeurs pour status : "conforme" | "a_verifier" | "non_conforme"
Valeurs pour compliance_level : "CONFORME" | "RÉVISIONS_MINEURES" | "RÉVISIONS_MAJEURES" | "BLOQUANT_NON_ENVOYABLE"
global_score : 0-100. Pénalités : -20 par clause non_conforme, -8 par a_verifier.`
    }]
  }, 'analyze_contract', CONTRACT_ANALYSIS_SCHEMA, 2);
  if (!result) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  if (!result.clauses || result.clauses.length < 10) {
    const existing = new Set((result.clauses || []).map(c => c.clause_number));
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        const isHardBlocking = [1, 2, 8].includes(i);
        result.clauses.push({
          clause_number: i,
          clause_title: CONTRACT_CLAUSES_DEFAULT[i - 1],
          content: 'Clause non trouvée dans le document',
          status: 'non_conforme',
          legal_blocking: isHardBlocking,
          mandatory_elements_found: [],
          mandatory_elements_missing: ['Clause entière absente'],
          issues: ['Clause structurante absente du contrat']
        });
      }
    }
    result.clauses.sort((a, b) => a.clause_number - b.clause_number);
  }

  result.clauses = result.clauses.map((c, idx) => ({
    legal_blocking: false,
    mandatory_elements_found: [],
    mandatory_elements_missing: [],
    ...c,
    linked_dip_section_number: CLAUSE_DIP_SECTION_MAP[c.clause_number - 1] || CLAUSE_DIP_SECTION_MAP[idx]
  }));

  if (!result.compliance_level) {
    const hasBlocking = result.clauses.some(c => c.legal_blocking);
    const nonConformes = result.clauses.filter(c => c.status === 'non_conforme').length;
    const aVerifier    = result.clauses.filter(c => c.status === 'a_verifier').length;
    if (hasBlocking)        result.compliance_level = 'BLOQUANT_NON_ENVOYABLE';
    else if (nonConformes)  result.compliance_level = 'RÉVISIONS_MAJEURES';
    else if (aVerifier)     result.compliance_level = 'RÉVISIONS_MINEURES';
    else                    result.compliance_level = 'CONFORME';
  }

  if (!result.blocking_issues) {
    result.blocking_issues = result.clauses
      .filter(c => c.legal_blocking)
      .map(c => `Clause ${c.clause_number} (${c.clause_title}) : ${(c.issues || []).join('; ') || 'éléments obligatoires manquants'}`);
  }

  result.global_score = result.global_score ?? Math.max(0,
    100
    - result.clauses.filter(c => c.status === 'non_conforme').length * 20
    - result.clauses.filter(c => c.status === 'a_verifier').length * 8
  );

  return result;
};

/**
 * Comparer deux versions d'un contrat de franchise — détecter les changements à impact légal
 */
const compareContractVersions = async (previousText, newText) => {
  if (!previousText || !newText) {
    return { changements: [], resume: 'Texte manquant pour la comparaison', nb_changements_critiques: 0 };
  }

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 8192,
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Compare ces deux versions d'un contrat de franchise et identifie tous les changements qui ont un impact légal ou financier.

VERSION PRÉCÉDENTE :
${previousText.substring(0, 9000)}

NOUVELLE VERSION :
${newText.substring(0, 9000)}

INSTRUCTIONS :
- Identifie UNIQUEMENT les changements réels et significatifs (pas les reformulations cosmétiques)
- Classe les changements par ordre d'importance légale (High en premier)

NIVEAUX D'IMPACT :
- High : changement substantiel (durée, redevances, droit d'entrée, territoire, résiliation, non-concurrence)
- Moderate : changement important mais non bloquant
- Low : changement mineur de forme

TYPES DE CHANGEMENTS :
- duree_renouvellement, financier, territoire, obligations, propriete_intellectuelle, non_concurrence, resiliation, cession, litiges, autre`
    }]
  }, 'compare_contract_versions', CONTRACT_COMPARISON_SCHEMA, 2);

  if (!result) return { changements: [], resume: 'Analyse indisponible — réessayez ultérieurement', nb_changements_critiques: 0 };

  if (result.changements) {
    result.changements = result.changements.map((c, i) => ({ ...c, id: c.id || `chgt_${i + 1}` }));
  }
  return result;
};

/**
 * Générer un contrat de franchise à partir d'un DIP déjà analysé.
 * Le DIP contient déjà la majorité des données juridiques nécessaires (territoire,
 * conditions financières, durée, litiges...) — l'IA les reformule en clauses contractuelles.
 * formData permet un mode "assisté" : réponses complémentaires sur des points propres
 * au contrat et absents du DIP (préavis de résiliation, juridiction compétente, etc.)
 */
const generateContractFromDIP = async (dipSections, formData = {}) => {
  if (!dipSections || dipSections.length === 0) {
    throw new Error('Aucune section de DIP fournie pour générer le contrat.');
  }

  const dipContent = dipSections
    .sort((a, b) => a.section_number - b.section_number)
    .map(s => `[Section ${s.section_number}] ${s.section_title}\n${s.content || 'Non renseigné'}`)
    .join('\n\n');

  const hasFormData = formData && Object.keys(formData).length > 0;
  const formSection = hasFormData
    ? `\nRÉPONSES COMPLÉMENTAIRES DU FRANCHISEUR (priorité sur le DIP en cas de conflit) :\n${JSON.stringify(formData, null, 2)}\n`
    : '';

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    thinking: { type: 'adaptive' },
    max_tokens: 16000,
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Rédige un contrat de franchise complet à partir du Document d'Information Précontractuelle (DIP) ci-dessous, déjà analysé et validé par le franchiseur.

DIP DU FRANCHISEUR :
${dipContent.substring(0, 18000)}
${formSection}
CLAUSES À RÉDIGER :
1. Objet et durée du contrat — durée en années, date de prise d'effet, conditions de renouvellement
2. Droit d'entrée et redevances — montant du droit d'entrée, taux de redevance d'exploitation, taux de redevance publicitaire
3. Territoire et exclusivité — périmètre territorial, caractère exclusif ou non
4. Obligations du franchiseur — transmission du savoir-faire, formation, assistance continue
5. Obligations du franchisé — respect des normes, redevances, approvisionnement, reporting
6. Propriété intellectuelle et savoir-faire — licence de marque, confidentialité du savoir-faire
7. Clause de non-concurrence — durée, périmètre géographique post-contractuel
8. Conditions de résiliation — motifs, préavis, conséquences pour chaque partie
9. Conditions de cession et transmission — droit de préemption, agrément du cessionnaire
10. Règlement des litiges — juridiction compétente, clause de médiation/arbitrage

INSTRUCTIONS :
- Reformule en clauses contractuelles juridiquement rigoureuses les informations déjà présentes dans le DIP (territoire = section 7, finances = section 6, contrat = section 8, litiges = section 9, etc.)
- Utilise les réponses complémentaires en priorité quand elles existent
- Si une information reste manquante après le DIP et le formulaire, indique "À compléter" et liste-la dans missing_data
- Le texte de chaque clause doit être directement utilisable dans le contrat final
- Veille à la cohérence stricte entre le contrat généré et le DIP source (mêmes montants, mêmes durées, même territoire)

Retourne ce JSON exactement :
{
  "clauses": [
    {
      "clause_number": 1,
      "clause_title": "Objet et durée du contrat",
      "content": "texte rédigé pour cette clause, prêt à intégrer au contrat",
      "status": "conforme",
      "issues": [],
      "suggestions": ["améliorations possibles"]
    }
  ],
  "global_score": 80,
  "summary": "état global du contrat généré et cohérence avec le DIP source",
  "missing_data": ["liste des informations manquantes à fournir avant signature"]
}

Valeurs pour status : "conforme" | "a_verifier" | "non_conforme"`
    }]
  }, 'generate_contract', CONTRACT_GENERATION_SCHEMA, 2);
  if (!result) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  if (!result.clauses || result.clauses.length < 10) {
    const existing = new Set((result.clauses || []).map(c => c.clause_number));
    result.clauses = result.clauses || [];
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        result.clauses.push({
          clause_number: i,
          clause_title: CONTRACT_CLAUSES_DEFAULT[i - 1],
          content: 'À compléter',
          status: 'non_conforme',
          issues: ['Clause non générée — informations insuffisantes dans le DIP'],
          suggestions: []
        });
      }
    }
    result.clauses.sort((a, b) => a.clause_number - b.clause_number);
  }

  result.clauses = result.clauses.map((c, idx) => ({
    ...c,
    linked_dip_section_number: CLAUSE_DIP_SECTION_MAP[c.clause_number - 1] || CLAUSE_DIP_SECTION_MAP[idx]
  }));

  result.global_score = result.global_score ?? Math.round(
    (result.clauses.filter(c => c.status === 'conforme').length / result.clauses.length) * 100
  );

  return result;
};

/**
 * Analyser l'impact croisé d'un changement détecté dans un document (DIP ou Contrat)
 * sur les éléments correspondants de l'autre document — coeur du "tunnel" d'informations.
 *
 * @param {object} params
 *   sourceType   — "dip" | "contract" — document où le changement a été détecté
 *   changes      — tableau de changements (depuis compareDIPVersions ou compareContractVersions)
 *   targetItems  — sections ou clauses actuelles du document cible [{ number, title, content }]
 */
const analyzeCrossImpact = async ({ sourceType, changes, targetItems }) => {
  if (!changes || changes.length === 0 || !targetItems || targetItems.length === 0) {
    return { impacts: [] };
  }

  const targetLabel = sourceType === 'dip' ? 'contrat de franchise' : 'DIP';
  const sourceLabel = sourceType === 'dip' ? 'DIP' : 'contrat de franchise';

  const result = await callClaudeToolUse({
    model: MODEL_HAIKU,
    max_tokens: 2048,
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{
      role: 'user',
      content: `Des changements viennent d'être détectés dans le ${sourceLabel}. Détermine s'ils rendent obsolètes ou incohérents des éléments du ${targetLabel} lié.

CHANGEMENTS DÉTECTÉS DANS LE ${sourceLabel.toUpperCase()} :
${JSON.stringify(changes.map(c => ({ type: c.type, titre: c.section || c.clause, ancien: c.ancien, nouveau: c.nouveau, impact_legal: c.impact_legal })), null, 2)}

ÉLÉMENTS ACTUELS DU ${targetLabel.toUpperCase()} :
${targetItems.map(t => `[${t.number}] ${t.title} : ${(t.content || '').substring(0, 300)}`).join('\n\n')}

Pour chaque élément du ${targetLabel} potentiellement rendu incohérent par un changement, retourne un impact. Ignore les éléments non concernés. Si aucun impact : retourne un tableau impacts vide.`
    }]
  }, 'submit_cross_impact', CROSS_IMPACT_SCHEMA, 1);

  return result ?? { impacts: [] };
};

const generateContractFromDIPStream = async (dipSections, formData = {}, onProgress) => {
  if (!dipSections || dipSections.length === 0) {
    throw new Error('Aucune section de DIP fournie pour générer le contrat.');
  }

  const dipContent = dipSections
    .sort((a, b) => a.section_number - b.section_number)
    .map(s => `[Section ${s.section_number}] ${s.section_title}\n${s.content || 'Non renseigné'}`)
    .join('\n\n');

  const hasFormData = formData && Object.keys(formData).length > 0;
  const formSection = hasFormData
    ? `\nRÉPONSES COMPLÉMENTAIRES DU FRANCHISEUR (priorité sur le DIP en cas de conflit) :\n${JSON.stringify(formData, null, 2)}\n`
    : '';

  const userContent = `Rédige un contrat de franchise complet à partir du Document d'Information Précontractuelle (DIP) ci-dessous, déjà analysé et validé par le franchiseur.

DIP DU FRANCHISEUR :
${dipContent.substring(0, 18000)}
${formSection}
CLAUSES À RÉDIGER :
1. Objet et durée du contrat — durée en années, date de prise d'effet, conditions de renouvellement
2. Droit d'entrée et redevances — montant du droit d'entrée, taux de redevance d'exploitation, taux de redevance publicitaire
3. Territoire et exclusivité — périmètre territorial, caractère exclusif ou non
4. Obligations du franchiseur — transmission du savoir-faire, formation, assistance continue
5. Obligations du franchisé — respect des normes, redevances, approvisionnement, reporting
6. Propriété intellectuelle et savoir-faire — licence de marque, confidentialité du savoir-faire
7. Clause de non-concurrence — durée, périmètre géographique post-contractuel
8. Conditions de résiliation — motifs, préavis, conséquences pour chaque partie
9. Conditions de cession et transmission — droit de préemption, agrément du cessionnaire
10. Règlement des litiges — juridiction compétente, clause de médiation/arbitrage

INSTRUCTIONS :
- Reformule en clauses contractuelles juridiquement rigoureuses les informations déjà présentes dans le DIP
- Utilise les réponses complémentaires en priorité quand elles existent
- Si une information reste manquante, indique "À compléter" et liste-la dans missing_data
- Le texte de chaque clause doit être directement utilisable dans le contrat final
- Veille à la cohérence stricte entre le contrat généré et le DIP source

Retourne ce JSON exactement :
{
  "clauses": [
    {
      "clause_number": 1,
      "clause_title": "Objet et durée du contrat",
      "content": "texte rédigé pour cette clause, prêt à intégrer au contrat",
      "status": "conforme",
      "issues": [],
      "suggestions": ["améliorations possibles"]
    }
  ],
  "global_score": 80,
  "summary": "état global du contrat généré et cohérence avec le DIP source",
  "missing_data": ["liste des informations manquantes à fournir avant signature"]
}

Valeurs pour status : "conforme" | "a_verifier" | "non_conforme"`;

  let fullText = '';
  let charsReceived = 0;

  const stream = claude.messages.stream({
    model: MODEL_OPUS,
    max_tokens: 12000,
    system: CACHED_SYSTEM_CONTRACT,
    messages: [{ role: 'user', content: userContent }],
  });

  for await (const event of stream) {
    if (event.type === 'content_block_delta' && event.delta.type === 'text_delta') {
      fullText += event.delta.text;
      charsReceived += event.delta.text.length;
      const clauseEst = Math.min(10, Math.max(1, Math.floor(charsReceived / 3600) + 1));
      const pct = Math.min(88, 10 + Math.floor((charsReceived / 36000) * 78));
      onProgress(pct, `Rédaction clause ${clauseEst}/10…`);
    }
  }

  const jsonStart = fullText.indexOf('{');
  if (jsonStart === -1) throw new Error("L'IA n'a pas retourné de JSON valide. Réessayez.");

  const rawJson = fullText.slice(jsonStart);
  let result;
  try {
    result = JSON.parse(rawJson);
  } catch {
    // JSON tronqué — extraire les clauses complètes déjà reçues
    const clauseMatches = [...rawJson.matchAll(/"clause_number"\s*:\s*(\d+)[\s\S]*?"content"\s*:\s*"((?:[^"\\]|\\.)*)"/g)];
    const partialClauses = clauseMatches.map(m => {
      const num = parseInt(m[1]);
      return {
        clause_number: num,
        clause_title: CONTRACT_CLAUSES_DEFAULT[num - 1] || `Clause ${num}`,
        content: m[2].replace(/\\n/g, '\n').replace(/\\"/g, '"'),
        status: 'a_verifier',
        issues: [],
        suggestions: []
      };
    });

    result = {
      clauses: partialClauses,
      global_score: null,
      summary: 'Génération partielle — certaines clauses ont été tronquées. Relancez pour une version complète.',
      missing_data: []
    };
  }

  if (!result.clauses || result.clauses.length < 10) {
    const existing = new Set((result.clauses || []).map(c => c.clause_number));
    result.clauses = result.clauses || [];
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        result.clauses.push({
          clause_number: i,
          clause_title: CONTRACT_CLAUSES_DEFAULT[i - 1],
          content: 'À compléter',
          status: 'non_conforme',
          issues: ['Clause non générée — informations insuffisantes dans le DIP'],
          suggestions: []
        });
      }
    }
    result.clauses.sort((a, b) => a.clause_number - b.clause_number);
  }

  result.clauses = result.clauses.map((c, idx) => ({
    ...c,
    linked_dip_section_number: CLAUSE_DIP_SECTION_MAP[c.clause_number - 1] || CLAUSE_DIP_SECTION_MAP[idx]
  }));

  result.global_score = result.global_score ?? Math.round(
    (result.clauses.filter(c => c.status === 'conforme').length / result.clauses.length) * 100
  );

  return result;
};

/**
 * Analyser les risques de litiges d'un DIP selon la jurisprudence française actuelle.
 * Pour chaque section non conforme, identifie le type d'action judiciaire possible,
 * l'article de loi et la jurisprudence de référence.
 */
const assessLitigationRisks = async (sections) => {
  if (!sections || sections.length === 0) {
    return {
      overall_risk: 'FAIBLE', risk_score: 0, risks: [], coherence_issues: [],
      previsionnel_analysis: { has_projections: false, disclaimer_present: false, risk_level: 'faible', observations: 'Aucune section analysée.' },
      recommended_actions: []
    };
  }

  const sectionsBlock = sections
    .sort((a, b) => (a.section_number || 0) - (b.section_number || 0))
    .map(s => `SECTION ${s.section_number} — ${s.section_title}
Statut : ${s.status || 'inconnu'} | Légalement bloquant : ${s.legal_blocking ? 'OUI' : 'non'}
Éléments manquants : ${(s.mandatory_elements_missing || []).join(', ') || 'aucun'}
Problèmes : ${(s.issues || []).join('; ') || 'aucun'}
Contenu : ${(s.content || 'Non renseigné').substring(0, 500)}`)
    .join('\n\n---\n\n');

  const result = await callClaudeToolUse({
    model: MODEL_OPUS,
    max_tokens: 8192,
    thinking: { type: 'adaptive' },
    system: CACHED_SYSTEM,
    messages: [{
      role: 'user',
      content: `Tu es un avocat spécialisé en droit de la franchise. Analyse ce DIP et identifie précisément les risques de litiges selon la jurisprudence française 2017-2024.

SECTIONS DU DIP :
${sectionsBlock}

RÉFÉRENTIEL DE LITIGES (applique uniquement les types pertinents) :

TYPE nullite_consentement [Art. 1130-1144 Code civil]
→ L'absence ou l'inexactitude d'une information essentielle constitue un dol ou une erreur déterminant le consentement du franchisé.
→ Résultat : nullité rétroactive du contrat + restitution intégrale des sommes versées.
→ Jurisprudence : Cass. 1re civ., 25 janv. 2017 — L330-3 est d'ordre public.
→ Sections à risque : toute section absente ou inexacte (1, 2, 3, 4, 5, 6, 7, 8, 9).

TYPE responsabilite_precontractuelle [Art. 1112-1 Code civil]
→ Manquement à l'obligation d'information précontractuelle, même sans nullité du contrat.
→ Résultat : dommages-intérêts. Plus accessible que la nullité, souvent cumulé.
→ Sections à risque : toute section incomplète.

TYPE dol_previsionnel [Cass. com., 1er juin 2022]
→ Les prévisionnels remis "grossièrement erronés" touchent "la substance même du contrat de franchise".
→ RISQUE SPÉCIFIQUE : Section 10 avec projections financières sans avertissement explicite "à titre indicatif, sans garantie de résultat".
→ Jurisprudence : Cass. com., 1er juin 2022.

TYPE desequilibre_significatif [Art. L442-1, I, 2° Code commerce]
→ Clauses créant un déséquilibre manifeste entre les droits et obligations des parties.
→ Sections à risque :
  - Section 7 : exclusivité territoriale avec réserves cachées (e-commerce franchiseur, ventes directes, exceptions non mentionnées)
  - Section 8 : résiliation unilatérale sans contrepartie ou préavis asymétrique
  - Section 6 : redevances indexées sans plafond

TYPE rupture_brutale [Art. L442-1, II Code commerce — Cass. com., 22 juin 2022]
→ Applicable après plusieurs années de relation. Préavis insuffisant = indemnisation obligatoire.
→ Section à risque : Section 8 (conditions de résiliation, durée du préavis).

TYPE ordre_public_l330_3 [Art. L330-3 Code commerce — Cass. 1re civ., 25 janv. 2017, n°15-28.064]
→ L.330-3 est d'ordre public : toute clause du DIP ou du contrat visant à exonérer le franchiseur de son obligation d'information précontractuelle est réputée non écrite.
→ ATTENTION — PAS de nullité automatique : la Cour de cassation exige la preuve d'un vice du consentement (erreur ou dol) résultant du manquement ; la seule absence ou insuffisance d'une section légalement bloquante ne suffit pas à elle seule. Formule toujours le risque au conditionnel ("expose à un risque de nullité si le candidat franchisé démontre que le manquement a déterminé son consentement"), jamais comme une nullité certaine ou automatique.

INSTRUCTIONS :
1. Ne retourne des risques QUE pour les sections qui présentent des problèmes réels (status ≠ conforme OU legal_blocking = true)
2. Pour chaque section problématique, identifie le type de litige le plus probable
3. Détecte les incohérences ENTRE sections (ex : CA Section 4 vs Section 6 incohérent)
4. Analyse Section 10 spécifiquement pour dol_previsionnel (présence de projections ? disclaimer ?)
5. Analyse Section 7 pour déséquilibre (réserves e-commerce mentionnées ?)
6. Analyse Section 8 pour rupture_brutale (durée du préavis, conditions de résiliation)
7. risk_score 0-100 : 100 = plusieurs risques critiques cumulés exposant à la nullité + dommages`
    }]
  }, 'submit_litigation_assessment', LITIGATION_ASSESSMENT_SCHEMA, 2);

  if (!result) {
    return {
      overall_risk: 'MODERE', risk_score: 40, risks: [], coherence_issues: [],
      previsionnel_analysis: { has_projections: false, disclaimer_present: false, risk_level: 'faible', observations: 'Analyse indisponible — réessayez.' },
      recommended_actions: ['Relancez l\'analyse dans quelques instants.']
    };
  }

  return result;
};

module.exports = {
  parseDIPSections, generateDIPFromForm, formulateField, compareDIPVersions, detectChanges,
  generateUpdateSummary, correctSection, correctSectionWithAnswers,
  analyzeDocumentForDIPImpact, generateChangesCertificate, extractDocumentData, DOCUMENT_TYPES,
  parseContractClauses, compareContractVersions, generateContractFromDIP,
  generateContractFromDIPStream, analyzeCrossImpact, assessLitigationRisks,
  correctClause, correctClauseWithAnswers,
  CONTRACT_CLAUSES_DEFAULT, CLAUSE_DIP_SECTION_MAP
};
