import { useState, useEffect } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { C } from './constants';
import App from './App';
import { SCRIPTS_DATA } from './App';
import { todayLocalStr } from './utils';

let ANTHROPIC_API_KEY = '';
async function chargerCleAPI(){try{const snap=await getDoc(doc(db,'admin','config'));if(snap.exists()&&snap.data().anthropicKey)ANTHROPIC_API_KEY=snap.data().anthropicKey;}catch{}}
chargerCleAPI();

async function genererDiagBusiness(type, reponses, nomClient) {
  const typeLabels = {
    pasrecruiter: "blocage en recrutement MLM/VDI",
    pasvendre: "blocage en ventes de produits Mihi",
    reseaux: "inefficacité des réseaux sociaux pour son activité Mihi",
    chargementale: "équilibre vie pro/perso et charge mentale",
    valeurmarche: "valeur professionnelle et manque à gagner",
    entrepreneuriat: "profil entrepreneurial et potentiel",
    complementrevenu: "objectif de complément de revenu",
  };
  const reponsesText = Object.entries(reponses||{})
    .filter(([k]) => k !== "_contact")
    .map(([k,v]) => `- ${k}: ${v}`).join("\n") || "Pas de réponses";

  const prompt = `Tu es coach en développement d'activité MLM/VDI pour la marque Mihi (cosmétiques et bien-être naturels).
${nomClient||"Une distributrice"} a rempli un diagnostic sur son ${typeLabels[type]}.

Réponses au questionnaire :
${reponsesText}

Génère un plan d'action personnalisé en JSON avec cette structure exacte (ne mets rien d'autre que le JSON) :
{
  "diagnostic": "2-3 phrases qui résument ce que tu observes dans ses réponses, sans la juger",
  "points_forts": ["point fort 1", "point fort 2"],
  "blocages": ["blocage identifié 1", "blocage identifié 2", "blocage identifié 3"],
  "plan_action": [
    {"priorite": "🔥 Immédiat", "action": "action concrète à faire cette semaine", "pourquoi": "explication courte"},
    {"priorite": "📅 Cette période", "action": "action à mettre en place sur 21 jours", "pourquoi": "explication courte"},
    {"priorite": "🚀 Long terme", "action": "habitude à ancrer sur le long terme", "pourquoi": "explication courte"}
  ],
  "message_encouragement": "1 phrase personnalisée d'encouragement direct, chaleureuse et motivante"
}`;

  try{
    const response = await fetch("https://api.anthropic.com/v1/messages",{
      method:"POST",
      headers:{
        "Content-Type":"application/json",
        "x-api-key":ANTHROPIC_API_KEY,
        "anthropic-version":"2023-06-01",
        "anthropic-dangerous-direct-browser-access":"true",
      },
      body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:4000,messages:[{role:"user",content:prompt}]}),
    });
    const data = await response.json();
    if(data.error) throw new Error(data.error.message);
    const text = data.content?.map(i=>i.text||"").join("")||"";
    const clean = text.replace(/```json|```/g,"").trim();
    const parsed = JSON.parse(clean);
    return {...parsed, kind:"business", type};
  }catch(e){
    throw e;
  }
}

// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
// ── DIAGNOSTIC IA ────────────────────────────────────────────────────────────
async function genererOrdonnanceIA(type, reponses, nomClient) {
  // Types business (pas de catalogue produits)
  const typesBusiness = ["pasrecruiter","pasvendre","reseaux","chargementale","valeurmarche","entrepreneuriat","complementrevenu"];
  if(typesBusiness.includes(type)){
    return genererDiagBusiness(type, reponses, nomClient);
  }

  // Charger les notes admin si elles existent
  let notesAdmin = "";
  try {
    const snap = await getDoc(doc(db,"admin","diag_notes"));
    if(snap.exists() && snap.data()[type]) notesAdmin = snap.data()[type];
  } catch {}

  // Charger le catalogue réel des produits Mihi selon le type
  let catalogueText = "";
  try {
    const catSnap = await getDoc(doc(db,"admin","catalogue_mihi"));
    if(catSnap.exists()){
      const cat = catSnap.data();
      let cles = [];
      if(type==="skincare") cles=["face"];
      else if(type==="cheveux") cles=["hair"];
      else if(type==="sante"||type==="silhouette"||type==="detox"||type==="antiage") cles=["health"];
      else if(type==="makeup") cles=["makeup","face"];
      else if(type==="peaucorps") cles=["corps","health"];
      else cles=["face","corps","hair","makeup","health"];
      let produits=[];
      cles.forEach(cle=>{ produits=[...produits,...(cat[cle]||[])]; });
      if(produits.length>25) produits=produits.slice(0,25);
      catalogueText = produits.map(p=>`${p.nom} — ${p.prix}€`).join("\n");
    }
  } catch (e) { console.error("Erreur chargement catalogue:", e); }

  const typeLabel =
    type==="skincare"?"soin visage/peau":
    type==="cheveux"?"soin capillaire":
    type==="makeup"?"maquillage et couleurs":
    type==="peaucorps"?"soin de la peau du corps":
    "santé et compléments alimentaires";
  
  const reponsesText = Object.entries(reponses||{})
    .filter(([k]) => k !== "_contact")
    .map(([k,v]) => `- ${k}: ${v}`).join("\n") || "Pas de réponses détaillées";
  
  const prompt = `Experte beauté MIHI. Diagnostic ${typeLabel} pour ${nomClient||"Cliente"}.
Réponses: ${reponsesText}
Catalogue: ${catalogueText}
${notesAdmin?`Notes: ${notesAdmin}`:""}

3 packs. JSON strict:
{"introduction":"2 phrases","budget":{"total":"X€","produits":[{"nom":"Nom","prix":"X€","usage":"Matin/Soir","benefice":"1 phrase","comment":"geste"}],"routine":"matin→soir"},"bestseller":{"total":"X€","produits":[{"nom":"Nom","prix":"X€","usage":"usage","benefice":"phrase","comment":"geste"}],"routine":"matin→soir"},"premium":{"total":"X€","produits":[{"nom":"Nom","prix":"X€","usage":"usage","benefice":"phrase","comment":"geste"}],"routine":"matin→soir"},"conseil":"conseil"}
budget=1-2 produits. bestseller=2-3 produits. premium=3-4 produits max`;

  try {
    const response = await fetch("https://api.anthropic.com/v1/messages", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "x-api-key":ANTHROPIC_API_KEY,
        "anthropic-version": "2023-06-01",
        "anthropic-dangerous-direct-browser-access": "true"
      },
      body: JSON.stringify({
        model: "claude-sonnet-4-6",
        max_tokens: 3000,
        messages: [{ role: "user", content: prompt }]
      })
    });

    const data = await response.json();

    if(data.error){
      console.error("Erreur API Claude:", data.error);
      throw new Error("API: " + (data.error.message || JSON.stringify(data.error)));
    }

    const text = data.content?.map(i => i.text || "").join("") || ""; console.log("REPONSE BRUTE:", text.substring(0,500));
    console.log("=== RÉPONSE IA BRUTE ===", text);
    console.log("=== LONGUEUR ===", text.length);
    const clean = text.replace(/```json|```/g, "").trim();

    // Parse robuste : extraire les 4 blocs JSON indépendants
    try {
      return JSON.parse(clean);
    } catch(e) {
      // Si le JSON est tronqué, extraire ce qui est disponible champ par champ
      const extract = (key) => {
        const rx = new RegExp(`"${key}"\\s*:\\s*(\\{[\\s\\S]*?)(?=,\\s*"(?:budget|bestseller|premium|conseil|introduction)"\\s*:|\\}\\s*$)`, 'i');
        const m = clean.match(rx);
        if(!m) return null;
        try { return JSON.parse(m[1]); } catch { return null; }
      };
      const introRx = clean.match(/"introduction"\s*:\s*"([^"]+)"/);
      const conseilRx = clean.match(/"conseil"\s*:\s*"([^"]+)"/);
      const result = {
        introduction: introRx?.[1] || "",
        budget: extract("budget"),
        bestseller: extract("bestseller"),
        premium: extract("premium"),
        conseil: conseilRx?.[1] || "",
      };
      // Si un pack est manquant, on tente de le régénérer
      if(!result.premium) {
        console.warn("Pack premium manquant dans la réponse IA, tentative de récupération...");
        result._incomplet = true;
      }
      // Si pack premium manquant, appel séparé pour le récupérer
      if(!result.premium && catalogueText) {
        try {
          const promptPremium = `Tu es une experte beauté Mihi. Génère UNIQUEMENT le Pack Boost Premium pour ${nomClient||"cette cliente"} (${typeLabel}).

Profil cliente: ${reponsesText}

CATALOGUE MIHI:
${catalogueText}

Génère 4 à 5 produits du catalogue pour un pack premium complet. Réponds UNIQUEMENT avec ce JSON (rien d'autre):
{"nom":"🚀 Pack Boost Premium","total":"XX.XX€","produits":[{"nom":"Nom FR","prix":"XX.XX€","usage":"Matin/Soir","benefice":"1 phrase"}],"routine":"1 phrase"}`;
          const r2 = await fetch("https://api.anthropic.com/v1/messages",{method:"POST",headers:{"Content-Type":"application/json","x-api-key":ANTHROPIC_API_KEY,"anthropic-version":"2023-06-01","anthropic-dangerous-direct-browser-access":"true"},body:JSON.stringify({model:"claude-sonnet-4-6",max_tokens:1500,messages:[{role:"user",content:promptPremium}]})});
          const d2 = await r2.json();
          const t2 = d2.content?.map(i=>i.text||"").join("").replace(/```json|```/g,"").trim();
          result.premium = JSON.parse(t2);
        } catch(e2) { console.warn("Récupération pack premium échouée:", e2); }
      }
      return result;
    }
  } catch (fetchErr) {
    console.error("Erreur réseau / fetch:", fetchErr);
    throw fetchErr;
  }
}

function getRecommandations(type, reponses) { return null; }

// ── QUIZ DE PROFIL RECRUTEMENT (4 niveaux, ton "tu") ─────────────────────────
const QUIZ_RECRUTEMENT = [
  {id:"q1", question:"Quand tu penses à te lancer dans une nouvelle activité, qu'est-ce qui te motive le plus ?", options:[
    {value:"a",label:"Gagner un peu d'argent en plus sans trop me bouger",score:1},
    {value:"b",label:"Avoir plus de liberté dans mon quotidien et mes horaires",score:3},
    {value:"c",label:"Construire quelque chose à moi, sur le long terme",score:4},
    {value:"d",label:"Je ne sais pas trop, je suis curieuse",score:2},
  ]},
  {id:"q2", question:"Comment réagis-tu quand quelqu'un te dit non ou n'est pas intéressé par ce que tu proposes ?", options:[
    {value:"a",label:"Ça me touche beaucoup, j'ai du mal à insister ou recontacter",score:1},
    {value:"b",label:"Ça me déçoit un peu mais je passe à autre chose",score:2},
    {value:"c",label:"Je le prends avec du recul, ce n'est pas personnel",score:3},
    {value:"d",label:"Je vois ça comme normal, ça fait partie du jeu",score:4},
  ]},
  {id:"q3", question:"À quelle fréquence pourrais-tu consacrer du temps à une activité, même 20-30 minutes ?", options:[
    {value:"a",label:"Très irrégulièrement, ça dépend vraiment des semaines",score:1},
    {value:"b",label:"Quelques fois par semaine quand j'y pense",score:2},
    {value:"c",label:"Presque tous les jours, je peux m'organiser un petit créneau",score:3},
    {value:"d",label:"Tous les jours, j'aime avoir une routine",score:4},
  ]},
  {id:"q4", question:"Comment te sens-tu à l'idée de parler de toi, de ton quotidien, sur les réseaux sociaux ?", options:[
    {value:"a",label:"Ça me met très mal à l'aise, je préfère rester discrète",score:1},
    {value:"b",label:"Je peux le faire un peu mais ça me demande un effort",score:2},
    {value:"c",label:"Ça ne me dérange pas, je le fais déjà parfois",score:3},
    {value:"d",label:"J'aime bien partager, je le fais naturellement",score:4},
  ]},
  {id:"q5", question:"Si les réseaux sociaux n'étaient pas une option, penses-tu pouvoir développer une activité uniquement via ton entourage et le bouche-à-oreille ?", options:[
    {value:"a",label:"Non, je ne vois pas comment faire sans réseaux",score:1},
    {value:"b",label:"Peut-être, mais ça me semble compliqué et lent",score:2},
    {value:"c",label:"Oui, j'ai un bon réseau de connaissances autour de moi",score:3},
    {value:"d",label:"Oui clairement, je suis quelqu'un de très sociable et connectée localement",score:4},
  ]},
  {id:"q6", question:"Quand tu apprends quelque chose de nouveau (une méthode, un outil), comment réagis-tu ?", options:[
    {value:"a",label:"J'ai tendance à procrastiner, j'ai peur de mal faire",score:1},
    {value:"b",label:"Je mets du temps à m'y mettre mais j'y arrive",score:2},
    {value:"c",label:"Je me lance assez vite, en apprenant petit à petit",score:3},
    {value:"d",label:"J'adore apprendre et tester de nouvelles choses",score:4},
  ]},
  {id:"q7", question:"Comment décrirais-tu ta situation financière actuelle / ton besoin ?", options:[
    {value:"a",label:"J'ai vraiment besoin d'un revenu rapide et conséquent",score:1},
    {value:"b",label:"Je teste surtout par curiosité, sans vraie attente financière",score:2},
    {value:"c",label:"J'aimerais un revenu complémentaire mais sans urgence",score:3},
    {value:"d",label:"Je veux construire un projet sur le moyen/long terme",score:4},
  ]},
  {id:"q8", question:"Comment réagis-tu face aux résultats qui prennent du temps à arriver ?", options:[
    {value:"a",label:"Je me décourage vite si je ne vois rien après quelques semaines",score:1},
    {value:"b",label:"Ça m'use un peu mais je tiens si je vois des petits progrès",score:2},
    {value:"c",label:"Je sais que ça prend du temps, je reste patiente",score:3},
    {value:"d",label:"Je vois ça comme un investissement, je suis sur la durée",score:4},
  ]},
  {id:"q9", question:"As-tu déjà accompagné, conseillé ou aidé des gens autour de toi (même sans contexte professionnel) ?", options:[
    {value:"a",label:"Pas vraiment, je suis plutôt discrète sur ces sujets",score:1},
    {value:"b",label:"De temps en temps, avec des proches",score:2},
    {value:"c",label:"Oui assez souvent, on me demande facilement conseil",score:3},
    {value:"d",label:"Oui, c'est même quelque chose qui me définit bien",score:4},
  ]},
  {id:"q10", question:"Sur une échelle de motivation, où te situes-tu aujourd'hui pour te lancer dans un vrai projet ?", options:[
    {value:"a",label:"Je suis curieuse mais pas vraiment prête à m'investir",score:1},
    {value:"b",label:"Motivée, mais j'ai besoin d'être accompagnée pas à pas",score:2},
    {value:"c",label:"Motivée et prête à apprendre et essayer",score:3},
    {value:"d",label:"Très motivée, je veux me lancer sérieusement",score:4},
  ]},
];

function getRecrutementLevel(score, max){
  const pct = score/max;
  if(pct < 0.4) return {
    level:1, label:"Pas le bon moment",
    desc:"À ce stade, le marketing relationnel risque de te demander beaucoup d'efforts pour des résultats qui mettront du temps à arriver, ce qui peut être décourageant. Ce n'est pas une question de valeur personnelle — simplement, certains piliers (régularité, gestion du non, visibilité) ne sont pas encore en place pour toi.",
    advice:[
      {h:"Pas de pression",t:"Inutile de te précipiter vers une inscription rapide : le risque d'abandon précoce est élevé."},
      {h:"Garde le lien",t:"Reste connectée de manière légère (contenu inspirant) sans te forcer. Le bon moment peut arriver plus tard, dans un autre contexte de vie."},
      {h:"Si tu veux essayer",t:"Commence plutôt par une expérience client (produits) avant de te lancer dans l'activité — ça te permet de tester sans pression."},
    ]
  };
  if(pct < 0.65) return {
    level:2, label:"Belle marge de progression",
    desc:"Tu as des qualités intéressantes mais tu auras besoin d'un accompagnement rapproché, surtout sur la régularité et la gestion du rejet. Le bouche-à-oreille sera probablement plus naturel pour toi que les réseaux sociaux dans un premier temps.",
    advice:[
      {h:"Démarrage en douceur",t:"Commence centrée sur ton entourage proche (bouche-à-oreille) plutôt que sur les réseaux, moins anxiogène pour démarrer."},
      {h:"Cadre et suivi",t:"Mets en place un point hebdomadaire les premières semaines pour t'aider à tenir la régularité — c'est ton principal point de vigilance."},
      {h:"Petites victoires",t:"Valorise chaque petite action (un message envoyé, une présentation faite) pour construire ta confiance progressivement."},
    ]
  };
  if(pct < 0.85) return {
    level:3, label:"Bon profil",
    desc:"Tu as les bases pour réussir : motivation correcte, ouverture à apprendre, capacité à gérer le rejet. Tu peux te lancer sereinement avec un accompagnement classique, en testant à la fois réseaux et bouche-à-oreille.",
    advice:[
      {h:"Lancement mixte",t:"Teste les deux leviers (réseaux + entourage) dès le départ pour trouver ce qui te correspond le mieux."},
      {h:"Formation structurée",t:"Le programme START & CASH est parfaitement adapté pour structurer ton démarrage sur les premières semaines."},
      {h:"Autonomie progressive",t:"Tu n'as pas besoin d'un cadre trop serré — avance à ton rythme tout en restant accompagnée."},
    ]
  };
  return {
    level:4, label:"Profil idéal",
    desc:"Profil très prometteur : motivation forte, aisance sociale, résilience face au rejet, et appétence pour les réseaux ET le bouche-à-oreille. Tu as un fort potentiel de leadership et tu pourrais toi-même devenir une recruteuse efficace rapidement.",
    advice:[
      {h:"Accélération",t:"Mets-toi rapidement sur le programme START & CASH ET sur MOCHA pour développer ta présence sur les réseaux dès le début."},
      {h:"Vision leadership",t:"Pense assez vite à la dimension équipe/leadership — ton profil suggère que tu peux viser le développement d'une équipe rapidement."},
      {h:"Mise en lumière",t:"N'hésite pas à partager ton expérience tôt — ton énergie sera un atout pour attirer d'autres profils similaires."},
    ]
  };
}

// Note interne pour la distributrice : pas de tags dans ce quiz, on dérive le levier
// conseillé à partir des questions q4 (réseaux) et q5 (bouche-à-oreille)
function getRecrutementInternalNote(reponses, level){
  const scoreVal = (qid, v) => {
    const q = QUIZ_RECRUTEMENT.find(x=>x.id===qid);
    const opt = q?.options.find(o=>o.value===v);
    return opt?.score || 0;
  };
  const scoreReseaux = scoreVal("q4", reponses.q4);
  const scoreBouche = scoreVal("q5", reponses.q5);

  let levier, action;
  if(scoreReseaux>=3 && scoreBouche>=3){
    levier = "Mix réseaux + bouche-à-oreille — cette personne est à l'aise sur les deux canaux.";
    action = "Propose un démarrage sur les deux fronts : entourage proche en premier (conversion plus rapide), réseaux sociaux en parallèle pour construire sa visibilité.";
  } else if(scoreReseaux>=3){
    levier = "Réseaux sociaux — c'est le canal le plus naturel pour cette personne.";
    action = "Oriente-la vers le programme MOCHA pour structurer sa présence sur les réseaux dès le départ.";
  } else if(scoreBouche>=3){
    levier = "Bouche-à-oreille / entourage — c'est le canal le plus naturel pour cette personne.";
    action = "Aide-la à construire sa liste de contacts proches et donne-lui des scripts de conversation simples pour parler naturellement de son activité.";
  } else {
    levier = "Aucun canal naturel identifié pour l'instant — accompagnement rapproché nécessaire.";
    action = "Avant de parler de canal, prends un temps pour explorer avec elle où elle se sent le plus à l'aise. Propose un test cadré sur 2 semaines (1 semaine réseaux, 1 semaine entourage).";
  }

  if(level<=1){
    action += " Vu son niveau de motivation actuel, ne mets aucune pression — reste disponible sans insister.";
  } else if(level>=4){
    action += " Et n'hésite pas à lui parler rapidement de la dimension équipe/leadership.";
  }

  return {levier, action};
}

// ── QUIZ "RECRUE BLOQUÉE" (orientation réseaux / bouche-à-oreille / mix) ─────
const QUIZ_BLOCAGE = [
  {id:"b1", question:"Depuis combien de temps as-tu démarré ton activité ?", options:[
    {value:"a",label:"Moins d'1 mois",score:1},
    {value:"b",label:"1 à 3 mois",score:2},
    {value:"c",label:"3 à 6 mois",score:3},
    {value:"d",label:"Plus de 6 mois",score:4},
  ]},
  {id:"b2", question:"Combien de personnes contactes-tu en moyenne par semaine (réseaux + entourage) ?", options:[
    {value:"a",label:"Aucune, je n'ose pas vraiment",score:1},
    {value:"b",label:"1 à 2 personnes",score:2},
    {value:"c",label:"3 à 5 personnes",score:3},
    {value:"d",label:"Plus de 5 personnes régulièrement",score:4},
  ]},
  {id:"b3", question:"Publies-tu du contenu sur les réseaux sociaux (posts, stories) ?", options:[
    {value:"a",label:"Jamais ou presque jamais",score:1},
    {value:"b",label:"De temps en temps, sans régularité",score:2},
    {value:"c",label:"Quelques fois par semaine",score:3},
    {value:"d",label:"Tous les jours ou presque",score:4},
  ]},
  {id:"b4", question:"À l'inverse, parles-tu de ton activité à ton entourage proche (famille, amis, voisins, collègues) ?", options:[
    {value:"a",label:"Jamais, j'ai peur de leur réaction",score:1},
    {value:"b",label:"Rarement, seulement si on me pose la question",score:2},
    {value:"c",label:"Régulièrement, j'en parle naturellement",score:3},
    {value:"d",label:"Très souvent, c'est ma principale source de contacts",score:4},
  ]},
  {id:"b5", question:"Quand tu envoies un message à un prospect, fais-tu un suivi (relance) si la personne ne répond pas ?", options:[
    {value:"a",label:"Non, je n'ose pas relancer",score:1},
    {value:"b",label:"Parfois, mais je culpabilise un peu",score:2},
    {value:"c",label:"Oui, je relance après quelques jours",score:3},
    {value:"d",label:"Oui systématiquement, avec un suivi organisé",score:4},
  ]},
  {id:"b6", question:"Comment te sens-tu face à la caméra (lives, vidéos, stories) ?", options:[
    {value:"a",label:"Très mal à l'aise, j'évite complètement",score:1},
    {value:"b",label:"Mal à l'aise mais je commence à essayer",score:2},
    {value:"c",label:"Plutôt à l'aise, je le fais de temps en temps",score:3},
    {value:"d",label:"Très à l'aise, j'aime ça",score:4},
  ]},
  {id:"b7", question:"As-tu une routine quotidienne ou hebdomadaire pour ton activité (actions planifiées) ?", options:[
    {value:"a",label:"Non, je fais au feeling selon le temps que j'ai",score:1},
    {value:"b",label:"J'ai quelques idées mais pas vraiment de planning",score:2},
    {value:"c",label:"Oui, j'ai une routine mais je ne la suis pas toujours",score:3},
    {value:"d",label:"Oui, j'ai une routine claire que je suis régulièrement",score:4},
  ]},
  {id:"b8", question:"Te sens-tu à l'aise pour expliquer simplement ce que tu fais et tes produits/opportunité ?", options:[
    {value:"a",label:"Pas vraiment, j'ai du mal à expliquer clairement",score:1},
    {value:"b",label:"Un peu, mais je tourne parfois autour du pot",score:2},
    {value:"c",label:"Oui, j'ai un discours assez clair",score:3},
    {value:"d",label:"Oui, je me sens à l'aise et naturelle",score:4},
  ]},
  {id:"b9", question:"Quel est, selon toi, ton plus grand frein actuel ?", options:[
    {value:"a",label:"La peur du jugement / du regard des autres",score:1},
    {value:"b",label:"Le manque de temps ou d'organisation",score:2},
    {value:"c",label:"Le manque de méthode / je ne sais pas par où commencer",score:2},
    {value:"d",label:"Le manque de régularité, je commence bien puis je lâche",score:3},
  ]},
  {id:"b10", question:"Si tu devais miser sur UN levier pour développer ton activité dans les 30 prochains jours, lequel choisirais-tu naturellement ?", options:[
    {value:"a",label:"Le bouche-à-oreille / mon entourage proche",score:3,tag:"bouche-a-oreille"},
    {value:"b",label:"Les réseaux sociaux (posts, stories, lives)",score:3,tag:"reseaux"},
    {value:"c",label:"Un mix des deux, mais je ne sais pas comment m'organiser",score:2,tag:"mix"},
    {value:"d",label:"Je ne sais pas, je n'ai pas de préférence",score:1,tag:"indecise"},
  ]},
];

function getBlocageOrientation(score, max, reponses){
  const pct = score/max;
  const lastQ = QUIZ_BLOCAGE[QUIZ_BLOCAGE.length-1];
  const lastVal = reponses[lastQ.id];
  const lastOpt = lastQ.options.find(o=>o.value===lastVal);
  const preferredLever = lastOpt?.tag || null;

  let orientation;
  if(preferredLever === "reseaux"){
    orientation = {
      title:"Orientation : Réseaux sociaux",
      desc:"Tu as une appétence naturelle pour les réseaux sociaux. C'est ce levier qu'il faut renforcer en priorité.",
      actions:[
        {h:"Programme MOCHA",t:"Inscris-toi (ou refais) le programme MOCHA pour structurer ta présence sur les réseaux : régularité de publication, formats qui convertissent, CTA par mots-clés."},
        {h:"Objectif simple",t:"Fixe-toi un objectif minimal mais tenable : 1 story par jour + 1 post fort par semaine, plutôt qu'une cadence intenable."},
        {h:"Visage et présence",t:"Si tu es mal à l'aise face caméra, commence par des formats sans visage (texte sur fond, voix off) avant d'introduire progressivement la vidéo."},
      ]
    };
  } else if(preferredLever === "bouche-a-oreille"){
    orientation = {
      title:"Orientation : Bouche-à-oreille / Entourage",
      desc:"Tu es plus à l'aise dans les interactions directes avec ton entourage. Misons sur ce canal naturel.",
      actions:[
        {h:"Liste chaude",t:"Construis (ou réactive) ta liste de contacts proches : famille, amis, anciens collègues, voisins — avec un angle naturel (partage d'expérience produit plutôt que pitch direct)."},
        {h:"Scripts de conversation",t:"Utilise des phrases d'accroche simples pour parler naturellement de ton activité dans une conversation normale, sans que ça paraisse être un argumentaire."},
        {h:"Suivi systématique",t:"Travaille la relance : beaucoup de blocages viennent de l'absence de suivi après un premier contact. Un rappel structuré (via cet outil) peut t'aider."},
      ]
    };
  } else if(preferredLever === "mix"){
    orientation = {
      title:"Orientation : Mix réseaux + entourage, avec un cadre",
      desc:"Tu vois l'intérêt des deux leviers mais tu manques d'organisation pour les mener de front. Il faut te donner un cadre simple.",
      actions:[
        {h:"Planning simplifié",t:"Propose-toi une répartition simple : par exemple lundi/mercredi/vendredi = contenu réseaux, mardi/jeudi = contacts entourage. Pas plus de 2-3 actions par jour."},
        {h:"Une priorité à la fois",t:"Même si tu veux tout faire, choisis UN levier prioritaire pour les 2 prochaines semaines, l'autre restant en complément léger."},
        {h:"START & CASH",t:"Le programme START & CASH peut t'aider à retrouver une structure claire semaine par semaine."},
      ]
    };
  } else {
    orientation = {
      title:"Orientation : Clarification du levier avant tout",
      desc:"Tu n'as pas encore identifié ce qui te correspond. Avant de parler d'action, il faut t'aider à te positionner.",
      actions:[
        {h:"Discussion exploratoire",t:"Prends un temps pour explorer où tu te sens le plus à l'aise naturellement : parler à des gens que tu connais, ou créer du contenu en ligne."},
        {h:"Test sur 2 semaines",t:"Propose-toi un test cadré : 1 semaine centrée réseaux, 1 semaine centrée entourage, puis compare ce qui t'a semblé le plus naturel."},
        {h:"Réassurance",t:"L'indécision cache souvent une peur de mal faire. Rassure-toi : il n'y a pas de mauvais choix, seulement des essais à ajuster."},
      ]
    };
  }

  let levelInfo;
  if(pct < 0.4) levelInfo = {level:1, label:"Blocage profond — réassurance prioritaire",
    extra:"Au-delà de l'orientation réseaux/entourage, le frein principal semble être la confiance et la régularité. Avant tout plan d'action, un accompagnement rapproché (appels courts, encouragements) est nécessaire pour éviter le découragement complet."};
  else if(pct < 0.65) levelInfo = {level:2, label:"Blocage modéré — besoin de cadre",
    extra:"Tu as des bases mais tu manques de structure. Un planning simple et des objectifs atteignables sur 2-3 semaines devraient permettre de relancer la dynamique."};
  else if(pct < 0.85) levelInfo = {level:3, label:"Blocage léger — ajustement ciblé",
    extra:"Tu es globalement sur la bonne voie ; il s'agit surtout d'ajuster un levier précis ou de renforcer la régularité sur un point spécifique plutôt que de tout reprendre."};
  else levelInfo = {level:4, label:"Pas vraiment bloquée — affiner la stratégie",
    extra:"Ton score est élevé : il ne s'agit probablement pas d'un blocage profond mais d'un ajustement de stratégie ou d'un passage à un niveau supérieur (par exemple : viser le leadership d'équipe)."};

  return {orientation, levelInfo};
}

