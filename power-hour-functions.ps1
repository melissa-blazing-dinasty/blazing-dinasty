$path = "C:\Users\melou\blazing-dynasty\functions\index.js"

$content = [System.IO.File]::ReadAllText($path)
Write-Host "Longueur AVANT modification : $($content.Length) caracteres"

# ── Remplacement 1 : ajouter onDocumentWritten a l'import ──
$old1 = @'
const {onDocumentUpdated, onDocumentCreated} = require("firebase-functions/v2/firestore");
'@

$new1 = @'
const {onDocumentUpdated, onDocumentCreated, onDocumentWritten} = require("firebase-functions/v2/firestore");
'@

# ── Remplacement 2 : ajouter les 2 nouvelles fonctions apres notifMessage ──
$old2 = @'
exports.notifMessage = onDocumentUpdated("conversations/{convId}", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const msgsBefore = before.messages || [];
    const msgsAfter = after.messages || [];
    if (msgsAfter.length <= msgsBefore.length) return;
    const dernierMsg = msgsAfter[msgsAfter.length - 1];
    const participants = after.participants || [];
    const destinataires = participants.filter(p => p !== dernierMsg.de);
    if (!destinataires.length) return;
    const apercu = dernierMsg.texte ? dernierMsg.texte.slice(0, 60) : "Photo";
    const titre = after.isGroupe ? ("💬 " + (after.nomGroupe || "Groupe") + " · " + dernierMsg.deNom) : ("💬 " + dernierMsg.deNom);
    for (const dest of destinataires) {
      await sendNotifToUid(dest, titre, apercu);
    }
  } catch (e) { console.error("notifMessage error", e); }
});
'@

$new2 = @'
exports.notifMessage = onDocumentUpdated("conversations/{convId}", async (event) => {
  try {
    const before = event.data.before.data() || {};
    const after = event.data.after.data() || {};
    const msgsBefore = before.messages || [];
    const msgsAfter = after.messages || [];
    if (msgsAfter.length <= msgsBefore.length) return;
    const dernierMsg = msgsAfter[msgsAfter.length - 1];
    const participants = after.participants || [];
    const destinataires = participants.filter(p => p !== dernierMsg.de);
    if (!destinataires.length) return;
    const apercu = dernierMsg.texte ? dernierMsg.texte.slice(0, 60) : "Photo";
    const titre = after.isGroupe ? ("💬 " + (after.nomGroupe || "Groupe") + " · " + dernierMsg.deNom) : ("💬 " + dernierMsg.deNom);
    for (const dest of destinataires) {
      await sendNotifToUid(dest, titre, apercu);
    }
  } catch (e) { console.error("notifMessage error", e); }
});

exports.notifPowerHourDebut = onDocumentWritten("equipe/power-hour", async (event) => {
  try {
    const before = event.data.before.exists ? event.data.before.data() : {};
    const after = event.data.after.exists ? event.data.after.data() : {};
    if (after.startedAt && after.startedAt !== before.startedAt) {
      const nom = after.startedBy || "Un membre de l equipe";
      await sendNotifToAll("⚡ Power Hour lancee !", nom + " vient de lancer une Power Hour de 20 minutes. Rejoins l equipe !");
    }
  } catch(e) { console.error("notifPowerHourDebut error", e); }
});

exports.notifPowerHourFin = onSchedule({ schedule: "* * * * *", timeZone: "Europe/Paris" }, async () => {
  try {
    const ref = db.collection("equipe").doc("power-hour");
    const snap = await ref.get();
    if (!snap.exists) return;
    const d = snap.data();
    if (!d.startedAt) return;
    const DUREE_MIN = 20 * 60000;
    const elapsed = Date.now() - d.startedAt;
    if (elapsed >= DUREE_MIN && elapsed < DUREE_MIN + 5 * 60000 && !d.finNotifiee) {
      await sendNotifToAll("✅ Power Hour terminee !", "Bravo pour ces 20 minutes de focus intense !");
      await ref.set({finNotifiee: true}, {merge: true});
    }
  } catch(e) { console.error("notifPowerHourFin error", e); }
});
'@

# ── Verification puis application ──
$replacements = @(
  @{ old = $old1; new = $new1; name = "1 - import onDocumentWritten" },
  @{ old = $old2; new = $new2; name = "2 - fonctions notifPowerHourDebut/Fin" }
)

foreach ($r in $replacements) {
  if (-not $content.Contains($r.old)) {
    Write-Host "ERREUR : bloc ancre introuvable pour le remplacement '$($r.name)'. Arret sans modification." -ForegroundColor Red
    exit 1
  }
}

foreach ($r in $replacements) {
  $content = $content.Replace($r.old, $r.new)
  Write-Host "Remplacement applique : $($r.name)"
}

Write-Host "Longueur APRES modification : $($content.Length) caracteres"

[System.IO.File]::WriteAllText($path, $content, [System.Text.Encoding]::UTF8)
Write-Host "Fichier sauvegarde avec succes." -ForegroundColor Green