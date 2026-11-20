// =====================================================================================================================
// extras.js: features added Nov 2026, built after app.js into the same script (so it shares S, DATA, render, …).
//   sync (Stobite account, Supabase) · bookmarks + reading history + "continue on this device" · compare versions
//   search filters · reading-plan pace, catch-up, read-ahead, calendar reminder · memorise · themes (in app.js prefs)
//   Dag Heward-Mills EPUB reader (Mac app only)
// =====================================================================================================================

// ---------- Bookmarks, reading history, memory verses ----------
let BMS=store.get('bookmarks',[]), HIST=store.get('history',[]), MEM=store.get('mem',[]);
const DEV=store.get('dev',null)||(()=>{ const d=Math.random().toString(36).slice(2,10); store.set('dev',d); return d; })();
const DEVNAME=window.MAC_APP?'Mac':/iPhone/.test(navigator.userAgent)?'iPhone':/iPad/.test(navigator.userAgent)?'iPad':/Android/.test(navigator.userAgent)?'Android':'browser';
let LASTMOVE=Date.now();
function histRecord(){
  const top=HIST[0], now=Date.now();
  if(!top||top.b!==S.b||top.c!==S.c){ HIST.unshift({b:S.b,c:S.c,t:now,d:DEVNAME}); HIST=HIST.slice(0,100); LASTMOVE=now; store.set('history',HIST); syncPut('x-history',{list:HIST}); }
  const pos={b:S.b,c:S.c,v:oneMode()?ONE:0,ver:S.v,t:now,dev:DEV,dn:DEVNAME};
  store.set('pos',pos); if(!top||top.b!==S.b||top.c!==S.c) syncPut('x-pos',pos);
}
function mergeHist(a,b){
  const seen=new Set(), all=[...a,...b].filter(x=>x&&x.t).sort((x,y)=>y.t-x.t), out=[];
  for(const x of all){ const k=x.b+'.'+x.c+'.'+x.t; if(seen.has(k)) continue; seen.add(k); const p=out[out.length-1]; if(p&&p.b===x.b&&p.c===x.c) continue; out.push(x); }
  return out.slice(0,100);
}
const bmIndex=(b,c,v)=>BMS.findIndex(x=>x.b===b&&x.c===c&&x.v===v);
function toggleBookmark(b,c,v){
  const i=bmIndex(b,c,v); if(i>=0) BMS.splice(i,1); else BMS.unshift({b,c,v,t:Date.now()});
  store.set('bookmarks',BMS); syncPut('x-bookmarks',{list:BMS}); return i<0;
}
const memFind=(b,c,v)=>MEM.find(x=>x.b===b&&x.c===c&&x.v===v);
function saveMem(){ store.set('mem',MEM); syncPut('x-mem',{list:MEM}); }
function showBookmarks(){
  searchMode={type:'bm'}; closePanel();
  const vt=(b,c,v)=>{ const s=((DATA[S.v][b]||[])[c-1]||[])[v-1]; return s?render(s,{strongs:false,god:false}).html:''; };
  const bms=BMS.map(x=>`<div class="res" data-b="${x.b}" data-c="${x.c-1}" data-v="${x.v-1}"><div class="rr">${NAMES[x.b]} ${x.c}:${x.v}<button class="rmx" data-rmbm="${x.b}.${x.c}.${x.v}" aria-label="Remove bookmark">Remove</button></div><div class="rt">${vt(x.b,x.c,x.v)}</div></div>`).join('');
  const LV=['Read','Some hidden','Half hidden','Most hidden','First letters','All hidden'];
  const mem=MEM.map(x=>`<div class="res" data-memo="${x.b}.${x.c}.${x.v}"><div class="rr">${NAMES[x.b]} ${x.c}:${x.v} · ${LV[x.level||0]}</div><div class="rt">${vt(x.b,x.c,x.v)}</div></div>`).join('');
  const hist=HIST.slice(0,40).map(x=>`<div class="res hrow" data-b="${x.b}" data-c="${x.c}" data-v="-1"><div class="rr">${NAMES[x.b]} ${x.c+1}<span>${ago(x.t)}${x.d&&x.d!==DEVNAME?' · '+esc(x.d):''}</span></div></div>`).join('');
  $('#col').classList.remove('wide','onev');
  $('#col').innerHTML=header('Bookmarks and history','Bookmark a verse from its panel. Tap anything here to open it.')
    +`<div class="sec">Bookmarks</div>${bms||'<p class="none">No bookmarks yet. Tap a verse number, then Bookmark.</p>'}`
    +`<div class="sec">Memory verses</div>${mem||'<p class="none">Tap a verse number, then Memorise, to learn it by heart.</p>'}`
    +`<div class="sec">Recently read</div>${hist||'<p class="none">Chapters you read will appear here.</p>'}`;
  $('#reft').textContent='Bookmarks'; $('#scroll').scrollTop=0; buildBooks(); syncControls();
}
// "Continue on this device": when another device read somewhere else more recently, offer to jump there.
function remotePos(p){
  if(!p||p.dev===DEV||p.t<=LASTMOVE||(p.b===S.b&&p.c===S.c)) return;
  const el=$('#cont'); el.innerHTML=`<span>Continue at <b>${NAMES[p.b]} ${p.c+1}</b>${p.dn?` · from your ${esc(p.dn)}`:''}</span><button data-cgo>Go</button><button data-cx aria-label="Dismiss">✕</button>`;
  el.dataset.p=JSON.stringify(p); el.classList.add('open');
}
$('#cont').onclick=e=>{
  const el=$('#cont'), b=e.target.closest('button'); if(!b) return;
  if('cgo' in b.dataset){ const p=JSON.parse(el.dataset.p||'null'); if(p){ if(p.v){ ONE=p.v; ONEKEY=p.b+'.'+p.c; } go(p.b,p.c,p.v||0); } }
  el.classList.remove('open');
};

