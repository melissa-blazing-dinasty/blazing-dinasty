const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

c = c.replace(/"Eva, dans l'equipe Blazing Dynasty"équipe'}/g, '"Eva, dans l\'equipe Blazing Dynasty"}');
c = c.replace(/"Christelle, dans l'equipe Blazing Dynasty"équipe'}/g, '"Christelle, dans l\'equipe Blazing Dynasty"}');
c = c.replace(/"Oceane, dans l'equipe Blazing Dynasty"équipe'}/g, '"Oceane, dans l\'equipe Blazing Dynasty"}');

fs.writeFileSync(f, c, 'utf8');
console.log('OK - syntaxe corrigee');