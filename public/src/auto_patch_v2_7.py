#!/usr/bin/env python3
"""
Auto-patch Blazing Dynasty v2.6.0 -> v2.7.0
Usage: python3 auto_patch_v2_7.py App.js > App_v2_7.js
"""
import sys, re

if len(sys.argv) < 2:
    print("Usage: python3 auto_patch_v2_7.py <chemin_vers_App.js>")
    sys.exit(1)

with open(sys.argv[1], 'r', encoding='utf-8') as f:
    content = f.read()

print(f"[INFO] Fichier lu: {content.count(chr(10))} lignes", file=sys.stderr)

# ── 1. Version ──
content = content.replace('const APP_VERSION = "2.6.0";', 'const APP_VERSION = "2.7.0";')
print("[1/16] Version 2.7.0 ✓", file=sys.stderr)

# ── 2. Constantes Telegram ──
TELEGRAM = '''
// ── CONSTANTES TELEGRAM ──
const TELEGRAM_LIENS = [
  { label: "Canal principal Blazing Dynasty", url: "https://t.me/+2wKWxIROE4c1M2Q0", icon: "🔥" },
  { label: "Canal formation & ressources", url: "https://t.me/+pv0RY_JJy4wyYzE8", icon: "📚" },
];
'''
content = content.replace('const C={brun:"#3D1F0E"', TELEGRAM + '\nconst C={brun:"#3D1F0E"')
print("[2/16] Constantes Telegram ✓", file=sys.stderr)

# ── 3. FAST_START_MODULES ──
MODULES = '''
// ── MODULES FAST START ──
const FAST_START_MODULES = [
  { num:1, titre:"Bienvenue & Prise en main", icon:"🎉", description:"Découvrir l'équipe, l'application, et rejoindre nos canaux Telegram.",
    contenu:["Regarde la vidéo de bienvenue dans Formation → Démarrage Partie 1","Configure ton profil Mihi personnel dans l'espace Mihi","Rejoins les 2 canaux Telegram de l'équipe (liens ci-dessous 👇)","Présente-toi dans le canal Telegram en quelques mots"],
    exercice:{consigne:"Décris ton message de présentation dans le canal Telegram (ou colle le lien de ta capture d'écran).",type:"texte"} },
  { num:2, titre:"Connaître Mihi", icon:"🌿", description:"Les produits, les valeurs, la mission de la marque.",
    contenu:["Lis toute la section 'Comprendre Mihi' dans l'onglet Mihi","Découvre les 7 gammes et leurs points forts","Comprends les 3 façons de gagner de l'argent avec Mihi","Note les programmes clients : Infinity Bonus, Token Store, Smart Shopping"],
    exercice:{consigne:"Envoie ta liste des 3 produits Mihi préférés avec une phrase d'explication pour chacun.",type:"texte"} },
  { num:3, titre:"Mon histoire & Mon Pourquoi", icon:"💫", description:"Construire ton histoire personnelle — pourquoi tu as rejoint.",
    contenu:["Réfléchis aux 3 raisons qui t'ont motivée à rejoindre Blazing Dynasty","Lis les exemples de storytelling dans Formation → Contenu → Storytelling","Rédige ton 'Pourquoi' en 3-5 phrases authentiques (dans tes propres mots)","Évite les phrases trop formelles — parle comme tu parles naturellement"],
    exercice:{consigne:"Envoie ton texte 'Mon Pourquoi' à ta marraine (3 à 5 phrases sincères, dans tes mots).",type:"texte"} },
  { num:4, titre:"Mes premiers contacts", icon:"📱", description:"Construire ta liste de contacts et apprendre l'approche naturelle.",
    contenu:["Écris ta liste de 20 premiers contacts (famille, amis, collègues, voisins...)","Classe-les : 🔥 Chauds / 🌡️ Tièdes / ❄️ Froids","Lis les scripts de premier contact dans l'onglet Scripts","Identifie 3 personnes à contacter en priorité cette semaine"],
    exercice:{consigne:"Envoie ta liste de 10 contacts minimum (prénom + classement Chaud/Tiède/Froid).",type:"texte"} },
  { num:5, titre:"Présenter Mihi", icon:"🎯", description:"Savoir parler des produits et de l'opportunité naturellement.",
    contenu:["Regarde Formation → Démarrage Partie 2 (Post de lancement)","Lis les hooks et scripts dans Scripts → Vente produits","Apprends et pratique le pitch express 30 secondes à voix haute","Publie ton premier post ou story de lancement sur tes réseaux"],
    exercice:{consigne:"Envoie la capture d'écran (ou le lien) de ton premier post ou story de lancement.",type:"texte"} },
  { num:6, titre:"Mes premières ventes", icon:"💰", description:"Suivre une cliente, gérer une commande, fidéliser.",
    contenu:["Découvre comment fonctionne ta boutique Mihi personnelle","Lis 'Base du suivi client' dans Tableau de bord → Clients","Envoie 3 messages personnels à des contacts de ta liste chaude","Fais ta première présentation produit à une personne de ton entourage"],
    exercice:{consigne:"Envoie la confirmation de ta première vente OU le récapitulatif de ta première présentation produit (qui, quand, résultat).",type:"texte"} },
  { num:7, titre:"Je construis mon équipe", icon:"👑", description:"Parler de l'opportunité business, identifier tes premiers candidats.",
    contenu:["Regarde Formation → Recrutement → Stratégies pour attirer","Lis les scripts de recrutement dans Scripts → Recrutement équipe","Identifie 3 personnes pour qui l'opportunité serait parfaite","Envoie un premier message d'approche à l'une d'elles"],
    exercice:{consigne:"Envoie le prénom + une description de la personne approchée pour l'opportunité (et comment la conversation s'est passée).",type:"texte"} },
];

function isFastStartTermine(fastStartData) {
  if (!fastStartData || !fastStartData.startDate) return false;
  const modules = fastStartData.modules || {};
  return FAST_START_MODULES.every(m => modules[m.num]?.valide === true);
}
'''
pos = content.find('const FAST_START_DAYS=[')
if pos >= 0:
    content = content[:pos] + MODULES + '\n' + content[pos:]
    print("[3/16] FAST_START_MODULES ✓", file=sys.stderr)