// ---------- Compare this verse in every version (verse panel) ----------
async function fillCompare(b,c,n){
  const el=$('#cmp'); if(!el) return; const vs=Object.keys(VN).filter(v=>v!==S.v);
  await Promise.all(vs.map(v=>load(v).catch(()=>null)));
  if(SELV!==n||S.b!==b||S.c+1!==c||!$('#cmp')) return;
  const rows=vs.map(v=>{ const s=(((DATA[v]||[])[b]||[])[c-1]||[])[n-1]; return s?`<div class="cmpv"><b>${esc(VN[v])}</b><span class="serif">${render(s,{strongs:false,god:false}).html}</span></div>`:''; }).join('');
  $('#cmp').innerHTML=rows||'<span class="mute">No other version has this verse.</span>';
}

// ---------- Search filters ----------
const SSCOPES=[['all','Whole Bible'],['ot','Old Testament'],['nt','New Testament'],['gos','Gospels'],['book','This book']];
const inScope=b=>{ const k=S.sscope||'all'; return k==='all'||(k==='ot'&&b<39)||(k==='nt'&&b>=39)||(k==='gos'&&b>=39&&b<=42)||(k==='book'&&b===S.b); };
function searchChips(){
  const k=S.sscope||'all';
  return `<div class="fl">${SSCOPES.map(([id,l])=>`<button data-sscope="${id}" class="${k===id?'on':''}">${id==='book'?esc(NAMES[S.b]):l}</button>`).join('')}${MARKED.has(S.v)?`<button data-sgod class="${S.sgod?'on':''}"><i style="background:var(--red)"></i>God’s words</button>`:''}</div>`;
}

// ---------- Clicks for the new page content ----------
function extrasClick(e){
  const rb=e.target.closest('[data-rmbm]'); if(rb){ const [b,c,v]=rb.dataset.rmbm.split('.').map(Number); toggleBookmark(b,c,v); showBookmarks(); return true; }
  const sc=e.target.closest('[data-sscope]'); if(sc){ S.sscope=sc.dataset.sscope; save(); textSearch(searchMode.q); return true; }
  const sg=e.target.closest('[data-sgod]'); if(sg){ S.sgod=!S.sgod; save(); textSearch(searchMode.q); return true; }
  const mo=e.target.closest('[data-memo]'); if(mo){ const [b,c,v]=mo.dataset.memo.split('.').map(Number); memoOpen(b,c,v); return true; }
  return false;
}

// ---------- Reading plan: pace, catch up, read ahead, calendar reminder ----------
function planPace(){
  const P=PLAN, t=ymd(new Date()), start=P.created||t, all=readDays(P,start<t?start:t);
  const before=all.filter(d=>d<t).length, total=planChapters(P).length;
  const expected=Math.round(total*before/Math.max(1,all.length)), done=planProgress().n;
  return {behind:Math.max(0,expected-done), ahead:Math.max(0,done-expected)};
}
function planExtrasHTML(today,done,fut){
  const pc=planPace(), allDone=today.length&&done.length===today.length;
  let h='';
  if(pc.behind>0) h+=`<div class="ppace behind"><span><b>${pc.behind}</b> ${pc.behind===1?'chapter':'chapters'} behind your starting pace</span><button class="pill" data-catchup>Catch up today</button></div>`;
  else if(pc.ahead>0) h+=`<div class="ppace"><span>${pc.ahead} ${pc.ahead===1?'chapter':'chapters'} ahead of pace</span></div>`;
  else h+=`<div class="ppace"><span>On track</span></div>`;
  if(allDone&&fut.sched[0]) h+=`<button class="pill pahead" data-readahead>Read ahead: add ${dayLabel(fut.sched[0].date)}’s ${fut.sched[0].ch.length} ${fut.sched[0].ch.length===1?'chapter':'chapters'}</button>`;
  h+=`<div class="pl" style="margin-top:16px">Daily reminder</div>
    <div class="prow prem"><input type="time" id="ptime" value="${S.planTime||'07:00'}"><button class="pill" data-ics>Add to Calendar</button></div>
    <div class="psub" style="margin-top:6px">Adds a repeating reading time, with an alert, to your calendar until ${dayLong(PLAN.end)}${(PLAN.off||[]).length?', skipping your days off':''}.</div>`;
  return h;
}
function planICS(){
  const P=PLAN, tm=(S.planTime||'07:00').replace(':',''), d0=ymd(new Date()).replace(/-/g,''), d1=P.end.replace(/-/g,'');
  const days=['SU','MO','TU','WE','TH','FR','SA'].filter((_,i)=>!(P.off||[]).includes(i));
  const url=location.protocol.startsWith('http')?location.href.split('#')[0].split('?')[0]:'https://stobitejunior-create.github.io/my-bible/';
  const stamp=new Date().toISOString().replace(/[-:]/g,'').slice(0,15)+'Z';
  return ['BEGIN:VCALENDAR','VERSION:2.0','PRODID:-//My Bible//Reading plan//EN','CALSCALE:GREGORIAN','BEGIN:VEVENT',
    `UID:my-bible-plan-${(P.created||d0).replace(/-/g,'')}-${tm}@stobite`,`DTSTAMP:${stamp}`,`DTSTART:${d0}T${tm}00`,'DURATION:PT30M',
    `RRULE:FREQ=DAILY;UNTIL=${d1}T235959${days.length<7?';BYDAY='+days.join(','):''}`,'SUMMARY:Bible reading',
    `DESCRIPTION:Today’s reading is in My Bible (☰ → Reading plan).\\n${url}`,`URL:${url}`,
    'BEGIN:VALARM','ACTION:DISPLAY','DESCRIPTION:Time for today’s Bible reading','TRIGGER:PT0M','END:VALARM','END:VEVENT','END:VCALENDAR'].join('\r\n');
}
function saveFile(name,text,type){
  if(window.MAC_APP&&window.webkit&&webkit.messageHandlers&&webkit.messageHandlers.native){ webkit.messageHandlers.native.postMessage({type:'file',name,text}); return; }
  if(/iPhone|iPad/.test(navigator.userAgent)){ location.href=`data:${type};charset=utf-8,`+encodeURIComponent(text); return; }
  const a=document.createElement('a'); a.href=URL.createObjectURL(new Blob([text],{type})); a.download=name; document.body.appendChild(a); a.click(); setTimeout(()=>{ URL.revokeObjectURL(a.href); a.remove(); },1000);
}
function planExtrasClick(D){
  if('catchup' in D){
    const pc=planPace(), have=new Set(PLAN.today.ch);
    const extra=planChapters(PLAN).filter(([b,c])=>!PLAN.done[chKey(b,c)]&&!have.has(chKey(b,c))).slice(0,pc.behind);
    PLAN.today.ch.push(...extra.map(([b,c])=>chKey(b,c))); savePlan(); renderPlan(); toast(`Added ${extra.length} ${extra.length===1?'chapter':'chapters'} to today`); return true;
  }
  if('readahead' in D){
    const t=ymd(new Date()), d=parseYmd(t); d.setDate(d.getDate()+1);
    const fut=planSchedule(PLAN,ymd(d),new Set(PLAN.today.ch)); if(fut.sched[0]) PLAN.today.ch.push(...fut.sched[0].ch.map(([b,c])=>chKey(b,c)));
    savePlan(); renderPlan(); return true;
  }
  if('ics' in D){ S.planTime=$('#ptime').value||'07:00'; save(); saveFile('Bible reading.ics',planICS(),'text/calendar'); return true; }
  return false;
}

