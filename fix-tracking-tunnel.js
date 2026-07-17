const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');
let ok = 0;

// 1. Import getDocs si absent
const imp1 = "import { doc, getDoc, setDoc, addDoc, collection } from 'firebase/firestore';";
if (!c.includes('getDocs') && c.includes(imp1)) {
  c = c.replace(imp1, "import { doc, getDoc, setDoc, addDoc, collection, getDocs } from 'firebase/firestore';");
  ok++; console.log('1 OK import getDocs');
} else { ok++; console.log('1 SKIP'); }

// 2. Ajouter fonction trackVue apres les imports
const ancreTrack = "const THEMES_TUNNEL = [";
const trackFns = `// ── TRACKING ─────────────────────────────────────────────────────────────────
async function trackVue(db, uid) {
  try {
    const today = new Date().toISOString().slice(0,10);
    const ref = doc(db, 'tunnel_stats', uid, 'jours', today);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {vues:0, leads:0};
    await setDoc(ref, {...data, vues:(data.vues||0)+1, lastVue:Date.now()}, {merge:true});
  } catch {}
}

async function trackLead(db, uid) {
  try {
    const today = new Date().toISOString().slice(0,10);
    const ref = doc(db, 'tunnel_stats', uid, 'jours', today);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {vues:0, leads:0};
    await setDoc(ref, {...data, leads:(data.leads||0)+1}, {merge:true});
  } catch {}
}

`;

if (c.includes('async function trackVue')) { ok++; console.log('2 DEJA'); }
else if (c.includes(ancreTrack)) {
  c = c.replace(ancreTrack, trackFns + ancreTrack);
  ok++; console.log('2 OK fonctions tracking');
} else console.log('2 ECHEC');

// 3. Appeler trackVue dans le useEffect de chargement de la page publique
const ancreLoad = "      setLoading(false);";
const idxLoad = c.lastIndexOf(ancreLoad);
if (c.includes('trackVue(db, uid)')) { ok++; console.log('3 DEJA'); }
else if (idxLoad !== -1) {
  c = c.slice(0, idxLoad) + "      await trackVue(db, uid);\n      " + ancreLoad.trim() + c.slice(idxLoad + ancreLoad.length);
  ok++; console.log('3 OK tracking vue');
} else console.log('3 ECHEC');

// 4. Appeler trackLead quand formulaire soumis
const ancreFormSent = "      setFormSent(true);";
if (c.includes('trackLead(db, uid)')) { ok++; console.log('4 DEJA'); }
else if (c.includes(ancreFormSent)) {
  c = c.replace(ancreFormSent, "      await trackLead(db, uid);\n      setFormSent(true);");
  ok++; console.log('4 OK tracking lead');
} else console.log('4 ECHEC');

// 5. Notification dans l'app quand formulaire soumis
const ancreNotif = "      setFormSent(true);";
const notifCode = `      // Notification interne
      try {
        await setDoc(doc(db, 'notifications_internes', uid + '_lead_' + Date.now()), {
          type: 'nouveau_lead',
          titre: 'Nouveau lead recrutement !',
          message: form.prenom + ' ' + form.nom + ' a rempli ton formulaire de recrutement.',
          email: form.email, tel: form.tel, ts: Date.now(), lu: false,
        }, {merge: true});
      } catch {}
      setFormSent(true);`;

if (c.includes('notifications_internes') && c.includes('nouveau_lead')) { ok++; console.log('5 DEJA'); }
else if (c.includes(ancreFormSent)) {
  c = c.replace(ancreFormSent, notifCode);
  ok++; console.log('5 OK notification interne');
} else console.log('5 ECHEC');

fs.writeFileSync(f, c, 'utf8');
console.log('\n=== ' + ok + '/5 ===');