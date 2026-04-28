const Anthropic = require('@anthropic-ai/sdk');

const claude = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
const MODEL = process.env.ANTHROPIC_MODEL || 'claude-haiku-4-5-20251001';

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

/**
 * Analyser et extraire les 10 sections réglementaires d'un DIP
 */
const parseDIPSections = async (rawText) => {
  if (!rawText || rawText.trim().length < 50) {
    throw new Error('Le texte extrait du fichier est trop court. Vérifiez que le PDF n\'est pas scanné ou protégé.');
  }

  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_DIP_EXPERT,
    messages: [{
      role: 'user',
      content: `Analyse ce DIP et extrais les 10 sections réglementaires obligatoires selon la Loi Doubin.

TEXTE DU DIP :
${rawText.substring(0, 18000)}

INSTRUCTIONS :
- Extrais le contenu réel de chaque section depuis le document
- Évalue le statut de conformité selon les critères ci-dessous
- Si une section est absente ou incomplète, note-le dans "issues"

CRITÈRES DE CONFORMITÉ PAR SECTION :
1. Identité du franchiseur → conforme si : raison sociale, forme juridique, capital, RCS, siège, dirigeants présents
2. Historique enseigne/dirigeant → conforme si : date création, parcours dirigeant (5 ans min), historique enseigne
3. État du réseau → conforme si : liste franchisés avec adresses, ouvertures/fermetures sur 12 mois
4. Comptes annuels → conforme si : 2 derniers exercices comptables complets fournis
5. Marque/PI → conforme si : numéro dépôt INPI, date, territoire, validité mentionnés
6. Informations financières → conforme si : droits d'entrée, redevances, conditions paiement explicites
7. Territoire exclusif → conforme si : zone géographique définie et exclusive clairement
8. Contrat → conforme si : durée, conditions renouvellement, résiliation/cession détaillées
9. Litiges → conforme si : mention explicite litiges passés et en cours (ou attestation d'absence)
10. Comptes prévisionnels → conforme si : projections financières sur 3 ans avec hypothèses

Retourne ce JSON exactement :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "Texte extrait du document pour cette section (verbatim si possible)",
      "status": "conforme",
      "issues": []
    }
  ],
  "global_score": 75,
  "summary": "Résumé de l'état global du DIP : points forts, lacunes principales, risques juridiques"
}

Valeurs possibles pour status : "conforme" | "a_verifier" | "non_conforme"
global_score : entier entre 0 et 100 basé sur le nombre de sections conformes et leur qualité`
    }]
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) throw new Error('L\'IA n\'a pas retourné de JSON valide. Réessayez.');

  const result = JSON.parse(match[0]);

  // Garantir que toutes les sections existent même si l'IA en a oublié
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

  if (!result.sections || result.sections.length < 10) {
    const existing = new Set((result.sections || []).map(s => s.section_number));
    for (let i = 1; i <= 10; i++) {
      if (!existing.has(i)) {
        result.sections.push({
          section_number: i,
          section_title: SECTIONS_DEFAULT[i - 1],
          content: 'Section non trouvée dans le document',
          status: 'non_conforme',
          issues: ['Section obligatoire absente du DIP — non conforme Loi Doubin']
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

/**
 * Comparer deux versions d'un DIP — détecter les changements à valider légalement
 */
const compareDIPVersions = async (previousText, newText) => {
  if (!previousText || !newText) {
    return { changements: [], resume: 'Texte manquant pour la comparaison', nb_changements_critiques: 0 };
  }

  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 8192,
    system: SYSTEM_DIP_EXPERT,
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

Retourne ce JSON exactement :
{
  "changements": [
    {
      "id": "chgt_1",
      "type": "prix_franchise",
      "section": "Informations financières",
      "section_number": 6,
      "ancien": "Droit d'entrée : 15 000 €",
      "nouveau": "Droit d'entrée : 18 000 €",
      "impact_legal": "High",
      "recommandation_ia": "La modification du droit d'entrée est une information substantielle au sens de l'article L.330-3. Ce changement doit être communiqué à tous les candidats franchisés au moins 20 jours avant la signature du contrat. Un nouveau DIP doit être remis.",
      "proposition_texte": "Droit d'entrée : 18 000 € HT, payable à la signature du contrat de franchise. Ce montant couvre l'accès au savoir-faire, la formation initiale de X jours et l'assistance au démarrage."
    }
  ],
  "resume": "Résumé synthétique des changements : nombre, nature, urgence et impact global sur la conformité du DIP",
  "nb_changements_critiques": 1
}

Si aucun changement significatif : { "changements": [], "resume": "Aucun changement substantiel détecté entre les deux versions.", "nb_changements_critiques": 0 }`
    }]
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { changements: [], resume: 'Analyse incomplète — réessayez', nb_changements_critiques: 0 };

  const result = JSON.parse(match[0]);

  // Garantir des IDs uniques
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
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 2048,
    system: SYSTEM_DIP_EXPERT,
    messages: [{
      role: 'user',
      content: `Compare la section DIP existante avec un nouveau document source et détecte les mises à jour nécessaires.

SECTION DIP ACTUELLE — ${sectionTitle} :
${sectionContent}

NOUVEAU DOCUMENT SOURCE :
${newDocumentText.substring(0, 5000)}

Retourne ce JSON :
{
  "has_changes": true,
  "changes": [
    {
      "field": "Nom du champ modifié",
      "old_value": "Ancienne valeur",
      "new_value": "Nouvelle valeur",
      "suggestion": "Texte de remplacement conforme Loi Doubin"
    }
  ],
  "urgency": "haute"
}`
    }]
  });

  const raw = message.content[0].text.trim();
  const match = raw.match(/\{[\s\S]*\}/);
  if (!match) return { has_changes: false, changes: [] };
  return JSON.parse(match[0]);
};

/**
 * Générer un message de notification pour les franchisés
 */
const generateUpdateSummary = async (updatedSections) => {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    system: 'Tu es un expert en communication juridique franchise. Tu rédiges des messages clairs, professionnels et rasssurants.',
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

  return message.content[0].text.trim();
};

module.exports = { parseDIPSections, compareDIPVersions, detectChanges, generateUpdateSummary };
