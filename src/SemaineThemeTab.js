import React, { useState, useEffect } from 'react';
import { doc, getDoc, setDoc } from 'firebase/firestore';
import { db } from './firebase';
import { C } from './constants';
import { ss, sg } from './utils';
import { DecouverteTour } from './App';

// ═══════════════════════════════════════════════════════════════
//  SEMAINE A THEME — 24 themes pre-remplis, 7 angles chacun
//  Prolongement direct de la formation "Arrete de vouloir tout vendre"
// ═══════════════════════════════════════════════════════════════

export const ANGLES_LABELS = [
  { n: 1, ic: "🎯", t: "Le problème", aide: "Tu ouvres par la sensation, jamais par le nom du produit." },
  { n: 2, ic: "🎬", t: "Ta routine filmée", aide: "Le vrai geste, la vraie texture, la quantité réelle." },
  { n: 3, ic: "💶", t: "Le prix au litre", aide: "Ramène à la dose et compare. Le chiffre fait le travail." },
  { n: 4, ic: "🚫", t: "Pour qui ce n'est pas", aide: "L'angle honnête — celui qui crédibilise les six autres." },
  { n: 5, ic: "💬", t: "Le retour cliente", aide: "Avec son accord. Un message brut vaut mieux qu'un témoignage reformulé." },
  { n: 6, ic: "😬", t: "L'objection frontale", aide: "Tu dis toi-même ce qu'on pense tout bas." },
  { n: 7, ic: "⏳", t: "Le rappel de fin", aide: "Urgence honnête uniquement. Pas de faux compte à rebours." },
];

export const FAMILLES = [
  { id: "skincare", label: "✨ Skincare visage", col: "#C4788C" },
  { id: "corps", label: "🧴 Peau du corps", col: "#9B8AA6" },
  { id: "cheveux", label: "💇 Cheveux", col: "#8B5E00" },
  { id: "poids", label: "⚖️ Poids & bien-être", col: "#5E8B5E" },
  { id: "maison", label: "🏠 Maison & entretien", col: "#4A8FA6" },
  { id: "autres", label: "⚡ Énergie · Beauté · Parfum", col: "#C4788C" },
];

