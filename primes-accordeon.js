function PrimesAccordeon({obj, save, onPrimeValidee}){
  const[open,setOpen]=useState(true);
  return(
    <div style={{marginBottom:".75rem"}}>
      <div onClick={()=>setOpen(o=>!o)}
        style={{display:"flex",alignItems:"center",justifyContent:"space-between",background:C.blanc,border:`1px solid ${C.pale}`,borderRadius:open?"12px 12px 0 0":12,padding:".75rem 1rem",cursor:"pointer",userSelect:"none"}}>
        <div style={{display:"flex",alignItems:"center",gap:".5rem"}}>
          <span style={{fontSize:"1rem"}}>💎</span>
          <div style={{fontSize:".75rem",fontWeight:700,color:C.brun}}>Primes de qualification</div>
        </div>
        <span style={{color:C.gris,fontSize:".8rem",transform:open?"rotate(90deg)":"none",transition:"transform .2s"}}>›</span>
      </div>
      {open&&(
        <div style={{border:`1px solid ${C.pale}`,borderTop:"none",borderRadius:"0 0 12px 12px",overflow:"hidden"}}>
          <PrimesQualificationSection obj={obj} save={save} onPrimeValidee={onPrimeValidee}/>
        </div>
      )}
    </div>
  );
}

// ── CALCUL DU RESTE ──────────────────────────────────────────────────────────
