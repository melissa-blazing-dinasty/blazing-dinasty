const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancien = `        const snapPub = await getDoc(doc(db, 'contacts_publics', slug));
        const uid = snapPub.exists() ? (snapPub.data().uid || slug) : slug;
        const snapCfg = await getDoc(doc(db, 'tunnel_recrutement', uid));
        if (snapCfg.exists()) {
          const data = snapCfg.data();
          const qualiBonnes = data.temoignagesQuali && data.temoignagesQuali[0] && data.temoignagesQuali[0].auteur && data.temoignagesQuali[0].auteur.includes('Eva');
          setCfg({...data, temoignagesQuali: qualiBonnes ? data.temoignagesQuali : TEMOIGNAGES_QUALI_DEFAULT});
        } else {
          setCfg({ titreAccroche: '', actif: true, nbPersonnesRejointes: 0, nbPlacesRestantes: 0 });
        }
        const snapTok = await getDoc(doc(db, 'tokens_cadeaux', uid));
        if (snapTok.exists()) setTokens((snapTok.data().tokens || []).filter(t => !t.utilise));
        const snapLink = await getDoc(doc(db, 'linkbio', uid));
        if (snapLink.exists()) { setPhoto(snapLink.data().photo || ''); setPrenom(snapLink.data().prenom || ''); setThemeId(snapLink.data().theme || 'rose_gold'); }`;

const nouveau = `        // Resoudre uid depuis linkbio (meme logique que LinkBioPublicPage)
        const snapLink = await getDoc(doc(db, 'linkbio', slug));
        let uid = slug;
        if (snapLink.exists()) {
          const linkData = snapLink.data();
          uid = linkData.uid || slug;
          setPhoto(linkData.photo || '');
          setPrenom(linkData.prenom || '');
          setThemeId(linkData.theme || 'rose_gold');
        } else {
          // Fallback contacts_publics
          const snapPub = await getDoc(doc(db, 'contacts_publics', slug));
          if (snapPub.exists()) uid = snapPub.data().uid || slug;
          const snapLink2 = await getDoc(doc(db, 'linkbio', uid));
          if (snapLink2.exists()) { setPhoto(snapLink2.data().photo || ''); setPrenom(snapLink2.data().prenom || ''); setThemeId(snapLink2.data().theme || 'rose_gold'); }
        }
        const snapCfg = await getDoc(doc(db, 'tunnel_recrutement', uid));
        if (snapCfg.exists()) {
          const data = snapCfg.data();
          const qualiBonnes = data.temoignagesQuali && data.temoignagesQuali[0] && data.temoignagesQuali[0].auteur && data.temoignagesQuali[0].auteur.includes('Eva');
          setCfg({...data, temoignagesQuali: qualiBonnes ? data.temoignagesQuali : TEMOIGNAGES_QUALI_DEFAULT});
        } else {
          setCfg({ titreAccroche: '', actif: true, nbPersonnesRejointes: 0, nbPlacesRestantes: 0 });
        }
        const snapTok = await getDoc(doc(db, 'tokens_cadeaux', uid));
        if (snapTok.exists()) setTokens((snapTok.data().tokens || []).filter(t => !t.utilise));`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - resolution slug via linkbio');
} else {
  console.log('ECHEC - ancre introuvable');
}