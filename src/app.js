const NAMES=["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"];
const ALIAS={gn:0,gen:0,ex:1,exo:1,exod:1,lv:2,lev:2,nm:3,num:3,dt:4,deut:4,jos:5,josh:5,jdg:6,judg:6,jg:6,ru:7,rth:7,"1sam":8,"1sa":8,"2sam":9,"2sa":9,"1kgs":10,"1ki":10,"2kgs":11,"2ki":11,"1chr":12,"1ch":12,"2chr":13,"2ch":13,ne:15,neh:15,est:16,jb:17,ps:18,psa:18,psalm:18,pss:18,pr:19,prov:19,prv:19,ec:20,eccl:20,qoh:20,song:21,sos:21,sng:21,canticles:21,is:22,isa:22,jer:23,lam:24,ezk:25,eze:25,ezek:25,dn:26,dan:26,hos:27,jl:28,joel:28,am:29,amos:29,ob:30,obad:30,jon:31,jnh:31,mic:32,na:33,nah:33,hab:34,zeph:35,zep:35,hag:36,zec:37,zech:37,mal:38,mt:39,matt:39,mat:39,mk:40,mrk:40,mar:40,lk:41,luk:41,jn:42,jhn:42,joh:42,ac:43,act:43,ro:44,rom:44,"1cor":45,"1co":45,"2cor":46,"2co":46,ga:47,gal:47,eph:48,php:49,phil:49,col:50,"1th":51,"1thess":51,"2th":52,"2thess":52,"1tim":53,"1ti":53,"2tim":54,"2ti":54,tit:55,phm:56,phlm:56,philem:56,heb:57,jas:58,jm:58,"1pet":59,"1pe":59,"1pt":59,"2pet":60,"2pe":60,"2pt":60,"1jn":61,"1jo":61,"1john":61,"2jn":62,"2jo":62,"3jn":63,"3jo":63,jude:64,jud:64,rev:65,re:65,rv:65,revelations:65};
const $=s=>document.querySelector(s);
const store={get(k,d){try{const v=localStorage.getItem('bible.'+k);return v==null?d:JSON.parse(v)}catch(e){return d}},set(k,v){try{localStorage.setItem('bible.'+k,JSON.stringify(v))}catch(e){}}};
const S=Object.assign({v:'kjv',b:42,c:2,strongs:true,red:true,god:false,fs:20,theme:'auto',par:false,v2:'bsb',font:'newyork',lh:'normal',hs:'dropcap',layout:'verse',mw:44},store.get('state',{}));
const DATA={}, PLAIN={}, GODCH={};
let LEX=null, XREF=null, openBook=S.b, searchMode=null, SELV=0;
const VN={kjv:'KJV',bsb:'BSB',web:'WEB',asv:'ASV',blb:'BLB'};
const VFULL={kjv:'King James Version',bsb:'Berean Standard Bible',web:'World English Bible',asv:'American Standard Version',blb:'Berean Literal Bible'};
// Only these versions carry red-letter and God's-words marks
const MARKED=new Set(['kjv','bsb','web']);
// Versions whose text carries Strong's tags
const STRONGS=new Set(['kjv','bsb']);
const godOn=()=>S.god&&MARKED.has(S.v);
const FONTS=[
  ['newyork','New York','ui-serif,"New York","Iowan Old Style",Georgia,serif','Apple'],
  ['georgia','Georgia','Georgia,"Times New Roman",serif',''],
  ['palatino','Palatino','Palatino,"Palatino Linotype","Book Antiqua",serif',''],
  ['iowan','Iowan Old Style','"Iowan Old Style","Palatino",serif',''],
  ['charter','Charter','Charter,"Bitstream Charter",Georgia,serif',''],
  ['baskerville','Baskerville','Baskerville,"Baskerville Old Face",Georgia,serif',''],
  ['hoefler','Hoefler Text','"Hoefler Text",Garamond,Georgia,serif',''],
  ['sf','SF Pro','-apple-system,BlinkMacSystemFont,"SF Pro Text","Helvetica Neue",sans-serif','Sans serif'],
  ['avenir','Avenir Next','"Avenir Next",Avenir,"Helvetica Neue",sans-serif','Sans serif'],
];
const SPACING={compact:1.5,normal:1.72,relaxed:1.95};
// S.font is a preset key from FONTS, or "f:<family>" for any other installed font.
const fontStack=k=>k&&k.startsWith('f:')?`"${k.slice(2).replace(/"/g,'')}", ui-serif, Georgia, serif`:(FONTS.find(x=>x[0]===k)||FONTS[0])[2];
const fontName=k=>k&&k.startsWith('f:')?k.slice(2):(FONTS.find(x=>x[0]===k)||FONTS[0])[1];
// The Mac app injects window.MAC_FONTS (every family installed); in Chrome they can be listed with queryLocalFonts().
let ALLFONTS=window.MAC_FONTS||null, FFIND='';
if(!VN[S.v]) S.v='kjv'; if(!VN[S.v2]) S.v2='bsb';
if(S.hsv!==2){ S.hs='dropcap'; S.hsv=2; } // Oct 2026: Tecarta-style drop number became the default

