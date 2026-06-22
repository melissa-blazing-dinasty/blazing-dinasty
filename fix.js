const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

const idx = c.indexOf('isToday=(i)=>courante');
console.log('Pattern actuel:', JSON.stringify(c.substring(idx-60, idx+80)));