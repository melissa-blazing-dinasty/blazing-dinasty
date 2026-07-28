# =====================================================================
#  Blazing Dynasty - Ajout formation "Arrete de vouloir tout vendre"
#  Cible : App.js > module Formation > sous-onglet Vente
#  Insertion juste avant <BoutonTermineFormation subTab="vente"/>
# =====================================================================

$ErrorActionPreference = "Stop"
$app = "C:\Users\melou\blazing-dynasty\src\App.js"

if (-not (Test-Path $app)) { Write-Host "ABANDON : App.js introuvable." -ForegroundColor Red; exit 1 }

# ---------- SAUVEGARDE ----------
$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "C:\Users\melou\blazing-dynasty\App.js.backup-$stamp"
Copy-Item $app $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Cyan

# ---------- LECTURE ----------
$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content   = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
$tailleAvant = $content.Length
Write-Host "Taille avant : $tailleAvant caracteres" -ForegroundColor Gray

# ---------- VERIFICATIONS ----------
$ancre = '<BoutonTermineFormation subTab="vente"/>'
$nb = ([regex]::Matches($content, [regex]::Escape($ancre))).Count
if ($nb -ne 1) {
    Write-Host "ABANDON : ancre trouvee $nb fois (attendu : 1)." -ForegroundColor Red
    exit 1
}
Write-Host "Ancre OK (1 occurrence)." -ForegroundColor Green

if ($content -match "Arrete de vouloir tout vendre" -or $content -match "Arr\u00eate de vouloir tout vendre") {
    Write-Host "ABANDON : la formation semble deja presente. Script deja passe ?" -ForegroundColor Red
    exit 1
}

$ancreDate = 'vente:"2026-07-09"'
$nbDate = ([regex]::Matches($content, [regex]::Escape($ancreDate))).Count
if ($nbDate -ne 1) {
    Write-Host "ATTENTION : date de MAJ non trouvee ($nbDate occurrence). Le badge NOUVEAU ne sera pas mis a jour." -ForegroundColor Yellow
}

