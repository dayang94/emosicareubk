import {useEffect,useState,useCallback} from 'react'
import {supabase,rpcRetry} from './supabase'
import {PieChart,Pie,Cell,Tooltip,ResponsiveContainer,LineChart,Line,XAxis,YAxis,Legend} from 'recharts'

const EMO=[['gembira','😄','GEMBIRA','#34d399'],['tenang','🙂','BAIK / TENANG','#60a5fa'],['biasa','😐','BIASA','#94a3b8'],
['risau','😟','RISAU','#facc15'],['sedih','😢','SEDIH','#f87171'],['marah','😠','MARAH','#fb923c']]
const iso=d=>d.toLocaleDateString('sv-SE'); const today=()=>iso(new Date())
const ago=n=>{const d=new Date();d.setDate(d.getDate()-n);return iso(d)}
const useDeb=(v,ms=400)=>{const[x,s]=useState(v);useEffect(()=>{const t=setTimeout(()=>s(v),ms);return()=>clearTimeout(t)},[v,ms]);return x}

function Footer(){return <footer><img src="/logo-ubk.png" alt="UBK TesTKa" style={{height:56,marginBottom:6}}/><br/><b>EmosiCare</b> – Sistem Kesejahteraan Emosi Murid<br/>Unit Bimbingan dan Kaunseling, Sekolah Kebangsaan Telok Kalong · <b>TesTKa Leading The Future</b><br/>
"Setiap emosi mempunyai cerita. Setiap murid berhak untuk didengari."<br/>Data adalah sulit dan untuk kegunaan sekolah sahaja.</footer>}

function Login({pre,back}){
  const[u,setU]=useState(pre||'');const[p,setP]=useState('');const[show,setShow]=useState(false);const[err,setErr]=useState('');const[busy,setBusy]=useState(false)
  const go=async e=>{e.preventDefault();setBusy(true);setErr('')
    const{error}=await supabase.auth.signInWithPassword({email:`${u.trim().toLowerCase()}@emosicare.sk`,password:p})
    if(error)setErr('ID atau kata laluan tidak betul.');setBusy(false)}
  return <div className="login"><div className="card" style={{textAlign:'center'}}><img className="logo" src="/logo-sekolah.png" alt="Logo SK Telok Kalong" style={{height:80}}/><h1 style={{margin:'6px 0 0'}}>EmosiCare</h1>
    <div className="muted">Sistem Kesejahteraan Emosi Murid<br/>Unit Bimbingan dan Kaunseling · SK Telok Kalong</div><p><i>"Kenali Emosi, Hargai Diri."</i></p></div>
    <div className="row"><button onClick={back}>‹ Halaman Utama</button><span className="muted" style={{alignSelf:'center'}}>Portal: {PN[u]||'—'}</span></div>
    <form className="card" onSubmit={go} style={{display:'flex',flexDirection:'column',gap:10}}>
      <input placeholder="ID Pengguna" value={u} onChange={e=>setU(e.target.value)} required/>
      <input placeholder="Kata laluan" type={show?'text':'password'} value={p} onChange={e=>setP(e.target.value)} required/>
      <label className="muted"><input type="checkbox" checked={show} onChange={e=>setShow(e.target.checked)} style={{width:'auto'}}/> Tunjuk kata laluan</label>
      {err&&<div style={{color:'#f87171'}}>{err}</div>}<button className="pri" disabled={busy}>{busy?'Sila tunggu…':'Log Masuk'}</button></form><Footer/></div>}

function Shell({tabs,tab,setTab,children}){
  return <div className="wrap"><aside className="side card"><div style={{textAlign:'center'}}><img className="logo" src="/logo-sekolah.png" alt="Logo" style={{height:64}}/><h3 style={{margin:'4px 0 10px'}}>EmosiCare</h3></div>
    {tabs.map(t=><button key={t} className={'nav '+(tab===t?'on':'')} onClick={()=>setTab(t)}>{t}</button>)}
    <button onClick={()=>supabase.auth.signOut()} style={{marginTop:'auto'}}>Log Keluar</button></aside>
    <div style={{flex:1,display:'flex',flexDirection:'column'}}><main className="main">{children}</main><Footer/></div></div>}