// ---------- Memorise a verse ----------
const MLV=['Read it','Some words hidden','Half hidden','Most hidden','First letters only','All hidden'];
let MEMO=null;
function memoOpen(b,c,v){
  const s=((DATA[S.v][b]||[])[c-1]||[])[v-1]; if(!s) return;
  const words=plain(s).split(/\s+/).filter(Boolean).map(w=>{ const m=w.match(/^([“‘"(\[]*)(.*?)([,.;:!?’”"')\]]*)$/); return {pre:m[1],core:m[2],post:m[3]}; });
  const saved=memFind(b,c,v);
  MEMO={b,c,v,words,level:saved?saved.level:1,seed:Math.random(),shown:new Set()};
  closeSheets(); closePop(); renderMemo(); $('#memo').classList.add('open');
}
function memoHidden(){
  const n=MEMO.words.length, L=MEMO.level, share=[0,.25,.5,.75,1,1][L];
  const idx=[...Array(n).keys()].filter(i=>MEMO.words[i].core);
  let r=MEMO.seed; const rand=()=>{ r=(r*9301+49297)%233280; return r/233280; };
  const order=idx.map(i=>[i,rand()]).sort((a,b)=>a[1]-b[1]).map(x=>x[0]);
  return new Set(order.slice(0,Math.round(order.length*share)));
}
function renderMemo(){
  const M=MEMO, hid=memoHidden(), saved=!!memFind(M.b,M.c,M.v);
  const text=M.words.map((w,i)=>{
    if(!hid.has(i)||M.shown.has(i)) return `${esc(w.pre)}<span class="mw${hid.has(i)?' got':''}">${esc(w.core)}</span>${esc(w.post)}`;
    const blank=M.level===4?esc(w.core[0])+'<span class="ml">'+'_'.repeat(Math.max(1,w.core.length-1))+'</span>':'_'.repeat(Math.max(2,w.core.length));
    return `${esc(w.pre)}<button class="mh" data-mi="${i}">${blank}</button>${esc(w.post)}`;
  }).join(' ');
  $('#memo').innerHTML=`<div class="mcard">
    <div class="mtop"><b>${NAMES[M.b]} ${M.c}:${M.v}</b><span>${esc(VN[S.v])}</span><button class="ib" data-mx aria-label="Close"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg></button></div>
    <div class="mtext serif">${text}</div>
    <div class="mlvl"><button class="stp" data-ml="-1" aria-label="Easier">−</button><span>${MLV[M.level]}</span><button class="stp" data-ml="1" aria-label="Harder">+</button></div>
    <div class="macts"><button class="pill" data-mshuf>New gaps</button><button class="pill" data-mshow>Show all</button><button class="pill${saved?' on':''}" data-msave>${saved?'In memory verses ✓':'Add to memory verses'}</button></div>
    <div class="psub" style="text-align:center;margin-top:10px">Say the verse aloud, then tap a gap to check it. Step up when it feels easy.</div>
  </div>`;
}
$('#memo').addEventListener('click',e=>{
  e.stopPropagation(); const b=e.target.closest('button'); if(!b){ if(e.target.id==='memo') $('#memo').classList.remove('open'); return; }
  const D=b.dataset, M=MEMO;
  if(D.mi!=null) M.shown.add(+D.mi);
  else if(D.ml){ M.level=Math.max(0,Math.min(5,M.level+ +D.ml)); M.shown.clear(); const s=memFind(M.b,M.c,M.v); if(s){ s.level=M.level; s.t=Date.now(); saveMem(); } }
  else if('mshuf' in D){ M.seed=Math.random(); M.shown.clear(); }
  else if('mshow' in D){ memoHidden().forEach(i=>M.shown.add(i)); }
  else if('msave' in D){ const s=memFind(M.b,M.c,M.v); if(s) MEM=MEM.filter(x=>x!==s); else MEM.unshift({b:M.b,c:M.c,v:M.v,level:M.level,t:Date.now()}); saveMem(); }
  else if('mx' in D){ $('#memo').classList.remove('open'); if(searchMode&&searchMode.type==='bm') showBookmarks(); return; }
  renderMemo();
});

// ---------- Sync: Stobite account (Supabase project shared with Stobite Buy, table bible_docs) ----------
// Local-first: everything still saves on the device; changes queue in OUTBOX and are pushed shortly after, and other
// devices' changes are pulled every minute and when the app comes back to the front. Server time orders changes.
const SB_URL='https://hfamehbhdwptnlwmjsgi.supabase.co', SB_KEY='sb_publishable_kd0MfCYGKikPa_VEhjxdpQ_3mzlP6En';
let SB=store.get('sb',null), OUTBOX=store.get('outbox',{});
const SYNC={last:store.get('synclast','1970-01-01T00:00:00Z'),busy:false,err:'',at:store.get('syncat',0),msg:''};
const syncOn=()=>!!SB&&!MSTORE;
let syncT=0;
function syncPut(id,data){
  if(MSTORE) return;
  OUTBOX[id]=data==null?{deleted:true,data:{}}:{data}; store.set('outbox',OUTBOX);
  if(SB){ clearTimeout(syncT); syncT=setTimeout(()=>syncNow(),1500); }
}
async function sbAuth(path,body,token){
  const r=await fetch(SB_URL+'/auth/v1/'+path,{method:'POST',headers:{apikey:SB_KEY,'Content-Type':'application/json',...(token?{Authorization:'Bearer '+token}:{})},body:JSON.stringify(body||{})});
  const j=await r.json().catch(()=>({}));
  if(!r.ok) throw new Error(j.msg||j.error_description||j.message||j.error||('Something went wrong ('+r.status+')'));
  return j;
}
function sbSave(j){ SB={access:j.access_token,refresh:j.refresh_token,exp:Date.now()+(j.expires_in||3600)*1000,email:(j.user&&j.user.email)||(SB&&SB.email),uid:(j.user&&j.user.id)||(SB&&SB.uid)}; store.set('sb',SB); }
async function sbToken(){
  if(!SB) throw new Error('Not signed in');
  if(Date.now()>SB.exp-60000){
    try{ sbSave(await sbAuth('token?grant_type=refresh_token',{refresh_token:SB.refresh})); }
    catch(e){ if(/refresh token|invalid|expired|not found/i.test(e.message)){ SB=null; store.set('sb',null); } throw e; }
  }
  return SB.access;
}
async function sbRest(method,path,body,extra){
  const r=await fetch(SB_URL+'/rest/v1/'+path,{method,headers:{apikey:SB_KEY,Authorization:'Bearer '+await sbToken(),'Content-Type':'application/json',...(extra||{})},body:body?JSON.stringify(body):undefined});
  if(!r.ok){ const t=await r.text(); if(/bible_docs/.test(t)&&/does not exist|schema cache/i.test(t)) throw new Error('The sync table isn’t set up yet (supabase/bible_sync.sql).'); throw new Error(t.slice(0,160)||('Sync failed ('+r.status+')')); }
  const t=await r.text(); return t?JSON.parse(t):null;
}
function localDocs(){
  const d={}; for(const [k,v] of Object.entries(MARKS)) d[k]=v;
  if(PLAN) d['x-plan']=PLAN; d['x-reading']=READ;
  if(BMS.length) d['x-bookmarks']={list:BMS}; if(HIST.length) d['x-history']={list:HIST}; if(MEM.length) d['x-mem']={list:MEM};
  return d;
}
function applyRemote(rows,first){
  let marks=false,plan=false,other=false;
  for(const r of rows){
    if(OUTBOX[r.id]) continue;
    const d=r.deleted?null:r.data;
    if(r.id.startsWith('m-')){
      const mine=MARKS[r.id];
      if(first&&mine&&(!d||(mine.t||0)>(d.t||0))){ OUTBOX[r.id]={data:mine}; continue; }   // keep the newer copy
      if(d) MARKS[r.id]=d; else delete MARKS[r.id]; marks=true;
    }
    else if(r.id==='x-plan'){ PLAN=d; store.set('plan',PLAN); plan=true; }
    else if(r.id==='x-reading'){ if(d){ READ=Object.assign({counts:{},hist:[]},d); if(first) READ.counts={...store.get('reading',{counts:{}}).counts,...READ.counts}; store.set('reading',READ); } }
    else if(r.id==='x-bookmarks'){ BMS=first?[...(d&&d.list||[]),...BMS.filter(x=>!(d&&d.list||[]).some(y=>y.b===x.b&&y.c===x.c&&y.v===x.v))]:(d&&d.list||[]); store.set('bookmarks',BMS); other=true; }
    else if(r.id==='x-history'){ HIST=mergeHist(HIST,d&&d.list||[]); store.set('history',HIST); other=true; }
    else if(r.id==='x-mem'){ MEM=first?[...(d&&d.list||[]),...MEM.filter(x=>!(d&&d.list||[]).some(y=>y.b===x.b&&y.c===x.c&&y.v===x.v))]:(d&&d.list||[]); store.set('mem',MEM); other=true; }
    else if(r.id==='x-pos'&&d) remotePos(d);
    else if(r.id==='x-theme'&&d&&d.custom){ S.custom=d.custom; save(); applyTheme(); if(PREFPAGE==='theme'&&$('#prefs').classList.contains('open')) renderPrefs(); }
  }
  store.set('outbox',OUTBOX);
  if(marks){ store.set('marks',MARKS); applyMarks(); }
  if(plan&&$('#planp').classList.contains('open')) renderPlan();
  if(other&&searchMode&&searchMode.type==='bm') showBookmarks();
}
async function syncNow(first){
  if(!syncOn()||SYNC.busy) return; SYNC.busy=true; SYNC.err=''; if($('#syncp').classList.contains('open')) renderSync();
  try{
    let rows=[], off=0; const since=first?'1970-01-01T00:00:00Z':SYNC.last;
    for(;;){ const page=await sbRest('GET',`bible_docs?select=id,data,deleted,updated_at&updated_at=gt.${encodeURIComponent(since)}&order=updated_at.asc&limit=1000&offset=${off}`)||[]; rows=rows.concat(page); if(page.length<1000) break; off+=1000; }
    if(first){ const have=new Set(rows.map(r=>r.id)); for(const [k,v] of Object.entries(localDocs())) if(!have.has(k)&&!OUTBOX[k]) OUTBOX[k]={data:v}; store.set('outbox',OUTBOX); }
    applyRemote(rows,first);
    if(rows.length){ SYNC.last=rows[rows.length-1].updated_at; store.set('synclast',SYNC.last); }
    const snap={...OUTBOX}, ids=Object.keys(snap);
    for(let i=0;i<ids.length;i+=200){
      const part=ids.slice(i,i+200).map(id=>({id,data:snap[id].data||{},deleted:!!snap[id].deleted}));
      await sbRest('POST','bible_docs?on_conflict=user_id,id',part,{Prefer:'resolution=merge-duplicates,return=minimal'});
    }
    ids.forEach(id=>{ if(OUTBOX[id]===snap[id]) delete OUTBOX[id]; }); store.set('outbox',OUTBOX);
    SYNC.at=Date.now(); store.set('syncat',SYNC.at);
  }catch(e){ SYNC.err=e.message||String(e); }
  SYNC.busy=false; if($('#syncp').classList.contains('open')) renderSync();
}
function renderSync(){
  const el=$('#syncp'), x='<button class="ib" data-sx aria-label="Close"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg></button>';
  if(MSTORE){ el.innerHTML=`<div class="ph"><h3>Sync</h3>${x}</div><p class="psub">This copy saves to your Claude account automatically.</p>`; return; }
  if(!SB){
    el.innerHTML=`<div class="ph"><h3>Sync</h3>${x}</div>
      <p class="sy-intro">Keep highlights, notes, your reading plan, bookmarks, history and memory verses the same on your Mac and phone. Sign in with your Stobite account (the same one as Stobite Buy), or create one.</p>
      <input id="sy-email" type="email" autocomplete="username" placeholder="Email" value="${esc(SYNC.email||'')}">
      <input id="sy-pass" type="password" autocomplete="current-password" placeholder="Password">
      ${SYNC.msg?`<div class="sy-msg">${esc(SYNC.msg)}</div>`:''}${SYNC.err?`<div class="sy-err">${esc(SYNC.err)}</div>`:''}
      <div class="pacts"><button class="pill" data-sup>Create account</button><button class="pill pri" data-sin>Sign in</button></div>
      <button class="sy-link" data-sforgot>Forgot password?</button>`;
    return;
  }
  const pending=Object.keys(OUTBOX).length;
  el.innerHTML=`<div class="ph"><h3>Sync</h3>${x}</div>
    <div class="sy-on"><b>On</b> · ${esc(SB.email||'')}</div>
    <div class="psub">${SYNC.busy?'Syncing…':SYNC.err?'':SYNC.at?`Last synced ${ago(SYNC.at).toLowerCase()==='today'?new Date(SYNC.at).toLocaleTimeString([], {hour:'numeric',minute:'2-digit'}):ago(SYNC.at)}`:'Not synced yet'}${pending&&!SYNC.busy?` · ${pending} ${pending===1?'change':'changes'} waiting`:''}</div>
    ${SYNC.err?`<div class="sy-err">${esc(SYNC.err)}</div>`:''}
    <div class="pacts"><button class="pill" data-sout>Sign out</button><button class="pill pri" data-snow>Sync now</button></div>
    <p class="psub" style="margin-top:12px">Imported Bibles and settings stay on each device.</p>`;
}
function openSync(){ closeSheets(); SYNC.msg=''; renderSync(); openSheet($('#syncp'),null); }
$('#syncp').addEventListener('click',async e=>{
  e.stopPropagation(); const b=e.target.closest('button'); if(!b) return; const D=b.dataset;
  const email=()=>($('#sy-email')||{}).value?.trim(), pass=()=>($('#sy-pass')||{}).value||'';
  if('sx' in D) return closeSheets();
  if('sin' in D||'sup' in D){
    SYNC.email=email(); SYNC.err=''; SYNC.msg='';
    if(!SYNC.email||pass().length<6){ SYNC.err='Enter your email and a password of at least 6 characters.'; return renderSync(); }
    b.disabled=true; b.textContent='sin' in D?'Signing in…':'Creating…';
    try{
      if('sup' in D){
        const j=await sbAuth('signup',{email:SYNC.email,password:pass()});
        if(j.access_token){ sbSave(j); } else { SYNC.msg='Account created. Open the confirmation email, then come back and sign in.'; return renderSync(); }
      } else sbSave(await sbAuth('token?grant_type=password',{email:SYNC.email,password:pass()}));
      SYNC.last='1970-01-01T00:00:00Z'; renderSync(); await syncNow(true); toast('Sync is on');
    }catch(err){ SYNC.err=/invalid login/i.test(err.message)?'That email and password don’t match.':/not confirmed/i.test(err.message)?'Confirm your email first (check your inbox), then sign in.':err.message; renderSync(); }
    return;
  }
  if('sforgot' in D){ SYNC.email=email(); if(!SYNC.email){ SYNC.err='Type your email first.'; return renderSync(); } try{ await sbAuth('recover',{email:SYNC.email}); SYNC.msg='If that account exists, a reset email is on its way.'; SYNC.err=''; }catch(err){ SYNC.err=err.message; } return renderSync(); }
  if('snow' in D) return syncNow();
  if('sout' in D){ try{ await sbAuth('logout',{},SB.access); }catch(err){} SB=null; store.set('sb',null); SYNC.at=0; store.set('syncat',0); renderSync(); toast('Signed out. Everything is still on this device.'); }
});
$('#syncp').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='sy-pass') $('#syncp [data-sin]').click(); });
setInterval(()=>{ if(document.visibilityState==='visible') syncNow(); },60000);
document.addEventListener('visibilitychange',()=>{ if(document.visibilityState==='visible') syncNow(); });

// ---------- Dag Heward-Mills books: read the chapter in the Mac app (from Ben's own EPUB folder) ----------
// The Mac app serves bible://app/epub-index.json (every EPUB's title and contents) and bible://app/epub/<id>/<file>.
// Nothing here runs on the phone/web, and the books are never part of the published site.
let EPIDX=null, EPMAP=null, EPCUR=null;
const epKey=t=>String(t).replace(/^\s*(?:[A-Z]{1,4}\s?\d{1,3}\.|Pr\s?\d+\.|\d{1,3}\.)\s*/,'').replace(/\s*-\s*Dag Heward-Mills\s*$/i,'').replace(/\s*[-–(]*\s*(?:\d(?:st|nd|rd|th)\s+ed(?:ition|\.)?|revised(?: edition)?|\(\d{4}\))\)?\s*$/i,'').toLowerCase().replace(/&/g,'and').replace(/neutralise/g,'neutralize').replace(/\b(the|a|an)\b/g,'').replace(/[^a-z0-9]/g,'');
const EP_FRONT=/^(start|contents|table of contents|copyright|dedication|acknowledg|preface|foreword|introduction|intro\b|about the author|title|cover|front cover|other books|books by|conclusion|epilogue|appendix|bibliography|references|endnotes|notes|prayer of salvation|index|also by|praise|prologue|special thanks|preamble|section\b|section\s*\d|part\s+\d|part\s+[ivx]+\b)/i;
const EP_NUM=/^\s*(?:chapter|ch\.?|lesson|session|[A-Za-z ]{0,30}?(?:no\.?|#|message|secret))?\s*(\d{1,3})\s*(?:[.:\-–)]|\s)/i;
function epChapters(e){
  const toc=(e.toc||[]).filter(t=>t[0]), nums=toc.map(t=>{ const m=EP_NUM.exec(t[0]); return m?+m[1]:null; }).filter(n=>n!=null);
  if(nums.length>=3&&Math.max(...nums)<=toc.length+2){
    const out=[]; for(let n=1;n<=Math.max(...nums);n++){ const t=toc.find(x=>{ const m=EP_NUM.exec(x[0]); return m&&+m[1]===n; }); out.push(t||out[out.length-1]||toc[0]); }
    return out;
  }
  return toc.filter(t=>!EP_FRONT.test(t[0]));
}
async function epubIndex(force){
  if(!window.MAC_APP) return null;
  if(EPIDX&&!force) return EPIDX;
  try{
    const r=await fetch('epub-index.json',{cache:'no-store'}); if(!r.ok) return null; const j=await r.json();
    if(j.building){ setTimeout(()=>epubIndex(true).then(()=>{ if($('#randp').classList.contains('open')&&RP.tab!=='bible') renderRand(); }),4000); return null; }
    EPIDX=j; EPMAP=new Map();
    for(const e of j.books||[]){ e.ch=epChapters(e); const k=epKey(e.title); const cur=EPMAP.get(k); if(!cur||e.ch.length>cur.ch.length) EPMAP.set(k,e); }
    return EPIDX;
  }catch(e){ return null; }
}
window.epubReload=()=>{ EPIDX=null; epubIndex(true); };
const EP_ALIAS={'1000 Micro Churches':'One Thousand Micro Churches','Ready at 20':'Ready@20','The Top 10 Mistakes Pastors Make':'The Top Ten Mistakes Pastors Make'};
function epFor(title){
  if(!EPMAP) return null; const k=epKey(EP_ALIAS[title]||title); if(EPMAP.has(k)) return EPMAP.get(k);
  // "Anagkazo: Compelling Power!" ↔ "Anagkazo", "Bearing Fruit After Your Own Kind" ↔ "…After Your Kind"
  let best=null, len=0;
  for(const [ek,e] of EPMAP){ const short=ek.length<k.length?ek:k; if(short.length>=6&&(k.startsWith(ek)||ek.startsWith(k))&&short.length>len){ best=e; len=short.length; } }
  if(best) return best;
  for(const [ek,e] of EPMAP){ let n=0; while(n<k.length&&k[n]===ek[n]) n++; if(n>=12&&n>len){ best=e; len=n; } }
  return best;
}
function epReadHTML(title,c){
  const e=epFor(title); if(!e||!c) return '';
  const ch=e.ch.length>=c?e.ch[c-1]:null;
  // When this EPUB's contents don't line up with the chapter count, open the book and let the list choose.
  if(!ch) return `<button class="pill pri ep-read" data-epread>Open the book</button>`;
  return `<div class="chtl">${esc(ch[0].replace(EP_NUM,'').replace(/^[\s:.\-–]+/,'')||ch[0])}</div><button class="pill pri ep-read" data-epread>Read this chapter</button>`;
}
function epOpen(title,c){
  const e=epFor(title); if(!e) return;
  const fits=e.ch.length>=(c||1); EPCUR={e,c:fits?Math.max(1,c||1):1,list:fits?'ch':'toc'}; closeSheets(); $('#epr').classList.add('open'); epShow();
}
function epShow(){
  const {e,c}=EPCUR, list=EPCUR.list==='ch'&&e.ch.length?e.ch:e.toc, ch=list[c-1]||list[0];
  $('#epr').querySelector('.eph').innerHTML=`<button class="pill" data-epx>‹ Done</button>
    <div class="ept"><b>${esc(e.title.replace(/^\s*(?:[A-Z]{1,4}\s?\d{1,3}\.|Pr\s?\d+\.|\d{1,3}\.)\s*/,''))}</b><span>${c} of ${list.length}</span></div>
    <button class="ib" data-epp aria-label="Previous chapter" ${c<=1?'disabled':''}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m12.5 4.5-5.5 5.5 5.5 5.5"/></svg></button>
    <select id="epsel" aria-label="Chapter">${list.map((t,i)=>`<option value="${i+1}"${i+1===c?' selected':''}>${esc(t[0])}</option>`).join('')}</select>
    <button class="ib" data-epn aria-label="Next chapter" ${c>=list.length?'disabled':''}><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m7.5 4.5 5.5 5.5-5.5 5.5"/></svg></button>`;
  const f=$('#epf'); f.onload=epStyle; f.src=`epub/${e.id}/${(e.base?e.base+'/':'')+ch[1]}`.replace(/\/+/g,'/');
}
function epStyle(){
  let d; try{ d=$('#epf').contentDocument; }catch(err){ return; } if(!d||!d.head) return;
  const cs=getComputedStyle(document.documentElement), v=k=>cs.getPropertyValue(k).trim();
  const st=d.createElement('style');
  st.textContent=`html,body{background:${v('--bg')}!important;color:${v('--ink')}!important}
    body{font-family:${fontStack(S.font)}!important;font-size:${S.fs}px!important;line-height:${SPACING[S.lh]||1.72}!important;max-width:${S.mw||44}rem!important;margin:0 auto!important;padding:36px 28px 90px!important}
    body *{color:inherit!important;background-color:transparent!important;font-family:inherit!important;line-height:inherit!important;max-width:100%}
    h1,h2,h3{line-height:1.25!important} img{max-width:100%!important;height:auto!important} a{color:${v('--accent')}!important}`;
  d.head.appendChild(st);
}
$('#epr').addEventListener('click',e=>{
  const b=e.target.closest('button'); if(!b) return; const D=b.dataset;
  if('epx' in D){ $('#epr').classList.remove('open'); $('#epf').src='about:blank'; return; }
  if('epp' in D){ EPCUR.c--; epShow(); } if('epn' in D){ EPCUR.c++; epShow(); }
});
$('#epr').addEventListener('change',e=>{ if(e.target.id==='epsel'){ EPCUR.c=+e.target.value; epShow(); } });

// ---------- Custom theme (Settings → Appearance → Custom) ----------
// Four colours you pick (page, text, accent, red letters); every other colour is worked out from them, so it always
// looks balanced. The colours sync between devices as db doc "x-theme" (which theme each device uses does not).
var CUSTOM_DEF={bg:'#1f2430',ink:'#e6e9ef',accent:'#88a4f0',red:'#f29191'};
var CPRESETS=[['Midnight',CUSTOM_DEF],['Nord',{bg:'#2e3440',ink:'#e5e9f0',accent:'#88c0d0',red:'#e0959b'}],['Forest',{bg:'#1d2621',ink:'#dfe8df',accent:'#7fc49a',red:'#e8998f'}],
  ['Plum',{bg:'#2a2230',ink:'#ece3f0',accent:'#c49af0',red:'#f29bb0'}],['Linen',{bg:'#f7f3ec',ink:'#2d2a26',accent:'#a0623a',red:'#a8322a'}],['Mint',{bg:'#eef6f2',ink:'#1f2d27',accent:'#2f8a63',red:'#b3362c'}],
  ['Sky',{bg:'#eef3fb',ink:'#1b2431',accent:'#2f62c9',red:'#b3261e'}],['Rose',{bg:'#fbf1f1',ink:'#33232a',accent:'#c0466e',red:'#a82a3a'}]];
var CVARS=['--bg','--side','--bar','--ink','--muted','--faint','--line','--hover','--sel','--accent','--red','--sn','--mark','--flash','--card','--segon','--shadow','--shbg','--hy','--hg','--hb','--hp','--hv','color-scheme'];
const custom=()=>Object.assign({},CUSTOM_DEF,S.custom||{});
function lum(hex){ const n=parseInt(hex.slice(1),16), c=[n>>16,(n>>8)&255,n&255].map(v=>{v/=255;return v<=.03928?v/12.92:((v+.055)/1.055)**2.4;}); return .2126*c[0]+.7152*c[1]+.0722*c[2]; }
function customVars(){
  const {bg,ink,accent,red}=custom(), dark=lum(bg)<.35, mix=(a,p,b)=>`color-mix(in srgb,${a} ${p}%,${b})`;
  return {'--bg':bg,'--ink':ink,'--accent':accent,'--red':red,'--shbg':bg,
    '--side':mix(ink,dark?3:4,bg),'--card':dark?mix('#ffffff',4,bg):mix('#ffffff',70,bg),'--bar':mix(bg,86,'transparent'),
    '--muted':mix(ink,62,bg),'--faint':mix(ink,38,bg),'--sn':mix(ink,48,bg),'--line':mix(ink,dark?8:10,'transparent'),'--hover':mix(ink,6,'transparent'),
    '--sel':mix(ink,dark?14:10,bg),'--segon':dark?mix(ink,20,bg):'#ffffff','--flash':mix(accent,16,'transparent'),'--mark':dark?'rgba(240,178,50,.24)':'rgba(255,204,0,.34)',
    '--shadow':dark?'0 12px 40px rgba(0,0,0,.42),0 0 0 .5px rgba(0,0,0,.3)':'0 12px 40px rgba(0,0,0,.13),0 0 0 .5px rgba(0,0,0,.07)',
    '--hy':dark?'rgba(240,178,50,.22)':'rgba(255,204,0,.32)','--hg':dark?'rgba(35,165,90,.22)':'rgba(52,199,89,.22)','--hb':mix(accent,dark?26:20,'transparent'),
    '--hp':dark?'rgba(235,69,158,.2)':'rgba(255,55,95,.16)','--hv':dark?'rgba(155,89,182,.26)':'rgba(175,82,222,.18)','color-scheme':dark?'dark':'light'};
}
function applyCustom(on){
  if(!CVARS) return;   // app.js can call this before this file has run; applyTheme() runs again below
  const st=document.documentElement.style;
  if(!on){ CVARS.forEach(k=>st.removeProperty(k)); return; }
  for(const [k,v] of Object.entries(customVars())) st.setProperty(k,v);
}
function customEditorHTML(){
  if(S.theme!=='custom') return '';
  const c=custom(), row=(k,l)=>`<label class="srow"><span>${l}</span><span class="cpick"><code>${c[k]}</code><input type="color" data-ccol="${k}" value="${c[k]}" aria-label="${l} colour"></span></label>`;
  return `<div class="sg">Your colours</div><div class="sbox">${row('bg','Page')}${row('ink','Text')}${row('accent','Accent')}${row('red','Red letters')}</div>
    <div class="sg">Start from</div><div class="cpre">${CPRESETS.map(([n,p],i)=>`<button data-cpreset="${i}" title="${n}"><span style="background:${p.bg};color:${p.ink}">Aa<i style="background:${p.accent}"></i></span>${n}</button>`).join('')}</div>
    <button class="pill" data-creset style="width:100%;margin-top:12px">Reset to Midnight</button>`;
}
function setCustom(c){ S.custom=c; save(); applyTheme(); syncPut('x-theme',{custom:c}); }
$('#prefs').addEventListener('input',e=>{
  const k=e.target.dataset&&e.target.dataset.ccol; if(!k) return;
  S.custom=Object.assign(custom(),{[k]:e.target.value}); applyTheme();
  const code=e.target.parentNode.querySelector('code'); if(code) code.textContent=e.target.value;
  clearTimeout(setCustom.t); setCustom.t=setTimeout(()=>setCustom(S.custom),600);
});
applyTheme();

// ---------- Offline (phone site) ----------
// sw.js opens the app from the copy saved on the phone and checks GitHub in the background; when it saves a newer
// version it tells us, and we offer a Reload. Settings shows whether this device has the app saved for offline use.
var OFFLINE={state:window.MAC_APP?'mac':'checking',at:0};
async function offlineCheck(){
  if(window.MAC_APP) return;
  if(!('serviceWorker' in navigator)||!window.caches||(location.protocol!=='https:'&&location.hostname!=='localhost')){ OFFLINE.state='none'; return; }
  try{ const r=await caches.match('./index.html'); OFFLINE.state=r?'saved':'saving'; }catch(e){ OFFLINE.state='none'; }
  if(navigator.storage&&navigator.storage.persist) navigator.storage.persist().catch(()=>{});   // ask the phone not to clear it
}
function showUpdate(){
  let u=$('#upd'); if(!u){ u=document.createElement('div'); u.id='upd'; document.body.appendChild(u); }
  u.innerHTML='<span>A new version is ready</span><button data-reload>Reload</button><button data-x aria-label="Later">✕</button>';
  u.onclick=e=>{ if(e.target.closest('[data-reload]')) location.reload(); else if(e.target.closest('[data-x]')) u.remove(); };
}
if('serviceWorker' in navigator) navigator.serviceWorker.addEventListener('message',e=>{
  const d=e.data||{};
  if(d.type==='updated'){ OFFLINE.state='saved'; showUpdate(); }
  if(d.type==='checked'){ OFFLINE.at=Date.now(); OFFLINE.state='saved'; toast(d.offline?'No connection; using the saved copy':d.changed?'Updated':'You have the latest version'); if(d.changed) showUpdate(); if(PREFPAGE==='main'&&$('#prefs').classList.contains('open')) renderPrefs(); }
});
function offlineRowHTML(){
  if(OFFLINE.state==='mac') return '';
  const v={saved:'Saved on this phone ✓',saving:'Saving…',checking:'Checking…',none:'Add to Home Screen first'}[OFFLINE.state];
  return `<div class="sg">This device</div><div class="sbox"><div class="srow"><span>Offline</span><span class="sv">${v}</span></div>
    ${OFFLINE.state==='saved'?'<button class="srow nav" data-updcheck><span>Check for updates</span><span class="sv">'+CHEV_R+'</span></button>':''}</div>`;
}
$('#prefs').addEventListener('click',e=>{
  if(!e.target.closest('[data-updcheck]')) return;
  const sw=navigator.serviceWorker&&navigator.serviceWorker.controller; if(!sw) return toast('Not saved yet; try again in a moment');
  toast('Checking…'); sw.postMessage('check');
});
offlineCheck();