else:
    print("[3/16] WARN: FAST_START_DAYS non trouvé", file=sys.stderr)

# ── 4. PopupBienvenue ──
# (code complet dans le fichier new_sections_full.jsx)
# Insérer juste avant function HomeRecap
with open('/mnt/user-data/outputs/new_sections_full.jsx', 'r', encoding='utf-8') as nf:
    new_sections = nf.read()

# Extraire PopupBienvenue depuis new_sections_full.jsx
popup_start = new_sections.find('const BIENVENUE_TEXTS =')
popup_end = new_sections.find('\n// ── 5. NOUVEAU FastStartTab')
if popup_start >= 0 and popup_end >= 0:
    popup_code = new_sections[popup_start:popup_end]
    pos = content.find('function HomeRecap(')
    if pos >= 0:
        content = content[:pos] + '\n// ── POPUP BIENVENUE ──\n' + popup_code + '\n' + content[pos:]
        print("[4/16] PopupBienvenue ✓", file=sys.stderr)
    else:
        print("[4/16] WARN: HomeRecap non trouvé", file=sys.stderr)
else:
    print("[4/16] WARN: PopupBienvenue non trouvé dans new_sections_full.jsx", file=sys.stderr)

# ── 5. FastStartTabV2 ──
faststart_start = new_sections.find('\nfunction FastStartTab(')
faststart_end = new_sections.find('\n\n\n// ── 6. COMPOSANT ExercicesFastStart')
if faststart_start >= 0 and faststart_end >= 0:
    faststart_code = new_sections[faststart_start:faststart_end]
    # Renommer en FastStartTabV2 dans ce code
    faststart_code = faststart_code.replace('function FastStartTab(', 'function FastStartTabV2(', 1)
    pos = content.find('function DashboardTab(')
    if pos >= 0:
        content = content[:pos] + faststart_code + '\n\n' + content[pos:]
        print("[5/16] FastStartTabV2 ✓", file=sys.stderr)
    else:
        print("[5/16] WARN: DashboardTab non trouvé", file=sys.stderr)

# ── 6. ExercicesFastStartTab + ExerciceCard ──
exo_start = new_sections.find('\nfunction ExercicesFastStartTab(')
exo_end = new_sections.find('\n\n\n// ── 7. MODIFICATION FORMATION')
if exo_start >= 0 and exo_end >= 0:
    exo_code = new_sections[exo_start:exo_end]
    pos = content.find('function DashboardTab(')
    if pos >= 0:
        content = content[:pos] + exo_code + '\n\n' + content[pos:]
        print("[6/16] ExercicesFastStartTab ✓", file=sys.stderr)

# ── 7. États fastStartTermine et showBienvenue ──
old = 'const[lang,setLang]=useState("fr");'
new = 'const[lang,setLang]=useState("fr");\n  const[fastStartTermine,setFastStartTermine]=useState(false);\n  const[showBienvenue,setShowBienvenue]=useState(false);'
content = content.replace(old, new)
print("[7/16] États fastStartTermine + showBienvenue ✓", file=sys.stderr)

