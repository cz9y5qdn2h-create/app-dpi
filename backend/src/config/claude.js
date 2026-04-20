const Anthropic = require('@anthropic-ai/sdk');

const claude = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY
});

const MODEL = process.env.ANTHROPIC_MODEL || 'claude-sonnet-4-20250514';

/**
 * Analyser et extraire les sections d'un DIP depuis le texte brut
 */
const parseDIPSections = async (rawText) => {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `Tu es un expert juridique en droit de la franchise française. Analyse ce Document d'Information Précontractuelle (DIP) et extrais-en les 10 sections réglementaires.

Pour chaque section, fournis un JSON avec la structure exacte suivante :
{
  "sections": [
    {
      "section_number": 1,
      "section_title": "Identité du franchiseur",
      "content": "contenu extrait",
      "status": "conforme" | "a_verifier" | "non_conforme",
      "issues": ["problème détecté si applicable"]
    }
  ],
  "global_score": 85,
  "summary": "résumé de l'état du DIP"
}

Sections à extraire :
1. Identité du franchiseur (raison sociale, dirigeants, RCS, etc.)
2. Historique de l'enseigne et du dirigeant
3. État du réseau (liste franchisés, ouvertures/fermetures)
4. Comptes annuels (2 derniers exercices)
5. Marque et propriété intellectuelle
6. Informations financières (redevances, droits d'entrée)
7. Territoire exclusif
8. Contrat (durée, renouvellement, résiliation)
9. Litiges en cours et passés
10. Comptes prévisionnels

Texte du DIP à analyser :
${rawText.substring(0, 15000)}

Réponds UNIQUEMENT avec le JSON, sans markdown.`
    }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) throw new Error('Réponse Claude invalide');
  return JSON.parse(jsonMatch[0]);
};

/**
 * Comparer deux versions d'un DIP et retourner les deltas avec recommandations légales
 */
const compareDIPVersions = async (previousText, newText) => {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 8192,
    messages: [{
      role: 'user',
      content: `Tu es un expert juridique en droit de la franchise française, spécialisé dans la Loi Doubin et les Documents d'Information Précontractuelle (DIP).

Compare ces deux versions d'un DIP et identifie tous les changements (deltas) qui nécessitent une mise à jour formelle.

VERSION PRÉCÉDENTE :
${previousText.substring(0, 8000)}

NOUVELLE VERSION :
${newText.substring(0, 8000)}

Pour chaque changement détecté, fournis le JSON suivant :
{
  "changements": [
    {
      "id": "unique_id_1",
      "type": "prix_franchise" | "conditions" | "equipe" | "resultats_financiers" | "reseau" | "litiges" | "contrat" | "territoire" | "marque" | "autre",
      "section": "Nom de la section DIP concernée",
      "section_number": 1,
      "ancien": "valeur ou texte précédent",
      "nouveau": "nouvelle valeur ou texte",
      "impact_legal": "Low" | "Moderate" | "High",
      "recommandation_ia": "Explication légale détaillée — pourquoi ce changement est important, quelles obligations légales il implique selon la Loi Doubin",
      "proposition_texte": "Reformulation légale complète et conforme à intégrer dans le DIP"
    }
  ],
  "resume": "Résumé global des changements détectés",
  "nb_changements_critiques": 0
}

Si aucun changement significatif n'est détecté, retourne { "changements": [], "resume": "Aucun changement significatif détecté", "nb_changements_critiques": 0 }.

Réponds UNIQUEMENT avec le JSON, sans markdown.`
    }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { changements: [], resume: 'Analyse impossible', nb_changements_critiques: 0 };
  return JSON.parse(jsonMatch[0]);
};

/**
 * Détecter les changements entre un document source et une section DIP
 */
const detectChanges = async (sectionContent, newDocumentText, sectionTitle) => {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 2048,
    messages: [{
      role: 'user',
      content: `Tu es un expert en conformité franchise. Compare le contenu actuel d'une section DIP avec un nouveau document source.

Section DIP actuelle - ${sectionTitle} :
${sectionContent}

Nouveau document source :
${newDocumentText.substring(0, 5000)}

Détecte les informations qui ont changé et qui nécessitent une mise à jour du DIP.

Réponds avec ce JSON uniquement :
{
  "has_changes": true/false,
  "changes": [
    {
      "old_value": "ancienne valeur",
      "new_value": "nouvelle valeur",
      "field": "nom du champ concerné",
      "suggestion": "texte suggéré pour la mise à jour"
    }
  ],
  "urgency": "haute" | "moyenne" | "faible"
}`
    }]
  });

  const text = message.content[0].text.trim();
  const jsonMatch = text.match(/\{[\s\S]*\}/);
  if (!jsonMatch) return { has_changes: false, changes: [] };
  return JSON.parse(jsonMatch[0]);
};

/**
 * Générer un résumé des modifications pour notification franchisés
 */
const generateUpdateSummary = async (updatedSections) => {
  const message = await claude.messages.create({
    model: MODEL,
    max_tokens: 1024,
    messages: [{
      role: 'user',
      content: `Rédige un message de notification professionnel et concis en français pour informer les franchisés des mises à jour suivantes du DIP (Document d'Information Précontractuelle) :

${JSON.stringify(updatedSections, null, 2)}

Le message doit être :
- Professionnel et rassurant
- Indiquer les sections modifiées
- Rappeler l'importance de consulter le DIP mis à jour
- Maximum 150 mots

Réponds uniquement avec le texte du message.`
    }]
  });

  return message.content[0].text.trim();
};

module.exports = { parseDIPSections, compareDIPVersions, detectChanges, generateUpdateSummary };
