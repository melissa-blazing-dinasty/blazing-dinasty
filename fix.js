const fs = require('fs');
let c = fs.readFileSync('src/App.js', 'utf8');

// Fix : si cd est un Array (ancien format), le traiter comme périmé et reset
const old = '          if(Array.isArray(cd)){setActionsCustomRaw(cd);}\n          else if(cd._date===tod){setActionsCustomRaw(cd.actions||[]);}';
const newt = '          if(Array.isArray(cd)){setActionsCustomRaw([]);ss(uid,"db-actions-custom",JSON.stringify({_date:tod,actions:[]}));}\n          else if(cd._date===tod){setActionsCustomRaw(cd.actions||[]);}';

if(c.includes(old)){
  c = c.replace(old, newt);
  console.log('✅ Fix reset actions ancien format');
} else {
  console.log('❌ Non trouvé');
}

fs.writeFileSync('src/App.js', c, 'utf8');