// ── QUESTIONS DIAGNOSTICS ────────────────────────────────────────────────────
const PARFUMS_CATALOGUE = [
  {id:"tuscany",nom:"Tuscany Citron",serie:"Voyage Collection",genre:"F",famille:"Floral Fruité",occasion:["quotidien","printemps_ete"],intensite:"leger",caractere:["naturel","frais","raffiné"],ambiance:["frais","floral","ensoleille"],desc:"Léger, frais et radieux. Agrumes ensoleillés, jasmin délicat, notes boisées douces. Idéal pour celles qui aiment le naturel et la sophistication.",prix:"18.5€"},
  {id:"mythos",nom:"Mythos",serie:"Voyage Collection",genre:"F",famille:"Oriental Gourmand",occasion:["quotidien","printemps_ete","romantique"],intensite:"leger",caractere:["gourmand","doux","sensuel"],ambiance:["gourmand","floral","ensoleille"],desc:"Citron rafraîchissant, fleur d'oranger délicate, douceur de vanille et praline. Pour celles qui aiment les parfums sensuels et joyeux.",prix:"18.5€"},
  {id:"wioletta",nom:"Wioletta",serie:"Unique",genre:"F",famille:"Floral Fruité",occasion:["quotidien","travail","polyvalent"],intensite:"moyen",caractere:["universel","elegant","feminin"],ambiance:["floral","agrumes","universel"],desc:"Fraîche et séduisante, violettes et agrumes en harmonie. Accompagne aussi bien un costume qu'une robe romantique.",prix:"20.9€"},
  {id:"karolina",nom:"Karolina",serie:"Unique",genre:"F",famille:"Oriental Épicé",occasion:["soiree","romantique","automne_hiver"],intensite:"intense",caractere:["chaleureux","mysterieux","epice"],ambiance:["epice","chaleureux","oriental"],desc:"Épicé et profond, enveloppé de chaleur. Lavande et agrumes, cœur miel-cannelle-jasmin, fond vanille et tabac. Pour une femme audacieuse.",prix:"20.9€"},
  {id:"monika",nom:"Monika",serie:"Unique",genre:"F",famille:"Boisé Aromatique",occasion:["quotidien","polyvalent","romantique"],intensite:"moyen",caractere:["dynamique","sensuel","ludique"],ambiance:["agrumes","boise","epice"],desc:"Légère mais sensuelle. Agrumes vifs, épices séduisantes, fond boisé santal. Option parfaite au quotidien et pour les occasions spéciales.",prix:"20.9€"},
  {id:"jarca",nom:"Jarča",serie:"Unique",genre:"F",famille:"Floral Fruité",occasion:["polyvalent","quotidien","toutes_saisons"],intensite:"moyen",caractere:["polyvalent","frais","feminin"],ambiance:["floral","fruité","universel"],desc:"Fraîche et vivifiante, chaude et profonde. Un caméléon qui s'adapte à chaque moment. Agrumes et fruit de la passion, bouquet floral, musc.",prix:"20.9€"},
  {id:"w1",nom:"W1",serie:"Perfume W",genre:"F",famille:"Chypré Floral",occasion:["quotidien","travail","soiree"],intensite:"moyen",caractere:["elegant","moderne","subtil"],ambiance:["floral","boise","elegant"],desc:"Élégant et discret, structure soyeuse. Cassis capiteux, freesia délicat, sillage boisé vanillé. Pour une femme moderne au fort charisme.",prix:"18.5€"},
  {id:"w3",nom:"W3",serie:"Perfume W",genre:"F",famille:"Floral Oriental",occasion:["romantique","soiree","quotidien"],intensite:"moyen",caractere:["feminin","sensuel","libre"],ambiance:["floral","gourmand","sensuel"],desc:"Féminité, charme et sensualité. Cassis et poire, bouquet floral d'iris et jasmin, fond praline et vanille. Pour une femme libre et heureuse.",prix:"18.5€"},
  {id:"w4",nom:"W4",serie:"Perfume W",genre:"F",famille:"Floral Oriental",occasion:["soiree","romantique","automne_hiver"],intensite:"intense",caractere:["mysterieux","sensuel","profond"],ambiance:["oriental","floral","profond"],desc:"Oriental doux et chaud avec fleurs délicates. Café et amande, tubéreuse audacieuse, fond vanille séduisant. Pour une femme mystérieuse.",prix:"18.5€"},
  {id:"w8",nom:"W8",serie:"Perfume W",genre:"F",famille:"Floral Fruité",occasion:["quotidien","printemps_ete","romantique"],intensite:"leger",caractere:["romantique","joyeux","raffiné"],ambiance:["floral","fruité","frais"],desc:"Excitant et tonique. Citron de Sicile et pomme, bouquet jasmin-rose, fond cèdre et musc. Comme une brise estivale sicilienne.",prix:"18.5€"},
  {id:"w9",nom:"W9",serie:"Perfume W",genre:"F",famille:"Floral Boisé",occasion:["polyvalent","quotidien","soiree"],intensite:"moyen",caractere:["universel","feminin","inspire"],ambiance:["floral","boise","universel"],desc:"Multiforme et harmonieux. Fleur d'oranger et bergamote, tubéreuse et jasmin indien, fond vanille et musc blanc. Universel jour et soir.",prix:"18.5€"},
  {id:"w10",nom:"W10",serie:"Perfume W",genre:"F",famille:"Floral Fruité",occasion:["soiree","evenement","romantique"],intensite:"intense",caractere:["luxueux","sur_de_soi","glamour"],ambiance:["floral","fruité","luxueux"],desc:"Pour une femme sûre d'elle. Framboise et néroli, bouquet gardénia-jasmin, fond ambré et miel blanc. Comme un diamant.",prix:"18.5€"},
  {id:"w12",nom:"W12",serie:"Perfume W",genre:"F",famille:"Floral",occasion:["quotidien","polyvalent"],intensite:"leger",caractere:["ensoleille","positif","universel"],ambiance:["floral","frais","joyeux"],desc:"Ensoleillé et floral. Fleur de cactus, bouquet rose-jasmin-freesia, fond boisé et cèdre. Pour une femme qui rayonne de l'intérieur.",prix:"18.5€"},
  {id:"just_for_her",nom:"Just For Her",serie:"Perfume W",genre:"F",famille:"Floral Oriental",occasion:["quotidien","soiree","romantique"],intensite:"intense",caractere:["sensuel","audacieux","moderne"],ambiance:["oriental","fruité","sensuel"],desc:"Composition sensuelle et orientale. Framboise et mandarine, fleurs exotiques, fond caramel-vanille-santal. Pour une femme qui ose.",prix:"19.5€"},
  {id:"just_for_love_f",nom:"Just For Love (F)",serie:"Perfume W",genre:"F",famille:"Floral Oriental",occasion:["soiree","romantique","seduction"],intensite:"intense",caractere:["passionné","sensuel","seducteur"],ambiance:["floral","oriental","seduction"],desc:"Parfum phéromonique. Cassis et bergamote, jasmin sambac et muguet, fond vanille et santal. Pour une femme passionnée.",prix:"22.5€"},
  {id:"futuristic",nom:"Futuristic",serie:"Perfume W",genre:"F",famille:"Floral Boisé",occasion:["soiree","polyvalent"],intensite:"intense",caractere:["audacieux","classique_moderne","profond"],ambiance:["floral","boise","profond"],desc:"Pour les classiques qui osent l'audace. Narcisse et tubéreuse, massepain, fond musqué noble avec vétiver et ambre gris.",prix:"16.9€"},
  {id:"oscar",nom:"Oscar",serie:"Perfume W",genre:"F",famille:"Boisé Floral Gourmand",occasion:["soiree","automne_hiver","evenement"],intensite:"intense",caractere:["glamour","profond","gourmand"],ambiance:["gourmand","boise","luxueux"],desc:"Un parfum de star. Poire et whisky, cœur caramel-jasmin-guimauve, fond santal et vétiver velouté. Pour chaque apparition un événement.",prix:"23.9€"},
  {id:"m1",nom:"M1",serie:"Perfume M",genre:"M",famille:"Fougère",occasion:["polyvalent","travail","soiree"],intensite:"intense",caractere:["viril","sensuel","elegant"],ambiance:["boise","fougere","oriental"],desc:"Intense et polyvalent. Bergamote et poivre, lavande fraîche et vétiver, fond ambré sexy. Pour l'homme épris de liberté.",prix:"18.5€"},
  {id:"m2",nom:"M2",serie:"Perfume M",genre:"M",famille:"Fougère Boisé",occasion:["soiree","romantique","evenement"],intensite:"intense",caractere:["masculin","sensuel","charismatique"],ambiance:["boise","fougere","sensuel"],desc:"Masculinité et force intérieure. Menthe et pomme, fève tonka et géranium, fond boisé cèdre-vanille. Pour les soirées.",prix:"18.5€"},
  {id:"m4",nom:"M4",serie:"Perfume M",genre:"M",famille:"Aquatique Boisé",occasion:["quotidien","sport","polyvalent"],intensite:"leger",caractere:["dynamique","frais","masculin"],ambiance:["aquatique","frais","boise"],desc:"Discret et frais pour tous les jours. Notes marines et agrumes, laurier et jasmin, fond boisé ambré. Orienté sport.",prix:"18.5€"},
  {id:"m5",nom:"M5",serie:"Perfume M",genre:"M",famille:"Aquatique Boisé",occasion:["polyvalent","sport","voyage"],intensite:"moyen",caractere:["actif","aventurier","raffiné"],ambiance:["agrumes","aquatique","boise"],desc:"Pour un homme actif et aventurier. Agrumes explosifs, notes marines, fond boisé cèdre et mousse de chêne.",prix:"18.5€"},
  {id:"m6",nom:"M6",serie:"Perfume M",genre:"M",famille:"Boisé Épicé",occasion:["soiree","romantique","seduction"],intensite:"intense",caractere:["puissant","seducteur","luxueux"],ambiance:["boise","epice","seduction"],desc:"Manifeste de succès. Mandarine et menthe, rose cannelle, fond cuir-ambre-patchouli. Pour ceux qui n'ont pas peur de briller.",prix:"18.5€"},
  {id:"just_for_him",nom:"Just For Him",serie:"Perfume M",genre:"M",famille:"Fougère Aromatique",occasion:["quotidien","soiree","polyvalent"],intensite:"moyen",caractere:["energique","moderne","charismatique"],ambiance:["fougere","frais","epice"],desc:"Énergie et dynamisme. Cardamome et menthe, ananas et lavande, fond cèdre-vanille-châtaigne. Pour l'homme sûr de lui.",prix:"19.5€"},
  {id:"just_for_love_m",nom:"Just For Love (H)",serie:"Perfume M",genre:"M",famille:"Floral Oriental Boisé",occasion:["quotidien","soiree","romantique"],intensite:"intense",caractere:["noble","elegant","passionné"],ambiance:["boise","oriental","nature"],desc:"Parfum phéromonique boisé-épicé. Orange et pamplemousse, poivre et pélargonium, fond vétiver-cèdre-patchouli.",prix:"22.5€"},
];

const QUESTIONS_PARFUM = [
  {id:"genre", question:"Ce parfum est pour :", options:[
    {value:"F", label:"👩 Une femme"},
    {value:"M", label:"👨 Un homme"},
    {value:"U", label:"✨ Les deux (mixte)"},
  ]},
  {id:"famille", question:"Quel univers olfactif vous attire le plus ?", options:[
    {value:"floral", label:"🌸 Floral — roses, jasmin, fleurs délicates"},
    {value:"fruité", label:"🍋 Fruité/Agrumes — frais, pétillant, vitaminé"},
    {value:"gourmand", label:"🍬 Gourmand — vanille, caramel, douceurs"},
    {value:"boisé", label:"🌲 Boisé — cèdre, santal, vétiver, profond"},
    {value:"oriental", label:"🌙 Oriental/Épicé — chaleureux, envoûtant, mystérieux"},
    {value:"aquatique", label:"🌊 Marin/Frais — brise marine, air pur, légèreté"},
  ]},
  {id:"occasion", question:"Pour quelle occasion principalement ?", options:[
    {value:"quotidien", label:"☀️ Tous les jours — discret et polyvalent"},
    {value:"travail", label:"💼 Travail/Bureau — élégant et professionnel"},
    {value:"soiree", label:"🌙 Soirée/Événement — marquer les esprits"},
    {value:"romantique", label:"❤️ Moment romantique — séduire et attirer"},
    {value:"sport", label:"⚡ Sport/Plein air — frais et dynamique"},
    {value:"polyvalent", label:"🔄 Polyvalent — toutes les occasions"},
  ]},
  {id:"intensite", question:"Vous préférez un parfum :", options:[
    {value:"leger", label:"🕊️ Léger et discret — présence subtile"},
    {value:"moyen", label:"🌺 Modéré — équilibré, remarqué sans envahir"},
    {value:"intense", label:"💥 Intense et puissant — laisser un sillage fort"},
  ]},
  {id:"saison", question:"Votre saison préférée pour ce parfum ?", options:[
    {value:"printemps_ete", label:"🌸 Printemps/Été — légèreté et fraîcheur"},
    {value:"automne_hiver", label:"🍂 Automne/Hiver — chaleur et profondeur"},
    {value:"toutes_saisons", label:"🌍 Toutes saisons — versatilité totale"},
  ]},
  {id:"caractere", question:"Quel mot vous correspond le mieux ?", options:[
    {value:"elegant", label:"👑 Élégante/Raffinée — classe et sophistication"},
    {value:"sensuel", label:"🔥 Sensuelle/Mystérieuse — attirer et séduire"},
    {value:"naturel", label:"🌿 Naturelle/Authentique — simplicité et fraîcheur"},
    {value:"dynamique", label:"⚡ Dynamique/Moderne — énergie et modernité"},
    {value:"gourmand", label:"🍭 Gourmande/Douce — douceur et tendresse"},
    {value:"luxueux", label:"💎 Luxueuse/Audacieuse — se démarquer"},
  ]},
  {id:"aversion", question:"Qu'est-ce que vous voulez absolument éviter ?", options:[
    {value:"rien_trop_fleuri", label:"🚫 Rien de trop fleuri ou sucré"},
    {value:"pas_lourd", label:"🚫 Rien de trop lourd ou entêtant"},
    {value:"pas_frais", label:"🚫 Rien de trop frais ou neutre"},
    {value:"pas_sucre", label:"🚫 Rien de trop sucré ou gourmand"},
    {value:"aucune", label:"✅ Pas de préférence particulière"},
  ]},
];