# ── 8. Charger fastStartTermine dans load() ──
old = "      if(data.notes)  setNotes(data.notes);\n    }catch{}\n    setLoading(false);\n  },[]);"
new = """      if(data.notes)  setNotes(data.notes);
      if(data["db-fast-start-v2"]){try{const fs=JSON.parse(data["db-fast-start-v2"]);const mods=fs.modules||{};const termine=FAST_START_MODULES.every(m=>mods[m.num]?.valide===true);setFastStartTermine(termine);}catch{}}
    }catch{}
    setLoading(false);
  },[]);"""
content = content.replace(old, new)
print("[8/16] Chargement fastStartTermine ✓", file=sys.stderr)

# ── 9. Popup après auto-login ──
old = "          setUserId(uid);setName(n);\n          setScreen(\"app\");load(uid);\n        } else {"
new = '          setUserId(uid);setName(n);\n          setScreen("app");load(uid);\n          try{if(!localStorage.getItem("bd-bienvenue-"+uid)){setTimeout(()=>setShowBienvenue(true),2000);}}catch{}\n        } else {'
content = content.replace(old, new)
print("[9/16] Popup auto-login ✓", file=sys.stderr)

# ── 10. Popup après confirmerChef ──
old = "      setUserId(pendingUid);setName(pendingName);setScreen(\"app\");load(pendingUid);\n      saveFCMToken(pendingUid);"
new = '      setUserId(pendingUid);setName(pendingName);setScreen("app");load(pendingUid);\n      try{if(!localStorage.getItem("bd-bienvenue-"+pendingUid)){setTimeout(()=>setShowBienvenue(true),2000);}}catch{}\n      saveFCMToken(pendingUid);'
content = content.replace(old, new)
print("[10/16] Popup confirmerChef ✓", file=sys.stderr)

# ── 11. Afficher PopupBienvenue dans return App() ──
old = "      {/* WATERMARK invisible"
new = '      {showBienvenue&&(<PopupBienvenue lang={lang} onClose={()=>{setShowBienvenue(false);try{localStorage.setItem("bd-bienvenue-"+userId,"1");}catch{};}} onGoFastStart={()=>{setTab("dashboard");setShowBienvenue(false);try{localStorage.setItem("bd-bienvenue-"+userId,"1");}catch{};}}/>)}\n\n      {/* WATERMARK invisible'
content = content.replace(old, new)
print("[11/16] PopupBienvenue dans return ✓", file=sys.stderr)

# ── 12. Bloquer FORMATION_TABS ──
old_map = """            {FORMATION_TABS.map(f=>(
              <div key={f.id} onClick={()=>setFormationSubTab(f.id)}
                style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:"pointer"}}>
                <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
                  <div style={{width:38,height:38,borderRadius:"50%",background:f.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{f.icon}</div>
                  <div>
                    <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:C.brun}}>{f.label.replace(/^\\S+\\s/,"")}</div>
                    <div style={{fontSize:".66rem",color:C.gris}}>{f.desc}</div>
                  </div>
                </div>
                <span style={{color:C.pale}}>›</span>
              </div>
            ))}"""
new_map = """            {FORMATION_TABS.map(f=>{
              const toujoursAccessible=f.id==="formationapp";
              const isMelissaUser=userId==="melissa"||userId==="melissa-da-silveira";
              const bloque=!fastStartTermine&&!isChefApp&&!isMelissaUser&&!toujoursAccessible;
              return(
                <div key={f.id} onClick={()=>!bloque&&setFormationSubTab(f.id)}
                  style={{display:"flex",justifyContent:"space-between",alignItems:"center",background:bloque?C.creme:C.blanc,border:`1px solid ${C.pale}`,borderRadius:12,padding:".8rem 1rem",marginBottom:".5rem",cursor:bloque?"default":"pointer",opacity:bloque?.55:1}}>
                  <div style={{display:"flex",alignItems:"center",gap:".7rem"}}>
                    <div style={{width:38,height:38,borderRadius:"50%",background:f.col+"20",display:"flex",alignItems:"center",justifyContent:"center",fontSize:"1.1rem",flexShrink:0}}>{f.icon}</div>
                    <div>
                      <div style={{fontFamily:"Georgia,serif",fontSize:".92rem",fontWeight:600,color:bloque?C.gris:C.brun}}>{f.label.replace(/^\S+\s/,"")}</div>
                      <div style={{fontSize:".66rem",color:C.gris}}>{bloque?"🔒 Terminer le Fast Start pour débloquer":f.desc}</div>
                    </div>
                  </div>
                  <span style={{color:bloque?C.pale:C.pale}}>{bloque?"🔒":"›"}</span>
                </div>
              );
            })}"""
