// TunnelStatsTab.jsx — Blazing Dynasty
// Stats du tunnel de recrutement : vues, leads, tokens, graphiques
// Placer dans src/

import { useState, useEffect } from 'react';
import { doc, getDoc, setDoc, collection, getDocs } from 'firebase/firestore';

const CR = {
  brun:'#5A3829', or:'#C4A962', creme:'#FAF7F2', pale:'#EDE8E0',
  texte:'#2D1F1F', gris:'#9A8C8C', vert:'#2D7A4F', rouge:'#C0504D',
  rose:'#C49A8A', lilas:'#9575CD',
};

// ── HELPERS ──────────────────────────────────────────────────────────────────
const todayStr = () => new Date().toISOString().slice(0,10);

const getLast7Days = () => {
  const days = [];
  for(let i=6; i>=0; i--) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    days.push(d.toISOString().slice(0,10));
  }
  return days;
};

const getCurrentMonthDays = () => {
  const now = new Date();
  const year = now.getFullYear();
  const month = now.getMonth();
  const daysInMonth = new Date(year, month+1, 0).getDate();
  const days = [];
  for(let i=1; i<=now.getDate(); i++) {
    const d = new Date(year, month, i);
    days.push(d.toISOString().slice(0,10));
  }
  return days;
};

const formatDate = str => {
  const d = new Date(str);
  return d.toLocaleDateString('fr-FR', {day:'numeric', month:'short'});
};

// ── TRACKING : enregistrer une vue ───────────────────────────────────────────
export async function trackTunnelView(db, uid) {
  try {
    const today = todayStr();
    const ref = doc(db, 'tunnel_stats', uid, 'jours', today);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {vues:0, leads:0};
    await setDoc(ref, {...data, vues: (data.vues||0) + 1, lastVue: Date.now()}, {merge:true});
  } catch {}
}

// ── TRACKING : enregistrer un lead ───────────────────────────────────────────
export async function trackTunnelLead(db, uid) {
  try {
    const today = todayStr();
    const ref = doc(db, 'tunnel_stats', uid, 'jours', today);
    const snap = await getDoc(ref);
    const data = snap.exists() ? snap.data() : {vues:0, leads:0};
    await setDoc(ref, {...data, leads: (data.leads||0) + 1}, {merge:true});
  } catch {}
}

