const fs = require('fs');
const f = 'src/DiagnosticsTab.js';
let c = fs.readFileSync(f, 'utf8');

const ancre = '  const bioSlug=p.get("bio");';

const routing = `  // URLs courtes /r/ /b/ /d/
  const shortPathname = window.location.pathname;
  const parts = shortPathname.split('/').filter(Boolean);
  if (parts.length >= 2) {
    const type = parts[0];
    const slug = parts[1];
    if (type === 'r' || type === 't') return <TunnelRecrutementPublic slug={slug} db={db}/>;
    if (type === 'b') return <LinkBioPublicPage slug={slug}/>;
    if (type === 'd') {
      const newUrl = '/?diag=' + p.get('diag') + '&uid=' + slug + (p.get('client') ? '&client=' + p.get('client') : '');
      window.location.replace(newUrl);
      return null;
    }
  }
  `;

if (c.includes('shortPathname')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, routing + ancre);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - routing /r/ /b/ /d/