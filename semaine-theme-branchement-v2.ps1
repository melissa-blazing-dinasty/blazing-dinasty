# =====================================================================
#  Blazing Dynasty - Branchement de l'onglet "Semaine a theme"  (v2)
#  Correctif : ConvertFromUtf32 pour les emojis hors BMP
# =====================================================================

$ErrorActionPreference = "Stop"
$src = "C:\Users\melou\blazing-dynasty\src"
$app = "$src\App.js"
$mod = "$src\SemaineThemeTab.js"

if (-not (Test-Path $app)) { Write-Host "ABANDON : App.js introuvable." -ForegroundColor Red; exit 1 }
if (-not (Test-Path $mod)) {
    Write-Host "ABANDON : SemaineThemeTab.js absent de src\." -ForegroundColor Red
    exit 1
}

# ---------- SAUVEGARDE ----------
$stamp  = Get-Date -Format "yyyyMMdd-HHmmss"
$backup = "C:\Users\melou\blazing-dynasty\App.js.backup-$stamp"
Copy-Item $app $backup -Force
Write-Host "Sauvegarde : $backup" -ForegroundColor Cyan

$utf8NoBom = New-Object System.Text.UTF8Encoding($false)
$content   = [System.IO.File]::ReadAllText($app, [System.Text.Encoding]::UTF8)
$avant = $content.Length
Write-Host "Taille avant : $avant" -ForegroundColor Gray

if ($content -match "SemaineThemeTab") {
    Write-Host "ABANDON : deja branche. Script deja passe ?" -ForegroundColor Red
    exit 1
}

# ---------- 1. IMPORT ----------
$a1 = "import { FormationProduitsTab"
if (([regex]::Matches($content, [regex]::Escape($a1))).Count -ne 1) {
    Write-Host "ABANDON : ancre import introuvable ou multiple." -ForegroundColor Red; exit 1
}
$content = $content.Replace($a1, "import { SemaineThemeTab } from './SemaineThemeTab';`r`n" + $a1)
Write-Host "1/3 Import ajoute." -ForegroundColor Green

# ---------- 2. SOUS-ONGLET (avant Sprint) ----------
$eclair = [char]0x26A1
$agenda = [char]::ConvertFromUtf32(0x1F5D3) + [char]0xFE0F

$a2 = '{id:"sprint",label:"' + $eclair + ' Sprint"},'
if (([regex]::Matches($content, [regex]::Escape($a2))).Count -ne 1) {
    Write-Host "ABANDON : ancre sous-onglet Sprint introuvable ou multiple." -ForegroundColor Red; exit 1
}
$nouveau = '{id:"semainetheme",label:"' + $agenda + ' Semaine a theme"},'
$content = $content.Replace($a2, $nouveau + "`r`n    " + $a2)
Write-Host "2/3 Sous-onglet insere avant Sprint." -ForegroundColor Green

# ---------- 3. RENDU ----------
$a3 = '{tab==="dashboard"&&dashboardSousOnglet==="sprint"&&('
if (([regex]::Matches($content, [regex]::Escape($a3))).Count -ne 1) {
    Write-Host "ABANDON : ancre rendu Sprint introuvable ou multiple." -ForegroundColor Red; exit 1
}
$rendu = '{tab==="dashboard"&&dashboardSousOnglet==="semainetheme"&&<SemaineThemeTab uid={userId}/>}'
$content = $content.Replace($a3, $rendu + "`r`n        " + $a3)
Write-Host "3/3 Rendu branche." -ForegroundColor Green

# ---------- CONTROLE ----------
$apres = $content.Length
$delta = $apres - $avant
Write-Host "Taille apres : $apres (+$delta)" -ForegroundColor Gray
if ($delta -lt 150 -or $delta -gt 600) {
    Write-Host "ABANDON : delta inattendu ($delta). Rien ecrit." -ForegroundColor Red; exit 1
}

[System.IO.File]::WriteAllText($app, $content, $utf8NoBom)
Write-Host ""
Write-Host "=== TERMINE ===" -ForegroundColor Green
Write-Host "Etape suivante : npm run build" -ForegroundColor Yellow
Write-Host "Si echec : Copy-Item '$backup' '$app' -Force" -ForegroundColor Yellow