function Summary(){
  const[s,setS]=useState(),[d,setD]=useState(today())
  const load=useCallback(()=>supabase.rpc('participation_summary',{p_date:d}).then(({data})=>setS(data?.[0])),[d])
  useEffect(()=>{load()},[load])
  const pct=s&&s.total?(s.done/s.total*100).toFixed(2):'0.00'
  return <><div className="row"><input type="date" value={d} onChange={e=>setD(e.target.value)}/><button onClick={load}>Muat Semula</button></div>
    <div className="grid">{[['Jumlah Murid',s?.total],['Sudah Menjawab',s?.done],['Belum Menjawab',s?.pending],['Peratus Penyertaan',pct+'%']].map(([l,v])=>
      <div className="card" key={l}><div className="muted">{l}</div><div className="big">{v??'…'}</div></div>)}</div></>}

function useClasses(){const[c,setC]=useState([]);useEffect(()=>{supabase.from('school_classes').select('name').order('name').then(({data})=>setC(data||[]))},[]);return c}

function CheckIn(){
  const classes=useClasses();const[cls,setCls]=useState('');const[st,setSt]=useState([]);const[sid,setSid]=useState('');const[emo,setEmo]=useState('');const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('')
  useEffect(()=>{setSid('');if(cls)supabase.from('students').select('id,name').eq('class',cls).eq('is_active',true).order('name').limit(100).then(({data})=>setSt(data||[]))},[cls])
  const send=async()=>{if(busy||!emo)return;setBusy(true)
    const{data,error,attempt}=await rpcRetry('submit_checkin',{p_student:sid,p_emotion:emo})
    const ok=data&&(data.success||(attempt>0&&data.message.startsWith('MURID SUDAH')))
    setMsg(error?'Ralat sambungan. Sila cuba lagi.':ok?'Terima kasih kerana berkongsi perasaan anda. Setiap emosi anda penting!':data.message)
    setEmo('');setTimeout(()=>{setMsg('');setSid('');setBusy(false)},3500)}
  if(msg)return <div className="priv"><h1>{msg}</h1></div>
  if(sid)return <div className="priv"><h1>HARI INI SAYA RASA...</h1><div className="emos" style={{width:'min(900px,100%)'}}>
    {EMO.map(([k,e,l])=><button key={k} className={'emo '+(emo===k?'sel':'')} onClick={()=>setEmo(k)}>{e}<small>{l}</small></button>)}</div>
    <button className="pri" style={{fontSize:'1.2rem'}} disabled={!emo||busy} onClick={send}>HANTAR EMOSI SAYA</button></div>
  return <div className="card"><h2>Semakan Emosi Harian</h2><p className="muted">Pilih kelas dan nama murid, kemudian beri ruang privasi kepada murid.</p>
    <div className="row"><select value={cls} onChange={e=>setCls(e.target.value)}><option value="">— Pilih kelas —</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select>
    <select value={sid} onChange={e=>setSid(e.target.value)} disabled={!cls}><option value="">— Pilih murid —</option>{st.map(s=><option key={s.id} value={s.id}>{s.name}</option>)}</select></div></div>}

function Status(){
  const classes=useClasses();const[cls,setCls]=useState('');const[q,setQ]=useState('');const[d,setD]=useState(today());const[pg,setPg]=useState(0);const[rows,setR]=useState([]);const[ld,setLd]=useState(true)
  const dq=useDeb(q);useEffect(()=>setPg(0),[cls,dq,d])
  useEffect(()=>{setLd(true);supabase.rpc('teacher_checkin_status',{p_date:d,p_class:cls||null,p_search:dq||null,p_limit:50,p_offset:pg*50}).then(({data})=>{setR(data||[]);setLd(false)})},[cls,dq,d,pg])
  return <div className="card"><h2>Status Semakan Harian</h2><div className="row"><input type="date" value={d} onChange={e=>setD(e.target.value)}/>
    <select value={cls} onChange={e=>setCls(e.target.value)}><option value="">Semua kelas</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select>
    <input placeholder="Cari nama…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {ld?<p>Memuatkan…</p>:!rows.length?<p className="muted">Tiada rekod.</p>:<table><thead><tr><th>Bil.</th><th>Nama</th><th>Kelas</th><th>Status</th></tr></thead><tbody>
    {rows.map((r,i)=><tr key={r.student_id}><td>{pg*50+i+1}</td><td>{r.name}</td><td>{r.class}</td><td className={r.status==='Sudah'?'ok':'no'}>{r.status==='Sudah'?'Sudah menjawab':'Belum menjawab'}</td></tr>)}</tbody></table>}
    <div className="row" style={{marginTop:10}}><button disabled={!pg} onClick={()=>setPg(pg-1)}>‹</button><span>Halaman {pg+1}</span><button disabled={rows.length<50} onClick={()=>setPg(pg+1)}>›</button></div></div>}

