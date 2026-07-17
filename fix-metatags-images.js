const fs = require('fs');
const f = 'functions/index.js';
let c = fs.readFileSync(f, 'utf8');

const ancien = "    let image = 'https://blazing-dinasty-1fad9.web.app/logo192.png';";
const nouveau = `    const baseUrl = 'https://blazing-dinasty-1fad9.web.app';
    const diagType = params.get('diag') || '';
    let image = baseUrl + '/meta-linkbio.png';
    if (diagType === 'parfum') image = baseUrl + '/meta-parfum.png';
    else if (diagType === 'skincare' || diagType === 'peauvisage') image = baseUrl + '/meta-skincare.png';
    else if (diagType === 'silhouette' || diagType === 'peaucorps') image = baseUrl + '/meta-silhouette.png';
    else if (diagType === 'sante') image = baseUrl + '/meta-sante.png';
    else if (params.get('recrutement') || params.get('r')) image = baseUrl + '/meta-recrutement.png';`;

if (c.includes(ancien)) {
  c = c.replace(ancien, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - images meta tags mises a jour');
} else {
  console.log('ECHEC - ancre introuvable');
}