const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

// Supprimer les lignes ajoutees par erreur (139-148)
// Chercher et supprimer le const ETAPES_DECOUVERTE mal place
let debut = -1, fin = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('const ETAPES_DECOUVERTE') && lines[i-1] && lines[i-1].includes('</div>')) { debut = i; }
  if (debut !== -1 && lines[i].includes('];') && i > debut) { fin = i; break; }
}
if (debut !== -1 && fin !== -1) {
  lines.splice(debut, fin - debut + 1);
  console.log('Supprime lignes ' + debut + ' a ' + fin);
}

// Retrouver la ligne du showDecouverte return
let idxReturn = -1;
for (let i = 0; i < lines.length; i++) {
  if (lines[i].includes('if (showDecouverte) return')) { idxReturn = i; break; }
}

const etapes = `  const ETAPES_DECOUVERTE = [
    {titre:"Bienvenue dans ton Tunnel !", texte:"Ce tunnel est une page publique que tu partages a des prospects. Elle leur presente l'opportunite Mihi et les incite a te contacter.", icon:"🎯"},
    {titre:"Configure ton accroche", texte:"Personnalise le titre et le sous-titre qui apparaissent en haut de ta page. Parle directement aux femmes qui cherchent un complement de revenus.", icon:"✍️"},
    {titre:"Ajoute des offres cadeaux", texte:"Si tu as des tokens actifs (Boutique → Tokens cadeaux), ils s'affichent avec un compte a rebours pour creer l'urgence.", icon:"🎁"},
    {titre:"Ta boutique en ligne", texte:"Si tu as cree ta boutique Blazing Dynasty, active ce bouton pour que tes prospects voient tes produits avant de rejoindre l'equipe.", icon:"🛍️"},
    {titre:"Les temoignages revenus", texte:"Remplace les prenoms et montants par des vraies personnes de ton equipe. Des chiffres reels convainquent bien mieux.", icon:"💰"},
    {titre:"Ton lien d inscription Mihi", texte:"Colle ton lien de parrainage Mihi. Il apparaitra pour les prospects deja convaincus qui veulent s'inscrire directement.", icon:"🔗"},
    {titre:"Partage ton lien partout !", texte:"Copie ton lien tunnel et partage-le en story, en post, en DM, dans ta bio. Plus tu le partages, plus tu attires de recrues.", icon:"🚀"},
  ];`;

if (idxReturn !== -1) {
  lines.splice(idxReturn, 0, etapes);
  console.log('OK - ETAPES insere avant ligne ' + idxReturn);
} else {
  console.log('ECHEC - showDecouverte return introuvable');
}

fs.writeFileSync(f, lines.join('\n'), 'utf8');