function Analysis({days=30}){
  const[n,setN]=useState(days);const[sum,setSum]=useState([]);const[tr,setTr]=useState([])
  useEffect(()=>{supabase.rpc('emotion_summary',{p_from:ago(n),p_to:today()}).then(({data})=>setSum(data||[]))
    supabase.rpc('emotion_trend',{p_from:ago(n),p_to:today()}).then(({data})=>{const m={};(data||[]).forEach(r=>{m[r.day]={...(m[r.day]||{day:r.day}),[r.emotion]:Number(r.total)}});setTr(Object.values(m))})},[n])
  const tot=k=>sum.filter(r=>r.emotion===k).reduce((a,r)=>a+Number(r.total),0)
  const pie=EMO.map(([k,,l,c])=>({name:l,value:tot(k),c}))
  const cls=[...new Set(sum.map(r=>r.class))].sort()
  const pct=(c,k)=>{const all=sum.filter(r=>r.class===c).reduce((a,r)=>a+Number(r.total),0);const v=sum.find(r=>r.class===c&&r.emotion===k);return all?Math.round(Number(v?.total||0)/all*100):0}
  return <><div className="row">{[7,30,90,180,365].map(x=><button key={x} className={n===x?'pri':''} onClick={()=>setN(x)}>{x} hari</button>)}</div>
    <div className="grid">{EMO.map(([k,e,l])=><div className="card" key={k}><div className="muted">{e} {l}</div><div className="big">{tot(k)}</div></div>)}</div>
    <div className="grid" style={{gridTemplateColumns:'repeat(auto-fit,minmax(320px,1fr))'}}>
    <div className="card" style={{height:300}}><ResponsiveContainer><PieChart><Pie data={pie} dataKey="value" innerRadius={55} outerRadius={95}>{pie.map(p=><Cell key={p.name} fill={p.c}/>)}</Pie><Tooltip/><Legend/></PieChart></ResponsiveContainer></div>
    <div className="card" style={{height:300}}><ResponsiveContainer><LineChart data={tr}><XAxis dataKey="day" stroke="#aab"/><YAxis stroke="#aab"/><Tooltip/>{EMO.map(([k,,l,c])=><Line key={k} dataKey={k} name={l} stroke={c} dot={false}/>)}</LineChart></ResponsiveContainer></div></div>
    <div className="card" style={{overflowX:'auto'}}><h3>Peta Haba Emosi (% mengikut kelas)</h3><table><thead><tr><th>Kelas</th>{EMO.map(e=><th key={e[0]}>{e[2]}</th>)}</tr></thead><tbody>
    {cls.map(c=><tr key={c}><td>{c}</td>{EMO.map(([k,,,col])=>{const v=pct(c,k);return <td key={k} style={{background:col+Math.min(255,Math.round(v*3.2)).toString(16).padStart(2,'0')}}>{v}%</td>})}</tr>)}</tbody></table></div></>}

