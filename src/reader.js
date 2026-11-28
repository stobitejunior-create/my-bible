// ===================== Library and book reader (EPUB and PDF) =====================
// Mac app: every book in Ben's iCloud Drive › Authors folder (bible://app/lib/…, see mac/Library.swift).
// Phone / browser: books added from the Files app, kept in this device's IndexedDB ("library").
// Reading position and bookmarks sync between devices (db docs "r-<key>", key = the book's file name), and the Mac
// shares its list of books ("lc-<n>") so the phone can show what's on the Mac.
// EPUBs are unzipped here (DecompressionStream) and laid out in pages with CSS columns inside an iframe; PDFs are
// drawn with Mozilla's pdf.js (vendor/pdfjs, loaded only when a PDF is opened).

// ---------- small helpers ----------
const rq=(s,el=document)=>el.querySelector(s);
const hash=s=>{ let h=0x811c9dc5; for(let i=0;i<s.length;i++){ h^=s.charCodeAt(i); h=Math.imul(h,0x01000193); } return (h>>>0).toString(36); };
const normT=s=>String(s||'').toLowerCase().replace(/[^\p{L}\p{N}]+/gu,'');
const bookKey=b=>hash(normT(b.f||b.t)+'|'+(b.k==='pdf'?'pdf':'book'));
const coverHue=b=>parseInt(hash(b.t+b.a).slice(-4),36)%360;   // from the original title, so a rename keeps the colour
const fileTitle=(name,author)=>{ let t=name.replace(/\.[^.]+$/,''); if(author&&t.toLowerCase().endsWith(' - '+author.toLowerCase())) t=t.slice(0,-(author.length+3)); else { const m=t.match(/^(.*) - ([^-]{3,40})$/); if(m&&!author){ t=m[1]; } } t=t.replace(/_ /g,': ').replace(/_/g,' '); if(/, The$/.test(t)) t='The '+t.slice(0,-5); return t.trim(); };
const fileAuthor=name=>{ const m=name.replace(/\.[^.]+$/,'').match(/ - ([^-]{3,40})$/); return m?m[1].trim():''; };
const MIME={xhtml:'application/xhtml+xml',html:'text/html',htm:'text/html',css:'text/css',jpg:'image/jpeg',jpeg:'image/jpeg',png:'image/png',gif:'image/gif',svg:'image/svg+xml',webp:'image/webp',ttf:'font/ttf',otf:'font/otf',woff:'font/woff',woff2:'font/woff2'};
const extOf=p=>(p.split('?')[0].split('.').pop()||'').toLowerCase();
function pjoin(dir,rel){
  if(/^[a-z]+:/i.test(rel)) return rel;
  const [path,frag]=rel.split('#'); let parts=(dir?dir+'/':'').concat((()=>{ try{ return decodeURIComponent(path||''); }catch(e){ return path||''; } })()).split('/'), out=[];
  for(const p of parts){ if(p==='..') out.pop(); else if(p&&p!=='.') out.push(p); }
  return out.join('/')+(frag!==undefined?'#'+frag:'');
}
const pdir=p=>p.includes('/')?p.slice(0,p.lastIndexOf('/')):'';

// ---------- ZIP (EPUB) ----------
async function zipOpen(buf){
  const dv=new DataView(buf), u8=new Uint8Array(buf), td=new TextDecoder();
  let e=buf.byteLength-22; const stop=Math.max(0,e-65557);
  while(e>=stop&&dv.getUint32(e,true)!==0x06054b50) e--;
  if(e<stop) throw new Error('This file isn’t a valid EPUB.');
  const n=dv.getUint16(e+10,true); let p=dv.getUint32(e+16,true); const files={}, lower={};
  for(let i=0;i<n;i++){
    if(dv.getUint32(p,true)!==0x02014b50) break;
    const method=dv.getUint16(p+10,true), csize=dv.getUint32(p+20,true), usize=dv.getUint32(p+24,true), nl=dv.getUint16(p+28,true), xl=dv.getUint16(p+30,true), cl=dv.getUint16(p+32,true), off=dv.getUint32(p+42,true);
    const name=td.decode(u8.subarray(p+46,p+46+nl)); files[name]={method,csize,usize,off}; lower[name.toLowerCase()]=name; p+=46+nl+xl+cl;
  }
  const find=name=>files[name]?name:lower[String(name).toLowerCase()];
  return {files, has:n=>!!find(n), size:n=>{ const k=find(n); return k?files[k].usize:0; },
    async bytes(name){
      const k=find(name); if(!k) return null; const f=files[k];
      const lo=f.off, start=lo+30+dv.getUint16(lo+26,true)+dv.getUint16(lo+28,true), raw=u8.subarray(start,start+f.csize);
      if(f.method===0) return raw;
      return new Uint8Array(await new Response(new Blob([raw]).stream().pipeThrough(new DecompressionStream('deflate-raw'))).arrayBuffer());
    },
    async text(name){ const b=await this.bytes(name); return b?new TextDecoder().decode(b):null; }};
}
function parseXML(s,type){
  let d=new DOMParser().parseFromString(s,type||'application/xml');
  if(d.querySelector('parsererror')) d=new DOMParser().parseFromString(s,'text/html');
  return d;
}
const byTag=(d,t)=>[...d.getElementsByTagNameNS('*',t)];