# ---------- CONTENU JSX ----------
$jsx = @'
{/* ── FORMATION : ARRETE DE VOULOIR TOUT VENDRE ── */}
<Card title="Arrête de vouloir tout vendre" sub="1 produit par période · 7 angles · la méthode" icon="⚠️" color={C.or} defaultOpen>

  <Info color={C.or}>
    <strong>La formation la plus importante de cet onglet.</strong> Si tu n'en appliques qu'une, prends celle-là. Elle ne te demande pas de travailler plus — elle te demande de travailler sur <em>moins de produits</em>.
  </Info>

  {/* 1. LE PIEGE */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>1 · Le piège du catalogue</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Ne cherche pas à couvrir le catalogue. C'est le réflexe naturel, et c'est exactement le piège : avec 400 produits, si tu en montres un nouveau chaque jour, <strong>personne ne voit jamais deux fois le même</strong>.
  </p>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Et on n'achète pas ce qu'on a vu une seule fois. On achète ce qu'on a vu assez souvent pour s'en souvenir le jour où le besoin arrive.
  </p>
  <div style={{background:"rgba(139,94,0,.08)",borderLeft:"3px solid "+C.or,padding:".7rem .8rem",borderRadius:"0 8px 8px 0",marginBottom:".6rem"}}>
    <div style={{fontSize:".72rem",color:C.brun,lineHeight:1.6}}>
      <strong>400 produits qui défilent = 0 produit installé.</strong><br/>
      17 produits travaillés en profondeur = 17 produits que ton audience connaît par cœur.
    </div>
  </div>

  {/* 2. LA REGLE */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>2 · La règle : 1 produit par période</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Tu as environ <strong>7 créneaux produit par période</strong>. Utilise-les <strong>tous sur le même produit</strong>, traité sous 7 angles différents.
  </p>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Ça paraît répétitif quand tu le prépares. Ça ne l'est jamais pour celle qui te lit : elle ne voit qu'une fraction de ce que tu publies. Ce qui te semble lourd, elle le vit comme « ah tiens, encore ce truc — ça doit être bien ».
  </p>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Résultat sur l'année : <strong>17 produits vraiment installés</strong> dans la tête de ton audience, au lieu de 400 qui défilent.
  </p>

  {/* 3. LES 7 ANGLES */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>3 · Les 7 angles pour un seul produit</div>
  {[
    ["1","🎯","Le problème — pas le produit","Tu n'ouvres jamais par le nom du produit. Tu ouvres par la sensation. « Ta peau tire après la douche ? » « Ce moment où tu te relèves du canapé et t'as mal partout. » Elle doit se reconnaître avant de savoir que tu vends quelque chose."],
    ["2","🎬","Ta routine, filmée","Comment tu l'utilises vraiment. Pas une démo léchée — le vrai geste, la vraie texture, la quantité réelle. C'est ce qui transforme un produit abstrait en objet qu'on imagine dans sa salle de bain."],
    ["3","💶","Le prix — la comparaison au litre","Ton hook le plus partagé. Ramène le prix au litre ou à la dose, et compare à une marque connue. Le chiffre fait le travail tout seul, tu n'as pas besoin d'en rajouter."],
    ["4","🚫","Pour qui ce n'est PAS","L'angle honnête, et celui qui crédibilise les six autres. « Si tu cherches un effet immédiat, passe ton chemin. » Dire à qui un produit ne convient pas est le signal le plus fort que tu ne racontes pas n'importe quoi."],
    ["5","💬","Le retour cliente","Avec son accord, et sans promesse de résultat. Un message brut vaut mieux qu'un témoignage reformulé — les gens reconnaissent instantanément le vrai du fabriqué."],
    ["6","😬","L'objection frontale","Tu dis toi-même ce qu'on pense tout bas. « Oui, c'est une marque que tu ne connais pas. Parlons-en. » Prendre l'objection en premier te met du côté de ta cliente, pas en face d'elle."],
    ["7","⏳","Le rappel de fin de période","La promo se termine, tu le dis. Simplement, sans faux compte à rebours et sans « dernières pièces » inventé. L'urgence honnête fonctionne. L'urgence fabriquée te grille pour de bon."],
  ].map(([n,ic,t,d])=>(
    <div key={n} style={{display:"flex",gap:".7rem",alignItems:"flex-start",marginBottom:".7rem"}}>
      <div style={{minWidth:"1.7rem",height:"1.7rem",borderRadius:"50%",background:C.or,color:"#fff",display:"flex",alignItems:"center",justifyContent:"center",fontSize:".7rem",fontWeight:700,flexShrink:0}}>{n}</div>
      <div>
        <div style={{fontSize:".76rem",fontWeight:700,color:C.brun,marginBottom:".15rem"}}>{ic} {t}</div>
        <div style={{fontSize:".71rem",color:C.texte,lineHeight:1.6}}>{d}</div>
      </div>
    </div>
  ))}

  {/* 4. PLAN DE PERIODE */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>4 · Ton plan de période, clé en main</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".7rem"}}>
    Tu n'as pas à réfléchir à l'ordre : il est déjà pensé pour amener ta cliente d'un point A à un point B.
  </p>
  {[
    ["Semaine 1","Tu installes le produit",["Angle 1 — Le problème","Angle 2 — Ta routine filmée"],C.rose],
    ["Semaine 2","Tu construis la valeur",["Angle 3 — Le prix au litre","Angle 4 — Pour qui ce n'est pas","Angle 5 — Le retour cliente"],C.lilas],
    ["Semaine 3","Tu lèves les freins",["Angle 6 — L'objection frontale","Angle 7 — Le rappel de fin de période"],C.or],
  ].map(([sem,but,items,col])=>(
    <div key={sem} style={{border:"1px solid rgba(139,94,0,.18)",borderRadius:"10px",padding:".7rem .8rem",marginBottom:".55rem",background:"rgba(255,255,255,.4)"}}>
      <div style={{display:"flex",justifyContent:"space-between",alignItems:"baseline",marginBottom:".4rem",flexWrap:"wrap",gap:".3rem"}}>
        <span style={{fontSize:".78rem",fontWeight:700,color:col}}>{sem}</span>
        <span style={{fontSize:".66rem",color:C.gris,fontStyle:"italic"}}>{but}</span>
      </div>
      {items.map(it=>(
        <div key={it} style={{fontSize:".71rem",color:C.texte,lineHeight:1.7,paddingLeft:".2rem"}}>• {it}</div>
      ))}
    </div>
  ))}

  {/* 5. CHOISIR SES 17 */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>5 · Comment choisir tes 17 héros</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Ne choisis pas au feeling. Ouvre ton back-office et sors <strong>tes ventes des 6 derniers mois</strong>. Tu vas découvrir que 10 à 15 références font la grande majorité de ton volume. Ce sont tes héros — tu les gardes toute l'année.
  </p>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Pour arbitrer les places restantes, deux critères :
  </p>
  {[
    ["🔁","Consommable avant tout","Un soin qui se termine en 6 semaines rapporte dix fois plus qu'un appareil acheté une fois. Ton PGV a besoin de récurrence, pas de nouveautés."],
    ["📅","Aligné sur le catalogue en cours","Chaque période a ses promos. Un produit en promo te donne un argument prix concret — c'est le moment de le pousser, pas dans trois mois."],
  ].map(([ic,t,d])=>(
    <div key={t} style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:".55rem"}}>
      <span style={{fontSize:"1rem",flexShrink:0}}>{ic}</span>
      <div>
        <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>{t}</div>
        <div style={{fontSize:".71rem",color:C.texte,lineHeight:1.6}}>{d}</div>
      </div>
    </div>
  ))}

  {/* 6. SEMAINES A THEME */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>6 · Organise par problème vécu, pas par catégorie</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Les semaines à thème : oui. Mais pas par catégorie. « Semaine crèmes », « semaine compléments » — c'est de la logique de catalogue. Ça ne parle qu'à celles qui cherchent déjà.
  </p>
  <div style={{background:"rgba(139,94,0,.06)",borderRadius:"10px",padding:".7rem .8rem",marginBottom:".6rem"}}>
    <div style={{fontSize:".64rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:C.gris,marginBottom:".4rem"}}>Organise plutôt comme ça</div>
    {["La peau qui tire","La fatigue de fin de journée","Les cheveux qui cassent","Le ventre gonflé après les repas"].map(x=>(
      <div key={x} style={{fontSize:".72rem",color:C.brun,fontWeight:600,lineHeight:1.8}}>• {x}</div>
    ))}
  </div>
  <div style={{background:"rgba(196,120,140,.1)",borderLeft:"3px solid "+C.rose,padding:".7rem .8rem",borderRadius:"0 8px 8px 0",marginBottom:".6rem"}}>
    <div style={{fontSize:".72rem",color:C.brun,lineHeight:1.7}}>
      Une femme ne se dit <strong>jamais</strong> « il me faut un sérum ».<br/>
      Elle se dit « j'ai une sale tête ce matin ».<br/>
      <em>Tu entres par là, le produit arrive après.</em>
    </div>
  </div>

  {/* 7. GARDE-FOU */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:"#B3261E",marginTop:"1.2rem",marginBottom:".5rem"}}>7 · Le garde-fou — compléments alimentaires</div>
  <div style={{border:"1.5px solid rgba(179,38,30,.35)",background:"rgba(179,38,30,.05)",borderRadius:"10px",padding:".8rem"}}>
    <div style={{fontSize:".74rem",color:C.brun,lineHeight:1.7,marginBottom:".6rem"}}>
      <strong>⚠️ À lire avant de publier.</strong> Sur tout ce qui est complément alimentaire, reste dans les allégations autorisées et ne laisse <strong>jamais</strong> entendre un effet de type médicament. C'est le sujet sur lequel la DGCCRF est la plus attentive — et c'est aussi celui où tes concurrentes se plantent le plus souvent. Donc où ta rigueur se voit.
    </div>
    <div style={{display:"grid",gridTemplateColumns:"1fr",gap:".5rem"}}>
      <div>
        <div style={{fontSize:".66rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#2E7D32",marginBottom:".25rem"}}>✅ Tu peux dire</div>
        {["« Contribue à réduire la fatigue »","« Participe au maintien d'une peau normale »","« Ce que moi j'ai ressenti, sans promesse pour toi »","« Complément d'une alimentation variée »"].map(x=>(
          <div key={x} style={{fontSize:".7rem",color:C.texte,lineHeight:1.7}}>{x}</div>
        ))}
      </div>
      <div>
        <div style={{fontSize:".66rem",fontWeight:700,textTransform:"uppercase",letterSpacing:".08em",color:"#B3261E",marginBottom:".25rem"}}>❌ Tu ne peux pas dire</div>
        {["« Soigne », « guérit », « traite »","« Fait perdre X kilos »","« Remplace ton traitement »","Un avant/après présenté comme un résultat garanti"].map(x=>(
          <div key={x} style={{fontSize:".7rem",color:C.texte,lineHeight:1.7}}>{x}</div>
        ))}
      </div>
    </div>
    <div style={{fontSize:".68rem",color:C.gris,fontStyle:"italic",marginTop:".6rem",lineHeight:1.6}}>
      En cas de doute sur une formulation : demande-la-moi en message avant de publier. Ça prend deux minutes et ça t'évite un vrai problème.
    </div>
  </div>

  {/* 8. ERREURS */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>8 · Les 4 erreurs qui tuent la méthode</div>
  {[
    ["Craquer au bout de 3 jours","Tu vas trouver ça répétitif bien avant ton audience. C'est normal, et ce n'est pas un signal. Tiens la période complète — c'est justement à partir du 4e ou 5e contenu que ça commence à payer."],
    ["Changer de produit parce qu'un post a mal marché","Un contenu qui ne performe pas ne condamne pas le produit. Il condamne l'angle. Passe au suivant, garde le produit."],
    ["Empiler deux produits dans le même contenu","Dès qu'il y a un choix à faire, il n'y a plus de décision. Un contenu = un produit = un angle."],
    ["Attendre la nouveauté pour se relancer","La nouveauté flatte ton envie de variété, pas les ventes. Tes héros paient tes factures, pas le dernier lancement."],
  ].map(([t,d],i)=>(
    <div key={t} style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:".55rem"}}>
      <span style={{fontSize:".9rem",flexShrink:0}}>❌</span>
      <div>
        <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>{t}</div>
        <div style={{fontSize:".71rem",color:C.texte,lineHeight:1.6}}>{d}</div>
      </div>
    </div>
  ))}

  {/* 9. MESURER */}
  <div style={{fontSize:".6rem",fontWeight:700,letterSpacing:".12em",textTransform:"uppercase",color:C.or,marginTop:"1.2rem",marginBottom:".5rem"}}>9 · Comment savoir si ça marche</div>
  <p style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
    Pas les likes. Les likes ne t'ont jamais payé une facture. Regarde ces trois chiffres à la fin de chaque période :
  </p>
  {[
    ["💬","Messages reçus sur le produit","Le vrai thermomètre. Si les angles fonctionnent, on te pose des questions."],
    ["🔁","Partages / enregistrements","Surtout sur l'angle prix. C'est le signal que ton contenu circule au-delà de tes abonnées."],
    ["🛍️","Ventes attribuées à ce produit","Compare avec la période précédente sur un produit traité à l'ancienne. L'écart te dira tout."],
  ].map(([ic,t,d])=>(
    <div key={t} style={{display:"flex",gap:".6rem",alignItems:"flex-start",marginBottom:".5rem"}}>
      <span style={{fontSize:"1rem",flexShrink:0}}>{ic}</span>
      <div>
        <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>{t}</div>
        <div style={{fontSize:".71rem",color:C.texte,lineHeight:1.6}}>{d}</div>
      </div>
    </div>
  ))}

  {/* 10. CTA */}
  <div style={{marginTop:"1.3rem",background:"linear-gradient(135deg,rgba(139,94,0,.12),rgba(196,120,140,.12))",border:"1.5px solid rgba(139,94,0,.25)",borderRadius:"12px",padding:".9rem"}}>
    <div style={{fontSize:".82rem",fontWeight:700,color:C.brun,marginBottom:".45rem"}}>🎯 Ton plan pour cette période</div>
    <div style={{fontSize:".72rem",color:C.texte,lineHeight:1.7,marginBottom:".6rem"}}>
      Regarde quel produit est en promo au catalogue en cours. Croise avec tes 3 meilleures ventes des 6 derniers mois. <strong>Prends celui qui coche les deux.</strong> C'est ton produit de la période, tu ne le lâches plus pendant 3 semaines.
    </div>
    <div style={{fontSize:".72rem",color:C.brun,lineHeight:1.7,fontWeight:600,borderTop:"1px solid rgba(139,94,0,.2)",paddingTop:".55rem"}}>
      ✍️ Écris-moi ton produit en message — je te rédige tes 7 angles en détail, prêts à publier.
    </div>
  </div>

</Card>
'@

# ---------- INSERTION ----------
$content = $content.Replace($ancre, $jsx + "`r`n" + $ancre)

# ---------- MAJ DATE (badge NOUVEAU) ----------
if ($nbDate -eq 1) {
    $content = $content.Replace($ancreDate, 'vente:"2026-07-28"')
    Write-Host "Date de MAJ Vente -> 2026-07-28 (badge NOUVEAU active)." -ForegroundColor Green
}

# ---------- CONTROLE ----------
$tailleApres = $content.Length
$delta = $tailleApres - $tailleAvant
Write-Host "Taille apres : $tailleApres caracteres (+$delta)" -ForegroundColor Gray
if ($delta -lt 5000) {
    Write-Host "ABANDON : insertion trop petite, rien n'a ete ecrit." -ForegroundColor Red
    exit 1
}

# ---------- ECRITURE ----------
[System.IO.File]::WriteAllText($app, $content, $utf8NoBom)
Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Green
Write-Host "Etape suivante : npm run build" -ForegroundColor Yellow
Write-Host "Si le build echoue : Copy-Item '$backup' '$app' -Force" -ForegroundColor Yellow