function Alerts(){
  const[rows,setR]=useState([]);const load=()=>supabase.from('referral_alerts').select('*,students(name,class)').order('alert_date',{ascending:false}).limit(100).then(({data})=>setR(data||[]))
  useEffect(()=>{load();const ch=supabase.channel('al').on('postgres_changes',{event:'INSERT',schema:'public',table:'referral_alerts'},load).subscribe();return()=>supabase.removeChannel(ch)},[])
  const save=async(r,patch)=>{const{data:{user}}=await supabase.auth.getUser();await supabase.from('referral_alerts').update({...patch,handled_by:user.id,updated_at:new Date().toISOString()}).eq('id',r.id);load()}
  return <div className="card"><h2>Amaran Emosi &amp; Rujukan</h2><p className="muted">Petunjuk awal untuk perhatian dan bimbingan, bukan diagnosis kesihatan mental.</p>
    {!rows.length&&<p className="muted">Tiada amaran.</p>}{rows.map(r=><div key={r.id} className="card" style={{marginBottom:10}}><b>{r.students?.name}</b> · {r.students?.class} · {r.alert_date} · 😢😢😢
      <div className="row" style={{marginTop:8}}><select value={r.status} onChange={e=>save(r,{status:e.target.value})}>{['Baharu','Dalam Pemantauan','Tindakan Susulan','Selesai'].map(s=><option key={s}>{s}</option>)}</select>
      <textarea style={{flex:1}} placeholder="Catatan tindakan GBK" defaultValue={r.action_notes||''} onBlur={e=>e.target.value!==(r.action_notes||'')&&save(r,{action_notes:e.target.value})}/></div></div>)}</div>}

const PN={guru:'Guru',gbksktk:'Guru Bimbingan dan Kaunseling',admin:'Pentadbir'}
function Landing({go}){
  const F=[['😊','Semakan Emosi Harian','Murid memilih emoji perasaan dalam masa beberapa saat.'],['🔒','Privasi Terjamin','Guru hanya melihat status penyertaan, bukan emosi murid.'],
   ['🔔','Amaran Awal','Pengesanan murid sedih tiga hari persekolahan berturut-turut.'],['📊','Analisis & Laporan','Peta haba dan trend emosi berdasarkan rekod sebenar.']]
  const P=[['guru','👩‍🏫','Portal Guru','Semakan emosi dan status penyertaan murid.'],['gbksktk','💜','Portal GBK','Pemantauan emosi, amaran dan pengurusan murid.'],['admin','🏫','Portal Pentadbir','Pemantauan statistik agregat (baca sahaja).']]
  return <div className="hero"><section className="card hero-card"><img className="logo" src="/logo-ubk.png" alt="Logo UBK TesTKa" style={{width:'min(300px,70%)'}}/>
    <div><img src="/logo-sekolah.png" alt="Logo SK Telok Kalong" style={{height:46,verticalAlign:'middle',marginRight:10}}/><h1 style={{fontSize:'2.6rem',margin:'6px 0',display:'inline-block',verticalAlign:'middle'}}>EmosiCare</h1>
    <div className="muted">Sistem Kesejahteraan Emosi Murid<br/>Unit Bimbingan dan Kaunseling · Sekolah Kebangsaan Telok Kalong</div>
    <h3><i>"Kenali Emosi, Hargai Diri."</i></h3><b>TesTKa Leading The Future</b></div></section>
    <div className="grid">{F.map(([i,t,d])=><div className="card" key={t}><div style={{fontSize:'2rem'}}>{i}</div><b>{t}</b><div className="muted">{d}</div></div>)}</div>
    <h2 style={{textAlign:'center',margin:'8px 0 0'}}>Pilih Portal Anda</h2>
    <div className="grid">{P.map(([id,i,t,d])=><div className="card" key={id} style={{textAlign:'center'}}><div style={{fontSize:'2.4rem'}}>{i}</div><b>{t}</b><div className="muted" style={{margin:'6px 0 12px'}}>{d}</div><button className="pri" onClick={()=>go(id)}>Masuk</button></div>)}</div><Footer/></div>}