function DiagnosticParfumTab({uid, externalMode=false, distributeurNom="", onResultat=null}){
  const [step, setStep] = useState(-1); // -1 = accueil
  const [reponses, setReponses] = useState({});
  const [resultat, setResultat] = useState(null);
  const [loading, setLoading] = useState(false);
  const [nom, setNom] = useState("");
  const [capturePrenom, setCapturePrenom] = useState("");
  const [captureContact, setCaptureContact] = useState("");
  const [captureEnvoyee, setCaptureEnvoyee] = useState(false);
  const [suiteParfum, setSuiteParfum] = useState("");

  const calculerResultat = (rep) => {
    setLoading(true);
    const genre = rep.genre;
    const famille = rep.famille;
    const occasion = rep.occasion;
    const intensite = rep.intensite;
    const saison = rep.saison;
    const caractere = rep.caractere;
    const aversion = rep.aversion;

    // Filtrer par genre
    let candidates = PARFUMS_CATALOGUE.filter(p => {
      if(genre === "F") return p.genre === "F";
      if(genre === "M") return p.genre === "M";
      return true; // U = tous
    });

    // Scorer chaque parfum
    const scored = candidates.map(p => {
      let score = 0;
      // Famille olfactive
      if(p.ambiance.includes(famille)) score += 3;
      if(p.famille.toLowerCase().includes(famille)) score += 2;
      // Occasion
      if(p.occasion.includes(occasion)) score += 3;
      if(p.occasion.includes("polyvalent")) score += 1;
      // Intensité
      if(p.intensite === intensite) score += 2;
      // Saison
      if(p.occasion.includes(saison)) score += 2;
      if(p.occasion.includes("toutes_saisons")) score += 1;
      // Caractère
      if(p.caractere.includes(caractere)) score += 2;
      // Anti-avversions
      if(aversion === "rien_trop_fleuri" && !p.famille.includes("Floral") && !p.caractere.includes("gourmand")) score += 1;
      if(aversion === "pas_lourd" && p.intensite === "leger") score += 2;
      if(aversion === "pas_frais" && p.intensite !== "leger" && !p.ambiance.includes("aquatique")) score += 1;
      if(aversion === "pas_sucre" && !p.caractere.includes("gourmand") && !p.ambiance.includes("gourmand")) score += 1;
      return {...p, score};
    });

    // Trier et prendre le top 3
    const top3 = scored.sort((a,b) => b.score - a.score).slice(0, 3);
    setResultat(top3);
    setLoading(false);
  };

  const repondre = (val) => {
    const q = QUESTIONS_PARFUM[step];
    const newRep = {...reponses, [q.id]: val};
    setReponses(newRep);
    if(step < QUESTIONS_PARFUM.length - 1){
      setStep(step + 1);
    } else {
      calculerResultat(newRep);
    }
  };

  const reset = () => { setStep(-1); setReponses({}); setResultat(null); setNom(""); setCapturePrenom(""); setCaptureContact(""); setCaptureEnvoyee(false); setSuiteParfum(""); };

  // Rediriger vers tunnel si suite choisie
  if(suiteParfum==="produits"){
    return <TunnelHybridePage slug={distributeurNom} forceParcours="produits"/>;
  }
  if(suiteParfum==="recrutement"){
    if(typeof window !== "undefined") window.location.href="?recrutement=true&uid="+distributeurNom;
    return null;
  }

  // Accueil
  if(step === -1) return(
    <div style={{paddingBottom:"2rem"}}>
      {!externalMode&&<div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem"}}>Diagnostic <em style={{color:C.rose}}>Parfum</em></div>}
      {externalMode&&<div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".5rem",textAlign:"center"}}>Trouver <em style={{color:C.rose}}>mon parfum</em></div>}
      <div style={{background:"linear-gradient(135deg,#9B59B6,#6C3483)",borderRadius:16,padding:"1.5rem",marginBottom:"1.25rem",textAlign:"center"}}>
        <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🌸</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:"white",fontWeight:300,marginBottom:".5rem"}}>Quel parfum vous ressemble ?</div>
        <div style={{fontSize:".78rem",color:"rgba(255,255,255,.85)",lineHeight:1.65}}>7 questions pour trouver votre parfum Mihi idéal parmi 26 fragrances. Résultat personnalisé en moins de 2 minutes.</div>
      </div>
      {externalMode&&<div style={{marginBottom:"1rem"}}>
        <input placeholder="Votre prénom (facultatif)" value={nom} onChange={e=>setNom(e.target.value)}
          style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:10,padding:".55rem .75rem",fontSize:".82rem",fontFamily:"inherit",color:"#3D2B1F",background:"#FAF7F2",outline:"none"}}/>
      </div>}
      <div style={{display:"flex",flexDirection:"column",gap:".6rem",marginBottom:"1rem"}}>
        {[["✨","26 parfums Mihi analysés"],["🎯","Recommandation personnalisée top 3"],["💰","Prix à partir de 11.83€"],["⏱️","Résultat en 2 minutes"]].map(([icon,txt])=>(
          <div key={txt} style={{display:"flex",gap:".65rem",alignItems:"center",background:"white",borderRadius:10,padding:".6rem .85rem",border:"1px solid #E8DDD4"}}>
            <span style={{fontSize:"1.2rem"}}>{icon}</span>
            <span style={{fontSize:".78rem",color:"#3D2B1F"}}>{txt}</span>
          </div>
        ))}
      </div>
      <button onClick={()=>setStep(0)}
        style={{width:"100%",background:"linear-gradient(135deg,#9B59B6,#6C3483)",color:"white",border:"none",borderRadius:12,padding:".8rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
        🌸 Commencer le diagnostic →
      </button>
    </div>
  );

  // Questions
  if(!resultat){
    const q = QUESTIONS_PARFUM[step];
    const pct = Math.round((step / QUESTIONS_PARFUM.length) * 100);
    return(
      <div style={{paddingBottom:"2rem"}}>
        {/* Barre de progression */}
        <div style={{height:4,background:"#E8DDD4",borderRadius:2,marginBottom:"1.25rem",overflow:"hidden"}}>
          <div style={{height:"100%",background:"#9B59B6",width:pct+"%",transition:"width .3s"}}/>
        </div>
        <div style={{fontSize:".65rem",color:"#888",textAlign:"right",marginBottom:"1rem"}}>Question {step+1}/{QUESTIONS_PARFUM.length}</div>

        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:300,color:"#3D1F0E",marginBottom:"1.25rem",lineHeight:1.5}}>
          {q.question}
        </div>

        <div style={{display:"flex",flexDirection:"column",gap:".5rem"}}>
          {q.options.map(opt=>(
            <button key={opt.value} onClick={()=>repondre(opt.value)}
              style={{background:"white",border:"1.5px solid #E8DDD4",borderRadius:12,padding:".75rem 1rem",textAlign:"left",fontSize:".82rem",color:"#3D2B1F",cursor:"pointer",fontFamily:"inherit",lineHeight:1.5,transition:"all .2s"}}>
              {opt.label}
            </button>
          ))}
        </div>

        {step > 0&&<button onClick={()=>setStep(step-1)}
          style={{background:"none",border:"none",color:"#888",fontSize:".72rem",cursor:"pointer",fontFamily:"inherit",marginTop:"1rem",padding:".3rem"}}>
          ← Question précédente
        </button>}
      </div>
    );
  }

  // Résultat
  const SERIE_COLORS = {"Voyage Collection":"#C49A8A","Unique":"#A89BB5","Perfume W":"#9B59B6","Perfume M":"#2E4057"};
  return(
    <div style={{paddingBottom:"2rem"}}>
      <div style={{textAlign:"center",marginBottom:"1.5rem"}}>
        <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🌸</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:300,color:"#3D1F0E",marginBottom:".3rem"}}>
          {nom?`${nom}, voici`:"Voici"} <em style={{color:"#9B59B6"}}>vos parfums idéaux</em>
        </div>
        <div style={{fontSize:".72rem",color:"#888"}}>Sélectionnés parmi 26 parfums Mihi selon vos réponses</div>
      </div>

      {resultat.map((p,i)=>(
        <div key={p.id} style={{background:"white",borderRadius:14,marginBottom:".75rem",overflow:"hidden",border:`2px solid ${i===0?"#9B59B6":"#E8DDD4"}`,boxShadow:i===0?"0 4px 20px rgba(155,89,182,.15)":"none"}}>
          {i===0&&<div style={{background:"#9B59B6",padding:".35rem 1rem",fontSize:".62rem",fontWeight:700,color:"white",letterSpacing:".1em"}}>⭐ RECOMMANDATION PRINCIPALE</div>}
          {i===1&&<div style={{background:"#E8DDD4",padding:".35rem 1rem",fontSize:".62rem",fontWeight:700,color:"#3D1F0E",letterSpacing:".1em"}}>✨ ALTERNATIVE 2</div>}
          {i===2&&<div style={{background:"#FAF7F2",padding:".35rem 1rem",fontSize:".62rem",fontWeight:700,color:"#888",letterSpacing:".1em"}}>🌸 ALTERNATIVE 3</div>}
          <div style={{padding:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"flex-start",marginBottom:".5rem"}}>
              <div>
                <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:"#3D1F0E",marginBottom:".2rem"}}>{p.nom}</div>
                <div style={{display:"flex",gap:".3rem",alignItems:"center"}}>
                  <span style={{background:SERIE_COLORS[p.serie]+"20",color:SERIE_COLORS[p.serie],borderRadius:20,padding:".1rem .5rem",fontSize:".6rem",fontWeight:700}}>{p.serie}</span>
                  <span style={{background:"#FAF7F2",borderRadius:20,padding:".1rem .5rem",fontSize:".6rem",color:"#888"}}>{p.famille}</span>
                </div>
              </div>
              <div style={{textAlign:"right"}}>
                <div style={{fontSize:"1rem",fontWeight:700,color:"#9B59B6"}}>{p.prix}</div>
                <div style={{fontSize:".6rem",color:"#888"}}>50ml · 18% conc.</div>
              </div>
            </div>
            <div style={{fontSize:".78rem",color:"#3D2B1F",lineHeight:1.65,background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",marginBottom:".5rem"}}>
              {p.desc}
            </div>
            <div style={{display:"flex",gap:".35rem",flexWrap:"wrap"}}>
              {p.ambiance.map(a=>(
                <span key={a} style={{background:"#9B59B620",color:"#9B59B6",borderRadius:20,padding:".1rem .45rem",fontSize:".6rem",fontWeight:600}}>{a}</span>
              ))}
            </div>
          </div>
        </div>
      ))}

      <div style={{background:"#3D1F0E",borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
        <div style={{fontSize:".6rem",fontWeight:700,color:"#C4A882",letterSpacing:".1em",marginBottom:".35rem"}}>💡 CONSEIL DE VOTRE CONSEILLÈRE</div>
        <div style={{fontSize:".78rem",color:"white",lineHeight:1.65}}>
          {distributeurNom?`${distributeurNom} est`:"Je suis"} disponible pour vous faire sentir ces parfums et vous guider dans votre choix. Tous nos parfums sont à 18% de concentration et tiennent jusqu'à 12h.
        </div>
      </div>

      {/* Formulaire de capture */}
      {!captureEnvoyee ? (
        <div style={{background:"#3D1F0E",borderRadius:14,padding:"1.25rem",marginBottom:"1rem",color:"white"}}>
          <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",color:"#C4A882",marginBottom:".4rem"}}>✦ RECEVOIR MA SÉLECTION PAR MESSAGE</div>
          <div style={{fontSize:".8rem",color:"rgba(255,255,255,.85)",marginBottom:".85rem",lineHeight:1.6}}>Entre tes coordonnées pour recevoir ta sélection et être contactée par ta conseillère.</div>
          <input placeholder="Ton prénom" value={capturePrenom} onChange={e=>setCapturePrenom(e.target.value)}
            style={{width:"100%",border:"none",borderRadius:8,padding:".5rem .75rem",fontSize:".82rem",fontFamily:"inherit",marginBottom:".5rem",outline:"none"}}/>
          <input placeholder="Ton Instagram, WhatsApp ou email" value={captureContact} onChange={e=>setCaptureContact(e.target.value)}
            style={{width:"100%",border:"none",borderRadius:8,padding:".5rem .75rem",fontSize:".82rem",fontFamily:"inherit",marginBottom:".75rem",outline:"none"}}/>
          <button onClick={async()=>{
            if(!capturePrenom.trim()||!captureContact.trim()) return;
            try{
              await setDoc(doc(db,"tunnel_prospects","diag"+Date.now()),{
                type:"diagnostic_parfum",prenom:capturePrenom,contact:captureContact,
                resultat:resultat.map(p=>p.nom),slug:distributeurNom,date:todayLocalStr(),ts:Date.now()
              });
            }catch{}
            setCaptureEnvoyee(true);
          }}
            style={{width:"100%",background:"#C49A8A",color:"white",border:"none",borderRadius:10,padding:".65rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
            ✦ Recevoir ma sélection
          </button>
        </div>
      ) : (
        <div style={{background:"#7FAF8A",borderRadius:12,padding:"1rem",textAlign:"center",marginBottom:"1rem",color:"white"}}>
          <div style={{fontSize:"1.5rem",marginBottom:".3rem"}}>✅</div>
          <div style={{fontWeight:700,fontSize:".85rem",marginBottom:".2rem"}}>Reçu !</div>
          <div style={{fontSize:".75rem",opacity:.9}}>Ta conseillère va te contacter très vite 🌸</div>
        </div>
      )}

      {/* Boutons suite du parcours */}
      <div style={{display:"flex",flexDirection:"column",gap:".6rem",marginBottom:"1rem"}}>
        <button onClick={()=>setSuiteParfum("produits")}
          style={{background:"#C49A8A",color:"white",border:"none",borderRadius:12,padding:".75rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:".75rem"}}>
          <span style={{fontSize:"1.2rem"}}>🛍️</span>
          <div><div style={{fontWeight:700}}>Découvrir tous les produits Mihi</div><div style={{fontSize:".7rem",opacity:.85,fontWeight:400}}>Qui correspondent à ton profil</div></div>
        </button>
        <button onClick={()=>setSuiteParfum("recrutement")}
          style={{background:"#3D1F0E",color:"white",border:"none",borderRadius:12,padding:".75rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",textAlign:"left",display:"flex",alignItems:"center",gap:".75rem"}}>
          <span style={{fontSize:"1.2rem"}}>👑</span>
          <div><div style={{fontWeight:700}}>Créer un revenu avec ces produits</div><div style={{fontSize:".7rem",opacity:.85,fontWeight:400}}>Découvrir l'opportunité Mihi</div></div>
        </button>
      </div>

      <button onClick={reset}
        style={{width:"100%",background:"none",border:"1.5px solid #E8DDD4",borderRadius:10,padding:".55rem",fontSize:".78rem",color:"#888",cursor:"pointer",fontFamily:"inherit"}}>
        🔄 Recommencer le diagnostic
      </button>
    </div>
  );
}

const QUESTIONS = {
  parfum: QUESTIONS_PARFUM,
  skincare: [
    {id:"typePeau", question:"Quel est ton type de peau ?", multi:true, options:[
      {value:"seche",label:"🌵 Sèche — tiraillements, inconfort"},
      {value:"grasse",label:"✨ Grasse — brillances, pores visibles"},
      {value:"mixte",label:"☯️ Mixte — zone T grasse, joues sèches"},
      {value:"sensible",label:"🌸 Sensible — rougeurs, réactions"},
    ]},
    {id:"concern", question:"Ta préoccupation principale ?", multi:true, options:[
      {value:"rides",label:"⏳ Rides & Fermeté"},
      {value:"eclat",label:"✨ Éclat & Teint terne"},
      {value:"hydratation",label:"💧 Hydratation"},
      {value:"imperfections",label:"🔍 Imperfections & Pores"},
    ]},
    {id:"age", question:"Ton âge ?", multi:true, options:[
      {value:"moins25",label:"🌱 Moins de 25 ans"},
      {value:"25_35",label:"🌿 25-35 ans"},
      {value:"35_50",label:"🌺 35-50 ans"},
      {value:"plus50",label:"🌸 Plus de 50 ans"},
    ]},
    {id:"routine", question:"Ta routine actuelle ?", multi:true, options:[
      {value:"aucune",label:"❌ Aucune routine"},
      {value:"basique",label:"🧼 Basique — nettoyage uniquement"},
      {value:"intermediaire",label:"💆 Intermédiaire — crème quotidienne"},
      {value:"complete",label:"🌟 Complète — plusieurs étapes"},
    ]},
    {id:"allergie", question:"As-tu des allergies ou sensibilités ?", multi:true, options:[
      {value:"non",label:"✅ Non, aucune"},
      {value:"parfums",label:"🌸 Parfums & huiles essentielles"},
      {value:"alcool",label:"🍷 Alcool"},
      {value:"oui_autres",label:"⚠️ Oui, autres"},
    ]},
  ],
  cheveux: [
    {id:"typeCheveux", question:"Ton type de cheveux ?", multi:true, options:[
      {value:"fins",label:"🍃 Fins & plats"},
      {value:"epais",label:"🦁 Épais & volumineux"},
      {value:"boucles",label:"🌀 Bouclés & frisés"},
      {value:"lisses",label:"✨ Lisses & droits"},
    ]},
    {id:"probleme", question:"Ton problème principal ?", multi:true, options:[
      {value:"chute",label:"🍂 Chute & manque de densité"},
      {value:"sec",label:"🌵 Sécheresse & manque de brillance"},
      {value:"abime",label:"✂️ Cheveux abîmés & cassants"},
      {value:"colores",label:"🎨 Couleur à protéger"},
    ]},
    {id:"cuirChevelu", question:"Ton cuir chevelu ?", multi:true, options:[
      {value:"normal",label:"✅ Normal"},
      {value:"gras",label:"💧 Gras — racines rapides"},
      {value:"sec",label:"🌵 Sec — démangeaisons"},
      {value:"pellicules",label:"❄️ Pellicules"},
    ]},
    {id:"traitements", question:"Traitements chimiques ?", multi:true, options:[
      {value:"aucun",label:"🌿 Aucun"},
      {value:"coloration",label:"🎨 Coloration / Mèches"},
      {value:"lissage",label:"💆 Lissage / Défrisage"},
      {value:"permanente",label:"🌀 Permanente"},
    ]},
    {id:"objectifCheveux", question:"Ton objectif principal ?", multi:true, options:[
      {value:"pousse",label:"📈 Faire pousser mes cheveux"},
      {value:"volume",label:"💨 Ajouter du volume"},
      {value:"brillance",label:"✨ Retrouver la brillance"},
      {value:"reparation",label:"🔧 Réparer & fortifier"},
    ]},
  ],
  sante: [
    {id:"objectif", question:"Ton objectif santé principal ?", multi:true, options:[
      {value:"poids",label:"⚖️ Contrôle du poids & Minceur"},
      {value:"energie",label:"⚡ Énergie & Vitalité"},
      {value:"stress",label:"🧘 Stress & Sommeil"},
      {value:"immunite",label:"🛡️ Immunité & Défenses"},
    ]},
    {id:"mode", question:"Ton mode de vie ?", multi:true, options:[
      {value:"actif",label:"🏃 Actif — sport régulier"},
      {value:"modere",label:"🚶 Modéré — marche, léger"},
      {value:"sedentaire",label:"🪑 Sédentaire — travail de bureau"},
    ]},
    {id:"alimentation", question:"Ton alimentation ?", multi:true, options:[
      {value:"equilibree",label:"🥗 Équilibrée"},
      {value:"grignotage",label:"🍫 Grignotage fréquent"},
      {value:"restrictive",label:"🥦 Restrictive / Régime"},
      {value:"variable",label:"🎲 Variable selon les jours"},
    ]},
    {id:"probleme_sante", question:"Un problème spécifique ?", multi:true, options:[
      {value:"digestion",label:"🫃 Digestion difficile"},
      {value:"fatigue",label:"😴 Fatigue chronique"},
      {value:"articulations",label:"🦴 Articulations & Mobilité"},
      {value:"aucun",label:"✅ Aucun problème particulier"},
    ]},
    {id:"budget", question:"Budget mensuel compléments ?", multi:true, options:[
      {value:"petit",label:"💚 Moins de 30€"},
      {value:"moyen",label:"⭐ 30-70€"},
      {value:"confort",label:"🚀 70€ et plus"},
    ]},
  ],
  recrutement: QUIZ_RECRUTEMENT,
  blocage: QUIZ_BLOCAGE,
  silhouette: [
    {id:"objectif",question:"Quel est ton objectif principal ?",multi:true,options:[{value:"perdre",label:"⚖️ Perdre du poids"},{value:"tonifier",label:"💪 Tonifier ma silhouette"},{value:"energie",label:"⚡ Retrouver de l'énergie"},{value:"sommeil",label:"😴 Améliorer mon sommeil"}]},
    {id:"alimentation",question:"Comment décrirais-tu ton alimentation ?",multi:true,options:[{value:"equilibree",label:"🥗 Plutôt équilibrée"},{value:"sucre",label:"🍫 J'ai du mal avec le sucre"},{value:"grignotage",label:"🍿 Je grignote souvent"},{value:"saute",label:"⏭️ Je saute des repas"}]},
    {id:"activite",question:"Ton niveau d'activité physique actuel ?",options:[{value:"sedentaire",label:"🛋️ Très sédentaire"},{value:"leger",label:"🚶 Léger (marche)"},{value:"modere",label:"🏃 Modéré (2-3x/semaine)"},{value:"intense",label:"🏋️ Intense (4x+/semaine)"}]},
    {id:"sommeil",question:"Comment est ton sommeil ?",options:[{value:"tres_bon",label:"😴 Très bon, je me réveille reposée"},{value:"moyen",label:"😐 Moyen, parfois fatiguée"},{value:"mauvais",label:"😩 Mauvais, je suis épuisée"},{value:"insomnies",label:"😫 Insomnies fréquentes"}]},
    {id:"complementsActuels",question:"Tu prends déjà des compléments alimentaires ?",options:[{value:"non",label:"❌ Non, jamais"},{value:"vitamines",label:"💊 Vitamines basiques"},{value:"oui_efficace",label:"✅ Oui et ça marche"},{value:"oui_pas_satisfaite",label:"😕 Oui mais pas convaincue"}]},
    {id:"motivation",question:"Qu'est-ce qui te motive à changer ?",multi:true,options:[{value:"sante",label:"❤️ Ma santé"},{value:"apparence",label:"🌸 Mon apparence"},{value:"confiance",label:"💫 Ma confiance en moi"},{value:"exemple",label:"👶 Être un bon exemple"}]},
  ],
  chargementale: [
    {id:"equilibre",question:"Comment évalues-tu ton équilibre vie pro / vie perso ?",options:[{value:"excellent",label:"✅ Excellent, je gère bien"},{value:"correct",label:"😐 Correct mais perfectible"},{value:"difficile",label:"😓 Difficile, je cours tout le temps"},{value:"inexistant",label:"😩 Inexistant, je suis épuisée"}]},
    {id:"stress",question:"Quel est ton niveau de stress au quotidien ?",options:[{value:"faible",label:"😌 Faible, je suis sereine"},{value:"modere",label:"😐 Modéré, gérable"},{value:"eleve",label:"😬 Élevé, j'ai du mal"},{value:"tres_eleve",label:"🔴 Très élevé, c'est trop"}]},
    {id:"temps",question:"Combien de temps as-tu pour toi chaque jour ?",options:[{value:"plus1h",label:"⏰ Plus d'1 heure"},{value:"30a60",label:"⌚ 30 à 60 minutes"},{value:"moins30",label:"⏱️ Moins de 30 minutes"},{value:"rien",label:"❌ Quasiment rien"}]},
    {id:"revenu",question:"Ta situation financière te permet de...",options:[{value:"epargner",label:"💰 Épargner et voyager"},{value:"vivre",label:"✅ Vivre confortablement"},{value:"compter",label:"😐 Compter chaque euro"},{value:"galere",label:"😟 Galérer fin de mois"}]},
    {id:"aspiration",question:"Ton aspiration principale ?",multi:true,options:[{value:"liberte_temps",label:"⏰ Liberté de temps"},{value:"liberte_financiere",label:"💰 Liberté financière"},{value:"reconversion",label:"🔄 Me reconvertir"},{value:"complement",label:"💵 Complément de revenu"}]},
    {id:"ouverture",question:"Face à une opportunité de revenus complémentaires, tu es...",options:[{value:"tres_ouverte",label:"🚀 Très ouverte, je cherche"},{value:"ouverte",label:"✅ Ouverte si c'est sérieux"},{value:"sceptique",label:"🤔 Sceptique mais curieuse"},{value:"fermee",label:"❌ Pas intéressée pour l'instant"}]},
  ],
  detox: [
    {id:"reveil",question:"Comment te réveilles-tu le matin ?",options:[{value:"energique",label:"⚡ Energique et motivée"},{value:"normale",label:"😐 Normale, il faut quelques minutes"},{value:"fatiguee",label:"😩 Fatiguée comme si je n'avais pas dormi"},{value:"tres_fatiguee",label:"🔴 Épuisée, c'est dur de me lever"}]},
    {id:"barres",question:"As-tu des coups de barre dans la journée ?",options:[{value:"jamais",label:"✅ Jamais"},{value:"parfois",label:"🟡 Parfois, après les repas"},{value:"souvent",label:"🟠 Souvent, surtout vers 14h-15h"},{value:"toujours",label:"🔴 Tout le temps"}]},
    {id:"digestion",question:"Comment est ta digestion ?",multi:true,options:[{value:"ok",label:"✅ Parfaite, aucun souci"},{value:"ballonnements",label:"😮 Ballonnements fréquents"},{value:"lente",label:"🐌 Digestion lente et lourde"},{value:"irreguliere",label:"⚡ Irrégulière"}]},
    {id:"peau_reflet",question:"Comment est ton teint et ta peau ?",multi:true,options:[{value:"eclat",label:"✨ Beau teint, je suis rayonnante"},{value:"terne",label:"😐 Teint terne et sans éclat"},{value:"imperfections",label:"🔴 Imperfections fréquentes"},{value:"cernes",label:"😴 Cernes marquées"}]},
    {id:"sucre",question:"Ta consommation de sucre et produits transformés ?",options:[{value:"faible",label:"🥗 Faible, je mange sainement"},{value:"moderee",label:"😐 Modérée"},{value:"elevee",label:"🍫 Élevée, j'adore les sucreries"},{value:"tres_elevee",label:"🔴 Très élevée, c'est difficile de résister"}]},
    {id:"eau",question:"Tu bois combien d'eau par jour ?",options:[{value:"plus2L",label:"💧 Plus de 2 litres"},{value:"1a2L",label:"💧 Entre 1 et 2 litres"},{value:"moins1L",label:"💧 Moins d'1 litre"},{value:"peu",label:"❌ Très peu, j'oublie de boire"}]},
  ],
  budget: [
    {id:"shampoing",question:"Ton budget shampoing/après-shampoing/masque mensuel ?",options:[{value:"moins10",label:"💚 Moins de 10€"},{value:"10a25",label:"🟡 10€ à 25€"},{value:"25a50",label:"🟠 25€ à 50€"},{value:"plus50",label:"🔴 Plus de 50€"}]},
    {id:"soins_visage",question:"Ton budget soins visage/crèmes/sérums mensuel ?",options:[{value:"moins15",label:"💚 Moins de 15€"},{value:"15a40",label:"🟡 15€ à 40€"},{value:"40a80",label:"🟠 40€ à 80€"},{value:"plus80",label:"🔴 Plus de 80€"}]},
    {id:"maquillage",question:"Ton budget maquillage mensuel ?",options:[{value:"moins10",label:"💚 Moins de 10€"},{value:"10a30",label:"🟡 10€ à 30€"},{value:"30a60",label:"🟠 30€ à 60€"},{value:"plus60",label:"🔴 Plus de 60€"}]},
    {id:"complements",question:"Tu achètes des vitamines/compléments en pharmacie ou grande surface ?",options:[{value:"non",label:"❌ Non jamais"},{value:"parfois",label:"🟡 Parfois"},{value:"oui_peu",label:"🟠 Oui, 10€ à 30€/mois"},{value:"oui_beaucoup",label:"🔴 Oui, plus de 30€/mois"}]},
    {id:"satisfaction",question:"Es-tu satisfaite des résultats de tes produits actuels ?",options:[{value:"tres",label:"✅ Très satisfaite"},{value:"plutot",label:"😐 Plutôt satisfaite"},{value:"peu",label:"😕 Peu satisfaite"},{value:"non",label:"❌ Pas du tout"}]},
    {id:"qualite_composition",question:"Tu regardes la composition de tes produits ?",options:[{value:"toujours",label:"✅ Toujours, la qualité m'importe"},{value:"parfois",label:"😐 Parfois"},{value:"rarement",label:"🤷 Rarement"},{value:"jamais",label:"❌ Jamais, je regarde surtout le prix"}]},
  ],
  antiage: [
    {id:"hydratation_peau",question:"Comment tu hydrates ta peau au quotidien ?",options:[{value:"routine_complete",label:"✅ Routine complète matin et soir"},{value:"crème_basique",label:"😐 Crème basique parfois"},{value:"peu",label:"😕 Très peu ou irrégulièrement"},{value:"non",label:"❌ Je n'hydrate pas"}]},
    {id:"soleil",question:"Ton exposition au soleil sans protection ?",options:[{value:"protegee",label:"✅ Je me protège toujours"},{value:"parfois",label:"🟡 Parfois j'oublie"},{value:"souvent",label:"🟠 Souvent sans protection"},{value:"jamais_protection",label:"🔴 Jamais de protection"}]},
    {id:"stress_age",question:"Ton niveau de stress chronique ?",options:[{value:"faible",label:"✅ Faible"},{value:"modere",label:"🟡 Modéré"},{value:"eleve",label:"🟠 Élevé"},{value:"tres_eleve",label:"🔴 Très élevé, permanent"}]},
    {id:"sommeil_age",question:"Ton sommeil en moyenne ?",options:[{value:"plus7h",label:"✅ Plus de 7h, réparant"},{value:"6a7h",label:"🟡 6 à 7h"},{value:"moins6h",label:"🟠 Moins de 6h"},{value:"tres_peu",label:"🔴 Très peu, je suis épuisée"}]},
    {id:"alimentation_age",question:"Ta consommation de fruits et légumes ?",options:[{value:"quotidienne",label:"✅ Quotidienne et variée"},{value:"moderee",label:"😐 Modérée"},{value:"rare",label:"😕 Rare"},{value:"tres_rare",label:"❌ Très rare"}]},
    {id:"premiers_signes",question:"Quels premiers signes du vieillissement tu observes ?",multi:true,options:[{value:"rides",label:"😐 Premières ridules"},{value:"teint",label:"✨ Teint qui terne"},{value:"fermete",label:"🎈 Perte de fermeté"},{value:"taches",label:"🔵 Taches"}]},
  ],
  valeurmarche: [
    {id:"statut",question:"Ton statut professionnel actuel ?",options:[{value:"salariee",label:"👔 Salariée"},{value:"independante",label:"💼 Indépendante/Freelance"},{value:"sans_emploi",label:"🔍 En recherche d'emploi"},{value:"mere_foyer",label:"🏠 Mère au foyer"}]},
    {id:"taux_horaire",question:"Ton taux horaire net approximatif ?",options:[{value:"moins10",label:"💰 Moins de 10€/h"},{value:"10a15",label:"💰 10€ à 15€/h"},{value:"15a25",label:"💰 15€ à 25€/h"},{value:"plus25",label:"💰 Plus de 25€/h"}]},
    {id:"transport",question:"Temps de transport quotidien (aller-retour) ?",options:[{value:"non",label:"✅ Télétravail ou 0"},{value:"moins30min",label:"⏱️ Moins de 30 min"},{value:"30a60min",label:"⏰ 30 à 60 min"},{value:"plus1h",label:"🔴 Plus d'1 heure"}]},
    {id:"augmentation",question:"As-tu eu une augmentation ces 2 dernières années ?",options:[{value:"oui_significative",label:"✅ Oui, significative"},{value:"oui_inflation",label:"😐 Oui mais sous l'inflation"},{value:"non",label:"😟 Non, stagnation"},{value:"na",label:"N/A — sans emploi"}]},
    {id:"liberte",question:"As-tu la liberté de choisir tes horaires ?",options:[{value:"totale",label:"✅ Totale"},{value:"partielle",label:"😐 Partielle (télétravail...)"},{value:"non",label:"❌ Non, horaires fixes"},{value:"contraignants",label:"🔴 Horaires très contraignants"}]},
    {id:"satisfaction_pro",question:"Es-tu épanouie dans ta vie professionnelle ?",options:[{value:"tres",label:"✅ Oui, je m'éclate"},{value:"plutot",label:"😐 Plutôt oui"},{value:"peu",label:"😕 Peu, j'aspire à autre chose"},{value:"non",label:"❌ Non, je veux changer"}]},
  ],
  entrepreneuriat: [
    {id:"autonomie",question:"Dans ta vie, tu es plutôt...",options:[{value:"tres_autonome",label:"🦁 Très autonome, je prends mes décisions"},{value:"autonome",label:"✅ Autonome mais j'aime être guidée"},{value:"guidee",label:"🤝 J'aime qu'on me guide"},{value:"pas_sure",label:"🤷 Pas vraiment sûre"}]},
    {id:"liberte",question:"La liberté, c'est quoi pour toi ?",multi:true,options:[{value:"temps",label:"⏰ Choisir mes horaires"},{value:"lieu",label:"🌍 Travailler d'où je veux"},{value:"argent",label:"💰 Ne pas compter mes euros"},{value:"passion",label:"💫 Faire ce qui me passionne"}]},
    {id:"relation_autres",question:"Avec les autres, tu es naturellement...",options:[{value:"communicante",label:"💬 Communicante, j'adore échanger"},{value:"bienveillante",label:"🌸 Bienveillante, j'aime aider"},{value:"discrete",label:"😌 Plutôt discrète"},{value:"leader",label:"👑 Leader, j'aime montrer la voie"}]},
    {id:"defi",question:"Face à un défi, tu...",options:[{value:"fonce",label:"🚀 Tu fonces et tu apprends"},{value:"planifie",label:"📋 Tu planifies avant d'agir"},{value:"hesites",label:"😐 Tu hésites un peu"},{value:"abandonnes",label:"😕 Tu tends à abandonner"}]},
    {id:"creation",question:"Ta relation avec la créativité ?",options:[{value:"tres_creative",label:"🎨 Je suis très créative"},{value:"creative",label:"✅ Assez créative"},{value:"peu",label:"😐 Peu créative"},{value:"non",label:"❌ Pas du tout"}]},
    {id:"objectif_pro",question:"Ton objectif dans 2 ans ?",multi:true,options:[{value:"revenu_complementaire",label:"💰 Revenu complémentaire stable"},{value:"remplacer_salaire",label:"💼 Remplacer mon salaire"},{value:"liberte_complete",label:"🌍 Liberté complète"},{value:"aider",label:"🤝 Aider d'autres femmes à réussir"}]},
  ],
  complementrevenu: [
    {id:"objectif_montant",question:"De combien as-tu besoin pour vraiment respirer ce mois-ci ?",options:[{value:"300",label:"💰 300€ — pour souffler un peu"},{value:"500",label:"💰 500€ — pour les imprévus"},{value:"1000",label:"💰 1000€ — pour changer vraiment"},{value:"plus",label:"💰 Plus de 1000€ — je veux tout changer"}]},
    {id:"temps_dispo",question:"Combien de temps tu peux libérer par jour ?",options:[{value:"30min",label:"⏱️ 30 minutes"},{value:"1h",label:"⏰ 1 heure"},{value:"2h",label:"⏰ 2 heures"},{value:"plus2h",label:"⏰ Plus de 2 heures"}]},
    {id:"experience",question:"As-tu déjà tenté de gagner de l'argent autrement qu'avec ton emploi ?",options:[{value:"oui_reussi",label:"✅ Oui et ça a marché"},{value:"oui_echoue",label:"😕 Oui mais ça n'a pas fonctionné"},{value:"non_voulu",label:"💡 Non mais j'y pense souvent"},{value:"non_jamais",label:"❌ Non, jamais envisagé"}]},
    {id:"competences",question:"Tes points forts naturels ?",multi:true,options:[{value:"relationnel",label:"💬 Le relationnel, j'adore le contact"},{value:"organisation",label:"📋 L'organisation"},{value:"creativite",label:"🎨 La créativité et les réseaux"},{value:"conviction",label:"🔥 La conviction, je suis persuasive"}]},
    {id:"contraintes",question:"Tes contraintes principales ?",multi:true,options:[{value:"enfants",label:"👶 Mes enfants"},{value:"temps",label:"⏰ Manque de temps"},{value:"confiance",label:"😟 Manque de confiance"},{value:"argent_depart",label:"💰 Pas d'argent de départ"}]},
    {id:"urgence",question:"C'est urgent pour toi ?",options:[{value:"tres",label:"🔴 Oui, j'ai besoin d'agir maintenant"},{value:"oui",label:"🟠 Oui, dans les 3 prochains mois"},{value:"moyen_terme",label:"🟡 Plutôt à moyen terme"},{value:"exploration",label:"✅ Je me renseigne, pas d'urgence"}]},
  ],
  pasrecruiter: [
    {id:"depuis", question:"Depuis combien de temps tu essaies de recruter ?", multi:true, options:[
      {value:"moins1mois",label:"Moins d'1 mois — je débute"},
      {value:"1a3mois",label:"1 à 3 mois — j'ai essayé sans résultat"},
      {value:"plus3mois",label:"Plus de 3 mois — je stagne vraiment"},
      {value:"jamais",label:"Je n'ai pas encore vraiment commencé"},
    ]},
    {id:"approche", question:"Comment tu approches les prospects recrutement ?", multi:true, options:[
      {value:"dm_direct",label:"📩 DM direct avec présentation Mihi"},
      {value:"contenu",label:"📱 Je partage du contenu et j'attends"},
      {value:"bouche",label:"👥 Bouche-à-oreille, entourage proche"},
      {value:"rien",label:"❌ Je ne sais pas vraiment comment faire"},
    ]},
    {id:"objection", question:"Quelle est la réaction la plus fréquente quand tu en parles ?", multi:true, options:[
      {value:"mlm",label:"😬 'C'est du MLM je ne veux pas'"},
      {value:"temps",label:"⏰ 'Je n'ai pas le temps'"},
      {value:"argent",label:"💰 'Je n'ai pas les moyens de commencer'"},
      {value:"silence",label:"🔇 Pas de réponse, on m'ignore"},
    ]},
    {id:"contenu", question:"Est-ce que tu parles de ton activité sur les réseaux ?", multi:true, options:[
      {value:"oui_regulier",label:"✅ Oui, régulièrement"},
      {value:"oui_rare",label:"🔄 Oui mais rarement"},
      {value:"non_peur",label:"❌ Non, j'ai peur du regard des autres"},
      {value:"non_sais_pas",label:"❓ Non, je ne sais pas quoi dire"},
    ]},
    {id:"conviction", question:"Comment tu te sens quand tu parles de l'opportunité ?", multi:true, options:[
      {value:"convaincue",label:"💪 Convaincue et enthousiaste"},
      {value:"hesite",label:"😐 J'hésite, je ne suis pas sûre de moi"},
      {value:"peur_juger",label:"😟 Peur d'être jugée ou rejetée"},
      {value:"pas_legitime",label:"🤷 Je ne me sens pas légitime"},
    ]},
    {id:"resultat", question:"Est-ce que tu as des résultats visibles à montrer ?", multi:true, options:[
      {value:"oui_bons",label:"✨ Oui, de bons résultats et revenus"},
      {value:"oui_petits",label:"🌱 Oui, des petits débuts mais réels"},
      {value:"non_encore",label:"⏳ Pas encore de résultats significatifs"},
      {value:"non_partage",label:"🙈 J'en ai mais je ne les partage pas"},
    ]},
  ],
  pasvendre: [
    {id:"contact", question:"Combien de personnes contactes-tu en moyenne par semaine pour vendre ?", multi:true, options:[
      {value:"zero",label:"❌ 0 — je n'ose pas contacter"},
      {value:"1a5",label:"📩 1 à 5 personnes"},
      {value:"5a15",label:"📨 5 à 15 personnes"},
      {value:"plus15",label:"🚀 Plus de 15 personnes"},
    ]},
    {id:"suivi", question:"Est-ce que tu fais du suivi après un premier contact ?", multi:true, options:[
      {value:"oui_sys",label:"✅ Oui, systématiquement"},
      {value:"oui_parfois",label:"🔄 Parfois, pas régulièrement"},
      {value:"non_gene",label:"😬 Non, j'ai peur de déranger"},
      {value:"non_oublie",label:"❌ Non, j'oublie"},
    ]},
    {id:"objection_vente", question:"Quelle objection bloques-tu le plus souvent ?", multi:true, options:[
      {value:"prix",label:"💰 'C'est trop cher'"},
      {value:"reflechir",label:"🤔 'Je vais réfléchir' (et plus de nouvelles)"},
      {value:"besoin",label:"❓ 'Je ne suis pas sûre d'en avoir besoin'"},
      {value:"concurrence",label:"🔄 'J'ai déjà une autre marque'"},
    ]},
    {id:"presentation", question:"Comment tu présentes les produits ?", multi:true, options:[
      {value:"perso",label:"✨ Je partage mon expérience perso"},
      {value:"catalogue",label:"📋 J'envoie le catalogue ou des photos"},
      {value:"copie",label:"📋 Je copie-colle des descriptions toutes faites"},
      {value:"pas_aise",label:"😐 Je ne suis pas à l'aise pour en parler"},
    ]},
    {id:"clients_fideles", question:"As-tu des clientes qui reviennent régulièrement ?", multi:true, options:[
      {value:"oui_plusieurs",label:"💚 Oui, plusieurs clientes fidèles"},
      {value:"oui_1a2",label:"🌱 1 à 2 clientes régulières"},
      {value:"non_encorever",label:"⏳ Pas encore, je démarre"},
      {value:"non_achat_unique",label:"😕 Mes clientes achètent une fois et ne reviennent pas"},
    ]},
    {id:"contenu_vente", question:"Est-ce que tu crées du contenu sur tes produits ?", multi:true, options:[
      {value:"oui_regulier",label:"✅ Oui, régulièrement avec des résultats"},
      {value:"oui_peu",label:"🔄 Oui mais peu d'engagement"},
      {value:"non_sais_pas",label:"❓ Non, je ne sais pas quoi dire"},
      {value:"non_peur",label:"😟 Non, j'ai peur du regard des autres"},
    ]},
  ],
  reseaux: [
    {id:"publication", question:"À quelle fréquence tu publies sur tes réseaux ?", multi:true, options:[
      {value:"quotidien",label:"📅 Tous les jours"},
      {value:"quelques",label:"🗓️ Quelques fois par semaine"},
      {value:"rare",label:"📆 Une fois par semaine ou moins"},
      {value:"tres_rare",label:"❌ Très rarement ou jamais"},
    ]},
    {id:"format", question:"Quel format tu utilises principalement ?", multi:true, options:[
      {value:"reels",label:"🎥 Reels / vidéos courtes"},
      {value:"photos",label:"📸 Photos produits"},
      {value:"stories",label:"📱 Stories uniquement"},
      {value:"texte",label:"📝 Posts texte / carrousels"},
    ]},
    {id:"engagement", question:"Quel est ton niveau d'engagement habituel ?", multi:true, options:[
      {value:"bon",label:"🔥 Beaucoup de likes, commentaires, DM"},
      {value:"moyen",label:"📊 Quelques likes mais peu de commentaires"},
      {value:"faible",label:"😕 Très peu de réactions"},
      {value:"zero",label:"❌ Presque aucune réaction"},
    ]},
    {id:"contenu_type", question:"Qu'est-ce que tu publies principalement ?", multi:true, options:[
      {value:"promo",label:"🛍️ Promotions et produits uniquement"},
      {value:"perso",label:"🌸 Du contenu personnel et authentique"},
      {value:"mixte",label:"⚖️ Un mélange des deux"},
      {value:"copies",label:"📋 Des contenus copiés ou partagés"},
    ]},
    {id:"cible", question:"Est-ce que tu sais à qui tu t'adresses ?", multi:true, options:[
      {value:"oui_clair",label:"🎯 Oui, ma cible est très claire"},
      {value:"vague",label:"🤔 À peu près, mais c'est vague"},
      {value:"non",label:"❌ Non, je parle à tout le monde"},
      {value:"peur",label:"😟 Non, j'ai peur d'exclure des gens"},
    ]},
    {id:"regularite", question:"Est-ce que tu es régulière sur tes réseaux ?", multi:true, options:[
      {value:"tres",label:"✅ Oui, je suis très régulière"},
      {value:"par_vagues",label:"🌊 Par vagues — actif puis silence"},
      {value:"non_motivation",label:"😔 Non, je manque de motivation"},
      {value:"non_idees",label:"💡 Non, je manque d'idées"},
    ]},
  ],
  makeup: [
    {id:"carnation", question:"Quelle est ta carnation ?", multi:true, options:[
      {value:"claire",label:"🌸 Claire — peau très pâle, teinte porcelaine"},
      {value:"claire_rose",label:"🌷 Claire rosée — sous-tons roses/froids"},
      {value:"mediocre",label:"🌿 Moyenne — ni trop claire ni trop foncée"},
      {value:"dorée",label:"☀️ Dorée / Dorée — sous-tons chauds, beige doré"},
      {value:"olive",label:"🫒 Olive — sous-tons verts/jaunes"},
      {value:"foncée",label:"🌑 Foncée à ébène — du brun au noir intense"},
    ]},
    {id:"soustons", question:"Tes sous-tons dominants ?", multi:true, options:[
      {value:"froids",label:"❄️ Froids — veines bleues/violettes, gris rosé"},
      {value:"chauds",label:"🔥 Chauds — veines vertes, jaune/doré"},
      {value:"neutres",label:"⚖️ Neutres — mélange des deux"},
      {value:"je_sais_pas",label:"🤷 Je ne sais pas encore"},
    ]},
    {id:"problemes_peau", question:"Ta peau sous le maquillage ?", multi:true, options:[
      {value:"brille",label:"✨ Elle brille vite (peau grasse)"},
      {value:"tiraille",label:"💧 Elle est sèche, le fond de teint tiraille"},
      {value:"imperfections",label:"🔍 J'ai des imperfections à couvrir"},
      {value:"rougeurs",label:"🌹 J'ai des rougeurs / couperose"},
      {value:"taches",label:"🟤 J'ai des taches ou une peau inégale"},
      {value:"nickel",label:"✅ Elle est plutôt bien équilibrée"},
    ]},
    {id:"style", question:"Ton style makeup au quotidien ?", multi:true, options:[
      {value:"nude",label:"🤍 Naturel / No-makeup makeup"},
      {value:"classique",label:"💋 Classique — rouge à lèvres, mascara"},
      {value:"smoky",label:"🖤 Smoky / Yeux intenses"},
      {value:"coloré",label:"🌈 Coloré et créatif"},
      {value:"couvrant",label:"💆 Peau parfaite, haute couvrance"},
      {value:"occasion",label:"🎉 Surtout pour les occasions"},
    ]},
    {id:"morpho_yeux", question:"La forme de tes yeux ?", multi:true, options:[
      {value:"amande",label:"👁️ En amande"},
      {value:"ronds",label:"👀 Ronds et grands"},
      {value:"tombants",label:"🌸 Légèrement tombants"},
      {value:"petits",label:"✨ Petits — je veux les agrandir"},
      {value:"monopalpebres",label:"🫦 Monopalpébraux / Peu de paupière mobile"},
    ]},
    {id:"budget", question:"Ton budget makeup mensuel ?", multi:true, options:[
      {value:"petit",label:"💚 Petit budget — je cherche le rapport qualité/prix"},
      {value:"moyen",label:"⭐ Moyen — j'investis dans ce qui compte"},
      {value:"large",label:"👑 Je veux le meilleur sans regarder le prix"},
    ]},
  ],
  peaucorps: [
    {id:"zone_probleme", question:"Tes principales préoccupations sur le corps ?", multi:true, options:[
      {value:"secheresse",label:"🌵 Sécheresse — peau très sèche, squameuse"},
      {value:"cellulite",label:"🍊 Capitons / Cellulite"},
      {value:"vergetures",label:"〰️ Vergetures"},
      {value:"taches",label:"🟤 Taches brunes / Hyperpigmentation"},
      {value:"sensibilite",label:"🌸 Peau sensible / Réactive"},
      {value:"relachement",label:"💧 Relâchement / Peau peu ferme"},
      {value:"poils_incarés",label:"🪮 Poils incarnés"},
      {value:"keratose",label:"🔴 Kératose pilaire (petits boutons sur les bras)"},
    ]},
    {id:"zones", question:"Quelles zones te posent le plus problème ?", multi:true, options:[
      {value:"ventre",label:"🫶 Ventre"},
      {value:"cuisses",label:"🦵 Cuisses / Hanches"},
      {value:"bras",label:"💪 Bras"},
      {value:"dos",label:"🔙 Dos"},
      {value:"decollete",label:"👗 Décolleté"},
      {value:"jambes",label:"🦿 Jambes"},
      {value:"tout",label:"🌍 Un peu partout"},
    ]},
    {id:"routine_corps", question:"Ta routine corps actuelle ?", multi:true, options:[
      {value:"aucune",label:"❌ Aucune"},
      {value:"douche_rapide",label:"🚿 Juste le gel douche"},
      {value:"creme_basique",label:"🧴 Crème hydratante de temps en temps"},
      {value:"reguliere",label:"✅ Routine régulière matin ou soir"},
      {value:"huile",label:"🌿 J'utilise des huiles"},
    ]},
    {id:"texture_preferee", question:"La texture que tu préfères ?", multi:true, options:[
      {value:"legere",label:"💨 Légère — s'absorbe vite"},
      {value:"riche",label:"🧈 Riche et nourrissante"},
      {value:"huileuse",label:"🌟 Huile sèche — effet peau soyeuse"},
      {value:"gommage",label:"🍬 Gommage / Exfoliant"},
      {value:"peu_importe",label:"🤷 Peu importe si l'efficacité est là"},
    ]},
    {id:"objectif", question:"Ton objectif principal ?", multi:true, options:[
      {value:"hydratation",label:"💧 Hydratation intense"},
      {value:"fermete",label:"💪 Fermeté & Tonicité"},
      {value:"anti_cellulite",label:"🍊 Réduire la cellulite"},
      {value:"eclat",label:"✨ Peau lumineuse & Éclat"},
      {value:"cicatrisation",label:"🌿 Atténuer vergetures / Taches"},
      {value:"confort",label:"🤍 Juste être à l'aise dans ma peau"},
    ]},
  ],
};

// Onglet "Formation App" — vidéos de prise en main de l'application, par catégorie
const FORMATION_APP_DASHBOARD_SUBS=[
  {id:"fa-dashboard-general", num:"1", icon:"⚡", title:"Tableau de bord général", desc:"Mood-check, actions du jour, citation du jour, annonces."},
  {id:"fa-objectifs", num:"2", icon:"🎯", title:"Mes Objectifs", desc:"CA, recrues, paliers de qualification, primes."},
  {id:"fa-clients", num:"3", icon:"🛍️", title:"Clients", desc:"Fiches clientes, commandes, alertes fin de flacon."},
  {id:"fa-distributeurs", num:"4", icon:"👑", title:"Distributeurs", desc:"Annuaire, filleules, plan de rémunération."},
  {id:"fa-prospects", num:"5", icon:"👥", title:"Prospects", desc:"Organiser tes prospects par catégorie, statuts et relances."},
];

let FORMATION_APP_CATEGORIES_DEFAULT=[
  {id:"formationchef", num:"1", icon:"👑", title:"Formation Chef d'équipe", desc:"Espace Chef, Accès équipe, Assiduité — pour les cheffes d'équipe."},
  {id:"dashboard", num:"2", icon:"⚡", title:"Tableau de bord", desc:"Tout sur le tableau de bord et ses sous-sections.", folder:FORMATION_APP_DASHBOARD_SUBS},
  {id:"outils", num:"3", icon:"🛠️", title:"Outils généraux", desc:"Les bases de l'application : navigation, recherche produits, diagnostics."},
];

let FORMATION_APP_CATEGORIES=[...FORMATION_APP_CATEGORIES_DEFAULT];
async function chargerOrdreFormationApp(){
  try{
    const snap=await getDoc(doc(db,"admin","formation_app_ordre"));
    if(snap.exists()&&snap.data().ordre){
      const ordre=snap.data().ordre;
      FORMATION_APP_CATEGORIES=[...FORMATION_APP_CATEGORIES_DEFAULT].sort((a,b)=>ordre.indexOf(a.id)-ordre.indexOf(b.id));
    }
  }catch{}
}
chargerOrdreFormationApp();

export function FormationAppTab({adminItems=[]}){
  const[openFolder,setOpenFolder]=useState(null);
  const[openSub,setOpenSub]=useState(null);

  // formationapp = items généraux affichés dans la vue dossier principal
  // sinon filtre par onglet précis
  const itemsPour=(onglet)=>adminItems.filter(i=>i.onglet===onglet);

  const renderItem=(item)=>{
    const cfg={video:{icon:"▶",color:"#8B1A1A"},youtube:{icon:"▶",color:"#8B1A1A"},drive:{icon:"📄",color:C.brun2},doc:{icon:"📝",color:"#1a4a8b"},info:{icon:"💡",color:"#5C8A60"}}[item.type]||{icon:"▶",color:C.brun};
    return(
      <div key={item.id} style={{background:"rgba(196,154,138,.08)",border:`1px solid ${C.pale}`,borderRadius:10,padding:".65rem .85rem",marginBottom:".5rem"}}>
        <div style={{fontSize:".78rem",fontWeight:600,color:C.brun,marginBottom:item.description?".2rem":item.url?".35rem":0}}>{item.titre}</div>
        {item.description&&<div style={{fontSize:".72rem",color:C.gris,lineHeight:1.5,marginBottom:item.url?".4rem":0}}>{item.description}</div>}
        {item.url&&<a href={item.url} target="_blank" rel="noopener noreferrer"
          style={{display:"flex",alignItems:"center",gap:".5rem",background:cfg.color,borderRadius:8,padding:".45rem .8rem",textDecoration:"none"}}>
          <span style={{fontSize:".8rem"}}>{cfg.icon}</span>
          <span style={{fontSize:".72rem",fontWeight:600,color:"white"}}>Ouvrir</span>
        </a>}
      </div>
    );
  };

  const aVenir=(
    <div style={{display:"flex",alignItems:"center",gap:".5rem",background:C.creme,borderRadius:9,padding:".6rem .9rem",fontSize:".74rem",color:C.gris,fontStyle:"italic"}}>
      🎬 Vidéo à venir — disponible prochainement
    </div>
  );

  // Vue sous-section
  if(openFolder&&openSub){
    const cat=FORMATION_APP_CATEGORIES.find(c=>c.id===openFolder);
    const sub=cat?.folder?.find(s=>s.id===openSub);
    if(!sub)return null;
    const items=itemsPour(sub.id);
    return(
      <div>
        <div style={{display:"flex",gap:".3rem",alignItems:"center",fontSize:".7rem",marginBottom:".75rem",flexWrap:"wrap"}}>
          <button onClick={()=>{setOpenFolder(null);setOpenSub(null);}} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>Formation App</button>
          <span style={{color:C.pale}}>›</span>
          <button onClick={()=>setOpenSub(null)} style={{background:"none",border:"none",color:C.rose,fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem"}}>{cat.title}</button>
          <span style={{color:C.pale}}>›</span>
          <span style={{color:C.brun,fontWeight:700}}>{sub.title}</span>
        </div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".3rem"}}>{sub.icon} {sub.title}</div>
        <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{sub.desc}</p>
        {items.length>0?items.map(renderItem):aVenir}
      </div>
    );
  }

  // Vue dossier principal
  if(openFolder){
    const cat=FORMATION_APP_CATEGORIES.find(c=>c.id===openFolder);
    const items=itemsPour(openFolder);
    // Ajoute aussi les anciennes vidéos formationapp si on est dans une catégorie Formation App
    const itemsGeneraux = openFolder!=="formationapp" ? adminItems.filter(i=>i.onglet==="formationapp") : [];
    return(
      <div>
        <button onClick={()=>setOpenFolder(null)} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>
          ← Formation App
        </button>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:600,color:C.brun,marginBottom:".2rem"}}>{cat.icon} {cat.title}</div>
        <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>{cat.desc}</p>
        {items.length>0&&<div style={{marginBottom:"1rem"}}>{items.map(renderItem)}</div>}
        {itemsGeneraux.length>0&&!cat.folder&&(
          <div style={{marginBottom:"1rem"}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>✦ Vidéos disponibles</div>
            {itemsGeneraux.map(renderItem)}
          </div>
        )}
        {cat.folder?cat.folder.map(sub=>{
          const subItems=itemsPour(sub.id);
          return(
            <div key={sub.id} onClick={()=>setOpenSub(sub.id)}
              style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".75rem 1rem",marginBottom:".45rem",cursor:"pointer"}}>
              <div style={{display:"flex",alignItems:"center",gap:".6rem"}}>
                <div style={{width:34,height:34,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1rem",flexShrink:0}}>{sub.icon}</div>
                <div>
                  <div style={{fontFamily:"Georgia,serif",fontSize:".88rem",fontWeight:600,color:C.brun}}>{sub.num}. {sub.title}</div>
                  <div style={{fontSize:".62rem",color:C.gris}}>{subItems.length>0?`${subItems.length} vidéo${subItems.length>1?"s":""}`:sub.desc}</div>
                </div>
              </div>
              <span style={{color:C.pale}}>›</span>
            </div>
          );
        }):(items.length===0&&aVenir)}
      </div>
    );
  }

  // Vue liste principale
  return(
    <div>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.35rem",fontWeight:300,color:C.brun,marginBottom:".2rem"}}>
        Formation <em style={{fontStyle:"italic",color:C.rose}}>Application</em>
      </div>
      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>
        Clique sur une catégorie pour accéder aux vidéos de formation 🎬
      </p>
      {FORMATION_APP_CATEGORIES.map(cat=>{
        const totalItems=itemsPour(cat.id).length+(cat.folder?cat.folder.reduce((s,sub)=>s+itemsPour(sub.id).length,0):0);
        return(
          <div key={cat.id} onClick={()=>setOpenFolder(cat.id)}
            style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
            <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
              <div style={{width:38,height:38,borderRadius:"50%",background:C.rose+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{cat.icon}</div>
              <div>
                <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{cat.num}. {cat.title}</div>
                <div style={{fontSize:".66rem",color:C.gris}}>{totalItems>0?`${totalItems} vidéo${totalItems>1?"s":""}`:cat.desc}</div>
              </div>
            </div>
            <span style={{color:C.pale}}>›</span>
          </div>
        );
      })}
    </div>
  );
}



function ScriptsDiagSection(){
  const[open,setOpen]=useState(false);
  const[copie,setCopie]=useState(null);
  const scripts=SCRIPTS_DATA.find(s=>s.cat==="🔬 Proposer un diagnostic")?.scripts||[];

  const copier=(text,i)=>{
    navigator.clipboard?.writeText(text);
    setCopie(i);
    setTimeout(()=>setCopie(null),2000);
  };

  return(
    <div style={{marginTop:"1.5rem"}}>
      <button onClick={()=>setOpen(p=>!p)}
        style={{width:"100%",background:C.lilas+"15",border:`1px solid ${C.lilas}40`,borderRadius:11,padding:".65rem",fontSize:".78rem",fontWeight:600,color:C.brun,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"space-between"}}>
        <span>💬 Scripts pour proposer les diagnostics ({scripts.length})</span>
        <span style={{fontSize:".7rem"}}>{open?"▲":"▼"}</span>
      </button>
      {open&&(
        <div style={{marginTop:".5rem"}}>
          <p style={{fontSize:".68rem",color:C.gris,marginBottom:".65rem",lineHeight:1.6}}>
            Des idées variées pour aborder le diagnostic différemment — story, DM, Reel, approche mystère, preuve sociale...
          </p>
          {scripts.map((s,i)=>(
            <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:10,padding:".7rem .85rem",marginBottom:".5rem"}}>
              <div style={{fontSize:".65rem",fontWeight:700,color:C.lilas,marginBottom:".3rem",textTransform:"uppercase",letterSpacing:".06em"}}>{s.title}</div>
              <div style={{fontSize:".72rem",color:C.texte,lineHeight:1.65,whiteSpace:"pre-wrap",marginBottom:".4rem"}}>{s.text}</div>
              <button onClick={()=>copier(s.text,i)}
                style={{background:copie===i?C.vert:C.lilas,color:"white",border:"none",borderRadius:7,padding:".28rem .65rem",fontSize:".65rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
                {copie===i?"✓ Copié !":"📋 Copier"}
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function DiagnosticsTab({ uid, userName, externalMode=false, initialType="", initialClient="" }) {
  const [mode, setMode] = useState(initialType?"questionnaire":"choix");
  const [type, setType] = useState(initialType||"");
  const [step, setStep] = useState(0);
  const [reponses, setReponses] = useState({});
  const [reponsesFinales, setReponsesFinales] = useState(null);
  const [nomClient, setNomClient] = useState(initialClient||"");
  const [contactClient, setContactClient] = useState(""); // tel, email ou réseau social
  const [prenomContact, setPrenomContact] = useState("");
  const [nomContact, setNomContact] = useState("");
  const [telContact, setTelContact] = useState("");
  const [mailContact, setMailContact] = useState("");
  const [reseauContact, setReseauContact] = useState("");
  const [ordonnance, setOrdonnance] = useState(null);
  const [loading, setLoading] = useState(false);
  const [erreur, setErreur] = useState("");
  const[labelPerso,setLabelPerso]=useState({});const[showLabelInput,setShowLabelInput]=useState({});

  const questions = type ? (QUESTIONS[type]||[]) : [];
  const q = questions[step];
  // Si type sélectionné mais pas de questions définies => générer directement
  if(mode==="questionnaire" && type && questions.length===0 && !TYPES_SCORING.includes(type)){
    // Pour les types equipe sans questions, afficher un message simple
  }
  const TYPES_SCORING = ["recrutement","blocage"];

  const repondre = (val) => {
    const newRep = { ...reponses, [q.id]: val };
    setReponses(newRep);
    if (step < questions.length - 1) {
      setStep(step + 1);
    } else if (TYPES_SCORING.includes(type)) {
      genererResultatScoring(newRep);
    } else if (externalMode) {
      // En mode externe : afficher le formulaire de contact avant d'envoyer
      setReponsesFinales(newRep);
      setMode("contact");
    } else {
      setReponsesFinales(newRep); setMode("contact");
    }
  };

  // Calcule score/niveau pour les diagnostics de type scoring (recrutement, blocage)
  const genererResultatScoring = (rep) => {
    const quiz = QUESTIONS[type];
    const score = quiz.reduce((s,qq) => {
      const opt = qq.options.find(o=>o.value===rep[qq.id]);
      return s + (opt?.score || 0);
    }, 0);
    const max = quiz.length * 4;
    let result;
    if(type === "recrutement"){
      const niveau = getRecrutementLevel(score, max);
      const internalNote = getRecrutementInternalNote(rep, niveau.level);
      result = { kind:"recrutement", score, max, niveau, internalNote };
    } else {
      const { orientation, levelInfo } = getBlocageOrientation(score, max, rep);
      result = { kind:"blocage", score, max, orientation, levelInfo };
    }
    setOrdonnance(result);
    setMode("resultat");
    saveResult(result, rep);
  };

  const genererOrdonnance = async (rep) => {
    if(externalMode){
      setMode("loading");
      try{
        // Extraire les coordonnées si présentes
        const repSansContact={...rep};
        let contact={};
        if(repSansContact._contact){
          try{contact=JSON.parse(repSansContact._contact);}catch{}
          delete repSansContact._contact;
        }
        const nomFinal=contact.prenom?(contact.prenom+(contact.nom?" "+contact.nom:"")):(nomClient||"Cliente");

        // Stocker dans diag_externes (pour référence)
        const ref=doc(db,"diag_externes",`${uid}_${Date.now()}`);
        await setDoc(ref,{
          uid, type, nomClient:nomFinal, contact,
          reponses:repSansContact,
          date:todayLocalStr(),
          ts:Date.now(), traite:false
        });
        // Stocker aussi dans users/{uid}/db-diagnostics pour apparaître dans l'historique
        const userRef=doc(db,"users",uid);
        const snap=await getDoc(userRef);
        const existing=snap.exists()&&snap.data()["db-diagnostics"]?JSON.parse(snap.data()["db-diagnostics"]):[];
        const newDiag={
          id:`diag${Date.now()}`,
          type, nomClient:nomFinal, contact,
          reponses:repSansContact,
          date:todayLocalStr(),
          ts:Date.now(),
          externe:true, nonLu:true,
        };
        await setDoc(userRef,{"db-diagnostics":JSON.stringify([newDiag,...existing].slice(0,50))},{merge:true});
        setMode("attente");
      }catch{
        setErreur("Erreur lors de l'envoi. Merci de contacter ta conseillère directement.");
        setMode("questionnaire");
      }
      return;
    }
    setMode("loading");
    setErreur("");
    let result = null;
    let errDetail = "";
    try {
      result = await genererOrdonnanceIA(type, rep, nomClient);
    } catch(e) {
      errDetail = e?.message || String(e);
    }
    if (result) {
      setOrdonnance(result);
      setMode("resultat");
      saveResult(result, rep);
    } else {
      setErreur(`Erreur de génération${errDetail ? " : " + errDetail : ""}. Réessaie.`);
      setMode("questionnaire");
    }
  };

  const saveResult = async (reco, rep) => {
    try {
      const ref = doc(db, "users", uid);
      const snap = await getDoc(ref);
      const existing = snap.exists() && snap.data()["db-diagnostics"] ? JSON.parse(snap.data()["db-diagnostics"]) : [];
      const newDiag = { id: `diag${Date.now()}`, type, nomClient: nomClient||"Cliente", reponses: rep||reponses, ordonnance: reco, date: todayLocalStr(), ts: Date.now() };
      await setDoc(ref, { "db-diagnostics": JSON.stringify([newDiag,...existing].slice(0,50)) }, { merge: true });
    } catch {}
  };

  const copierLien = () => {
    const lien = `https://blazing-dinasty-1fad9.web.app?diag=${type}&uid=${uid}&client=${encodeURIComponent(nomClient||"")}`;
    navigator.clipboard.writeText(lien).catch(()=>{});
  };

  const reset = () => { setMode("choix"); setType(""); setStep(0); setReponses({}); setNomClient(""); setOrdonnance(null); setErreur(""); };

  const copierPack = (pack) => {
    const p = ordonnance[pack];
    const text = `✨ ${pack==="budget"?"💚 Pack Petit Budget":pack==="bestseller"?"⭐ Pack Best Seller":"🚀 Pack Boost"} — ${p.total}\n\n${p.produits.map(pr=>`• ${pr.nom} (${pr.prix})\n  → ${pr.usage} | ${pr.benefice}`).join("\n")}\n\nRoutine: ${p.routine}`;
    navigator.clipboard.writeText(text).catch(()=>{});
  };

  const copierTout = () => {
    if(!ordonnance) return;
    const packs = ["budget","bestseller","premium"];
    const labels = {budget:"💚 Pack Petit Budget",bestseller:"⭐ Pack Best Seller",premium:"🚀 Pack Boost Premium"};
    const text = `✨ ORDONNANCE BEAUTÉ — ${nomClient||"Cliente"}\n${ordonnance.introduction||""}\n\n${packs.map(pk=>{
      const p=ordonnance[pk];
      if(!p)return"";
      return `${labels[pk]} — ${p.total}\n${(p.produits||[]).map(pr=>`• ${pr.nom} (${pr.prix}) — ${pr.usage}\n  → ${pr.benefice||""}${pr.comment?"\n  💡 "+pr.comment:""}`).join("\n")}\n\n${p.routine?"📋 Routine :\n"+p.routine:""}`;
    }).filter(Boolean).join("\n\n")}${ordonnance.conseil?"\n\n💛 "+ordonnance.conseil:""}`;
    navigator.clipboard.writeText(text).catch(()=>{});
    alert("✅ Ordonnance complète copiée !");
  };

  const TYPES_DIAG = [
    // ── BEAUTÉ & BIEN-ÊTRE ─────────────────────────────────────────────
    { id:"parfum",        cat:"beaute", icon:"🌸", label:"Diagnostic Parfum",             desc:"Trouver votre parfum ideal parmi 26 fragrances Mihi",     pourquoi:"7 questions pour identifier votre univers olfactif et recevoir votre top 3 personnalise." },
    { id:"skincare",      cat:"beaute", icon:"✨", label:"Diagnostic Skincare",           desc:"Type de peau, préoccupations, routine",                    pourquoi:"Identifier les produits Mihi adaptés à ta peau et créer une routine personnalisée." },
    { id:"makeup",        cat:"beaute", icon:"💄", label:"Diagnostic Makeup & Couleurs",  desc:"Teint, carnation, style, fond de teint adapté",            pourquoi:"Trouver la teinte parfaite, les couleurs qui valorisent ET les produits makeup Mihi adaptés.", photo:true },
    { id:"peaucorps",     cat:"beaute", icon:"🧴", label:"Diagnostic Peau Corps",          desc:"Sécheresse, taches, vergetures, cellulite, sensibilité",   pourquoi:"Proposer une routine corps ciblée selon les vrais problèmes de peau du corps." },
    { id:"cheveux",       cat:"beaute", icon:"💇", label:"Diagnostic Cheveux",             desc:"Type, problèmes, traitements",                             pourquoi:"Trouver la routine capillaire idéale et les produits Mihi adaptés." },
    { id:"antiage",       cat:"beaute", icon:"🌸", label:"Diagnostic Anti-Âge",            desc:"Mode de vie, peau, prévention",                            pourquoi:"Découvrir l'âge biologique de sa peau crée une envie immédiate de solution." },
    { id:"budget",        cat:"beaute", icon:"💡", label:"Diagnostic Budget Beauté",       desc:"Comparaison dépenses actuelles vs routine Mihi",            pourquoi:"Casser l'objection du prix en montrant qu'elles dépensent déjà cet argent ailleurs." },
    // ── SANTÉ & BIEN-ÊTRE ──────────────────────────────────────────────
    { id:"sante",         cat:"sante",  icon:"💊", label:"Diagnostic Santé",              desc:"Objectifs, mode de vie, compléments",                      pourquoi:"Cibler les compléments alimentaires Mihi adaptés à tes besoins." },
    { id:"silhouette",    cat:"sante",  icon:"⚖️", label:"Diagnostic Silhouette",          desc:"Poids, énergie, alimentation, sommeil",                    pourquoi:"Évaluer les habitudes pour proposer un programme compléments ciblé." },
    { id:"detox",         cat:"sante",  icon:"🌿", label:"Test Détox & Énergie",           desc:"Toxines, fatigue chronique, digestion",                    pourquoi:"La fatigue touche tout le monde. Mène naturellement à une cure de compléments." },
    // ── RECRUTEMENT & ACTIVITÉ ─────────────────────────────────────────
    { id:"recrutement",   cat:"recrutement", icon:"🤝", label:"Profil Recrutement",       desc:"Prête pour le marketing de réseau ?",                      pourquoi:"Évaluer si un prospect est prêt pour l'opportunité Mihi." },
    { id:"complementrevenu", cat:"recrutement", icon:"💰", label:"Diagnostic Revenu Complémentaire", desc:"Objectif +300€, temps disponible, plan d'action", pourquoi:"Ultra concret et rassurant — un plan réaliste adapté à leur vie." },
    { id:"entrepreneuriat",  cat:"recrutement", icon:"🚀", label:"Quiz Profil Entrepreneur", desc:"Personnalité, autonomie, profil entrepreneur",           pourquoi:"Valider le potentiel avant même que la personne se lance." },
    { id:"valeurmarche",  cat:"recrutement", icon:"💼", label:"Test Valeur sur le Marché", desc:"Taux horaire, manque à gagner, temps sous-payé",          pourquoi:"Créer une frustration saine pour amener l'opportunité Mihi." },
    { id:"chargementale", cat:"recrutement", icon:"🧠", label:"Diagnostic Charge Mentale", desc:"Équilibre vie pro/perso, stress, gestion du temps",        pourquoi:"Tu diagnoses leur quotidien et proposes naturellement ta solution MLM." },
    { id:"libertefin",    cat:"recrutement", icon:"🏖️", label:"Diagnostic Liberté Financière", desc:"Objectifs de vie, vision à 3 ans, manques actuels",   pourquoi:"Projeter la personne dans son futur idéal puis montrer Mihi comme pont réaliste." },
    { id:"maman",         cat:"recrutement", icon:"🌸", label:"Diagnostic Maman Entrepreneur", desc:"Concilier famille, envies personnelles et activité",   pourquoi:"Toucher les mamans qui veulent un projet à elles sans sacrifier leur famille." },
    { id:"reconversion",  cat:"recrutement", icon:"🔄", label:"Diagnostic Reconversion",  desc:"Envie de changement, compétences, freins, tremplin",       pourquoi:"Capter les personnes insatisfaites de leur job et en quête de sens." },
    { id:"confianceensoi",cat:"recrutement", icon:"💪", label:"Diagnostic Confiance en Soi", desc:"Légitimité, peur du regard, syndrome de l'imposteur",   pourquoi:"Très puissant : révéler les forces de la personne avant de proposer Mihi." },
    { id:"reseauxsociaux2", cat:"recrutement", icon:"📲", label:"Audit Présence Digitale", desc:"Instagram, Facebook, personal branding, visibilité",      pourquoi:"Proposer Mihi comme moyen de monétiser une présence déjà existante." },
    // ── SUIVI ÉQUIPE ───────────────────────────────────────────────────
    { id:"blocage",       cat:"equipe", icon:"🔓", label:"Recrue bloquée",                desc:"Identifie le levier et un plan d'action",                  pourquoi:"Débloquer une distributrice qui stagne." },
    { id:"pasrecruiter",  cat:"equipe", icon:"😓", label:"Je n'arrive pas à recruter",    desc:"Freins et leviers pour débloquer le recrutement",           pourquoi:"Comprendre pourquoi le recrutement ne décolle pas." },
    { id:"pasvendre",     cat:"equipe", icon:"💸", label:"Je n'arrive pas à vendre",      desc:"Où ça coince et comment relancer",                         pourquoi:"Identifier le blocage exact dans le processus de vente." },
    { id:"reseaux",       cat:"equipe", icon:"📱", label:"Mes réseaux ne marchent pas",   desc:"Analyse de présence et stratégie contenus",                pourquoi:"Diagnostic précis de la stratégie réseaux." },
  ];

  const CATS_DIAG=[
    {id:"beaute",      label:"💆 Beauté & Soins",      color:C.rose},
    {id:"sante",       label:"💚 Santé & Bien-être",    color:C.vert},
    {id:"recrutement", label:"🚀 Recrutement",          color:C.or},
    {id:"equipe",      label:"👑 Suivi Équipe",         color:C.brun},
  ];

  const[catDiag,setCatDiag]=useState("beaute");

  // Helper : titre lisible depuis l'id
  const diagLabel=(id)=>TYPES_DIAG.find(t=>t.id===id)?.label||id;

  // Types equipe sans questions définies - affichage spécial  
  if(mode==="questionnaire" && type && questions.length===0 && !TYPES_SCORING.includes(type)){
    return(<div style={{paddingBottom:"2rem"}}>
      <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>← Retour</button>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:C.brun,marginBottom:".75rem"}}>{TYPES_DIAG.find(t=>t.id===type)?.label}</div>
      <div style={{background:C.creme,borderRadius:12,padding:"1rem",marginBottom:"1rem",border:"1px solid "+C.pale,fontSize:".78rem",color:C.gris,lineHeight:1.65}}>
        {TYPES_DIAG.find(t=>t.id===type)?.pourquoi}
      </div>
      <button onClick={()=>genererOrdonnance({})} style={{width:"100%",background:C.brun,color:"white",border:"none",borderRadius:10,padding:".7rem",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
        ✨ Générer le diagnostic IA
      </button>
    </div>);
  }

  // Rendu spécial parfum
  if(type==="parfum" && mode==="questionnaire"){
    return <DiagnosticParfumTab uid={uid} externalMode={externalMode} distributeurNom={userName||""}/>;
  }

  if (mode === "choix") return (
    <div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.35rem", fontWeight: 300, color: C.brun, marginBottom: ".2rem" }}>
        Diagnostics <em style={{ fontStyle: "italic", color: C.rose }}>& Outils</em>
      </div>
      <p style={{ fontSize: ".72rem", color: C.gris, marginBottom: ".75rem", lineHeight: 1.65 }}>
        Envoie un lien diagnostic à une cliente ou prospect — elle répond, tu reçois ses résultats et une ordonnance personnalisée.
      </p>

      {/* Onglets de catégories */}
      <div style={{ display:"flex", gap:".3rem", marginBottom:".75rem", overflowX:"auto", paddingBottom:".2rem" }}>
        {CATS_DIAG.map(c=>(
          <button key={c.id} onClick={()=>setCatDiag(c.id)}
            style={{ flex:"none", padding:".4rem .75rem", fontSize:".68rem", fontWeight:600, borderRadius:20, border:`1.5px solid ${catDiag===c.id?c.color:C.pale}`, background:catDiag===c.id?c.color:C.blanc, color:catDiag===c.id?"white":C.gris, cursor:"pointer", fontFamily:"inherit", whiteSpace:"nowrap" }}>
            {c.label}
          </button>
        ))}
      </div>

      {/* Prénom de la cliente — juste pour personnaliser le lien */}
      <div style={{ background:C.creme, borderRadius:12, padding:".65rem .9rem", marginBottom:".75rem", border:`1px solid ${C.pale}` }}>
        <div style={{ fontSize:".62rem", fontWeight:700, color:C.brun, marginBottom:".35rem", textTransform:"uppercase", letterSpacing:".08em" }}>👤 Prénom de la cliente (optionnel)</div>
        <input placeholder="Ex: Sophie" value={nomClient} onChange={e=>setNomClient(e.target.value)}
          style={{ width:"100%", border:`1px solid ${C.pale}`, borderRadius:8, padding:".42rem .65rem", fontSize:".82rem", fontFamily:"inherit", color:C.texte, background:"white", outline:"none" }}/>
        <div style={{ fontSize:".6rem", color:C.gris, marginTop:".3rem" }}>La cliente renseignera ses coordonnées elle-même à la fin du diagnostic.</div>
      </div>

      {/* Liste diagnostics de la catégorie sélectionnée */}
      {TYPES_DIAG.filter(t=>t.cat===catDiag).map(t => (
        <div key={t.id} style={{ background: C.blanc, border: `1px solid ${C.pale}`, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: ".65rem" }}>
          <div style={{ display: "flex", gap: ".8rem", alignItems: "flex-start", marginBottom: ".5rem" }}>
            <div style={{ width: 48, height: 48, borderRadius: "50%", background: C.rose+"20", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.4rem", flexShrink: 0 }}>{t.icon}</div>
            <div style={{flex:1}}>
              <div style={{ fontFamily: "Georgia,serif", fontSize: ".95rem", fontWeight: 600, color: C.brun, marginBottom: ".15rem" }}>{t.label}</div>
              <div style={{ fontSize: ".72rem", color: C.gris, marginBottom: t.pourquoi?".3rem":"0" }}>{t.desc}</div>
              {t.pourquoi&&<div style={{ fontSize: ".68rem", color: C.rose, fontStyle: "italic", lineHeight: 1.55, background: C.rose+"08", borderRadius: 7, padding: ".3rem .5rem", borderLeft: `2px solid ${C.rose}` }}>💡 {t.pourquoi}</div>}
            </div>
          </div>
          <div style={{ display: "flex", gap: ".4rem" }}>
            <button onClick={() => { setType(t.id); setMode("questionnaire"); setStep(0); setReponses({}); }}
              style={{ flex: 1, background: C.brun, color: C.blanc, border: "none", borderRadius: 9, padding: ".5rem", fontSize: ".75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              📋 Remplir maintenant
            </button>
            <button onClick={() => setShowLabelInput(p=>({...p,[t.id]:!p[t.id]}))}
              style={{ flex: 1, background: C.rose+"20", color: C.rose, border: `1px solid ${C.rose}`, borderRadius: 9, padding: ".5rem", fontSize: ".75rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
              🔗 Envoyer le lien
            </button>
          </div>
          {showLabelInput[t.id]&&(<div style={{marginTop:".5rem",background:"#FAF7F2",borderRadius:9,padding:".6rem .75rem",border:"1px solid #E8DDD4"}}><div style={{fontSize:".6rem",color:"#888",marginBottom:".3rem",fontWeight:600}}>Intitule du lien (optionnel)</div><input value={labelPerso[t.id]||""} onChange={e=>setLabelPerso(p=>({...p,[t.id]:e.target.value}))} placeholder="Ex: Mon diagnostic Skincare gratuit" style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:7,padding:".38rem .55rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",marginBottom:".4rem"}}/><button onClick={()=>{copierLienDirect(t.id,labelPerso[t.id]);setShowLabelInput(p=>({...p,[t.id]:false}));}} style={{width:"100%",background:"#C49A8A",color:"white",border:"none",borderRadius:8,padding:".42rem",fontSize:".75rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>Copier le message</button></div>)}
        </div>
      ))}

      {/* Scripts pour proposer les diagnostics */}
      <ScriptsDiagSection/>
    </div>
  );
  function copierLienDirect(diagType, labelCustom) {
    const lien = `https://blazing-dinasty-1fad9.web.app?diag=${diagType}&uid=${uid}&distributrice=${encodeURIComponent(userName)}&client=${encodeURIComponent(nomClient||"")}`;


    const msg = (labelCustom ? labelCustom+" " : "Coucou "+(nomClient||"")+"! Diagnostic gratuit 2 min ! ")  + lien;
    navigator.clipboard && navigator.clipboard.writeText(msg);
    alert("Message copie ! Colle-le dans ta conversation.");
  }
  if (mode === "loading") return (
    <div style={{textAlign:"center",padding:"3rem 1rem"}}>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, marginBottom: ".5rem" }}>Génération en cours...</div>
      <p style={{ fontSize: ".76rem", color: C.gris, lineHeight: 1.6 }}>
        L'IA analyse les réponses et sélectionne les meilleurs produits Mihi pour {nomClient||"ta cliente"} 🖤
      </p>
    </div>
  );

  if (mode === "contact") return (
    <div style={{padding:"1rem 0"}}>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",fontWeight:300,color:C.brun,marginBottom:".3rem"}}>
        Presque terminé <em style={{fontStyle:"italic",color:C.rose}}>✨</em>
      </div>
      <p style={{fontSize:".76rem",color:C.gris,marginBottom:"1.25rem",lineHeight:1.65}}>
        Laisse tes coordonnées pour que ta conseillère puisse te recontacter avec tes recommandations personnalisées 💛
      </p>

      <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
        <div style={{display:"flex",gap:".5rem",marginBottom:".6rem"}}>
          <div style={{flex:1}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Prénom *</div>
            <input value={prenomContact} onChange={e=>setPrenomContact(e.target.value)} placeholder="Ton prénom"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
          <div style={{flex:1}}>
            <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>Nom</div>
            <input value={nomContact} onChange={e=>setNomContact(e.target.value)} placeholder="Ton nom"
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
          </div>
        </div>

        <div style={{fontSize:".6rem",color:C.gris,marginBottom:".5rem",fontWeight:600}}>Comment te contacter ? <span style={{color:"#B04040"}}>* au moins un obligatoire</span></div>
        <div style={{marginBottom:".5rem"}}>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>📱 Téléphone / WhatsApp</div>
          <input value={telContact} onChange={e=>setTelContact(e.target.value)} placeholder="06 XX XX XX XX" type="tel"
            style={{width:"100%",border:`1.5px solid ${telContact.trim()?C.vert:C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
        <div style={{marginBottom:".5rem"}}>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>📧 Email</div>
          <input value={mailContact} onChange={e=>setMailContact(e.target.value)} placeholder="ton@email.com" type="email"
            style={{width:"100%",border:`1.5px solid ${mailContact.trim()?C.vert:C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
        <div>
          <div style={{fontSize:".6rem",color:C.gris,marginBottom:".2rem"}}>💬 Messenger / Instagram / Facebook</div>
          <input value={reseauContact} onChange={e=>setReseauContact(e.target.value)} placeholder="@tonpseudo ou lien profil"
            style={{width:"100%",border:`1.5px solid ${reseauContact.trim()?C.vert:C.pale}`,borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
        </div>
      </div>

      {/* Message d'alerte si contact manquant */}
      {prenomContact.trim() && !telContact.trim() && !mailContact.trim() && !reseauContact.trim() && (
        <div style={{background:"#FFF3F0",border:"1px solid #F4C0B0",borderRadius:8,padding:".55rem .75rem",marginBottom:".6rem",fontSize:".72rem",color:"#B04040",display:"flex",gap:".4rem",alignItems:"center"}}>
          ⚠️ Ajoute ton téléphone, email ou réseau social pour recevoir tes recommandations
        </div>
      )}

      <button
        onClick={()=>{
          const contact={prenom:prenomContact,nom:nomContact,tel:telContact,mail:mailContact,reseau:reseauContact};
          genererOrdonnance({...reponsesFinales, _contact:JSON.stringify(contact)});
        }}
        disabled={prenomContact.trim().length<2||nomContact.trim().length<2||(!(/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(mailContact.trim()))&&!(/^[\d\+\-\s\(\)]{10,}$/.test(telContact.trim())))}
        style={{width:"100%",background:(prenomContact.trim()&&(telContact.trim()||mailContact.trim()||reseauContact.trim()))?C.brun:C.pale,color:(prenomContact.trim()&&(telContact.trim()||mailContact.trim()||reseauContact.trim()))?C.blanc:C.gris,border:"none",borderRadius:10,padding:".75rem",fontSize:".84rem",fontWeight:600,fontFamily:"inherit",cursor:(prenomContact.trim()&&(telContact.trim()||mailContact.trim()||reseauContact.trim()))?"pointer":"default",transition:"all .2s",marginBottom:".5rem"}}>
        Envoyer mes réponses →
      </button>
      <div style={{fontSize:".65rem",color:C.gris,textAlign:"center"}}>
        * Prénom + au moins un moyen de contact obligatoires
      </div>
    </div>
  );

  if (mode === "attente") return (
    <div style={{ textAlign: "center", padding: "3rem 1rem" }}>
      <div style={{ fontSize: "3rem", marginBottom: "1rem" }}>💛</div>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.2rem", color: C.brun, marginBottom: ".75rem" }}>
        Merci {nomClient||""} !
      </div>
      <p style={{ fontSize: ".82rem", color: C.gris, lineHeight: 1.7, marginBottom: "1.5rem" }}>
        Tes réponses ont bien été envoyées à ta conseillère Mihi.<br/>
        Elle va préparer ton diagnostic personnalisé et te recontacter très vite avec tes recommandations produits ✨
      </p>
      <div style={{ background: C.creme, borderRadius: 12, padding: "1rem", border: `1px solid ${C.pale}`, fontSize: ".76rem", color: C.brun, lineHeight: 1.6 }}>
        🌸 En attendant, n'hésite pas à lui poser toutes tes questions !
      </div>
    </div>
  );

  if (mode === "questionnaire") return (
    <div>
      <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Retour</button>
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, marginBottom: ".3rem" }}>
        {diagLabel(type)}
        {nomClient && <span style={{ fontSize: ".8rem", color: C.rose, marginLeft: ".5rem" }}>— {nomClient}</span>}
      </div>
      <div style={{ height: 4, background: C.pale, borderRadius: 10, overflow: "hidden", marginBottom: "1.5rem" }}>
        <div style={{ height: "100%", background: C.rose, width: `${((step+1)/questions.length)*100}%`, borderRadius: 10, transition: "width .3s" }} />
      </div>
      <div style={{ fontSize: ".6rem", color: C.gris, marginBottom: ".75rem" }}>Question {step+1} / {questions.length}</div>
      {erreur && <div style={{ background: "#FFF0F0", border: "1px solid #F44", borderRadius: 8, padding: ".6rem .8rem", marginBottom: ".75rem", fontSize: ".75rem", color: "#B04040" }}>{erreur}</div>}
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.1rem", color: C.brun, fontWeight: 400, marginBottom: ".5rem", lineHeight: 1.45 }}>{q.question}</div>
      {q.multi&&<div style={{fontSize:".65rem",color:C.gris,marginBottom:".75rem",fontStyle:"italic"}}>✨ Tu peux choisir plusieurs réponses</div>}
      {!q.multi&&<div style={{height:".75rem"}}/>}
      {q.options.map(opt => {
        const repCourante = reponses[q.id];
        const isSelected = q.multi
          ? (Array.isArray(repCourante) ? repCourante.includes(opt.value) : false)
          : repCourante === opt.value;
        return(
          <div key={opt.value} onClick={() => {
            if(q.multi){
              const current = Array.isArray(repCourante) ? repCourante : [];
              const next = current.includes(opt.value) ? current.filter(v=>v!==opt.value) : [...current, opt.value];
              setReponses(r=>({...r, [q.id]: next}));
            } else {
              repondre(opt.value);
            }
          }}
            style={{ background: isSelected?C.rose+"15":C.blanc, border: `1.5px solid ${isSelected?C.rose:C.pale}`, borderRadius: 12, padding: ".85rem 1rem", marginBottom: ".5rem", cursor: "pointer", fontSize: ".82rem", color: C.texte, transition: "all .15s", display: "flex", alignItems: "center", gap: ".6rem" }}>
            <div style={{ width: 20, height: 20, borderRadius: q.multi?"4px":"50%", border: `2px solid ${isSelected?C.rose:C.pale}`, flexShrink: 0, background: isSelected?C.rose:"transparent", display:"flex", alignItems:"center", justifyContent:"center" }}>
              {isSelected&&<span style={{fontSize:".6rem",color:"white",fontWeight:700}}>✓</span>}
            </div>
            {opt.label}
          </div>
        );
      })}
      {q.multi&&(
        <button onClick={()=>{
          const rep = reponses[q.id];
          if(!rep||rep.length===0) return;
          repondre(Array.isArray(rep)?rep.join(","):rep);
        }}
          disabled={!reponses[q.id]||reponses[q.id].length===0}
          style={{width:"100%",marginTop:".5rem",background:reponses[q.id]?.length>0?C.brun:C.pale,color:reponses[q.id]?.length>0?C.blanc:C.gris,border:"none",borderRadius:10,padding:".65rem",fontSize:".82rem",fontWeight:600,fontFamily:"inherit",cursor:reponses[q.id]?.length>0?"pointer":"default"}}>
          Valider ({reponses[q.id]?.length||0} sélectionné{reponses[q.id]?.length>1?"s":""}) →
        </button>
      )}
    </div>
  );

  if (mode === "resultat" && ordonnance && ordonnance.kind === "recrutement") {
    const { niveau, internalNote, score, max } = ordonnance;
    const levelColors = { 1:"#A85C5C", 2:"#B8804A", 3:"#5C8A6A", 4:C.lilas };
    const col = levelColors[niveau.level] || C.rose;
    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ display:"inline-block", background: col+"20", color: col, fontSize:".6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", borderRadius:20, padding:".25rem .75rem", marginBottom:".6rem" }}>
          Niveau {niveau.level}/4 — {niveau.label}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:"1.2rem", color:C.brun, marginBottom:".3rem" }}>
          {nomClient ? `Ton résultat, ${nomClient}` : "Ton résultat"}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontStyle:"italic", fontSize:"2.2rem", color:C.lilas, marginBottom:".6rem" }}>{score} / {max}</div>
        <p style={{ fontSize:".8rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{niveau.desc}</p>

        {niveau.advice.map((a,i)=>(
          <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
            <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
            <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
          </div>
        ))}

        <div style={{ background:C.lilas+"15", border:`1px solid ${C.lilas}40`, borderRadius:10, padding:".8rem .9rem", marginTop:"1rem" }}>
          <div style={{ fontSize:".76rem", fontWeight:700, color:C.brun, marginBottom:".4rem" }}>👀 Pour toi (note interne)</div>
          <div style={{ fontSize:".75rem", color:C.texte, lineHeight:1.6, marginBottom:".3rem" }}><strong>Levier conseillé :</strong> {internalNote.levier}</div>
          <div style={{ fontSize:".75rem", color:C.texte, lineHeight:1.6 }}><strong>Action recommandée :</strong> {internalNote.action}</div>
          <div style={{ fontSize:".65rem", color:C.gris, marginTop:".4rem" }}>Cette note est privée et reste visible uniquement dans "Mes diagnostics".</div>
        </div>

        <p style={{ fontSize:".65rem", color:C.gris, textAlign:"center", marginTop:"1rem" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }

  if (mode === "resultat" && ordonnance && ordonnance.kind === "blocage") {
    const { orientation, levelInfo, score, max } = ordonnance;
    const levelColors = { 1:"#A85C5C", 2:"#B8804A", 3:"#5C8A6A", 4:C.lilas };
    const col = levelColors[levelInfo.level] || C.rose;
    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ display:"inline-block", background: col+"20", color: col, fontSize:".6rem", fontWeight:700, textTransform:"uppercase", letterSpacing:".1em", borderRadius:20, padding:".25rem .75rem", marginBottom:".6rem" }}>
          Niveau {levelInfo.level}/4 — {levelInfo.label}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontSize:"1.2rem", color:C.brun, marginBottom:".3rem" }}>
          {nomClient ? `Ton résultat, ${nomClient}` : "Ton résultat"}
        </div>
        <div style={{ fontFamily:"Georgia,serif", fontStyle:"italic", fontSize:"2.2rem", color:C.lilas, marginBottom:".6rem" }}>{score} / {max}</div>
        <p style={{ fontSize:".8rem", color:C.texte, lineHeight:1.7, marginBottom:"1rem" }}>{levelInfo.extra}</p>

        <div style={{ background:C.rose+"15", borderLeft:`4px solid ${C.rose}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
          <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{orientation.title}</div>
          <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{orientation.desc}</div>
        </div>

        {orientation.actions.map((a,i)=>(
          <div key={i} style={{ background:C.creme, borderLeft:`4px solid ${C.lilas}`, borderRadius:"0 10px 10px 0", padding:".7rem .9rem", marginBottom:".6rem" }}>
            <div style={{ fontSize:".8rem", fontWeight:700, color:C.brun, marginBottom:".2rem" }}>{a.h}</div>
            <div style={{ fontSize:".76rem", color:C.texte, lineHeight:1.6 }}>{a.t}</div>
          </div>
        ))}

        <p style={{ fontSize:".65rem", color:C.gris, textAlign:"center", marginTop:"1rem" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }

  if (mode === "resultat" && ordonnance && ordonnance.kind === "business") {
    const typeLabels = {pasrecruiter:"😓 Je n'arrive pas à recruter",pasvendre:"💸 Je n'arrive pas à vendre",reseaux:"📱 Mes réseaux ne marchent pas"};
    return(
      <div>
        <button onClick={()=>setMode("choix")} style={{background:"none",border:"none",color:C.gris,fontSize:".75rem",cursor:"pointer",fontFamily:"inherit",marginBottom:"1rem",padding:0}}>← Retour</button>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:600,color:C.brun,marginBottom:".15rem"}}>{typeLabels[ordonnance.type]}</div>
        <div style={{fontSize:".65rem",color:C.gris,marginBottom:"1rem"}}>{nomClient||""}</div>

        {/* Diagnostic */}
        <div style={{background:`linear-gradient(135deg,${C.brun},${C.brun2})`,borderRadius:12,padding:".9rem 1rem",marginBottom:"1rem"}}>
          <div style={{fontSize:".58rem",fontWeight:700,color:C.or,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".4rem"}}>🔍 Mon diagnostic</div>
          <div style={{fontSize:".8rem",color:C.pale,lineHeight:1.7}}>{ordonnance.diagnostic}</div>
        </div>

        {/* Points forts */}
        {ordonnance.points_forts?.length>0&&(
          <div style={{background:C.vert+"10",border:`1px solid ${C.vert}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,color:C.vert,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>💚 Tes points forts</div>
            {ordonnance.points_forts.map((p,i)=>(
              <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem"}}>
                <span style={{color:C.vert,flexShrink:0}}>✓</span>
                <span style={{fontSize:".78rem",color:C.texte}}>{p}</span>
              </div>
            ))}
          </div>
        )}

        {/* Blocages */}
        {ordonnance.blocages?.length>0&&(
          <div style={{background:C.rose+"10",border:`1px solid ${C.rose}30`,borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,color:C.rose,letterSpacing:".1em",textTransform:"uppercase",marginBottom:".5rem"}}>🔓 Ce qui te bloque</div>
            {ordonnance.blocages.map((b,i)=>(
              <div key={i} style={{display:"flex",gap:".5rem",marginBottom:".35rem"}}>
                <span style={{color:C.rose,flexShrink:0}}>→</span>
                <span style={{fontSize:".78rem",color:C.texte}}>{b}</span>
              </div>
            ))}
          </div>
        )}

        {/* Plan d'action */}
        {ordonnance.plan_action?.map((a,i)=>(
          <div key={i} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",marginBottom:".6rem"}}>
            <div style={{fontSize:".72rem",fontWeight:700,color:C.brun,marginBottom:".3rem"}}>{a.priorite}</div>
            <div style={{fontSize:".82rem",fontWeight:600,color:C.texte,marginBottom:".25rem"}}>{a.action}</div>
            <div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic"}}>{a.pourquoi}</div>
          </div>
        ))}

        {/* Message encouragement */}
        {ordonnance.message_encouragement&&(
          <div style={{background:C.creme,borderRadius:10,padding:".75rem 1rem",border:`1px solid ${C.or}40`,marginTop:"1rem"}}>
            <div style={{fontSize:".8rem",color:C.brun,lineHeight:1.65,fontStyle:"italic"}}>💛 "{ordonnance.message_encouragement}"</div>
          </div>
        )}
      </div>
    );
  }

  if (mode === "resultat" && ordonnance) {
    const packs = [
      { key: "budget", label: "💚 Pack Petit Budget", color: "#5C8A60", bg: "#5C8A6015" },
      { key: "bestseller", label: "⭐ Pack Best Seller", color: C.or, bg: C.or+"15" },
      { key: "premium", label: "🚀 Pack Boost Premium", color: C.rose, bg: C.rose+"15" },
    ];

    return (
      <div>
        <button onClick={reset} style={{ background: "none", border: "none", color: C.gris, fontSize: ".75rem", cursor: "pointer", fontFamily: "inherit", marginBottom: "1rem", padding: 0 }}>← Nouveau diagnostic</button>

        <div style={{ background: C.brun, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: "1.25rem" }}>
          <div style={{ fontSize: ".55rem", fontWeight: 700, letterSpacing: ".15em", color: C.or, marginBottom: ".3rem" }}>✦ ORDONNANCE IA — PRODUITS MIHI</div>
          <div style={{ fontFamily: "Georgia,serif", fontSize: "1rem", color: C.blanc, fontWeight: 300, lineHeight: 1.5 }}>
            {ordonnance.introduction}
          </div>
        </div>

        {packs.map(pack => {
          const p = ordonnance[pack.key];
          if (!p) return null;
          return (
            <div key={pack.key} style={{ background: pack.bg, border: `2px solid ${pack.color}30`, borderRadius: 14, padding: "1rem 1.1rem", marginBottom: ".75rem" }}>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: ".65rem" }}>
                <div style={{ fontSize: ".82rem", fontWeight: 700, color: pack.color }}>{pack.label}</div>
                <div style={{ background: pack.color, color: "white", fontSize: ".7rem", fontWeight: 700, padding: ".2rem .6rem", borderRadius: 20 }}>{p.total}</div>
              </div>

              {p.produits && p.produits.map((prod, i) => (
                <div key={i} style={{ background: "rgba(255,255,255,.7)", borderRadius: 9, padding: ".55rem .75rem", marginBottom: ".35rem" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", marginBottom: ".15rem" }}>
                    <div style={{ fontSize: ".78rem", fontWeight: 600, color: C.brun, flex: 1, paddingRight: ".5rem" }}>{prod.nom}</div>
                    <div style={{ fontSize: ".75rem", fontWeight: 700, color: pack.color, flexShrink: 0 }}>{prod.prix}</div>
                  </div>
                  <div style={{ fontSize: ".65rem", color: C.gris }}>
                    <span style={{ background: pack.color+"20", color: pack.color, padding: ".1rem .35rem", borderRadius: 20, marginRight: ".35rem", fontWeight: 600 }}>{prod.usage}</span>
                    {prod.benefice}
                  </div>
                </div>
              ))}

              <div style={{ background: "rgba(255,255,255,.5)", borderRadius: 8, padding: ".5rem .7rem", marginTop: ".5rem", fontSize: ".7rem", color: C.brun, fontStyle: "italic", marginBottom: ".5rem" }}>
                📋 {p.routine}
              </div>

              <button onClick={() => copierPack(pack.key)}
                style={{ width: "100%", background: pack.color, color: "white", border: "none", borderRadius: 8, padding: ".42rem", fontSize: ".72rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer" }}>
                📋 Copier ce pack
              </button>
            </div>
          );
        })}

        <button onClick={copierTout}
          style={{ width: "100%", background: C.brun, color: C.blanc, border: "none", borderRadius: 10, padding: ".65rem", fontSize: ".82rem", fontWeight: 600, fontFamily: "inherit", cursor: "pointer", marginBottom: ".5rem" }}>
          📋 Copier l'ordonnance complète
        </button>

        {/* Bouton PDF côté cliente */}
        <button onClick={()=>{
          if(!ordonnance) return;
          const fmt=(pk)=>{if(!pk)return"";return(pk.produits||[]).map(pr=>"<div class='produit'><div class='nom'>"+pr.nom+" — "+(pr.prix||"")+"</div><div class='usage'>"+(pr.usage||"")+"</div><div class='ben'>"+(pr.benefice||"")+"</div>"+(pr.comment?"<div class='tip'>💡 "+pr.comment+"</div>":"")+"</div>").join("")+(pk.routine?"<div class='routine'>📋 "+pk.routine+"</div>":"");};
          const html="<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{font-family:'Trebuchet MS',sans-serif;max-width:600px;margin:0 auto;padding:2rem;color:#3D2B1F;background:#FAF7F2;}h1{font-family:Georgia,serif;color:#3D1F0E;font-weight:300;font-size:1.5rem;margin-bottom:.25rem;}.sub{color:#C49A8A;font-size:.85rem;margin-bottom:1.5rem;}.intro{background:#F5EFE8;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.9rem;line-height:1.7;}.pack{background:white;border:1.5px solid #E8DDD4;border-radius:12px;padding:1rem;margin-bottom:1rem;}.pt{font-weight:700;color:#3D1F0E;margin-bottom:.75rem;font-size:1rem;}.produit{padding:.5rem 0;border-bottom:1px solid #FAF7F2;}.nom{font-weight:600;font-size:.88rem;}.usage{font-size:.75rem;color:#C49A8A;font-weight:600;margin-top:.1rem;}.ben{font-size:.8rem;color:#555;margin-top:.1rem;}.tip{font-size:.75rem;color:#888;font-style:italic;}.routine{background:#FAF7F2;border-radius:8px;padding:.65rem;margin-top:.65rem;font-size:.78rem;line-height:1.6;}.conseil{background:#3D1F0E;color:white;border-radius:10px;padding:1rem;margin-top:1.5rem;font-size:.85rem;line-height:1.6;}.footer{text-align:center;margin-top:2rem;font-size:.72rem;color:#aaa;}</style></head><body>"
          +"<h1>Ton ordonnance personnalisee</h1>"
          +"<div class='sub'>Blazing Dynasty x Mihi France</div>"
          +(ordonnance.introduction?"<div class='intro'>"+ordonnance.introduction+"</div>":"")
          +(ordonnance.budget?"<div class='pack'><div class='pt'>Pack Essentiel — "+(ordonnance.budget.total||"")+"</div>"+fmt(ordonnance.budget)+"</div>":"")
          +(ordonnance.bestseller?"<div class='pack'><div class='pt'>Pack Best Seller — "+(ordonnance.bestseller.total||"")+"</div>"+fmt(ordonnance.bestseller)+"</div>":"")
          +(ordonnance.premium?"<div class='pack'><div class='pt'>Pack Premium — "+(ordonnance.premium.total||"")+"</div>"+fmt(ordonnance.premium)+"</div>":"")
          +(ordonnance.conseil?"<div class='conseil'>"+ordonnance.conseil+"</div>":"")
          +"<div class='footer'>Blazing Dynasty · Mihi France · "+new Date().toLocaleDateString("fr-FR")+"</div>"
          +"</body></html>";
          const w=window.open("","_blank");
          w.document.write(html);
          w.document.close();
          setTimeout(()=>w.print(),600);
        }}
          style={{width:"100%",background:C.rose,color:"white",border:"none",borderRadius:10,padding:".6rem",fontSize:".78rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginTop:".4rem"}}>
          🖨️ Sauvegarder mon ordonnance en PDF
        </button>

        <button onClick={async()=>{if(!ordonnance)return;try{const id='ord_'+Date.now();await setDoc(doc(db,'ordonnances_publiques',id),{ordonnance:ordonnance,nomClient:nomClient||'Cliente',date:todayLocalStr(),ts:Date.now()});const lien=window.location.origin+'?ordonnance='+id;await navigator.clipboard.writeText(lien);alert('Lien copie - partage-le par WhatsApp ou Messenger');}catch(e){alert('Erreur');}}} style={{width:'100%',background:'#7FAF8A',color:'white',border:'none',borderRadius:10,padding:'.6rem',fontSize:'.78rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:'.4rem'}}>Partager mon ordonnance</button>

        {/* DEBUG TEMPORAIRE */}
        <details style={{marginTop:".5rem"}}>
          <summary style={{fontSize:".6rem",color:C.gris,cursor:"pointer"}}>🔍 Debug (clic pour voir)</summary>
          <pre style={{fontSize:".55rem",color:"#333",background:"#f5f5f5",padding:".5rem",borderRadius:6,overflowX:"auto",whiteSpace:"pre-wrap",wordBreak:"break-all",marginTop:".3rem"}}>
            {JSON.stringify({budget:!!ordonnance?.budget, bestseller:!!ordonnance?.bestseller, premium:!!ordonnance?.premium, conseil:!!ordonnance?.conseil, keys:Object.keys(ordonnance||{}), premiumData:ordonnance?.premium||"ABSENT"},null,2)}
          </pre>
        </details>
        <p style={{ fontSize: ".65rem", color: C.gris, textAlign: "center" }}>Résultat sauvegardé dans ton tableau de bord 🖤</p>
      </div>
    );
  }
  return null;
}

// ── RESULTATS DIAGNOSTICS (Dashboard) ────────────────────────────────────────
function DiagResultsTab({ uid }) {
  const [diags, setDiags] = useState([]);
  const [loaded, setLoaded] = useState(false);
  const [sel, setSel] = useState(null);
  const [prospects, setProspects] = useState([]);
  const [clients, setClients] = useState([]);
  const [genLoading, setGenLoading] = useState(false);
  const [lienProspect, setLienProspect] = useState(null);
  const [showArchives, setShowArchives] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const snap = await getDoc(doc(db, "users", uid));
        if (snap.exists()) {
          if (snap.data()["db-diagnostics"]) setDiags(JSON.parse(snap.data()["db-diagnostics"]));
          if (snap.data()["db-prospects"]) setProspects(JSON.parse(snap.data()["db-prospects"]));
          if (snap.data()["db-clients"]) setClients(JSON.parse(snap.data()["db-clients"]));
        }
      } catch {}
      setLoaded(true);
    })();
  }, [uid]);

  const saveDiags = async (next) => {
    setDiags(next);
    try { await setDoc(doc(db, "users", uid), { "db-diagnostics": JSON.stringify(next) }, { merge: true }); } catch {}
  };

  const del = async (id) => saveDiags(diags.filter(d => d.id !== id));

  const marquerLu = async (id) => {
    const next = diags.map(d => d.id===id ? {...d, nonLu:false} : d);
    saveDiags(next);
  };

  // Générer l'ordonnance IA pour un diag externe depuis l'historique
  const genererDepuisHistorique = async (d) => {
    setGenLoading(d.id);
    // Nettoyer les réponses (retirer _contact si présent)
    const reponsesClean = {...(d.reponses||{})};
    delete reponsesClean._contact;

    const result = await genererOrdonnanceIA(d.type, reponsesClean, d.nomClient||(d.contact?.prenom)||"Cliente");
    if (result) {
      const next = diags.map(x => x.id===d.id ? {...x, ordonnance:result, nonLu:false} : x);
      saveDiags(next);
      setSel({...d, ordonnance:result});
    } else {
      alert("Erreur de génération. Vérifie ta connexion et réessaie.");
    }
    setGenLoading(null);
  };

  // Lier diag à prospect ou client
  const lierAProspect = async (diagId, prospectId) => {
    // Lier ET archiver (retirer de la liste principale)
    const next = diags.map(d => d.id===diagId ? {...d, prospectId, archive:true} : d);
    saveDiags(next);
    setLienProspect(null);
    setSel(null);
  };

  const archiver = async (id) => {
    const next = diags.map(d => d.id===id ? {...d, archive:true} : d);
    saveDiags(next);
    setSel(null);
  };

  const desarchiver = async (id) => {
    const next = diags.map(d => d.id===id ? {...d, archive:false} : d);
    saveDiags(next);
  };

  // Convertir prospect en client ou distributrice
  const convertirProspect = async (prospectId, vers) => {
    const p = prospects.find(x => x.id===prospectId);
    if (!p) return;
    if (vers === "client") {
      const newClient = {id:`c${Date.now()}`, nom:p.name, prenom:"", tel:"", email:"", produits:[], notes:p.note||"", dateAjout:todayLocalStr()};
      const nextClients = [...clients, newClient];
      setClients(nextClients);
      try { await setDoc(doc(db,"users",uid), {"db-clients":JSON.stringify(nextClients)}, {merge:true}); } catch {}
    }
    // Marquer comme converti dans prospects
    const nextP = prospects.map(x => x.id===prospectId ? {...x, statut:"✅ Converti", convertiVers:vers} : x);
    setProspects(nextP);
    try { await setDoc(doc(db,"users",uid), {"db-prospects":JSON.stringify(nextP)}, {merge:true}); } catch {}
  };

  const TYPE_LABELS = {
    skincare: "✨ Skincare",
    makeup: "💄 Makeup & Couleurs",
    peaucorps: "🧴 Peau Corps",
    cheveux: "💇 Cheveux",
    sante: "💊 Santé",
    silhouette: "⚖️ Silhouette",
    detox: "🌿 Détox & Énergie",
    antiage: "🌸 Anti-Âge",
    budget: "💡 Budget Beauté",
    recrutement: "🤝 Profil Recrutement",
    complementrevenu: "💰 Revenu Complémentaire",
    entrepreneuriat: "🚀 Profil Entrepreneur",
    valeurmarche: "💼 Valeur sur le Marché",
    chargementale: "🧠 Charge Mentale",
    libertefin: "🏖️ Liberté Financière",
    maman: "🌸 Maman Entrepreneur",
    reconversion: "🔄 Reconversion",
    confianceensoi: "💪 Confiance en Soi",
    reseauxsociaux2: "📲 Audit Digital",
    blocage: "🔓 Recrue bloquée",
    pasrecruiter: "😓 Blocage recrutement",
    pasvendre: "💸 Blocage ventes",
    reseaux: "📱 Réseaux sociaux",
  };
  const nonLus = diags.filter(d => d.nonLu).length;

  if (!loaded) return <div style={{ textAlign: "center", padding: "2rem", color: C.gris, fontSize: ".8rem" }}>Chargement...</div>;

  // Vue détail diag
  if (sel) {
    const packs = [
      { key: "budget", label: "💚 Pack Petit Budget", color: "#5C8A60" },
      { key: "bestseller", label: "⭐ Pack Best Seller", color: C.or },
      { key: "premium", label: "🚀 Pack Boost Premium", color: C.rose },
    ];
    const ord = sel.ordonnance;
    const isRecruDiag = sel.type === "recrutement" || sel.type === "blocage";
    const prospectLie = prospects.find(p => p.id === sel.prospectId);

    return (
      <div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:"1rem" }}>
          <button onClick={() => { setSel(null); marquerLu(sel.id); }} style={{ background:"none", border:"none", color:C.gris, fontSize:".75rem", cursor:"pointer", fontFamily:"inherit", padding:0 }}>← Retour</button>
          <button onClick={()=>{ sel.archive?desarchiver(sel.id):archiver(sel.id); setSel(null); }}
            style={{ background:"none", border:`1px solid ${C.pale}`, borderRadius:8, padding:".25rem .65rem", fontSize:".68rem", color:C.gris, cursor:"pointer", fontFamily:"inherit" }}>
            {sel.archive?"↩️ Restaurer":"📦 Archiver"}
          </button>
        </div>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"flex-start", marginBottom:".75rem" }}>
          <div>
            <div style={{ fontFamily:"Georgia,serif", fontSize:"1rem", color:C.brun, marginBottom:".15rem" }}>{sel.nomClient} — {TYPE_LABELS[sel.type]}</div>
            <div style={{ fontSize:".65rem", color:C.gris }}>{sel.date}{sel.externe&&<span style={{ marginLeft:".4rem", background:C.lilas+"20", color:C.lilas, borderRadius:20, padding:".1rem .4rem", fontWeight:700 }}>📩 Externe</span>}</div>
          </div>
          {sel.nonLu&&<span style={{ background:C.rose, color:"white", borderRadius:20, fontSize:".6rem", fontWeight:700, padding:".2rem .6rem" }}>Nouveau</span>}
        </div>

        {/* Coordonnées de contact */}
        {sel.contact&&(sel.contact.tel||sel.contact.mail||sel.contact.reseau)&&(
          <div style={{ background:C.vert+"10", border:`1px solid ${C.vert}30`, borderRadius:10, padding:".65rem .85rem", marginBottom:"1rem" }}>
            <div style={{ fontSize:".6rem", fontWeight:700, color:C.vert, marginBottom:".3rem" }}>📞 Coordonnées</div>
            <div style={{ fontSize:".78rem", color:C.brun, fontWeight:600 }}>{sel.contact.prenom} {sel.contact.nom}</div>
            {sel.contact.tel&&<div style={{ fontSize:".74rem", color:C.texte }}>📱 {sel.contact.tel}</div>}
            {sel.contact.mail&&<div style={{ fontSize:".74rem", color:C.texte }}>📧 {sel.contact.mail}</div>}
            {sel.contact.reseau&&<div style={{ fontSize:".74rem", color:C.texte }}>💬 {sel.contact.reseau}</div>}
          </div>
        )}

        {/* Lier à un prospect — avec création auto */}
        <div style={{ background:C.creme, borderRadius:10, padding:".65rem .85rem", marginBottom:"1rem" }}>
          <div style={{ fontSize:".6rem", fontWeight:700, color:C.gris, marginBottom:".35rem" }}>🔗 Fiche prospect</div>
          {prospectLie
            ? <div>
                <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", marginBottom:".4rem" }}>
                  <span style={{ fontSize:".78rem", fontWeight:600, color:C.brun }}>{prospectLie.name}</span>
                </div>
                <div style={{ display:"flex", gap:".3rem", flexWrap:"wrap" }}>
                  <button onClick={()=>convertirProspect(prospectLie.id,"client")}
                    style={{ flex:1, background:C.vert+"20", border:`1px solid ${C.vert}`, borderRadius:8, padding:".3rem .55rem", fontSize:".65rem", fontWeight:600, color:C.vert, cursor:"pointer", fontFamily:"inherit" }}>
                    🛍️ Assimiler en Cliente
                  </button>
                  <button onClick={()=>convertirProspect(prospectLie.id,"distributrice")}
                    style={{ flex:1, background:C.or+"20", border:`1px solid ${C.or}`, borderRadius:8, padding:".3rem .55rem", fontSize:".65rem", fontWeight:600, color:C.or, cursor:"pointer", fontFamily:"inherit" }}>
                    👑 Assimiler en Distributrice
                  </button>
                </div>
              </div>
            : <div>
                {/* Création automatique depuis le nom/contact du diag */}
                {(sel.nomClient||sel.contact?.prenom)&&(
                  <div style={{ marginBottom:".4rem" }}>
                    <button onClick={async()=>{
                      const nom=sel.nomClient||((sel.contact?.prenom||"")+" "+(sel.contact?.nom||"")).trim()||"Inconnue";
                      const newP={
                        id:Date.now(),
                        name:nom,
                        statut:"Nouveau",
                        interet:sel.type==="chargementale"||sel.type==="business"?"distributeur":"client",
                        note:`Diagnostic ${sel.type||""} effectué le ${new Date(sel.date||Date.now()).toLocaleDateString("fr-FR")}`,
                        tel:sel.contact?.tel||"",
                        email:sel.contact?.email||"",
                        source:"diagnostic",
                      };
                      const nextP=[...prospects,newP];
                      setProspects(nextP);
                      try{ await setDoc(doc(db,"users",uid),{"db-prospects":JSON.stringify(nextP)},{merge:true}); }catch{}
                      // Lier ce prospect au diag
                      const nextD=diags.map(d=>d.id===sel.id?{...d,prospectId:newP.id}:d);
                      saveDiags(nextD);
                      setSel(p=>({...p,prospectId:newP.id}));
                      alert(`✅ Fiche créée pour ${nom} dans Prospects !`);
                    }}
                      style={{ width:"100%", background:C.rose, color:"white", border:"none", borderRadius:8, padding:".4rem", fontSize:".72rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginBottom:".3rem" }}>
                      ✨ Créer la fiche prospect automatiquement
                    </button>
                  </div>
                )}
                {lienProspect===sel.id
                  ? <div>
                      <select onChange={e=>lierAProspect(sel.id,e.target.value)} defaultValue=""
                        style={{ width:"100%", border:`1px solid ${C.pale}`, borderRadius:8, padding:".4rem .6rem", fontSize:".78rem", fontFamily:"inherit", color:C.texte, background:C.blanc, outline:"none" }}>
                        <option value="" disabled>Choisir un prospect existant...</option>
                        {prospects.filter(p=>p.statut!=="✅ Converti").map(p=>(
                          <option key={p.id} value={p.id}>{p.name}</option>
                        ))}
                      </select>
                      <button onClick={()=>setLienProspect(null)} style={{ marginTop:".3rem", background:"none", border:"none", color:C.gris, fontSize:".65rem", cursor:"pointer", fontFamily:"inherit" }}>Annuler</button>
                    </div>
                  : <button onClick={()=>setLienProspect(sel.id)}
                      style={{ background:"none", border:`1px dashed ${C.pale}`, borderRadius:8, padding:".3rem .7rem", fontSize:".7rem", color:C.gris, cursor:"pointer", fontFamily:"inherit" }}>
                      + Lier à un prospect existant
                    </button>
                }
              </div>
          }
        </div>

        {/* Bouton envoyer l'ordonnance directement */}
        {ord&&(
          <div style={{ marginBottom:"1rem" }}>
            <button onClick={()=>{
              const intro=ord.introduction||"";
              const formatPack=(label,pack)=>{
                if(!pack)return"";
                const prods=(pack.produits||[]).map(p=>`• ${p.nom} — ${p.prix}${p.usage?` (${p.usage})`:""}${p.benefice?`\n  → ${p.benefice}`:""}`).join("\n");
                return `${label}\n${prods}\nTotal : ${pack.total||""}\n${pack.routine||""}`;
              };
              const texte=[
                `✨ Ton ordonnance personnalisée Mihi`,
                intro&&`\n${intro}`,
                `\n💚 PACK PETIT BUDGET\n${formatPack("",ord.budget)}`,
                `\n⭐ PACK BEST SELLER\n${formatPack("",ord.bestseller)}`,
                `\n🚀 PACK BOOST\n${formatPack("",ord.premium)}`,
                ord.conseil&&`\n💛 Conseil personnalisé : ${ord.conseil}`,
              ].filter(Boolean).join("\n");
              navigator.clipboard?.writeText(texte);
              alert("✅ Ordonnance copiée avec le détail complet !");
            }}
              style={{ width:"100%", background:`linear-gradient(135deg,${C.brun},${C.brun2})`, color:"white", border:"none", borderRadius:10, padding:".6rem", fontSize:".78rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit" }}>
              📋 Copier l'ordonnance complète
            </button>

            {/* Bouton PDF */}
            <button onClick={()=>{
              const ord = sel?.ordonnance;
              if(!ord) return;
              const fmt=(pk)=>{if(!pk)return"";return(pk.produits||[]).map(pr=>"<div class='produit'><div class='nom'>"+pr.nom+" — "+pr.prix+"</div><div class='usage'>"+pr.usage+"</div><div class='ben'>"+(pr.benefice||"")+"</div>"+(pr.comment?"<div class='tip'>💡 "+pr.comment+"</div>":"")+"</div>").join("")+(pk.routine?"<div class='routine'>📋 "+pk.routine+"</div>":"");};
              const html="<!DOCTYPE html><html><head><meta charset='utf-8'><style>body{font-family:'Trebuchet MS',sans-serif;max-width:600px;margin:0 auto;padding:2rem;color:#3D2B1F;background:#FAF7F2;}h1{font-family:Georgia,serif;color:#3D1F0E;font-weight:300;font-size:1.5rem;}.intro{background:#F5EFE8;border-radius:10px;padding:1rem;margin-bottom:1.5rem;font-size:.9rem;line-height:1.7;}.pack{background:white;border:1.5px solid #E8DDD4;border-radius:12px;padding:1rem;margin-bottom:1rem;}.pack-titre{font-weight:700;color:#3D1F0E;margin-bottom:.75rem;font-size:1rem;}.produit{padding:.5rem 0;border-bottom:1px solid #FAF7F2;}.nom{font-weight:600;font-size:.88rem;}.usage{font-size:.75rem;color:#C49A8A;font-weight:600;margin-top:.15rem;}.ben{font-size:.8rem;color:#555;margin-top:.15rem;}.tip{font-size:.75rem;color:#888;font-style:italic;margin-top:.1rem;}.routine{background:#FAF7F2;border-radius:8px;padding:.65rem;margin-top:.65rem;font-size:.78rem;line-height:1.6;}.conseil{background:#3D1F0E;color:white;border-radius:10px;padding:1rem;margin-top:1.5rem;font-size:.85rem;line-height:1.6;}.footer{text-align:center;margin-top:2rem;font-size:.72rem;color:#aaa;}</style></head><body>"
              +"<h1>Ordonnance personnalisee</h1>"
              +"<div style='color:#C49A8A;font-size:.85rem;margin-bottom:1.5rem;'>Blazing Dynasty x Mihi France</div>"
              +(ord.introduction?"<div class='intro'>"+ord.introduction+"</div>":"")
              +(ord.budget?"<div class='pack'><div class='pack-titre'>Pack Essentiel — "+(ord.budget.total||"")+"</div>"+fmt(ord.budget)+"</div>":"")
              +(ord.bestseller?"<div class='pack'><div class='pack-titre'>Pack Best Seller — "+(ord.bestseller.total||"")+"</div>"+fmt(ord.bestseller)+"</div>":"")
              +(ord.premium?"<div class='pack'><div class='pack-titre'>Pack Premium — "+(ord.premium.total||"")+"</div>"+fmt(ord.premium)+"</div>":"")
              +(ord.conseil?"<div class='conseil'>"+ord.conseil+"</div>":"")
              +"<div class='footer'>Blazing Dynasty · Mihi France · "+new Date().toLocaleDateString("fr-FR")+"</div>"
              +"</body></html>";
              const w=window.open("","_blank");
              w.document.write(html);
              w.document.close();
              setTimeout(()=>w.print(),600);
            }}
              style={{ width:"100%", background:C.rose, color:"white", border:"none", borderRadius:10, padding:".6rem", fontSize:".78rem", fontWeight:600, cursor:"pointer", fontFamily:"inherit", marginTop:".4rem" }}>
              🖨️ Générer PDF / Imprimer
            </button>

            <button onClick={async()=>{const ord=sel?.ordonnance;if(!ord)return;try{const id='ord_'+Date.now();await setDoc(doc(db,'ordonnances_publiques',id),{ordonnance:ord,nomClient:sel?.nomClient||sel?.contact?.prenom||'Cliente',date:todayLocalStr(),ts:Date.now()});const lien=window.location.origin+'?ordonnance='+id;const msg='Voici le lien pour ta cliente :\n\n'+lien+'\n\nCopie ce lien et envoie-le lui !';if(navigator.share){await navigator.share({title:'Ordonnance Mihi',text:'Ton ordonnance personnalisée Mihi',url:lien});}else{prompt('Copie ce lien et envoie-le à ta cliente :',lien);}}catch(e){alert('Erreur : '+e.message);}}} style={{width:'100%',background:'#7FAF8A',color:'white',border:'none',borderRadius:10,padding:'.6rem',fontSize:'.78rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit',marginTop:'.4rem'}}>Envoyer le lien a la cliente</button>
          </div>
        )}

        {/* Diag externe sans ordonnance → bouton générer */}
        {sel.externe && !ord && (
          <div style={{ background:C.lilas+"10", border:`1px solid ${C.lilas}`, borderRadius:12, padding:"1rem", marginBottom:"1rem", textAlign:"center" }}>
            <div style={{ fontSize:".76rem", color:C.brun, marginBottom:".5rem", fontWeight:600 }}>📩 Diagnostic reçu d'une cliente</div>
            <p style={{ fontSize:".72rem", color:C.gris, marginBottom:".75rem", lineHeight:1.6 }}>Les réponses sont disponibles. Génère l'ordonnance IA maintenant.</p>
            <button onClick={()=>genererDepuisHistorique(sel)} disabled={genLoading===sel.id}
              style={{ background:C.brun, color:C.blanc, border:"none", borderRadius:10, padding:".6rem 1.2rem", fontSize:".8rem", fontWeight:600, fontFamily:"inherit", cursor:"pointer" }}>
              {genLoading===sel.id?"✨ Génération...":"✨ Générer l'ordonnance IA"}
            </button>
          </div>
        )}

        {/* Ordonnance normale (skincare/cheveux/santé) */}
        {!isRecruDiag && ord && (
          <>
            {ord.introduction && (
              <div style={{ background:C.brun, borderRadius:12, padding:".85rem 1rem", marginBottom:"1rem" }}>
                <p style={{ fontSize:".76rem", color:C.pale, lineHeight:1.6, margin:0 }}>{ord.introduction}</p>
              </div>
            )}
            {packs.map(pack => {
              const p = ord?.[pack.key];
              if (!p) return null;
              return (
                <div key={pack.key} style={{ background:C.blanc, border:`1px solid ${pack.color}30`, borderRadius:12, padding:".85rem 1rem", marginBottom:".6rem" }}>
                  <div style={{ display:"flex", justifyContent:"space-between", marginBottom:".5rem" }}>
                    <div style={{ fontSize:".76rem", fontWeight:700, color:pack.color }}>{pack.label}</div>
                    <div style={{ fontSize:".76rem", fontWeight:700, color:C.brun }}>{p.total}</div>
                  </div>
                  {p.produits?.map((pr,i) => (
                    <div key={i} style={{ paddingBottom:".4rem", marginBottom:".4rem", borderBottom:`1px solid ${C.pale}` }}>
                      <div style={{ fontSize:".76rem", fontWeight:600, color:C.brun }}>{pr.nom} <span style={{ color:C.rose, fontWeight:700 }}>{pr.prix}</span></div>
                      <div style={{ fontSize:".68rem", color:C.gris, marginBottom:".1rem" }}>{pr.usage} · {pr.benefice}</div>
                      {pr.comment&&<div style={{ fontSize:".65rem", color:C.brun, background:C.creme, borderRadius:6, padding:".2rem .45rem", fontStyle:"italic" }}>💡 {pr.comment}</div>}
                    </div>
                  ))}
                  {p.routine && <div style={{ fontSize:".7rem", color:C.brun, fontStyle:"italic", marginTop:".3rem" }}>Routine : {p.routine}</div>}
                </div>
              );
            })}
          </>
        )}

        {/* Diag recrutement/blocage */}
        {isRecruDiag && ord && (
          <div style={{ background:C.creme, borderRadius:12, padding:"1rem" }}>
            <div style={{ fontSize:".76rem", color:C.brun, lineHeight:1.6 }}>Score : {ord.score}/{ord.max}</div>
          </div>
        )}

        {/* Réponses brutes */}
        {sel.reponses && Object.keys(sel.reponses).length > 0 && (
          <div style={{ marginTop:"1rem" }}>
            <div style={{ fontSize:".6rem", fontWeight:700, letterSpacing:".1em", textTransform:"uppercase", color:C.gris, marginBottom:".4rem" }}>📋 Réponses</div>
            {Object.entries(sel.reponses).map(([k,v])=>(
              <div key={k} style={{ fontSize:".7rem", color:C.texte, padding:".25rem 0", borderBottom:`1px solid ${C.pale}` }}>
                <span style={{ color:C.gris }}>{k} : </span><strong>{v}</strong>
              </div>
            ))}
          </div>
        )}
      </div>
    );
  }

  // Liste principale
  const actifs = diags.filter(d => !d.archive).sort((a,b)=>(b.ts||0)-(a.ts||0));
  const archives = diags.filter(d => d.archive).sort((a,b)=>(b.ts||0)-(a.ts||0));

  return (
    <div>
      <div style={{ fontFamily:"Georgia,serif", fontSize:"1.35rem", fontWeight:300, color:C.brun, marginBottom:".2rem" }}>
        Diagnostics <em style={{ fontStyle:"italic", color:C.rose }}>clients</em>
        {nonLus>0&&<span style={{ marginLeft:".5rem", background:C.rose, color:"white", borderRadius:20, fontSize:".65rem", fontWeight:700, padding:".15rem .55rem", verticalAlign:"middle" }}>{nonLus} nouveau{nonLus>1?"x":""}</span>}
      </div>

      {/* Onglets actifs / archives */}
      <div style={{ display:"flex", gap:".4rem", marginBottom:"1rem", marginTop:".5rem" }}>
        <button onClick={()=>setShowArchives(false)}
          style={{ flex:1, padding:".45rem", fontSize:".72rem", fontWeight:600, border:"none", borderBottom:`2px solid ${!showArchives?C.rose:"transparent"}`, background:"none", color:!showArchives?C.brun:C.gris, cursor:"pointer", fontFamily:"inherit" }}>
          🩺 Actifs ({actifs.length})
        </button>
        <button onClick={()=>setShowArchives(true)}
          style={{ flex:1, padding:".45rem", fontSize:".72rem", fontWeight:600, border:"none", borderBottom:`2px solid ${showArchives?C.rose:"transparent"}`, background:"none", color:showArchives?C.brun:C.gris, cursor:"pointer", fontFamily:"inherit" }}>
          📦 Archives ({archives.length})
        </button>
      </div>

      {!showArchives&&(
        <>
          {actifs.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:C.gris, fontSize:".76rem" }}>
              <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>🩺</div>
              Aucun diagnostic actif.
            </div>
          )}
          {actifs.map(d=>(
            <div key={d.id} style={{ background:d.nonLu?C.rose+"08":C.blanc, border:`1.5px solid ${d.nonLu?C.rose:C.pale}`, borderRadius:12, padding:".8rem 1rem", marginBottom:".5rem", display:"flex", justifyContent:"space-between", alignItems:"center" }}>
              <div onClick={()=>setSel(d)} style={{ cursor:"pointer", flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:".4rem", flexWrap:"wrap" }}>
                  <div style={{ fontSize:".82rem", fontWeight:600, color:C.brun }}>{d.nomClient}</div>
                  {d.externe&&<span style={{ background:C.lilas+"20", color:C.lilas, fontSize:".58rem", fontWeight:700, borderRadius:20, padding:".1rem .4rem" }}>📩 Externe</span>}
                  {d.nonLu&&<span style={{ background:C.rose, color:"white", fontSize:".58rem", fontWeight:700, borderRadius:20, padding:".1rem .4rem" }}>Nouveau</span>}
                  {!d.ordonnance&&d.externe&&<span style={{ background:C.or+"20", color:C.or, fontSize:".58rem", fontWeight:700, borderRadius:20, padding:".1rem .4rem" }}>⏳ À traiter</span>}
                  {d.prospectId&&<span style={{ background:C.vert+"20", color:C.vert, fontSize:".58rem", fontWeight:700, borderRadius:20, padding:".1rem .4rem" }}>🔗 Lié</span>}
                </div>
                <div style={{ display:"flex", gap:".4rem", marginTop:".2rem" }}>
                  <span style={{ background:C.rose+"20", color:C.rose, fontSize:".6rem", fontWeight:700, padding:".1rem .4rem", borderRadius:20 }}>{TYPE_LABELS[d.type]}</span>
                  <span style={{ fontSize:".62rem", color:C.gris }}>{d.date}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:".3rem" }}>
                <button onClick={()=>archiver(d.id)} title="Archiver"
                  style={{ background:"none", border:`1px solid ${C.pale}`, borderRadius:6, padding:".2rem .4rem", color:C.gris, cursor:"pointer", fontSize:".65rem", fontFamily:"inherit" }}>📦</button>
                <button onClick={()=>del(d.id)}
                  style={{ background:"none", border:"none", color:C.pale, cursor:"pointer", fontSize:".75rem", padding:".2rem", fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}

      {showArchives&&(
        <>
          {archives.length===0&&(
            <div style={{ textAlign:"center", padding:"2rem", color:C.gris, fontSize:".76rem" }}>
              <div style={{ fontSize:"2rem", marginBottom:".5rem" }}>📦</div>
              Aucune archive.
            </div>
          )}
          {archives.map(d=>(
            <div key={d.id} style={{ background:C.creme, border:`1px solid ${C.pale}`, borderRadius:12, padding:".8rem 1rem", marginBottom:".5rem", display:"flex", justifyContent:"space-between", alignItems:"center", opacity:.8 }}>
              <div onClick={()=>setSel(d)} style={{ cursor:"pointer", flex:1 }}>
                <div style={{ display:"flex", alignItems:"center", gap:".4rem", flexWrap:"wrap" }}>
                  <div style={{ fontSize:".82rem", fontWeight:600, color:C.brun }}>{d.nomClient}</div>
                  {d.prospectId&&<span style={{ background:C.vert+"20", color:C.vert, fontSize:".58rem", fontWeight:700, borderRadius:20, padding:".1rem .4rem" }}>🔗 Lié</span>}
                </div>
                <div style={{ display:"flex", gap:".4rem", marginTop:".2rem" }}>
                  <span style={{ background:C.rose+"20", color:C.rose, fontSize:".6rem", fontWeight:700, padding:".1rem .4rem", borderRadius:20 }}>{TYPE_LABELS[d.type]}</span>
                  <span style={{ fontSize:".62rem", color:C.gris }}>{d.date}</span>
                </div>
              </div>
              <div style={{ display:"flex", gap:".3rem" }}>
                <button onClick={()=>desarchiver(d.id)} title="Restaurer"
                  style={{ background:"none", border:`1px solid ${C.pale}`, borderRadius:6, padding:".2rem .4rem", color:C.gris, cursor:"pointer", fontSize:".65rem", fontFamily:"inherit" }}>↩️</button>
                <button onClick={()=>del(d.id)}
                  style={{ background:"none", border:"none", color:C.pale, cursor:"pointer", fontSize:".75rem", padding:".2rem", fontFamily:"inherit" }}>✕</button>
              </div>
            </div>
          ))}
        </>
      )}
    </div>
  );
}


// ── DIAG ADMIN EDITOR ────────────────────────────────────────────────────────
function DiagAdminEditor(){
  const[notes,setNotes]=useState({skincare:"",cheveux:"",sante:""});
  const[saving,setSaving]=useState(false);
  const[saved,setSaved]=useState(false);
  const[loaded,setLoaded]=useState(false);

  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"admin","diag_notes"));
        if(snap.exists()) setNotes(snap.data());
      }catch{}
      setLoaded(true);
    })();
  },[]);

  const save=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"admin","diag_notes"),notes);
      setSaved(true);
      setTimeout(()=>setSaved(false),2500);
    }catch{}
    setSaving(false);
  };

  const DIAGS=[
    {id:"skincare",icon:"✨",label:"Skincare"},
    {id:"cheveux",icon:"💇",label:"Cheveux"},
    {id:"sante",icon:"💊",label:"Santé"},
  ];

  if(!loaded) return <div style={{fontSize:".74rem",color:C.gris}}>Chargement...</div>;

  return(
    <div>
      {DIAGS.map(d=>(
        <div key={d.id} style={{marginBottom:".85rem"}}>
          <div style={{fontSize:".65rem",fontWeight:700,color:C.brun,marginBottom:".3rem"}}>{d.icon} {d.label} — Instructions pour l'IA</div>
          <textarea
            placeholder={`Ex: Pour le diagnostic ${d.label}, toujours inclure le produit X dans le pack boost. Éviter les produits contenant du parfum pour les peaux sensibles...`}
            value={notes[d.id]||""}
            onChange={e=>setNotes(p=>({...p,[d.id]:e.target.value}))}
            style={{width:"100%",minHeight:80,border:`1px solid ${C.pale}`,borderRadius:9,padding:".6rem .8rem",fontFamily:"inherit",fontSize:".76rem",color:C.texte,background:C.creme,resize:"vertical",outline:"none",lineHeight:1.6}}/>
        </div>
      ))}
      <button onClick={save} disabled={saving}
        style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:9,padding:".55rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
        {saving?"Sauvegarde...":saved?"✅ Sauvegardé !":"Sauvegarder les instructions"}
      </button>
      <p style={{fontSize:".65rem",color:C.gris,textAlign:"center",marginTop:".4rem"}}>
        Ces instructions seront intégrées dans chaque génération d'ordonnance IA.
      </p>
    </div>
  );
}

function LinkBioPublicPage({slug}){
  const [profil,setProfil]=useState(null);
  const [loading,setLoading]=useState(true);
  const [diagActif,setDiagActif]=useState(null);
  useEffect(()=>{
    (async()=>{
      try{
        const s=await getDoc(doc(db,"linkbio",slug));
        if(s.exists()){setProfil(s.data());try{const sRef=doc(db,"linkbio_stats",slug);const sSnap=await getDoc(sRef);const prev=sSnap.exists()?sSnap.data():{};await setDoc(sRef,{...prev,visites:(prev.visites||0)+1,derniereVisite:new Date().toISOString()},{merge:true});}catch(e){console.error("tracking:",e);}}
        else{
          const q=query(collection(db,"linkbio"),where("slug","==",slug));
          const qs=await getDocs(q);
          if(!qs.empty){console.log("TRACKING via query:",slug);setProfil(qs.docs[0].data());}
          else setProfil("404");
        }
      }catch(e){setProfil("404");}
      setLoading(false);
    })();
  },[slug]);

  if(loading) return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAF7F2"}}>
      <div style={{textAlign:"center"}}>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.5rem",color:"#3D1F0E"}}>Blazing <em style={{color:"#C49A8A"}}>Dynasty</em></div>
        <div style={{fontSize:".75rem",color:"#888",marginTop:".5rem"}}>Chargement...</div>
      </div>
    </div>
  );

  if(!profil||profil==="404") return(
    <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAF7F2"}}>
      <div style={{textAlign:"center",padding:"2rem"}}>
        <div style={{fontSize:"2.5rem",marginBottom:"1rem"}}>🔍</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:"#3D1F0E",marginBottom:".5rem"}}>Page introuvable</div>
        <div style={{fontSize:".78rem",color:"#888"}}>Ce lien ne correspond à aucune distributrice active.</div>
      </div>
    </div>
  );

  const THEMES_PUB=[
    {id:"rose_dore",bg:"#FAF7F2",header:"#3D1F0E",accent:"#C49A8A",btnP:"#C49A8A",btnT:"#A89BB5",light:true},
    {id:"lilas",bg:"#F5F0FA",header:"#A89BB5",accent:"#A89BB5",btnP:"#A89BB5",btnT:"#C49A8A",light:true},
    {id:"nature",bg:"#F0F7F2",header:"#7FAF8A",accent:"#7FAF8A",btnP:"#7FAF8A",btnT:"#C49A8A",light:true},
    {id:"nuit",bg:"#1A1A2E",header:"#16213E",accent:"#C49A8A",btnP:"#C49A8A",btnT:"#A89BB5",light:false},
    {id:"soleil",bg:"#FFF8E7",header:"#C4A882",accent:"#C4A882",btnP:"#C4A882",btnT:"#C49A8A",light:true},
    {id:"or_noir",bg:"#0D0D0D",header:"#1A1A1A",accent:"#C4A882",btnP:"#C4A882",btnT:"#888",light:false},
  ];
  const theme=THEMES_PUB.find(t=>t.id===profil.theme)||THEMES_PUB[0];
  const sub=theme.light?"#888":"rgba(255,255,255,.65)";

  return(
    <div style={{minHeight:"100vh",background:theme.bg,fontFamily:"'Trebuchet MS',sans-serif"}}>
      <div style={{maxWidth:480,margin:"0 auto",minHeight:"100vh",background:theme.bg}}>
        <div style={{background:theme.header,padding:"2rem 1rem 1.5rem",textAlign:"center"}}>
          {profil.photo
            ?<img src={profil.photo} alt="" style={{width:90,height:90,borderRadius:"50%",objectFit:"cover",border:"3px solid rgba(255,255,255,.3)",marginBottom:".75rem",display:"block",margin:"0 auto .75rem"}}/>
            :<div style={{width:90,height:90,borderRadius:"50%",background:"rgba(255,255,255,.2)",margin:"0 auto .75rem",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"2.4rem",color:"#fff",fontFamily:"Georgia,serif"}}>
              {(profil.prenom||"B")[0].toUpperCase()}
            </div>
          }
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.15rem",fontWeight:600,color:"#fff"}}>{profil.prenom} {profil.nom||""}</div>
          {profil.slogan&&<div style={{fontSize:".72rem",color:"rgba(255,255,255,.8)",marginTop:".3rem",lineHeight:1.5,padding:"0 1rem"}}>{profil.slogan}</div>}
        </div>
        {profil.histoire&&<div style={{padding:".85rem 1.1rem",fontSize:".78rem",lineHeight:1.7,color:sub,background:theme.bg}}>{profil.histoire}</div>}
        {(profil.temoignages||[]).filter(t=>t.texte).length>0&&(
          <div style={{padding:".75rem 1rem",background:theme.bg}}>
            {profil.temoignages.filter(t=>t.texte).map((t,i)=>(
              <div key={i} style={{background:theme.accent+"15",borderRadius:10,padding:".65rem .85rem",marginBottom:".4rem",borderLeft:`3px solid ${theme.accent}`}}>
                <div style={{fontSize:".75rem",fontStyle:"italic",color:sub,lineHeight:1.6,marginBottom:".2rem"}}>"{t.texte}"</div>
                {t.auteur&&<div style={{fontSize:".62rem",fontWeight:600,color:theme.accent}}>— {t.auteur}</div>}
              </div>
            ))}
          </div>
        )}
        {/* Section diagnostics */}
        {diagActif ? (
          <div style={{padding:"1rem",background:theme.bg}}>
            <button onClick={()=>setDiagActif(null)}
              style={{background:"none",border:"none",color:theme.accent,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem",display:"flex",alignItems:"center",gap:".3rem"}}>
              ← Retour
            </button>
            <DiagnosticsTab uid={profil.uid||slug} userName={profil.prenom||""} externalMode={true} initialType={diagActif} initialClient=""/>
          </div>
        ) : (
          <div style={{padding:"1rem",background:theme.bg}}>
            <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:theme.accent,textAlign:"center",marginBottom:".75rem"}}>✦ Mes diagnostics gratuits</div>
            <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".5rem",marginBottom:"1rem"}}>
              {[
                {id:"parfum",icon:"🌸",label:"Diagnostic Parfum",sub:"Ton parfum idéal parmi 26 fragrances"},
                {id:"skincare",icon:"✨",label:"Diagnostic Skincare",sub:"Ta routine beauté personnalisée"},
                {id:"silhouette",icon:"⚖️",label:"Diagnostic Silhouette",sub:"Ton programme minceur sur mesure"},
                {id:"sante",icon:"💚",label:"Diagnostic Bien-être",sub:"Tes compléments adaptés"},
                {id:"cheveux",icon:"💇",label:"Diagnostic Cheveux",sub:"Ta routine capillaire sur mesure"},
                {id:"makeup",icon:"💄",label:"Diagnostic Makeup",sub:"Tes couleurs et produits makeup"},
                {id:"recrutement",icon:"👑",label:"Diagnostic Opportunité",sub:"L'activité Mihi faite pour toi ?"},
              {id:"blocage",icon:"👩‍👧",label:"Diagnostic Maman Entrepreneur",sub:"L'activité Mihi est-elle faite pour toi ?"},
              ].filter(d=>(profil.diagChoisis||["parfum","skincare","silhouette","sante"]).includes(d.id)).map(d=>(
                <button key={d.id} onClick={()=>setDiagActif(d.id)}
                  style={{background:"white",border:"1.5px solid "+theme.accent+"40",borderRadius:12,padding:".75rem .65rem",textAlign:"center",cursor:"pointer",fontFamily:"inherit"}}>
                  <div style={{fontSize:"1.4rem",marginBottom:".3rem"}}>{d.icon}</div>
                  <div style={{fontSize:".72rem",fontWeight:700,color:theme.header,lineHeight:1.3,marginBottom:".2rem"}}>{d.label}</div>
                  <div style={{fontSize:".62rem",color:"#888",lineHeight:1.4}}>{d.sub}</div>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Boutons principaux */}
        <div style={{padding:"0 1rem .75rem",display:"flex",flexDirection:"column",gap:".6rem"}}>
          <button onClick={()=>{window.location.href=window.location.origin+"?bio="+(profil?.slug||slug)+"&tunnel=produits_page";}} style={{width:"100%",background:theme.btnPrimary||"#C49A8A",color:"white",border:"none",borderRadius:12,padding:".8rem",textAlign:"center",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>🛍️ Découvrir les produits Mihi</button>
          <button onClick={()=>{window.location.href=window.location.origin+"?bio="+(profil?.slug||slug)+"&tunnel=recrutement_page";}} style={{width:"100%",background:"transparent",color:theme.accent||"#A89BB5",border:`1.5px solid ${theme.accent||"#A89BB5"}`,borderRadius:12,padding:".75rem",textAlign:"center",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>👑 Rejoindre l'équipe</button>
        </div>


        <div style={{padding:"1rem 1rem 2rem",background:theme.bg,display:"flex",flexDirection:"column",gap:".5rem"}}>
          {profil.lienBoutique&&(
            <a href={profil.lienBoutique} target="_blank" rel="noopener noreferrer"
              style={{display:"block",background:theme.btnP,color:"#fff",borderRadius:12,padding:".75rem 1rem",textAlign:"center",textDecoration:"none",fontSize:".85rem",fontWeight:700}}>
              🛍️ Découvrir les produits
            </a>
          )}
          {(profil.liensDiag||[]).filter(d=>d.url).map((d,i)=>(
            <a key={i} href={d.url} target="_blank" rel="noopener noreferrer"
              style={{display:"block",background:"transparent",color:theme.accent,border:`1.5px solid ${theme.accent}`,borderRadius:12,padding:".7rem 1rem",textAlign:"center",textDecoration:"none",fontSize:".82rem",fontWeight:600}}>
              {d.label||"✨ Faire mon diagnostic"}
            </a>
          ))}
          {!(profil.liensDiag||[]).filter(d=>d.url).length&&profil.lienDiag&&(
            <a href={profil.lienDiag} target="_blank" rel="noopener noreferrer"
              style={{display:"block",background:"transparent",color:theme.accent,border:`1.5px solid ${theme.accent}`,borderRadius:12,padding:".7rem 1rem",textAlign:"center",textDecoration:"none",fontSize:".82rem",fontWeight:600}}>
              ✨ Faire mon diagnostic
            </a>
          )}
          <button onClick={()=>{window.location.href=window.location.origin+"?bio="+(profil?.slug||slug)+"&tunnel=recrutement_page";}}
            style={{display:"block",width:"100%",background:"transparent",color:theme.accent,border:`1.5px solid ${theme.accent}`,borderRadius:12,padding:".75rem",textAlign:"center",fontSize:".85rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",border:"none"}}>
            👑 Rejoindre l'équipe
          </button>
        </div>
        <div style={{padding:"1rem",textAlign:"center",fontSize:".6rem",color:theme.accent,opacity:.6}}>Blazing Dynasty × Mihi France</div>
      </div>
    </div>
  );
}


function OrdonnancePubliquePage({ordId}){
  const [data,setData]=useState(null);
  const [loading,setLoading]=useState(true);
  const [notFound,setNotFound]=useState(false);
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,'ordonnances_publiques',ordId));
        if(snap.exists()) setData(snap.data());
        else setNotFound(true);
      }catch{setNotFound(true);}
      setLoading(false);
    })();
  },[ordId]);
  if(loading) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FAF7F2'}}><div style={{textAlign:'center'}}><div style={{fontFamily:'Georgia,serif',fontSize:'1.5rem',color:'#3D1F0E'}}>Chargement...</div></div></div>;
  if(notFound||!data) return <div style={{minHeight:'100vh',display:'flex',alignItems:'center',justifyContent:'center',background:'#FAF7F2'}}><div style={{textAlign:'center',padding:'2rem'}}><div style={{fontSize:'2rem'}}>404</div><div>Ordonnance introuvable</div></div></div>;
  const ord=data.ordonnance;
  const packs=[{key:'budget',label:'Pack Essentiel',color:'#5C8A60'},{key:'bestseller',label:'Pack Best Seller',color:'#C4A882'},{key:'premium',label:'Pack Premium',color:'#C49A8A'}];
  return(
    <div style={{minHeight:'100vh',background:'#FAF7F2',fontFamily:'Trebuchet MS,sans-serif'}}>
      <div style={{maxWidth:480,margin:'0 auto',padding:'1rem 1rem 3rem'}}>
        <div style={{background:'#3D1F0E',borderRadius:14,padding:'1.25rem',marginBottom:'1.25rem',textAlign:'center'}}>
          <div style={{fontSize:'.55rem',fontWeight:700,letterSpacing:'.15em',color:'#C4A882',marginBottom:'.3rem'}}>ORDONNANCE PERSONNALISEE</div>
          <div style={{fontFamily:'Georgia,serif',fontSize:'1.1rem',color:'white',fontWeight:300}}>Pour {data.nomClient||'toi'}</div>
          {data.distribName&&<div style={{fontSize:'.7rem',color:'#C49A8A',marginTop:'.2rem'}}>Conseillere : {data.distribName}</div>}
        </div>
        {ord?.introduction&&<div style={{background:'white',borderRadius:12,padding:'.85rem 1rem',marginBottom:'1rem',border:'1px solid #E8DDD4',fontSize:'.82rem',color:'#3D2B1F',lineHeight:1.7,fontStyle:'italic'}}>{ord.introduction}</div>}
        {packs.map(pack=>{
          const p=ord?.[pack.key];
          if(!p||(p.produits||[]).length===0) return null;
          return(
            <div key={pack.key} style={{background:'white',border:'1.5px solid #E8DDD4',borderRadius:14,padding:'1rem',marginBottom:'.75rem'}}>
              <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.65rem'}}>
                <div style={{fontSize:'.82rem',fontWeight:700,color:pack.color}}>{pack.label}</div>
                <div style={{fontSize:'.82rem',fontWeight:700,color:'#3D1F0E'}}>{p.total}</div>
              </div>
              {(p.produits||[]).map((pr,i)=>(
                <div key={i} style={{paddingBottom:'.5rem',marginBottom:'.5rem',borderBottom:i<p.produits.length-1?'1px solid #FAF7F2':'none'}}>
                  <div style={{display:'flex',justifyContent:'space-between',marginBottom:'.1rem'}}>
                    <div style={{fontSize:'.8rem',fontWeight:700,color:'#3D1F0E'}}>{pr.nom}</div>
                    <div style={{fontSize:'.75rem',fontWeight:600,color:pack.color}}>{pr.prix}</div>
                  </div>
                  {pr.usage&&<div style={{fontSize:'.7rem',color:pack.color,fontWeight:600}}>{pr.usage}</div>}
                  {pr.benefice&&<div style={{fontSize:'.74rem',color:'#555'}}>{pr.benefice}</div>}
                  {pr.comment&&<div style={{fontSize:'.68rem',color:'#888',fontStyle:'italic'}}>💡 {pr.comment}</div>}
                </div>
              ))}
              {p.routine&&<div style={{background:'#FAF7F2',borderRadius:8,padding:'.6rem',marginTop:'.5rem',fontSize:'.72rem',color:'#3D2B1F',lineHeight:1.6}}>{p.routine}</div>}
            </div>
          );
        })}
        {ord?.conseil&&<div style={{background:'#3D1F0E',borderRadius:12,padding:'1rem',marginBottom:'1rem'}}><div style={{fontSize:'.6rem',fontWeight:700,color:'#C4A882',marginBottom:'.4rem'}}>CONSEIL PERSONNALISE</div><div style={{fontSize:'.8rem',color:'white',lineHeight:1.7}}>{ord.conseil}</div></div>}
        <button onClick={()=>window.print()} style={{width:'100%',background:'#C49A8A',color:'white',border:'none',borderRadius:10,padding:'.7rem',fontSize:'.82rem',fontWeight:600,cursor:'pointer',fontFamily:'inherit'}}>Imprimer / Sauvegarder en PDF</button>
        <div style={{textAlign:'center',fontSize:'.62rem',color:'#888',marginTop:'1rem'}}>Blazing Dynasty x Mihi France</div>
      </div>
    </div>
  );
}

