$lines = [System.IO.File]::ReadAllLines("C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js", [System.Text.Encoding]::UTF8)

# Catalogue
$lines[85] = "  let catalogueText = '';"
$lines[86] = "  try {"
$lines[87] = "    const catSnap = await getDoc(doc(db,'admin','formation_produits'));"
$lines[88] = "    if(catSnap.exists()){"
$lines[89] = "      const allP = catSnap.data().produits || {};"
$lines[90] = "      let cles = [];"
$lines[91] = "      if(type==='skincare') cles=['skincare','problematiques'];"
$lines[92] = "      else if(type==='cheveux') cles=['cheveux'];"
$lines[93] = "      else if(['sante','silhouette','detox','antiage'].includes(type)) cles=['complement','poids'];"
$lines[94] = "      else if(type==='makeup') cles=['makeup'];"
$lines[95] = "      else if(type==='peaucorps') cles=['corpsoin','problematiques'];"
$lines[96] = "      else cles=Object.keys(allP);"
$lines[97] = "      let prods=[];"
$lines[98] = "      cles.forEach(c=>{ prods=[...prods,...(allP[c]||[])]; });"
$lines[99] = "      if(prods.length>30) prods=prods.slice(0,30);"
$lines[100] = "      catalogueText = prods.map(p=>p.nom+(p.prix?' - '+p.prix+'€':'')).join('\n');"
$lines[101] = "    }"
$lines[102] = "  } catch(e){}"
$lines[103] = ""
$lines[104] = ""

[System.IO.File]::WriteAllLines("C:\Users\melou\blazing-dynasty\src\DiagnosticsTab.js", $lines, [System.Text.Encoding]::UTF8)
Write-Host "Done catalogue"
