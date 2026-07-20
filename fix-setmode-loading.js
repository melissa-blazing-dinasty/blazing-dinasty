const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');
let ok = 0;

// 1. Avant le premier appel (soumission externe cliente)
const a1 = '        let result = null;\n        try{\n          result = await genererOrdonnanceIA';
const n1 = '        setMode("loading");\n        let result = null;\n        try{\n          result = await genererOrdonnanceIA';
if (c.includes(a1)) { c = c.replace(a1, n1); ok++; console.log('1 OK'); } else console.log('1 ECHEC');

// 2. Avant le deuxieme appel (soumission interne)
const a2 = '    let result = null;\n    let errDetail = "";\n    try {\n      result = await genererOrdonnanceIA';
const n2 = '    setMode("loading");\n    let result = null;\n    let errDetail = "";\n    try {\n      result = await genererOrdonnanceIA';
if (c.includes(a2)) { c = c.replace(a2, n2); ok++; console.log('2 OK'); } else console.log('2 ECHEC');

fs.writeFileSync(f, c, 'utf8');
console.log('=== ' + ok + '/2 ===');