export const THEMES_SEMAINE = [

  // ─────────── SKINCARE VISAGE ───────────
  {
    id: "teint-terne", fam: "skincare", icon: "😩",
    titre: "J'ai une sale tête ce matin",
    sous: "Teint terne, mine fatiguée",
    qui: "Celle qui dort mal, qui enchaîne les journées, et qui trouve que son teint ne suit plus. Elle ne cherche pas un sérum — elle cherche à ne plus avoir l'air épuisée sur les photos.",
    produits: ["Sérum éclat", "Crème hydratante jour", "Masque coup d'éclat"],
    diag: "✨ Skincare",
    angles: [
      "Ce moment où tu te regardes le matin et où tu te dis « j'ai une sale tête ». Pas fatiguée. Pas malade. Juste… terne. Vous voyez de quoi je parle ?",
      "Ma routine du matin en 40 secondes. Trois gestes, pas dix. Je vous montre la quantité exacte que je mets — la plupart des gens en mettent beaucoup trop.",
      "Ce flacon fait 30 ml et me dure 2 mois. Ça revient à moins que mon café du matin par jour. J'ai comparé avec ce que j'achetais avant en parapharmacie : c'était trois fois ça.",
      "Si tu cherches un truc qui te change le teint en une nuit, passe ton chemin. Ça ne marche pas comme ça. Moi j'ai vu la différence à la 3e semaine — et c'est justement pour ça que j'y crois.",
      "Une cliente m'a écrit ça hier matin. Je vous la partage avec son accord, sans rien changer. C'est ce genre de message qui me fait aimer ce que je fais.",
      "Oui, c'est une marque que tu ne connais pas. Parlons-en franchement : voilà ce qu'il y a dedans, voilà d'où ça vient, et voilà pourquoi je l'utilise moi-même tous les jours.",
      "Dernière semaine sur ce produit avant que je passe à autre chose. Si tu hésitais, c'est le moment — après je ne reviens pas dessus avant un moment.",
    ],
  },
  {
    id: "peau-brille", fam: "skincare", icon: "✨",
    titre: "Ma peau brille dès midi",
    sous: "Peau mixte à grasse, zone T",
    qui: "Celle qui se remaquille à midi, qui a des papiers matifiants dans son sac, et qui a compris trop tard qu'assécher sa peau la fait briller encore plus.",
    produits: ["Soin matifiant", "Nettoyant doux", "Sérum régulateur"],
    diag: "✨ Skincare",
    angles: [
      "Il est midi, tu passes devant une vitrine, et là : la zone T qui brille. Tu attrapes un mouchoir. Et à 16h tu recommences. Ça vous parle ?",
      "Le geste que je faisais mal pendant des années : je nettoyais trop fort en pensant bien faire. Je vous montre ce que je fais maintenant, matin et soir.",
      "50 ml qui durent 10 semaines. Fais le calcul à la dose : on est en dessous de ce que coûte une boîte de papiers matifiants sur la même période.",
      "Si ta peau est sèche et tiraille, ce produit n'est pas pour toi — tu vas la déshydrater. Je préfère te le dire que de te vendre quelque chose qui ne t'ira pas.",
      "Ce message d'une cliente qui a arrêté de se remaquiller le midi. Trois semaines. Elle m'a autorisée à le partager.",
      "« Encore un produit qui promet de matifier. » Je comprends, j'en ai testé cinq avant. La différence ici c'est qu'il régule au lieu d'assécher — et c'est toute la nuance.",
      "Je clôture ce produit cette semaine. La promo se termine avec le catalogue en cours, je préfère vous prévenir maintenant plutôt qu'au dernier moment.",
    ],
  },
  {
    id: "premieres-rides", fam: "skincare", icon: "🕐",
    titre: "Mes traits commencent à se marquer",
    sous: "Premières ridules, perte de fermeté",
    qui: "Celle qui remarque que ses traits restent marqués le matin. Elle n'a pas peur de vieillir — elle veut juste que son visage reflète comment elle se sent.",
    produits: ["Sérum anti-âge", "Crème riche nuit", "Contour des yeux"],
    diag: "✨ Skincare",
    angles: [
      "Tu te réveilles, et la marque de l'oreiller met une heure à partir. Avant elle partait en dix minutes. C'est là que j'ai compris qu'il fallait que je m'y mette.",
      "Mon geste du soir, filmé sans montage. Le sens d'application compte plus que le produit — je vous montre.",
      "Un flacon de 30 ml pour 3 mois d'utilisation. Ramené à la dose quotidienne, c'est sous la barre de ce que je mettais avant dans une crème de supermarché.",
      "Si tu attends de retrouver ton visage de tes 25 ans, ce produit va te décevoir. Ce n'est pas ce qu'il fait, et aucune crème ne le fait. Ce qu'il fait, c'est ralentir et hydrater en profondeur.",
      "Un retour reçu ce matin. Je le partage tel quel, avec son accord — vous verrez, elle est très honnête sur ce qui a changé et ce qui n'a pas changé.",
      "Oui, tu ne connais pas la marque. Et oui, tu as sûrement déjà été déçue par une crème anti-âge. Moi aussi. Voilà pourquoi celle-là est différente, concrètement.",
      "Fin de période sur ce produit. C'est ma dernière publication dessus — je passe à autre chose la semaine prochaine.",
    ],
  },
  {
    id: "imperfections", fam: "skincare", icon: "😖",
    titre: "J'ai encore des boutons à 35 ans",
    sous: "Imperfections adulte, points noirs",
    qui: "Celle à qui on avait promis que ça passerait après l'adolescence. Elle est fatiguée des produits agressifs qui décapent et empirent tout.",
    produits: ["Soin purifiant", "Gel nettoyant", "Masque argile"],
    diag: "✨ Skincare",
    angles: [
      "On m'avait dit que ça passerait après 20 ans. J'en ai 35 et j'ai encore des boutons avant mes règles. Personne n'en parle et pourtant on est nombreuses.",
      "Ce que j'ai arrêté de faire : décaper. Ce que je fais maintenant : je vous montre en une minute, c'est beaucoup plus doux que ce que vous imaginez.",
      "Le tube dure 8 semaines à raison d'un usage par jour. Compare au prix d'un seul rendez-vous chez l'esthéticienne — la différence est parlante.",
      "Si tu as une acné sévère ou inflammatoire, ce produit ne suffira pas et je ne vais pas te dire le contraire. Va voir un dermato. Ça, c'est pour les imperfections occasionnelles.",
      "Une cliente m'a envoyé ça après 4 semaines. Elle précise elle-même que tout n'a pas disparu — c'est ce qui rend son message crédible.",
      "« C'est encore un produit miracle contre l'acné ? » Non. Aucun produit ne l'est. Celui-là purifie sans agresser, et c'est déjà beaucoup quand on a testé les décapants.",
      "Dernier post sur ce produit avant la fin de période. Si tu voulais le tester avec l'offre en cours, c'est cette semaine.",
    ],
  },
  {
    id: "peau-sensible", fam: "skincare", icon: "🌡️",
    titre: "Ma peau réagit à tout",
    sous: "Sensibilité, rougeurs, inconfort",
    qui: "Celle qui a peur d'essayer un nouveau produit. Elle a une liste de choses qui l'ont fait réagir et elle lit les compositions avant d'acheter.",
    produits: ["Soin apaisant", "Nettoyant sans savon", "Crème barrière"],
    diag: "✨ Skincare",
    angles: [
      "Tu essaies un nouveau produit, et le lendemain : plaques, tiraillements, chaleur. Du coup tu n'oses plus rien tester. Je connais très bien ce cercle-là.",
      "Le test que je fais systématiquement avant d'adopter un produit — pli du coude, 48 h. Je vous montre, ça prend deux minutes et ça évite bien des galères.",
      "Le format dure longtemps parce qu'on en met peu. Sur trois mois, le coût par jour est dérisoire comparé à ce que tu perds en produits que tu ne peux pas finir.",
      "Si ta peau supporte tout, tu n'as pas besoin de ce produit — prends quelque chose de plus actif, tu auras plus de résultat. Celui-là est pensé pour les peaux qui réagissent.",
      "Ce message d'une cliente qui n'osait plus rien acheter. Partagé avec son accord — c'est exactement le profil dont je parle.",
      "Tu vas me dire : « ils disent tous que c'est hypoallergénique ». Vrai. Alors voilà la composition complète, je vous laisse juger vous-mêmes.",
      "Fin de période, dernier rappel sur ce soin. Je passe à un autre thème lundi.",
    ],
  },
  {
    id: "cernes", fam: "skincare", icon: "👁️",
    titre: "Mes cernes me font 10 ans de plus",
    sous: "Contour des yeux, poches, fatigue",
    qui: "Celle qui met du correcteur tous les matins et qui trouve que ça marque encore plus dans les plis. Souvent maman de jeunes enfants.",
    produits: ["Contour des yeux", "Patchs", "Sérum défatigant"],
    diag: "✨ Skincare",
    angles: [
      "Tu mets ton correcteur, et deux heures après il s'est logé dans les petits plis sous l'œil. Résultat : tu as l'air plus fatiguée qu'avant de te maquiller.",
      "Le geste que 90 % des gens font mal sur le contour des yeux : l'annulaire, en tapotant, jamais en frottant. Je vous montre.",
      "15 ml, mais on en utilise l'équivalent d'un grain de riz par œil. Ça dure 4 mois. À la dose, c'est quelques centimes par jour.",
      "Si tes cernes sont creusés et génétiques, aucune crème ne les comblera — c'est de l'acide hyaluronique en cabinet qu'il te faut. Là, on parle de cernes de fatigue.",
      "Le message d'une cliente maman de deux enfants en bas âge. Elle ne dit pas que ses cernes ont disparu — elle dit autre chose, et c'est plus intéressant.",
      "Oui, c'est une marque que tu ne connais pas, et oui le contour des yeux est le rayon où on se fait le plus avoir. Voilà pourquoi j'ai choisi celui-là et pas un autre.",
      "Dernière semaine sur ce produit. Après je change de thème — profitez de l'offre en cours si ça vous tente.",
    ],
  },

  // ─────────── PEAU DU CORPS ───────────
  {
    id: "peau-tire", fam: "corps", icon: "💧",
    titre: "Ma peau tire après la douche",
    sous: "Déshydratation, inconfort",
    qui: "Celle qui sort de la douche et doit se remettre de la crème tout de suite sinon ça gratte. Elle pense que c'est juste sa peau, alors que c'est souvent son gel douche.",
    produits: ["Lait corps", "Huile sèche", "Gel douche surgras"],
    diag: "🧴 Peau Corps",
    angles: [
      "Ta peau tire après la douche ? Ce n'est pas ta peau le problème. C'est ce que tu mets dessus pendant la douche. Je vous explique.",
      "Le bon moment pour appliquer sa crème corps : peau encore humide, dans les 3 minutes. Je vous montre — ça change tout et ça ne coûte rien.",
      "400 ml pour 3 mois d'utilisation quotidienne sur tout le corps. Compare au litre avec ta marque habituelle de parapharmacie, tu vas être surprise.",
      "Si tu cherches un parfum qui tient toute la journée, ce n'est pas ça. C'est un soin, pas un parfum. L'odeur s'estompe en une heure — et c'est voulu.",
      "Ce retour d'une cliente qui avait des démangeaisons tous les hivers. Partagé avec son accord.",
      "« Une crème corps c'est une crème corps. » C'est ce que je pensais aussi. Puis j'ai regardé la liste INCI des deux côte à côte. Je vous montre la différence.",
      "Fin de période sur ce produit. Dernier rappel avant que je passe à autre chose lundi.",
    ],
  },
  {
    id: "mains", fam: "corps", icon: "🤲",
    titre: "Mes mains sont détruites",
    sous: "Mains sèches, gerçures, ongles cassants",
    qui: "Infirmière, coiffeuse, aide-soignante, maman qui lave les mains vingt fois par jour. Ses mains la vieillissent et elle le sait.",
    produits: ["Crème mains réparatrice", "Huile ongles", "Baume nuit"],
    diag: "🧴 Peau Corps",
    angles: [
      "On dit que les mains trahissent l'âge. Moi je dis qu'elles trahissent surtout le métier. Si tu te laves les mains vingt fois par jour, ce post est pour toi.",
      "Mon rituel du soir pour les mains — 30 secondes avant de dormir. La nuit c'est là que ça répare le mieux, je vous montre pourquoi.",
      "75 ml qui tiennent 2 mois même en usage intensif. Ramené à la journée, c'est moins que le prix d'un paquet de mouchoirs.",
      "Si tu cherches une texture ultra légère qui pénètre en 2 secondes, ce n'est pas ça. Celle-là est riche, elle met un peu de temps. C'est le prix de l'efficacité.",
      "Ce message d'une cliente infirmière. Je vous le laisse tel quel — elle est très concrète sur son quotidien.",
      "Oui, tu as déjà dix crèmes mains entamées dans ta maison. Moi aussi j'en avais. La question n'est pas d'en avoir une de plus, c'est d'en avoir une que tu finis.",
      "Dernière publication sur ce produit avant la fin de période.",
    ],
  },
  {
    id: "fermete", fam: "corps", icon: "🍊",
    titre: "Je me sens moins ferme qu'avant",
    sous: "Fermeté, grain de peau",
    qui: "Celle qui a perdu du poids, qui a eu des enfants, ou qui a simplement passé un cap. Elle veut se sentir bien dans son corps, pas ressembler à une photo retouchée.",
    produits: ["Soin fermeté", "Gommage corps", "Huile tonifiante"],
    diag: "🧴 Peau Corps",
    angles: [
      "Il y a un moment où on se regarde et où on se dit « tiens, ça a changé ». Pas en mal. Juste : ça a changé. Et on a le droit d'avoir envie de s'en occuper.",
      "Le geste qui compte le plus ici, ce n'est pas le produit : c'est le massage. Je vous montre le mouvement, il prend une minute par jambe.",
      "200 ml pour 6 semaines en usage quotidien sur les zones ciblées. Le calcul au litre reste très en dessous des marques que tu vois en pub.",
      "Soyons claires : aucun soin ne remplace le sport ni ne fait disparaître la cellulite. Ce que ça fait, c'est hydrater en profondeur et améliorer le grain de peau. C'est déjà bien.",
      "Le retour d'une cliente, 8 semaines d'utilisation. Elle est très mesurée dans ce qu'elle dit — c'est ce qui me plaît dans son message.",
      "« Les soins fermeté, ça ne marche pas. » Sur la promesse qu'on leur prête, non. Sur ce qu'ils font vraiment, oui. Je vous explique la différence.",
      "Fin de période. Dernier post sur ce produit, je change de thème lundi.",
    ],
  },
  {
    id: "jambes-lourdes", fam: "corps", icon: "🦵",
    titre: "J'ai les jambes lourdes le soir",
    sous: "Confort circulatoire, sensation de jambes lourdes",
    qui: "Celle qui est debout toute la journée, ou assise sans bouger. Le soir elle enlève ses chaussures et ses chevilles ont doublé.",
    produits: ["Gel jambes légères", "Huile de massage", "Complément circulation"],
    diag: "🧴 Peau Corps",
    angles: [
      "20 h, tu enlèves tes chaussures, et tu vois la marque de la chaussette imprimée sur ta cheville. Si tu bosses debout ou assise sans bouger, tu connais.",
      "Le geste : toujours de la cheville vers le genou, jamais l'inverse. Je vous montre. Et le petit plus qui change tout : garder le gel au frigo.",
      "150 ml pour 5 semaines. Sur la saison chaude, c'est quelques centimes par soir pour rentrer chez soi sans avoir envie de se couper les jambes.",
      "Si tu as des varices installées ou une insuffisance veineuse diagnostiquée, va voir ton médecin — un gel ne remplacera jamais un traitement ni des bas de contention.",
      "Ce message d'une cliente serveuse. Elle décrit très bien la différence sur la fin de service.",
      "Oui, l'effet frais ne dure qu'un moment. C'est normal, et ce n'est pas là que se joue l'intérêt du produit. Je vous explique ce qui compte vraiment.",
      "Dernière semaine sur ce produit avant que je passe au thème suivant.",
    ],
  },
  {
    id: "froid", fam: "corps", icon: "❄️",
    titre: "Le froid attaque ma peau",
    sous: "Saisonnier hiver — tiraillements, rougeurs",
    qui: "Tout le monde, de novembre à mars. Chauffage, vent, écarts de température : la peau ne suit plus et le maquillage accroche.",
    produits: ["Baume nourrissant", "Baume lèvres", "Crème protectrice visage"],
    diag: "🧴 Peau Corps",
    angles: [
      "Ce n'est pas le froid dehors le pire. C'est l'écart entre le froid dehors et le chauffage dedans. Ta peau fait des allers-retours toute la journée et elle craque.",
      "Ma routine hiver, filmée. Elle est différente de ma routine du reste de l'année sur un seul point — mais ce point fait toute la différence.",
      "Un pot dure toute la saison froide. Ramené aux 4 mois d'hiver, on parle de quelques centimes par jour pour ne plus avoir la peau qui craque.",
      "Si tu vis dans le Sud et qu'il fait 15 degrés en janvier chez toi, honnêtement tu n'en as pas besoin. Garde ta routine habituelle.",
      "Le retour d'une cliente qui bosse en extérieur. Son message est court mais très parlant.",
      "« En hiver je mets juste plus de ma crème habituelle. » C'est ce que je faisais. Le problème c'est que ce n'est pas une question de quantité, c'est une question de texture.",
      "L'hiver se termine, et ce produit avec. Dernier rappel avant que je le range jusqu'à novembre.",
    ],
  },

  // ─────────── CHEVEUX ───────────
  {
    id: "cheveux-cassent", fam: "cheveux", icon: "💔",
    titre: "Mes cheveux cassent quand je les brosse",
    sous: "Casse, fourches, longueurs abîmées",
    qui: "Celle qui laisse une touffe dans sa brosse chaque matin. Elle veut laisser pousser mais ses longueurs cassent aussi vite qu'elles poussent.",
    produits: ["Masque réparateur", "Sérum pointes", "Shampooing doux"],
    diag: "💇 Cheveux",
    angles: [
      "Tu te brosses les cheveux et tu regardes ta brosse. Cette petite touffe, tous les matins. Ce n'est pas de la chute — c'est de la casse. Et ça ne se traite pas pareil.",
      "L'erreur que je faisais : brosser sur cheveux mouillés, du haut vers le bas. Je vous montre le bon geste, il est à l'exact opposé.",
      "Un pot de masque tient 12 utilisations. À raison d'une fois par semaine, ça fait trois mois. Le calcul à la dose est imbattable face à un soin en salon.",
      "Si tes cheveux sont fins et vite alourdis, ce masque va les plomber. Prends la version légère à la place — je préfère te le dire avant que tu sois déçue.",
      "Ce message d'une cliente qui essayait de laisser pousser depuis deux ans. Partagé avec son accord.",
      "Oui, tous les masques promettent de réparer. Techniquement, aucun ne « répare » un cheveu mort. Ce qu'ils font, c'est gainer. Nuance importante, je vous explique.",
      "Fin de période sur ce produit. Dernier post avant que je change de thème.",
    ],
  },
  {
    id: "racines-grasses", fam: "cheveux", icon: "🔀",
    titre: "Racines grasses, pointes sèches",
    sous: "Cuir chevelu déséquilibré",
    qui: "Celle qui doit se laver les cheveux tous les jours mais dont les pointes sont de la paille. Elle a l'impression d'avoir deux types de cheveux sur la même tête.",
    produits: ["Shampooing équilibrant", "Soin cuir chevelu", "Huile pointes"],
    diag: "💇 Cheveux",
    angles: [
      "Racines qui regraissent en 24 h, pointes qui ressemblent à de la paille. Comme si tu avais deux têtes différentes. Et aucun produit ne semble faire les deux.",
      "Ce que j'ai changé : je ne mets plus le même produit partout. Shampooing aux racines uniquement, soin sur les longueurs uniquement. Je vous montre.",
      "Le flacon dure 2 mois même avec des lavages rapprochés. Ramené au lavage, c'est bien moins cher que ce que je prenais en grande surface.",
      "Si tu as le cuir chevelu très sec ou des squames, ce n'est pas ce qu'il te faut — tu vas assécher encore plus. Il y a autre chose pour toi dans la gamme.",
      "Le retour d'une cliente qui est passée d'un lavage quotidien à un lavage tous les trois jours. Son message avec son accord.",
      "« On m'a déjà dit d'espacer les lavages, ça ne marche pas. » Effectivement, pas toute seule. Il faut changer ce qu'on met, pas juste la fréquence.",
      "Dernier rappel sur ce produit avant la fin de période.",
    ],
  },
  {
    id: "chute", fam: "cheveux", icon: "🍂",
    titre: "J'en perds beaucoup en ce moment",
    sous: "Chute saisonnière, densité",
    qui: "Automne et printemps surtout. Aussi post-partum, post-régime, après un stress. Elle voit sa raie s'élargir et ça l'inquiète vraiment.",
    produits: ["Complément cheveux", "Lotion densifiante", "Shampooing fortifiant"],
    diag: "💇 Cheveux",
    angles: [
      "La bonde de douche. Chaque automne, chaque printemps. On perd tous des cheveux, mais quand la raie commence à s'élargir, ça devient autre chose que de l'esthétique.",
      "Le massage du cuir chevelu, 2 minutes sous la douche. Gratuit, et c'est ce qui donne le plus de résultat sur la durée. Je vous montre le mouvement.",
      "Une cure fait 3 mois, ce qui correspond exactement à la durée d'un cycle. Ramené au jour, c'est le prix d'un chewing-gum.",
      "Si ta chute dure depuis plus de 6 mois, ou si tu vois des zones dégarnies, va voir un médecin. Ce n'est pas une chute saisonnière et aucun complément ne réglera ça.",
      "Ce message d'une cliente en post-partum. Elle raconte très bien ce qu'elle a ressenti — partagé avec son accord.",
      "Tu vas me dire que les compléments cheveux, c'est du vent. Je comprends. Alors regardons ensemble ce qu'il y a dedans et à quoi ça sert réellement.",
      "Dernière semaine sur cette cure avant que je change de thème.",
    ],
    dgccrf: true,
  },
  {
    id: "couleur", fam: "cheveux", icon: "🎨",
    titre: "Ma couleur ternit en 3 semaines",
    sous: "Cheveux colorés, éclat qui part",
    qui: "Celle qui paie son coiffeur et qui voit sa couleur virer en trois semaines. Elle veut espacer les rendez-vous sans avoir l'air négligée.",
    produits: ["Shampooing cheveux colorés", "Masque protecteur", "Soin sans rinçage"],
    diag: "💇 Cheveux",
    angles: [
      "Tu sors de chez le coiffeur, c'est magnifique. Trois semaines après, c'est terne et ça a viré. Et le rendez-vous suivant est dans deux mois.",
      "Le geste qui fait partir ta couleur le plus vite : l'eau trop chaude. Je vous montre ce que je fais maintenant, ça ne coûte rien à changer.",
      "Le flacon dure 10 semaines. Sur une année, l'économie est simple à calculer : c'est le prix d'un rendez-vous couleur en moins.",
      "Si tu es blonde platine ou sur des couleurs fantaisie, il te faut un pigmentant, pas ça. Celui-ci protège mais ne redépose pas de pigment.",
      "Ce message d'une cliente qui a réussi à espacer ses rendez-vous coiffeur. Partagé avec son accord.",
      "Oui, chaque marque a son shampooing « spécial couleur ». La différence se joue sur un point précis de la composition — je vous montre lequel.",
      "Fin de période sur ce produit. Dernier post, je passe à autre chose lundi.",
    ],
  },

  // ─────────── POIDS & BIEN-ÊTRE ───────────
  {
    id: "ventre-gonfle", fam: "poids", icon: "🎈",
    titre: "Le ventre gonflé après les repas",
    sous: "Confort digestif",
    qui: "Celle qui déboutonne son pantalon en fin de journée. Ce n'est pas une question de poids, c'est une question de confort — et elle en a assez qu'on lui dise que c'est dans sa tête.",
    produits: ["Complément digestion", "Tisane", "Probiotiques"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "16 h. Tu déboutonnes discrètement ton pantalon sous le bureau. Ce n'est pas une question de kilos — c'est une question de confort. Et on n'en parle jamais.",
      "Mon moment de prise, et pourquoi le timing compte plus que la dose. Je vous montre comment je l'ai intégré à ma journée sans y penser.",
      "Une boîte fait 30 jours. Ramené au jour, on est très en dessous du prix d'un café. Et ça, c'est le vrai calcul à faire.",
      "Si tu as des douleurs fortes, régulières, ou un transit très perturbé, va consulter. Un complément n'est pas un diagnostic et ne remplacera jamais un avis médical.",
      "Ce message d'une cliente reçu la semaine dernière. Elle parle de son confort, pas de sa silhouette — et c'est exactement le bon angle.",
      "« Les compléments, c'est du placebo. » C'est une question légitime. Voilà ce que dit la réglementation sur ce qu'on a le droit d'affirmer, et voilà ce que moi j'ai ressenti.",
      "Dernière semaine sur ce produit avant que je change de thème lundi.",
    ],
    dgccrf: true,
  },
  {
    id: "grignotage", fam: "poids", icon: "🍪",
    titre: "Je grignote tout l'après-midi",
    sous: "Satiété, fringales",
    qui: "Celle qui tient très bien jusqu'à 15 h puis qui vide le placard. Elle se culpabilise alors que c'est souvent un déjeuner mal construit.",
    produits: ["Complément satiété", "Barres", "Substitut collation"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "Tu tiens très bien jusqu'à 15 h. Et puis d'un coup tu ouvres le placard, et tu ne le refermes plus. Ce n'est pas un manque de volonté — c'est ton déjeuner.",
      "Ce que j'ai changé dans mon après-midi. Deux choses, dont une qui ne coûte rien du tout. Je vous montre.",
      "30 portions dans la boîte. Comparé à ce que je dépensais en viennoiseries à 16 h, le calcul s'est fait tout seul.",
      "Si tu as un rapport difficile à la nourriture ou des épisodes de compulsions, ce n'est pas un produit qu'il te faut — c'est un accompagnement. Je le dis sincèrement.",
      "Le retour d'une cliente sur ses après-midis au bureau. Partagé avec son accord.",
      "« Un complément qui coupe la faim, ça me fait peur. » Tu as raison de te méfier. Ça ne coupe rien du tout — voilà ce que ça fait vraiment.",
      "Fin de période sur ce produit, dernier rappel.",
    ],
    dgccrf: true,
  },
  {
    id: "lourdeur", fam: "poids", icon: "💦",
    titre: "Je me sens lourde en ce moment",
    sous: "Drainage, rétention",
    qui: "Celle qui a l'impression d'être gonflée partout — bagues serrées, chevilles marquées. Souvent lié aux cycles, à la chaleur, aux repas salés.",
    produits: ["Boisson drainante", "Tisane détox", "Complément drainage"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "Tes bagues qui serrent. Tes chevilles marquées le soir. Cette sensation d'être gonflée de partout sans que la balance ait bougé. On en parle ?",
      "Ma routine sur 10 jours, filmée jour 1 et jour 10. Le geste le plus important reste gratuit : boire. Je vous montre comment j'ai fait pour y penser.",
      "Une cure de 10 jours par flacon. Ramené au jour, c'est moins qu'une bouteille d'eau minérale — et c'est un calcul honnête à faire.",
      "Si tu as une rétention importante et persistante, ou des œdèmes, consulte. Ce n'est pas anodin et un drainant ne réglera pas la cause.",
      "Ce message d'une cliente pendant la période de chaleur. Partagé avec son accord, sans retouche.",
      "« Détox, drainage, ce sont des mots marketing. » En partie oui. Alors regardons ce que la réglementation autorise à dire, et ce que ça fait concrètement.",
      "Dernière semaine sur cette cure avant que je passe au thème suivant.",
    ],
    dgccrf: true,
  },
  {
    id: "sport", fam: "poids", icon: "🏃",
    titre: "Je reprends le sport, je veux tenir",
    sous: "Récupération, énergie à l'effort",
    qui: "Celle qui s'est réinscrite à la salle, ou qui a repris la course. Elle a mal partout au troisième jour et c'est là que la plupart abandonnent.",
    produits: ["Protéines", "Complément récupération", "Magnésium"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "Jour 1 : motivée. Jour 3 : tu as mal partout et tu trouves une excuse. C'est exactement là que 80 % des gens arrêtent. Le problème n'est pas la motivation.",
      "Ce que je prends après une séance, et à quel moment. La fenêtre compte — je vous montre ma routine post-sport en une minute.",
      "Un pot fait 25 portions. Comparé à un shaker acheté en salle, le rapport est sans appel. Le calcul à la portion, encore une fois.",
      "Si tu fais du sport de haut niveau ou que tu es suivie par un nutritionniste, écoute-le lui, pas moi. Ce que je propose, c'est pour une reprise normale.",
      "Le message d'une cliente qui a repris la course après trois ans d'arrêt. Elle en est à sa huitième semaine.",
      "« Les protéines c'est pour les bodybuilders. » C'est ce que je croyais. En réalité c'est surtout une question de récupération — je vous explique.",
      "Fin de période sur ce produit. Dernier post avant de changer de thème.",
    ],
    dgccrf: true,
  },
  {
    id: "equilibre", fam: "poids", icon: "🥗",
    titre: "Je mange n'importe comment le midi",
    sous: "Équilibre alimentaire, repas pris sur le pouce",
    qui: "Celle qui déjeune en 10 minutes devant son écran, ou dans sa voiture. Elle sait que ce n'est pas bien mais elle n'a pas de solution réaliste.",
    produits: ["Repas complet", "Compléments multivitamines", "Snacks équilibrés"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "Sandwich avalé en 10 minutes devant l'écran. Ou rien du tout, et un gros dîner le soir. On sait toutes que ce n'est pas idéal — mais qui a le temps de faire autrement ?",
      "Ce que j'ai dans mon sac depuis six mois. Ça se prépare en 30 secondes et ça m'a sortie du sandwich quotidien. Je vous montre.",
      "Comparé à un menu du midi acheté sur place, l'écart au repas est important. Sur un mois de déjeuners, le calcul parle tout seul.",
      "Ça ne remplace pas un vrai repas équilibré, et je ne vais pas prétendre le contraire. C'est une solution pour les jours où l'alternative serait pire.",
      "Ce retour d'une cliente commerciale qui déjeune dans sa voiture. Partagé avec son accord.",
      "« Un substitut de repas, ce n'est pas de la vraie nourriture. » Tu as raison. La question n'est pas là — c'est : mieux que quoi ? Je vous explique mon raisonnement.",
      "Dernière semaine sur ce thème, dernier rappel sur ce produit.",
    ],
    dgccrf: true,
  },

  // ─────────── ÉNERGIE · BEAUTÉ · PARFUM ───────────
  {
    id: "coup-de-barre", fam: "autres", icon: "⚡",
    titre: "Le coup de barre de 16h",
    sous: "Baisse d'énergie de l'après-midi",
    qui: "Tout le monde, ou presque. Elle enchaîne les cafés à partir de 15 h et dort mal le soir — et le cercle se referme.",
    produits: ["Complément énergie", "Vitamine C", "Magnésium"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "15 h 30. Tu relis trois fois la même phrase. Tu te lèves pour un café — le troisième. Et le soir tu ne dors pas. C'est un cercle et j'en suis sortie.",
      "Ce que je fais maintenant à 15 h à la place du café. Deux minutes, et le résultat n'a rien à voir avec ce que j'imaginais.",
      "Une boîte fait 30 jours. Comparé à deux cafés quotidiens achetés dehors, l'économie mensuelle est réelle — je vous fais le calcul.",
      "Si tu es épuisée en permanence, dès le matin, ce n'est pas un coup de barre : c'est autre chose. Fais une prise de sang avant d'acheter quoi que ce soit.",
      "Le message d'une cliente en télétravail sur ses après-midis. Partagé avec son accord.",
      "« Encore un truc pour donner un coup de fouet. » Je comprends la lassitude. Voilà exactement ce qu'il y a dedans et ce que ça fait — sans exagération.",
      "Fin de période sur ce produit, dernier rappel avant le changement de thème.",
    ],
    dgccrf: true,
  },
  {
    id: "reveil-fatiguee", fam: "autres", icon: "🌙",
    titre: "Je me réveille déjà fatiguée",
    sous: "Qualité du sommeil, récupération",
    qui: "Celle qui dort 8 heures et se lève épuisée. Souvent : scroll au lit, stress, réveils nocturnes. Elle a essayé la tisane et ça n'a rien changé.",
    produits: ["Complément sommeil", "Tisane du soir", "Magnésium"],
    diag: "💊 Santé & Bien-être",
    angles: [
      "Tu as dormi 8 heures et tu te lèves comme si tu n'avais pas dormi. Le problème n'est pas la durée. C'est la qualité — et ça, on n'en parle jamais.",
      "Ma routine du soir, celle qui a vraiment changé quelque chose. Un seul élément est un produit, les deux autres sont gratuits. Je vous montre.",
      "30 jours par boîte. Le calcul à la nuit est dérisoire comparé à ce qu'une mauvaise nuit te coûte en énergie le lendemain.",
      "Si tu as des insomnies chroniques ou des réveils à 3 h toutes les nuits, parle-en à ton médecin. Ce n'est pas un complément qu'il te faut.",
      "Ce message d'une cliente sur ses trois premières semaines. Elle est très nuancée — c'est ce qui rend son retour crédible.",
      "« Le sommeil ça ne s'achète pas en gélules. » Complètement d'accord. Ce que ça fait, c'est aider à l'endormissement — nuance importante, je détaille.",
      "Dernière semaine sur ce produit avant que je change de thème.",
    ],
    dgccrf: true,
  },
  {
    id: "maquillage", fam: "autres", icon: "💄",
    titre: "Mon maquillage tient pas la journée",
    sous: "Tenue du teint, base",
    qui: "Celle qui se maquille à 7 h et qui à midi n'a plus rien. Elle achète des fonds de teint de plus en plus couvrants alors que le problème est en dessous.",
    produits: ["Base de teint", "Fond de teint longue tenue", "Poudre fixante"],
    diag: "💄 Makeup",
    angles: [
      "7 h : maquillage impeccable. 12 h : il ne reste plus rien, sauf dans les plis. Et tu achètes un fond de teint de plus en plus couvrant. Le problème n'est pas là.",
      "L'étape que 90 % des gens sautent, et qui fait toute la tenue. Je vous la montre — elle prend 20 secondes.",
      "30 ml, et on en met très peu. Ça dure 4 mois. Le calcul à l'application est bien plus favorable que ce qu'on imagine.",
      "Si tu as la peau très sèche, cette base va marquer tes zones de sécheresse. Il te faut l'autre version — je te le dis franchement.",
      "Le retour d'une cliente qui bosse en extérieur toute la journée. C'est le test ultime pour une tenue.",
      "Oui, toutes les marques promettent une tenue 24 h. Aucune ne tient 24 h. Celle-ci tient une vraie journée de travail, et c'est déjà bien plus honnête.",
      "Fin de période sur ce produit, dernier post avant de changer.",
    ],
  },
  {
    id: "parfum", fam: "autres", icon: "🌸",
    titre: "On me demande toujours quel est mon parfum",
    sous: "Parfums — l'argument prix imbattable",
    qui: "Tout le monde. C'est le produit d'entrée le plus facile, celui qui déclenche la conversation sans que tu aies rien à vendre.",
    produits: ["Parfums femme", "Parfums homme", "Coffrets"],
    diag: "🌸 Parfum",
    angles: [
      "« Tu mets quoi comme parfum ? » On me l'a demandé trois fois cette semaine. Et à chaque fois, la tête des gens quand je donne le prix.",
      "Où je le mets exactement, et pourquoi ça change la tenue du tout au tout. Ce n'est pas là où vous pensez. Je vous montre.",
      "Moins de 20 €. Le même volume chez une grande marque : entre 70 et 110 €. Je ne dis pas que c'est identique — je dis que le rapport est là.",
      "Si tu cherches exactement le même sillage qu'un parfum de niche à 200 €, tu vas être déçue. Ce n'est pas une copie. C'est une bonne famille olfactive à un prix juste.",
      "Ce message d'une cliente qui a offert un coffret. La réaction de la personne qui l'a reçu vaut le détour.",
      "Oui, c'est une marque que tu ne connais pas, et à ce prix-là tu te dis forcément qu'il y a un piège. Parlons-en franchement : voilà pourquoi c'est possible.",
      "Dernière semaine sur les parfums avec l'offre en cours. Après, je passe à autre chose.",
    ],
  },

  // ─────────── MAISON & ENTRETIEN ───────────
  {
    id: "dimanche-menage", fam: "maison", icon: "🧹",
    titre: "Je passe mon dimanche à nettoyer",
    sous: "Temps perdu, corvée qui n'en finit pas",
    qui: "Celle qui bosse toute la semaine et qui sacrifie son dimanche au ménage. Elle ne cherche pas un produit — elle cherche à récupérer son week-end.",
    produits: ["Nettoyant multi-usage", "Spray sols", "Lingettes réutilisables"],
    diag: "🏠 Maison",
    angles: [
      "Dimanche, 14 h. Tu es à genoux devant ta baignoire. Et lundi tu retournes bosser sans avoir eu de week-end. À un moment il faut se poser la question du temps que ça coûte.",
      "Ma routine du samedi matin, filmée en accéléré. 40 minutes pour tout l'appartement. Le secret n'est pas la vitesse — c'est de ne pas changer de produit entre chaque pièce.",
      "Un flacon de concentré fait 15 litres de produit prêt à l'emploi. Ramené au litre, on est à quelques centimes. Compare avec ton spray du supermarché, l'écart est énorme.",
      "Si tu aimes avoir un produit spécifique pour chaque surface et que ça te rassure, ce n'est pas pour toi. Ça, c'est pour celles qui veulent simplifier.",
      "Ce message d'une cliente maman de trois enfants sur son temps de ménage. Partagé avec son accord.",
      "« Un multi-usage, ça nettoie mal partout. » C'était mon avis aussi. La vraie question n'est pas la polyvalence, c'est la concentration — je vous explique.",
      "Dernière semaine sur ce produit avec l'offre en cours, après je change de thème.",
    ],
    dgccrf: "menage",
  },
  {
    id: "odeur-chimique", fam: "maison", icon: "🌬️",
    titre: "Ça sent le produit chimique chez moi",
    sous: "Odeurs agressives, gorge qui pique",
    qui: "Celle qui doit ouvrir les fenêtres après avoir nettoyé sa salle de bain. Souvent asthmatique, ou avec un enfant qui tousse.",
    produits: ["Nettoyant doux", "Spray sans javel", "Parfum d'ambiance"],
    diag: "🏠 Maison",
    angles: [
      "Tu nettoies ta salle de bain, et après tu dois ouvrir la fenêtre en grand pendant vingt minutes. Ta gorge pique. On a fini par trouver ça normal — ça ne l'est pas.",
      "Ce que je fais maintenant, et ce que j'ai arrêté de mélanger. Une erreur que beaucoup font encore et qui est vraiment dangereuse — je vous montre.",
      "Le concentré revient à quelques centimes le litre une fois dilué. Et tu achètes un flacon au lieu de six, ce qui change aussi le calcul du transport et du plastique.",
      "Si tu veux une odeur de propre très marquée, celle qui reste trois heures, tu vas être déçue. Ici l'odeur est discrète et part vite — c'est justement le principe.",
      "Le message d'une cliente dont le fils est asthmatique. Elle raconte très concrètement ce qui a changé chez elle.",
      "Oui, « naturel » est un mot galvaudé et ça ne veut pas dire grand-chose en soi. Alors regardons la composition ligne par ligne, c'est plus honnête.",
      "Fin de période sur ce produit, dernier rappel avant de passer à autre chose.",
    ],
    dgccrf: "menage",
  },
  {
    id: "placard-produits", fam: "maison", icon: "🧴",
    titre: "Mon placard déborde de produits différents",
    sous: "Un produit par surface, budget qui file",
    qui: "Celle qui a huit flacons sous son évier, dont trois entamés qu'elle n'utilise jamais. Elle sait que c'est absurde mais elle rachète quand même.",
    produits: ["Nettoyant multi-usage", "Concentré", "Recharges"],
    diag: "🏠 Maison",
    angles: [
      "Ouvre le placard sous ton évier. Compte les flacons. Maintenant compte ceux que tu as utilisés cette semaine. Voilà, on est d'accord.",
      "Ce qu'il me reste sous l'évier aujourd'hui, filmé sans préparation. Trois produits. Je vous montre lequel fait quoi.",
      "Un concentré remplace plusieurs sprays. Le calcul au litre dilué est déjà favorable, mais le vrai gain c'est ce que tu ne rachètes plus.",
      "Si tu as des surfaces très spécifiques — marbre, pierre naturelle, parquet huilé — il te faudra quand même un produit dédié. Je ne vais pas te dire l'inverse.",
      "Ce message d'une cliente qui a fait le tri sous son évier. Elle a compté ce qu'elle a jeté — le chiffre fait réfléchir.",
      "« Marketing : un produit qui fait tout, ça fait tout mal. » C'est vrai pour beaucoup de multi-usages. Voilà ce qui change ici, et voilà les cas où ça ne suffit pas.",
      "Dernière publication sur ce produit avant la fin de période.",
    ],
    dgccrf: "menage",
  },
  {
    id: "sol-enfants", fam: "maison", icon: "👶",
    titre: "Mes enfants jouent par terre",
    sous: "Sols, surfaces, contact quotidien",
    qui: "Jeune parent, ou propriétaire d'animaux. Elle regarde les étiquettes depuis qu'il y a un bébé qui rampe et qui met tout à la bouche.",
    produits: ["Nettoyant sols", "Spray surfaces", "Lingettes"],
    diag: "🏠 Maison",
    angles: [
      "Ton bébé rampe. Il met ses mains par terre, puis dans sa bouche. Depuis qu'on m'a fait remarquer ça, je ne regarde plus mes produits de la même façon.",
      "Mon geste pour les sols, et le temps de séchage que je respecte maintenant. Ça paraît bête mais c'est là que tout se joue.",
      "Dilué, on descend à quelques centimes le litre. Sur une année de sols lavés deux fois par semaine, l'économie devient très concrète.",
      "Si tu cherches un désinfectant hospitalier, ce n'est pas ça et je ne vais pas te le vendre comme tel. C'est un nettoyant du quotidien, pour un usage domestique normal.",
      "Le retour d'une cliente jeune maman. Elle parle surtout de sa tranquillité d'esprit, et c'est le bon angle.",
      "Oui, tout le monde met « respectueux de la famille » sur son étiquette. Ça ne veut rien dire juridiquement. Alors voilà la composition, jugez vous-mêmes.",
      "Fin de période sur ce produit. Dernier rappel avant que je change de thème lundi.",
    ],
    dgccrf: "menage",
  },
  {
    id: "traces-vitres", fam: "maison", icon: "🪟",
    titre: "Mes vitres ont toujours des traces",
    sous: "Vitres, miroirs, inox",
    qui: "Tout le monde. C'est le thème le plus visuel de tous — la démo se filme toute seule et le résultat est immédiat.",
    produits: ["Nettoyant vitres", "Chiffon microfibre", "Spray inox"],
    diag: "🏠 Maison",
    angles: [
      "Tu nettoies ta vitre. Le soleil passe. Et là : les traces. Tu recommences. Toujours des traces. Le problème n'est pas ton produit — c'est ton chiffon.",
      "La démo la plus satisfaisante que je connaisse. Moitié gauche avec, moitié droite sans. Filmé à contre-jour, sans montage. Regardez.",
      "Le flacon dure une saison entière. Ramené au nettoyage de vitres, on est sur des centimes — et surtout tu ne rachètes plus d'essuie-tout.",
      "Si tu n'utilises pas une microfibre propre, aucun produit au monde ne te donnera un résultat sans traces. Le produit ne fait que la moitié du travail.",
      "Ce message d'une cliente qui a des baies vitrées plein sud. C'est le test le plus dur qui soit.",
      "« Le vinaigre blanc fait la même chose pour trois fois rien. » Sur les vitres, franchement, il fait déjà un bon travail. Voilà où se situe la vraie différence.",
      "Dernière semaine sur ce produit avec l'offre du catalogue en cours.",
    ],
    dgccrf: "menage",
  },
  {
    id: "linge-renferme", fam: "maison", icon: "🧺",
    titre: "Mon linge sent le renfermé",
    sous: "Lessive, séchage, machine",
    qui: "Celle qui étend en intérieur l'hiver, ou qui oublie sa machine deux heures. L'odeur revient dès que le linge est porté.",
    produits: ["Lessive concentrée", "Assouplissant", "Nettoyant machine"],
    diag: "🏠 Maison",
    angles: [
      "Tu sors ton linge de la machine, il sent bon. Tu le portes deux heures, et l'odeur de renfermé revient. Ce n'est pas ta lessive — c'est ta machine.",
      "Ce que je fais une fois par mois et que presque personne ne fait. Dix minutes, et ça change l'odeur de tout mon linge. Je vous montre.",
      "Une dose de concentré par machine. Compare le prix à la dose avec ta lessive habituelle plutôt qu'au flacon — c'est là que la différence apparaît.",
      "Si ton linge sent le renfermé à cause d'un séchage trop lent en intérieur l'hiver, aucune lessive ne réglera ça. Il te faut aérer, pas racheter.",
      "Ce retour d'une cliente qui étend dans sa salle de bain toute l'année. Partagé avec son accord.",
      "Oui, la lessive c'est le rayon où on se fait le plus avoir avec les parfums. Je vous montre comment lire une étiquette de lessive en trente secondes.",
      "Fin de période, dernier post sur ce produit avant de changer de thème.",
    ],
    dgccrf: "menage",
  },
  {
    id: "calcaire", fam: "maison", icon: "🚿",
    titre: "Le calcaire de ma salle de bain",
    sous: "Dépôts, robinetterie, paroi de douche",
    qui: "Celle qui vit en zone d'eau dure. Sa paroi de douche est blanche en permanence et elle a renoncé à frotter.",
    produits: ["Anticalcaire", "Spray douche quotidien", "Raclette"],
    diag: "🏠 Maison",
    angles: [
      "Ta paroi de douche est blanche. Pas sale — blanche. Tu as frotté, ça revient en trois jours. Si tu es en zone d'eau dure, tu sais exactement de quoi je parle.",
      "Le geste de 10 secondes après chaque douche qui m'a fait arrêter de frotter le samedi. Ce n'est même pas le produit le plus important ici.",
      "Le concentré fait plusieurs litres dilués. À l'usage quotidien, on parle de centimes par semaine pour ne plus jamais avoir à décaper.",
      "Si ton calcaire est incrusté depuis des années, un spray quotidien ne suffira pas au début — il faudra un vrai décapage d'abord. Autant le dire franchement.",
      "Ce message d'une cliente en Bretagne, eau très dure. Elle est précise sur le temps que ça lui a pris.",
      "« Le vinaigre blanc suffit. » Sur du calcaire léger, oui. Sur de l'incrusté, il faut autre chose — et je vous explique pourquoi, chimiquement.",
      "Dernière semaine sur ce produit avant que je passe au thème suivant.",
    ],
    dgccrf: "menage",
  },
];