async function unpack(id){
  const b64=document.getElementById('d-'+id).textContent.trim();
  const bin=atob(b64), u=new Uint8Array(bin.length);
  for(let i=0;i<bin.length;i++)u[i]=bin.charCodeAt(i);
  const txt=await new Response(new Blob([u]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
  return JSON.parse(txt);
}
async function load(v){ if(!DATA[v]) DATA[v]=v.startsWith('x_')?await idb('data','get',v):await unpack(v); return DATA[v]; }
async function lex(){ if(!LEX) LEX=await unpack('lex'); return LEX; }
const save=()=>store.set('state',S);
const esc=s=>s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
const TOK=/\[\[|\]\]|\[([HG])(\d+)\]|<em>|<\/em>|[{}«»]|[^\[\]<{}«»]+|[\[\]<]/g;
const plain=s=>s.replace(/\[\[|\]\]|\[[HG]\d+\]|<\/?em>|[{}«»]/g,'').replace(/\s+/g,' ').trim();

// Render one verse. Returns {title, html, has}
// A Strong's tag follows the English word or phrase it belongs to ("only begotten[G3439]"), so the text since the
// previous tag becomes one clickable, underlined word group.
function render(str,o){
  let title=false,em=false,red=false,god=false,buf=[];
  const groups=[], flush=ids=>{ groups.push({p:buf,s:ids}); buf=[]; };
  TOK.lastIndex=0; let m;
  while((m=TOK.exec(str))){
    const t=m[0];
    if(t==='[['||t===']]'){ if(buf.length) flush([]); title=t==='[['; continue; }
    if(t==='<em>'){em=true;continue} if(t==='</em>'){em=false;continue}
    if(t==='{'){red=true;continue} if(t==='}'){red=false;continue}
    if(t==='«'){god=true;continue} if(t==='»'){god=false;continue}
    if(m[1]){
      const id=m[1]+m[2];
      if(buf.some(p=>/\w/.test(p.t))){ flush([id]); continue; }
      // no new words: the tag belongs to the previous group ("created[H1254][H853]", "his son.]][H1121]")
      const g=groups[groups.length-1];
      if(g&&g.p.some(p=>/\w/.test(p.t))&&!g.s.includes(id)&&!(id==='H853'&&g.s.length)) g.s.push(id);
      continue;
    }
    buf.push({t,em,red,god:red||god,title});
  }
  if(buf.length) flush([]);

  let body='',ttl='',has=false,skipped=false,any=false;
  const GAP='<span class="gap">…</span> ';
  for(const g of groups){
    // walk the pieces in order: in God's-words mode hidden narration becomes a "…" before the next spoken piece
    const items=[];
    for(const p of g.p){
      if(o.god&&(p.title||!p.god)){ if(any&&p.t.trim()) skipped=true; continue; }
      let t=p.t;
      if(o.god){
        if(!any) t=t.replace(/^\s+/,'');
        if(skipped){ items.push({gap:true}); skipped=false; t=t.replace(/^\s+/,''); }
        any=true;
      }
      items.push({...p,t});
      if(!p.title&&p.god) has=true;
    }
    if(!items.length) continue;
    const isTitle=!!items.find(x=>!x.gap)?.title;
    // keep leading space, gaps and trailing punctuation outside the underline
    let lead='', trail='';
    while(items.length&&(items[0].gap||!items[0].t.trim())){ const x=items.shift(); lead+=x.gap?GAP:esc(x.t); }
    if(items.length){
      const f=items[0], ls=f.t.match(/^[\s“‘"(\[—–-]*/)[0]; f.t=f.t.slice(ls.length); lead+=ls.trim()?wrap(ls,f.em,f.red&&!f.title,null):ls;
      const l=items[items.length-1], ts=l.t.match(/[\s,.;:!?)”’"\]—–-]*$/)[0]; l.t=l.t.slice(0,l.t.length-ts.length); trail=ts.trim()?wrap(ts,l.em,l.red&&!l.title,null):ts;
    }
    let html=items.map(x=>x.gap?GAP:(x.t?wrap(x.t,x.em,x.red&&!x.title,o.q):'')).join('');
    if(o.strongs&&g.s.length&&html) html=`<span class="w${o.hl&&g.s.includes(o.hl)?' hl':''}" data-s="${g.s.join(' ')}">${html}</span>`;
    const out=lead+html+trail;
    if(isTitle) ttl+=out; else body+=out;
  }
  return {title:ttl.trim(),html:body.trim(),has};
}
function wrap(t,em,red,q){
  let s=esc(t);
  if(q) s=s.replace(q,x=>`<mark>${x}</mark>`);
  const c=(red?'jr':'');
  if(em) s=`<i>${s}</i>`;
  return c?`<span class="${c}">${s}</span>`:s;
}
const opts=()=>({strongs:S.strongs&&STRONGS.has(S.v),god:godOn()});
// Strong's search and counts use the current version when it is tagged, otherwise the KJV
const SV=()=>STRONGS.has(S.v)?S.v:'kjv';

function chapterHasGod(v,b,c){
  const k=v+b+'.'+c; if(k in GODCH) return GODCH[k];
  const ch=DATA[v][b][c]||[]; return GODCH[k]=ch.some(s=>/[{«]/.test(s));
}

// ---------- Navigator (Tecarta-style): book tiles by section, then chapters ----------
const ABBR="Gen Exod Lev Num Deut Josh Judg Ruth 1 Sam 2 Sam 1 Kgs 2 Kgs 1 Chr 2 Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1 Cor 2 Cor Gal Eph Phil Col 1 Thess 2 Thess 1 Tim 2 Tim Titus Phlm Heb Jas 1 Pet 2 Pet 1 John 2 John 3 John Jude Rev".match(/(?:[123] )?\S+/g);
const GENRE=b=>b<5?'law':b<17?'hist':b<22?'wis':b<27?'maj':b<39?'min':b<43?'gos':b<44?'acts':b<57?'paul':b<65?'gen':'rev';
const GNAME={law:'Law',hist:'History',wis:'Wisdom',maj:'Major Prophets',min:'Minor Prophets',gos:'Gospels',acts:'Acts',paul:'Paul’s Letters',gen:'General Letters',rev:'Revelation'};
let NAVB=null; // book whose chapters are showing, or null for the book grid
function renderNav(){
  const body=$('#navbody'); if(!body) return;
  if(NAVB==null){
    const tiles=(lo,hi)=>{let h=''; for(let i=lo;i<=hi;i++) h+=`<button class="bt${i===S.b?' on':''}" data-g="${GENRE(i)}" data-nb="${i}" title="${NAMES[i]}">${ABBR[i]}</button>`; return h;};
    body.innerHTML=`<div class="ngrp">Old Testament</div><div class="bks">${tiles(0,38)}</div>
      <div class="ngrp">New Testament</div><div class="bks">${tiles(39,65)}</div>
      <div class="legend">${Object.entries(GNAME).map(([k,l])=>`<span><i data-g="${k}"></i>${l}</span>`).join('')}</div>`;
  } else {
    const n=DATA[S.v][NAVB].length;
    let h=''; for(let c=0;c<n;c++){ const dim=godOn()&&!chapterHasGod(S.v,NAVB,c); h+=`<button class="${NAVB===S.b&&c===S.c&&!searchMode?'on':''}${dim?' dim':''}" data-nc="${c}">${c+1}</button>`; }
    body.innerHTML=`<div class="nback"><button data-nback>‹ Books</button><h3>${NAMES[NAVB]}</h3></div><div class="ngrp">${n} ${n===1?'chapter':'chapters'}</div><div class="chg">${h}</div>`;
  }
}
function buildBooks(){ $('#reft').textContent=searchMode?$('#reft').textContent:`${NAMES[S.b]} ${S.c+1}`; if($('#navp').classList.contains('open')) renderNav(); }
function openNav(focus){
  NAVB=null; renderNav(); openSheet($('#navp'),null); document.body.classList.add('nav-open');
  if(focus) setTimeout(()=>{$('#q').focus(); $('#q').select();},30);
}
$('#navbody').addEventListener('click',e=>{
  e.stopPropagation();
  const b=e.target.closest('[data-nb]'), c=e.target.closest('[data-nc]');
  if(b){ const i=+b.dataset.nb; if(DATA[S.v][i].length===1){ closeSheets(); go(i,0); return; } NAVB=i; renderNav(); $('#navp').scrollTop=0; }
  else if(c){ closeSheets(); go(NAVB,+c.dataset.nc); }
  else if(e.target.closest('[data-nback]')){ NAVB=null; renderNav(); }
});
$('#ref').onclick=()=>$('#navp').classList.contains('open')?closeSheets():openNav(false);
$('#navx').onclick=()=>closeSheets();

function syncControls(){
  document.querySelectorAll('#ver button').forEach(x=>x.classList.toggle('on',x.dataset.v===S.v));
  const sg=STRONGS.has(S.v);
  $('#t-strongs').classList.toggle('on',S.strongs&&sg); $('#t-strongs').disabled=!sg;
  $('#t-strongs').title=sg?"Underline words linked to Strong's Hebrew and Greek":"Strong's is available in the "+[...STRONGS].map(v=>VN[v]).join(' and ');
  const mk=MARKED.has(S.v);
  $('#t-red').disabled=!mk; $('#t-god').disabled=!mk;
  $('#t-red').title=mk?'Show the words of Jesus in red':'Red letters are available in the KJV, BSB and WEB';
  $('#t-god').title=mk?'Hide narration and show only words spoken by God':'God’s words only is available in the KJV, BSB and WEB';
  $('#t-red').classList.toggle('on',S.red&&mk); $('#t-god').classList.toggle('on',S.god&&mk); $('#t-par').classList.toggle('on',S.par);
  $('#verb').innerHTML=VN[S.v]+(S.par&&S.v2!==S.v?`<span class="s">+ ${VN[S.v2]}</span>`:'')+'<svg class="cv" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="m3 4.5 3 3 3-3"/></svg>';
  document.documentElement.style.setProperty('--mw',(S.mw||44)+'rem');
  document.documentElement.style.setProperty('--bf',fontStack(S.font));
  document.documentElement.style.setProperty('--lh',SPACING[S.lh]||1.72);
  document.body.classList.toggle('showred',S.red);
  document.documentElement.style.setProperty('--fs',S.fs+'px');
  applyTheme();
  $('#theme').title='Appearance: '+(THEMES.find(t=>t[0]===S.theme)||THEMES[0])[1];
}

function draw(flashV){
  searchMode=null;
  const bk=DATA[S.v][S.b]; if(S.c>=bk.length) S.c=bk.length-1;
  const ch=bk[S.c]||[]; const o=opts(), G=o.god;
  $('#reft').textContent=`${NAMES[S.b]} ${S.c+1}`; document.title=`${NAMES[S.b]} ${S.c+1} · ${VN[S.v]}`;
  if(oneMode()) return drawOne(ch,o,G,flashV);
  const twin=S.par&&S.v2!==S.v, hs=twin&&S.hs==='dropcap'?'line':S.hs, drop=hs==='dropcap'; let first=true;
  let h=`<header class="hd h-${hs}">${headHTML(hs,S.b,S.c+1,S.v)}`;
  if(G) h+=`<div class="note"><i></i>Showing only words spoken by God</div>`;
  h+=(S.layout==='para'&&!(S.par&&S.v2!==S.v))?'</header><div id="verses"><p class="para">':'</header><div id="verses">';
  let shown=0;
  const par=S.par&&S.v2!==S.v, flow=S.layout==='para'&&!par, ch2=par?(DATA[S.v2][S.b]||[])[S.c]||[]:null;
  const o2={strongs:S.strongs&&STRONGS.has(S.v2),god:G};
  if(par) h=h.replace('<div id="verses">',`<div class="phd"><span></span><span class="lab">${VN[S.v]}</span><span>${seg2()}</span></div><div id="verses">`);
  const n=Math.max(ch.length,par?ch2.length:0);
  for(let i=0;i<n;i++){
    const s=ch[i]||'', s2=par?(ch2[i]||''):'';
    if(!s&&!s2) continue;
    const r=render(s,o), r2=par?render(s2,o2):null;
    if(G&&!r.has&&!(r2&&r2.has)) continue;
    if(r.title&&!G&&!par) h+=flow?`<span class="ttl">${r.title}</span>`:`<p class="ttl">${r.title}</p>`;
    const mk=MARKS[mkey(S.b,S.c+1,i+1)];
    const dc=drop&&first?`<span class="dc">${S.c+1}</span>`:''; first=false;
    const cls='v'+(par?' par':'')+(dc&&i===0?' first':'')+(mk&&mk.color?' c-'+mk.color:'')+(SELV===i+1?' sel':'');
    const nd=mk&&mk.note?'<i class="nd" title="Has a note"></i>':'';
    const body=x=>(par&&x.title&&!G?`<i style="color:var(--muted)">${x.title}</i> `:'')+(G&&!x.has?'':x.html);
    if(par) h+=`<div class="${cls}" id="v${i+1}" data-n="${i+1}"><span class="n">${i+1}${nd}</span><span class="t${G&&!r.has?' none':''}">${body(r)||'<span style="color:var(--faint)">—</span>'}</span><span class="t t2${G&&!r2.has?' none':''}">${body(r2)||'<span style="color:var(--faint)">—</span>'}</span></div>`;
    else if(flow) h+=`${dc}<span class="${cls} pv" id="v${i+1}" data-n="${i+1}"><span class="n">${dc&&i===0?'':i+1}${nd}</span><span class="t">${r.html}</span></span> `;
    else h+=`<div class="${cls}" id="v${i+1}" data-n="${i+1}"><span class="n">${i+1}${nd}</span><span class="t">${dc}${r.html}</span></div>`;
    shown++;
  }
  h+=flow?'</p></div>':'</div>';
  if(G&&!shown) h+=`<p class="empty">No words spoken directly by God are recorded in this chapter.</p>`;
  const nx=nextCh(1), pv=nextCh(-1);
  h+='<div class="next">';
  if(pv) h+=`<button class="pill" data-go="${pv}">‹ ${NAMES[pv[0]]} ${pv[1]+1}</button>`;
  if(nx) h+=`<button class="pill pri" data-go="${nx}">${NAMES[nx[0]]} ${nx[1]+1} ›</button>`;
  h+=planBtn();
  h+='</div>';
  $('#col').innerHTML=h; $('#col').classList.toggle('wide',!!par); $('#col').classList.toggle('flow',flow); $('#col').classList.remove('onev'); buildBooks(); syncControls(); save(); histRecord();
  if(flashV){const el=document.getElementById('v'+flashV); if(el){el.scrollIntoView({block:'center'}); el.classList.add('flash'); setTimeout(()=>el.classList.remove('flash'),1400);}}
  else $('#scroll').scrollTop=0;
}
// ---------- One verse at a time (Settings → Layout → One verse) ----------
// The chapter is shown a verse at a time, large and centred. ← → / the edge arrows / swipe / tapping the left or
// right of the verse step through it and carry on into the next chapter. Tap the reference for the verse panel.
let ONE=S.ov||1, ONEKEY=S.ovk||'';
const oneMode=()=>S.layout==='one'&&!searchMode&&!(S.par&&S.v2!==S.v);
const oneList=(ch,G)=>{ const L=[]; ch.forEach((x,i)=>{ if(x&&(!G||/[{«]/.test(x))) L.push(i+1); }); return L; };
function drawOne(ch,o,G,flashV){
  const key=S.b+'.'+S.c, L=oneList(ch,G);
  if(flashV) ONE=flashV; else if(ONEKEY!==key) ONE=L[0]||1;
  if(L.length&&!L.includes(ONE)) ONE=L.find(x=>x>=ONE)||L[L.length-1];
  ONEKEY=key; S.ov=ONE; S.ovk=key;
  let h;
  if(!L.length) h=`<div class="one"><p class="empty">${G?'No words spoken directly by God are recorded in this chapter.':'This chapter has no verses in this version.'}</p></div>`;
  else {
    const r=render(ch[ONE-1],o), mk=MARKS[mkey(S.b,S.c+1,ONE)], p=L.indexOf(ONE);
    h=`<div class="one" id="one">${G?'<div class="note"><i></i>Showing only words spoken by God</div>':''}
      <div class="ov${mk&&mk.color?' c-'+mk.color:''}" id="v${ONE}" data-n="${ONE}">${r.title&&!G?`<span class="ottl">${r.title}</span>`:''}<span class="t">${r.html}</span></div>
      <button class="ocap" data-opanel title="Highlight, note, copy, cross references">${NAMES[S.b]} ${S.c+1}:${ONE}${mk&&mk.note?'<i class="ond"></i>':''}</button>
      <div class="obar"><i style="width:${Math.round(100*(p+1)/L.length)}%"></i></div>
      <div class="ocnt">${p+1} of ${L.length}</div>
      ${p===L.length-1&&planBtn()?`<div class="next">${planBtn()}</div>`:''}
    </div>`;
  }
  $('#col').innerHTML=h; $('#col').classList.remove('wide','flow'); $('#col').classList.add('onev'); buildBooks(); syncControls(); save(); histRecord(); $('#scroll').scrollTop=0;
}
function stepVerse(d){
  const G=godOn(), wasOpen=$('#bodyg').classList.contains('withpanel'), L=oneList(DATA[S.v][S.b][S.c]||[],G), p=L.indexOf(ONE);
  if(p+d>=0&&p+d<L.length) ONE=L[p+d];
  else { const nc=nextCh(d); if(!nc) return; S.b=nc[0]; S.c=nc[1]; const L2=oneList(DATA[S.v][S.b][S.c]||[],G); ONE=d>0?(L2[0]||1):(L2[L2.length-1]||1); ONEKEY=S.b+'.'+S.c; }
  SELV=0; draw(ONE); if(wasOpen) openPanel(ONE);
}
// In God's-words mode, chapter arrows skip chapters with no divine speech
function nextCh(d){
  let b=S.b,c=S.c;
  for(let guard=0;guard<1200;guard++){
    c+=d;
    if(c<0){b--; if(b<0) return null; c=DATA[S.v][b].length-1;}
    else if(c>=DATA[S.v][b].length){b++; if(b>65) return null; c=0;}
    if(!godOn()||chapterHasGod(S.v,b,c)) return [b,c];
  }
  return null;
}
function go(b,c,v){S.b=b;S.c=c;openBook=b;closePop();SELV=v||0;draw(v); if(v&&$('#bodyg').classList.contains('withpanel')) openPanel(v); else if(!v) closePanel();}
$('#col').addEventListener('click',e=>{
  if(extrasClick(e)) return;
  const p=e.target.closest('[data-go]'); if(p){const [b,c]=p.dataset.go.split(',').map(Number); turn(b>S.b||(b===S.b&&c>S.c)?1:-1,()=>go(b,c)); return;}
  const w=e.target.closest('.w'); if(w&&!String(getSelection())){e.stopPropagation(); showPop(w.dataset.s.split(' '),w); return;}
  const one=e.target.closest('#one');
  if(one&&!searchMode){ if(String(getSelection())) return; if(e.target.closest('[data-opanel]')) return openPanel(ONE); if(e.target.closest('button,a')) return; stepVerse(e.clientX-one.getBoundingClientRect().left<one.offsetWidth/3?-1:1); return; }
  const s2=e.target.closest('[data-v2]'); if(s2){ const v=s2.dataset.v2; load(v).then(()=>{S.v2=v; draw(firstVisibleVerse()||0);}); return; }
  const fb=e.target.closest('[data-fc]'); if(fb){ showMarks(fb.dataset.fc); return; }
  const r=e.target.closest('.res'); if(r){go(+r.dataset.b,+r.dataset.c,+r.dataset.v+1); return;}
  const v=e.target.closest('.v'); if(v&&!searchMode){ if(String(getSelection())) return; openPanel(+v.dataset.n); }
});
// one step back or forward (a verse in one-verse layout, otherwise a chapter), without animation
function rawStep(d){ if(oneMode()) return stepVerse(d); const p=nextCh(d); p&&go(p[0],p[1]); }
$('#prev').onclick=()=>{ if(oneMode()||nextCh(-1)) turn(-1,()=>rawStep(-1)); };
$('#next').onclick=()=>{ if(oneMode()||nextCh(1)) turn(1,()=>rawStep(1)); };
$('#ver').onclick=async e=>{
  const b=e.target.closest('button'); if(!b||b.dataset.v===S.v) return;
  const v=b.dataset.v; document.body.style.cursor='progress'; await load(v); document.body.style.cursor='';
  const top=firstVisibleVerse(); if(S.v2===v) S.v2=S.v; S.v=v; if(S.par) await load(S.v2); searchMode?rerunSearch():draw(top>1?top:0);
};
function firstVisibleVerse(){const vs=[...document.querySelectorAll('.v')]; const t=$('#scroll').getBoundingClientRect().top+60; const el=vs.find(x=>x.getBoundingClientRect().bottom>t); return el?+el.id.slice(1):0;}
$('#t-strongs').onclick=()=>{S.strongs=!S.strongs; const t=firstVisibleVerse(); searchMode?rerunSearch():draw(t>1?t:0);};
$('#t-red').onclick=()=>{S.red=!S.red; syncControls(); save();};
$('#t-god').onclick=()=>{S.god=!S.god; searchMode?rerunSearch():draw();};
// ---------- Sheets (settings, random picker): popovers on desktop, bottom sheets on phones ----------
const phone=()=>matchMedia('(max-width:700px)').matches;
function openSheet(el,btn){
  closeSheets(el); el.classList.add('open'); document.body.classList.add('sheet-open');
  if(phone()||!btn) return;
  const r=btn.getBoundingClientRect();
  el.style.top=(r.bottom+8)+'px'; el.style.left=Math.max(12,Math.min(r.right-el.offsetWidth,innerWidth-el.offsetWidth-12))+'px';
}
function closeSheets(except){
  document.querySelectorAll('.sheet.open').forEach(x=>{ if(x!==except) x.classList.remove('open'); });
  if(!document.querySelector('.sheet.open')) document.body.classList.remove('sheet-open');
  if(!$('#navp').classList.contains('open')) document.body.classList.remove('nav-open');
}
const closePrefs=()=>{ $('#prefs').classList.remove('open'); closeSheets(); };
$('#scrim').onclick=()=>closeSheets();
// Phones: while a sheet is open, a tap or drag that reaches the verses only closes the sheet; it never selects or scrolls them.
$('#scrim').addEventListener('touchmove',e=>e.preventDefault(),{passive:false});
// iOS still scrolls the page or the verses when a drag inside a sheet reaches its top or bottom (or the sheet doesn't
// scroll at all). So while one is open, a drag only ever scrolls the sheet's own list, and only while it has room to move.
const OVER='.sheet.open,#menup.open,#verp.open,#navp.open,#planp.open,#syncp.open';
{ let ty=0;
  document.addEventListener('touchstart',e=>{ ty=e.touches[0].clientY; },{passive:true,capture:true});
  document.addEventListener('touchmove',e=>{
    if(!document.querySelector(OVER)) return;
    const box=e.target.closest&&e.target.closest(OVER);
    if(!box){ e.preventDefault(); return; }
    if(e.target.matches('input[type=range]')) return;   // sliders move sideways
    const dy=e.touches[0].clientY-ty;
    for(let el=e.target; el&&el!==box.parentNode; el=el.parentElement){
      const cs=getComputedStyle(el);
      if(!/(auto|scroll)/.test(cs.overflowY)||el.scrollHeight<=el.clientHeight+1) continue;
      const atTop=el.scrollTop<=0, atEnd=el.scrollTop+el.clientHeight>=el.scrollHeight-1;
      if((dy>0&&atTop)||(dy<0&&atEnd)) continue;   // this list can't move that way; try the one around it
      return;                                       // this list scrolls: let it
    }
    e.preventDefault();
  },{passive:false,capture:true});
}
['click','touchstart','touchend'].forEach(t=>$('#scroll').addEventListener(t,e=>{
  if(!phone()||!(document.body.classList.contains('sheet-open')||document.body.classList.contains('nav-open'))) return;
  e.preventDefault(); e.stopPropagation(); if(t==='click') closeSheets();
},{capture:true,passive:false}));

// ---------- Imported Bibles (XML) ----------
// Saved in this browser's / the Mac app's IndexedDB: store "meta" {id,name,abbr,strongs,red,verses} and store "data" (the text).
function idb(store,op,arg){
  return new Promise((res,rej)=>{
    let rq; try{ rq=indexedDB.open('bible-imports',1); }catch(e){ return rej(e); }
    rq.onupgradeneeded=()=>{ rq.result.createObjectStore('meta',{keyPath:'id'}); rq.result.createObjectStore('data'); };
    rq.onerror=()=>rej(rq.error);
    rq.onsuccess=()=>{
      const tx=rq.result.transaction(store,op==='get'||op==='all'?'readonly':'readwrite'), st=tx.objectStore(store);
      const r=op==='all'?st.getAll():op==='get'?st.get(arg):op==='del'?st.delete(arg):(store==='data'?st.put(arg[1],arg[0]):st.put(arg));
      r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error);
    };
  });
}
let IMPORTS=[];
function registerImport(m){
  VN[m.id]=m.abbr; VFULL[m.id]=m.name;
  if(m.strongs) STRONGS.add(m.id); if(m.red) MARKED.add(m.id);
  if(!$(`#ver button[data-v="${m.id}"]`)) $('#ver').insertAdjacentHTML('beforeend',`<button data-v="${m.id}"></button>`);
}
async function loadImports(){ try{ IMPORTS=await idb('meta','all'); IMPORTS.forEach(registerImport); }catch(e){ IMPORTS=[]; } }

const OSIS_CODES='Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split(' ');
const USFM_CODES='GEN EXO LEV NUM DEU JOS JDG RUT 1SA 2SA 1KI 2KI 1CH 2CH EZR NEH EST JOB PSA PRO ECC SNG ISA JER LAM EZK DAN HOS JOL AMO OBA JON MIC NAM HAB ZEP HAG ZEC MAL MAT MRK LUK JHN ACT ROM 1CO 2CO GAL EPH PHP COL 1TH 2TH 1TI 2TI TIT PHM HEB JAS 1PE 2PE 1JN 2JN 3JN JUD REV'.split(' ');
const bookByName=n=>{ const k=String(n||'').toLowerCase().replace(/[^a-z0-9]/g,''); let i=NAMES.findIndex(x=>x.toLowerCase().replace(/[^a-z0-9]/g,'')===k); if(i<0&&k==='psalm') i=18; if(i<0) i=OSIS_CODES.findIndex(x=>x.toLowerCase()===k); if(i<0) i=USFM_CODES.findIndex(x=>x.toLowerCase()===k); return i; };

// Read a Zefania, OSIS, USFX, Beblia or OpenSong XML Bible into [book][chapter][verse] strings using this app's markup:
// word[H123] for Strong's, {…} for words of Jesus, <em>…</em> for supplied words.
function parseBibleXML(text,fileName){
  const doc=new DOMParser().parseFromString(text,'application/xml');
  if(doc.querySelector('parsererror')) throw new Error('This file isn’t valid XML.');
  const root=doc.documentElement, rn=root.localName.toLowerCase();
  const fmt=rn==='xmlbible'?'zef':rn==='osis'?'osis':rn==='usfx'?'usfx':rn==='bible'&&root.querySelector('b')?'opensong':rn==='bible'?'beblia':null;
  if(!fmt) throw new Error('This XML format isn’t supported. Use a Zefania, OSIS, USFX, Beblia or OpenSong Bible.');
  const V=new Map(); let book=-1,chap=0,cur=null,red=false,anyS=false,anyRed=false,bookCount=0;
  const SKIP=new Set(['note','f','x','fe','rf','xref','footnote','stylesheet','header','work','information','title','caption','reference','idx','toc','h','id','ide','rem','milestone']);
  const append=t=>{ if(cur==null) return; t=t.replace(/[{}]/g,m=>m==='{'?'(':')').replace(/«/g,'“').replace(/»/g,'”').replace(/\[(?=\[|[HG]\d)/g,'(');
    if(red&&t.trim()){ t='{'+t+'}'; anyRed=true; } V.set(cur,(V.get(cur)||'')+t); };
  const key=(b,c,v)=>b>=0&&b<66&&c>0&&v>0?`${b}.${c}.${v}`:null;
  const sid=(raw,b)=>{ return String(raw||'').split(/\s+/).map(x=>{ const m=x.replace(/^strong:/i,'').match(/^([HGhg])?0*(\d+)/); return m?(m[1]?m[1].toUpperCase():(b<39?'H':'G'))+m[2]:null; }).filter(Boolean); };
  const wrap=(el,open,close)=>{ const k=cur; const before=k?(V.get(k)||'').length:0; kids(el); if(k&&cur===k){ const t=V.get(k)||''; if(t.slice(before).trim()){ V.set(k,t.slice(0,before)+open+t.slice(before)+close); if(open==='{') anyRed=true; } } };
  const kids=el=>{ for(const n of el.childNodes) visit(n); };
  function visit(n){
    if(n.nodeType===3||n.nodeType===4){ append(n.nodeValue); return; }
    if(n.nodeType!==1) return;
    const t=n.localName.toLowerCase(), a=x=>n.getAttribute(x);
    if(SKIP.has(t)&&!(fmt==='osis'&&t==='title'&&a('type')==='psalm')) return;
    if(t==='br'){ append(' '); return; }
    // structure
    if(fmt==='zef'){
      if(t==='biblebook'){ book=+a('bnumber')-1; if(book>65) return; bookCount++; return kids(n); }
      if(t==='chapter'){ chap=+a('cnumber'); return kids(n); }
      if(t==='vers'){ cur=key(book,chap,+a('vnumber')); kids(n); cur=null; return; }
    } else if(fmt==='beblia'){
      if(t==='book'){ book=+a('number')-1; if(book>65) return; bookCount++; return kids(n); }
      if(t==='chapter'){ chap=+a('number'); return kids(n); }
      if(t==='verse'){ cur=key(book,chap,+a('number')); kids(n); cur=null; return; }
    } else if(fmt==='opensong'){
      if(t==='b'){ const i=bookByName(a('n')); book=i>=0?i:bookCount; bookCount++; return kids(n); }
      if(t==='c'){ chap=+a('n'); return kids(n); }
      if(t==='v'){ cur=key(book,chap,+a('n')); kids(n); cur=null; return; }
    } else if(fmt==='usfx'){
      if(t==='book'){ book=USFM_CODES.indexOf(String(a('id')).toUpperCase()); if(book>=0) bookCount++; cur=null; return kids(n); }
      if(t==='c'){ chap=+a('id'); cur=null; return; }
      if(t==='v'){ cur=key(book,chap,parseInt(a('id'))); return; }
      if(t==='ve'){ cur=null; return; }
      if(t==='w'&&a('s')){ const k=cur; wrap(n,'',''); if(k&&cur===k){ const ids=sid(a('s'),book); if(ids.length){ V.set(k,V.get(k)+ids.map(x=>`[${x}]`).join('')); anyS=true; } } return; }
      if(t==='wj') return wrap(n,'{','}');
      if(t==='add') return wrap(n,'<em>','</em>');
    } else if(fmt==='osis'){
      if(t==='div'&&a('type')==='book'){ const i=OSIS_CODES.indexOf(String(a('osisID'))); if(i>=0){ book=i; bookCount++; } return kids(n); }
      if(t==='chapter'){ if(a('eID')) return; return kids(n); }
      if(t==='verse'){
        if(a('eID')){ cur=null; return; }
        const id=String(a('osisID')||a('sID')||'').split(/\s+/)[0].split('.');
        const k=key(OSIS_CODES.indexOf(id[0]),+id[1],parseInt(id[2]));
        if(a('sID')&&!n.hasChildNodes()){ cur=k; return; }
        cur=k; kids(n); cur=null; return;
      }
      if(t==='q'&&a('who')==='Jesus'){ if(a('sID')){ red=true; return; } if(a('eID')){ red=false; return; } return wrap(n,'{','}'); }
      if(t==='q'&&a('eID')&&red){ red=false; return; }
      if(t==='transchange'&&a('type')==='added') return wrap(n,'<em>','</em>');
    }
    // Strong's words: Zefania <gr str="">, OSIS <w lemma="strong:H430">
    if((t==='gr'&&a('str'))||(t==='w'&&/strong:/i.test(a('lemma')||''))){
      const k=cur; kids(n); if(k&&cur===k){ const ids=sid(a('str')||(a('lemma')||'').split(/\s+/).filter(x=>/strong:/i.test(x)).join(' '),+k.split('.')[0]); if(ids.length){ V.set(k,V.get(k)+ids.map(x=>`[${x}]`).join('')); anyS=true; } } return;
    }
    if(t==='style'&&/red|#f00|#ff0000|jesus/i.test((a('css')||'')+(a('fs')||''))) return wrap(n,'{','}');
    if(t==='style'&&/italic/i.test((a('css')||'')+(a('fs')||''))) return wrap(n,'<em>','</em>');
    kids(n);
  }
  visit(root);
  if(!V.size) throw new Error('No verses were found in this file.');
  const data=Array.from({length:66},()=>[]);
  for(const [k,v] of V){ const [b,c,vv]=k.split('.').map(Number); const ch=(data[b][c-1]=data[b][c-1]||[]); ch[vv-1]=v.replace(/\s+/g,' ').replace(/\s+([,.;:!?}])/g,'$1').replace(/\{\s+/g,'{').replace(/\{\}/g,'').trim(); }
  data.forEach(bk=>{ for(let c=0;c<bk.length;c++){ bk[c]=bk[c]||[]; for(let v=0;v<bk[c].length;v++) bk[c][v]=bk[c][v]||''; } if(!bk.length) bk.push([]); });
  const q=sel=>root.querySelector(sel);
  const name=(q('INFORMATION > title, information > title, work > title, header title')?.textContent||root.getAttribute('translation')||root.getAttribute('biblename')||root.getAttribute('n')||fileName.replace(/\.[^.]+$/,'')).trim();
  let abbr=(q('INFORMATION > identifier, identifier')?.textContent||q('work')?.getAttribute('osisWork')||'').trim();
  abbr=abbr.replace(/^(?:bible\.)?[a-z]{2,3}[-_.]/i,'').toUpperCase();
  if(!abbr||abbr.length>8) abbr=name.split(/\s+/).filter(w=>/^[A-Za-z0-9]/.test(w)&&!/^(the|of|and|a)$/i.test(w)).map(w=>w[0]).join('').toUpperCase().slice(0,5)||'XML';
  return {name,abbr,data,strongs:anyS,red:anyRed,verses:V.size};
}
// JSON Bibles: {books:[[["v1","v2"],…],…]} (Stobite TV) or {name,abbrev,books:[{name,chapters:[[…]]}]} (Stobite Presenter),
// or just the books array. Verses are plain text; any Strong's/red-letter marks in our own format are kept.
function parseBibleJSON(text,fileName){
  let j; try{ j=JSON.parse(text); }catch(e){ throw new Error('That JSON file couldn’t be read.'); }
  let books=Array.isArray(j)?j:(j.books||j.bible||j.data);
  if(!Array.isArray(books)) throw new Error('No books were found in this JSON file.');
  books=books.map(b=>Array.isArray(b)?b:(b&&(b.chapters||b.c))||[]);
  if(books.length<66) throw new Error(`This file has ${books.length} books; a whole Bible (66) is needed.`);
  const data=books.slice(0,66).map(bk=>bk.map(ch=>(Array.isArray(ch)?ch:Object.values(ch||{})).map(v=>String(typeof v==='object'&&v?(v.text||v.t||''):v??'').replace(/\s+/g,' ').trim())));
  let verses=0, anyS=false, anyRed=false; data.forEach(bk=>bk.forEach(ch=>ch.forEach(v=>{ if(v){ verses++; if(!anyS&&/\[[HG]\d+\]/.test(v)) anyS=true; if(!anyRed&&v.includes('{')) anyRed=true; } })));
  if(!verses) throw new Error('No verses were found in this file.');
  const name=String(Array.isArray(j)?'':(j.name||j.version||j.title||'')).trim()||fileName.replace(/\.[^.]+$/,'');
  let abbr=String(Array.isArray(j)?'':(j.abbrev||j.abbr||j.abbreviation||'')).trim().toUpperCase();
  if(!abbr||abbr.length>8){ const m=fileName.match(/^([a-z0-9]{2,8})\.json$/i); abbr=m?m[1].toUpperCase():name.split(/\s+/).filter(w=>/^[A-Za-z0-9]/.test(w)&&!/^(the|of|and|a)$/i.test(w)).map(w=>w[0]).join('').toUpperCase().slice(0,5)||'JSON'; }
  return {name,abbr,data,strongs:anyS,red:anyRed,verses};
}
const parseBibleFile=(text,name)=>/\.json$/i.test(name)||/^\s*[\[{]/.test(text)?parseBibleJSON(text,name):parseBibleXML(text,name);
let PENDING=null;
$('#xmlfile').addEventListener('change',async e=>{
  const f=e.target.files[0]; e.target.value=''; if(!f) return;
  toast('Reading '+f.name+'…');
  try{ PENDING=parseBibleFile(await f.text(),f.name); renderMenu('confirm'); openSheet($('#menup'),$('#menu')); }
  catch(err){ toast(err.message||'Couldn’t read that file.'); }
});
// Used by the Mac app's File → Import menu, which reads the file natively.
window.importXMLText=async(text,name)=>{ PENDING=parseBibleFile(text,name); renderMenu('confirm'); openSheet($('#menup'),$('#menu')); if(!phone()) $('#menup').style.left=$('#menu').getBoundingClientRect().left+'px'; return PENDING.verses; };
async function saveImport(name,abbr){
  const P=PENDING; if(!P) return;
  abbr=(abbr||P.abbr).trim().toUpperCase().slice(0,8)||'XML'; while(Object.values(VN).includes(abbr)) abbr+='2';
  if(!P.red&&P.data.length===66){ toast('Adding red letters and God’s words…'); if(await addMarks(P.data)) P.red=true; }
  const m={id:'x_'+Date.now().toString(36),name:(name||P.name).trim()||abbr,abbr,strongs:P.strongs,red:P.red,verses:P.verses,marksTried:1};
  try{ await idb('data','put',[m.id,P.data]); await idb('meta','put',m); }
  catch(e){ return toast('Couldn’t save the Bible here: '+(e.message||e)); }
  DATA[m.id]=P.data; IMPORTS.push(m); registerImport(m); PENDING=null; closeSheets();
  $(`#ver button[data-v="${m.id}"]`).click(); toast(`Added ${m.abbr}`);
  if(syncOn()) setTimeout(()=>syncNow(),500);
}
async function removeImport(id){
  const m=IMPORTS.find(x=>x.id===id); if(!m||!confirm(`Remove ${m.name} from this Bible app?`)) return;
  try{ await idb('data','del',id); await idb('meta','del',id); }catch(e){}
  forgetImportRemote(id);
  IMPORTS=IMPORTS.filter(x=>x.id!==id); delete VN[id]; delete VFULL[id]; delete DATA[id]; STRONGS.delete(id); MARKED.delete(id);
  $(`#ver button[data-v="${id}"]`)?.remove();
  if(S.v===id){ S.v='kjv'; } if(S.v2===id){ S.v2=S.v==='bsb'?'kjv':'bsb'; }
  renderMenu(); draw();
}

// ---------- Menu (☰) ----------
const ICON={
  search:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.7"><circle cx="8.5" cy="8.5" r="5.5"/><path d="m13 13 4 4" stroke-linecap="round"/></svg>',
  marks:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linejoin="round"><path d="M5.5 3h9v14l-4.5-3.2L5.5 17z"/></svg>',
  imp:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M10 3v9m-3.5-3.5L10 12l3.5-3.5M4 14v2.5h12V14"/></svg>',
  shuf:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3 6h3.5c2.5 0 3.5 1.5 4.5 4s2 4 4.5 4H17M3 14h3.5c1.2 0 2-.4 2.7-1.1M17 6h-1.5c-1.2 0-2 .4-2.7 1.1M15 4l2 2-2 2M15 12l2 2-2 2"/></svg>',
  lib:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M3.5 4.5c2.4-.9 4.6-.6 6.5 1v11c-1.9-1.6-4.1-1.9-6.5-1z"/><path d="M16.5 4.5c-2.4-.9-4.6-.6-6.5 1v11c1.9-1.6 4.1-1.9 6.5-1z"/></svg>',
  bm:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><circle cx="10" cy="10" r="7"/><path d="M10 6v4l2.5 2"/></svg>',
  sync:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><path d="M16 8.5A6 6 0 0 0 5 6.2M4 11.5a6 6 0 0 0 11 2.3"/><path d="M5 3v3.3h3.3M15 17v-3.3h-3.3"/></svg>',
  plan:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"><rect x="3" y="4.5" width="14" height="12.5" rx="2.5"/><path d="M3 8.5h14M7 3v3M13 3v3M7.5 12.5l1.7 1.7 3.3-3.4"/></svg>',
  info:'<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.6"><circle cx="10" cy="10" r="7"/><path d="M10 9v5M10 6.2v.1" stroke-linecap="round"/></svg>'};
function renderMenu(mode){
  const m=$('#menup');
  if(mode==='confirm'&&PENDING){
    m.innerHTML=`<div class="lbx">Add this Bible</div>
      <div style="padding:4px 10px 10px;font-size:13px;color:var(--muted);line-height:1.5">${PENDING.verses.toLocaleString()} verses${PENDING.strongs?' · Strong’s':''}${PENDING.red?' · red letters':''}</div>
      <div style="padding:0 10px;display:flex;flex-direction:column;gap:8px">
        <input id="impName" value="${esc(PENDING.name)}" placeholder="Name" style="border:.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:8px 10px;font-size:14px">
        <input id="impAbbr" value="${esc(PENDING.abbr)}" placeholder="Short name, e.g. NKJV" maxlength="8" style="border:.5px solid var(--line);background:var(--card);color:var(--ink);border-radius:8px;padding:8px 10px;font-size:14px;text-transform:uppercase">
      </div>
      <div style="display:flex;gap:8px;padding:12px 10px 4px"><button class="pill" data-cancel style="flex:1">Cancel</button><button class="pill pri" data-addimp style="flex:1">Add</button></div>`;
    return;
  }
  const pl=planMenuLabel();
  m.innerHTML=`<button class="mi" data-m="lib">${ICON.lib}Library<small>${window.MAC_APP?'⇧⌘L':'Books'}</small></button>
    <button class="mi" data-m="plan">${ICON.plan}Reading plan${pl?`<small>${esc(pl)}</small>`:''}</button>
    <button class="mi" data-m="shuffle">${ICON.shuf}Verse shuffle</button>
    <button class="mi" data-m="search">${ICON.search}Search<small>⌘K</small></button>
    <button class="mi" data-m="marks">${ICON.marks}Highlights and notes</button>
    <button class="mi" data-m="bm">${ICON.bm}Bookmarks and history</button>
    ${MSTORE?'':`<button class="mi" data-m="sync">${ICON.sync}Sync<small>${SB?'On':'Off'}</small></button>`}
    <button class="mi" data-m="import">${ICON.imp}Import a Bible (XML or JSON)…</button>
    ${IMPORTS.length?`<div class="lbx">Imported</div>${IMPORTS.map(x=>`<div class="imp"><b>${esc(x.abbr)}</b><span>${esc(x.name)}</span><button data-rmimp="${x.id}">Remove</button></div>`).join('')}`:''}
    <hr><button class="mi" data-m="about">${ICON.info}About</button>`;
}
$('#menu').onclick=()=>{ if($('#menup').classList.contains('open')) return closeSheets(); renderMenu(); openSheet($('#menup'),$('#menu')); const r=$('#menu').getBoundingClientRect(); if(!phone()) $('#menup').style.left=r.left+'px'; };
$('#menup').onclick=e=>{
  e.stopPropagation();
  const b=e.target.closest('button'); if(!b) return;
  const k=b.dataset.m;
  if(k==='lib'){ closeSheets(); libOpen(); }
  else if(k==='plan'){ openPlan(); }
  else if(k==='shuffle'){ shufOpen(); }
  else if(k==='bm'){ closeSheets(); showBookmarks(); }
  else if(k==='sync'){ openSync(); }
  else if(k==='search'){ closeSheets(); openNav(true); }
  else if(k==='marks'){ closeSheets(); showMarks('all'); }
  else if(k==='import'){ $('#xmlfile').click(); }
  else if(k==='about'){ closeSheets(); $('#modal').classList.add('open'); }
  else if(b.dataset.rmimp) removeImport(b.dataset.rmimp);
  else if('cancel' in b.dataset){ PENDING=null; closeSheets(); }
  else if('addimp' in b.dataset) saveImport($('#impName').value,$('#impAbbr').value);
};

// Swipe left/right to change chapter: see the page-turn code in extras.js

// ---------- Version menu ----------
// The NKJV is copyrighted, so it isn't bundled; these links open it (with Strong's) on Blue Letter Bible, which is licensed.
const BLB_CODES='gen exo lev num deu jos jdg rth 1sa 2sa 1ki 2ki 1ch 2ch ezr neh est job psa pro ecc sng isa jer lam eze dan hos joe amo oba jon mic nah hab zep hag zec mal mat mar luk jhn act rom 1co 2co gal eph phl col 1th 2th 1ti 2ti tit phm heb jas 1pe 2pe 1jo 2jo 3jo jde rev'.split(' ');
const nkjvURL=(b,c,v)=>`https://www.blueletterbible.org/nkjv/${BLB_CODES[b]}/${c}/${v||1}/`;
function renderVer(){
  const tg=$('#t-par');
  $('#verp').innerHTML=Object.keys(VN).map(v=>`<button class="vr${S.v===v?' on':''}" data-pickv="${v}"><b>${VN[v]}</b><span>${VFULL[v]}</span>${STRONGS.has(v)?'<small>Strong’s</small>':''}</button>`).join('')
    +`<a class="vr" href="${nkjvURL(S.b,S.c+1)}" target="_blank" rel="noopener"><b>NKJV</b><span>New King James Version ↗</span><small>Strong’s</small></a>`
    +`<hr><button class="tg${tg.classList.contains('on')?' on':''}" data-par><span class="lbl">Side by side</span><span class="sw"></span></button>`;
}
$('#verb').onclick=()=>{ if($('#verp').classList.contains('open')) return closeSheets(); renderVer(); openSheet($('#verp'),$('#verb')); };
$('#verp').onclick=async e=>{
  e.stopPropagation();
  const b=e.target.closest('button'); if(!b) return;
  if(b.dataset.pickv){ $(`#ver button[data-v="${b.dataset.pickv}"]`).click(); await load(b.dataset.pickv); closeSheets(); return; }
  if('par' in b.dataset){ $('#t-par').click(); setTimeout(renderVer,60); }
};

// ---------- Reading settings ----------
function fontList(){
  const q=FFIND.trim().toLowerCase(), list=(ALLFONTS||[]).filter(f=>!q||f.toLowerCase().includes(q)).slice(0,250);
  return list.length?list.map(f=>`<button data-font="f:${esc(f)}" class="${S.font==='f:'+f?'on':''}" style='font-family:"${esc(f).replace(/'/g,'')}"'>${esc(f)}</button>`).join(''):'<div style="font-size:13px;color:var(--muted);padding:6px 10px">No fonts match.</div>';
}
const HEADS=[['dropcap','Big number'],['refined','Book and number'],['classic','Centred'],['line','One line'],['bookchap','Book, chapter']];
function headHTML(style,b,c,v){
  const name=NAMES[b], full=VFULL[v];
  if(style==='dropcap') return '';
  if(style==='line') return `<div class="t1">${name} ${c}</div><div class="vn">${full}</div>`;
  if(style==='bookchap') return `<div class="bn">${name}</div><div class="vn">Chapter ${c} · ${VN[v]}</div>`;
  return `<div class="bn">${name}</div><div class="cn">${c}</div><div class="vn">${full}</div>`;
}
// Settings: a short main page in three sections, with Font and Chapter heading as their own pages.
let PREFPAGE='main';
const GLASS_TINTS=[['blue','Soft blue','#d3dcea','#4a6fb5'],['mist','Mist','#dcdee3','#56657d'],['lavender','Lavender','#e0d9ef','#7059b8'],['rose','Rose','#f1dde2','#b0506c'],
  ['peach','Peach','#f3e1d3','#b0673f'],['sand','Sand','#e9e3d6','#8a6a3c'],['sage','Sage','#d8e5da','#3f8259'],['aqua','Aqua','#d3e8e8','#2f8586']];
const glassTint=()=>GLASS_TINTS.find(t=>t[0]===S.glass)||GLASS_TINTS[0];
const glassSW=t=>`radial-gradient(80% 90% at 90% 0%,${t[2]},transparent 70%),linear-gradient(160deg,#f8f9fa,color-mix(in srgb,${t[2]} 45%,#f8f9fa))`;
const GLASS_SW='';
const THEMES=[['auto','Automatic','Light by day, dark at night','#ffffff','#1d1d1f'],['autoglass','Automatic glass','Glass by day, dark at night',GLASS_SW,'#1b2431'],['light','Light','White paper','#ffffff','#1d1d1f'],['glass','Glass','Frosted panels on a soft colour wash',GLASS_SW,'#1b2431'],['dark','Dark','Soft charcoal, Discord colours','#313338','#dbdee1'],['sepia','Sepia','Warm paper, easy on the eyes','#f4ecd8','#3b3024'],['black','Black','True black, for reading at night','#000000','#e8e8ea'],['custom','Custom','Your own colours','','']];
const CHEV_R='<svg class="chv" viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="1.7" stroke-linecap="round" stroke-linejoin="round"><path d="m4.5 2.5 3.5 3.5-3.5 3.5"/></svg>';
function renderPrefs(){
  const el=$('#prefs');
  const tgl=(id,label)=>{ const t=$('#'+id); return `<button class="tg srow${t.classList.contains('red')?' red':''}${t.classList.contains('on')?' on':''}" data-tg="${id}" ${t.disabled?'disabled':''} title="${esc(t.title)}"><span class="lbl">${label}</span><span class="sw"></span></button>`; };
  const seg=(key,val,opts)=>`<span class="sseg">${opts.map(([k,l])=>`<button data-${key}="${k}" class="${val===k?'on':''}">${l}</button>`).join('')}</span>`;
  const back=title=>`<div class="shd"><button class="sback" data-page="main">‹ Settings</button><h3>${title}</h3></div>`;
  if(PREFPAGE==='font'){
    el.innerHTML=back('Font')+`<div class="sbox fonts">${FONTS.map(([k,n,st,note])=>`<button data-font="${k}" class="${S.font===k?'on':''}" style='font-family:${st}'>${n}<small>${note}</small></button>`).join('')}</div>
      <div class="sg">${ALLFONTS?`All fonts on this ${window.MAC_APP?'Mac':'device'} (${ALLFONTS.length.toLocaleString()})`:'Other fonts'}</div>
      ${ALLFONTS?`<input class="ffind" id="ffind" type="search" placeholder="Search fonts" value="${esc(FFIND)}" autocomplete="off"><div class="sbox fonts" id="flist">${fontList()}</div>`
        :`<input class="ffind" id="ffind" type="text" placeholder="Type any installed font name" value="${esc(FFIND)}" autocomplete="off"><div style="display:flex;gap:8px"><button class="pill" data-usefont style="flex:1">Use this font</button>${'queryLocalFonts' in window?'<button class="pill" data-listfonts style="flex:1">List my fonts</button>':''}</div>`}`;
    return;
  }
  if(PREFPAGE==='theme'){
    el.innerHTML=back('Appearance')+`<div class="themes">${THEMES.map(([k,n,sub,bg,ink])=>(k==='custom'&&([bg,ink]=[custom().bg,custom().ink]),k.endsWith('glass')&&(bg=glassSW(glassTint())),`<button data-theme="${k}" class="${S.theme===k?'on':''}"><span class="sw" style="background:${bg};color:${ink}">${k.startsWith('auto')?'<i style="background:#313338"></i>':''}Aa</span><b>${n}</b><small>${sub}</small></button>`)).join('')}</div>`+(S.theme.endsWith('glass')?`<div class="sg">Glass colour</div><div class="gtints">${GLASS_TINTS.map(t=>`<button data-gtint="${t[0]}" class="${glassTint()[0]===t[0]?'on':''}"><span style="background:${glassSW(t)}"><i style="background:${t[3]}"></i></span>${t[1]}</button>`).join('')}</div>`:'')+customEditorHTML();
    return;
  }
  if(PREFPAGE==='turn'){
    el.innerHTML=back('Page turn')+`<div class="turns">${TURNS.map(([k,n,sub])=>`<button data-turn="${k}" class="${(S.turn||'slide')===k?'on':''}"><span class="tpv t-${k}"><i></i><i></i></span><b>${n}</b><small>${sub}</small></button>`).join('')}</div>
      <p class="snote">Swipe left or right on the text, tap the arrows, or use ← → on a keyboard.${matchMedia('(prefers-reduced-motion:reduce)').matches?' Reduce Motion is on in your device settings, so pages change without moving.':''}</p>`;
    return;
  }
  if(PREFPAGE==='heading'){
    const pv={dropcap:`<div style="display:flex;gap:5px;align-items:flex-start"><span style="font-size:26px;font-weight:300;line-height:.9">${S.c+1}</span><span style="display:flex;flex-direction:column;gap:3px;padding-top:3px;flex:1"><i class="ln"></i><i class="ln"></i></span></div>`,
      refined:`<div style="font-size:12px">${NAMES[S.b]}</div><div style="font-size:26px;font-weight:300">${S.c+1}</div>`,
      classic:`<div style="font-size:8px;letter-spacing:.3em;text-transform:uppercase;text-align:center;color:var(--muted)">${NAMES[S.b]}</div><div style="font-size:26px;font-weight:300;text-align:center">${S.c+1}</div>`,
      line:`<div style="font-size:18px;font-weight:500">${NAMES[S.b]} ${S.c+1}</div>`,
      bookchap:`<div style="font-size:20px">${NAMES[S.b]}</div><div style="font:600 8px -apple-system,sans-serif;letter-spacing:.2em;color:var(--accent)">CHAPTER ${S.c+1}</div>`};
    el.innerHTML=back('Chapter heading')+`<div class="heads">${HEADS.map(([k,l])=>`<button data-hs="${k}" class="${S.hs===k?'on':''}"><span class="pv">${pv[k]}</span><small>${l}</small></button>`).join('')}</div>`;
    return;
  }
  el.innerHTML=`<div class="shd"><h3>Settings</h3></div>
    <div class="sg">Reading</div>
    <div class="sbox">${tgl('t-strongs','Strong’s words')}${tgl('t-red','Red letters')}${tgl('t-god','God’s words only')}</div>
    <div class="sg">Text</div>
    <div class="sbox">
      <button class="srow nav" data-page="font"><span>Font</span><span class="sv">${esc(fontName(S.font))}${CHEV_R}</span></button>
      <div class="srow"><span>Size</span><span class="stpr"><button class="stp" data-fs="-1" aria-label="Smaller text" style="font-size:12px">A</button><b>${S.fs}</b><button class="stp" data-fs="1" aria-label="Larger text" style="font-size:16px">A</button></span></div>
      <div class="srow"><span>Line spacing</span>${seg('lh',S.lh,[['compact','Tight'],['normal','Normal'],['relaxed','Loose']])}</div>
      <div class="srow"><span>Margins</span><input type="range" id="mw" min="28" max="72" step="2" value="${S.mw||44}" aria-label="Text width: left is wider margins"></div>
    </div>
    <div class="sg">Page</div>
    <div class="sbox">
      <div class="srow"><span>Layout</span>${seg('layout',S.layout,[['verse','Verses'],['para','Paragraph'],['one','One verse']])}</div>
      <button class="srow nav" data-page="turn"><span>Page turn</span><span class="sv">${(TURNS.find(t=>t[0]===(S.turn||'slide'))||TURNS[0])[1]}${CHEV_R}</span></button>
      <button class="srow nav" data-page="heading"><span>Chapter heading</span><span class="sv">${(HEADS.find(h=>h[0]===S.hs)||HEADS[0])[1]}${CHEV_R}</span></button>
      <button class="srow nav" data-page="theme"><span>Appearance</span><span class="sv">${(THEMES.find(t=>t[0]===S.theme)||THEMES[0])[1]}${CHEV_R}</span></button>
    </div>${offlineRowHTML()}`;
}
$('#gear').onclick=()=>{ if($('#prefs').classList.contains('open')) return closePrefs(); PREFPAGE='main'; renderPrefs(); openSheet($('#prefs'),$('#gear')); };
$('#prefs').onclick=async e=>{
  e.stopPropagation(); // the panel redraws, so the outside-click check must not see this click
  const b=e.target.closest('button'); if(!b||b.disabled) return;
  const keep=()=>{ const fl=$('#flist'), fs=fl?fl.scrollTop:0, top=$('#prefs').scrollTop; renderPrefs(); if($('#flist')) $('#flist').scrollTop=fs; $('#prefs').scrollTop=top; };
  if(b.dataset.page){ PREFPAGE=b.dataset.page; renderPrefs(); $('#prefs').scrollTop=0; return; }
  if(b.dataset.theme){ S.theme=b.dataset.theme; }
  if(b.dataset.gtint){ S.glass=b.dataset.gtint; save(); applyTheme(); syncPut('x-theme',{custom:custom(),glass:S.glass}); keep(); return; }
  if(b.dataset.turn){ S.turn=b.dataset.turn; save(); keep(); if(!searchMode) setTimeout(()=>turn(1,()=>{}),60); return; }
  if(b.dataset.cpreset){ setCustom({...CPRESETS[+b.dataset.cpreset][1]}); keep(); return; }
  if('creset' in b.dataset){ setCustom({...CUSTOM_DEF}); keep(); return; }
  if(b.dataset.layout){ const fv=oneMode()?ONE:firstVisibleVerse(); S.layout=b.dataset.layout; if(S.layout==='one'){ ONE=fv||1; ONEKEY=S.b+'.'+S.c; } save(); if(!searchMode) draw(S.layout==='one'?ONE:(fv>1?fv:0)); }
  if(b.dataset.tg){ $('#'+b.dataset.tg).click(); setTimeout(keep,50); return; }
  if(b.dataset.hs){ S.hs=b.dataset.hs; save(); if(!searchMode) draw(firstVisibleVerse()>1?firstVisibleVerse():0); }
  if(b.dataset.font) S.font=b.dataset.font;
  if('usefont' in b.dataset){ const n=$('#ffind').value.trim(); if(!n) return; if(!document.fonts.check(`16px "${n}"`)) toast('That font may not be installed; using it anyway'); S.font='f:'+n; }
  if('listfonts' in b.dataset){ try{ const fs=await window.queryLocalFonts(); ALLFONTS=[...new Set(fs.map(f=>f.family))].sort((a,b)=>a.localeCompare(b)); }catch(err){ return toast('Font access wasn’t allowed'); } }
  if(b.dataset.fs) S.fs=Math.max(14,Math.min(32,S.fs+ +b.dataset.fs));
  if(b.dataset.lh) S.lh=b.dataset.lh;
  syncControls(); save(); keep();
};

// ---------- Random reading: a Bible chapter, or a chapter of a Dag Heward-Mills book ----------
// Picks and any chapter counts entered for the newer books are saved with highlights (db doc "x-reading").
let READ=Object.assign({counts:{},hist:[]},store.get('reading',{}));
const RP={token:0,tab:S.rtab||'bible',scope:S.rscope||'all',mkset:S.rmkset||'all',cur:{}};
const MKSETS=[['all','All books'],['makarios','Makarios'],['mini','Mini books'],['school','Schools']];
const mkPool=()=>MAKARIOS.map((_,i)=>i).filter(i=>RP.mkset==='all'||MAKARIOS[i][2]===RP.mkset);
const rnd=n=>Math.floor(Math.random()*n);
const mkCount=i=>READ.counts[MAKARIOS[i][0]]??MAKARIOS[i][1];
function saveReading(){ READ.hist=READ.hist.slice(-60); store.set('reading',READ); if(MSTORE) MSTORE.doc('x-reading').set(READ).catch(()=>{}); else syncPut('x-reading',READ); }
function pick(){
  let label;
  if(RP.tab==='bible'){
    const [lo,hi]=RP.scope==='ot'?[0,38]:RP.scope==='nt'?[39,65]:[0,65];
    const b=lo+rnd(hi-lo+1), c=rnd(DATA[S.v][b].length);
    RP.cur.bible={b,c}; READ.hist.push({k:'b',b,c:c+1,at:Date.now()});
    label=()=>{ const x=lo+rnd(hi-lo+1); return [`${NAMES[x]} ${1+rnd(DATA[S.v][x].length)}`,null]; };
  } else {
    const pool=mkPool(), i=pool[rnd(pool.length)], n=mkCount(i), c=n?1+rnd(n):null;
    RP.cur.mk={i,c}; READ.hist.push({k:'m',t:MAKARIOS[i][0],c,at:Date.now()});
    label=()=>{ const j=pool[rnd(pool.length)], m=mkCount(j)||20; return [MAKARIOS[j][0],`Chapter <b>${1+rnd(m)}</b> of ${m}`]; };
  }
  saveReading(); renderRand(); shuffle(label,++RP.token);
}
// Quick slot-machine shuffle: flick through random picks, slowing down, then land on the real one.
function shuffle(label,token){
  const card=$('#randp .card'); if(!card||matchMedia('(prefers-reduced-motion:reduce)').matches) return;
  const big=card.querySelector('.big'), chn=card.querySelector('.chn'), real=[big.innerHTML,chn&&chn.innerHTML,big.className];
  const dice=$('#rand'); dice.classList.remove('shake'); void dice.offsetWidth; dice.classList.add('shake');
  card.classList.add('spin');
  const delays=[40,40,45,50,55,60,70,80,95,115,140,170];
  let k=0;
  const step=()=>{
    if(RP.token!==token) return; // a newer pick or tab switch took over
    if(k>=delays.length){ big.innerHTML=real[0]; big.className=real[2]; if(chn) chn.innerHTML=real[1]; card.classList.remove('spin'); card.classList.add('land'); return; }
    const [t,c]=label(); big.textContent=t; big.className='big'+(t.length>30?' long':''); if(chn&&c) chn.innerHTML=c;
    setTimeout(step,delays[k++]);
  };
  step();
}
function ago(t){ const d=Math.floor((Date.now()-t)/86400000); return d<1?'Today':d<2?'Yesterday':d<7?`${d} days ago`:new Date(t).toLocaleDateString(undefined,{day:'numeric',month:'short'}); }
function renderRand(){
  const bible=RP.tab==='bible'; let card='';
  if(bible){
    const x=RP.cur.bible; const n=DATA[S.v][x.b].length;
    card=`<div class="card"><div class="k">${x.b<39?'Old Testament':'New Testament'}</div>
      <div class="big">${NAMES[x.b]} ${x.c+1}</div><div class="sub">${NAMES[x.b]} has ${n} ${n===1?'chapter':'chapters'}</div>
      <div class="scope">${[['all','Whole Bible'],['ot','Old'],['nt','New']].map(([k,l])=>`<button data-scope="${k}" class="${RP.scope===k?'on':''}">${l}</button>`).join('')}</div></div>
      <div class="acts"><button class="pill" data-again>Pick again</button><button class="pill pri" data-read>Read it</button></div>`;
  } else {
    const x=RP.cur.mk, [t]=MAKARIOS[x.i], n=mkCount(x.i);
    card=`<div class="card"><div class="k">Dag Heward-Mills</div><div class="big${t.length>30?' long':''}">${esc(t)}</div>
      ${x.c?`<div class="chn">Chapter <b>${x.c}</b> of ${n}</div>${window.MAC_APP?epReadHTML(t,x.c):''}<button class="edit" data-editc>Change chapter count</button>`
        :`<div class="sub">This book’s chapter count isn’t set yet.</div>`}
      ${!x.c||RP.editing?`<div class="setc">Chapters in this book <input id="cnt" type="number" min="1" max="400" inputmode="numeric" value="${n||''}"><button class="pill pri" data-setc>Save</button></div>`:''}</div>
      <div class="scope">${MKSETS.map(([k,l])=>`<button data-mkset="${k}" class="${RP.mkset===k?'on':''}">${l}</button>`).join('')}</div>
      <div class="acts"><button class="pill pri" data-again>Pick again</button></div>`;
  }
  const hist=READ.hist.filter(h=>h.k===(bible?'b':'m')).slice(-8).reverse();
  const shufBtn=`<button class="shufgo" data-shuf>▶ Verse shuffle, full screen</button>`;
  $('#randp').innerHTML=`<div class="seg"><button data-tab="bible" class="${bible?'on':''}">Bible</button><button data-tab="mk" class="${bible?'':'on'}">Dag Heward-Mills</button></div>${card}${bible?shufBtn:''}
    ${hist.length>1?`<div class="lb">Recent picks</div><div class="hist">${hist.slice(1).map(h=>`<div>${h.k==='b'?`${NAMES[h.b]} ${h.c}`:`${esc(h.t)}${h.c?`, ch. ${h.c}`:''}`}<span>${ago(h.at)}</span></div>`).join('')}</div>`:''}`;
}
function openRand(){
  if(!(RP.tab==='bible'?RP.cur.bible:RP.cur.mk)) return pick(), openSheet($('#randp'),$('#rand'));
  renderRand(); openSheet($('#randp'),$('#rand'));
}
$('#rand').onclick=()=>$('#randp').classList.contains('open')?closeSheets():openRand();
$('#prefs').addEventListener('input',e=>{
  if(e.target.id==='ffind'){ FFIND=e.target.value; const l=$('#flist'); if(l) l.innerHTML=fontList(); }
  if(e.target.id==='mw'){ S.mw=+e.target.value; document.documentElement.style.setProperty('--mw',S.mw+'rem'); save(); }
});
$('#randp').onclick=e=>{
  e.stopPropagation();
  const b=e.target.closest('button'); if(!b) return;
  if('shuf' in b.dataset){ RP.token++; return shufOpen(); }
  if('epread' in b.dataset){ const x=RP.cur.mk; return epOpen(MAKARIOS[x.i][0],x.c); }
  if(b.dataset.tab){ RP.token++; RP.tab=S.rtab=b.dataset.tab; RP.editing=false; save(); (RP.tab==='bible'?RP.cur.bible:RP.cur.mk)?renderRand():pick(); }
  else if(b.dataset.scope){ RP.scope=S.rscope=b.dataset.scope; save(); pick(); }
  else if(b.dataset.mkset){ RP.mkset=S.rmkset=b.dataset.mkset; save(); pick(); }
  else if('again' in b.dataset){ RP.editing=false; pick(); }
  else if('read' in b.dataset){ const x=RP.cur.bible; closeSheets(); go(x.b,x.c); }
  else if('editc' in b.dataset){ RP.editing=true; renderRand(); $('#cnt').focus(); }
  else if('setc' in b.dataset){
    const n=Math.round(+$('#cnt').value); if(!(n>=1&&n<=400)) return toast('Enter the number of chapters, from 1 to 400');
    const x=RP.cur.mk, t=MAKARIOS[x.i][0]; READ.counts[t]=n; RP.editing=false;
    if(!x.c||x.c>n){ x.c=1+rnd(n); const h=[...READ.hist].reverse().find(h=>h.k==='m'&&h.t===t); if(h) h.c=x.c; }
    saveReading(); renderRand();
  }
};
$('#randp').addEventListener('keydown',e=>{ if(e.key==='Enter'&&e.target.id==='cnt') $('#randp [data-setc]').click(); });
$('#theme').onclick=()=>{ const i=THEMES.findIndex(t=>t[0]===S.theme); S.theme=THEMES[(i+1)%THEMES.length][0]; syncControls(); save();};
// Glass is a light look: 'glass' always, 'autoglass' only while the system is light (it goes to the dark theme at night).
function applyTheme(){
  const th=S.theme, root=document.documentElement;
  if(th==='auto'||th==='autoglass') root.removeAttribute('data-theme'); else root.setAttribute('data-theme',th==='glass'?'light':th);
  applyCustom(th==='custom');
  if(S.glass&&S.glass!=='blue') root.setAttribute('data-glass',S.glass); else root.removeAttribute('data-glass');
  root.classList.toggle('glass',th==='glass'||(th==='autoglass'&&!matchMedia('(prefers-color-scheme:dark)').matches));
}
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>applyTheme());
// The toolbar slides away while reading down the page and returns when scrolling up.
{ let last=0; $('#scroll').addEventListener('scroll',()=>{
    const y=$('#scroll').scrollTop, bar=$('#bar'), d=y-last; last=y;
    if(document.querySelector('.sheet.open')||y<60) return bar.style.marginTop='0px';
    if(d>6) bar.style.marginTop=-bar.offsetHeight+'px'; else if(d<-6) bar.style.marginTop='0px';
  },{passive:true}); }
$('#info').onclick=()=>$('#modal').classList.add('open');
$('#closeModal').onclick=()=>$('#modal').classList.remove('open');
$('#modal').onclick=e=>{if(e.target.id==='modal') $('#modal').classList.remove('open');};

// Strong's popover
async function showPop(ids,anchor,pick){
  const id=pick||ids[0];
  const L=await lex(); const d=L[id]; const pop=$('#pop');
  const count=countStrongs(id);
  const lang=id[0]==='H'?'Hebrew':'Greek';
  const word=anchor.textContent.trim();
  const tabs=ids.length>1?`<div class="ids">${ids.map(x=>`<button data-id="${x}" class="${x===id?'on':''}">${x[0]==='H'?'Hebrew':'Greek'} ${x.slice(1)}</button>`).join('')}</div>`:'';
  pop.innerHTML=`<div class="wd serif">“${esc(word)}”</div>${tabs}`+(d?`<div class="num">${lang} ${id.slice(1)}</div>
    <div class="lem" ${id[0]==='H'?'dir="rtl" style="text-align:left"':''}>${esc(d[0])}</div>
    <div class="xl">${esc(d[1])}${d[2]?' <span style="opacity:.7">('+esc(d[2])+')</span>':''}</div>
    ${d[3]?`<div class="df">${esc(d[3])}</div>`:''}
    ${d[4]?`<div class="lb">Translated in the KJV as</div><div class="kd">${esc(d[4])}</div>`:''}
    ${d[5]?`<div class="lb">Origin</div><div class="kd">${esc(d[5])}</div>`:''}
    <div class="ft"><button id="findS">Show all ${count.toLocaleString()} verses</button><button id="closeP" style="color:var(--muted)">Close</button></div>`
    :`<div class="num">${id}</div><div class="df">No dictionary entry for this number.</div>`);
  const r=anchor.getClientRects()[0]||anchor.getBoundingClientRect(); pop.classList.add('open');
  const w=pop.offsetWidth, h=pop.offsetHeight;
  let x=Math.min(Math.max(12,r.left-w/2+r.width/2),innerWidth-w-12), y=r.bottom+8;
  if(y+h>innerHeight-12) y=Math.max(12,r.top-h-8);
  pop.style.left=x+'px'; pop.style.top=y+'px';
  pop.querySelectorAll('[data-id]').forEach(b=>b.onclick=e=>{e.stopPropagation(); showPop(ids,anchor,b.dataset.id);});
  const f=$('#findS'); if(f) f.onclick=()=>{closePop(); strongsSearch(id);};
  const c=$('#closeP'); if(c) c.onclick=closePop;
}
function closePop(){$('#pop').classList.remove('open');}
document.addEventListener('click',e=>{ if(!e.isTrusted) return; if(!e.target.closest('#pop')&&!e.target.closest('.w')) closePop(); if(!phone()&&!e.target.closest('.sheet')&&!e.target.closest('#gear')&&!e.target.closest('#rand')&&!e.target.closest('#verb')&&!e.target.closest('#ref')&&!e.target.closest('#menu')) closeSheets(); });
function countStrongs(id){ const tag='['+id+']'; let n=0; for(const b of DATA[SV()]) for(const c of b) for(const v of c) if(v.includes(tag)) n++; return n; }

// Search
function header(title,sub,back){return `<div class="rh"><h2>${title}</h2><p>${sub}</p></div>`;}
function resultsHTML(list,o,labelV){
  return list.map(([b,c,v,html])=>`<div class="res" data-b="${b}" data-c="${c}" data-v="${v}"><div class="rr">${NAMES[b]} ${c+1}:${v+1}${labelV?' · '+labelV:''}</div><div class="rt">${html}</div></div>`).join('');
}
async function strongsSearch(id){
  const sv=SV(); await load(sv); const tag='['+id+']'; const out=[]; const o={strongs:true,god:S.god&&MARKED.has(sv),hl:id};
  DATA[sv].forEach((bk,b)=>bk.forEach((ch,c)=>ch.forEach((s,v)=>{ if(s.includes(tag)){ const r=render(s,o); if(!o.god||new RegExp('data-s="[^"]*\\b'+id+'\\b').test(r.html)) out.push([b,c,v,r.html]); } })));
  searchMode={type:'s',id};
  const L=await lex(); const d=L[id];
  const cap=out.slice(0,600);
  $('#col').innerHTML=header(`${id[0]==='H'?'Hebrew':'Greek'} ${id.slice(1)}${d?' <span class="serif" style="font-weight:400;color:var(--muted)">'+esc(d[0])+'</span>':''}`,
    `${out.length.toLocaleString()} verses in the ${VN[sv]}${o.god?' within God’s words':''}${out.length>cap.length?', first 600 shown':''}. Tap a verse to open it.`)+resultsHTML(cap,o,VN[sv]);
  $('#col').classList.remove('wide'); $('#reft').textContent=`Strong’s ${id}`; $('#scroll').scrollTop=0; buildBooks(); syncControls();
}
async function textSearch(q){
  const v=S.v; await load(v);
  if(!PLAIN[v]){PLAIN[v]=[]; DATA[v].forEach((bk,b)=>bk.forEach((ch,c)=>ch.forEach((s,i)=>PLAIN[v].push([b,c,i,plain(s).toLowerCase()]))));}
  const terms=q.toLowerCase().split(/\s+/).filter(Boolean);
  const re=new RegExp('('+terms.map(t=>t.replace(/[.*+?^${}()|[\]\\]/g,'\\$&')).join('|')+')','gi');
  const out=[]; const o={...opts(),q:re}; if(S.sgod&&MARKED.has(v)) o.god=true; const phrase=q.toLowerCase().replace(/\s+/g,' ');
  const ordered=terms.length>1?[...PLAIN[v].filter(x=>x[3].includes(phrase)),...PLAIN[v].filter(x=>!x[3].includes(phrase))]:PLAIN[v];
  for(const [b,c,i,p] of ordered){
    if(!inScope(b)||!terms.every(t=>p.includes(t))) continue;
    const r=render(DATA[v][b][c][i],o);
    if(o.god){ if(!r.has) continue; const txt=r.html.replace(/<[^>]+>/g,'').toLowerCase(); if(!terms.every(t=>txt.includes(t))) continue; }
    out.push([b,c,i,r.html]); if(out.length>=1500) break;
  }
  searchMode={type:'t',q};
  const cap=out.slice(0,400);
  $('#col').innerHTML=header(`“${esc(q)}”`, out.length?`${out.length>=1500?'1,500+':out.length.toLocaleString()} verses in the ${v.toUpperCase()}${o.god?' within God’s words':''}${out.length>cap.length?', first 400 shown':''}.`:`No verses in the ${v.toUpperCase()} contain every word. Try fewer words, or switch version.`)+searchChips()+resultsHTML(cap,o);
  $('#col').classList.remove('wide'); $('#reft').textContent='Search'; $('#scroll').scrollTop=0; buildBooks(); syncControls();
}
function rerunSearch(){ if(!searchMode) return draw(); if(searchMode.type==='bm') return showBookmarks(); if(searchMode.type==='m') return showMarks(searchMode.f); searchMode.type==='s'?strongsSearch(searchMode.id):textSearch(searchMode.q); }
function parseRef(q){
  const m=q.trim().toLowerCase().match(/^([1-3]?\s*[a-z]+(?:\s+of\s+[a-z]+)?)\.?\s*(\d+)?(?:\s*[:.\s]\s*(\d+))?\s*$/);
  if(!m) return null;
  const key=m[1].replace(/\s+/g,''); let b=ALIAS[key];
  if(b==null){ b=NAMES.findIndex(n=>n.toLowerCase().replace(/\s+/g,'')===key); }
  if(b<0||b==null){ if(key.length<3&&!/^\d/.test(key)) return null; b=NAMES.findIndex(n=>n.toLowerCase().replace(/\s+/g,'').startsWith(key)); }
  if(b<0) return null;
  if(!m[2]&&key.length<3) return null;
  const c=Math.max(0,Math.min((+m[2]||1)-1,DATA[S.v][b].length-1));
  return [b,c,m[3]?+m[3]:0];
}
$('#q').addEventListener('keydown',e=>{
  if(e.key==='Enter'){
    const q=e.target.value.trim(); if(!q) return;
    const s=q.match(/^([HGhg])\s?(\d{1,5})$/); if(s){closeSheets(); strongsSearch(s[1].toUpperCase()+(+s[2])); return;}
    const r=parseRef(q); if(r){ e.target.value=''; closeSheets(); go(r[0],r[1],r[2]); e.target.blur(); return; }
    closeSheets(); textSearch(q);
  } else if(e.key==='Escape'){ e.target.value=''; e.target.blur(); if(searchMode) draw(); }
});
document.addEventListener('keydown',e=>{
  if($('#epr').classList.contains('open')&&!(e.metaKey||e.ctrlKey)){
    const n=(EPCUR.list==='ch'&&EPCUR.e.ch.length?EPCUR.e.ch:EPCUR.e.toc).length;
    if(e.key==='Escape') $('#epr [data-epx]').click(); else if(e.key==='ArrowRight'&&EPCUR.c<n){ EPCUR.c++; epShow(); } else if(e.key==='ArrowLeft'&&EPCUR.c>1){ EPCUR.c--; epShow(); }
    return;
  }
  if($('#memo').classList.contains('open')){ if(e.key==='Escape') $('#memo').classList.remove('open'); return; }
  if($('#shuf').classList.contains('open')&&!(e.metaKey||e.ctrlKey)){
    if(e.key==='Escape') shufClose(); else if(e.key==='ArrowRight'||e.key==='Enter') shufNext(); else if(e.key==='ArrowLeft') shufPrev(); else if(e.key===' '){ e.preventDefault(); shufPause(); }
    shufWake(); return;
  }
  if((e.metaKey||e.ctrlKey)&&e.key.toLowerCase()==='k'){e.preventDefault(); openNav(true); return;}
  if(e.target.matches&&e.target.matches('input,textarea,select')) return;
  if(e.key==='Escape'){ closePop(); closeSheets(); $('#modal').classList.remove('open'); if($('#bodyg').classList.contains('withpanel')) closePanel(); else if(searchMode) draw(); }
  if(e.metaKey||e.ctrlKey||e.altKey) return;
  if(e.key==='ArrowRight') $('#next').click();
  if(e.key==='ArrowLeft') $('#prev').click();
});
if(!/Mac/.test(navigator.platform)) $('#qk').textContent='Ctrl K';

// ---------- Side by side ----------
function seg2(){ return '<span class="seg sm">'+Object.keys(VN).filter(v=>v!==S.v).map(v=>`<button data-v2="${v}" class="${v===S.v2?'on':''}">${VN[v]}</button>`).join('')+'</span>'; }
$('#t-par').onclick=async()=>{ S.par=!S.par; if(S.par){ if(S.v2===S.v) S.v2=Object.keys(VN).find(v=>v!==S.v); await load(S.v2);} const t=firstVisibleVerse(); searchMode?rerunSearch():draw(t>1?t:0); };

// ---------- Highlights & notes ----------
const COLORS=[['y','Yellow','#ffd60a'],['g','Green','#34c759'],['b','Blue','#0a84ff'],['p','Pink','#ff375f'],['v','Purple','#af52de']];
const mkey=(b,c,v)=>`m-${b}.${c}.${v}`;
let MARKS={}, MSTORE=null;
function localMarks(){ return store.get('marks',{}); }
function applyMarks(){
  if(oneMode()&&$('#one')) return draw(ONE);
  if(searchMode&&searchMode.type==='m') return showMarks(searchMode.f);
  document.querySelectorAll('#verses .v').forEach(el=>{
    const n=+el.dataset.n, mk=MARKS[mkey(S.b,S.c+1,n)];
    el.className=el.className.replace(/\bc-\w\b/g,'').trim(); if(mk&&mk.color) el.classList.add('c-'+mk.color);
    const nn=el.querySelector('.n'); const dot=nn.querySelector('.nd');
    if(mk&&mk.note&&!dot) nn.insertAdjacentHTML('beforeend','<i class="nd" title="Has a note"></i>'); else if(!(mk&&mk.note)&&dot) dot.remove();
  });
}
async function initMarks(){
  MARKS=localMarks(); applyMarks();
  try{
    if(!window.claude||!window.claude.use) return;
    const [user,db]=await Promise.all([claude.use('user'),claude.use('db')]);
    const uid=user&&await user.id(); if(!db||!uid) return;
    const col=db.collection('data/users/'+uid);
    MSTORE=col;
    // move any marks saved in this browser into your account once
    const local=localMarks(); const keys=Object.keys(local);
    col.onSnapshot(snap=>{
      const m={}; snap.docs.forEach(d=>{ if(d.id.startsWith('m-')) m[d.id]={...d.data()}; else if(d.id==='x-plan'){ PLAN=d.data().gone?null:d.data(); store.set('plan',PLAN); } else if(d.id==='x-reading'){ READ=Object.assign({counts:{},hist:[]},d.data()); store.set('reading',READ); } });
      MARKS=m; applyMarks();
      if(keys.length){ const ks=keys.splice(0); ks.forEach(k=>{ if(!m[k]) col.doc(k).set(local[k]).catch(()=>{}); }); store.set('marks',{}); }
    },()=>{ MSTORE=null; });
  }catch(e){ MSTORE=null; }
}
async function setMark(b,c,v,patch){
  const k=mkey(b,c,v); const cur={b,c,v,color:'',note:'',...(MARKS[k]||{}),...patch,t:Date.now()};
  const empty=!cur.color&&!cur.note.trim();
  if(empty) delete MARKS[k]; else MARKS[k]=cur;
  applyMarks();
  if(MSTORE){ try{ empty?await MSTORE.doc(k).delete():await MSTORE.doc(k).set(cur); return true; }catch(e){ toast('Couldn’t save. Check your connection and try again.'); return false; } }
  const L=localMarks(); if(empty) delete L[k]; else L[k]=cur; store.set('marks',L); syncPut(k,empty?null:cur); return true;
}
function showMarks(f){
  f=f||'all'; searchMode={type:'m',f}; closePanel(false);
  const list=Object.values(MARKS).filter(m=>f==='all'||(f==='note'?m.note:m.color===f)).sort((a,b)=>a.b-b.b||a.c-b.c||a.v-b.v);
  const o={...opts(),god:false};
  const pills=[['all','All',''],...COLORS.map(c=>[c[0],c[1],c[2]]),['note','With notes','']].map(([k,l,col])=>`<button data-fc="${k}" class="${f===k?'on':''}">${col?`<i style="background:${col}"></i>`:''}${l}</button>`).join('');
  const rows=list.map(m=>{ const s=(DATA[S.v][m.b]||[])[m.c-1]?.[m.v-1]||''; const r=render(s,o);
    return `<div class="res${m.color?' c-'+m.color:''}" data-b="${m.b}" data-c="${m.c-1}" data-v="${m.v-1}"><div class="rr">${NAMES[m.b]} ${m.c}:${m.v}</div><div class="rt"><span class="${''}">${r.html}</span></div>${m.note?`<div class="nt">${esc(m.note)}</div>`:''}</div>`;}).join('');
  $('#col').classList.remove('wide');
  $('#col').innerHTML=header('Highlights and notes', list.length?`${list.length} ${list.length===1?'verse':'verses'}. Tap one to open it.`:(Object.keys(MARKS).length?'Nothing matches this filter.':'Click any verse while reading to highlight it or add a note.'))+`<div class="fl">${pills}</div>`+rows;
  $('#reft').textContent='Highlights and notes'; $('#scroll').scrollTop=0; buildBooks(); syncControls();
}
$('#marks').onclick=()=>showMarks('all');

// ---------- Verse panel ----------
async function xrefs(){ if(!XREF) XREF=await unpack('xref'); return XREF; }
function parseX(t){ const m=t.match(/^(\d+)\.(\d+)\.(\d+)(?:-(?:(\d+)\.)?(\d+))?$/); if(!m) return null; const b=+m[1],c=+m[2],v=+m[3]; const c2=m[4]?+m[4]:c, v2=m[5]?+m[5]:v; return {b,c,v,c2,v2,label:`${NAMES[b]} ${c}:${v}`+(m[5]?(c2!==c?`–${c2}:${v2}`:`–${v2}`):'')}; }
function refText(b,c,v){ return plain(((DATA[S.v][b]||[])[c-1]||[])[v-1]||''); }
let noteTimer=null;
async function openPanel(n){
  SELV=n; document.querySelectorAll('#verses .v.sel').forEach(x=>x.classList.remove('sel')); const el=document.getElementById('v'+n); el&&el.classList.add('sel');
  $('#bodyg').classList.add('withpanel');
  const b=S.b,c=S.c+1, mk=MARKS[mkey(b,c,n)]||{};
  const txt=refText(b,c,n);
  const p=$('#panel');
  p.innerHTML=`<div class="pn">
    <div class="top"><h3>${NAMES[b]} ${c}:${n}</h3><button class="ib" id="pclose" title="Close (Esc)" aria-label="Close"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg></button></div>
    <div class="vt serif">${esc(txt)}</div>
    <div class="lb">Highlight</div>
    <div class="sw6">${COLORS.map(([k,l,col])=>`<button data-col="${k}" title="${l}" aria-label="${l}" style="background:${col}" class="${mk.color===k?'on':''}"></button>`).join('')}<button class="x${!mk.color?' on':''}" data-col="" title="No highlight" aria-label="No highlight">✕</button></div>
    <div class="lb">Note</div>
    <textarea id="note" placeholder="Write a note on this verse">${esc(mk.note||'')}</textarea>
    <div class="saved" id="saved"></div>
    <div class="acts"><button class="pill" id="bmv">${bmIndex(b,c,n)>=0?'Bookmarked ✓':'Bookmark'}</button><button class="pill" id="memv">Memorise</button><button class="pill" id="copyv">Copy</button><a class="pill" href="${nkjvURL(b,c,n)}" target="_blank" rel="noopener">NKJV ↗</a></div>
    <div class="lb">Other versions</div>
    <div id="cmp"><span class="mute">Loading…</span></div>
    <div class="lb">Cross references</div>
    <div id="xr"><span style="font-size:13px;color:var(--muted)">Loading…</span></div>
  </div>`;
  $('#pclose').onclick=()=>closePanel();
  p.querySelectorAll('[data-col]').forEach(bt=>bt.onclick=async()=>{ await setMark(b,c,n,{color:bt.dataset.col}); p.querySelectorAll('[data-col]').forEach(x=>x.classList.toggle('on',x===bt)); });
  $('#note').oninput=e=>{ clearTimeout(noteTimer); $('#saved').textContent=''; const val=e.target.value; noteTimer=setTimeout(async()=>{ if(await setMark(b,c,n,{note:val})) $('#saved').textContent='Saved'; },600); };
  $('#copyv').onclick=()=>copyText(`“${txt}” ${NAMES[b]} ${c}:${n} (${VN[S.v]})`);
  $('#bmv').onclick=()=>{ const on=toggleBookmark(b,c,n); $('#bmv').textContent=on?'Bookmarked ✓':'Bookmark'; toast(on?'Bookmarked':'Bookmark removed'); };
  $('#memv').onclick=()=>memoOpen(b,c,n);
  fillCompare(b,c,n);
  const X=await xrefs(); if(SELV!==n||S.b!==b) return;
  const list=((X[b]||[])[c-1]||[])[n-1]||'';
  const items=list?list.split(' ').map(parseX).filter(Boolean):[];
  $('#xr').innerHTML=items.length?items.map(x=>{ let t=refText(x.b,x.c,x.v); if(t.length>130) t=t.slice(0,127).replace(/\s+\S*$/,'')+'…'; return `<button class="xr" data-xb="${x.b}" data-xc="${x.c}" data-xv="${x.v}"><b>${x.label}</b><span>${esc(t)}</span></button>`; }).join(''):'<span style="font-size:13px;color:var(--muted)">No cross references for this verse.</span>';
  $('#xr').onclick=e=>{ const x=e.target.closest('.xr'); if(x) go(+x.dataset.xb,+x.dataset.xc-1,+x.dataset.xv); };
}
function closePanel(redraw){ $('#bodyg').classList.remove('withpanel'); SELV=0; document.querySelectorAll('#verses .v.sel').forEach(x=>x.classList.remove('sel')); }
function toast(m){ const t=$('#toast'); t.textContent=m; t.style.display='block'; clearTimeout(toast.t); toast.t=setTimeout(()=>t.style.display='none',1800); }
async function copyText(s){
  try{ await navigator.clipboard.writeText(s); toast('Copied'); return; }catch(e){}
  const ta=document.createElement('textarea'); ta.value=s; ta.style.position='fixed'; ta.style.opacity='0'; document.body.appendChild(ta); ta.select();
  try{ document.execCommand('copy'); toast('Copied'); }catch(e){ toast('Copy isn’t allowed here. Select the text and press ⌘C.'); } ta.remove();
}


// ---------- Verse shuffle (like Stobite TV): a random verse full screen, a new one every few seconds ----------
// Uses the current version; with God's words only on, it picks only words spoken by God. Keeps the screen awake.
const SHUF={hist:[],i:-1,timer:0,paused:false,lock:null,idle:0,swiped:false};
const SHUF_EVERY=[15,30,60,120,300];
const shufEvery=()=>SHUF_EVERY.includes(S.shufEvery)?S.shufEvery:60;
const shufLabel=n=>n<60?n+'s':(n/60)+' min';
function shufPick(){
  const D=DATA[S.v], G=godOn();
  for(let t=0;t<300;t++){
    const b=rnd(66), c=rnd(D[b].length||1), v=rnd((D[b][c]||[]).length||1), x=(D[b][c]||[])[v];
    if(!x) continue;
    if(G){ if(!/[{«]/.test(x)) continue; const r=render(x,{god:true}), len=r.html.replace(/<[^>]+>/g,'').length; if(len<25||len>360) continue; return {b,c,v,html:r.html}; }
    const len=plain(x).length; if(len<40||len>320) continue;
    return {b,c,v,html:render(x,{god:false,strongs:false}).html};
  }
  return null;
}
function shufShow(){
  const x=SHUF.hist[SHUF.i]; if(!x) return;
  const fig=$('#shuf .sfig'); fig.classList.remove('in'); void fig.offsetWidth; fig.classList.add('in');
  $('#shq').innerHTML=x.html; $('#shr').textContent=`${NAMES[x.b]} ${x.c+1}:${x.v+1} · ${VN[S.v]}`;
  shufTimer();
}
function shufTimer(){
  clearTimeout(SHUF.timer); const bar=$('#shi'); bar.classList.remove('run'); void bar.offsetWidth;
  if(SHUF.paused){ bar.style.width='0'; return; }
  bar.style.width=''; bar.style.animationDuration=shufEvery()+'s'; bar.classList.add('run');
  SHUF.timer=setTimeout(shufNext,shufEvery()*1000);
}
function shufNext(){ if(SHUF.i<SHUF.hist.length-1) SHUF.i++; else { const x=shufPick(); if(!x) return; SHUF.hist.push(x); if(SHUF.hist.length>200){ SHUF.hist.shift(); } SHUF.i=SHUF.hist.length-1; } shufShow(); }
function shufPrev(){ if(SHUF.i>0){ SHUF.i--; shufShow(); } }
function shufPause(){ SHUF.paused=!SHUF.paused; shufTimer(); shufCtl(); }
function shufCtl(){
  const I={prev:'<path d="m12.5 4.5-5.5 5.5 5.5 5.5"/>',next:'<path d="m7.5 4.5 5.5 5.5-5.5 5.5"/>',pause:'<path d="M7 4.5v11M13 4.5v11"/>',play:'<path d="M6.5 4.5v11l9-5.5z" fill="currentColor"/>',full:'<path d="M3.5 7.5v-4h4M16.5 7.5v-4h-4M3.5 12.5v4h4M16.5 12.5v4h-4"/>',close:'<path d="m5.5 5.5 9 9m0-9-9 9"/>'};
  const ic=k=>`<svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round">${I[k]}</svg>`;
  $('#shctl').innerHTML=`<button data-s="prev" title="Previous (←)" aria-label="Previous verse">${ic('prev')}</button>
    <button data-s="pause" title="${SHUF.paused?'Play':'Pause'} (space)" aria-label="${SHUF.paused?'Play':'Pause'}">${ic(SHUF.paused?'play':'pause')}</button>
    <button data-s="next" title="Next (→)" aria-label="Next verse">${ic('next')}</button><i class="sep"></i>
    <button data-s="every" title="Time on each verse">${shufLabel(shufEvery())}</button>
    <button data-s="open" title="Open this chapter">Open</button>
    ${document.fullscreenEnabled?`<button data-s="full" title="Full screen" aria-label="Full screen">${ic('full')}</button>`:''}
    <button data-s="close" title="Close (Esc)" aria-label="Close">${ic('close')}</button>`;
}
function shufWake(){ const el=$('#shuf'); el.classList.remove('idle'); clearTimeout(SHUF.idle); SHUF.idle=setTimeout(()=>el.classList.add('idle'),3000); }
async function shufLock(){ try{ if(navigator.wakeLock&&document.visibilityState==='visible') SHUF.lock=await navigator.wakeLock.request('screen'); }catch(e){} }
function shufOpen(){
  closeSheets(); closePop(); SHUF.paused=false; shufCtl();
  $('#shuf').classList.add('open'); document.body.classList.add('shuf-open'); shufWake(); shufLock();
  shufNext();
}
function shufClose(){
  clearTimeout(SHUF.timer); clearTimeout(SHUF.idle); $('#shuf').classList.remove('open'); document.body.classList.remove('shuf-open');
  try{ SHUF.lock&&SHUF.lock.release(); }catch(e){} SHUF.lock=null;
  if(document.fullscreenElement) document.exitFullscreen().catch(()=>{});
}
$('#shuf').addEventListener('click',e=>{
  e.stopPropagation(); shufWake(); if(SHUF.swiped){ SHUF.swiped=false; return; }
  const b=e.target.closest('#shctl button');
  if(!b){ if(!e.target.closest('#shctl')) shufNext(); return; }
  const k=b.dataset.s;
  if(k==='prev') shufPrev(); else if(k==='next') shufNext(); else if(k==='pause') shufPause();
  else if(k==='every'){ const i=SHUF_EVERY.indexOf(shufEvery()); S.shufEvery=SHUF_EVERY[(i+1)%SHUF_EVERY.length]; save(); shufCtl(); shufTimer(); }
  else if(k==='open'){ const x=SHUF.hist[SHUF.i]; shufClose(); if(x) go(x.b,x.c,x.v+1); }
  else if(k==='full'){ document.fullscreenElement?document.exitFullscreen():$('#shuf').requestFullscreen().catch(()=>{}); }
  else if(k==='close') shufClose();
});
$('#shuf').addEventListener('mousemove',shufWake);
{ let x0=null,y0=0; $('#shuf').addEventListener('touchstart',e=>{ shufWake(); const t=e.touches[0]; x0=t.clientX; y0=t.clientY; },{passive:true});
  $('#shuf').addEventListener('touchend',e=>{ if(x0==null) return; const t=e.changedTouches[0], dx=t.clientX-x0, dy=t.clientY-y0; x0=null;
    if(Math.abs(dx)>60&&Math.abs(dy)<60){ SHUF.swiped=true; dx<0?shufNext():shufPrev(); } },{passive:true}); }
document.addEventListener('visibilitychange',()=>{ if($('#shuf').classList.contains('open')&&document.visibilityState==='visible') shufLock(); });

// ---------- Reading plan ----------
// Pick a start chapter, an end chapter and a finish date; the app works out what to read each day.
// Each day's reading is balanced by length (verses), re-calculated from what is still unread, and frozen for the day
// (PLAN.today) so ticking chapters off doesn't hand you more. Saved with highlights (db doc "x-plan"), plus localStorage.
let PLAN=store.get('plan',null), PLANVIEW='main', PLANDRAFT=null;
const VD=()=>DATA.kjv||DATA[S.v];
const ymd=d=>`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
const parseYmd=t=>{ const [y,m,d]=t.split('-').map(Number); return new Date(y,m-1,d,12); };
const DAYN=['Sun','Mon','Tue','Wed','Thu','Fri','Sat'];
const dayLabel=t=>parseYmd(t).toLocaleDateString(undefined,{weekday:'short',day:'numeric',month:'short'});
const dayLong=t=>parseYmd(t).toLocaleDateString(undefined,{weekday:'long',day:'numeric',month:'long'});
function savePlan(){ store.set('plan',PLAN); if(MSTORE) MSTORE.doc('x-plan').set(PLAN||{gone:true}).catch(()=>{}); else syncPut('x-plan',PLAN); }
const chKey=(b,c)=>b+'.'+c;
const chW=(b,c)=>(VD()[b][c]||[]).length||1;
function planChapters(P){
  const out=[], [b0,c0]=P.from, [b1,c1]=P.to; if(b0>b1||(b0===b1&&c0>c1)) return out;
  for(let b=b0;b<=b1;b++){ const n=VD()[b].length; for(let c=(b===b0?c0:0);c<(b===b1?c1+1:n);c++) out.push([b,c]); }
  return out;
}
function readDays(P,from){
  const end=parseYmd(P.end), out=[];
  for(let d=parseYmd(from);d<=end;d.setDate(d.getDate()+1)) if(!(P.off||[]).includes(d.getDay())) out.push(ymd(d));
  return out;
}
// Greedy even split: each day takes chapters until it is as close to "remaining ÷ days left" as it can get.
function planSchedule(P,from,skip){
  const days=readDays(P,from);
  let rem=planChapters(P).filter(([b,c])=>!P.done[chKey(b,c)]&&!(skip&&skip.has(chKey(b,c))));
  let wsum=rem.reduce((a,[b,c])=>a+chW(b,c),0); const sched=[];
  for(let i=0;i<days.length&&rem.length;i++){
    const left=days.length-i, share=wsum/left; let acc=0; const take=[];
    while(rem.length){
      const w=chW(rem[0][0],rem[0][1]);
      if(left>1&&take.length&&Math.abs(acc+w-share)>Math.abs(acc-share)) break;
      take.push(rem.shift()); acc+=w;
    }
    wsum-=acc; sched.push({date:days[i],ch:take});
  }
  return {days,sched,left:rem.length};
}
function ensureToday(){
  if(!PLAN) return; const t=ymd(new Date()); if(PLAN.today&&PLAN.today.date===t) return;
  const r=planSchedule(PLAN,t); const row=r.days[0]===t&&r.sched[0]?r.sched[0].ch:[];
  PLAN.today={date:t,ch:row.map(([b,c])=>chKey(b,c))}; savePlan();
}
function fmtCh(list){
  const gs=[]; for(const [b,c] of list){ const g=gs[gs.length-1]; if(g&&g.b===b&&c===g.to+1) g.to=c; else gs.push({b,from:c,to:c}); }
  return gs.map(g=>{ const n=NAMES[g.b]; if(VD()[g.b].length===1) return n; return g.from===g.to?`${n} ${g.from+1}`:`${n} ${g.from+1}–${g.to+1}`; }).join(', ');
}
function chStats(list){
  let v=0,w=0; for(const [b,c] of list){ const ch=VD()[b][c]||[]; v+=ch.length; for(const x of ch) w+=plain(x).split(' ').length; }
  return {verses:v,mins:Math.max(1,Math.round(w/200))};
}
const inPlan=(b,c)=>{ if(!PLAN) return false; return planChapters(PLAN).some(([x,y])=>x===b&&y===c); };
function planBtn(){
  if(!PLAN||!inPlan(S.b,S.c)) return '';
  return PLAN.done[chKey(S.b,S.c)]?`<button class="pill" data-planread title="Tap to undo">Read ✓</button>`:`<button class="pill" data-planread>Mark as read</button>`;
}
function planProgress(){ const all=planChapters(PLAN), n=all.filter(([b,c])=>PLAN.done[chKey(b,c)]).length; return {n,total:all.length,pct:all.length?Math.round(100*n/all.length):0}; }
function planMenuLabel(){
  if(!PLAN) return ''; ensureToday(); const ch=PLAN.today.ch.map(k=>k.split('.').map(Number)), left=ch.filter(([b,c])=>!PLAN.done[chKey(b,c)]);
  return !ch.length?'Rest day':left.length?fmtCh(left):'Done today';
}

function planSetupHTML(){
  const d=PLANDRAFT, opt=sel=>NAMES.map((n,k)=>`<option value="${k}"${k===sel?' selected':''}>${n}</option>`).join('');
  const chOpt=(b,sel)=>Array.from({length:VD()[b].length},(_,c)=>`<option value="${c}"${c===sel?' selected':''}>${c+1}</option>`).join('');
  return `<div class="ph"><h3>${PLAN?'Edit plan':'New reading plan'}</h3><button class="ib" data-pclose aria-label="Close"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg></button></div>
    <div class="pl">Start reading at</div>
    <div class="prow"><select id="pf-b">${opt(d.from[0])}</select><select id="pf-c">${chOpt(d.from[0],d.from[1])}</select></div>
    <div class="pl">Finish reading at</div>
    <div class="prow"><select id="pt-b">${opt(d.to[0])}</select><select id="pt-c">${chOpt(d.to[0],d.to[1])}</select></div>
    <div class="pchips" style="margin-top:8px">${[['Whole Bible',[0,0],[65,21]],['Old Testament',[0,0],[38,3]],['New Testament',[39,0],[65,21]],['Here to Revelation',[S.b,S.c],[65,21]]].map(([l,a,b])=>`<button class="pc" data-preset="${a.join(',')}|${b.join(',')}">${l}</button>`).join('')}</div>
    <div class="pl">Finish by</div>
    <input type="date" id="pend" value="${d.end}" min="${ymd(new Date())}">
    <div class="pl">Days off</div>
    <div class="pchips">${DAYN.map((n,i)=>`<button class="pc${d.off.includes(i)?' on':''}" data-off="${i}">${n}</button>`).join('')}</div>
    <div class="pprev" id="pprev"></div>
    <div class="pacts"><button class="pill" data-pcancel>${PLAN?'Cancel':'Close'}</button><button class="pill pri" data-psave>${PLAN?'Save plan':'Start plan'}</button></div>`;
}
function planDraftP(){ const d=PLANDRAFT; return {from:d.from,to:d.to,end:d.end,off:d.off,done:PLAN?PLAN.done:{}}; }
function planPreview(){
  const el=$('#pprev'); if(!el) return; const P=planDraftP(), all=planChapters(P);
  if(!all.length){ el.innerHTML='<span class="warn">The finish point comes before the start point.</span>'; return; }
  const r=planSchedule(P,ymd(new Date())); const nd=r.days.length;
  if(!nd){ el.innerHTML='<span class="warn">Pick a finish date that is today or later.</span>'; return; }
  const st=chStats(all), per=Math.ceil(all.length/nd), pm=Math.round(st.mins/nd);
  el.innerHTML=`<b>${all.length.toLocaleString()} chapters</b> in <b>${nd}</b> reading ${nd===1?'day':'days'}.<br>About <b>${per} ${per===1?'chapter':'chapters'}</b> a day, roughly <b>${pm>=60?Math.floor(pm/60)+' h '+(pm%60?pm%60+' min':''):pm+' min'}</b> of reading.`;
}
function planMainHTML(){
  ensureToday(); const t=ymd(new Date()), T=PLAN.today, today=T.ch.map(k=>k.split('.').map(Number));
  const done=today.filter(([b,c])=>PLAN.done[chKey(b,c)]), pg=planProgress();
  const tmr=(()=>{ const d=parseYmd(t); d.setDate(d.getDate()+1); return ymd(d); })();
  const fut=planSchedule(PLAN,tmr,new Set(T.ch));
  const left=planSchedule(PLAN,t).days.length;
  const st=chStats(today), ends=planChapters(PLAN);
  let h=`<div class="ph"><h3>Reading plan</h3><button class="ib" data-pclose aria-label="Close"><svg viewBox="0 0 20 20" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round"><path d="m5.5 5.5 9 9m0-9-9 9"/></svg></button></div>
    <div class="pcard"><div class="pk">Today · ${dayLabel(t)}</div>`;
  if(!today.length){
    h+=`<div class="pbig" style="font-size:22px">${pg.n===pg.total?'Plan finished':'Rest day'}</div><div class="psub">${fut.sched[0]?`Next: ${dayLabel(fut.sched[0].date)}, ${fmtCh(fut.sched[0].ch)}`:pg.n===pg.total?'You have read everything in this plan.':'Nothing scheduled.'}</div>`;
  } else {
    h+=`<div class="pbig${fmtCh(today).length>26?' long':''}">${fmtCh(today)}</div>
      <div class="psub">${today.length} ${today.length===1?'chapter':'chapters'} · ${st.verses} verses · about ${st.mins} min</div>
      <div class="pchs">${today.map(([b,c])=>`<div class="pch${PLAN.done[chKey(b,c)]?' on':''}"><button class="pck" data-tk="${chKey(b,c)}" aria-label="Mark ${NAMES[b]} ${c+1} read"><svg viewBox="0 0 12 12" fill="none" stroke="currentColor" stroke-width="2" stroke-linecap="round" stroke-linejoin="round"><path d="m2.5 6.5 2.3 2.3 4.7-5"/></svg></button><button class="plk" data-open="${chKey(b,c)}">${VD()[b].length===1?NAMES[b]:ABBR[b]+' '+(c+1)}</button></div>`).join('')}</div>
      ${done.length===today.length?`<div class="pdone">Today’s reading is complete.</div>`
        :`<div class="pacts" style="margin-top:12px"><button class="pill" data-markall>Mark all read</button><button class="pill pri" data-continue>${done.length?'Continue reading':'Start reading'}</button></div>`}`;
  }
  h+=`</div>
    <div class="pbar"><i style="width:${pg.pct}%"></i></div>
    <div class="pstat"><span><b>${pg.n.toLocaleString()}</b> of ${pg.total.toLocaleString()} chapters · ${pg.pct}%</span><span>${left} reading ${left===1?'day':'days'} left</span></div>
    <div class="pstat" style="margin-top:2px"><span>Finish by ${dayLong(PLAN.end)}</span><span>${fmtCh(ends.slice(0,1))} → ${fmtCh(ends.slice(-1))}</span></div>`;
  h+=planExtrasHTML(today,done,fut);
  if(fut.left>0&&fut.days.length===0&&left<=1&&today.length&&done.length<today.length) h+='';
  else if(fut.left>0&&fut.days.length===0) h+=`<div class="pwarn">The finish date is here and ${fut.left} chapters are still unread. Edit the plan to choose a new date.</div>`;
  const rows=fut.sched.map(x=>`<div class="prw"><span>${dayLabel(x.date)}</span><b>${fmtCh(x.ch)}</b><i>${x.ch.length} ch</i></div>`);
  if(rows.length) h+=`<div class="pl" style="margin-top:16px">Coming up</div><div class="psch">${rows.slice(0,5).join('')}</div>${rows.length>5?`<details class="pall"><summary>Show the full schedule (${rows.length} days)</summary><div class="psch">${rows.slice(5).join('')}</div></details>`:''}`;
  h+=`<div class="pacts" style="margin-top:16px"><button class="pill" data-pedit>Edit plan</button><button class="pill" data-pdel style="color:var(--red)">Delete plan</button></div>`;
  return h;
}
function renderPlan(){
  const el=$('#planp'), top=el.scrollTop;
  if(PLANVIEW==='setup'){ el.innerHTML=planSetupHTML(); planPreview(); } else el.innerHTML=planMainHTML();
  el.scrollTop=top;
}
function planDraftNew(){
  const now=new Date(), y=now.getFullYear(); let end=`${y}-12-31`; if(end<ymd(now)) end=`${y+1}-12-31`;
  return {from:[0,0],to:[65,21],end,off:[]};
}
function openPlan(){
  if(PLAN){ PLANVIEW='main'; } else { PLANVIEW='setup'; PLANDRAFT=planDraftNew(); }
  closeSheets(); renderPlan(); openSheet($('#planp'),null);
}
function toggleChapter(b,c,on){
  const k=chKey(b,c); if(on===undefined) on=!PLAN.done[k]; if(on) PLAN.done[k]=1; else delete PLAN.done[k]; savePlan();
}
$('#planp').onclick=e=>{
  e.stopPropagation(); const b=e.target.closest('button'); if(!b) return; const D=b.dataset;
  if(planExtrasClick(D)) return;
  if('pclose' in D) return closeSheets();
  if('pcancel' in D){ if(PLAN){ PLANVIEW='main'; renderPlan(); } else closeSheets(); return; }
  if('preset' in D){ const [a,z]=D.preset.split('|').map(x=>x.split(',').map(Number)); PLANDRAFT.from=a; PLANDRAFT.to=z; PLANVIEW='setup'; renderPlan(); return; }
  if('off' in D){ const i=+D.off, o=PLANDRAFT.off; PLANDRAFT.off=o.includes(i)?o.filter(x=>x!==i):[...o,i]; b.classList.toggle('on'); planPreview(); return; }
  if('psave' in D){
    const P=planDraftP(), all=planChapters(P);
    if(!all.length) return toast('The finish point must come after the start point');
    if(!planSchedule(P,ymd(new Date())).days.length) return toast('Pick a finish date that is today or later');
    PLAN={...P,done:PLAN?PLAN.done:{},today:null,created:PLAN?PLAN.created:ymd(new Date())}; savePlan(); PLANVIEW='main'; renderPlan(); return;
  }
  if('pedit' in D){ PLANDRAFT={from:PLAN.from,to:PLAN.to,end:PLAN.end,off:PLAN.off||[]}; PLANVIEW='setup'; renderPlan(); return; }
  if('pdel' in D){ if(confirm('Delete this reading plan? Your progress will be lost.')){ PLAN=null; savePlan(); PLANVIEW='setup'; PLANDRAFT=planDraftNew(); renderPlan(); } return; }
  if(D.tk){ const [x,y]=D.tk.split('.').map(Number); toggleChapter(x,y); renderPlan(); return; }
  if('markall' in D){ PLAN.today.ch.forEach(k=>PLAN.done[k]=1); savePlan(); renderPlan(); return; }
  if(D.open){ const [x,y]=D.open.split('.').map(Number); closeSheets(); go(x,y); return; }
  if('continue' in D){ const k=PLAN.today.ch.find(k=>!PLAN.done[k]); if(k){ const [x,y]=k.split('.').map(Number); closeSheets(); go(x,y); } return; }
};
$('#planp').addEventListener('change',e=>{
  const d=PLANDRAFT; if(!d) return; const id=e.target.id;
  if(id==='pf-b'||id==='pt-b'){ const sel=id==='pf-b'?'from':'to', b=+e.target.value; d[sel]=[b,id==='pt-b'?VD()[b].length-1:0]; const c=$(id==='pf-b'?'#pf-c':'#pt-c'); c.innerHTML=Array.from({length:VD()[b].length},(_,i)=>`<option value="${i}">${i+1}</option>`).join(''); c.value=d[sel][1]; }
  if(id==='pf-c') d.from[1]=+e.target.value;
  if(id==='pt-c') d.to[1]=+e.target.value;
  if(id==='pend'&&e.target.value) d.end=e.target.value;
  planPreview();
});
$('#col').addEventListener('click',e=>{
  const b=e.target.closest('[data-planread]'); if(!b||!PLAN) return;
  toggleChapter(S.b,S.c); const on=!!PLAN.done[chKey(S.b,S.c)];
  b.textContent=on?'Read ✓':'Mark as read';
  if(on&&PLAN.today){ const t=PLAN.today.ch; if(t.length&&t.every(k=>PLAN.done[k])&&t.includes(chKey(S.b,S.c))) toast('Today’s reading is complete'); else toast('Marked as read'); }
});

(async()=>{
  try{
    if(!('DecompressionStream' in window)) throw new Error('This browser is too old to open the Bible data. Update Safari or Chrome and reload.');
    await loadImports(); if(!VN[S.v]) S.v='kjv'; if(!VN[S.v2]) S.v2='bsb';
    await load(S.v); if(S.par) await load(S.v2); if(S.v!=='kjv') load('kjv');
    draw(); initMarks(); $('#loading').remove();
    if(syncOn()) setTimeout(()=>syncNow(),1500);
    if(window.MAC_APP) setTimeout(()=>epubIndex(),1200);
    setTimeout(()=>{lex(); xrefs(); Object.keys(VN).forEach(v=>load(v));},600);
  }catch(err){ $('#loading').innerHTML='<div style="max-width:320px;text-align:center;line-height:1.5">'+esc(err.message||String(err))+'</div>'; }
})();