export function EntonnoirTab(p){
  const pr=p.prospects||[],cl=p.clients||[],di=p.distributeurs||[];
  const tP=pr.length,tC=cl.length,tD=di.length;
  const ca=cl.reduce((s,x)=>s+(x.commandes||[]).reduce((a,b)=>a+(parseFloat(b.montant)||0),0),0);
  const mx=Math.max(tP,tC,tD,1);
  const r1=tP>0?Math.round(tC/tP*100):0;
  const r2=tC>0?Math.round(tD/tC*100):0;
  return(
    <div style={{paddingBottom:"2rem"}}>
      <div style={{fontFamily:"Georgia,serif",fontSize:"1.3rem",color:"#3D1F0E",marginBottom:"1rem"}}>Entonnoir activite</div>
      {[{l:"Prospects",v:tP,c:"#C49A8A"},{l:"Clientes",v:tC,c:"#7FAF8A"},{l:"Distributrices",v:tD,c:"#C4A882"}].map((e,i)=>(
        <div key={i} style={{marginBottom:".6rem"}}>
          <div style={{display:"flex",justifyContent:"space-between",marginBottom:".2rem"}}>
            <span style={{fontSize:".78rem",color:"#3D2B1F",fontWeight:600}}>{e.l}</span>
            <span style={{fontSize:".85rem",fontWeight:700,color:e.c}}>{e.v}</span>
          </div>
          <div style={{height:10,background:"#E8DDD4",borderRadius:5,overflow:"hidden"}}>
            <div style={{height:"100%",background:e.c,borderRadius:5,width:Math.max(3,Math.round(e.v/mx*100))+"%"}}/>
          </div>
        </div>
      ))}
      <div style={{background:"#FAF7F2",borderRadius:12,padding:"1rem",marginTop:".75rem",border:"1px solid #E8DDD4",display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".4rem"}}>
        {[[r1+"%","P vers C","#C49A8A"],[r2+"%","C vers D","#C4A882"],[ca.toFixed(0)+"e","CA total","#7FAF8A"]].map(([v,l,col])=>(
          <div key={l} style={{background:"white",borderRadius:10,padding:".6rem .5rem",textAlign:"center"}}>
            <div style={{fontSize:"1rem",fontWeight:700,color:col}}>{v}</div>
            <div style={{fontSize:".6rem",color:"#888"}}>{l}</div>
          </div>
        ))}
      </div>
    </div>
  );
}