// ── COMPOSANT PRINCIPAL ───────────────────────────────────────────────────────
export function TunnelStatsTab({ uid, db }) {
  const [onglet, setOnglet] = useState('7j');
  const [statsJours, setStatsJours] = useState({});
  const [tokensUtilises, setTokensUtilises] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      try {
        // Charger tous les jours de stats
        const snap = await getDocs(collection(db, 'tunnel_stats', uid, 'jours'));
        const data = {};
        snap.forEach(d => { data[d.id] = d.data(); });
        setStatsJours(data);

        // Tokens utilisés
        const snapTok = await getDoc(doc(db, 'tokens_cadeaux', uid));
        if(snapTok.exists()) {
          const used = (snapTok.data().tokens||[]).filter(t=>t.utilise).length;
          setTokensUtilises(used);
        }
      } catch {}
      setLoading(false);
    })();
  }, [uid]);

  if(loading) return <div style={{textAlign:'center',padding:'2rem',color:CR.gris}}>Chargement des stats...</div>;

  // Calcul des données selon l'onglet
  const getDays = () => {
    if(onglet === '7j') return getLast7Days();
    if(onglet === 'mois') return getCurrentMonthDays();
    // Historique : tous les jours disponibles triés
    return Object.keys(statsJours).sort();
  };

  const days = getDays();
  const totalVues = days.reduce((s,d) => s + (statsJours[d]?.vues||0), 0);
  const totalLeads = days.reduce((s,d) => s + (statsJours[d]?.leads||0), 0);
  const tauxConv = totalVues > 0 ? Math.round((totalLeads/totalVues)*100) : 0;

  // Dernière vue
  const allDays = Object.entries(statsJours).filter(([,v])=>v.lastVue).sort((a,b)=>b[1].lastVue-a[1].lastVue);
  const derniereVue = allDays.length > 0 ? new Date(allDays[0][1].lastVue).toLocaleDateString('fr-FR', {day:'numeric',month:'long',hour:'2-digit',minute:'2-digit'}) : 'Aucune';

  // Données graphique
  const graphDays = onglet === 'historique' ? days.slice(-30) : days; // max 30 jours pour historique
  const maxVues = Math.max(...graphDays.map(d => statsJours[d]?.vues||0), 1);
  const maxLeads = Math.max(...graphDays.map(d => statsJours[d]?.leads||0), 1);
  const graphH = 120;
  const graphW = Math.max(graphDays.length * 32, 300);

  return (
    <div style={{fontFamily:'inherit'}}>

      {/* Onglets */}
      <div style={{display:'flex',gap:'.5rem',marginBottom:'1rem'}}>
        {[{id:'7j',label:'7 jours'},{id:'mois',label:'Ce mois'},{id:'historique',label:'Historique'}].map(o=>(
          <button key={o.id} onClick={()=>setOnglet(o.id)}
            style={{flex:1,background:onglet===o.id?CR.brun:'white',color:onglet===o.id?'white':CR.gris,border:'1px solid '+CR.pale,borderRadius:10,padding:'.5rem',fontSize:'.75rem',fontWeight:onglet===o.id?700:400,fontFamily:'inherit',cursor:'pointer'}}>
            {o.label}
          </button>
        ))}
      </div>

      {/* KPIs */}
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr',gap:'.6rem',marginBottom:'1rem'}}>
        {[
          {label:'👁️ Vues',val:totalVues,color:CR.brun,bg:'#F5EDE8'},
          {label:'📋 Leads',val:totalLeads,color:CR.vert,bg:'#E8F5EE'},
          {label:'🎁 Tokens utilisés',val:tokensUtilises,color:CR.or,bg:'#FDF8EC'},
          {label:'📊 Taux conversion',val:tauxConv+'%',color:CR.lilas,bg:'#F3EEF8'},
        ].map((k,i)=>(
          <div key={i} style={{background:k.bg,borderRadius:12,padding:'.9rem',textAlign:'center'}}>
            <div style={{fontSize:'.7rem',color:CR.gris,marginBottom:'.3rem'}}>{k.label}</div>
            <div style={{fontSize:'1.6rem',fontWeight:700,color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>

      {/* Dernière vue */}
      <div style={{background:'white',border:'1px solid '+CR.pale,borderRadius:10,padding:'.7rem 1rem',marginBottom:'1rem',fontSize:'.75rem',color:CR.gris}}>
        🕐 Dernière visite : <strong style={{color:CR.brun}}>{derniereVue}</strong>
      </div>

      {/* Graphique */}
      {graphDays.length > 0 && (
        <div style={{background:'white',border:'1px solid '+CR.pale,borderRadius:12,padding:'1rem',marginBottom:'1rem'}}>
          <div style={{fontSize:'.78rem',fontWeight:700,color:CR.brun,marginBottom:'.8rem'}}>📈 Vues (barres) & Leads (courbe)</div>

          {/* Légende */}
          <div style={{display:'flex',gap:'1rem',marginBottom:'.8rem'}}>
            <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
              <div style={{width:12,height:12,background:CR.rose,borderRadius:2}}/>
              <span style={{fontSize:'.68rem',color:CR.gris}}>Vues</span>
            </div>
            <div style={{display:'flex',alignItems:'center',gap:'.4rem'}}>
              <div style={{width:12,height:3,background:CR.vert,borderRadius:2}}/>
              <span style={{fontSize:'.68rem',color:CR.gris}}>Leads</span>
            </div>
          </div>

          {/* SVG Graphique */}
          <div style={{overflowX:'auto'}}>
            <svg width={graphW} height={graphH + 30} style={{display:'block'}}>
              {/* Lignes de grille */}
              {[0,0.25,0.5,0.75,1].map((p,i)=>(
                <g key={i}>
                  <line x1="0" y1={graphH * (1-p)} x2={graphW} y2={graphH * (1-p)} stroke={CR.pale} strokeWidth="1"/>
                  <text x="2" y={graphH * (1-p) - 2} fontSize="8" fill={CR.gris}>{Math.round(maxVues*p)}</text>
                </g>
              ))}

              {/* Barres (vues) */}
              {graphDays.map((d,i) => {
                const vues = statsJours[d]?.vues||0;
                const barH = maxVues > 0 ? (vues/maxVues)*graphH : 0;
                const x = i * 32 + 4;
                return (
                  <g key={d}>
                    <rect x={x} y={graphH - barH} width={20} height={barH} fill={CR.rose} opacity={0.8} rx="3"/>
                    {graphDays.length <= 14 && (
                      <text x={x+10} y={graphH+20} fontSize="8" fill={CR.gris} textAnchor="middle">
                        {formatDate(d).slice(0,5)}
                      </text>
                    )}
                  </g>
                );
              })}

              {/* Courbe (leads) */}
              {graphDays.length > 1 && (
                <polyline
                  points={graphDays.map((d,i) => {
                    const leads = statsJours[d]?.leads||0;
                    const y = maxLeads > 0 ? graphH - (leads/maxLeads)*graphH : graphH;
                    return `${i*32+14},${y}`;
                  }).join(' ')}
                  fill="none" stroke={CR.vert} strokeWidth="2.5" strokeLinejoin="round"
                />
              )}

              {/* Points leads */}
              {graphDays.map((d,i) => {
                const leads = statsJours[d]?.leads||0;
                const y = maxLeads > 0 ? graphH - (leads/maxLeads)*graphH : graphH;
                return leads > 0 ? (
                  <g key={d+'pt'}>
                    <circle cx={i*32+14} cy={y} r="4" fill={CR.vert}/>
                    <text x={i*32+14} y={y-7} fontSize="8" fill={CR.vert} textAnchor="middle">{leads}</text>
                  </g>
                ) : null;
              })}
            </svg>
          </div>

          {graphDays.length > 14 && (
            <div style={{fontSize:'.65rem',color:CR.gris,textAlign:'center',marginTop:'.4rem'}}>
              Faites défiler horizontalement pour voir tous les jours
            </div>
          )}
        </div>
      )}

      {/* Tableau détaillé */}
      {graphDays.length > 0 && (
        <div style={{background:'white',border:'1px solid '+CR.pale,borderRadius:12,padding:'1rem'}}>
          <div style={{fontSize:'.78rem',fontWeight:700,color:CR.brun,marginBottom:'.8rem'}}>📋 Détail par jour</div>
          <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'.3rem',marginBottom:'.5rem'}}>
            {['Date','Vues','Leads','Conv.'].map(h=>(
              <div key={h} style={{fontSize:'.65rem',fontWeight:700,color:CR.gris,textTransform:'uppercase',letterSpacing:1}}>{h}</div>
            ))}
          </div>
          {[...graphDays].reverse().slice(0,20).map(d=>{
            const vues = statsJours[d]?.vues||0;
            const leads = statsJours[d]?.leads||0;
            const conv = vues > 0 ? Math.round((leads/vues)*100) : 0;
            return (
              <div key={d} style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr 1fr',gap:'.3rem',padding:'.4rem 0',borderBottom:'1px solid '+CR.pale}}>
                <div style={{fontSize:'.72rem',color:CR.texte}}>{formatDate(d)}</div>
                <div style={{fontSize:'.72rem',fontWeight:600,color:CR.brun}}>{vues}</div>
                <div style={{fontSize:'.72rem',fontWeight:600,color:CR.vert}}>{leads}</div>
                <div style={{fontSize:'.72rem',color:conv>0?CR.or:CR.gris}}>{conv}%</div>
              </div>
            );
          })}
        </div>
      )}

      {totalVues === 0 && (
        <div style={{textAlign:'center',padding:'2rem',color:CR.gris}}>
          <div style={{fontSize:'2rem',marginBottom:'.5rem'}}>📊</div>
          <div style={{fontSize:'.82rem',fontWeight:600,color:CR.brun,marginBottom:'.3rem'}}>Aucune visite pour le moment</div>
          <div style={{fontSize:'.75rem',lineHeight:1.6}}>Partage ton lien tunnel pour commencer à voir des statistiques.</div>
        </div>
      )}
    </div>
  );
}

// ── RECAP CHEF ────────────────────────────────────────────────────────────────
export function TunnelStatsEquipeRecap({ membres, db }) {
  const [stats, setStats] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    (async () => {
      const days7 = getLast7Days();
      const results = [];
      for(const m of membres) {
        try {
          let vues7=0, leads7=0, tokensUsed=0;
          for(const d of days7) {
            const snap = await getDoc(doc(db,'tunnel_stats',m.uid,'jours',d));
            if(snap.exists()) { vues7 += snap.data().vues||0; leads7 += snap.data().leads||0; }
          }
          const snapTok = await getDoc(doc(db,'tokens_cadeaux',m.uid));
          if(snapTok.exists()) tokensUsed = (snapTok.data().tokens||[]).filter(t=>t.utilise).length;
          results.push({...m, vues7, leads7, tokensUsed, conv: vues7>0?Math.round((leads7/vues7)*100):0});
        } catch {}
      }
      results.sort((a,b)=>b.leads7-a.leads7);
      setStats(results);
      setLoading(false);
    })();
  }, [membres]);

  if(loading) return <div style={{textAlign:'center',padding:'1rem',color:CR.gris,fontSize:'.8rem'}}>Chargement recap équipe...</div>;

  const totalVues = stats.reduce((s,m)=>s+m.vues7,0);
  const totalLeads = stats.reduce((s,m)=>s+m.leads7,0);

  return (
    <div style={{fontFamily:'inherit'}}>
      <div style={{display:'grid',gridTemplateColumns:'1fr 1fr 1fr',gap:'.6rem',marginBottom:'1rem'}}>
        {[
          {label:'👁️ Vues équipe',val:totalVues,color:CR.brun},
          {label:'📋 Leads équipe',val:totalLeads,color:CR.vert},
          {label:'📊 Taux moy.',val:(totalVues>0?Math.round((totalLeads/totalVues)*100):0)+'%',color:CR.or},
        ].map((k,i)=>(
          <div key={i} style={{background:'white',border:'1px solid '+CR.pale,borderRadius:10,padding:'.7rem',textAlign:'center'}}>
            <div style={{fontSize:'.62rem',color:CR.gris,marginBottom:'.2rem'}}>{k.label}</div>
            <div style={{fontSize:'1.3rem',fontWeight:700,color:k.color}}>{k.val}</div>
          </div>
        ))}
      </div>
      <div style={{fontSize:'.7rem',color:CR.gris,marginBottom:'.5rem',fontWeight:600,textTransform:'uppercase',letterSpacing:1}}>7 derniers jours — par membre</div>
      {stats.map((m,i)=>(
        <div key={m.uid} style={{background:'white',border:'1px solid '+CR.pale,borderRadius:10,padding:'.7rem',marginBottom:'.5rem',display:'flex',alignItems:'center',gap:'.7rem'}}>
          <div style={{width:24,height:24,borderRadius:'50%',background:CR.brun,color:'white',display:'flex',alignItems:'center',justifyContent:'center',fontSize:'.7rem',fontWeight:700,flexShrink:0}}>{i+1}</div>
          <div style={{flex:1}}>
            <div style={{fontSize:'.78rem',fontWeight:700,color:CR.brun}}>{m.nom||m.uid}</div>
            <div style={{fontSize:'.68rem',color:CR.gris}}>{m.vues7} vues • {m.leads7} leads • {m.conv}% conv.</div>
          </div>
          <div style={{fontSize:'.75rem',fontWeight:700,color:m.tokensUsed>0?CR.or:CR.gris}}>{m.tokensUsed} 🎁</div>
        </div>
      ))}
      {stats.length === 0 && (
        <div style={{textAlign:'center',padding:'1.5rem',color:CR.gris,fontSize:'.78rem'}}>Aucune donnée disponible pour l'équipe.</div>
      )}
    </div>
  );
}
