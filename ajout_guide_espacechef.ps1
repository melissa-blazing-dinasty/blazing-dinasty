$path = "C:\Users\melou\blazing-dynasty\src\App.js"
$content = [System.IO.File]::ReadAllText($path)

$marker = '  objectifs: ['
$count = ([regex]::Matches($content, [regex]::Escape($marker))).Count
if ($count -ne 1) { Write-Host "ERREUR: marker trouve $count fois (attendu 1). Abandon."; exit }

$newEntry = @'
  espacechef: [
    {titre:"Bienvenue !", texte:"L\u2019Espace Chef regroupe tous tes outils d\u2019animation d\u2019equipe : statistiques, suivi CA, gestion des acces, defis collectifs... On regarde ca ensemble !", icon:"\uD83D\uDC4B", cible:"decouverte-chef-stats"},
    {titre:"Etape 1 : Statistiques equipe", texte:"Ici tu retrouves le taux d\u2019utilisation de l\u2019app, la conversion, et les diagnostics realises. Des chiffres utiles pour recruter et motiver ton equipe.", icon:"\uD83D\uDCCA", cible:"decouverte-chef-stats"},
    {titre:"Etape 2 : Suivi CA", texte:"Ton chiffre d\u2019affaires periode par periode, avec tout l\u2019historique. Accessible a toute distributrice, pas seulement aux cheffes.", icon:"\uD83D\uDCC8", cible:"decouverte-chef-suivica"},
    {titre:"Etape 3 : Acces equipe", texte:"Gere les membres de ton equipe, nomme des chefs, et assigne les marraines depuis cette section.", icon:"\u2699\uFE0F", cible:"decouverte-chef-membres"},
    {titre:"Etape 4 : Assiduite equipe", texte:"Suis les connexions et les actions realisees chaque jour par chaque membre de ton equipe.", icon:"\uD83D\uDCCB", cible:"decouverte-chef-assiduite"},
    {titre:"Etape 5 : Challenge Decouverte App", texte:"Suis la progression de chaque membre dans le defi 7 jours de decouverte de l\u2019application.", icon:"\uD83C\uDFAE", cible:"decouverte-chef-challengeapp"},
    {titre:"Etape 6 : Challenge Flash et Power Hour", texte:"Lance un defi collectif pour toute l\u2019equipe, ou organise un Power Hour : un sprint synchrone de 20 minutes tous ensemble.", icon:"\uD83D\uDE80", cible:"decouverte-chef-defi"},
    {titre:"Etape 7 : Distributeurs et Nouveaux Distri", texte:"Navigue dans l\u2019arborescence complete de ton equipe, et suis l\u2019onboarding de tes recrues les plus recentes.", icon:"\uD83D\uDC51", cible:"decouverte-chef-distributeurs"},
    {titre:"Etape 8 : Actions biblio", texte:"Ajoute des actions a la bibliotheque partagee, utilisee par toute l\u2019equipe dans l\u2019onglet Aujourd\u2019hui.", icon:"\uD83D\uDCA1", cible:"decouverte-chef-actionsbiblio"},
    {titre:"Bravo, tu es prete !", texte:"Tu as maintenant tous les outils