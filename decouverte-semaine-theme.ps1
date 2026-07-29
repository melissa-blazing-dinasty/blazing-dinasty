# =====================================================================
#  Blazing Dynasty - Tour Decouverte "Semaine a theme"
#  Ajoute la cle semainetheme dans l'objet DECOUVERTE de App.js
# =====================================================================

$ErrorActionPreference = "Stop"
$app = "C:\Users\melou\blazing-dynasty\src\App.js"
if (-not (Test-Path $app)) { Write-Host "ABANDON : App.js introuvable." -ForegroundColor Red; exit 1 }

$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "C:\Users\melou\blazing-dynasty\App.js.backup-$stamp"
Copy-Item $app $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content   = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
$avant = $content.Length
Write-Host "Taille avant : $avant" -ForegroundColor Gray

if ($content -match "semainetheme: \[") {
    Write-Host "ABANDON : le tour existe deja." -ForegroundColor Red; exit 1
}

$ancre = "  objectifs: ["
$nb = ([regex]::Matches($content, [regex]::Escape($ancre))).Count
if ($nb -ne 1) { Write-Host "ABANDON : ancre trouvee $nb fois (attendu 1)." -ForegroundColor Red; exit 1 }
Write-Host "Ancre OK." -ForegroundColor Green

$bloc = @'
  semainetheme: [
    {titre:"Bienvenue !", texte:"Ici, tu ne cherches plus quoi poster. Tu choisis un th\u00E8me le lundi, et tu as ta p\u00E9riode enti\u00E8re de contenu. 31 th\u00E8mes, 7 angles chacun, d\u00E9j\u00E0 \u00E9crits. On regarde \u00E7a ensemble !", icon:"\uD83D\uDC4B"},
    {titre:"Un th\u00E8me = un probl\u00E8me v\u00E9cu", texte:"Regarde les titres : ma peau tire, je grignote l\u2019apr\u00E8s-midi, mes vitres ont des traces. Jamais les soins visage. Une femme ne se dit jamais il me faut un s\u00E9rum. Elle se dit j\u2019ai une sale t\u00EAte ce matin. Tu entres par l\u00E0, le produit arrive apr\u00E8s.", icon:"\uD83C\uDFAF"},
    {titre:"Trouve ton th\u00E8me", texte:"Utilise les filtres en haut : par famille, ou Jamais fait pour voir ce que tu n\u2019as pas encore exploit\u00E9. Astuce : croise avec le produit en promo au catalogue en cours, c\u2019est l\u00E0 que tu auras le meilleur argument prix.", icon:"\uD83D\uDD0D"},
    {titre:"Tes 7 angles", texte:"Ouvre un th\u00E8me : tu trouves 7 fa\u00E7ons de parler du m\u00EAme produit. Copie l\u2019angle avec le bouton Copier, puis r\u00E9\u00E9cris-le avec tes mots. C\u2019est un point de d\u00E9part, pas un texte \u00E0 publier tel quel. Tes clientes doivent reconna\u00EEtre ta voix.", icon:"\u270F"},
    {titre:"Les encadr\u00E9s rouges", texte:"Sur les compl\u00E9ments et les produits m\u00E9nagers, respecte les formulations indiqu\u00E9es. Antibact\u00E9rien ou fait maigrir peuvent te causer de vrais ennuis. En cas de doute sur une phrase, demande avant de publier.", icon:"\u26A0"},
    {titre:"Coche ce que tu as fait", texte:"Le bouton J\u2019ai fait ce th\u00E8me garde ton historique. En un coup d\u2019oeil tu vois ce que tu as d\u00E9j\u00E0 exploit\u00E9 et ce qui dort encore. Les th\u00E8mes jamais faits sont marqu\u00E9s en rose.", icon:"\u2705"},
    {titre:"Bravo, tu es pr\u00EAte !", texte:"Toute la m\u00E9thode est expliqu\u00E9e dans Formation puis Vente puis Arr\u00EAte de vouloir tout vendre. Cet onglet, c\u2019est la mise en pratique. Un th\u00E8me par p\u00E9riode, et tu ne cherches plus jamais quoi poster.", icon:"\uD83C\uDF89"},
  ],
'@

$content = $content.Replace($ancre, $bloc + "`r`n" + $ancre)

$apres = $content.Length
$delta = $apres - $avant
Write-Host "Taille apres : $apres (+$delta)" -ForegroundColor Gray
if ($delta -lt 1200 -or $delta -gt 3500) {
    Write-Host "ABANDON : delta inattendu ($delta). Rien ecrit." -ForegroundColor Red; exit 1
}

[System.IO.File]::WriteAllText($app, $content, $utf8NoBom)
Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Green
Write-Host "Etape suivante : npm run build" -ForegroundColor Yellow
Write-Host "Si echec : Copy-Item '$backup' '$app' -Force" -ForegroundColor Yellow
