const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

// 1. Supprimer l'avertissement du message
c = c.replace(
  '+ "⚠️ Clique bien sur le lien ci-dessus\\n"\n      + "(pas sur le premier apercu qui apparait)\\n\\n"\n      + "🌿 Blazing Dynasty x Mihi France";',
  '+ "🌿 Blazing Dynasty x Mihi France";'
);
console.log('1 OK - avertissement supprime');

// 2. Remplacer navigator.clipboard par une methode plus robuste sur mobile
c = c.replace(
  'navigator.clipboard.writeText(msg);\n    showNotif(\'Message copie',
  `try {
      await navigator.clipboard.writeText(msg);
    } catch {
      // Fallback mobile
      const ta = document.createElement('textarea');
      ta.value = msg;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.focus();
      ta.select();
      document.execCommand('copy');
      document.body.removeChild(ta);
    }
    showNotif('Message copie`
);
console.log('2 OK - clipboard robuste');

// 3. Corriger lienPublic pour utiliser le format court /r/
c = c.replace(
  "const lienPublic = window.location.origin + '?recrutement=' + slug;",
  "const