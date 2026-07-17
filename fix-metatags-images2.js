const fs = require('fs');
const f = 'functions/index.js';
let lines = fs.readFileSync(f, 'utf8').split('\n');

lines = lines.map(l => {
  if (l.includes('logo192.png')) {
    const baseUrl = 'https://blazing-dinasty-1fad9.web.app';
    return `  const diagType = params.get('diag') || '';
  let image = '${baseUrl}/meta-linkbio.png';
  if (diagType === 'parfum') image = '${baseUrl}/meta-parfum.png';
  else if (diagType === 'skincare' || diagType === 'peauvisage') image = '${baseUrl}/meta-skincare.png';
  else if (diagType === 'silhouette' || diagType === 'peaucorps') image = '${baseUrl}/meta-silhouette.png';
  else if (diagType === 'sante') image = '${baseUrl}/meta-sante.png';
  else if (params.get('recrutement')) image = '${baseUrl}/meta-recrutement.png';`;
  }
  return l;
});

fs.writeFileSync(f, lines.join('\n'), 'utf8');
const check = lines.join('\n').includes('meta-parfum');
console.log('OK: ' + (check ? 'OK' : 'ECHEC'));