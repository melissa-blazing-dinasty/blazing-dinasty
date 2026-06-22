const fs = require('fs');
const os = require('os');
const src = fs.readFileSync(os.homedir()+'/Downloads/App_citation_final.txt','utf8');
fs.writeFileSync('src/App.js', src, 'utf8');
console.log('OK:', src.split('\n').length, 'lignes');