function TunnelHybridePage({slug, forceEtape="", forceParcours=""}){
  const [profil,setProfil]=useState(null);
  const [loading,setLoading]=useState(true);
  const [etape,setEtape]=useState(forceEtape||(forceParcours?"ebook":"accueil"));
  const [parcours,setParcours]=useState(forceParcours||"");
  const [ebookChoisi,setEbookChoisi]=useState("");
  const [coords,setCoords]=useState({prenom:"",email:"",tel:"",reseau:""});
  const [saving,setSaving]=useState(false);
  const [qIdx,setQIdx]=useState(0);
  const [repsDiagRec,setRepsDiagRec]=useState([]);
  const QDIAGREC=[
    {q:"Tu cherches plutôt :",opts:[["💰","Un revenu complémentaire"],["🚀","Un projet à plein temps"],["🌱","Juste tester sans engagement"]]},
    {q:"Tu es à l'aise avec les réseaux sociaux ?",opts:[["📱","Oui, j'y suis tous les jours"],["🤔","Un peu, j'apprends"],["😅","Pas du tout mais je veux progresser"]]},
    {q:"Ce qui t'attire le plus dans Mihi :",opts:[["🌿","Les produits que j'adore"],["👑","La liberté que ça apporte"],["💪","Le défi de construire quelque chose"]]},
  ];
  const isPT=(navigator.language||"fr").slice(0,2)==="pt";
  const txt=(fr,pt)=>isPT?pt:fr;
  const C2={brun:"#3D1F0E",rose:"#C49A8A",or:"#C4A882",vert:"#7FAF8A",lilas:"#A89BB5",creme:"#FAF7F2",blanc:"#FFFFFF",texte:"#3D2B1F",gris:"#888888",pale:"#E8DDD4"};
  const EBOOKS=[{id:"maman",icon:"M",titre:"Le Guide de la Maman Active",sous:"5 cles pour gagner 1h par jour",couleur:"#3D1F0E"},{id:"silhouette",icon:"S",titre:"Carnet Silhouette",sous:"7 jours de recettes gourmandes",couleur:"#7FAF8A"}];
  useEffect(()=>{
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"linkbio",slug));
        if(snap.exists()) setProfil(snap.data());
        else{
          const q=query(collection(db,"linkbio"),where("slug","==",slug));
          const qs=await getDocs(q);
          if(!qs.empty){console.log("TRACKING via query:",slug);setProfil(qs.docs[0].data());}
        }
      }catch{}
      setLoading(false);
    })();
  },[slug]);
  const nomDistrib=profil&&profil.prenom||"ta conseillere";
  const coordsOk=coords.prenom.trim()&&(coords.email.trim()||coords.tel.trim()||coords.reseau.trim());
  const enregistrerCoords=async()=>{
    setSaving(true);
    try{
      await setDoc(doc(db,"tunnel_prospects","t"+Date.now()),{slug,parcours,ebook:ebookChoisi,coordonnees:coords,date:todayLocalStr(),ts:Date.now()});
    }catch(e){console.error(e);}
    setSaving(false);
    setEtape("ebook_affiche");
  };
  if(loading) return <div style={{minHeight:"100vh",display:"flex",alignItems:"center",justifyContent:"center",background:"#FAF7F2"}}><div style={{textAlign:"center"}}><div style={{fontFamily:"Georgia,serif",fontSize:"1.5rem",color:"#3D1F0E"}}>Chargement...</div></div></div>;
  // Appliquer forceEtape après chargement

  const W={maxWidth:480,margin:"0 auto",padding:"1rem 1rem 3rem"};
  const Hdr=()=>(<div style={{textAlign:"center",padding:"1.5rem 0 1rem"}}>{profil&&profil.photo?<img src={profil.photo} alt="" style={{width:72,height:72,borderRadius:"50%",objectFit:"cover",border:"3px solid #C49A8A",display:"block",margin:"0 auto .6rem"}}/>:<div style={{width:72,height:72,borderRadius:"50%",background:"#3D1F0E",margin:"0 auto .6rem",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.8rem",color:"white"}}>{(profil&&profil.prenom||"B")[0]}</div>}<div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",color:"#3D1F0E",fontWeight:600}}>{profil&&profil.prenom} {profil&&profil.nom||""}</div>{profil&&profil.slogan&&<div style={{fontSize:".72rem",color:"#888",marginTop:".2rem"}}>{profil.slogan}</div>}</div>);

  // ── PAGE PRODUITS ──

  if(etape==="ebook_affiche"){
    const ebookUrl=ebookChoisi==="maman"?"https://blazing-dinasty-1fad9.web.app/guide-maman-active.html":"https://blazing-dinasty-1fad9.web.app/carnet-silhouette.html";
    const ebookNom=ebookChoisi==="maman"?"Le Guide de la Maman Active":"Carnet Silhouette";
    return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}><Hdr/>
      <div style={{background:"#3D1F0E",borderRadius:16,padding:"1.5rem",marginBottom:"1.25rem",textAlign:"center"}}>
        <div style={{fontSize:"2.5rem",marginBottom:".5rem"}}>🎁</div>
        <div style={{fontSize:".55rem",fontWeight:700,letterSpacing:".15em",color:"#C4A882",marginBottom:".3rem"}}>CADEAU DÉBLOQUÉ</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:"white",fontWeight:300,marginBottom:".4rem"}}>{coords.prenom?"Bonne lecture "+coords.prenom+" !":"Bonne lecture !"}</div>
        <div style={{fontSize:".78rem",color:"rgba(255,255,255,.75)",lineHeight:1.6}}>Ton guide <strong style={{color:"#C49A8A"}}>{ebookNom}</strong> est prêt 🌸</div>
      </div>
      <a href={ebookUrl} target="_blank" rel="noopener noreferrer"
        style={{display:"block",background:"#C49A8A",color:"white",textDecoration:"none",borderRadius:12,padding:"1rem",textAlign:"center",marginBottom:"1rem"}}>
        <div style={{fontSize:"1.2rem",marginBottom:".25rem"}}>📖</div>
        <div style={{fontWeight:700,fontSize:".9rem",marginBottom:".2rem"}}>Lire mon guide maintenant</div>
        <div style={{fontSize:".72rem",opacity:.85}}>S'ouvre dans un nouvel onglet</div>
      </a>
      <div style={{background:"white",borderRadius:12,padding:"1rem",marginBottom:".75rem",border:"1px solid #E8DDD4"}}>
        <div style={{fontSize:".6rem",fontWeight:700,color:"#C49A8A",letterSpacing:".1em",marginBottom:".4rem"}}>ET AUSSI</div>
        <div style={{fontSize:".82rem",color:"#3D2B1F",lineHeight:1.6,marginBottom:".75rem"}}>{parcours==="produits"?"Pour des recommandations produits personnalisées →":"Découvrir comment travailler avec nous →"}</div>
        <button onClick={()=>setEtape(parcours==="produits"?"diagnostic":"recrutement")}
          style={{width:"100%",background:"#3D1F0E",color:"white",border:"none",borderRadius:10,padding:".65rem",fontSize:".82rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
          {parcours==="produits"?"Mes recommandations produits →":"Découvrir l'opportunité →"}
        </button>
      </div>
    </div></div>);
  }
  if(etape==="produits_page") return(
    <div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}>
      <div style={W}>
        <Hdr/>
        {/* Hero */}
        <div style={{background:"linear-gradient(135deg,#3D1F0E,#5C3A22)",borderRadius:16,padding:"1.5rem",marginBottom:"1.25rem",textAlign:"center"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🌿</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:"white",fontWeight:300,marginBottom:".4rem"}}>Découvrir les produits <em style={{color:"#C49A8A"}}>Mihi</em></div>
          <div style={{fontSize:".78rem",color:"rgba(255,255,255,.8)",lineHeight:1.65}}>Fabriqués par ElfaPharm — laboratoire pharmaceutique présent dans 62 pays depuis 25 ans. 90% d'ingrédients naturels.</div>
        </div>

        {/* Pourquoi pas cher */}
        <div style={{background:"white",borderRadius:14,padding:"1rem",marginBottom:"1rem",border:"1px solid #E8DDD4"}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:"#C4A882",letterSpacing:".12em",marginBottom:".6rem"}}>✦ POURQUOI CE PRIX ?</div>
          <div style={{fontSize:".82rem",color:"#3D2B1F",lineHeight:1.75}}>Mihi vend <strong>directement</strong> de l'usine à toi — sans intermédiaire, sans boutique, sans publicité TV. Tu paies le produit, pas le marketing.</div>
          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr 1fr",gap:".5rem",marginTop:".75rem"}}>
            {[["🏭","Fabricant direct","ElfaPharm"],["🌿","90% naturel","Sans compromis"],["💰","Prix juste","Sans intermédiaire"]].map(([ic,t,s])=>(
              <div key={t} style={{background:"#FAF7F2",borderRadius:10,padding:".6rem",textAlign:"center"}}>
                <div style={{fontSize:"1.2rem",marginBottom:".2rem"}}>{ic}</div>
                <div style={{fontSize:".68rem",fontWeight:700,color:"#3D1F0E",marginBottom:".1rem"}}>{t}</div>
                <div style={{fontSize:".6rem",color:"#888"}}>{s}</div>
              </div>
            ))}
          </div>
        </div>

        {/* Gammes */}
        <div style={{marginBottom:"1rem"}}>
          <div style={{fontSize:".6rem",fontWeight:700,color:"#C4A882",letterSpacing:".12em",marginBottom:".65rem"}}>✦ NOS GAMMES</div>
          {[
            {icon:"✨",nom:"Skincare",desc:"Soins visage adaptés à tous les types de peau. Hydratation, anti-âge, éclat.",couleur:"#C49A8A"},
            {icon:"🌸",nom:"Parfums",desc:"26 fragrances à 18% de concentration. Tiennent 12h. À partir de 12€.",couleur:"#A89BB5"},
            {icon:"💊",nom:"Compléments",desc:"Minceur, énergie, beauté, santé. Formules pharmaceutiques naturelles.",couleur:"#7FAF8A"},
            {icon:"💄",nom:"Maquillage",desc:"Teintes adaptées à toutes les carnations. Formules légères et durables.",couleur:"#C4A882"},
            {icon:"💇",nom:"Cheveux",desc:"Soins capillaires réparateurs et fortifiants pour tous types de cheveux.",couleur:"#E8A598"},
          ].map(g=>(
            <div key={g.nom} style={{display:"flex",gap:".75rem",alignItems:"flex-start",background:"white",borderRadius:12,padding:".85rem",marginBottom:".5rem",border:"1px solid #E8DDD4"}}>
              <div style={{width:40,height:40,borderRadius:10,background:g.couleur+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.2rem",flexShrink:0}}>{g.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:".85rem",color:"#3D1F0E",marginBottom:".2rem"}}>{g.nom}</div>
                <div style={{fontSize:".75rem",color:"#666",lineHeight:1.55}}>{g.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={()=>{setParcours("produits");setEtape("diag_besoins");}}
          style={{width:"100%",background:"#C49A8A",color:"white",border:"none",borderRadius:12,padding:".85rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".6rem"}}>
          ✨ Trouver mes produits idéaux →
        </button>
        <button onClick={()=>{setParcours("produits");setEtape("coordonnees");}}
          style={{width:"100%",background:"none",border:"1.5px solid #E8DDD4",borderRadius:12,padding:".7rem",fontSize:".78rem",color:"#888",fontFamily:"inherit",cursor:"pointer"}}>
          Contacter {nomDistrib} directement
        </button>
      </div>
    </div>
  );

  // ── DIAGNOSTIC BESOINS (après page produits) ──
  if(etape==="diag_besoins") return(
    <div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}>
      <div style={W}>
        <button onClick={()=>setEtape("produits_page")} style={{background:"none",border:"none",color:"#C49A8A",fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>← Retour</button>
        <div style={{background:"#3D1F0E",borderRadius:14,padding:"1rem",marginBottom:"1.25rem",textAlign:"center"}}>
          <div style={{fontSize:"1.5rem",marginBottom:".3rem"}}>🎯</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>Tes besoins en 3 questions</div>
          <div style={{fontSize:".72rem",color:"rgba(255,255,255,.75)",marginTop:".3rem"}}>Pour te recommander la gamme idéale</div>
        </div>
        {[
          {q:"Ton objectif principal ?",opts:[["✨","Prendre soin de ma peau","skincare"],["⚖️","Perdre du poids","silhouette"],["💊","Booster mon énergie","sante"],["💄","Sublimer mon maquillage","makeup"],["🌸","Trouver mon parfum","parfum"],["💇","Soins cheveux","cheveux"]]},
        ].map((item,qi)=>(
          <div key={qi} style={{background:"white",borderRadius:14,padding:"1rem",marginBottom:"1rem",border:"1px solid #E8DDD4"}}>
            <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"#3D1F0E",marginBottom:".85rem"}}>{item.q}</div>
            <div style={{display:"flex",flexDirection:"column",gap:".4rem"}}>
              {item.opts.map(([ic,label,val])=>(
                <button key={val} onClick={()=>{
                  setParcours("produits");
                  setEtape("coordonnees");
                  // Stocker le besoin pour personnaliser l'ebook
                }}
                  style={{display:"flex",alignItems:"center",gap:".75rem",background:"#FAF7F2",border:"1.5px solid #E8DDD4",borderRadius:10,padding:".65rem .85rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
                  <span style={{fontSize:"1.2rem"}}>{ic}</span>
                  <span style={{fontSize:".82rem",color:"#3D2B1F",fontWeight:600}}>{label}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </div>
    </div>
  );

  // ── PAGE RECRUTEMENT ──
  if(etape==="recrutement_page") return(
    <div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}>
      <div style={W}>
        <Hdr/>
        <div style={{background:"linear-gradient(135deg,#3D1F0E,#1A0A04)",borderRadius:16,padding:"1.5rem",marginBottom:"1.25rem",textAlign:"center"}}>
          <div style={{fontSize:"2rem",marginBottom:".5rem"}}>👑</div>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:"white",fontWeight:300,marginBottom:".4rem"}}>L'activité <em style={{color:"#C49A8A"}}>Mihi</em></div>
          <div style={{fontSize:".78rem",color:"rgba(255,255,255,.8)",lineHeight:1.65}}>Un revenu complémentaire depuis chez toi. Sans stock. Sans patron. À tes heures.</div>
        </div>

        {/* Avantages */}
        <div style={{marginBottom:"1rem"}}>
          {[
            {icon:"🏠",titre:"Depuis chez toi",desc:"Travaille depuis ton canapé, ton café, ta voiture. Ton bureau, c'est toi qui le choisis."},
            {icon:"⏰",titre:"Tes horaires",desc:"Le matin avant les enfants, le soir après le dîner. Tu choisis quand tu travailles."},
            {icon:"💰",titre:"Revenus réels",desc:"Des commissions sur tes ventes + les ventes de ton équipe. Plus tu développes, plus tu gagnes."},
            {icon:"🌱",titre:"Zéro stock",desc:"Les clientes commandent directement sur le site Mihi. Tu n'avances pas d'argent."},
            {icon:"👩‍👧",titre:"Parfait pour les mamans",desc:"Flexible, épanouissant, et motivant. Des centaines de mamans françaises ont déjà franchi le pas."},
          ].map(a=>(
            <div key={a.titre} style={{display:"flex",gap:".75rem",background:"white",borderRadius:12,padding:".85rem",marginBottom:".5rem",border:"1px solid #E8DDD4"}}>
              <div style={{width:38,height:38,borderRadius:10,background:"#3D1F0E15",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{a.icon}</div>
              <div>
                <div style={{fontWeight:700,fontSize:".83rem",color:"#3D1F0E",marginBottom:".2rem"}}>{a.titre}</div>
                <div style={{fontSize:".75rem",color:"#666",lineHeight:1.55}}>{a.desc}</div>
              </div>
            </div>
          ))}
        </div>

        <button onClick={()=>{setParcours("recrutement");setEtape("diag_recrutement");}}
          style={{width:"100%",background:"#3D1F0E",color:"white",border:"none",borderRadius:12,padding:".85rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:".6rem"}}>
          👑 Est-ce fait pour moi ? →
        </button>
        <button onClick={()=>{setParcours("recrutement");setEtape("coordonnees");}}
          style={{width:"100%",background:"none",border:"1.5px solid #E8DDD4",borderRadius:12,padding:".7rem",fontSize:".78rem",color:"#888",fontFamily:"inherit",cursor:"pointer"}}>
          Contacter {nomDistrib} directement
        </button>
      </div>
    </div>
  );

  // ── DIAGNOSTIC RECRUTEMENT RAPIDE ──
  if(etape==="diag_recrutement"){
    const _ignore=[
      {q:"Tu cherches plutôt :",opts:[["💰","Un revenu complémentaire"],["🚀","Un projet à plein temps"],["🌱","Juste tester sans engagement"]]},
      {q:"Tu es à l'aise avec les réseaux sociaux ?",opts:[["📱","Oui, j'y suis tous les jours"],["🤔","Un peu, j'apprends"],["😅","Pas du tout mais je veux progresser"]]},
      {q:"Ce qui t'attire le plus dans Mihi :",opts:[["🌿","Les produits que j'adore"],["👑","La liberté que ça apporte"],["💪","Le défi de construire quelque chose"]]},
    ];

    if(qIdx<QDIAGREC.length){
      const q=QDIAGREC[qIdx];
      return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}>
        <button onClick={()=>setEtape("recrutement_page")} style={{background:"none",border:"none",color:"#C49A8A",fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:0,marginBottom:".75rem"}}>← Retour</button>
        <div style={{height:4,background:"#E8DDD4",borderRadius:2,marginBottom:"1.25rem",overflow:"hidden"}}><div style={{height:"100%",background:"#C49A8A",width:((qIdx/QDIAGREC.length)*100)+"%",transition:"width .3s"}}/></div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:"#3D1F0E",marginBottom:"1.25rem",lineHeight:1.5}}>{q.q}</div>
        <div style={{display:"flex",flexDirection:"column",gap:".5rem"}}>
          {q.opts.map(([ic,label])=>(
            <button key={label} onClick={()=>{setRepsDiagRec(r=>[...r,label]);setQIdx(i=>i+1);}}
              style={{display:"flex",alignItems:"center",gap:".75rem",background:"white",border:"1.5px solid #E8DDD4",borderRadius:12,padding:".75rem 1rem",cursor:"pointer",fontFamily:"inherit",textAlign:"left"}}>
              <span style={{fontSize:"1.2rem"}}>{ic}</span>
              <span style={{fontSize:".85rem",color:"#3D2B1F",fontWeight:600}}>{label}</span>
            </button>
          ))}
        </div>
      </div></div>);
    }
    return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}>
      <div style={{background:"linear-gradient(135deg,#3D1F0E,#1A0A04)",borderRadius:16,padding:"1.5rem",textAlign:"center",marginBottom:"1.25rem"}}>
        <div style={{fontSize:"2rem",marginBottom:".5rem"}}>🌟</div>
        <div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",color:"white",fontWeight:300,marginBottom:".4rem"}}>Tu as le profil !</div>
        <div style={{fontSize:".78rem",color:"rgba(255,255,255,.8)",lineHeight:1.65}}>{nomDistrib} peut te donner toutes les infos pour démarrer. Laisse tes coordonnées.</div>
      </div>
      <button onClick={()=>setEtape("coordonnees")}
        style={{width:"100%",background:"#C49A8A",color:"white",border:"none",borderRadius:12,padding:".85rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>
        Recevoir toutes les infos →
      </button>
    </div></div>);
  }

  if(etape==="accueil") return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}><Hdr/>{profil&&profil.histoire&&<div style={{background:"white",borderRadius:14,padding:"1rem",marginBottom:"1rem",border:"1px solid #E8DDD4",fontSize:".82rem",color:"#3D2B1F",lineHeight:1.75,fontStyle:"italic"}}>"{profil.histoire}"</div>}<div style={{background:"#3D1F0E",borderRadius:14,padding:"1rem",marginBottom:"1.25rem",textAlign:"center"}}><div style={{fontFamily:"Georgia,serif",fontSize:"1.05rem",color:"white",fontWeight:300}}>Qu'est-ce qui t'amene aujourd'hui ? </div></div><div style={{display:"flex",flexDirection:"column",gap:".6rem"}}><div onClick={()=>{setParcours("produits");setEtape("produits_page");}} style={{background:"white",border:"2px solid #C49A8A",borderRadius:14,padding:"1.1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".85rem"}}><div style={{width:50,height:50,borderRadius:12,background:"#C49A8A30",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>P</div><div style={{flex:1}}><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:"#3D1F0E",marginBottom:".2rem"}}>Je veux decouvrir les produits</div><div style={{fontSize:".72rem",color:"#888"}}>Recois tes recommandations personnalisees + un cadeau offert</div></div><span style={{color:"#C49A8A",fontSize:"1.1rem",flexShrink:0}}>→</span></div><div onClick={()=>{setParcours("recrutement");setEtape("recrutement_page");}} style={{background:"white",border:"2px solid #A89BB5",borderRadius:14,padding:"1.1rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".85rem"}}><div style={{width:50,height:50,borderRadius:12,background:"#A89BB530",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.5rem",flexShrink:0}}>O</div><div style={{flex:1}}><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:"#3D1F0E",marginBottom:".2rem"}}>Je cherche une opportunite</div><div style={{fontSize:".72rem",color:"#888"}}>Decouvre si cette aventure est faite pour toi + un cadeau offert</div></div><span style={{color:"#A89BB5",fontSize:"1.1rem",flexShrink:0}}>→</span></div></div></div></div>);
  if(etape==="ebook") return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}><Hdr/><div style={{background:"#3D1F0E",borderRadius:14,padding:"1rem",marginBottom:"1.25rem",textAlign:"center"}}><div style={{fontSize:".6rem",fontWeight:700,color:"#C4A882",marginBottom:".3rem"}}>CADEAU OFFERT</div><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>Choisis ton guide gratuit</div></div>{EBOOKS.map(eb=>(<div key={eb.id} onClick={()=>{setEbookChoisi(eb.id);setEtape("coordonnees");}} style={{background:"white",border:"2px solid "+(ebookChoisi===eb.id?eb.couleur:"#E8DDD4"),borderRadius:14,padding:"1.1rem",marginBottom:".65rem",cursor:"pointer",display:"flex",alignItems:"center",gap:".75rem"}}><div style={{fontSize:"2rem",flexShrink:0}}>{eb.icon}</div><div style={{flex:1}}><div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:"#3D1F0E",marginBottom:".2rem"}}>{eb.titre}</div><div style={{fontSize:".72rem",color:"#888"}}>{eb.sous}</div></div><span style={{color:eb.couleur,fontSize:"1.1rem",flexShrink:0}}>→</span></div>))}</div></div>);
  if(etape==="coordonnees") return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={W}><Hdr/><div style={{background:"#3D1F0E",borderRadius:14,padding:"1rem",marginBottom:"1rem",textAlign:"center"}}><div style={{fontFamily:"Georgia,serif",fontSize:"1rem",color:"white",fontWeight:300}}>Ou est-ce que je t'envoie ton guide ?</div></div>{[["prenom","Prenom *","Ton prenom"],["email","Email","ton@email.com"],["tel","Tel / WhatsApp","06 XX XX XX XX"],["reseau","Messenger / Instagram","@tonpseudo"]].map(([k,l,ph])=>(<div key={k} style={{marginBottom:".4rem"}}><div style={{fontSize:".6rem",color:"#888",marginBottom:".2rem",fontWeight:600}}>{l}</div><input value={coords[k]||""} onChange={e=>setCoords(c=>({...c,[k]:e.target.value}))} placeholder={ph} style={{width:"100%",border:"1.5px solid "+(coords[k]?"#7FAF8A":"#E8DDD4"),borderRadius:8,padding:".45rem .65rem",fontSize:".82rem",fontFamily:"inherit",color:"#3D2B1F",background:"white",outline:"none"}}/></div>))}<button onClick={enregistrerCoords} disabled={!coordsOk||saving} style={{width:"100%",background:coordsOk?"#3D1F0E":"#E8DDD4",color:coordsOk?"white":"#888",border:"none",borderRadius:10,padding:".75rem",fontSize:".88rem",fontWeight:700,fontFamily:"inherit",cursor:coordsOk?"pointer":"default",marginTop:".5rem"}}>{saving?"Envoi...":"Recevoir mon guide gratuit →"}</button></div></div>);
  if(etape==="diagnostic") return(<div style={{minHeight:"100vh",background:"#FAF7F2",fontFamily:"Trebuchet MS,sans-serif"}}><div style={{maxWidth:480,margin:"0 auto"}}><DiagnosticsTab uid={profil&&profil.uid||slug} userName={nomDistrib} externalMode={true} initialClient={coords.prenom}/></div></div>);
  if(etape==="recrutement"){window.location.href="?recrutement=true&uid="+(profil&&profil.uid||slug);return null;}
  return null;
}
function RecommandationPubliquePage({slug, clienteNom}){
  const[prenom,setPrenom]=useState("");const[nom,setNom]=useState("");const[tel,setTel]=useState("");const[mail,setMail]=useState("");const[pseudo,setPseudo]=useState("");
  const[sent,setSent]=useState(false);const[sending,setSending]=useState(false);
  const[cadeau,setCadeau]=useState("Un produit offert");const[prenomDistrib,setPrenomDistrib]=useState("ta conseillere");const[theme,setTheme]=useState("#C49A8A");
  const[a1p,setA1p]=useState("");const[a1n,setA1n]=useState("");const[a1t,setA1t]=useState("");const[a1m,setA1m]=useState("");const[a1s,setA1s]=useState("");
  const[a2p,setA2p]=useState("");const[a2n,setA2n]=useState("");const[a2t,setA2t]=useState("");const[a2m,setA2m]=useState("");const[a2s,setA2s]=useState("");
  const[a3p,setA3p]=useState("");const[a3n,setA3n]=useState("");const[a3t,setA3t]=useState("");const[a3m,setA3m]=useState("");const[a3s,setA3s]=useState("");
  const[showForm,setShowForm]=useState(false);
  useEffect(()=>{(async()=>{try{const s=await getDoc(doc(db,"users",slug));if(s.exists()){if(s.data()["db-recommandation-config"]){const cfg=JSON.parse(s.data()["db-recommandation-config"]);setCadeau(cfg.cadeau||"Un produit offert");if(cfg.theme)setTheme(cfg.theme);}}const s2=await getDoc(doc(db,"linkbio",slug));if(s2.exists())setPrenomDistrib(s2.data().prenom||"ta conseillere");}catch{}})();},[slug]);
  const[rgpdOk,setRgpdOk]=useState(false);const[showRgpd,setShowRgpd]=useState(false);
  const envoyer=async()=>{if(!prenom.trim())return;setSending(true);try{const s=await getDoc(doc(db,"users",slug));const d=s.exists()?s.data():{};const pp=d["db-prospects"]?JSON.parse(d["db-prospects"]):[];const mk=(ap,an,at,am,as2,i)=>({id:Date.now()+i,name:(ap+" "+an).trim(),tel:at.trim(),mail:am.trim(),pseudo:as2.trim(),statut:"Nouveau",interet:"Recommandation",source:"recommandation",recommandePar:(prenom+" "+nom).trim(),recommandeParTel:tel,recommandeParMail:mail,recommandeParPseudo:pseudo,note:`Recommandee par ${prenom} ${nom}${tel?" - Tel:"+tel:""}${mail?" - Email:"+mail:""}${pseudo?" - "+pseudo:""}`,date:new Date().toLocaleDateString("fr-FR"),relance:""});const amies=[[a1p,a1n,a1t,a1m,a1s,0],[a2p,a2n,a2t,a2m,a2s,1],[a3p,a3n,a3t,a3m,a3s,2]].filter(([ap])=>ap.trim()).map(([ap,an,at,am,as2,i])=>mk(ap,an,at,am,as2,i));await setDoc(doc(db,"users",slug),{"db-prospects":JSON.stringify([...amies,...pp].slice(0,500))},{merge:true});setSent(true);}catch(e){console.error(e);}setSending(false);};
  const C2={brun:"#3D1F0E",creme:"#FAF7F2",blanc:"#FFFFFF",texte:"#3D2B1F",gris:"#888888",pale:"#E8DDD4",vert:"#7FAF8A"};const acc=theme||"#C49A8A";
  if(sent)return(<div style={{minHeight:"100vh",background:C2.creme,display:"flex",alignItems:"center",justifyContent:"center",padding:"2rem",fontFamily:"system-ui,sans-serif"}}><div style={{textAlign:"center"}}><div style={{fontSize:"3rem"}}>🎉</div><div style={{fontFamily:"Georgia,serif",fontSize:"1.2rem",color:C2.brun,margin:"1rem 0"}}>Merci !</div><p style={{fontSize:".78rem",color:C2.gris,lineHeight:1.7}}>{prenomDistrib} va te contacter tres vite 🌸</p><div style={{fontSize:".72rem",color:acc,fontWeight:600,marginTop:"1rem"}}>🎁 {cadeau}</div></div></div>);
  if(!showForm)return(<div style={{minHeight:"100vh",background:`linear-gradient(135deg,#3D1F0E,${acc})`,fontFamily:"system-ui,sans-serif",padding:"2rem 1rem",maxWidth:420,margin:"0 auto"}}><div style={{textAlign:"center",color:"white",marginBottom:"1.5rem"}}><div style={{fontSize:"2.5rem",marginBottom:"1rem"}}>🎁</div><div style={{fontFamily:"Georgia,serif",fontSize:"1.5rem",fontWeight:300,marginBottom:".5rem"}}>Tu aimes les cadeaux ?</div><div style={{width:40,height:1,background:acc,margin:".75rem auto"}}/><p style={{fontSize:".85rem",lineHeight:1.8,color:"rgba(255,255,255,.85)",marginBottom:"1.5rem"}}>Tu es cliente de <strong style={{color:acc}}>{prenomDistrib}</strong> et tu adores ses produits Mihi ?<br/>Recommande-la a <strong style={{color:acc}}>3 amies</strong> et recois :<br/><strong style={{color:acc,fontSize:"1rem"}}>🎁 {cadeau}</strong></p><div style={{background:"rgba(255,255,255,.08)",borderRadius:12,padding:"1rem",marginBottom:"1.5rem"}}><div style={{fontSize:".75rem",color:"rgba(255,255,255,.7)",marginBottom:".75rem",fontWeight:700,textTransform:"uppercase",textAlign:"center"}}>Comment ca marche</div><div style={{fontSize:".78rem",color:"white",lineHeight:2}}><div>1. Tu laisses les coordonnees de 3 amies</div><div>2. {prenomDistrib} te recontacte</div><div>3. Tu lui recommandes tes amies</div><div>4. Tu recois ton cadeau 🎁</div></div></div><button onClick={()=>setShowForm(true)} style={{width:"100%",background:acc,color:"white",border:"none",borderRadius:12,padding:".9rem",fontSize:"1rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer"}}>Je participe !</button><p style={{fontSize:".65rem",color:"rgba(255,255,255,.4)",marginTop:"1rem",textAlign:"center"}}>Sans engagement, 100% gratuit</p></div></div>);
  return(<div style={{minHeight:"100vh",background:C2.creme,fontFamily:"system-ui,sans-serif",padding:"1.5rem 1rem",maxWidth:480,margin:"0 auto"}}><button onClick={()=>setShowForm(false)} style={{background:"none",border:"none",color:C2.brun,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",marginBottom:"1rem"}}>← Retour</button><div style={{textAlign:"center",marginBottom:"1.25rem"}}><div style={{fontSize:"1.8rem"}}>🌸</div><div style={{fontFamily:"Georgia,serif",fontSize:"1.1rem",fontWeight:300,color:C2.brun,marginTop:".4rem"}}>Vos coordonnees</div></div><div style={{background:"white",borderRadius:14,padding:"1rem",boxShadow:"0 4px 16px rgba(0,0,0,.07)",marginBottom:"1rem"}}><div style={{fontSize:".62rem",fontWeight:700,color:acc,marginBottom:".75rem",textTransform:"uppercase",letterSpacing:".08em"}}>Vous — qui recommandez</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem",marginBottom:".4rem"}}><input value={prenom} onChange={e=>setPrenom(e.target.value)} placeholder="Prenom *" style={{border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/><input value={nom} onChange={e=>setNom(e.target.value)} placeholder="Nom" style={{border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/></div><input value={tel} onChange={e=>setTel(e.target.value)} placeholder="Telephone / WhatsApp *" type="tel" style={{width:"100%",border:`1px solid ${tel.trim()?"#7FAF8A":"#E8DDD4"}`,borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",marginBottom:".4rem"}}/><input value={mail} onChange={e=>setMail(e.target.value)} placeholder="Email (ou telephone)" type="email" style={{width:"100%",border:`1px solid ${mail.trim()?"#7FAF8A":"#E8DDD4"}`,borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",marginBottom:".4rem"}}/><input value={pseudo} onChange={e=>setPseudo(e.target.value)} placeholder="@pseudo Instagram / Messenger (optionnel)" style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/></div>{[[a1p,setA1p,a1n,setA1n,a1t,setA1t,a1m,setA1m,a1s,setA1s,"Amie 1"],[a2p,setA2p,a2n,setA2n,a2t,setA2t,a2m,setA2m,a2s,setA2s,"Amie 2"],[a3p,setA3p,a3n,setA3n,a3t,setA3t,a3m,setA3m,a3s,setA3s,"Amie 3"]].map(([ap,sap,an,san,at,sat,am,sam,as2,sas,lbl],i)=>(<div key={i} style={{background:"white",borderRadius:14,padding:"1rem",boxShadow:"0 4px 16px rgba(0,0,0,.07)",marginBottom:"1rem"}}><div style={{fontSize:".62rem",fontWeight:700,color:acc,marginBottom:".75rem",textTransform:"uppercase",letterSpacing:".08em"}}>{lbl}</div><div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".4rem",marginBottom:".4rem"}}><input value={ap} onChange={e=>sap(e.target.value)} placeholder="Prenom *" style={{border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/><input value={an} onChange={e=>san(e.target.value)} placeholder="Nom" style={{border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/></div><input value={at} onChange={e=>sat(e.target.value)} placeholder="Telephone / WhatsApp *" type="tel" style={{width:"100%",border:`1px solid ${at.trim()?"#7FAF8A":"#E8DDD4"}`,borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",marginBottom:".4rem"}}/><input value={am} onChange={e=>sam(e.target.value)} placeholder="Email (ou telephone)" type="email" style={{width:"100%",border:`1px solid ${am.trim()?"#7FAF8A":"#E8DDD4"}`,borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none",marginBottom:".4rem"}}/><input value={as2} onChange={e=>sas(e.target.value)} placeholder="@pseudo Instagram / Messenger (optionnel)" style={{width:"100%",border:"1px solid #E8DDD4",borderRadius:8,padding:".45rem .6rem",fontSize:".78rem",fontFamily:"inherit",outline:"none"}}/></div>))}<div style={{fontSize:".62rem",color:C2.gris,textAlign:"center",marginBottom:".75rem"}}>* Prenom + telephone OU email obligatoires par amie</div><button onClick={envoyer} disabled={!prenom.trim()||(!tel.trim()&&!mail.trim())||!a1p.trim()||(!a1t.trim()&&!a1m.trim())||!a2p.trim()||(!a2t.trim()&&!a2m.trim())||!a3p.trim()||(!a3t.trim()&&!a3m.trim())||sending} style={{width:"100%",background:(prenom.trim()&&(tel.trim()||mail.trim())&&a1p.trim()&&(a1t.trim()||a1m.trim())&&a2p.trim()&&(a2t.trim()||a2m.trim())&&a3p.trim()&&(a3t.trim()||a3m.trim()))?C2.brun:"#E8DDD4",color:(prenom.trim()&&(tel.trim()||mail.trim())&&a1p.trim()&&(a1t.trim()||a1m.trim())&&a2p.trim()&&(a2t.trim()||a2m.trim())&&a3p.trim()&&(a3t.trim()||a3m.trim()))?"white":"#888",border:"none",borderRadius:12,padding:".8rem",fontSize:".9rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",marginBottom:"1rem"}}>{sending?"Envoi en cours...":"Envoyer mes recommandations !"}</button>{showRgpd&&(<div style={{position:"fixed",inset:0,background:"rgba(0,0,0,.5)",zIndex:9999,display:"flex",alignItems:"center",justifyContent:"center",padding:"1rem"}} onClick={()=>setShowRgpd(false)}><div style={{background:"white",borderRadius:14,padding:"1.25rem",maxWidth:400,width:"100%",maxHeight:"80vh",overflowY:"auto"}} onClick={e=>e.stopPropagation()}><div style={{fontSize:".8rem",fontWeight:700,color:C2.brun,marginBottom:"1rem"}}>Politique de confidentialite</div><div style={{fontSize:".68rem",color:C2.texte,lineHeight:1.7}}><p><strong>Responsable :</strong> Melissa Da Silveira - Distributrice independante Mihi France</p><p><strong>Donnees collectees :</strong> Prenom, nom, telephone, email, pseudo reseaux sociaux.</p><p><strong>Finalite :</strong> Vous recontacter avec des recommandations de produits Mihi.</p><p><strong>Duree :</strong> 12 mois maximum puis suppression.</p><p><strong>Vos droits (RGPD) :</strong> Acces, rectification et suppression sur simple demande aupres de votre conseillere.</p></div><button onClick={()=>setShowRgpd(false)} style={{width:"100%",background:C2.brun,color:"white",border:"none",borderRadius:8,padding:".65rem",fontSize:".78rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer",marginTop:".75rem"}}>Compris !</button></div></div>)}<div style={{display:"flex",alignItems:"flex-start",gap:".5rem",background:"#FDF8F5",border:"1px solid #E8DDD4",borderRadius:8,padding:".65rem .75rem",margin:".75rem 0"}}><input type="checkbox" id="rgpd-rec" checked={rgpdOk} onChange={e=>setRgpdOk(e.target.checked)} style={{marginTop:2,width:15,height:15,flexShrink:0,cursor:"pointer"}}/><label htmlFor="rgpd-rec" style={{fontSize:".66rem",color:"#888",lineHeight:1.5,cursor:"pointer"}}>J accepte que mes coordonnees et celles de mes amies soient transmises a la conseillere Mihi. <span onClick={()=>setShowRgpd(true)} style={{color:C2.brun,fontWeight:600,textDecoration:"underline",cursor:"pointer"}}>Politique de confidentialite</span></label></div><p style={{fontSize:".6rem",color:C2.gris,textAlign:"center"}}>🎁 Cadeau : {cadeau}</p></div>);
}

function Root(){
  const p=new URLSearchParams(window.location.search);
  const bioSlug=p.get("bio");
  const tunnelParam=p.get("tunnel");
  // Si bio + tunnel => ouvrir tunnel avec parcours pré-sélectionné
  if(bioSlug && tunnelParam) return <TunnelHybridePage slug={bioSlug} forceEtape={tunnelParam}/>;
  if(bioSlug) return <LinkBioPublicPage slug={bioSlug}/>;
  const pathname=window.location.pathname;
  if(pathname.startsWith("/recommande/")){const recSlug=pathname.split("/")[2];const clienteNom=p.get("cliente")||"";return <RecommandationPubliquePage slug={recSlug} clienteNom={clienteNom}/>;}  
  const ordId=p.get("ordonnance");
  if(ordId) return <OrdonnancePubliquePage ordId={ordId}/>;
  const tunnelSlug=p.get("tunnel");
  if(tunnelSlug) return <TunnelHybridePage slug={tunnelSlug}/>;
  return <App/>;
}


export { DiagnosticParfumTab, DiagnosticsTab, DiagResultsTab, LinkBioPublicPage, TunnelHybridePage, RecommandationPubliquePage, FORMATION_APP_CATEGORIES, FORMATION_APP_CATEGORIES_DEFAULT };
export default Root;