function Murid(){
  const classes=useClasses();const[cls,setCls]=useState('');const[q,setQ]=useState('');const[pg,setPg]=useState(0);const[rows,setR]=useState([]);const[ld,setLd]=useState(true)
  const[nm,setNm]=useState('');const[nc,setNc]=useState('');const[msg,setMsg]=useState('');const[tick,setTick]=useState(0);const dq=useDeb(q);useEffect(()=>setPg(0),[cls,dq])
  useEffect(()=>{setLd(true);let r=supabase.from('students').select('id,name,class,is_active').order('class').order('name').range(pg*50,pg*50+49)
    if(cls)r=r.eq('class',cls);if(dq)r=r.ilike('name','%'+dq+'%');r.then(({data})=>{setR(data||[]);setLd(false)})},[cls,dq,pg,tick])
  const run=async(fn,args)=>{const{data,error}=await supabase.rpc(fn,args);setMsg(error?'Ralat: '+error.message:data.message);if(!error&&data.success){setTick(t=>t+1);return true}}
  const tambah=async e=>{e.preventDefault();if(await run('add_student',{p_name:nm,p_class:nc}))setNm('')}
  const padam=r=>window.confirm(`PADAM KEKAL "${r.name}" (${r.class})?\n\nSemua rekod emosi dan amaran murid ini turut dipadam dan TIDAK boleh dipulihkan.\nGunakan "Nyahaktif" jika sejarah emosi perlu dikekalkan.`)&&run('delete_student',{p_id:r.id})
  return <><form className="card" onSubmit={tambah}><h2>Tambah Murid</h2><div className="row"><input style={{flex:1}} placeholder="Nama murid" value={nm} onChange={e=>setNm(e.target.value)} required/>
    <select value={nc} onChange={e=>setNc(e.target.value)} required><option value="">— Pilih kelas —</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select><button className="pri">+ Tambah</button></div>
    {msg&&<p className="muted">{msg}</p>}</form>
    <div className="card"><h2>Senarai Murid</h2><div className="row"><select value={cls} onChange={e=>setCls(e.target.value)}><option value="">Semua kelas</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select>
    <input placeholder="Cari nama…" value={q} onChange={e=>setQ(e.target.value)}/></div>
    {ld?<p>Memuatkan…</p>:!rows.length?<p className="muted">Tiada murid.</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th>Nama</th><th>Kelas</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.id}><td>{r.name}</td><td>{r.class}</td><td className={r.is_active?'ok':'no'}>{r.is_active?'Aktif':'Tidak aktif'}</td>
    <td className="row"><button onClick={()=>run('set_student_active',{p_id:r.id,p_active:!r.is_active})}>{r.is_active?'Nyahaktif':'Aktifkan'}</button><button style={{color:'#f87171'}} onClick={()=>padam(r)}>🗑 Padam</button></td></tr>)}</tbody></table></div>}
    <div className="row" style={{marginTop:10}}><button disabled={!pg} onClick={()=>setPg(pg-1)}>‹</button><span>Halaman {pg+1}</span><button disabled={rows.length<50} onClick={()=>setPg(pg+1)}>›</button></div></div></>}

