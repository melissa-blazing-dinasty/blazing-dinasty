import { useState, useEffect, useCallback } from 'react';
import { db } from './firebase';
import { doc, getDoc, setDoc, getDocs, collection, query, where } from 'firebase/firestore';
import { C } from './constants';
import { todayLocalStr, ss, sg, sgAll } from './utils';

function CopyBtn({text}){
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
const CITATIONS_DEFAULT=[
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
          if(diffJours>=7){setEtat("termine");return;}
          const joursValides=ca.joursValides||[];
          setEtat("actif");
          setJourActuel(jour);
          setValide(joursValides.includes(jour));
        }
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
      setValide(true);
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

  const jour=jourActuel?CHALLENGE_APP_JOURS[jourActuel-1]:null;

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
  const[loginStep,setLoginStep]=useState(1); // 1=identité, 2=chef équipe
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

  const SECRET_CODE="BD-2026-FIRE";

  // ── AUTO-LOGIN depuis localStorage ──
  useEffect(()=>{
    try{
      const saved=localStorage.getItem("bd-user");
      if(saved){
        const{uid,n,codeOk}=JSON.parse(saved);
        if(uid&&n&&codeOk===true){
          setUserId(uid);setName(n);
          setScreen("app");load(uid);verifierChangementPeriode(uid);
          try{const fk="bd-first-"+uid;if(!localStorage.getItem(fk)){localStorage.setItem(fk,"1");setTimeout(()=>setShowWelcome(true),1500);}}catch{}
        } else {
          // Session invalide - effacer et forcer reconnexion
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

      if(!isMelissa&&!alreadyHasChef){
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

      // Connexion directe
      try{localStorage.setItem("bd-user",JSON.stringify({uid,n:displayName,codeOk:true}));}catch{}
      // Popup bienvenue si première connexion
      try{
        const isFirst=!localStorage.getItem("bd-welcome-shown-"+uid);
        if(isFirst){ setShowWelcome(true); localStorage.setItem("bd-welcome-shown-"+uid,"1"); }
      }catch{}
      setUserId(uid);setName(displayName);setScreen("app");load(uid);verifierChangementPeriode(uid);
      // Afficher le challenge app après 2s
      setTimeout(()=>setShowChallengeApp(true), 2000);
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
      // Synchroniser l'annuaire global des distributeurs
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
              const bloque = !formationDebloquee && f.id!=="formationapp" && f.id!=="demarrage";
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

function HistoriquePeriodes({uid}){
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

function NoticePanel({cleOutil,onClose,videoUrl}){
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

function SuiviRecruTab({uid, isChef=false}){
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

function ConversionPopup({prospect:p, clients, distributeurs, saveClients, saveDistributeurs, saveProspects, prospects, onClose}){
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

function DashboardTab({uid, goToFormation, fastStartDone=false, onFastStartDone=()=>{}, hasFastStart=false, onHasFastStart=()=>{}, isChef=false, onObjPersoChange=()=>{}}){
  const[dtab,setDtab]=useState("today");
  const[showNotice,setShowNotice]=useState(false);
  const[noticeVideos,setNoticeVideos]=useState({});
  const[btab,setBtab]=useState("suivica");

  // Rafraîchir automatiquement les prospects à chaque ouverture de l'onglet
  useEffect(()=>{
    if(dtab==="prospects"&&uid){
      getDoc(doc(db,"users",uid)).then(snap=>{
        if(snap.exists()&&snap.data()["db-prospects"]){
          try{setProspects(JSON.parse(snap.data()["db-prospects"]));}catch{}
        }
      }).catch(()=>{});
    }
  },[dtab,uid]);
  const[actions,setActions]=useState({});
  const[prospects,setProspects]=useState([]);
  const[newP,setNewP]=useState({name:"",statut:"Nouveau",note:"",interet:""});
  const[conversionPopup,setConversionPopup]=useState(null); // {prospect, vers: 'client'|'distributrice'}
  const[prospectSearch,setProspectSearch]=useState("");
  const[prospectFiltre,setProspectFiltre]=useState("Tous");
  const[prospectInteretFiltre,setProspectInteretFiltre]=useState("");
  const[posts,setPosts]=useState([]);
  const[newPost,setNewPost]=useState({type:"Post",sujet:"",fait:false});
  const[stats,setStats]=useState({messages:"",reponses:"",presentations:"",ventes:"",recrues:"",objectif:"2"});
  const[clients,setClients]=useState([]);
  const[distributeurs,setDistributeurs]=useState([]);
  const[objPerso,setObjPerso]=useState({ca:"",caObj:"",palier:"2%",recruesObj:"0"});
  const[isChefDash,setIsChefDash]=useState(false);
  const[loaded,setLoaded]=useState(false);
  const[totalRecrues,setTotalRecrues]=useState(0);
  const[cmdPeriode,setCmdPeriode]=useState({count:0,montant:0});
  const[streak,setStreak]=useState(0);
  const[totalActionsValidees,setTotalActionsValidees]=useState(0);
  const[confettiTrigger,setConfettiTrigger]=useState(0);
  const[equipeFunTab,setEquipeFunTab]=useState("wall");
  const[clientsSubTab,setClientsSubTab]=useState("clients");
  const[distriSubTab,setDistriSubTab]=useState("distributeurs");
  const[mood,setMood]=useState(null);
  const userName = uid.split("-").map(w=>w.charAt(0).toUpperCase()+w.slice(1)).join(" ");

  useEffect(()=>{
    let cancelled=false;
    sgAll(uid).then(data=>{
      if(cancelled) return;
      if(data["db-actions"]){
        try{
          const parsed = JSON.parse(data["db-actions"]);
          const today = todayLocalStr();
          // Si les actions ont été sauvegardées aujourd'hui → les charger
          // Sinon → repartir à zéro (nouveau jour)
          if(parsed._date === today){
            const {_date, ...actionsSeules} = parsed;
            setActions(actionsSeules);
          } else {
            // Nouveau jour → actions vides
            setActions({});
            ss(uid,"db-actions",JSON.stringify({_date:today}));
          }
        }catch{ setActions({}); }
      }
      if(data["db-prospects"])     setProspects(JSON.parse(data["db-prospects"]));
      if(data["db-posts"])         setPosts(JSON.parse(data["db-posts"]));
      if(data["db-stats"])         setStats(JSON.parse(data["db-stats"]));
      if(data["db-clients"])       setClients(JSON.parse(data["db-clients"]));
      if(data["db-distributeurs"]) setDistributeurs(JSON.parse(data["db-distributeurs"]));
      if(data["db-obj-perso"])     setObjPerso(JSON.parse(data["db-obj-perso"]));
      if(data["recrues"]){
        try{ setTotalRecrues(JSON.parse(data["recrues"]).length); }catch{}
      }
      if(data["db-actions-cumul"]) setTotalActionsValidees(+data["db-actions-cumul"]||0);
      if(data["db-actions-custom"]){
        try{
          const cd=JSON.parse(data["db-actions-custom"]);
          const tod=todayLocalStr();
          if(Array.isArray(cd)){setActionsCustomRaw([]);ss(uid,"db-actions-custom",JSON.stringify({_date:tod,actions:[]}));}
          else if(cd._date===tod){setActionsCustomRaw(cd.actions||[]);}
          else{setActionsCustomRaw([]);ss(uid,"db-actions-custom",JSON.stringify({_date:tod,actions:[]}));}
        }catch{}
      }
      if(data["db-cmd-periode"]){
        try{
          const raw = JSON.parse(data["db-cmd-periode"]);
          const periodeNum = getPeriodeActuelle ? getPeriodeActuelle() : 0;
          const p = raw[`p${periodeNum}`]||{count:0,montant:0};
          setCmdPeriode(p);
        }catch{}
      }
      if(data["db-fast-start"]){
        try{
          const fs=JSON.parse(data["db-fast-start"]);
          // Fast Start "fait" = tous les 7 modules validés par la marraine
          const nbModulesValides=Object.values(fs.modulesValides||{}).filter(Boolean).length;
          const done=fs.startDate && nbModulesValides>=FAST_START_DAYS.length;
          onFastStartDone(done);
          // Visible seulement si assigné ET pas tous les modules validés
          onHasFastStart(!!fs.startDate && !done);
        }catch{}
      }

      // Calcul du streak de connexion quotidienne
      const today = todayLocalStr();
      const lastLogin = data["db-last-login"];
      let newStreak = +data["db-streak"] || 0;
      if(lastLogin !== today){
        const yesterday = new Date(Date.now()-86400000).toISOString().slice(0,10);
        newStreak = (lastLogin===yesterday) ? newStreak+1 : 1;
        ss(uid,"db-streak",String(newStreak));
        ss(uid,"db-last-login",today);
      }
      setStreak(newStreak);

      setLoaded(true);
    });
    // Vérifier si chef d'équipe
    (async()=>{
      try{
        const snap=await getDoc(doc(db,"acces","membres"));
        const chefs=snap.exists()?snap.data().chefs||[]:[];
        setIsChefDash((Array.isArray(chefs)?chefs:Object.values(chefs||{})).includes(uid.replace(/-/g," ")));
      }catch{}
    })();
    return()=>{cancelled=true;};
  },[uid]);

  const saveActions=(a, justChecked)=>{
    const today = todayLocalStr();
    setActions(a);
    ss(uid,"db-actions",JSON.stringify({...a, _date:today}));

    // Compter ce jour comme actif dans l'historique d'assiduité
    if(justChecked){
      const periodeNum = getPeriodeActuelle ? getPeriodeActuelle() : 0;
      const periodeKey = `p${periodeNum}`;
      sgAll(uid).then(data=>{
        try{
          const hist = data["db-assiduite"] ? JSON.parse(data["db-assiduite"]) : {};
          const periode = hist[periodeKey] || {jours:[]};
          const joursArr=Array.isArray(periode.jours)?periode.jours:Object.values(periode.jours||{});
          if(!joursArr.includes(today)){
            periode.jours = [...joursArr, today];
            hist[periodeKey] = periode;
            ss(uid,"db-assiduite",JSON.stringify(hist));
          }
        }catch{}
      });
    }
    if(justChecked){
      const newCumul = totalActionsValidees+1;
      setTotalActionsValidees(newCumul);
      ss(uid,"db-actions-cumul",String(newCumul));
      const newDone = allTodayActions.filter(act=>a[act.id]).length;
      if(newDone===5) setConfettiTrigger(t=>t+1);
    }
  };
  const saveProspects=p=>{setProspects(p);ss(uid,"db-prospects",JSON.stringify(p));};
  const savePosts=p=>{setPosts(p);ss(uid,"db-posts",JSON.stringify(p));};
  const saveStats=s=>{setStats(s);ss(uid,"db-stats",JSON.stringify(s));};
  const saveClients=c=>{setClients(c);ss(uid,"db-clients",JSON.stringify(c));};
  const saveDistributeurs=d=>{setDistributeurs(d);ss(uid,"db-distributeurs",JSON.stringify(d));};
  const saveObjPerso=async(o)=>{setObjPerso(o);ss(uid,"db-obj-perso",JSON.stringify(o));try{await syncAnnuaire(uid,userName,o);}catch{};onObjPersoChange(o);};

  const todayActions=[
    {id:"a1",icon:"📝",label:"Publier mon post du jour",sub:"1 contenu fort — photo, Reel ou carrousel"},
    {id:"a2",icon:"💬",label:"Envoyer 5 messages de suivi",sub:"Personnes qui ont liké, commenté ou vu mes stories"},
    {id:"a3",icon:"🤝",label:"Interagir avec 10 comptes ciblés",sub:"Femmes qui correspondent à ma cible — vrais commentaires"},
    {id:"a4",icon:"❓",label:'Story "question du jour"',sub:"Une question simple pour générer des réponses en DM"},
    {id:"a5",icon:"📋",label:"Mettre à jour mes prospects",sub:"Relances, nouveaux contacts, statuts à jour"},
  ];
  const[actionsCustom,setActionsCustomRaw]=useState([]);
  const setActionsCustom=(updater)=>{
    setActionsCustomRaw(prev=>{
      const next=typeof updater==="function"?updater(prev):updater;
      ss(uid,"db-actions-custom",JSON.stringify({_date:todayLocalStr(),actions:next}));
      return next;
    });
  };
  const[showBiblio,setShowBiblio]=useState(false);
  const allTodayActions=[...todayActions,...actionsCustom];
  const doneCount=allTodayActions.filter(a=>actions[a.id]).length;
  const totalActions=allTodayActions.length;
  const displayedActions = allTodayActions;

  const pctCAGauge = (()=>{
    if(!objPerso.caObj||!objPerso.ca)return 0;
    return Math.round(+objPerso.ca/+objPerso.caObj*100);
  })();
  const pctRecruesGauge = (()=>{
    if(!objPerso.recruesObj||objPerso.recruesObj==="0"||!objPerso.recruesReal)return 0;
    return Math.round(+objPerso.recruesReal/+objPerso.recruesObj*100);
  })();
  const badgeData = {
    totalActionsValidees, totalRecrues, streak,
    pctCA: pctCAGauge, pctRecrues: pctRecruesGauge,
    ca: +objPerso.ca||0, doneCount,
  };
  const badges = computeBadges(badgeData);

  const todayStr = todayLocalStr();
  const aRecontacterAujourdhui = prospects.filter(p=>p.relance && p.relance<=todayStr);

  // Anniversaires clients dans les 7 prochains jours
  const anniversairesProches = (clients||[]).filter(c=>{
    if(!c.ddn)return false;
    const ddn=new Date(c.ddn);
    const today=new Date();
    const thisYearBday=new Date(today.getFullYear(),ddn.getMonth(),ddn.getDate());
    if(thisYearBday<today.setHours(0,0,0,0)) thisYearBday.setFullYear(today.getFullYear()+1);
    const diffJours=Math.ceil((thisYearBday-new Date().setHours(0,0,0,0))/(1000*60*60*24));
    return diffJours>=0&&diffJours<=7;
  }).map(c=>{
    const ddn=new Date(c.ddn);
    const today=new Date();
    const thisYearBday=new Date(today.getFullYear(),ddn.getMonth(),ddn.getDate());
    if(thisYearBday<new Date(today.getFullYear(),today.getMonth(),today.getDate())) thisYearBday.setFullYear(today.getFullYear()+1);
    const diffJours=Math.ceil((thisYearBday-new Date(today.getFullYear(),today.getMonth(),today.getDate()))/(1000*60*60*24));
    return{...c,joursAvant:diffJours};
  }).sort((a,b)=>a.joursAvant-b.joursAvant);

  const ordreInteret={client:0, distributeur:1, "":2};
  const prospectsFiltres = prospects
    .filter(p=>prospectFiltre==="Tous"||(prospectFiltre==="🤝 Recommandés"?p.source==="recommandation":p.statut===prospectFiltre))
    .filter(p=>{
      if(!prospectInteretFiltre)return true;
      if(prospectInteretFiltre==="none")return !p.interet;
      return p.interet===prospectInteretFiltre;
    })
    .filter(p=>!prospectSearch.trim()||p.name.toLowerCase().includes(prospectSearch.trim().toLowerCase())||(p.note||"").toLowerCase().includes(prospectSearch.trim().toLowerCase()))
    .slice()
    .sort((a,b)=>{
      const aToday = a.relance && a.relance<=todayStr;
      const bToday = b.relance && b.relance<=todayStr;
      if(aToday&&!bToday)return -1;
      if(bToday&&!aToday)return 1;
      const oa=ordreInteret[a.interet||""], ob=ordreInteret[b.interet||""];
      if(oa!==ob) return oa-ob;
      if(a.relance&&b.relance)return a.relance<b.relance?-1:1;
      if(a.relance)return -1;
      if(b.relance)return 1;
      return 0;
    });

  // Annonce automatique sur le Wall of Fame quand un nouveau badge est débloqué
  useEffect(()=>{
    if(!loaded) return;
    const unlockedIds = badges.filter(b=>b.unlocked).map(b=>b.id);
    if(unlockedIds.length===0) return;
    sg(uid,"db-badges-unlocked").then(stored=>{
      const prevRaw = stored ? JSON.parse(stored) : [];
      const prev = Array.isArray(prevRaw) ? prevRaw : Object.values(prevRaw||{});
      const nouveaux = unlockedIds.filter(id=>!prev.includes(id));
      if(nouveaux.length>0){
        nouveaux.forEach(id=>{
          const b = BADGES_DEF.find(x=>x.id===id);
          if(b) postToWallOfFame(uid, userName, `vient de débloquer le badge ${b.icon} "${b.label}" !`, "🏅");
        });
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      } else if(unlockedIds.length!==prev.length){
        ss(uid,"db-badges-unlocked",JSON.stringify(unlockedIds));
      }
    });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  },[loaded, badges.filter(b=>b.unlocked).map(b=>b.id).join(",")]);

  const STATUTS=["Nouveau","Contact fait","🔥 Chaud","🌡️ Tiède","❄️ Froid","📅 Invité présentation","👀 En réflexion","✅ Converti","❌ Pas intéressé"];
  const statusColor={"Nouveau":C.gris,"Contact fait":C.lilas,"🔥 Chaud":"#C44B1A","🌡️ Tiède":C.or,"❄️ Froid":"#5B8DB8","📅 Invité présentation":C.rose,"👀 En réflexion":"#8B5E00","✅ Converti":C.vert,"❌ Pas intéressé":"#B04040"};

  const {t} = useLang();
  const DTABS=[
    {id:"today",        label:"⚡ Aujourd'hui"},
    // Fast Start — visible seulement si assigné ET pas encore terminé
    ...((hasFastStart&&!fastStartDone)?[{id:"faststart",label:"🚀 Fast Start"}]:[]),
    {id:"objperso",     label:"🎯 Objectifs"},
    {id:"clients",      label:"🛍️ Clients"},
    {id:"distributeurs",label:"👑 Distributeurs"},
    {id:"prospects",    label:"👥 Prospects"},
    // Suivi CA — visible seulement pour les chefs
    {id:"relances",label:"🔔 Relances"},
    {id:"editorial",label:"✍️ Éditorial"},{id:"business",label:"📊 Business"},
    {id:"diagnostics",  label:"🩺 Diagnostics"},
    
    {id:"equipe-fun",   label:"🏆 Équipe"},
  ];

  return(
    <div>
      <SecTitle title="Tableau" em="de bord" desc="Tes actions quotidiennes · Tes prospects · Tes publications · Tes stats."/>

      {/* Sub-nav */}
      <div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto",paddingBottom:".3rem"}}>
        {DTABS.map(t=>(
          <button key={t.id} onClick={()=>setDtab(t.id)}
            style={{flex:"none",padding:".5rem .9rem",fontSize:".68rem",fontWeight:600,borderRadius:20,border:`1px solid ${dtab===t.id?C.rose:C.pale}`,background:dtab===t.id?C.rose:C.blanc,color:dtab===t.id?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap",transition:"all .2s"}}>
            {t.label}
          </button>
        ))}
      </div>

      {/* FAST START J1-J7 */}
      {dtab==="faststart"&&<FastStartTab uid={uid} userName={userName} goToFormation={goToFormation}/>}

      {/* TODAY */}
      {dtab==="today"&&(
        <div>
          <Confetti trigger={confettiTrigger}/>
          <MarrainePopup uid={uid} userName={userName}/>
          <AnnonceBanner uid={uid}/>

          {/* POPUP CONVERSION PROSPECT */}
          {conversionPopup&&(
            <ConversionPopup
              prospect={conversionPopup.prospect}
              clients={clients}
              distributeurs={distributeurs}
              saveClients={saveClients}
              saveDistributeurs={saveDistributeurs}
              saveProspects={saveProspects}
              prospects={prospects}
              onClose={()=>setConversionPopup(null)}
            />
          )}
          {aRecontacterAujourdhui.length>0&&(
            <div onClick={()=>setDtab("prospects")}
              style={{background:"linear-gradient(135deg,#C44B1A,#C49A8A)",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"white",marginBottom:".3rem"}}>📞 À recontacter aujourd'hui</div>
              <div style={{fontSize:".78rem",color:"white",fontWeight:600}}>
                {aRecontacterAujourdhui.length} prospect{aRecontacterAujourdhui.length>1?"s":""} : {aRecontacterAujourdhui.slice(0,3).map(p=>p.name).join(", ")}{aRecontacterAujourdhui.length>3?"...":""}
              </div>
              <div style={{fontSize:".62rem",color:"rgba(255,255,255,.85)",marginTop:".2rem"}}>Touche pour voir tes prospects →</div>
            </div>
          )}
          {anniversairesProches.length>0&&(
            <div onClick={()=>setDtab("clients")}
              style={{background:"linear-gradient(135deg,#C49A8A,#E8B4A8)",borderRadius:12,padding:".85rem 1rem",marginBottom:"1rem",cursor:"pointer"}}>
              <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"white",marginBottom:".3rem"}}>🎂 Anniversaires à venir</div>
              {anniversairesProches.slice(0,3).map(c=>(
                <div key={c.id} style={{fontSize:".75rem",color:"white",fontWeight:600,marginBottom:".15rem"}}>
                  {c.joursAvant===0?"🎉 Aujourd'hui":c.joursAvant===1?"Demain":`Dans ${c.joursAvant}j`} — {c.prenom} {c.nom}
                </div>
              ))}
              <div style={{fontSize:".62rem",color:"rgba(255,255,255,.85)",marginTop:".2rem"}}>Touche pour voir tes clientes →</div>
            </div>
          )}
          <AssistanteIATab uid={uid} userName={userName}/>
          <JaugeSucces pctCA={pctCAGauge} pctRecrues={pctRecruesGauge}/>
          <BadgesPanel badges={badges}/>
          {streak>=2&&(
            <div style={{display:"flex",alignItems:"center",gap:".4rem",background:"rgba(196,168,130,.15)",border:`1px solid ${C.or}40`,borderRadius:10,padding:".5rem .8rem",marginBottom:"1rem",fontSize:".72rem",color:C.brun}}>
              <span style={{fontSize:"1.1rem"}}>🔥</span>
              <span><strong>{streak} jours</strong> de connexion d'affilée — continue comme ça !</span>
            </div>
          )}
          <CitationDuJour uid={uid}/>
          <DreamBoardWidget uid={uid}/>
          {showBiblio&&<BiblioActionsPopup
            onClose={()=>setShowBiblio(false)}
            actionsCustom={actionsCustom}
            onAjouter={(a)=>{
              if(!actionsCustom.some(x=>x.id===a.id)){
                setActionsCustom(prev=>[...prev,a]);
              }
            }}
          />}

          <div style={{background:C.brun,borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>
            <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".4rem"}}>
              <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".15em",textTransform:"uppercase",color:C.or}}>
                ⚡ MES ACTIONS DU JOUR
              </div>
              <button onClick={()=>setShowBiblio(true)}
                style={{background:C.or+"25",border:`1px solid ${C.or}50`,borderRadius:8,padding:".2rem .55rem",fontSize:".62rem",fontWeight:700,color:C.or,cursor:"pointer",fontFamily:"inherit",flexShrink:0}}>
                + Actions
              </button>
            </div>
            <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.pale,marginBottom:".35rem"}}>
              <span>Progression</span><span style={{fontWeight:700,color:doneCount===totalActions?C.vert:C.or}}>{doneCount} / {totalActions}</span>
            </div>
            <div style={{height:5,background:"rgba(255,255,255,.1)",borderRadius:10,overflow:"hidden",marginBottom:".75rem"}}>
              <div style={{height:"100%",background:doneCount===totalActions?C.vert:C.rose,width:(doneCount/Math.max(totalActions,1)*100)+"%",borderRadius:10,transition:"width .3s"}}/>
            </div>
            {displayedActions.map(a=>(
              <div key={a.id} onClick={()=>saveActions({...actions,[a.id]:!actions[a.id]}, !actions[a.id])}
                style={{display:"flex",gap:".65rem",padding:".6rem 0",borderBottom:`1px solid rgba(196,154,138,.2)`,cursor:"pointer",alignItems:"flex-start"}}>
                <div style={{width:20,height:20,borderRadius:5,border:`2px solid ${actions[a.id]?C.rose:C.pale+"80"}`,background:actions[a.id]?C.rose:"transparent",flexShrink:0,marginTop:2,display:"flex",alignItems:"center",justifyContent:"center",transition:"all .15s"}}>
                  {actions[a.id]&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
                </div>
                <div style={{flex:1}}>
                  <div style={{fontSize:".78rem",fontWeight:600,color:actions[a.id]?C.gris:C.blanc,textDecoration:actions[a.id]?"line-through":"none"}}>{a.icon} {a.label}</div>
                  <div style={{fontSize:".65rem",color:C.pale,opacity:.7,marginTop:".1rem"}}>{a.sub}</div>
                </div>
              </div>
            ))}
          </div>


          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".58rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.rose,marginBottom:".5rem"}}>🔄 Réactivation base existante</div>
            <p style={{fontSize:".75rem",color:C.texte,lineHeight:1.65}}>Contacter 10 anciens silencieux cette semaine.</p>
            <div style={{background:C.creme,borderLeft:`3px solid ${C.lilas}`,borderRadius:"0 8px 8px 0",padding:".5rem .75rem",fontSize:".73rem",fontStyle:"italic",color:C.texte,lineHeight:1.7,marginTop:".5rem"}}>
              "Coucou, ça fait longtemps ! Comment tu vas ?"
              <CopyBtn text="Coucou, ça fait longtemps ! Comment tu vas ?"/>
            </div>
          </div>

          <TodoPerso uid={uid}/>
          <ClassementEquipe uid={uid}/>

          {/* Compteur commandes période */}
          <CmdPeriodeBlock cmdPeriode={cmdPeriode}/>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(196,168,130,.08))`,border:`1px solid ${C.pale}`,borderRadius:12,padding:".85rem 1rem",textAlign:"center"}}>
            <div style={{fontSize:".75rem",color:C.brun,fontStyle:"italic",lineHeight:1.65}}>
              💡 <strong>"Posts = attirer. Actions quotidiennes = convertir.<br/>Les deux ensemble, c'est là que ça décolle."</strong>
            </div>
          </div>
        </div>
      )}

      {/* PROSPECTS */}
      {dtab==="prospects"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="prospects" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["prospects"]||""}/>}
          <button onClick={async()=>{
            try{
              const snap=await getDoc(doc(db,"users",uid));
              if(snap.exists()&&snap.data()["db-prospects"]){
                const liste=JSON.parse(snap.data()["db-prospects"]);
                setProspects(liste);
                alert(`✅ ${liste.length} prospects chargés (dont ${liste.filter(p=>p.source==="recommandation").length} recommandations)`);
              } else {
                alert("Aucun prospect trouvé dans Firebase pour ce compte.");
              }
            }catch(e){alert("Erreur : "+e.message);}
          }}
            style={{width:"100%",background:C.creme,border:`1px solid ${C.pale}`,borderRadius:9,padding:".4rem",fontSize:".68rem",fontWeight:600,color:C.brun,fontFamily:"inherit",cursor:"pointer",marginBottom:".6rem"}}>
            🔄 Rafraîchir (pour voir les nouvelles recommandations)
          </button>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Ajouter un prospect ({prospects.length})</div>
            <input placeholder="Prénom" value={newP.name} onChange={e=>setNewP(p=>({...p,name:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}/>
            <select value={newP.statut} onChange={e=>setNewP(p=>({...p,statut:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              {STATUTS.map(s=><option key={s}>{s}</option>)}
            </select>
            <select value={newP.interet} onChange={e=>setNewP(p=>({...p,interet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".45rem"}}>
              <option value="">Intérêt : non défini</option>
              <option value="client">🛍️ Intéressée par les produits (cliente)</option>
              <option value="distributeur">👑 Intéressée par l'activité (distributrice)</option>
            </select>
            <input placeholder="Note (optionnel)" value={newP.note} onChange={e=>setNewP(p=>({...p,note:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newP.name.trim())return;
              const next=[{...newP,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),relance:""},...prospects];
              saveProspects(next);setNewP({name:"",statut:"Nouveau",note:"",interet:""});
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter le prospect
            </button>
          </div>

          {/* Navigation par dossier : Clients potentiels / Distributeurs potentiels / Non classé */}
          {!prospectInteretFiltre&&(
            <div>
              <div style={{fontSize:".68rem",color:C.gris,marginBottom:".6rem"}}>Choisis une catégorie pour voir tes prospects :</div>
              {[
                ["client","🛍️ Clients potentiels",C.rose],
                ["distributeur","👑 Distributeurs potentiels",C.lilas],
                
                ["none","🤝 Recommandations",C.gris],
              ].map(([val,label,col])=>{
                const count = val==="none"
                  ?prospects.filter(p=>!p.interet||p.interet==="none").length
                  :prospects.filter(p=>p.interet===val).length;
                return(
                  <div key={val} onClick={()=>setProspectInteretFiltre(val)}
                    style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".95rem",fontWeight:600,color:C.brun}}>{label}</div>
                    <div style={{display:"flex",alignItems:"center",gap:".4rem"}}>
                      <span style={{fontSize:".7rem",fontWeight:700,color:col,background:col+"15",borderRadius:20,padding:".15rem .6rem"}}>{count}</span>
                      <span style={{color:C.pale}}>›</span>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {prospectInteretFiltre&&(
          <div>
          <button onClick={()=>{setProspectInteretFiltre("");setProspectFiltre("Tous");setProspectSearch("");}}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour aux catégories
          </button>
          <div style={{fontFamily:"Georgia,serif",fontSize:"1rem",fontWeight:600,color:C.brun,marginBottom:".6rem"}}>
            {prospectInteretFiltre==="client"?"🛍️ Clients potentiels":prospectInteretFiltre==="distributeur"?"👑 Distributeurs potentiels":prospectInteretFiltre==="Recommandation"?"🤝 Recommandations":"📌 Non classé"}
          </div>

          {/* Recherche et filtres */}
          <input placeholder="🔍 Rechercher par nom ou note..." value={prospectSearch} onChange={e=>setProspectSearch(e.target.value)}
            style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".78rem",fontFamily:"inherit",color:C.texte,background:C.blanc,outline:"none",marginBottom:".5rem"}}/>
          <div style={{display:"flex",gap:".3rem",marginBottom:".75rem",overflowX:"auto",paddingBottom:".2rem"}}>
            {["🤝 Recommandés","Tous",...STATUTS].map(s=>(
              <button key={s} onClick={()=>{setProspectFiltre(s);setProspectInteretFiltre("");}}
                style={{flex:"none",padding:".3rem .65rem",fontSize:".64rem",fontWeight:600,borderRadius:20,border:`1px solid ${prospectFiltre===s?C.rose:C.pale}`,background:prospectFiltre===s?C.rose:C.blanc,color:prospectFiltre===s?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",whiteSpace:"nowrap"}}>
                {s}
              </button>
            ))}
          </div>

          <div style={{fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>{prospectsFiltres.length} prospect{prospectsFiltres.length>1?"s":""}{prospectFiltre!=="Tous"||prospectSearch?` (filtré${prospectsFiltres.length>1?"s":""})`:""}</div>
          {prospectsFiltres.map(p=>{
            const isToday = p.relance && p.relance<=todayStr;
            return(
            <div key={p.id} style={{background:isToday?"rgba(196,74,26,.06)":C.blanc,border:`1px solid ${isToday?"#C44B1A60":C.pale}`,borderRadius:10,padding:".7rem .9rem",marginBottom:".45rem"}}>
              <div style={{display:"flex",gap:".65rem",alignItems:"flex-start"}}>
                <div style={{flex:1}}>
                  <div style={{display:"flex",gap:".5rem",alignItems:"center",marginBottom:".2rem",flexWrap:"wrap"}}>
                    <div style={{fontSize:".82rem",fontWeight:600,color:C.brun}}>{p.name}</div>
                    {p.source==="recommandation"&&(
                      <span style={{fontSize:".58rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20,background:C.lilas+"20",color:C.lilas}}>🤝 Recommandé(e)</span>
                    )}
                    <select value={p.statut} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,statut:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:700,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${statusColor[p.statut]||C.pale}`,background:(statusColor[p.statut]||C.gris)+"20",color:statusColor[p.statut]||C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      {STATUTS.map(s=><option key={s}>{s}</option>)}
                    </select>
                    {isToday&&<span style={{fontSize:".58rem",fontWeight:700,color:"#C44B1A",background:"#C44B1A15",borderRadius:20,padding:".1rem .5rem"}}>📞 À recontacter</span>}
                    <select value={p.interet||""} onChange={e=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,interet:e.target.value}:x);
                      saveProspects(next);
                    }} style={{fontSize:".6rem",fontWeight:600,padding:".1rem .4rem",borderRadius:20,border:`1px solid ${p.interet?C.lilas:C.pale}`,background:p.interet?C.lilas+"15":"transparent",color:p.interet?C.lilas:C.gris,fontFamily:"inherit",cursor:"pointer",outline:"none"}}>
                      <option value="">❔ Non défini</option>
                      <option value="client">🛍️ Cliente</option>
                      <option value="distributeur">👑 Distributrice</option>
                    </select>
                  </div>
                  {p.note&&<div style={{fontSize:".7rem",color:C.gris,fontStyle:"italic"}}>{p.note}</div>}
                  <div style={{fontSize:".6rem",color:C.pale,marginTop:".15rem"}}>Ajouté le {p.date}</div>
                </div>
                <button onClick={()=>saveProspects(prospects.filter(x=>x.id!==p.id))}
                  style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
              </div>
              <div style={{display:"flex",alignItems:"center",gap:".4rem",marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                <span style={{fontSize:".62rem",color:C.gris}}>🔔 Relance :</span>
                <input type="date" value={p.relance||""} onChange={e=>{
                  const next=prospects.map(x=>x.id===p.id?{...x,relance:e.target.value}:x);
                  saveProspects(next);
                }} style={{border:`1px solid ${C.pale}`,borderRadius:6,padding:".25rem .4rem",fontSize:".68rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none"}}/>
                {p.relance&&(
                  <button onClick={()=>{
                    const next=prospects.map(x=>x.id===p.id?{...x,relance:""}:x);
                    saveProspects(next);
                  }} style={{background:"none",border:"none",color:C.gris,cursor:"pointer",fontSize:".62rem",fontFamily:"inherit",textDecoration:"underline"}}>
                    effacer
                  </button>
                )}
              </div>

              {/* Journal conversation */}
              <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:"1px solid #E8DDD4"}}>
                <div style={{display:"flex",justifyContent:"space-between",alignItems:"center",marginBottom:".3rem"}}>
                  <div style={{fontSize:".6rem",fontWeight:700,color:"#3D1F0E",textTransform:"uppercase",letterSpacing:".08em"}}>Journal</div>
                  <button onClick={()=>{const msg=prompt("Message envoyé ou reçu");if(!msg)return;const j=[...(p.journal||[]),{date:new Date().toLocaleDateString("fr-FR"),msg}];saveProspects(prospects.map(x=>x.id===p.id?{...x,journal:j}:x));}} style={{background:"none",border:"1px solid #E8DDD4",borderRadius:6,padding:".15rem .45rem",fontSize:".62rem",color:"#888",cursor:"pointer",fontFamily:"inherit"}}>+ Ajouter</button>
                </div>
                {(p.journal||[]).length===0?<div style={{fontSize:".65rem",color:"#888",fontStyle:"italic"}}>Aucun echange</div>:(p.journal||[]).slice(-3).reverse().map((e,i)=>(<div key={i} style={{display:"flex",gap:".4rem",marginBottom:".2rem"}}><span style={{fontSize:".6rem",color:"#888",flexShrink:0}}>{e.date}</span><span style={{fontSize:".7rem",color:"#3D2B1F"}}>{e.msg}</span></div>))}
              </div>

              {/* Bouton conversion si statut Converti */}
              {p.statut==="✅ Converti"&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                  <button onClick={()=>{
                    saveProspects(prospects.filter(x=>x.id!==p.id));
                    setConversionPopup({prospect:p, vers:null});
                  }}
                    style={{width:"100%",background:`linear-gradient(135deg,${C.vert},#4a9a5a)`,color:"white",border:"none",borderRadius:9,padding:".5rem",fontSize:".76rem",fontWeight:700,fontFamily:"inherit",cursor:"pointer",display:"flex",alignItems:"center",justifyContent:"center",gap:".4rem"}}>
                    ✅ Convertir et transférer →
                  </button>
                </div>
              )}

              {/* Boutons conversion rapide pour diagnostics et recommandations */}
              {(p.source==="diagnostic"||p.source==="recommandation")&&p.statut!=="✅ Converti"&&!p.convertiVers&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`}}>
                  <div style={{fontSize:".58rem",color:C.gris,marginBottom:".3rem",fontWeight:600}}>
                    {p.source==="diagnostic"?"🔬 Issu d'un diagnostic":"🤝 Issu d'une recommandation"} — Marquer la conversion :
                  </div>
                  <div style={{display:"flex",gap:".3rem"}}>
                    <button onClick={()=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:"client",statut:"✅ Converti",dateConversion:todayLocalStr()}:x);
                      saveProspects(next);
                    }}
                      style={{flex:1,background:C.vert+"20",border:`1px solid ${C.vert}`,borderRadius:8,padding:".35rem",fontSize:".66rem",fontWeight:700,color:C.vert,cursor:"pointer",fontFamily:"inherit"}}>
                      🛍️ Convertie en cliente
                    </button>
                    <button onClick={()=>{
                      const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:"distributrice",statut:"✅ Converti",dateConversion:todayLocalStr()}:x);
                      saveProspects(next);
                    }}
                      style={{flex:1,background:C.or+"20",border:`1px solid ${C.or}`,borderRadius:8,padding:".35rem",fontSize:".66rem",fontWeight:700,color:C.or,cursor:"pointer",fontFamily:"inherit"}}>
                      👑 Convertie en distributrice
                    </button>
                  </div>
                </div>
              )}

              {/* Badge conversion réussie */}
              {p.convertiVers&&(
                <div style={{marginTop:".5rem",paddingTop:".5rem",borderTop:`1px solid ${C.pale}`,display:"flex",alignItems:"center",gap:".4rem"}}>
                  <span style={{fontSize:".65rem",fontWeight:700,color:p.convertiVers==="client"?C.vert:C.or,background:(p.convertiVers==="client"?C.vert:C.or)+"20",borderRadius:20,padding:".2rem .55rem"}}>
                    {p.convertiVers==="client"?"✅ Convertie en cliente":"✅ Convertie en distributrice"}
                  </span>
                  {p.dateConversion&&<span style={{fontSize:".58rem",color:C.gris}}>le {new Date(p.dateConversion).toLocaleDateString("fr-FR")}</span>}
                  <button onClick={()=>{
                    const next=prospects.map(x=>x.id===p.id?{...x,convertiVers:undefined,statut:"Nouveau",dateConversion:undefined}:x);
                    saveProspects(next);
                  }} style={{marginLeft:"auto",background:"none",border:"none",fontSize:".58rem",color:C.gris,cursor:"pointer",fontFamily:"inherit",textDecoration:"underline"}}>annuler</button>
                </div>
              )}
            </div>
          );})}
          {prospectsFiltres.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>{prospects.length===0?<>Aucun prospect pour l'instant.<br/>Ajoute ta 1ʳᵉ personne ci-dessus.</>:"Aucun prospect ne correspond à ta recherche/filtre."}</div>}
          </div>
          )}
        </div>
      )}

      {/* PRODUITS */}
      {/* Suppression onglet Produits — remplacé par IA Conseillère */}

      {/* CLIENTS (+ sous-onglet Objections) */}
      {dtab==="clients"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="clients" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["clients"]||""}/>}
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setClientsSubTab("clients")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="clients"?C.rose:C.pale}`,background:clientsSubTab==="clients"?C.rose:C.blanc,color:clientsSubTab==="clients"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🛍️ Clients
            </button>
            <button onClick={()=>setClientsSubTab("relance")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="relance"?"#5B8DB8":C.pale}`,background:clientsSubTab==="relance"?"#5B8DB8":C.blanc,color:clientsSubTab==="relance"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ❄️ Relance
            </button>
            <button onClick={()=>setClientsSubTab("objections")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${clientsSubTab==="objections"?C.rose:C.pale}`,background:clientsSubTab==="objections"?C.rose:C.blanc,color:clientsSubTab==="objections"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              💬 Objections
            </button>
          </div>
          {clientsSubTab==="clients"&&<ClientsTab clients={clients} save={saveClients} uid={uid}/>}
          {clientsSubTab==="relance"&&<ClientsRelanceTab clients={clients} save={saveClients} uid={uid}/>}
          {clientsSubTab==="objections"&&<ObjectionsTab/>}
        </div>
      )}
      {dtab==="objperso"&&(
        <div>
          <ObjPersoTab obj={objPerso} save={saveObjPerso} uid={uid} userName={userName} distributeurs={distributeurs}/>
        </div>
      )}

      {/* ÉQUIPE - GAMIFICATION */}
      {dtab==="equipe-fun"&&(
        <div>
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setEquipeFunTab("wall")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="wall"?C.rose:C.pale}`,background:equipeFunTab==="wall"?C.rose:C.blanc,color:equipeFunTab==="wall"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              🌟 Wall of Fame
            </button>
            <button onClick={()=>setEquipeFunTab("defi")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="defi"?C.rose:C.pale}`,background:equipeFunTab==="defi"?C.rose:C.blanc,color:equipeFunTab==="defi"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ⚡ Challenge Flash
            </button>
            <button onClick={()=>setEquipeFunTab("powerhour")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${equipeFunTab==="powerhour"?C.rose:C.pale}`,background:equipeFunTab==="powerhour"?C.rose:C.blanc,color:equipeFunTab==="powerhour"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              ⏱️ Power Hour
            </button>
          </div>
          {equipeFunTab==="wall"&&<WallOfFameTab uid={uid} userName={userName}/>}
          {equipeFunTab==="defi"&&<DefisTab uid={uid} userName={userName} canCreate={true} isChef={isChefDash}/>}
          {equipeFunTab==="powerhour"&&<PowerHourTab uid={uid} userName={userName} canCreate={isChefDash||uid===MELISSA||uid==="melissa-da-silveira"}/>}
        </div>
      )}
      {dtab==="editorial"&&<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="editorial" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["editorial"]||""}/>}<EditorialTab uid={uid} userName={userName}/></div>}
      {dtab==="relances"&&<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)",display:"flex",alignItems:"center",gap:".35rem"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="relances" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["relances"]||""}/>}<RelancesTab prospects={prospects} clients={clients} saveProspects={saveProspects} saveClients={saveClients}/></div>}
      {dtab==="business"&&(<div><div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="business" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["business"]||""}/>}<div style={{display:"flex",gap:".3rem",marginBottom:"1rem",overflowX:"auto"}}>{[{id:"suivica",label:"CA"},{id:"entonnoir",label:"Entonnoir"},{id:"historique",label:"Historique"}].map(t=>(<button key={t.id} onClick={()=>setBtab(t.id)} style={{flex:"none",padding:".4rem .85rem",fontSize:".7rem",fontWeight:600,borderRadius:20,border:"1.5px solid "+(btab===t.id?"#C49A8A":"#E8DDD4"),background:btab===t.id?"#C49A8A":"white",color:btab===t.id?"white":"#888",cursor:"pointer",fontFamily:"inherit"}}>{t.label}</button>))}</div>{btab==="suivica"&&<SuiviCATab uid={uid}/>}
          {btab==="entonnoir"&&<div><div style={{background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem",border:"1px solid #E8DDD4",fontSize:".7rem",color:"#3D1F0E",lineHeight:1.6}}><strong>Comment lire l entonnoir ?</strong><br/>Les barres montrent combien de personnes passent d une etape a l autre. P vers C = % de prospects devenus clientes. C vers D = % de clientes qui ont rejoint l equipe. Plus ces taux sont eleves, meilleure est ta conversion.</div><EntonnoirTab prospects={prospects} clients={clients} distributeurs={distributeurs}/></div>}
          {btab==="historique"&&<div><div style={{background:"#FAF7F2",borderRadius:10,padding:".65rem .85rem",marginBottom:"1rem",border:"1px solid #E8DDD4",fontSize:".7rem",color:"#3D1F0E",lineHeight:1.6}}><strong>Comment lire l historique ?</strong><br/>Chaque barre = une periode de 21 jours. La barre la plus longue = ta meilleure periode. Clique sur une periode pour voir le detail des commandes. Si la periode affichee ne correspond pas (ex: P9 au lieu de P8), corrige la date dans Admin - Configuration des Periodes.</div><HistoriquePeriodes uid={uid}/></div>}</div>)}
      {dtab==="diagnostics"&&<DiagResultsTab uid={uid}/>}

      {/* DISTRIBUTEURS (+ sous-onglet Nouveaux Distributeurs) */}
      {dtab==="distributeurs"&&(
        <div>
          <div style={{display:"flex",justifyContent:"flex-end",marginBottom:".6rem"}}><button onClick={()=>setShowNotice(true)} style={{background:"#C49A8A",color:"white",border:"none",borderRadius:20,padding:".35rem 1rem",fontSize:".75rem",fontWeight:700,cursor:"pointer",fontFamily:"inherit",boxShadow:"0 2px 8px rgba(196,154,138,.4)"}}>❓ Guide</button></div>{showNotice&&<NoticePanel cleOutil="distributeurs" onClose={()=>setShowNotice(false)} videoUrl={noticeVideos["distributeurs"]||""}/>}
          <div style={{display:"flex",gap:".3rem",marginBottom:"1rem"}}>
            <button onClick={()=>setDistriSubTab("distributeurs")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="distributeurs"?C.rose:C.pale}`,background:distriSubTab==="distributeurs"?C.rose:C.blanc,color:distriSubTab==="distributeurs"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              👑 Distributeurs
            </button>
            <button onClick={()=>setDistriSubTab("nouveaux")}
              style={{flex:1,padding:".5rem",fontSize:".72rem",fontWeight:600,borderRadius:10,border:`1px solid ${distriSubTab==="nouveaux"?C.rose:C.pale}`,background:distriSubTab==="nouveaux"?C.rose:C.blanc,color:distriSubTab==="nouveaux"?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit"}}>
              📋 Nouveaux Distri
            </button>
          </div>
          {distriSubTab==="distributeurs"&&<DistributeursTab distributeurs={distributeurs} save={saveDistributeurs} uid={uid}/>}
          {distriSubTab==="nouveaux"&&<SuiviRecruTab uid={uid} isChef={isChef}/>}
        </div>
      )}

      {/* POSTS */}
      {dtab==="posts_disabled"&&(
        <div>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>➕ Planifier un contenu</div>
            <div style={{display:"flex",gap:".5rem",marginBottom:".45rem"}}>
              {["Post","Story","Reel","Live"].map(t=>(
                <button key={t} onClick={()=>setNewPost(p=>({...p,type:t}))}
                  style={{flex:1,padding:".4rem",fontSize:".7rem",fontWeight:600,borderRadius:8,border:`1px solid ${newPost.type===t?C.rose:C.pale}`,background:newPost.type===t?C.rose:C.blanc,color:newPost.type===t?C.blanc:C.gris,cursor:"pointer",fontFamily:"inherit",transition:"all .2s"}}>
                  {t}
                </button>
              ))}
            </div>
            <input placeholder="Sujet / hook (ex: routine visage à 25€)" value={newPost.sujet} onChange={e=>setNewPost(p=>({...p,sujet:e.target.value}))}
              style={{width:"100%",border:`1px solid ${C.pale}`,borderRadius:8,padding:".45rem .7rem",fontSize:".8rem",fontFamily:"inherit",color:C.texte,background:C.creme,outline:"none",marginBottom:".65rem"}}/>
            <button onClick={()=>{
              if(!newPost.sujet.trim())return;
              const next=[{...newPost,id:Date.now(),date:new Date().toLocaleDateString("fr-FR"),fait:false},...posts];
              savePosts(next);setNewPost(p=>({...p,sujet:""}));
            }} style={{width:"100%",background:C.brun,color:C.blanc,border:"none",borderRadius:8,padding:".55rem",fontSize:".8rem",fontWeight:600,fontFamily:"inherit",cursor:"pointer"}}>
              Ajouter au planning
            </button>
          </div>

          <div style={{display:"flex",justifyContent:"space-between",fontSize:".62rem",color:C.gris,marginBottom:".5rem"}}>
            <span>{posts.length} contenu{posts.length>1?"s":""} planifié{posts.length>1?"s":""}</span>
            <span style={{color:C.vert}}>{posts.filter(p=>p.fait).length} publié{posts.filter(p=>p.fait).length>1?"s":""}</span>
          </div>
          {posts.map(p=>(
            <div key={p.id} style={{background:p.fait?C.pale+"60":C.blanc,border:`1px solid ${p.fait?C.rose:C.pale}`,borderRadius:10,padding:".65rem .9rem",marginBottom:".4rem",display:"flex",gap:".6rem",alignItems:"center"}}>
              <div onClick={()=>savePosts(posts.map(x=>x.id===p.id?{...x,fait:!x.fait}:x))}
                style={{width:18,height:18,borderRadius:4,border:`2px solid ${p.fait?C.rose:C.pale}`,background:p.fait?C.rose:"transparent",flexShrink:0,display:"flex",alignItems:"center",justifyContent:"center",cursor:"pointer",transition:"all .15s"}}>
                {p.fait&&<span style={{fontSize:".55rem",color:"white",fontWeight:700}}>✓</span>}
              </div>
              <div style={{flex:1}}>
                <div style={{display:"flex",gap:".4rem",alignItems:"center"}}>
                  <span style={{fontSize:".58rem",fontWeight:700,background:C.rose+"20",color:C.rose,padding:".1rem .35rem",borderRadius:10}}>{p.type}</span>
                  <div style={{fontSize:".77rem",fontWeight:600,color:p.fait?C.gris:C.brun,textDecoration:p.fait?"line-through":"none"}}>{p.sujet}</div>
                </div>
                <div style={{fontSize:".6rem",color:C.pale,marginTop:".1rem"}}>{p.date}</div>
              </div>
              <button onClick={()=>savePosts(posts.filter(x=>x.id!==p.id))}
                style={{background:"none",border:"none",color:C.pale,cursor:"pointer",fontSize:".8rem",flexShrink:0,padding:".2rem"}}>✕</button>
            </div>
          ))}
          {posts.length===0&&<div style={{textAlign:"center",padding:"2rem",color:C.gris,fontSize:".78rem"}}>Aucun contenu planifié.<br/>Ajoute ton prochain post ci-dessus.</div>}
        </div>
      )}

      {/* STATS */}
      {dtab==="stats"&&(
        <div>
          <button onClick={()=>setDtab("objperso")}
            style={{background:"none",border:"none",color:C.rose,fontSize:".75rem",fontWeight:600,cursor:"pointer",fontFamily:"inherit",padding:".2rem",marginBottom:".75rem"}}>
            ← Retour à Mes Objectifs
          </button>
          <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem",marginBottom:"1rem"}}>
            <div style={{fontSize:".62rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:C.rose,marginBottom:".65rem"}}>🎯 Mon objectif du mois</div>
            <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
              <input type="number" min="1" value={stats.objectif} onChange={e=>saveStats({...stats,objectif:e.target.value})}
                style={{width:55,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:C.brun,border:`1px solid ${C.pale}`,borderRadius:8,textAlign:"center",outline:"none",background:C.creme,padding:".2rem"}}/>
              <div style={{fontSize:".78rem",color:C.gris}}>nouvelle{+stats.objectif>1?"s":""} recrue{+stats.objectif>1?"s":""} ce mois</div>
            </div>
          </div>

          <div style={{display:"grid",gridTemplateColumns:"1fr 1fr",gap:".55rem",marginBottom:"1rem"}}>
            {[
              ["messages","Messages envoyés",C.lilas],
              ["reponses","Réponses reçues",C.or],
              ["presentations","Présentations",C.rose],
              ["ventes","Ventes",C.vert],
              ["recrues","Nouvelles recrues",C.brun],
            ].map(([k,l,col])=>(
              <div key={k} style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".7rem",textAlign:"center",gridColumn:k==="recrues"?"1 / -1":"auto"}}>
                <input type="number" min="0" value={stats[k]||""} placeholder="0" onChange={e=>saveStats({...stats,[k]:e.target.value})}
                  style={{width:60,fontFamily:"Georgia,serif",fontSize:"1.8rem",fontWeight:600,color:col,border:"none",background:"none",textAlign:"center",outline:"none"}}/>
                <div style={{fontSize:".62rem",color:C.gris,marginTop:".15rem"}}>{l}</div>
              </div>
            ))}
          </div>

          <div style={{background:`linear-gradient(135deg,rgba(196,154,138,.1),rgba(168,155,181,.07))`,border:`1px solid ${C.pale}`,borderRadius:10,padding:".85rem 1rem",marginBottom:"1rem",fontSize:".74rem",color:C.texte,lineHeight:1.65}}>
            📐 <strong>Ratio cible :</strong> 10 messages → 5 réponses → 3 présentations → 1 recrue.<br/>
            Volume insuffisant → plus de contacts. Réponses mais pas de recrues → retravailler le pitch.
          </div>

          {/* Progress bar objectif */}
          {stats.recrues&&stats.objectif&&(
            <div style={{background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:"1rem"}}>
              <div style={{display:"flex",justifyContent:"space-between",fontSize:".7rem",color:C.gris,marginBottom:".4rem"}}>
                <span>Progression vers l'objectif</span>
                <span style={{fontWeight:700,color:+stats.recrues>=+stats.objectif?C.vert:C.rose}}>{stats.recrues} / {stats.objectif}</span>
              </div>
              <div style={{height:8,background:C.pale,borderRadius:10,overflow:"hidden"}}>
                <div style={{height:"100%",background:+stats.recrues>=+stats.objectif?C.vert:C.rose,width:Math.min(100,Math.round(+stats.recrues/+stats.objectif*100))+"%",borderRadius:10,transition:"width .4s"}}/>
              </div>
              {+stats.recrues>=+stats.objectif&&<div style={{textAlign:"center",fontSize:".75rem",color:C.vert,fontWeight:700,marginTop:".5rem"}}>🎉 Objectif atteint !</div>}
            </div>
          )}
        </div>
      )}
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
  const gamme=(TYPE_TO_GAMME[ligne.typeProduit])||'entretien';const template=SCRIPTS_RELANCE_GAMME[gamme]||SCRIPTS_RELANCE_GAMME.entretien;return template.replace(/{produit}/g,ligne.nom).replace(/{prenom}/g,prenomClient||'toi');}
export { CopyBtn, SuiviRecruTab, DashboardTab, ConversionPopup, NoticePanel, HistoriquePeriodes, getCitationDuJour, getProgress, CHALLENGE_APP_JOURS, CITATIONS_DEFAULT, TYPE_TO_GAMME, SCRIPTS_RELANCE_GAMME, genererScriptRelance };
