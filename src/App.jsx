import {useEffect,useState,useCallback} from 'react'
import {supabase,rpcRetry} from './supabase'
import {parseCSV,muatTurunTemplat} from './csv'
import {janaPDF,simpanExcel} from './laporan'
import {KPM_2027,KELANTAN_2027} from './kpm2027'
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
    if(!error)setEmo('');setTimeout(()=>{setMsg('');if(!error)setSid('');setBusy(false)},error?2500:3500)}
  if(msg)return <div className="priv"><h1>{msg}</h1></div>
  if(sid)return <div className="priv"><h1>HARI INI SAYA RASA...</h1><div className="emos" style={{width:'min(900px,100%)'}}>
    {EMO.map(([k,e,l])=><button key={k} className={'emo '+(emo===k?'sel':'')} onClick={()=>setEmo(k)}>{e}<small>{l}</small></button>)}</div>
    <div className="row" style={{justifyContent:'center'}}><button style={{fontSize:'1.1rem'}} disabled={busy} onClick={()=>{setSid('');setEmo('')}}>‹ Kembali ke laman</button><button className="pri" style={{fontSize:'1.2rem'}} disabled={!emo||busy} onClick={send}>HANTAR EMOSI SAYA</button></div></div>
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

const ST=['Baharu','Perlu Kaunseling','Dalam Pemantauan','Tindakan Susulan','Selesai']
const STC={'Baharu':'#60a5fa','Perlu Kaunseling':'#f87171','Dalam Pemantauan':'#facc15','Tindakan Susulan':'#fb923c','Selesai':'#34d399'}
function Alerts(){
  const[rows,setR]=useState([]);const[f,setF]=useState('Semua');const[err,setErr]=useState('')
  const load=()=>supabase.from('referral_alerts').select('*,students(name,class)').order('alert_date',{ascending:false}).limit(200).then(({data})=>setR(data||[]))
  useEffect(()=>{load();const ch=supabase.channel('al').on('postgres_changes',{event:'INSERT',schema:'public',table:'referral_alerts'},load).subscribe();return()=>supabase.removeChannel(ch)},[])
  const save=async(r,patch)=>{setErr('');const{data:{user}}=await supabase.auth.getUser()
    const{error}=await supabase.from('referral_alerts').update({...patch,handled_by:user.id,updated_at:new Date().toISOString()}).eq('id',r.id)
    if(error)setErr('Ralat menyimpan: '+error.message);load()}
  const n=s=>rows.filter(r=>r.status===s).length
  const shown=f==='Semua'?rows:rows.filter(r=>r.status===f)
  return <div className="card"><h2>Amaran Emosi &amp; Rujukan</h2><p className="muted">Petunjuk awal untuk perhatian dan bimbingan, bukan diagnosis kesihatan mental.</p>
    {n('Perlu Kaunseling')>0&&<div className="card" style={{borderColor:STC['Perlu Kaunseling'],marginBottom:10}}>🚩 <b>{n('Perlu Kaunseling')}</b> murid ditandakan <b>Perlu Kaunseling</b>.</div>}
    <div className="row" style={{marginBottom:12}}>{['Semua',...ST].map(s=><button key={s} className={f===s?'pri':''} onClick={()=>setF(s)}>{s} ({s==='Semua'?rows.length:n(s)})</button>)}</div>
    {err&&<p style={{color:'#f87171'}}>{err}</p>}
    {!shown.length&&<p className="muted">Tiada amaran.</p>}
    {shown.map(r=><div key={r.id} className="card" style={{marginBottom:10,borderLeft:'5px solid '+STC[r.status]}}><b>{r.students?.name}</b> · {r.students?.class} · {r.alert_date} · 😢😢😢 <span style={{color:STC[r.status],fontWeight:600}}>{r.status}</span>
      <div className="row" style={{marginTop:8}}><select value={r.status} onChange={e=>save(r,{status:e.target.value})}>{ST.map(s=><option key={s}>{s}</option>)}</select>
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

function ImportCSV({classes,onDone}){
  const[rows,setRows]=useState([]);const[file,setFile]=useState('');const[msg,setMsg]=useState('');const[errs,setErrs]=useState([]);const[busy,setBusy]=useState(false)
  const names=new Set(classes.map(c=>c.name));const norm=s=>(s||'').replace(/\s+/g,' ').trim()
  const valid=r=>r.name&&names.has(r.class);const ok=rows.filter(valid);const bad=rows.filter(r=>!valid(r))
  const pick=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;setMsg('');setErrs([]);setRows([]);setFile(f.name)
    if(f.size>2e6){setMsg('Fail terlalu besar (maksimum 2 MB).');return}
    const raw=parseCSV(await f.text());if(!raw.length){setMsg('Fail kosong.');return}
    const h=raw[0].map(x=>norm(x).toLowerCase());let ni=h.findIndex(x=>['nama','name','nama murid'].includes(x));let ki=h.findIndex(x=>['kelas','class'].includes(x))
    const hasH=ni>=0&&ki>=0;if(!hasH){ni=0;ki=1}
    const out=raw.slice(hasH?1:0).map((r,i)=>({line:i+(hasH?2:1),name:norm(r[ni]),class:norm(r[ki]).toUpperCase()}))
    if(out.length>2000){setMsg('Maksimum 2000 baris setiap import. Pecahkan fail kepada beberapa bahagian.');return}
    setRows(out)}
  const hantar=async()=>{setBusy(true);setMsg('');const{data,error}=await supabase.rpc('import_students',{p_rows:ok});setBusy(false)
    if(error){setMsg('Ralat: '+error.message);return}
    setMsg(data.message);setErrs(data.errors||[]);if(data.success){setRows([]);setFile('');onDone()}}
  return <div className="card"><h2>Muat Naik CSV Data Murid</h2>
    <p className="muted">Fail CSV dengan 2 lajur: <b>nama</b> dan <b>kelas</b> (contoh: AHMAD BIN ALI, 1 GALAXY). Nama kelas mesti sama dengan senarai kelas sistem. Murid yang nama dan kelasnya sudah wujud akan dilangkau.</p>
    <div className="row"><button onClick={muatTurunTemplat}>⬇ Muat turun templat</button><input type="file" accept=".csv,text/csv" onChange={pick}/></div>
    {file&&rows.length>0&&<div style={{marginTop:10}}><p><b>{file}</b>: <span className="ok">{ok.length} baris sah</span>{bad.length>0&&<> · <span style={{color:'#f87171'}}>{bad.length} baris tidak sah</span></>}</p>
      {bad.length>0&&<ul className="muted" style={{margin:'0 0 10px'}}>{bad.slice(0,10).map(r=><li key={r.line}>Baris {r.line}: "{r.name||'(nama kosong)'}" / "{r.class||'(kelas kosong)'}"</li>)}{bad.length>10&&<li>…dan {bad.length-10} lagi</li>}</ul>}
      <button className="pri" disabled={busy||!ok.length} onClick={hantar}>{busy?'Mengimport…':'Import '+ok.length+' murid'}</button></div>}
    {msg&&<p><b>{msg}</b></p>}{errs.length>0&&<ul className="muted">{errs.map((x,i)=><li key={i}>{x}</li>)}</ul>}</div>}

function Murid(){
  const classes=useClasses();const[cls,setCls]=useState('');const[q,setQ]=useState('');const[st,setSt]=useState('Semua');const[pg,setPg]=useState(0);const[rows,setR]=useState([]);const[ld,setLd]=useState(true)
  const[nm,setNm]=useState('');const[nc,setNc]=useState('');const[msg,setMsg]=useState('');const[tick,setTick]=useState(0);const[sel,setSel]=useState([]);const dq=useDeb(q)
  useEffect(()=>{setPg(0)},[cls,dq,st]);useEffect(()=>{setSel([])},[cls,dq,st,pg,tick])
  useEffect(()=>{setLd(true);let r=supabase.from('students').select('id,name,class,is_active').order('class').order('name').range(pg*50,pg*50+49)
    if(cls)r=r.eq('class',cls);if(dq)r=r.ilike('name','%'+dq+'%');if(st==='Aktif')r=r.eq('is_active',true);if(st==='Tidak aktif')r=r.eq('is_active',false)
    r.then(({data})=>{setR(data||[]);setLd(false)})},[cls,dq,st,pg,tick])
  const run=async(fn,args)=>{const{data,error}=await supabase.rpc(fn,args);setMsg(error?'Ralat: '+error.message:data.message);if(!error&&data.success){setTick(t=>t+1);return true}}
  const tambah=async e=>{e.preventDefault();if(await run('add_student',{p_name:nm,p_class:nc}))setNm('')}
  const padam=r=>window.confirm(`PADAM KEKAL "${r.name}" (${r.class})?\n\nSemua rekod emosi dan amaran murid ini turut dipadam dan TIDAK boleh dipulihkan.\nGunakan "Nyahaktif" jika sejarah emosi perlu dikekalkan.`)&&run('delete_student',{p_id:r.id})
  const padamBanyak=()=>{if(window.prompt(`PADAM KEKAL ${sel.length} murid yang dipilih beserta SEMUA rekod emosi dan amaran mereka.\nTindakan ini TIDAK boleh dipulihkan.\n\nTaip PADAM untuk sahkan:`)==='PADAM')run('delete_students',{p_ids:sel})}
  const toggle=id=>setSel(s=>s.includes(id)?s.filter(x=>x!==id):[...s,id])
  return <><form className="card" onSubmit={tambah}><h2>Tambah Murid</h2><div className="row"><input style={{flex:1}} placeholder="Nama murid" value={nm} onChange={e=>setNm(e.target.value)} required/>
    <select value={nc} onChange={e=>setNc(e.target.value)} required><option value="">— Pilih kelas —</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select><button className="pri">+ Tambah</button></div>
    {msg&&<p className="muted">{msg}</p>}</form>
    <ImportCSV classes={classes} onDone={()=>setTick(t=>t+1)}/>
    <div className="card"><h2>Senarai Murid</h2><div className="row"><select value={cls} onChange={e=>setCls(e.target.value)}><option value="">Semua kelas</option>{classes.map(c=><option key={c.name}>{c.name}</option>)}</select>
    <select value={st} onChange={e=>setSt(e.target.value)}>{['Semua','Aktif','Tidak aktif'].map(s=><option key={s}>{s}</option>)}</select>
    <input placeholder="Cari nama…" value={q} onChange={e=>setQ(e.target.value)}/>
    {sel.length>0&&<button style={{color:'#f87171'}} onClick={padamBanyak}>🗑 Padam {sel.length} dipilih</button>}</div>
    {ld?<p>Memuatkan…</p>:!rows.length?<p className="muted">Tiada murid.</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th><input type="checkbox" style={{width:'auto'}} title="Pilih semua di halaman ini" checked={rows.length>0&&sel.length===rows.length} onChange={e=>setSel(e.target.checked?rows.map(r=>r.id):[])}/></th><th>Nama</th><th>Kelas</th><th>Status</th><th>Tindakan</th></tr></thead><tbody>
    {rows.map(r=><tr key={r.id}><td><input type="checkbox" style={{width:'auto'}} checked={sel.includes(r.id)} onChange={()=>toggle(r.id)}/></td><td>{r.name}</td><td>{r.class}</td><td className={r.is_active?'ok':'no'}>{r.is_active?'Aktif':'Tidak aktif'}</td>
    <td><div className="row"><button onClick={()=>run('set_student_active',{p_id:r.id,p_active:!r.is_active})}>{r.is_active?'Nyahaktif':'Aktifkan'}</button><button style={{color:'#f87171'}} onClick={()=>padam(r)}>🗑 Padam</button></div></td></tr>)}</tbody></table></div>}
    <div className="row" style={{marginTop:10}}><button disabled={!pg} onClick={()=>setPg(pg-1)}>‹</button><span>Halaman {pg+1}</span><button disabled={rows.length<50} onClick={()=>setPg(pg+1)}>›</button></div></div></>}

function Laporan(){
  const[f,setF]=useState(ago(30));const[t,setT]=useState(today());const[busy,setBusy]=useState('');const[msg,setMsg]=useState('')
  const buat=async j=>{setBusy(j);setMsg('');try{await(j==='pdf'?janaPDF:simpanExcel)(f,t);setMsg('Laporan berjaya dijana. Semak folder muat turun anda.')}catch(e){setMsg('Ralat: '+(e.message||e))}setBusy('')}
  return <div className="card"><h2>Laporan</h2><p className="muted">Mengandungi statistik emosi agregat, ringkasan mengikut kelas dan senarai murid dalam amaran / perlu kaunseling. Dokumen ini SULIT, kongsi kepada pihak berkenaan sahaja.</p>
    <div className="row">{[7,30,90,180,365].map(x=><button key={x} onClick={()=>{setF(ago(x));setT(today())}}>{x} hari</button>)}</div>
    <div className="row" style={{margin:'12px 0'}}><label className="muted">Dari<br/><input type="date" value={f} onChange={e=>setF(e.target.value)}/></label><label className="muted">Hingga<br/><input type="date" value={t} onChange={e=>setT(e.target.value)}/></label></div>
    {f>t&&<p style={{color:'#f87171'}}>Tarikh mula mesti sebelum tarikh akhir.</p>}
    <div className="row"><button className="pri" disabled={!!busy||f>t} onClick={()=>buat('pdf')}>{busy==='pdf'?'Menjana…':'📄 Jana Laporan PDF'}</button><button className="pri" disabled={!!busy||f>t} onClick={()=>buat('xlsx')}>{busy==='xlsx'?'Menjana…':'📊 Simpan Laporan Excel'}</button></div>
    {msg&&<p><b>{msg}</b></p>}</div>}

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

function Kalendar(){
  const t0=new Date();const[ym,setYm]=useState([t0.getFullYear(),t0.getMonth()]);const[data,setData]=useState({});const[sel,setSel]=useState(null);const[det,setDet]=useState(null);const[ld,setLd]=useState(true)
  const[y,m]=ym;const first=new Date(y,m,1);const last=new Date(y,m+1,0);const td=today()
  useEffect(()=>{setLd(true);supabase.rpc('daily_participation',{p_from:iso(first),p_to:iso(last)}).then(({data:d})=>{const o={};(d||[]).forEach(r=>{o[r.day]=r});setData(o);setLd(false)})},[y,m])
  useEffect(()=>{setDet(null);if(sel)supabase.rpc('day_class_participation',{p_date:sel}).then(({data:d})=>setDet(d||[]))},[sel])
  const go=n=>{const d=new Date(y,m+n,1);setYm([d.getFullYear(),d.getMonth()]);setSel(null)}
  const cells=[...Array(first.getDay()).fill(null),...Array.from({length:last.getDate()},(_,i)=>i+1)]
  const sum=k=>(det||[]).reduce((a,r)=>a+r[k],0)
  return <><div className="card"><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><button onClick={()=>go(-1)}>‹</button>
    <h2 style={{margin:0}}>{first.toLocaleDateString('ms-MY',{month:'long',year:'numeric'})}</h2><button onClick={()=>go(1)}>›</button></div>
    <p className="muted">✓ sudah menjawab · ✗ belum menjawab. Warna hijau lebih pekat bermakna penyertaan lebih tinggi. Hari bukan persekolahan dipudarkan. Klik satu hari untuk lihat mengikut kelas.</p>
    <div className="calgrid">{['Ahd','Isn','Sel','Rab','Kha','Jum','Sab'].map(x=><div key={x} className="muted" style={{textAlign:'center'}}>{x}</div>)}
    {cells.map((d,i)=>{if(!d)return <div key={'e'+i}/>;const k=iso(new Date(y,m,d));const r=data[k];const fut=k>td;const sch=!!r?.school_day;const pc=r&&r.total?r.done/r.total:0
      return <button key={k} className="cal" onClick={()=>setSel(k)} style={{background:sch&&!fut?`rgba(52,211,153,${(.08+pc*.45).toFixed(2)})`:'rgba(255,255,255,.04)',opacity:sch?1:.5,outline:k===sel?'2px solid #fff':k===td?'2px solid #6d5dfc':'none'}}>
        <b>{d}</b>{sch&&!fut&&r&&<><span className="ok">✓ {r.done}</span><span>✗ {Math.max(0,r.total-r.done)}</span></>}</button>})}</div>{ld&&<p className="muted">Memuatkan…</p>}</div>
    {sel&&<div className="card"><h3>{new Date(sel+'T00:00:00').toLocaleDateString('ms-MY',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3>
      {data[sel]&&!data[sel].school_day&&<p className="muted">Bukan hari persekolahan.</p>}
      {!det?<p className="muted">Memuatkan…</p>:<div style={{overflowX:'auto'}}><table><thead><tr><th>Kelas</th><th>Jumlah murid</th><th>Sudah menjawab</th><th>Belum menjawab</th></tr></thead><tbody>
      {det.map(r=><tr key={r.class}><td>{r.class}</td><td>{r.total}</td><td className="ok">{r.done}</td><td>{r.total-r.done}</td></tr>)}
      <tr><td><b>Jumlah</b></td><td><b>{sum('total')}</b></td><td className="ok"><b>{sum('done')}</b></td><td><b>{sum('total')-sum('done')}</b></td></tr></tbody></table></div>}</div>}</>}

const fmtD=d=>d.slice(8)+'/'+d.slice(5,7)
function KalendarSekolah(){
  const t0=new Date();const[ym,setYm]=useState([t0.getFullYear(),t0.getMonth()]);const[map,setMap]=useState({});const[sel,setSel]=useState(null)
  const[jenis,setJenis]=useState('cuti');const[ket,setKet]=useState('');const[hingga,setHingga]=useState('');const[busy,setBusy]=useState(false);const[msg,setMsg]=useState('');const[tick,setTick]=useState(0)
  const[y,m]=ym;const first=new Date(y,m,1);const last=new Date(y,m+1,0);const td=today()
  useEffect(()=>{supabase.from('school_calendar').select('calendar_date,is_school_day,description').gte('calendar_date',iso(first)).lte('calendar_date',iso(last))
    .then(({data})=>{const o={};(data||[]).forEach(r=>{o[r.calendar_date]=r});setMap(o)})},[y,m,tick])
  const info=k=>{const r=map[k];const def=new Date(k+'T00:00:00').getDay()<=4
    return r?{school:r.is_school_day,desc:r.description||'',set:true,def}:{school:def,desc:def?'':'Hujung minggu',set:false,def}}
  const go=n=>{const d=new Date(y,m+n,1);setYm([d.getFullYear(),d.getMonth()]);setSel(null);setMsg('')}
  const pick=k=>{const i=info(k);setSel(k);setHingga(k);setJenis(i.school?'cuti':'sekolah');setKet(map[k]?.description||'');setMsg('')}
  const run=async(fn,args)=>{setBusy(true);setMsg('');const{data,error}=await supabase.rpc(fn,args);setBusy(false)
    if(error){setMsg('Ralat: '+error.message);return}setMsg(data.message);if(data.success)setTick(t=>t+1)}
  const simpan=()=>run('set_school_ranges',{p_items:[{from:sel,to:hingga||sel,school:jenis==='sekolah',desc:ket}]})
  const padam=()=>run('clear_school_days',{p_from:sel,p_to:hingga||sel})
  const muat=(items,nama)=>{if(window.confirm('Muatkan '+nama+'?\n\nTarikh yang sama akan ditimpa dengan data ini.'))run('set_school_ranges',{p_items:items})}
  const cells=[...Array(first.getDay()).fill(null),...Array.from({length:last.getDate()},(_,i)=>i+1)]
  const list=Object.values(map).sort((a,b)=>a.calendar_date<b.calendar_date?-1:1).reduce((a,r)=>{const p=a[a.length-1]
    const nx=p&&iso(new Date(new Date(p.to+'T00:00:00').getTime()+864e5))
    if(p&&nx===r.calendar_date&&p.school===r.is_school_day&&p.desc===(r.description||''))p.to=r.calendar_date
    else a.push({from:r.calendar_date,to:r.calendar_date,school:r.is_school_day,desc:r.description||''});return a},[])
  const si=sel?info(sel):null
  return <><div className="card"><div className="row" style={{justifyContent:'space-between',alignItems:'center'}}><button onClick={()=>go(-1)}>‹</button>
    <h2 style={{margin:0}}>Kalendar Sekolah · {first.toLocaleDateString('ms-MY',{month:'long',year:'numeric'})}</h2><button onClick={()=>go(1)}>›</button></div>
    <p className="muted">Lalai: Ahad hingga Khamis ialah hari persekolahan; Jumaat dan Sabtu ialah hujung minggu. Klik satu tarikh untuk tandakan cuti atau hari persekolahan ganti. Cuti yang ditanda akan dikecualikan daripada kiraan "belum menjawab" dan pengesanan sedih 3 hari berturut-turut.</p>
    <div className="row muted" style={{marginBottom:8}}><span>🟥 Cuti</span><span>🟩 Hari sekolah ganti</span><span>⬜ Hari sekolah biasa</span><span>▫ Hujung minggu</span></div>
    <div className="calgrid">{['Ahd','Isn','Sel','Rab','Kha','Jum','Sab'].map(x=><div key={x} className="muted" style={{textAlign:'center'}}>{x}</div>)}
    {cells.map((d,i)=>{if(!d)return <div key={'e'+i}/>;const k=iso(new Date(y,m,d));const f=info(k)
      const bg=f.set&&!f.school?'rgba(248,113,113,.28)':!f.school?'rgba(255,255,255,.04)':f.set?'rgba(52,211,153,.22)':'rgba(255,255,255,.08)'
      return <button key={k} className="cal" onClick={()=>pick(k)} style={{background:bg,opacity:(!f.school&&!f.set)?0.5:1,outline:k===sel?'2px solid #fff':k===td?'2px solid #6d5dfc':'none'}}>
        <b>{d}</b>{f.desc&&<span className="muted" style={{fontSize:'.62rem',lineHeight:1.15,overflow:'hidden',display:'-webkit-box',WebkitLineClamp:2,WebkitBoxOrient:'vertical'}}>{f.desc}</span>}</button>})}</div></div>
    {sel&&<div className="card"><h3>{new Date(sel+'T00:00:00').toLocaleDateString('ms-MY',{weekday:'long',day:'numeric',month:'long',year:'numeric'})}</h3>
      <p className="muted">Status semasa: {si.school?(si.set?'Hari persekolahan (ditetapkan)':'Hari persekolahan (lalai)'):(si.set?'Cuti: '+(si.desc||'tanpa keterangan'):'Hujung minggu (lalai)')}</p>
      <div className="row"><select value={jenis} onChange={e=>setJenis(e.target.value)}><option value="cuti">Tandakan sebagai Cuti</option><option value="sekolah">Tandakan sebagai Hari persekolahan</option></select>
      <input style={{flex:1}} placeholder="Keterangan (cth. Cuti peristiwa)" maxLength={120} value={ket} onChange={e=>setKet(e.target.value)}/></div>
      <div className="row" style={{margin:'10px 0'}}><label className="muted">Hingga tarikh (untuk julat, boleh dibiar sama)<br/><input type="date" min={sel} value={hingga} onChange={e=>setHingga(e.target.value)}/></label></div>
      <div className="row"><button className="pri" disabled={busy||!hingga||hingga<sel} onClick={simpan}>{busy?'Menyimpan…':'Simpan'}</button>
      <button disabled={busy||!hingga||hingga<sel} onClick={padam}>Padam penetapan (kembali ke lalai)</button></div></div>}
    <div className="card"><h3>Penetapan bulan ini</h3>{!list.length?<p className="muted">Tiada penetapan. Semua hari mengikut lalai Ahad hingga Khamis.</p>:
      <table><tbody>{list.map(r=><tr key={r.from}><td style={{whiteSpace:'nowrap'}}>{r.from===r.to?fmtD(r.from):fmtD(r.from)+' - '+fmtD(r.to)}</td><td className={r.school?'ok':''}>{r.school?'Hari sekolah ganti':'Cuti'}</td><td>{r.desc}</td></tr>)}</tbody></table>}</div>
    <div className="card"><h3>Muat kalendar rasmi KPM</h3><p className="muted">Menetapkan semua tarikh cuti penggal, cuti tambahan KPM dan cuti am 2027 bagi Kumpulan A (Kedah, Kelantan, Terengganu) mengikut Surat Siaran KPM Bil. 1 Tahun 2026. Tarikh yang sama akan ditimpa. Anda masih boleh mengubah mana-mana hari selepas itu.</p>
      <div className="row"><button className="pri" disabled={busy} onClick={()=>muat(KPM_2027,'Kalendar KPM 2027 (Kumpulan A)')}>📅 Muat Kalendar KPM 2027</button>
      <button disabled={busy} onClick={()=>muat(KELANTAN_2027,'cuti negeri Kelantan 2027 (Keputeraan Sultan 29-30 Sep)')}>Tambah cuti negeri Kelantan 2027</button></div></div>
    {msg&&<div className="card"><b>{msg}</b></div>}</>}

const PORTAL={teacher:{tabs:['Papan Pemuka','Semakan Emosi Harian','Status Penyertaan'],view:{'Papan Pemuka':<Summary/>,'Semakan Emosi Harian':<CheckIn/>,'Status Penyertaan':<Status/>}},
 gbk:{tabs:['Papan Pemuka','Kalendar Penyertaan','Kalendar Sekolah','Peta Haba & Trend Emosi','Amaran Emosi','Pengurusan Murid','Laporan','Naik Kelas'],view:{'Papan Pemuka':<><Summary/><Analysis days={7}/></>,'Kalendar Penyertaan':<Kalendar/>,'Kalendar Sekolah':<KalendarSekolah/>,'Peta Haba & Trend Emosi':<Analysis/>,'Amaran Emosi':<Alerts/>,'Pengurusan Murid':<Murid/>,'Laporan':<Laporan/>,'Naik Kelas':<NaikKelas/>}},
 admin:{tabs:['Papan Pemuka','Analisis Data','Status Murid'],view:{'Papan Pemuka':<><Summary/><Analysis days={7}/></>,'Analisis Data':<Analysis/>,'Status Murid':<Status/>}}}

export default function App(){
  const[role,setRole]=useState();const[portal,setPortal]=useState(null);const[ready,setReady]=useState(false);const[tab,setTab]=useState('Papan Pemuka')
  useEffect(()=>{const f=async()=>{const{data:{session}}=await supabase.auth.getSession()
    if(!session){setRole(null);setReady(true);return}
    const{data}=await supabase.from('user_profiles').select('role').single();setRole(data?.role||null);setPortal(null);setTab('Papan Pemuka');setReady(true)}
    f();const{data:{subscription}}=supabase.auth.onAuthStateChange(()=>f());return()=>subscription.unsubscribe()},[])
  if(!ready)return <div className="login card">Memuatkan…</div>
  if(!role)return portal?<Login pre={portal} back={()=>setPortal(null)}/>:<Landing go={setPortal}/>
  const P=PORTAL[role];return <Shell tabs={P.tabs} tab={tab} setTab={setTab}>{P.view[tab]}</Shell>}
