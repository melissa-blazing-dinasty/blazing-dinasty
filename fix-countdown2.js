const fs = require('fs');
const f = 'src/TunnelRecrutementTab.jsx';
let c = fs.readFileSync(f, 'utf8');

const ancre = "  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });";

const nouveau = `  const [countdown, setCountdown] = useState({ h: 0, m: 0, s: 0 });
  const timerRef = useRef(null);

  useEffect(() => {
    const key = 'bd_recru_timer_' + slug;
    let endTime;
    try {
      const stored = localStorage.getItem(key);
      if (stored) {
        endTime = parseInt(stored);
        if (endTime < Date.now()) {
          const h = 18 + Math.floor(Math.random() * 30);
          endTime = Date.now() + h * 3600000;
          localStorage.setItem(key, endTime.toString());
        }
      } else {
        const h = 18 + Math.floor(Math.random() * 30);
        endTime = Date.now() + h * 3600000;
        localStorage.setItem(key, endTime.toString());
      }
    } catch {
      endTime = Date.now() + 24 * 3600000;
    }
    const tick = () => {
      const diff = Math.max(0, endTime - Date.now());
      setCountdown({ h: Math.floor(diff / 3600000), m: Math.floor((diff % 3600000) / 60000), s: Math.floor((diff % 60000) / 1000) });
    };
    tick();
    timerRef.current = setInterval(tick, 1000);
    return () => clearInterval(timerRef.current);
  }, [slug]);`;

if (c.includes('timerRef') && c.includes('localStorage')) {
  console.log('DEJA FAIT');
} else if (c.includes(ancre)) {
  c = c.replace(ancre, nouveau);
  fs.writeFileSync(f, c, 'utf8');
  console.log('OK - countdown localStorage ajoute');
} else {
  console.log('ECHEC');
}