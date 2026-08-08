// Détecte les marqueurs que l'IA insère elle-même dans une section/clause
// quand une donnée manquante l'empêche de rédiger un texte complet (voir
// claude.js : "[À COMPLÉTER : ...]" dans les corrections guidées par
// questions, "Non renseigné — à compléter avant remise" dans la génération
// depuis formulaire). Jusqu'ici rien ne surveillait leur présence une fois
// le contenu enregistré — un franchiseur pouvait sauvegarder une section
// avec un placeholder resté en l'état, sans jamais en être alerté.
const INCOMPLETE_MARKERS = [
  // Crochets obligatoires : sans eux, ça matcherait n'importe quelle phrase
  // légitime contenant "à compléter" (ex: "clause à compléter par avenant").
  /\[À COMPLÉTER[^\]]*\]/i,
  /Non renseigné\s*—\s*à compléter avant remise/i,
];

function findIncompleteMarker(content) {
  if (!content) return null;
  for (const re of INCOMPLETE_MARKERS) {
    const m = content.match(re);
    if (m) return m[0];
  }
  return null;
}

module.exports = { findIncompleteMarker };