// ═══════════════════════════════════════════════════════════════
//  COMPOSANT
// ═══════════════════════════════════════════════════════════════

function BoutonCopier({ texte }) {
  const [ok, setOk] = useState(false);
  const copier = () => {
    try {
      navigator.clipboard.writeText(texte);
      setOk(true);
      setTimeout(() => setOk(false), 1600);
    } catch (e) { }
  };
  return (
    <button onClick={copier}
      style={{ background: "none", border: "1px solid " + C.pale, borderRadius: 14, padding: ".15rem .5rem", fontSize: ".58rem", color: ok ? C.vert : C.gris, cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0 }}>
      {ok ? "✓ Copié" : "Copier"}
    </button>
  );
}

function EncadreDgccrf({ type }) {
  const menage = type === "menage";
  return (
    <div style={{ border: "1.5px solid rgba(179,38,30,.35)", background: "rgba(179,38,30,.05)", borderRadius: 10, padding: ".7rem", marginBottom: ".8rem" }}>
      <div style={{ fontSize: ".68rem", fontWeight: 700, color: "#B3261E", marginBottom: ".4rem" }}>
        {menage ? "⚠️ Attention aux allégations biocides" : "⚠️ Thème sensible — formulations"}
      </div>
      <div style={{ fontSize: ".68rem", color: "#2E7D32", fontWeight: 700, marginBottom: ".15rem" }}>✅ Tu peux dire</div>
      <div style={{ fontSize: ".67rem", color: C.texte, lineHeight: 1.6, marginBottom: ".4rem" }}>
        {menage
          ? "« Nettoie » · « dégraisse » · « élimine les salissures » · « ravive » · « laisse une surface nette »"
          : "« Contribue à réduire la fatigue » · « Participe au maintien de… » · « Ce que moi j'ai ressenti, sans promesse pour toi » · « En complément d'une alimentation variée »"}
      </div>
      <div style={{ fontSize: ".68rem", color: "#B3261E", fontWeight: 700, marginBottom: ".15rem" }}>❌ Tu ne peux pas dire</div>
      <div style={{ fontSize: ".67rem", color: C.texte, lineHeight: 1.6 }}>
        {menage
          ? "« Désinfecte » · « tue 99,9 % des bactéries » · « antibactérien » · « virucide » · « assainit » — ce sont des allégations biocides réglementées, réservées aux produits qui disposent de l'autorisation correspondante."
          : "« Soigne » · « guérit » · « traite » · « fait perdre X kilos » · « remplace ton traitement » · un avant/après présenté comme un résultat garanti"}
      </div>
      <div style={{ fontSize: ".64rem", color: C.gris, fontStyle: "italic", marginTop: ".45rem", lineHeight: 1.5 }}>
        En cas de doute sur une formulation, demande avant de publier.
      </div>
    </div>
  );
}

