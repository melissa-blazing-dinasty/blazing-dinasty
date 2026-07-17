// fix-bitly.js
// Ajoute la generation de liens Bitly dans DiagnosticsTab.js et TunnelRecrutementTab.jsx
// node fix-bitly.js

const fs = require('fs');
let ok = 0;

// ── 1. DiagnosticsTab.js — fonction raccourcir lien ──────────────────────────
const fD = 'src/DiagnosticsTab.js';
let cD = fs.readFileSync(fD, 'utf8');
fs.writeFileSync(fD + '.bak-bitly', cD, 'utf8');

const bitlyFn = `
// ── BITLY ────────────────────────────────────────────────────────────────────
async function raccourcirLien(lien, bitlyToken) {
  if (!bitlyToken) return lien;
  try {
    const resp = await fetch('https://api-ssl.bitly.com/v4/shorten', {
      method: 'POST',
      headers: { 'Authorization': 'Bearer ' + bitlyToken, 'Content-Type': 'application/json' },
      body: JSON.stringify({ long_url: lien, domain: 'bit.ly' })
    });
    const data = await resp.json();
    return data.link || lien;
  } catch { return lien; }
}

`;

const ancreD = "async function genererDiagBusiness(";
if (cD.includes('raccourcirLien')) { ok++; console.log('1 DEJA'); }
else if (cD.includes(ancreD)) {
  cD = cD.replace(ancreD, bitlyFn + ancreD);
  ok++; console.log('1 OK - fonction raccourcirLien');
} else console.log('1 ECHEC');

// Modifier copierLienDirect pour utiliser Bitly
const ancreMsg = "  function copierLienDirect(diagType, labelCustom) {";
const nouveauMsg = `  async function copierLienDirect(diagType, labelCustom) {
    let bitlyToken = '';
    try {
      const snap = await getDoc(doc(db, 'admin', 'config'));
      if (snap.exists()) bitlyToken = snap.data().bitlyToken || '';
    } catch {}`;

if (cD.includes('async function copierLienDirect')) { ok++; console.log('2 DEJA'); }
else if (cD.includes(ancreMsg)) {
  cD = cD.replace(ancreMsg, nouveauMsg);
  // Raccourcir le lien avant de construire le message
  const ancreRacc = "    const lien = `https://blazing-dinasty-1fad9.web.app/d/${uid}?diag=${diagType}&client=${encodeURIComponent(nomClient||\"\")}`;";
  cD = cD.replace(ancreRacc, ancreRacc + "\n    const lienCourt = await raccourcirLien(lien, bitlyToken);");
  // Utiliser lienCourt dans le message
  cD = cD.replace(
    '"➡️ "+lien+"\\n\\n"',
    '"➡️ "+lienCourt+"\\n\\n"'
  );
  ok++; console.log('2 OK - copierLienDirect async + Bitly');
} else console.log('2 ECHEC');

fs.writeFileSync(fD, cD, 'utf8');
console.log('=== DiagnosticsTab: ' + ok + '/2 ===');

// ── 2. TunnelRecrutementTab.jsx — copyLink avec Bitly ────────────────────────
const fT = 'src/TunnelRecrutementTab.jsx';
let cT = fs.readFileSync(fT, 'utf8');
fs.writeFileSync(fT + '.bak-bitly', cT, 'utf8');

const ancreT = "  const copyLink = () => {";
const nouveauT = `  const copyLink = async () => {
    let bitlyToken = '';
    try {
      const snap = await getDoc(doc(db, 'admin', 'config'));
      if (snap.exists()) bitlyToken = snap.data().bitlyToken || '';
    } catch {}
    let lienCourt = lienPublic;
    if (bitlyToken) {
      try {
        const resp = await fetch('https://api-ssl.bitly.com/v4/shorten', {
          method: 'POST',
          headers: { 'Authorization': 'Bearer ' + bitlyToken, 'Content-Type': 'application/json' },
          body: JSON.stringify({ long_url: lienPublic, domain: 'bit.ly' })
        });
        const data = await resp.json();
        if (data.link) lienCourt = data.link;
      } catch {}
    }`;

if (cT.includes('async () => {\n    let bitlyToken')) { ok++; console.log('3 DEJA'); }
else if (cT.includes(ancreT)) {
  // Remplacer la fonction copyLink
  const finCopyLink = "    showNotif('Message copie ! Colle-le dans Messenger 💬');\n  };";
  const idx1 = cT.indexOf(ancreT);
  const idx2 = cT.indexOf(finCopyLink, idx1) + finCopyLink.length;
  const nouvelleFn = nouveauT + `
    const msg = "🔥✨ Une opportunite business rien que pour toi ! ✨🔥\\n\\n"
      + "💰 Boutique gratuite · 20-30% commission · 100% flexible\\n\\n"
      + "👇👇 DECOUVRE ICI 👇👇\\n"
      + "➡️ " + lienCourt + "\\n\\n"
      + "⚠️ Clique bien sur le lien ci-dessus\\n"
      + "(pas sur le premier apercu qui apparait)\\n\\n"
      + "🌿 Blazing Dynasty x Mihi France";
    navigator.clipboard.writeText(msg);
    showNotif('Message copie ! Colle-le dans Messenger 💬');
  };`;
  cT = cT.slice(0, idx1) + nouvelleFn + cT.slice(idx2);
  fs.writeFileSync(fT, cT, 'utf8');
  ok++; console.log('3 OK - copyLink avec Bitly');
} else console.log('3 ECHEC');

console.log('\n=== TOTAL: ' + ok + '/3 ===');
