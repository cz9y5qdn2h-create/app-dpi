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

GRILLE DE CONFORMITÉ OBLIGATOIRE PAR SECTION (Décret 91-337) :

SECTION 1 — Identité du franchiseur [Réf. Décret art.1 §1]
BLOQUANT si absent : dénomination sociale, forme juridique, numéro RCS + ville, adresse siège, nom du dirigeant responsable
À VÉRIFIER : capital social, date immatriculation

SECTION 2 — Historique dirigeant et enseigne [Réf. Décret art.1 §2]
BLOQUANT si absent : historique professionnel du dirigeant sur 5 ans minimum (exigence légale explicite), date de création de l'enseigne
À VÉRIFIER : parcours détaillé, expériences antérieures dans la franchise

SECTION 3 — État du réseau [Réf. Décret art.1 §3 — jurisprudence Cass. com.]
BLOQUANT si absent : nombre exact de franchisés actifs, nombre exact d'entrées sur 12 mois, nombre exact de sorties sur 12 mois avec motifs (résiliation, non-renouvellement, cession, fermeture volontaire, autre)
À VÉRIFIER : adresses des franchisés ou liste disponible sur demande, nombre d'établissements en propre

SECTION 4 — Comptes annuels [Réf. Décret art.1 §4 — BLOQUANT absolu]
BLOQUANT si absent : résultats des 2 derniers exercices comptables clos (chiffre d'affaires ET résultat net pour chaque exercice), dates de clôture
Les bilans complets peuvent être en annexe mais les chiffres clés doivent figurer dans le DIP.

SECTION 5 — Marque et propriété intellectuelle [Réf. Décret art.1 §5]
BLOQUANT si absent : numéro de dépôt INPI de la marque principale, statut de la marque (déposée/enregistrée)
À VÉRIFIER : date de dépôt, classes de protection, date d'expiration, marques secondaires

SECTION 6 — Informations financières [Réf. Décret art.1 §6 — BLOQUANT absolu]
BLOQUANT si absent : montant du droit d'entrée (ou mention explicite "aucun droit d'entrée"), taux ou montant de la redevance d'exploitation, taux ou montant de la redevance publicitaire (ou "aucune"), estimation de l'investissement global requis
À VÉRIFIER : conditions de paiement détaillées, aides au financement

SECTION 7 — Territoire exclusif [Réf. Décret art.1 §7]
BLOQUANT si absent : définition du périmètre territorial (même si non exclusif, la mention doit être explicite), mention du caractère exclusif ou non
À VÉRIFIER : critères de délimitation précis, conditions de modification

SECTION 8 — Contrat [Réf. Décret art.1 §8 — BLOQUANT absolu]
BLOQUANT si absent : durée du contrat en années, conditions de renouvellement, conditions et motifs de résiliation par chaque partie
À VÉRIFIER : conditions de cession du fonds, droit de préemption, clause de non-concurrence post-contractuelle

SECTION 9 — Litiges [Réf. Décret art.1 §9 — BLOQUANT absolu]
BLOQUANT si absent : TOUTE mention de litiges passés et en cours est obligatoire. Si aucun litige : la phrase "Aucun litige en cours à la date de remise du présent document" ou équivalent doit figurer explicitement. L'absence totale de cette section est un motif régulier d'annulation.
À VÉRIFIER : précision sur la nature des litiges mentionnés

SECTION 10 — Comptes prévisionnels [Réf. Décret art.1 §10]
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
      "legal_reference": "Décret 91-337 art.1 §1"
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
    'Décret 91-337 art.1 §1', 'Décret 91-337 art.1 §2', 'Décret 91-337 art.1 §3',
    'Décret 91-337 art.1 §4', 'Décret 91-337 art.1 §5', 'Décret 91-337 art.1 §6',
    'Décret 91-337 art.1 §7', 'Décret 91-337 art.1 §8', 'Décret 91-337 art.1 §9',
    'Décret 91-337 art.1 §10'
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
- L'articulation entre le DIP (art. L.330-3 Code de commerce) et le contrat de franchise qui lui succède : le DIP doit être remis 20 jours avant la signature du contrat, et toute incohérence entre les deux documents est un motif de nullité ou de mise en jeu de la responsabilité du franchiseur (jurisprudence Cass. com. 26 juin 2024)
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
    model: MODEL_SONNET,
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
    model: MODEL_SONNET,
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

module.exports = {
  parseDIPSections, compareDIPVersions, detectChanges,
  generateUpdateSummary, correctSection, correctSectionWithAnswers,
  analyzeDocumentForDIPImpact, generateChangesCertificate,
  parseContractClauses, compareContractVersions, generateContractFromDIP,
  generateContractFromDIPStream, analyzeCrossImpact,
  CONTRACT_CLAUSES_DEFAULT, CLAUSE_DIP_SECTION_MAP
};