if old_map in content:
    content = content.replace(old_map, new_map)
    print("[12/16] Blocage Formation ✓", file=sys.stderr)
else:
    print("[12/16] WARN: map Formation non trouvé (pattern légèrement différent?)", file=sys.stderr)
    # Try simplified version
    simple_old = "            {FORMATION_TABS.map(f=>(\n              <div key={f.id} onClick={()=>setFormationSubTab(f.id)}"
    if simple_old in content:
        # Find and replace the whole block
        start = content.find(simple_old)
        end = content.find("\n            ))}", start) + len("\n            ))}")
        content = content[:start] + new_map + content[end:]
        print("[12/16] Blocage Formation ✓ (fallback)", file=sys.stderr)

# ── 13. Telegram dans BanqueImagesTab ──
old_banque = '      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>\n        Télécharge les visuels et témoignages pour tes publications.\n      </p>\n\n      {isMelissa'
new_banque = '      <p style={{fontSize:".74rem",color:C.gris,marginBottom:"1rem",lineHeight:1.65}}>\n        Télécharge les visuels et témoignages pour tes publications.\n      </p>\n      <div style={{background:"#EFF9FF",border:"1px solid #2AABEE30",borderRadius:14,padding:"1.1rem",marginBottom:"1rem"}}>\n        <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".1em",textTransform:"uppercase",color:"#2AABEE",marginBottom:".6rem"}}>✈️ Canaux Telegram de l\'équipe</div>\n        <p style={{fontSize:".74rem",color:C.gris,marginBottom:".8rem",lineHeight:1.6}}>Rejoins nos canaux pour rester connectée, recevoir les actus et ne rien manquer !</p>\n        {TELEGRAM_LIENS.map(lien=>(<a key={lien.url} href={lien.url} target="_blank" rel="noopener noreferrer" style={{display:"flex",alignItems:"center",gap:".65rem",background:"#2AABEE",borderRadius:10,padding:".65rem .9rem",textDecoration:"none",marginBottom:".45rem"}}><span style={{fontSize:"1.1rem"}}>✈️</span><div style={{flex:1}}><div style={{fontSize:".78rem",fontWeight:700,color:"white"}}>{lien.icon} {lien.label}</div></div><span style={{color:"rgba(255,255,255,.7)",fontSize:".65rem"}}>→</span></a>))}\n      </div>\n\n      {isMelissa'
if old_banque in content:
    content = content.replace(old_banque, new_banque)
    print("[13/16] Telegram BanqueImages ✓", file=sys.stderr)
else:
    print("[13/16] WARN: BanqueImages pattern non trouvé", file=sys.stderr)

# ── 14. FastStartTabV2 dans DashboardTab ──
old_fs = '{dtab==="faststart"&&<FastStartTab uid={uid} userName={userName} goToFormation={goToFormation}/>'
new_fs = '{dtab==="faststart"&&<FastStartTabV2 uid={uid} userName={userName} goToFormation={goToFormation}/>'
if old_fs in content:
    content = content.replace(old_fs, new_fs)
    print("[14/16] FastStartTabV2 utilisé ✓", file=sys.stderr)
else:
    print("[14/16] WARN: render FastStartTab non trouvé", file=sys.stderr)

# ── 15. Exercices Fast Start dans ESPACE_CHEF_SECTIONS ──
old_ecs = 'const ESPACE_CHEF_SECTIONS=[\n  {id:"membres"'
new_ecs = 'const ESPACE_CHEF_SECTIONS=[\n  {id:"exercices-faststart",icon:"📝",label:"Exercices Fast Start",desc:"Valider les exercices de tes filleules — débloque leur module suivant",chefOnly:false},\n  {id:"membres"'
if old_ecs in content:
    content = content.replace(old_ecs, new_ecs)
    print("[15/16] Exercices Fast Start dans ESPACE_CHEF_SECTIONS ✓", file=sys.stderr)
else:
    print("[15/16] WARN: ESPACE_CHEF_SECTIONS non trouvé", file=sys.stderr)

# ── 16. Navigation vers ExercicesFastStartTab ──
old_nav = '        {section==="suivica"&&<SuiviCATab uid={uid}/>'
new_nav = '        {section==="exercices-faststart"&&<ExercicesFastStartTab uid={uid} userName={userName}/>}\n        {section==="suivica"&&<SuiviCATab uid={uid}/>'
if old_nav in content:
    content = content.replace(old_nav, new_nav)
    print("[16/16] Navigation ExercicesFastStartTab ✓", file=sys.stderr)
else:
    print("[16/16] WARN: section suivica non trouvé", file=sys.stderr)

print(f"\n[DONE] Fichier final: {content.count(chr(10))} lignes", file=sys.stderr)
sys.stdout.write(content)
