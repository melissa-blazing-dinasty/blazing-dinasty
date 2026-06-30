import { useState, useCallback, useEffect, createContext, useContext } from 'react';
import { initializeApp } from 'firebase/app';
import { getFirestore, doc, getDoc, setDoc, getDocs, collection, query, where } from "firebase/firestore";
import { getStorage, ref as storageRef, uploadBytes, getDownloadURL } from "firebase/storage";
import { getMessaging, getToken, onMessage } from "firebase/messaging";
import { DiagnosticsTab, DiagResultsTab, DiagnosticParfumTab, LinkBioPublicPage, TunnelHybridePage, RecommandationPubliquePage, FormationAppTab, EntonnoirTab, FORMATION_APP_CATEGORIES, FORMATION_APP_CATEGORIES_DEFAULT } from './DiagnosticsTab';
import { FicheClienteCard, ClientsRelanceTab, ClientsTab, DistributeursTab, RelancesTab, LiensReseauxSection, MELISSA } from './ClientsTab';
import { CommunauteTab } from './CommunauteTab';
import { EditorialTab } from './EditorialTab';
import { CalendrierTab } from './CalendrierTab';
import { LinkBioTab } from './LinkBioTab';
import { AdminLinkBioSection } from './EspaceChefTab';
import { TunnelTab } from './TunnelTab';
import { DreamBoardWidget, DreamBoardTab } from './DreamBoardTab';
import { FormationProduitsTab, AdminFormationProduits, UploadPhoto, CATEGORIES_PRODUITS } from './FormationProduitsTab';
import { DashboardTab } from './DashboardTab';
import { ObjectionBubbles, ObjectionsTab, ScriptsTab } from './ScriptsTab';
import { FastStartTab } from './FastStartTab';
import { ObjectifsTab } from './ObjectifsTab';
import { AssistanteIATab } from './AssistanteIATab';
import { buildEquipeTree, countEquipe, getLigneeChefs, countEquipeSafe, SearchSelect, todayLocalDate, todayLocalStr, BoutonMiseAJour, useLang, useTranslation, useTranslatedContent, useTranslatedProduit, T, Btn, YTBtn, DriveBtn, DocBtn, Card, Info, Tag, SecTitle, LangContext, UI_TEXTS, UI_TEXTS_PT, domOriginals, translateDOM, translateBatch, seedAnnuaireFromMembres, APP_VERSION, C } from './components';
// ── FIREBASE ──────────────────────────────────────────────────────────────────
const firebaseConfig = {
  apiKey: "AIzaSyBhsxeZe7JvliHh3kBRgRKSKA2XSiAUg9k",
  authDomain: "blazing-dinasty-1fad9.firebaseapp.com",
  projectId: "blazing-dinasty-1fad9",
  storageBucket: "blazing-dinasty-1fad9.firebasestorage.app",
  messagingSenderId: "499869328828",
  appId: "1:499869328828:web:28900482512a07ca3a77b9",
};
const fbApp = initializeApp(firebaseConfig);
const db = getFirestore(fbApp);
const storage = getStorage(fbApp);
let messaging = null;
try { messaging = getMessaging(fbApp); } catch {}

async function saveFCMToken(uid) {
  if (!messaging) return;
  try {
    const permission = await Notification.requestPermission();
    if (permission !== "granted") return;
    const token = await getToken(messaging, {
      vapidKey: "BFI7Uodh64p0EnejAc9xQ6y0hOS0w4CVA2QO-3mCxFmcm13orUtX7mYDwSRuaS8iDs8ovcClbKj2j2JzMi47sRE"
    });
    if (token) {
      await setDoc(doc(db, "fcm_tokens", uid), { token, uid, updatedAt: Date.now() });
    }
  } catch {}
}

// ── STORAGE (Firebase Firestore) ──────────────────────────────────────────────
export async function sg(uid, k) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    if (snap.exists()) {
      const data = snap.data();
      return data[k] !== undefined ? data[k] : null;
    }
    return null;
  } catch { return null; }
}

export async function ss(uid, k, v) {
  try {
    const ref = doc(db, "users", uid);
    await setDoc(ref, { [k]: v }, { merge: true });
  } catch {}
}

// Charge toutes les données d'un utilisateur en une seule requête
export async function sgAll(uid) {
  try {
    const ref = doc(db, "users", uid);
    const snap = await getDoc(ref);
    return snap.exists() ? snap.data() : {};
  } catch { return {}; }
}

// Met à jour la fiche d'un membre dans l'annuaire global (équipe/annuaire)
export async function syncAnnuaire(uid, displayName, objPerso, marraineUid){
  try{
    const ref = doc(db,"equipe","annuaire");
    const [prenom, ...rest] = (displayName||"").split(" ");
    const entry = {
      uid,
      prenom: prenom||"",
      nom: rest.join(" ")||"",
      palier: objPerso?.palier||"2%",
      ca: objPerso?.ca||"",
      caPerso: objPerso?.caPerso||"",
      caObj: objPerso?.caObj||"",
      recruesReal: objPerso?.recruesReal||"0",
      recruesObj: objPerso?.recruesObj||"0",
      lastActive: Date.now(),
    };
    const snap = await getDoc(ref);
    const existing = snap.exists() && snap.data().membres ? snap.data().membres : {};
    entry.dateEnreg = existing[uid]?.dateEnreg || todayLocalStr();
    if(existing[uid]?.notes) entry.notes = existing[uid].notes;
    // Marraine : utilise la nouvelle valeur si fournie, sinon conserve l'existante
    if(marraineUid) entry.marraine = marraineUid;
    else if(existing[uid]?.marraine) entry.marraine = existing[uid].marraine;
    await setDoc(ref, {membres: {...existing, [uid]: entry}}, {merge:true});
  }catch{}
}


// Construit récursivement l'arbre des filleules (recrues directes et indirectes) d'un membre
export function CopyBtn({text}){
  const[c,setC]=useState(false);
  return <button onClick={()=>{navigator.clipboard.writeText(text);setC(true);setTimeout(()=>setC(false),2000);}}
    style={{fontSize:".55rem",padding:".15rem .45rem",border:`1px solid ${c?C.vert:C.pale}`,borderRadius:5,background:"none",color:c?C.vert:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>{c?"✓":"Copier"}</button>;
}

// ── POST IDEAS DATA ───────────────────────────────────────────────────────────
const POST_IDEAS = [
  {theme:"💄 Make-up & Beauté", color:C.rose, posts:[
    {id:"p1",hook:"On m'a encore demandé \"c'est quoi ton parfum ?\"",caption:"Plot twist → moins de 20€ et on me fait des compliments NON-STOP. Tu veux savoir lequel ? Écris PARFUM en commentaire 😏"},
    {id:"p2",hook:"Makeup du jour : rapide, naturel, pas besoin de 15 produits",caption:"J'utilise une mini routine makeup que je recommande souvent aux mamans pressées. Tu veux la liste des produits exacts ? Commente MAKEUP 💄"},
    {id:"p3",hook:"Toi aussi tu adores les rouges à lèvres pigmentés qui tiennent longtemps ?",caption:"Alors je pense que comme moi tu vas adorer ces petites pépites !! Tape PÉPITES je te réserve une belle surprise ❤️"},
    {id:"p4",hook:"⏰ 5 minutes. C'est le temps que je mets pour ma routine (vraiment).",caption:"Skincare + touche de makeup + parfum. Tu veux ma routine express et les produits exacts ? Écris 5MIN 💕"},
    {id:"p5",hook:"Makeup qui tient toute la journée même avec un masque ?",caption:"Oui ça existe 😂 Je vous montre ma technique en story ce soir. Restez connectées 👀"},
  ]},
  {theme:"🌿 Skincare & Soin", color:C.lilas, posts:[
    {id:"p6",hook:"💭 On parle souvent de skincare hors de prix… J'ai une routine visage SIMPLE à moins de 25€",caption:"Rien de compliqué. Rien de gadget. Juste ce qu'il faut pour une peau propre, nette et confortable. Tu veux la liste exacte ? Dis-le moi en commentaire 👇"},
    {id:"p7",hook:"On pense souvent que pour que ça marche… il faut que ce soit cher. Faux.",caption:"J'utilise des produits beaucoup plus accessibles et les résultats sont là. Tu veux voir ce que j'utilise vraiment ? Écris LISTE en commentaire."},
    {id:"p8",hook:"Prendre soin de soi ≠ se ruiner.",caption:"J'ai construit une routine complète soin + bien-être, accessible et rapide. Tu veux la liste détaillée ? Dis MOI 👇"},
    {id:"p9",hook:"Le problème ce n'est pas toi. C'est juste que ta peau n'a pas la bonne routine.",caption:"Même peau, même personne. La seule différence ? Une routine adaptée à 25€. Résultat : teint unifié, peau hydratée. Tu veux la routine ? Écris ROUTINE 👇"},
  ]},
  {theme:"💆 Bien-être & Énergie", color:C.or, posts:[
    {id:"p10",hook:"Non, je ne prends pas 12 compléments par jour.",caption:"J'ai une routine ultra simple pour l'énergie, le bien-être, me sentir mieux au quotidien. Tu veux savoir ce que je prends exactement ? Écris ROUTINE en commentaire."},
    {id:"p11",hook:"Tu te lèves fatiguée même après 8h de sommeil ?",caption:"J'étais pareille. Un truc m'a changé la vie et c'est pas du café 😂 Écris ÉNERGIE je t'explique tout 👇"},
    {id:"p12",hook:"Ventre gonflé, digestion difficile, fatigue chronique…",caption:"C'est pas une fatalité. J'ai trouvé une solution naturelle et ça m'a transformée. Qui veut en savoir plus ? 👋"},
  ]},
  {theme:"💰 Opportunité & Liberté", color:C.brun, posts:[
    {id:"p13",hook:"Je ne cherchais pas un 2ème emploi. Je cherchais quelque chose qui s'adapte à ma vie.",caption:"Aujourd'hui je travaille depuis mon canapé pendant que mes enfants dorment. Et je ne l'ai jamais regretté. Tu veux savoir comment ? Écris LIBERTÉ en commentaire 🖤"},
    {id:"p14",hook:"Mardi 15h. Je récupère mon enfant à l'école.",caption:"Pas de congés posés. Pas de permission demandée. Juste... ma vie. C'est ça que j'ai construit avec Blazing Dynasty 🖤"},
    {id:"p15",hook:"Belle journée qui commence ☀️ Appel équipe dans 1h.",caption:"J'adore ce que je fais parce que ça me ressemble. Tu es curieuse de savoir comment ? Réponds à ce message 🙂"},
    {id:"p16",hook:"La semaine a été productive 🖤",caption:"Je vous explique bientôt ce qu'il se passe dans les coulisses... Restez connectées 👀"},
    {id:"p17",hook:"On m'a demandé aujourd'hui combien je gagnais avec \"ça\".",caption:"J'ai répondu : assez pour ne plus avoir à demander de congés. Qui veut en savoir plus ? Écris ÉQUIPE en commentaire 🔥"},
  ]},
  {theme:"🌸 Storytelling & Vie perso", color:C.rose, posts:[
    {id:"p18",hook:"Il y a [X mois], j'ai pris une décision qui m'a fait peur.",caption:"Aujourd'hui je ne l'ai pas regrettée une seule fois. [Continue ton histoire authentiquement. Partage tes doutes, ta décision, où tu en es aujourd'hui.]"},
    {id:"p19",hook:"Ce que personne ne voit derrière mes posts.",caption:"Les galères, les doutes, les jours où j'avais envie d'arrêter. Je vous raconte tout parce que vous méritez la vérité, pas juste les moments parfaits."},
    {id:"p20",hook:"J'aurais aimé que quelqu'un me dise ça quand j'ai commencé.",caption:"[Partage un conseil clé que tu aurais aimé avoir. Ton expérience terrain est ton meilleur contenu.]"},
  ]},
  {theme:"🔑 Recrutement détourné", color:C.lilas, posts:[
    {id:"p21",hook:"Tu cherches un complément de revenu sans sacrifier ta famille ?",caption:"Je construis une équipe de femmes ambitieuses. Pas de stock, pas de porte-à-porte. Juste du sérieux et une vraie méthode. Écris ÉQUIPE si tu veux en savoir plus 🖤"},
    {id:"p22",hook:"3 choses que j'aurais voulu savoir avant de commencer.",caption:"1. C'est du vrai travail. 2. Ça vaut vraiment le coup. 3. Tu n'es pas seule. C'est ça Blazing Dynasty. Curiosité ? Réponds à ce message 🙂"},
    {id:"p23",hook:"Ce mois-ci j'ai gagné [montant] en travaillant depuis chez moi.",caption:"Sans boss. Sans horaires fixes. Sans sacrifier ma famille. Si tu veux comprendre comment — écris MOI en commentaire."},
  ]},
  {theme:"✨ Face Architect", color:"#9B7FA8", posts:[
    {id:"p24",hook:"Mes rides ont l'air de disparaître... et non c'est pas du filtre 😮",caption:"Le sérum que j'utilise fait vraiment la différence. C'est la gamme Face Architect de Mihi. Tu veux que je t'explique comment ça marche ? Commente VISAGE 👇"},
    {id:"p25",hook:"47 ans et on me donne 35. Mon secret en 3 produits.",caption:"Crème ExoLifting + sérum Spicule + soin contour des yeux. Moins de 80€ les 3. Tu veux les détails ? Écris ANTIAGE en commentaire ✨"},
  ]},
  {theme:"💇 Hair Architect", color:C.or, posts:[
    {id:"p26",hook:"Tes cheveux font la tête ? Secs, cassants ou carrément ternes ?",caption:"Et si je te disais qu'avec seulement 25€, tu peux leur redonner vie et brillance comme en sortant de chez le coiffeur ? Commente CHEVEUX en dessous ! 👇"},
    {id:"p27",hook:"J'ai arrêté de dépenser une fortune chez le coiffeur.",caption:"J'ai trouvé une routine capillaire qui coûte moins de 30€ et mes cheveux n'ont jamais été aussi beaux. Tu veux le nom des produits ? Écris CHEVEUX 💛"},
  ]},
];

// ── SPRINT DATA ───────────────────────────────────────────────────────────────
const SPRINT=[
  {day:1,title:"Préparer le terrain",goal:"Profil optimisé + liste des 20",focus:"rs",tasks:[
    {id:"s1a",label:"Optimiser ta bio (photo + description + lien)"},
    {id:"s1b",label:"Poster une story d'énergie — pas de pitch"},
    {id:"s1c",label:"Écrire et classer ta liste des 20 contacts"},
    {id:"s1d",label:"Liker 10 publications de ta cible",script:'"Cette semaine je me fixe un défi. Je vous tiens au courant 🔥"'},
  ]},
  {day:2,title:"Premiers contacts chauds",goal:"3 messages + 1 conversation",focus:"bao",tasks:[
    {id:"s2a",label:'3 messages WhatsApp personnels aux contacts "Chauds"',script:'"Coucou [Prénom], je pense à toi. Je développe quelque chose qui te correspondrait peut-être. 3 min à regarder ? 🙂"'},
    {id:"s2b",label:"Story vie quotidienne sans pitch"},
    {id:"s2c",label:"Répondre à toutes les réactions en DM"},
  ]},
  {day:3,title:"Contenu d'attraction",goal:"1 Reel publié + réponses mot-clé",focus:"rs",tasks:[
    {id:"s3a",label:"Créer et publier un Reel avec CTA mot-clé",script:'"Je ne cherchais pas un 2ᵉ emploi. Je cherchais quelque chose qui s\'adapte à ma vie. Écris ÉQUIPE en commentaire 🖤"'},
    {id:"s3b",label:"DM à chaque personne qui répond avec le mot-clé"},
    {id:"s3c",label:'Relancer 1–2 personnes sans réponse hier',script:'"Coucou ! Pas de souci si tu es occupée — je te laisse regarder quand t\'as 5 min 🙂"'},
  ]},
  {day:4,title:"Présenter l'opportunité",goal:"1 présentation + 5 contacts relancés",focus:"mix",tasks:[
    {id:"s4a",label:"Faire 1 présentation complète (15–30 min)",script:'"J\'ai commencé parce que j\'avais besoin de quelque chose qui s\'adapte à ma vie. Ce n\'est pas un schéma miracle — c\'est du travail qui a du sens."'},
    {id:"s4b",label:"3 nouveaux messages aux contacts Tièdes"},
    {id:"s4c",label:'Story "résultat flou" — sans tout dévoiler'},
  ]},
  {day:5,title:"Amplifier la portée",goal:"2 recommandations + 1 témoignage",focus:"mix",tasks:[
    {id:"s5a",label:"Demander à 2–3 amies de partager ta publication"},
    {id:"s5b",label:'À celles qui ont décliné : "Tu connais quelqu\'un ?"',script:'"Pas de souci ! Est-ce que tu aurais quelqu\'un dans ton entourage qui cherche un revenu complémentaire ? 🙂"'},
    {id:"s5c",label:"Post témoignage produit authentique"},
  ]},
  {day:6,title:"Café ou Zoom découverte",goal:"Événement réalisé + suivi envoyé",focus:"bao",tasks:[
    {id:"s6a",label:"Organiser un café ou Zoom 30–45 min avec 3–5 personnes"},
    {id:"s6b",label:"Présenter ton histoire + les 3 façons d'entrer"},
    {id:"s6c",label:"Suivi individuel à chaque participante dans les 2h",script:'"Merci d\'avoir pris le temps ce soir 🧡 Je suis là si tu as des questions. Pas de pression."'},
  ]},
  {day:7,title:"Bilan & relances",goal:"Bilan chiffré + plan semaine 2",focus:"mix",tasks:[
    {id:"s7a",label:"Compter : contacts · réponses · présentations · recrues"},
    {id:"s7b",label:'Relancer les personnes "en réflexion"',script:'"Coucou ! Je voulais prendre des nouvelles 🙂 Pas de pression — je suis là si tu veux avancer."'},
    {id:"s7c",label:"Story de bilan + planifier la semaine 2"},
  ]},
];

// ── CITATIONS DU JOUR ─────────────────────────────────────────────────────────
export const CITATIONS_DEFAULT=[
  "Le succès, c'est tomber 7 fois et se relever 8.",
  "Chaque jour est une nouvelle chance de changer ta vie.",
  "La discipline, c'est se rappeler ce que tu veux vraiment.",
  "Tu n'as pas besoin d'être parfaite, juste constante.",
  "Le doute tue plus de rêves que l'échec jamais ne le fera.",
  "Petit pas par petit pas, on construit de grandes choses.",
  "Ton énergie d'aujourd'hui dessine ton avenir de demain.",
  "Crois en toi, même quand personne d'autre ne le fait.",
  "La motivation te lance. L'habitude te fait tenir.",
  "Tu es plus forte que ce que tu penses.",
  "Le meilleur moment pour commencer, c'était hier. Le 2ème, c'est maintenant.",
  "Chaque 'non' te rapproche d'un 'oui'.",
  "La constance bat le talent quand le talent ne travaille pas.",
  "Sois fière de chaque petit progrès — c'est ainsi que naissent les grands changements.",
  "Ton futur toi te remerciera pour les efforts d'aujourd'hui.",
  "Les femmes fortes lèvent les autres femmes en se levant elles-mêmes.",
  "Ce n'est pas le temps qui manque, c'est la décision qui compte.",
  "Une graine plantée chaque jour devient une forêt.",
  "Ta différence est ta force, pas ta faiblesse.",
  "Avance à ton rythme — l'important c'est de ne jamais reculer.",
  "L'échec n'est qu'une information : il te dit ce qu'il faut ajuster.",
  "Les grandes histoires commencent toujours par un petit 'je vais essayer'.",
  "Investir en toi-même est le meilleur placement que tu feras jamais.",
  "Le travail discret d'aujourd'hui devient le résultat visible de demain.",
  "Sois la raison pour laquelle quelqu'un croit encore en la bonté et la persévérance.",
  "Chaque expert a un jour été débutant.",
  "Ta vie peut changer en une décision — celle de continuer.",
  "On ne grandit pas dans la zone de confort.",
  "Le secret pour avancer, c'est de commencer.",
  "Fais aujourd'hui ce que les autres ne font pas, pour avoir demain ce que les autres n'auront pas.",
  "Tu ne perds jamais vraiment — tu apprends ou tu gagnes.",
  "Une femme qui se lève chaque matin pour ses rêves est déjà une gagnante.",
  "Ton rythme n'a pas à ressembler à celui de quelqu'un d'autre.",
  "La patience n'est pas l'attente passive — c'est l'action continue.",
  "Choisis-toi, encore et encore.",
  "Les rêves ne fonctionnent que si tu fonctionnes.",
  "Aujourd'hui, fais un pas — même tout petit.",
  "Ta valeur ne dépend pas de ta productivité, mais ton avenir en dépend un peu.",
  "Le courage, c'est d'avancer même quand on a peur.",
  "On ne devient pas confiante en attendant — on le devient en agissant.",
  "Si ce n'était pas difficile, tout le monde le ferait.",
  "Le changement commence à la fin de ta zone de confort.",
  "Sois la version de toi que tu admirerais.",
  "Construire quelque chose qui dure prend du temps — et c'est normal.",
  "Ne compare pas ton chapitre 1 au chapitre 20 de quelqu'un d'autre.",
  "Une décision aujourd'hui peut changer toute ta trajectoire.",
  "Les obstacles sont souvent les détours qui mènent au bon endroit.",
  "Ton 'pourquoi' doit être plus fort que tes excuses.",
  "Le succès silencieux d'aujourd'hui sera la victoire visible de demain.",
  "Tu n'as pas à tout savoir pour commencer — juste à commencer.",
  "Avance même si c'est imparfait. Le mouvement crée la clarté.",
  "Plus tu sèmes, plus tu récoltes — sois patiente avec la croissance.",
  "Tu es la PDG de ta vie. Agis en conséquence.",
  "Le repos fait partie du progrès — prends-en sans culpabiliser.",
  "Une routine simple, répétée chaque jour, change une vie entière.",
  "Les femmes qui réussissent ne sont pas parfaites — elles sont déterminées.",
  "Ose demander, ose proposer, ose avancer.",
  "Ton énergie attire ce qui te ressemble — reste alignée.",
  "Fais-le avec amour, même les jours difficiles.",
  "Chaque client que tu aides, c'est une vie que tu touches.",
  "La liberté se construit une action à la fois.",
  "Ne laisse pas un mauvais jour devenir une mauvaise semaine.",
  "Ton parcours inspire plus de gens que tu ne le crois.",
  "L'authenticité attire plus que la perfection.",
  "Sois patiente avec toi-même — tu apprends quelque chose de nouveau chaque jour.",
  "La régularité transforme l'ordinaire en extraordinaire.",
  "Une bonne journée commence par une bonne décision dès le réveil.",
  "Tu construis ton empire une conversation à la fois.",
  "Le plus dur, c'est de commencer. Le reste suit.",
  "Si ton rêve ne te fait pas un peu peur, il n'est peut-être pas assez grand.",
  "Sois reconnaissante pour où tu es, ambitieuse pour où tu vas.",
  "Ce que tu fais aujourd'hui compte, même si ça ne se voit pas encore.",
  "Les femmes qui se soutiennent vont plus loin, ensemble.",
  "Reste fidèle à ton histoire — c'est elle qui touche les gens.",
  "On ne sait jamais quelle conversation va tout changer.",
  "Ta confiance grandit chaque fois que tu agis malgré la peur.",
  "Un petit progrès chaque jour donne de grands résultats avec le temps.",
  "Le travail acharné bat le talent quand le talent ne travaille pas.",
  "Donne-toi le droit d'évoluer, de changer d'avis, de grandir.",
  "Sois celle qui essaie, même si elle n'est pas sûre de réussir.",
  "La meilleure publicité, c'est ton enthousiasme sincère.",
  "Une cliente satisfaite en parle à 3 personnes. Une cliente transformée en parle à 30.",
  "Ne minimise jamais l'impact d'un simple message envoyé avec le cœur.",
  "Ton authenticité est ton meilleur argument de vente.",
  "La vente, c'est de l'attention donnée avant d'être reçue.",
  "Sers d'abord, vends ensuite — la confiance fera le reste.",
  "Les grandes équipes se construisent une personne à la fois, avec patience.",
  "Un leader, c'est quelqu'un qui montre le chemin en marchant devant.",
  "Aide quelqu'un à réussir et tu réussiras toi-même.",
  "Ta lumière peut allumer celle de quelqu'un d'autre — partage-la.",
  "Les femmes qui osent sont celles qui changent leur vie.",
  "Une habitude positive aujourd'hui est un cadeau pour ta toi de demain.",
  "Le succès n'est pas linéaire — accepte les hauts et les bas.",
  "Ce que tu sèmes en silence, tu le récolteras en lumière.",
  "Donne du sens à chaque action, même la plus petite.",
  "Sois fière du chemin parcouru, même s'il reste du chemin à faire.",
  "Aujourd'hui est un excellent jour pour recommencer, si besoin.",
  "Ta présence à elle seule peut inspirer quelqu'un aujourd'hui.",
  "Le plus grand risque, c'est de ne jamais essayer.",
  "Concentre-toi sur le progrès, pas sur la perfection.",
  "Un 'pas encore' n'est pas un 'jamais'.",
  "Tu mérites le succès que tu travailles si dur pour obtenir.",
  "Les meilleures opportunités se cachent souvent dans l'inconfort.",
  "Garde ton cap, même quand le vent change.",
  "Une vie extraordinaire est faite de jours ordinaires bien vécus.",
  "Sois la femme que ta fille ou ton fils admirera plus tard.",
  "Chaque grand changement a commencé par une personne qui a osé.",
  "Le bonheur n'est pas une destination — c'est une façon de voyager.",
  "Tu as déjà survécu à 100% de tes pires journées. Continue.",
  "Ce que tu fais avec constance devient ce que tu es.",
  "Une bonne énergie attire de bonnes opportunités.",
  "Les détails font la différence — prends soin des petites choses.",
  "L'audace paie, même quand elle fait peur.",
  "Le travail que tu fais en privé crée le résultat que tout le monde voit.",
  "Avancer lentement vaut mieux que ne pas avancer du tout.",
  "Crois dans ton projet autant que tu voudrais que les autres y croient.",
  "Une bonne nouvelle peut arriver à n'importe quel moment — reste prête.",
  "Sois reconnaissante chaque jour pour 3 choses, même petites.",
  "La gratitude transforme ce que tu as en suffisant.",
  "Le futur appartient à celles qui se préparent aujourd'hui.",
  "Chaque jour, choisis d'être un peu meilleure qu'hier.",
  "Ton rêve ne périmera pas — alors prends ton temps mais avance.",
  "La vraie force, c'est de continuer même quand c'est dur.",
  "Plus tu donnes de valeur, plus tu en reçois en retour.",
  "Une décision prise avec le cœur est rarement une erreur.",
  "Le succès aime la cohérence plus que l'intensité.",
  "Sois patiente : les graines ne deviennent pas des arbres en un jour.",
  "Ta vulnérabilité partagée peut devenir la force de quelqu'un d'autre.",
  "Aujourd'hui, fais quelque chose que ta future toi te remerciera d'avoir fait.",
  "L'important n'est pas où tu commences, mais où tu choisis d'aller.",
  "Un esprit positif attire des résultats positifs.",
  "Ose être vue, même imparfaite.",
  "Une vie pleine commence par des choix alignés avec tes valeurs.",
  "La meilleure version de toi t'attend du côté de l'effort.",
  "Quand tu doutes, regarde tout le chemin déjà parcouru.",
  "Les femmes inspirantes ne sont pas sans peur — elles avancent avec.",
  "Ne renonce pas à un bon rêve à cause d'une mauvaise journée.",
  "Construire un business, c'est construire sa liberté, jour après jour.",
  "Le respect de soi commence par tenir ses propres promesses.",
  "Un jour à la fois suffit — pas besoin de tout voir d'un coup.",
  "La beauté de recommencer, c'est qu'on peut le faire à chaque instant.",
  "Sois douce avec toi-même — tu fais de ton mieux avec ce que tu as.",
  "Le progrès imparfait vaut mieux que l'inaction parfaite.",
  "Crois en la magie des nouveaux départs.",
  "Un sourire sincère peut ouvrir des portes que les mots ne peuvent pas.",
  "Le succès, c'est aussi savoir s'arrêter pour se reposer sans culpabilité.",
  "Reste curieuse — c'est elle qui fait grandir tes compétences.",
  "Une petite victoire aujourd'hui mérite d'être célébrée.",
  "Ta façon unique de faire les choses est précisément ce qui te distingue.",
  "Le temps que tu investis en toi n'est jamais perdu.",
  "Avance avec foi, même sans toutes les réponses.",
  "La meilleure énergie, c'est celle qui inspire sans épuiser.",
  "Chaque conversation est une graine — certaines mettent du temps à germer.",
  "Sois fière de demander de l'aide — c'est un signe de force, pas de faiblesse.",
  "Un esprit reposé prend de meilleures décisions.",
  "Le succès partagé est un succès multiplié.",
  "Ta voix compte — utilise-la pour inspirer.",
  "Le travail d'équipe transforme les rêves individuels en réalité collective.",
  "Une bonne organisation aujourd'hui t'offre de la liberté demain.",
  "Apprends de chaque expérience — même de celles qui n'ont pas marché.",
  "Le succès n'est pas un sprint, c'est un marathon avec de bonnes chaussures.",
  "Sois reconnaissante pour les personnes qui croient en toi.",
  "La vraie richesse, c'est le temps que tu choisis pour toi-même.",
  "Un objectif écrit a beaucoup plus de chances de se réaliser.",
  "Célèbre les progrès de tes collègues comme les tiens.",
  "Une journée productive commence souvent par une bonne nuit de sommeil.",
  "Tu n'as pas besoin de la permission de quiconque pour réussir.",
  "Le doute est normal — l'action malgré le doute, c'est le courage.",
  "Sois fière de ton parcours, même les chapitres difficiles.",
  "Les graines plantées dans la difficulté donnent souvent les plus belles fleurs.",
  "Aujourd'hui compte, même si demain semble plus important.",
  "La persévérance transforme l'impossible en inévitable.",
  "Avance avec gratitude, pas avec pression.",
  "Ton intuition est souvent plus sage que tu ne le penses.",
  "Le succès attire le succès — commence petit, mais commence.",
  "Une bonne attitude vaut souvent plus qu'une bonne stratégie sans elle.",
  "Reste alignée avec tes valeurs, même quand c'est plus difficile.",
  "Le travail que tu fais aujourd'hui construit la confiance de demain.",
  "Une femme qui aide une autre femme construit un monde meilleur.",
  "Sois généreuse avec ton sourire — il ne coûte rien et vaut beaucoup.",
  "L'inspiration vient en agissant, pas en attendant.",
  "Tu es exactement où tu dois être pour grandir vers où tu veux aller.",
  "Le succès aime ceux qui se montrent, même les jours difficiles.",
  "Avance vers tes rêves un appel, un message, une action à la fois.",
  "La confiance se construit en tenant ses engagements envers soi-même.",
  "Ne sous-estime jamais l'impact d'un mot encourageant.",
  "Le bonheur authentique se voit — et il attire.",
  "Sois la femme qui se relève, encore et encore.",
  "Ta détermination d'aujourd'hui façonne ton histoire de demain.",
  "Apprends à célébrer les petites victoires — elles construisent les grandes.",
  "Le succès, c'est faire ce qu'il faut, même quand personne ne regarde.",
  "Une vie épanouie est faite de choix alignés, jour après jour.",
  "Crois en ton projet même quand tu es la seule à y croire.",
  "Le meilleur investissement, c'est celui que tu fais sur toi-même.",
  "Avance vers la lumière, même à petits pas.",
  "Une équipe soudée peut accomplir bien plus que des individus seuls.",
  "Sois patiente envers ton évolution — Rome ne s'est pas faite en un jour.",
  "Le travail discret paie toujours, tôt ou tard.",
  "Reste fidèle à ta mission, même quand le chemin est sinueux.",
  "Une cliente bien accompagnée devient une amie fidèle.",
  "La gratitude attire l'abondance.",
  "Sois ouverte aux opportunités qui se présentent sous une forme inattendue.",
  "Le courage de commencer est souvent plus grand que celui de continuer.",
  "Avance avec confiance — même les experts ont commencé par un premier pas.",
  "Le succès se construit en coulisses, longtemps avant d'être visible.",
  "Garde le sourire — il influence ta journée plus que tu ne le penses.",
  "La discipline aujourd'hui est la liberté de demain.",
  "Sois fière de chaque message envoyé, chaque appel passé, chaque effort fait.",
  "Le changement que tu cherches commence souvent par un petit geste.",
  "Avance malgré la fatigue — le repos viendra, mais d'abord, l'action.",
  "Ta réussite peut être la preuve dont quelqu'un d'autre a besoin pour croire.",
  "Le succès aime les femmes qui n'abandonnent pas après un 'non'.",
  "Sois reconnaissante pour les leçons, même celles qui ont fait mal.",
  "Une bonne énergie matinale donne le ton de toute la journée.",
  "Le progrès se mesure en mois et en années, pas en heures.",
  "Avance vers ton 'pourquoi' chaque jour, même imparfaitement.",
  "La confiance vient en répétant ce qui te fait peur jusqu'à ce que ça ne le soit plus.",
  "Sois fière d'être différente — c'est ce qui te rend mémorable.",
  "Le succès, c'est continuer même quand les résultats se font attendre.",
  "Une femme déterminée trouve toujours un chemin.",
  "Avance avec le cœur — les chiffres suivront.",
  "La meilleure version de toi grandit chaque jour, même invisiblement.",
  "Sois douce avec ton rythme — il est unique, et c'est correct.",
  "Le travail que tu fais aujourd'hui a un impact que tu ne mesures pas encore.",
  "Avance avec foi en l'avenir et discipline dans le présent.",
  "Une bonne habitude vaut mieux qu'une grande motivation ponctuelle.",
  "Sois reconnaissante envers la personne que tu étais — elle a fait de son mieux.",
  "Le succès n'attend pas la perfection — il aime l'action.",
  "Avance, même si tu ne vois pas encore la ligne d'arrivée.",
  "La vraie liberté, c'est choisir comment tu passes ton temps.",
  "Sois fière de toi pour avoir essayé, peu importe le résultat.",
  "Le succès se cultive comme un jardin — avec patience et constance.",
  "Avance avec gratitude pour ce que tu as et ambition pour ce que tu veux.",
  "Une bonne action aujourd'hui peut changer le cours de ta semaine.",
  "Sois la lumière dont quelqu'un d'autre a besoin aujourd'hui.",
  "Le succès récompense ceux qui restent quand c'est difficile.",
  "Avance vers tes rêves même quand le chemin semble flou.",
  "La confiance en soi se construit une petite victoire à la fois.",
  "Sois fière de ton authenticité — elle attire les bonnes personnes.",
  "Le succès aime la régularité plus que les grands sprints occasionnels.",
  "Avance avec le sourire — même les jours difficiles ont une fin.",
  "Une bonne nouvelle peut arriver juste après le moment où tu voulais abandonner.",
  "Sois patiente : la croissance la plus belle est souvent la plus lente.",
  "Le succès se construit jour après jour, action après action.",
  "Avance avec courage — la peur ne disparaît pas, mais elle s'apaise avec l'action.",
  "La vraie force, c'est de se relever après chaque chute, encore et encore.",
  "Sois fière de chaque étape, même les plus petites.",
  "Le succès n'a pas d'horaire — continue d'avancer à ton rythme.",
  "Avance vers la version de toi que tu rêves de devenir.",
  "Une attitude positive transforme les obstacles en opportunités.",
  "Sois reconnaissante pour aujourd'hui — c'est un cadeau.",
  "Le succès aime celles qui croient en elles avant même d'avoir des preuves.",
  "Avance avec détermination — chaque pas compte, même invisible.",
  "La meilleure façon de prédire ton avenir, c'est de le créer.",
  "Sois fière de ton parcours unique — personne d'autre ne peut le vivre comme toi.",
  "Le succès commence souvent par une décision simple : continuer.",
  "Avance avec confiance — tu as déjà tout ce qu'il faut pour réussir.",
  "Une vie pleine de sens commence par des actions alignées avec ton cœur.",
  "Sois patiente avec le processus — les meilleures choses prennent du temps.",
  "Le succès aime ceux qui se présentent, jour après jour, sans exception.",
  "Avance avec gratitude pour le chemin parcouru et excitation pour celui à venir.",
  "La vraie réussite se mesure aussi en sourires donnés et en vies touchées.",
  "Sois fière de ta croissance, même si elle est invisible aux yeux des autres.",
  "Le succès, c'est l'addition de tous les jours où tu as choisi de continuer.",
  "Avance avec amour pour ce que tu fais — ça se ressent toujours.",
  "Une bonne journée commence par une bonne intention.",
  "Sois reconnaissante pour les défis — ils te font grandir.",
  "Le succès aime la cohérence plus que la perfection.",
  "Avance vers tes objectifs avec patience et persévérance.",
  "La meilleure motivation, c'est de se rappeler pourquoi tu as commencé.",
  "Sois fière de toi pour être arrivée jusqu'ici.",
  "Le succès, c'est avancer même quand on ne voit pas encore les résultats.",
  "Avance avec foi — les graines plantées aujourd'hui fleuriront demain.",
  "Une femme inspirée inspire d'autres femmes.",
  "Sois patiente avec ton évolution — chaque jour compte.",
  "Le succès aime celles qui restent fidèles à elles-mêmes.",
  "Avance avec gratitude — chaque jour est une nouvelle opportunité.",
  "La vraie force vient de l'intérieur — nourris-la chaque jour.",
  "Sois fière de ton chemin, même s'il est différent de celui des autres.",
  "Le succès, c'est continuer d'avancer même à petits pas.",
  "Avance avec confiance vers la vie que tu mérites.",
  "Une bonne énergie attire de bonnes personnes et de bonnes opportunités.",
  "Sois reconnaissante pour chaque opportunité, même les plus petites.",
  "Le succès aime celles qui osent rêver grand et agir petit, chaque jour.",
  "Avance avec le cœur ouvert et l'esprit déterminé.",
  "La meilleure version de toi est à un choix de distance.",
  "Sois fière de ton courage — même quand il est invisible aux autres.",
  "Le succès, c'est la somme de tous les efforts que personne ne voit.",
  "Avance avec espoir — demain est plein de possibilités.",
  "Une vie extraordinaire commence par des choix ordinaires répétés.",
  "Sois patiente — le meilleur est souvent à venir.",
  "Le succès aime celles qui ne renoncent jamais à leurs rêves.",
  "Avance avec gratitude pour aujourd'hui et espoir pour demain.",
  "Ta passion d'aujourd'hui est le métier de demain.",
  "Une femme qui se lève après chaque chute devient inarrêtable.",
  "Le succès commence dans ta tête, avant de se voir dans tes résultats.",
  "Avance avec le sourire, même les jours gris.",
  "Sois fière du chemin, pas seulement de la destination.",
  "Une petite graine de constance donne un grand arbre de résultats.",
  "Ton rythme est le bon rythme, tant que tu avances.",
  "Le courage n'attend pas que la peur disparaisse — il avance avec elle.",
  "Chaque jour est une page blanche — écris-la avec intention.",
  "La meilleure énergie est celle qu'on choisit, pas celle qu'on subit.",
  "Sois la preuve vivante que le changement est possible.",
  "Un esprit reconnaissant trouve toujours une raison de sourire.",
  "Avance, même lentement — l'essentiel est de ne pas t'arrêter.",
  "Ta lumière intérieure ne dépend pas du regard des autres.",
  "Le succès se construit dans les habitudes du quotidien.",
  "Sois douce avec toi-même comme tu le serais avec une amie.",
  "Chaque relance est une preuve de ta détermination.",
  "La confiance grandit chaque fois que tu choisis d'agir.",
  "Avance avec ton cœur — il connaît souvent le chemin.",
  "Le futur se construit une décision à la fois, aujourd'hui.",
  "Le succès, c'est tomber 7 fois et se relever 8 Continue.",
  "Chaque jour est une nouvelle chance de changer ta vie Continue.",
  "La discipline, c'est se rappeler ce que tu veux vraiment Continue.",
  "Tu n'as pas besoin d'être parfaite, juste constante Continue.",
  "Le doute tue plus de rêves que l'échec jamais ne le fera Continue.",
  "Petit pas par petit pas, on construit de grandes choses Continue.",
  "Ton énergie d'aujourd'hui dessine ton avenir de demain Continue.",
  "Crois en toi, même quand personne d'autre ne le fait Continue.",
  "La motivation te lance. L'habitude te fait tenir Continue.",
  "Tu es plus forte que ce que tu penses Continue.",
  "Le meilleur moment pour commencer, c'était hier. Le 2ème, c'est maintenant Continue.",
  "Chaque 'non' te rapproche d'un 'oui' Continue.",
  "La constance bat le talent quand le talent ne travaille pas Continue.",
  "Sois fière de chaque petit progrès — c'est ainsi que naissent les grands changements Continue.",
  "Ton futur toi te remerciera pour les efforts d'aujourd'hui Continue.",
  "Les femmes fortes lèvent les autres femmes en se levant elles-mêmes Continue.",
  "Ce n'est pas le temps qui manque, c'est la décision qui compte Continue.",
  "Une graine plantée chaque jour devient une forêt Continue.",
  "Ta différence est ta force, pas ta faiblesse Continue.",
  "Avance à ton rythme — l'important c'est de ne jamais reculer Continue.",
  "L'échec n'est qu'une information : il te dit ce qu'il faut ajuster Continue.",
  "Les grandes histoires commencent toujours par un petit 'je vais essayer' Continue.",
  "Investir en toi-même est le meilleur placement que tu feras jamais Continue.",
  "Le travail discret d'aujourd'hui devient le résultat visible de demain Continue.",
  "Sois la raison pour laquelle quelqu'un croit encore en la bonté et la persévérance Continue.",
  "Chaque expert a un jour été débutant Continue.",
  "Ta vie peut changer en une décision — celle de continuer Continue.",
  "On ne grandit pas dans la zone de confort Continue.",
  "Le secret pour avancer, c'est de commencer Continue.",
  "Fais aujourd'hui ce que les autres ne font pas, pour avoir demain ce que les autres n'auront pas Continue.",
  "Tu ne perds jamais vraiment — tu apprends ou tu gagnes Continue.",
  "Une femme qui se lève chaque matin pour ses rêves est déjà une gagnante Continue.",
  "Ton rythme n'a pas à ressembler à celui de quelqu'un d'autre Continue.",
  "La patience n'est pas l'attente passive — c'est l'action continue Continue.",
  "Choisis-toi, encore et encore Continue.",
  "Les rêves ne fonctionnent que si tu fonctionnes Continue.",
  "Aujourd'hui, fais un pas — même tout petit Continue.",
  "Ta valeur ne dépend pas de ta productivité, mais ton avenir en dépend un peu Continue.",
  "Le courage, c'est d'avancer même quand on a peur Continue.",
  "On ne devient pas confiante en attendant — on le devient en agissant Continue.",
  "Si ce n'était pas difficile, tout le monde le ferait Continue.",
  "Le changement commence à la fin de ta zone de confort Continue.",
  "Sois la version de toi que tu admirerais Continue.",
  "Construire quelque chose qui dure prend du temps — et c'est normal Continue.",
  "Ne compare pas ton chapitre 1 au chapitre 20 de quelqu'un d'autre Continue.",
  "Une décision aujourd'hui peut changer toute ta trajectoire Continue.",
  "Les obstacles sont souvent les détours qui mènent au bon endroit Continue.",
  "Ton 'pourquoi' doit être plus fort que tes excuses Continue.",
  "Le succès silencieux d'aujourd'hui sera la victoire visible de demain Continue.",
  "Tu n'as pas à tout savoir pour commencer — juste à commencer Continue.",
  "Avance même si c'est imparfait. Le mouvement crée la clarté Continue.",
  "Plus tu sèmes, plus tu récoltes — sois patiente avec la croissance Continue.",
];

function getCitationDuJour(citations){
  const list=(citations&&citations.length>0)?citations:CITATIONS_DEFAULT;
  const today=new Date();
  const dayOfYear=Math.floor((today-new Date(today.getFullYear(),0,0))/86400000);
  return list[dayOfYear%list.length];
}

// ── MAIN APP ──────────────────────────────────────────────────────────────────
// ── CHALLENGE DÉCOUVERTE APP — 7 JOURS ───────────────────────────────────────
const CHALLENGE_APP_JOURS = [
  {
    jour: 1,
    titre: "Crée ta première fiche prospect",
    emoji: "👤",
    description: "Va dans Tableau de bord → Prospects. Ajoute une vraie personne que tu as en tête. Note son prénom, son intérêt (cliente ou distributrice) et une note sur ce que tu sais d'elle.",
    action: "Ajouter 1 fiche prospect",
    tip: "💡 C'est là que tout commence. Chaque personne à qui tu penses est un futur résultat.",
    section: "prospects",
  },
  {
    jour: 2,
    titre: "Envoie ton premier diagnostic",
    emoji: "🔬",
    description: "Va dans Diagnostics. Choisis un type (Skincare, Makeup, Cheveux...), entre le prénom d'une connaissance et copie le lien à lui envoyer. Envoie-lui aujourd'hui.",
    action: "Envoyer 1 lien diagnostic",
    tip: "💡 Le diagnostic est ton meilleur outil de vente — il crée une conversation naturelle.",
    section: "diagnostics",
  },
  {
    jour: 3,
    titre: "Configure ton Link-in-Bio",
    emoji: "🔗",
    description: "Va dans Link-in-Bio. Ajoute ta photo, ton slogan, et au moins 3 liens (Instagram, Facebook, catalogue...). Copie le lien et mets-le dans ta bio Instagram.",
    action: "Compléter son Link-in-Bio",
    tip: "💡 Ton link-in-bio remplace les 10 liens que tu ne peux pas mettre ailleurs.",
    section: "linkbio",
  },
  {
    jour: 4,
    titre: "Ajoute ta première cliente",
    emoji: "🛍️",
    description: "Va dans Tableau de bord → Clients. Ajoute une vraie cliente avec sa date de naissance. Enregistre une commande qu'elle a déjà passée — même ancienne.",
    action: "Ajouter 1 cliente avec 1 commande",
    tip: "💡 Les rappels automatiques te préviendront quand ses produits seront bientôt terminés.",
    section: "clients",
  },
  {
    jour: 5,
    titre: "Lance un challenge dans ton équipe",
    emoji: "⚡",
    description: "Va dans Tableau de bord → Équipe → Challenges. Crée un Challenge Flash de 48h avec un objectif simple et un cadeau sympa. Partage-le avec ton équipe.",
    action: "Créer 1 challenge équipe",
    tip: "💡 Un challenge actif = toute l'équipe motivée au même moment.",
    section: "equipe-fun",
  },
  {
    jour: 6,
    titre: "Pose tes objectifs de période",
    emoji: "🎯",
    description: "Va dans Tableau de bord → Objectifs. Remplis ton CA cible, ton palier visé et ton nombre de recrues. Clique sur 'Mes objectifs sont posés'. C'est ton engagement envers toi-même.",
    action: "Fixer ses objectifs de période",
    tip: "💡 Ce qu'on mesure, on l'améliore. Ce qu'on écrit, on l'atteint.",
    section: "objperso",
  },
  {
    jour: 7,
    titre: "Explore ton espace chef (ou ton Dream Board)",
    emoji: "✨",
    description: "Si tu as une équipe : explore Espace Chef → Statistiques pour voir le tableau de bord de ton équipe. Sinon : va dans Dream Board et ajoute 3 rêves avec des photos.",
    action: "Explorer Espace Chef ou Dream Board",
    tip: "💡 Tu viens de découvrir les fondations de l'app. Maintenant, utilise-la chaque jour.",
    section: "dreamboard",
  },
];

function ChallengeAppPopup({uid, onClose, setTab}){
  const[etat,setEtat]=useState(null); // null=chargement
  const[jourActuel,setJourActuel]=useState(null);
  const[valide,setValide]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        const data=snap.exists()?snap.data():{};
        const ca=data["db-challenge-app"]?JSON.parse(data["db-challenge-app"]):null;
        if(!ca){
          // Pas encore commencé → montrer l'annonce "ça commence demain"
          setEtat("annonce");
        } else {
          const startDate=new Date(ca.startDate);
          const today=new Date();
          today.setHours(0,0,0,0);
          const diffJours=Math.floor((today-startDate)/(1000*60*60*24));
          const jour=Math.min(diffJours+1,7); // J1 à J7
          if(diffJours>=7){setEtat("termine");return;}const joursValides=ca.joursValides||[];if(joursValides.includes(jour)){setEtat("termine_jour");return;}setEtat("actif");setJourActuel(jour);setValide(joursValides.includes(jour));}
      }catch{setEtat("annonce");}
    })();
  },[uid]);

  const demarrer=async()=>{
    setSaving(true);
    try{
      const tomorrow=new Date();
      tomorrow.setDate(tomorrow.getDate()+1);
      tomorrow.setHours(0,0,0,0);
      const ca={startDate:tomorrow.toISOString().slice(0,10),joursValides:[]};
      await setDoc(doc(db,"users",uid),{"db-challenge-app":JSON.stringify(ca)},{merge:true});
      setEtat("confirme");
    }catch{}
    setSaving(false);
  };

  const validerJour=async()=>{
    setSaving(true);
    try{
      const snap=await getDoc(doc(db,"users",uid));
      const ca=JSON.parse(snap.data()["db-challenge-app"]||"{}");
      const joursValides=[...(ca.joursValides||[])];
      if(!joursValides.includes(jourActuel)) joursValides.push(jourActuel);
      const next={...ca,joursValides};
      await setDoc(doc(db,"users",uid),{"db-challenge-app":JSON.stringify(next)},{merge:true});
      await setDoc(doc(db,"users",uid),{"db-challenge-app":JSON.stringify(next)},{merge:true});
      setValide(true);
      setTimeout(()=>onClose(),2000);
    }catch{}
    setSaving(false);
  };

  const allerSection=(section)=>{
    if(section==="prospects"||section==="clients"||section==="equipe-fun"||section==="objperso"){
      setTab("dashboard");
    } else if(section==="diagnostics"){ setTab("diagnostics"); }
    else if(section==="linkbio"){ setTab("linkbio"); }
    else if(section==="dreamboard"){ setTab("dreamboard"); }
    onClose();
  };
  if(etat==="termine_jour"||etat==="termine"){onClose();return null;}  const jour=jourActuel?CHALLENGE_APP_JOURS[jourActuel-1]:null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.75)",zIndex:999,display:"flex",alignItems:"flex-end",justifyContent:"center"}}
      onClick={onClose}>
      <div style={{background:C.blanc,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",padding:"1.5rem"}}
        onClick={e=>e.stopPropagation()}>

        {/* Annonce de lancement */}
        {etat==="annonce"&&(
          <div style={{textAlign:"center"}}>
            <div style={{fontSize:"2.5rem",marginBottom:".75rem"}}>🚀</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:600,color:C.brun,marginBottom:".4rem"}}>
              Challenge Découverte App
            </div>
            <div style={{fontSize:".82rem",color:C.gris,lineHeight:1.7,marginBottom:"1rem"}}>
              Pendant <strong>7 jours</strong>, une action courte chaque jour pour maîtriser l'application Blazing Dynasty.<br/>
              <strong>Ça commence demain matin.</strong> Prête ?
            </div>
            <div style={{background:C.creme,borderRadius:12,padding:".85rem",marginBottom:"1rem"}}>
              {CHALLENGE_APP_JOURS.map((j,i)=>(
                <div key={i} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".3rem 0",borderBottom:i<6?`1px solid ${C.pale}`:"none"}}>
                  <span style={{width:24,height:24,borderRadius:"50%",background:C.brun,color:"white",fontSize:".65rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{j.jour}</span>
                  <span style={{fontSize:".72rem",color:C.gris}}>{j.emoji} {j.titre}</span>
                </div>
              ))}
            </div>
            <button onClick={demarrer} disabled={saving}
              style={{width:"100%",background:`linear-gradient(135deg,${C.brun},${C.brun2})`,color:"white",border:"none",borderRadius:12,padding:".8rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
              {saving?"...":"🚀 Je relève le défi !"}
            </button>
            <button onClick={onClose}
              style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".75rem",fontFamily:"inherit",cursor:"pointer",padding:".4rem"}}>
              Pas maintenant
            </button>
          </div>
        )}

        {/* Confirmation démarrage */}
        {etat==="confirme"&&(
          <div style={{textAlign:"center",padding:"1rem 0"}}>
            <div style={{fontSize:"2rem",marginBottom:".5rem"}}>✅</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:C.brun,marginBottom:".5rem"}}>C'est noté !</div>
            <div style={{fontSize:".8rem",color:C.gris,lineHeight:1.7}}>Le challenge commence demain. Chaque jour, une action dans l'app pour progresser. On compte sur toi 🌟</div>
            <button onClick={onClose}
              style={{marginTop:"1rem",background:C.brun,color:"white",border:"none",borderRadius:10,padding:".6rem 1.5rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Super, à demain !
            </button>
          </div>
        )}

        {/* Jour actif */}
        {etat==="actif"&&jour&&(
          <div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
              <div style={{fontSize:".62rem",fontWeight:700,color:C.rose,textTransform:"uppercase",letterSpacing:".1em"}}>Challenge App — Jour {jourActuel}/7</div>
              <button onClick={onClose} style={{background:"none",border:"none",color:C.gris,fontSize:"1rem",cursor:"pointer"}}>✕</button>
            </div>
            {/* Barre progression */}
            <div style={{height:5,background:C.pale,borderRadius:10,marginBottom:"1rem",overflow:"hidden"}}>
              <div style={{height:"100%",background:`linear-gradient(90deg,${C.rose},${C.or})`,width:`${Math.round((jourActuel/7)*100)}%`,borderRadius:10}}/>
            </div>
            <div style={{textAlign:"center",marginBottom:"1rem"}}>
              <div style={{fontSize:"3rem",marginBottom:".4rem"}}>{jour.emoji}</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun}}>{jour.titre}</div>
            </div>
            <div style={{background:C.creme,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
              <div style={{fontSize:".78rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>{jour.description}</div>
              <div style={{fontSize:".72rem",color:C.brun,fontStyle:"italic",background:"white",borderRadius:8,padding:".45rem .65rem"}}>{jour.tip}</div>
            </div>
            <button onClick={()=>allerSection(jour.section)}
              style={{width:"100%",background:`linear-gradient(135deg,${C.rose},${C.lilas})`,color:"white",border:"none",borderRadius:12,padding:".75rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
              → Y aller maintenant
            </button>
            {!valide
              ?<button onClick={validerJour} disabled={saving}
                style={{width:"100%",background:C.creme,border:`1.5px solid ${C.or}`,borderRadius:12,padding:".65rem",fontSize:".8rem",fontWeight:600,color:C.brun,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
                {saving?"...":"✅ J'ai fait l'action du jour !"}
              </button>
              :<div style={{textAlign:"center",fontSize:".8rem",color:C.vert,fontWeight:700,padding:".5rem",marginBottom:".5rem"}}>✓ Action du jour validée 🎉</div>
            }
            <button onClick={onClose}
              style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".72rem",fontFamily:"inherit",cursor:"pointer",padding:".3rem"}}>
              Fermer
            </button>
          </div>
        )}

        {/* Terminé */}
        {etat==="termine"&&(
          <div style={{textAlign:"center",padding:"1rem 0"}}>
            <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🏆</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:C.brun,marginBottom:".5rem"}}>Challenge terminé !</div>
            <div style={{fontSize:".8rem",color:C.gris,lineHeight:1.7}}>Tu as découvert les 7 piliers de l'application. Maintenant tu sais tout — utilise-la chaque jour pour des résultats concrets ✨</div>
            <button onClick={onClose}
              style={{marginTop:"1rem",background:C.or,color:"white",border:"none",borderRadius:10,padding:".6rem 1.5rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Merci ! 🌟
            </button>
          </div>
        )}

      </div>
    </div>
  );
}

function App(){
  const[screen,setScreen]=useState("login");
  const[showWelcome,setShowWelcome]=useState(false);
  const[showBackupReminder,setShowBackupReminder]=useState(false);
  const[showMdpSetup,setShowMdpSetup]=useState(false);
  const[newMdp,setNewMdp]=useState("");
  const[newMdp2,setNewMdp2]=useState("");
  const[loginStep,setLoginStep]=useState(1);
  const[mdpInput,setMdpInput]=useState("");
  const[userId,setUserId]=useState("");
  const[isChefApp,setIsChefApp]=useState(false);
  const[hasTeamApp,setHasTeamApp]=useState(false);
  const[fastStartDone,setFastStartDone]=useState(false);
  const[hasFastStart,setHasFastStart]=useState(false);

  useEffect(()=>{
    if(!userId)return;
    if(userId==="melissa"||userId==="melissa-da-silveira"){setIsChefApp(true);setHasTeamApp(true);return;}
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        const chefs=snap.exists()?snap.data().chefs||[]:[];
        setIsChefApp((Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(userId.replace(/-/g," ")));
      }catch{setIsChefApp(false);}
      try{
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        setHasTeamApp(Object.values(annuaire).some(m=>m.marraine===userId));
      }catch{setHasTeamApp(false);}
    })();
  },[userId]);

  const[name,setName]=useState("");
  const[nameInput,setNameInput]=useState("");
  const[prenomInput,setPrenomInput]=useState("");
  const[nomInput,setNomInput]=useState("");
  const[codeInput,setCodeInput]=useState("");
  const[loginError,setLoginError]=useState("");
  const[loginLoading,setLoginLoading]=useState(false);
  const[chefs,setChefs]=useState([]);
  const[chefChoisi,setChefChoisi]=useState("");
  const[membresListe,setMembresListe]=useState([]);
  const[marraineChoisie,setMarraineChoisie]=useState("");
  const[pendingUid,setPendingUid]=useState("");
  const[pendingName,setPendingName]=useState("");
  const[pendingIsMelissa,setPendingIsMelissa]=useState(false);


  const verifierMdp=async()=>{
    if(!mdpInput.trim())return;
    setLoginLoading(true);setLoginError("");
    try{
      const snap=await getDoc(doc(db,"users",pendingUid));
      const mdpStocke=snap.exists()?snap.data()["db-mdp"]:"";
      if(mdpInput.trim()!==mdpStocke){setLoginError("Code personnel incorrect.");setLoginLoading(false);return;}
      try{localStorage.setItem("bd-user",JSON.stringify({uid:pendingUid,n:pendingName,codeOk:true}));}catch{}
      setUserId(pendingUid);setName(pendingName);setScreen("app");load(pendingUid);verifierChangementPeriode(pendingUid);try{const snapCA2=await getDoc(doc(db,"users",pendingUid));const caRaw2=snapCA2.exists()?snapCA2.data()["db-challenge-app"]:null;if(caRaw2){const ca2=JSON.parse(caRaw2);const startDate2=new Date(ca2.startDate);const today2=new Date();today2.setHours(0,0,0,0);const diffJours2=Math.floor((today2-startDate2)/(1000*60*60*24));if(diffJours2<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}catch{setTimeout(()=>setShowChallengeApp(true),2000);}
      // Rappel backup tous les 3 jours (Melissa uniquement)
      if(pendingUid==="melissa"||pendingUid==="melissa-da-silveira"){
        try{
          const snapBk=await getDoc(doc(db,"users",pendingUid));
          const lastBk=snapBk.exists()?snapBk.data()["db-last-backup"]:null;
          const joursDepuis=lastBk?Math.floor((Date.now()-new Date(lastBk).getTime())/(1000*60*60*24)):999;
          if(joursDepuis>=3) setTimeout(()=>setShowBackupReminder(true),3500);
        }catch{}
      }
      saveFCMToken(pendingUid);
      sg(pendingUid,"db-obj-perso").then(data=>{syncAnnuaire(pendingUid,pendingName,data?JSON.parse(data):null);});
    }catch{setLoginError("Erreur. Reessaie.");}
    setLoginLoading(false);
  };

  const SECRET_CODE="BD-2026-FIRE";

  // ── AUTO-LOGIN depuis localStorage ──
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("bd-user");
      if(saved){
        const{uid,n,codeOk}=JSON.parse(saved);
        if(uid&&n&&codeOk===true){
          // Verifier forceReload
          getDoc(doc(db,"admin","config")).then(cfg=>{
            const fr=cfg.exists()?cfg.data().forceReload:0;
            const lastReload=+localStorage.getItem("bd-last-reload")||0;
            if(fr&&fr>lastReload){localStorage.setItem("bd-last-reload",String(fr));window.location.reload();return;}
            setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);
            try{const fk="bd-first-"+uid;if(!localStorage.getItem(fk)){localStorage.setItem(fk,"1");setTimeout(()=>setShowWelcome(true),1500);}}catch{}
          }).catch(()=>{
            setUserId(uid);setName(n);setScreen("app");load(uid);verifierChangementPeriode(uid);
          });
        } else {
          // Session invalide
          localStorage.removeItem("bd-user");
        }


      }
    }catch{}
  },[]);

  const login=async()=>{
    if(!prenomInput.trim()||!nomInput.trim()||!codeInput.trim())return;
    if(codeInput.trim().toUpperCase()!==SECRET_CODE){
      setLoginError("❌ Code d'accès incorrect.");return;
    }
    setLoginLoading(true);setLoginError("");
    try{
      const ref=doc(db,"acces","membres");
      const snap=await getDoc(ref);
      const fullName=`${prenomInput.trim().toLowerCase()} ${nomInput.trim().toLowerCase()}`;
      const isMelissa=prenomInput.trim().toLowerCase()==="melissa";
      // Auto-ajouter Melissa comme chef d'équipe
      if(isMelissa){
        try{
          const accRef=doc(db,"acces","membres");
          const accSnap=await getDoc(accRef);
          const existing=accSnap.exists()?accSnap.data():{};
          const chefs=existing.chefs||[];
          const melissaId="melissa da silveira";
          if(!(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(melissaId)){
            await setDoc(accRef,{...existing,chefs:[...chefs,melissaId]},{merge:true});
          }
        }catch{}
      }
      if(!isMelissa){
        if(!snap.exists()){
          setLoginError("❌ Accès non autorisé. Contacte Melissa.");
          setLoginLoading(false);return;
        }
        const membres=snap.data().liste||[];
        const autorise=membres.some(m=>m.toLowerCase()===fullName);
        if(!autorise){
          setLoginError("❌ Prénom/Nom non reconnu. Contacte Melissa.");
          setLoginLoading(false);return;
        }
      }
      const uid=fullName.replace(/\s+/g,"-");
      const displayName=`${prenomInput.trim()} ${nomInput.trim()}`;

      // Vérifier si déjà un chef assigné
      const userSnap=await getDoc(doc(db,"users",uid));
      const alreadyHasChef=userSnap.exists()&&userSnap.data()["chef-equipe"];

      if(userSnap.exists()&&userSnap.data()["db-mdp"]){setPendingUid(uid);setPendingName(displayName);setPendingIsMelissa(isMelissa);
        // Charger la liste des chefs et des membres (pour la marraine)
        const chefsSnap=await getDoc(doc(db,"acces","membres"));
        const liste=chefsSnap.exists()?chefsSnap.data().chefs||[]:[];
        const tousMembres=chefsSnap.exists()?chefsSnap.data().liste||[]:[];
        setPendingUid(uid);setPendingName(displayName);setPendingIsMelissa(false);
        setChefs(liste);
        setMembresListe(["melissa da silveira", ...tousMembres.filter(m=>m.toLowerCase()!==fullName&&m.toLowerCase()!=="melissa da silveira")]);
        setLoginLoading(false);
        setLoginStep(2);return;
      }

      // Check mot de passe personnel
      if(userSnap.exists()&&userSnap.data()["db-mdp"]){
        setPendingUid(uid);setPendingName(displayName);setPendingIsMelissa(isMelissa);
        setLoginLoading(false);setLoginStep(3);return;
      }

      // Connexion directe
      try{localStorage.setItem("bd-user",JSON.stringify({uid,n:displayName,codeOk:true}));}catch{}
      // Popup bienvenue si première connexion
      try{const snapW=await getDoc(doc(db,"users",uid));const welcomed=snapW.exists()?snapW.data()["db-welcomed"]:false;if(!welcomed){setShowWelcome(true);await setDoc(doc(db,"users",uid),{"db-welcomed":true},{merge:true});}}catch{}
      setUserId(uid);setName(displayName);setScreen("app");load(uid);verifierChangementPeriode(uid);
      // Afficher le challenge app apres 2s seulement si pas termine
      try{const snapCA=await getDoc(doc(db,"users",uid));const caRaw=snapCA.exists()?snapCA.data()["db-challenge-app"]:null;if(caRaw){const ca=JSON.parse(caRaw);const startDate=new Date(ca.startDate);const today=new Date();today.setHours(0,0,0,0);const diffJours=Math.floor((today-startDate)/(1000*60*60*24));if(diffJours<7)setTimeout(()=>setShowChallengeApp(true),2000);}else{setTimeout(()=>setShowChallengeApp(true),2000);}}catch{setTimeout(()=>setShowChallengeApp(true),2000);}
      // Démarrer automatiquement le challenge app si première connexion
      try{
        const snap2=await getDoc(doc(db,"users",uid));
        const existingCA=snap2.exists()?snap2.data()["db-challenge-app"]:null;
        let caData=null;
        if(existingCA){try{caData=JSON.parse(existingCA);}catch{}}
        if(!caData||!caData.startDate){
          const today=new Date();
          const ca={startDate:today.toISOString().slice(0,10),joursValides:[],auto:true};
          await setDoc(doc(db,"users",uid),{"db-challenge-app":JSON.stringify(ca)},{merge:true});
        }
      }catch{}
      // Enregistrer token FCM pour les notifications
      saveFCMToken(uid);
      saveFCMToken(uid);
      // Verifier si mdp personnel existe - si non, afficher popup creation
      try{const mdpSnap=await getDoc(doc(db,"users",uid));if(!mdpSnap.exists()||!mdpSnap.data()["db-mdp"]){setTimeout(()=>setShowMdpSetup(true),1500);}}catch{}
      sg(uid,"db-obj-perso").then(data=>{
        syncAnnuaire(uid, displayName, data?JSON.parse(data):null);
      });
    }catch{
      setLoginError("❌ Erreur de connexion. Réessaie.");
    }
    setLoginLoading(false);
  };

  const confirmerChef=async()=>{
    setLoginLoading(true);
    try{
      if(chefChoisi){
        const ref=doc(db,"users",pendingUid);
        await setDoc(ref,{"chef-equipe":chefChoisi},{ merge:true });
        // Ajouter dans l'équipe du chef
        const chefUid=chefChoisi.toLowerCase().replace(/\s+/g,"-");
        const chefRef=doc(db,"users",chefUid);
        const chefSnap=await getDoc(chefRef);
        const equipe=chefSnap.exists()&&chefSnap.data()["mon-equipe"]?JSON.parse(chefSnap.data()["mon-equipe"]):[];
        if(!equipe.includes(pendingUid)){
          await setDoc(chefRef,{"mon-equipe":JSON.stringify([...equipe,pendingUid])},{merge:true});
        }
      }
      let marraineUid="";
      if(marraineChoisie){
        marraineUid=marraineChoisie.toLowerCase().replace(/\s+/g,"-");
        await setDoc(doc(db,"users",pendingUid),{"marraine":marraineUid},{merge:true});
      }
      try{localStorage.setItem("bd-user",JSON.stringify({uid:pendingUid,n:pendingName,codeOk:true}));}catch{}
      setUserId(pendingUid);setName(pendingName);setScreen("app");load(pendingUid);verifierChangementPeriode(pendingUid);
      try{const fk="bd-first-"+pendingUid;if(!localStorage.getItem(fk)){localStorage.setItem(fk,"1");setTimeout(()=>setShowWelcome(true),1500);}}catch{}
      saveFCMToken(pendingUid);
      sg(pendingUid,"db-obj-perso").then(data=>{
        syncAnnuaire(pendingUid, pendingName, data?JSON.parse(data):null, marraineUid);
      });
    }catch{}
    setLoginLoading(false);
  };
  const[tab,setTab]=useState("dashboard");
  const[formationSubTab,setFormationSubTab]=useState("");
  const[showObjectifs,setShowObjectifs]=useState(false);
  const[lang,setLang]=useState("fr");
  const[translations,setTranslations]=useState({});
  const[translating,setTranslating]=useState(false);

  // Re-traduire le DOM à chaque changement d'onglet si en mode PT
  useEffect(()=>{
    if(lang==="pt"){
      const t=setTimeout(()=>{ try{translateDOM("pt");}catch{} },400);
      return()=>clearTimeout(t);
    }
  },[tab, lang]);

  // MutationObserver : retraduire auto quand le DOM change en mode PT
  useEffect(()=>{
    if(lang!=="pt") return;
    let timer=null;
    const obs=new MutationObserver(()=>{
      clearTimeout(timer);
      timer=setTimeout(()=>{ try{translateDOM("pt");}catch{} },800);
    });
    const root=document.getElementById("root");
    if(root) obs.observe(root,{childList:true,subtree:true,characterData:false});
    return()=>{obs.disconnect();clearTimeout(timer);};
  },[lang]);

  const toggleLang=async()=>{
    const newLang=lang==="fr"?"pt":"fr";
    if(newLang==="fr"){
      setLang("fr");
      setTranslations({});
      try{ await translateDOM("fr"); }catch{}
      domOriginals.clear();
      return;
    }
    setTranslating(true);
    try{ await translateDOM(newLang); }catch(e){ console.error(e); }
    setLang(newLang);
    setTranslating(false);
  };
    const[checks,setChecks]=useState({});
  const[tasks,setTasks]=useState({});
  const[posts,setPosts]=useState({});
  const[kpis,setKpis]=useState({k1:"",k2:"",k3:"",k4:""});
  const[notes,setNotes]=useState("");
  const[loading,setLoading]=useState(false);
  const[openDays,setOpenDays]=useState({1:true});

  const load=useCallback(async(uid)=>{
    setLoading(true);
    try{
      const data = await sgAll(uid);
      if(data.checks) setChecks(JSON.parse(data.checks));
      if(data.tasks)  setTasks(JSON.parse(data.tasks));
      if(data.posts)  setPosts(JSON.parse(data.posts));
      if(data.kpis)   setKpis(JSON.parse(data.kpis));
      if(data.notes)  setNotes(data.notes);
    }catch{}
    setLoading(false);
  },[]);

  // Vérifie si la période a changé et remet à zéro les objectifs si oui
  const verifierChangementPeriode=useCallback(async(uid)=>{
    try{
      const periodeCourante=getPeriodeActuelle();
      const snap=await getDoc(doc(db,"users",uid));
      if(!snap.exists()) return;
      const d=snap.data();
      const lastPeriode=d["last_periode"];
      // Si jamais enregistré, juste stocker la période actuelle sans reset
      if(!lastPeriode){
        await setDoc(doc(db,"users",uid),{"last_periode":periodeCourante},{merge:true});
        return;
      }
      if(lastPeriode===periodeCourante) return; // Même période — rien à faire

      // Période différente → clôturer automatiquement
      const objRaw=d["db-obj-perso"];
      if(objRaw){
        const obj=JSON.parse(objRaw);
        // Sauvegarder dans l'historique
        const hist=obj.historique||[];
        const entry={
          date:todayLocalStr(),
          periode:lastPeriode,
          ca:parseFloat(obj.ca)||0,
          caObj:parseFloat(obj.caObj)||0,
          caPerso:parseFloat(obj.caPerso)||0,
          recruesReal:parseFloat(obj.recruesReal)||0,
          recruesObj:parseFloat(obj.recruesObj)||0,
          palier:obj.palier||"2%",
        };
        const newHist=[...hist,entry].slice(-24); // garder 24 périodes max
        const totalCaCumul=(parseFloat(obj.totalCaCumul)||0)+(parseFloat(obj.ca)||0);
        const totalRecruesCumul=(parseFloat(obj.totalRecruesCumul)||0)+(parseFloat(obj.recruesReal)||0);

        // Remettre à zéro les compteurs courants, conserver objectifs et palier
        const nextObj={
          ...obj,
          ca:"",
          caPerso:"",
          caEquipe:"",
          recruesReal:"0",
          // Vider le calcul du reste (directeurs) pour la nouvelle période
          nbDirecteurs:0,
          caDirecteurs:{},
          dirSelectionnes:{},
          historique:newHist,
          totalCaCumul:String(totalCaCumul),
          totalRecruesCumul:String(totalRecruesCumul),
        };
        await setDoc(doc(db,"users",uid),{"db-obj-perso":JSON.stringify(nextObj),"last_periode":periodeCourante},{merge:true});
        // Sync annuaire avec les nouvelles valeurs vides
        await syncAnnuaire(uid, name||uid, nextObj);

        // Remettre à zéro les badges sauf régularité or
        try{
          const badgesSnap=await getDoc(doc(db,"users",uid));
          if(badgesSnap.exists()){
            const bd=badgesSnap.data();
            const badgesRaw=bd["db-badges-unlocked"];
            if(badgesRaw){
              const badges=JSON.parse(badgesRaw);
              // Garder les badges permanents (régularité, recrutement, suivi)
              const garder=["regularite_or","streak_or","gold_streak","recruteur-elite","king-suivi","top-vendeur","fidelite-or","ambassador"].filter(k=>badges[k]);
              const nextBadges={};
              garder.forEach(k=>nextBadges[k]=badges[k]);
              await setDoc(doc(db,"users",uid),{"db-badges-unlocked":JSON.stringify(nextBadges)},{merge:true});
            }
          }
        }catch(e){console.error("reset badges:",e);}
        console.log(`Période ${lastPeriode}→${periodeCourante} : objectifs et badges remis à zéro`);
      } else {
        // Pas encore d'objectifs, juste enregistrer la période
        await setDoc(doc(db,"users",uid),{"last_periode":periodeCourante},{merge:true});
      }

      // Mettre à jour aussi l'annuaire
      syncAnnuaire(uid, name||"");
    }catch(e){ console.error("verifierChangementPeriode:",e); }
  },[name]);

  const save=useCallback(async(uid,c,t,_s,p,k,n)=>{
    if(!uid)return;
    try{await Promise.all([
      ss(uid,"checks",JSON.stringify(c)),ss(uid,"tasks",JSON.stringify(t)),
      ss(uid,"posts",JSON.stringify(p)),
      ss(uid,"kpis",JSON.stringify(k)),ss(uid,"notes",n),
    ]);}catch{}
  },[]);

  const tog=(type,id)=>{
    const setters={checks:[checks,setChecks],tasks:[tasks,setTasks],posts:[posts,setPosts]};
    const[state,setter]=setters[type];
    if(!state)return;
    const next={...state,[id]:!state[id]};
    setter(next);
    if(type==="tasks")save(userId,checks,next,{},posts,kpis,notes);
    else if(type==="posts")save(userId,checks,tasks,{},next,kpis,notes);
    else save(userId,next,tasks,{},posts,kpis,notes);
  };
  const updKpi=(k,v)=>{const next={...kpis,[k]:v};setKpis(next);save(userId,checks,tasks,null,posts,next,notes);};
  const updNotes=(v)=>{setNotes(v);save(userId,checks,tasks,null,posts,kpis,v);};

  const allTask=SPRINT.flatMap(d=>d.tasks.map(t=>t.id));
  const allPosts=POST_IDEAS.flatMap(th=>th.posts.map(p=>p.id));
  const donePosts=allPosts.filter(id=>posts[id]).length;

  // ── Période et bannières ──
  const periodeInfoInit=getPeriodeInfo();
  const isDebutPeriodeInit=periodeInfoInit.pctElapsed<=10;
  const bannerKeyInit=`bd-banner-${periodeInfoInit.periodEnd.toISOString().slice(0,10)}`;
  const[showBanner,setShowBanner]=useState(()=>{try{return isDebutPeriodeInit&&!localStorage.getItem(bannerKeyInit);}catch{return false;}});
  const[showChallengeApp,setShowChallengeApp]=useState(false);
  const[dismissedPeriode,setDismissedPeriode]=useState(false);
  const[objPosesLocal,setObjPosesLocal]=useState(false);

  // ── Admin items ──
  const[adminItems,setAdminItems]=useState([]);
  const[adminPosts,setAdminPosts]=useState([]);
  const[adminVideosFastStart,setAdminVideosFastStart]=useState({});
  const[homeObjPerso,setHomeObjPerso]=useState(null);
  const[homeTextes,setHomeTextes]=useState(null);
  useEffect(()=>{
    if(screen!=="app")return;
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setAdminItems((snap.data().items||[]).filter(i=>i.actif));
      }catch{}
      try{
        const snapVFS=await getDoc(doc(db,"admin","videos_faststart"));
        if(snapVFS.exists())setAdminVideosFastStart(snapVFS.data().videos||{});
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","posts_extra"));
        if(snap2.exists())setAdminPosts(snap2.data().items||[]);
      }catch{}
      try{
        const snap3=await getDoc(doc(db,"users",userId));
        if(snap3.exists()&&snap3.data()["db-obj-perso"]) setHomeObjPerso(JSON.parse(snap3.data()["db-obj-perso"]));
      }catch{}
      try{
        const snap4=await getDoc(doc(db,"admin","textes"));
        if(snap4.exists()) setHomeTextes(snap4.data());
      }catch{}
    })();
  },[screen]);

  // Rafraîchir homeObjPerso à chaque retour sur le tableau de bord (pour la bannière période)
  useEffect(()=>{
    if(tab==="dashboard"&&userId){
      getDoc(doc(db,"users",userId)).then(snap=>{
        if(snap.exists()&&snap.data()["db-obj-perso"]){
          try{ setHomeObjPerso(JSON.parse(snap.data()["db-obj-perso"])); }catch{}
        }
      }).catch(()=>{});
    }
  },[tab,userId]);

  // ── Protection clavier ──
  useEffect(()=>{
    const block=(e)=>{
      if(e.key==="F12"||(e.ctrlKey&&["u","s","a","p"].includes(e.key.toLowerCase()))){
        e.preventDefault();e.stopPropagation();
      }
    };
    document.addEventListener("keydown",block);
    return()=>document.removeEventListener("keydown",block);
  },[]);

  const TABS=[
    {id:"home",label:"🏠"},
    {id:"dashboard",label:"📊 Tableau de bord"},
    {id:"calendrier",label:"📅 Calendrier"},
    {id:"formation",label:"🎓 Formation"},
    {id:"sprint",label:"⚡ Sprint"},
    {id:"scripts",label:"📝 Scripts"},
    {id:"banqueimages",label:"🖼️ Images"},
    {id:"diagnostics",label:"🩺 Diagnostics"},
    {id:"linkbio",label:"🔗 Link-in-Bio"},
    ...(isChefApp||hasTeamApp?[{id:"espacechef",label:"👑 Espace Chef"}]:[]),
    {id:"dreamboard",label:"✨ Dream Board"},
  ];

  // Sous-onglets du menu Formation
  const FORMATION_TABS=[
    {id:"demarrage",label:"📚 Démarrage",icon:"📚",col:C.rose,desc:"8 parties — étape par étape pour bien démarrer"},
    {id:"formationapp",label:"🎬 Formation App",icon:"🎬",col:C.lilas,desc:"Comment utiliser l'application Blazing Dynasty"},
    {id:"mihibd",label:"🔥 Mihi & Blazing Dynasty",icon:"🔥",col:C.or,desc:"Qui on est, la marque, l'équipe — pour comprendre et en parler"},
    {id:"vente",label:"🎯 Vente",icon:"🎯",col:C.or,desc:"Stratégies, scripts et objections pour booster tes ventes"},
    {id:"recrutement",label:"👥 Recrutement",icon:"👥",col:C.rose,desc:"Recrutement, affiliation et stratégies d'équipe"},
    {id:"contenu",label:"📱 Contenu",icon:"📱",col:C.lilas,desc:"Posts, storytelling, contenu qui attire"},
    {id:"outils",label:"🛠️ Outils",icon:"🛠️",col:C.or,desc:"Canva, CapCut, Linktree et plus"},
    {id:"devperso",label:"🧠 Dév. Personnel",icon:"🧠",col:C.lilas,desc:"Mindset et développement personnel"},
    {id:"formaproduits",label:"🧴 Formation Produits",icon:"🧴",col:C.rose,desc:"Tout savoir sur les produits Mihi"},
  ];

  // ── MODE DIAGNOSTIC EXTERNE (cliente sans login) ──
  const urlParams = new URLSearchParams(window.location.search);
  const diagMode = urlParams.has("diag");
  const diagDistrib = urlParams.get("uid")||urlParams.get("distrib")||"";
  if(diagMode){
    return(
      <div style={{minHeight:"100vh",background:C.creme,fontFamily:"'Trebuchet MS',sans-serif"}}>
        <div style={{maxWidth:480,margin:"0 auto",padding:"1rem"}}>
          <div style={{textAlign:"center",padding:"1.5rem 0 .5rem"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:300,color:C.brun,letterSpacing:".04em"}}>
              Blazing <em style={{fontStyle:"italic",color:C.rose}}>Dynasty</em>
            </div>
            <div style={{fontSize:".7rem",color:C.gris,marginTop:".2rem"}}>Diagnostic personnalisé ✨</div>
          </div>
          <DiagnosticsTab uid={diagDistrib||"external"} userName={diagDistrib} externalMode={true} initialType={urlParams.get("diag")||""} initialClient={urlParams.get("client")||""}/>
        </div>
      </div>
    );
  }

  // ── LOGIN ────────────────────────────────────────────────────────────────────
  if(screen==="login")return(
    <div style={{minHeight:"100vh",background:C.brun,display:"flex",flexDirection:"column",alignItems:"center",justifyContent:"center",padding:"2rem 1.2rem",fontFamily:"'DM Sans',system-ui,sans-serif"}}>
      <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".25em",color:C.or,marginBottom:".5rem"}}>✦ BLAZING DYNASTY ✦</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.8rem,5vw,2.6rem)",fontWeight:300,color:C.blanc,textAlign:"center",lineHeight:1.1}}>Espace Formation</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"clamp(1.8rem,5vw,2.6rem)",fontStyle:"italic",color:C.pale,textAlign:"center",lineHeight:1.1,marginBottom:".3rem"}}>Privé</div>
      <div style={{width:48,height:1,background:C.or,margin:".85rem auto"}}/>
      <p style={{fontSize:".76rem",color:"rgba(232,213,204,.7)",textAlign:"center",marginBottom:"2rem",maxWidth:300}}>Formations · Stratégies · Outils · Suivi</p>

      <div style={{background:C.blanc,borderRadius:16,padding:"1.5rem 1.4rem",width:"100%",maxWidth:360,boxShadow:"0 8px 32px rgba(0,0,0,.25)"}}>

        {/* ÉTAPE 1 — Identité */}
        {loginStep===1&&<>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".75rem",textAlign:"center"}}>🔐 Accès membres</div>
          <div style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
            <input type="text" placeholder="Prénom" value={prenomInput} onChange={e=>{setPrenomInput(e.target.value);setLoginError("");}}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}} autoFocus/>
            <input type="text" placeholder="Nom" value={nomInput} onChange={e=>{setNomInput(e.target.value);setLoginError("");}}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
          <input type="password" placeholder="Code d'accès" value={codeInput} onChange={e=>{setCodeInput(e.target.value);setLoginError("");}} onKeyDown={e=>e.key==="Enter"&&login()}
            style={{width:"100%",border:`1px solid ${loginError?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
          {loginError&&<div style={{fontSize:".72rem",color:"#B04040",marginBottom:".5rem",textAlign:"center"}}>{loginError}</div>}
          <button onClick={login} disabled={!prenomInput.trim()||!nomInput.trim()||!codeInput.trim()||loginLoading}
            style={{width:"100%",background:(prenomInput.trim()&&nomInput.trim()&&codeInput.trim())?C.brun:C.pale,color:(prenomInput.trim()&&nomInput.trim()&&codeInput.trim())?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",transition:"all .2s"}}>
            {loginLoading?"Vérification...":"Continuer →"}
          </button>
          <p style={{fontSize:".62rem",color:C.gris,textAlign:"center",marginTop:".7rem"}}>Espace réservé aux membres Blazing Dynasty.</p>
        </>}

        {/* ÉTAPE 2 — Choix chef d'équipe */}
        {loginStep===2&&<>
          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem",textAlign:"center"}}>👑 Ta chef d'équipe</div>
          <p style={{fontSize:".76rem",color:C.gris,textAlign:"center",marginBottom:"1rem",lineHeight:1.6}}>
            Bienvenue {pendingName.split(" ")[0]} ! 🎉<br/>Choisis ta chef d'équipe.
          </p>
          <select value={chefChoisi} onChange={e=>setChefChoisi(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:"1rem"}}>
            <option value="">— Sélectionne ta chef —</option>
            {chefs.map(c=><option key={c} value={c}>{c.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")}</option>)}
          </select>

          <div style={{fontSize:".68rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".5rem",textAlign:"center"}}>🌸 Ta marraine</div>
          <p style={{fontSize:".74rem",color:C.gris,textAlign:"center",marginBottom:".7rem",lineHeight:1.6}}>
            Qui t'a parrainée dans l'aventure ? (optionnel)
          </p>
          <SearchSelect value={marraineChoisie} onChange={setMarraineChoisie} options={membresListe} placeholder="🔍 Tape le nom de ta marraine..."/>
          <button onClick={confirmerChef} disabled={!chefChoisi||loginLoading}
            style={{width:"100%",background:chefChoisi?C.brun:C.pale,color:chefChoisi?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",transition:"all .2s"}}>
            {loginLoading?"Sauvegarde...":"Accéder à mon espace →"}
          </button>
          <button onClick={confirmerChef} disabled={loginLoading}
            style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".7rem",marginTop:".5rem",cursor:"pointer",fontFamily:"inherit",padding:".3rem"}}>
            Passer cette étape
          </button>
        </>}
        {loginStep===3&&<>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:300,color:"#3D1F0E",marginBottom:"1rem",textAlign:"center"}}>🔐 Ton code <em style={{color:"#C49A8A"}}>personnel</em></div>
          <input type="password" placeholder="Ton code personnel" value={mdpInput} onChange={e=>setMdpInput(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&verifierMdp()}
            style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".6rem .9rem",fontSize:".9rem",fontFamily:"inherit",color:"#3D2B1F",background:"white",outline:"none",marginBottom:".75rem"}}/>
          {loginError&&<div style={{color:"#C44B1A",fontSize:".75rem",marginBottom:".5rem",textAlign:"center"}}>{loginError}</div>}
          <button onClick={verifierMdp} disabled={!mdpInput.trim()||loginLoading}
            style={{width:"100%",background:"#3D1F0E",color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {loginLoading?"Verification...":"Acceder →"}
          </button>
        </>}

      </div>
    </div>
  );


  // ── APP ──────────────────────────────────────────────────────────────────────
  const todayKey=todayLocalStr();
  const dailyActions=["a1","a2","a3","a4","a5"];
  const actionsToday=dailyActions.filter(id=>checks[`${todayKey}-${id}`]||checks[id]).length;
  const actionsIncomplete=actionsToday<5;
  const periodeInfo=getPeriodeInfo();
  // J1 seulement = moins de 24h depuis le début de la période
  const isJ1Periode = periodeInfo.pctElapsed<=Math.round(100/21);
  const periodeCourante = getPeriodeActuelle();
  const objPeriodeRemplis = objPosesLocal || homeObjPerso?.objectifsPosesPeriode===periodeCourante;
  const showPeriodeBanner = isJ1Periode && !objPeriodeRemplis;
  const bannerKey=`bd-banner-p${periodeCourante}`;
  const closeBanner=()=>{try{localStorage.setItem(bannerKey,"1");}catch{}setShowBanner(false);};

  return(
    <LangContext.Provider value={{lang, translations, t:(k)=>translations[k]||(lang==="pt"?UI_TEXTS_PT[k]:null)||UI_TEXTS[k]||k}}>
    <div
      style={{minHeight:"100vh",background:C.creme,fontFamily:"'DM Sans',system-ui,sans-serif",color:C.texte,userSelect:"none"}}
      onContextMenu={e=>e.preventDefault()}
      onCopy={e=>e.preventDefault()}
      onCut={e=>e.preventDefault()}
    >

      {showWelcome&&(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(61,31,14,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}><div style={{background:"white",borderRadius:20,maxWidth:420,width:"100%",overflow:"hidden"}}><div style={{background:"#3D1F0E",padding:"1.5rem 1.3rem",textAlign:"center"}}><div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>👑</div><div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",color:"white",fontWeight:300}}>Bienvenue {name&&name.split(" ")[0]} !</div><div style={{fontSize:".78rem",color:"#C49A8A",marginTop:".25rem"}}>Tu fais maintenant partie de Blazing Dynasty ✨</div></div><div style={{padding:"1.25rem 1.3rem"}}><div style={{background:"#FAF7F2",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",fontSize:".78rem",color:"#3D2B1F",lineHeight:1.7}}>🌸 Nous sommes tellement heureuses de t'accueillir dans notre équipe. Tu as fait le bon choix — maintenant on est là pour t'accompagner à chaque étape. Let's go ! 🔥</div><div style={{fontSize:".6rem",fontWeight:700,color:"#888",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>✦ TES ACCÈS DU MOMENT</div>{[{icon:"🚀",titre:"Fast Start",desc:"7 modules progressifs pour bien démarrer — commence par là !"},{icon:"📱",titre:"Formation Application",desc:"Apprends à utiliser l'appli pour te faciliter la vie"}].map((item,i)=>(<div key={i} onClick={()=>{setShowWelcome(false);setTab("formation");}} style={{display:"flex",alignItems:"center",gap:".75rem",background:"#3D1F0E",borderRadius:10,padding:".7rem .85rem",marginBottom:".4rem",cursor:"pointer"}}><span style={{fontSize:"1.3rem"}}>{item.icon}</span><div style={{flex:1}}><div style={{fontSize:".82rem",fontWeight:700,color:"white"}}>{item.titre}</div><div style={{fontSize:".68rem",color:"#C49A8A"}}>{item.desc}</div></div><span style={{color:"#C49A8A"}}>→</span></div>))}<button onClick={()=>setShowWelcome(false)} style={{width:"100%",background:"#C49A8A",color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginTop:".75rem"}}>Commencer mon aventure → 🚀</button></div></div></div>)}

      {showMdpSetup&&(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}><div style={{background:"white",borderRadius:16,padding:"1.5rem",maxWidth:380,width:"100%"}}><div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:"#3D1F0E",marginBottom:".5rem",textAlign:"center"}}>🔐 Crée ton code personnel</div><div style={{fontSize:".75rem",color:"#888",marginBottom:"1rem",textAlign:"center",lineHeight:1.5}}>Pour sécuriser ton espace, choisis un code personnel que tu saisiras à chaque connexion.</div><input type="password" placeholder="Ton code personnel" value={newMdp} onChange={e=>setNewMdp(e.target.value)} style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",marginBottom:".5rem",outline:"none"}}/><input type="password" placeholder="Confirme ton code" value={newMdp2} onChange={e=>setNewMdp2(e.target.value)} style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".6rem .9rem",fontSize:".85rem",fontFamily:"inherit",marginBottom:".75rem",outline:"none"}}/>{newMdp&&newMdp!==newMdp2&&<div style={{fontSize:".7rem",color:"#C44B1A",marginBottom:".5rem"}}>Les codes ne correspondent pas</div>}<button onClick={async()=>{if(!newMdp.trim()||newMdp!==newMdp2)return;try{await setDoc(doc(db,"users",userId),{"db-mdp":newMdp.trim()},{merge:true});setShowMdpSetup(false);setNewMdp("");setNewMdp2("");}catch{}}} disabled={!newMdp.trim()||newMdp!==newMdp2} style={{width:"100%",background:"#3D1F0E",color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>Enregistrer mon code</button><button onClick={()=>setShowMdpSetup(false)} style={{width:"100%",background:"none",border:"none",color:"#888",fontSize:".72rem",cursor:"pointer",fontFamily:"inherit"}}>Plus tard</button></div></div>)}
      {/* BANNIÈRE NOUVELLE PÉRIODE */}
      {showPeriodeBanner&&(
        <div style={{background:"linear-gradient(135deg,#C44B1A,#8B3010)",padding:".85rem 1rem",display:"flex",gap:".75rem",alignItems:"flex-start",position:"sticky",top:0,zIndex:150}}>
          <span style={{fontSize:"1.2rem",flexShrink:0}}>🎯</span>
          <div style={{flex:1}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:"white",marginBottom:".2rem"}}>
              Nouvelle période — Fixe tes objectifs !
            </div>
            <div style={{fontSize:".7rem",color:"rgba(255,255,255,.85)",lineHeight:1.5}}>
              Une nouvelle période de 21 jours vient de commencer. Prends 2 minutes pour définir ton CA cible, ton palier et ton objectif de recrues.
            </div>
            <div style={{display:"flex",gap:".4rem",marginTop:".5rem",flexWrap:"wrap"}}>
              <button onClick={()=>{setTab("dashboard");}}
                style={{background:"white",color:"#C44B1A",border:"none",borderRadius:8,padding:".3rem .75rem",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                → Définir mes objectifs
              </button>
              <button onClick={async()=>{
                const newObj={...(homeObjPerso||{}),objectifsPosesPeriode:periodeCourante};
                setHomeObjPerso(newObj);
                setObjPosesLocal(true);
                const existingRaw=JSON.stringify(newObj);
                try{
                  await setDoc(doc(db,"users",userId),{"db-obj-perso":existingRaw},{merge:true});
                }catch(e){console.warn(e);}
              }}
                style={{background:"rgba(255,255,255,.2)",color:"white",border:"1px solid rgba(255,255,255,.5)",borderRadius:8,padding:".3rem .75rem",fontSize:".72rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
                ✅ Mes objectifs sont posés
              </button>
            </div>
          </div>
        </div>
      )}

      {/* HEADER */}
      <div style={{background:C.brun,padding:"1rem 1rem .85rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",inset:0,backgroundImage:"repeating-linear-gradient(45deg,transparent,transparent 20px,rgba(196,168,130,.04) 20px,rgba(196,168,130,.04) 21px)"}}/>
        <div style={{position:"relative",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontSize:".52rem",fontWeight:700,letterSpacing:".2em",color:C.or}}>✦ BLAZING DYNASTY</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:300,color:C.blanc,marginTop:".15rem"}}>
              Bonjour <strong style={{color:C.or,fontWeight:600}}>{name}</strong>
            </div>
          </div>
          <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
            {/* Langue */}
            <a href={"https://translate.google.com/translate?sl=fr&tl=pt&u="+encodeURIComponent(window.location.href)} target="_blank" rel="noopener noreferrer" style={{textDecoration:"none"}} title="Traduzir para português"><button disabled={false}
              style={{background:"rgba(196,168,130,.15)",border:`1px solid ${C.or}40`,borderRadius:20,padding:".22rem .55rem",cursor:translating?"default":"pointer",fontFamily:"inherit",fontSize:".62rem",fontWeight:700,color:C.or,opacity:translating?.6:1}}
              title={lang==="fr"?"Traduzir para português":"Revenir en français"}>
              🇵🇹
            </button></a>
            {/* Notification actions du jour */}
            {actionsIncomplete&&(
              <button onClick={()=>setTab("dashboard")}
                style={{display:"flex",alignItems:"center",gap:".35rem",background:"rgba(196,154,138,.2)",border:`1px solid ${C.rose}`,borderRadius:20,padding:".25rem .6rem",cursor:"pointer",fontFamily:"inherit"}}>
                <span style={{width:16,height:16,borderRadius:"50%",background:C.rose,color:"white",fontSize:".52rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{5-actionsToday}</span>
                <span style={{fontSize:".6rem",color:C.pale,fontWeight:600}}>actions restantes</span>
              </button>
            )}
            {!actionsIncomplete&&(
              <div style={{display:"flex",alignItems:"center",gap:".3rem",background:"rgba(127,175,138,.15)",border:`1px solid ${C.vert}`,borderRadius:20,padding:".25rem .6rem"}}>
                <span style={{fontSize:".7rem"}}>✅</span>
                <span style={{fontSize:".6rem",color:C.vert,fontWeight:600}}>Journée complète !</span>
              </div>
            )}
            <button onClick={()=>{try{localStorage.removeItem("bd-user");}catch{}setScreen("login");}} style={{padding:".25rem .6rem",fontSize:".6rem",color:C.gris,border:`1px solid rgba(196,168,130,.2)`,borderRadius:20,background:"none",cursor:"pointer",fontFamily:"inherit"}}>↩</button>
          </div>
        </div>
        <div style={{position:"relative",marginTop:".6rem",display:"flex",gap:".5rem"}}>
          <div style={{flex:1}}>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".55rem",color:C.pale,opacity:.7,marginBottom:".2rem"}}>
              <span>Posts cochés</span><span>{donePosts}/{allPosts.length}</span>
            </div>
            <div style={{height:3,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden"}}>
              <div style={{height:"100%",background:C.rose,width:(allPosts.length?Math.round(donePosts/allPosts.length*100):0)+"%",borderRadius:10,transition:"width .4s"}}/>
            </div>
          </div>
        </div>
      </div>

      {/* NAV */}
      <div style={{background:C.blanc,borderBottom:`1px solid ${C.pale}`,display:"flex",overflowX:"auto",position:"sticky",top:0,zIndex:100,boxShadow:"0 1px 8px rgba(61,31,14,.06)"}}>
        {TABS.map(tb=>(
          <button key={tb.id} onClick={()=>setTab(tb.id)}
            style={{flex:"none",padding:".72rem .85rem",fontSize:".6rem",fontWeight:600,letterSpacing:".05em",textTransform:"uppercase",color:tab===tb.id?C.brun:C.gris,border:"none",borderBottom:`2px solid ${tab===tb.id?C.rose:"transparent"}`,background:"none",cursor:"pointer",whiteSpace:"nowrap",fontFamily:"inherit",transition:"all .2s"}}>
            {tb.label}
          </button>
        ))}
      </div>

      {/* RETOUR FORMATION (quand un dossier est ouvert) */}
      {tab==="formation"&&formationSubTab&&(
        <div style={{background:C.creme,borderBottom:`1px solid ${C.pale}`,position:"sticky",top:0,zIndex:99,padding:".5rem 1rem"}}>
          <button onClick={()=>setFormationSubTab("")}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0}}>
            ← Retour à Formation
          </button>
        </div>
      )}

      {/* BANNIÈRE DÉBUT DE PÉRIODE */}
      {showBanner&&(
        <div style={{background:"linear-gradient(135deg,#C44B1A,#8B3010)",padding:".85rem 1rem",position:"relative",zIndex:50}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",gap:".75rem"}}>
            <div style={{flex:1}}>
              <div style={{fontSize:".65rem",fontWeight:700,letterSpacing:".12em",color:"rgba(255,220,180,.9)",marginBottom:".2rem"}}>🎯 NOUVELLE PÉRIODE MIHI</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:"white",fontWeight:300,lineHeight:1.3,marginBottom:".35rem"}}>
                C'est le moment de définir<br/><em style={{fontStyle:"italic",color:"#FFD9A0"}}>tes objectifs pour cette période</em>
              </div>
              <p style={{fontSize:".72rem",color:"rgba(255,220,180,.8)",lineHeight:1.5,margin:"0 0 .6rem"}}>
                CA visé · Palier à atteindre · Nombre de recrues — note-les maintenant pour suivre ta progression.
              </p>
              <div style={{display:"flex",gap:".5rem"}}>
                <button onClick={()=>{setTab("dashboard");closeBanner();}}
                  style={{background:"rgba(255,255,255,.2)",border:"1px solid rgba(255,255,255,.4)",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:700,color:"white",cursor:"pointer",fontFamily:"inherit"}}>
                  Définir mes objectifs →
                </button>
                <button onClick={closeBanner}
                  style={{background:"none",border:"1px solid rgba(255,255,255,.2)",borderRadius:8,padding:".35rem .65rem",fontSize:".72rem",color:"rgba(255,255,255,.6)",cursor:"pointer",fontFamily:"inherit"}}>
                  Plus tard
                </button>
              </div>
            </div>
            <button onClick={closeBanner}
              style={{background:"none",border:"none",color:"rgba(255,255,255,.5)",fontSize:".9rem",cursor:"pointer",padding:".2rem",flexShrink:0,fontFamily:"inherit"}}>
              ✕
            </button>
          </div>
        </div>
      )}

      {loading&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>}

      <div style={{maxWidth:680,margin:"0 auto",padding:"1.1rem 1rem 4rem"}}>

        {/* ── HOME ── */}
        {tab==="home"&&(
          <div>
            {/* ── RÉCAP DU JOUR ── */}
            <HomeRecap name={name} objPerso={homeObjPerso} textes={homeTextes}/>

            <div style={{background:C.brun,borderRadius:16,padding:"1.4rem",marginBottom:"1rem",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:-15,right:-15,width:90,height:90,borderRadius:"50%",background:"rgba(196,154,138,.08)"}}/>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".4rem"}}>✦ ESPACE PRIVÉ</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.25rem",fontWeight:300,color:C.blanc,lineHeight:1.2,marginBottom:".4rem"}}>
                Ton hub de formation<br/><em style={{fontStyle:"italic",color:C.pale}}>Blazing Dynasty</em>
              </div>
              <p style={{fontSize:".73rem",color:C.pale,lineHeight:1.65,opacity:.85}}>
                Formations · Stratégies · Outils · Idées de posts · Suivi recrutement. Tout est ici.
              </p>
            </div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
              {[["8","parties démarrage",C.rose],["11","replays Zoom",C.or],[String(allPosts.length),"idées de posts",C.lilas]].map(([n,l,col])=>(
                <div key={l} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem .5rem",textAlign:"center"}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:col,lineHeight:1}}>{n}</div>
                  <div style={{fontSize:".58rem",color:C.gris,marginTop:".15rem",lineHeight:1.3}}>{l}</div>
                </div>
              ))}
            </div>
            {[
              {id:"formation",sub:"mihibd",icon:"🔥",col:C.rose,label:"Mihi & Blazing Dynasty — Qui on est"},
              {id:"formation",sub:"demarrage",icon:"📚",col:C.rose,label:"Formation Démarrage Rapide — 8 parties"},
              {id:"formation",sub:"vente",icon:"🎯",col:C.or,label:"Vente · Stratégies · Booster ses ventes"},
              {id:"formation",sub:"recrutement",icon:"👥",col:C.rose,label:"Recrutement · Affiliation · Diagnostique"},
              {id:"formation",sub:"contenu",icon:"📱",col:C.lilas,label:"Contenu · Posts · Storytelling · Cible"},
              {id:"formation",sub:"devperso",icon:"🧠",col:C.lilas,label:"Développement Personnel"},
              {id:"formation",sub:"outils",icon:"🛠️",col:C.or,label:"Outils — Canva · CapCut · Linktree"},
              {id:"sprint",sub:null,icon:"⚡",col:C.rose,label:"Sprint Recrutement 7 jours"},
              {id:"suivi",sub:null,icon:"📋",col:C.lilas,label:"Checklist Nouvelle Recrue"},
            ].map(s=>(
              <div key={s.label} onClick={()=>{setTab(s.id); if(s.sub) setFormationSubTab(s.sub);}}
                style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".45rem",display:"flex",alignItems:"center",gap:".65rem",cursor:"pointer"}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:s.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",flexShrink:0}}>{s.icon}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".88rem",fontWeight:600,color:C.brun,flex:1}}>{s.label}</div>
                <div style={{color:C.rose,fontSize:".68rem"}}>→</div>
              </div>
            ))}
          </div>
        )}

        {/* ── BLAZING DYNASTY ── */}

        {/* ── DÉMARRAGE RAPIDE ── */}
        {/* ── FORMATION : LISTE DE DOSSIERS ── */}
        {tab==="formation"&&!formationSubTab&&(
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
              Centre de <em style={{fontStyle:"italic",color:C.rose}}>Formation</em>
            </div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
              Choisis une catégorie pour accéder à ses formations, vidéos et ressources.
            </p>
            {FORMATION_TABS.map(f=>{
              const formationDebloquee = fastStartDone || isChefApp || hasTeamApp;
              // Onglets bloqués si Fast Start non terminé (sauf formationapp et demarrage)
              const bloque = false;
              return(
                <div key={f.id} onClick={()=>!bloque&&setFormationSubTab(f.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:bloque?C.creme:C.blanc,border:`1px solid ${bloque?"#ddd":C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:bloque?"default":"pointer",opacity:bloque?.6:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:bloque?"#ddd":f.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>
                      {bloque?"🔒":f.icon}
                    </div>
                    <div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:bloque?C.gris:C.brun}}>{f.label.replace(/^\S+\s/,"")}</div>
                      <div style={{fontSize:".66rem",color:bloque?"#bbb":C.gris}}>{bloque?"Se débloque après le Fast Start":f.desc}</div>
                    </div>
                  </div>
                  <span style={{color:bloque?"#ccc":C.pale}}>{bloque?"🔒":"›"}</span>
                </div>
              );
            })}
          </div>
        )}

        {tab==="formation"&&formationSubTab==="mihibd"&&(<>
          <div>
            <div style={{background:C.brun,borderRadius:16,padding:"2rem 1.4rem",marginBottom:"1rem",textAlign:"center",position:"relative",overflow:"hidden"}}>
              <div style={{position:"absolute",top:"50%",left:"50%",transform:"translate(-50%,-50%)",width:200,height:200,borderRadius:"50%",background:"rgba(196,154,138,.05)"}}/>
              <div style={{position:"relative",fontSize:".58rem",fontWeight:700,letterSpacing:".25em",color:C.or,marginBottom:".5rem"}}>✦ NOTRE ÉQUIPE ✦</div>
              <div style={{position:"relative",fontFamily:"Georgia,serif",fontSize:"clamp(2rem,6vw,2.8rem)",fontWeight:300,color:C.blanc,lineHeight:1}}>Blazing</div>
              <div style={{position:"relative",fontFamily:"Georgia,serif",fontSize:"clamp(2rem,6vw,2.8rem)",fontStyle:"italic",color:C.pale,lineHeight:1.1}}>Dynasty</div>
              <div style={{width:48,height:1,background:C.or,margin:".9rem auto"}}/>
              <p style={{position:"relative",fontSize:".77rem",color:C.pale,opacity:.85,lineHeight:1.7,maxWidth:380,margin:"0 auto"}}>
                Une équipe de femmes et d'hommes ambitieux, bienveillants et déterminés. Pas juste un groupe — une famille qui avance ensemble vers la liberté financière.
              </p>
            </div>
            {[
              ["🌍","Une équipe internationale","Présente en France, au Portugal et au-delà. Nous grandissons ensemble, sans frontières."],
              ["💎","L'excellence comme standard","Pas pour être parfaite — pour être la meilleure version de soi. Chaque jour un peu plus."],
              ["🤝","L'entraide avant tout","Ici on ne laisse personne derrière. Si tu avances, tu tends la main à celles qui arrivent après toi."],
              ["🔥","L'ambition assumée","Nous ne nous excusons pas d'avoir des objectifs. Nous les partageons, nous nous y tenons, nous les atteignons."],
              ["👑","Des leaders, pas des vendeuses","Blazing Dynasty forme des entrepreneures et des leaders de réseau."],
            ].map(([icon,title,desc])=>(
              <div key={title} style={{display:"flex",gap:".65rem",marginBottom:".65rem",alignItems:"flex-start",background:C.blanc,borderRadius:12,padding:".75rem",border:`1px solid ${C.pale}`}}>
                <div style={{width:30,height:30,borderRadius:"50%",background:C.pale,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".85rem",flexShrink:0}}>{icon}</div>
                <div><div style={{fontSize:".8rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
              </div>
            ))}
            <div style={{background:C.brun,borderRadius:14,padding:"1.2rem",marginBottom:".75rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.or,marginBottom:".65rem"}}>✦ Nos valeurs</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem"}}>
                {["Authenticité","Ambition","Bienveillance","Excellence","Liberté","Sororité"].map(v=>(
                  <div key={v} style={{background:"rgba(196,168,130,.12)",borderRadius:8,padding:".4rem .65rem",fontSize:".72rem",fontWeight:600,color:C.pale,textAlign:"center"}}>✦ {v}</div>
                ))}
              </div>
            </div>
            <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.12),rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"Seule on va plus vite. Ensemble on va plus loin."</div>
              <div style={{fontSize:".63rem",color:C.gris,marginTop:".4rem"}}>— Blazing Dynasty</div>
            </div>
          </div>
          <div>
            <SecTitle title="Comprendre" em="Mihi" desc="L'essentiel sur la marque, les gammes et comment construire ton revenu."/>
            <Card title="Qui est Mihi ?" sub="Histoire · Valeurs · Forces" icon="🏢" color={C.or} defaultOpen>
              <Info color={C.or}>Mihi est une marque polonaise de bien-être, beauté et soins, portée par le laboratoire pharmaceutique <strong>ElfaPharm</strong>. Des produits avec de vraies études scientifiques derrière.</Info>
              {[
                ["🧬","Fondée par ElfaPharm","Un laboratoire pharmaceutique sérieux. Ce n'est pas du marketing — il y a une vraie R&D derrière les produits."],
                ["🌍","Présente dans 30+ pays","Une marque qui grandit vite, avec des produits testés et approuvés sur plusieurs marchés européens."],
                ["💎","Rapport qualité/prix","Des produits comparables aux grandes marques de pharmacie, à des prix distributeur compétitifs."],
                ["🔄","Modèle de vente directe","Tu distribues en direct, tes clientes commandent sur ta boutique personnelle. Pas de stock obligatoire."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:28,height:28,borderRadius:"50%",background:C.pale,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".8rem",flexShrink:0}}>{icon}</div>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Les gammes Mihi" sub="Ce que tu peux vendre" icon="💄" color={C.lilas}>
              {[
                ["✨","Skincare — Soin visage","Crèmes anti-âge, sérums, contour des yeux, gommages visage, mousses nettoyantes. Des soins avec de vraies actifs à des prix accessibles."],
                ["💇","Soins cheveux","Shampoings réparateurs, baumes, soins capillaires. Résultats visibles rapidement. Argument fort : résultats comparables aux marques pro, prix bien inférieurs."],
                ["💄","Make-up","Mascara volume, fond de teint matifiant, rouge à lèvres longue tenue. Qualité professionnelle. Facile à démontrer, facile à vendre."],
                ["💊","Compléments alimentaires & Perte de poids","Détox, brûle-graisses, booster de métabolisme, ginkgo biloba, vitamines. Gamme très demandée. Les résultats créent de la fidélité."],
                ["🌸","Parfums","Des jus de qualité, comparables aux grandes marques, à moins de 20€. C'est l'argument qui surprend tout le monde et crée des ventes immédiates."],
                ["🧴","Soin corps","Gommages effet or, baumes satinés, enveloppements. Un rituel luxueux à prix accessible. Parfait pour les box surprises et cadeaux."],
                ["🏠","HOME — Soins maison","Produits d'entretien naturels, désodorisants, soins textiles. Une gamme innovante pour celles qui veulent vendre à toute la famille, pas seulement sur la beauté."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".5rem",padding:".6rem .7rem",background:C.creme,borderRadius:9,border:`1px solid ${C.pale}`}}>
                  <span style={{fontSize:"1.1rem",flexShrink:0}}>{icon}</span>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".7rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Comment gagner de l'argent avec Mihi" sub="Le plan de rémunération détaillé" icon="💰" color={C.or}>
              <Info color={C.or}>Il y a <strong>3 façons</strong> de gagner de l'argent avec Mihi, cumulables. Plus tu avances dans les deux, plus ton revenu est stable et croissant.</Info>

              <div style={{background:C.brun,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>💰 Levier 1 — Vente directe</div>
                {[
                  ["Prix distributeur","Tu achètes les produits avec une remise de 20 à 30% sur le prix catalogue selon ton statut."],
                  ["Ta marge","Tu revends au prix catalogue. Ta marge = 20 à 30% du prix de vente. Ex : un produit à 40€ catalogue → tu l'achètes ~28-32€ → tu gagnes 8-12€ par vente."],
                  ["Pas de minimum","Pas de stock obligatoire, pas de commande minimum. Tu commandes ce que tes clientes ont commandé."],
                  ["Immédiat","Le bénéfice est direct, dès ta première vente. Pas de palier à atteindre."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.pale,lineHeight:1.5}}><strong style={{color:C.or}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:C.brun2,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>👥 Levier 2 — Commissions équipe</div>
                {[
                  ["Comment ça marche","Tu recrutes des distributrices dans ton équipe. À chaque commande qu'elles passent, tu touches un pourcentage sur leur volume."],
                  ["Revenu passif","Même quand tu ne travailles pas, ton équipe génère du volume. C'est la base de la liberté financière."],
                  ["Duplication","Plus ton équipe recrute à son tour, plus ta structure grandit et plus tes commissions augmentent — sans que tu aies à faire plus de travail direct."],
                  ["Profondeur","Tu touches des commissions sur plusieurs niveaux de ton équipe selon ton statut de qualification."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.pale,lineHeight:1.5}}><strong style={{color:C.or}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:"rgba(196,168,130,.12)",border:`1px solid ${C.or}40`,borderRadius:10,padding:".85rem 1rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}>🏆 Levier 3 — Bonus et qualifications</div>
                {[
                  ["Bonus de démarrage","Quand tu démarres fort les 90 premiers jours, Mihi te verse des bonus supplémentaires sur ton volume personnel et équipe."],
                  ["Bonus mensuel","À chaque mois où tu atteins les objectifs de ton palier, tu touches un bonus en plus de tes commissions."],
                  ["Paliers de qualification","Distributrice → Senior → Directrice → Senior Directrice → Directrice Business. Chaque palier = plus de pourcentages et plus de bonus."],
                  ["Voyages & récompenses","Les meilleurs rangs ont accès à des voyages et événements offerts par Mihi."],
                ].map(([t,d])=>(
                  <div key={t} style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
                    <span style={{color:C.or,flexShrink:0,fontSize:".75rem"}}>✦</span>
                    <div style={{fontSize:".73rem",color:C.texte,lineHeight:1.5}}><strong style={{color:C.brun}}>{t} :</strong> {d}</div>
                  </div>
                ))}
              </div>

              <div style={{background:C.brun,borderRadius:9,padding:".7rem .9rem",fontSize:".74rem",color:C.pale,lineHeight:1.65}}>
                💡 <strong style={{color:C.or}}>Exemple concret :</strong> Tu vends 500€ de produits ce mois → tu gardes ~125-150€ de marge. Ton équipe génère 2 000€ de volume → tu touches ~100-200€ de commissions en plus. Total : 225-350€ pour ce mois. Plus ton équipe grandit, plus le ratio s'inverse en ta faveur.
              </div>
            </Card>

            <Card title="Les programmes clients Mihi" sub="Tes arguments de vente — détails complets" icon="🎁" color={C.rose}>
              <Info>Ces programmes sont tes <strong>arguments de vente et de fidélisation</strong>. Connais-les par cœur — une cliente bien informée revient toujours.</Info>

              {[
                {icon:"🎁",title:"Welcome Bonus",tag:"1ʳᵉ commande",color:C.rose,details:[
                  "5 € offerts automatiquement sur le compte promo de chaque nouvelle cliente, dès l'inscription.",
                  "Un set de produits best-sellers disponible pour les débutants à prix réduit.",
                  "Des échantillons offerts pour toute commande passée dans les 24h après l'inscription.",
                  "👉 Comment l'utiliser : \"En t'inscrivant via mon lien aujourd'hui, tu reçois 5 € sur ta première commande. C'est automatique, pas de code promo.\"",
                ]},
                {icon:"♾️",title:"Infinity Bonus",tag:"Fidélité",color:C.lilas,details:[
                  "À partir de la 2ᵉ commande : dès 40 € de commande au prix catalogue, ta cliente choisit 1 produit du catalogue avec -70%.",
                  "Ce bonus est ILLIMITÉ — il se renouvelle à chaque période, tant qu'elle commande.",
                  "Si elle saute une période : elle doit recommander 2 périodes consécutives pour retrouver le droit.",
                  "Tous les produits sont éligibles sauf les sets et les produits \"Extra\".",
                  "👉 Comment l'utiliser : \"À chaque commande de 40 €, tu as le droit de choisir un produit à -70 %. Ça fait souvent une valeur de 20-30 € offerts.\"",
                ]},
                {icon:"🎟️",title:"Token Store",tag:"Ton outil de réachat",color:C.or,details:[
                  "Tu achètes des tokens avec ton compte promo ou ton Recruitment Bonus, et tu les envoies à tes clientes.",
                  "3 types de tokens : 5 € en cadeau (coûte 2 € pour toi) · Produit offert (2,50 €) · Remise -70% (0,50 €).",
                  "Le token est valable 24h après envoi. Si la cliente ne l'utilise pas → tu es remboursée automatiquement.",
                  "Fonctionne sur commande minimum de 40 €.",
                  "👉 Quand l'utiliser : pour relancer une cliente silencieuse, anniversaire, après une vente réussie, ou pour déclencher une 1ʳᵉ commande.",
                ]},
                {icon:"💰",title:"Recruitment Bonus",tag:"Pour toi en tant que distributrice",color:C.brun,details:[
                  "À chaque période où tu enregistres au moins 1 nouveau client avec une commande : 5 € crédités dans ton Token Store.",
                  "Ces 5 € servent directement à acheter des tokens pour tes clientes.",
                  "Non cumulatif sur plusieurs nouveaux clients — c'est 5 € fixe par période active.",
                  "👉 Utilité directe : recrute des clientes régulièrement pour alimenter ton Token Store sans bourse délier.",
                ]},
                {icon:"🛍️",title:"Smart Shopping Program",tag:"Automatique",color:C.lilas,details:[
                  "L'IA Mihi analyse les achats de chaque cliente et lui envoie automatiquement un SMS personnalisé.",
                  "L'offre : -50 % sur un produit de sa commande précédente, valable 24h.",
                  "En plus : une recommandation pop-up au moment du panier avec +5 % de remise sur un produit complémentaire.",
                  "Tu n'as rien à faire — mais informe tes clientes que ce programme existe pour qu'elles commandent à chaque période.",
                  "👉 Argument vente : \"Mihi t'envoie automatiquement des offres -50% sur tes produits préférés. Raison de plus de commander régulièrement.\"",
                ]},
                {icon:"👑",title:"Premium Club",tag:"Statut VIP",color:C.or,details:[
                  "Statut accessible aux clientes qui commandent régulièrement des volumes importants.",
                  "Avantages exclusifs : accès à des produits et sets réservés aux membres Premium, remises spéciales, privilèges.",
                  "👉 Comment le vendre : propose-le comme une récompense à tes meilleures clientes. \"Tu commandes souvent — tu mérites le statut Premium Club avec des avantages exclusifs.\"",
                ]},
              ].map(prog=>(
                <div key={prog.title} style={{background:C.creme,borderRadius:10,padding:".8rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".55rem"}}>
                    <span style={{fontSize:"1.1rem"}}>{prog.icon}</span>
                    <div style={{fontSize:".82rem",fontWeight:600,color:C.brun,flex:1}}>{prog.title}</div>
                    <span style={{background:prog.color+"22",color:prog.color===C.or?C.brun2:prog.color,fontSize:".55rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:".13rem .4rem",borderRadius:20}}>{prog.tag}</span>
                  </div>
                  {prog.details.map((d,i)=>(
                    <div key={i} style={{fontSize:".72rem",color:d.startsWith("👉")?C.brun:C.gris,lineHeight:1.6,marginBottom:".28rem",fontWeight:d.startsWith("👉")?600:400,fontStyle:d.startsWith("👉")?"italic":"normal"}}>{d}</div>
                  ))}
                </div>
              ))}
            </Card>
          </div>
        </>)}


        {tab==="formation"&&formationSubTab==="demarrage"&&(
          <div>
            <SecTitle title="Formation" em="Démarrage Rapide" desc="7 modules — le même parcours que le Fast Start, avec les scripts complets pour chaque étape."/>
            <AdminContentBlock onglet="demarrage" items={adminItems}/>

            {FAST_START_DAYS.map(d=>{
              const checkId=`demarrage-module-${d.jour}`;
              const done=checks[checkId];
              const quiz=FAST_START_QUIZ.find(q=>q.jour===d.jour);
              return(
                <Card key={d.jour} title={d.titre} sub={quiz?.exercice||""} icon={done?"✅":`${d.jour}`} color={done?C.vert:C.rose}>
                  <div onClick={()=>tog("checks",checkId)}
                    style={{display:"flex",alignItems:"center",gap:".6rem",background:done?C.vert+"15":C.creme,borderRadius:9,padding:".55rem .8rem",marginBottom:".75rem",cursor:"pointer",border:`1px solid ${done?C.vert:C.pale}`}}>
                    <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${done?C.vert:C.gris}`,background:done?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {done&&<span style={{fontSize:".65rem",color:"white",fontWeight:700}}>✓</span>}
                    </div>
                    <span style={{fontSize:".75rem",fontWeight:600,color:done?C.vert:C.gris}}>{done?"✅ Module terminé !":"Cocher quand le module est terminé"}</span>
                  </div>

                  {/* Vidéo du module */}
                  {(()=>{
                    const vKey=`module${d.jour}`;
                    const vData=adminVideosFastStart[vKey];
                    return(
                      <div style={{marginBottom:".75rem"}}>
                        {vData?.url
                          ? <a href={vData.url} target="_blank" rel="noopener noreferrer"
                              style={{display:"flex",alignItems:"center",gap:".6rem",background:C.brun,borderRadius:10,padding:".6rem .9rem",textDecoration:"none"}}>
                              <span style={{fontSize:"1rem"}}>▶</span>
                              <div>
                                <div style={{fontSize:".78rem",fontWeight:700,color:C.blanc}}>Regarder la vidéo</div>
                                <div style={{fontSize:".62rem",color:C.pale}}>Module {d.jour} — {vData.type==="youtube"?"YouTube":vData.type==="drive"?"Drive":"Vidéo"}</div>
                              </div>
                            </a>
                          : <div style={{display:"flex",alignItems:"center",gap:".5rem",background:C.creme,borderRadius:9,padding:".55rem .8rem",fontSize:".72rem",color:C.gris,fontStyle:"italic",border:`1px solid ${C.pale}`}}>
                              🎬 Vidéo à venir — disponible prochainement
                            </div>
                        }
                      </div>
                    );
                  })()}

                  {/* Tâches du module */}
                  <div style={{marginBottom:".75rem"}}>
                    <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>📋 Tâches</div>
                    {d.taches.map((t,i)=>{
                      const label=typeof t==="object"?t.t:t;
                      return(
                        <div key={i} style={{display:"flex",gap:".55rem",padding:".42rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`}}>
                          <div style={{width:19,height:19,borderRadius:"50%",background:C.rose+"22",color:C.rose,fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{i+1}</div>
                          <div style={{fontSize:".75rem",color:C.texte,lineHeight:1.45,flex:1}}>{label}</div>
                        </div>
                      );
                    })}
                  </div>

                  {/* Exercice */}
                  {quiz?.exercice&&(
                    <div style={{marginBottom:".75rem"}}>
                      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>✦ Exercice de validation</div>
                      <div style={{background:C.lilas+"15",border:`1px solid ${C.lilas}30`,borderRadius:9,padding:".6rem .85rem",fontSize:".76rem",color:C.texte,lineHeight:1.55}}>
                        {quiz.exercice}
                      </div>
                    </div>
                  )}

                  {/* Quiz */}
                  {quiz?.quiz&&(
                    <div>
                      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>📊 Quiz de validation ({quiz.quiz.length} questions)</div>
                      {quiz.quiz.map((q,i)=>(
                        <div key={i} style={{padding:".4rem 0",borderBottom:`1px solid ${C.pale}`}}>
                          <div style={{fontSize:".74rem",fontWeight:600,color:C.brun,marginBottom:".3rem"}}>{i+1}. {q.q}</div>
                          {q.options.map((opt,j)=>(
                            <div key={j} style={{fontSize:".7rem",color:j===q.rep?C.vert:C.gris,padding:".15rem 0",paddingLeft:".5rem",fontWeight:j===q.rep?700:400}}>
                              {j===q.rep?"✓ ":"○ "}{opt}
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </Card>
              );
            })}
          </div>
        )}


        {/* ── VENTE ── */}
        {tab==="formation"&&formationSubTab==="vente"&&(
          <div>
            <SecTitle title="Vente &" em="Stratégies" desc="Tout pour vendre plus, fidéliser tes clientes et booster ton activité."/>
            <AdminContentBlock onglet="vente" items={adminItems}/>

            <Card title="Replays Zoom Vente" sub="Les sessions de formation vente" icon="🎥" color={C.or} defaultOpen>
              <Btn href="https://us06web.zoom.us/rec/share/3i2Txz0KmPwoECQyE7ADbkCr_kDej-QYp_7vW2_YmzpWGSnkipRh5-v7t7oa6r2U.czfOEisyPOYCjYsG" label="Tips de vente + comprendre son pourquoi" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/IFStg6CC8vBngO3HPu9G5fh91zV9W6fuwaR3txBwRc96v7vO0-azbiea2eA-d1Hf.MgYK9kyFy7z2kIHB" label="Comment faire ses Lives + déclencher des ventes" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/RwAb_48QbKt_jrn_91SJbfXZ8Sf8shCOpxzixhX0HdElfb4xDOU9nBEq-OdNms2b.RRxzRJZ53fmbvprr" label="Les réunions à domicile" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/nMz-EPawKi9Iz7vnwqFELpJaK6kJH2aXLaE-evMxN9KiPzBuRIjbmrA77-e41RMv.wpFb79BqNh9yETMe" label="Comment parler des produits (exercice équipe)" icon="▶" color={C.brun}/>
            </Card>

            <Card title="Stratégies de vente" sub="Les méthodes qui marchent" icon="💡" color={C.or}>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>📁 Documents stratégies</div>
              <DocBtn href="https://docs.google.com/document/d/1BMF1FiXl7HTjQ-kIJYNl_cHh-J-K1Mk5irfunsN6s4c/edit" label="Stratégie Enveloppe Mystère — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1XkJRZMArmWqTy11xCTaJagR4s-vEOdtL/view" label="Stratégie Catalogue — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/19wRJArnlDVpzBd1RFxefJCvNcTStFS_TeMNzBe6SUnc/edit" label="Stratégie Catalogue — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1S7IMHB9xUqY43JQRuqa8mtlqY7kabv8t/view" label="Stratégie Défi Live — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/1B9b2O7W2crNlRSgTub1QQ1h_lSn87kgGf7Q8dng_nwo/edit" label="Stratégie Défi Live — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1KldVcCgrfLjirxVZjyXtFCpECinKevWs/view" label="Stratégie Liste — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/1-GSGmYlH9eyIWn-QjUW8JdGDmN7-ZtA-CfWyMO8AF6s/edit" label="Stratégie C'est Interdit 🔥"/>
            </Card>

            <Card title="Idées pour booster ses ventes" sub="Méthodes créatives et efficaces" icon="🚀" color={C.rose}>
              {[
                ["📦","Box surprises","La cliente choisit un montant (ex: 30€, 50€, 80€). Tu crées une box surprise avec des produits adaptés. Avantage : tu décides de la marge, tu mets en valeur les produits, effet cadeau = émotion = réachat.","Comment vendre ça : \"Tu me donnes un budget, je te crée une box personnalisée avec ce que j'aurai choisi spécialement pour toi. Parfait pour s'offrir ou offrir.\""],
                ["🎰","Tombola produits","La tombola s'auto-finance : les billets paient le lot. Objectif : faire découvrir les produits à de nouvelles personnes. 1 billet = 1 produit Mihi à tester. Les gagnantes deviennent souvent des clientes.","Organisation : 10 billets à 3€ = 30€. Tu achètes le lot à prix distributeur (~15€). Bénéfice réel = 5 nouvelles personnes qui ont découvert les produits."],
                ["🎒","Palette voyageuse","Une trousse avec des échantillons, produits phares, le catalogue et un bon de commande. Tu la fais circuler dans ton entourage (famille, collègues, voisines). Chaque personne la garde 48h.","Résultat : des ventes sans sortir de chez toi. Les gens touchent, testent, commandent."],
                ["🧪","Offre testeurs","Tu recherches 5 personnes pour tester une nouvelle gamme à prix coûtant. Objectif : créer de la preuve sociale et fidéliser. En échange : un témoignage honnête.","Comment le pitcher : \"Je recherche 5 femmes pour tester la nouvelle gamme Face Architect à prix coûtant. En échange, juste ton retour honnête. Intéressée ?\""],
                ["🎮","Jeu concours","Un jeu simple sur tes stories (sondage, devinette, tirage au sort). Le lot = un produit Mihi. Objectif : engagement + visibilité + nouvelles personnes.","Règle d'or : le jeu doit être simple (une action max), le lot doit être désirable, et tu dois relancer les participantes en DM après."],
              ].map(([icon,title,desc,tip])=>(
                <div key={title} style={{background:C.creme,borderRadius:10,padding:".8rem",marginBottom:".65rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"flex-start",marginBottom:".4rem"}}>
                    <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div>
                  </div>
                  <p style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,marginBottom:".35rem"}}>{desc}</p>
                  <div style={{background:C.blanc,borderRadius:7,padding:".5rem .65rem",fontSize:".71rem",color:C.brun,lineHeight:1.6,fontStyle:"italic",borderLeft:`2px solid ${C.or}`}}>{tip}</div>
                </div>
              ))}
            </Card>

            <Card title="Groupe Messenger clientes" sub="Comment gérer ta communauté cliente" icon="💬" color={C.lilas}>
              <Info color={C.lilas}>Un groupe Messenger bien géré = des clientes engagées qui reviennent. Un groupe mal géré = désengagement et sorties silencieuses.</Info>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.vert,marginBottom:".4rem"}}>✅ À faire</div>
              {["Présenter le groupe dès l'arrivée d'une nouvelle cliente (ton nom, ce que tu partages ici)","Partager des contenus utiles et valorisants (tips beauté, routine, offres en cours)","Annoncer les nouvelles gammes et les programmes clients Mihi","Créer de l'interaction (sondages, questions, avis produits)","Célébrer les résultats des clientes (avant/après, témoignages)","Partager les promotions Mihi (Infinity Bonus, Smart Shopping, tokens)"].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem",alignItems:"flex-start",fontSize:".75rem",color:C.texte}}>
                  <span style={{color:C.vert,flexShrink:0}}>✓</span>{item}
                </div>
              ))}
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#B04040",marginBottom:".4rem",marginTop:".7rem"}}>❌ À ne pas faire</div>
              {["Spammer avec des promotions tous les jours","Copier-coller des messages génériques Mihi sans personnalisation","Ignorer les questions ou mettre du temps à répondre","Partager des prix sans contexte (toujours montrer la valeur avant le prix)","Créer plusieurs groupes pour la même clientèle (confusion)"].map((item,i)=>(
                <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem",alignItems:"flex-start",fontSize:".75rem",color:C.texte}}>
                  <span style={{color:"#B04040",flexShrink:0}}>✗</span>{item}
                </div>
              ))}
            </Card>

            <Card title="Base du suivi client" sub="Ne plus jamais perdre une cliente" icon="📊" color={C.or}>
              <Info color={C.or}>Une cliente qui ne commande plus n'est pas perdue — elle est juste oubliée. Le suivi c'est ce qui fait la différence entre une activité qui stagne et une qui grandit.</Info>
              {[
                ["Après la 1ʳᵉ commande","Message de remerciement dans les 24h. Demande si tout s'est bien passé. Propose un conseil d'utilisation."],
                ["À J+7","Comment elle trouve les produits ? Elle a des questions ? C'est le moment de créer le lien."],
                ["À J+21","Avant la prochaine période : \"La nouvelle période Mihi arrive, tu veux que je te prévienne des offres en cours ?\""],
                ["Si silence +30j","Relance avec un token ou une offre personnalisée. \"J'ai pensé à toi pour cette offre — ça correspond à ce que tu avais aimé.\""],
                ["À chaque anniversaire","Un message personnel. Un token en cadeau si possible. Les petites attentions créent la fidélité à vie."],
              ].map(([moment,action],i)=>(
                <div key={i} style={{display:"flex",gap:".6rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.or+"30",color:C.brun2,fontSize:".58rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:2}}>{i+1}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{moment}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{action}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Les Lives — Guide complet" sub="Différentes idées, comment varier" icon="🎥" color={C.rose}>
              {[
                ["🌟","Live démo produit","Tu montres un produit en live, tu l'appliques sur toi, tu réponds aux questions. Le plus simple et le plus efficace.","Durée : 20-30 min. Annonce 24h avant. Commence même si peu de monde."],
                ["❓","Live FAQ","\"Je réponds à toutes vos questions sur [thème].\" Collect les questions avant en story.","Crée de la confiance et de l'expertise. Les spectatrices reviennent."],
                ["🎯","Live défi en direct","\"Ce soir on fait le défi [teint parfait / cheveux brillants] ensemble.\" Chacune montre son avant.","Engagement maximal. Les participantes deviennent des ambassadrices."],
                ["🛍️","Live vente flash","\"Ce soir seulement, offre spéciale sur [produit].\" Crée l'urgence.","Ne pas en abuser. Réserver aux occasions : nouvelle gamme, fin de période, anniversaire."],
                ["📖","Live storytelling","Tu racontes ton histoire : pourquoi tu as rejoint Mihi, tes galères, tes victoires.","C'est le live le plus puissant pour le recrutement. L'authenticité convertit."],
              ].map(([icon,title,desc,tip])=>(
                <div key={title} style={{background:C.creme,borderRadius:10,padding:".75rem",marginBottom:".6rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",marginBottom:".3rem"}}><span>{icon}</span><div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div></div>
                  <p style={{fontSize:".73rem",color:C.texte,lineHeight:1.6,marginBottom:".3rem"}}>{desc}</p>
                  <div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic",borderLeft:`2px solid ${C.rose}`,paddingLeft:".5rem"}}>{tip}</div>
                </div>
              ))}
            </Card>
          </div>
        )}

        {/* ── RECRUTEMENT ── */}
        {tab==="formation"&&formationSubTab==="recrutement"&&(
          <div>
            <SecTitle title="Recrutement &" em="Affiliation" desc="Stratégies, diagnostique, affiliation — tout pour développer ton équipe."/>
            <AdminContentBlock onglet="recrutement" items={adminItems}/>

            <Card title="Replays Zoom Recrutement" sub="Les sessions formation recrutement" icon="🎥" color={C.rose} defaultOpen>
              <Btn href="https://us06web.zoom.us/rec/share/viyM_OY-wZkKDCyLj-qhIEbIiDv1Yl7j06l9WctzEbvdOS6YPyNJ8RbKKINR5wcO.m5X0v3XgsWBn0ymc" label="Outils de démarrage & recrutement" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL" label="Communiquer différemment pour passer au niveau supérieur" icon="▶" color={C.brun}/>
              <Btn href="https://us06web.zoom.us/rec/share/Ifld2R1bAsLQ1bJKuj0mr80yNxPt5kPOKAapDNv5jJundkKNIXrdr7de0H0Cn_qR.Yqhq_7quf10A7wtw?startTime=1774984148000" label="Stratégie — Je ne dois pas te le dire mais... 🔥" icon="▶" color={C.brun}/>
            </Card>

            <Card title="Parler de Mihi & Blazing Dynasty" sub="Comment présenter l'opportunité sans mentir ni survendre" icon="🔥" color={C.brun} defaultOpen>
              <Info color={C.brun}>Ne vends pas un rêve — partage une réalité concrète. Les gens sentent le baratin à 10km. Sois précise, honnête, et laisse l'opportunité parler d'elle-même.</Info>
              {[
                ["🏢","Mihi, c'est quoi exactement","Mihi est une marque française de beauté et bien-être (parfums, skincare, compléments, minceur) lancée en 2022, fabriquée par ElfaPharm — un vrai laboratoire pharmaceutique présent dans 62 pays. Ce n'est pas une startup fantôme : derrière les produits, il y a une vraie expertise pharmaceutique. Dis-le simplement : \"Je vends une marque française fabriquée par un laboratoire pharma, pas un produit fabriqué dans un garage.\""],
                ["🌟","Pourquoi Blazing Dynasty et pas une autre équipe","Blazing Dynasty, c'est l'équipe que tu rejoins, pas juste un statut de distributrice isolée. Tu n'es jamais seule : formation complète (cette appli en est la preuve), accompagnement personnalisé par ta marraine, communauté de femmes qui s'entraident. Le discours : \"Tu ne rejoins pas juste Mihi, tu rejoins une équipe qui te forme et t'accompagne vraiment.\""],
                ["💰","Le modèle économique honnête","Sois transparente sur le modèle : tu gagnes sur tes propres ventes ET sur celles de l'équipe que tu formes. Ce n'est ni un système pyramidal (pas de gain juste à recruter sans vendre) ni un emploi salarié classique. C'est de la vente directe avec effet de levier d'équipe. Dis : \"Plus tu vends et plus tu aides ton équipe à vendre, plus tu gagnes — c'est aussi simple que ça.\""],
                ["🎯","Pour qui c'est fait","Sois honnête sur le profil idéal : quelqu'un qui veut un complément de revenu flexible, qui aime le contact humain, et qui est prête à apprendre. Ce n'est pas pour quelqu'un qui cherche un revenu garanti sans effort. \"Si tu cherches 2-10h par semaine pour développer un vrai revenu complémentaire avec un vrai accompagnement, on devrait parler.\""],
                ["🙅","Ce qu'il ne faut JAMAIS dire","Jamais de promesse de revenu garanti, jamais \"deviens riche vite\", jamais cacher que c'est un investissement de départ (kit) et de temps. La confiance se construit sur l'honnêteté, pas sur le rêve qui s'effondre au premier mois difficile."],
                ["💬","La phrase d'accroche qui fonctionne","\"Je fais partie d'une équipe qui vend les produits Mihi, une marque française fabriquée par un vrai labo pharmaceutique. On est plusieurs femmes à se former et s'entraider pour développer une activité flexible à côté. Si jamais ça t'intéresse de voir comment ça marche, je peux t'expliquer sans pression.\""],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{background:C.creme,borderRadius:9,padding:".7rem .85rem",marginBottom:".55rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",marginBottom:".3rem",alignItems:"flex-start"}}>
                    <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div>
                  </div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.65}}>{desc}</div>
                </div>
              ))}
            </Card>

            <Card title="Stratégies pour attirer" sub="Comment attirer les bonnes personnes naturellement" icon="🧲" color={C.or}>
              <Info color={C.or}>Attirer c'est mieux que convaincre. Ces stratégies créent un flux entrant de personnes intéressées — sans avoir à courir après.</Info>
              {[
                ["🪝","Le profil qui attire","Ton profil Instagram/Facebook doit répondre à une question en 3 secondes : qui est cette personne et pourquoi je devrais la suivre ? Photo pro + bio qui parle à ta cible + lien Linktree. Sans ça, tout le reste ne sert à rien."],
                ["📖","Le storytelling quotidien","Partage ton histoire — tes galères, tes doutes, tes victoires. Les gens ne s'identifient pas à la perfection. Ils s'identifient à l'authenticité. Une distributrice qui raconte sa transformation attire plus que dix publications produit."],
                ["🔥","Le contenu de preuve","Témoignages clientes, résultats visuels, before/after, messages reçus. La preuve sociale est le moteur n°1 du désir. Partage tout ce qui montre que ça marche — pas en te vantant, mais en partageant."],
                ["🎯","Les hooks qui interpellent","Ta 1ʳᵉ phrase sur chaque publication doit stopper le scroll. \"Je ne cherchais pas un 2ᵉ emploi.\" \"Il y a 6 mois je ne savais pas quoi faire.\" \"Ce que personne ne te dit sur le marketing relationnel.\" La curiosité attire."],
                ["💬","L'interaction stratégique","Commente des publications de ta cible avec de vrais commentaires — pas des emojis. Réponds à toutes les stories. Pose des questions en DM sans pitcher. Crée la relation avant la proposition."],
                ["⚡","Le mot-clé en commentaire","Sur chaque publication opportunité, ferme avec un mot-clé : \"Écris ÉQUIPE en commentaire\". Tu ne réponds qu'aux personnes qui ont montré de l'intérêt. Qualité > quantité."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{background:C.creme,borderRadius:9,padding:".7rem .85rem",marginBottom:".55rem",border:`1px solid ${C.pale}`}}>
                  <div style={{display:"flex",gap:".5rem",marginBottom:".3rem",alignItems:"flex-start"}}>
                    <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun}}>{title}</div>
                  </div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.6}}>{desc}</div>
                </div>
              ))}
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem",marginTop:".5rem"}}>📹 Vidéos diagnostic à envoyer selon le profil</div>
              <DriveBtn href="https://drive.google.com/file/d/1oNIJBA9XKsZjB7idX_xV4oWxgzhHGST9/view" label="👉 Je veux m'affilier — vidéo à envoyer"/>
              <DriveBtn href="https://drive.google.com/file/d/18YRagfzUyTrlarrABNHJouqwUlzC948x/view" label="👉 Vidéo sur l'affiliation"/>
              <DriveBtn href="https://drive.google.com/file/d/1rm5kaTh90zhbd50dYjHxBVi10ud1wqqg/view" label="👉 Je ne veux pas m'affilier — vidéo à envoyer"/>
              <DriveBtn href="https://drive.google.com/file/d/1UvvOQuRetaJymObMLnuxRz6_RzvxOwBT/view" label="👉 Vidéo complémentaire"/>
            </Card>

            <Card title="Stratégies de recrutement" sub="Les méthodes avec documents complets" icon="📁" color={C.lilas}>
              <DriveBtn href="https://drive.google.com/file/d/1dLOGuCg-LkiOX-YUsW_Bce5pr3mwYPVN/view" label="Démarcher — Vidéo"/>
              <DocBtn href="https://docs.google.com/document/d/19GWloCMuOPG8Q_7UQTmTph6AyCMnPWNVTywqRIQPaLY/edit" label="Démarcher — Document complet"/>
              <DriveBtn href="https://drive.google.com/file/d/1WutnDp_no7zU-mmGEgWsiVq7cJ6j7LkA/view" label="Démarcher — Vidéo complémentaire"/>
            </Card>

            <Card title="Récap outils de l'équipe" sub="Tout ce que l'équipe utilise au quotidien" icon="📋" color={C.or}>
              <DocBtn href="https://docs.google.com/document/d/1BU0MH-AcaiWTn1eODBKppavTI8g_77jN833sasmfwU8/edit" label="📋 Récapitulatif complet des outils de l'équipe"/>
              <Info color={C.or}>Ce document contient la liste de tous les outils, liens et ressources utilisés par l'équipe Blazing Dynasty. Garde-le sous la main.</Info>
            </Card>
          </div>
        )}

        {/* ── CONTENU ── */}
        {tab==="formation"&&formationSubTab==="contenu"&&(
          <div>
            <SecTitle title="Contenu &" em="Stratégie" desc="Personal branding, storytelling, mixing contenu — et ton tableau d'idées à cocher."/>
            <AdminContentBlock onglet="contenu" items={adminItems}/>

            <Card title="Formations vidéo Contenu" sub="YouTube · Les bases à connaître" icon="▶" color={C.lilas} defaultOpen>
              <YTBtn href="https://youtu.be/76SKVl4lHsw" label="📸 Comment se prendre en photo pour se mettre en valeur"/>
              <YTBtn href="https://youtu.be/j5EUiKmUSgM" label="👤 Le Personal Branding — Construire ton image"/>
              <YTBtn href="https://youtu.be/WxJFBnigjpw" label="🤝 Humaniser son contenu — Pourquoi et comment"/>
              <YTBtn href="https://youtu.be/dgylHebkai4" label="📖 Le Storytelling — Raconter pour vendre"/>
              <YTBtn href="https://youtu.be/JCgNdVywUME" label="📱 Comprendre les réseaux sociaux"/>
              <YTBtn href="https://youtu.be/6g0k-ET_lW8" label="🎯 Définir sa cible — Vente et recrutement"/>
            </Card>

            <Card title="Mixer ses publications" sub="La règle du mix pour ne pas lasser" icon="🔄" color={C.rose}>
              <Info>La règle de base : sur 10 publications, <strong>4 produits · 3 vie perso/storytelling · 2 opportunité · 1 divertissement/interaction</strong>. Ne jamais être mono-thème.</Info>
              {[
                ["💄","Contenu Produit (40%)","Démo, avant/après, routine, astuce d'utilisation, témoignage cliente, résultat concret. Toujours avec un CTA (mot-clé en commentaire, DM, lien)."],
                ["🌸","Storytelling & Vie perso (30%)","Ton histoire, tes doutes, tes victoires, ta famille, tes valeurs. Ce que les gens ne voient pas. L'authenticité crée la confiance."],
                ["🔥","Opportunité (20%)","Partager l'activité de manière détournée : liberté, moments de vie, résultats flous, témoignages d'équipe. Jamais de pitch direct en publication."],
                ["😄","Divertissement & Interaction (10%)","Sondage, quiz, question ouverte, contenu léger et fun. Ce qui fait réagir sans demander d'effort."],
              ].map(([icon,title,desc])=>(
                <div key={title} style={{display:"flex",gap:".6rem",marginBottom:".6rem",alignItems:"flex-start",background:C.creme,borderRadius:9,padding:".65rem"}}>
                  <span style={{fontSize:"1rem",flexShrink:0}}>{icon}</span>
                  <div><div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Idées de hooks par thème" sub="10 hooks par sujet — pour accrocher dès la 1ʳᵉ ligne" icon="🪝" color={C.or}>
              <Info color={C.or}>Un hook c'est ta 1ʳᵉ phrase — celle qui donne envie de lire la suite. Sans bon hook, même le meilleur contenu ne sera pas lu.</Info>
              {[
                ["💄 Make-up",[
                  "On m'a demandé combien ça m'avait coûté... ils ont pas cru la réponse 😂",
                  "Tu veux le même résultat sans y passer 1h ?",
                  "Le makeup qui tient 12h même avec un masque — oui ça existe.",
                  "3 produits. 5 minutes. Un résultat qui change tout.",
                  "J'ai arrêté le fond de teint hors de prix. Voilà ce que j'utilise maintenant.",
                  "Le mascara dont tout le monde me demande le nom.",
                  "Mes lèvres tiennent toute la journée sans retouche — secret ?",
                  "Je maquille mes clientes depuis X ans. Le produit que je recommande à TOUTES.",
                  "Makeup naturel en moins de 5 min pour les mamans pressées.",
                  "Elle pensait que ça coûtait 80€. En vrai c'est moins de 20€ 😏",
                ]],
                ["🌿 Skincare",[
                  "La vérité sur le skincare hors de prix que personne ne te dit.",
                  "J'ai testé ça pendant 30 jours. Ce que j'ai découvert m'a surprise.",
                  "Peau terne, boutons, imperfections — j'avais tout ça. Voilà ce qui a tout changé.",
                  "Routine visage complète à moins de 25€. Simple, efficace, sans gadget.",
                  "Mon dermato m'a demandé ce que j'utilisais. Il a été étonné.",
                  "Le serum que j'utilise depuis X semaines — mes rides ont l'air de disparaître.",
                  "Non, ce n'est pas un filtre. C'est juste ma routine soin.",
                  "J'ai 47 ans. On me donne 35. Mes 3 produits secrets.",
                  "Tu penses que les bons soins sont forcément chers. Voilà pourquoi tu as tort.",
                  "Peau sèche, déshydratée, qui tire ? J'ai trouvé LA solution à 18€.",
                ]],
                ["💆 Bien-être & Énergie",[
                  "Je me levais fatiguée chaque matin malgré 8h de sommeil. Puis j'ai changé UN truc.",
                  "Non, ce n'est pas du café. Et non, ce n'est pas de l'eau.",
                  "Tu ne devrais pas avoir à souffrir de ton corps chaque jour.",
                  "Mon ventre plat n'est pas dû à une diète. C'est ça mon secret.",
                  "Fatigue chronique, digestion difficile, ventre gonflé — ce que personne ne t'a dit.",
                  "J'ai perdu X kilos sans régime. Voilà ce qui a changé.",
                  "La routine bien-être que j'aurais aimé commencer 10 ans plus tôt.",
                  "3 compléments. Pas 12. Juste 3. Et ça a tout changé.",
                  "Mon énergie avant VS après. La différence est hallucinante.",
                  "Pour celles qui veulent se sentir mieux sans se ruiner ni se priver.",
                ]],
                ["💇 Cheveux",[
                  "Tes cheveux font la tête ? Secs, ternes, cassants — ça s'explique.",
                  "J'ai arrêté de dépenser 80€ chez le coiffeur. Voilà ce que je fais maintenant.",
                  "Ma routine capillaire à 25€ qui donne des cheveux de rêve.",
                  "Ce produit a sauvé mes cheveux après la grossesse.",
                  "Brillance, douceur, volume — sans alourdir. Le secret ?",
                  "On m'a demandé ce que j'utilisais dans les cheveux. Encore et encore.",
                  "Cheveux abîmés par la coloration ? Ce soin a tout réparé.",
                  "Ma coiffeuse voulait savoir ce que j'avais changé. Voilà la réponse.",
                  "Pour celles qui ont abandonné l'idée d'avoir de beaux cheveux.",
                  "En 2 semaines, la différence était visible. Sans aller chez le coiffeur.",
                ]],
                ["🌸 Parfums",[
                  "Petit jeu : devinez le prix de mon parfum. Réponse en commentaire 😏",
                  "On me fait des compliments sur mon parfum depuis 3 semaines. Il coûte 18€.",
                  "J'ai arrêté de me ruiner en parfum. Voilà pourquoi.",
                  "Mon parfum du quotidien à moins de 20€ — et il tient toute la journée.",
                  "\"C'est quoi ton parfum ?\" La question qu'on m'a posée encore aujourd'hui.",
                  "Qualité grande marque, prix accessible. Ça existe pour les parfums aussi.",
                  "J'utilise ça depuis X mois et je ne retournerai jamais en arrière.",
                  "Pour les amoureux des beaux parfums avec un petit budget.",
                  "Ils ont cru que ça coûtait au moins 80€. Plot twist ❌",
                  "Le parfum dont je suis accro depuis que je l'ai découvert.",
                ]],
                ["💰 Opportunité & Liberté",[
                  "Je ne cherchais pas un 2ème emploi. Je cherchais quelque chose qui s'adapte à ma vie.",
                  "Mardi 15h. Je récupère mon enfant à l'école. Pas de congés posés.",
                  "Il y a 6 mois je ne savais pas quoi faire. Aujourd'hui voilà où j'en suis.",
                  "On m'a demandé si c'était une arnaque. Voilà ma réponse honnête.",
                  "Ce que j'aurais aimé que quelqu'un me dise avant de commencer.",
                  "Je ne vends pas du rêve. Je partage ce qui marche vraiment pour moi.",
                  "La liberté financière ce n'est pas pour les autres. C'est pour toi aussi.",
                  "Ce mois-ci j'ai gagné [montant] en travaillant depuis mon canapé.",
                  "5 femmes dans mon équipe ont changé de vie cette année. Comment ?",
                  "La vraie question ce n'est pas \"est-ce que ça marche ?\" C'est \"est-ce que tu vas essayer ?\"",
                ]],
                ["🔑 Recrutement détourné",[
                  "Tu cherches un complément de revenu sans sacrifier ta famille ?",
                  "3 choses que j'aurais voulu savoir avant de commencer.",
                  "Ce que personne ne montre vraiment sur les réseaux dans ce business.",
                  "J'ai refusé 3 fois avant d'accepter. Voilà pourquoi j'ai eu tort.",
                  "Le business qu'on m'a présenté et que j'ai failli ignorer.",
                  "Pour les mamans qui veulent travailler sans tout sacrifier.",
                  "Travailler de chez soi c'est possible. Pas facile. Mais possible.",
                  "Mon équipe cherche 3 femmes sérieuses. Pas des milliers. Juste 3.",
                  "Ce n'est pas pour tout le monde. Mais peut-être que c'est pour toi.",
                  "Avant de juger, lis jusqu'au bout. Tu pourrais être surpris(e).",
                ]],
              ].map(([theme,hooks])=>(
                <div key={theme} style={{marginBottom:".85rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",padding:".22rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme}</div>
                  {hooks.map((hook,i)=>(
                    <div key={i} style={{display:"flex",gap:".5rem",background:C.creme,borderRadius:8,padding:".45rem .65rem",marginBottom:".28rem",alignItems:"flex-start"}}>
                      <span style={{fontSize:".65rem",color:C.gris,flexShrink:0,marginTop:".1rem"}}>🪝</span>
                      <div style={{fontSize:".73rem",color:C.texte,lineHeight:1.5,flex:1,fontStyle:"italic"}}>{hook}</div>
                      <CopyBtn text={hook}/>
                    </div>
                  ))}
                </div>
              ))}
            </Card>

            {adminPosts.length>0&&(
              <Card title="✨ Idées ajoutées par Melissa" sub={`${adminPosts.length} nouvelle${adminPosts.length>1?"s":""} idée${adminPosts.length>1?"s":""}`} icon="🌟" color={C.or} defaultOpen>
                {adminPosts.map(theme=>(
                  <div key={theme.theme} style={{marginBottom:"1rem"}}>
                    <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".25rem .6rem",background:(theme.color||C.or)+"20",color:theme.color===C.or?C.brun2:(theme.color||C.brun2),borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme.theme}</div>
                    {theme.posts.map(post=>(
                      <div key={post.id} style={{background:posts[post.id]?C.pale+"80":C.creme,borderRadius:9,padding:".65rem .8rem",marginBottom:".35rem",border:`1px solid ${posts[post.id]?C.rose:C.pale}`,transition:"all .2s"}}>
                        <div style={{display:"flex",gap:".55rem",alignItems:"flex-start",marginBottom:posts[post.id]?0:".35rem"}}>
                          <div onClick={()=>tog("posts",post.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${posts[post.id]?C.rose:C.pale}`,background:posts[post.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                            {posts[post.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                          </div>
                          <div style={{fontSize:".76rem",fontWeight:600,color:posts[post.id]?C.gris:C.brun,textDecoration:posts[post.id]?"line-through":"none",flex:1}}>{post.hook}</div>
                          <CopyBtn text={post.hook+"\n\n"+post.caption}/>
                        </div>
                        {!posts[post.id]&&<div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55,marginLeft:"1.45rem"}}>{post.caption}</div>}
                      </div>
                    ))}
                  </div>
                ))}
              </Card>
            )}

            <Card title="Tableau d'idées de posts à cocher" sub={`${donePosts}/${allPosts.length} posts utilisés`} icon="📋" color={C.rose}>
              <Info>Coche les posts que tu as déjà utilisés pour suivre ta diversité de contenu. Adapte toujours à ta voix et à ton vécu.</Info>
              <div style={{marginBottom:".35rem",display:"flex",gap:".5rem",flexWrap:"wrap"}}>
                <span style={{fontSize:".62rem",color:C.gris}}>{donePosts} utilisés · {allPosts.length-donePosts} restants</span>
              </div>
              {POST_IDEAS.map(theme=>(
                <div key={theme.theme} style={{marginBottom:"1rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".25rem .6rem",background:theme.color+"20",color:theme.color===C.or?C.brun2:theme.color,borderRadius:20,display:"inline-block",marginBottom:".5rem"}}>{theme.theme}</div>
                  {theme.posts.map(post=>(
                    <div key={post.id} style={{background:posts[post.id]?C.pale+"80":C.creme,borderRadius:9,padding:".65rem .8rem",marginBottom:".35rem",border:`1px solid ${posts[post.id]?C.rose:C.pale}`,transition:"all .2s"}}>
                      <div style={{display:"flex",gap:".55rem",alignItems:"flex-start",marginBottom:posts[post.id]?0:".35rem"}}>
                        <div onClick={()=>tog("posts",post.id)} style={{width:18,height:18,borderRadius:4,border:`2px solid ${posts[post.id]?C.rose:C.pale}`,background:posts[post.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                          {posts[post.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                        </div>
                        <div style={{fontSize:".76rem",fontWeight:600,color:posts[post.id]?C.gris:C.brun,textDecoration:posts[post.id]?"line-through":"none",flex:1}}>{post.hook}</div>
                        <CopyBtn text={post.hook+"\n\n"+post.caption}/>
                      </div>
                      {!posts[post.id]&&<div style={{fontSize:".71rem",color:C.gris,lineHeight:1.55,marginLeft:"1.45rem"}}>{post.caption}</div>}
                    </div>
                  ))}
                </div>
              ))}
            </Card>

            <Card title="Ressources supplémentaires" sub="Documents stratégie contenu" icon="📄" color={C.lilas}>
              <DocBtn href="https://docs.google.com/document/d/19-pcqclkBvCHcAt6ONAGk_U8uDMmW0xg2UhOnO-l-fY/edit" label="Idées de publications — Document complet"/>
              <DocBtn href="https://docs.google.com/document/d/12tkS-4d0iLgZkpcnIgBZ0K4hIIXWgclC3IwnjkuyJ3s/edit" label="Stratégie contenu avancée"/>
              <YTBtn href="https://youtu.be/1m37A50VRN8" label="Formation Produit — Gestion perte de poids"/>
              <YTBtn href="https://youtu.be/r0MFA4bj1SY" label="Formation Produit — Ginkgo Biloba"/>
            </Card>
          </div>
        )}

        {/* ── OUTILS ── */}
        {tab==="formation"&&formationSubTab==="devperso"&&(
          <DevPersoSection adminItems={adminItems}/>
        )}

        {tab==="formation"&&formationSubTab==="outils"&&(
          <div>
            <SecTitle title="Outils" em="indispensables" desc="Les bases de Canva, CapCut et Linktree — ce qu'il faut savoir et pas plus."/>
            <AdminContentBlock onglet="outils" items={adminItems}/>

            <Card title="Canva — Créer ses visuels" sub="Les bases pour des posts professionnels" icon="🎨" color={C.rose} defaultOpen>
              <Info>Canva c'est l'outil n°1 pour créer tes visuels sans être graphiste. Gratuit, sur mobile et desktop.</Info>
              <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>Les 5 choses à maîtriser</div>
              {[
                ["1","Les formats","Story = 1080x1920px · Post carré = 1080x1080px · Reel = 1080x1920px. Toujours commencer par choisir le bon format."],
                ["2","Les templates","Cherche \"Instagram story beauté\" ou \"post cosmétique\" dans la barre de recherche. Choisis un template, adapte les couleurs à ton branding (brun + rose + or pour Blazing Dynasty)."],
                ["3","Cohérence visuelle","Utilise toujours les mêmes 3 couleurs, les mêmes 2 polices, le même style de photos. Ton profil doit être reconnaissable au 1ᵉʳ coup d'œil."],
                ["4","Les éléments graphiques","Stickers, formes, lignes — utilise-les avec parcimonie. Moins c'est souvent plus. Un visuel épuré convertit mieux qu'un visuel surchargé."],
                ["5","Exporter et partager","Télécharge en PNG pour les images, MP4 pour les vidéos animées. Active \"Partager le lien\" pour collaborer avec ton équipe."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.rose,color:"white",fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
              <Btn href="https://www.canva.com" label="Ouvrir Canva" color={C.rose} icon="🎨"/>
            </Card>

            <Card title="CapCut — Monter ses vidéos" sub="Les bases pour des Reels et stories vidéo" icon="🎬" color={C.lilas}>
              <Info color={C.lilas}>CapCut c'est l'appli de montage vidéo la plus simple et la plus puissante pour créer des Reels. Gratuite sur mobile.</Info>
              {[
                ["1","Importer et couper","Importe ta vidéo, utilise l'outil \"Séparer\" pour couper les silences et les parties ratées. Garde les moments naturels — l'authenticité convertit."],
                ["2","Les sous-titres automatiques","Outils → Auto-sous-titres. CapCut génère automatiquement les sous-titres. Édite les erreurs. 85% des vidéos sont regardées sans le son."],
                ["3","La musique et les tendances","Bibliothèque → Sons tendances. Utilise une musique tendance pour augmenter ta portée. Vérifie qu'elle est autorisée pour Instagram/TikTok."],
                ["4","Les templates","Onglet \"Templates\" → cherche un format de Reel tendance. Tu remplaces juste les vidéos — le montage est déjà fait."],
                ["5","Exporter","Toujours exporter en 1080p. Désactive le filigrane CapCut si possible (ça nuit à la portée sur Instagram)."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.lilas,color:"white",fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
            </Card>

            <Card title="Linktree — Ton lien unique" sub="Un seul lien, toutes tes ressources" icon="🔗" color={C.or}>
              <Info color={C.or}>Linktree c'est la page qui réunit tous tes liens importants. Tu mets UN seul lien dans ta bio Instagram, et les gens y trouvent tout.</Info>
              {[
                ["1","Créer ton compte","Va sur linktree.com, inscris-toi gratuitement avec ton adresse email."],
                ["2","Ajouter tes liens","Clique \"+Ajouter lien\" pour chaque ressource : ta boutique Mihi, ton groupe Facebook, ton Telegram, ton WhatsApp, ton profil Instagram."],
                ["3","Les liens essentiels à mettre","Ma boutique Mihi · Rejoindre mon équipe · Me contacter sur WhatsApp · Mon Instagram · Mon groupe clientes."],
                ["4","Personnaliser l'apparence","Choisis un fond sombre (cohérent avec tes couleurs Blazing Dynasty). Mets ta photo de profil. Ajoute ton nom et une courte description."],
                ["5","Mettre à jour ta bio","Copie ton lien Linktree (ex: linktr.ee/tonprenom). Colle-le dans ta bio Instagram, Facebook et TikTok. Un seul lien pour tout."],
              ].map(([n,title,desc])=>(
                <div key={n} style={{display:"flex",gap:".55rem",marginBottom:".55rem",alignItems:"flex-start"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.or,color:C.brun,fontSize:".62rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:1}}>{n}</div>
                  <div><div style={{fontSize:".77rem",fontWeight:600,color:C.brun,marginBottom:".1rem"}}>{title}</div><div style={{fontSize:".71rem",color:C.gris,lineHeight:1.5}}>{desc}</div></div>
                </div>
              ))}
              <Btn href="https://linktr.ee" label="Créer mon Linktree" color={C.or} icon="🔗"/>
            </Card>

            <Card title="Récap outils de l'équipe" sub="Document officiel Blazing Dynasty" icon="📋" color={C.brun}>
              <DocBtn href="https://docs.google.com/document/d/1BU0MH-AcaiWTn1eODBKppavTI8g_77jN833sasmfwU8/edit" label="📋 Récapitulatif complet des outils de l'équipe"/>
            </Card>
          </div>
        )}

        {/* ── FORMATION PRODUITS ── */}
        {tab==="formation"&&formationSubTab==="formaproduits"&&(
          <FormationProduitsTab adminItems={adminItems}/>
        )}

        {/* ── SPRINT / ACCÉLÈRE ── */}
        {tab==="sprint"&&(
          <div>
            <SecTitle title="Prends" em="de la vitesse" desc="7 actions quotidiennes pour passer à l'action. Chaque jour compte — coche et avance."/>
            <div style={{background:C.brun,borderRadius:10,padding:".7rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.pale,lineHeight:1.6}}>
              🚀 Chaque conversation déclenchée est une graine. Les graines d'aujourd'hui = les recrues de demain.
            </div>
            <div style={{marginBottom:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".22rem"}}>
                <span>Progression sprint</span><span>{SPRINT.flatMap(d=>d.tasks).filter(t=>tasks[t.id]).length}/{allTask.length}</span>
              </div>
              <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",background:C.rose,width:(allTask.length?Math.round(SPRINT.flatMap(d=>d.tasks).filter(t=>tasks[t.id]).length/allTask.length*100):0)+"%",borderRadius:10,transition:"width .3s"}}/>
              </div>
            </div>
            {SPRINT.map(day=>{
              const isOpen=openDays[day.day];
              const dayDone=day.tasks.filter(t=>tasks[t.id]).length;
              const dayPct=Math.round(dayDone/day.tasks.length*100);
              const allDone=dayPct===100;
              const fc={rs:C.lilas,bao:C.or,mix:C.rose}[day.focus];
              const fl={rs:"Réseaux",bao:"Terrain",mix:"Mixte"}[day.focus];
              return(
                <div key={day.day} style={{background:C.blanc,border:`1px solid ${isOpen?C.rose:C.pale}`,borderRadius:14,marginBottom:".75rem",overflow:"hidden",transition:"all .2s"}}>
                  <div onClick={()=>setOpenDays(p=>({...p,[day.day]:!p[day.day]}))}
                    style={{padding:".82rem 1rem",display:"flex",alignItems:"center",gap:".6rem",cursor:"pointer",userSelect:"none"}}>
                    <div style={{width:34,height:34,borderRadius:"50%",background:allDone?C.vert:C.brun,color:allDone?"white":C.or,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                      {allDone?"✓":day.day}
                    </div>
                    <div style={{flex:1,minWidth:0}}>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{day.title}</div>
                      <div style={{fontSize:".6rem",color:C.gris}}>{day.goal}</div>
                    </div>
                    <span style={{background:fc+"22",color:fc===C.or?C.brun2:fc,fontSize:".55rem",fontWeight:700,textTransform:"uppercase",padding:".15rem .45rem",borderRadius:20,flexShrink:0}}>{fl}</span>
                    <div style={{color:C.rose,fontSize:".68rem",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</div>
                  </div>
                  {isOpen&&(
                    <div style={{borderTop:`1px solid ${C.pale}`}}>
                      <div style={{padding:".5rem 1rem .3rem"}}>
                        <div style={{display:"flex",justifyContent:"space-between",fontSize:".6rem",color:C.gris,marginBottom:".22rem"}}>
                          <span>{dayDone}/{day.tasks.length}</span><span>{dayPct}%</span>
                        </div>
                        <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                          <div style={{height:"100%",background:C.rose,width:dayPct+"%",transition:"width .3s",borderRadius:10}}/>
                        </div>
                      </div>
                      <div style={{padding:".5rem 1rem .85rem"}}>
                        {day.tasks.map(task=>(
                          <div key={task.id}>
                            <div onClick={()=>tog("tasks",task.id)} style={{display:"flex",alignItems:"flex-start",gap:".55rem",padding:".45rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`,cursor:"pointer"}}>
                              <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${C.rose}`,background:tasks[task.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                                {tasks[task.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                              </div>
                              <div style={{fontSize:".76rem",color:tasks[task.id]?C.gris:C.texte,textDecoration:tasks[task.id]?"line-through":"none",lineHeight:1.45,flex:1}}>{task.label}</div>
                            </div>
                            {task.script&&(
                              <div style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .75rem",fontSize:".72rem",fontStyle:"italic",color:C.texte,lineHeight:1.7,margin:".3rem 0 .4rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
                                <span style={{flex:1}}>{task.script}</span>
                                <CopyBtn text={task.script}/>
                              </div>
                            )}
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>📊 Mes chiffres</div>
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:".75rem"}}>
                {[["k1","Messages envoyés"],["k2","Réponses reçues"],["k3","Présentations"],["k4","Nouvelles recrues"]].map(([k,l])=>(
                  <div key={k} style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem",textAlign:"center"}}>
                    <input type="number" min="0" value={kpis[k]||""} placeholder="0" onChange={e=>updKpi(k,e.target.value)}
                      style={{width:52,fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:C.brun,border:"none",background:"none",textAlign:"center",outline:"none"}}/>
                    <div style={{fontSize:".58rem",color:C.gris,marginTop:".12rem"}}>{l}</div>
                  </div>
                ))}
              </div>
              <textarea value={notes} onChange={e=>updNotes(e.target.value)} placeholder="Notes, blocages, questions..."
                style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".6rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>
            </div>
          </div>
        )}

        {/* ── SUIVI RECRUES ── */}
        {tab==="suivi"&&<SuiviRecruTab uid={userId} isChef={isChefApp}/>}

        {/* ── TABLEAU DE BORD ── */}
        {tab==="dashboard"&&<DashboardTab uid={userId} goToFormation={(sub)=>{setTab("formation");setFormationSubTab(sub);}} fastStartDone={fastStartDone} onFastStartDone={setFastStartDone} hasFastStart={hasFastStart} onHasFastStart={setHasFastStart} isChef={isChefApp} onObjPersoChange={setHomeObjPerso}/>}
        {tab==="scripts"&&<ScriptsTab/>}
        {tab==="banqueimages"&&<BanqueImagesTab isMelissa={name.toLowerCase().startsWith("melissa")||isChefApp}/>}
        {tab==="diagnostics"&&<DiagnosticsTab uid={userId} userName={name}/>}
        {tab==="linkbio"&&<LinkBioTab uid={userId} userName={name}/>}
        {tab==="dreamboard"&&<DreamBoardTab uid={userId}/>}
        {tab==="espacechef"&&(isChefApp||hasTeamApp)&&<EspaceChefTab uid={userId} isChef={isChefApp}/>}
        {tab==="formation"&&formationSubTab==="formationapp"&&<FormationAppTab adminItems={adminItems}/>}
        {tab==="objectifs"&&<ObjectifsTab uid={userId} userName={name} isMelissa={name.toLowerCase().startsWith("melissa")}/>}
        {tab==="calendrier"&&<CalendrierTab uid={userId} userName={name} isMelissa={name.toLowerCase().startsWith("melissa")} isChef={isChefApp}/>}

        {/* Bouton mise à jour */}
        <div style={{padding:"1.5rem 0 .5rem",textAlign:"center"}}>
          <BoutonMiseAJour/>
          <div style={{fontSize:".58rem",color:C.pale,marginTop:".3rem"}}>v{APP_VERSION}</div>
        </div>

      </div>

      {/* WATERMARK invisible — prénom de la personne connectée */}
      <div style={{position:"fixed",top:0,left:0,width:"100%",height:"100%",pointerEvents:"none",zIndex:9999,overflow:"hidden",opacity:.03}}>
        {Array.from({length:20}).map((_,i)=>(
          <div key={i} style={{position:"absolute",top:`${(i*11)%100}%`,left:`${(i*17)%100}%`,fontSize:"1.2rem",fontWeight:700,color:C.brun,transform:"rotate(-30deg)",whiteSpace:"nowrap",letterSpacing:".15em"}}>
            {name.toUpperCase()} · BLAZING DYNASTY
          </div>
        ))}
      </div>

      <div style={{textAlign:"center",padding:"1.1rem",fontSize:".6rem",color:C.gris,borderTop:`1px solid ${C.pale}`}}>
        <strong style={{color:C.rose}}>Blazing Dynasty</strong> · Espace Formation Privé
      </div>

      {/* ── BOUTON FLOTTANT OBJECTIFS ── */}
      <button onClick={()=>setShowObjectifs(p=>!p)}
        style={{position:"fixed",bottom:"5rem",right:"1.2rem",width:56,height:56,borderRadius:"50%",background:C.brun,border:`2px solid ${C.or}`,boxShadow:"0 4px 20px rgba(61,31,14,.4)",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",zIndex:200,transition:"all .2s",padding:0,overflow:"hidden"}}>
        {showObjectifs
          ? <span style={{fontSize:"1rem",color:C.or,fontWeight:700}}>✕</span>
          : <span style={{fontSize:"1.4rem"}}>👑</span>
        }
      </button>

      {/* ── POPUP BIENVENUE ── */}
      {showWelcome&&(
        <WelcomePopup userName={name} onClose={()=>{
          setShowWelcome(false);
          setTab("formation");
          setFormationSubTab("faststart");
        }}/>
      )}

      {/* ── POPUP CHALLENGE APP ── */}
      {showChallengeApp&&userId&&(
        <ChallengeAppPopup
          uid={userId}
          onClose={()=>setShowChallengeApp(false)}
          setTab={setTab}
        />
      )}

            {/* ── POPUP RAPPEL BACKUP ── */}
      {showBackupReminder&&(
        <div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9999,background:"rgba(61,31,14,.85)",display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}}>
          <div style={{background:"white",borderRadius:20,maxWidth:380,width:"100%",overflow:"hidden"}}>
            <div style={{background:"#3A6A4A",padding:"1.5rem 1.3rem",textAlign:"center"}}>
              <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>💾</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:"white",fontWeight:300}}>Petit rappel backup</div>
              <div style={{fontSize:".75rem",color:"#C8E0CC",marginTop:".25rem"}}>Ca fait plus de 3 jours, pense a sauvegarder !</div>
            </div>
            <div style={{padding:"1.25rem 1.3rem"}}>
              <div style={{background:"#F0F7F2",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",fontSize:".78rem",color:"#3D2B1F",lineHeight:1.7}}>
                Pour eviter de perdre tes donnees (clientes, CA, prospects...), telecharge un backup regulierement. Ca prend 2 secondes !
              </div>
              <button onClick={async()=>{
                try{
                  const snap=await getDoc(doc(db,"users",userId));
                  const data=snap.exists()?snap.data():{};
                  const json=JSON.stringify(data,null,2);
                  const blob=new Blob([json],{type:"application/json"});
                  const url=URL.createObjectURL(blob);
                  const a=document.createElement("a");
                  a.href=url;a.download="backup-blazing-"+new Date().toISOString().slice(0,10)+".json";
                  document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);
                  await setDoc(doc(db,"users",userId),{"db-last-backup":new Date().toISOString()},{merge:true});
                }catch(e){alert("Erreur: "+e);}
                setShowBackupReminder(false);
              }} style={{width:"100%",background:"#3A6A4A",color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
                Telecharger mon backup maintenant
              </button>
              <button onClick={()=>setShowBackupReminder(false)} style={{width:"100%",background:"none",border:"none",color:"#888",fontSize:".72rem",fontFamily:"inherit",cursor:"pointer",padding:".4rem"}}>
                Me le rappeler plus tard
              </button>
            </div>
          </div>
        </div>
      )}
{/* ── POPUP OBJECTIFS ── */}
      {showObjectifs&&(
        <div style={{position:"fixed",bottom:"8rem",right:"1.2rem",width:285,background:C.blanc,borderRadius:16,boxShadow:"0 8px 32px rgba(61,31,14,.25)",border:`1px solid ${C.pale}`,zIndex:199,overflow:"hidden"}}>
          <div style={{background:C.brun,padding:".85rem 1rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <span style={{fontSize:"1.4rem"}}>👑</span>
              <div>
                <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or}}>✦ OBJECTIFS ÉQUIPE</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",color:C.blanc,fontWeight:300}}>Ce mois-ci</div>
              </div>
            </div>
          </div>
          <ObjectifsPopup uid={userId}/>
        </div>
      )}
    </div>
    </LangContext.Provider>
  );
}

// ── HOME RECAP (page d'accueil) ──────────────────────────────────────────────

export function HistoriquePeriodes({uid}){
  const [suiviCA,setSuiviCA]=useState({});
  const [loading,setLoading]=useState(true);
  const [ouvert,setOuvert]=useState(null);
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'users',uid));
        if(snap.exists()&&snap.data()['db-suivi-ca']) setSuiviCA(JSON.parse(snap.data()['db-suivi-ca']));
      }catch{}
      setLoading(false);
    })();
  },[uid]);
  const caMap={};
  const ANCRE_H=new Date('2026-01-01T12:00:00').getTime();
  Object.entries(suiviCA).forEach(([key,val])=>{
    const pNum=parseInt(key.replace('p',''));
    if(!pNum||isNaN(pNum)) return;
    const deb=new Date(ANCRE_H+(pNum-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
    const fin2=new Date(deb.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
    const fmtD=(dt)=>dt.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
    caMap[key]={ca:val.ca||0,obj:val.obj||0,cmds:[],label:'P'+pNum,dates:fmtD(deb)+' au '+fmtD(fin2),num:pNum};
  });;
  const periodes=Object.values(caMap).sort((a,b)=>b.num-a.num);
  const maxCA=Math.max(...periodes.map(p=>p.ca),1);
  const pActuelle=getPeriodeActuelle();
  const pActAnn=((pActuelle-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
  Object.values(caMap).forEach(p=>{const deb=new Date(PERIODE_DEBUT_ABSOLU_MS+(p.num-1)*PERIODE_DUREE_JOURS*24*60*60*1000);const fin2=new Date(deb.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);const ann2=((p.num-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;p.label='P'+ann2;p.dates=deb.toLocaleDateString('fr-FR',{day:'numeric',month:'short'})+' au '+fin2.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});});
  if(loading) return <div style={{textAlign:'center',padding:'2rem',color:C.gris}}>Chargement...</div>;
  return(
    <div style={{paddingBottom:'2rem'}}>
      <div style={{fontFamily:'Georgia,serif',fontSize:'1.35rem',fontWeight:300,color:C.brun,marginBottom:'.2rem'}}>Historique <em style={{fontStyle:'italic',color:C.rose}}>periodes</em></div>
      <p style={{fontSize:'.74rem',color:C.gris,marginBottom:'1rem'}}>Periode actuelle : <strong style={{color:C.brun}}>P{pActAnn}</strong></p>
      {periodes.length===0&&<div style={{textAlign:'center',padding:'2rem',color:C.gris}}>Aucune commande enregistree</div>}
      {periodes.map(p=>{
        const isOpen=ouvert===p.num;
        const isCur=p.num===pActuelle;
        const bar=Math.round(p.ca/maxCA*100);
        return(
          <div key={p.num} style={{background:C.blanc,border:'1.5px solid '+(isCur?C.rose:C.pale),borderRadius:12,marginBottom:'.5rem',overflow:'hidden'}}>
            <div onClick={()=>setOuvert(isOpen?null:p.num)} style={{padding:'.75rem 1rem',cursor:'pointer',display:'flex',alignItems:'center',gap:'.75rem'}}>
              <div style={{width:40,height:40,borderRadius:10,background:isCur?C.rose:C.creme,display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0}}>
                <div style={{fontSize:'.7rem',fontWeight:700,color:isCur?'white':C.brun}}>{p.label}</div>
              </div>
              <div style={{flex:1}}>
                <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.3rem'}}>
                  <div style={{fontSize:'.82rem',fontWeight:700,color:C.brun}}>{p.label}{isCur&&<span style={{background:C.rose,color:'white',borderRadius:20,padding:'.1rem .4rem',fontSize:'.58rem',marginLeft:'.3rem'}}>En cours</span>}</div>
                  <div style={{fontSize:'.88rem',fontWeight:700,color:C.brun}}>{p.ca.toFixed(0)}EUR</div>
                </div>
                <div style={{height:4,background:C.pale,borderRadius:2,overflow:'hidden'}}>
                  <div style={{height:'100%',background:isCur?C.rose:C.or,width:bar+'%',borderRadius:2}}/>
                </div>
                <div style={{fontSize:'.62rem',color:C.gris,marginTop:'.2rem'}}>{p.cmds.length} commande{p.cmds.length>1?'s':''}</div>
              </div>
              <span style={{color:C.gris,transform:isOpen?'rotate(90deg)':'none',transition:'transform .2s'}}>›</span>
            </div>
            {isOpen&&(
              <div style={{padding:'0 1rem 1rem',borderTop:'1px solid '+C.pale}}>
                {p.cmds.sort((a,b)=>new Date(b.date)-new Date(a.date)).map((cmd,i)=>(
                  <div key={i} style={{display:'flex',justifyContent:'space-between',padding:'.35rem 0',borderBottom:i<p.cmds.length-1?'1px solid '+C.creme:'none'}}>
                    <div>
                      <div style={{fontSize:'.78rem',fontWeight:600,color:C.brun}}>{cmd.client}</div>
                      <div style={{fontSize:'.6rem',color:C.gris}}>{new Date(cmd.date).toLocaleDateString('fr-FR')}</div>
                    </div>
                    <div style={{fontSize:'.82rem',fontWeight:700,color:C.brun}}>{cmd.montant.toFixed(0)}EUR</div>
                  </div>
                ))}
              </div>
            )}
          </div>
        );
      })}
      <div style={{background:C.creme,borderRadius:10,padding:'.75rem 1rem',marginTop:'.75rem',border:'1px solid '+C.pale,fontSize:'.7rem',color:C.gris,lineHeight:1.6}}>
        Si la periode affichee ne correspond pas, ajuste la date dans Admin - Configuration des Periodes.
      </div>
    </div>
  );
}

const NOTICES = {
  clients:{titre:"Mes Clientes",icon:"🛍️",explication:"Centralise toutes tes clientes, leurs commandes et suivis automatiques J+8 et J+21.",comment:["Ajoute une cliente avec le bouton +","Clique sur la fiche pour voir l'historique complet","Programme une relance depuis la fiche","Le suivi J+8 et J+21 se declenche apres chaque commande"],apport:"Tu ne perds plus aucune cliente. Les endormies sont detectees apres 60 jours automatiquement."},
  prospects:{titre:"Mes Prospects",icon:"👥",explication:"Suis tes prospects du premier contact jusqu'a la conversion en cliente ou distributrice.",comment:["Ajoute avec son statut chaud tiede ou froid","Programme une date de relance","Note chaque echange dans le journal","Convertis en cliente ou distributrice en un clic"],apport:"Vision claire de ton pipeline. Tu sais exactement qui relancer chaque jour."},
  relances:{titre:"Relances du jour",icon:"🔔",explication:"Toutes tes relances au meme endroit — prospects a recontacter et clientes endormies depuis 60 jours.",comment:["Consulte chaque matin pendant 10 minutes","Copie le message pret en un clic","Marque comme fait ou reporte de 3 ou 7 jours","Copie tous les messages endormies en une fois"],apport:"Tes relances deviennent un rituel de 10 minutes. Plus personne ne tombe dans l'oubli."},
  editorial:{titre:"Editorial IA",icon:"✍️",explication:"Planning de contenu automatique. L'IA genere hooks, legendes et stories pour 2 posts et 3 stories par jour.",comment:["Clique sur un jour pour voir les themes","Appuie sur Generer pour creer le contenu","Copie hooks et legendes en un clic","Coche A faire quand tu as publie"],apport:"Plus jamais la panne d'inspiration. Planning structure sur 4 semaines avec du contenu varie."},
  diagnostics:{titre:"Diagnostics Produits",icon:"🩺",explication:"Tes clientes repondent a 5 questions et l'IA genere une ordonnance produit personnalisee.",comment:["Choisis le type de diagnostic","Envoie le lien a ta cliente","L'ordonnance est generee automatiquement","Partage en PDF ou par lien public"],apport:"Experience personnalisee qui justifie ton role de conseillere et augmente la conversion."},
  business:{titre:"Espace Business",icon:"📊",explication:"Vue complete de ton activite — CA par periode, entonnoir de conversion et historique.",comment:["Saisis ton CA dans Suivi CA","Consulte l'Entonnoir pour voir tes taux","L'Historique montre toutes tes periodes"],apport:"Tu pilotes avec des chiffres reels et tu identifies tes axes d'amelioration."},
  distributeurs:{titre:"Mes Distributrices",icon:"👑",explication:"Gestion de tes recrues — coordonnees, statut Fast Start, challenge decouverte et suivi.",comment:["Ajoute une distributrice manuellement","Assigne le Fast Start depuis la fiche","Lance le Challenge Decouverte","Suis la progression dans Nouveaux Distrib"],apport:"Tu as une vue d'ensemble de ton equipe et tu peux animer facilement."},
  scripts:{titre:"Scripts et Fils DM",icon:"💬",explication:"Scripts prets et guides de conversation selon le CTA recu — MINCEUR, EQUIPE, DIAGNOSTIC, SILHOUETTE.",comment:["Va dans Fils DM et choisis le CTA recu","Suis le fil etape par etape","Copie et adapte le prenom de la personne"],apport:"Tu sais toujours quoi repondre. Chaque CTA a son fil conducteur jusqu'a la vente."},
};

export function NoticePanel({cleOutil,onClose,videoUrl}){
  const n=NOTICES[cleOutil];if(!n)return null;
  return(<div style={{position:"fixed",top:0,left:0,right:0,bottom:0,zIndex:9998,background:"rgba(61,31,14,.8)"}} onClick={onClose}>
    <div style={{position:"absolute",top:0,right:0,width:"85%",maxWidth:360,height:"100vh",background:"white",overflowY:"auto",display:"flex",flexDirection:"column"}} onClick={e=>e.stopPropagation()}>
      <div style={{background:"#3D1F0E",padding:"1.1rem 1.2rem",display:"flex",justifyContent:"space-between",alignItems:"center",flexShrink:0}}>
        <div style={{display:"flex",alignItems:"center",gap:".65rem"}}>
          <span style={{fontSize:"1.5rem"}}>{n.icon}</span>
          <div><div style={{fontSize:".5rem",fontWeight:700,letterSpacing:".12em",color:"#C4A882",marginBottom:".1rem"}}>GUIDE D'UTILISATION</div><div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:"white",fontWeight:300}}>{n.titre}</div></div>
        </div>
        <button onClick={onClose} style={{background:"none",border:"none",color:"#C49A8A",fontSize:"1.4rem",cursor:"pointer",lineHeight:1}}>✕</button>
      </div>
      <div style={{padding:"1rem",flex:1}}>
        {videoUrl?<div style={{marginBottom:"1rem",borderRadius:10,overflow:"hidden",aspectRatio:"16/9",background:"#000"}}><iframe src={videoUrl.replace("watch?v=","embed/").replace("youtu.be/","youtube.com/embed/")} style={{width:"100%",height:"100%",border:"none"}} allowFullScreen title="tuto"/></div>:<div style={{background:"#FAF7F2",borderRadius:10,padding:".65rem",marginBottom:"1rem",textAlign:"center",border:"1px solid #E8DDD4",fontSize:".68rem",color:"#888"}}>🎬 Vidéo tuto à venir — configure depuis Admin → Vidéos outils</div>}
        <div style={{marginBottom:"1rem"}}><div style={{fontSize:".6rem",fontWeight:700,color:"#3D1F0E",textTransform:"uppercase",letterSpacing:".08em",marginBottom:".4rem"}}>📖 C'est quoi ?</div><div style={{fontSize:".78rem",color:"#3D2B1F",lineHeight:1.7,background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",border:"1px solid #E8DDD4"}}>{n.explication}</div></div>
        <div style={{marginBottom:"1rem"}}><div style={{fontSize:".6rem",fontWeight:700,color:"#3D1F0E",textTransform:"uppercase",letterSpacing:".08em",marginBottom:".4rem"}}>🛠️ Comment l'utiliser ?</div>{n.comment.map((s,i)=>(<div key={i} style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:".4rem"}}><div style={{width:22,height:22,borderRadius:"50%",background:"#C49A8A",color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".65rem",fontWeight:700,flexShrink:0}}>{i+1}</div><div style={{fontSize:".76rem",color:"#3D2B1F",lineHeight:1.55}}>{s}</div></div>))}</div>
        <div style={{background:"#3D1F0E",borderRadius:12,padding:".85rem 1rem"}}><div style={{fontSize:".58rem",fontWeight:700,color:"#C4A882",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>✦ Ce que ca t'apporte</div><div style={{fontSize:".78rem",color:"white",lineHeight:1.65}}>{n.apport}</div></div>
      </div>
    </div>
  </div>);
}

function HomeRecap({name, objPerso, textes}){
  const periodeInfo=getPeriodeInfo();
  const citation=getCitationDuJour(textes?.citations);
  const prenom=name.split(" ")[0];

  const pct=(r,o)=>{
    if(!o||!r||+o===0)return 0;
    return Math.min(100,Math.round(+r/+o*100));
  };

  const pctCA=objPerso?pct(objPerso.ca,objPerso.caObj):0;
  const pctRecrues=objPerso?pct(objPerso.recruesReal,objPerso.recruesObj):0;
  const hasObjCA=objPerso&&objPerso.caObj;
  const hasObjRecrues=objPerso&&objPerso.recruesObj&&objPerso.recruesObj!=="0";

  const urgent=periodeInfo.daysLeft<3;

  return(
    <div style={{marginBottom:"1rem"}}>
      {/* Bienvenue */}
      <div style={{background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,borderRadius:16,padding:"1.4rem",marginBottom:".75rem",position:"relative",overflow:"hidden"}}>
        <div style={{position:"absolute",top:-20,right:-20,width:100,height:100,borderRadius:"50%",background:"rgba(196,168,130,.1)"}}/>
        <div style={{position:"relative"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".35rem"}}>✦ BIENVENUE</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc,lineHeight:1.25,marginBottom:".5rem"}}>
            Salut <em style={{fontStyle:"italic",color:C.pale}}>{prenom}</em> 👋
          </div>
          {textes?.messageAccueil&&(
            <p style={{fontSize:".74rem",color:C.pale,opacity:.9,lineHeight:1.6,marginBottom:0}}>{textes.messageAccueil}</p>
          )}
        </div>
      </div>

      {/* Période + objectifs */}
      <div style={{display:"grid",gridTemplateColumns:hasObjCA||hasObjRecrues?"1fr 1fr":"1fr",gap:".5rem",marginBottom:".75rem"}}>
        {/* Période */}
        <div style={{background:urgent?"#FFF3E0":C.blanc,border:`1px solid ${urgent?"#E6A817":C.pale}`,borderRadius:12,padding:".85rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:urgent?"#8B5E00":C.rose,marginBottom:".4rem"}}>⏱️ Période en cours</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:urgent?"#C44B1A":C.brun,lineHeight:1}}>
            {periodeInfo.daysLeft}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}> j {periodeInfo.hoursLeft}h</span>
          </div>
          <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>restants{urgent?" ⚠️":""}</div>
          <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
            <div style={{height:"100%",background:urgent?"#E6A817":C.rose,width:periodeInfo.pctElapsed+"%",borderRadius:10}}/>
          </div>
        </div>

        {/* Objectif CA */}
        {hasObjCA&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".4rem"}}>💰 Mon CA</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctCA>=100?C.vert:C.brun,lineHeight:1}}>
              {pctCA}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.ca||0}€ / {objPerso.caObj}€</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctCA>=100?C.vert:C.or,width:pctCA+"%",borderRadius:10}}/>
            </div>
          </div>
        )}

        {/* Objectif recrues (si pas de CA, prend la 2e colonne) */}
        {hasObjRecrues&&!hasObjCA&&(
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Mes recrues</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:600,color:pctRecrues>=100?C.vert:C.brun,lineHeight:1}}>
              {pctRecrues}<span style={{fontSize:".8rem",fontWeight:400,color:C.gris}}>%</span>
            </div>
            <div style={{fontSize:".6rem",color:C.gris,marginTop:".15rem"}}>{objPerso.recruesReal||0} / {objPerso.recruesObj}</div>
            <div style={{height:4,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".5rem"}}>
              <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10}}/>
            </div>
          </div>
        )}
      </div>

      {/* Objectif recrues — 2e ligne si CA présent aussi */}
      {hasObjCA&&hasObjRecrues&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas}}>👥 Mes recrues</div>
            <div style={{fontSize:".75rem",fontWeight:700,color:pctRecrues>=100?C.vert:C.brun}}>{objPerso.recruesReal||0} / {objPerso.recruesObj} · {pctRecrues}%</div>
          </div>
          <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pctRecrues>=100?C.vert:C.lilas,width:pctRecrues+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      )}

      {!hasObjCA&&!hasObjRecrues&&(
        <div style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".7rem 1rem",marginBottom:".75rem",fontSize:".74rem",color:C.brun,lineHeight:1.6}}>
          💡 Définis tes objectifs du mois dans <strong>Tableau de bord → Mes objectifs</strong> pour les voir apparaître ici chaque jour.
        </div>
      )}

      {/* Citation du jour */}
      <div style={{background:`linear-gradient(135deg, rgba(196,154,138,.12), rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center"}}>
        <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.rose,marginBottom:".5rem"}}>✦ PENSÉE DU JOUR ✦</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"{citation}"</div>
      </div>
    </div>
  );
}

// ── SUIVI RECRUES COMPONENT ───────────────────────────────────────────────────
const CHECKLIST_BLOCKS=[
  {day:"J+1",color:"#B04040",title:"Accueil immédiat",tasks:[
    {id:"c1",label:"Message de bienvenue vocal ou vidéo envoyé"},
    {id:"c2",label:"Accès Formation Démarrage Rapide transmis"},
    {id:"c3",label:"Date du call de suivi fixée"},
    {id:"c4",label:"Exercices expliqués (liste 20 / profil / story)"},
  ]},
  {day:"J+2",color:"#8B5E00",title:"Formation & exercices",tasks:[
    {id:"c5",label:"Formation terminée — vérifier avec elle"},
    {id:"c6",label:"Liste des 20 contacts réalisée"},
    {id:"c7",label:"Profil optimisé (photo + bio + lien)"},
    {id:"c8",label:"Première story publiée"},
    {id:"c9",label:"Call démarrage 30 min réalisé"},
  ]},
  {day:"J+3",color:"#4A4A9C",title:"Intégration équipe",tasks:[
    {id:"c10",label:"Ajoutée au groupe Facebook Blazing Dynasty"},
    {id:"c11",label:"Ajoutée au canal Telegram"},
    {id:"c12",label:"Accès site de formation transmis"},
    {id:"c13",label:"Présentée à la communauté"},
    {id:"c14",label:"Premier contact prospect approché"},
  ]},
  {day:"S1",color:"#5C8A60",title:"Semaine 1 — Premiers résultats",tasks:[
    {id:"c15",label:"1 story par jour (vie quotidienne)"},
    {id:"c16",label:"5+ personnes contactées en message personnel"},
    {id:"c17",label:"1 présentation de l'opportunité faite"},
    {id:"c18",label:"Première vente OU premier recrutement ✨"},
    {id:"c19",label:"Point de suivi hebdomadaire effectué"},
  ]},
  {day:"S2-4",color:"#6B5B8A",title:"Semaines 2-4 — Routine & croissance",tasks:[
    {id:"c20",label:"Contenu régulier publié (3x/semaine minimum)"},
    {id:"c21",label:"Sprint 7j complété dans l'appli"},
    {id:"c22",label:"Premier café ou Zoom découverte organisé"},
    {id:"c23",label:"2ᵉ vente ou 1ʳᵉ recrue dans son équipe"},
    {id:"c24",label:"Formation produits avancée suivie"},
    {id:"c25",label:"Bilan du mois réalisé avec distributrice"},
  ]},
];

const ALL_TASK_IDS=CHECKLIST_BLOCKS.flatMap(b=>b.tasks.map(t=>t.id));
const MAX_RECRUES=15;

function getProgress(r){
  const done=ALL_TASK_IDS.filter(id=>r.checks&&r.checks[id]).length;
  return{done,total:ALL_TASK_IDS.length,pct:Math.round(done/ALL_TASK_IDS.length*100)};
}

function phaseLabel(pct){
  if(pct===0)return{label:"Pas encore démarrée",col:C.gris};
  if(pct<30)return{label:"Démarrage J+1/J+2",col:"#B04040"};
  if(pct<60)return{label:"Intégration en cours",col:"#8B5E00"};
  if(pct<85)return{label:"Semaine 1 active",col:C.rose};
  if(pct<100)return{label:"En pleine progression",col:C.lilas};
  return{label:"Parcours complété 🎉",col:C.vert};
}

function RecrueFiche({recrue,onToggle,onRemove,uid,userName}){
  const[openBlocks,setOpenBlocks]=useState({"J+1":true});
  const[confirmDel,setConfirmDel]=useState(false);
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const{done,total,pct}=getProgress(recrue);
  const ph=phaseLabel(pct);

  useEffect(()=>{
    if(pct===100){
      setConfettiTrigger(t=>t+1);
      if(uid&&userName){
        postToWallOfFame(uid, userName, `a terminé le parcours d'onboarding de sa recrue ${recrue.name} ! 🎉`, "🌟");
      }
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[pct]);

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      {/* Header */}
      <div style={{background:C.brun,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".85rem"}}>
        <div style={{width:42,height:42,borderRadius:"50%",background:C.rose,color:"white",fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
          {recrue.name[0].toUpperCase()}
        </div>
        <div style={{flex:1}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{recrue.name}</div>
          <div style={{fontSize:".62rem",color:C.pale,opacity:.75}}>Entrée le {recrue.date}</div>
          <div style={{fontSize:".65rem",fontWeight:700,color:ph.col,marginTop:".15rem"}}>{ph.label}</div>
        </div>
        <div style={{textAlign:"right",marginRight:".4rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",fontWeight:600,color:pct===100?C.vert:C.or,lineHeight:1}}>{pct}%</div>
          <div style={{fontSize:".58rem",color:C.pale,opacity:.7}}>{done}/{total}</div>
        </div>
        {!confirmDel
          ? <button onClick={()=>setConfirmDel(true)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:6,padding:".3rem .5rem",color:C.pale,cursor:"pointer",fontSize:".7rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
          : <div style={{display:"flex",gap:".3rem",flexShrink:0}}>
              <button onClick={()=>onRemove(recrue.id)} style={{background:"#B04040",border:"none",borderRadius:6,padding:".3rem .55rem",color:"white",cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>Supprimer</button>
              <button onClick={()=>setConfirmDel(false)} style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:6,padding:".3rem .55rem",color:C.pale,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>Annuler</button>
            </div>
        }
      </div>

      {/* Barre globale */}
      <div style={{marginBottom:"1rem"}}>
        <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden"}}>
          <div style={{height:"100%",background:pct===100?C.vert:C.rose,width:pct+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
      </div>

      <div style={{background:"linear-gradient(135deg,rgba(196,154,138,.1),rgba(168,155,181,.07))",border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.texte,lineHeight:1.65}}>
        🏆 Objectif : 1 première vente ou 1 premier recrutement dans les 7 premiers jours.
      </div>

      {/* Blocs checklist */}
      {CHECKLIST_BLOCKS.map(block=>{
        const isOpen=openBlocks[block.day];
        const blockDone=block.tasks.filter(t=>recrue.checks&&recrue.checks[t.id]).length;
        const blockPct=Math.round(blockDone/block.tasks.length*100);
        return(
          <div key={block.day} style={{background:C.blanc,border:`1px solid ${isOpen?C.rose:C.pale}`,borderRadius:14,marginBottom:".6rem",overflow:"hidden",transition:"all .2s"}}>
            <div onClick={()=>setOpenBlocks(p=>({...p,[block.day]:!p[block.day]}))}
              style={{padding:".75rem 1rem",display:"flex",alignItems:"center",gap:".6rem",cursor:"pointer",userSelect:"none"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:blockPct===100?C.vert:block.color,color:"white",fontSize:".65rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {blockPct===100?"✓":block.day}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{block.title}</div>
                <div style={{fontSize:".58rem",color:C.gris}}>{blockDone}/{block.tasks.length} · {blockPct}%</div>
              </div>
              <div style={{width:48,height:4,background:C.pale,borderRadius:10,overflow:"hidden",flexShrink:0}}>
                <div style={{height:"100%",background:blockPct===100?C.vert:block.color,width:blockPct+"%",borderRadius:10,transition:"width .3s"}}/>
              </div>
              <div style={{color:C.rose,fontSize:".65rem",transform:isOpen?"rotate(180deg)":"none",transition:"transform .2s",flexShrink:0}}>▼</div>
            </div>
            {isOpen&&(
              <div style={{borderTop:`1px solid ${C.pale}`,padding:".6rem 1rem .8rem"}}>
                {block.tasks.map(task=>{
                  const checked=recrue.checks&&recrue.checks[task.id];
                  return(
                    <div key={task.id} onClick={()=>onToggle(recrue.id,task.id)}
                      style={{display:"flex",alignItems:"flex-start",gap:".55rem",padding:".42rem 0",borderBottom:`1px solid rgba(232,213,204,.3)`,cursor:"pointer"}}>
                      <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?block.color:C.rose}`,background:checked?block.color:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                        {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                      </div>
                      <div style={{fontSize:".75rem",color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none",lineHeight:1.45,flex:1}}>{task.label}</div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function SuiviRecruTab({uid, isChef=false}){
  const[filleules,setFilleules]=useState([]);
  const[loading,setLoading]=useState(true);
  const[sel,setSel]=useState(null);
  const[extras,setExtras]=useState({}); // uid -> {fastStart, caPerso, premiere_commande}
  const[loadingExtra,setLoadingExtra]=useState({});
  const[voirToute,setVoirToute]=useState(isChef);

  // Une recrue est "nouvelle" si inscrite il y a moins de 14 jours
  const estNouvelle=(f)=>{
    if(!f.dateEnreg)return false;
    const jours=(Date.now()-new Date(f.dateEnreg).getTime())/(1000*60*60*24);
    return jours<=14;
  };

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        if(snap.exists()){
          const membres=snap.data().membres||{};
          let liste;
          if(voirToute){
            // Chef d'équipe : toute la lignée (filleules + sous-filleules, récursif)
            const tree=buildEquipeTree(membres,uid);
            const aplatir=(nodes,niveau=1)=>nodes.flatMap(n=>[{...n,niveau},...aplatir(n.enfants||[],niveau+1)]);
            liste=aplatir(tree).sort((a,b)=>new Date(b.dateEnreg||0)-new Date(a.dateEnreg||0));
          } else {
            // Distributrice simple : filleules directes uniquement
            liste=Object.entries(membres)
              .filter(([,m])=>m.marraine===uid)
              .map(([mUid,m])=>({uid:mUid,...m,niveau:1}))
              .sort((a,b)=>new Date(b.dateEnreg||0)-new Date(a.dateEnreg||0));
          }
          setFilleules(liste);
        }
      }catch{}
      setLoading(false);
    })();
  },[uid,voirToute]);

  const chargerExtra=async(mUid)=>{
    if(extras[mUid])return;
    setLoadingExtra(p=>({...p,[mUid]:true}));
    try{
      const snap=await getDoc(doc(db,"users",mUid));
      if(snap.exists()){
        const d=snap.data();
        const obj=d["db-obj-perso"]?JSON.parse(d["db-obj-perso"]):{};
        setExtras(p=>({...p,[mUid]:{
          fastStart:d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null,
          caPerso:parseFloat(obj.caPerso)||0,
          premiereCommande:!!obj.caPerso&&parseFloat(obj.caPerso)>0,
          premiereCommandeManuelle:d["premiere_commande_validee"]||false,
        }}));
      }
    }catch{}
    setLoadingExtra(p=>({...p,[mUid]:false}));
  };

  const validerPremiereCommande=async(mUid,val)=>{
    try{
      await setDoc(doc(db,"users",mUid),{premiere_commande_validee:val},{merge:true});
      setExtras(p=>({...p,[mUid]:{...p[mUid],premiereCommandeManuelle:val}}));
    }catch{}
  };

  const retirerFastStart=async(mUid,nom)=>{
    if(!window.confirm("Retirer le Fast Start de "+nom+" ?")) return;
    try{
      await setDoc(doc(db,"users",mUid),{"db-fast-start":""},  {merge:true});
      alert("Fast Start retiré pour "+nom);
    }catch(e){alert("Erreur");}
  };

  const assignerFastStart=async(mUid,nom)=>{
    try{
      const ref=doc(db,"users",mUid);
      const snap=await getDoc(ref);
      const existing=snap.exists()&&snap.data()["db-fast-start"]?JSON.parse(snap.data()["db-fast-start"]):{};
      if(!existing.startDate){
        await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
        alert("✅ Fast Start assigné à "+nom);
        chargerExtra(mUid);
      } else {
        if(window.confirm(nom+" a déjà un Fast Start. Relancer ?")){
          await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
          setExtras(p=>({...p,[mUid]:{...p[mUid],fastStart:{startDate:todayLocalStr(),doneTasks:{},modulesValides:{}}}}));
        }
      }
    }catch{alert("Erreur.");}
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(filleules.length===0)return(
    <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".5rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",color:C.brun,marginBottom:".3rem"}}>Aucune recrue pour l'instant</div>
      <div style={{fontSize:".72rem"}}>Tes filleules apparaîtront ici dès qu'elles s'inscrivent avec toi comme marraine.</div>
    </div>
  );

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Suivi <em style={{fontStyle:"italic",color:C.rose}}>nouvelles distributrices</em>
      </div>

      {isChef&&(
        <div style={{display:"flex",gap:".3rem",marginBottom:".5rem"}}>
          <button onClick={()=>setVoirToute(true)}
            style={{flex:1,padding:".4rem",fontSize:".68rem",fontWeight:600,borderRadius:9,border:`1px solid ${voirToute?C.rose:C.pale}`,background:voirToute?C.rose:C.blanc,color:voirToute?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            👑 Toute mon équipe ({filleules.length})
          </button>
          <button onClick={()=>setVoirToute(false)}
            style={{flex:1,padding:".4rem",fontSize:".68rem",fontWeight:600,borderRadius:9,border:`1px solid ${!voirToute?C.rose:C.pale}`,background:!voirToute?C.rose:C.blanc,color:!voirToute?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            Mes filleules directes
          </button>
        </div>
      )}

      {filleules.filter(estNouvelle).length>0&&(
        <div style={{display:"flex",alignItems:"center",gap:".4rem",background:C.or+"10",border:`1px solid ${C.or}40`,borderRadius:9,padding:".5rem .75rem",marginBottom:".75rem"}}>
          <span style={{fontSize:"1rem"}}>🆕</span>
          <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>{filleules.filter(estNouvelle).length} nouvelle{filleules.filter(estNouvelle).length>1?"s":""} recrue{filleules.filter(estNouvelle).length>1?"s":""} (- de 14 jours)</span>
        </div>
      )}

      {filleules.map(f=>{
        const isOpen=sel===f.uid;
        const ex=extras[f.uid];
        const fs=ex?.fastStart;
        const modulesValides=fs?Object.values(fs.modulesValides||{}).filter(Boolean).length:0;
        const totalTaches=fs?FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.length,0):0;
        const done=fs?FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.filter((_,i)=>fs.doneTasks?.[`${d2.jour}-${i}`]).length,0):0;
        const pctGlobal=totalTaches?Math.round(done/totalTaches*100):0;
        const aPremiereCommande=ex?.premiereCommandeManuelle||(ex?.caPerso>0);

        return(
          <div key={f.uid} style={{background:C.blanc,border:`1.5px solid ${isOpen?C.rose:C.pale}`,borderRadius:12,marginBottom:".5rem",overflow:"hidden"}}>
            {/* Ligne résumé */}
            <div onClick={()=>{setSel(isOpen?null:f.uid);if(!isOpen&&!ex)chargerExtra(f.uid);}}
              style={{display:"flex",alignItems:"center",gap:".6rem",padding:".65rem .9rem",cursor:"pointer",background:estNouvelle(f)?C.or+"08":"transparent"}}>
              <div style={{width:36,height:36,borderRadius:"50%",background:estNouvelle(f)?C.or+"25":C.rose+"20",color:estNouvelle(f)?C.or:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,border:estNouvelle(f)?`2px solid ${C.or}`:"none"}}>
                {(f.prenom||"?")[0].toUpperCase()}
              </div>
              <div style={{flex:1,minWidth:0}}>
                <div style={{display:"flex",alignItems:"center",gap:".4rem",flexWrap:"wrap"}}>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{f.prenom} {f.nom}</div>
                  {estNouvelle(f)&&(
                    <span style={{fontSize:".55rem",fontWeight:700,color:"white",background:C.or,borderRadius:20,padding:".1rem .45rem"}}>🆕 Nouvelle</span>
                  )}
                  {voirToute&&f.niveau>1&&(
                    <span style={{fontSize:".55rem",fontWeight:700,color:C.lilas,background:C.lilas+"15",borderRadius:20,padding:".1rem .4rem"}}>N{f.niveau}</span>
                  )}
                </div>
                <div style={{fontSize:".6rem",color:C.gris,display:"flex",gap:".5rem",alignItems:"center",marginTop:".1rem"}}>
                  {f.dateEnreg&&<span>📅 {new Date(f.dateEnreg).toLocaleDateString("fr-FR",{day:"numeric",month:"short",year:"numeric"})}</span>}
                  {fs&&<span style={{color:pctGlobal>=100?C.vert:C.rose}}>🚀 {modulesValides}/7 modules</span>}
                  {!fs&&<span style={{color:C.pale}}>Pas de Fast Start</span>}
                </div>
              </div>
              {/* Badge première commande */}
              <div style={{display:"flex",flexDirection:"column",gap:".2rem",alignItems:"flex-end"}}>
                <div style={{fontSize:".58rem",fontWeight:700,color:aPremiereCommande?C.vert:C.pale,background:aPremiereCommande?C.vert+"15":"transparent",borderRadius:20,padding:".1rem .35rem",border:`1px solid ${aPremiereCommande?C.vert:C.pale}`}}>
                  {aPremiereCommande?"✅ 1ère cmd":"⏳ pas de cmd"}
                </div>
              </div>
              <div style={{display:"flex",flexDirection:"column",gap:".25rem",alignItems:"flex-end"}}>
                <button onClick={e=>{e.stopPropagation();if(window.confirm("Retirer "+f.prenom+" de cette liste de suivi ?")){setFilleules(fl=>fl.filter(x=>x.uid!==f.uid));if(sel===f.uid)setSel(null);}}}
                  style={{background:"none",border:`1px solid #E0C0C0`,borderRadius:6,padding:".15rem .4rem",fontSize:".58rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit"}}>
                  ✕ Retirer
                </button>
              </div>
              <div style={{fontSize:".75rem",color:C.gris,transform:isOpen?"rotate(90deg)":"none",transition:"transform .2s",flexShrink:0}}>›</div>
            </div>

            {/* Détail déplié */}
            {isOpen&&(
              <div style={{borderTop:`1px solid ${C.pale}`,padding:".85rem 1rem"}}>
                {loadingExtra[f.uid]&&<div style={{textAlign:"center",color:C.gris,fontSize:".75rem",padding:".5rem"}}>Chargement...</div>}

                {ex&&(
                  <div>
                    {/* Première commande */}
                    <div style={{background:aPremiereCommande?C.vert+"10":"#FFF8E1",border:`1px solid ${aPremiereCommande?C.vert+"30":"#E6A817"}`,borderRadius:10,padding:".6rem .85rem",marginBottom:".75rem"}}>
                      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                        <div>
                          <div style={{fontSize:".7rem",fontWeight:700,color:aPremiereCommande?C.vent:"#856404"}}>🛍️ Première commande</div>
                          {ex.caPerso>0&&<div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>CA perso détecté : {ex.caPerso}€</div>}
                        </div>
                        <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
                          <input type="checkbox" checked={!!aPremiereCommande}
                            onChange={e=>validerPremiereCommande(f.uid,e.target.checked)}/>
                          <span style={{fontSize:".7rem",color:C.brun,fontWeight:600}}>Valider manuellement</span>
                        </label>
                      </div>
                    </div>

                    {/* Fast Start */}
                    {fs
                      ?<div>
                        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
                          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>🚀 Suivi Fast Start</div>
                          <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                            <span style={{fontSize:".6rem",color:C.gris}}>J1 : {fs.startDate?new Date(fs.startDate).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"-"}</span>
                            <button onClick={()=>retirerFastStart(f.uid,f.prenom+" "+f.nom)}
                              style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".25rem .55rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",marginRight:".3rem"}}>
                              ✕ Retirer FS
                            </button>
                            <button onClick={()=>retirerFastStart(f.uid,f.prenom+" "+f.nom)}
                          style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".25rem .55rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",marginRight:".3rem"}}>
                          ✕ Retirer FS
                        </button>
                        <button onClick={()=>assignerFastStart(f.uid,f.prenom+" "+f.nom)}
                              style={{background:C.rose+"15",border:`1px solid ${C.rose}40`,borderRadius:6,padding:".15rem .45rem",fontSize:".6rem",color:C.rose,cursor:"pointer",fontFamily:"inherit"}}>🔄 Relancer</button>
                          </div>
                        </div>

                        {/* Barre globale */}
                        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:9,padding:".55rem .75rem",marginBottom:".6rem"}}>
                          <div style={{display:"flex",justifyContent:"space-between",marginBottom:".25rem"}}>
                            <span style={{fontSize:".62rem",color:C.or,fontWeight:700}}>{modulesValides}/7 modules validés</span>
                            <span style={{fontSize:".62rem",color:C.pale}}>{done}/{totalTaches} tâches · {pctGlobal}%</span>
                          </div>
                          <div style={{height:5,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden"}}>
                            <div style={{height:"100%",background:pctGlobal>=100?C.vert:C.or,width:pctGlobal+"%",borderRadius:10}}/>
                          </div>
                        </div>

                        {/* Les 7 modules — interface Fast Start */}
                        {FAST_START_DAYS.map(d2=>{
                          const moduleValide=fs.modulesValides?.[d2.jour];
                          const prevValide=d2.jour===1?true:!!fs.modulesValides?.[d2.jour-1];
                          const isLocked=!prevValide&&!moduleValide;
                          const tachesDone=d2.taches.filter((_,i)=>fs.doneTasks?.[`${d2.jour}-${i}`]).length;
                          const total2=d2.taches.length;
                          return(
                            <div key={d2.jour} style={{background:moduleValide?C.vert+"08":C.blanc,border:`1.5px solid ${moduleValide?C.vert:isLocked?C.pale:tachesDone>0?C.or:C.pale}`,borderRadius:11,padding:".65rem .85rem",marginBottom:".4rem",opacity:isLocked?.5:1}}>
                              <div style={{display:"flex",alignItems:"center",gap:".55rem"}}>
                                <div style={{width:26,height:26,borderRadius:"50%",background:moduleValide?C.vert:isLocked?C.pale:tachesDone>0?C.or+"30":C.creme,color:moduleValide?"white":isLocked?C.pale:C.brun,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem",fontWeight:700,flexShrink:0}}>
                                  {moduleValide?"✓":isLocked?"🔒":d2.jour}
                                </div>
                                <div style={{flex:1}}>
                                  <div style={{fontSize:".75rem",fontWeight:700,color:moduleValide?C.vent:isLocked?C.gris:C.brun,lineHeight:1.3}}>{d2.titre}</div>
                                  <div style={{height:3,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".2rem"}}>
                                    <div style={{height:"100%",background:moduleValide?C.vent:C.rose,width:(tachesDone/total2*100)+"%",borderRadius:10}}/>
                                  </div>
                                </div>
                                <div style={{fontSize:".62rem",fontWeight:700,color:moduleValide?C.vent:C.gris,flexShrink:0,textAlign:"right"}}>
                                  {moduleValide?"✅":isLocked?"🔒":`${tachesDone}/${total2}`}
                                </div>
                              </div>
                              {/* Tâches */}
                              {!isLocked&&tachesDone>0&&(
                                <div style={{paddingLeft:".5rem",marginTop:".35rem"}}>
                                  {d2.taches.map((tache,i)=>{
                                    const fait=!!fs.doneTasks?.[`${d2.jour}-${i}`];
                                    const txt=typeof tache==="string"?tache:tache.t;
                                    return fait?(
                                      <div key={i} style={{display:"flex",alignItems:"center",gap:".4rem",padding:".18rem 0",fontSize:".68rem",color:C.vent}}>
                                        <span style={{color:C.vert,fontWeight:700,flexShrink:0}}>✓</span>
                                        <span style={{textDecoration:"line-through",color:C.gris}}>{txt}</span>
                                      </div>
                                    ):null;
                                  })}
                                </div>
                              )}
                            </div>
                          );
                        })}
                      </div>
                      :<div style={{background:C.creme,borderRadius:9,padding:".75rem",textAlign:"center"}}>
                        <div style={{fontSize:".72rem",color:C.gris,marginBottom:".5rem"}}>🚀 Pas de Fast Start assigné</div>
                        <button onClick={()=>retirerFastStart(f.uid,f.prenom+" "+f.nom)}
                          style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".25rem .55rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",marginRight:".3rem"}}>
                          ✕ Retirer FS
                        </button>
                        <button onClick={()=>assignerFastStart(f.uid,f.prenom+" "+f.nom)}
                          style={{background:C.rose,color:"white",border:"none",borderRadius:8,padding:".42rem .85rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                          Assigner le Fast Start
                        </button>
                      </div>
                    }
                  </div>
                )}
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

export function ConversionPopup({prospect:p, clients, distributeurs, saveClients, saveDistributeurs, saveProspects, prospects, onClose}){
  const prenom = p.name.split(" ")[0]||p.name;
  const nom = p.name.split(" ").slice(1).join(" ")||"";
  const[tel,setTel]=useState(p.tel||"");
  const[email,setEmail]=useState(p.email||"");
  const[vers,setVers]=useState(null);

  const doublon = vers==="distributrice" ? distributeurs.find(d=>
    (d.prenom?.toLowerCase()===prenom.toLowerCase()&&d.nom?.toLowerCase()===nom.toLowerCase())||(tel&&d.tel===tel)
  ) : null;

  const confirmer=()=>{
    if(vers==="client"){
      const newClient={id:`c${Date.now()}`,prenom,nom,tel,email,notes:p.note||"",commandes:[],dateAjout:todayLocalStr()};
      saveClients([...clients,newClient]);
    } else if(vers==="distributrice"){
      if(doublon){
        saveDistributeurs(distributeurs.map(d=>d.id===doublon.id?{...d,tel:tel||d.tel,email:email||d.email,prospectId:p.id}:d));
      } else {
        const newDistrib={id:`d${Date.now()}`,prenom,nom,tel,email,palier:"2%",notes:p.note||"",dateEnreg:todayLocalStr(),prospectId:p.id};
        saveDistributeurs([...distributeurs,newDistrib]);
      }
    }
    onClose();
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999}}>
      <div style={{background:C.blanc,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,padding:"1.5rem",boxShadow:"0 -8px 40px rgba(0,0,0,.3)"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".25rem"}}>✅ {p.name} est convertie !</div>
        <div style={{fontSize:".72rem",color:C.gris,marginBottom:"1.2rem"}}>Elle est retirée des prospects. Où veux-tu l'ajouter ?</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
          {[{v:"client",icon:"🛍️",label:"Cliente",color:C.vert},{v:"distributrice",icon:"👑",label:"Distributrice",color:C.or}].map(opt=>(
            <button key={opt.v} onClick={()=>setVers(opt.v)}
              style={{flex:1,background:vers===opt.v?opt.color:opt.color+"15",color:vers===opt.v?"white":opt.color,border:`2px solid ${opt.color}`,borderRadius:10,padding:".6rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {opt.icon} {opt.label}
            </button>
          ))}
        </div>
        {vers&&(
          <div style={{background:C.creme,borderRadius:10,padding:".85rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>Coordonnées</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem",marginBottom:".4rem"}}>
              <div style={{fontSize:".65rem",color:C.gris}}>Prénom : <strong style={{color:C.brun}}>{prenom}</strong></div>
              <div style={{fontSize:".65rem",color:C.gris}}>Nom : <strong style={{color:C.brun}}>{nom||"—"}</strong></div>
            </div>
            <input value={tel} onChange={e=>setTel(e.target.value)} placeholder="Téléphone / WhatsApp"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".4rem"}}/>
            <input value={email} onChange={e=>setEmail(e.target.value)} placeholder="Email"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}/>
            {doublon&&(
              <div style={{background:C.or+"20",border:`1px solid ${C.or}`,borderRadius:8,padding:".45rem .65rem",marginTop:".4rem",fontSize:".68rem",color:C.brun}}>
                ⚠️ Fiche existante : <strong>{doublon.prenom} {doublon.nom}</strong> — sera mise à jour sans doublon.
              </div>
            )}
          </div>
        )}
        <div style={{display:"flex",gap:".5rem"}}>
          <button onClick={onClose}
            style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:9,padding:".6rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
            Ignorer
          </button>
          <button onClick={confirmer} disabled={!vers}
            style={{flex:2,background:vers?C.brun:C.pale,color:vers?C.blanc:C.gris,border:"none",borderRadius:9,padding:".6rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:vers?"pointer":"default"}}>
            {vers?"✓ Confirmer le transfert":"Choisir une destination"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ── SUIVI CLIENTS ─────────────────────────────────────────────────────────────
const INP = (props) => <input {...props} style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem",...props.style}}/>;

// Types de produits courants avec durée d'utilisation typique (en jours) — pour les rappels de réapprovisionnement
const TYPES_PRODUITS_DUREE=[
  {id:"shampoing",label:"🧴 Shampoing",jours:45},
  {id:"soin-cheveux",label:"💇 Soin/masque cheveux",jours:60},
  {id:"gel-douche",label:"🚿 Gel douche",jours:30},
  {id:"creme-visage",label:"✨ Crème visage",jours:60},
  {id:"serum",label:"💧 Sérum",jours:60},
  {id:"contour-yeux",label:"👁️ Contour des yeux",jours:75},
  {id:"baume-corps",label:"🧴 Baume/lait corps",jours:45},
  {id:"deodorant",label:"🌿 Déodorant",jours:60},
  {id:"parfum",label:"🌸 Parfum",jours:180},
  {id:"complement",label:"💊 Complément alimentaire",jours:30},
  {id:"maquillage",label:"💄 Maquillage",jours:90},
  {id:"autre",label:"📦 Autre",jours:30},
];

// Scripts de relance réapprovisionnement, par gamme — {produit} est remplacé par le nom tapé dans la commande
const SCRIPTS_RELANCE_GAMME={
  skincare:"Coucou {prenom} ! 😊 Je me disais que ton {produit} doit bientôt arriver à la fin... Comment se porte ta peau avec ? Si tu veux, je peux te renvoyer la même référence ou te conseiller autre chose selon ce que tu ressens en ce moment 💛",
  "soins-cheveux":"Hello {prenom} ! Petite pensée pour toi 🌸 Ton {produit} doit être presque terminé non ? Comment tu trouves le résultat sur tes cheveux ? Dis-moi si tu veux qu'on en recommande, ou si tu préfères essayer autre chose cette fois !",
  complements:"Coucou {prenom} ! Ça fait un petit moment que tu as commencé ton {produit} — comment tu te sens, des effets que tu remarques ? 😊 Si tu veux continuer la cure, c'est le bon moment pour recommander avant la fin du pot !",
  corps:"Hey {prenom} ! 🧴 Ton {produit} doit bientôt être fini... Tu en es contente ? Je peux te le renvoyer si tu veux, ou te faire découvrir une autre texture pour changer un peu 😊",
  parfum:"Coucou {prenom} ! Petit message pour prendre de tes nouvelles 🌸 Ton {produit} doit être presque vide... Toujours autant fan de cette odeur ou tu serais tentée d'essayer une nouvelle fragrance ?",
  entretien:"Hello {prenom} ! 🌿 Ton {produit} doit bientôt arriver à la fin — verdict, tu l'as trouvé efficace ? Je te le remets de côté si tu veux, dis-moi !",
};

// Mappe chaque type de produit (TYPES_PRODUITS_DUREE) vers sa gamme de script
const TYPE_TO_GAMME={
  shampoing:"soins-cheveux", "soin-cheveux":"soins-cheveux",
  "gel-douche":"corps","baume-corps":"corps","deodorant":"corps",
  "creme-visage":"skincare",serum:"skincare","contour-yeux":"skincare",maquillage:"skincare",
  parfum:"parfum",
  complement:"complements",
  autre:"entretien",
};

function genererScriptRelance(ligne, prenomClient){
  const gamme = TYPE_TO_GAMME[ligne.typeProduit]||"entretien";
  const template = SCRIPTS_RELANCE_GAMME[gamme]||SCRIPTS_RELANCE_GAMME.entretien;
  return template.replace(/{produit}/g, ligne.nom).replace(/{prenom}/g, prenomClient||"toi");
}


// Formulaire édition client avec state local pour éviter le re-render de la liste
// Fiche cliente complète — composant isolé pour éviter le re-render de la liste


// ── SCRIPTS ───────────────────────────────────────────────────────────────────
export const SCRIPTS_DATA=[
  {cat:"🔬 Proposer un diagnostic",scripts:[
    {title:"Story / DM — Diagnostic Peau (général)",text:"🌸 Tu veux enfin comprendre ce dont ta peau a VRAIMENT besoin ?\n\nJe te propose un diagnostic beauté personnalisé — 100% gratuit, 2 minutes chrono ✨\n\nÀ la clé : une ordonnance sur mesure avec les produits faits pour toi 💊\n\n👇 Écris-moi DIAGNOSTIC en MP et je t'envoie le lien !"},
    {title:"DM — Diagnostic Skincare ciblé",text:"Coucou [Prénom] ! 👋\n\nJ'ai vu que tu posais des questions sur [problème peau/routine]... J'ai quelque chose qui pourrait vraiment t'aider !\n\nJe fais des diagnostics peau personnalisés — 5 questions et je te propose une routine adaptée à TON profil avec des produits que j'adore 🌿\n\nC'est gratuit et sans engagement. Tu veux essayer ? 😊"},
    {title:"DM — Diagnostic Cheveux",text:"Coucou [Prénom] ! Je pensais à toi en voyant [contexte]...\n\nEst-ce que tes cheveux te posent des problèmes en ce moment ? (sécheresse, chute, frisottis, etc.)\n\nJe propose des diagnostics capillaires gratuits — ça prend 2 minutes et tu repars avec des conseils 100% adaptés à tes cheveux 💇‍♀️\n\nTu veux que je t'envoie le lien ?"},
    {title:"DM — Diagnostic Makeup & couleurs",text:"Coucou [Prénom] ! 💄\n\nSi tu cherches le maquillage adapté à TON teint, TON style et TON budget... j'ai créé un diagnostic makeup personnalisé !\n\n→ Teinte de fond de teint\n→ Couleurs qui te valorisent\n→ Produits adaptés à ta morphologie\n\nC'est gratuit, ça prend 3 min. Tu veux l'essayer ? 🎨"},
    {title:"DM — Diagnostic Compléments / Minceur",text:"Coucou [Prénom] ! Je voulais te partager quelque chose...\n\nJ'ai un diagnostic bien-être qui aide à identifier exactement QUELS compléments alimentaires peuvent t'aider selon tes objectifs (énergie, minceur, immunité, sommeil...)\n\nBeaucoup de gens prennent des compléments qui ne sont pas adaptés à leurs besoins — ce diagnostic évite ça 💊\n\n2 minutes, gratuit, sans engagement. Ça t'intéresse ? ✨"},
    {title:"DM — Diagnostic Peau Corps",text:"Coucou [Prénom] ! 🌿\n\nEst-ce que tu as des problèmes de peau sur le corps ? (sécheresse, taches, capitons, sensibilité...)\n\nJe fais des diagnostics corps personnalisés pour proposer une routine adaptée. Pas juste \"hydrate-toi\" — une vraie sélection de produits pour TES problèmes spécifiques 💆‍♀️\n\nC'est gratuit, 2 min. Tu veux essayer ?"},
    {title:"DM — Diagnostic Entrepreneur (recrutement)",text:"Coucou [Prénom] ! 😊\n\nJe propose un mini-diagnostic pour savoir si le marketing de réseau pourrait être une option pour toi — sans pression, juste pour avoir une vision claire de ton profil et de tes possibilités.\n\n5 questions, pas de jugement, 100% honnête. Et si ce n'est pas fait pour toi, je te le dirai aussi 😄\n\nTu serais tentée d'essayer ?"},
    {title:"Story — Booster diagnostic (engagement)",text:"🔬 J'ai envoyé [X] diagnostics ce mois-ci...\n\nRésultat : des femmes qui comprennent ENFIN leur peau / leurs cheveux / leurs besoins 🌸\n\n→ Une routine sur mesure\n→ Des produits qu'elles adorent\n→ Des résultats concrets\n\nTu n'as pas encore fait le tien ?\n\n👉 Écris-moi DIAGO en commentaire ou en MP 💬"},
    {title:"Story — Résultat diagnostic (preuve sociale)",text:"Avant le diagnostic : \"Je ne sais pas quels produits prendre, j'ai tout essayé sans résultat\" 😔\n\nAprès le diagnostic : une routine de 3 produits adaptée à son profil exact ✨\n\n→ Résultat en 3 semaines 🌟\n\nC'est ce que j'offre gratuitement à chaque femme qui fait mon diagnostic.\n\nTu veux être la prochaine ? 👇 MP ou commentaire"},
    {title:"Story — Teasing diagnostic makeup",text:"POV : tu portes depuis 3 ans une teinte de fond de teint qui n'est pas vraiment la tienne 😅\n\nJe fais des diagnostics makeup — couleurs, teinte, style — pour trouver exactement ce qui te va.\n\nEt ça change TOUT.\n\n💄 Écris MAKEUP en commentaire pour essayer"},
    {title:"Reel — Accroche diagnostic peau",text:"❌ Tu achètes des produits au hasard sur TikTok\n❌ Tu ne comprends pas pourquoi ta peau ne s'améliore pas\n❌ Tu dépenses une fortune sans résultats\n\n✅ Ce qu'il te faut : un diagnostic peau\n✅ Gratuit\n✅ 2 minutes\n✅ Une ordonnance personnalisée\n\nÉcris PEAU en commentaire 👇"},
    {title:"Approche indirecte — via problème observé",text:"Hé [Prénom] ! J'ai vu ta story avec [problème de peau/cheveux/etc.] — tu galères avec ça depuis longtemps ?\n\nSans pression, mais j'ai un truc qui pourrait vraiment aider. Je fais des petits diagnostics beauté — tu réponds à quelques questions et je te fais une sélection de produits sur mesure.\n\nC'est gratuit. Tu veux qu'on essaie ? 🌸"},
    {title:"Approche via curiosité (mystère)",text:"[Prénom], je t'envoie quelque chose demain que j'envoie seulement à quelques personnes dans mon entourage...\n\n[lendemain]\n\nVoilà ! C'est un diagnostic beauté personnalisé. Ça prend 2 min et tu repars avec une sélection de produits faite pour toi. Gratuit bien sûr 😊\n\nTu veux essayer ?"},
    {title:"Approche via résultat d'une cliente",text:"Je viens de recevoir un message d'une cliente qui a fait mon diagnostic la semaine dernière... Elle me dit que la routine que je lui ai recommandée a changé l'état de sa peau en 10 jours 🤍\n\nSi tu veux, je peux faire le tien aussi ? C'est gratuit et ça prend 2 minutes 😊"},
  ]},
  {cat:"💬 Premier contact",scripts:[
    {title:"Contact WhatsApp — Produits",text:"Coucou [Prénom] 😊 Je pensais à toi ! Je travaille avec une marque de beauté et bien-être qui m'a bluffée. Je me demandais si tu aurais 5 min pour jeter un œil ? Pas d'obligation, juste partager quelque chose qui m'a vraiment plu 🙏"},
    {title:"Contact WhatsApp — Opportunité",text:"Coucou [Prénom] ! J'espère que tu vas bien 🙂 Je développe quelque chose qui m'a permis de gagner un revenu complémentaire depuis chez moi. Ça m'a fait penser à toi — tu serais ouverte à en discuter 5 min ?"},
    {title:"Réponse à une story",text:"Coucou ! J'ai vu ta story sur [sujet] — ça m'a donné envie de te contacter 😊 Je travaille avec une marque que tu pourrais vraiment aimer. Tu veux que je t'envoie quelques infos ?"},
  ]},
  {cat:"🔄 Relance",scripts:[
    {title:"Relance douce",text:"Coucou [Prénom] ! Pas de pression du tout 🙂 Je voulais juste prendre de tes nouvelles. Tu avais eu le temps de regarder ce que je t'avais envoyé ?"},
    {title:"Relance après silence",text:"Coucou [Prénom] ! Ça fait un moment 😊 Je pense souvent à toi. Si tu es toujours curieuse de ce que je fais, je serais ravie d'en parler. Et si tu n'es pas intéressée, c'est ok aussi — dis-le moi simplement !"},
    {title:"Relance après un 'non'",text:"Pas de souci du tout [Prénom] ! Je comprends totalement. Est-ce que tu connais quelqu'un dans ton entourage qui cherche un revenu complémentaire ? Je suis preneuse de toute recommandation 🙏"},
  ]},
  {cat:"🎯 Présentation opportunité",scripts:[
    {title:"Pitch express 30 secondes",text:"En gros — je distribue des produits beauté et bien-être Mihi. Je gagne entre 20 et 30% sur chaque vente, et je touche des commissions sur l'équipe que je construis. Je travaille depuis mon téléphone, à mes heures. Ce n'est pas un miracle — c'est du vrai travail. Mais ça m'a permis de [ton résultat]. Tu veux en savoir plus ?"},
    {title:"Présentation complète — intro",text:"Je vais t'expliquer ce que je fais en 3 points. 1️⃣ Je vends des produits Mihi — beauté, bien-être, perte de poids. 2️⃣ Je gagne une marge de 20 à 30% sur chaque vente. 3️⃣ Je développe une équipe et je touche des commissions sur leur activité. Ce qui me plaît c'est que ça s'adapte à ma vie — pas l'inverse."},
    {title:"Réponse à 'c'est du MLM ?'",text:"Je comprends la méfiance — j'avais les mêmes questions 😊 Oui c'est de la vente directe. La différence avec les arnaques : il y a de vrais produits qu'on vend à de vraies clientes, avec une vraie marge. Je ne gagne pas d'argent en recrutant — je gagne en vendant et en formant une équipe qui vend. Tu veux que je te montre les chiffres concrets ?"},
  ]},
  {cat:"🛍️ Vente produits",scripts:[
    {title:"Présenter les parfums",text:"Tu sais ce que je réponds quand on me demande combien coûte mon parfum ? 😏 Moins de 20€. Et non c'est pas une arnaque — c'est Mihi, une marque que je distribue. La qualité est vraiment là. Tu veux que je t'en envoie quelques références ?"},
    {title:"Présenter les soins visage",text:"Je testais une nouvelle crème ce matin et j'ai pensé à toi 😊 La gamme soin visage que je distribue a des résultats hallucinants — et à des prix vraiment accessibles. Si tu veux, je peux te faire une sélection selon ton type de peau ?"},
    {title:"Inviter à commander",text:"Si tu veux essayer, le plus simple c'est de passer par ma boutique personnelle. Je t'envoie le lien ? Et si tu as des questions sur les produits, je suis là pour t'orienter 🙂"},
  ]},
  {cat:"👑 Recrutement équipe",scripts:[
    {title:"Approche douce recrutement",text:"Coucou [Prénom] ! Je développe mon équipe Blazing Dynasty et en te voyant, je me suis dit que tu pourrais vraiment avoir ta place ici. Je ne te demande pas de dire oui — juste d'écouter 10 min. Qu'est-ce que tu en penses ?"},
    {title:"Après une présentation",text:"Merci d'avoir pris le temps ce soir 🧡 Je suis là si tu as des questions. Pas de pression — prends le temps qu'il te faut. Si ça peut t'aider à décider, je peux te mettre en contact avec une de mes filles qui a démarré dans la même situation que toi."},
    {title:"Gérer l'objection 'je n'ai pas le temps'",text:"Je comprends totalement — moi aussi j'avais l'impression de ne pas avoir le temps au départ 😊 Ce qui m'a surprise c'est que ça prend vraiment le temps qu'on lui donne. Certaines filles de mon équipe commencent avec 30 min par jour. On peut en parler si tu veux ?"},
    {title:"Gérer l'objection 'je ne suis pas vendeuse'",text:"Moi non plus je ne me considérais pas comme vendeuse ! 😅 Ce que je fais c'est surtout partager ce que j'aime avec les gens autour de moi. Les ventes viennent naturellement après. Est-ce que tu partages déjà des produits que tu aimes avec tes amies ? Alors tu sais déjà faire 😊"},
  ]},
  {cat:"📱 Stories & contenu",scripts:[
    {title:"CTA mot-clé commentaire",text:"Tu veux savoir quel est ce produit qui me fait des compliments à chaque fois ? Écris PRODUIT en commentaire et je t'envoie tout en privé 😊"},
    {title:"CTA pour l'opportunité",text:"Tu cherches un revenu complémentaire qui s'adapte à ta vie ? Écris ÉQUIPE en commentaire — je te réponds en privé 🖤"},
    {title:"Intro storytelling",text:"Il y a [X mois], je ne savais pas quoi faire. Aujourd'hui [ton résultat]. Ce n'est pas un miracle — c'est ce que j'ai construit, étape par étape. Je vous raconte ça ce soir en story 👇"},
  ]},
];

// ── ANNONCE IMPORTANTE (pop-up + bandeau) ─────────────────────────────────────

export function MarrainePopup({uid, userName}){
  const[show,setShow]=useState(false);
  const[membres,setMembres]=useState([]);
  const[choix,setChoix]=useState("");
  const[dismissed,setDismissed]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        const moi=annuaire[uid];
        if(moi&&!moi.marraine){
          const accSnap=await getDoc(doc(db,"acces","membres"));
          const liste=accSnap.exists()?accSnap.data().liste||[]:[];
          setMembres(["melissa da silveira", ...liste.filter(m=>m.toLowerCase().replace(/\s+/g,"-")!==uid&&m.toLowerCase()!=="melissa da silveira")]);
          setShow(true);
        }
      }catch{}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const confirmer=async()=>{
    if(!choix){setShow(false);setDismissed(true);return;}
    setSaving(true);
    const marraineUid=choix.toLowerCase().replace(/\s+/g,"-");
    try{
      await setDoc(doc(db,"users",uid),{marraine:marraineUid},{merge:true});
      const ref=doc(db,"equipe","annuaire");
      const snap=await getDoc(ref);
      const existing=snap.exists()&&snap.data().membres?snap.data().membres:{};
      await setDoc(ref,{membres:{...existing,[uid]:{...existing[uid],marraine:marraineUid}}},{merge:true});
    }catch{}
    setSaving(false);setShow(false);
  };

  if(!show||dismissed) return null;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:16,padding:"1.4rem",maxWidth:380,width:"100%",boxShadow:"0 10px 40px rgba(0,0,0,.25)"}}>
        <div style={{fontSize:"1.8rem",textAlign:"center",marginBottom:".4rem"}}>🌸</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:C.brun,textAlign:"center",marginBottom:".5rem"}}>Qui t'a parrainée ?</div>
        <p style={{fontSize:".76rem",color:C.gris,textAlign:"center",lineHeight:1.6,marginBottom:"1rem"}}>
          Ça permettra à ta marraine de te retrouver dans son équipe automatiquement 💛
        </p>
        <SearchSelect value={choix} onChange={setChoix} options={membres} placeholder="🔍 Tape le nom de ta marraine..."/>
        <button onClick={confirmer} disabled={saving}
          style={{width:"100%",background:C.rose,color:"white",border:"none",borderRadius:9,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
          {saving?"...":choix?"Confirmer":"Je ne sais pas / pas de marraine"}
        </button>
        <button onClick={()=>{setShow(false);setDismissed(true);}}
          style={{width:"100%",background:"none",border:"none",color:C.gris,fontSize:".7rem",cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
          Plus tard
        </button>
      </div>
    </div>
  );
}


export function AnnonceBanner({uid}){
  const[annonce,setAnnonce]=useState(null);
  const[showPopup,setShowPopup]=useState(false);
  const[dismissed,setDismissed]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap = await getDoc(doc(db,"admin","annonce"));
        if(snap.exists()&&snap.data().actif&&snap.data().message){
          const a = snap.data();
          setAnnonce(a);
          const vu = await sg(uid,"db-annonce-vue");
          if(!vu || +vu !== a.ts){
            setShowPopup(true);
          }
        }
      }catch{}
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const fermerPopup=()=>{
    setShowPopup(false);
    if(annonce) ss(uid,"db-annonce-vue",String(annonce.ts));
  };

  if(!annonce||dismissed) return null;

  return(
    <>
      {showPopup&&(
        <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.55)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
          <div style={{background:C.blanc,borderRadius:16,padding:"1.4rem",maxWidth:380,width:"100%",boxShadow:"0 10px 40px rgba(0,0,0,.25)"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>📣 ANNONCE IMPORTANTE</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,lineHeight:1.6,marginBottom:"1.2rem",whiteSpace:"pre-wrap"}}>{annonce.message}</div>
            <button onClick={fermerPopup}
              style={{width:"100%",background:C.rose,color:"white",border:"none",borderRadius:9,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Compris !
            </button>
          </div>
        </div>
      )}
      <div style={{background:"linear-gradient(135deg,rgba(196,168,130,.15),rgba(196,154,138,.1))",border:`1px solid ${C.or}50`,borderRadius:12,padding:".8rem 1rem",marginBottom:"1rem",display:"flex",gap:".6rem",alignItems:"flex-start"}}>
        <div style={{fontSize:"1.1rem",flexShrink:0}}>📣</div>
        <div style={{flex:1}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".2rem"}}>Annonce</div>
          <div style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,whiteSpace:"pre-wrap"}}>{annonce.message}</div>
        </div>
        <button onClick={()=>setDismissed(true)}
          style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".75rem",flexShrink:0,padding:".1rem"}}>✕</button>
      </div>
    </>
  );
}

function AdminAnnuaireSync(){
  const[status,setStatus]=useState(null);
  const[loading,setLoading]=useState(false);

  const run=async()=>{
    setLoading(true);
    const added = await seedAnnuaireFromMembres();
    setStatus(added);
    setLoading(false);
  };

  return(
    <div>
      <button onClick={run} disabled={loading}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {loading?"Synchronisation...":"🔄 Synchroniser tous les membres maintenant"}
      </button>
      {status!==null&&(
        <div style={{fontSize:".68rem",color:C.vert,marginTop:".5rem",textAlign:"center"}}>
          ✅ {status} nouveau{status>1?"x":""} membre{status>1?"s":""} ajouté{status>1?"s":""} à l'annuaire.
        </div>
      )}
    </div>
  );
}


function AdminAnnonceEditor(){
  const[message,setMessage]=useState("");
  const[actif,setActif]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","annonce"));
        if(snap.exists()){
          setMessage(snap.data().message||"");
          setActif(!!snap.data().actif);
        }
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(nextActif)=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","annonce"),{message, actif:nextActif, ts:Date.now()});
      setActif(nextActif);
      setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <textarea placeholder="Ex: La soirée formation de ce soir est décalée à 21h !" value={message} onChange={e=>setMessage(e.target.value)}
        style={{width:"100%",minHeight:90,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".8rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
      {actif&&(
        <div style={{fontSize:".68rem",color:C.vert,fontWeight:600,marginBottom:".6rem"}}>✓ Annonce actuellement active — visible par toute l'équipe</div>
      )}
      <div style={{display:"flex",gap:".5rem"}}>
        <button onClick={()=>save(true)} disabled={saving||!message.trim()}
          style={{flex:1,background:C.rose,color:"white",border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"...":saved?"✅ Publié !":"Publier l'annonce"}
        </button>
        {actif&&(
          <button onClick={()=>save(false)} disabled={saving}
            style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .9rem",fontSize:".78rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
            Désactiver
          </button>
        )}
      </div>
    </div>
  );
}



export const FAST_START_DAYS=[
  {jour:1,titre:"Module 1 — Bienvenue & Prise en main 🎉",taches:[
    {t:"Regarde la vidéo du Module 1",link:{video:true,module:1}},
    {t:"Rejoins les groupes Telegram de l'équipe 🔵",link:{url:"https://t.me/+2wKWxIROE4c1M2Q0",label:"Banque d'images équipe"},link2:{url:"https://t.me/+pv0RY_JJy4wyYzE8",label:"Groupe témoignages"}},
  ]},
  {jour:2,titre:"Module 2 — Connaître Mihi 🌿",taches:[
    {t:"Regarde la vidéo du Module 2",link:{video:true,module:2}},
    "Commande ou teste au moins 1 produit Mihi si ce n'est pas fait",
    "Exo : Envoie ta liste des 3 produits préférés avec une phrase sur pourquoi à ta marraine",
  ]},
  {jour:3,titre:"Module 3 — Mon histoire & Ma Why 💫",taches:[
    {t:"Regarde la vidéo du Module 3",link:{video:true,module:3}},
    "Prends 15 minutes pour écrire ton 'pourquoi' en 3 phrases : avant / déclic / maintenant",
    "Exo : Envoie ton 'pourquoi' en quelques lignes à ta marraine",
  ]},
  {jour:4,titre:"Module 4 — Mes premiers contacts 📱",taches:[
    {t:"Regarde la vidéo du Module 4",link:{video:true,module:4}},
    "Fais ta liste de 10 contacts potentiels (famille, amies, collègues, voisines...)",
    "Exo : Envoie ta liste de 10 contacts à ta marraine",
  ]},
  {jour:5,titre:"Module 5 — Présenter Mihi 🎯",taches:[
    {t:"Regarde la vidéo du Module 5",link:{video:true,module:5}},
    "Entraîne-toi à ton pitch de 30 secondes à voix haute 3 fois",
    "Exo : Fais une story ou un post et envoie la capture à ta marraine",
  ]},
  {jour:6,titre:"Module 6 — Mes premières ventes 💰",taches:[
    {t:"Regarde la vidéo du Module 6",link:{video:true,module:6}},
    "Note 3 clientes potentielles à contacter cette semaine",
    "Exo : Envoie la confirmation de ta première commande client à ta marraine",
  ]},
  {jour:7,titre:"Module 7 — Je construis mon équipe 👑",taches:[
    {t:"Regarde la vidéo du Module 7",link:{video:true,module:7}},
    "Identifie 1 personne dans ton entourage qui pourrait être intéressée par l'opportunité",
    "Exo : Envoie le nom d'une personne contactée pour l'opportunité à ta marraine",
  ]},
];

// Quiz + exercice de validation pour chaque module
export const FAST_START_QUIZ=[
  {
    jour:1,
    exercice:null, // pas d'exercice pour module 1
    quiz:[
      {q:"Où se passe la vie d'équipe au quotidien ?",options:["Sur Facebook","Sur Telegram","Par email","Sur WhatsApp"],rep:1},
      {q:"Que représente Blazing Dynasty ?",options:["Une marque de cosmétiques","L'équipe et la communauté","Le nom de l'appli","Le groupe Facebook"],rep:1},
      {q:"Quelle est ta première mission dans l'équipe ?",options:["Faire une vente","Rejoindre Telegram et explorer l'appli","Recruter une filleule","Poster sur Instagram"],rep:1},
    ],
  },
  {
    jour:2,
    exercice:"Envoie à ta marraine ta liste des 3 produits Mihi préférés avec une phrase sur pourquoi tu les as choisis 🌿",
    quiz:[
      {q:"Qu'est-ce qui différencie Mihi des autres marques ?",options:["Le prix le plus bas","Les ingrédients naturels et la qualité","Le nombre de produits","La livraison gratuite"],rep:1},
      {q:"Pour bien parler des produits, tu dois d'abord...",options:["Les avoir vendus au moins une fois","Les avoir testés toi-même","Lire tous les fiches techniques","Regarder des vidéos YouTube"],rep:1},
      {q:"Combien de gammes principales propose Mihi ?",options:["2","4","6","Plus de 6"],rep:3},
    ],
  },
  {
    jour:3,
    exercice:"Rédige ton 'pourquoi' en 3-5 phrases (avant / déclic / maintenant) et envoie-le à ta marraine 💫",
    quiz:[
      {q:"Pourquoi ton 'pourquoi' est-il important ?",options:["Pour remplir le formulaire","C'est la base de ton authenticité et de ta connexion aux autres","Pour impressionner les prospects","Ce n'est pas vraiment important"],rep:1},
      {q:"La structure d'une bonne histoire personnelle c'est :",options:["Chiffres / résultats / objectifs","Avant / déclic / maintenant","Produits / prix / livraison","Suivis / relances / clôture"],rep:1},
      {q:"Ton histoire doit être :",options:["Parfaite et sans défauts","Longue et détaillée","Authentique et personnelle","Centrée sur les produits"],rep:2},
    ],
  },
  {
    jour:4,
    exercice:"Envoie ta liste de 10 contacts potentiels à ta marraine (prénom + lien avec toi) 📱",
    quiz:[
      {q:"Quel est le meilleur point de départ pour ta liste de contacts ?",options:["Les inconnus sur Instagram","Ton entourage proche (famille, amies, collègues)","Les groupes Facebook","Les pages professionnelles"],rep:1},
      {q:"Comment approcher naturellement un contact ?",options:["En envoyant directement le lien boutique","En prenant des nouvelles d'abord, sans parler de Mihi","En faisant un pitch complet d'emblée","En publiant son contact sur les réseaux"],rep:1},
      {q:"Combien de contacts doit contenir ta liste de départ ?",options:["5 minimum","10 minimum","50 minimum","100 minimum"],rep:1},
    ],
  },
  {
    jour:5,
    exercice:"Publie une story ou un post Mihi et envoie la capture d'écran à ta marraine 🎯",
    quiz:[
      {q:"Un bon pitch de présentation dure :",options:["5 minutes minimum","30 secondes maximum","10 minutes","1 à 2 minutes"],rep:1},
      {q:"Que doit contenir une bonne story de présentation Mihi ?",options:["Tous les prix de la gamme","Ton résultat ou ressenti personnel + appel à l'action","Le lien de la boutique uniquement","Une liste de tous les produits"],rep:1},
      {q:"Quelle est la règle d'or du contenu sur les réseaux ?",options:["Publier le plus souvent possible","Copier-coller ce qui marche pour d'autres","Être authentique et régulière","Parler uniquement des produits"],rep:2},
    ],
  },
  {
    jour:6,
    exercice:"Envoie la confirmation de ta première commande client à ta marraine 💰",
    quiz:[
      {q:"Après une commande, quand recontacter la cliente ?",options:["Jamais, c'est elle qui revient","3 à 5 jours après réception pour prendre des nouvelles","Un mois après","Uniquement si elle a un problème"],rep:1},
      {q:"Le service après-vente c'est :",options:["Une obligation légale","Un outil puissant pour fidéliser et obtenir des recommandations","Une perte de temps","Uniquement pour les problèmes"],rep:1},
      {q:"Comment transformer une cliente en ambassadrice ?",options:["En lui donnant des remises","En la suivant régulièrement et en lui demandant son avis","En lui envoyant beaucoup de messages","En lui proposant de rejoindre l'équipe dès la 1ère commande"],rep:1},
    ],
  },
  {
    jour:7,
    exercice:"Envoie le prénom et le profil d'une personne que tu as contactée pour l'opportunité business à ta marraine 👑",
    quiz:[
      {q:"Comment parler de l'opportunité sans forcer ?",options:["Envoyer le lien d'inscription directement","Partager ton propre parcours et laisser la curiosité venir","Lister tous les avantages financiers","Faire un pitch complet non sollicité"],rep:1},
      {q:"Quel profil est idéal pour l'opportunité Mihi ?",options:["Uniquement les personnes sans emploi","Uniquement les experts en vente","Toute personne motivée, quelle que soit sa situation","Uniquement les femmes de moins de 30 ans"],rep:2},
      {q:"Après 7 modules, la suite c'est :",options:["Arrêter de se former","Tout faire seule","Continuer à te former et t'appuyer sur ta marraine","Attendre les résultats"],rep:2},
    ],
  },
];

export function FastStartQuizPopup({jour, uid, userName, marraineUid, onClose, onValide}){
  const config = FAST_START_QUIZ.find(q=>q.jour===jour);
  const[step,setStep]=useState(config?.exercice?"exercice":"quiz");
  const[reponses,setReponses]=useState({});
  const[exoTexte,setExoTexte]=useState("");
  const[sending,setSending]=useState(false);
  const[sent,setSent]=useState(false);
  const[score,setScore]=useState(null);
  if(!config) return null;

  // config existe ici
  const titre=FAST_START_DAYS.find(d=>d.jour===jour)?.titre||`Module ${jour}`;
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  const validerQuiz=()=>{
    let s=0;
    config.quiz.forEach((q,i)=>{ if(reponses[i]===q.rep) s++; });
    setScore(s);
    setStep("envoyer");
  };

  const envoyer=async()=>{
    setSending(true);
    try{
      // Message envoyé à la marraine
      if(marraineUid){
        const ref=doc(db,"messages",marraineUid);
        const snap=await getDoc(ref);
        const existing=snap.exists()?snap.data().msgs||[]:[];

        // Détail des réponses au quiz
        let quizDetail = "";
        if(config.quiz){
          config.quiz.forEach((q,i)=>{
            const repDonnee = reponses[i];
            const estJuste = repDonnee === q.rep;
            quizDetail += `\n${estJuste?"✅":"❌"} Q${i+1}: ${q.q}\n   → Réponse: "${q.options[repDonnee]||"?"}" ${estJuste?"(correct)":"(incorrect — bonne réponse: "+q.options[q.rep]+")"}\n`;
          });
        }

        const msg={
          id:`fs${Date.now()}`,
          de:uid,
          deNom:fmt(uid),
          texte:`✅ ${fmt(uid)} a validé le ${titre}\n\n${config.exercice&&exoTexte?`📝 Exercice :\n${exoTexte}\n`:""}\n📊 Quiz : ${score}/${config.quiz.length} bonnes réponses${quizDetail}`,
          ts:Date.now(),
          lu:false,
          type:"faststart",
          score,
          total:config.quiz.length,
        };
        await setDoc(ref,{msgs:[msg,...existing].slice(0,100)});
      }
      // Marquer le module comme validé
      onValide&&onValide(jour);
      setSent(true);
    }catch{}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999}}>
      <div style={{background:C.blanc,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.3)"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1rem 1.2rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.blanc}}>
              {step==="exercice"?"📝 Exercice":step==="quiz"?"📊 Quiz de validation":step==="envoyer"?"📤 Envoyer à ta marraine":"✅ Validé !"}
            </div>
            <div style={{fontSize:".65rem",color:C.pale,marginTop:".15rem"}}>{titre}</div>
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",color:C.pale,fontSize:"1.2rem",cursor:"pointer"}}>✕</button>
        </div>

        <div style={{padding:"1.2rem"}}>

          {/* ÉTAPE EXERCICE */}
          {step==="exercice"&&config.exercice&&(
            <div>
              <div style={{background:C.creme,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",borderLeft:`3px solid ${C.rose}`}}>
                <div style={{fontSize:".7rem",fontWeight:700,color:C.rose,marginBottom:".3rem"}}>📝 Exercice de validation</div>
                <div style={{fontSize:".8rem",color:C.brun,lineHeight:1.65}}>{config.exercice}</div>
              </div>
              <textarea value={exoTexte} onChange={e=>setExoTexte(e.target.value)}
                placeholder="Écris ta réponse ici... ou décris ce que tu as fait"
                style={{width:"100%",minHeight:100,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".8rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:"1rem"}}/>
              <button onClick={()=>setStep("quiz")}
                style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                Continuer → Quiz de validation
              </button>
            </div>
          )}

          {/* ÉTAPE QUIZ */}
          {step==="quiz"&&(
            <div>
              <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
                Réponds aux questions pour valider ce module et débloquer le suivant 🎯
              </p>
              {config.quiz.map((q,i)=>(
                <div key={i} style={{marginBottom:"1rem"}}>
                  <div style={{fontSize:".8rem",fontWeight:600,color:C.brun,marginBottom:".5rem",lineHeight:1.5}}>{i+1}. {q.q}</div>
                  {q.options.map((opt,j)=>(
                    <div key={j} onClick={()=>setReponses(r=>({...r,[i]:j}))}
                      style={{display:"flex",alignItems:"center",gap:".6rem",padding:".5rem .75rem",borderRadius:9,border:`1.5px solid ${reponses[i]===j?C.rose:C.pale}`,background:reponses[i]===j?C.rose+"10":"transparent",marginBottom:".3rem",cursor:"pointer",transition:"all .15s"}}>
                      <div style={{width:18,height:18,borderRadius:"50%",border:`2px solid ${reponses[i]===j?C.rose:C.pale}`,background:reponses[i]===j?C.rose:"transparent",flexShrink:0}}/>
                      <div style={{fontSize:".76rem",color:C.texte}}>{opt}</div>
                    </div>
                  ))}
                </div>
              ))}
              <button onClick={validerQuiz}
                disabled={Object.keys(reponses).length<config.quiz.length}
                style={{width:"100%",background:Object.keys(reponses).length>=config.quiz.length?C.brun:C.pale,color:Object.keys(reponses).length>=config.quiz.length?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:Object.keys(reponses).length>=config.quiz.length?"pointer":"default",transition:"all .2s"}}>
                Valider le quiz →
              </button>
            </div>
          )}

          {/* ÉTAPE ENVOYER */}
          {step==="envoyer"&&!sent&&(
            <div>
              {/* Score */}
              <div style={{background:score>=2?C.vert+"15":C.rose+"15",border:`1px solid ${score>=2?C.vert:C.rose}`,borderRadius:12,padding:"1rem",textAlign:"center",marginBottom:"1rem"}}>
                <div style={{fontSize:"2rem",marginBottom:".3rem"}}>{score===config.quiz.length?"🏆":score>=2?"✅":"💪"}</div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>{score}/{config.quiz.length} bonnes réponses</div>
                <div style={{fontSize:".72rem",color:C.gris,marginTop:".2rem"}}>
                  {score===config.quiz.length?"Parfait !":score>=2?"Bien joué !":"Continue à revoir les notions du module"}
                </div>
              </div>

              {/* Récap exercice */}
              {config.exercice&&exoTexte&&(
                <div style={{background:C.creme,borderRadius:10,padding:".75rem",marginBottom:"1rem",fontSize:".74rem",color:C.brun}}>
                  <strong>Ton exercice :</strong> {exoTexte}
                </div>
              )}

              <button onClick={envoyer} disabled={sending}
                style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".75rem",fontSize:".84rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:".5rem"}}>
                {sending?"Envoi en cours...":"📤 Envoyer à ma marraine pour validation"}
              </button>
              <button onClick={onClose}
                style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:10,padding:".55rem",fontSize:".76rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
                Enregistrer et fermer
              </button>
            </div>
          )}

          {/* ENVOYÉ */}
          {sent&&(
            <div style={{textAlign:"center",padding:"1.5rem 0"}}>
              <div style={{fontSize:"3rem",marginBottom:".5rem"}}>🎉</div>
              <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun,marginBottom:".5rem"}}>
                Module {jour} validé !
              </div>
              <p style={{fontSize:".78rem",color:C.gris,lineHeight:1.7,marginBottom:"1.2rem"}}>
                Ta marraine a reçu tes réponses et va valider ton module. Le module suivant se débloque automatiquement 🚀
              </p>
              <button onClick={onClose}
                style={{background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".65rem 1.4rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                Continuer →
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}



const PRODUITS_DEFAULT=[
  {id:"sk-anti-age",categorie:"Skincare",icon:"✨",nom:"Crème/Sérum anti-âge",besoins:"Rides, fermeté, peau mature",pointsForts:"Actifs concentrés, résultats visibles, texture premium",prix:""},
  {id:"sk-hydratant",categorie:"Skincare",icon:"✨",nom:"Soin hydratant visage",besoins:"Peau sèche, déshydratée, tiraillements",pointsForts:"Hydratation longue durée, confort immédiat",prix:""},
  {id:"sk-nettoyant",categorie:"Skincare",icon:"✨",nom:"Mousse / gel nettoyant",besoins:"Nettoyage en douceur, peaux sensibles",pointsForts:"Respecte le film hydrolipidique, non agressif",prix:""},
  {id:"sk-contour",categorie:"Skincare",icon:"✨",nom:"Contour des yeux",besoins:"Cernes, poches, ridules",pointsForts:"Effet coup d'éclat immédiat, action longue durée",prix:""},
  {id:"sk-gommage",categorie:"Skincare",icon:"✨",nom:"Gommage visage",besoins:"Peau terne, pores bouchés, teint irrégulier",pointsForts:"Grains fins, action douce, peau lissée immédiatement",prix:""},

  {id:"ch-secs",categorie:"Soins cheveux",icon:"💇",nom:"Shampoing/Soin cheveux secs",besoins:"Cheveux secs, abîmés, pointes fourchues",pointsForts:"Nutrition intense, résultats comparables marques pro",prix:""},
  {id:"ch-gras",categorie:"Soins cheveux",icon:"💇",nom:"Shampoing cheveux gras / racines",besoins:"Racines grasses, cheveux qui regraissent vite",pointsForts:"Effet purifiant, fraîcheur longue durée",prix:""},
  {id:"ch-reparateur",categorie:"Soins cheveux",icon:"💇",nom:"Baume / masque réparateur",besoins:"Cheveux colorés, cassants, abîmés par la chaleur",pointsForts:"Répare la fibre en profondeur, brillance retrouvée",prix:""},
  {id:"ch-volume",categorie:"Soins cheveux",icon:"💇",nom:"Soin volumateur",besoins:"Cheveux fins, sans volume, qui s'aplatissent",pointsForts:"Effet volume visible dès la première utilisation",prix:""},
  {id:"ch-anticalc",categorie:"Soins cheveux",icon:"💇",nom:"Soin anti-calcaire/eau dure",besoins:"Cheveux qui nettoient mal avec l'eau du robinet, dépôts calcaires",pointsForts:"Nettoie sans abîmer ni dessécher, douceur préservée",prix:""},

  {id:"mu-mascara",categorie:"Make-up",icon:"💄",nom:"Mascara volume",besoins:"Cils plats, peu de tenue, envie de volume",pointsForts:"Volume immédiat, longue tenue, qualité pro",prix:""},
  {id:"mu-fdt",categorie:"Make-up",icon:"💄",nom:"Fond de teint matifiant",besoins:"Peau grasse, brillances, envie de teint unifié",pointsForts:"Tenue longue durée, fini matifié naturel",prix:""},
  {id:"mu-rouge",categorie:"Make-up",icon:"💄",nom:"Rouge à lèvres longue tenue",besoins:"Couleur qui ne tient pas, lèvres sèches",pointsForts:"Tenue longue durée, confort, large choix de teintes",prix:""},
  {id:"mu-teint",categorie:"Make-up",icon:"💄",nom:"Correcteur / anti-cernes",besoins:"Cernes, imperfections, teint terne",pointsForts:"Couvrance modulable, fini naturel",prix:""},

  {id:"co-detox",categorie:"Compléments alimentaires",icon:"💊",nom:"Détox / draineur",besoins:"Sensation de lourdeur, rétention, besoin de \"reset\"",pointsForts:"Formule naturelle, effet ressenti rapidement",prix:""},
  {id:"co-brulegraisse",categorie:"Compléments alimentaires",icon:"💊",nom:"Brûle-graisses / métabolisme",besoins:"Perte de poids, coup de pouce métabolisme",pointsForts:"Booste l'énergie, soutient la perte de poids",prix:""},
  {id:"co-vitamines",categorie:"Compléments alimentaires",icon:"💊",nom:"Vitamines / énergie",besoins:"Fatigue, baisse d'énergie, immunité",pointsForts:"Formule complète, effet ressenti sur l'énergie quotidienne",prix:""},
  {id:"co-ginkgo",categorie:"Compléments alimentaires",icon:"💊",nom:"Ginkgo biloba / circulation",besoins:"Jambes lourdes, mémoire, circulation",pointsForts:"Plante reconnue, action ciblée",prix:""},

  {id:"pa-femme",categorie:"Parfums",icon:"🌸",nom:"Parfum Femme",besoins:"Envie d'un nouveau parfum, budget serré sur les grandes marques",pointsForts:"Qualité comparable aux grandes marques, à moins de 20€",prix:""},
  {id:"pa-homme",categorie:"Parfums",icon:"🌸",nom:"Parfum Homme",besoins:"Cadeau homme, parfum du quotidien",pointsForts:"Sillage qualitatif, prix très accessible",prix:""},

  {id:"sc-gommage-or",categorie:"Soin corps",icon:"🧴",nom:"Gommage effet or",besoins:"Peau terne, envie de rituel cocooning",pointsForts:"Expérience sensorielle premium, peau douce immédiatement",prix:""},
  {id:"sc-baume",categorie:"Soin corps",icon:"🧴",nom:"Baume satiné corps",besoins:"Peau sèche, manque d'éclat",pointsForts:"Hydratation longue durée, fini satiné non gras",prix:""},
  {id:"sc-enveloppement",categorie:"Soin corps",icon:"🧴",nom:"Enveloppement / soin minceur",besoins:"Cellulite, fermeté, rituel minceur",pointsForts:"Effet rituel spa, parfait pour box cadeaux",prix:""},
];


function ProduitsSearchTab(){
  const[question,setQuestion]=useState("");
  const[loading,setLoading]=useState(false);
  const[ordonnance,setOrdonnance]=useState(null);
  const[erreur,setErreur]=useState("");
  const[baseFormation,setBaseFormation]=useState({});
  const[baseLoaded,setBaseLoaded]=useState(false);

  // Charger la base Formation Produits au démarrage
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","formation_produits"));
        if(snap.exists()) setBaseFormation(snap.data().produits||{});
      }catch{}
      setBaseLoaded(true);
    })();
  },[]);

  // Construire le contexte textuel à injecter dans le prompt
  const buildContexte=()=>{
    const lignes=[];
    CATEGORIES_PRODUITS.forEach(cat=>{
      const produits=baseFormation[cat.id]||[];
      if(produits.length===0)return;
      lignes.push(`\n=== ${cat.icon} ${cat.label.toUpperCase()} ===`);
      produits.forEach(p=>{
        lignes.push(`\nProduit : ${p.titre}`);
        if(p.description) lignes.push(`Description : ${p.description.slice(0,600)}`);
      });
    });
    return lignes.join("\n");
  };

  const genererOrdonnance=async()=>{
    const q=question.trim();
    if(!q)return;
    setLoading(true);setErreur("");setOrdonnance(null);

    const contexte=buildContexte();

    if(!contexte||contexte.length<50){
      setErreur("La base de formation produits est vide. Demande à Melissa d'ajouter des produits depuis l'Admin.");
      setLoading(false);return;
    }

    const prompt=`Tu es une conseillère beauté et bien-être experte des produits Mihi, qui aide à trouver la combinaison parfaite pour chaque cliente.

BASE DE CONNAISSANCES PRODUITS MIHI :
${contexte}

QUESTION / BESOIN DE LA CLIENTE :
"${q}"

En te basant UNIQUEMENT sur les produits présents dans la base de connaissances ci-dessus, génère une ordonnance personnalisée en JSON (ne renvoie QUE le JSON, sans markdown ni commentaire) :

{
  "analyse": "2-3 phrases qui analysent le besoin exprimé et expliquent ton approche",
  "packs": [
    {
      "nom": "Pack Essentiel",
      "emoji": "💚",
      "couleur": "#27AE60",
      "description": "L'essentiel pour commencer, budget accessible",
      "produits": [
        {"nom": "Nom exact du produit", "role": "Pourquoi ce produit pour ce besoin", "categorie": "Catégorie"},
        {"nom": "Nom exact du produit 2", "role": "Pourquoi ce produit", "categorie": "Catégorie"}
      ],
      "avantage_cle": "Le principal bénéfice de ce pack en 1 phrase"
    },
    {
      "nom": "Pack Recommandé",
      "emoji": "⭐",
      "couleur": "#C49A8A",
      "description": "La combinaison idéale, notre recommandation",
      "produits": [
        {"nom": "Produit 1", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 2", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 3", "role": "Rôle", "categorie": "Catégorie"}
      ],
      "avantage_cle": "Pourquoi ce pack est le meilleur choix"
    },
    {
      "nom": "Pack Premium",
      "emoji": "👑",
      "couleur": "#C4A832",
      "description": "La routine complète, résultats maximaux",
      "produits": [
        {"nom": "Produit 1", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 2", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 3", "role": "Rôle", "categorie": "Catégorie"},
        {"nom": "Produit 4", "role": "Rôle", "categorie": "Catégorie"}
      ],
      "avantage_cle": "L'expérience complète et transformative"
    }
  ],
  "conseil": "Un conseil personnalisé final pour accompagner la cliente, en 2 phrases"
}

RÈGLES IMPORTANTES :
- N'utilise QUE les produits présents dans la base de connaissances
- Si la base ne contient pas assez de produits pour répondre, adapte les packs en conséquence
- Les packs doivent être progressifs en termes de complétude (pas nécessairement de prix)
- Sois précise et concrète dans les explications`;

    try{
      const res=await fetch("https://api.anthropic.com/v1/messages",{
        method:"POST",
        headers:{
          "Content-Type":"application/json",
          "x-api-key":ANTHROPIC_API_KEY,
          "anthropic-version":"2023-06-01",
          "anthropic-dangerous-direct-browser-access":"true"
        },
        body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:2000,messages:[{role:"user",content:prompt}]})
      });
      const data=await res.json();
      if(data.error)throw new Error(data.error.message);
      const text=data.content?.map(i=>i.text||"").join("")||"";
      const clean=text.replace(/```json|```/g,"").trim();
      setOrdonnance(JSON.parse(clean));
    }catch(e){
      setErreur("Erreur lors de la génération. Réessaie dans quelques secondes.");
    }
    setLoading(false);
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Conseillère <em style={{fontStyle:"italic",color:C.rose}}>Produits IA</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Décris le besoin de ta cliente — l'IA sélectionne les produits Mihi adaptés et crée une ordonnance personnalisée.
      </p>

      {/* Exemples de questions */}
      {!ordonnance&&!loading&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",marginBottom:".75rem"}}>
          {["Peau sèche et terne","Perte de poids + énergie","Maquillage longue tenue","Cheveux abîmés","Complément anti-âge","Parfum féminin doux"].map(ex=>(
            <button key={ex} onClick={()=>setQuestion(ex)}
              style={{padding:".3rem .65rem",fontSize:".68rem",borderRadius:20,border:`1px solid ${C.pale}`,background:C.blanc,color:C.brun,cursor:"pointer",fontFamily:"inherit"}}>
              {ex}
            </button>
          ))}
        </div>
      )}

      {/* Champ de saisie */}
      <div style={{position:"relative",marginBottom:".75rem"}}>
        <textarea
          value={question}
          onChange={e=>setQuestion(e.target.value)}
          placeholder="Ex: Ma cliente a la peau grasse avec des imperfections, elle veut aussi perdre du poids durablement..."
          rows={3}
          style={{width:"100%",border:`1px solid ${question?C.rose:C.pale}`,borderRadius:12,padding:".65rem .85rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",resize:"none",lineHeight:1.6}}
        />
      </div>

      <button onClick={genererOrdonnance} disabled={loading||!question.trim()||!baseLoaded}
        style={{width:"100%",background:loading?"#aaa":question.trim()?C.brun:C.pale,color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:600,fontFamily:"inherit",cursor:loading||!question.trim()?"default":"pointer",marginBottom:"1rem",transition:"background .2s"}}>
        {loading?"✨ L'IA cherche dans les produits...":!baseLoaded?"Chargement de la base...":"✨ Générer l'ordonnance produits"}
      </button>

      {erreur&&<div style={{background:"#FEE",border:"1px solid #E88",borderRadius:9,padding:".65rem .85rem",fontSize:".74rem",color:"#B04040",marginBottom:"1rem"}}>{erreur}</div>}

      {/* ORDONNANCE */}
      {ordonnance&&(
        <div>
          {/* Analyse */}
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".55rem",fontWeight:700,color:C.or,letterSpacing:".12em",textTransform:"uppercase",marginBottom:".35rem"}}>🔍 Analyse du besoin</div>
            <div style={{fontSize:".82rem",color:C.pale,lineHeight:1.7}}>{ordonnance.analyse}</div>
          </div>

          {/* 3 Packs */}
          {(ordonnance.packs||[]).map((pack,idx)=>(
            <div key={idx} style={{background:C.blanc,border:`2px solid ${pack.couleur}30`,borderRadius:14,overflow:"hidden",marginBottom:".75rem"}}>
              {/* Header pack */}
              <div style={{background:`linear-gradient(135deg,${pack.couleur},${pack.couleur}bb)`,padding:".75rem 1rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                  <div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:"white"}}>{pack.emoji} {pack.nom}</div>
                    <div style={{fontSize:".68rem",color:"rgba(255,255,255,.8)",marginTop:".1rem"}}>{pack.description}</div>
                  </div>
                </div>
                <div style={{background:"rgba(255,255,255,.2)",borderRadius:8,padding:".4rem .6rem",marginTop:".5rem",fontSize:".7rem",color:"white",fontWeight:600}}>
                  💡 {pack.avantage_cle}
                </div>
              </div>

              {/* Produits du pack */}
              <div style={{padding:".75rem 1rem"}}>
                {(pack.produits||[]).map((p,i)=>(
                  <div key={i} style={{display:"flex",gap:".55rem",alignItems:"flex-start",padding:".45rem 0",borderBottom:i<(pack.produits.length-1)?`1px solid ${C.pale}30`:"none"}}>
                    <div style={{width:28,height:28,borderRadius:"50%",background:pack.couleur+"20",border:`1.5px solid ${pack.couleur}40`,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:".65rem",fontWeight:700,color:pack.couleur}}>
                      {i+1}
                    </div>
                    <div style={{flex:1}}>
                      <div style={{fontSize:".8rem",fontWeight:700,color:C.brun}}>{p.nom}</div>
                      <div style={{fontSize:".68rem",color:C.gris,fontStyle:"italic",marginTop:".1rem"}}>{p.role}</div>
                      {p.categorie&&<div style={{fontSize:".58rem",color:pack.couleur,marginTop:".1rem",fontWeight:600}}>{CATEGORIES_PRODUITS.find(c=>c.id===p.categorie)?.icon||""} {p.categorie}</div>}
                    </div>
                  </div>
                ))}
              </div>
            </div>
          ))}

          {/* Conseil final */}
          {ordonnance.conseil&&(
            <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",border:`1px solid ${C.or}40`}}>
              <div style={{fontSize:".8rem",color:C.brun,lineHeight:1.7,fontStyle:"italic"}}>💛 {ordonnance.conseil}</div>
            </div>
          )}

          {/* Nouvelle question */}
          <button onClick={()=>{setOrdonnance(null);setQuestion("");}}
            style={{width:"100%",marginTop:"1rem",background:"none",border:`1px solid ${C.pale}`,borderRadius:9,padding:".5rem",fontSize:".76rem",color:C.gris,fontFamily:"inherit",cursor:"pointer"}}>
            ← Nouvelle question
          </button>
        </div>
      )}
    </div>
  );
}

export const OBJECTIONS_VENTE=[
  {id:"cher",icon:"💰",label:"C'est trop cher",reponses:["Je comprends ! Ce qui est intéressant avec Mihi, c'est que les produits sont concentrés — une petite quantité suffit, donc le flacon dure bien plus longtemps qu'un produit classique. Au final, le coût par utilisation est souvent inférieur à ce qu'on trouve en grande surface 😊","La qualité a un prix, mais avec Mihi tu ne paies pas la pub, les intermédiaires ou les rayons de supermarché. Tout va dans le produit. Tu veux que je te montre la différence de composition ?","C'est un investissement dans ta peau et ta santé. Et le plus souvent, mes clientes me disent qu'elles ont arrêté d'acheter 3 ou 4 autres produits parce que Mihi leur suffit !"]},
  {id:"besoin",icon:"🤔",label:"Je n'en ai pas besoin",reponses:["Bien sûr, tu n'es pas obligée ! Mais dis-moi, si tu pouvais avoir une peau plus lumineuse / plus d'énergie / moins de cheveux qui tombent... tu prendrais quoi comme produit actuellement ?","Je t'entends. Et souvent, on ne sait pas qu'on a besoin d'un produit avant de l'essayer. C'est pour ça que je propose des tests 😊 Qu'est-ce qui te manquerait le plus si tu pouvais changer une chose dans ta routine ?","Ce n'est pas un problème ! Je ne vends pas à tout le monde. Je te pose juste la question : est-ce que tu es contente à 100% de tes produits actuels ?"]},
  {id:"reflexion",icon:"💭",label:"Je vais réfléchir",reponses:["Bien sûr ! Je ne veux pas que tu achètes par pression. Pour t'aider à réfléchir : qu'est-ce qui te retient ? Le prix, le fait de ne pas connaître les produits, autre chose ?","Je comprends. Tu veux qu'on se rappelle dans 3 jours ? Comme ça tu as le temps d'y penser tranquillement 😊","À quoi tu dois réfléchir précisément ? Si c'est une question sur les ingrédients, les résultats ou le budget, je peux t'aider maintenant !"]},
  {id:"concurrence",icon:"🔄",label:"J'ai déjà une autre marque",reponses:["Super ! Ça veut dire que tu prends soin de toi 🌸 Et si tu ajoutes juste un produit Mihi à côté pour comparer ? Beaucoup de mes clientes ont fait ça et ont progressivement switché quand elles ont vu la différence.","C'est quoi ta marque actuelle ? Je te dis franchement si Mihi est mieux adapté ou pas à ton cas. Je préfère être honnête plutôt que de vendre pour vendre.","Je ne te demande pas de tout changer d'un coup ! Est-ce qu'il y a un seul besoin pour lequel tu n'es pas 100% satisfaite ? On peut commencer par là 😊"]},
  {id:"pharmacie",icon:"🏥",label:"Je préfère la pharmacie",reponses:["La pharmacie c'est bien pour des problèmes spécifiques ! Mais pour la routine quotidienne, Mihi propose des formules sans sulfates, sans parabènes, sans perturbateurs endocriniens. Des ingrédients que tu ne trouveras pas forcément en pharmacie.","Je comprends la confiance en pharmacie. Mihi c'est une gamme développée par ElfaPharm, qui est justement un laboratoire pharmaceutique. Tu bénéficies de la même rigueur, mais avec une distribution directe qui fait baisser le prix.","Est-ce qu'il y a un produit spécifique que tu achètes en pharmacie ? Je peux te dire si on a un équivalent et te montrer la comparaison d'ingrédients 😊"]},
];

export const OBJECTIONS_RECRUTEMENT=[
  {id:"mlm",icon:"😬",label:"C'est du MLM / arnaque",reponses:["Je te comprends totalement, j'avais les mêmes craintes au départ ! La différence fondamentale : avec Mihi, je gagne principalement sur les ventes de vrais produits à de vraies clientes. Pas sur le recrutement. Si je recrutais sans vendre, je ne gagnerais rien.","C'est une vente directe réglementée en France, pas un pyramide. Les produits existent vraiment, les clientes les achètent vraiment. Je peux te montrer mes vrais résultats du mois si tu veux être transparente.","Je ne te demande pas de me croire sur parole ! Je te propose juste de rencontrer quelques membres de l'équipe et de leur poser la question directement. Qu'est-ce qui te ferait changer d'avis si tu pouvais avoir une vraie réponse ?"]},
  {id:"temps",icon:"⏰",label:"Je n'ai pas le temps",reponses:["C'est exactement pour ça que je t'en parle ! Beaucoup de mes membres travaillent depuis leur téléphone, pendant que les enfants dorment ou pendant la pause déjeuner. On adapte à ton rythme de vie, pas l'inverse.","Combien d'heures par semaine tu penses avoir ? Parce qu'avec 3-4h par semaine, certaines de mes membres font déjà 200-300€ de ventes. C'est pas le Pérou, mais c'est un vrai complément.","Je ne veux pas que tu sacrifies du temps que tu n'as pas. On peut juste en parler 20 minutes pour que tu aies toutes les infos ? Après tu décides librement 😊"]},
  {id:"argent",icon:"💶",label:"Je n'ai pas les moyens",reponses:["Le starter kit commence à 39€. C'est le seul investissement — après tu te rembourses sur tes premières ventes. Et si vraiment c'est impossible, on peut trouver une solution ensemble.","Je comprends. Est-ce que c'est un problème de budget ponctuel ou structurel ? Parce que si c'est ponctuel, on peut attendre le bon moment. Et si c'est structurel... n'est-ce pas justement pour ça que tu as besoin de revenus complémentaires ?","On peut commencer progressivement. Parle-en autour de toi, ramène tes premières clientes sans kit, et on voit si l'activité te plaît avant d'investir quoi que ce soit."]},
  {id:"introvertie",icon:"😶",label:"Je suis trop timide / pas commerciale",reponses:["Les meilleures vendeuses de l'équipe sont souvent des personnes discrètes ! Parce qu'elles écoutent vraiment les clientes au lieu de les bombarder. Et avec les produits Mihi, tu n'as pas besoin de 'vendre' — tu partages ce que tu aimes vraiment.","Je n'étais pas commerciale du tout non plus au départ. Ce qui a tout changé : aimer les produits et en parler naturellement. Quand tu crois en ce que tu vends, ça ne ressemble plus à de la vente.","On a une formation complète pour ça ! Scripts, réponses aux objections, stories Instagram... On ne te lâche pas dans le vide. Et les premières ventes se font souvent avec l'entourage proche, pas avec des inconnus 😊"]},
  {id:"experience",icon:"📚",label:"Je n'ai pas d'expérience",reponses:["Bonne nouvelle : on n'en a pas besoin ! J'ai des membres qui n'avaient jamais vendu quoi que ce soit et qui font des centaines d'euros par mois aujourd'hui. On forme tout le monde de zéro.","L'expérience vient en faisant. Et comme je suis ta marraine, tu n'es jamais seule. Chaque question, chaque doute, je suis là pour t'aider à avancer.","La seule chose dont tu as besoin : croire aux produits et être prête à apprendre. Le reste, on te l'enseigne étape par étape dans notre programme de démarrage 🚀"]},
];

// ── CALENDRIER ────────────────────────────────────────────────────────────────

// ── OBJECTIFS POPUP ───────────────────────────────────────────────────────────
// ── PÉRIODE MIHI ─────────────────────────────────────────────────────────────
// Période de 21 jours, commence un mercredi
// Référence : période en cours se termine dans 6j 12h à partir d'aujourd'hui (11/06/2026)
export function getPeriodeInfo(){
  // Utiliser le calendrier officiel Mihi
  const campOfficielle = getCampagneMihiActuelle();
  if(campOfficielle){
    const deb = new Date(campOfficielle.debut+"T12:00:00");
    const fin = new Date(campOfficielle.fin+"T23:59:59");
    const now = Date.now();
    const PERIOD_MS = 21*24*60*60*1000;
    const msLeft = fin.getTime() - now;
    const daysLeft = Math.max(0, Math.ceil(msLeft/(1000*60*60*24)));
    const hoursLeft = Math.max(0, Math.floor((msLeft%(1000*60*60*24))/(1000*60*60)));
    const pctElapsed = Math.min(100, Math.round((now-deb.getTime())/PERIOD_MS*100));
    return {periodNum:campOfficielle.num, periodStart:deb, periodEnd:fin, daysLeft, hoursLeft, pctElapsed, pctLeft:Math.max(0,100-pctElapsed)};
  }
  // Fallback calcul linéaire
  const ANCRE = new Date("2026-01-01T12:00:00").getTime();
  const PERIOD_MS = PERIODE_DUREE_JOURS * 24 * 60 * 60 * 1000;
  const d = new Date(); const now = new Date(d.getFullYear(),d.getMonth(),d.getDate(),12,0,0).getTime();
  const periodNum = Math.max(1, Math.floor((now - ANCRE) / PERIOD_MS) + 1);
  const periodStart = new Date(ANCRE + (periodNum-1)*PERIOD_MS);
  const periodEnd = new Date(periodStart.getTime() + PERIOD_MS);
  const msLeft = periodEnd.getTime() - now;
  const daysLeft = Math.max(0, Math.floor(msLeft / (1000*60*60*24)));
  const hoursLeft = Math.max(0, Math.floor((msLeft % (1000*60*60*24)) / (1000*60*60)));
  const pctElapsed = Math.round((1 - msLeft/PERIOD_MS)*100);
  return { daysLeft, hoursLeft, pctElapsed, periodEnd, periodStart, periodNum };
}

function PeriodeTimer(){
  const[info,setInfo]=useState(getPeriodeInfo());
  useEffect(()=>{
    const t=setInterval(()=>setInfo(getPeriodeInfo()),60000);
    return()=>clearInterval(t);
  },[]);
  
  const urgent = info.daysLeft < 3;
  
  return(
    <div style={{background:urgent?"#FFF3E0":C.creme,border:`1px solid ${urgent?"#E6A817":C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:urgent?"#8B5E00":C.brun}}>
          ⏱️ Période en cours
        </div>
        <div style={{fontSize:".65rem",fontWeight:700,color:urgent?"#C44B1A":C.rose}}>
          {info.daysLeft}j {info.hoursLeft}h restants{urgent?" ⚠️":""}
        </div>
      </div>
      <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".3rem"}}>
        <div style={{height:"100%",background:urgent?"#E6A817":C.rose,width:info.pctElapsed+"%",borderRadius:10,transition:"width .5s"}}/>
      </div>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".58rem",color:C.gris}}>
        <span>Début {info.periodStart.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
        <span>{info.pctElapsed}% écoulé</span>
        <span>Fin {info.periodEnd.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
      </div>
    </div>
  );
}

function ObjectifsPopup({uid}){
  const[obj,setObj]=useState(null);
  const[perso,setPerso]=useState(null);
  const[ptab,setPtab]=useState("perso");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","objectifs"));
        if(snap.exists())setObj(snap.data());
      }catch{}
      if(uid){
        try{
          const snap2=await getDoc(doc(db,"users",uid));
          if(snap2.exists()&&snap2.data()["db-obj-perso"])
            setPerso(JSON.parse(snap2.data()["db-obj-perso"]));
        }catch{}
      }
    })();
  },[uid]);

  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};

  return(
    <div>
      {/* Timer période */}
      <div style={{padding:"1rem 1rem 0"}}><PeriodeTimer/></div>

      {/* Mini tabs */}
      <div style={{display:"flex",borderBottom:`1px solid ${C.pale}`}}>
        {[{id:"perso",label:"🎯 Mes objectifs"},{id:"ca",label:"💰 CA Équipe"}].map(t=>(
          <button key={t.id} onClick={()=>setPtab(t.id)}
            style={{flex:1,padding:".5rem",fontSize:".65rem",fontWeight:600,border:"none",borderBottom:`2px solid ${ptab===t.id?C.rose:"transparent"}`,background:"none",color:ptab===t.id?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>

      <div style={{padding:"1rem"}}>
        {/* MES OBJECTIFS */}
        {ptab==="perso"&&(
          !perso
          ? <div style={{textAlign:"center",padding:"1rem",fontSize:".74rem",color:C.gris}}>
              Définis tes objectifs dans<br/><strong>Tableau de bord → Mes objectifs</strong>
            </div>
          : <>
            {[
              {label:"💰 Mon CA",val:perso.ca,obj:perso.caObj,unit:"€",color:C.rose},
            ].map(({label,val,obj,unit,color})=>(
              <div key={label} style={{marginBottom:".65rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".25rem"}}>
                  <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{label}</div>
                  <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:pct(val,obj)>=100?C.vert:color}}>{val||"—"}{unit}</span>
                    <span style={{fontSize:".6rem",color:C.gris}}>/ {obj||"—"}{unit}</span>
                    <span style={{background:color+"20",color:color,fontSize:".58rem",fontWeight:700,padding:".1rem .35rem",borderRadius:20}}>{pct(val,obj)}%</span>
                  </div>
                </div>
                <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct(val,obj)>=100?C.vert:color,width:pct(val,obj)+"%",borderRadius:10,transition:"width .5s"}}/>
                </div>
              </div>
            ))}
            {perso.recruesObj&&perso.recruesObj!=="0"&&(
              <div style={{marginBottom:".65rem"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".25rem"}}>
                  <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>👥 Mes recrues</div>
                  <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                    <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:pct(perso.recruesReal,perso.recruesObj)>=100?C.vert:C.lilas}}>{perso.recruesReal||0}</span>
                    <span style={{fontSize:".6rem",color:C.gris}}>/ {perso.recruesObj}</span>
                    <span style={{background:C.lilas+"20",color:C.lilas,fontSize:".58rem",fontWeight:700,padding:".1rem .35rem",borderRadius:20}}>{pct(perso.recruesReal,perso.recruesObj)}%</span>
                  </div>
                </div>
                <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                  <div style={{height:"100%",background:pct(perso.recruesReal,perso.recruesObj)>=100?C.vert:C.lilas,width:pct(perso.recruesReal,perso.recruesObj)+"%",borderRadius:10,transition:"width .5s"}}/>
                </div>
              </div>
            )}
            <div style={{background:C.creme,borderRadius:8,padding:".5rem .75rem",fontSize:".72rem",color:C.brun,display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <span>🏆 Palier visé</span>
              <strong style={{color:C.or}}>{perso.palier||"2%"}</strong>
            </div>
          </>
        )}

        {/* ÉQUIPE */}
        {ptab==="ca"&&(
          !perso||!perso.caObj
          ? <div style={{textAlign:"center",padding:"1rem",fontSize:".74rem",color:C.gris}}>
              Définis ton objectif CA dans<br/><strong>Tableau de bord → Mes objectifs</strong>
            </div>
          : <>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>💰 CA Total équipe cette période</div>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".5rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:"2rem",fontWeight:600,color:C.brun}}>{perso.ca||0}€</div>
              <div style={{fontSize:".78rem",color:C.gris}}>objectif : <strong style={{color:C.brun}}>{perso.caObj}€</strong></div>
            </div>
            <div style={{height:10,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".4rem"}}>
              <div style={{height:"100%",background:pct(perso.ca,perso.caObj)>=100?C.vert:C.rose,width:pct(perso.ca,perso.caObj)+"%",borderRadius:10,transition:"width .5s"}}/>
            </div>
            <div style={{textAlign:"right",fontSize:".72rem",fontWeight:700,color:pct(perso.ca,perso.caObj)>=100?C.vert:C.rose}}>
              {pct(perso.ca,perso.caObj)}%{pct(perso.ca,perso.caObj)>=100?" 🎉 Objectif atteint !":""}
            </div>
          </>
        )}

      </div>
    </div>
  );
}

// ── GAMIFICATION (Lot 2a) ─────────────────────────────────────────────────────

// Pluie de confettis CSS pure, déclenchée à chaque changement de la prop "trigger"
export function Confetti({trigger}){
  const [pieces, setPieces] = useState([]);
  useEffect(()=>{
    if(!trigger) return;
    const colors = [C.rose, C.or, C.lilas, C.vert, "#FFD700", C.brun2];
    const arr = Array.from({length:60},(_,i)=>({
      id: i+"-"+trigger,
      left: Math.random()*100,
      delay: Math.random()*0.4,
      duration: 2 + Math.random()*1.5,
      color: colors[Math.floor(Math.random()*colors.length)],
      size: 6 + Math.random()*6,
      rotate: Math.random()*360,
    }));
    setPieces(arr);
    const t = setTimeout(()=>setPieces([]), 3500);
    return ()=>clearTimeout(t);
  },[trigger]);

  if(pieces.length===0) return null;

  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      <style>{`
        @keyframes confetti-fall {
          0% { transform: translateY(-10vh) rotate(0deg); opacity:1; }
          100% { transform: translateY(110vh) rotate(720deg); opacity:0; }
        }
      `}</style>
      {pieces.map(p=>(
        <div key={p.id} style={{
          position:"absolute", top:0, left:p.left+"vw",
          width:p.size, height:p.size*0.4, background:p.color,
          animation:`confetti-fall ${p.duration}s ease-in ${p.delay}s forwards`,
          borderRadius:2, transform:`rotate(${p.rotate}deg)`,
        }}/>
      ))}
    </div>
  );
}

// Feu d'artifice — pour les grandes célébrations (primes validées)
function Fireworks({trigger}){
  const [bursts, setBursts] = useState([]);
  useEffect(()=>{
    if(!trigger) return;
    const colors = [C.rose, C.or, C.lilas, C.vert, "#FFD700", "#FF6B6B", "#4ECDC4"];
    const arr = Array.from({length:5},(_,i)=>({
      id: i+"-"+trigger,
      x: 15 + Math.random()*70,
      y: 15 + Math.random()*50,
      delay: i*0.3,
      color: colors[Math.floor(Math.random()*colors.length)],
      particles: Array.from({length:16},(_,j)=>({
        angle: (j/16)*360,
        dist: 40+Math.random()*40,
      })),
    }));
    setBursts(arr);
    const t = setTimeout(()=>setBursts([]), 4500);
    return ()=>clearTimeout(t);
  },[trigger]);

  if(bursts.length===0) return null;

  return(
    <div style={{position:"fixed",inset:0,pointerEvents:"none",zIndex:9999,overflow:"hidden"}}>
      <style>{`
        @keyframes firework-particle {
          0% { transform: translate(0,0) scale(1); opacity:1; }
          100% { transform: translate(var(--dx), var(--dy)) scale(0); opacity:0; }
        }
        @keyframes firework-flash {
          0% { opacity:0; }
          15% { opacity:1; }
          100% { opacity:0; }
        }
      `}</style>
      {bursts.map(b=>(
        <div key={b.id} style={{position:"absolute",left:b.x+"vw",top:b.y+"vh",animation:`firework-flash 4s ${b.delay}s forwards`}}>
          {b.particles.map((p,i)=>(
            <div key={i} style={{
              position:"absolute",width:8,height:8,borderRadius:"50%",background:b.color,
              "--dx":`${Math.cos(p.angle*Math.PI/180)*p.dist}vw`,
              "--dy":`${Math.sin(p.angle*Math.PI/180)*p.dist}vh`,
              animation:`firework-particle 1.4s ease-out ${b.delay}s forwards`,
            }}/>
          ))}
        </div>
      ))}
    </div>
  );
}

// Définition des badges disponibles
export const BADGES_DEF=[
  {id:"king-suivi",icon:"📞",label:"King du Suivi",desc:"10 actions de suivi validées",
    check:(d)=> (d.totalActionsValidees||0) >= 10},
  {id:"recruteur-elite",icon:"👑",label:"Recruteur Élite",desc:"5 recrues au total",
    check:(d)=> (d.totalRecrues||0) >= 5},
  {id:"premiere-recrue",icon:"🌱",label:"Première Recrue",desc:"Ta toute première recrue",
    check:(d)=> (d.totalRecrues||0) >= 1},
  {id:"regularite",icon:"🔥",label:"Régularité",desc:"5 jours de connexion d'affilée",
    check:(d)=> (d.streak||0) >= 5},
  {id:"regularite-or",icon:"⭐",label:"Régularité Or",desc:"15 jours de connexion d'affilée",
    check:(d)=> (d.streak||0) >= 15},
  {id:"objectif-ca",icon:"💰",label:"Objectif CA Atteint",desc:"100% de ton objectif CA du mois",
    check:(d)=> (d.pctCA||0) >= 100},
  {id:"objectif-recrues",icon:"🎯",label:"Objectif Recrues Atteint",desc:"100% de ton objectif recrues du mois",
    check:(d)=> (d.pctRecrues||0) >= 100},
  {id:"premiere-vente",icon:"💎",label:"Première Vente",desc:"Ton premier point CA enregistré",
    check:(d)=> (d.ca||0) > 0},
  {id:"semaine-parfaite",icon:"✅",label:"Semaine Parfaite",desc:"Les 5 actions du jour validées",
    check:(d)=> (d.doneCount||0) >= 5},
];

// Calcule les badges débloqués à partir des données de l'utilisatrice
export function computeBadges(d){
  return BADGES_DEF.map(b=>({...b, unlocked: b.check(d)}));
}

// Citation / conseil / question d'auto-coaching du jour — carte à retourner à la 1ère ouverture du jour
// ── TO-DO LISTE PERSONNELLE ───────────────────────────────────────────────────
// ── BIBLIOTHÈQUE D'ACTIONS ────────────────────────────────────────────────────
const ACTIONS_BIBLIO = {
  ventes: [
    {id:"v1",icon:"📸",label:"Poster une photo avant/après produit"},
    {id:"v2",icon:"🎥",label:"Faire un Reel de démonstration produit"},
    {id:"v3",icon:"💬",label:"Envoyer 3 DM à des personnes qui ont liké tes posts"},
    {id:"v4",icon:"🛍️",label:"Partager un témoignage client en story"},
    {id:"v5",icon:"✨",label:"Faire une story \"routine du matin\" avec tes produits"},
    {id:"v6",icon:"📋",label:"Envoyer un devis personnalisé à une cliente intéressée"},
    {id:"v7",icon:"🎁",label:"Créer une offre groupée de 2-3 produits complémentaires"},
    {id:"v8",icon:"📞",label:"Appeler une ancienne cliente pour prendre des nouvelles"},
    {id:"v9",icon:"💌",label:"Envoyer un message de suivi à une cliente qui a commandé"},
    {id:"v10",icon:"🌟",label:"Poster un top 3 produits de la semaine"},
    {id:"v11",icon:"🎬",label:"Faire un live de 15 min sur un produit phare"},
    {id:"v12",icon:"📊",label:"Créer un sondage story sur les besoins beauté"},
    {id:"v13",icon:"💡",label:"Partager un conseil beauté lié à tes produits"},
    {id:"v14",icon:"🤳",label:"Faire un unboxing d'un produit en story"},
    {id:"v15",icon:"💰",label:"Proposer un paiement en 2-3 fois à une cliente hésitante"},
    {id:"v16",icon:"🎯",label:"Contacter 5 personnes de ta liste chaude"},
    {id:"v17",icon:"📱",label:"Publier le lien de ton diagnostic personnalisé en story"},
    {id:"v18",icon:"🌸",label:"Faire une story \"ma peau ce matin\" naturelle et authentique"},
    {id:"v19",icon:"💆",label:"Poster un rituel soin corps avec tes produits"},
    {id:"v20",icon:"🎉",label:"Annoncer une nouveauté ou lancement produit"},
    {id:"v21",icon:"📷",label:"Poster une photo lifestyle avec le produit intégré naturellement"},
    {id:"v22",icon:"🔖",label:"Partager un article ou étude sur les bienfaits d'un ingrédient"},
    {id:"v23",icon:"👩",label:"Mettre en avant le témoignage d'une cliente satisfaite"},
    {id:"v24",icon:"💎",label:"Créer un contenu comparatif avant/après 30 jours"},
    {id:"v25",icon:"🛒",label:"Faire une story avec le lien direct vers ton catalogue"},
    {id:"v26",icon:"🌙",label:"Partager ta routine du soir en stories"},
    {id:"v27",icon:"☀️",label:"Partager ta routine du matin en stories"},
    {id:"v28",icon:"📣",label:"Faire un post éducatif sur un problème de peau courant"},
    {id:"v29",icon:"🧴",label:"Filmer l'application d'un produit en texture et résultat"},
    {id:"v30",icon:"🤝",label:"Proposer un diagnostic offert à 3 personnes de ta liste"},
    {id:"v31",icon:"🎀",label:"Créer un contenu cadeau idéal pour une occasion"},
    {id:"v32",icon:"💬",label:"Répondre à tous les commentaires de tes posts récents"},
    {id:"v33",icon:"🌿",label:"Poster sur les ingrédients naturels de tes produits"},
    {id:"v34",icon:"👑",label:"Faire un carrousel top 5 produits bestsellers"},
    {id:"v35",icon:"📲",label:"Relancer par DM les personnes qui ont regardé tes stories"},
    {id:"v36",icon:"🎗️",label:"Créer un post autour d'une journée thématique"},
    {id:"v37",icon:"💫",label:"Partager ton propre résultat visible sur un produit"},
    {id:"v38",icon:"🔔",label:"Activer les rappels commandes pour 3 clientes"},
    {id:"v39",icon:"📝",label:"Rédiger 3 scripts de vente pour tes produits phares"},
    {id:"v40",icon:"🌈",label:"Faire un post sur la gamme couleur maquillage"},
    {id:"v41",icon:"🧪",label:"Tester un nouveau produit et partager ta première impression"},
    {id:"v42",icon:"💪",label:"Poster un contenu sur les compléments alimentaires et énergie"},
    {id:"v43",icon:"🏆",label:"Partager tes résultats du mois (ventes, clientes)"},
    {id:"v44",icon:"🎓",label:"Créer un mini-guide beauté à partager en DM"},
    {id:"v45",icon:"🔥",label:"Faire une vente flash 24h sur un produit"},
    {id:"v46",icon:"🌺",label:"Poster sur les bienfaits d'un produit en détail"},
    {id:"v47",icon:"💝",label:"Envoyer un message de remerciement à tes meilleures clientes"},
    {id:"v48",icon:"📌",label:"Épingler ton meilleur post de vente sur ton profil"},
    {id:"v49",icon:"🌟",label:"Demander à 3 clientes un avis écrit ou vidéo"},
    {id:"v50",icon:"🎯",label:"Identifier 10 nouvelles cibles sur Instagram et les suivre"},
    {id:"v51",icon:"💅",label:"Faire un contenu sur les soins ongles/mains"},
    {id:"v52",icon:"🧘",label:"Poster sur bien-être et beauté intérieure"},
    {id:"v53",icon:"🛁",label:"Créer un contenu rituel bain/détente avec tes produits"},
    {id:"v54",icon:"📦",label:"Filmer la préparation d'une commande cliente"},
    {id:"v55",icon:"🌍",label:"Poster sur l'engagement éco ou naturel de la marque"},
    {id:"v56",icon:"❤️",label:"Faire un post sur pourquoi tu as choisi ces produits"},
    {id:"v57",icon:"🎪",label:"Organiser un jeu concours (partage+follow)"},
    {id:"v58",icon:"💬",label:"Créer une FAQ beauté en carrousel"},
    {id:"v59",icon:"🌙",label:"Poster un contenu anti-âge ciblé"},
    {id:"v60",icon:"🏃",label:"Contacter les personnes inactives depuis 3 mois"},
    {id:"v61",icon:"🌸",label:"Faire un post sur les soins sensibles/peaux réactives"},
    {id:"v62",icon:"💡",label:"Créer un contenu mythe vs réalité beauté"},
    {id:"v63",icon:"🎥",label:"Filmer un tutoriel maquillage rapide"},
    {id:"v64",icon:"📱",label:"Mettre à jour ta bio Instagram avec ton lien diagnostic"},
    {id:"v65",icon:"🌿",label:"Poster sur les bienfaits des soins capillaires"},
    {id:"v66",icon:"✨",label:"Faire un post sur l'éclat de peau en 7 jours"},
    {id:"v67",icon:"💎",label:"Présenter la gamme premium en story"},
    {id:"v68",icon:"🛍️",label:"Créer un post \"idée cadeau sous 50€\""},
    {id:"v69",icon:"📊",label:"Faire un sondage sur le problème beauté n°1 de tes followers"},
    {id:"v70",icon:"🤳",label:"Poster une selfie naturelle avec un produit"},
    {id:"v71",icon:"🎁",label:"Offrir un échantillon à une nouvelle cliente"},
    {id:"v72",icon:"💰",label:"Calculer et partager ta marge sur une vente type"},
    {id:"v73",icon:"🌟",label:"Mettre en avant un produit méconnu de la gamme"},
    {id:"v74",icon:"📸",label:"Créer une série de 3 stories \"conseil du jour\""},
    {id:"v75",icon:"💆",label:"Poster sur les bienfaits du massage avec vos produits"},
    {id:"v76",icon:"🔑",label:"Partager 3 astuces pour maximiser l'efficacité d'un produit"},
    {id:"v77",icon:"🌺",label:"Créer un contenu saisonnier (été, hiver, rentrée...)"},
    {id:"v78",icon:"💬",label:"Réactiver une conversation DM en attente"},
    {id:"v79",icon:"📋",label:"Mettre à jour ta liste de produits favoris"},
    {id:"v80",icon:"🎯",label:"Identifier les 5 clientes avec le plus grand potentiel"},
    {id:"v81",icon:"🧴",label:"Comparer deux produits similaires de la gamme en story"},
    {id:"v82",icon:"💪",label:"Poster sur les résultats en 21 jours d'utilisation"},
    {id:"v83",icon:"🌈",label:"Créer un post coloré et vitaminé sur la gamme maquillage"},
    {id:"v84",icon:"🎬",label:"Faire un mini documentaire \"une journée avec mes produits\""},
    {id:"v85",icon:"🤝",label:"Proposer un appel découverte gratuit à 3 prospects"},
    {id:"v86",icon:"📌",label:"Créer un highlight Instagram dédié aux témoignages"},
    {id:"v87",icon:"💫",label:"Poster sur la transformation de ta peau depuis que tu utilises les produits"},
    {id:"v88",icon:"🌙",label:"Faire une story ASMR application produit"},
    {id:"v89",icon:"🎓",label:"Partager un fait méconnu sur un ingrédient clé"},
    {id:"v90",icon:"💝",label:"Envoyer un cadeau surprise à une cliente fidèle"},
    {id:"v91",icon:"📲",label:"Créer un carrousel \"erreurs beauté à éviter\""},
    {id:"v92",icon:"🌿",label:"Poster sur la composition naturelle de tes produits"},
    {id:"v93",icon:"🏆",label:"Célébrer une réussite cliente en story (avec permission)"},
    {id:"v94",icon:"🔥",label:"Lancer un défi beauté 7 jours avec tes clientes"},
    {id:"v95",icon:"💬",label:"Faire un Q&A en story sur tes produits"},
    {id:"v96",icon:"🌺",label:"Poster sur les soins corps en période hivernale"},
    {id:"v97",icon:"✨",label:"Créer un contenu sur les routines minimalistes"},
    {id:"v98",icon:"📦",label:"Faire un haul produits avec descriptions détaillées"},
    {id:"v99",icon:"💡",label:"Partager 5 façons d'utiliser un produit multi-usage"},
    {id:"v100",icon:"🎯",label:"Planifier tes 5 prochains posts de vente à l'avance"},
  ],
  recrutement: [
    {id:"r1",icon:"👥",label:"Partager ton témoignage sur ce que l'activité t'a apporté"},
    {id:"r2",icon:"💰",label:"Poster sur la liberté financière que tu vis"},
    {id:"r3",icon:"🌟",label:"Faire un post \"rejoins mon équipe\" authentique"},
    {id:"r4",icon:"📱",label:"Contacter 3 personnes qui ont montré de l'intérêt"},
    {id:"r5",icon:"🎥",label:"Faire un Reel sur ta journée type en tant que distributrice"},
    {id:"r6",icon:"💡",label:"Poster sur les avantages produits pour les distributrices"},
    {id:"r7",icon:"🤝",label:"Envoyer le lien de présentation à une contact qualifiée"},
    {id:"r8",icon:"🌸",label:"Partager les résultats de ta dernière période"},
    {id:"r9",icon:"📊",label:"Créer un post sur le plan de rémunération simplifié"},
    {id:"r10",icon:"🎯",label:"Identifier 5 profils potentiellement intéressés dans ta liste"},
    {id:"r11",icon:"💬",label:"Inviter une amie à découvrir l'activité autour d'un café"},
    {id:"r12",icon:"🏆",label:"Partager une victoire de ton équipe en story"},
    {id:"r13",icon:"✨",label:"Poster sur l'ambiance et l'esprit d'équipe Blazing Dynasty"},
    {id:"r14",icon:"🎓",label:"Expliquer la formation disponible pour les nouvelles"},
    {id:"r15",icon:"💪",label:"Faire un post sur ce que tu as appris depuis que tu as commencé"},
    {id:"r16",icon:"🌈",label:"Partager un post sur la diversité des profils dans ton équipe"},
    {id:"r17",icon:"📸",label:"Poster une photo de groupe avec ton équipe"},
    {id:"r18",icon:"🔑",label:"Expliquer le système de parrainage en story"},
    {id:"r19",icon:"💫",label:"Partager un témoignage d'une filleule sur sa progression"},
    {id:"r20",icon:"🎁",label:"Faire un post sur les cadeaux et bonus Mihi"},
    {id:"r21",icon:"🌍",label:"Poster sur la possibilité de travailler depuis n'importe où"},
    {id:"r22",icon:"⏰",label:"Faire un post sur la flexibilité des horaires"},
    {id:"r23",icon:"💌",label:"Envoyer un message personnalisé à une prospect recrutement"},
    {id:"r24",icon:"📋",label:"Préparer ton pitch de 2 minutes pour présenter l'activité"},
    {id:"r25",icon:"🎬",label:"Filmer un \"pourquoi j'ai dit oui\" sincère"},
    {id:"r26",icon:"💎",label:"Poster sur les incentives et voyages Mihi"},
    {id:"r27",icon:"🤳",label:"Faire une story sur tes objectifs du mois"},
    {id:"r28",icon:"🌺",label:"Partager un post sur l'épanouissement personnel dans l'activité"},
    {id:"r29",icon:"📱",label:"Partager ton lien diagnostic avec un angle recrutement"},
    {id:"r30",icon:"🏃",label:"Contacter une personne qui cherche un complément de revenus"},
    {id:"r31",icon:"💬",label:"Répondre à tous les commentaires sur ton post recrutement"},
    {id:"r32",icon:"🌟",label:"Faire un post sur les paliers et progression du plan"},
    {id:"r33",icon:"🎯",label:"Organiser une présentation en ligne pour 3-5 personnes"},
    {id:"r34",icon:"💡",label:"Créer un carrousel \"5 idées reçues sur le MLM\""},
    {id:"r35",icon:"🤝",label:"Faire un appel découverte avec une nouvelle prospect"},
    {id:"r36",icon:"📊",label:"Montrer concrètement combien tu as gagné ce mois"},
    {id:"r37",icon:"🎉",label:"Fêter l'anniversaire d'entrée d'une filleule en story"},
    {id:"r38",icon:"💰",label:"Poster sur les revenus passifs possibles avec l'équipe"},
    {id:"r39",icon:"🌸",label:"Partager comment l'activité a changé ta confiance en toi"},
    {id:"r40",icon:"📸",label:"Faire un before/after de ta vie avant/après l'activité"},
    {id:"r41",icon:"🎓",label:"Présenter la formation Fast Start en story"},
    {id:"r42",icon:"💪",label:"Montrer une journée productive avec ton activité Mihi"},
    {id:"r43",icon:"🌈",label:"Poster sur les possibilités d'évolution dans l'équipe"},
    {id:"r44",icon:"🔔",label:"Relancer les prospects recrutement inactifs depuis 2 semaines"},
    {id:"r45",icon:"✨",label:"Faire un post sur \"ma vie dans 1 an grâce à Mihi\""},
    {id:"r46",icon:"🎀",label:"Créer un kit de bienvenue digital pour tes nouvelles"},
    {id:"r47",icon:"💫",label:"Partager les formations et outils disponibles dans l'app"},
    {id:"r48",icon:"🏆",label:"Poster sur un objectif que tu as atteint grâce à l'activité"},
    {id:"r49",icon:"🌍",label:"Faire un post sur l'indépendance et l'entrepreneuriat féminin"},
    {id:"r50",icon:"💬",label:"Faire un sondage \"es-tu intéressée par un revenu complémentaire ?\""},
    {id:"r51",icon:"📲",label:"Créer un highlight Instagram \"rejoins l'équipe\""},
    {id:"r52",icon:"🌺",label:"Partager 3 choses que tu aurais aimé savoir avant de commencer"},
    {id:"r53",icon:"🎥",label:"Filmer une réunion d'équipe ou appel collectif"},
    {id:"r54",icon:"💡",label:"Créer un carrousel \"comment ça marche en 5 étapes\""},
    {id:"r55",icon:"🤝",label:"Présenter une filleule à tes abonnés"},
    {id:"r56",icon:"📋",label:"Écrire 3 objections courantes et tes réponses"},
    {id:"r57",icon:"💰",label:"Poster sur ce que tu as pu payer grâce à tes revenus Mihi"},
    {id:"r58",icon:"🌟",label:"Faire un post sur la communauté et le soutien entre membres"},
    {id:"r59",icon:"🎯",label:"Contacter 3 mamans à la maison dans ta liste"},
    {id:"r60",icon:"💎",label:"Partager les avantages exclusifs pour les chefs d'équipe"},
    {id:"r61",icon:"🌸",label:"Faire un post sur \"on peut commencer sans expérience\""},
    {id:"r62",icon:"📱",label:"Créer une story interactive sur l'activité"},
    {id:"r63",icon:"🏃",label:"Contacter une amie qui t'a déjà dit chercher quelque chose"},
    {id:"r64",icon:"💬",label:"Faire un live \"questions/réponses sur l'activité Mihi\""},
    {id:"r65",icon:"🌈",label:"Poster sur les valeurs de la marque et de l'équipe"},
    {id:"r66",icon:"📸",label:"Partager une photo de ton espace de travail"},
    {id:"r67",icon:"🎉",label:"Célébrer une nouvelle recrue en story"},
    {id:"r68",icon:"💪",label:"Faire un post sur la persévérance et les premiers mois"},
    {id:"r69",icon:"✨",label:"Partager ce qui te motive à continuer chaque jour"},
    {id:"r70",icon:"🎓",label:"Expliquer le rôle de cheffe d'équipe et ses avantages"},
    {id:"r71",icon:"🔑",label:"Partager ton lien de présentation dans ta bio"},
    {id:"r72",icon:"💫",label:"Faire un post sur les paliers atteints cette année"},
    {id:"r73",icon:"🌍",label:"Poster sur la possibilité de recruter en dehors de ta ville"},
    {id:"r74",icon:"💌",label:"Écrire une lettre ouverte \"pourquoi tu devrais rejoindre\""},
    {id:"r75",icon:"🏆",label:"Partager le résultat de ta meilleure période"},
    {id:"r76",icon:"🌺",label:"Faire un post sincère sur les difficultés et comment tu les surmontes"},
    {id:"r77",icon:"📊",label:"Créer une infographie simple sur le plan de rémunération"},
    {id:"r78",icon:"🤳",label:"Faire une story \"ce qui a tout changé pour moi\""},
    {id:"r79",icon:"💡",label:"Poster sur comment combiner Mihi avec un emploi salarié"},
    {id:"r80",icon:"🎯",label:"Envoyer le témoignage d'une filleule à une prospect"},
    {id:"r81",icon:"💬",label:"Créer un sondage sur les freins au démarrage d'une activité"},
    {id:"r82",icon:"🌟",label:"Faire un post sur l'impact de l'activité sur ta famille"},
    {id:"r83",icon:"🎀",label:"Préparer un kit de démarrage pour une nouvelle filleule"},
    {id:"r84",icon:"💰",label:"Calculer et partager le potentiel de revenus à 6 mois"},
    {id:"r85",icon:"🌸",label:"Poster sur les réseaux de femmes et la sororité"},
    {id:"r86",icon:"📲",label:"Contacter 5 personnes qui ont demandé \"comment tu fais\""},
    {id:"r87",icon:"🎥",label:"Faire un mini-reportage sur une journée avec tes filleules"},
    {id:"r88",icon:"💪",label:"Partager ta progression depuis ton lancement"},
    {id:"r89",icon:"✨",label:"Poster sur les reconnaissances et récompenses Mihi"},
    {id:"r90",icon:"🤝",label:"Planifier un appel de suivi avec une recrue récente"},
    {id:"r91",icon:"🌈",label:"Faire un post sur l'activité comme plan B devenu plan A"},
    {id:"r92",icon:"🎓",label:"Créer un mini guide \"commencer avec Mihi\" à partager"},
    {id:"r93",icon:"💎",label:"Partager les avantages produits dont tu bénéficies"},
    {id:"r94",icon:"🏃",label:"Contacter les amies qui ont aimé tes posts récents"},
    {id:"r95",icon:"📋",label:"Mettre à jour ta liste de prospects recrutement"},
    {id:"r96",icon:"💫",label:"Faire un post sur ce que l'activité t'a appris sur toi"},
    {id:"r97",icon:"🌺",label:"Partager les succès de ton équipe ce mois-ci"},
    {id:"r98",icon:"🎯",label:"Organiser un café virtuel recrutement avec 3 personnes"},
    {id:"r99",icon:"💬",label:"Répondre aux questions sur l'activité en story interactive"},
    {id:"r100",icon:"🏆",label:"Écrire et poster ta vision à 12 mois dans l'activité"},
  ],
  algorithme: [
    {id:"al1",icon:"⏰",label:"Poster à l'heure de pointe (7h, 12h ou 19h)"},
    {id:"al2",icon:"💬",label:"Commenter 20 posts de comptes similaires au tien"},
    {id:"al3",icon:"❤️",label:"Liker les 30 derniers posts de tes abonnés actifs"},
    {id:"al4",icon:"📊",label:"Analyser tes statistiques et noter le meilleur post de la semaine"},
    {id:"al5",icon:"🔁",label:"Repartager un contenu pertinent en story avec ton avis"},
    {id:"al6",icon:"📱",label:"Répondre à toutes tes stories reçues en DM"},
    {id:"al7",icon:"🎯",label:"Utiliser 10-15 hashtags ciblés sur ton prochain post"},
    {id:"al8",icon:"🌟",label:"Créer un carrousel (3-10 slides) — fort pour la portée"},
    {id:"al9",icon:"🎥",label:"Publier un Reel de 15-30 secondes dynamique"},
    {id:"al10",icon:"💡",label:"Poser une question ouverte dans ta légende de post"},
    {id:"al11",icon:"🤝",label:"Répondre à tous tes commentaires dans les 30 premières minutes"},
    {id:"al12",icon:"📸",label:"Publier une photo haute qualité avec lumière naturelle"},
    {id:"al13",icon:"🔔",label:"Activer tes notifications pour interagir rapidement"},
    {id:"al14",icon:"🌈",label:"Utiliser une palette de couleurs cohérente sur ton feed"},
    {id:"al15",icon:"📝",label:"Écrire une légende longue et engageante (300+ mots)"},
    {id:"al16",icon:"💫",label:"Créer un sondage en story pour maximiser les interactions"},
    {id:"al17",icon:"🎪",label:"Utiliser la fonction quiz en story"},
    {id:"al18",icon:"🌺",label:"Poster une story avec curseur de notation"},
    {id:"al19",icon:"💬",label:"Faire un \"question box\" en story"},
    {id:"al20",icon:"📌",label:"Épingler ton meilleur commentaire sur un post récent"},
    {id:"al21",icon:"🎬",label:"Faire un live et interagir en temps réel"},
    {id:"al22",icon:"🔗",label:"Mettre à jour le lien en bio avec un lien actuel"},
    {id:"al23",icon:"🌟",label:"Taguer des comptes pertinents dans tes posts (avec sens)"},
    {id:"al24",icon:"📲",label:"Utiliser la géolocalisation sur tes posts"},
    {id:"al25",icon:"🤳",label:"Faire une collab post avec un compte complémentaire"},
    {id:"al26",icon:"⚡",label:"Publier 2 stories minimum par jour"},
    {id:"al27",icon:"🌸",label:"Créer un highlight thématique et le mettre à jour"},
    {id:"al28",icon:"💡",label:"Utiliser les mots-clés dans ta bio Instagram"},
    {id:"al29",icon:"📊",label:"Vérifier tes heures de meilleure audience dans les stats"},
    {id:"al30",icon:"🎯",label:"Interagir pendant 15 min avant de publier ton post"},
    {id:"al31",icon:"💎",label:"Créer un contenu \"save-worthy\" (à sauvegarder)"},
    {id:"al32",icon:"🔥",label:"Créer un contenu \"share-worthy\" (à partager)"},
    {id:"al33",icon:"❤️",label:"Aller commenter les posts en tendance de ta niche"},
    {id:"al34",icon:"🌍",label:"Poster en story depuis un lieu avec géolocalisation"},
    {id:"al35",icon:"📱",label:"Répondre aux DM dans les 2h pour booster l'engagement"},
    {id:"al36",icon:"🎁",label:"Créer un contenu exclusif à partager uniquement en DM"},
    {id:"al37",icon:"🏆",label:"Analyser le contenu viral de ta niche et t'en inspirer"},
    {id:"al38",icon:"💬",label:"Demander à tes abonnés de taguer une amie dans un post"},
    {id:"al39",icon:"📸",label:"Faire un \"before/after\" — format très partagé"},
    {id:"al40",icon:"🎥",label:"Utiliser la tendance audio du moment pour ton Reel"},
    {id:"al41",icon:"✨",label:"Créer un filtre ou sticker de marque en story"},
    {id:"al42",icon:"🌺",label:"Partager un post de ta filleule avec ton commentaire"},
    {id:"al43",icon:"💫",label:"Faire un \"compte à rebours\" en story pour une annonce"},
    {id:"al44",icon:"🔑",label:"Créer un contenu \"liste\" numérotée — très engageant"},
    {id:"al45",icon:"📋",label:"Faire un \"Top 5\" ou \"Top 10\" dans ta niche"},
    {id:"al46",icon:"🌟",label:"Utiliser les sous-titres automatiques sur tes Reels"},
    {id:"al47",icon:"💪",label:"Poster tôt le matin (avant 8h) pour maximiser la portée"},
    {id:"al48",icon:"🎯",label:"Créer du contenu evergreen (intemporel et toujours utile)"},
    {id:"al49",icon:"🌈",label:"Alterner formats : photo, carrousel, Reel, story"},
    {id:"al50",icon:"📲",label:"Activer les sous-titres sur tous tes vidéos"},
    {id:"al51",icon:"💡",label:"Faire un \"mythe vs réalité\" dans ta niche"},
    {id:"al52",icon:"🤳",label:"Poster une selfie authentique et naturelle"},
    {id:"al53",icon:"🎬",label:"Utiliser des transitions créatives dans tes Reels"},
    {id:"al54",icon:"💬",label:"Répondre en vidéo à un commentaire pertinent"},
    {id:"al55",icon:"📊",label:"Faire un tableau ou infographie simple et lisible"},
    {id:"al56",icon:"🌸",label:"Partager un moment de coulisses (behind the scenes)"},
    {id:"al57",icon:"🎀",label:"Faire un \"wrap up\" hebdomadaire en story"},
    {id:"al58",icon:"💰",label:"Créer un contenu avec appel à l'action clair"},
    {id:"al59",icon:"🔔",label:"Demander à tes abonnés d'activer les notifications"},
    {id:"al60",icon:"🌍",label:"Participer à un challenge tendance de ta niche"},
    {id:"al61",icon:"✨",label:"Utiliser le texte animé dans tes stories"},
    {id:"al62",icon:"🏃",label:"Publier à la même heure chaque jour pour la régularité"},
    {id:"al63",icon:"💎",label:"Créer un contenu avec une promesse forte dans le titre"},
    {id:"al64",icon:"🤝",label:"Faire une mention partenaire avec une autre distributrice"},
    {id:"al65",icon:"📸",label:"Varier les angles de prise de vue (dessus, côté, gros plan)"},
    {id:"al66",icon:"🎯",label:"Utiliser des hashtags de niche (10-50k posts) pour la visibilité"},
    {id:"al67",icon:"💬",label:"Épingler une story de présentation de toi"},
    {id:"al68",icon:"🌺",label:"Faire un \"day in my life\" engageant"},
    {id:"al69",icon:"💡",label:"Poster sur un sujet controversé (positivement) de ta niche"},
    {id:"al70",icon:"📱",label:"Utiliser les stickers interactifs sur toutes tes stories"},
    {id:"al71",icon:"🎥",label:"Faire un Reel avec voix off pour plus d'authenticité"},
    {id:"al72",icon:"💫",label:"Créer une série de posts sur un même thème"},
    {id:"al73",icon:"🌟",label:"Optimiser ta bio avec des emojis et mots-clés"},
    {id:"al74",icon:"📊",label:"Tester 2 types de posts différents cette semaine"},
    {id:"al75",icon:"🎁",label:"Offrir un contenu gratuit pour les DM (PDF, guide...)"},
    {id:"al76",icon:"🔥",label:"Poster sur un sujet tendance dans ta niche"},
    {id:"al77",icon:"💬",label:"Commenter les posts des influenceurs de ta niche"},
    {id:"al78",icon:"🌸",label:"Créer un post avec beaucoup de texte pour le temps de lecture"},
    {id:"al79",icon:"❤️",label:"Faire une sélection de tes posts favoris en story"},
    {id:"al80",icon:"📸",label:"Utiliser la photo de profil comme accroche de story"},
    {id:"al81",icon:"🎯",label:"Répondre aux stories de tes abonnés pour créer du lien"},
    {id:"al82",icon:"💡",label:"Créer un post \"voici ce que j'aurais aimé savoir\""},
    {id:"al83",icon:"🏆",label:"Faire un post récapitulatif de ta semaine"},
    {id:"al84",icon:"🌈",label:"Utiliser des couleurs vives et contrastées pour attirer l'œil"},
    {id:"al85",icon:"📲",label:"Tester la fonction \"diffusion\" Instagram"},
    {id:"al86",icon:"💎",label:"Créer du contenu UGC (user generated content) avec clientes"},
    {id:"al87",icon:"🤳",label:"Faire un \"get ready with me\" dans ta niche"},
    {id:"al88",icon:"✨",label:"Utiliser les effets de lumière naturelle pour tes photos"},
    {id:"al89",icon:"🌺",label:"Poster un contenu inspirationnel qui donne envie d'agir"},
    {id:"al90",icon:"🎀",label:"Faire un \"thank you\" sincère à tes abonnés"},
    {id:"al91",icon:"💬",label:"Créer un post avec une liste de ressources utiles"},
    {id:"al92",icon:"📋",label:"Tester un nouveau format de contenu cette semaine"},
    {id:"al93",icon:"🌟",label:"Poster une citation motivante avec ta photo"},
    {id:"al94",icon:"💪",label:"Faire un contenu de \"preuve sociale\" (chiffres, résultats)"},
    {id:"al95",icon:"🎬",label:"Utiliser la musique tendance sur tes Reels"},
    {id:"al96",icon:"🔑",label:"Créer un post avec un titre accrocheur en première ligne"},
    {id:"al97",icon:"💫",label:"Utiliser la fonction \"close friends\" pour du contenu exclusif"},
    {id:"al98",icon:"🌍",label:"Poster sur l'impact positif de tes actions"},
    {id:"al99",icon:"🎯",label:"Analyser et reproduire ton post avec le plus d'engagement"},
    {id:"al100",icon:"🏃",label:"Maintenir un rythme de publication régulier pendant 21 jours"},
  ],
};

export function BiblioActionsPopup({onClose, onAjouter, actionsCustom=[]}){
  const[cat,setCat]=useState("ventes");
  const[recherche,setRecherche]=useState("");
  const[actionsChef,setActionsChef]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","actions_biblio"));
        if(snap.exists()) setActionsChef(snap.data().items||[]);
      }catch{}
    })();
  },[]);

  const cats=[
    {id:"ventes",icon:"🛍️",label:"Ventes"},
    {id:"recrutement",icon:"👥",label:"Recrutement"},
    {id:"algorithme",icon:"⚡",label:"Algorithme"},
    {id:"equipe",icon:"✨",label:"Équipe"},
  ];

  const actionsEquipe=actionsChef.filter(a=>a.cat===cat||cat==="equipe"&&a.cat==="equipe");
  const actionsBase=ACTIONS_BIBLIO[cat]||[];
  const actions=cat==="equipe"?actionsEquipe:[...actionsBase,...actionsChef.filter(a=>a.cat===cat)];

  const filtrees=recherche.trim()
    ? [
        ...ACTIONS_BIBLIO.ventes,...ACTIONS_BIBLIO.recrutement,...ACTIONS_BIBLIO.algorithme,
        ...actionsChef
      ].filter(a=>a.label.toLowerCase().includes(recherche.toLowerCase()))
    : actions;

  const dejaAjoutee=(id)=>actionsCustom.some(a=>a.id===id);

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.7)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999,padding:"0"}}>
      <div style={{background:C.blanc,borderRadius:"18px 18px 0 0",width:"100%",maxWidth:480,maxHeight:"85vh",display:"flex",flexDirection:"column",boxShadow:"0 -8px 40px rgba(0,0,0,.25)"}}>

        {/* Header */}
        <div style={{padding:"1.1rem 1.1rem .6rem",borderBottom:`1px solid ${C.pale}`,flexShrink:0}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".7rem"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>💡 Bibliothèque d'actions</div>
            <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer"}}>✕</button>
          </div>

          {/* Recherche */}
          <input value={recherche} onChange={e=>setRecherche(e.target.value)}
            placeholder="🔍 Rechercher une action..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:10,padding:".5rem .8rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".6rem"}}/>

          {/* Onglets catégories */}
          {!recherche&&(
            <div style={{display:"flex",gap:".3rem"}}>
              {cats.map(c=>(
                <button key={c.id} onClick={()=>setCat(c.id)}
                  style={{flex:1,padding:".4rem .2rem",fontSize:".68rem",fontWeight:700,border:"none",borderRadius:8,background:cat===c.id?C.brun:C.creme,color:cat===c.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .15s"}}>
                  {c.icon} {c.label}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Liste */}
        <div style={{overflowY:"auto",flex:1,padding:".6rem .8rem"}}>
          {filtrees.map(a=>{
            const ajoutee=dejaAjoutee(a.id);
            return(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:".6rem",padding:".55rem .6rem",borderRadius:10,marginBottom:".3rem",background:ajoutee?C.vert+"10":C.blanc,border:`1px solid ${ajoutee?C.vert+"40":C.pale}`}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{a.icon}</span>
                <div style={{flex:1,fontSize:".76rem",color:C.texte,lineHeight:1.4}}>{a.label}</div>
                <button onClick={()=>!ajoutee&&onAjouter(a)}
                  style={{background:ajoutee?C.vert:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".28rem .6rem",fontSize:".68rem",fontWeight:700,fontFamily:"inherit",cursor:ajoutee?"default":"pointer",flexShrink:0,transition:"all .2s"}}>
                  {ajoutee?"✓ Ajoutée":"+ Ajouter"}
                </button>
              </div>
            );
          })}
        </div>

        {actionsCustom.length>0&&(
          <div style={{padding:".6rem 1rem",borderTop:`1px solid ${C.pale}`,background:C.creme,flexShrink:0}}>
            <div style={{fontSize:".68rem",color:C.gris,textAlign:"center"}}>
              ✅ {actionsCustom.length} action{actionsCustom.length>1?"s":""} ajoutée{actionsCustom.length>1?"s":""} à ta journée
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

export function TodoPerso({uid}){
  const[todos,setTodos]=useState([]);
  const[newTodo,setNewTodo]=useState("");
  const[adding,setAdding]=useState(false);
  const[saving,setSaving]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",uid));
        if(snap.exists()&&snap.data()["db-todos"]){
          setTodos(JSON.parse(snap.data()["db-todos"]));
        }
      }catch{}
    })();
  },[uid]);

  const saveTodos=async(next)=>{
    setTodos(next);
    try{await setDoc(doc(db,"users",uid),{"db-todos":JSON.stringify(next)},{merge:true});}catch{}
  };

  const addTodo=async()=>{
    if(!newTodo.trim())return;
    setSaving(true);
    const next=[...todos,{id:`t${Date.now()}`,text:newTodo.trim(),done:false}];
    await saveTodos(next);
    setNewTodo("");setAdding(false);setSaving(false);
  };

  const toggleTodo=(id)=>saveTodos(todos.map(t=>t.id===id?{...t,done:!t.done}:t));
  const delTodo=(id)=>saveTodos(todos.filter(t=>t.id!==id));

  const actives=todos.filter(t=>!t.done);
  const faits=todos.filter(t=>t.done);

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".65rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>
          ✅ Ma to-do liste
        </div>
        <button onClick={()=>setAdding(!adding)}
          style={{background:adding?C.rose:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".25rem .65rem",fontSize:".68rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {adding?"✕":"+ Ajouter"}
        </button>
      </div>

      {adding&&(
        <div style={{display:"flex",gap:".4rem",marginBottom:".65rem"}}>
          <input
            value={newTodo} onChange={e=>setNewTodo(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addTodo()}
            placeholder="Nouvelle tâche..."
            autoFocus
            style={{flex:1,border:`1px solid ${C.rose}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addTodo} disabled={!newTodo.trim()||saving}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .75rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            ✓
          </button>
        </div>
      )}

      {actives.length===0&&!adding&&(
        <div style={{fontSize:".74rem",color:C.gris,textAlign:"center",padding:".5rem",fontStyle:"italic"}}>
          Aucune tâche — ajoute ta première ! 🎯
        </div>
      )}

      {actives.map(t=>(
        <div key={t.id} style={{display:"flex",alignItems:"center",gap:".55rem",padding:".45rem 0",borderBottom:`1px solid ${C.pale}`}}>
          <div onClick={()=>toggleTodo(t.id)}
            style={{width:20,height:20,borderRadius:5,border:`2px solid ${C.rose}`,background:"transparent",flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
          </div>
          <div style={{flex:1,fontSize:".8rem",color:C.texte,lineHeight:1.4}}>{t.text}</div>
          <button onClick={()=>delTodo(t.id)}
            style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
        </div>
      ))}

      {faits.length>0&&(
        <div style={{marginTop:".5rem"}}>
          <div style={{fontSize:".58rem",color:C.gris,marginBottom:".3rem",textTransform:"uppercase",letterSpacing:".08em"}}>Fait ✓</div>
          {faits.map(t=>(
            <div key={t.id} style={{display:"flex",alignItems:"center",gap:".55rem",padding:".35rem 0",opacity:.5}}>
              <div onClick={()=>toggleTodo(t.id)}
                style={{width:20,height:20,borderRadius:5,border:`2px solid ${C.vert}`,background:C.vert,flexShrink:0,cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center"}}>
                <span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>
              </div>
              <div style={{flex:1,fontSize:".78rem",color:C.gris,textDecoration:"line-through"}}>{t.text}</div>
              <button onClick={()=>delTodo(t.id)}
                style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── POPUP BIENVENUE (première connexion) ─────────────────────────────────────
function WelcomePopup({userName, onClose}){
  const prenom = userName.split(" ")[0] || userName;
  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.75)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9999,padding:"0"}}>
      <div style={{background:C.blanc,borderRadius:"20px 20px 0 0",width:"100%",maxWidth:480,maxHeight:"90vh",overflowY:"auto",boxShadow:"0 -8px 40px rgba(0,0,0,.3)"}}>

        {/* Header */}
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,padding:"1.5rem 1.2rem 1.2rem",textAlign:"center"}}>
          <div style={{fontSize:"2.2rem",marginBottom:".4rem"}}>👑</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.blanc,lineHeight:1.3}}>
            Bienvenue {prenom} !
          </div>
          <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",color:C.pale,marginTop:".3rem",fontStyle:"italic"}}>
            Tu fais maintenant partie de Blazing Dynasty ✨
          </div>
        </div>

        <div style={{padding:"1.2rem"}}>

          {/* Message équipe */}
          <div style={{background:C.creme,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem",borderLeft:`3px solid ${C.or}`}}>
            <div style={{fontSize:".72rem",color:C.brun,lineHeight:1.7}}>
              🌸 Nous sommes tellement heureuses de t'accueillir dans notre équipe. Tu as fait le bon choix — maintenant on est là pour t'accompagner à chaque étape. Let's go ! 💛
            </div>
          </div>

          {/* Telegram */}
          <div style={{background:C.lilas+"15",border:`1px solid ${C.lilas}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".78rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>✈️ Nos groupes Telegram</div>
            <a href="https://t.me/+2wKWxIROE4c1M2Q0" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:".6rem",background:"#29A0D8",borderRadius:9,padding:".55rem .85rem",textDecoration:"none",marginBottom:".4rem"}}>
              <span style={{fontSize:"1rem"}}>🖼️</span>
              <div>
                <div style={{fontSize:".78rem",fontWeight:600,color:"white"}}>Banque d'images équipe</div>
                <div style={{fontSize:".62rem",color:"rgba(255,255,255,.75)"}}>Accède aux visuels de l'équipe</div>
              </div>
            </a>
            <a href="https://t.me/+pv0RY_JJy4wyYzE8" target="_blank" rel="noopener noreferrer"
              style={{display:"flex",alignItems:"center",gap:".6rem",background:"#29A0D8",borderRadius:9,padding:".55rem .85rem",textDecoration:"none"}}>
              <span style={{fontSize:"1rem"}}>⭐</span>
              <div>
                <div style={{fontSize:".78rem",fontWeight:600,color:"white"}}>Groupe témoignages</div>
                <div style={{fontSize:".62rem",color:"rgba(255,255,255,.75)"}}>Découvre les résultats de l'équipe</div>
              </div>
            </a>
          </div>

          {/* Tes 2 premiers accès */}
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".5rem"}}>
            🔓 Tes accès du moment
          </div>

          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:".5rem",display:"flex",alignItems:"center",gap:".75rem"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>🚀</div>
            <div>
              <div style={{fontSize:".82rem",fontWeight:700,color:C.blanc}}>Fast Start</div>
              <div style={{fontSize:".68rem",color:C.pale}}>7 modules progressifs pour bien démarrer — commence par là !</div>
            </div>
          </div>

          <div style={{background:C.lilas+"15",border:`1px solid ${C.lilas}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".75rem"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>🎬</div>
            <div>
              <div style={{fontSize:".82rem",fontWeight:700,color:C.brun}}>Formation Application</div>
              <div style={{fontSize:".68rem",color:C.gris}}>Apprends à utiliser l'appli pour te faciliter la vie</div>
            </div>
          </div>

          {/* Bandeau déverrouillage */}
          <div style={{background:C.or+"20",border:`1px solid ${C.or}`,borderRadius:10,padding:".65rem .85rem",marginBottom:"1.2rem",display:"flex",alignItems:"center",gap:".5rem"}}>
            <span style={{fontSize:"1rem"}}>🔒</span>
            <div style={{fontSize:".7rem",color:C.brun,lineHeight:1.5}}>
              <strong>Le reste de la formation</strong> se débloque automatiquement quand tu auras terminé tes 7 modules Fast Start 🎉
            </div>
          </div>

          <button onClick={onClose}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:12,padding:".8rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            Commencer le Fast Start 🚀
          </button>
        </div>
      </div>
    </div>
  );
}

// ── CLASSEMENT PERMANENT VENTES & RECRUTEMENT ────────────────────────────────
export function CmdPeriodeBlock({cmdPeriode}){
  const info=getPeriodeInfo();
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",display:"flex",alignItems:"center",gap:".75rem"}}>
      <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,fontSize:"1.2rem"}}>🛍️</div>
      <div style={{flex:1}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".15rem"}}>{fmtPLabel(info.periodNum)}</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:C.brun}}>
          {cmdPeriode.count} commande{cmdPeriode.count>1?"s":""}
          {cmdPeriode.montant>0&&<span style={{fontSize:".75rem",fontWeight:400,color:C.gris}}> · {cmdPeriode.montant}€</span>}
        </div>
      </div>
      <div style={{textAlign:"right",fontSize:".62rem",color:C.gris}}>Se remet à 0<br/>en fin de période</div>
    </div>
  );
}

export function ClassementEquipe({uid}){
  const[data,setData]=useState([]);
  const[lastData,setLastData]=useState({});
  const[loading,setLoading]=useState(true);
  const[onglet,setOnglet]=useState("ventes"); // ventes | recrues | progression
  const[lastUpdate,setLastUpdate]=useState(null);

  const charger=async()=>{
    try{
      const annSnap=await getDoc(doc(db,"equipe","annuaire"));
      if(!annSnap.exists()){setLoading(false);return;}
      const membres=annSnap.data().membres||{};

      // Données fraîches du membre courant
      const meSnap=await getDoc(doc(db,"users",uid));
      const meData=meSnap.exists()&&meSnap.data()["db-obj-perso"]?JSON.parse(meSnap.data()["db-obj-perso"]):{};

      // Historique période précédente pour la progression
      const prevPeriode=getPeriodeActuelle()-1;
      const prevKey=`hist_p${prevPeriode}`;

      const valides=Object.entries(membres).map(([mUid,m])=>{
        const isMe=mUid===uid;
        const caPerso=isMe?parseFloat(meData.caPerso)||0:parseFloat(m.caPerso)||0;
        const ca=isMe?parseFloat(meData.ca)||0:parseFloat(m.ca)||0;
        const recrues=isMe?parseInt(meData.recruesReal)||0:parseInt(m.recruesReal)||0;
        const prevCaPerso=parseFloat(m[prevKey+"_caPerso"])||0;
        const prevRecrues=parseInt(m[prevKey+"_recrues"])||0;
        const progVentes=caPerso-prevCaPerso;
        const progRecrues=recrues-prevRecrues;
        const scoreProgression=progVentes+(progRecrues*50);
        return{uid:mUid,prenom:m.prenom||mUid.split("-")[0],caPerso,ca,recrues,progVentes,progRecrues,scoreProgression};
      }).filter(m=>m.ca>0||m.caPerso>0||m.recrues>0||m.uid===uid);
      // Sauvegarder positions précédentes pour les flèches
      const prev=JSON.parse(localStorage.getItem("bd-classement-prev")||"{}");
      setLastData(prev);
      const newPrev={};
      [...valides].sort((a,b)=>b.caPerso-a.caPerso).forEach((m,i)=>{newPrev[m.uid]={v:i,r:[...valides].sort((a,b)=>b.recrues-a.recrues).findIndex(x=>x.uid===m.uid),p:[...valides].sort((a,b)=>b.scoreProgression-a.scoreProgression).findIndex(x=>x.uid===m.uid)};});
      localStorage.setItem("bd-classement-prev",JSON.stringify(newPrev));
      setData(valides);
      setLastUpdate(new Date());
    }catch(e){console.error(e);}
    setLoading(false);
  };

  useEffect(()=>{
    charger();
    const t=setInterval(charger,3*60*1000);
    // Rafraîchir aussi quand la page reprend le focus
    const onFocus=()=>charger();
    window.addEventListener('focus',onFocus);
    return()=>{clearInterval(t);window.removeEventListener('focus',onFocus);};
  },[uid]);

  if(loading)return null;

  const onglets=[
    {id:"ventes",label:"🛍️ Ventes perso",sortKey:"caPerso",unit:"€"},
    {id:"equipe",label:"👥 Équipe",sortKey:"ca",unit:"€"},
    {id:"recrues",label:"🤝 Recrues",sortKey:"recrues",unit:""},
    {id:"progression",label:"📈 Progression",sortKey:"scoreProgression",unit:""},
  ];
  // Filtre 100€ perso seulement pour l'onglet Équipe
  const filtreMin = onglet==="equipe" ? (m)=>m.caPerso>=100||m.uid===uid : ()=>true;
  const currentOnglet=onglets.find(o=>o.id===onglet)||onglets[0];
  const sorted=[...data].filter(filtreMin).sort((a,b)=>b[currentOnglet.sortKey]-a[currentOnglet.sortKey]);
  const medals=["🥇","🥈","🥉"];
  const timeStr=lastUpdate?`${lastUpdate.getHours()}h${String(lastUpdate.getMinutes()).padStart(2,"0")}`:"";

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".75rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun}}>🏆 Classement équipe</div>
        <button onClick={charger} title="Rafraîchir"
          style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".2rem .4rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>🔄</button>
      </div>

      {/* Onglets */}
      <div style={{display:"flex",gap:".25rem",marginBottom:".75rem",overflowX:"auto"}}>
        {onglets.map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flexShrink:0,padding:".3rem .55rem",fontSize:".63rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${onglet===o.id?C.rose:C.pale}`,background:onglet===o.id?C.rose:C.blanc,color:onglet===o.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* Liste */}
      {sorted.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".5rem"}}>Aucune donnée pour l'instant</div>}
      {sorted.map((m,i)=>{
        const isMe=m.uid===uid;
        const prevPos=lastData[m.uid];
        const curIdx=i;
        const prevIdx=currentOnglet.id==="ventes"?prevPos?.v:currentOnglet.id==="recrues"?prevPos?.r:prevPos?.p;
        const tendance=prevIdx==null?"→":prevIdx>curIdx?"⬆️":prevIdx<curIdx?"⬇️":"→";

        let valPrimary, valSecondary;
        if(onglet==="ventes"){
          valPrimary=`${m.caPerso}€`;
          valSecondary=m.progVentes!==0?`${m.progVentes>=0?"+":""}${m.progVentes}€ vs P préc.`:null;
        } else if(onglet==="equipe"){
          valPrimary=`${m.ca}€`;
          valSecondary=m.caPerso>=100?`dont ${m.caPerso}€ perso`:null;
        } else if(onglet==="recrues"){
          valPrimary=`${m.recrues} recrue${m.recrues>1?"s":""}`;
          valSecondary=m.progRecrues!==0?`${m.progRecrues>=0?"+":""}${m.progRecrues} vs P préc.`:null;
        } else {
          valPrimary=`${m.progVentes>=0?"+":""}${m.progVentes}€ · ${m.progRecrues>=0?"+":""}${m.progRecrues} rec.`;
          valSecondary=null;
        }

        return(
          <div key={m.uid} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".45rem .5rem",borderRadius:9,background:isMe?C.rose+"08":"transparent",marginBottom:".2rem",border:isMe?`1px solid ${C.rose}30`:"none"}}>
            <div style={{width:26,textAlign:"center",fontSize:i<3?"1rem":".7rem",flexShrink:0}}>
              {i<3?medals[i]:`${i+1}.`}
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:".78rem",fontWeight:isMe?700:500,color:isMe?C.rose:C.texte}}>{m.prenom}{isMe?" (moi)":""}</div>
              {valSecondary&&<div style={{fontSize:".6rem",color:C.vert}}>{valSecondary}</div>}
            </div>
            <div style={{fontSize:".7rem",color:C.gris,flexShrink:0}}>{tendance}</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",fontWeight:700,color:isMe?C.rose:C.brun,flexShrink:0,textAlign:"right"}}>{valPrimary}</div>
          </div>
        );
      })}

      <div style={{fontSize:".55rem",color:C.pale,textAlign:"right",marginTop:".4rem"}}>
        {timeStr?`Màj ${timeStr} · `:""}Rafraîchi auto toutes les 3min
      </div>
    </div>
  );
}
export function CitationDuJour({uid}){
  const[citations,setCitations]=useState(null);
  const[revealed,setRevealed]=useState(true); // toujours visible
  const[isFirstToday,setIsFirstToday]=useState(false);
  const[flipping,setFlipping]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        setCitations(snap.exists()?snap.data().citations:null);
      }catch{ setCitations(null); }

      const forceCard = new URLSearchParams(window.location.search).get("testcard")==="1";
      if(forceCard){
        setIsFirstToday(true);
        setRevealed(false);
        return;
      }

      const todayStr = todayLocalStr();
      let lastSeen = await sg(uid,"db-citation-vue");
      // Normaliser le format de date stocké
      if(lastSeen && lastSeen.length > 10) lastSeen = lastSeen.slice(0,10);
      if(lastSeen !== todayStr){
        setIsFirstToday(true);
        setRevealed(false);
        ss(uid,"db-citation-vue",todayStr);
      }
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const citation = getCitationDuJour(citations);

  const reveal=()=>{
    if(revealed)return;
    setFlipping(true);
    setTimeout(()=>{ setRevealed(true); setFlipping(false); }, 350);
  };

  if(!isFirstToday || revealed){
    return(
      <div style={{background:`linear-gradient(135deg, rgba(196,154,138,.12), rgba(168,155,181,.08))`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",textAlign:"center",marginBottom:"1rem",animation:isFirstToday?"card-flip-in .4s ease":"none"}}>
        <style>{`@keyframes card-flip-in{from{opacity:0;transform:scale(.96);}to{opacity:1;transform:scale(1);}}`}</style>
        <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.rose,marginBottom:".5rem"}}>✦ PENSÉE DU JOUR ✦</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontStyle:"italic",color:C.brun,lineHeight:1.65}}>"{citation}"</div>
      </div>
    );
  }

  // Carte fermée — à découvrir
  return(
    <button onClick={reveal}
      style={{display:"block",width:"100%",background:`linear-gradient(135deg, ${C.brun}, ${C.brun2})`,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.3rem",textAlign:"center",marginBottom:"1rem",cursor:"pointer",opacity:flipping?0:1,transition:"opacity .35s ease",boxShadow:"0 4px 16px rgba(61,31,14,.2)",fontFamily:"inherit",WebkitTapHighlightColor:"transparent",touchAction:"manipulation",WebkitAppearance:"none",appearance:"none"}}>
      <div style={{fontSize:"1.8rem",marginBottom:".4rem"}}>🎴</div>
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".18em",color:C.or,marginBottom:".3rem"}}>✦ NOUVELLE CARTE DU JOUR ✦</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontStyle:"italic",color:"white",lineHeight:1.5}}>Touche pour découvrir ta pensée du jour</div>
    </button>
  );
}

// Mood-check quotidien : adapte le ton de la to-do du jour
const MOODS=[
  {id:"top",icon:"⚡",label:"Au top",message:"Génial ! C'est le moment idéal pour viser tes 5 actions à fond aujourd'hui 🚀"},
  {id:"fatigue",icon:"🐢",label:"Un peu fatigué(e)",message:"Pas de souci, on avance à son rythme aujourd'hui. Fais ce que tu peux, l'essentiel c'est de ne pas t'arrêter complètement 🌱"},
  {id:"depasse",icon:"🤯",label:"Dépassé(e)",message:"Pas de panique, aujourd'hui on fait léger : choisis juste UNE action essentielle ci-dessous et fête ta victoire 💛"},
];

// Causes possibles de fatigue/surcharge (perso + travail), avec conseil ciblé
const CAUSES_FATIGUE=[
  {id:"sommeil",icon:"😴",label:"Manque de sommeil",
    conseils:[
      "Ce soir, essaie de te coucher 30 min plus tôt — même un petit ajustement peut faire une vraie différence sur ton énergie demain.",
      "Et si tu testais une micro-sieste de 15-20 min cet après-midi ? Pas besoin de dormir profondément, juste fermer les yeux peut relancer ton énergie.",
      "Le manque de sommeil affecte direct la motivation et la concentration — sois indulgente avec toi-même aujourd'hui, fais ce que tu peux, pas plus.",
      "Essaie de couper les écrans 30 min avant de dormir ce soir — ça aide vraiment à mieux récupérer pour demain.",
      "Une tisane, une lumière tamisée, un peu de calme avant le coucher... Petits rituels, grands effets sur le sommeil 🌙",
    ],
    conseilRepetition:"Ça fait plusieurs jours que le sommeil te pèse... Si ça continue, ce serait peut-être bien d'en parler à quelqu'un (médecin, proche) — ton corps t'envoie peut-être un message à écouter 💛",
  },
  {id:"charge-mentale",icon:"🧠",label:"Charge mentale élevée",
    conseils:[
      "Essaie de tout sortir de ta tête sur une liste (perso + travail) — ça libère de la place mentale, même sans tout faire aujourd'hui.",
      "Choisis UNE seule priorité pour aujourd'hui et laisse le reste de côté sans culpabiliser. Une chose à la fois.",
      "Et si tu déléguais ou reportais une tâche qui peut attendre ? Ce n'est pas un échec, c'est de la gestion intelligente.",
      "5 minutes pour respirer, sans rien faire d'autre — ça peut sembler inutile mais ça aide vraiment à retrouver de la clarté.",
      "Quand tout s'accumule, écrire ce qui tourne en boucle (même en vrac, sans ordre) aide souvent à redescendre la pression.",
    ],
    conseilRepetition:"La charge mentale revient souvent ces derniers jours... Est-ce qu'il y a une chose précise qui pèse plus que les autres ? Parfois identifier LA chose aide à mieux la gérer 🧩",
  },
  {id:"famille",icon:"👨‍👩‍👧",label:"Famille / enfants",
    conseils:[
      "C'est normal que la famille passe en priorité parfois. Ton activité Mihi peut attendre quelques heures — l'important c'est de ne pas culpabiliser.",
      "Même 10 minutes entre deux tâches familiales peuvent suffire pour répondre à un message client. Petits créneaux, ça compte aussi !",
      "Les périodes familiales chargées sont temporaires — ton activité reprendra son rythme. Profite de ces moments, ils ne reviennent pas.",
      "Et si tu impliquais un peu ta famille dans ton activité ? Parfois ça crée des moments complices en plus.",
      "Pas de pression aujourd'hui — la régularité se mesure sur la durée, pas sur une seule journée.",
    ],
    conseilRepetition:"La famille prend beaucoup de place ces derniers temps, et c'est complètement normal. Pense à te accorder aussi un petit moment pour toi, même court — tu en as besoin aussi 💛",
  },
  {id:"sante",icon:"🤒",label:"Pas en forme / santé",
    conseils:[
      "Prends soin de toi en premier. Si tu peux, hydrate-toi, repose-toi un peu — ton business sera toujours là demain.",
      "Écoute ton corps aujourd'hui. Si tu as besoin de ralentir complètement, fais-le sans culpabiliser — la santé passe avant tout.",
      "Pas en forme ne veut pas dire pas productive : même une petite action de 5 minutes compte, le reste peut attendre.",
      "Un peu d'air frais, même 5 minutes à la fenêtre ou sur le pas de la porte, peut parfois aider à se sentir un peu mieux.",
      "Si ça persiste, n'hésite pas à consulter — ce n'est jamais une perte de temps de prendre soin de sa santé.",
    ],
    conseilRepetition:"Ça fait plusieurs jours que tu ne te sens pas bien... Si ça continue, pense à consulter un professionnel de santé — ta santé est plus importante que n'importe quel objectif 💛",
  },
  {id:"motivation",icon:"💭",label:"Manque de motivation",
    conseils:[
      "C'est ok d'avoir des baisses de motivation, ça arrive à tout le monde. Relis un de tes objectifs ou un message d'une cliente satisfaite, ça peut redonner un petit coup de boost 💪",
      "Et si tu commençais par la tâche la plus facile de ta liste ? Parfois un petit succès rapide relance toute la dynamique.",
      "La motivation suit souvent l'action, pas l'inverse. Fais un petit geste, même sans envie, et observe si ça change quelque chose.",
      "Repense à ton 'pourquoi' — pourquoi as-tu commencé cette activité ? Reconnecter avec ça peut redonner du sens.",
      "Regarde le chemin déjà parcouru plutôt que ce qui reste à faire — tu as déjà avancé, et ça compte 🌱",
    ],
    conseilRepetition:"Le manque de motivation revient souvent en ce moment... Est-ce que tes objectifs actuels te parlent encore, ou est-ce qu'il serait temps de les ajuster ? Parfois un petit changement de cap redonne de l'élan 🔄",
  },
  {id:"surcharge-travail",icon:"💼",label:"Surcharge travail/emploi du temps",
    conseils:[
      "Aujourd'hui, vise juste 1 action de 10 minutes maximum. Mieux vaut un petit pas régulier qu'un gros effort suivi d'un abandon.",
      "Et si tu bloquais un créneau fixe de 15 min dans ton agenda, juste pour Mihi ? Un rendez-vous avec toi-même, non négociable.",
      "Quand tout s'accumule, trier par urgence/importance aide à voir plus clair. Tout n'a pas besoin d'être fait aujourd'hui.",
      "La surcharge est souvent temporaire. Identifie ce qui peut attendre une semaine sans conséquence, et laisse-le de côté pour l'instant.",
      "Un planning trop chargé mène souvent à rien faire du tout par overwhelm. Réduire la liste, c'est parfois la clé pour avancer.",
    ],
    conseilRepetition:"La surcharge revient souvent ces derniers jours... Est-ce qu'il y a quelque chose dans ton emploi du temps qui pourrait être allégé ou délégué sur la durée ? Un ajustement structurel aiderait peut-être plus qu'un effort ponctuel 📋",
  },
];


// Actions bonus optionnelles si "Au top"
const ACTIONS_BONUS=[
  {id:"b1",icon:"🎥",label:"Filme un contenu en avance",sub:"Prépare 1 Reel ou story pour un jour où tu seras moins motivée"},
  {id:"b2",icon:"📞",label:"Contacte 3 anciens prospects \"froids\"",sub:"Un petit message sympa pour reprendre contact, sans pression"},
  {id:"b3",icon:"🌟",label:"Aide une personne de ton équipe",sub:"Un message d'encouragement ou un conseil à une collègue"},
];

function MoodCheck({uid, onMoodChange, onBonusToggle}){
  const[mood,setMood]=useState(null);
  const[causes,setCauses]=useState([]);
  const[bonusDone,setBonusDone]=useState({});
  const[loaded,setLoaded]=useState(false);
  const[conseilHistory,setConseilHistory]=useState({});
  const todayStr = todayLocalStr();

  useEffect(()=>{
    (async()=>{
      const data = await sg(uid,"db-mood");
      if(data){
        const parsed = JSON.parse(data);
        if(parsed.date===todayStr){
          setMood(parsed.mood);
          setCauses(parsed.causes||[]);
          setBonusDone(parsed.bonusDone||{});
          onMoodChange&&onMoodChange(parsed.mood);
        }
      }
      const hist = await sg(uid,"db-mood-conseil-history");
      if(hist){
        try{ setConseilHistory(JSON.parse(hist)); }catch{}
      }
      setLoaded(true);
    })();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[uid]);

  const persist=(next)=>{
    ss(uid,"db-mood",JSON.stringify({date:todayStr, mood, causes, bonusDone, ...next}));
  };

  // Choisit un conseil pour une cause donnée, en évitant la répétition immédiate
  // et en proposant un message spécial si la cause revient plusieurs jours d'affilée
  const getConseilPourCause=(c, history)=>{
    const h = history[c.id] || {lastDate:null, lastIndex:-1, streak:0};
    // Streak de jours consécutifs (y compris aujourd'hui)
    const streak = h.lastDate===todayStr ? h.streak
      : (h.lastDate && isYesterday(h.lastDate)) ? h.streak+1 : 1;

    if(streak>=3 && c.conseilRepetition){
      return {text:c.conseilRepetition, index:-1, streak};
    }
    // Choix pseudo-aléatoire évitant la répétition immédiate
    let index = Math.floor(Math.random()*c.conseils.length);
    if(c.conseils.length>1 && index===h.lastIndex){
      index = (index+1)%c.conseils.length;
    }
    // Si déjà choisi aujourd'hui, garder le même (cohérence si re-render)
    if(h.lastDate===todayStr && h.lastIndex>=0 && h.lastIndex<c.conseils.length){
      index = h.lastIndex;
    }
    return {text:c.conseils[index], index, streak};
  };

  const isYesterday=(dateStr)=>{
    const d=new Date(dateStr);
    const yest=new Date();
    yest.setDate(yest.getDate()-1);
    return d.toISOString().slice(0,10)===yest.toISOString().slice(0,10);
  };

  const choisir=(moodId)=>{
    setMood(moodId);
    setCauses([]);
    onMoodChange&&onMoodChange(moodId);
    ss(uid,"db-mood",JSON.stringify({date:todayStr, mood:moodId, causes:[], bonusDone:{}}));
  };

  const toggleCause=(causeId)=>{
    const next = causes.includes(causeId) ? causes.filter(c=>c!==causeId) : [...causes, causeId];
    setCauses(next);
    persist({causes:next});

    // Si on vient de cocher (pas décocher), fige le conseil du jour dans l'historique
    if(!causes.includes(causeId)){
      const c = CAUSES_FATIGUE.find(x=>x.id===causeId);
      if(c){
        const {index, streak} = getConseilPourCause(c, conseilHistory);
        const nextHistory = {...conseilHistory, [causeId]:{lastDate:todayStr, lastIndex:index, streak}};
        setConseilHistory(nextHistory);
        ss(uid,"db-mood-conseil-history",JSON.stringify(nextHistory));
      }
    }
  };

  const toggleBonus=(bonusId)=>{
    const next = {...bonusDone, [bonusId]:!bonusDone[bonusId]};
    setBonusDone(next);
    persist({bonusDone:next});
    onBonusToggle&&onBonusToggle(next);
  };

  if(!loaded) return null;
  const selected = MOODS.find(m=>m.id===mood);
  const showCauses = mood==="fatigue"||mood==="depasse";

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun,marginBottom:".6rem"}}>💛 Comment tu te sens aujourd'hui ?</div>
      <div style={{display:"flex",gap:".4rem",marginBottom:mood?".6rem":0}}>
        {MOODS.map(m=>(
          <button key={m.id} onClick={()=>choisir(m.id)}
            style={{flex:1,padding:".55rem .3rem",borderRadius:10,border:`1.5px solid ${mood===m.id?C.rose:C.pale}`,background:mood===m.id?C.rose+"15":C.blanc,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
            <div style={{fontSize:"1.3rem"}}>{m.icon}</div>
            <div style={{fontSize:".62rem",color:mood===m.id?C.brun:C.gris,fontWeight:mood===m.id?700:400,marginTop:".15rem"}}>{m.label}</div>
          </button>
        ))}
      </div>
      {selected&&(
        <div style={{fontSize:".74rem",color:C.texte,lineHeight:1.6,background:C.creme,borderRadius:8,padding:".6rem .8rem"}}>
          {selected.message}
        </div>
      )}

      {/* Mini-questionnaire causes (fatigue/dépassée) */}
      {showCauses&&(
        <div style={{marginTop:".7rem",paddingTop:".7rem",borderTop:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem"}}>Si tu veux, dis-moi ce qui pèse aujourd'hui (tu peux en cocher plusieurs) :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".35rem",marginBottom:causes.length>0?".6rem":0}}>
            {CAUSES_FATIGUE.map(c=>{
              const active = causes.includes(c.id);
              return(
                <button key={c.id} onClick={()=>toggleCause(c.id)}
                  style={{padding:".3rem .6rem",borderRadius:20,fontSize:".68rem",fontWeight:600,border:`1px solid ${active?C.lilas:C.pale}`,background:active?C.lilas+"15":C.blanc,color:active?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {c.icon} {c.label}
                </button>
              );
            })}
          </div>
          {causes.map(causeId=>{
            const c = CAUSES_FATIGUE.find(x=>x.id===causeId);
            if(!c) return null;
            const {text, streak} = getConseilPourCause(c, conseilHistory);
            return(
              <div key={causeId} style={{fontSize:".72rem",color:C.texte,lineHeight:1.6,background:streak>=3?"rgba(196,154,138,.12)":"rgba(168,155,181,.1)",borderLeft:`3px solid ${streak>=3?C.rose:C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .7rem",marginBottom:".35rem"}}>
                {streak>=3&&<span style={{fontWeight:700}}>💛 </span>}{text}
              </div>
            );
          })}
        </div>
      )}

      {/* Actions bonus (au top) */}
      {mood==="top"&&(
        <div style={{marginTop:".7rem",paddingTop:".7rem",borderTop:`1px solid ${C.pale}`}}>
          <div style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem"}}>Envie d'aller plus loin ? Quelques actions bonus (optionnelles) :</div>
          {ACTIONS_BONUS.map(b=>{
            const checked = bonusDone[b.id];
            return(
              <div key={b.id} onClick={()=>toggleBonus(b.id)}
                style={{display:"flex",alignItems:"flex-start",gap:".5rem",padding:".4rem 0",cursor:"pointer"}}>
                <div style={{width:18,height:18,borderRadius:4,border:`2px solid ${checked?C.or:C.pale}`,background:checked?C.or:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center"}}>
                  {checked&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                </div>
                <div>
                  <div style={{fontSize:".74rem",fontWeight:600,color:checked?C.gris:C.texte,textDecoration:checked?"line-through":"none"}}>{b.icon} {b.label}</div>
                  <div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>{b.sub}</div>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}


export function JaugeSucces({pctCA, pctRecrues}){
  const score = Math.round((Math.min(100,pctCA||0) + Math.min(100,pctRecrues||0)) / 2);
  let couleur = C.rose, message = "C'est parti ! 💪";
  if(score>=100){couleur=C.vert; message="Objectif du mois atteint, bravo ! 🎉";}
  else if(score>=75){couleur=C.or; message="Tu y es presque ! 🔥";}
  else if(score>=40){couleur=C.lilas; message="Belle progression, continue ! ✨";}

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>🚀 Jauge de succès du mois</div>
        <div style={{fontSize:"1rem",fontWeight:700,color:couleur}}>{score}%</div>
      </div>
      <div style={{height:14,background:C.pale,borderRadius:10,overflow:"hidden"}}>
        <div style={{height:"100%",background:couleur,width:score+"%",borderRadius:10,transition:"width .5s ease"}}/>
      </div>
      <div style={{fontSize:".68rem",color:C.gris,marginTop:".4rem",textAlign:"center"}}>{message}</div>
    </div>
  );
}

// Galerie de badges
export function BadgesPanel({badges}){
  const unlocked = badges.filter(b=>b.unlocked);
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".6rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.brun}}>🏅 Mes Badges</div>
        <div style={{fontSize:".68rem",color:C.gris}}>{unlocked.length} / {badges.length}</div>
      </div>
      <div style={{display:"flex",flexWrap:"wrap",gap:".5rem"}}>
        {badges.map(b=>(
          <div key={b.id} title={b.desc}
            style={{
              flex:"1 1 30%", minWidth:90, textAlign:"center", padding:".6rem .3rem",
              borderRadius:10, border:`1px solid ${b.unlocked?C.or+"60":C.pale}`,
              background:b.unlocked?C.or+"15":C.creme, opacity:b.unlocked?1:.45,
              transition:"all .2s",
            }}>
            <div style={{fontSize:"1.5rem",marginBottom:".2rem",filter:b.unlocked?"none":"grayscale(1)"}}>{b.icon}</div>
            <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,lineHeight:1.3}}>{b.label}</div>
            <div style={{fontSize:".56rem",color:C.gris,marginTop:".15rem",lineHeight:1.3}}>{b.desc}</div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── WALL OF FAME & DÉFIS ÉQUIPE (Lot 2b) ──────────────────────────────────────

const REACTION_EMOJIS = ["🔥","❤️","👏","💪"];

// Publie automatiquement une réussite sur le Wall of Fame (global, partagé)
export async function postToWallOfFame(uid, userName, message, icon="🎉"){
  try{
    const ref = doc(db,"equipe","wall-of-fame");
    const snap = await getDoc(ref);
    const existing = snap.exists() && snap.data().posts ? snap.data().posts : [];
    // Éviter les doublons rapprochés (même message, même personne, < 1h)
    const recent = existing.find(p=>p.uid===uid&&p.message===message&&(Date.now()-p.ts)<3600000);
    if(recent) return;
    const post = {id:`wf${Date.now()}`, uid, userName, message, icon, ts:Date.now(), reactions:{}};
    const next = [post, ...existing].slice(0,50);
    await setDoc(ref, {posts: next}, {merge:true});
  }catch{}
}

// Power Hour — Sprint collectif synchrone de 20 minutes, lançable par tout chef d'équipe
export function PowerHourTab({uid, userName, canCreate}){
  const[session,setSession]=useState(null);
  const[loading,setLoading]=useState(true);
  const[message,setMessage]=useState("");
  const[accepted,setAccepted]=useState(false);
  const DUREE_MIN=20;

  const load=async()=>{
    try{
      const snap=await getDoc(doc(db,"equipe","power-hour"));
      if(snap.exists()&&snap.data().startedAt){
        const d=snap.data();
        const elapsed=Date.now()-d.startedAt;
        if(elapsed < DUREE_MIN*60000+5*60000){ setSession(d); }
        else setSession(null);
      } else setSession(null);
      // Charger si l'utilisateur a accepté cette session
      const accSnap=await getDoc(doc(db,"power-hour-accepts",uid));
      if(accSnap.exists()&&accSnap.data().sessionStart===snap.data()?.startedAt){
        setAccepted(true);
      } else setAccepted(false);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{ load(); const t=setInterval(load,5000); return()=>clearInterval(t); },[]);

  const lancer=async()=>{
    const nouvelle={startedAt:Date.now(),startedBy:userName,messages:[],accepts:{}};
    try{ await setDoc(doc(db,"equipe","power-hour"),nouvelle); setSession(nouvelle); }catch{}
  };

  const accepter=async()=>{
    if(!session)return;
    const next={...session,accepts:{...(session.accepts||{}),[uid]:{userName,ts:Date.now()}}};
    setSession(next);setAccepted(true);
    try{
      await setDoc(doc(db,"equipe","power-hour"),next,{merge:true});
      await setDoc(doc(db,"power-hour-accepts",uid),{sessionStart:session.startedAt,userName,ts:Date.now()});
    }catch{}
  };

  const envoyerMessage=async()=>{
    if(!message.trim()||!session)return;
    const msg={uid,userName,text:message.trim(),ts:Date.now()};
    const next={...session,messages:[...(session.messages||[]),msg].slice(-100)};
    setMessage("");setSession(next);
    try{ await setDoc(doc(db,"equipe","power-hour"),next,{merge:true}); }catch{}
  };

  const arreter=async()=>{
    try{ await setDoc(doc(db,"equipe","power-hour"),{startedAt:0,startedBy:"",messages:[],accepts:{}}); }catch{}
    setSession(null);
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  const elapsed=session?Date.now()-session.startedAt:0;
  const remaining=session?DUREE_MIN*60000-elapsed:0;
  const isActive=session&&remaining>0;
  const minutes=Math.max(0,Math.floor(remaining/60000));
  const seconds=Math.max(0,Math.floor((remaining%60000)/1000));

  // Stats pour chef
  const acceptsList=Object.entries(session?.accepts||{});
  const totalEquipe=Math.max(1,acceptsList.length);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>⚡ Power Hour</div>

      {!session&&!isActive&&(
        <div style={{background:C.creme,borderRadius:12,padding:"1.25rem",textAlign:"center",marginBottom:"1rem"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>⚡</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".3rem"}}>Aucune session en cours</div>
          <div style={{fontSize:".72rem",color:C.gris,marginBottom:"1rem"}}>20 minutes de focus intense pour toute l'équipe</div>
          {canCreate&&(
            <button onClick={lancer}
              style={{background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem 1.5rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              🚀 Lancer une Power Hour
            </button>
          )}
        </div>
      )}

      {session&&(
        <div>
          {/* Bandeau session */}
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem",color:C.blanc}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
              <div>
                <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>
                  {isActive?"⚡ POWER HOUR EN COURS":"✅ Session terminée"}
                </div>
                <div style={{fontSize:".72rem",color:C.pale}}>Lancée par {session.startedBy}</div>
              </div>
              {isActive&&(
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:700,color:C.or}}>
                  {String(minutes).padStart(2,"0")}:{String(seconds).padStart(2,"0")}
                </div>
              )}
            </div>

            {/* Coche d'acceptation */}
            {isActive&&(
              <div onClick={!accepted?accepter:null}
                style={{marginTop:".75rem",background:accepted?"rgba(127,175,138,.25)":"rgba(255,255,255,.1)",borderRadius:10,padding:".6rem .85rem",display:"flex",alignItems:"center",gap:".6rem",cursor:accepted?"default":"pointer",border:`1px solid ${accepted?"rgba(127,175,138,.5)":"rgba(255,255,255,.2)"}`}}>
                <div style={{width:22,height:22,borderRadius:6,border:`2px solid ${accepted?"#7FAF8A":"rgba(255,255,255,.4)"}`,background:accepted?"#7FAF8A":"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {accepted&&<span style={{color:"white",fontSize:".7rem",fontWeight:700}}>✓</span>}
                </div>
                <span style={{fontSize:".78rem",fontWeight:600,color:accepted?"#B8E6C4":C.pale}}>
                  {accepted?"✅ Tu participes à cette Power Hour !":"Je participe à cette Power Hour"}
                </span>
              </div>
            )}

            {/* Stats chef */}
            {canCreate&&isActive&&(
              <div style={{marginTop:".5rem",background:"rgba(255,255,255,.08)",borderRadius:9,padding:".5rem .75rem"}}>
                <div style={{fontSize:".6rem",color:C.or,fontWeight:700,marginBottom:".3rem"}}>📊 Participation équipe</div>
                <div style={{display:"flex",alignItems:"center",gap:".75rem"}}>
                  <div style={{flex:1,height:6,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:C.vert,width:Math.min(100,(acceptsList.length/Math.max(1,Object.keys(session.accepts||{}).length+5))*100)+"%",borderRadius:10}}/>
                  </div>
                  <span style={{fontSize:".72rem",fontWeight:700,color:C.pale,flexShrink:0}}>{acceptsList.length} participant{acceptsList.length>1?"s":""}</span>
                </div>
                {acceptsList.length>0&&(
                  <div style={{marginTop:".35rem",display:"flex",flexWrap:"wrap",gap:".25rem"}}>
                    {acceptsList.map(([,v])=>(
                      <span key={v.userName} style={{background:"rgba(255,255,255,.12)",borderRadius:20,padding:".1rem .4rem",fontSize:".6rem",color:C.pale}}>{v.userName}</span>
                    ))}
                  </div>
                )}
              </div>
            )}

            {canCreate&&<button onClick={arreter} style={{marginTop:".6rem",background:"rgba(255,255,255,.15)",border:"none",borderRadius:7,padding:".3rem .8rem",fontSize:".65rem",color:C.pale,cursor:"pointer",fontFamily:"inherit"}}>✕ Arrêter</button>}
          </div>

          {/* Chat */}
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",marginBottom:".5rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,color:C.gris,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>💬 Messages</div>
            <div style={{maxHeight:200,overflowY:"auto",marginBottom:".5rem"}}>
              {(session.messages||[]).length===0&&<div style={{fontSize:".7rem",color:C.gris,textAlign:"center",padding:".5rem"}}>Aucun message</div>}
              {(session.messages||[]).map((m,i)=>(
                <div key={i} style={{marginBottom:".35rem",padding:".35rem .6rem",background:m.uid===uid?C.rose+"12":C.creme,borderRadius:8,border:`1px solid ${m.uid===uid?C.rose+"30":C.pale}`}}>
                  <div style={{fontSize:".6rem",fontWeight:700,color:m.uid===uid?C.rose:C.brun}}>{m.userName}</div>
                  <div style={{fontSize:".75rem",color:C.texte}}>{m.text}</div>
                </div>
              ))}
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <input value={message} onChange={e=>setMessage(e.target.value)} placeholder="Ton message..."
                onKeyDown={e=>e.key==="Enter"&&envoyerMessage()} style={{marginBottom:0,border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",flex:1}}/>
              <button onClick={envoyerMessage} style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".4rem .7rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>→</button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

export function WallOfFameTab({uid, userName}){
  const[posts,setPosts]=useState([]);
  const[loading,setLoading]=useState(true);

  const load=async()=>{
    setLoading(true);
    try{
      const snap = await getDoc(doc(db,"equipe","wall-of-fame"));
      setPosts(snap.exists()&&snap.data().posts ? snap.data().posts : []);
    }catch{}
    setLoading(false);
  };

  useEffect(()=>{ load(); },[]);

  const react=async(postId, emoji)=>{
    const next = posts.map(p=>{
      if(p.id!==postId) return p;
      const reactions = {...(p.reactions||{})};
      const users = reactions[emoji] || [];
      reactions[emoji] = users.includes(uid) ? users.filter(u=>u!==uid) : [...users, uid];
      return {...p, reactions};
    });
    setPosts(next);
    try{ await setDoc(doc(db,"equipe","wall-of-fame"), {posts: next}, {merge:true}); }catch{}
  };

  const timeAgo=(ts)=>{
    const diff = Date.now()-ts;
    const mins = Math.floor(diff/60000);
    if(mins<1) return "à l'instant";
    if(mins<60) return `il y a ${mins} min`;
    const hours = Math.floor(mins/60);
    if(hours<24) return `il y a ${hours}h`;
    return `il y a ${Math.floor(hours/24)}j`;
  };

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Wall of <em style={{fontStyle:"italic",color:C.rose}}>Fame</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Les réussites de toute l'équipe Blazing Dynasty 🎉 — réagis pour encourager !
      </p>

      <button onClick={load} disabled={loading}
        style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        {loading?"Chargement...":"🔄 Actualiser"}
      </button>

      {posts.length===0&&!loading&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Rien pour l'instant... Les prochaines réussites de l'équipe apparaîtront ici automatiquement ! ✨
        </div>
      )}

      {posts.map(p=>(
        <div key={p.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"flex-start"}}>
            <div style={{fontSize:"1.4rem",flexShrink:0}}>{p.icon||"🎉"}</div>
            <div style={{flex:1}}>
              <div style={{fontSize:".75rem",color:C.texte,lineHeight:1.55}}>
                <strong style={{color:C.brun}}>{p.userName}</strong> {p.message}
              </div>
              <div style={{fontSize:".6rem",color:C.gris,marginTop:".2rem"}}>{timeAgo(p.ts)}</div>
            </div>
          </div>
          <div style={{display:"flex",gap:".35rem",marginTop:".6rem"}}>
            {REACTION_EMOJIS.map(emoji=>{
              const users = (p.reactions&&p.reactions[emoji])||[];
              const active = users.includes(uid);
              return(
                <button key={emoji} onClick={()=>react(p.id,emoji)}
                  style={{display:"flex",alignItems:"center",gap:".25rem",border:`1px solid ${active?C.rose:C.pale}`,background:active?C.rose+"15":"transparent",borderRadius:20,padding:".2rem .55rem",fontSize:".72rem",cursor:"pointer",fontFamily:"inherit",color:active?C.brun:C.gris}}>
                  <span>{emoji}</span>{users.length>0&&<span style={{fontWeight:700}}>{users.length}</span>}
                </button>
              );
            })}
          </div>
        </div>
      ))}
    </div>
  );
}

// Module de Défis éphémères équipe
function ChallengeCountdown({deadline}){
  const[r,setR]=useState(deadline-Date.now());
  useEffect(()=>{const t=setInterval(()=>setR(deadline-Date.now()),30000);return()=>clearInterval(t);},[deadline]);
  if(r<=0)return <span style={{color:"#B04040",fontWeight:700,fontSize:".72rem"}}>⏰ Terminé</span>;
  const d2=Math.floor(r/86400000),h=Math.floor((r%86400000)/3600000),m=Math.floor((r%3600000)/60000);
  return <span style={{fontWeight:700,color:C.or,fontSize:".72rem"}}>{d2>0?`${d2}j `:""}{h}h {m}min</span>;
}

export function DefisTab({uid, userName, canCreate, isChef}){
  const[challenges,setChallenges]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showCreate,setShowCreate]=useState(false);
  const[form,setForm]=useState({titre:"",description:"",type:"flash",dureeHeures:"48",objectif:"",unite:"ventes",cadeau:"",cadeauImage:"",equipesCibles:[],global:true});
  const[equipes,setEquipes]=useState([]);
  const[declarations,setDeclarations]=useState({});
  const[declareInput,setDeclareInput]=useState({});

  const isMelissa = uid==="melissa"||uid==="melissa-da-silveira";

  useEffect(()=>{
    (async()=>{
      let annuaire={};
      let chefsUids=[];
      try{
        // Charger l'annuaire et la liste des chefs en premier
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        if(annSnap.exists()){
          annuaire=annSnap.data().membres||{};
          // Un "chef" = quelqu'un qui a au moins une filleule OU marqué isChef
          const marraines=new Set(Object.values(annuaire).map(m=>m.marraine).filter(Boolean));
          const chefsEntries=Object.entries(annuaire).filter(([k,v])=>v.isChef||marraines.has(k));
          // Ajouter Melissa (uid racine) si pas dans l'annuaire
          const melissaEntry={uid:"melissa-da-silveira",nom:"Melissa"};
          const chefsAvecMelissa=[...chefsEntries.map(([k,v])=>({uid:k,nom:v.prenom||k}))];
          if(!chefsAvecMelissa.find(e=>e.uid==="melissa-da-silveira")) chefsAvecMelissa.unshift(melissaEntry);
          chefsUids=chefsAvecMelissa.map(e=>e.uid);
          setEquipes(chefsAvecMelissa.sort((a,b)=>a.nom.localeCompare(b.nom)));
        }
      }catch{}
      try{
        // Charger les challenges
        const snap=await getDoc(doc(db,"challenges","liste"));
        const data=snap.exists()?snap.data().items||[]:[];
        // Filtrer selon l'équipe de l'utilisateur — en remontant sa lignée jusqu'aux chefs
        const now=Date.now();
        const mesChefs=getLigneeChefs(annuaire,uid,chefsUids);
        const actifs=data.filter(c=>{
          if(c.deadline&&c.deadline<now)return false;
          if(isMelissa)return true;
          if(c.global)return true;
          if(!c.equipesCibles||c.equipesCibles.length===0)return true;
          if(c.equipesCibles.includes("all"))return true;
          // Visible si l'utilisateur EST un des chefs ciblés, OU si un de ses chefs (lignée) est ciblé
          return c.equipesCibles.includes(uid)||mesChefs.some(chefUid=>c.equipesCibles.includes(chefUid));
        });
        setChallenges(actifs.sort((a,b)=>b.ts-a.ts));
        // Charger les déclarations par challenge
        const declSnap=await getDoc(doc(db,"challenges","declarations"));
        setDeclarations(declSnap.exists()?declSnap.data():{});
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveAll=async(items)=>{
    await setDoc(doc(db,"challenges","liste"),{items});
    setChallenges(items.filter(c=>{
      if(c.deadline&&c.deadline<Date.now())return false;
      if(isMelissa)return true;
      if(c.global)return true;
      if(!c.equipesCibles||c.equipesCibles.length===0)return true;
      return c.equipesCibles.includes(uid);
    }));
  };

  const creer=async()=>{
    if(!form.titre.trim())return;
    const id=`c${Date.now()}`;
    const nouveau={
      id,titre:form.titre.trim(),description:form.description.trim(),
      type:form.type,
      deadline:form.type==="flash"?Date.now()+(+form.dureeHeures||48)*3600000:form.type==="long"?Date.now()+21*24*3600000:null,
      objectif:+form.objectif||0,unite:form.unite,
      cadeau:form.cadeau.trim(),cadeauImage:form.cadeauImage.trim(),
      global:form.global,equipesCibles:form.global?[]:form.equipesCibles,
      createdBy:userName,ts:Date.now(),
    };
    const snap=await getDoc(doc(db,"challenges","liste"));
    const existing=snap.exists()?snap.data().items||[]:[];
    await saveAll([nouveau,...existing]);
    setShowCreate(false);
    setForm({titre:"",description:"",type:"flash",dureeHeures:"48",objectif:"",unite:"ventes",cadeau:"",cadeauImage:"",equipesCibles:[],global:true});
  };

  const declarer=async(challengeId,amount)=>{
    const d={uid,userName,count:+amount||1,ts:Date.now()};
    const current=declarations[challengeId]||[];
    const next={...declarations,[challengeId]:[...current,d]};
    setDeclarations(next);
    await setDoc(doc(db,"challenges","declarations"),next,{merge:true});
    postToWallOfFame&&postToWallOfFame(uid,userName,`a déclaré ${amount} ${form.unite} sur le challenge "${challengeId}" 💪`,"🚀");
  };

  const supprimer=async(id)=>{
    const snap=await getDoc(doc(db,"challenges","liste"));
    const items=(snap.exists()?(snap.data().items||[]):[]).filter(c=>c.id!==id);
    await saveAll(items);
  };

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  const Countdown=ChallengeCountdown;

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>🏆 Challenges & Défis</div>
        {canCreate&&(
          <button onClick={()=>setShowCreate(p=>!p)}
            style={{background:showCreate?C.pale:C.brun,color:showCreate?C.gris:C.blanc,border:"none",borderRadius:9,padding:".4rem .8rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {showCreate?"✕ Annuler":"+ Créer"}
          </button>
        )}
      </div>

      {/* FORMULAIRE CRÉATION */}
      {showCreate&&canCreate&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>✨ Nouveau challenge</div>

          {/* Titre */}
          <input placeholder="Titre du challenge*" value={form.titre} onChange={e=>setForm(p=>({...p,titre:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>
          <textarea placeholder="Description (optionnel)" value={form.description} onChange={e=>setForm(p=>({...p,description:e.target.value}))} rows={2}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",marginBottom:".5rem"}}/>

          {/* Type */}
          <div style={{display:"flex",gap:".35rem",marginBottom:".5rem"}}>
            {[{v:"flash",l:"⚡ Challenge Flash (24-72h)"},{v:"long",l:"📅 Challenge Long terme (21j)"},{v:"libre",l:"🎯 Challenge Libre"}].map(t=>(
              <button key={t.v} onClick={()=>setForm(p=>({...p,type:t.v}))}
                style={{flex:1,padding:".38rem .3rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1px solid ${form.type===t.v?C.rose:C.pale}`,background:form.type===t.v?C.rose:C.blanc,color:form.type===t.v?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                {t.l}
              </button>
            ))}
          </div>

          {/* Durée si flash */}
          {form.type==="flash"&&(
            <div style={{display:"flex",gap:".4rem",marginBottom:".5rem",alignItems:"center"}}>
              <span style={{fontSize:".7rem",color:C.gris,flexShrink:0}}>Durée :</span>
              {["24","48","72"].map(h=>(
                <button key={h} onClick={()=>setForm(p=>({...p,dureeHeures:h}))}
                  style={{flex:1,padding:".35rem",fontSize:".7rem",fontWeight:600,borderRadius:7,border:`1px solid ${form.dureeHeures===h?C.rose:C.pale}`,background:form.dureeHeures===h?C.rose:C.blanc,color:form.dureeHeures===h?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                  {h}h
                </button>
              ))}
            </div>
          )}

          {/* Objectif + unité */}
          <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
            <input type="number" placeholder="Objectif" value={form.objectif} onChange={e=>setForm(p=>({...p,objectif:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .55rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
            <input placeholder="Unité (ventes, €...)" value={form.unite} onChange={e=>setForm(p=>({...p,unite:e.target.value}))}
              style={{flex:2,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .55rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>

          {/* Cadeau */}
          <input placeholder="🎁 Récompense (ex: Kit produit Mihi, carte cadeau 50€...)" value={form.cadeau} onChange={e=>setForm(p=>({...p,cadeau:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".35rem"}}/>
          <input placeholder="Image du cadeau (URL optionnel)" value={form.cadeauImage} onChange={e=>setForm(p=>({...p,cadeauImage:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}/>

          {/* Ciblage équipes — 2 choix clairs */}
          <div style={{marginBottom:".75rem"}}>
            <div style={{fontSize:".6rem",color:C.gris,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em",marginBottom:".4rem"}}>Portée du challenge</div>
            <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
              <button onClick={()=>setForm(p=>({...p,global:true,equipesCibles:[]}))}
                style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${form.global?C.rose:C.pale}`,background:form.global?C.rose:C.blanc,color:form.global?"white":C.gris,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                🌍 Toute l'équipe
              </button>
              <button onClick={()=>setForm(p=>({...p,global:false}))}
                style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1.5px solid ${!form.global?C.or:C.pale}`,background:!form.global?C.or+"15":C.blanc,color:!form.global?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit",textAlign:"center"}}>
                👑 Inter-équipes
              </button>
            </div>
            {!form.global&&(
              <div style={{background:C.creme,borderRadius:9,padding:".6rem .75rem",border:`1px solid ${C.or}40`}}>
                <div style={{fontSize:".62rem",color:C.brun,fontWeight:600,marginBottom:".35rem"}}>Sélectionne les équipes participantes :</div>
                <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
                  {equipes.map(e=>{
                    const sel=form.equipesCibles.includes(e.uid);
                    const estMoi=e.uid===uid;
                    return(
                      <button key={e.uid} onClick={()=>setForm(p=>({...p,equipesCibles:sel?p.equipesCibles.filter(x=>x!==e.uid):[...p.equipesCibles,e.uid]}))}
                        style={{padding:".28rem .65rem",fontSize:".68rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${sel?C.brun:C.pale}`,background:sel?C.brun:C.blanc,color:sel?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                        {e.nom}{estMoi?" (moi)":""}
                      </button>
                    );
                  })}
                </div>
                {form.equipesCibles.length>=2&&(
                  <div style={{fontSize:".62rem",color:C.vert,fontWeight:600,marginTop:".4rem"}}>
                    ✓ {form.equipesCibles.length} équipes sélectionnées — les membres de chacune verront ce challenge
                  </div>
                )}
                {form.equipesCibles.length<2&&(
                  <div style={{fontSize:".62rem",color:C.gris,marginTop:".4rem",fontStyle:"italic"}}>
                    Sélectionne au moins 2 équipes pour un challenge inter-équipes
                  </div>
                )}
              </div>
            )}
          </div>

          <button onClick={creer}
            style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".6rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            🚀 Lancer le challenge
          </button>
        </div>
      )}

      {/* LISTE DES CHALLENGES */}
      {challenges.length===0&&!showCreate&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          Aucun challenge en cours 🌸<br/>
          {canCreate&&<span style={{color:C.rose,fontSize:".72rem"}}>Crée le premier !</span>}
        </div>
      )}

      {challenges.map(c=>{
        const decls=declarations[c.id]||[];
        const total=decls.reduce((s,d)=>s+d.count,0);
        const pct=c.objectif?Math.min(100,Math.round(total/c.objectif*100)):0;
        const classement=Object.values(decls.reduce((acc,d)=>{
          acc[d.userName]=acc[d.userName]||{userName:d.userName,total:0};
          acc[d.userName].total+=d.count;
          return acc;
        },{})).sort((a,b)=>b.total-a.total);
        const medals=["🥇","🥈","🥉"];
        const monTotal=decls.filter(d=>d.uid===uid).reduce((s,d)=>s+d.count,0);

        return(
          <div key={c.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,overflow:"hidden",marginBottom:".75rem"}}>
            {/* Header challenge */}
            <div style={{background:`linear-gradient(135deg,${c.type==="flash"?C.rose:c.type==="long"?C.lilas:C.or},${c.type==="flash"?C.brun2:c.type==="long"?C.brun:C.brun})`,padding:".9rem 1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:".55rem",fontWeight:700,color:"rgba(255,255,255,.7)",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".2rem"}}>
                    {c.type==="flash"?"⚡ Challenge Flash":c.type==="long"?"📅 Challenge Long terme":"🎯 Challenge"}
                    {!c.global&&(c.equipesCibles?.length>1?` · 👑 Challenge entre ${c.equipesCibles.length} équipes`:" · Équipe ciblée")}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:600,color:"white"}}>{c.titre}</div>
                  {c.description&&<div style={{fontSize:".7rem",color:"rgba(255,255,255,.75)",marginTop:".2rem",lineHeight:1.5}}>{c.description}</div>}
                </div>
                <div style={{display:"flex",flexDirection:"column",alignItems:"flex-end",gap:".2rem",flexShrink:0,marginLeft:".5rem"}}>
                  {c.deadline&&<Countdown deadline={c.deadline}/>}
                  {canCreate&&<button onClick={()=>supprimer(c.id)}
                    style={{background:"rgba(255,255,255,.15)",border:"none",borderRadius:5,padding:".18rem .4rem",color:"rgba(255,255,255,.6)",cursor:"pointer",fontSize:".6rem",fontFamily:"inherit"}}>
                    ✕
                  </button>}
                </div>
              </div>
            </div>

            <div style={{padding:".85rem 1rem"}}>
              {/* Barre de progression */}
              {c.objectif>0&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}>
                    <span>Total équipe : {total} {c.unite}</span>
                    <span style={{fontWeight:700,color:pct>=100?C.vert:C.rose}}>{pct}% · objectif {c.objectif}</span>
                  </div>
                  <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:pct>=100?C.vert:C.rose,width:pct+"%",borderRadius:10,transition:"width .5s"}}/>
                  </div>
                </div>
              )}

              {/* Encadré cadeau */}
              {c.cadeau&&(
                <div style={{background:`linear-gradient(135deg,${C.or}20,${C.creme})`,border:`1.5px solid ${C.or}40`,borderRadius:12,padding:".75rem",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".75rem"}}>
                  {c.cadeauImage
                    ?<img src={c.cadeauImage} alt="cadeau" style={{width:52,height:52,borderRadius:8,objectFit:"cover",flexShrink:0}}/>
                    :<div style={{width:44,height:44,background:`linear-gradient(135deg,${C.or},#B8962A)`,borderRadius:10,display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.4rem",flexShrink:0}}>🎁</div>
                  }
                  <div style={{flex:1}}>
                    <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".08em",textTransform:"uppercase",marginBottom:".15rem"}}>Récompense</div>
                    <div style={{fontSize:".8rem",fontWeight:600,color:C.brun,lineHeight:1.5}}>{c.cadeau}</div>
                  </div>
                </div>
              )}

              {/* Ma participation */}
              <div style={{background:C.creme,borderRadius:10,padding:".65rem .85rem",marginBottom:".75rem",display:"flex",alignItems:"center",gap:".6rem"}}>
                <div style={{flex:1}}>
                  <div style={{fontSize:".6rem",color:C.gris,marginBottom:".1rem"}}>Ma participation</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:700,color:C.brun}}>{monTotal} {c.unite}</div>
                </div>
                <input type="number" min="1" value={declareInput[c.id]||""} onChange={e=>setDeclareInput(p=>({...p,[c.id]:e.target.value}))}
                  placeholder="Qté"
                  style={{width:60,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".8rem",fontFamily:"inherit",textAlign:"center",color:C.texte,background:C.blanc,outline:"none"}}/>
                <button onClick={()=>{declarer(c.id,declareInput[c.id]||1);setDeclareInput(p=>({...p,[c.id]:""}));}}
                  style={{background:C.brun,color:C.blanc,border:"none",borderRadius:7,padding:".35rem .7rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",whiteSpace:"nowrap"}}>
                  + Déclarer
                </button>
              </div>

              {/* Classement */}
              {classement.length>0&&(
                <div>
                  <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>🏆 Classement</div>
                  {classement.slice(0,5).map((p,i)=>(
                    <div key={p.userName} style={{display:"flex",alignItems:"center",gap:".5rem",padding:".3rem 0",borderBottom:i<classement.slice(0,5).length-1?`1px solid ${C.pale}30`:"none"}}>
                      <div style={{width:22,textAlign:"center",fontSize:i<3?"1rem":".7rem",flexShrink:0}}>{i<3?medals[i]:`${i+1}.`}</div>
                      <div style={{flex:1,fontSize:".76rem",fontWeight:p.userName===userName?700:400,color:p.userName===userName?C.rose:C.texte}}>{p.userName}{p.userName===userName?" ✓":""}</div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".85rem",fontWeight:700,color:C.brun}}>{p.total} {c.unite}</div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// Mini graphique d'évolution (SVG, sans dépendance externe)
function MiniChart({data, dataKey, objKey, color, unit=""}){
  if(!data || data.length < 2) return (
    <div style={{textAlign:"center",fontSize:".68rem",color:C.gris,padding:".75rem 0"}}>
      Pas encore assez d'historique — reviens après ta prochaine période pour voir ta courbe 📈
    </div>
  );

  const w=300, h=110, pad=8;
  const values = data.map(d=>+d[dataKey]||0);
  const objValues = data.map(d=>+d[objKey]||0);
  const maxV = Math.max(...values, ...objValues, 1);

  const points = values.map((v,i)=>{
    const x = pad + (i/(data.length-1)) * (w-2*pad);
    const y = h-pad - (v/maxV)*(h-2*pad);
    return `${x},${y}`;
  }).join(" ");

  const lastObj = objValues[objValues.length-1];
  const objY = h-pad - (lastObj/maxV)*(h-2*pad);

  return(
    <div>
      <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:"auto",display:"block"}}>
        {lastObj>0&&(
          <line x1={pad} y1={objY} x2={w-pad} y2={objY} stroke={C.or} strokeWidth="1" strokeDasharray="4 3"/>
        )}
        <polyline points={points} fill="none" stroke={color} strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round"/>
        {values.map((v,i)=>{
          const x = pad + (i/(data.length-1)) * (w-2*pad);
          const y = h-pad - (v/maxV)*(h-2*pad);
          return <circle key={i} cx={x} cy={y} r="3" fill={color}/>;
        })}
      </svg>
      <div style={{display:"flex",justifyContent:"space-between",fontSize:".58rem",color:C.gris,marginTop:".2rem"}}>
        <span>{new Date(data[0].date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
        {lastObj>0&&<span style={{color:C.or}}>┄ Objectif : {lastObj}{unit}</span>}
        <span>{new Date(data[data.length-1].date).toLocaleDateString("fr-FR",{day:"numeric",month:"short"})}</span>
      </div>
    </div>
  );
}

// Calcule la comparaison vs la période précédente
function comparaisonPeriode(historique, currentVal, key){
  if(!historique || historique.length===0) return null;
  const previous = +historique[historique.length-1][key] || 0;
  const current = +currentVal || 0;
  const diff = current - previous;
  const pct = previous!==0 ? Math.round((diff/previous)*100) : (current>0?100:0);
  return {previous, current, diff, pct};
}


// ── OBJECTIFS PERSONNELS ──────────────────────────────────────────────────────
const PALIERS_PERSO=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];

// Objectif CA suggéré selon le palier visé (pré-remplissage automatique)
const PALIER_CA_OBJ={
  "2%":100, "4%":250, "6%":500, "8%":1000, "10%":1500, "12%":2000, "14%":3000, "17%":5000, "SR":7500,
};

// Paliers de qualification : nombre de directeurs requis + points requis + montant de prime
const PALIERS_QUALIFICATION=[
  {id:"Directeur", nbDirecteurs:1, pts:0, prime:1000},
  {id:"SR", nbDirecteurs:1, pts:7500, ptsOU:true, prime:500}, // 7500 pts OU 1 directeur
  {id:"Structural", nbDirecteurs:2, pts:0, prime:2000},
  {id:"Business Director", nbDirecteurs:3, pts:0, prime:3000},
  {id:"SR Business Director", nbDirecteurs:4, pts:0, prime:4000},
];

// Périodes Mihi — ancre chargée depuis Firebase admin (modifiable)
// Valeur par défaut : 19/12/2024

// ── CALENDRIER OFFICIEL MIHI PAR ANNÉE ──────────────────────────────────────
// Dates exactes extraites des catalogues officiels Mihi
export const CALENDRIER_MIHI = {
  2023: [
    {c:1, debut:"2023-01-07", fin:"2023-01-27"},
    {c:2, debut:"2023-01-28", fin:"2023-02-17"},
    {c:3, debut:"2023-02-18", fin:"2023-03-10"},
    {c:4, debut:"2023-03-11", fin:"2023-03-31"},
    {c:5, debut:"2023-04-01", fin:"2023-04-21"},
    {c:6, debut:"2023-04-22", fin:"2023-05-12"},
    {c:7, debut:"2023-05-13", fin:"2023-06-02"},
    {c:8, debut:"2023-06-03", fin:"2023-06-23"},
    {c:9, debut:"2023-06-24", fin:"2023-07-14"},
    {c:10,debut:"2023-07-15", fin:"2023-08-04"},
    {c:11,debut:"2023-08-05", fin:"2023-08-25"},
    {c:12,debut:"2023-08-26", fin:"2023-09-15"},
    {c:13,debut:"2023-09-16", fin:"2023-10-06"},
    {c:14,debut:"2023-10-07", fin:"2023-10-27"},
    {c:15,debut:"2023-10-28", fin:"2023-11-17"},
    {c:16,debut:"2023-11-18", fin:"2023-12-08"},
    {c:17,debut:"2023-12-09", fin:"2023-12-29"},
  ],
  2024: [
    {c:1, debut:"2024-01-18", fin:"2024-02-07"},
    {c:2, debut:"2024-02-08", fin:"2024-02-28"},
    {c:3, debut:"2024-02-29", fin:"2024-03-20"},
    {c:4, debut:"2024-03-21", fin:"2024-04-10"},
    {c:5, debut:"2024-04-11", fin:"2024-05-01"},
    {c:6, debut:"2024-05-02", fin:"2024-05-22"},
    {c:7, debut:"2024-05-23", fin:"2024-06-12"},
    {c:8, debut:"2024-06-13", fin:"2024-07-03"},
    {c:9, debut:"2024-07-04", fin:"2024-07-24"},
    {c:10,debut:"2024-07-25", fin:"2024-08-14"},
    {c:11,debut:"2024-08-15", fin:"2024-09-04"},
    {c:12,debut:"2024-09-05", fin:"2024-09-25"},
    {c:13,debut:"2024-09-26", fin:"2024-10-16"},
    {c:14,debut:"2024-10-17", fin:"2024-11-06"},
    {c:15,debut:"2024-11-07", fin:"2024-11-27"},
    {c:16,debut:"2024-11-28", fin:"2024-12-18"},
    {c:17,debut:"2024-12-19", fin:"2025-01-08"},
    {c:18,debut:"2023-12-28", fin:"2024-01-17"},
  ],
  2025: [
    {c:1, debut:"2025-01-09", fin:"2025-01-29"},
    {c:2, debut:"2025-01-30", fin:"2025-02-19"},
    {c:3, debut:"2025-02-20", fin:"2025-03-12"},
    {c:4, debut:"2025-03-13", fin:"2025-04-02"},
    {c:5, debut:"2025-04-03", fin:"2025-04-23"},
    {c:6, debut:"2025-04-24", fin:"2025-05-14"},
    {c:7, debut:"2025-05-15", fin:"2025-06-04"},
    {c:8, debut:"2025-06-05", fin:"2025-06-25"},
    {c:9, debut:"2025-06-26", fin:"2025-07-16"},
    {c:10,debut:"2025-07-17", fin:"2025-08-06"},
    {c:11,debut:"2025-08-07", fin:"2025-08-27"},
    {c:12,debut:"2025-08-28", fin:"2025-09-17"},
    {c:13,debut:"2025-09-18", fin:"2025-10-08"},
    {c:14,debut:"2025-10-09", fin:"2025-10-29"},
    {c:15,debut:"2025-10-30", fin:"2025-11-19"},
    {c:16,debut:"2025-11-20", fin:"2025-12-10"},
    {c:17,debut:"2025-12-11", fin:"2025-12-31"},
  ],
  2026: [
    {c:1, debut:"2026-01-01", fin:"2026-01-21"},
    {c:2, debut:"2026-01-22", fin:"2026-02-11"},
    {c:3, debut:"2026-02-12", fin:"2026-03-04"},
    {c:4, debut:"2026-03-05", fin:"2026-03-25"},
    {c:5, debut:"2026-03-26", fin:"2026-04-15"},
    {c:6, debut:"2026-04-16", fin:"2026-05-06"},
    {c:7, debut:"2026-05-07", fin:"2026-05-27"},
    {c:8, debut:"2026-05-28", fin:"2026-06-17"},
    {c:9, debut:"2026-06-18", fin:"2026-07-08"},
    {c:10,debut:"2026-07-09", fin:"2026-07-29"},
    {c:11,debut:"2026-07-30", fin:"2026-08-19"},
    {c:12,debut:"2026-08-20", fin:"2026-09-09"},
    {c:13,debut:"2026-09-10", fin:"2026-09-30"},
    {c:14,debut:"2026-10-01", fin:"2026-10-21"},
    {c:15,debut:"2026-10-22", fin:"2026-11-11"},
    {c:16,debut:"2026-11-12", fin:"2026-12-02"},
    {c:17,debut:"2026-12-03", fin:"2026-12-23"},
  ],
};

// Trouve la campagne Mihi officielle pour une date donnée
function getCampagneMihiPourDate(dateStr){
  const d = new Date(dateStr+"T12:00:00").getTime();
  for(const [annee, campagnes] of Object.entries(CALENDRIER_MIHI)){
    for(const c of campagnes){
      const deb = new Date(c.debut+"T00:00:00").getTime();
      const fin = new Date(c.fin+"T23:59:59").getTime();
      if(d >= deb && d <= fin) return {annee:parseInt(annee), num:c.c, debut:c.debut, fin:c.fin};
    }
  }
  return null;
}

// Trouve la campagne Mihi actuelle
function getCampagneMihiActuelle(){
  const today = new Date();
  const dateStr = today.getFullYear()+"-"+String(today.getMonth()+1).padStart(2,"0")+"-"+String(today.getDate()).padStart(2,"0");
  return getCampagneMihiPourDate(dateStr);
}

export let ANTHROPIC_API_KEY="";
async function chargerCleAPI(){try{const snap=await getDoc(doc(db,"admin","config"));if(snap.exists()&&snap.data().anthropicKey)ANTHROPIC_API_KEY=snap.data().anthropicKey;}catch{}}
chargerCleAPI();

export let PERIODE_DEBUT_ABSOLU_MS = new Date("2026-01-01T12:00:00").getTime();
export const CALENDRIER_PERIODES = {
  2025: [
    {num:1,debut:"2025-01-09",fin:"2025-01-29"},
    {num:2,debut:"2025-01-30",fin:"2025-02-19"},
    {num:3,debut:"2025-02-20",fin:"2025-03-12"},
    {num:4,debut:"2025-03-13",fin:"2025-04-02"},
    {num:5,debut:"2025-04-03",fin:"2025-04-23"},
    {num:6,debut:"2025-04-24",fin:"2025-05-14"},
    {num:7,debut:"2025-05-15",fin:"2025-06-04"},
    {num:8,debut:"2025-06-05",fin:"2025-06-25"},
    {num:9,debut:"2025-06-26",fin:"2025-07-16"},
    {num:10,debut:"2025-07-17",fin:"2025-08-06"},
    {num:11,debut:"2025-08-07",fin:"2025-08-27"},
    {num:12,debut:"2025-08-28",fin:"2025-09-17"},
    {num:13,debut:"2025-09-18",fin:"2025-10-08"},
    {num:14,debut:"2025-10-09",fin:"2025-10-29"},
    {num:15,debut:"2025-10-30",fin:"2025-11-19"},
    {num:16,debut:"2025-11-20",fin:"2025-12-10"},
    {num:17,debut:"2025-12-11",fin:"2025-12-31"},
  ],
  2024: [
    {num:18,debut:"2023-12-28",fin:"2024-01-17"},
    {num:1,debut:"2024-01-18",fin:"2024-02-07"},
    {num:2,debut:"2024-02-08",fin:"2024-02-28"},
    {num:3,debut:"2024-02-29",fin:"2024-03-20"},
    {num:4,debut:"2024-03-21",fin:"2024-04-10"},
    {num:5,debut:"2024-04-11",fin:"2024-05-01"},
    {num:6,debut:"2024-05-02",fin:"2024-05-22"},
    {num:7,debut:"2024-05-23",fin:"2024-06-12"},
    {num:8,debut:"2024-06-13",fin:"2024-07-03"},
    {num:9,debut:"2024-07-04",fin:"2024-07-24"},
    {num:10,debut:"2024-07-25",fin:"2024-08-14"},
    {num:11,debut:"2024-08-15",fin:"2024-09-04"},
    {num:12,debut:"2024-09-05",fin:"2024-09-25"},
    {num:13,debut:"2024-09-26",fin:"2024-10-16"},
    {num:14,debut:"2024-10-17",fin:"2024-11-06"},
    {num:15,debut:"2024-11-07",fin:"2024-11-27"},
    {num:16,debut:"2024-11-28",fin:"2024-12-18"},
    {num:17,debut:"2024-12-19",fin:"2025-01-08"},
  ],
};
export const PERIODE_DUREE_JOURS = 21;
export const PERIODES_PAR_AN = 18;

// Charge l'ancre depuis Firebase (appelé au démarrage de l'app)
async function chargerAncrePeriodesFirebase(){
  try{
    const snap = await getDoc(doc(db,"admin","config_periodes"));
    if(snap.exists()&&snap.data().ancre){
      const savedAncre = new Date(snap.data().ancre).getTime();
      // Utiliser l'ancre sauvegardée seulement si elle est récente (2026+)
      if(savedAncre >= new Date("2025-01-01").getTime()) PERIODE_DEBUT_ABSOLU_MS = savedAncre;
    }
  }catch{}
}

// Appel immédiat au chargement
chargerAncrePeriodesFirebase();

export function getDebutCampagne(annee, numC){
  if(typeof CALENDRIER_MIHI!=="undefined"&&CALENDRIER_MIHI[annee]){
    const camp=CALENDRIER_MIHI[annee].find(c=>c.c===numC);
    if(camp) return new Date(camp.debut+"T12:00:00");
  }
  return null;
}
export function getFinCampagne(annee, numC){
  if(typeof CALENDRIER_MIHI!=="undefined"&&CALENDRIER_MIHI[annee]){
    const camp=CALENDRIER_MIHI[annee].find(c=>c.c===numC);
    if(camp) return new Date(camp.fin+"T12:00:00");
  }
  return null;
}
export function getPeriodeDebut(nAbsolu){
  // Utiliser le calendrier officiel Mihi 2026 pour la période actuelle
  const campActuelle = getCampagneMihiActuelle();
  if(campActuelle){
    const annee = campActuelle.annee;
    const camps = CALENDRIER_MIHI[annee] || [];
    // nAbsolu relatif = numéro dans l'année courante
    const numAnnee = ((nAbsolu-1) % PERIODES_PAR_AN) + 1;
    const camp = camps.find(c=>c.c===numAnnee);
    if(camp) return new Date(camp.debut+"T12:00:00");
  }
  return new Date(PERIODE_DEBUT_ABSOLU_MS + (nAbsolu-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
}

export function getPeriodeActuelle(){
  const ANCRE = new Date("2026-01-01T12:00:00").getTime();
  const now = new Date(); const todayLocal = new Date(now.getFullYear(),now.getMonth(),now.getDate()).getTime(); const diffJours = Math.floor((todayLocal - ANCRE) / (24*60*60*1000));
  return Math.max(1, Math.floor(diffJours / PERIODE_DUREE_JOURS) + 1);
}

function getPeriodeLabel(nAbsolu){
  const debut = getPeriodeDebut(nAbsolu);
  const fin = new Date(debut.getTime() + PERIODE_DUREE_JOURS*24*60*60*1000 - 1);
  const fmt=(d)=>d.toLocaleDateString("fr-FR",{day:"numeric",month:"short"});
  // Numéro dans l'année et année
  // P1 2025 = abs 1, P18 2025 = abs 18, P1 2026 = abs 19...
  const numDansAnnee = ((nAbsolu-1) % PERIODES_PAR_AN + PERIODES_PAR_AN) % PERIODES_PAR_AN + 1;
  const annee = debut.getFullYear();
  return `P${numDansAnnee} ${annee} · ${fmt(debut)}→${fmt(fin)}`;
}

function getPeriodKeys(n=12){
  const current = getPeriodeActuelle();
  const keys = [];
  for(let i=n-1;i>=0;i--){
    const num = current - i;
    if(num > 0) keys.push(`p${num}`);
  }
  return keys;
}

// Label court d'une période : "P7 2026"
export function fmtPLabel(nAbsolu){
  const debut = getPeriodeDebut(nAbsolu);
  // Ancre 22/01/2026 = P1 Mihi
  const OFFSET_MIHI = 0;
  const numAnnee = ((nAbsolu - 1 + OFFSET_MIHI) % PERIODES_PAR_AN + PERIODES_PAR_AN) % PERIODES_PAR_AN + 1;
  return `P${numAnnee} ${debut.getFullYear()}`;
}

// Section "Primes de Qualification" — suivi par période de 21j
function PrimesQualificationSection({obj, save, onPrimeValidee}){
  const qualifs = obj.qualifs || {};

  const setDirecteurs=(palierId, n)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    save({...obj, qualifs:{...qualifs, [palierId]:{...current, directeurs:n}}});
  };

  const setPts=(palierId, n)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    save({...obj, qualifs:{...qualifs, [palierId]:{...current, pts:n}}});
  };

  const togglePeriode=(palierId, periodeKey)=>{
    const current = qualifs[palierId] || {directeurs:0, periodes:{}, primes:{}, pts:0};
    const periodes = {...(current.periodes||{}), [periodeKey]:!current.periodes?.[periodeKey]};
    const next = {...current, periodes};

    const keys = getPeriodKeys(12);

    // Calcul des consécutives : trouve le nombre max de périodes consécutives dans les 12
    // (pas forcément depuis la fin — on cherche le max)
    let maxConsecutifs=0, courant=0;
    for(let i=0;i<keys.length;i++){
      if(periodes[keys[i]]){ courant++; maxConsecutifs=Math.max(maxConsecutifs,courant); }
      else courant=0;
    }
    // Consécutives depuis la fin (les plus récentes)
    let consecutifsRecents=0;
    for(let i=keys.length-1;i>=0;i--){
      if(periodes[keys[i]]) consecutifsRecents++;
      else break;
    }

    const totalSur12 = keys.filter(k=>periodes[k]).length;

    const primes = {...(current.primes||{})};

    // Prime 1 : 2 périodes consécutives
    if(maxConsecutifs>=2 && !primes.consecutif){
      primes.consecutif=true;
      setTimeout(()=>onPrimeValidee&&onPrimeValidee(), 100);
    }

    // Prime 2 : 6 périodes sur 12
    if(totalSur12>=6 && !primes.sur12){
      primes.sur12=true;
      setTimeout(()=>onPrimeValidee&&onPrimeValidee(), 600); // décalé pour que les deux feux s'enchaînent
    }

    next.primes = primes;
    save({...obj, qualifs:{...qualifs, [palierId]:next}});
  };

  const currentIdx = PALIERS_PERSO.indexOf(obj.palier||"2%");
  const srIdx = PALIERS_PERSO.indexOf("SR");
  if(currentIdx < srIdx) return null;

  const periodeKeys = getPeriodKeys(12);
  const currentPeriode = getPeriodeActuelle();

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".3rem"}}>💎 Primes de qualification</div>
      <p style={{fontSize:".66rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Coche les périodes de 21 jours où tu valides la qualification. 2 périodes consécutives ou 6 sur 12 → prime débloquée 🎉
      </p>

      {PALIERS_QUALIFICATION.map(pq=>{
        const q = qualifs[pq.id] || {directeurs:0, periodes:{}, primes:{}, pts:0};
        const periodes = q.periodes || {};
        // Consécutives récentes (depuis la fin)
        let consecutifs=0;
        for(let i=periodeKeys.length-1;i>=0;i--){
          if(periodes[periodeKeys[i]]) consecutifs++;
          else break;
        }
        // Max consécutives sur les 12
        let maxConsecutifs=0, courant=0;
        for(let i=0;i<periodeKeys.length;i++){
          if(periodes[periodeKeys[i]]){ courant++; maxConsecutifs=Math.max(maxConsecutifs,courant); }
          else courant=0;
        }
        const totalSur12 = periodeKeys.filter(k=>periodes[k]).length;

        // Condition SR : 7500 pts OU 1 directeur
        const srPtsValide = pq.ptsOU && (q.pts||0)>=pq.pts;
        const srDirValide = pq.ptsOU && q.directeurs>=1;
        const srQualifie = pq.ptsOU ? (srPtsValide || srDirValide) : true;

        return(
          <div key={pq.id} style={{marginBottom:"1rem",paddingBottom:"1rem",borderBottom:`1px solid ${C.pale}`}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem"}}>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{pq.id}</div>
              <div style={{fontSize:".68rem",fontWeight:700,color:C.or}}>{pq.prime}€ par prime</div>
            </div>

            {/* Condition SR double */}
            {pq.ptsOU&&(
              <div style={{background:C.creme,borderRadius:8,padding:".5rem .7rem",marginBottom:".5rem",fontSize:".68rem",color:C.gris}}>
                <div style={{fontWeight:700,color:C.brun,marginBottom:".3rem"}}>Condition d'accès (au choix) :</div>
                <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
                  {/* Option A : 7500 pts */}
                  <div style={{flex:1,background:srPtsValide?C.vert+"20":C.blanc,border:`1.5px solid ${srPtsValide?C.vert:C.pale}`,borderRadius:8,padding:".5rem .65rem"}}>
                    <div style={{fontSize:".62rem",fontWeight:700,color:srPtsValide?C.vert:C.gris,marginBottom:".3rem"}}>Option A — 7 500 pts</div>
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <input type="number" value={q.pts||""} onChange={e=>setPts(pq.id,+e.target.value||0)}
                        placeholder="0"
                        style={{width:70,border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .4rem",fontSize:".78rem",fontFamily:"inherit",textAlign:"center"}}/>
                      <span style={{fontSize:".62rem",color:C.gris}}>/ 7500 pts</span>
                      {srPtsValide&&<span style={{color:C.vert,fontWeight:700,fontSize:".68rem"}}>✓</span>}
                    </div>
                  </div>
                  <div style={{display:"flex",alignItems:"center",fontSize:".72rem",color:C.gris,fontWeight:700}}>OU</div>
                  {/* Option B : 1 directeur */}
                  <div style={{flex:1,background:srDirValide?C.vert+"20":C.blanc,border:`1.5px solid ${srDirValide?C.vert:C.pale}`,borderRadius:8,padding:".5rem .65rem"}}>
                    <div style={{fontSize:".62rem",fontWeight:700,color:srDirValide?C.vert:C.gris,marginBottom:".3rem"}}>Option B — 1 Directeur</div>
                    <div onClick={()=>setDirecteurs(pq.id, q.directeurs>=1?0:1)}
                      style={{width:24,height:24,borderRadius:6,border:`2px solid ${srDirValide?C.vert:C.pale}`,background:srDirValide?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:".7rem",color:"white",fontWeight:700}}>
                      {srDirValide?"✓":"1"}
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/* Directeurs requis (non-SR) */}
            {pq.nbDirecteurs>0&&!pq.ptsOU&&(
              <div style={{display:"flex",alignItems:"center",gap:".4rem",marginBottom:".5rem",flexWrap:"wrap"}}>
                <span style={{fontSize:".64rem",color:C.gris}}>Directeurs dans ma structure :</span>
                {Array.from({length:pq.nbDirecteurs},(_,i)=>i+1).map(n=>(
                  <div key={n} onClick={()=>setDirecteurs(pq.id, q.directeurs>=n?n-1:n)}
                    style={{width:22,height:22,borderRadius:6,border:`2px solid ${q.directeurs>=n?C.vert:C.pale}`,background:q.directeurs>=n?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",fontSize:".68rem",color:"white",fontWeight:700}}>
                    {q.directeurs>=n?"✓":n}
                  </div>
                ))}
                <span style={{fontSize:".62rem",color:q.directeurs>=pq.nbDirecteurs?C.vert:C.gris,fontWeight:600}}>
                  {q.directeurs}/{pq.nbDirecteurs} {q.directeurs>=pq.nbDirecteurs?"✓ Qualifiée !":""}
                </span>
              </div>
            )}

            {/* Grille périodes */}
            <div style={{display:"grid",gridTemplateColumns:"repeat(4,1fr)",gap:".25rem",marginBottom:".5rem"}}>
              {periodeKeys.map(k=>{
                const num=parseInt(k.slice(1));
                const checked=periodes[k];
                const isCurrent = num===currentPeriode;
                return(
                  <div key={k} onClick={()=>togglePeriode(pq.id,k)}
                    style={{textAlign:"center",padding:".3rem 0",borderRadius:6,border:`1.5px solid ${checked?C.vert:isCurrent?C.rose:C.pale}`,background:checked?C.vert+"20":"transparent",cursor:"pointer"}}>
                    <div style={{fontSize:".58rem",fontWeight:600,color:checked?C.vert:isCurrent?C.rose:C.gris}}>{fmtPLabel(num)}</div>
                    <div style={{fontSize:".52rem",color:checked?C.vert:C.pale}}>{checked?"✓":""}</div>
                  </div>
                );
              })}
            </div>

            {/* Statut primes — 2 onglets débloquables */}
            <div style={{display:"flex",flexDirection:"column",gap:".35rem",marginTop:".5rem"}}>

              {/* Prime 1 : 2 consécutives */}
              <div style={{
                background:q.primes?.consecutif?`linear-gradient(135deg,${C.vert},#4a9a5a)`:maxConsecutifs>=2?C.or+"15":C.creme,
                border:`1.5px solid ${q.primes?.consecutif?C.vert:maxConsecutifs>=2?C.or:C.pale}`,
                borderRadius:10,padding:".6rem .85rem",
                display:"flex",justifyContent:"space-between",alignItems:"center"
              }}>
                <div>
                  <div style={{fontSize:".7rem",fontWeight:700,color:q.primes?.consecutif?"white":maxConsecutifs>=2?C.brun:C.gris}}>
                    {q.primes?.consecutif?"🎉 Prime 1 débloquée !":maxConsecutifs>=2?"✓ Condition remplie":"○ Prime 1"}
                  </div>
                  <div style={{fontSize:".6rem",color:q.primes?.consecutif?"rgba(255,255,255,.8)":C.gris,marginTop:".1rem"}}>
                    2 périodes consécutives · {maxConsecutifs}/2
                  </div>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:q.primes?.consecutif?"white":maxConsecutifs>=2?C.vert:C.gris}}>
                  {pq.prime}€
                </div>
              </div>

              {/* Prime 2 : 6 sur 12 */}
              <div style={{
                background:q.primes?.sur12?`linear-gradient(135deg,${C.or},#b8962a)`:totalSur12>=6?C.vert+"15":C.creme,
                border:`1.5px solid ${q.primes?.sur12?C.or:totalSur12>=6?C.vert:C.pale}`,
                borderRadius:10,padding:".6rem .85rem",
                display:"flex",justifyContent:"space-between",alignItems:"center"
              }}>
                <div>
                  <div style={{fontSize:".7rem",fontWeight:700,color:q.primes?.sur12?"white":totalSur12>=6?C.brun:C.gris}}>
                    {q.primes?.sur12?"🎉 Prime 2 débloquée !":totalSur12>=6?"✓ Condition remplie":"○ Prime 2"}
                  </div>
                  <div style={{fontSize:".6rem",color:q.primes?.sur12?"rgba(255,255,255,.8)":C.gris,marginTop:".1rem"}}>
                    6 périodes sur 12 · {totalSur12}/6
                  </div>
                </div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:q.primes?.sur12?"white":totalSur12>=6?C.vert:C.gris}}>
                  {pq.prime}€
                </div>
              </div>

              {/* Total débloqué */}
              {(q.primes?.consecutif||q.primes?.sur12)&&(
                <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".55rem .85rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
                  <div style={{fontSize:".72rem",fontWeight:600,color:C.or}}>
                    💰 Total débloqué pour {pq.id}
                  </div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:700,color:C.or}}>
                    {((q.primes?.consecutif?1:0)+(q.primes?.sur12?1:0)) * pq.prime}€
                  </div>
                </div>
              )}
            </div>
          </div>
        );
      })}
    </div>
  );



}
function PrimesAccordeon({obj, save, onPrimeValidee}){
  const[open,setOpen]=useState(true);
  return(
    <div style={{marginBottom:".75rem"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:open?"12px 12px 0 0":12,padding:".75rem 1rem",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
          <span style={{fontSize:"1rem"}}>💎</span>
          <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>Primes de qualification</div>
        </div>
        <span style={{color:C.gris,fontSize:".8rem",transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
      </div>
      {open&&(
        <div style={{border:`1px solid ${C.pale}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
          <PrimesQualificationSection obj={obj} save={save} onPrimeValidee={onPrimeValidee}/>
        </div>
      )}
    </div>
  );
}

// ── CALCUL DU RESTE ──────────────────────────────────────────────────────────
function ResteCalculateur({obj, save, distributeurs=[]}){
  const[annuaire,setAnnuaire]=useState([]);
  // State local pour les saisies CA — indépendant de obj pour éviter les re-renders
  const[vals,setVals]=useState({});
  const[inited,setInited]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        if(snap.exists()){
          const m=snap.data().membres||{};
          setAnnuaire(Object.entries(m).map(([uid,d])=>({id:uid,prenom:d.prenom||"",nom:d.nom||"",ca:d.ca||""})).filter(d=>d.prenom||d.nom).sort((a,b)=>(a.prenom+a.nom).localeCompare(b.prenom+b.nom)));
        }
      }catch{}
    })();
  },[]);

  // Initialiser vals depuis obj.caDirecteurs une seule fois
  useEffect(()=>{
    if(!inited&&obj.caDirecteurs){
      setVals({...obj.caDirecteurs});
      setInited(true);
    }
  },[obj.caDirecteurs,inited]);

  const caEquipe=parseFloat(obj.ca)||0;
  const nbDir=parseInt(obj.nbDirecteurs)||0;
  const selectionnes=obj.dirSelectionnes||{};

  // Calcul depuis le state local vals
  const totalDir=Array.from({length:nbDir},(_,i)=>parseFloat(vals[i])||0).reduce((s,v)=>s+v,0);
  const reste=caEquipe-totalDir;

  const setNbDir=(n)=>{
    const nextCa={...vals};
    const nextSel={...selectionnes};
    for(let i=n;i<6;i++){delete nextCa[i];delete nextSel[i];}
    setVals(nextCa);
    save({...obj,nbDirecteurs:n,caDirecteurs:nextCa,dirSelectionnes:nextSel});
  };

  const setVal=(i,v)=>{
    const next={...vals,[i]:v};
    setVals(next);
    save({...obj,caDirecteurs:next});
  };

  const selDir=(i,uid)=>{
    const d=annuaire.find(x=>x.id===uid);
    const nextSel={...selectionnes,[i]:uid};
    // Ne pas écraser une valeur déjà saisie manuellement
    const nextCa={...vals};
    if(!vals[i]&&d?.ca) nextCa[i]=d.ca;
    setVals(nextCa);
    save({...obj,dirSelectionnes:nextSel,caDirecteurs:nextCa});
  };

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".6rem"}}><T k="obj.reste">📊 Calcul du Reste</T></div>

      {/* CA équipe */}
      <div style={{background:C.creme,borderRadius:9,padding:".5rem .75rem",marginBottom:".75rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
        <span style={{fontSize:".7rem",color:C.gris}}>💰 CA total équipe (mes objectifs)</span>
        <span style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:700,color:C.brun}}>{caEquipe}€</span>
      </div>

      {/* Nombre directeurs */}
      <div style={{marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".35rem",fontWeight:600}}><T k="obj.directeurs">Directeurs dans ma structure</T></div>
        <div style={{display:"flex",gap:".3rem"}}>
          {[0,1,2,3,4,5,6].map(n=>(
            <button key={n} onClick={()=>setNbDir(n)}
              style={{width:34,height:34,borderRadius:8,border:`2px solid ${nbDir===n?C.brun:C.pale}`,background:nbDir===n?C.brun:C.blanc,color:nbDir===n?C.blanc:C.gris,fontSize:".8rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
              {n}
            </button>
          ))}
        </div>
      </div>

      {/* Champs directeurs */}
      {nbDir>0&&(
        <div style={{marginBottom:".75rem"}}>
          {Array.from({length:nbDir},(_,i)=>{
            const selUid=selectionnes[i]||"";
            const selD=selUid?annuaire.find(x=>x.id===selUid):null;
            return(
              <div key={i} style={{background:C.creme,borderRadius:9,padding:".55rem .75rem",marginBottom:".4rem",border:`1px solid ${C.pale}`}}>
                <div style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".3rem"}}>
                  <div style={{width:22,height:22,borderRadius:"50%",background:C.brun,color:C.blanc,fontSize:".65rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>{i+1}</div>
                  <select value={selUid} onChange={e=>selDir(i,e.target.value)}
                    style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".32rem .5rem",fontSize:".75rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none"}}>
                    <option value="">— Choisir —</option>
                    {annuaire.map(d=>(
                      <option key={d.id} value={d.id}>{d.prenom} {d.nom}</option>
                    ))}
                  </select>
                </div>
                {selD&&<div style={{fontSize:".62rem",color:C.vert,marginBottom:".25rem",fontWeight:600}}>✓ {selD.prenom} {selD.nom}</div>}
                <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".65rem",color:C.gris,flexShrink:0}}>CA ce directeur :</span>
                  <input
                    type="number"
                    value={vals[i]||""}
                    onChange={e=>setVal(i,e.target.value)}
                    placeholder="0"
                    style={{flex:1,border:`1.5px solid ${C.rose}`,borderRadius:7,padding:".32rem .5rem",fontSize:".88rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:700}}
                  />
                  <span style={{fontSize:".65rem",color:C.gris}}>€</span>
                </div>
              </div>
            );
          })}

          {/* Total directeurs */}
          <div style={{background:C.creme,borderRadius:8,padding:".4rem .75rem",display:"flex",justifyContent:"space-between"}}>
            <span style={{fontSize:".7rem",color:C.gris}}>Total CA directeurs</span>
            <span style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:700,color:"#B04040"}}>− {totalDir}€</span>
          </div>
        </div>
      )}

      {/* Résultat */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".85rem 1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".35rem"}}>
          <div>
            <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".1rem"}}>✨ Reste qualifiant</div>
            <div style={{fontSize:".62rem",color:C.pale}}>{caEquipe} − {totalDir} =</div>
          </div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.6rem",fontWeight:700,color:reste<0?"#F4A460":C.or}}>{reste}€</div>
        </div>
        {nbDir>0&&(
          <div style={{background:"rgba(255,255,255,.1)",borderRadius:7,padding:".3rem .6rem",fontSize:".65rem",color:C.pale}}>
            {Array.from({length:nbDir},(_,i)=>{
              const selD=selectionnes[i]?annuaire.find(x=>x.id===selectionnes[i]):null;
              return<span key={i}>{i>0?" · ":""}{selD?selD.prenom:`Dir.${i+1}`} : {parseFloat(vals[i])||0}€</span>;
            })}
          </div>
        )}
      </div>
    </div>
  );
}


export function ObjPersoTab({obj,save,uid,userName,distributeurs=[]}){
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[fireworksTrigger,setFireworksTrigger]=useState(0);
  const[suiviCATotal,setSuiviCATotal]=useState(0);useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"users",uid));if(snap.exists()&&snap.data()["db-suivi-ca"]){const sc=JSON.parse(snap.data()["db-suivi-ca"]);const total=Object.values(sc).reduce((s,v)=>s+(parseFloat(v)||0),0);setSuiviCATotal(total);}}catch{}})();},[uid]);
  const[graphEnGros,setGraphEnGros]=useState(null);
  const raw=getPeriodeInfo();
  const pCourant=getPeriodeActuelle();

  // Score période précédente depuis l'historique
  const histPerso=obj.historique||[];
  const dernierHist=histPerso.length>0?histPerso[histPerso.length-1]:null;
  const scorePrecBadge=dernierHist?(
    <div style={{display:"flex",gap:".5rem",alignItems:"center",background:"rgba(196,154,138,.1)",border:`1px solid ${C.pale}`,borderRadius:8,padding:".3rem .65rem",marginBottom:".6rem",flexWrap:"wrap"}}>
      <span style={{fontSize:".58rem",color:C.gris}}>📊 Période précédente ({fmtPLabel(dernierHist.periode||pCourant-1)}) :</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.rose}}>💰 {dernierHist.ca||0}€</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.brun}}>🛍️ {dernierHist.caPerso||0}€ perso</span>
      <span style={{fontSize:".65rem",fontWeight:700,color:C.lilas}}>👥 {dernierHist.recruesReal||0} recrues</span>
    </div>
  ):null;

  const pctCA=()=>{if(!obj.caObj||!obj.ca)return 0;return Math.min(100,Math.round(+obj.ca/+obj.caObj*100));};
  const pctR=()=>{if(!obj.recruesObj||obj.recruesObj==="0"||!obj.recruesReal)return 0;return Math.min(100,Math.round(+obj.recruesReal/+obj.recruesObj*100));};
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};

  const checkAndCelebrate=(nextObj)=>{
    const wasNot100CA=pctCA()<100,wasNot100R=pctR()<100;
    const nextPctCA=(!nextObj.caObj||!nextObj.ca)?0:Math.min(100,Math.round(+nextObj.ca/+nextObj.caObj*100));
    const nextPctR=(!nextObj.recruesObj||nextObj.recruesObj==="0"||!nextObj.recruesReal)?0:Math.min(100,Math.round(+nextObj.recruesReal/+nextObj.recruesObj*100));
    if((wasNot100CA&&nextPctCA>=100)||(wasNot100R&&nextPctR>=100))setConfettiTrigger(t=>t+1);
    if(wasNot100CA&&nextPctCA>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif CA ! 💰","🎉");
    if(wasNot100R&&nextPctR>=100&&uid&&userName)postToWallOfFame(uid,userName,"a atteint son objectif recrutement ! 👥","🎉");
    save(nextObj);
  };

  const historique=obj.historique||[];
  const snapshotNow=()=>{
    const entry={date:todayLocalStr(),ca:+obj.ca||0,caObj:+obj.caObj||0,caPerso:+obj.caPerso||0,recruesReal:+obj.recruesReal||0,recruesObj:+obj.recruesObj||0,palier:obj.palier||"2%"};
    return [...historique,entry].slice(-24);
  };

  const resetPeriode=async()=>{
    const hist=snapshotNow();
    const next={...obj,ca:"",caObj:"",caPerso:"",caEquipe:"",recruesReal:"0",historique:hist};
    const totalCaCumul=(+obj.totalCaCumul||0)+(+obj.ca||0);
    const totalRecruesCumul=(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0);
    checkAndCelebrate({...next,totalCaCumul,totalRecruesCumul});
  };

  const enregistrerPoint=()=>{save({...obj,historique:snapshotNow()});};
  const comparaisonPeriode=(hist,valActuelle,key)=>{if(!hist||hist.length<1)return null;const last=hist[hist.length-1];const prev=last[key]||0;const curr=+valActuelle||0;const diff=curr-prev;const pct2=prev?Math.round(diff/prev*100):0;return{diff,previous:prev,pct:pct2};};

  const PALIERS_PERSO=["2%","4%","6%","8%","10%","12%","14%","17%","SR","Directeur","Structural","Business Director","SR Business Director","Business"];
  const currentPalierIdx=PALIERS_PERSO.indexOf(obj.palier||"2%");
  const nextPalier=currentPalierIdx<PALIERS_PERSO.length-1?PALIERS_PERSO[currentPalierIdx+1]:null;

  // Mini graphique inline
  const MiniGraph=({data,dataKey,color,label,onClick})=>{
    if(!data||data.length<2)return null;
    const vals=data.map(d=>+d[dataKey]||0);
    const max=Math.max(...vals,1);
    const w=120,h=50;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div onClick={onClick} style={{flex:1,minWidth:0,cursor:"pointer",padding:".4rem",background:C.blanc,borderRadius:9,border:`1px solid ${C.pale}`,transition:"transform .15s"}} title="Cliquer pour agrandir">
        <div style={{fontSize:".58rem",color:C.gris,marginBottom:".2rem",fontWeight:600}}>{label}</div>
        <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:50,display:"block"}}>
          <polyline points={pts} fill="none" stroke={color} strokeWidth={2} strokeLinecap="round" strokeLinejoin="round"/>
          <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.12} stroke="none"/>
        </svg>
        <div style={{fontSize:".55rem",color,fontWeight:700,textAlign:"right",marginTop:".1rem"}}>{vals[vals.length-1]}</div>
      </div>
    );
  };

  // Graphique en grand (popup)
  const GrandGraph=({data,dataKey,color,label,unit=""})=>{
    const vals=data.map(d=>+d[dataKey]||0);
    const dates=data.map(d=>d.date?.slice(5)||"");
    const max=Math.max(...vals,1);
    const w=280,h=120;
    const pts=vals.map((v,i)=>`${Math.round(i/(vals.length-1)*w)},${Math.round(h-(v/max*h*.85+h*.05))}`).join(" ");
    return(
      <div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.6)",display:"flex",alignItems:"center",justifyContent:"center",zIndex:9999}} onClick={()=>setGraphEnGros(null)}>
        <div style={{background:C.blanc,borderRadius:16,padding:"1.25rem",width:"90%",maxWidth:360}} onClick={e=>e.stopPropagation()}>
          <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun,marginBottom:".75rem"}}>{label}</div>
          <svg viewBox={`0 0 ${w} ${h}`} style={{width:"100%",height:140,display:"block",marginBottom:".5rem"}}>
            <polyline points={pts} fill="none" stroke={color} strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round"/>
            <polyline points={`0,${h} ${pts} ${w},${h}`} fill={color} fillOpacity={.1} stroke="none"/>
            {vals.map((v,i)=>(
              <g key={i}>
                <circle cx={Math.round(i/(vals.length-1)*w)} cy={Math.round(h-(v/max*h*.85+h*.05))} r={3} fill={color}/>
                <text x={Math.round(i/(vals.length-1)*w)} y={h-2} textAnchor="middle" fontSize="7" fill={C.gris}>{dates[i]}</text>
              </g>
            ))}
          </svg>
          {vals.map((v,i)=>(
            <div key={i} style={{display:"flex",justifyContent:"space-between",fontSize:".65rem",color:C.gris,padding:".2rem 0",borderBottom:`1px solid ${C.pale}`}}>
              <span>{dates[i]||`Point ${i+1}`}</span>
              <span style={{fontWeight:700,color}}>{v}{unit}</span>
            </div>
          ))}
          <button onClick={()=>setGraphEnGros(null)} style={{width:"100%",marginTop:".75rem",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Fermer</button>
        </div>
      </div>
    );
  };

  return(
    <div>
      <Confetti trigger={confettiTrigger}/>
      <Fireworks trigger={fireworksTrigger}/>
      {graphEnGros&&historique.length>=2&&<GrandGraph data={historique} dataKey={graphEnGros} color={graphEnGros==="recruesReal"?C.lilas:graphEnGros==="caPerso"?C.rose:C.brun} label={graphEnGros==="recruesReal"?"👥 Recrues":graphEnGros==="caPerso"?"🛍️ Ventes perso":"💰 CA total"} unit={graphEnGros==="recruesReal"?"":" €"}/>}

      {/* 1. PÉRIODE EN COURS */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem",color:C.blanc}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start"}}>
          <div>
            <div style={{fontSize:".55rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".15rem"}}>⏱️ Période en cours</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.blanc}}>{fmtPLabel(pCourant)}</div>
            <div style={{fontSize:".65rem",color:C.pale}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
          <div style={{textAlign:"right"}}>
            <div style={{height:4,width:80,background:"rgba(255,255,255,.15)",borderRadius:10,overflow:"hidden",marginBottom:".2rem"}}>
              <div style={{height:"100%",background:C.or,width:raw.pctElapsed+"%",borderRadius:10}}/>
            </div>
            <div style={{fontSize:".58rem",color:C.pale}}>{raw.pctElapsed}% écoulé</div>
          </div>
        </div>
      </div>

      {/* Bouton confirmer objectifs posés */}
      {obj.objectifsPosesPeriode!==pCourant&&(
        <button onClick={()=>save({...obj,objectifsPosesPeriode:pCourant})}
          style={{width:"100%",background:C.creme,border:`1.5px dashed ${C.or}`,borderRadius:10,padding:".5rem",fontSize:".75rem",fontWeight:600,color:"#856404",fontFamily:"inherit",cursor:"pointer",marginBottom:".75rem"}}>
          ✅ Mes objectifs sont posés pour cette période
        </button>
      )}

      {/* Score période précédente */}
      {scorePrecBadge}

      {/* 2. TOTAL DEPUIS LE DÉBUT */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:".75rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:700,color:C.brun}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)+(+suiviCATotal||0)}€</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",fontWeight:700,color:C.brun}}>{(+obj.totalCaCumul||0)+(+obj.ca||0)}€</div>
        <div style={{fontSize:".58rem",color:C.gris}}>{(+obj.totalRecruesCumul||0)+(+obj.recruesReal||0)} recrues total</div>
      </div>

      {/* 3. PALIER À ATTEINDRE */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>🎯 Palier à atteindre</div>
        <div style={{display:"flex",gap:".4rem",flexWrap:"wrap"}}>
          {PALIERS_PERSO.map((p,idx)=>(
            <button key={p} onClick={()=>save({...obj,palier:p})}
              style={{padding:".3rem .55rem",fontSize:".65rem",fontWeight:600,borderRadius:8,border:`1.5px solid ${obj.palier===p?C.or:C.pale}`,background:idx<currentPalierIdx?"#E8F5E9":obj.palier===p?C.or+"20":C.blanc,color:idx<currentPalierIdx?C.vert:obj.palier===p?C.brun:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {idx<currentPalierIdx?"✓ ":""}{p}
            </button>
          ))}
        </div>
        {nextPalier&&<div style={{fontSize:".65rem",color:C.gris,marginTop:".4rem"}}>Prochain palier → <strong style={{color:C.brun}}>{nextPalier}</strong></div>}
      </div>

      {/* 4. CHIFFRE D'AFFAIRES */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:".75rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>💰 Chiffre d'affaires</div>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.objectif">Objectif (€)</T></div>
            <input type="number" placeholder="Ex: 500" value={obj.caObj||""} onChange={e=>save({...obj,caObj:e.target.value})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem"}}><T k="obj.ca_total">CA total = ventes équipe (€)</T></div>
            <input type="number" placeholder="Ex: 250" value={obj.ca||""} onChange={e=>checkAndCelebrate({...obj,ca:e.target.value,caEquipe:String(Math.max(0,(parseFloat(e.target.value)||0)-(parseFloat(obj.caPerso)||0)))})}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".9rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
          </div>
        </div>
        <div style={{background:C.creme,borderRadius:9,padding:".45rem .7rem",marginBottom:".5rem",display:"flex",justifyContent:"space-between",alignItems:"center"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",width:"100%"}}><span style={{fontSize:".68rem",color:C.gris}}>🛍️ Dont mes ventes perso</span><span style={{fontSize:".62rem",color:C.gris}}>Objectif : <input type="number" placeholder="0" value={obj.caPersoObj||""} onChange={e=>save({...obj,caPersoObj:e.target.value})} style={{width:55,border:"1px solid "+C.rose+"40",borderRadius:6,padding:".2rem .35rem",fontSize:".72rem",fontFamily:"inherit",color:C.rose,background:"white",outline:"none",textAlign:"center"}}/> €</span></div>
          <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
            <span style={{fontSize:".62rem",color:C.gris,fontWeight:600,marginRight:".25rem"}}>Réalisé</span>
            <input type="number" placeholder="0" value={obj.caPerso||""} onChange={e=>{
              const perso=parseFloat(e.target.value)||0;
              save({...obj,caPerso:e.target.value,caEquipe:String(Math.max(0,(parseFloat(obj.ca)||0)-perso))});
            }} style={{width:70,border:`1px solid ${C.rose}40`,borderRadius:7,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600,textAlign:"right"}}/>
            <span style={{fontSize:".65rem",color:C.gris}}>€</span>
          </div>
        </div>
        <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden",marginBottom:".3rem"}}>
          <div style={{height:"100%",background:pctCA()>=100?C.vert:C.rose,width:pctCA()+"%",borderRadius:10,transition:"width .4s"}}/>
        </div>
        <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris}}>
          <span>CA équipe : {Math.max(0,(parseFloat(obj.ca)||0)-(parseFloat(obj.caPerso)||0))}€</span>
          <span style={{fontWeight:700,color:pctCA()>=100?C.vert:C.rose}}>{pctCA()}%</span>
        </div>
        {pctCA()>=100&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".4rem"}}>🎉 Objectif CA atteint !</div>}

        {/* Recrues */}
        {obj.recruesObj&&obj.recruesObj!=="0"&&(
          <div style={{marginTop:".75rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>👥 Recrues</div>
            <div style={{display:"flex",gap:".5rem"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Objectif</div>
                <input type="number" placeholder="0" value={obj.recruesObj||""} onChange={e=>save({...obj,recruesObj:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Réalisé</div>
                <input type="number" placeholder="0" value={obj.recruesReal||""} onChange={e=>checkAndCelebrate({...obj,recruesReal:e.target.value})}
                  style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".38rem .55rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:C.creme,outline:"none",fontWeight:600}}/>
              </div>
            </div>
            <div style={{height:6,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".4rem"}}>
              <div style={{height:"100%",background:pctR()>=100?C.vert:C.lilas,width:pctR()+"%",borderRadius:10}}/>
            </div>
          </div>
        )}
        {(!obj.recruesObj||obj.recruesObj==="0")&&(
          <button onClick={()=>save({...obj,recruesObj:"1"})} style={{marginTop:".5rem",background:"none",border:`1px dashed ${C.pale}`,borderRadius:8,padding:".35rem .65rem",fontSize:".68rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",width:"100%"}}>
            + Ajouter un objectif recrutement
          </button>
        )}
      </div>

      {/* 5. CALCUL DU RESTE */}
      <ResteCalculateur obj={obj} save={save} distributeurs={distributeurs}/>

      {/* 6. GRAPHIQUES CÔTE À CÔTE */}
      {historique.length>=2&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem",marginBottom:".75rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris}}>📈 Évolution</div>
            <button onClick={enregistrerPoint} style={{background:C.lilas,color:"white",border:"none",borderRadius:7,padding:".22rem .55rem",fontSize:".62rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>+ Point</button>
          </div>
          <div style={{display:"flex",gap:".5rem"}}>
            <MiniGraph data={historique} dataKey="ca" color={C.brun} label="💰 CA total" onClick={()=>setGraphEnGros("ca")}/>
            <MiniGraph data={historique} dataKey="caPerso" color={C.rose} label="🛍️ Ventes perso" onClick={()=>setGraphEnGros("caPerso")}/>
            <MiniGraph data={historique} dataKey="recruesReal" color={C.lilas} label="👥 Recrues" onClick={()=>setGraphEnGros("recruesReal")}/>
          </div>
          <div style={{fontSize:".58rem",color:C.pale,textAlign:"center",marginTop:".4rem"}}>Clique sur un graphique pour l'agrandir</div>
        </div>
      )}

      {/* 7. PRIMES DE QUALIFICATION */}
      <PrimesAccordeon obj={obj} save={save} onPrimeValidee={()=>setFireworksTrigger(t=>t+1)}/>
    </div>
  );
}

// ── GESTION MEMBRES (Melissa uniquement) ─────────────────────────────────────
export function MembresTab({uid}){
  const isMelissa=uid==="melissa"||uid==="melissa-da-silveira";
  const[membres,setMembres]=useState([]);
  const[chefs,setChefs]=useState([]);
  const[newMembre,setNewMembre]=useState({prenom:"",nom:""});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);
  const[search,setSearch]=useState("");
  const[annuaire,setAnnuaire]=useState({});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        if(snap.exists()){
          const data=snap.data();
          setMembres(Array.isArray(data.liste)?data.liste:Object.values(data.liste||{}));
          setChefs(Array.isArray(data.chefs)?data.chefs:Object.values(data.chefs||{}));
        }
        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(annSnap.exists()?annSnap.data().membres||{}:{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  // Assigne/modifie la marraine d'un membre directement depuis l'admin
  const assignerMarraine=async(membreFullName, marraineFullName)=>{
    const membreUid = membreFullName.toLowerCase().replace(/\s+/g,"-");
    const marraineUid = marraineFullName ? marraineFullName.toLowerCase().replace(/\s+/g,"-") : "";
    try{
      const ref=doc(db,"equipe","annuaire");
      const existing = annuaire[membreUid] || {uid:membreUid, prenom:"", nom:"", dateEnreg:todayLocalStr()};
      const updated = {...existing, marraine:marraineUid||null};
      const nextAnnuaire = {...annuaire, [membreUid]:updated};
      setAnnuaire(nextAnnuaire);
      await setDoc(ref, {membres:{[membreUid]:updated}}, {merge:true});
      if(marraineUid) await setDoc(doc(db,"users",membreUid),{marraine:marraineUid},{merge:true});
    }catch{}
  };

  const saveAll=async(liste,chefsList)=>{
    setSaving(true);
    try{await setDoc(doc(db,"acces","membres"),{liste,chefs:chefsList},{merge:true});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!newMembre.prenom.trim()||!newMembre.nom.trim())return;
    const full=`${newMembre.prenom.trim().toLowerCase()} ${newMembre.nom.trim().toLowerCase()}`;
    const listeActuelle=Array.isArray(membres)?membres:[];
    if(listeActuelle.includes(full))return;
    const next=[...listeActuelle,full];
    setMembres(next);
    await saveAll(next,Array.isArray(chefs)?chefs:[]);
    setNewMembre({prenom:"",nom:""});
  };

  const remove=async(m)=>{
    if(!window.confirm(`Supprimer l'accès de ${fmt(m)} ? Cette personne ne pourra plus se connecter.`))return;
    const nextM=membres.filter(x=>x!==m);
    const nextC=chefs.filter(x=>x!==m);
    setMembres(nextM);setChefs(nextC);
    await saveAll(nextM,nextC);
    // Bloquer aussi dans Firebase users
    try{
      const mUid=m.toLowerCase().replace(/\s+/g,"-");
      await setDoc(doc(db,"users",mUid),{accesBloqueAdmin:true},{merge:true});
    }catch{}
    try{const snapMe=await getDoc(doc(db,"users",uid));if(snapMe.exists()&&snapMe.data()["db-distributeurs"]){const distList=JSON.parse(snapMe.data()["db-distributeurs"]);const mNom=m.toLowerCase().trim();const nextD=distList.filter(d=>((d.prenom||"")+" "+(d.nom||"")).toLowerCase().trim()!==mNom);if(nextD.length!==distList.length)await setDoc(doc(db,"users",uid),{"db-distributeurs":JSON.stringify(nextD)},{merge:true});}}catch{}
  };
  const [pauses,setPauses]=useState({});
  const togglePause=async(m)=>{
    const mUid=m.toLowerCase().replace(/\s+/g,"-");
    const estPause=pauses[mUid]||false;
    const next={...pauses,[mUid]:!estPause};
    setPauses(next);
    try{
      await setDoc(doc(db,"users",mUid),{accesPause:!estPause},{merge:true});
      await setDoc(doc(db,"acces","pauses"),{[mUid]:!estPause},{merge:true});
    }catch{}
  };

  // Charger les pauses
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","pauses"));
        if(snap.exists())setPauses(snap.data());
      }catch{}
    })();
  },[]);

  const toggleChef=async(m)=>{
    const isChef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(m);
    const nextC=isChef?chefs.filter(x=>x!==m):[...chefs,m];
    setChefs(nextC);
    await saveAll(membres,nextC);
  };

  const fmt=(m)=>m.split(" ").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Accès <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Gère les membres et les chefs d'équipe. Code d'accès : <strong style={{color:C.brun}}>BD-2025-FIRE</strong>
      </p>

      {/* Ajouter */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>➕ Ajouter un membre</div>
        <div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}>
          <input placeholder="Prénom" value={newMembre.prenom} onChange={e=>setNewMembre(p=>({...p,prenom:e.target.value}))}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <input placeholder="Nom" value={newMembre.nom} onChange={e=>setNewMembre(p=>({...p,nom:e.target.value}))}
            onKeyDown={e=>e.key==="Enter"&&add()}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
        <button onClick={add} disabled={saving||!newMembre.prenom.trim()||!newMembre.nom.trim()}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":"Ajouter"}
        </button>
      </div>

      {/* Barre de recherche */}
      <input placeholder="🔍 Rechercher un membre..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>

      {/* Liste */}
      <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>
        {membres.length} membre{membres.length>1?"s":""} · {chefs.length} chef{chefs.length>1?"s":""} d'équipe
      </div>
      {membres.filter(m=>!search||m.toLowerCase().includes(search.toLowerCase())).map(m=>{
        const isChef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(m);
        const mUid = m.toLowerCase().replace(/\s+/g,"-");
        const currentMarraine = annuaire[mUid]?.marraine || "";
        const currentMarraineLabel = currentMarraine ? fmt(currentMarraine) : "";
        return(
          <div key={m} style={{background:C.blanc,border:`1px solid ${isChef?C.or:C.pale}`,borderRadius:10,padding:".65rem 1rem",marginBottom:".4rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:isChef?C.or+"30":C.rose+"20",color:isChef?C.brun2:C.rose,fontSize:".8rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {isChef?"👑":fmt(m)[0]}
              </div>
              <div>
                <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{fmt(m)}</div>
                {isChef&&<div style={{fontSize:".6rem",color:C.or,fontWeight:700}}>Chef d'équipe</div>}
              </div>
            </div>
            <div style={{display:"flex",gap:".4rem"}}>
              <button onClick={()=>toggleChef(m)}
                style={{background:isChef?C.or+"20":"none",border:`1px solid ${isChef?C.or:C.pale}`,borderRadius:6,padding:".2rem .55rem",color:isChef?C.brun2:C.gris,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit",fontWeight:isChef?700:400}}>
                {isChef?"👑 Chef":"→ Chef"}
              </button>
              <button onClick={()=>togglePause(m)}
                style={{background:pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#FFF3CD":"none",border:`1px solid ${pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#E6A817":C.pale}`,borderRadius:6,padding:".2rem .55rem",color:pauses[m.toLowerCase().replace(/\s+/g,"-")]?"#856404":C.gris,cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>
                {pauses[m.toLowerCase().replace(/\s+/g,"-")]?"⏸️ En pause":"⏸️"}
              </button>
              <button onClick={()=>remove(m)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".2rem .55rem",color:"#B04040",cursor:"pointer",fontSize:".7rem",fontFamily:"inherit"}}>
                ✕
              </button>
            </div>
          </div>
          {/* Marraine */}
          <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.creme}`,display:"flex",alignItems:"center",gap:".5rem"}}>
            <span style={{fontSize:".64rem",color:C.gris,flexShrink:0}}>🌸 Marraine :</span>
            <div style={{flex:1}}>
              <SearchSelect
                value={currentMarraineLabel ? currentMarraineLabel.toLowerCase() : ""}
                onChange={(val)=>assignerMarraine(m, val)}
                options={["melissa da silveira", ...membres.filter(x=>x.toLowerCase()!==m.toLowerCase())]}
                placeholder="🔍 Aucune — tape pour assigner" compact/>
            </div>
            {currentMarraine&&(
              <button onClick={()=>assignerMarraine(m,"")}
                style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",textDecoration:"underline",flexShrink:0}}>
                retirer
              </button>
            )}
          </div>
        </div>
        );
      })}
      {membres.length===0&&(
        <div style={{textAlign:"center",padding:"1.5rem",color:C.gris,fontSize:".76rem"}}>Aucun membre ajouté.</div>
      )}
      <div style={{background:"rgba(196,74,26,.08)",border:"1px solid rgba(196,74,26,.2)",borderRadius:10,padding:".7rem 1rem",marginTop:"1rem",fontSize:".73rem",color:C.brun,lineHeight:1.6}}>
        💡 Clique sur <strong>"→ Chef"</strong> pour promouvoir une fille chef d'équipe. Elle pourra voir les objectifs des filles qui l'ont choisie à leur inscription.
      </div>
    </div>
  );
}

// ── MON ÉQUIPE (chefs d'équipe) ───────────────────────────────────────────────
// Carte stats d'un membre (réutilisée dans MonEquipeTab et le navigateur d'équipe)
export function MembreStatsCard({m, expanded, onToggleExpand}){
  const pct=(r,o)=>{if(!o||!r)return 0;return Math.min(100,Math.round(+r/+o*100));};
  const hist = m.historique || [];
  const compCA = comparaisonPeriode(hist, m.ca, "ca");
  const compR = comparaisonPeriode(hist, m.recruesReal, "recruesReal");
  const[extra,setExtra]=useState(null);
  const[loadingExtra,setLoadingExtra]=useState(false);
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  // Charge les données complètes depuis Firebase quand on ouvre la fiche
  useEffect(()=>{
    if(!expanded||!m.uid)return;
    setLoadingExtra(true);
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"users",m.uid));
        let liensReseaux=[];
        try{
          const linkSnap=await getDoc(doc(db,"linkbio",m.uid));
          if(linkSnap.exists()){
            const lb=linkSnap.data();
            const labels=lb.liensBonusLabel||[];
            const urls=lb.liensBonusUrl||[];
            liensReseaux=labels.map((lbl,i)=>({label:lbl,url:urls[i]})).filter(l=>l.label&&l.url);
          }
        }catch{}
        if(snap.exists()){
          const d=snap.data();
          setExtra({
            streak:+d["db-streak"]||0,
            lastLogin:d["db-last-login"]||null,
            actions:d["db-actions"]?JSON.parse(d["db-actions"]):{},
            totalCA:+d["db-actions-cumul"]||0,
            recrues:d["recrues"]?JSON.parse(d["recrues"]):[],
            badges:d["db-badges-unlocked"]?JSON.parse(d["db-badges-unlocked"]):[],
            notes:d["db-distributeurs-notes"]||"",
            fastStart:d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null,
            liensReseaux,
          });
        }
      }catch{}
      setLoadingExtra(false);
    })();
  },[expanded,m.uid]);

  const today=todayLocalStr();
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);

  return(
    <div>
      {/* ── RÉSUMÉ RAPIDE ── */}
      {[
        {label:"💰 CA",val:m.ca,goal:m.caObj,unit:"€",color:C.rose},
        {label:"👥 Recrues",val:m.recruesReal,goal:m.recruesObj,unit:"",color:C.lilas},
      ].map(({label,val,goal,unit,color})=>(
        <div key={label} style={{marginBottom:".5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",fontSize:".72rem",color:C.texte,marginBottom:".2rem"}}>
            <span style={{fontWeight:600}}>{label}</span>
            <span style={{color:pct(val,goal)>=100?C.vert:color,fontWeight:700}}>{val||"—"}{unit} / {goal||"—"}{unit} · {pct(val,goal)}%</span>
          </div>
          <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
            <div style={{height:"100%",background:pct(val,goal)>=100?C.vert:color,width:pct(val,goal)+"%",borderRadius:10,transition:"width .4s"}}/>
          </div>
        </div>
      ))}
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginTop:".35rem",fontSize:".7rem",color:C.gris}}>
        <span>Palier visé</span>
        <span style={{fontWeight:700,color:C.or}}>{m.palier||"2%"}</span>
      </div>

      {(compCA||compR)&&(
        <div style={{display:"flex",gap:".6rem",marginTop:".5rem",flexWrap:"wrap"}}>
          {compCA&&<span style={{fontSize:".64rem",color:compCA.diff>=0?C.vert:"#B04040"}}>{compCA.diff>=0?"📈":"📉"} CA {compCA.diff>=0?"+":""}{compCA.diff}€ vs avant</span>}
          {compR&&<span style={{fontSize:".64rem",color:compR.diff>=0?C.vert:"#B04040"}}>{compR.diff>=0?"📈":"📉"} Recrues {compR.diff>=0?"+":""}{compR.diff} vs avant</span>}
        </div>
      )}

      <button onClick={onToggleExpand}
        style={{width:"100%",background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".3rem",fontSize:".66rem",color:C.gris,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
        {expanded?"▲ Masquer la fiche complète":"▼ Voir la fiche complète"}
      </button>

      {/* ── FICHE COMPLÈTE ── */}
      {expanded&&(
        <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
          {loadingExtra&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".5rem"}}>Chargement...</div>}

          {extra&&(
            <div>
              {/* Connexion & Streak */}
              <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:".75rem"}}>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>🔥 Streak</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:extra.streak>=5?C.or:C.brun}}>{extra.streak}j</div>
                </div>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>📅 Connexion</div>
                  <div style={{fontSize:".62rem",fontWeight:700,color:extra.lastLogin===today?C.vert:extra.lastLogin===yesterday?C.or:"#C0504D"}}>
                    {extra.lastLogin===today?"Aujourd'hui":extra.lastLogin===yesterday?"Hier":extra.lastLogin?new Date(extra.lastLogin).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"Jamais"}
                  </div>
                </div>
                <div style={{background:C.creme,borderRadius:9,padding:".5rem",textAlign:"center"}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".15rem"}}>⚡ Actions/j</div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:700,color:C.brun}}>
                    {Object.values(extra.actions).filter(Boolean).length}/5
                  </div>
                </div>
              </div>

              {/* Barre actions du jour */}
              <div style={{marginBottom:".75rem"}}>
                <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Actions du jour</div>
                <div style={{display:"flex",gap:"3px"}}>
                  {Array.from({length:5}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:6,borderRadius:3,background:i<Object.values(extra.actions).filter(Boolean).length?C.rose:C.pale}}/>
                  ))}
                </div>
              </div>

              {/* Objectifs détaillés */}
              <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".75rem",marginBottom:".75rem"}}>
                <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.or,marginBottom:".5rem"}}>🎯 Objectifs période</div>
                {[
                  {label:"💰 CA",val:m.ca,goal:m.caObj,unit:"€",color:C.rose},
                  {label:"👥 Recrues",val:m.recruesReal,goal:m.recruesObj,unit:"",color:C.lilas},
                ].map(({label,val,goal,unit,color})=>{
                  const p=pct(val,goal);
                  return(
                    <div key={label} style={{marginBottom:".5rem"}}>
                      <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.pale,marginBottom:".2rem"}}>
                        <span>{label}</span>
                        <span style={{fontWeight:700,color:p>=100?C.vert:color}}>{val||0}{unit} / {goal||"—"}{unit} · {p}%</span>
                      </div>
                      <div style={{height:5,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden"}}>
                        <div style={{height:"100%",background:p>=100?C.vert:color,width:p+"%",borderRadius:10}}/>
                      </div>
                    </div>
                  );
                })}
                <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",color:C.pale,marginTop:".3rem"}}>
                  <span>Palier visé</span>
                  <span style={{fontWeight:700,color:C.or}}>{m.palier||"2%"}</span>
                </div>
              </div>

              {/* Recrues en suivi */}
              {extra.recrues.length>0&&(
                <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".75rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.lilas,marginBottom:".4rem"}}>
                    📋 Recrues en suivi ({extra.recrues.length})
                  </div>
                  {extra.recrues.map(r=>{
                    const{pct:p}=getProgress(r);
                    return(
                      <div key={r.id} style={{display:"flex",justifyContent:"space-between",alignItems:"center",padding:".3rem 0",borderBottom:`1px solid ${C.pale}`,fontSize:".7rem"}}>
                        <span style={{color:C.brun,fontWeight:600}}>{r.name}</span>
                        <span style={{color:p>=100?C.vert:C.rose,fontWeight:700}}>{p}%</span>
                      </div>
                    );
                  })}
                </div>
              )}

              {/* Fast Start — interface identique à la formation */}
              {extra.fastStart&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".6rem"}}>
                    <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>🚀 Suivi Fast Start</div>
                    <div style={{fontSize:".62rem",color:C.gris}}>
                      J1 : {extra.fastStart.startDate?new Date(extra.fastStart.startDate).toLocaleDateString("fr-FR",{day:"numeric",month:"short"}):"—"}
                    </div>
                  </div>

                  {/* Progression globale */}
                  {(()=>{
                    const totalTaches=FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.length,0);
                    const done=FAST_START_DAYS.reduce((s,d2)=>s+d2.taches.filter((_,i)=>extra.fastStart.doneTasks?.[`${d2.jour}-${i}`]).length,0);
                    const modulesValides=Object.values(extra.fastStart.modulesValides||{}).filter(Boolean).length;
                    const p=Math.round(done/totalTaches*100);
                    return(
                      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:10,padding:".6rem .85rem",marginBottom:".6rem"}}>
                        <div style={{display:"flex",justifyContent:"space-between",marginBottom:".3rem"}}>
                          <span style={{fontSize:".65rem",color:C.or,fontWeight:700}}>Progression globale</span>
                          <span style={{fontSize:".65rem",color:C.pale}}>{modulesValides}/7 modules validés</span>
                        </div>
                        <div style={{height:6,background:"rgba(255,255,255,.2)",borderRadius:10,overflow:"hidden",marginBottom:".2rem"}}>
                          <div style={{height:"100%",background:p>=100?C.vert:C.or,width:p+"%",borderRadius:10,transition:"width .5s"}}/>
                        </div>
                        <div style={{fontSize:".6rem",color:C.pale}}>{done}/{totalTaches} tâches · {p}%</div>
                      </div>
                    );
                  })()}

                  {/* Modules détaillés — même interface que FastStartTab */}
                  {FAST_START_DAYS.map(d2=>{
                    const moduleValide=extra.fastStart.modulesValides?.[d2.jour];
                    const prevValide=d2.jour===1?true:!!extra.fastStart.modulesValides?.[d2.jour-1];
                    const isLocked=!prevValide&&!moduleValide;
                    const tachesDone=d2.taches.filter((_,i)=>extra.fastStart.doneTasks?.[`${d2.jour}-${i}`]).length;
                    const total=d2.taches.length;
                    const dayDone=tachesDone===total;
                    return(
                      <div key={d2.jour} style={{background:moduleValide?C.vert+"08":C.blanc,border:`1.5px solid ${moduleValide?C.vert:dayDone?C.vert+"60":isLocked?C.pale:C.rose}`,borderRadius:12,padding:".75rem .9rem",marginBottom:".5rem",opacity:isLocked?.5:1}}>
                        <div style={{display:"flex",alignItems:"center",gap:".6rem",marginBottom:dayDone?".4rem":0}}>
                          <div style={{width:28,height:28,borderRadius:"50%",background:moduleValide?C.vert:isLocked?C.pale:C.rose,color:"white",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0}}>
                            {moduleValide?"✓":isLocked?"🔒":d2.jour}
                          </div>
                          <div style={{flex:1}}>
                            <div style={{fontSize:".75rem",fontWeight:700,color:moduleValide?C.vert:isLocked?C.gris:C.brun}}>{d2.titre}</div>
                            <div style={{height:3,background:C.pale,borderRadius:10,overflow:"hidden",marginTop:".25rem"}}>
                              <div style={{height:"100%",background:moduleValide?C.vert:C.rose,width:(tachesDone/total*100)+"%",borderRadius:10}}/>
                            </div>
                          </div>
                          <div style={{fontSize:".65rem",fontWeight:700,color:moduleValide?C.vert:C.gris,flexShrink:0}}>
                            {moduleValide?"✅ Validé":isLocked?"Verrouillé":`${tachesDone}/${total}`}
                          </div>
                        </div>

                        {/* Tâches détaillées */}
                        {!isLocked&&(
                          <div style={{paddingLeft:".5rem"}}>
                            {d2.taches.map((tache,i)=>{
                              const done2=!!extra.fastStart.doneTasks?.[`${d2.jour}-${i}`];
                              const txt=typeof tache==="string"?tache:tache.t;
                              return(
                                <div key={i} style={{display:"flex",alignItems:"flex-start",gap:".45rem",padding:".25rem 0",borderBottom:i<d2.taches.length-1?`1px solid ${C.pale}30`:"none"}}>
                                  <div style={{width:16,height:16,borderRadius:4,border:`2px solid ${done2?C.vert:C.pale}`,background:done2?C.vert:"transparent",display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,marginTop:".1rem"}}>
                                    {done2&&<span style={{color:"white",fontSize:".55rem",fontWeight:700}}>✓</span>}
                                  </div>
                                  <span style={{fontSize:".7rem",color:done2?C.vert:C.texte,textDecoration:done2?"line-through":"none",lineHeight:1.5}}>{txt}</span>
                                </div>
                              );
                            })}
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}

              {!extra.fastStart&&(
                <div style={{background:C.creme,borderRadius:9,padding:".65rem",marginBottom:".75rem",textAlign:"center"}}>
                  <div style={{fontSize:".72rem",color:C.gris,marginBottom:".4rem"}}>🚀 Pas encore de Fast Start assigné</div>
                </div>
              )}

              {/* Liens réseaux sociaux — toujours visible */}
              <LiensReseauxSection memberUid={m.uid}/>

              {/* Badges */}
              {extra.badges.length>0&&(
                <div style={{marginBottom:".75rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem"}}>🏅 Badges débloqués</div>
                  <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
                    {BADGES_DEF.filter(b=>extra.badges.includes(b.id)).map(b=>(
                      <div key={b.id} title={b.desc} style={{background:C.or+"20",border:`1px solid ${C.or}40`,borderRadius:8,padding:".3rem .5rem",fontSize:".65rem",color:C.brun,fontWeight:600}}>
                        {b.icon} {b.label}
                      </div>
                    ))}
                  </div>
                </div>
              )}

              {/* Courbes historique */}
              {hist.length>=2&&(
                <>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".3rem"}}>📈 CA</div>
                  <MiniChart data={hist} dataKey="ca" objKey="caObj" color={C.rose} unit="€"/>
                  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".08em",textTransform:"uppercase",color:C.gris,marginBottom:".3rem",marginTop:".6rem"}}>📈 Recrues</div>
                  <MiniChart data={hist} dataKey="recruesReal" objKey="recruesObj" color={C.lilas}/>
                </>
              )}
              {hist.length<2&&<div style={{fontSize:".68rem",color:C.gris,textAlign:"center"}}>Pas encore d'historique pour cette personne.</div>}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

// Onglet "Assiduité équipe" — visible chefs/Melissa : connexions + actions du jour de chaque membre
const TODAY_ACTIONS_COUNT = 5;

export function AssiduiteTab({uid}){
  const[loading,setLoading]=useState(true);
  const[isAuthorized,setIsAuthorized]=useState(false);
  const[membres,setMembres]=useState([]);
  const[search,setSearch]=useState("");

  const fmtUid=(u)=>u.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    (async()=>{
      try{
        const isMelissa = uid==="melissa"||uid==="melissa-da-silveira";
        const accesSnap=await getDoc(doc(db,"acces","membres"));
        const chefs=accesSnap.exists()?accesSnap.data().chefs||[]:[];
        const isChef = isMelissa || (Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," "));
        if(!isChef){ setIsAuthorized(false); setLoading(false); return; }
        setIsAuthorized(true);

        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire = annSnap.exists()?annSnap.data().membres||{}:{};

        // Détermine la liste des uids à afficher : toute l'équipe (Melissa) ou la descendance (chef)
        let targetUids;
        if(isMelissa){
          targetUids = Object.keys(annuaire);
        } else {
          const visited=new Set();
          const queue=[uid];
          while(queue.length){
            const current=queue.pop();
            Object.values(annuaire).forEach(m=>{
              if(m.marraine===current && !visited.has(m.uid)){
                visited.add(m.uid);
                queue.push(m.uid);
              }
            });
          }
          targetUids = [...visited];
        }

        // Charge les données d'assiduité de chaque membre
        const periodeNum = getPeriodeActuelle();
        const periodeKey = `p${periodeNum}`;
        const debutPeriode = getPeriodeDebut(periodeNum);
        const joursDansLaPeriode = Math.min(
          Math.floor((Date.now()-debutPeriode.getTime())/(1000*60*60*24))+1, 21
        );

        const results = await Promise.all(targetUids.map(async(mUid)=>{
          try{
            const snap=await getDoc(doc(db,"users",mUid));
            if(!snap.exists())return {uid:mUid, noData:true};
            const data=snap.data();
            const actionsRaw = data["db-actions"] ? JSON.parse(data["db-actions"]) : {};
            const todayStr = todayLocalStr();
            const isToday = actionsRaw._date === todayStr;
            const {_date, ...actionsSeules} = actionsRaw;
            const doneToday = isToday ? Object.values(actionsSeules).filter(Boolean).length : 0;
            const assiduite = data["db-assiduite"] ? JSON.parse(data["db-assiduite"]) : {};
            const joursActifs = assiduite[periodeKey]?.jours?.length || 0;
            return {
              uid:mUid,
              lastLogin: data["db-last-login"]||null,
              streak: +data["db-streak"]||0,
              doneToday,
              joursActifs,
              joursDansLaPeriode,
              periodeNum,
              noData:false,
            };
          }catch{ return {uid:mUid, noData:true}; }
        }));

        // Tri : streak décroissant, puis nom
        results.sort((a,b)=> (b.streak||0)-(a.streak||0) || a.uid.localeCompare(b.uid));
        setMembres(results);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!isAuthorized)return(
    <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Accès chef d'équipe</div>
      <div style={{fontSize:".75rem",lineHeight:1.6}}>Cet espace est réservé aux chefs d'équipe.<br/>Melissa peut te promouvoir depuis son espace.</div>
    </div>
  );

  const today=todayLocalStr();
  const yesterday=new Date(Date.now()-86400000).toISOString().slice(0,10);

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Assiduité <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Connexions, actions du jour et score de la période P{membres[0]?.periodeNum||""} · {membres.length} membre{membres.length>1?"s":""}.
      </p>

      <input placeholder="🔍 Rechercher un membre..." value={search} onChange={e=>setSearch(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>

      {membres.filter(m=>!search||fmtUid(m.uid).toLowerCase().includes(search.toLowerCase())).length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>{membres.length===0?"Aucune donnée d'équipe pour l'instant.":"Aucun membre ne correspond à la recherche."}</div>
      )}

      {membres.filter(m=>!search||fmtUid(m.uid).toLowerCase().includes(search.toLowerCase())).map(m=>{
        const connectedToday = m.lastLogin===today;
        const connectedYesterday = m.lastLogin===yesterday;
        let statusColor, statusLabel;
        if(m.noData||!m.lastLogin){ statusColor=C.gris; statusLabel="Jamais connectée"; }
        else if(connectedToday){ statusColor=C.vert; statusLabel="Connectée aujourd'hui"; }
        else if(connectedYesterday){ statusColor=C.or; statusLabel="Connectée hier"; }
        else { statusColor="#C0504D"; statusLabel=`Dernière connexion : ${new Date(m.lastLogin).toLocaleDateString("fr-FR")}`; }

        const doneToday = m.noData ? 0 : Math.min(m.doneToday, TODAY_ACTIONS_COUNT);
        const joursActifs = m.joursActifs||0;
        const joursDispo = m.joursDansLaPeriode||1;
        const scorePct = Math.round(joursActifs/joursDispo*100);

        return(
          <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:statusColor+"20",color:statusColor,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0,position:"relative"}}>
                {fmtUid(m.uid)[0]}
                <div style={{position:"absolute",bottom:-2,right:-2,width:10,height:10,borderRadius:"50%",background:statusColor,border:`2px solid ${C.blanc}`}}/>
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{fmtUid(m.uid)}</div>
                <div style={{fontSize:".62rem",color:statusColor}}>{statusLabel}</div>
              </div>
              {!m.noData&&(
                <div style={{textAlign:"right",flexShrink:0}}>
                  {m.streak>=2&&<div style={{fontSize:".68rem",fontWeight:700,color:C.or}}>🔥 {m.streak}j</div>}
                  <div style={{fontSize:".64rem",color:C.gris}}>Aujourd'hui : {doneToday}/{TODAY_ACTIONS_COUNT}</div>
                  {/* Score période */}
                  <div style={{fontSize:".68rem",fontWeight:700,color:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",marginTop:".1rem"}}>
                    📈 {joursActifs}/{joursDispo}j
                  </div>
                </div>
              )}
            </div>

            {!m.noData&&(
              <div style={{marginTop:".5rem"}}>
                <div style={{display:"flex",gap:"3px",marginBottom:".35rem"}}>
                  {Array.from({length:TODAY_ACTIONS_COUNT}).map((_,i)=>(
                    <div key={i} style={{flex:1,height:5,borderRadius:3,background:i<doneToday?C.rose:C.pale}}/>
                  ))}
                </div>
                <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".58rem",color:C.gris,flexShrink:0}}>P{m.periodeNum} :</span>
                  <div style={{flex:1,height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",width:scorePct+"%",borderRadius:10}}/>
                  </div>
                  <span style={{fontSize:".6rem",fontWeight:700,color:scorePct>=80?C.vert:scorePct>=50?C.or:"#C0504D",flexShrink:0}}>{joursActifs}/{joursDispo}j</span>
                </div>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


// Onglet "Espace Chef" — regroupe toutes les fonctions chef d'équipe au même endroit
export const ESPACE_CHEF_SECTIONS=[
  {id:"stats",icon:"📊",label:"Statistiques équipe",desc:"Taux d'utilisation, conversion, diagnostics — chiffres pour recruter",chefOnly:true},
  {id:"challengeapp",icon:"🎮",label:"Challenge Découverte App",desc:"Progression de chaque membre dans le défi 7 jours",chefOnly:true},
  {id:"membres",icon:"⚙️",label:"Accès équipe",desc:"Gérer les membres, chefs, et assigner les marraines",chefOnly:true},
  {id:"assiduite",icon:"📋",label:"Assiduité équipe",desc:"Connexions et actions du jour de chaque membre",chefOnly:true},
  {id:"suivica",icon:"📈",label:"Suivi CA",desc:"Ton chiffre d'affaires période par période avec historique",chefOnly:false},
  {id:"actionsbiblio",icon:"💡",label:"Actions biblio",desc:"Ajouter des actions à la bibliothèque partagée de toute l'équipe",chefOnly:false},
  {id:"defi",icon:"🚀",label:"Challenge Flash",desc:"Lancer un défi collectif pour toute l'équipe",chefOnly:true},
  {id:"powerhour",icon:"⏱️",label:"Power Hour",desc:"Sprint collectif synchrone de 20 minutes",chefOnly:true},
  {id:"distributeurs",icon:"👑",label:"Distributeurs",desc:"Voir et naviguer dans l'arborescence de ton équipe",chefOnly:false},
  {id:"nouveaux",icon:"📋",label:"Nouveaux Distri",desc:"Suivi onboarding des filleules récentes",chefOnly:false},
  {id:"admin",icon:"🔧",label:"Administration",desc:"Gérer les contenus, citations, scripts, annonces et produits",melissaOnly:true},
];

// ── MESSAGERIE ÉQUIPE ────────────────────────────────────────────────────────
// Popup pour envoyer un message perso ou groupé à son équipe
export function MessageEquipePopup({uid, userName, annuaire, onClose}){
  const[mode,setMode]=useState("choix"); // choix | perso | groupe
  const[destinataire,setDestinataire]=useState(null);
  const[texte,setTexte]=useState("");
  const[sending,setSending]=useState(false);
  const[sent,setSent]=useState(false);

  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  // Récupère tous les descendants directs
  const getDescendants=(rootUid)=>{
    const result=new Set();
    const queue=[rootUid];
    while(queue.length){
      const current=queue.pop();
      Object.values(annuaire).forEach(m=>{
        if(m.marraine===current&&!result.has(m.uid)){
          result.add(m.uid);
          queue.push(m.uid);
        }
      });
    }
    return [...result];
  };

  const equipe=getDescendants(uid);
  const directes=Object.values(annuaire).filter(m=>m.marraine===uid);

  const envoyerMsg=async(destinataires)=>{
    if(!texte.trim()||destinataires.length===0)return;
    setSending(true);
    const msg={
      id:`msg${Date.now()}`,
      de:uid,
      deNom:userName,
      texte:texte.trim(),
      ts:Date.now(),
      lu:false,
    };
    try{
      await Promise.all(destinataires.map(async(destUid)=>{
        const ref=doc(db,"messages",destUid);
        const snap=await getDoc(ref);
        const existing=snap.exists()?snap.data().msgs||[]:[];
        await setDoc(ref,{msgs:[msg,...existing].slice(0,100)},{merge:false});
      }));
      setSent(true);
      setTexte("");
      setTimeout(()=>{setSent(false);setMode("choix");setDestinataire(null);},2000);
    }catch{}
    setSending(false);
  };

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:"16px 16px 0 0",padding:"1.4rem",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,.2)",maxHeight:"80vh",overflowY:"auto"}}>

        {/* Header */}
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>
            {mode==="choix"?"💬 Envoyer un message":mode==="groupe"?"👥 Message groupé":"💬 Message personnel"}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer",padding:".2rem"}}>✕</button>
        </div>

        {/* CHOIX */}
        {mode==="choix"&&(
          <div>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.6}}>
              Tu as <strong style={{color:C.brun}}>{equipe.length}</strong> personne{equipe.length>1?"s":""} dans ton équipe.
            </p>
            <div onClick={()=>setMode("groupe")}
              style={{background:C.brun,borderRadius:12,padding:"1rem",marginBottom:".6rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem"}}>
              <div style={{fontSize:"1.5rem"}}>👥</div>
              <div>
                <div style={{fontSize:".88rem",fontWeight:600,color:C.blanc}}>Message groupé</div>
                <div style={{fontSize:".68rem",color:C.pale}}>Envoyer à toute ton équipe ({equipe.length} personnes)</div>
              </div>
            </div>
            <div onClick={()=>setMode("perso")}
              style={{background:C.rose+"15",border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem"}}>
              <div style={{fontSize:"1.5rem"}}>💌</div>
              <div>
                <div style={{fontSize:".88rem",fontWeight:600,color:C.brun}}>Message personnel</div>
                <div style={{fontSize:".68rem",color:C.gris}}>Choisir une personne spécifique</div>
              </div>
            </div>
          </div>
        )}

        {/* MESSAGE GROUPÉ */}
        {mode==="groupe"&&(
          <div>
            <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <div style={{background:C.creme,borderRadius:10,padding:".7rem",marginBottom:"1rem",fontSize:".72rem",color:C.gris}}>
              📤 Sera envoyé à : <strong style={{color:C.brun}}>{equipe.map(fmt).join(", ")}</strong>
            </div>
            <textarea
              placeholder="Écris ton message ici... ex: Bravo à toutes pour cette semaine ! 🔥 On continue sur cette lancée !"
              value={texte} onChange={e=>setTexte(e.target.value)}
              style={{width:"100%",minHeight:120,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".82rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.65,marginBottom:"1rem"}}/>
            <button onClick={()=>envoyerMsg(equipe)} disabled={!texte.trim()||sending||sent}
              style={{width:"100%",background:sent?C.vert:texte.trim()?C.brun:C.pale,color:texte.trim()?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:texte.trim()?"pointer":"default",transition:"all .2s"}}>
              {sent?"✅ Envoyé !":sending?"Envoi...":"Envoyer à toute l'équipe →"}
            </button>
          </div>
        )}

        {/* MESSAGE PERSONNEL — CHOIX DESTINATAIRE */}
        {mode==="perso"&&!destinataire&&(
          <div>
            <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <p style={{fontSize:".74rem",color:C.gris,marginBottom:".75rem"}}>Choisis la destinataire :</p>
            {equipe.map(mUid=>(
              <div key={mUid} onClick={()=>setDestinataire(mUid)}
                style={{display:"flex",alignItems:"center",gap:".65rem",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem",cursor:"pointer"}}>
                <div style={{width:32,height:32,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                  {fmt(mUid)[0]}
                </div>
                <div>
                  <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{fmt(mUid)}</div>
                  <div style={{fontSize:".62rem",color:C.gris}}>
                    {annuaire[mUid]?.marraine===uid?"Filleule directe":"Filleule indirecte"}
                  </div>
                </div>
                <span style={{marginLeft:"auto",color:C.pale}}>›</span>
              </div>
            ))}
          </div>
        )}

        {/* MESSAGE PERSONNEL — SAISIE */}
        {mode==="perso"&&destinataire&&(
          <div>
            <button onClick={()=>setDestinataire(null)} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:"1rem"}}>← Retour</button>
            <div style={{display:"flex",alignItems:"center",gap:".6rem",background:C.creme,borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {fmt(destinataire)[0]}
              </div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun}}>{fmt(destinataire)}</div>
            </div>
            <textarea
              placeholder={`Écris ton message pour ${fmt(destinataire)}...`}
              value={texte} onChange={e=>setTexte(e.target.value)}
              style={{width:"100%",minHeight:120,border:`1px solid ${C.pale}`,borderRadius:10,padding:".75rem",fontFamily:"inherit",fontSize:".82rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.65,marginBottom:"1rem"}}/>
            <button onClick={()=>envoyerMsg([destinataire])} disabled={!texte.trim()||sending||sent}
              style={{width:"100%",background:sent?C.vert:texte.trim()?C.brun:C.pale,color:texte.trim()?C.blanc:C.gris,border:"none",borderRadius:10,padding:".7rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:texte.trim()?"pointer":"default",transition:"all .2s"}}>
              {sent?"✅ Envoyé !":sending?"Envoi...":`Envoyer à ${fmt(destinataire)} →`}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// Affichage des messages reçus (popup sur le tableau de bord)
export function MessagesRecusPopup({uid, onClose}){
  const[msgs,setMsgs]=useState([]);
  const[loading,setLoading]=useState(true);
  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"messages",uid));
        if(snap.exists()) setMsgs(snap.data().msgs||[]);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const marquerLus=async()=>{
    const next=msgs.map(m=>({...m,lu:true}));
    setMsgs(next);
    try{await setDoc(doc(db,"messages",uid),{msgs:next});}catch{}
  };

  useEffect(()=>{
    if(msgs.length>0) marquerLus();
  },[msgs.length]);

  const nonLus=msgs.filter(m=>!m.lu).length;

  return(
    <div style={{position:"fixed",inset:0,background:"rgba(61,31,14,.6)",display:"flex",alignItems:"flex-end",justifyContent:"center",zIndex:9998,padding:"1rem"}}>
      <div style={{background:C.blanc,borderRadius:"16px 16px 0 0",padding:"1.4rem",width:"100%",maxWidth:480,boxShadow:"0 -8px 32px rgba(0,0,0,.2)",maxHeight:"80vh",overflowY:"auto"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:"1rem"}}>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun}}>
            💬 Mes messages {nonLus>0&&<span style={{background:C.rose,color:"white",borderRadius:20,fontSize:".6rem",padding:".1rem .45rem",marginLeft:".3rem"}}>{nonLus}</span>}
          </div>
          <button onClick={onClose} style={{background:"none",border:"none",fontSize:"1.2rem",color:C.gris,cursor:"pointer"}}>✕</button>
        </div>
        {loading&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Chargement...</div>}
        {!loading&&msgs.length===0&&(
          <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
            <div style={{fontSize:"2rem",marginBottom:".5rem"}}>📭</div>
            <div style={{fontSize:".76rem"}}>Aucun message pour l'instant.</div>
          </div>
        )}
        {msgs.map(m=>(
          <div key={m.id} style={{background:m.lu?C.creme:C.rose+"10",border:`1px solid ${m.lu?C.pale:C.rose+"40"}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
              <div style={{fontSize:".78rem",fontWeight:700,color:C.brun}}>{fmt(m.de)}</div>
              <div style={{fontSize:".6rem",color:C.gris}}>{new Date(m.ts).toLocaleDateString("fr-FR",{day:"numeric",month:"short",hour:"2-digit",minute:"2-digit"})}</div>
            </div>
            <div style={{fontSize:".78rem",color:C.texte,lineHeight:1.65}}>{m.texte}</div>
          </div>
        ))}
      </div>
    </div>
  );
}



// ── ACTIONS BIBLIO CHEF ───────────────────────────────────────────────────────
export function ActionsBiblioChefTab({uid}){
  const[actions,setActions]=useState([]);
  const[loading,setLoading]=useState(true);
  const[form,setForm]=useState({icon:"⚡",label:"",cat:"ventes"});
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);

  const CATS=[
    {id:"ventes",label:"🛍️ Ventes"},
    {id:"recrutement",label:"👥 Recrutement"},
    {id:"algorithme",label:"⚡ Algorithme"},
    {id:"equipe",label:"✨ Équipe"},
  ];

  const ICONS=["⚡","💡","🎯","🔥","💪","🌟","✨","🎉","💬","📱","🤝","🏆","💰","🌸","🎥","📸","🌈","💎","🚀","❤️"];

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","actions_biblio"));
        if(snap.exists()) setActions(snap.data().items||[]);
      }catch{}
      setLoading(false);
    })();
  },[]);

  const save=async(next)=>{
    setActions(next);
    try{await setDoc(doc(db,"admin","actions_biblio"),{items:next},{merge:false});}catch{}
  };

  const add=async()=>{
    if(!form.label.trim())return;
    setSaving(true);
    const next=[...actions,{
      id:`chef-${Date.now()}`,
      icon:form.icon,
      label:form.label.trim(),
      cat:form.cat,
      ajoutePar:uid,
      ts:Date.now(),
    }];
    await save(next);
    setForm({icon:"⚡",label:"",cat:"ventes"});
    setShowAdd(false);
    setSaving(false);
  };

  const del=async(id)=>save(actions.filter(a=>a.id!==id));

  if(loading) return <div style={{padding:"2rem",textAlign:"center",color:C.gris,fontSize:".76rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Actions <em style={{fontStyle:"italic",color:C.rose}}>Bibliothèque</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Les actions que tu ajoutes ici apparaissent dans l'onglet <strong>✨ Équipe</strong> de la bibliothèque d'actions de toutes les membres.
      </p>

      <button onClick={()=>setShowAdd(!showAdd)}
        style={{width:"100%",background:showAdd?C.pale:C.brun,color:showAdd?C.gris:C.blanc,border:"none",borderRadius:10,padding:".65rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        {showAdd?"✕ Annuler":"+ Ajouter une action"}
      </button>

      {showAdd&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          {/* Icône */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Icône</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",marginBottom:".7rem"}}>
            {ICONS.map(ic=>(
              <button key={ic} onClick={()=>setForm(f=>({...f,icon:ic}))}
                style={{background:form.icon===ic?C.brun:"none",border:`1px solid ${form.icon===ic?C.brun:C.pale}`,borderRadius:8,padding:".3rem .4rem",fontSize:".9rem",cursor:"pointer"}}>
                {ic}
              </button>
            ))}
          </div>

          {/* Catégorie */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Catégorie</div>
          <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".7rem"}}>
            {CATS.map(c=>(
              <button key={c.id} onClick={()=>setForm(f=>({...f,cat:c.id}))}
                style={{padding:".3rem .65rem",fontSize:".68rem",fontWeight:600,borderRadius:20,border:`1px solid ${form.cat===c.id?C.rose:C.pale}`,background:form.cat===c.id?C.rose:C.blanc,color:form.cat===c.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
                {c.label}
              </button>
            ))}
          </div>

          {/* Label */}
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".3rem"}}>Description de l'action</div>
          <input value={form.label} onChange={e=>setForm(f=>({...f,label:e.target.value}))}
            placeholder="ex: Envoyer 3 messages de prospection..."
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".7rem"}}/>

          <button onClick={add} disabled={!form.label.trim()||saving}
            style={{width:"100%",background:form.label.trim()?C.brun:C.pale,color:form.label.trim()?C.blanc:C.gris,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:form.label.trim()?"pointer":"default"}}>
            {saving?"Sauvegarde...":"✓ Publier dans la bibliothèque"}
          </button>
        </div>
      )}

      {/* Liste des actions ajoutées */}
      {actions.length===0&&!showAdd&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>💡</div>
          Aucune action ajoutée pour l'instant.
        </div>
      )}

      {CATS.map(c=>{
        const items=actions.filter(a=>a.cat===c.id);
        if(items.length===0)return null;
        return(
          <div key={c.id} style={{marginBottom:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.gris,marginBottom:".4rem",padding:".2rem .6rem",background:C.pale,borderRadius:20,display:"inline-block"}}>{c.label}</div>
            {items.map(a=>(
              <div key={a.id} style={{display:"flex",alignItems:"center",gap:".6rem",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".6rem .85rem",marginBottom:".35rem"}}>
                <span style={{fontSize:"1rem"}}>{a.icon}</span>
                <div style={{flex:1,fontSize:".78rem",color:C.texte}}>{a.label}</div>
                <button onClick={()=>del(a.id)}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".75rem",padding:".1rem .3rem",fontFamily:"inherit"}}>✕</button>
              </div>
            ))}
          </div>
        );
      })}
    </div>
  );
}

// Composant global — JAMAIS défini à l'intérieur d'un autre composant
export function GrilleJoursCA({pNum, color, courante=false, joursEcoules, data, editCell, editVal, setEditCell, setEditVal, saveJour, setEditPeriode, setEditCA, setEditObj}){
  const d=data[`p${pNum}`]||{ca:0,obj:0,jours:{}};
  const debut=getPeriodeDebut(pNum);
  const _n=new Date();const _t=new Date(_n.getFullYear(),_n.getMonth(),_n.getDate(),12,0,0);const _dj=Math.floor((_t.getTime()-debut.getTime())/(24*60*60*1000));const _je=courante?Math.min(21,Math.max(0,_dj+1)):joursEcoules;const isFutur=(i)=>courante&&i>=_je;const isToday=(i)=>courante&&i===_je-1;
  const pct=(ca,obj)=>obj?Math.min(100,Math.round((ca||0)/obj*100)):0;
  const fmtJour=(d2)=>d2.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});
  return(
    <div>
      <div style={{background:courante?`linear-gradient(135deg,${C.brun},${C.brun2})`:color+'15',padding:'.5rem .5rem .4rem',borderBottom:`1px solid ${color}30`}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div style={{fontSize:'.6rem',fontWeight:700,color:courante?C.or:color}}>{fmtPLabel(pNum)}</div>
          <button onClick={()=>{setEditPeriode(pNum);setEditCA(d.ca||'');setEditObj(d.obj||'');}}
            style={{background:'none',border:`1px solid ${courante?'rgba(255,255,255,.25)':color+'40'}`,borderRadius:5,padding:'.1rem .35rem',fontSize:'.52rem',color:courante?C.pale:color,cursor:'pointer',fontFamily:'inherit'}}>✏️</button>
        </div>
        <div style={{fontFamily:'Georgia,serif',fontSize:'.95rem',fontWeight:700,color:courante?C.blanc:color}}>
          {fmtPLabel(pNum)}
        </div>
        <div style={{height:3,background:courante?'rgba(255,255,255,.15)':C.pale,borderRadius:10,overflow:'hidden',marginTop:'.3rem'}}>
          <div style={{height:'100%',background:courante?C.or:color,width:pct(d.ca,d.obj)+'%',borderRadius:10}}/>
        </div>
      </div>
      {Array.from({length:21},(_,i)=>{
        const dateJour=new Date(debut.getTime()+i*24*60*60*1000);
        const val=d.jours?.[i];
        const editing=editCell?.pNum===pNum&&editCell?.jourIdx===i;
        return(
          <div key={i} onClick={()=>!isFutur(i)&&!editing&&(setEditCell({pNum,jourIdx:i}),setEditVal(val||''))}
            style={{display:'flex',alignItems:'center',gap:'.3rem',padding:'.26rem .45rem',borderBottom:`1px solid ${C.pale}20`,background:isToday(i)?C.rose+'25':val>0?C.vert+'08':'transparent',cursor:isFutur(i)?'default':'pointer',opacity:isFutur(i)?.35:1}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'.54rem',color:isToday(i)?C.rose:C.gris,fontWeight:isToday(i)?700:400,lineHeight:1.2}}>{fmtJour(dateJour)}</div>
            </div>
            {editing
              ?<input autoFocus type='number' defaultValue={val||''}
                  onChange={e=>setEditVal(e.target.value)}
                  onBlur={()=>saveJour(pNum,i,editVal)}
                  onKeyDown={e=>e.key==='Enter'&&saveJour(pNum,i,editVal)}
                  style={{width:44,border:`1px solid ${color}`,borderRadius:4,background:'white',textAlign:'right',fontSize:'.65rem',fontWeight:700,outline:'none',padding:'.1rem .25rem',color:C.brun}}/>
              :<div style={{fontSize:'.65rem',fontWeight:700,color:val>0?C.vert:isFutur(i)?C.pale:C.gris+'80',textAlign:'right',minWidth:36}}>
                {val>0?val+'€':'—'}
              </div>
            }
          </div>
        );
      })}
    </div>
  );
}

// ── SUIVI CHALLENGE APP PAR LE CHEF ──────────────────────────────────────────
export function ChallengeAppSuiviTab({annuaire}){
  const[membres,setMembres]=useState([]);
  const[loading,setLoading]=useState(true);

  useEffect(()=>{
    (async()=>{
      const liste=Object.entries(annuaire||{});
      const today=new Date();
      today.setHours(0,0,0,0);

      const resultats=await Promise.all(
        liste.map(async([mUid,mData])=>{
          try{
            const snap=await getDoc(doc(db,"users",mUid));
            if(!snap.exists())return null;
            const d=snap.data();
            const ca=d["db-challenge-app"]?JSON.parse(d["db-challenge-app"]):null;
            if(!ca)return{uid:mUid,nom:mData.prenom||mUid,statut:"non_commence",joursValides:[],jourActuel:0,pct:0};

            const startDate=new Date(ca.startDate);
            startDate.setHours(0,0,0,0);
            const diffJours=Math.floor((today-startDate)/(1000*60*60*24));
            const jourActuel=Math.max(0,Math.min(diffJours+1,7));
            const joursValides=ca.joursValides||[];
            const termine=diffJours>=7;
            const pct=Math.round((joursValides.length/7)*100);
            const dateEnreg=mData.dateEnreg||ca.startDate;

            return{
              uid:mUid,
              nom:mData.prenom||mUid,
              statut:termine?"termine":jourActuel===0?"demarre_demain":"actif",
              joursValides,
              jourActuel:Math.max(jourActuel,0),
              pct,
              startDate:ca.startDate,
              dateEnreg,
            };
          }catch{return null;}
        })
      );

      setMembres(resultats.filter(Boolean).sort((a,b)=>b.pct-a.pct||b.joursValides.length-a.joursValides.length));
      setLoading(false);
    })();
  },[annuaire]);

  if(loading)return<div style={{textAlign:"center",padding:"2rem",color:C.gris}}>⏳ Chargement...</div>;

  const nbActifs=membres.filter(m=>m.statut==="actif"||m.statut==="termine").length;
  const nbTermines=membres.filter(m=>m.statut==="termine").length;
  const nbNonCommences=membres.filter(m=>m.statut==="non_commence").length;
  const pctMoyen=membres.length?Math.round(membres.reduce((s,m)=>s+m.pct,0)/membres.length):0;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.brun,marginBottom:".75rem"}}>
        Challenge <em style={{fontStyle:"italic",color:C.rose}}>Découverte App</em>
      </div>

      {/* Résumé global */}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.rose,fontFamily:"Georgia,serif"}}>{nbActifs}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>En cours</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.vert,fontFamily:"Georgia,serif"}}>{nbTermines}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Terminé 🏆</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.or,fontFamily:"Georgia,serif"}}>{pctMoyen}%</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Progression moyenne</div>
        </div>
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem",textAlign:"center"}}>
          <div style={{fontSize:"1.6rem",fontWeight:700,color:C.gris,fontFamily:"Georgia,serif"}}>{nbNonCommences}</div>
          <div style={{fontSize:".62rem",color:C.gris,fontWeight:600}}>Pas encore commencé</div>
        </div>
      </div>

      {/* Liste membres */}
      {membres.map((m,i)=>(
        <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".5rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
              <div style={{width:32,height:32,borderRadius:"50%",background:m.statut==="termine"?C.vert+"25":m.statut==="actif"?C.rose+"25":C.pale,color:m.statut==="termine"?C.vert:m.statut==="actif"?C.rose:C.gris,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".78rem",fontWeight:700,flexShrink:0}}>
                {m.nom[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{m.nom}</div>
                <div style={{fontSize:".6rem",color:C.gris}}>
                  {m.statut==="termine"?"🏆 Challenge terminé !":
                   m.statut==="demarre_demain"?"⏳ Commence demain":
                   m.statut==="non_commence"?"❌ Pas encore commencé":
                   `📅 Jour ${m.jourActuel}/7 en cours`}
                </div>
              </div>
            </div>
            <div style={{textAlign:"right",flexShrink:0}}>
              <div style={{fontSize:".82rem",fontWeight:700,color:m.pct===100?C.vert:m.pct>=50?C.or:C.gris}}>{m.pct}%</div>
              <div style={{fontSize:".58rem",color:C.gris}}>{m.joursValides.length}/7 jours</div>
            </div>
          </div>

          {/* Barre progression avec cases par jour */}
          <div style={{display:"flex",gap:".2rem"}}>
            {CHALLENGE_APP_JOURS.map((j,ji)=>{
              const fait=m.joursValides.includes(j.jour);
              const estCejour=m.jourActuel===j.jour;
              return(
                <div key={ji} title={j.titre}
                  style={{flex:1,height:28,borderRadius:6,background:fait?C.vert:estCejour?C.or+"40":C.pale,border:`1px solid ${fait?C.vert:estCejour?C.or:C.pale}`,display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem",position:"relative"}}>
                  {fait?"✓":estCejour?<span style={{fontSize:".6rem",fontWeight:700,color:C.or}}>J{j.jour}</span>:<span style={{fontSize:".55rem",color:C.gris}}>{j.jour}</span>}
                </div>
              );
            })}
          </div>

          {/* Détail des jours validés */}
          {m.joursValides.length>0&&(
            <div style={{marginTop:".4rem",display:"flex",flexWrap:"wrap",gap:".2rem"}}>
              {m.joursValides.sort((a,b)=>a-b).map(j=>(
                <span key={j} style={{fontSize:".58rem",background:C.vert+"15",color:C.vert,borderRadius:20,padding:".1rem .4rem",fontWeight:600}}>
                  ✓ J{j}: {CHALLENGE_APP_JOURS[j-1]?.emoji}
                </span>
              ))}
            </div>
          )}
          <button onClick={async()=>{if(!window.confirm("Reset challenge de "+m.nom+" ?"))return;await setDoc(doc(db,"users",m.uid),{"db-challenge-app":null},{merge:true});setMembres(prev=>prev.map(x=>x.uid===m.uid?{...x,statut:"non_commence",joursValides:[],jourActuel:0,pct:0}:x));}} style={{marginTop:".4rem",width:"100%",background:"none",border:"1px solid #E8DDD4",borderRadius:8,padding:".3rem",fontSize:".62rem",color:C.gris,cursor:"pointer",fontFamily:"inherit"}}>Reset</button>
        </div>
      ))}

      {membres.length===0&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>
          Aucun membre dans l'équipe pour l'instant.
        </div>
      )}
      <button onClick={async()=>{if(!window.confirm("Remettre le challenge a zero pour tout le monde ?"))return;const liste=Object.entries(annuaire||{});await Promise.all(liste.map(([muid])=>setDoc(doc(db,"users",muid),{"db-challenge-app":null},{merge:true})));setMembres(prev=>prev.map(x=>({...x,statut:"non_commence",joursValides:[],jourActuel:0,pct:0})));}} style={{width:"100%",background:"#B04040",color:"white",border:"none",borderRadius:10,padding:".65rem",fontSize:".8rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginTop:"1rem"}}>Reset challenge tout le monde</button>
    </div>
  );
}

// ── STATISTIQUES ÉQUIPE ──────────────────────────────────────────────────────
function StatsEquipeTab({uid, annuaire}){
  const[stats,setStats]=useState(null);
  const[loading,setLoading]=useState(true);
  const[periode,setPeriode]=useState("30j");
  const[rechercheMembre,setRechercheMembre]=useState("");

  const fmt=(n,dec=0)=>typeof n==="number"?n.toFixed(dec):"-";
  const pct=(a,b)=>b>0?Math.round((a/b)*100):0;

  useEffect(()=>{
    (async()=>{
      setLoading(true);
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length){setLoading(false);return;}

        const today=new Date();
        const cutoffJours=periode==="7j"?7:periode==="30j"?30:90;
        const cutoff=new Date(today-cutoffJours*24*60*60*1000).toISOString().slice(0,10);

        // Charger les données de chaque membre en parallèle
        const snapshots=await Promise.all(
          membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null))
        );

        let totalMembres=membres.length;
        let actifs=0;
        let streakTotal=0;
        let totalDiags=0;
        let totalDiagsAvecOrd=0;
        let totalProspects=0;
        let totalProspectsDepuisDiag=0;
        let totalConvertisClient=0;
        let totalConvertisDistrib=0;
        let totalClients=0;
        let totalCommandes=0;
        let totalCA=0;
        let totalRecommandations=0;
        let totalRecsConverties=0;
        let totalFastStartDone=0;
        let totalFastStartAssigne=0;
        let totalActions=0;
        let membresAvecDreamboard=0;
        let membresAvecLinkbio=0;
        let membreDetails=[];
        let diagParType={}; // comptage par type

        snapshots.forEach((snap,i)=>{
          if(!snap||!snap.exists())return;
          const d=snap.data();
          const [mUid,mData]=membres[i];

          const lastLogin=d["db-last-login"]||"";
          const estActif=lastLogin>=cutoff;
          if(estActif)actifs++;

          const streak=+d["db-streak"]||0;
          streakTotal+=streak;

          // Diagnostics
          const diags=d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[];
          const diagsRecents=diags.filter(dg=>dg.date>=cutoff);
          totalDiags+=diagsRecents.length;
          const diagsAvecOrd=diagsRecents.filter(dg=>dg.ordonnance||dg.ordre);
          totalDiagsAvecOrd+=diagsAvecOrd.length;
          // Compter par type
          diagsRecents.forEach(dg=>{
            if(dg.type) diagParType[dg.type]=(diagParType[dg.type]||0)+1;
          });

          // Prospects
          const prospects=d["db-prospects"]?JSON.parse(d["db-prospects"]):[];
          const prospectsRecents=prospects.filter(p=>p.dateAjout>=cutoff||(p.id&&String(p.id).length===13&&new Date(+p.id)>=new Date(cutoff)));
          totalProspects+=prospectsRecents.length;
          const depuisDiag=prospects.filter(p=>p.source==="diagnostic").length;
          totalProspectsDepuisDiag+=depuisDiag;
          const convertisClient=prospects.filter(p=>p.convertiVers==="client").length;
          const convertisDistrib=prospects.filter(p=>p.convertiVers==="distributrice").length;
          totalConvertisClient+=convertisClient;
          totalConvertisDistrib+=convertisDistrib;

          // Recommandations
          const prospectsRec=prospects.filter(p=>p.source==="recommandation").length;
          totalRecommandations+=prospectsRec;
          totalRecsConverties+=prospects.filter(p=>p.source==="recommandation"&&p.convertiVers).length;

          // Clients et commandes
          const clients=d["db-clients"]?JSON.parse(d["db-clients"]):[];
          totalClients+=clients.length;
          clients.forEach(c=>{
            const cmds=(c.commandes||[]).filter(cmd=>cmd.date>=cutoff);
            totalCommandes+=cmds.length;
            totalCA+=cmds.reduce((s,cmd)=>s+(parseFloat(cmd.montant)||0),0);
          });

          // Fast Start
          const fs=d["db-fast-start"]?JSON.parse(d["db-fast-start"]):null;
          if(fs){
            totalFastStartAssigne++;
            const done=Object.values(fs.modulesValides||{}).filter(Boolean).length;
            if(done>=7)totalFastStartDone++;
          }

          // Actions biblio
          const actions=d["db-actions"]?JSON.parse(d["db-actions"]):{};
          const nbActions=Object.keys(actions).filter(k=>!k.startsWith("_")&&actions[k]).length;
          totalActions+=nbActions;

          // Dream board
          if(d["db-dreamboard"])membresAvecDreamboard++;

          membreDetails.push({
            uid:mUid,
            nom:mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" "),
            actif:estActif,
            lastLogin,
            streak,
            nbDiags:diagsRecents.length,
            nbDiagsAvecOrd:diagsAvecOrd.length,
            nbProspects:prospectsRecents.length,
            nbClients:clients.length,
            nbCommandes:totalCommandes,
            nbFsModules:fs?Object.values(fs.modulesValides||{}).filter(Boolean).length:0,
            fsDone:fs&&Object.values(fs.modulesValides||{}).filter(Boolean).length>=7,
          });
        });

        // Charger les recommandations depuis la collection recommandations
        try{
          const recSnap=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"recommandations",mUid)).catch(()=>null)));
          recSnap.forEach(s=>{if(s&&s.exists()){totalRecommandations+=(s.data().liste||[]).reduce((sum,r)=>sum+(r.personnes?.length||1),0);}});
        }catch{}

        const tauxUtilisation=pct(actifs,totalMembres);
        const tauxConvDiag=pct(totalProspectsDepuisDiag,totalDiags);
        const tauxConvProspect=pct(totalConvertisClient+totalConvertisDistrib,totalProspects+totalProspectsDepuisDiag);
        const tauxFastStart=pct(totalFastStartDone,totalFastStartAssigne||1);
        const tauxConvRec=pct(totalRecsConverties,totalRecommandations||1);

        setStats({
          totalMembres,actifs,tauxUtilisation,
          streakMoyen:totalMembres?Math.round(streakTotal/totalMembres):0,
          totalDiags,totalDiagsAvecOrd,tauxOrdonnance:pct(totalDiagsAvecOrd,totalDiags||1),
          totalProspects,totalProspectsDepuisDiag,tauxConvDiag,
          totalConvertisClient,totalConvertisDistrib,tauxConvProspect,
          totalClients,totalCommandes,totalCA:Math.round(totalCA),
          totalRecommandations,totalRecsConverties,tauxConvRec,
          totalFastStartAssigne,totalFastStartDone,tauxFastStart,
          totalActions,membresAvecDreamboard,
          diagParType,
          membreDetails:membreDetails.sort((a,b)=>b.nbDiags-a.nbDiags),
          cutoff,periode,
        });
      }catch(e){console.error(e);}
      setLoading(false);
    })();
  },[annuaire,periode]);

  const StatCard=({icon,label,value,sub,color,pctVal})=>(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".25rem"}}>
        <div style={{fontSize:".6rem",color:C.gris,fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{icon} {label}</div>
        {pctVal!==undefined&&(
          <div style={{fontSize:".65rem",fontWeight:700,color:pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C",background:(pctVal>=70?C.vert:pctVal>=40?"#E67E22":"#E74C3C")+"15",borderRadius:20,padding:".1rem .4rem"}}>
            {pctVal}%
          </div>
        )}
      </div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.4rem",fontWeight:600,color:color||C.brun}}>{value}</div>
      {sub&&<div style={{fontSize:".62rem",color:C.gris,marginTop:".1rem"}}>{sub}</div>}
    </div>
  );

  if(loading)return(
    <div style={{textAlign:"center",padding:"2rem",color:C.gris}}>
      <div style={{fontSize:"1.5rem",marginBottom:".5rem"}}>📊</div>
      Analyse en cours...
    </div>
  );

  if(!stats)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Aucune donnée disponible.</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Statistiques <em style={{fontStyle:"italic",color:C.rose}}>Blazing Dynasty</em>
      </div>

      {/* Sélecteur de période */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
        {["7j","30j","90j"].map(p=>(
          <button key={p} onClick={()=>setPeriode(p)}
            style={{flex:1,padding:".38rem",fontSize:".72rem",fontWeight:600,borderRadius:8,border:`1px solid ${periode===p?C.rose:C.pale}`,background:periode===p?C.rose:C.blanc,color:periode===p?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {p==="7j"?"7 jours":p==="30j"?"30 jours":"90 jours"}
          </button>
        ))}
      </div>

      {/* SECTION 1 — UTILISATION */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>📱 Utilisation de l'application</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Membres actifs" value={`${stats.actifs}/${stats.totalMembres}`} sub={`Connectées sur les ${periode}`} pctVal={stats.tauxUtilisation} color={C.rose}/>
        <StatCard icon="🔥" label="Streak moyen" value={`${stats.streakMoyen}j`} sub="Jours de connexion consécutifs" color={C.or}/>
        <StatCard icon="⚡" label="Actions biblio" value={stats.totalActions} sub={`Actions validées équipe`} color={C.brun}/>
        <StatCard icon="🌟" label="Dream Boards" value={stats.membresAvecDreamboard} sub={`Membres avec un board actif`} color={C.lilas}/>
      </div>

      {/* SECTION 2 — DIAGNOSTICS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🔬 Diagnostics & Ordonnances</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:".65rem"}}>
        <StatCard icon="📋" label="Diagnostics envoyés" value={stats.totalDiags} sub={`Sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✨" label="Ordonnances générées" value={stats.totalDiagsAvecOrd} sub="Diagnostics avec résultat IA" pctVal={stats.tauxOrdonnance} color={C.rose}/>
        <StatCard icon="👤" label="Prospects créés / diag" value={stats.totalProspectsDepuisDiag} sub="Fiches créées depuis un diagnostic" color={C.or}/>
        <StatCard icon="🔄" label="Taux diag → prospect" value={`${stats.tauxConvDiag}%`} sub="Diagnostic converti en fiche" color={stats.tauxConvDiag>=30?C.vert:"#E67E22"}/>
      </div>

      {/* Classement diagnostics les plus utilisés */}
      {stats.diagParType&&Object.keys(stats.diagParType).length>0&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem .85rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,color:C.brun,marginBottom:".5rem"}}>🏆 Diagnostics les plus utilisés</div>
          {Object.entries(stats.diagParType)
            .sort((a,b)=>b[1]-a[1])
            .slice(0,8)
            .map(([type,count],i)=>{
              const max=Object.values(stats.diagParType).reduce((a,b)=>Math.max(a,b),1);
              const label={skincare:"✨ Skincare",makeup:"💄 Makeup",peaucorps:"🧴 Peau Corps",cheveux:"💇 Cheveux",sante:"💊 Santé",silhouette:"⚖️ Silhouette",detox:"🌿 Détox",antiage:"🌸 Anti-Âge",budget:"💡 Budget Beauté",recrutement:"🤝 Recrutement",complementrevenu:"💰 Revenu +",entrepreneuriat:"🚀 Entrepreneur",valeurmarche:"💼 Valeur marché",chargementale:"🧠 Charge Mentale",libertefin:"🏖️ Liberté Fin.",maman:"🌸 Maman",reconversion:"🔄 Reconversion",confianceensoi:"💪 Confiance",reseauxsociaux2:"📲 Audit Digital",blocage:"🔓 Recrue bloquée",pasrecruiter:"😓 Non recrutement",pasvendre:"💸 Non ventes",reseaux:"📱 Réseaux"}[type]||type;
              return(
                <div key={type} style={{marginBottom:".4rem"}}>
                  <div style={{display:"flex",justifyContent:"space-between",fontSize:".68rem",marginBottom:".1rem"}}>
                    <span style={{color:C.brun,fontWeight:i<3?700:400}}>{i===0?"🥇":i===1?"🥈":i===2?"🥉":""} {label}</span>
                    <span style={{color:C.gris,fontWeight:600}}>{count}</span>
                  </div>
                  <div style={{height:5,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                    <div style={{height:"100%",background:i<3?C.rose:C.gris+"60",borderRadius:10,width:`${Math.round((count/max)*100)}%`,transition:"width .3s"}}/>
                  </div>
                </div>
              );
            })
          }
        </div>
      )}

      {/* SECTION 3 — CONVERSION PROSPECTS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🎯 Prospects & Conversion</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="👥" label="Total prospects" value={stats.totalProspects} sub={`Ajoutés sur les ${periode}`} color={C.brun}/>
        <StatCard icon="✅" label="Taux de conversion" value={`${stats.tauxConvProspect}%`} sub={`${stats.totalConvertisClient} clientes · ${stats.totalConvertisDistrib} distribs`} pctVal={stats.tauxConvProspect} color={C.vert}/>
        <StatCard icon="🛍️" label="Clientes totales" value={stats.totalClients} sub="Dans toutes les fiches" color={C.rose}/>
        <StatCard icon="📦" label="Commandes enregistrées" value={stats.totalCommandes} sub={`CA estimé: ${stats.totalCA}€`} color={C.or}/>
      </div>

      {/* SECTION 4 — RECOMMANDATIONS */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🤝 Système de recommandation</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📨" label="Recommandations reçues" value={stats.totalRecommandations} sub="Personnes recommandées par clientes" color={C.lilas}/>
        <StatCard icon="🔁" label="Taux conversion recs" value={`${stats.tauxConvRec}%`} sub="Recommandations devenues prospects" pctVal={stats.tauxConvRec} color={C.vert}/>
      </div>

      {/* SECTION 5 — FAST START */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>🚀 Onboarding Fast Start</div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
        <StatCard icon="📚" label="Fast Start assignés" value={stats.totalFastStartAssigne} sub="Nouvelles avec parcours actif" color={C.brun}/>
        <StatCard icon="🏁" label="Fast Start terminés" value={stats.totalFastStartDone} sub="7 modules validés" pctVal={stats.tauxFastStart} color={C.vert}/>
      </div>

      {/* SCORE GLOBAL */}
      {(()=>{
        const score=Math.round((stats.tauxUtilisation*0.3)+(stats.tauxOrdonnance*0.2)+(stats.tauxConvProspect*0.25)+(stats.tauxFastStart*0.25));
        const couleur=score>=70?C.vert:score>=45?"#E67E22":"#E74C3C";
        return(
          <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem",textAlign:"center"}}>
            <div style={{fontSize:".62rem",color:C.or,fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".3rem"}}>⚡ Score global Blazing Dynasty</div>
            <div style={{fontFamily:"Georgia,serif",fontSize:"2.5rem",fontWeight:700,color:couleur}}>{score}<span style={{fontSize:"1.2rem",color:"rgba(255,255,255,.6)"}}>/100</span></div>
            <div style={{fontSize:".68rem",color:"rgba(255,255,255,.7)",marginTop:".2rem"}}>
              {score>=70?"🔥 Équipe très engagée — excellent levier de recrutement !":score>=45?"⚡ Bonne dynamique — encore des axes de progression":score>0?"💡 Potentiel à débloquer — concentre-toi sur l'engagement":""}
            </div>
          </div>
        );
      })()}

      {/* PHRASE RECRUTEMENT */}
      <div style={{background:C.creme,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",border:`1px solid ${C.or}40`}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:C.or,marginBottom:".35rem"}}>💬 Phrase toute prête pour recruter</div>
        <div style={{fontSize:".74rem",color:C.brun,lineHeight:1.7,fontStyle:"italic"}}>
          "Dans mon équipe, {stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé {stats.totalDiags} diagnostics clients ce mois, généré {stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti {stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."
        </div>
        <button onClick={()=>{
          const texte=`"Dans mon équipe, ${stats.tauxUtilisation}% des distributrices utilisent l'outil de gestion que j'ai mis en place. Elles ont réalisé ${stats.totalDiags} diagnostics clients ce mois, généré ${stats.totalDiagsAvecOrd} ordonnances personnalisées, et converti ${stats.tauxConvProspect}% de leurs prospects en clientes ou distributrices. C'est pas juste du MLM — c'est une vraie structure qui marche."`;
          navigator.clipboard?.writeText(texte);
          alert("✅ Copié !");
        }}
          style={{width:"100%",background:C.or,color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".5rem"}}>
          📋 Copier cette phrase
        </button>
      </div>

      {/* TABLEAU MEMBRE PAR MEMBRE */}
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".45rem"}}>👥 Détail par membre</div>
      <input
        placeholder="🔍 Rechercher un membre..."
        value={rechercheMembre}
        onChange={e=>setRechercheMembre(e.target.value)}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:9,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".5rem"}}
      />
      {stats.membreDetails.filter(m=>m.nom.toLowerCase().includes(rechercheMembre.toLowerCase())).map((m,i)=>(
        <div key={i} style={{background:m.actif?C.blanc:C.creme,border:`1px solid ${m.actif?C.pale:"transparent"}`,borderRadius:10,padding:".55rem .75rem",marginBottom:".35rem",opacity:m.actif?1:.7}}>
          <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".2rem"}}>
            <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
              <div style={{width:28,height:28,borderRadius:"50%",background:m.actif?C.rose+"25":"#ccc",color:m.actif?C.rose:"#aaa",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".75rem",fontWeight:700,flexShrink:0}}>
                {m.nom[0]?.toUpperCase()}
              </div>
              <div>
                <div style={{fontSize:".74rem",fontWeight:600,color:C.brun}}>{m.nom}</div>
                <div style={{fontSize:".58rem",color:m.actif?C.vert:C.gris}}>{m.actif?"✅ Active":"⬜ Inactive"} · {m.streak}🔥</div>
              </div>
            </div>
            <div style={{textAlign:"right"}}>
              <div style={{fontSize:".62rem",color:C.gris}}>🔬 {m.nbDiags} diag · 👤 {m.nbProspects} prospects</div>
              <div style={{fontSize:".6rem",color:C.gris}}>🛍️ {m.nbClients} clientes · {m.fsDone?"🏁 FS ✓":"📚 FS "+m.nbFsModules+"/7"}</div>
            </div>
          </div>
        </div>
      ))}
    </div>
  );
}

export function SuiviCATab({uid}){
  const raw = getPeriodeInfo();
  const[periodeOverride,setPeriodeOverride]=useState(null);
  const[editPeriodeNum,setEditPeriodeNum]=useState(false);
  const[inputPeriodeNum,setInputPeriodeNum]=useState("");
  const pCourante = periodeOverride || raw.periodNum || getPeriodeActuelle();
  const joursEcoules = periodeOverride ? 21 : Math.min(21, Math.max(1, 21 - (raw.daysLeft||0)));

  const[data,setData]=useState({});
  const[loading,setLoading]=useState(true);
  const[saving,setSaving]=useState(false);

  // Colonnes comparaison libres
  const[compareA,setCompareA]=useState(pCourante-1>0?pCourante-1:1);
  const[compareB,setCompareB]=useState(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1);
  const[editColA,setEditColA]=useState(false);
  const[editColB,setEditColB]=useState(false);
  const[inputA,setInputA]=useState(String(pCourante-1>0?pCourante-1:1));
  const[inputB,setInputB]=useState(String(pCourante-PERIODES_PAR_AN>0?pCourante-PERIODES_PAR_AN:1));

  // Cellule en cours d'édition
  const[editCell,setEditCell]=useState(null);
  const[editVal,setEditVal]=useState('');

  // Édition total + objectif
  const[editPeriode,setEditPeriode]=useState(null);
  const[editCA,setEditCA]=useState('');
  const[editObj,setEditObj]=useState('');

  // Historique — navigation
  const[histAnnee,setHistAnnee]=useState(new Date().getFullYear());
  const[histPeriodeOuverte,setHistPeriodeOuverte]=useState(null); // num absolu

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'users',uid));
        if(snap.exists()&&snap.data()['db-suivi-ca'])
          setData(JSON.parse(snap.data()['db-suivi-ca']));
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const saveData=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,'users',uid),{'db-suivi-ca':JSON.stringify(next)},{merge:true});setData(next);}catch{}
    setSaving(false);
  };

  const saveJour=(pNum,idx,val)=>{
    const pKey=`p${pNum}`;
    const cur=data[pKey]||{obj:0,jours:{}};
    const jours={...(cur.jours||{}),[idx]:parseFloat(val)||0};
    // Total = valeur du jour le plus récent rempli (saisie cumulée)
    const joursRemplis=Object.entries(jours).filter(([,v])=>parseFloat(v)>0);
    let ca=0;
    if(joursRemplis.length>0){
      const dernierIdx=Math.max(...joursRemplis.map(([k])=>parseInt(k)));
      ca=parseFloat(jours[dernierIdx])||0;
    }
    saveData({...data,[pKey]:{...cur,jours,ca}});
    setEditCell(null);
  };

  const saveEdit=()=>{
    const pKey=`p${editPeriode}`;
    const cur=data[pKey]||{jours:{}};
    saveData({...data,[pKey]:{...cur,ca:parseFloat(editCA)||0,obj:parseFloat(editObj)||0}});
    setEditPeriode(null);
  };

  const pct=(ca,obj)=>obj?Math.min(100,Math.round((ca||0)/obj*100)):0;
  const fmtDate=(d)=>d.toLocaleDateString('fr-FR',{day:'numeric',month:'short'});
  const fmtJour=(d)=>d.toLocaleDateString('fr-FR',{weekday:'short',day:'numeric'});

  if(loading)return <div style={{padding:'2rem',textAlign:'center',color:C.gris,fontSize:'.76rem'}}>Chargement...</div>;

  const dCour=data[`p${pCourante}`]||{ca:0,obj:0,jours:{}};
  const attendu=dCour.obj?Math.round(dCour.obj*joursEcoules/21):0;
  const delta=(dCour.ca||0)-attendu;

  // Grille 21 jours pour une période donnée

  // Années disponibles
  const anneesDispos=[];
  const anneeCourante=getPeriodeDebut(pCourante).getFullYear();
  for(let a=2024;a<=anneeCourante;a++) anneesDispos.push(a);

  // Périodes d'une année donnée (numéros absolus)
  const periodesDeAnnee=(annee)=>{
    const result=[];
    for(let n=-50;n<=pCourante;n++){
      if(n===0) continue;
      try{
        const d=getPeriodeDebut(n);
        const f=new Date(d.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
        if(d.getFullYear()===annee||f.getFullYear()===annee) result.push(n);
      }catch{}
    }
    return [...new Set(result)].sort((a,b)=>a-b);
  };

  return(
    <div>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun}}>
          Suivi <em style={{fontStyle:"italic",color:C.rose}}>CA</em>
        </div>
        <div style={{display:"flex",alignItems:"center",gap:".3rem"}}>
          {editPeriodeNum
            ?<div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
              <span style={{fontSize:".62rem",color:C.gris}}>P n°</span>
              <input type="number" autoFocus value={inputPeriodeNum} onChange={e=>setInputPeriodeNum(e.target.value)}
                onBlur={()=>{const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}
                onKeyDown={e=>{if(e.key==="Enter"){const v=parseInt(inputPeriodeNum);if(v>0)setPeriodeOverride(v);setEditPeriodeNum(false);}}}
                style={{width:50,border:`1px solid ${C.rose}`,borderRadius:7,padding:".28rem .4rem",fontSize:".78rem",fontFamily:"inherit",textAlign:"center",outline:"none"}}/>
            </div>
            :<button onClick={()=>{setEditPeriodeNum(true);setInputPeriodeNum(String(pCourante));}}
              style={{background:periodeOverride?"#FFF3CD":"none",border:`1px solid ${periodeOverride?"#E6A817":C.pale}`,borderRadius:7,padding:".2rem .45rem",fontSize:".62rem",color:periodeOverride?"#856404":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              {periodeOverride?`⚠️ P${pCourante} (forcé)`:"+/- Période"}
            </button>
          }
          {periodeOverride&&<button onClick={()=>setPeriodeOverride(null)} title="Revenir à la période actuelle" style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".72rem"}}>↩️</button>}
        </div>
      </div>

      {/* Bandeau période courante */}
      <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:'.85rem 1rem',marginBottom:'1rem',color:C.blanc}}>
        <div style={{display:'flex',justifyContent:'space-between',alignItems:'center'}}>
          <div>
            <div style={{fontSize:'.55rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.or}}>{fmtPLabel(pCourante)} · J{joursEcoules}/21</div>
            <div style={{fontFamily:'Georgia,serif',fontSize:'1.3rem',fontWeight:600}}>{dCour.ca||0}€ <span style={{fontSize:'.7rem',fontWeight:400,color:C.pale}}>/ {dCour.obj||'—'}€</span></div>
          </div>
          <div style={{textAlign:'right'}}>
            <div style={{fontSize:'.72rem',fontWeight:700,color:delta>=0?C.vert:'#F4A460'}}>{delta>=0?'▲ +':'▼ '}{Math.abs(delta)}€</div>
            <div style={{fontSize:'.58rem',color:C.pale}}>{delta>=0?'en avance':'en retard'} · attendu {attendu}€</div>
            <div style={{fontSize:'.55rem',color:C.pale,marginTop:'.15rem'}}>{raw.daysLeft}j {raw.hoursLeft}h restants</div>
          </div>
        </div>
        <div style={{height:5,background:'rgba(255,255,255,.15)',borderRadius:10,overflow:'hidden',marginTop:'.5rem'}}>
          <div style={{height:'100%',background:C.or,width:pct(dCour.ca,dCour.obj)+'%',borderRadius:10}}/>
        </div>
      </div>

      {/* GRILLE 3 COLONNES */}
      <div style={{display:'grid',gridTemplateColumns:'repeat(3,1fr)',gap:'.4rem',marginBottom:'1rem'}}>
        {/* Colonne B */}
        <div style={{border:`1.5px solid #88888840`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:'#f5f5f5',padding:'.35rem .4rem .3rem',borderBottom:'1px solid #88888820',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareB(b=>Math.max(1,b-1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColB(true)} style={{fontSize:'.55rem',fontWeight:700,color:'#888',cursor:'pointer',textAlign:'center'}}>{editColB?<input type='number' autoFocus value={inputB} onChange={e=>setInputB(e.target.value)} onBlur={()=>{const v=parseInt(inputB);if(v>0)setCompareB(v);setEditColB(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareB(parseInt(inputB)||1),setEditColB(false))} style={{width:36,border:'1px solid #888',borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareB)}</span>
            <button onClick={()=>setCompareB(b=>Math.min(pCourante-1,b+1))} style={{background:'none',border:'none',color:'#aaa',cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareB} color='#888' joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>

        {/* Colonne A */}
        <div style={{border:`1.5px solid ${C.lilas}40`,borderRadius:12,overflow:'hidden'}}>
          <div style={{background:C.lilas+'10',padding:'.35rem .4rem .3rem',borderBottom:`1px solid ${C.lilas}20`,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
            <button onClick={()=>setCompareA(a=>Math.max(1,a-1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>‹</button>
            <span onClick={()=>setEditColA(true)} style={{fontSize:'.55rem',fontWeight:700,color:C.lilas,cursor:'pointer',textAlign:'center'}}>{editColA?<input type='number' autoFocus value={inputA} onChange={e=>setInputA(e.target.value)} onBlur={()=>{const v=parseInt(inputA);if(v>0)setCompareA(v);setEditColA(false);}} onKeyDown={e=>e.key==='Enter'&&(setCompareA(parseInt(inputA)||1),setEditColA(false))} style={{width:36,border:`1px solid ${C.lilas}`,borderRadius:4,fontSize:'.55rem',padding:'.08rem',textAlign:'center',fontFamily:'inherit'}}/>:fmtPLabel(compareA)}</span>
            <button onClick={()=>setCompareA(a=>Math.min(pCourante-1,a+1))} style={{background:'none',border:'none',color:C.lilas,cursor:'pointer',fontSize:'.85rem',lineHeight:1,padding:0}}>›</button>
          </div>
          <GrilleJoursCA pNum={compareA} color={C.lilas} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
        {/* Colonne courante */}
        <div style={{border:`1.5px solid ${C.rose}40`,borderRadius:12,overflow:'hidden'}}>
          <GrilleJoursCA pNum={pCourante} color={C.rose} courante={true} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
        </div>
      </div>

      {/* Formulaire édition total */}
      {editPeriode&&(
        <div style={{background:C.blanc,border:`1px solid ${C.rose}`,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'.7rem',fontWeight:700,color:C.brun,marginBottom:'.6rem'}}>✏️ {fmtPLabel(editPeriode)} — {fmtDate(getPeriodeDebut(editPeriode))}</div>
          <div style={{display:'flex',gap:'.5rem',marginBottom:'.6rem'}}>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>CA total (€)</div>
              <input type='number' value={editCA} onChange={e=>setEditCA(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
            <div style={{flex:1}}>
              <div style={{fontSize:'.6rem',color:C.gris,marginBottom:'.2rem'}}>Objectif (€)</div>
              <input type='number' value={editObj} onChange={e=>setEditObj(e.target.value)} placeholder='0'
                style={{width:'100%',border:`1px solid ${C.pale}`,borderRadius:8,padding:'.45rem .65rem',fontSize:'.85rem',fontFamily:'inherit',color:C.texte,background:C.creme,outline:'none',fontWeight:700}}/>
            </div>
          </div>
          <div style={{display:'flex',gap:'.4rem'}}>
            <button onClick={saveEdit} disabled={saving}
              style={{flex:1,background:C.brun,color:C.blanc,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>
              {saving?'Sauvegarde...':'✓ Enregistrer'}
            </button>
            <button onClick={()=>setEditPeriode(null)}
              style={{flex:1,background:C.pale,color:C.gris,border:'none',borderRadius:8,padding:'.5rem',fontSize:'.78rem',fontFamily:'inherit',cursor:'pointer'}}>Annuler</button>
          </div>
        </div>
      )}

      {/* HISTORIQUE — par année puis période */}
      <div style={{marginBottom:'.5rem',display:'flex',justifyContent:'space-between',alignItems:'center'}}>
        <div style={{fontSize:'.6rem',fontWeight:700,letterSpacing:'.1em',textTransform:'uppercase',color:C.gris}}>📅 Historique</div>
        <div style={{display:'flex',gap:'.3rem'}}>
          {anneesDispos.map(a=>(
            <button key={a} onClick={()=>{setHistAnnee(a);setHistPeriodeOuverte(null);}}
              style={{padding:'.22rem .55rem',fontSize:'.65rem',fontWeight:600,borderRadius:8,border:`1px solid ${histAnnee===a?C.brun:C.pale}`,background:histAnnee===a?C.brun:C.blanc,color:histAnnee===a?C.blanc:C.gris,cursor:'pointer',fontFamily:'inherit'}}>
              {a}
            </button>
          ))}
        </div>
      </div>

      {periodesDeAnnee(histAnnee).reverse().map(num=>{
        const d3=data[`p${num}`]||{};
        const pc3=pct(d3.ca||0,d3.obj||0);
        const isCourante=num===pCourante;
        const isOuverte=histPeriodeOuverte===num;
        const numAnnee=((num-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
        return(
          <div key={num} style={{marginBottom:'.4rem',border:`1.5px solid ${isCourante?C.rose:isOuverte?C.brun:C.pale}`,borderRadius:isOuverte?'12px 12px 0 0':12,overflow:'hidden'}}>
            {/* Ligne de la période */}
            <div onClick={()=>setHistPeriodeOuverte(isOuverte?null:num)}
              style={{display:'flex',alignItems:'center',gap:'.6rem',background:isCourante?C.brun:isOuverte?C.brun+'08':C.blanc,padding:'.5rem .85rem',cursor:'pointer'}}>
              <div style={{width:36,height:36,borderRadius:'50%',background:isCourante?C.or+'30':C.rose+'15',display:'flex',alignItems:'center',justifyContent:'center',flexShrink:0,fontSize:'.65rem',fontWeight:700,color:isCourante?C.or:C.rose}}>P{numAnnee}</div>
              <div style={{flex:1}}>
                <div style={{fontSize:'.62rem',fontWeight:600,color:isCourante?C.blanc:C.brun}}>{fmtDate(getPeriodeDebut(num))} → {fmtDate(new Date(getPeriodeDebut(num).getTime()+20*24*60*60*1000))}</div>
                <div style={{height:4,background:isCourante?'rgba(255,255,255,.15)':C.pale,borderRadius:10,overflow:'hidden',marginTop:'.2rem'}}>
                  <div style={{height:'100%',background:isCourante?C.or:C.rose,width:pc3+'%',borderRadius:10}}/>
                </div>
              </div>
              <div style={{textAlign:'right',flexShrink:0}}>
                <div style={{fontFamily:'Georgia,serif',fontSize:'.9rem',fontWeight:700,color:isCourante?C.blanc:C.brun}}>{d3.ca||'—'}{d3.ca?'€':''}</div>
                <div style={{fontSize:'.58rem',color:isCourante?C.pale:C.gris}}>{d3.obj?pc3+'%':''}</div>
              </div>
              <div style={{fontSize:'.75rem',color:isCourante?C.pale:C.gris,transform:isOuverte?'rotate(90deg)':'none',transition:'transform .2s',flexShrink:0}}>›</div>
            </div>

            {/* Grille jour par jour dépliable */}
            {isOuverte&&(
              <div style={{borderTop:`1px solid ${C.pale}`,background:C.blanc}}>
                <div style={{padding:'.5rem .65rem .2rem',background:C.creme,display:'flex',justifyContent:'space-between',alignItems:'center'}}>
                  <div style={{fontSize:'.6rem',color:C.gris}}>Clique sur un jour pour saisir ou modifier</div>
                  <button onClick={()=>{setEditPeriode(num);setEditCA(d3.ca||'');setEditObj(d3.obj||'');}}
                    style={{background:C.brun,color:C.blanc,border:'none',borderRadius:6,padding:'.2rem .5rem',fontSize:'.6rem',fontWeight:600,fontFamily:'inherit',cursor:'pointer'}}>✏️ Total & Obj.</button>
                </div>
                <GrilleJoursCA pNum={num} color={isCourante?C.rose:C.lilas} courante={isCourante} joursEcoules={joursEcoules} data={data} editCell={editCell} editVal={editVal} setEditCell={setEditCell} setEditVal={setEditVal} saveJour={saveJour} setEditPeriode={setEditPeriode} setEditCA={setEditCA} setEditObj={setEditObj}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}


function ResumeSemaineChef({annuaire}){
  const [resume,setResume]=useState(null);
  const [ouvert,setOuvert]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const membres=Object.entries(annuaire||{});
        if(!membres.length) return;
        const lundi=new Date();lundi.setDate(lundi.getDate()-lundi.getDay()+1);
        const lundiStr=lundi.toISOString().slice(0,10);
        const snaps=await Promise.all(membres.map(([mUid])=>getDoc(doc(db,"users",mUid)).catch(()=>null)));
        let actives=0,diags=0,cmds=0,ca=0,det=[];
        snaps.forEach((snap,i)=>{
          if(!snap?.exists()) return;
          const d=snap.data();const [mUid,mData]=membres[i];
          const nom=mData.prenom||mUid.split("-").map(w=>w[0]?.toUpperCase()+w.slice(1)).join(" ");
          const actif=(d["db-last-login"]||"")>=lundiStr;if(actif)actives++;
          const nd=(d["db-diagnostics"]?JSON.parse(d["db-diagnostics"]):[]).filter(dg=>dg.date>=lundiStr).length;diags+=nd;
          let nc=0,nca=0;
          (d["db-clients"]?JSON.parse(d["db-clients"]):[]).forEach(cl=>{(cl.commandes||[]).filter(cmd=>cmd.date>=lundiStr).forEach(cmd=>{nc++;nca+=parseFloat(cmd.montant)||0;});});
          cmds+=nc;ca+=nca;
          det.push({nom,actif,nd,nc,nca:Math.round(nca)});
        });
        setResume({actives,total:membres.length,diags,cmds,ca:Math.round(ca),det:det.sort((a,b)=>(b.actif?1:0)-(a.actif?1:0)||b.nd-a.nd)});
      }catch{}
    })();
  },[annuaire]);
  if(!resume) return null;
  return(
    <div style={{background:C.brun,borderRadius:14,padding:"1rem 1.1rem",marginBottom:"1rem"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".65rem"}}>
        <div><div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:C.or,marginBottom:".2rem"}}>CETTE SEMAINE</div><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>{resume.actives} active{resume.actives>1?"s":""} / {resume.total}</div></div>
        <button onClick={()=>setOuvert(!ouvert)} style={{background:"rgba(255,255,255,.1)",border:"none",borderRadius:8,padding:".3rem .65rem",color:"rgba(255,255,255,.8)",fontSize:".68rem",cursor:"pointer",fontFamily:"inherit"}}>{ouvert?"Fermer":"Détails"}</button>
      </div>
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem",marginBottom:ouvert?".75rem":"0"}}>
        {[[resume.diags,"Diagnostics",C.rose],[resume.cmds,"Commandes",C.or],[resume.ca+"EUR","CA",C.vert]].map(([val,label,col])=>(<div key={label} style={{textAlign:"center",background:"rgba(255,255,255,.08)",borderRadius:8,padding:".45rem .3rem"}}><div style={{fontSize:"1.1rem",fontWeight:700,color:col}}>{val}</div><div style={{fontSize:".58rem",color:"rgba(255,255,255,.55)"}}>{label}</div></div>))}
      </div>
      {ouvert&&<div style={{borderTop:"1px solid rgba(255,255,255,.1)",paddingTop:".65rem"}}>
        {resume.det.map((m,i)=>(<div key={i} style={{display:"flex",alignItems:"center",gap:".6rem",padding:".35rem 0",borderBottom:i<resume.det.length-1?"1px solid rgba(255,255,255,.06)":"none"}}>
          <div style={{width:8,height:8,borderRadius:"50%",background:m.actif?C.vert:"rgba(255,255,255,.2)",flexShrink:0}}/>
          <div style={{flex:1,fontSize:".75rem",color:m.actif?"white":"rgba(255,255,255,.4)",fontWeight:m.actif?600:400}}>{m.nom}</div>
          <div style={{display:"flex",gap:".5rem"}}>
            {m.nd>0&&<span style={{fontSize:".62rem",color:C.rose,fontWeight:600}}>{m.nd} diag</span>}
            {m.nc>0&&<span style={{fontSize:".62rem",color:C.or,fontWeight:600}}>{m.nc} cmd</span>}
            {m.nca>0&&<span style={{fontSize:".62rem",color:C.vert,fontWeight:600}}>{m.nca}EUR</span>}
            {!m.actif&&<span style={{fontSize:".6rem",color:"rgba(255,255,255,.3)"}}>Absente</span>}
          </div>
        </div>))}
      </div>}
    </div>
  );
}
function EspaceChefTab({uid, isChef}){
  const[section,setSection]=useState("");
  const[distrib,setDistrib]=useState([]);
  const[annuaire,setAnnuaire]=useState({});
  const[showMsg,setShowMsg]=useState(false);
  const[showMsgsRecus,setShowMsgsRecus]=useState(false);
  const[nbMsgsNonLus,setNbMsgsNonLus]=useState(0);
  const userName=uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");
  const isMelissaChef = uid==="melissa"||uid==="melissa-da-silveira";
  const sections = ESPACE_CHEF_SECTIONS.filter(s=>{
    if(s.melissaOnly) return isMelissaChef;
    if(s.chefOnly) return isChef;
    return true;
  });

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"equipe","annuaire"));
        setAnnuaire(snap.exists()?snap.data().membres||{}:{});
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"messages",uid));
        if(snap2.exists()){
          const msgs=snap2.data().msgs||[];
          setNbMsgsNonLus(msgs.filter(m=>!m.lu).length);
        }
      }catch{}
    })();
  },[uid]);

  // Charge les distributeurs manuels depuis Firebase quand on entre dans cette section
  const loadDistrib=async()=>{
    const data=await sgAll(uid);
    if(data["db-distributeurs"]){try{setDistrib(JSON.parse(data["db-distributeurs"]));}catch{}}
  };
  const saveDistrib=(d)=>{setDistrib(d);ss(uid,"db-distributeurs",JSON.stringify(d));};

  if(section){
    const s=sections.find(x=>x.id===section);
    return(
      <div>
        <button onClick={()=>setSection("")}
          style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>
          ← Retour à Espace Chef
        </button>
        {section==="stats"&&<StatsEquipeTab uid={uid} annuaire={annuaire}/>}
        {section==="challengeapp"&&<ChallengeAppSuiviTab annuaire={annuaire}/>}
        {section==="suivica"&&<SuiviCATab uid={uid}/>}
        {section==="actionsbiblio"&&<ActionsBiblioChefTab uid={uid}/>}
        {section==="membres"&&<MembresTab uid={uid}/>}
        {section==="assiduite"&&<AssiduiteTab uid={uid}/>}
        {section==="defi"&&<DefisTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={true} isChef={isChef}/>}
        {section==="powerhour"&&<PowerHourTab uid={uid} userName={uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ")} canCreate={isChef}/>}
        {section==="distributeurs"&&<DistributeursTab distributeurs={distrib} save={saveDistrib} uid={uid}/>}
        {section==="monequipe"&&<MonEquipeTab uid={uid}/>}
        {section==="nouveaux"&&<SuiviRecruTab uid={uid} isChef={isChef}/>}
        {section==="admin"&&(uid==="melissa"||uid==="melissa-da-silveira")&&<AdminTab uid={uid}/>}
      </div>
    );
  }

  return(
    <div>
      {showMsg&&<MessageEquipePopup uid={uid} userName={userName} annuaire={annuaire} onClose={()=>setShowMsg(false)}/>}
      {showMsgsRecus&&<MessagesRecusPopup uid={uid} onClose={()=>{setShowMsgsRecus(false);setNbMsgsNonLus(0);}}/>}

      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Chef</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Toutes tes fonctions de cheffe d'équipe, au même endroit.
      </p>

      {/* Boutons messagerie */}
      <div style={{display:"flex",gap:".5rem",marginBottom:"1rem"}}>
        <button onClick={()=>setShowMsg(true)}
          style={{flex:1,display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          💬 Envoyer un message
        </button>
        <button onClick={()=>setShowMsgsRecus(true)}
          style={{position:"relative",background:nbMsgsNonLus>0?C.rose+"15":C.creme,border:`1px solid ${nbMsgsNonLus>0?C.rose:C.pale}`,borderRadius:10,padding:".6rem .9rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",color:nbMsgsNonLus>0?C.rose:C.gris}}>
          📭 Reçus
          {nbMsgsNonLus>0&&(
            <span style={{position:"absolute",top:-6,right:-6,background:C.rose,color:"white",borderRadius:"50%",minWidth:18,height:18,fontSize:".6rem",fontWeight:700,display:"flex",alignItems:"center",justifyContent:"center",padding:"0 3px"}}>
              {nbMsgsNonLus}
            </span>
          )}
        </button>
      </div>

      {/* Mise à jour app */}
      <div style={{marginBottom:"1rem"}}>
        <BoutonMiseAJour style={{width:"100%",justifyContent:"center"}}/>
      </div>

      <ResumeSemaineChef annuaire={annuaire}/>

      {sections.map(s=>(
        <div key={s.id} onClick={()=>{if(s.id==="distributeurs")loadDistrib();setSection(s.id);}}
          style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
          <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
            <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{s.icon}</div>
            <div>
              <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{s.label}</div>
              <div style={{fontSize:".66rem",color:C.gris}}>{s.desc}</div>
            </div>
          </div>
          <span style={{color:C.pale}}>›</span>
        </div>
      ))}
    </div>
  );
}


function MonEquipeTab({uid}){
  const[annuaire,setAnnuaire]=useState({});
  const[loading,setLoading]=useState(true);
  const[isChef,setIsChef]=useState(false);
  const[authorized,setAuthorized]=useState(false);
  const[expanded,setExpanded]=useState(null);
  const[search,setSearch]=useState(""); // Chemin de navigation : liste d'uids, le dernier = dossier actuellement ouvert
  const[path,setPath]=useState([]);

  useEffect(()=>{
    (async()=>{
      try{
        const accesSnap=await getDoc(doc(db,"acces","membres"));
        const chefs=accesSnap.exists()?accesSnap.data().chefs||[]:[];
        const chef=(Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," "))||uid==="melissa-da-silveira"||uid==="melissa";
        setIsChef(chef);

        const annSnap=await getDoc(doc(db,"equipe","annuaire"));
        const annuaire=annSnap.exists()?annSnap.data().membres||{}:{};
        setAnnuaire(annuaire);

        const hasTeam = Object.values(annuaire).some(m=>m.marraine===uid);
        if(!chef&&!hasTeam){setLoading(false);return;}
        setAuthorized(true);
      }catch{}
      setLoading(false);
    })();
  },[uid]);

  const fmt=(id)=>id.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  if(loading)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  if(!authorized)return(
    <div style={{textAlign:"center",padding:"3rem 1rem",color:C.gris}}>
      <div style={{fontSize:"2rem",marginBottom:".75rem"}}>👑</div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:C.brun,marginBottom:".4rem"}}>Pas encore d'équipe</div>
      <div style={{fontSize:".75rem",lineHeight:1.6}}>Cet espace s'active dès que tu as au moins une filleule.<br/>Reviens ici quand quelqu'un t'aura choisie comme marraine !</div>
    </div>
  );

  // Racine = mes propres filleules directes
  const currentUid = path.length>0 ? path[path.length-1] : uid;
  const enfants = Object.values(annuaire).filter(m=>m.marraine===currentUid);
  const currentPerson = path.length>0 ? annuaire[currentUid] : null;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Mon <em style={{fontStyle:"italic",color:C.rose}}>Équipe</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        {path.length===0
          ? `Tes ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}. Clique sur 📁 pour voir la sous-équipe d'une personne.`
          : `Équipe de ${currentPerson?fmt(currentPerson.uid):""} — ${enfants.length} filleule${enfants.length>1?"s":""} directe${enfants.length>1?"s":""}.`}
      </p>

      {/* Fil d'ariane */}
      {path.length>0&&(
        <div style={{display:"flex",flexWrap:"wrap",gap:".3rem",alignItems:"center",marginBottom:"1rem",fontSize:".7rem"}}>
          <button onClick={()=>setPath([])} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>🏠 Mon équipe</button>
          {path.map((pUid,i)=>(
            <span key={pUid} style={{display:"flex",alignItems:"center",gap:".3rem"}}>
              <span style={{color:C.pale}}>›</span>
              <button onClick={()=>setPath(path.slice(0,i+1))}
                style={{background:"none",border:"none",color:i===path.length-1?C.brun:C.rose,fontWeight:i===path.length-1?700:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>
                {fmt(pUid)}
              </button>
            </span>
          ))}
        </div>
      )}

      {/* Fiche de la personne dont on consulte l'équipe */}
      {currentPerson&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
          <div style={{display:"flex",gap:".6rem",alignItems:"center",marginBottom:".6rem"}}>
            <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
              {fmt(currentPerson.uid)[0]}
            </div>
            <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{fmt(currentPerson.uid)}</div>
          </div>
          <MembreStatsCard m={currentPerson} expanded={expanded===currentPerson.uid} onToggleExpand={()=>setExpanded(expanded===currentPerson.uid?null:currentPerson.uid)}/>
        </div>
      )}

      {enfants.length===0&&!search&&(
        <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".76rem"}}>
          {path.length===0
            ?<>Aucune fille ne t'a encore choisie comme marraine.<br/>Elles apparaîtront ici dès qu'elles t'auront sélectionnée à l'inscription ou via le pop-up.</>
            :"Cette personne n'a pas encore de filleules."}
        </div>
      )}

      {enfants.length>0&&(
        <input placeholder="🔍 Rechercher dans l'équipe..." value={search} onChange={e=>setSearch(e.target.value)}
          style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".75rem",boxSizing:"border-box"}}/>
      )}

      {enfants.filter(m=>!search||fmt(m.uid).toLowerCase().includes(search.toLowerCase())).map(m=>{
        const sousEquipeCount = countEquipeSafe(annuaire, m.uid);
        const hasTeam = sousEquipeCount>0;
        return(
          <div key={m.uid} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem 1rem",marginBottom:".5rem"}}>
            <div style={{display:"flex",gap:".6rem",alignItems:"center"}}>
              <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",color:C.rose,fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,display:"flex",alignItems:"center",justifyContent:"center",flexShrink:0}}>
                {fmt(m.uid)[0]}
              </div>
              <div style={{flex:1}}>
                <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{fmt(m.uid)}</div>
                <div style={{fontSize:".62rem",color:C.gris}}>{m.palier||"2%"}{m.ca?` · ${m.ca}€`:""}</div>
              </div>
              {hasTeam&&(
                <button onClick={()=>setPath([...path,m.uid])}
                  style={{display:"flex",alignItems:"center",gap:".3rem",background:C.lilas+"15",border:`1px solid ${C.lilas}50`,borderRadius:8,padding:".35rem .6rem",fontSize:".68rem",fontWeight:600,color:C.lilas,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                  📁 {sousEquipeCount}
                </button>
              )}
              <button onClick={async()=>{
                try{
                  const ref=doc(db,"users",m.uid);
                  const snap=await getDoc(ref);
                  const existing=snap.exists()&&snap.data()["db-fast-start"]?JSON.parse(snap.data()["db-fast-start"]):{};
                  const nom=(m.prenom||"")+" "+(m.nom||"");
                  if(!existing.startDate){
                    await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                    alert("✅ Fast Start assigné à "+nom.trim());
                  } else {
                    if(window.confirm(nom.trim()+" a déjà un Fast Start (démarré le "+existing.startDate+"). Relancer depuis le début ?")){
                      await setDoc(ref,{"db-fast-start":JSON.stringify({startDate:todayLocalStr(),doneTasks:{},modulesValides:{}})},{merge:true});
                      alert("✅ Fast Start relancé pour "+nom.trim());
                    }
                  }
                }catch{alert("Erreur.");}
              }}
                style={{background:C.rose+"15",border:`1px solid ${C.rose}50`,borderRadius:8,padding:".35rem .55rem",fontSize:".65rem",fontWeight:600,color:C.rose,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}
                title="Assigner/relancer le Fast Start">
                🚀
              </button>
              <button onClick={()=>setExpanded(expanded===m.uid?null:m.uid)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:8,padding:".35rem .55rem",fontSize:".68rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {expanded===m.uid?"▲":"▼"}
              </button>
            </div>
            {expanded===m.uid&&(
              <div style={{marginTop:".6rem",paddingTop:".6rem",borderTop:`1px solid ${C.pale}`}}>
                <MembreStatsCard m={m} expanded={true} onToggleExpand={()=>setExpanded(null)}/>
              </div>
            )}
          </div>
        );
      })}
    </div>
  );
}

// ── ADMIN TAB (Melissa uniquement) ───────────────────────────────────────────
function AdminConfigPeriodes(){
  const[ancre,setAncre]=useState("2026-01-03");
  const[periodeNum,setPeriodeNum]=useState("");
  const[periodeDebut,setPeriodeDebut]=useState("");
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[resetUid,setResetUid]=useState("");
  const[resetResult,setResetResult]=useState("");
  const[resetSearch,setResetSearch]=useState("");
  const[membres,setMembres]=useState([]);
  const[resetSaving,setResetSaving]=useState(false);
  const[resetVals,setResetVals]=useState({});
  const[resetGlobalSaving,setResetGlobalSaving]=useState(false);
  const[resetGlobalResult,setResetGlobalResult]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","config_periodes"));
        if(snap.exists()&&snap.data().ancre) setAncre(snap.data().ancre.slice(0,10));
      }catch{}
      // Charger aussi les membres de l'annuaire
      try{
        const snap2=await getDoc(doc(db,"equipe","annuaire"));
        if(snap2.exists()) setMembres(Object.entries(snap2.data().membres||{}).map(([uid,m])=>({uid,prenom:m.prenom||"",nom:m.nom||""})).sort((a,b)=>(a.prenom+a.nom).localeCompare(b.prenom+b.nom)));
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","config_periodes"),{ancre:ancre+"T12:00:00"});
      // Met à jour la variable globale immédiatement
      PERIODE_DEBUT_ABSOLU_MS = new Date(ancre+"T12:00:00").getTime();
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };

  // Prévisualisation
  const ancreDate = new Date(ancre+"T00:00:00");
  const today = new Date();
  const diffMs = today.getTime() - ancreDate.getTime();
  const n = diffMs>0 ? Math.floor(diffMs/(PERIODE_DUREE_JOURS*24*60*60*1000))+1 : 1;
  const debut = new Date(ancreDate.getTime()+(n-1)*PERIODE_DUREE_JOURS*24*60*60*1000);
  const fin = new Date(debut.getTime()+PERIODE_DUREE_JOURS*24*60*60*1000-1);
  const numAnnee = ((n-1)%PERIODES_PAR_AN+PERIODES_PAR_AN)%PERIODES_PAR_AN+1;
  const resteDays = Math.ceil((fin.getTime()-today.getTime())/(24*60*60*1000));

  if(!loaded) return null;

  return(
    <div style={{background:"#FFF8E1",border:"1.5px solid #E6A817",borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:"#856404",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".6rem"}}>⚙️ Configuration des Périodes Mihi</div>
      <p style={{fontSize:".7rem",color:"#856404",marginBottom:".75rem",lineHeight:1.6}}>
        La date d'ancre détermine le calcul de toutes les périodes pour <strong>toute l'équipe</strong>. Modifie uniquement si les dates sont incorrectes.
      </p>
      <div style={{marginBottom:".6rem"}}>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Je suis en periode :</div>
        <div style={{display:"flex",gap:".3rem",flexWrap:"wrap",marginBottom:".6rem"}}>{[6,7,8,9,10,11,12,13,14,15,16,17,18].map(n=>(<button key={n} onClick={()=>setPeriodeNum(String(n))} style={{padding:".3rem .55rem",fontSize:".72rem",fontWeight:700,borderRadius:8,border:"1.5px solid "+(periodeNum===String(n)?"#E6A817":"#E8DDD4"),background:periodeNum===String(n)?"#E6A817":"white",color:periodeNum===String(n)?"white":"#3D1F0E",cursor:"pointer",fontFamily:"inherit"}}>P{n}</button>))}</div>
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de debut de cette periode</div>
        <input type="date" value={periodeDebut||""} onChange={e=>setPeriodeDebut(e.target.value)} style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".4rem"}}/>
        {periodeNum&&periodeDebut&&<div style={{fontSize:".7rem",color:"#856404",background:"#FFF8E1",borderRadius:6,padding:".4rem .6rem",marginBottom:".4rem"}}>P{periodeNum} commence le {new Date(periodeDebut+"T00:00:00").toLocaleDateString("fr-FR",{day:"numeric",month:"long"})}</div>}
        <div style={{fontSize:".62rem",color:C.gris,marginBottom:".25rem",fontWeight:600}}>Date de début de P1 (ancre)</div>
        <input type="date" value={ancre} onChange={e=>setAncre(e.target.value)}
          style={{width:"100%",border:`1px solid #E6A817`,borderRadius:8,padding:".42rem .65rem",fontSize:".85rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",fontWeight:600}}/>
      </div>
      {/* Prévisualisation */}
      <div style={{background:"white",borderRadius:8,padding:".5rem .75rem",marginBottom:".6rem",fontSize:".72rem",color:C.brun}}>
        <strong>Prévisualisation :</strong> Aujourd'hui = <strong style={{color:C.rose}}>P{numAnnee} {debut.getFullYear()}</strong> · {debut.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} → {fin.toLocaleDateString("fr-FR",{day:"numeric",month:"short"})} · {Math.max(0,resteDays)}j restants
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:"#E6A817",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Appliqué à toute l'équipe !":"✓ Appliquer à toute l'équipe"}
      </button>

      {/* Reset global tous les membres */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#C0392B",marginBottom:".4rem"}}>🔄 Remise à zéro de toute l'équipe</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Remet le CA et les recrues à 0 pour <strong>tous les membres</strong> (sans effacer le cumul ni l'historique). À utiliser au changement de période/campagne.
        </p>
        {resetGlobalResult&&<div style={{fontSize:".7rem",color:resetGlobalResult.startsWith("✅")?C.vert:"#B04040",marginBottom:".4rem"}}>{resetGlobalResult}</div>}
        <button onClick={async()=>{
          if(!window.confirm("Remettre CA et recrues à 0 pour TOUTE l'équipe ? Cette action est irréversible."))return;
          setResetGlobalSaving(true);setResetGlobalResult("");
          try{
            const annRef=doc(db,"equipe","annuaire");
            const annSnap=await getDoc(annRef);
            if(!annSnap.exists()){setResetGlobalResult("❌ Annuaire introuvable.");setResetGlobalSaving(false);return;}
            const membres2=annSnap.data().membres||{};
            const uids=Object.keys(membres2);
            let ok=0,err=0;
            // Reset annuaire en une fois
            const newMembres={};
            uids.forEach(u=>{newMembres[u]={...membres2[u],ca:"",caPerso:"",recruesReal:"0"};});
            await setDoc(annRef,{membres:newMembres},{merge:true});
            // Reset objectifs individuels
            for(const uid2 of uids){
              try{
                const uSnap=await getDoc(doc(db,"users",uid2));
                if(uSnap.exists()){
                  const d2=uSnap.data();
                  if(d2["db-obj-perso"]){
                    const obj2=JSON.parse(d2["db-obj-perso"]);
                    const periode2=getPeriodeActuelle();
                    // Sauvegarder dans historique avant reset
                    const hist2=obj2.historique||[];
                    if(obj2.ca||obj2.caPerso||obj2.recruesReal!=="0"){
                      hist2.push({date:todayLocalStr(),ca:+obj2.ca||0,caPerso:+obj2.caPerso||0,recruesReal:+obj2.recruesReal||0,palier:obj2.palier||"2%"});
                    }
                    const totalCaCumul=(+obj2.totalCaCumul||0)+(+obj2.ca||0);
                    const totalRecruesCumul=(+obj2.totalRecruesCumul||0)+(+obj2.recruesReal||0);
                    const nextObj2={...obj2,ca:"",caPerso:"",caEquipe:"",recruesReal:"0",nbDirecteurs:0,caDirecteurs:{},dirSelectionnes:{},historique:hist2.slice(-24),totalCaCumul:String(totalCaCumul),totalRecruesCumul:String(totalRecruesCumul)};
                    await setDoc(doc(db,"users",uid2),{"db-obj-perso":JSON.stringify(nextObj2),"last_periode":periode2},{merge:true});
                  } else {
                    await setDoc(doc(db,"users",uid2),{"last_periode":getPeriodeActuelle()},{merge:true});
                  }
                  ok++;
                }
              }catch{err++;}
            }
            setResetGlobalResult(`✅ ${ok} membres remis à zéro${err>0?` (${err} erreurs)`:""}. Annuaire mis à jour.`);
          }catch(e){setResetGlobalResult("Erreur : "+e.message);}
          setResetGlobalSaving(false);
        }} disabled={resetGlobalSaving}
          style={{width:"100%",background:resetGlobalSaving?"#aaa":"#C0392B",color:"white",border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:resetGlobalSaving?"default":"pointer"}}>
          {resetGlobalSaving?"Remise à zéro en cours...":"🔄 Remettre toute l'équipe à zéro"}
        </button>
      </div>

      {/* Correction cumul individuel */}
      <div style={{marginTop:"1rem",paddingTop:"1rem",borderTop:"1px solid #E6A817"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#856404",marginBottom:".4rem"}}>🔧 Corriger les objectifs d'un membre</div>
        <p style={{fontSize:".68rem",color:"#856404",marginBottom:".5rem",lineHeight:1.5}}>
          Recherche un membre et modifie directement ses valeurs (cumul, CA, recrues).
        </p>
        <input value={resetSearch} onChange={e=>{setResetSearch(e.target.value);setResetResult("");setResetUid("");}}
          placeholder="Rechercher par prénom ou nom..."
          style={{width:"100%",border:"1px solid #E6A817",borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",background:"white",outline:"none",marginBottom:".4rem"}}/>
        {resetSearch.length>=2&&(()=>{
          const filtres=membres.filter(m=>(m.prenom+" "+m.nom).toLowerCase().includes(resetSearch.toLowerCase())).slice(0,6);
          if(!filtres.length) return <div style={{fontSize:".7rem",color:"#B04040",marginBottom:".4rem"}}>Aucun membre trouvé</div>;
          return(
            <div style={{background:"white",border:"1px solid #E6A817",borderRadius:8,marginBottom:".4rem",overflow:"hidden"}}>
              {filtres.map(m=>(
                <div key={m.uid} onClick={async()=>{
                  setResetUid(m.uid);setResetSearch(m.prenom+" "+m.nom);
                  // Charger les valeurs actuelles
                  try{
                    const snap=await getDoc(doc(db,"users",m.uid));
                    if(snap.exists()){
                      const d=snap.data();
                      const obj2=d["db-obj-perso"]?JSON.parse(d["db-obj-perso"]):{};
                      setResetVals({
                        ca:obj2.ca||"",caPerso:obj2.caPerso||"",recruesReal:obj2.recruesReal||"0",
                        totalCaCumul:obj2.totalCaCumul||"0",totalRecruesCumul:obj2.totalRecruesCumul||"0",
                      });
                    }
                  }catch{}
                }}
                  style={{padding:".45rem .65rem",cursor:"pointer",borderBottom:"1px solid #FFF3CD",display:"flex",justifyContent:"space-between",alignItems:"center",background:resetUid===m.uid?"#FFF3CD":"white"}}>
                  <span style={{fontSize:".78rem",color:C.brun,fontWeight:resetUid===m.uid?700:400}}>{m.prenom} {m.nom}</span>
                </div>
              ))}
            </div>
          );
        })()}

        {resetUid&&(
          <div style={{background:"#FFF8E1",borderRadius:10,padding:".75rem",border:"1px solid #E6A817",marginBottom:".5rem"}}>
            <div style={{fontSize:".65rem",fontWeight:700,color:"#856404",marginBottom:".6rem"}}>✏️ {resetSearch} — valeurs modifiables</div>
            {[
              {label:"CA total période (€)",key:"ca"},
              {label:"Ventes perso (€)",key:"caPerso"},
              {label:"Recrues cette période",key:"recruesReal"},
              {label:"Cumul CA total (€)",key:"totalCaCumul"},
              {label:"Cumul recrues total",key:"totalRecruesCumul"},
            ].map(f=>(
              <div key={f.key} style={{display:"flex",alignItems:"center",gap:".5rem",marginBottom:".35rem"}}>
                <span style={{fontSize:".65rem",color:"#856404",flex:1}}>{f.label}</span>
                <input type="number" value={resetVals[f.key]||""} onChange={e=>setResetVals(p=>({...p,[f.key]:e.target.value}))}
                  style={{width:90,border:"1px solid #E6A817",borderRadius:6,padding:".28rem .45rem",fontSize:".8rem",fontFamily:"inherit",textAlign:"right",outline:"none",fontWeight:700}}/>
              </div>
            ))}
            <div style={{display:"flex",gap:".4rem",marginTop:".5rem"}}>
              <button onClick={async()=>{
                setResetSaving(true);
                try{
                  const ref=doc(db,"users",resetUid);
                  const snap=await getDoc(ref);
                  if(!snap.exists()){setResetResult("❌ Utilisateur non trouvé.");setResetSaving(false);return;}
                  const obj2=snap.data()["db-obj-perso"]?JSON.parse(snap.data()["db-obj-perso"]):{};
                  const next={...obj2,...resetVals};
                  await setDoc(ref,{"db-obj-perso":JSON.stringify(next)},{merge:true});
                  await syncAnnuaire(resetUid,resetSearch,next);
                  setResetResult("✅ Valeurs mises à jour pour "+resetSearch);
                  setResetUid("");setResetSearch("");setResetVals({});
                }catch(e){setResetResult("Erreur : "+e.message);}
                setResetSaving(false);
              }} disabled={resetSaving}
                style={{flex:1,background:"#856404",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {resetSaving?"Sauvegarde...":"✓ Appliquer"}
              </button>
              <button onClick={()=>{setResetUid("");setResetSearch("");setResetVals({});}}
                style={{flex:1,background:"#ccc",color:"white",border:"none",borderRadius:8,padding:".45rem",fontSize:".75rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}
        {resetResult&&<div style={{fontSize:".7rem",color:resetResult.startsWith("✅")?C.vert:"#B04040",marginTop:".3rem"}}>{resetResult}</div>}
      </div>
    </div>
  );
}

function AdminEbooksSection(){
  const[banniere,setBanniere]=useState({texte:"",couleur:"#C49A8A",lien:"",actif:false});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","linkbio_banniere"));
        if(snap.exists()) setBanniere(p=>({...p,...snap.data()}));
      }catch{}
    })();
  },[]);
  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","linkbio_banniere"),banniere);
      setSaved(true);setTimeout(()=>setSaved(false),2000);
    }catch{}
    setSaving(false);
  };
  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".6rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".75rem"}}>🔗 Bannière Link-in-Bio (toute l'équipe)</div>
      <p style={{fontSize:".7rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Cette bannière s'affichera sur la page de TOUTES les distributrices. Chaque membre peut choisir de l'afficher ou non.
      </p>
      <input value={banniere.texte} onChange={e=>setBanniere(p=>({...p,texte:e.target.value}))} placeholder="Ex: 🎉 Promo -20% jusqu'au 30 juin !"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <input value={banniere.lien} onChange={e=>setBanniere(p=>({...p,lien:e.target.value}))} placeholder="Lien (optionnel)"
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".4rem"}}/>
      <div style={{display:"flex",alignItems:"center",gap:".75rem",marginBottom:".5rem"}}>
        <div style={{fontSize:".7rem",color:C.gris}}>Couleur :</div>
        <input type="color" value={banniere.couleur} onChange={e=>setBanniere(p=>({...p,couleur:e.target.value}))} style={{width:32,height:28,border:"none",borderRadius:6,cursor:"pointer"}}/>
        <label style={{display:"flex",alignItems:"center",gap:".4rem",cursor:"pointer"}}>
          <input type="checkbox" checked={banniere.actif} onChange={e=>setBanniere(p=>({...p,actif:e.target.checked}))}/>
          <span style={{fontSize:".72rem",color:C.brun,fontWeight:600}}>Activer</span>
        </label>
      </div>
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"✓ Appliquer à toute l'équipe"}
      </button>
    </div>
  );
}

function AdminImportCatalogue(){
  const[importing,setImporting]=useState(false);
  const[result,setResult]=useState(null);
  const[stats,setStats]=useState(null);

  const CAT_MAP={
    'VISAGE':'face','CORPS':'corps','CHEVEUX':'hair',
    'Make Up':'makeup','PARFUMS':'parfums','SANTÉ':'health',
    'Hommes':'hommes','Enfants':'enfants','HOME':'home','Sets':'sets'
  };

  const handleFile=async(e)=>{
    const file=e.target.files?.[0];
    if(!file)return;
    setImporting(true);setResult(null);setStats(null);

    try{
      // Charger SheetJS depuis un tag script déjà présent (index.html) ou CDN via un élément script injecté
      const xlsx = await new Promise((resolve,reject)=>{
        if(window.XLSX){resolve(window.XLSX);return;}
        const s=document.createElement('script');
        s.src='https://cdn.sheetjs.com/xlsx-0.20.0/package/dist/xlsx.full.min.js';
        s.onload=()=>resolve(window.XLSX);
        s.onerror=()=>reject(new Error('SheetJS non chargé'));
        document.head.appendChild(s);
      });

      const buf=await file.arrayBuffer();
      const wb=xlsx.read(buf,{type:'array'});
      const ws=wb.Sheets[wb.SheetNames[0]];
      const rows=xlsx.utils.sheet_to_json(ws);

      const seen=new Set();
      const catalogue={};
      Object.values(CAT_MAP).forEach(k=>{catalogue[k]=[];});

      for(const row of rows){
        const art=String(row['Art']||'').replace('.0','').trim();
        if(!art||seen.has(art))continue;
        seen.add(art);
        const cat=row['Category']||'';
        const key=CAT_MAP[cat];
        if(!key)continue;
        const priceRaw=String(row['Price']||'').replace('€','').replace(',','.').trim();
        const prix=parseFloat(priceRaw)||0;
        const offerPriceRaw=String(row['Offer price']||'').replace('€','').replace(',','.').trim();
        catalogue[key].push({
          nom:String(row['Name']||''),
          prix,
          ref:art,
          serie:cat,
          offre:row['Offer']?String(row['Offer']):'',
          prixOffre:offerPriceRaw?parseFloat(offerPriceRaw)||0:'',
        });
      }

      const total=Object.values(catalogue).reduce((s,v)=>s+v.length,0);
      await setDoc(doc(db,"admin","catalogue_mihi"),catalogue);
      const statsObj={};
      Object.entries(catalogue).forEach(([k,v])=>{if(v.length)statsObj[k]=v.length;});
      setStats({total,details:statsObj});
      setResult("✅ Import réussi !");
    }catch(err){
      setResult("❌ Erreur : "+err.message);
    }
    setImporting(false);
    e.target.value="";
  };

  return(
    <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
      <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>📦 Import Catalogue Mihi (Excel)</div>
      <p style={{fontSize:".72rem",color:C.gris,marginBottom:".75rem",lineHeight:1.6}}>
        Sélectionne le fichier Excel du catalogue Mihi pour mettre à jour les produits dans l'application.
      </p>
      <label style={{display:"block",background:importing?C.pale:C.brun,color:"white",borderRadius:9,padding:".55rem",textAlign:"center",fontSize:".78rem",fontWeight:600,cursor:importing?"default":"pointer",fontFamily:"inherit"}}>
        {importing?"⏳ Import en cours...":"📂 Choisir le fichier Excel (.xlsx)"}
        <input type="file" accept=".xlsx,.xls" onChange={handleFile} style={{display:"none"}} disabled={importing}/>
      </label>
      {result&&<div style={{marginTop:".6rem",fontSize:".74rem",fontWeight:600,color:result.startsWith("✅")?C.vert:"#B04040"}}>{result}</div>}
      {stats&&(
        <div style={{background:C.creme,borderRadius:8,padding:".6rem .75rem",marginTop:".5rem"}}>
          <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".35rem"}}>{stats.total} produits importés :</div>
          <div style={{display:"flex",flexWrap:"wrap",gap:".3rem"}}>
            {Object.entries(stats.details).map(([k,v])=>(
              <span key={k} style={{fontSize:".62rem",background:C.pale,borderRadius:20,padding:".1rem .45rem",color:C.brun}}>{k}: {v}</span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function AdminTab({uid}){
  const[items,setItems]=useState([]);
  const[loading,setLoading]=useState(true);
  const[showAdd,setShowAdd]=useState(false);
  const[editId,setEditId]=useState(null);
  const[saving,setSaving]=useState(false);
  const[videosFastStart,setVideosFastStart]=useState({});
  const[anthropicKey,setAnthropicKey]=useState("");
  const[savingKey,setSavingKey]=useState(false);
  const[savedKey,setSavedKey]=useState(false);
  useEffect(()=>{(async()=>{try{const snap=await getDoc(doc(db,"admin","config"));if(snap.exists()&&snap.data().anthropicKey)setAnthropicKey(snap.data().anthropicKey);}catch{}})();},[]);
  const sauvegarderCle=async()=>{setSavingKey(true);try{await setDoc(doc(db,"admin","config"),{anthropicKey},{merge:true});ANTHROPIC_API_KEY=anthropicKey;setSavedKey(true);setTimeout(()=>setSavedKey(false),2000);}catch{}setSavingKey(false);};
  const[savingFS,setSavingFS]=useState(false);
  const[filterDest,setFilterDest]=useState("all");

  const EMPLACEMENTS=[
    {groupe:"🎓 Formation",options:[
      {id:"demarrage",       label:"Formation Démarrage"},
      {id:"vente",           label:"Formation Vente"},
      {id:"recrutement",     label:"Formation Recrutement"},
      {id:"contenu",         label:"Formation Contenu/Réseaux"},
      {id:"devperso",        label:"Développement Personnel Business"},
      {id:"videoannexe",     label:"Vidéos Annexes"},
      {id:"outils",          label:"Formation Outils"},
      {id:"formationapp",    label:"Formation App (général)"},
      {id:"formationchef",   label:"Formation App — Chef d'équipe"},
      {id:"dashboard",        label:"Formation App — Tableau de bord"},
      {id:"outils",           label:"Formation App — Outils généraux"},
    ]},
    {groupe:"🧴 Produits",options:[
      {id:"produits_parfum",      label:"Produits — Parfum"},
      {id:"produits_makeup",      label:"Produits — Maquillage"},
      {id:"produits_complement",  label:"Produits — Compléments alimentaires"},
      {id:"produits_poids",       label:"Produits — Perte de poids"},
      {id:"produits_skincare",    label:"Produits — Skincare"},
      {id:"produits_corpsoin",    label:"Produits — Soins corps"},
      {id:"produits_entretien",   label:"Produits — Entretien"},
    ]},
    {groupe:"🏠 Dashboard",options:[
      {id:"today_top",       label:"Aujourd'hui — En-tête"},
      {id:"today_bottom",    label:"Aujourd'hui — Bas de page"},
      {id:"annonces",        label:"Annonces équipe (popup)"},
    ]},
    {groupe:"📱 Réseaux / Posts",options:[
      {id:"posts_instagram", label:"Posts — Idées Instagram"},
      {id:"posts_facebook",  label:"Posts — Idées Facebook"},
      {id:"posts_stories",   label:"Posts — Idées Stories"},
    ]},
    {groupe:"🔗 Liens & Tunnels",options:[
      {id:"linkbio_liens",   label:"Link-in-Bio — Liens supplémentaires"},
      {id:"tunnel_vente",    label:"Tunnel Vente — Ressources"},
      {id:"tunnel_recrut",   label:"Tunnel Recrutement — Ressources"},
    ]},
  ];

  const TOUS_IDS=EMPLACEMENTS.flatMap(g=>g.options.map(o=>o.id));
  const getLabel=(id)=>{
    for(const g of EMPLACEMENTS) for(const o of g.options) if(o.id===id)return o.label;
    return id;
  };

  const TYPES=[
    {id:"video",    label:"▶ Vidéo Zoom",emoji:"🎬"},
    {id:"youtube",  label:"▶ YouTube",   emoji:"▶️"},
    {id:"drive",    label:"📄 Drive",    emoji:"📄"},
    {id:"doc",      label:"📝 Google Doc",emoji:"📝"},
    {id:"image",    label:"🖼️ Image",    emoji:"🖼️"},
    {id:"info",     label:"💡 Texte",    emoji:"💡"},
    {id:"lien",     label:"🔗 Lien",     emoji:"🔗"},
  ];

  const emptyForm={destination:TOUS_IDS[0],titre:"",description:"",url:"",type:"video",actif:true,image:""};
  const[form,setForm]=useState(emptyForm);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","contenus"));
        if(snap.exists())setItems(snap.data().items||[]);
      }catch{}
      try{
        const snap2=await getDoc(doc(db,"admin","videos_faststart"));
        if(snap2.exists())setVideosFastStart(snap2.data().videos||{});
      }catch{}
      setLoading(false);
    })();
  },[]);

  const saveItems=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","contenus"),{items:next});}catch{}
    setSaving(false);
  };

  const saveVideoFS=async(v)=>{
    setSavingFS(true);
    try{await setDoc(doc(db,"admin","videos_faststart"),{videos:v});}catch{}
    setVideosFastStart(v);
    setSavingFS(false);
  };

  const add=async()=>{
    if(!form.titre.trim())return;
    let next;
    if(editId){
      next=items.map(it=>it.id===editId?{...it,...form}:it);
    } else {
      next=[...items,{id:`adm${Date.now()}`,...form}];
    }
    setItems(next);
    await saveItems(next);
    setForm(emptyForm);setShowAdd(false);setEditId(null);
  };

  const del=async(id)=>{
    if(!window.confirm("Supprimer ce contenu ?"))return;
    const next=items.filter(it=>it.id!==id);
    setItems(next);await saveItems(next);
  };

  const toggle=async(id)=>{
    const next=items.map(it=>it.id===id?{...it,actif:!it.actif}:it);
    setItems(next);await saveItems(next);
  };

  const startEdit=(it)=>{
    setForm({destination:it.destination||it.onglet||TOUS_IDS[0],titre:it.titre||"",description:it.description||"",url:it.url||"",type:it.type||"video",actif:it.actif!==false,image:it.image||""});
    setEditId(it.id);setShowAdd(true);
  };

  if(loading)return<div style={{textAlign:"center",padding:"2rem",color:C.gris}}>Chargement...</div>;

  const itemsFiltres=filterDest==="all"?items:items.filter(it=>(it.destination||it.onglet)===filterDest);
  const SEL=({label,field,options,small=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      <select value={form[field]} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))}
        style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:small?".35rem .5rem":".42rem .65rem",fontSize:small?".75rem":".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
        {options}
      </select>
    </div>
  );
  const INP=({label,field,placeholder,textarea=false})=>(
    <div style={{marginBottom:".5rem"}}>
      <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>{label}</div>
      {textarea
        ?<textarea value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder} rows={3}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",resize:"vertical",lineHeight:1.6}}/>
        :<input value={form[field]||""} onChange={e=>setForm(p=>({...p,[field]:e.target.value}))} placeholder={placeholder}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
      }
    </div>
  );

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Espace <em style={{fontStyle:"italic",color:C.rose}}>Admin</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Ajoute du contenu à n'importe quel endroit du site — formations, vidéos, annonces, ressources.
      </p>

      {/* Sections fixes */}
      <AdminLinkBioSection/>
      <AdminConfigPeriodes/>
      <AdminImportCatalogue/>
      <AdminFormationProduits/>

      {/* Fast Start vidéos */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1.25rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".75rem"}}>🚀 Vidéos Fast Start — 7 modules</div>
        {FAST_START_DAYS.map(d=>{
          const key=`module${d.jour}`;
          const cur=videosFastStart[key]||{url:"",type:"youtube"};
          return(
            <div key={d.jour} style={{marginBottom:".6rem",paddingBottom:".6rem",borderBottom:`1px solid ${C.pale}`}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".3rem"}}>Module {d.jour} — {d.titre.split("—")[0].trim()}</div>
              <div style={{display:"flex",gap:".4rem"}}>
                <select value={cur.type} onChange={e=>{const v={...videosFastStart,[key]:{...cur,type:e.target.value}};saveVideoFS(v);}}
                  style={{border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .4rem",fontSize:".72rem",fontFamily:"inherit",background:C.creme,outline:"none",flexShrink:0}}>
                  <option value="youtube">YouTube</option>
                  <option value="video">Zoom</option>
                  <option value="drive">Drive</option>
                </select>
                <input value={cur.url} onChange={e=>{const v={...videosFastStart,[key]:{...cur,url:e.target.value}};setVideosFastStart(v);}}
                  onBlur={()=>saveVideoFS(videosFastStart)}
                  placeholder="URL de la vidéo"
                  style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:7,padding:".35rem .55rem",fontSize:".75rem",fontFamily:"inherit",background:C.creme,outline:"none"}}/>
              </div>
            </div>
          );
        })}
        {savingFS&&<div style={{fontSize:".65rem",color:C.vert,textAlign:"right"}}>Sauvegardé ✓</div>}
      </div>

      {/* ── CONTENU LIBRE ── */}
      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".75rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose}}>📦 Contenu libre — {items.length} éléments</div>
          <button onClick={()=>{setShowAdd(!showAdd);setForm(emptyForm);setEditId(null);}}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".35rem .75rem",fontSize:".72rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
            {showAdd&&!editId?"✕ Annuler":"+ Ajouter"}
          </button>
        </div>

        {/* Formulaire ajout/édition */}
        {showAdd&&(
          <div style={{background:C.creme,borderRadius:10,padding:".85rem",marginBottom:".75rem",border:`1px solid ${C.pale}`}}>
            <div style={{fontSize:".68rem",fontWeight:700,color:C.brun,marginBottom:".65rem"}}>{editId?"✏️ Modifier":"+ Nouveau contenu"}</div>

            {/* Destination */}
            <div style={{marginBottom:".5rem"}}>
              <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem",fontWeight:600,textTransform:"uppercase",letterSpacing:".08em"}}>📍 Où afficher ce contenu ?</div>
              <select value={form.destination} onChange={e=>setForm(p=>({...p,destination:e.target.value}))}
                style={{width:"100%",border:`1.5px solid ${C.rose}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.brun,background:"white",outline:"none",fontWeight:600}}>
                {EMPLACEMENTS.map(g=>(
                  <optgroup key={g.groupe} label={g.groupe}>
                    {g.options.map(o=><option key={o.id} value={o.id}>{o.label}</option>)}
                  </optgroup>
                ))}
              </select>
            </div>

            <SEL label="Type de contenu" field="type" options={TYPES.map(t=><option key={t.id} value={t.id}>{t.emoji} {t.label}</option>)}/>
            <INP label="Titre *" field="titre" placeholder="Ex: Comment aborder une inconnue sur Instagram"/>
            <INP label="Description" field="description" placeholder="Résumé, conseils..." textarea/>
            {["video","youtube","drive","doc","lien"].includes(form.type)&&
              <INP label="URL" field="url" placeholder="https://..."/>
            }
            {form.type==="image"&&
              <UploadPhoto label="Image" value={form.image} onChange={v=>setForm(p=>({...p,image:v}))} folder="admin-contenu"/>
            }
            <label style={{display:"flex",alignItems:"center",gap:".5rem",fontSize:".75rem",color:C.brun,cursor:"pointer",marginTop:".25rem"}}>
              <input type="checkbox" checked={!!form.actif} onChange={e=>setForm(p=>({...p,actif:e.target.checked}))}/>
              Visible immédiatement
            </label>
            <div style={{display:"flex",gap:".4rem",marginTop:".65rem"}}>
              <button onClick={add} disabled={saving||!form.titre.trim()}
                style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {saving?"Sauvegarde...":editId?"✓ Modifier":"✓ Ajouter"}
              </button>
              <button onClick={()=>{setShowAdd(false);setEditId(null);setForm(emptyForm);}}
                style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
                Annuler
              </button>
            </div>
          </div>
        )}

        {/* Filtre par destination */}
        <div style={{marginBottom:".65rem"}}>
          <select value={filterDest} onChange={e=>setFilterDest(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".4rem .65rem",fontSize:".76rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
            <option value="all">Tous les contenus ({items.length})</option>
            {EMPLACEMENTS.map(g=>(
              <optgroup key={g.groupe} label={g.groupe}>
                {g.options.map(o=>{
                  const n=items.filter(it=>(it.destination||it.onglet)===o.id).length;
                  return<option key={o.id} value={o.id}>{o.label} ({n})</option>;
                })}
              </optgroup>
            ))}
          </select>
        </div>

        {/* Liste items */}
        {itemsFiltres.length===0&&<div style={{textAlign:"center",fontSize:".72rem",color:C.gris,padding:".75rem",fontStyle:"italic"}}>Aucun contenu{filterDest!=="all"?" dans cet emplacement":""}</div>}
        {itemsFiltres.map(it=>{
          const T=TYPES.find(t=>t.id===it.type)||TYPES[0];
          return(
            <div key={it.id} style={{display:"flex",alignItems:"center",gap:".5rem",background:it.actif?C.creme:"#f0f0f0",borderRadius:9,padding:".5rem .75rem",marginBottom:".35rem",border:`1px solid ${it.actif?C.pale:"#ddd"}`,opacity:it.actif?1:.7}}>
              <span style={{fontSize:"1rem",flexShrink:0}}>{T.emoji}</span>
              <div style={{flex:1,minWidth:0}}>
                <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,overflow:"hidden",textOverflow:"ellipsis",whiteSpace:"nowrap"}}>{it.titre}</div>
                <div style={{fontSize:".6rem",color:C.rose,fontWeight:600}}>📍 {getLabel(it.destination||it.onglet||"")}</div>
              </div>
              <button onClick={()=>toggle(it.id)} title={it.actif?"Masquer":"Afficher"}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:it.actif?C.vert:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                {it.actif?"👁️":"🙈"}
              </button>
              <button onClick={()=>startEdit(it)}
                style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✏️</button>
              <button onClick={()=>del(it.id)}
                style={{background:"none",border:`1px solid #E0C0C0`,borderRadius:6,padding:".18rem .35rem",fontSize:".65rem",color:"#B04040",cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          );
        })}
      </div>

      {/* Clé API Anthropic */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".5rem"}}>🔑 Clé API Anthropic (IA)</div>
        <div style={{fontSize:".72rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Renouvelle-la si les diagnostics IA ne fonctionnent plus.</div>
        <input type="password" placeholder="sk-ant-api03-..." value={anthropicKey} onChange={e=>setAnthropicKey(e.target.value)}
          style={{width:"100%",border:"1px solid "+C.pale,borderRadius:8,padding:".45rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:"white",outline:"none",marginBottom:".5rem"}}/>
        <button onClick={sauvegarderCle} disabled={savingKey||!anthropicKey.trim()}
          style={{background:C.brun,color:"white",border:"none",borderRadius:8,padding:".45rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          {savingKey?"...":savedKey?"✅ Sauvegardée !":"💾 Sauvegarder la clé"}
        </button>
      </div>

      {/* Scripts personnalisés */}
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid "+C.pale}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.brun,marginBottom:".75rem"}}>📝 Scripts personnalisés</div>
        <AdminScriptsEditor/>
      </div>
      {/* Nettoyage mdp */}
      <div style={{background:"#FFF0F0",borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid #E0C0C0"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#B04040",marginBottom:".5rem"}}>🔐 Réinitialiser les codes personnels</div>
        <div style={{fontSize:".72rem",color:"#888",marginBottom:".75rem",lineHeight:1.5}}>Supprime tous les db-mdp existants. Les membres devront créer un nouveau code à leur prochaine connexion.</div>
        <button onClick={async()=>{
          if(!window.confirm("Supprimer tous les codes personnels ?"))return;
          try{
            const {getDocs,collection,writeBatch}=await import("firebase/firestore");
            const snap=await getDocs(collection(db,"users"));
            const batch=writeBatch(db);
            const {deleteField}=await import("firebase/firestore");
            snap.docs.forEach(d=>{if(d.data()["db-mdp"])batch.update(d.ref,{"db-mdp":deleteField()});});
            await batch.commit();
            alert("✅ Codes supprimés !");
          }catch(e){alert("Erreur: "+e.message);}
        }} style={{background:"#B04040",color:"white",border:"none",borderRadius:8,padding:".55rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          🗑️ Supprimer tous les codes
        </button>
      </div>
      <div style={{background:"#F0F7FF",borderRadius:12,padding:"1rem",marginTop:"1rem",border:"1px solid #B0C4DE"}}>
        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#1a5276",marginBottom:".5rem"}}>🔄 Forcer la mise à jour pour tous</div>
        <div style={{fontSize:".72rem",color:"#888",marginBottom:".75rem",lineHeight:1.5}}>Force toutes les membres a recharger l app au prochain chargement.</div>
        <button onClick={async()=>{try{await setDoc(doc(db,"admin","config"),{forceReload:Date.now()},{merge:true});alert("Mise a jour forcee !");}catch(e){alert("Erreur: "+e.message);}}}
          style={{background:"#1a5276",color:"white",border:"none",borderRadius:8,padding:".55rem 1rem",fontSize:".75rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          🔄 Forcer la mise a jour
        </button>
      </div>
      <div style={{marginTop:"1.5rem",background:"#F0F7F2",border:"1px solid #5C8A6A40",borderRadius:12,padding:"1rem"}}>
        <div style={{fontSize:".62rem",fontWeight:700,color:"#3A6A4A",letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>💾 Backup données</div>
        <button onClick={async()=>{try{const snap=await getDoc(doc(db,"users",uid));const data=snap.exists()?snap.data():{};const json=JSON.stringify(data,null,2);const blob=new Blob([json],{type:"application/json"});const url=URL.createObjectURL(blob);const a=document.createElement("a");a.href=url;a.download="backup-"+new Date().toISOString().slice(0,10)+".json";document.body.appendChild(a);a.click();document.body.removeChild(a);URL.revokeObjectURL(url);}catch(e){alert("Erreur: "+e);}}} style={{background:"#3A6A4A",color:"white",border:"none",borderRadius:10,padding:".55rem 1rem",fontSize:".78rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>⬇️ Télécharger backup JSON</button>
      </div>
    </div>
  );
}



function DevPersoSection({adminItems}){
  const[dvpTab,setDvpTab]=useState("business");
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>
        Développement <em style={{fontStyle:"italic",color:C.rose}}>Personnel</em>
      </div>
      <div style={{display:"flex",gap:".35rem",marginBottom:"1rem"}}>
        {[{id:"business",label:"🧠 Business"},{id:"annexe",label:"🎥 Vidéos annexes"}].map(t=>(
          <button key={t.id} onClick={()=>setDvpTab(t.id)}
            style={{flex:1,padding:".5rem",fontSize:".75rem",fontWeight:600,borderRadius:10,border:`1.5px solid ${dvpTab===t.id?C.rose:C.pale}`,background:dvpTab===t.id?C.rose:C.blanc,color:dvpTab===t.id?"white":C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {t.label}
          </button>
        ))}
      </div>
      {dvpTab==="business"&&(
        <div>
          <AdminContentBlock onglet="devperso" items={adminItems}/>
          {[
            {icon:"🧠",title:"Dégommer son plafond de verre",desc:"Identifier les croyances limitantes qui t'empêchent d'avancer et les transformer en force.",video:"https://us06web.zoom.us/rec/share/XzuZHzXLLZdVOz2rQmBb-7nomO9qxTj92_xluvzizpzlSaYfxRdmTARqoDTdatzs.EHObmbNT1mpbo0Ad"},
            {icon:"🎯",title:"Fixer ses objectifs — méthode complète",desc:"Des objectifs qui fonctionnent vraiment.",video:"https://us06web.zoom.us/rec/share/E1JtWx4furUdNFt4wKKCJYcfD4ScYwhJZ3BfUnHZYOnbUzcRYLzdLq5WuoyJSjw.MsevJMjQXIrzr1rp?startTime=1771357741000"},
            {icon:"👑",title:"Développer son leadership",desc:"Comment inspirer, guider et faire grandir son équipe.",video:"https://us06web.zoom.us/rec/share/hnDWdngAPCK_SGVTYzVhgk70t_nqqfesUvZF7hme8CaEgL-CpszXoantB-d2MSPZ.Yl7wHQ7KV9pZJnCL"},
            {icon:"📱",title:"Personal branding",desc:"Qui tu es en ligne = qui tu attires.",video:"https://youtu.be/j5EUiKmUSgM"},
            {icon:"🤝",title:"Humaniser son contenu",desc:"Pourquoi les gens achètent à des personnes, pas à des marques.",video:"https://youtu.be/WxJFBnigjpw"},
            {icon:"📖",title:"Le storytelling",desc:"Raconter pour vendre, pour convaincre, pour recruter.",video:"https://youtu.be/dgylHebkai4"},
          ].map(item=>(
            <div key={item.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
              <div style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:item.video?".6rem":0}}>
                <span style={{fontSize:"1.1rem",flexShrink:0}}>{item.icon}</span>
                <div style={{flex:1}}>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".9rem",fontWeight:600,color:C.brun,marginBottom:".15rem"}}>{item.title}</div>
                  <div style={{fontSize:".72rem",color:C.gris,lineHeight:1.55}}>{item.desc}</div>
                </div>
              </div>
              {item.video&&<YTBtn href={item.video} label="▶ Voir la formation"/>}
            </div>
          ))}
        </div>
      )}
      {dvpTab==="annexe"&&(
        <div>
          <AdminContentBlock onglet="videoannexe" items={adminItems}/>
          <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",fontSize:".75rem",color:C.gris,lineHeight:1.65}}>
            💡 Les vidéos annexes sont ajoutées depuis l'espace Admin.
          </div>
        </div>
      )}
    </div>
  );
}

function AdminContentBlock({onglet,items}){
  const {lang} = useLang();
  const filtered=(items||[]).filter(i=>(i.destination||i.onglet)===onglet&&i.actif!==false);
  if(filtered.length===0)return null;

  const typeConfig={
    video:{icon:"▶",color:"#8B1A1A",label:"Zoom"},
    youtube:{icon:"▶",color:"#8B1A1A",label:"YouTube"},
    drive:{icon:"📄",color:"#5C3020",label:"Drive"},
    doc:{icon:"📝",color:"#1a4a8b",label:"Doc"},
    info:{icon:"💡",color:"#5C8A60",label:"Info"},
  };

  return(
    <div style={{marginTop:".5rem"}}>
      <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".4rem"}}>✦ Ajouté par Melissa</div>
      {filtered.map(item=>{
        const cfg=typeConfig[item.type]||typeConfig.info;
        return <AdminContentItem key={item.id} item={item} cfg={cfg} lang={lang}/>;
      })}
    </div>
  );
}

function AdminContentItem({item,cfg,lang}){
  const[titre,setTitre]=useState(item.titre||"");
  const[desc,setDesc]=useState(item.description||"");

  useEffect(()=>{
    if(lang==="fr"){setTitre(item.titre||"");setDesc(item.description||"");return;}
    const toTr=[item.titre||"",item.description||""].filter(Boolean);
    if(!toTr.length)return;
    translateBatch(toTr,lang).then(res=>{
      setTitre(res[0]||item.titre);
      if(item.description) setDesc(res[1]||item.description);
    });
  },[lang,item.id]);

  return(
    <div style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem"}}>
      <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:desc?".2rem":item.url?".35rem":0}}>{titre}</div>
      {desc&&<div style={{fontSize:".72rem",color:C.gris,lineHeight:1.5,marginBottom:item.url?".4rem":0}}>{desc}</div>}
      {item.url&&(
        <a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:".5rem",background:cfg.color,borderRadius:8,padding:".45rem .8rem",textDecoration:"none",marginTop:".1rem"}}>
          <span style={{fontSize:".8rem",flexShrink:0}}>{cfg.icon}</span>
          <span style={{fontSize:".72rem",fontWeight:600,color:"white"}}>
            {lang==="pt"?"Abrir":"Ouvrir"} — {cfg.label}
          </span>
          <span style={{marginLeft:"auto",color:"rgba(255,255,255,.6)",fontSize:".6rem"}}>→</span>
        </a>
      )}
    </div>
  );
}

// ── ADMIN POSTS EDITOR ───────────────────────────────────────────────────────
function AdminPostsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({theme:"",hook:"",caption:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","posts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","posts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.theme.trim()||!form.hook.trim()||!form.caption.trim())return;
    const postId="adm-post-"+Date.now();
    const themeKey=form.theme.trim();
    const existing=items.find(t=>t.theme===themeKey);
    let next;
    if(existing){
      next=items.map(t=>t.theme===themeKey?{...t,posts:[...t.posts,{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}:t);
    } else {
      next=[...items,{theme:themeKey,color:C.or,posts:[{id:postId,hook:form.hook.trim(),caption:form.caption.trim()}]}];
    }
    save(next);
    setForm({theme:"",hook:"",caption:""});
    setShowAdd(false);
  };

  const delPost=(themeKey,postId)=>{
    let next=items.map(t=>t.theme===themeKey?{...t,posts:t.posts.filter(p=>p.id!==postId)}:t).filter(t=>t.posts.length>0);
    save(next);
  };

  const totalPosts=items.reduce((a,t)=>a+t.posts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter une idée de post ({totalPosts})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouvelle idée</div>
          <input placeholder="Thème (ex: 🎉 Promo de printemps)" value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Hook (1ère phrase qui accroche)" value={form.hook} onChange={e=>setForm(p=>({...p,hook:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Caption complète (avec CTA)" value={form.caption} onChange={e=>setForm(p=>({...p,caption:e.target.value}))}
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(theme=>(
        <div key={theme.theme} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{theme.theme}</div>
          {theme.posts.map(post=>(
            <div key={post.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{post.hook}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{post.caption}</div>
              </div>
              <button onClick={()=>delPost(theme.theme,post.id)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucune idée ajoutée encore.</div>}
    </div>
  );
}

// ── ADMIN SCRIPTS EDITOR ─────────────────────────────────────────────────────
function AdminScriptsEditor(){
  const[items,setItems]=useState([]);
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({cat:"",title:"",text:""});

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","scripts_extra"));
        if(snap.exists()) setItems(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async(next)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","scripts_extra"),{items:next});}catch{}
    setItems(next);
    setSaving(false);
  };

  const add=()=>{
    if(!form.cat.trim()||!form.title.trim()||!form.text.trim())return;
    const catKey=form.cat.trim();
    const existing=items.find(c=>c.cat===catKey);
    let next;
    if(existing){
      next=items.map(c=>c.cat===catKey?{...c,scripts:[...c.scripts,{title:form.title.trim(),text:form.text.trim()}]}:c);
    } else {
      next=[...items,{cat:catKey,scripts:[{title:form.title.trim(),text:form.text.trim()}]}];
    }
    save(next);
    setForm({cat:"",title:"",text:""});
    setShowAdd(false);
  };

  const delScript=(catKey,title)=>{
    let next=items.map(c=>c.cat===catKey?{...c,scripts:c.scripts.filter(s=>s.title!==title)}:c).filter(c=>c.scripts.length>0);
    save(next);
  };

  const total=items.reduce((a,c)=>a+c.scripts.length,0);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      <button onClick={()=>setShowAdd(p=>!p)}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
        ➕ Ajouter un script ({total})
      </button>

      {showAdd&&(
        <div style={{background:C.creme,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau script</div>
          <input placeholder="Catégorie (ex: 💬 Premier contact)" value={form.cat} onChange={e=>setForm(p=>({...p,cat:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <input placeholder="Titre du script" value={form.title} onChange={e=>setForm(p=>({...p,title:e.target.value}))}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".45rem"}}/>
          <textarea placeholder="Texte du script" value={form.text} onChange={e=>setForm(p=>({...p,text:e.target.value}))}
            style={{width:"100%",minHeight:90,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .65rem",fontFamily:"inherit",fontSize:".78rem",color:C.texte,background:C.blanc,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".6rem"}}/>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving} style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)} style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".5rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {items.map(cat=>(
        <div key={cat.cat} style={{marginBottom:".75rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",padding:".2rem .6rem",background:C.or+"20",color:C.brun2,borderRadius:20,display:"inline-block",marginBottom:".4rem"}}>{cat.cat}</div>
          {cat.scripts.map(s=>(
            <div key={s.title} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:9,padding:".55rem .75rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1}}>
                <div style={{fontSize:".75rem",fontWeight:600,color:C.brun}}>{s.title}</div>
                <div style={{fontSize:".68rem",color:C.gris,marginTop:".15rem"}}>{s.text}</div>
              </div>
              <button onClick={()=>delScript(cat.cat,s.title)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      ))}
      {items.length===0&&<div style={{fontSize:".73rem",color:C.gris,fontStyle:"italic"}}>Aucun script ajouté encore.</div>}
    </div>
  );
}

// ── ADMIN TEXTES EDITOR ──────────────────────────────────────────────────────
function AdminTextesEditor(){
  const[citations,setCitations]=useState([]);
  const[messageAccueil,setMessageAccueil]=useState("");
  const[loaded,setLoaded]=useState(false);
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[newCitation,setNewCitation]=useState("");

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","textes"));
        if(snap.exists()){
          const d=snap.data();
          setCitations(d.citations||CITATIONS_DEFAULT);
          setMessageAccueil(d.messageAccueil||"");
        } else {
          setCitations(CITATIONS_DEFAULT);
        }
      }catch{
        setCitations(CITATIONS_DEFAULT);
      }
      setLoaded(true);
    })();
  },[]);

  const save=async(nextCitations,nextMsg)=>{
    setSaving(true);
    try{await setDoc(doc(db,"admin","textes"),{citations:nextCitations,messageAccueil:nextMsg});}catch{}
    setSaving(false);
    setSaved(true);
    setTimeout(()=>setSaved(false),2000);
  };

  const addCitation=()=>{
    if(!newCitation.trim())return;
    const next=[...citations,newCitation.trim()];
    setCitations(next);
    setNewCitation("");
    save(next,messageAccueil);
  };

  const delCitation=(idx)=>{
    const next=citations.filter((_,i)=>i!==idx);
    setCitations(next);
    save(next,messageAccueil);
  };

  const saveMsg=()=>save(citations,messageAccueil);

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {/* Message d'accueil équipe */}
      <div style={{marginBottom:"1.25rem"}}>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>👋 Message d'accueil (page d'accueil de l'équipe)</div>
        <textarea
          placeholder="Ex: Bienvenue dans ton espace Blazing Dynasty ! On est fières de t'avoir avec nous 🖤"
          value={messageAccueil}
          onChange={e=>setMessageAccueil(e.target.value)}
          style={{width:"100%",minHeight:70,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6,marginBottom:".5rem"}}/>
        <button onClick={saveMsg} disabled={saving}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
          {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder le message"}
        </button>
      </div>

      {/* Citations */}
      <div>
        <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".4rem"}}>✨ Citations motivantes ({citations.length})</div>
        <p style={{fontSize:".68rem",color:C.gris,marginBottom:".5rem",lineHeight:1.5}}>Une citation différente s'affiche chaque jour sur la page d'accueil, dans l'ordre du jour de l'année (rotation automatique).</p>
        <div style={{display:"flex",gap:".4rem",marginBottom:".75rem"}}>
          <input placeholder="Nouvelle citation..." value={newCitation} onChange={e=>setNewCitation(e.target.value)}
            onKeyDown={e=>e.key==="Enter"&&addCitation()}
            style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          <button onClick={addCitation} disabled={saving||!newCitation.trim()}
            style={{background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".42rem .8rem",fontSize:".76rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",flexShrink:0}}>
            Ajouter
          </button>
        </div>
        <div style={{maxHeight:280,overflowY:"auto"}}>
          {citations.map((c,i)=>(
            <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:8,padding:".5rem .7rem",marginBottom:".3rem",display:"flex",gap:".5rem",alignItems:"flex-start"}}>
              <div style={{flex:1,fontSize:".74rem",color:C.texte,fontStyle:"italic",lineHeight:1.5}}>{c}</div>
              <button onClick={()=>delCitation(i)} style={{background:"none",border:"none",color:"#B04040",cursor:"pointer",fontSize:".7rem",padding:".15rem",fontFamily:"inherit",flexShrink:0}}>✕</button>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
}

// ── BANQUE D'IMAGES ───────────────────────────────────────────────────────────
const THEMES_IMAGES=[
  {id:"skincare",icon:"✨",label:"Skincare"},
  {id:"cheveux",icon:"💇",label:"Soins cheveux"},
  {id:"makeup",icon:"💄",label:"Make-up"},
  {id:"complements",icon:"💊",label:"Compléments"},
  {id:"parfums",icon:"🌸",label:"Parfums"},
  {id:"corps",icon:"🧴",label:"Soin corps"},
  {id:"home",icon:"🏠",label:"HOME"},
  {id:"perte_poids",icon:"⚖️",label:"Perte de poids"},
  {id:"recrutement",icon:"👑",label:"Recrutement"},
  {id:"outils",icon:"🛠️",label:"Outils équipe"},
];

function BanqueImagesTab({isMelissa}){
  const[images,setImages]=useState([]);
  const[theme,setTheme]=useState("skincare");
  const[sousTheme,setSousTheme]=useState("visuels");
  const[showAdd,setShowAdd]=useState(false);
  const[form,setForm]=useState({titre:"",url:"",theme:"skincare",sousTheme:"visuels",type:"image"});
  const[saving,setSaving]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"banque","images"));
        if(snap.exists()) setImages(snap.data().items||[]);
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const saveImages=async(items)=>{
    setSaving(true);
    try{await setDoc(doc(db,"banque","images"),{items});}catch{}
    setSaving(false);
  };

  const add=async()=>{
    if(!form.titre.trim()||!form.url.trim())return;
    const item={id:`img${Date.now()}`,...form};
    const next=[...images,item];
    setImages(next);await saveImages(next);
    setForm({titre:"",url:"",theme:"skincare",sousTheme:"visuels",type:"image"});
    setShowAdd(false);
  };

  const del=async(id)=>{
    const next=images.filter(i=>i.id!==id);
    setImages(next);await saveImages(next);
  };

  const filtered=images.filter(i=>i.theme===theme&&i.sousTheme===sousTheme);

  if(!loaded)return <div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".8rem"}}>Chargement...</div>;

  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Banque <em style={{fontStyle:"italic",color:C.rose}}>d'Images</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Télécharge les visuels et témoignages pour tes publications.
      </p>

      {isMelissa&&(
        <button onClick={()=>setShowAdd(p=>!p)}
          style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:10,padding:".6rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>
          ➕ Ajouter image / video
        </button>
      )}

      {showAdd&&isMelissa&&(
        <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".6rem"}}>Nouveau contenu</div><div style={{display:"flex",gap:".4rem",marginBottom:".5rem"}}><button onClick={()=>setForm(p=>({...p,type:"image"}))} style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:"2px solid "+(form.type!=="video"?C.brun:C.pale),background:form.type!=="video"?C.brun:C.blanc,color:form.type!=="video"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>📸 Photo</button><button onClick={()=>setForm(p=>({...p,type:"video"}))} style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:"2px solid "+(form.type==="video"?C.brun:C.pale),background:form.type==="video"?C.brun:C.blanc,color:form.type==="video"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>🎥 Video</button></div>
          {form.type==="video"?<input placeholder="URL video YouTube TikTok Instagram" value={form.url} onChange={e=>setForm(p=>({...p,url:e.target.value}))} style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:8,padding:".42rem .65rem",fontSize:".8rem",fontFamily:"inherit",outline:"none",marginBottom:".45rem"}}/>:<UploadPhoto label="Photo" value={form.url} onChange={v=>setForm(p=>({...p,url:v}))} folder="banque-images"/>}
          <div style={{display:"flex",gap:".4rem",marginBottom:".45rem",marginTop:".3rem"}}>
            <select value={form.theme} onChange={e=>setForm(p=>({...p,theme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              {THEMES_IMAGES.map(t=><option key={t.id} value={t.id}>{t.icon} {t.label}</option>)}
            </select>
            <select value={form.sousTheme} onChange={e=>setForm(p=>({...p,sousTheme:e.target.value}))}
              style={{flex:1,border:`1px solid ${C.pale}`,borderRadius:8,padding:".42rem .65rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}>
              <option value="visuels">📸 Visuels</option>
              <option value="temoignages">💬 Témoignages</option>
            </select>
          </div>
          <div style={{display:"flex",gap:".4rem"}}>
            <button onClick={add} disabled={saving||!form.titre.trim()||!form.url.trim()}
              style={{flex:1,background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              {saving?"...":"Ajouter"}
            </button>
            <button onClick={()=>setShowAdd(false)}
              style={{flex:1,background:C.pale,color:C.gris,border:"none",borderRadius:8,padding:".52rem",fontSize:".78rem",fontFamily:"inherit",cursor:"pointer"}}>
              Annuler
            </button>
          </div>
        </div>
      )}

      {/* Filtres thèmes */}
      <div style={{display:"flex",gap:".3rem",overflowX:"auto",marginBottom:".75rem",paddingBottom:".3rem"}}>
        {THEMES_IMAGES.map(t=>(
          <button key={t.id} onClick={()=>setTheme(t.id)}
            style={{flex:"none",padding:".35rem .7rem",fontSize:".65rem",fontWeight:600,borderRadius:20,border:`1px solid ${theme===t.id?C.rose:C.pale}`,background:theme===t.id?C.rose:C.blanc,color:theme===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
            {t.icon} {t.label}
          </button>
        ))}
      </div>

      {/* Sous-thème */}
      <div style={{display:"flex",gap:".4rem",marginBottom:"1rem"}}>
        {[{id:"visuels",label:"📸 Visuels"},{id:"temoignages",label:"💬 Témoignages"}].map(s=>(
          <button key={s.id} onClick={()=>setSousTheme(s.id)}
            style={{flex:1,padding:".4rem",fontSize:".72rem",fontWeight:600,borderRadius:9,border:`1px solid ${sousTheme===s.id?C.brun:C.pale}`,background:sousTheme===s.id?C.brun:C.blanc,color:sousTheme===s.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
            {s.label}
          </button>
        ))}
      </div>

      {/* Grille d'images */}
      {filtered.length===0&&(
        <div style={{textAlign:"center",padding:"2.5rem 1rem",color:C.gris}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🖼️</div>
          <div style={{fontSize:".76rem"}}>
            {isMelissa?"Aucune image dans cette catégorie. Ajoutes-en une !":"Melissa n'a pas encore ajouté d'images ici."}
          </div>
        </div>
      )}
      <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".65rem"}}>
        {filtered.map(img=>(
          <div key={img.id} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,overflow:"hidden",position:"relative"}}>
            <div style={{aspectRatio:"1",background:C.creme,overflow:"hidden",cursor:"pointer"}}
              onClick={()=>window.open(img.url,"_blank")}>
              <img src={img.url} alt={img.titre}
                style={{width:"100%",height:"100%",objectFit:"cover"}}
                onError={e=>{e.target.style.display="none";}}/>
            </div>
            <div style={{padding:".5rem .65rem"}}>
              <div style={{fontSize:".72rem",fontWeight:600,color:C.brun,marginBottom:".35rem"}}>{img.titre}</div>
              <div style={{display:"flex",gap:".3rem"}}>
                <a href={img.url} download target="_blank" rel="noopener noreferrer"
                  style={{flex:1,background:C.brun,color:C.blanc,borderRadius:7,padding:".3rem",fontSize:".65rem",fontWeight:600,textDecoration:"none",textAlign:"center",display:"block"}}>
                  ⬇ Télécharger
                </a>
                {isMelissa&&(
                  <button onClick={()=>del(img.id)}
                    style={{background:"none",border:`1px solid ${C.pale}`,borderRadius:7,padding:".3rem .5rem",color:"#B04040",cursor:"pointer",fontSize:".65rem",fontFamily:"inherit"}}>✕</button>
                )}
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}

// ── DIAGNOSTICS ───────────────────────────────────────────────────────────────

// ── DIAGNOSTIC BUSINESS (recrutement / ventes / réseaux) ─────────────────────
export default App;