// The cover picture, found the ways publishers mark it: EPUB 3 "cover-image"; EPUB 2 <meta name="cover"> (which should
// name a manifest id but often names the file instead, e.g. "FORGIVENESS.jpg"); the <guide> cover page's picture; an
// image called "cover"; and last, the first picture on the book's first page.
async function epubFindCover(z,opf,man,base,spine){
  const items=Object.values(man), isImg=x=>x&&/image/.test(x.type)&&z.has(x.href);
  const c3=items.find(x=>/cover-image/.test(x.props)); if(isImg(c3)) return c3.href;
  const cid=(byTag(opf,'meta').find(m=>m.getAttribute('name')==='cover')||{getAttribute:()=>null}).getAttribute('content');
  if(cid){ if(isImg(man[cid])) return man[cid].href;
    const byFile=items.find(x=>isImg(x)&&(x.href===pjoin(base,cid)||x.href.endsWith('/'+cid)||x.href===cid)); if(byFile) return byFile.href;
    if(z.has(pjoin(base,cid))&&/\.(jpe?g|png|gif|webp)$/i.test(cid)) return pjoin(base,cid); }
  const pageImg=async href=>{ if(!href||!z.has(href)) return null; const t=await z.text(href)||'';
    const m=t.match(/<img[^>]+src\s*=\s*["']([^"']+)["']/i)||t.match(/<image[^>]+(?:xlink:)?href\s*=\s*["']([^"']+)["']/i);
    if(!m) return null; const p=pjoin(pdir(href),decodeURIComponent(m[1])); return z.has(p)?p:null; };
  const g=byTag(opf,'reference').find(r=>/cover/i.test(r.getAttribute('type')||''));
  if(g){ const p=await pageImg(pjoin(base,(g.getAttribute('href')||'').split('#')[0])); if(p) return p; }
  const named=items.find(x=>isImg(x)&&/cover/i.test(x.href)); if(named) return named.href;
  const cp=items.find(x=>/html/.test(x.type)&&/cover/i.test(x.href)); if(cp){ const p=await pageImg(cp.href); if(p) return p; }
  return spine[0]?await pageImg(spine[0].href):null;
}
async function epubOpen(buf){
  const z=await zipOpen(buf);
  const cont=await z.text('META-INF/container.xml'); if(!cont) throw new Error('This EPUB has no contents file.');
  const opfPath=(cont.match(/full-path="([^"]+)"/)||[])[1]; const opfText=opfPath&&await z.text(opfPath);
  if(!opfText) throw new Error('This EPUB’s contents couldn’t be read.');
  const opf=parseXML(opfText), base=pdir(opfPath);
  const meta=t=>(byTag(opf,t)[0]||{}).textContent||'';
  const man={}; byTag(opf,'item').forEach(it=>{ man[it.getAttribute('id')]={href:pjoin(base,it.getAttribute('href')||''),type:it.getAttribute('media-type')||'',props:it.getAttribute('properties')||''}; });
  const spine=byTag(opf,'itemref').map(r=>man[r.getAttribute('idref')]).filter(x=>x&&/html|xml/.test(x.type)&&z.has(x.href.split('#')[0])).map(x=>({href:x.href.split('#')[0],size:Math.max(400,z.size(x.href.split('#')[0]))}));
  if(!spine.length) throw new Error('This EPUB has no chapters.');
  const cover=await epubFindCover(z,opf,man,base,spine);
  // contents: EPUB 3 nav, else EPUB 2 NCX
  let toc=[];
  const nav=Object.values(man).find(x=>/\bnav\b/.test(x.props));
  if(nav){ const nd=parseXML(await z.text(nav.href)||'','application/xhtml+xml'), nb=pdir(nav.href);
    const navEl=byTag(nd,'nav').find(n=>/toc/.test(n.getAttribute('epub:type')||n.getAttributeNS('http://www.idpf.org/2007/ops','type')||''))||byTag(nd,'nav')[0];
    const walk=(ol,depth)=>{ if(!ol) return; [...ol.children].forEach(li=>{ if(li.localName!=='li') return; const a=[...li.children].find(c=>c.localName==='a'||c.localName==='span'); if(a){ const h=a.getAttribute('href'); toc.push({label:a.textContent.replace(/\s+/g,' ').trim(),href:h?pjoin(nb,h):null,depth}); } walk([...li.children].find(c=>c.localName==='ol'),depth+1); }); };
    if(navEl) walk([...navEl.getElementsByTagNameNS('*','ol')][0],0);
  }
  if(!toc.length){ const ncx=Object.values(man).find(x=>/ncx/.test(x.type)||/\.ncx$/i.test(x.href));
    if(ncx){ const nd=parseXML(await z.text(ncx.href)||''), nb=pdir(ncx.href);
      const walk=(el,depth)=>[...el.children].forEach(np=>{ if(np.localName!=='navPoint') return; const lab=byTag(np,'text')[0], c=[...np.children].find(x=>x.localName==='content'); toc.push({label:(lab?lab.textContent:'').replace(/\s+/g,' ').trim(),href:c?pjoin(nb,c.getAttribute('src')||''):null,depth}); walk(np,depth+1); });
      const nm=byTag(nd,'navMap')[0]; if(nm) walk(nm,0); } }
  toc=toc.filter(t=>t.label);
  toc.forEach(t=>{ t.spine=t.href?spine.findIndex(s=>s.href===t.href.split('#')[0]):-1; });
  return {kind:'epub',z,title:meta('title'),author:meta('creator'),spine,toc,cover,urls:{}};
}
// a resource as a blob: URL (CSS has its own url()s rewritten too)
async function resURL(B,path){
  if(B.urls[path]) return B.urls[path];
  let bytes=await B.z.bytes(path); if(!bytes) return '';
  const ext=extOf(path); let type=MIME[ext]||'application/octet-stream';
  if(ext==='css'){
    let css=new TextDecoder().decode(bytes); const dir=pdir(path), found=[];
    css.replace(/url\(\s*(['"]?)([^'")]+)\1\s*\)/g,(m,q,u)=>{ if(!/^(data|https?):/.test(u)) found.push(u); return m; });
    for(const u of found){ const url=await resURL(B,pjoin(dir,u).split('#')[0]); css=css.split(u).join(url); }
    css=css.replace(/@import[^;]+;/g,'');
    bytes=new TextEncoder().encode(css);
  }
  return B.urls[path]=URL.createObjectURL(new Blob([bytes],{type}));
}

// ---------- where books come from ----------
const LIBDB={ open(){ return this.p||(this.p=new Promise((res,rej)=>{ const r=indexedDB.open('library',1); r.onupgradeneeded=()=>{ const d=r.result; d.createObjectStore('books',{keyPath:'id'}); d.createObjectStore('files'); d.createObjectStore('covers'); }; r.onsuccess=()=>res(r.result); r.onerror=()=>rej(r.error); })); },
  async op(store,mode,fn){ const d=await this.open(); return new Promise((res,rej)=>{ const tx=d.transaction(store,mode), r=fn(tx.objectStore(store)); tx.oncomplete=()=>res(r&&r.result); tx.onerror=()=>rej(tx.error); }); },
  all(s){ return this.op(s,'readonly',st=>st.getAll()); }, get(s,k){ return this.op(s,'readonly',st=>st.get(k)); },
  put(s,v,k){ return this.op(s,'readwrite',st=>k===undefined?st.put(v):st.put(v,k)); }, del(s,k){ return this.op(s,'readwrite',st=>st.delete(k)); } };
const LIB={books:[],loaded:false,mac:!!window.MAC_APP,folder:'',cat:[],q:'',view:store.get('libview','all'),sort:store.get('libsort','author'),author:null};
let RPOS=store.get('rpos',{});      // key → {i,f,pct,t,title,author,bm:[]}
// your own names for books (the original title is kept and still searchable); synced as db doc "x-alias"
let BALIAS=store.get('balias',{});
const dispT=b=>BALIAS[bookKey(b)]||b.t;
function setAlias(b,name){ const k=bookKey(b); name=(name||'').trim(); if(!name||name===b.t) delete BALIAS[k]; else BALIAS[k]=name; BALIAS._t=Date.now(); store.set('balias',BALIAS); syncPut('x-alias',BALIAS); }
async function libLoad(force){
  if(LIB.loaded&&!force) return;
  if(LIB.mac){ try{ const j=await (await fetch(force?'lib/index-fresh.json':'lib/index.json')).json(); LIB.books=(j.books||[]).map(b=>({...b,f:b.f||b.t})); LIB.folder=j.folder||''; LIB.missing=!!j.missing; }catch(e){ LIB.books=[]; } }
  else { try{ LIB.books=await LIBDB.all('books'); }catch(e){ LIB.books=[]; } LIB.cat=store.get('libcat',[]); }
  LIB.loaded=true;
}
// Books added before the cover finder learned more ways to find covers: look again, once, in the background.
async function libRecover(){
  if(LIB.mac||libRecover.on) return; libRecover.on=true; let got=0;
  try{ for(const b of LIB.books){
    if(b.k==='pdf'||b.cv2) continue;
    try{ if(!(await LIBDB.get('covers',b.id))){ const blob=await LIBDB.get('files',b.id);
      if(blob){ const B=await epubOpen(await blob.arrayBuffer()); const cb=B.cover&&await B.z.bytes(B.cover);
        if(cb){ await LIBDB.put('covers',new Blob([cb],{type:MIME[extOf(B.cover)]||'image/jpeg'}),b.id); delete COVCACHE[b.id]; got++; } } } }catch(e){}
    b.cv2=1; await LIBDB.put('books',b).catch(()=>{});
  } }finally{ libRecover.on=false; }
  if(got){ LIB.keepScroll=true; libRender(); }
}
async function libBytes(b){
  if(LIB.mac){ const r=await fetch('lib/file/'+b.id); if(!r.ok) throw new Error(b.k==='mobi'?'Couldn’t convert this Kindle book (is calibre installed?).':'Couldn’t open this book. Is iCloud Drive connected?'); return {buf:await r.arrayBuffer(),kind:/pdf/.test(r.headers.get('Content-Type')||'')?'pdf':'epub'}; }
  const blob=await LIBDB.get('files',b.id); if(!blob) throw new Error('This book’s file is missing; add it again.');
  return {buf:await blob.arrayBuffer(),kind:b.k==='pdf'?'pdf':'epub'};
}
// add books from the Files app (phone / browser)
async function libAddFiles(files){
  let n=0, bad=0;
  for(const f of files){
    const ext=extOf(f.name); if(ext!=='epub'&&ext!=='pdf'){ bad++; continue; }
    libToast(`Adding ${f.name}…`);
    try{
      const buf=await f.arrayBuffer(), id='p'+hash(f.name+f.size);
      let a=fileAuthor(f.name), cover=null;
      if(ext==='epub'){ const B=await epubOpen(buf); if(!a) a=(B.author||'').trim(); if(B.cover){ const cb=await B.z.bytes(B.cover); if(cb) cover=new Blob([cb],{type:MIME[extOf(B.cover)]||'image/jpeg'}); } }
      else { try{ if(!a){ const lib=await pdfLib(), doc=await lib.getDocument({data:new Uint8Array(buf.slice(0))}).promise, m=await doc.getMetadata().catch(()=>null); a=String(m&&m.info&&m.info.Author||'').trim().slice(0,60); doc.destroy(); } }catch(e){}
        try{ cover=await Promise.race([pdfThumb(buf),new Promise(r=>setTimeout(()=>r(null),8000))]); }catch(e){} }
      const b={id,t:fileTitle(f.name,a),a,k:ext,s:f.size,d:Math.floor(Date.now()/1000),f:f.name.replace(/\.[^.]+$/,'')};
      await LIBDB.put('files',new Blob([buf]),id); if(cover) await LIBDB.put('covers',cover,id); await LIBDB.put('books',b);
      n++;
    }catch(e){ bad++; console.warn(e); }
  }
  await libLoad(true); libRender();
  libToast(n?`Added ${n} ${n===1?'book':'books'}${bad?` (${bad} couldn’t be read)`:''}`:'No books were added. Choose EPUB or PDF files.');
}
async function libRemove(b){
  if(!confirm(`Remove “${b.t}” from this ${phone()?'phone':'device'}? Your place in it is kept.`)) return;
  await LIBDB.del('files',b.id); await LIBDB.del('covers',b.id); await LIBDB.del('books',b.id); await libLoad(true); libRender();
}
const libToast=m=>toast(m);

// ---------- reading position and bookmarks (synced) ----------
function posGet(b){ return RPOS[bookKey(b)]||null; }
function posSet(b,p){
  const k=bookKey(b), old=RPOS[k]||{};
  RPOS[k]={...old,...p,t:Date.now(),title:b.t,author:b.a,fn:b.f,k:b.k}; store.set('rpos',RPOS);
  clearTimeout(posSet.tm); posSet.tm=setTimeout(()=>syncPut('r-'+k,RPOS[k]),3000);
}
// Mac: share the list of books so the phone can show it (small: title, author, kind, file name)
async function libShareCatalog(){
  if(!LIB.mac||!syncOn()||!LIB.books.length) return;
  const rows=LIB.books.map(b=>[b.t,b.a,b.k==='pdf'?'pdf':'epub',b.f]), sig=hash(JSON.stringify(rows));
  if(store.get('libcatsig','')===sig) return;
  const parts=[]; let cur=[], size=0;
  for(const r of rows){ const n=JSON.stringify(r).length; if(size+n>120000){ parts.push(cur); cur=[]; size=0; } cur.push(r); size+=n; }
  if(cur.length) parts.push(cur);
  parts.forEach((p,i)=>syncPut('lc-'+i,{n:parts.length,i,rows:p}));
  for(let i=parts.length;i<parts.length+3;i++) syncPut('lc-'+i,null);
  store.set('libcatsig',sig);
}
function libApplyRemote(id,d){
  if(id.startsWith('r-')){ const k=id.slice(2); if(d&&(!RPOS[k]||(d.t||0)>(RPOS[k].t||0))){ RPOS[k]=d; store.set('rpos',RPOS); if($('#lib').classList.contains('open')) libRender(); } return true; }
  if(id==='x-alias'){ if(d&&(d._t||0)>(BALIAS._t||0)){ BALIAS=d; store.set('balias',BALIAS); if($('#lib').classList.contains('open')){ LIB.keepScroll=true; libRender(); } } return true; }
  if(id.startsWith('lc-')){ if(LIB.mac) return true; const cat=store.get('libcatparts',{}); if(d) cat[d.i]=d; else delete cat[id.slice(3)]; store.set('libcatparts',cat);
    const n=d?d.n:0, ps=Object.values(cat); if(ps.length&&ps.every(p=>p.n===ps[0].n)&&ps.length>=ps[0].n){ LIB.cat=ps.sort((a,b)=>a.i-b.i).flatMap(p=>p.rows); store.set('libcat',LIB.cat); if($('#lib').classList.contains('open')) libRender(); } return true; }
  return false;
}

// ---------- Library screen ----------
function libOpen(){
  closeSheets(); $('#lib').classList.add('open'); document.body.classList.add('lib-open');
  libRender(); libLoad().then(()=>{ libRender(); libShareCatalog();
    if(LIB.mac&&!LIB.fresh){ LIB.fresh=true; setTimeout(()=>libLoad(true).then(()=>{ LIB.keepScroll=true; libRender(); libShareCatalog(); setTimeout(libShareCovers,3000); }),400); } });
}
function libClose(){ $('#lib').classList.remove('open'); document.body.classList.remove('lib-open'); }
function libReload(){ LIB.loaded=false; libLoad(true).then(()=>{ libRender(); libShareCatalog(); }); }
function coverHTML(b,big,far){
  const pct=(posGet(b)||{}).pct;
  return `<div class="cv${big?' big':''}" style="--h:${coverHue(b)}"><span class="cvt">${esc(dispT(b))}</span><span class="cva">${esc(b.a||'')}</span>${b.k==='pdf'?'<span class="cvk">PDF</span>':''}<img alt="" data-cover="${far?'':b.id}" data-key="${bookKey(b)}" hidden>${pct!=null?`<i class="cvp"><b style="width:${Math.max(2,Math.round(pct*100))}%"></b></i>`:''}</div>`;
}
function bookTile(b){ const p=posGet(b), sub=[b.a,p&&p.pct!=null?(p.pct>.995?'Finished':Math.round(p.pct*100)+'%'):''].filter(Boolean).join(' · ');
  return `<button class="bk" data-book="${b.id}">${coverHTML(b)}<span class="bt">${esc(dispT(b))}</span><span class="ba">${esc(sub)||'&nbsp;'}</span></button>`; }
function libFiltered(){
  const q=LIB.q.trim().toLowerCase(); let L=LIB.books;
  if(q) L=L.filter(b=>(b.t+' '+dispT(b)+' '+b.a).toLowerCase().includes(q));
  if(LIB.author!=null) L=L.filter(b=>b.a===LIB.author);
  const by={author:(a,b)=>(a.a||'~').localeCompare(b.a||'~')||dispT(a).localeCompare(dispT(b)),title:(a,b)=>dispT(a).localeCompare(dispT(b)),recent:(a,b)=>(b.d||0)-(a.d||0),
    read:(a,b)=>((posGet(b)||{}).t||0)-((posGet(a)||{}).t||0)||a.t.localeCompare(b.t)};
  return L.slice().sort(by[LIB.sort]||by.author);
}
function libRender(){
  const el=$('#lib'); if(!el.classList.contains('open')) return;
  if(LIB.loaded&&!LIB.mac&&!libRecover.done){ libRecover.done=1; setTimeout(()=>libRecover(),800); }
  const mac=LIB.mac, reading=LIB.books.filter(b=>posGet(b)).sort((a,b)=>posGet(b).t-posGet(a).t).slice(0,12);
  const head=`<div class="lbh"><button class="lbback" data-lclose>‹ Bible</button><h2>${LIB.author!=null?esc(LIB.author||'Unknown author'):'Library'}</h2>
    ${mac?'':'<button class="lbadd" data-ladd>＋ Add books</button>'}</div>
    <div class="lbtools"><div class="lbsearch"><input id="lbq" type="search" placeholder="Search ${LIB.books.length?LIB.books.length.toLocaleString()+' ':''}books" value="${esc(LIB.q)}" autocomplete="off"></div>
      <div class="lbseg">${[['all','Books'],['authors','Authors'],['reading','Reading']].map(([k,l])=>`<button data-lview="${k}" class="${LIB.view===k&&LIB.author==null?'on':''}">${l}</button>`).join('')}</div>
      <select id="lbsort" aria-label="Sort">${[['author','Author'],['title','Title'],['recent','Recently added'],['read','Recently read']].map(([k,l])=>`<option value="${k}" ${LIB.sort===k?'selected':''}>${l}</option>`).join('')}</select></div>`;
  let body='';
  if(!LIB.loaded) body='<div class="lbempty">Loading your books…</div>';
  else if(mac&&LIB.missing) body=`<div class="lbempty"><b>Your books folder wasn’t found.</b><br>Choose it in File → Choose Library Folder…</div>`;
  else if(!LIB.books.length&&!mac) body=`<div class="lbempty"><b>Add your books</b><p>Tap <b>＋ Add books</b>, then choose EPUB or PDF files. Your books are in <b>iCloud Drive › Authors</b>; you can pick several at once.</p><p>They’re kept on this phone, and where you are in each book stays in step with your Mac when Sync is on.</p><button class="pill pri" data-ladd>Add books</button></div>${libCatHTML()}`;
  else if(LIB.view==='authors'&&LIB.author==null&&!LIB.q){
    const by={}; LIB.books.forEach(b=>{ (by[b.a]=by[b.a]||[]).push(b); });
    body=`<div class="lbauth">${Object.keys(by).sort((a,b)=>(a||'~').localeCompare(b||'~')).map(a=>`<button data-lauthor="${esc(a)}"><span class="lam">${by[a].slice(0,3).map(b=>`<i style="--h:${coverHue(b)}"></i>`).join('')}</span><b>${esc(a||'Unknown author')}</b><small>${by[a].length} ${by[a].length===1?'book':'books'}</small></button>`).join('')}</div>`;
  } else if(LIB.view==='reading'&&LIB.author==null&&!LIB.q){
    body=reading.length?`<div class="lbgrid">${reading.map(bookTile).join('')}</div>`:'<div class="lbempty">Books you open show here, with how far you’ve read.</div>';
  } else {
    const L=libFiltered();
    const cont=!LIB.q&&LIB.author==null&&reading.length?`<div class="lbsec">Continue reading</div><div class="lbrow">${reading.slice(0,10).map(bookTile).join('')}</div><div class="lbsec">All books</div>`:'';
    body=cont+(L.length?`<div class="lbgrid">${L.map(bookTile).join('')}</div>`:`<div class="lbempty">No books match “${esc(LIB.q)}”.</div>`)+(mac?'':libCatHTML());
  }
  const top=rq('.lbbody',el)?rq('.lbbody',el).scrollTop:0, focus=document.activeElement&&document.activeElement.id==='lbq';
  el.innerHTML=head+(LIB.mac&&LIB.cvLeft?`<div class="cvsync">Sharing covers with your phone… ${LIB.cvLeft.toLocaleString()} to go</div>`:'<div class="cvsync"></div>')+`<div class="lbbody">${body}</div>`;
  if(LIB.keepScroll) rq('.lbbody',el).scrollTop=top; LIB.keepScroll=false;
  if(focus){ const i=$('#lbq'); i.focus(); i.setSelectionRange(i.value.length,i.value.length); }
  libCovers();
}
// the Mac's books that aren't on this phone yet
function libCatHTML(){
  if(LIB.mac||!LIB.cat.length) return '';
  const have=new Set(LIB.books.map(b=>normT(b.f))), q=LIB.q.trim().toLowerCase();
  let rows=LIB.cat.filter(r=>!have.has(normT(r[3])));
  if(q) rows=rows.filter(r=>(r[0]+' '+(BALIAS[bookKey({f:r[3],k:r[2]})]||'')+' '+r[1]).toLowerCase().includes(q));
  if(LIB.author!=null) rows=rows.filter(r=>r[1]===LIB.author);
  if(!rows.length) return '';
  const show=rows.slice(0,q||LIB.author!=null?400:60);
  return `<div class="lbsec">On your Mac <small>${rows.length.toLocaleString()} not on this phone yet</small></div><div class="lbgrid mac">${show.map((r,i)=>{ const b={id:'c'+i,t:r[0],a:r[1],k:r[2],f:r[3]}; return `<button class="bk far" data-lcat="${esc(r[1])}" title="Add from Files">${coverHTML(b,false,true)}<span class="bt">${esc(dispT(b))}</span><span class="ba">${esc(r[1]||'')} · ☁︎</span></button>`; }).join('')}</div>${rows.length>show.length?`<div class="lbempty small">Search to find the other ${(rows.length-show.length).toLocaleString()}.</div>`:''}`;
}
// covers: the Mac makes them (a few at a time, only for tiles on screen); the phone has its own books' covers saved, and
// gets covers for the Mac's books (and any it couldn't read) from Sync, where the Mac shares small copies ("cv-<key>")
let COVQ=[], COVN=0, COVIO=null;
function libCovers(){
  if(COVIO) COVIO.disconnect();
  COVIO=new IntersectionObserver(es=>es.forEach(e=>{ if(!e.isIntersecting) return; COVIO.unobserve(e.target); COVQ.push(e.target); covPump(); }),{root:rq('#lib .lbbody'),rootMargin:'400px'});
  document.querySelectorAll('#lib img[data-key]').forEach(i=>COVIO.observe(i));
}
const COVCACHE={};
async function covLocal(id){
  if(!id) return null;
  if(LIB.mac) return await new Promise(r=>{ const im=new Image(); im.onload=()=>r('lib/cover/'+id); im.onerror=()=>r(null); im.src='lib/cover/'+id; });
  const bl=await LIBDB.get('covers',id).catch(()=>null); return bl?URL.createObjectURL(bl):null;
}
async function covShared(key){
  if(LIB.mac) return null;
  const bl=await LIBDB.get('covers','k:'+key).catch(()=>null); if(bl) return URL.createObjectURL(bl);
  if(!syncOn()) return null;
  const rows=await sbRest('GET',`bible_docs?select=data&deleted=is.false&id=eq.${encodeURIComponent('cv-'+key)}`).catch(()=>null);
  const d=rows&&rows[0]&&rows[0].data&&rows[0].data.d; if(!d) return null;
  const blob=await (await fetch(d)).blob(); LIBDB.put('covers',blob,'k:'+key).catch(()=>{}); return URL.createObjectURL(blob);
}
function covPump(){
  while(COVN<4&&COVQ.length){
    const img=COVQ.shift(), id=img.dataset.cover, key=img.dataset.key, ck=id||'k:'+key; if(!img.isConnected) continue;
    const show=u=>{ img.onload=()=>{ img.hidden=false; img.parentNode.classList.add('has'); }; img.src=u; };
    if(COVCACHE[ck]){ if(COVCACHE[ck]!=='none') show(COVCACHE[ck]); continue; }
    COVN++;
    (async()=>{ let u=null; try{ u=await covLocal(id); if(!u) u=await covShared(key); }catch(e){} COVN--; COVCACHE[ck]=u||'none'; if(u) show(u); covPump(); })();
  }
}
// Mac: share a small copy of every cover with the phone, one book at a time in the background (each book is downloaded
// from iCloud just long enough to read its cover). Progress shows under the Library title.
let CVUP=store.get('cvup',{}), CVRUN=false;
async function libShareCovers(){
  if(!LIB.mac||!syncOn()||CVRUN) return; CVRUN=true;
  try{
    const todo=LIB.books.filter(b=>!CVUP[bookKey(b)]);
    let n=0;
    for(const b of todo){
      if(!syncOn()) break;
      const key=bookKey(b);
      const d=await new Promise(res=>{ const im=new Image(); im.onload=()=>{ const h=200, w=Math.round(im.naturalWidth*h/im.naturalHeight)||133, c=document.createElement('canvas'); c.width=Math.min(w,200); c.height=h; c.getContext('2d').drawImage(im,0,0,c.width,h); res(c.toDataURL('image/jpeg',.72)); }; im.onerror=()=>res(null); im.src='lib/cover/'+b.id; });
      if(d) await sbRest('POST','bible_docs?on_conflict=user_id,id',[{id:'cv-'+key,data:{d},deleted:false}],{Prefer:'resolution=merge-duplicates,return=minimal'}).catch(()=>{});
      CVUP[key]=d?1:2; if(++n%10===0) store.set('cvup',CVUP);
      LIB.cvLeft=todo.length-n; const el=rq('#lib .cvsync'); if(el) el.textContent=LIB.cvLeft?`Sharing covers with your phone… ${LIB.cvLeft.toLocaleString()} to go`:'';
      await new Promise(r=>setTimeout(r,150));
    }
  }finally{ store.set('cvup',CVUP); CVRUN=false; LIB.cvLeft=0; const el=rq('#lib .cvsync'); if(el) el.textContent=''; }
}
// long-press (phone) or right-click (Mac) a book: rename it, or remove it from the phone
function bookActions(b){
  const el=$('#bkact'), al=BALIAS[bookKey(b)];
  el.innerHTML=`<div class="bkc"><h3>Rename book</h3><div class="orig">Original title: ${esc(b.t)}${b.a?`<br>${esc(b.a)}`:''}</div>
    <input id="bkname" value="${esc(al||b.t)}" placeholder="${esc(b.t)}" autocomplete="off">
    <div class="acts">${al?'<button class="pill" data-bkorig>Use original</button>':''}<button class="pill" data-bkx>Cancel</button><button class="pill pri" data-bksave>Save</button></div>
    ${LIB.mac||b.id.startsWith('c')?'':'<button class="rm" data-bkrm>Remove from this phone</button>'}</div>`;
  el.classList.add('open'); el._b=b; setTimeout(()=>{ const i=$('#bkname'); i.focus(); i.select(); },60);
}
$('#bkact').addEventListener('click',e=>{
  const el=$('#bkact'), b=el._b, t=e.target.closest('button');
  if(e.target===el||(t&&'bkx' in t.dataset)){ el.classList.remove('open'); return; }
  if(!t) return;
  if('bksave' in t.dataset) setAlias(b,$('#bkname').value);
  else if('bkorig' in t.dataset) setAlias(b,'');
  else if('bkrm' in t.dataset){ el.classList.remove('open'); libRemove(b); return; }
  el.classList.remove('open'); LIB.keepScroll=true; libRender(); if(R.b===b) rq('#rtitle').textContent=dispT(b);
});
$('#bkact').addEventListener('keydown',e=>{ if(e.key==='Enter'){ setAlias($('#bkact')._b,$('#bkname').value); $('#bkact').classList.remove('open'); LIB.keepScroll=true; libRender(); } if(e.key==='Escape') $('#bkact').classList.remove('open'); });
{ let lt=0, lx=0, ly=0, fired=false;
  $('#lib').addEventListener('touchstart',e=>{ const t=e.target.closest('[data-book]'); fired=false; if(!t) return; lx=e.touches[0].clientX; ly=e.touches[0].clientY;
    lt=setTimeout(()=>{ fired=true; const b=LIB.books.find(x=>x.id===t.dataset.book); if(b){ navigator.vibrate&&navigator.vibrate(10); bookActions(b); } },520); },{passive:true});
  $('#lib').addEventListener('touchmove',e=>{ if(Math.hypot(e.touches[0].clientX-lx,e.touches[0].clientY-ly)>8) clearTimeout(lt); },{passive:true});
  $('#lib').addEventListener('touchend',e=>{ clearTimeout(lt); if(fired){ e.preventDefault(); } },{passive:false});
  $('#lib').addEventListener('click',e=>{ if(fired){ e.stopImmediatePropagation(); e.preventDefault(); fired=false; } },true);
}
$('#lib').addEventListener('click',e=>{
  const t=e.target.closest('button'); if(!t) return;
  if('lclose' in t.dataset){ if(LIB.author!=null){ LIB.author=null; libRender(); } else libClose(); }
  else if('ladd' in t.dataset) $('#libfile').click();
  else if(t.dataset.lview){ LIB.view=t.dataset.lview; LIB.author=null; store.set('libview',LIB.view); libRender(); }
  else if(t.dataset.lauthor!==undefined){ LIB.author=t.dataset.lauthor; LIB.view='all'; libRender(); rq('#lib .lbbody').scrollTop=0; }
  else if(t.dataset.lcat!==undefined){ alert(`This book is on your Mac.\n\nTo read it here, tap “Add books” and choose it from:\niCloud Drive › Authors › ${t.dataset.lcat}`); $('#libfile').click(); }
  else if(t.dataset.book){ const b=LIB.books.find(x=>x.id===t.dataset.book); if(b) readerOpen(b); }
});
$('#lib').addEventListener('contextmenu',e=>{ const t=e.target.closest('[data-book]'); if(!t) return; e.preventDefault(); const b=LIB.books.find(x=>x.id===t.dataset.book); if(b) bookActions(b); });
$('#lib').addEventListener('input',e=>{ if(e.target.id==='lbq'){ LIB.q=e.target.value; clearTimeout(libRender.t); libRender.t=setTimeout(libRender,120); } });
$('#lib').addEventListener('change',e=>{ if(e.target.id==='lbsort'){ LIB.sort=e.target.value; store.set('libsort',LIB.sort); libRender(); } });
$('#libfile').addEventListener('change',e=>{ const fs=[...e.target.files]; e.target.value=''; if(fs.length) libAddFiles(fs); });

// ---------- Reader ----------
const RFONTS=()=>[['publisher','Publisher’s font','inherit'],...FONTS.map(([k,n,st])=>[k,n,st])];
const R={b:null,B:null,kind:null,i:0,p:0,pages:1,cols:1,W:0,H:0,chrome:true,busy:false};
const RS=()=>({rfont:S.font||'newyork',rfs:19,rlh:1.6,rmar:2,rjust:true,rmode:'pages',rturn:'slide',rpdfdark:true,rzoom:1,...S});
async function readerOpen(b){
  const el=$('#rdr'); el.classList.add('open'); document.body.classList.add('rdr-open');
  R.b=b; R.B=null; R.kind=null; R.chrome=true; readerChrome();
  rq('#rtitle').textContent=dispT(b); rq('#rsub').textContent=b.a||'';
  rq('#rstage').innerHTML=`<div class="rload"><div class="spin"></div><b>Opening ${esc(b.t)}…</b>${LIB.mac&&!b.l?'<small>Downloading from iCloud</small>':''}${b.k==='mobi'?'<small>Converting the Kindle book (first time only)</small>':''}</div>`;
  try{
    const {buf,kind}=await libBytes(b); if(R.b!==b) return;
    R.kind=kind;
    if(kind==='pdf') await pdfStart(buf); else { R.B=await epubOpen(buf); await epubStart(); }
    if(LIB.mac){ b.l=true; }
  }catch(e){ console.warn(e); rq('#rstage').innerHTML=`<div class="rload"><b>Couldn’t open this book</b><small>${esc(e.message||String(e))}</small><button class="pill" data-rclose>Back to Library</button></div>`; }
}
function readerClose(){
  const el=$('#rdr'); el.classList.remove('open'); document.body.classList.remove('rdr-open'); rsheet(null);
  if(R.B) Object.values(R.B.urls).forEach(u=>URL.revokeObjectURL(u));
  if(R.pdf){ try{ R.pdf.destroy(); }catch(e){} R.pdf=null; if(R.io) R.io.disconnect(); }
  R.b=null; R.B=null; rq('#rstage').innerHTML=''; libRender();
}
function readerChrome(){ $('#rdr').classList.toggle('chrome',R.chrome); }

// --- EPUB ---
async function epubStart(){
  const st=rq('#rstage'); st.innerHTML='<iframe id="rfr" title="Book"></iframe>';
  const fr=rq('#rfr'); fr.srcdoc='<!doctype html><html lang="en"><head><meta charset="utf-8"><style id="rbase"></style></head><body></body></html>';
  await new Promise(r=>fr.onload=r);
  const d=fr.contentDocument;
  // taps, swipes and links inside the page
  let x0=null,y0=0,t0=0,drag=false,dx=0;
  d.addEventListener('touchstart',e=>{ if(e.touches.length>1){ x0=null; return; } x0=e.touches[0].clientX; y0=e.touches[0].clientY; t0=Date.now(); drag=false; dx=0; },{passive:true});
  d.addEventListener('touchmove',e=>{ if(x0==null||RS().rmode==='scroll') return; const mx=e.touches[0].clientX-x0, my=e.touches[0].clientY-y0;
    if(!drag){ if(Math.abs(mx)>10&&Math.abs(mx)>Math.abs(my)*1.4&&!String(d.getSelection())) drag=true; else return; }
    e.preventDefault(); dx=mx; if(RS().rturn==='slide') d.body.style.transition='none', d.body.style.transform=`translateX(${-R.p*R.W+dx}px)`; },{passive:false});
  d.addEventListener('touchend',()=>{ if(x0==null) return; x0=null; if(!drag) return; R.swiped=Date.now();
    const v=Math.abs(dx)/Math.max(1,Date.now()-t0);
    if(Math.abs(dx)>60||(v>.45&&Math.abs(dx)>24)) (dx<0?rNext():rPrev()); else epubShow(true); },{passive:true});
  d.addEventListener('click',e=>{
    const a=e.target.closest&&e.target.closest('a[href]');
    if(a){ e.preventDefault(); const h=a.getAttribute('data-to'); if(h) epubGoHref(h); else if(/^https?:/.test(a.getAttribute('href'))) window.open(a.getAttribute('href'),'_blank','noopener'); return; }
    if(Date.now()-(R.swiped||0)<400||String(d.getSelection())) return;
    const x=e.clientX/R.W;
    if(RS().rmode!=='scroll'&&x<.28) rPrev(); else if(RS().rmode!=='scroll'&&x>.72) rNext(); else { R.chrome=!R.chrome; readerChrome(); }
  });
  d.addEventListener('keydown',readerKey);
  ['gesturestart','gesturechange','gestureend'].forEach(t=>d.addEventListener(t,e=>e.preventDefault(),{passive:false}));
  d.addEventListener('scroll',()=>{ if(RS().rmode==='scroll'){ clearTimeout(R.st); R.st=setTimeout(epubSaveScroll,200); } },true);
  const pos=posGet(R.b)||{}; R.bm=pos.bm||[];
  await epubLoad(Math.min(pos.i||0,R.B.spine.length-1),pos.f||0);
  addEventListener('resize',epubRelayout);
}
async function epubLoad(i,at,anim){
  const B=R.B, it=B.spine[i], fr=rq('#rfr'); if(!fr) return; const d=fr.contentDocument; R.busy=true; clearTimeout(R.bt); R.bt=setTimeout(()=>{ R.busy=false; },4000);
  const src=await B.z.text(it.href)||''; const doc=parseXML(src,'application/xhtml+xml'), dir=pdir(it.href);
  doc.querySelectorAll('script,iframe,object,embed').forEach(s=>s.remove());
  doc.querySelectorAll('*').forEach(el=>{ for(const a of [...el.attributes]) if(/^on/i.test(a.name)) el.removeAttribute(a.name); });
  const jobs=[];
  for(const el of doc.querySelectorAll('img[src],image,link[rel~="stylesheet"][href],source[src]')){
    const attr=el.localName==='image'?(el.getAttribute('href')!=null?'href':'xlink:href'):el.localName==='link'?'href':'src';
    const v=el.getAttribute(attr)||el.getAttributeNS('http://www.w3.org/1999/xlink','href'); if(!v||/^(data|https?):/.test(v)) continue;
    jobs.push(resURL(B,pjoin(dir,v).split('#')[0]).then(u=>{ if(el.localName==='image') el.setAttributeNS('http://www.w3.org/1999/xlink','href',u); el.setAttribute(attr,u); }));
  }
  doc.querySelectorAll('a[href]').forEach(a=>{ const h=a.getAttribute('href'); if(h&&!/^[a-z]+:/i.test(h)) a.setAttribute('data-to',h.startsWith('#')?it.href+h:pjoin(dir,h)); });
  await Promise.all(jobs);
  if(anim) await rTurnOut(anim);
  // move the chapter into the page
  d.head.querySelectorAll(':not(#rbase)').forEach(n=>n.remove());
  const hd=doc.head||doc.getElementsByTagNameNS('*','head')[0], bd=doc.body||doc.getElementsByTagNameNS('*','body')[0];
  if(hd) [...hd.children].filter(n=>/^(link|style)$/.test(n.localName)).forEach(n=>d.head.insertBefore(d.importNode(n,true),d.getElementById('rbase')));
  d.body.innerHTML=''; d.body.className=bd?bd.getAttribute('class')||'':''; if(bd) [...bd.childNodes].forEach(n=>d.body.appendChild(d.importNode(n,true)));
  R.i=i; epubStyle(); await epubWaitImages(d);
  epubMeasure(); R.p=at==='last'?R.pages-1:Math.min(R.pages-1,Math.max(0,Math.round((at||0)*R.pages)));
  if(typeof at==='string'&&at.startsWith('#')){ const t=d.getElementById(at.slice(1)); if(t) R.p=epubPageOf(t); }
  if(RS().rmode==='scroll'){ d.scrollingElement.scrollTop=(typeof at==='number'?at:at==='last'?1:0)*(d.scrollingElement.scrollHeight-R.H); }
  epubShow(false); if(anim) await rTurnIn(anim); R.busy=false; epubSave();
}
function epubWaitImages(d){ const imgs=[...d.images].filter(i=>!i.complete); return Promise.race([Promise.all(imgs.map(i=>new Promise(r=>{ i.onload=i.onerror=r; }))),new Promise(r=>setTimeout(r,1500))]); }
function epubStyle(){
  const fr=rq('#rfr'); if(!fr) return; const d=fr.contentDocument, o=RS(), cs=getComputedStyle(document.documentElement);
  R.W=fr.clientWidth; R.H=fr.clientHeight;
  const scroll=o.rmode==='scroll', mar=[14,22,32,48][o.rmar]||22, hp=R.W<500?mar:Math.max(mar*1.6,(R.W-(R.W>=1000?1400:760))/2), vp=R.W<500?28:46;
  R.cols=!scroll&&R.W>=1000?2:1; const G=hp*2, cw=(R.W-2*hp-(R.cols-1)*G)/R.cols;
  const f=RFONTS().find(x=>x[0]===o.rfont)||RFONTS()[0], fam=f[0]==='publisher'?'':`font-family:${f[2]}!important;`;
  const v=k=>cs.getPropertyValue(k).trim();
  d.getElementById('rbase').textContent=`
    html{${scroll?'overflow-y:auto;overflow-x:hidden':'overflow:hidden'};height:100%;touch-action:${scroll?'pan-y':'none'};-webkit-text-size-adjust:100%;background:transparent;color-scheme:${v('color-scheme')||'light'}}
    body{margin:0!important;box-sizing:border-box;${scroll?`padding:${vp}px ${hp}px 30vh!important;max-width:none`:`height:100vh;padding:${vp}px ${hp}px!important;column-width:${cw}px;column-gap:${G}px;column-fill:auto;width:${R.W}px;will-change:transform`};
      color:${v('--ink')}!important;background:transparent!important;font-size:${o.rfs}px!important;line-height:${o.rlh}!important;${fam}
      text-align:${o.rjust?'justify':'start'};hyphens:${o.rjust?'auto':'manual'};-webkit-hyphens:${o.rjust?'auto':'manual'};overflow-wrap:break-word;widows:2;orphans:2}
    body *{color:inherit!important;background-color:transparent!important;border-color:${v('--line')}!important;${fam?fam:''}max-width:100%;box-sizing:border-box}
    body p,body div,body li,body blockquote,body span{line-height:inherit!important}
    body p{${o.rjust?'text-align:justify':''}}
    h1,h2,h3,h4{line-height:1.25!important;break-after:avoid;text-align:start;hyphens:manual}
    img,svg,video{max-width:100%!important;${scroll?'':`max-height:${R.H-2*vp}px!important;`}height:auto;object-fit:contain;break-inside:avoid}
    a{color:${v('--accent')}!important;text-decoration:none}
    pre,code{font-family:ui-monospace,Menlo,monospace!important;white-space:pre-wrap}
    ::selection{background:color-mix(in srgb,${v('--accent')} 30%,transparent)}
    table{border-collapse:collapse} td,th{padding:2px 6px}`;
  rq('#rstage').style.setProperty('--rbg',v('--bg'));
}
function epubMeasure(){
  const d=rq('#rfr').contentDocument;
  if(RS().rmode==='scroll'){ R.pages=1; return; }
  d.body.style.transition='none'; d.body.style.transform='none';
  const w=Math.max(d.documentElement.scrollWidth,d.body.scrollWidth);
  R.pages=Math.max(1,Math.ceil((w-2)/R.W));
  // a last page with nothing on it (from trailing margins) isn't a page
  if(R.pages>1){ const r=d.createRange(); r.selectNodeContents(d.body); const rects=[...r.getClientRects()]; const right=Math.max(...rects.map(x=>x.right),0); if(right>0) R.pages=Math.max(1,Math.min(R.pages,Math.ceil((right-1)/R.W))); }
}
function epubPageOf(el){ const r=el.getBoundingClientRect(), d=rq('#rfr').contentDocument; const tf=new DOMMatrix(getComputedStyle(d.body).transform).m41||0; return Math.max(0,Math.min(R.pages-1,Math.floor((r.left-tf+1)/R.W))); }
function epubShow(anim){
  const d=rq('#rfr')&&rq('#rfr').contentDocument; if(!d) return;
  if(RS().rmode!=='scroll'){ d.body.style.transition=anim&&RS().rturn==='slide'?'transform .32s cubic-bezier(.22,.8,.24,1)':'none'; d.body.style.transform=`translateX(${-R.p*R.W}px)`; }
  readerBar();
}
function epubRelayout(){ if(!R.B||!rq('#rfr')) return; const f=R.pages>1?R.p/R.pages:0; epubStyle(); epubMeasure(); R.p=Math.min(R.pages-1,Math.round(f*R.pages)); epubShow(false); }
function epubSave(){ if(!R.B) return; const f=RS().rmode==='scroll'?epubScrollFrac():R.p/R.pages; posSet(R.b,{i:R.i,f,pct:epubPct(f),bm:R.bm}); }
function epubScrollFrac(){ const d=rq('#rfr').contentDocument, se=d.scrollingElement; return se.scrollHeight>R.H?se.scrollTop/(se.scrollHeight-R.H):0; }
function epubSaveScroll(){ epubSave(); readerBar(); }
function epubPct(f){ const S2=R.B.spine, tot=S2.reduce((a,s)=>a+s.size,0); let before=0; for(let k=0;k<R.i;k++) before+=S2[k].size; return Math.min(1,(before+S2[R.i].size*(f??0))/tot); }
async function epubGoHref(h){
  const [path,frag]=h.split('#'); const i=R.B.spine.findIndex(s=>s.href===path);
  if(i<0) return; if(i===R.i&&frag){ const t=rq('#rfr').contentDocument.getElementById(frag); if(t){ if(RS().rmode==='scroll') t.scrollIntoView(); else { R.p=epubPageOf(t); epubShow(true); } epubSave(); } return; }
  await epubLoad(i,frag?'#'+frag:0,'fade');
}
async function rNext(){
  if(R.busy) return;
  if(R.kind==='pdf') return pdfStep(1);
  if(RS().rmode==='scroll'){ const se=rq('#rfr').contentDocument.scrollingElement; if(se.scrollTop+R.H<se.scrollHeight-4){ se.scrollBy({top:R.H*.85,behavior:'smooth'}); return; } }
  else if(R.p<R.pages-1){ R.p++; epubShow(true); epubSave(); return; }
  if(R.i<R.B.spine.length-1) await epubLoad(R.i+1,0,'next'); else { epubShow(true); toast('The end'); }
}
async function rPrev(){
  if(R.busy) return;
  if(R.kind==='pdf') return pdfStep(-1);
  if(RS().rmode==='scroll'){ const se=rq('#rfr').contentDocument.scrollingElement; if(se.scrollTop>4){ se.scrollBy({top:-R.H*.85,behavior:'smooth'}); return; } }
  else if(R.p>0){ R.p--; epubShow(true); epubSave(); return; }
  if(R.i>0) await epubLoad(R.i-1,'last','prev'); else epubShow(true);
}
// chapter changes: the page slides or fades out, the next chapter comes in
function rTurnOut(dir){ const fr=rq('#rfr'), t=RS().rturn; if(t==='none') return; const W=R.W, s=dir==='next'?-1:dir==='prev'?1:0;
  return [fr.animate(t==='slide'&&s?[{transform:'none'},{transform:`translateX(${s*W*.35}px)`,opacity:0}]:[{opacity:1},{opacity:0}],{duration:160,easing:'ease-in',fill:'forwards'}).finished.catch(()=>{}).then(()=>{},()=>{}),new Promise(r=>setTimeout(r,200))].reduce((a,b)=>Promise.race([a,b])); }
function rTurnIn(dir){ const fr=rq('#rfr'), t=RS().rturn; fr.getAnimations().forEach(a=>a.cancel()); if(t==='none') return; const W=R.W, s=dir==='next'?1:dir==='prev'?-1:0;
  return [fr.animate(t==='slide'&&s?[{transform:`translateX(${s*W*.35}px)`,opacity:0},{transform:'none',opacity:1}]:[{opacity:0},{opacity:1}],{duration:220,easing:'cubic-bezier(.22,.8,.24,1)'}).finished.catch(()=>{}),new Promise(r=>setTimeout(r,260))].reduce((a,b)=>Promise.race([a,b])); }
// which contents entry we're in
function epubChapterLabel(){
  const T=R.B.toc; let best=null; for(const t of T){ if(t.spine>=0&&t.spine<=R.i&&(!best||t.spine>=best.spine)) best=t; }
  return best?best.label:'';
}

// --- PDF ---
let PDFJS=null;
async function pdfLib(){
  if(PDFJS) return PDFJS;
  const base=new URL('pdfjs/',location.href).href;
  PDFJS=await import(base+'pdf.min.mjs'); PDFJS.GlobalWorkerOptions.workerSrc=base+'pdf.worker.min.mjs';
  return PDFJS;
}
async function pdfThumb(buf){
  const lib=await pdfLib(), pdf=await lib.getDocument({data:new Uint8Array(buf.slice(0))}).promise, pg=await pdf.getPage(1);
  const vp=pg.getViewport({scale:1}), sc=360/vp.height, v2=pg.getViewport({scale:sc}), c=document.createElement('canvas'); c.width=v2.width; c.height=v2.height;
  await pg.render({canvasContext:c.getContext('2d'),viewport:v2,intent:'print'}).promise; pdf.destroy();
  return await new Promise(r=>c.toBlob(r,'image/jpeg',.8));
}
async function pdfStart(buf){
  const lib=await pdfLib();
  R.pdf=await lib.getDocument({data:new Uint8Array(buf)}).promise; R.np=R.pdf.numPages;
  const st=rq('#rstage'); st.innerHTML='<div id="rpdf" tabindex="-1"></div>'; const box=rq('#rpdf');
  const p1=await R.pdf.getPage(1), v1=p1.getViewport({scale:1}); R.aspect=v1.height/v1.width; R.pg=[];
  box.innerHTML=Array.from({length:R.np},(_,i)=>`<div class="pg" data-pg="${i}"><span class="pgn">${i+1}</span></div>`).join('');
  pdfSize();
  R.io=new IntersectionObserver(es=>es.forEach(e=>{ const i=+e.target.dataset.pg; if(e.isIntersecting) pdfDraw(i); else pdfUndraw(i); }),{root:box,rootMargin:'120% 0px'});
  box.querySelectorAll('.pg').forEach(p=>R.io.observe(p));
  let tap=0;
  box.addEventListener('scroll',()=>{ clearTimeout(R.st); R.st=setTimeout(()=>{ pdfSave(); readerBar(); },150); readerBarLive(); });
  box.addEventListener('click',e=>{ if(Date.now()-tap<300) return; tap=Date.now(); R.chrome=!R.chrome; readerChrome(); });
  box.addEventListener('wheel',e=>{ if(!e.ctrlKey) return; e.preventDefault(); pdfZoom(Math.exp(-e.deltaY/120)); },{passive:false});
  box.addEventListener('dblclick',()=>pdfZoom(RS().rzoom>1.05?1/RS().rzoom:2));
  const pos=posGet(R.b)||{}; R.bm=pos.bm||[];
  pdfOutline();
  setTimeout(()=>{ pdfJump(pos.i||0,pos.f||0); readerBar(); },30);
  addEventListener('resize',()=>{ if(R.kind==='pdf'&&R.pdf){ const [i,f]=pdfWhere(); pdfSize(); pdfJump(i,f); } });
}
function pdfSize(){
  const box=rq('#rpdf'); if(!box) return; const W=Math.min(box.clientWidth-(phone()?0:48),phone()?9999:1000)*(RS().rzoom||1);
  R.pw=W; box.style.setProperty('--pw',W+'px'); box.style.setProperty('--ph',W*R.aspect+'px');
  box.classList.toggle('dark',RS().rpdfdark&&getComputedStyle(document.documentElement).colorScheme.includes('dark'));
  R.pg.forEach((c,i)=>{ if(c){ c.remove(); R.pg[i]=null; } });
  [...box.querySelectorAll('.pg')].forEach(p=>{ R.io&&(R.io.unobserve(p),R.io.observe(p)); });
}
async function pdfDraw(i){
  if(R.pg[i]||!R.pdf) return; const holder=rq(`#rpdf .pg[data-pg="${i}"]`); if(!holder) return;
  const c=document.createElement('canvas'); R.pg[i]=c; holder.appendChild(c);
  try{ const pg=await R.pdf.getPage(i+1), v=pg.getViewport({scale:1}), dpr=Math.min(2,devicePixelRatio||1), sc=R.pw/v.width*dpr, vp=pg.getViewport({scale:sc});
    if(R.pg[i]!==c) return; c.width=vp.width; c.height=vp.height; holder.style.height=(R.pw*v.height/v.width)+'px';
    await pg.render({canvasContext:c.getContext('2d'),viewport:vp}).promise; c.classList.add('on'); }catch(e){}
}
function pdfUndraw(i){ const c=R.pg[i]; if(c){ c.remove(); R.pg[i]=null; } }
function pdfWhere(){ const box=rq('#rpdf'); if(!box) return [0,0]; const mid=box.scrollTop+box.clientHeight*.3; const pages=box.querySelectorAll('.pg');
  for(let i=0;i<pages.length;i++){ const p=pages[i]; if(p.offsetTop+p.offsetHeight>mid) return [i,Math.max(0,(mid-p.offsetTop)/p.offsetHeight)]; } return [pages.length-1,0]; }
function pdfJump(i,f){ const box=rq('#rpdf'), p=box&&box.querySelectorAll('.pg')[Math.min(i,R.np-1)]; if(p) box.scrollTop=p.offsetTop+(f||0)*p.offsetHeight-box.clientHeight*.3*(f?1:0)-(f?0:8); }
function pdfStep(d){ const box=rq('#rpdf'); box.scrollBy({top:d*box.clientHeight*.88,behavior:'smooth'}); }
function pdfSave(){ const [i,f]=pdfWhere(); posSet(R.b,{i,f,pct:(i+f)/R.np,bm:R.bm}); }
function pdfZoom(m){ const z=Math.max(.5,Math.min(4,(RS().rzoom||1)*m)); const [i,f]=pdfWhere(); S.rzoom=z; save(); pdfSize(); pdfJump(i,f); }
async function pdfOutline(){
  R.ptoc=[]; try{ const out=await R.pdf.getOutline(); if(!out) return;
    const walk=async(items,depth)=>{ for(const it of items){ let pg=-1; try{ let dest=it.dest; if(typeof dest==='string') dest=await R.pdf.getDestination(dest); if(dest&&dest[0]) pg=await R.pdf.getPageIndex(dest[0]); }catch(e){} R.ptoc.push({label:it.title,page:pg,depth}); if(it.items&&it.items.length&&depth<3) await walk(it.items,depth+1); } };
    await walk(out,0); }catch(e){}
}

// --- bar, slider, keys ---
function readerBar(){
  const bar=rq('#rprog'); if(!bar||!R.b) return; let label='', pct=0;
  if(R.kind==='pdf'){ const [i,f]=pdfWhere(); pct=(i+f)/R.np; label=`Page ${i+1} of ${R.np}`; }
  else if(R.B){ const f=RS().rmode==='scroll'?epubScrollFrac():R.p/R.pages; pct=epubPct(RS().rmode==='scroll'?f:(R.p+1)/R.pages); const left=R.pages-1-R.p, ch=epubChapterLabel();
    label=(ch?`<b>${esc(ch)}</b> · `:'')+(RS().rmode==='scroll'?'':left>0?`${left} ${left===1?'page':'pages'} left in chapter`:'Last page in chapter'); }
  rq('#rlabel').innerHTML=label+` <span>${Math.round(pct*100)}%</span>`; if(!R.sliding) bar.value=Math.round(pct*1000);
  const bmOn=R.bm&&R.bm.some(x=>R.kind==='pdf'?x.i===pdfWhere()[0]:(x.i===R.i&&Math.abs(x.f-R.p/R.pages)<.5/R.pages));
  rq('#rbm').classList.toggle('on',!!bmOn);
}
function readerBarLive(){ if(R.kind==='pdf'){ const [i]=pdfWhere(); const l=rq('#rlabel'); if(l) l.firstChild&&(l.firstChild.textContent=`Page ${i+1} of ${R.np} `); } }
async function readerSeek(v){
  if(R.kind==='pdf'){ const x=v/1000*R.np; pdfJump(Math.floor(x),x%1); return; }
  const S2=R.B.spine, tot=S2.reduce((a,s)=>a+s.size,0); let want=v/1000*tot, i=0; while(i<S2.length-1&&want>S2[i].size){ want-=S2[i].size; i++; }
  const f=Math.min(.999,want/S2[i].size); if(i===R.i){ if(RS().rmode==='scroll'){ const se=rq('#rfr').contentDocument.scrollingElement; se.scrollTop=f*(se.scrollHeight-R.H); } else { R.p=Math.min(R.pages-1,Math.floor(f*R.pages)); epubShow(false); } epubSave(); } else await epubLoad(i,f);
}
function readerKey(e){
  if(!$('#rdr').classList.contains('open')||e.target.matches&&e.target.matches('input,textarea,select')) return;
  if(e.key==='Escape'){ if(rq('#rdr .rsh.open')) rsheet(null); else readerClose(); e.preventDefault(); return; }
  if(['ArrowRight','PageDown',' '].includes(e.key)&&!e.shiftKey){ e.preventDefault(); rNext(); }
  else if(['ArrowLeft','PageUp'].includes(e.key)||(e.key===' '&&e.shiftKey)){ e.preventDefault(); rPrev(); }
}
addEventListener('keydown',e=>{ if($('#rdr').classList.contains('open')){ readerKey(e); e.stopImmediatePropagation(); } else if($('#lib').classList.contains('open')&&e.key==='Escape'){ libClose(); } },true);

// --- sheets: contents, appearance, search ---
function rsheet(kind){
  const sh=rq('#rdr .rsh'); if(!kind){ sh.classList.remove('open'); $('#rdr').classList.remove('shopen'); return; }
  R.sheet=kind; sh.classList.add('open'); $('#rdr').classList.add('shopen'); R.chrome=true; readerChrome(); rsheetRender();
}
function rsheetRender(){
  const sh=rq('#rdr .rsh .rshb'), o=RS(), k=R.sheet;
  if(k==='toc'){
    const toc=R.kind==='pdf'?(R.ptoc||[]):(R.B?R.B.toc:[]), cur=R.kind==='pdf'?pdfWhere()[0]:R.i;
    const bms=(R.bm||[]).slice().sort((a,b)=>a.i-b.i||a.f-b.f);
    let curIdx=-1; toc.forEach((t,ix)=>{ const at=R.kind==='pdf'?t.page:t.spine; if(at>=0&&at<=cur) curIdx=ix; });
    sh.innerHTML=`<div class="rsseg"><button data-rtab="toc" class="${R.tab!=='bm'?'on':''}">Contents</button><button data-rtab="bm" class="${R.tab==='bm'?'on':''}">Bookmarks${bms.length?` (${bms.length})`:''}</button></div>`+
      (R.tab==='bm'?(bms.length?`<div class="rtoc">${bms.map((x,ix)=>`<div class="rbmrow"><button data-rbm="${ix}"><b>${esc(x.label||'Bookmark')}</b><small>${Math.round((x.pct||0)*100)}%</small></button><button class="rx" data-rbmdel="${ix}" aria-label="Remove">✕</button></div>`).join('')}</div>`:'<p class="rnote">Tap the bookmark at the top to mark a page.</p>')
      :(toc.length?`<div class="rtoc">${toc.map((t,ix)=>`<button data-rtoc="${ix}" class="${ix===curIdx?'on':''}" style="padding-left:${14+t.depth*16}px">${esc(t.label)}${R.kind==='pdf'&&t.page>=0?`<small>${t.page+1}</small>`:''}</button>`).join('')}</div>`:'<p class="rnote">This book has no table of contents.</p>'));
    R.tocList=toc; R.bmList=bms; const on=sh.querySelector('.rtoc .on'); if(on) on.scrollIntoView({block:'center'});
  } else if(k==='look'){
    const seg=(key,val,opts)=>`<span class="sseg">${opts.map(([v,l])=>`<button data-rset="${key}" data-v="${v}" class="${String(val)===String(v)?'on':''}">${l}</button>`).join('')}</span>`;
    const themes=[['auto','Auto','#fff','#1d1d1f'],['light','Light','#fff','#1d1d1f'],['sepia','Sepia','#f4ecd8','#3b3024'],['glass','Glass','#eef2f8','#1f2530'],['dark','Dark','#313338','#dbdee1'],['black','Black','#000','#e8e8ea']];
    sh.innerHTML=`<div class="rthemes">${themes.map(([k2,n,bg,ink])=>`<button data-rtheme="${k2}" class="${S.theme===k2?'on':''}"><span style="background:${bg};color:${ink}">Aa</span>${n}</button>`).join('')}</div>`+
      (R.kind==='pdf'?`<div class="sbox"><div class="srow"><span>Zoom</span><span class="stpr"><button class="stp" data-rzoom="-1">−</button><b>${Math.round((o.rzoom||1)*100)}%</b><button class="stp" data-rzoom="1">+</button></span></div>
        <div class="srow"><span>Fit width</span><button class="pill" data-rzoom="0">Fit</button></div>
        <button class="tg srow${o.rpdfdark?' on':''}" data-rtog="rpdfdark"><span class="lbl">Dark pages in dark themes</span><span class="sw"></span></button></div>`
      :`<div class="sbox"><div class="srow"><span>Size</span><span class="stpr"><button class="stp" data-rfs="-1" style="font-size:12px">A</button><b>${o.rfs}</b><button class="stp" data-rfs="1" style="font-size:17px">A</button></span></div>
        <div class="srow"><span>Line spacing</span>${seg('rlh',o.rlh,[[1.35,'Tight'],[1.6,'Normal'],[1.85,'Loose']])}</div>
        <div class="srow"><span>Margins</span>${seg('rmar',o.rmar,[[0,'S'],[1,'M'],[2,'L'],[3,'XL']])}</div>
        <button class="tg srow${o.rjust?' on':''}" data-rtog="rjust"><span class="lbl">Justify text</span><span class="sw"></span></button></div>
        <div class="sg">Layout</div><div class="sbox"><div class="srow"><span>Read in</span>${seg('rmode',o.rmode,[['pages','Pages'],['scroll','Scroll']])}</div>
        <div class="srow"><span>Page turn</span>${seg('rturn',o.rturn,[['slide','Slide'],['fade','Fade'],['none','None']])}</div></div>
        <div class="sg">Font</div><div class="rfonts">${RFONTS().map(([k2,n,st])=>`<button data-rfont="${k2}" class="${o.rfont===k2?'on':''}" style='font-family:${k2==='publisher'?'inherit':st}'>${esc(n)}</button>`).join('')}</div>`);
  } else if(k==='find'){
    sh.innerHTML=`<input id="rfind" type="search" placeholder="Search this book" value="${esc(R.q||'')}" autocomplete="off"><div class="rres" id="rres">${R.res?rresHTML():''}</div>`;
    setTimeout(()=>{ const i=rq('#rfind'); i&&i.focus(); },50);
  }
}
function rresHTML(){ if(!R.res.length) return `<p class="rnote">${R.searching?'Searching…':'Nothing found.'}</p>`; return `<p class="rnote">${R.res.length}${R.res.length>=300?'+':''} found${R.searching?' so far…':''}</p>`+R.res.map((x,ix)=>`<button data-rres="${ix}"><small>${esc(x.where)}</small><span>${x.html}</span></button>`).join(''); }
async function readerSearch(q){
  R.q=q; R.res=[]; const tok=R.sTok=(R.sTok||0)+1; q=q.trim(); if(q.length<2){ R.res=null; rq('#rres').innerHTML=''; return; }
  R.searching=true; const ql=q.toLowerCase(), snip=(t,at)=>{ const a=Math.max(0,at-50), b=Math.min(t.length,at+q.length+70); return (a?'…':'')+esc(t.slice(a,at))+'<mark>'+esc(t.slice(at,at+q.length))+'</mark>'+esc(t.slice(at+q.length,b))+(b<t.length?'…':''); };
  const n=R.kind==='pdf'?R.np:R.B.spine.length;
  for(let i=0;i<n&&R.res.length<300;i++){
    let t='';
    if(R.kind==='pdf'){ const pg=await R.pdf.getPage(i+1); t=(await pg.getTextContent()).items.map(x=>x.str).join(' '); }
    else { const s=await R.B.z.text(R.B.spine[i].href)||''; t=(parseXML(s,'application/xhtml+xml').body||{textContent:''}).textContent; }
    if(tok!==R.sTok) return;
    t=t.replace(/\s+/g,' '); const tl=t.toLowerCase(); let at=tl.indexOf(ql), k=0;
    while(at>=0&&R.res.length<300){ R.res.push({i,k,at,where:R.kind==='pdf'?`Page ${i+1}`:(R.B.toc.filter(x=>x.spine>=0&&x.spine<=i).pop()||{label:`Part ${i+1}`}).label,html:snip(t,at)}); at=tl.indexOf(ql,at+ql.length); k++; }
    if(i%8===7&&rq('#rres')){ rq('#rres').innerHTML=rresHTML(); await new Promise(r=>setTimeout(r)); }
  }
  R.searching=false; if(rq('#rres')) rq('#rres').innerHTML=rresHTML();
}
async function readerGoResult(x){
  rsheet(null);
  if(R.kind==='pdf'){ pdfJump(x.i,0); return; }
  if(x.i!==R.i) await epubLoad(x.i,0,'fade');
  const d=rq('#rfr').contentDocument, w=d.createTreeWalker(d.body,NodeFilter.SHOW_TEXT), ql=R.q.trim().toLowerCase(); let n, k=0;
  while((n=w.nextNode())){ let at=n.data.toLowerCase().indexOf(ql); while(at>=0){ if(k===x.k){ const r=d.createRange(); r.setStart(n,at); r.setEnd(n,at+ql.length); const sel=d.getSelection(); sel.removeAllRanges(); sel.addRange(r);
    if(RS().rmode==='scroll') n.parentElement.scrollIntoView({block:'center'}); else { const rc=r.getBoundingClientRect(), tf=new DOMMatrix(getComputedStyle(d.body).transform).m41||0; R.p=Math.max(0,Math.min(R.pages-1,Math.floor((rc.left-tf)/R.W))); epubShow(false); } epubSave(); return; } k++; at=n.data.toLowerCase().indexOf(ql,at+1); } }
}
function readerToggleBm(){
  if(!R.b) return; R.bm=R.bm||[];
  if(R.kind==='pdf'){ const [i]=pdfWhere(); const ix=R.bm.findIndex(x=>x.i===i); if(ix>=0) R.bm.splice(ix,1); else R.bm.push({i,f:0,pct:i/R.np,label:`Page ${i+1}`,t:Date.now()}); pdfSave(); }
  else { const f=R.p/R.pages, ix=R.bm.findIndex(x=>x.i===R.i&&Math.abs(x.f-f)<.5/R.pages);
    if(ix>=0) R.bm.splice(ix,1); else { const d=rq('#rfr').contentDocument; let txt=''; const r=d.caretRangeFromPoint?d.caretRangeFromPoint(R.W*(.1),R.H*.25):null; if(r&&r.startContainer.nodeType===3) txt=r.startContainer.data.slice(r.startOffset).trim().slice(0,60);
      R.bm.push({i:R.i,f,pct:epubPct(f),label:(epubChapterLabel()||'Bookmark')+(txt?' — '+txt+'…':''),t:Date.now()}); }
    epubSave(); }
  readerBar(); toast(rq('#rbm').classList.contains('on')?'Bookmarked':'Bookmark removed');
}
$('#rdr').addEventListener('click',async e=>{
  const t=e.target.closest('button'); if(!t){ if(e.target.closest('.rshbg')) rsheet(null); return; }
  const o=RS();
  if('rclose' in t.dataset){ readerClose(); }
  else if(t.dataset.rsheet){ R.sheet===t.dataset.rsheet&&rq('#rdr .rsh.open')?rsheet(null):rsheet(t.dataset.rsheet); }
  else if('rbmk' in t.dataset) readerToggleBm();
  else if('rren' in t.dataset){ if(R.b) bookActions(R.b); }
  else if(t.dataset.rtab){ R.tab=t.dataset.rtab; rsheetRender(); }
  else if(t.dataset.rtoc){ const x=R.tocList[+t.dataset.rtoc]; rsheet(null); if(R.kind==='pdf'){ if(x.page>=0) pdfJump(x.page,0); } else if(x.href) epubGoHref(x.href); }
  else if(t.dataset.rbm){ const x=R.bmList[+t.dataset.rbm]; rsheet(null); if(R.kind==='pdf') pdfJump(x.i,0); else if(x.i===R.i){ R.p=Math.min(R.pages-1,Math.round(x.f*R.pages)); epubShow(true); epubSave(); } else epubLoad(x.i,x.f,'fade'); }
  else if(t.dataset.rbmdel){ const x=R.bmList[+t.dataset.rbmdel]; R.bm=R.bm.filter(y=>y!==x); R.kind==='pdf'?pdfSave():epubSave(); rsheetRender(); readerBar(); }
  else if(t.dataset.rres){ readerGoResult(R.res[+t.dataset.rres]); }
  else if(t.dataset.rtheme){ S.theme=t.dataset.rtheme; syncControls(); save(); readerRestyle(); rsheetRender(); }
  else if(t.dataset.rfs){ S.rfs=Math.max(13,Math.min(34,o.rfs+ +t.dataset.rfs)); save(); readerRestyle(); rsheetRender(); }
  else if(t.dataset.rset){ const k=t.dataset.rset, v=t.dataset.v; S[k]=isNaN(+v)?v:+v; save(); readerRestyle(); rsheetRender(); }
  else if(t.dataset.rtog){ S[t.dataset.rtog]=!o[t.dataset.rtog]; save(); readerRestyle(); rsheetRender(); }
  else if(t.dataset.rfont){ S.rfont=t.dataset.rfont; save(); readerRestyle(); rsheetRender(); }
  else if(t.dataset.rzoom!==undefined){ const z=+t.dataset.rzoom; if(z===0){ const [i,f]=pdfWhere(); S.rzoom=1; save(); pdfSize(); pdfJump(i,f); } else pdfZoom(z>0?1.2:1/1.2); rsheetRender(); }
});
$('#rdr').addEventListener('input',e=>{
  if(e.target.id==='rprog'){ R.sliding=true; const v=+e.target.value; rq('#rlabel span')&&(rq('#rlabel span').textContent=Math.round(v/10)+'%'); clearTimeout(R.sl); R.sl=setTimeout(()=>readerSeek(v),R.kind==='pdf'?0:160); }
  if(e.target.id==='rfind'){ clearTimeout(R.ft); R.ft=setTimeout(()=>readerSearch(e.target.value),300); }
});
$('#rdr').addEventListener('change',e=>{ if(e.target.id==='rprog'){ R.sliding=false; readerSeek(+e.target.value); } });
function readerRestyle(){
  if(R.kind==='pdf'){ const [i,f]=pdfWhere(); pdfSize(); pdfJump(i,f); return; }
  if(!R.B) return; const wasScroll=rq('#rfr').contentDocument.documentElement.style.overflowY; const f=RS().rmode==='scroll'?R.p/R.pages:(R.pages>1?R.p/R.pages:0);
  epubStyle(); epubMeasure(); R.p=Math.min(R.pages-1,Math.round(f*R.pages)); epubShow(false); epubSave();
}
// keep the reader's page in step with app theme changes (Automatic switching at night)
matchMedia('(prefers-color-scheme:dark)').addEventListener('change',()=>{ if(R.b) setTimeout(readerRestyle,50); });

// ---------- no zooming the app (iPhone ignores "no zoom" in the viewport, so stop the gesture) ----------
// Pinching a PDF zooms its pages instead.
{ let z0=1;
  const stop=e=>{ if(R.kind==='pdf'&&$('#rdr').classList.contains('open')&&e.target.closest&&e.target.closest('#rpdf')) return; e.preventDefault(); };
  document.addEventListener('gesturestart',e=>{ z0=RS().rzoom||1; stop(e); },{passive:false});
  document.addEventListener('gesturechange',stop,{passive:false});
  document.addEventListener('gestureend',e=>{ if(R.kind==='pdf'&&$('#rdr').classList.contains('open')&&e.target.closest&&e.target.closest('#rpdf')){ e.preventDefault(); const z=Math.max(.5,Math.min(4,z0*e.scale)); if(Math.abs(z-(RS().rzoom||1))>.02) pdfZoom(z/(RS().rzoom||1)); } else e.preventDefault(); },{passive:false});
  document.addEventListener('touchmove',e=>{ if(e.touches.length>1&&!(R.kind==='pdf'&&e.target.closest&&e.target.closest('#rpdf'))) e.preventDefault(); },{passive:false});
}