const NEXT=n=>{const[y,...r]=n.split(' ');return (+y+1)+' '+r.join(' ')}
function NaikKelas(){
  const[cnt,setCnt]=useState([]);const[map,setMap]=useState({});const[ph,setPh]=useState('');const[msg,setMsg]=useState('');const[busy,setBusy]=useState(false);const[last,setLast]=useState(null);const[tick,setTick]=useState(0)
  useEffect(()=>{supabase.rpc('class_counts').then(({data})=>{const d=data||[];setCnt(d);const names=d.map(c=>c.class)
    setMap(m=>{const o={};d.forEach(c=>{o[c.class]=m[c.class]??(c.class[0]==='6'?'__TAMAT__':names.includes(NEXT(c.class))?NEXT(c.class):'')});return o})})
    supabase.from('promotion_batches').select('*').order('performed_at',{ascending:false}).limit(1).then(({data})=>setLast(data?.[0]||null))},[tick])
  const act=cnt.filter(c=>c.total>0);const ready=act.length>0&&act.every(c=>map[c.class])
  const naik=act.filter(c=>!['__TAMAT__','__KEKAL__'].includes(map[c.class])).reduce((a,c)=>a+c.total,0)
  const tamat=act.filter(c=>map[c.class]==='__TAMAT__').reduce((a,c)=>a+c.total,0)
  const run=async(fn,args)=>{setBusy(true);const{data,error}=await supabase.rpc(fn,args);setMsg(error?'Ralat: '+error.message:data.message);setBusy(false);setPh('');setTick(t=>t+1)}
  const hantar=()=>run('promote_students',{p_mapping:act.filter(c=>map[c.class]!=='__KEKAL__').map(c=>({from:c.class,to:map[c.class]==='__TAMAT__'?null:map[c.class]}))})
  return <><div className="card"><h2>Naik Kelas</h2><p className="muted">Gunakan sekali setahun pada hujung sesi. Murid Tahun 6 ditandakan tamat (dinyahaktifkan). Sejarah emosi semua murid kekal.
    Murid Tahun 1 baharu perlu ditambah dalam Pengurusan Murid.</p>
    <div style={{overflowX:'auto'}}><table><thead><tr><th>Kelas semasa</th><th>Bil. murid</th><th>Kelas baharu</th></tr></thead><tbody>
    {cnt.map(c=><tr key={c.class}><td>{c.class}</td><td>{c.total}</td><td>{c.total===0?<span className="muted">—</span>:<select value={map[c.class]||''} onChange={e=>setMap({...map,[c.class]:e.target.value})}>
      <option value="">— Pilih —</option>{cnt.filter(x=>x.class!==c.class).map(x=><option key={x.class} value={x.class}>{x.class}</option>)}
      <option value="__KEKAL__">Kekal dalam kelas ini</option><option value="__TAMAT__">Tamat persekolahan</option></select>}</td></tr>)}</tbody></table></div>
    <p>Ringkasan: <b className="ok">{naik}</b> murid naik kelas · <b>{tamat}</b> murid tamat persekolahan</p>
    <div className="row"><input placeholder='Taip "NAIK KELAS" untuk sahkan' value={ph} onChange={e=>setPh(e.target.value)} style={{flex:1}}/>
    <button className="pri" disabled={busy||!ready||ph!=='NAIK KELAS'} onClick={hantar}>{busy?'Memproses…':'⬆ Naik Kelas'}</button></div>
    {!ready&&<p className="muted">Pilih kelas baharu bagi setiap kelas yang mempunyai murid.</p>}{msg&&<p><b>{msg}</b></p>}</div>
    {last&&<div className="card"><b>Naik kelas terakhir:</b> {new Date(last.performed_at).toLocaleString('ms-MY')} · {last.moved} naik, {last.graduated} tamat {last.undone?'(dibatalkan)':''}
    {!last.undone&&<div style={{marginTop:8}}><button disabled={busy} onClick={()=>window.confirm('Batalkan naik kelas terakhir dan kembalikan murid ke kelas asal?')&&run('undo_last_promotion')}>↩ Batal Naik Kelas Terakhir</button></div>}</div>}</>}

const PORTAL={teacher:{tabs:['Papan Pemuka','Semakan Emosi Harian','Status Penyertaan'],view:{'Papan Pemuka':<Summary/>,'Semakan Emosi Harian':<CheckIn/>,'Status Penyertaan':<Status/>}},
 gbk:{tabs:['Papan Pemuka','Peta Haba & Trend Emosi','Amaran Emosi','Pengurusan Murid','Naik Kelas'],view:{'Papan Pemuka':<><Summary/><Analysis days={7}/></>,'Peta Haba & Trend Emosi':<Analysis/>,'Amaran Emosi':<Alerts/>,'Pengurusan Murid':<Murid/>,'Naik Kelas':<NaikKelas/>}},
 admin:{tabs:['Papan Pemuka','Analisis Data'],view:{'Papan Pemuka':<><Summary/><Analysis days={7}/></>,'Analisis Data':<Analysis/>}}}

export default function App(){
  const[role,setRole]=useState();const[portal,setPortal]=useState(null);const[ready,setReady]=useState(false);const[tab,setTab]=useState('Papan Pemuka')
  useEffect(()=>{const f=async()=>{const{data:{session}}=await supabase.auth.getSession()
    if(!session){setRole(null);setReady(true);return}
    const{data}=await supabase.from('user_profiles').select('role').single();setRole(data?.role||null);setPortal(null);setTab('Papan Pemuka');setReady(true)}
    f();const{data:{subscription}}=supabase.auth.onAuthStateChange(()=>f());return()=>subscription.unsubscribe()},[])
  if(!ready)return <div className="login card">Memuatkan…</div>
  if(!role)return portal?<Login pre={portal} back={()=>setPortal(null)}/>:<Landing go={setPortal}/>
  const P=PORTAL[role];return <Shell tabs={P.tabs} tab={tab} setTab={setTab}>{P.view[tab]}</Shell>}
