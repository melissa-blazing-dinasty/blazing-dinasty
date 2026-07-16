const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let lines = fs.readFileSync(f, 'utf8').split('\n');

const etapes = `      const ETAPES_DECOUVERTE = [
        {titre:"Bienvenue dans ton Tunnel !", texte:"Ce tunnel est une page publique que tu partages a des prospects. Elle leur presente l'opportunite Mihi et les incite a te contacter.", icon:"🎯"},
        {titre:"Configure ton accroche", texte:"Personnalise le titre et le sous-titre qui apparaissent en haut de ta page. Parle directement aux femmes qui cherchent un complement de revenus.", icon:"✍️"},
        {titre:"Ajoute des offres cadeaux", texte:"Si tu as des tokens actifs (Boutique → Tokens cadeaux), ils s'affichent avec un compte a rebours pour creer l'urgence.", icon:"🎁"},
        {titre:"Ta boutique en ligne", texte:"Si tu as cree ta boutique Blazing Dynasty, active ce bouton pour que tes prospects voient tes produits avant de rejoindre l'equipe.", icon:"🛍️"},
        {titre:"Les temoignages revenus", texte:"Remplace les prenoms et montants par des vraies personnes de ton equipe. Des chiffres reels convainquent bien mieux.", icon:"💰"},
        {titre:"Ton lien d'inscription Mihi", texte:"Colle ton lien de parrainage Mihi. Il apparaitra pour les prospects deja convaincus qui veulent s'inscrire directement.", icon:"🔗"},
        {titre:"Partage ton lien partout !", texte:"Copie ton lien tunnel et partage-le en story, en post, en DM, dans ta bio. Plus tu le partages, plus tu attires de recrues.", icon:"🚀"},
      ];`;

// Inserer avant la ligne 139 (index 139)
lines.splice(139, 0, etapes);

fs.writeFileSync(f, lines.join('\n'), 'utf8');
console.log('OK - ETAPES_DECOUVERTE ajoute ligne 139');