export function SemaineThemeTab({ uid }) {
  const [compteur, setCompteur] = useState({});
  const [ouvert, setOuvert] = useState(null);
  const [filtre, setFiltre] = useState("tous");
  const [perso, setPerso] = useState([]);
  const [chargement, setChargement] = useState(true);
  const [showDecouverte, setShowDecouverte] = useState(false);

  const estMelissa = !!uid && uid.toLowerCase().startsWith("melissa");

  // form thèmes perso
  const [fTitre, setFTitre] = useState("");
  const [fIcon, setFIcon] = useState("💡");
  const [fQui, setFQui] = useState("");
  const [fProduits, setFProduits] = useState("");
  const [fNotes, setFNotes] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    (async () => {
      try {
        const brut = await sg(uid, "db-themes-compteur");
        if (brut) setCompteur(JSON.parse(brut));
      } catch (e) { }
      try {
        const snap = await getDoc(doc(db, "admin", "semaine_themes"));
        if (snap.exists()) setPerso(snap.data().themes || []);
      } catch (e) { }
      setChargement(false);
    })();
  }, [uid]);

  const incrementer = async (id) => {
    const d = new Date();
    const mois = d.toLocaleDateString("fr-FR", { month: "long", year: "numeric" });
    const suivant = { ...compteur, [id]: { n: (compteur[id]?.n || 0) + 1, last: mois } };
    setCompteur(suivant);
    try { await ss(uid, "db-themes-compteur", JSON.stringify(suivant)); } catch (e) { }
  };

  const reinitialiser = async (id) => {
    const suivant = { ...compteur };
    delete suivant[id];
    setCompteur(suivant);
    try { await ss(uid, "db-themes-compteur", JSON.stringify(suivant)); } catch (e) { }
  };

  const ajouterPerso = async () => {
    if (!fTitre.trim()) return;
    setSaving(true);
    const nouveau = {
      id: "perso-" + Date.now(),
      icon: fIcon || "💡",
      titre: fTitre.trim(),
      qui: fQui.trim(),
      produits: fProduits.split(",").map(x => x.trim()).filter(Boolean),
      notes: fNotes.trim(),
    };
    const liste = [...perso, nouveau];
    try {
      await setDoc(doc(db, "admin", "semaine_themes"), { themes: liste, maj: Date.now() });
      setPerso(liste);
      setFTitre(""); setFIcon("💡"); setFQui(""); setFProduits(""); setFNotes("");
    } catch (e) { }
    setSaving(false);
  };

  const supprimerPerso = async (id) => {
    const liste = perso.filter(p => p.id !== id);
    try {
      await setDoc(doc(db, "admin", "semaine_themes"), { themes: liste, maj: Date.now() });
      setPerso(liste);
    } catch (e) { }
  };

  const totalFaits = Object.values(compteur).reduce((s, v) => s + (v.n || 0), 0);
  const jamaisFaits = THEMES_SEMAINE.filter(t => !compteur[t.id]).length;

  const visibles = THEMES_SEMAINE.filter(t => {
    if (filtre === "tous") return true;
    if (filtre === "jamais") return !compteur[t.id];
    return t.fam === filtre;
  });

  return (
    <div style={{ paddingBottom: "2rem" }}>

      {showDecouverte && <DecouverteTour outil="semainetheme" onClose={() => setShowDecouverte(false)} />}

      <div style={{ display: "flex", justifyContent: "flex-end", marginBottom: ".5rem" }}>
        <button onClick={() => setShowDecouverte(true)}
          style={{ background: "#C49A8A", color: "white", border: "none", borderRadius: 20, padding: ".3rem .75rem", fontSize: ".64rem", fontWeight: 600, cursor: "pointer" }}>
          ? Découvrir cet onglet
        </button>
      </div>

      {/* EN-TÊTE */}
      <div style={{ fontFamily: "Georgia,serif", fontSize: "1.35rem", fontWeight: 300, color: C.brun, marginBottom: ".25rem" }}>
        Semaine à <em style={{ fontStyle: "italic", color: C.rose }}>thème</em>
      </div>
      <p style={{ fontSize: ".72rem", color: C.gris, lineHeight: 1.6, marginBottom: ".9rem" }}>
        Un thème = un problème vécu = une période entière de contenu. Les 7 angles sont pré-rédigés : adapte-les à ta voix, tes chiffres, ton expérience.
      </p>

      <div style={{ background: "rgba(139,94,0,.08)", borderLeft: "3px solid #8B5E00", padding: ".65rem .8rem", borderRadius: "0 8px 8px 0", marginBottom: "1rem" }}>
        <div style={{ fontSize: ".7rem", color: C.brun, lineHeight: 1.6 }}>
          📚 <strong>La méthode complète</strong> est dans Formation › Vente › « Arrête de vouloir tout vendre ».
        </div>
      </div>

      {/* COMPTEUR GLOBAL */}
      <div style={{ display: "flex", gap: ".5rem", marginBottom: "1rem" }}>
        <div style={{ flex: 1, background: C.blanc, border: "1px solid " + C.pale, borderRadius: 10, padding: ".6rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: C.rose }}>{totalFaits}</div>
          <div style={{ fontSize: ".6rem", color: C.gris }}>thèmes réalisés</div>
        </div>
        <div style={{ flex: 1, background: C.blanc, border: "1px solid " + C.pale, borderRadius: 10, padding: ".6rem", textAlign: "center" }}>
          <div style={{ fontSize: "1.25rem", fontWeight: 700, color: "#8B5E00" }}>{jamaisFaits}</div>
          <div style={{ fontSize: ".6rem", color: C.gris }}>jamais testés</div>
        </div>
      </div>

      {/* FILTRES */}
      <div style={{ display: "flex", gap: ".35rem", overflowX: "auto", paddingBottom: ".5rem", marginBottom: ".8rem" }}>
        {[{ id: "tous", label: "Tous" }, { id: "jamais", label: "🆕 Jamais fait" }, ...FAMILLES].map(f => (
          <button key={f.id} onClick={() => setFiltre(f.id)}
            style={{ flexShrink: 0, padding: ".35rem .7rem", fontSize: ".64rem", fontWeight: 600, borderRadius: 20, border: "1.5px solid " + (filtre === f.id ? C.rose : C.pale), background: filtre === f.id ? C.rose : "transparent", color: filtre === f.id ? "white" : C.gris, cursor: "pointer" }}>
            {f.label}
          </button>
        ))}
      </div>

      {/* LISTE DES THÈMES */}
      {visibles.map(t => {
        const c = compteur[t.id];
        const estOuvert = ouvert === t.id;
        const fam = FAMILLES.find(f => f.id === t.fam);
        return (
          <div key={t.id} style={{ background: C.blanc, border: "1px solid " + (c ? C.pale : C.rose), borderRadius: 12, marginBottom: ".55rem", overflow: "hidden" }}>

            <div onClick={() => setOuvert(estOuvert ? null : t.id)}
              style={{ display: "flex", alignItems: "center", gap: ".7rem", padding: ".75rem .85rem", cursor: "pointer" }}>
              <div style={{ width: 36, height: 36, borderRadius: "50%", background: (fam?.col || C.rose) + "22", display: "flex", alignItems: "center", justifyContent: "center", fontSize: "1.05rem", flexShrink: 0 }}>
                {t.icon}
              </div>
              <div style={{ flex: 1, minWidth: 0 }}>
                <div style={{ fontSize: ".82rem", fontWeight: 600, color: C.brun, display: "flex", alignItems: "center", gap: ".35rem", flexWrap: "wrap" }}>
                  {t.titre}
                  {!c && <span style={{ background: C.rose, color: "white", fontSize: ".52rem", fontWeight: 700, padding: ".08rem .35rem", borderRadius: 20 }}>JAMAIS FAIT</span>}
                </div>
                <div style={{ fontSize: ".63rem", color: C.gris }}>
                  {t.sous}{c ? " · fait " + c.n + (c.n > 1 ? " fois" : " fois") + " · " + c.last : ""}
                </div>
              </div>
              <span style={{ color: C.pale, fontSize: ".8rem" }}>{estOuvert ? "▲" : "▼"}</span>
            </div>

            {estOuvert && (
              <div style={{ padding: "0 .85rem .85rem", borderTop: "1px solid " + C.creme }}>

                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: fam?.col || C.rose, marginTop: ".7rem", marginBottom: ".25rem" }}>Qui se reconnaît</div>
                <div style={{ fontSize: ".71rem", color: C.texte, lineHeight: 1.6, marginBottom: ".7rem" }}>{t.qui}</div>

                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: fam?.col || C.rose, marginBottom: ".3rem" }}>Produits à piocher</div>
                <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem", marginBottom: ".7rem" }}>
                  {t.produits.map(p => (
                    <span key={p} style={{ fontSize: ".64rem", background: C.creme, color: C.brun, padding: ".2rem .5rem", borderRadius: 14 }}>{p}</span>
                  ))}
                </div>

                <div style={{ fontSize: ".66rem", color: C.gris, marginBottom: ".7rem" }}>
                  🩺 Diagnostic à lier en CTA : <strong style={{ color: C.brun }}>{t.diag}</strong>
                </div>

                {t.dgccrf && <EncadreDgccrf type={t.dgccrf} />}

                <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".1em", textTransform: "uppercase", color: fam?.col || C.rose, marginBottom: ".4rem" }}>Tes 7 angles</div>
                {t.angles.map((a, i) => {
                  const lab = ANGLES_LABELS[i];
                  return (
                    <div key={i} style={{ border: "1px solid " + C.creme, borderRadius: 9, padding: ".55rem .65rem", marginBottom: ".4rem", background: "rgba(255,255,255,.6)" }}>
                      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: ".4rem", marginBottom: ".25rem" }}>
                        <span style={{ fontSize: ".66rem", fontWeight: 700, color: C.brun }}>{lab.ic} {lab.n}. {lab.t}</span>
                        <BoutonCopier texte={a} />
                      </div>
                      <div style={{ fontSize: ".71rem", color: C.texte, lineHeight: 1.6 }}>{a}</div>
                      <div style={{ fontSize: ".6rem", color: C.gris, fontStyle: "italic", marginTop: ".25rem" }}>{lab.aide}</div>
                    </div>
                  );
                })}

                <div style={{ display: "flex", gap: ".4rem", marginTop: ".8rem", alignItems: "center" }}>
                  <button onClick={() => incrementer(t.id)}
                    style={{ flex: 1, background: C.rose, color: "white", border: "none", borderRadius: 20, padding: ".5rem", fontSize: ".7rem", fontWeight: 600, cursor: "pointer" }}>
                    ✓ J'ai fait ce thème
                  </button>
                  {c && (
                    <button onClick={() => reinitialiser(t.id)}
                      style={{ background: "none", border: "1px solid " + C.pale, borderRadius: 20, padding: ".5rem .7rem", fontSize: ".64rem", color: C.gris, cursor: "pointer" }}>
                      Annuler
                    </button>
                  )}
                </div>
              </div>
            )}
          </div>
        );
      })}

      {/* ─── THÈMES PERSO ─── */}
      <div style={{ marginTop: "1.6rem" }}>
        <div style={{ fontSize: ".6rem", fontWeight: 700, letterSpacing: ".12em", textTransform: "uppercase", color: "#8B5E00", marginBottom: ".5rem" }}>
          ✦ Mes thèmes
        </div>

        {!chargement && perso.length === 0 && (
          <p style={{ fontSize: ".68rem", color: C.gris, fontStyle: "italic", marginBottom: ".7rem" }}>
            Aucun thème perso pour l'instant.
          </p>
        )}

        {perso.map(p => (
          <div key={p.id} style={{ background: "rgba(139,94,0,.06)", border: "1px solid rgba(139,94,0,.2)", borderRadius: 12, padding: ".75rem .85rem", marginBottom: ".5rem" }}>
            <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", gap: ".5rem" }}>
              <div style={{ fontSize: ".82rem", fontWeight: 600, color: C.brun }}>{p.icon} {p.titre}</div>
              {estMelissa && (
                <button onClick={() => supprimerPerso(p.id)}
                  style={{ background: "none", border: "none", color: C.gris, fontSize: ".7rem", cursor: "pointer", flexShrink: 0 }}>✕</button>
              )}
            </div>
            {p.qui && <div style={{ fontSize: ".7rem", color: C.texte, lineHeight: 1.6, marginTop: ".3rem" }}>{p.qui}</div>}
            {p.produits?.length > 0 && (
              <div style={{ display: "flex", flexWrap: "wrap", gap: ".3rem", marginTop: ".4rem" }}>
                {p.produits.map(x => (
                  <span key={x} style={{ fontSize: ".62rem", background: C.blanc, color: C.brun, padding: ".18rem .45rem", borderRadius: 14 }}>{x}</span>
                ))}
              </div>
            )}
            {p.notes && <div style={{ fontSize: ".68rem", color: C.gris, lineHeight: 1.6, marginTop: ".4rem", whiteSpace: "pre-wrap" }}>{p.notes}</div>}
          </div>
        ))}

        {estMelissa && (
          <div style={{ background: C.blanc, border: "1px dashed " + C.pale, borderRadius: 12, padding: ".85rem", marginTop: ".6rem" }}>
            <div style={{ fontSize: ".72rem", fontWeight: 700, color: C.brun, marginBottom: ".6rem" }}>➕ Ajouter un thème</div>
            <div style={{ display: "flex", gap: ".4rem", marginBottom: ".45rem" }}>
              <input value={fIcon} onChange={e => setFIcon(e.target.value)} placeholder="💡"
                style={{ width: 52, padding: ".45rem", fontSize: ".8rem", textAlign: "center", border: "1px solid " + C.pale, borderRadius: 8 }} />
              <input value={fTitre} onChange={e => setFTitre(e.target.value)} placeholder="Accroche — le problème vécu"
                style={{ flex: 1, padding: ".45rem .6rem", fontSize: ".72rem", border: "1px solid " + C.pale, borderRadius: 8 }} />
            </div>
            <input value={fQui} onChange={e => setFQui(e.target.value)} placeholder="Qui se reconnaît dans ce thème ?"
              style={{ width: "100%", padding: ".45rem .6rem", fontSize: ".72rem", border: "1px solid " + C.pale, borderRadius: 8, marginBottom: ".45rem", boxSizing: "border-box" }} />
            <input value={fProduits} onChange={e => setFProduits(e.target.value)} placeholder="Produits, séparés par des virgules"
              style={{ width: "100%", padding: ".45rem .6rem", fontSize: ".72rem", border: "1px solid " + C.pale, borderRadius: 8, marginBottom: ".45rem", boxSizing: "border-box" }} />
            <textarea value={fNotes} onChange={e => setFNotes(e.target.value)} placeholder="Notes libres, idées d'angles…" rows={3}
              style={{ width: "100%", padding: ".45rem .6rem", fontSize: ".72rem", border: "1px solid " + C.pale, borderRadius: 8, marginBottom: ".5rem", boxSizing: "border-box", fontFamily: "inherit", resize: "vertical" }} />
            <button onClick={ajouterPerso} disabled={saving || !fTitre.trim()}
              style={{ width: "100%", background: fTitre.trim() ? "#8B5E00" : C.pale, color: "white", border: "none", borderRadius: 20, padding: ".55rem", fontSize: ".72rem", fontWeight: 600, cursor: fTitre.trim() ? "pointer" : "default" }}>
              {saving ? "..." : "Publier pour toute l'équipe"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
