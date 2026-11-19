import re,json,pickle,math
from books import *
kjv=json.load(open('kjv_red.json')); web=json.load(open('web.json')); bsb=json.load(open('bsb.json'))
verses,cov=pickle.load(open('cov.pkl','rb'))
heb,hmap=pickle.load(open('hmap.pkl','rb'))
BI={u:i for i,u in enumerate(USFM)}
# gather per english verse: list of (flags, hebrew strongs or None)
target={}
for k,fl in cov.items():
    b,c,v=k; bi=BI[b]
    if bi<39:
        if k not in hmap: continue
        e=hmap[k]; ws=heb.get(k)
        if ws is not None and len(ws)!=len(fl): ws=None
    else:
        e=(bi,c-1,v-1); ws=None
    # include full (non-divine) hebrew verses mapped to same english verse? keep simple
    target.setdefault(e,[]).append((fl,ws))
print('target verses',len(target))
WORD=re.compile(r"\[\[|\]\]|\[[HG]\d+\]|</?em>|([A-Za-z]+(?:['’][A-Za-z]+)*)")
def kwords(raw): return [(m.start(),m.end()) for m in WORD.finditer(raw) if m.group(1)]
def wrap(raw,s,e,o,c):
    # s,e char offsets; keep <em> pairs intact
    while raw[:s].endswith('<em>'): s-=4
    while raw[e:].startswith('</em>'): e+=5
    seg=raw[s:e]
    if seg.count('<em>')>seg.count('</em>'):
        j=raw.find('</em>',e); e=j+5 if j>=0 else e
    elif seg.count('</em>')>seg.count('<em>'):
        j=raw.rfind('<em>',0,s); s=j if j>=0 else s
    seg=raw[s:e]
    if '{' in seg or '}' in seg or '«' in seg: return raw
    st=len(seg)-len(seg.lstrip()); seg=seg.strip()
    return raw[:s+st]+o+seg+c+raw[s+st+len(seg):]
def title_end(raw):
    i=raw.find(']]')
    if raw.startswith('[[') and i>0:
        j=i+2
        while j<len(raw) and (raw[j]==' ' or raw[j]=='['): 
            if raw[j]=='[':
                m=re.match(r'\[[HG]\d+\]',raw[j:]); 
                if not m: break
                j+=len(m.group(0))
            else: j+=1
        return j
    return 0
PUN=',;:.?!'
def frac_range(raw,ws,a,b):
    m=len(ws); s=int(a*m); e=max(s,math.ceil(b*m)-1)
    def after_p(i): return i==0 or any(ch in PUN for ch in raw[ws[i-1][1]:ws[i][0]])
    def end_p(i): return i==m-1 or any(ch in PUN for ch in raw[ws[i][1]:ws[i+1][0]])
    for d in range(0,4):
        if s-d>=0 and after_p(s-d): s=s-d;break
        if s+d<m and after_p(s+d): s=s+d;break
    for d in range(0,4):
        if e+d<m and end_p(e+d): e=e+d;break
        if e-d>=s and end_p(e-d): e=e-d;break
    return s,e
_TAIL=re.compile(r'\[[HG]\d+\]|</em>|[,;:.?!’”\'")\]]+')
def end_char(raw,ws,e):
    if e+1>=len(ws): return len(raw)
    j=ws[e][1]
    while True:
        m=_TAIL.match(raw,j)
        if not m: break
        j=m.end()
    return j
def cover(entries):
    fl=[x for f,_ in entries for x in f]
    n=len(fl); idx=[i for i,x in enumerate(fl) if x]
    return len(idx)/n, idx[0]/n, (idx[-1]+1)/n
stat={'whole':0,'strong':0,'frac':0,'quote':0,'skip':0}
def mark_kjv(bi,ci,vi,entries,sp):
    raw=kjv[bi][ci][vi]
    if sp=='J' : return  # handled by OSIS red letters
    f,a,b=cover(entries)
    ws=kwords(raw)
    if not ws: return
    t0=title_end(raw)
    if f>=0.92:
        stat['whole']+=1; kjv[bi][ci][vi]=wrap(raw,t0,len(raw),'«','»'); return
    rng=None
    if len(entries)==1 and entries[0][1] is not None:
        fl,hw=entries[0]
        Q=set(h for h,x in zip(hw,fl) if x and h); N=set(h for h,x in zip(hw,fl) if not x and h)
        # phrase tags
        scores=[0]*len(ws); phrase=[]; tagged=False; wi=0
        for m in WORD.finditer(raw):
            if m.group(1):
                if tagged: phrase=[]; tagged=False
                phrase.append(wi); wi+=1; continue
            t=re.match(r'\[H(\d+)\]',m.group(0))
            if t:
                h=int(t.group(1)); sc=1 if (h in Q and h not in N) else (-1 if (h in N and h not in Q) else 0)
                for p in phrase: scores[p]+=sc
                tagged=True
        best=0;cur=0;cs=0;bs=be=None
        for i,sc in enumerate(scores):
            if cur<=0: cur=0;cs=i
            cur+=sc
            if cur>best: best=cur;bs=cs;be=i
        if best>=2:
            rng=(bs,be); stat['strong']+=1
    if rng is None:
        rng=frac_range(raw,ws,a,b); stat['frac']+=1
    s,e=rng
    if a<=0.08: s=0
    if b>=0.92: e=len(ws)-1
    # extend end over trailing untagged words until punctuation
    def gap(i): return raw[ws[i][1]:(ws[i+1][0] if i+1<len(ws) else len(raw))]
    while e+1<len(ws) and not any(ch in PUN for ch in gap(e)) and not re.search(r'\[[HG]\d+\]',gap(e+1)): e+=1
    kjv[bi][ci][vi]=wrap(raw,max(ws[s][0],t0),end_char(raw,ws,e),'«','»')

def qspans(text,inq):
    spans=[];st=0 if inq else None
    for i,ch in enumerate(text):
        if ch=='“':
            if st is None: st=i
        elif ch=='”':
            if st is not None: spans.append((st,i+1)); st=None
    if st is not None: spans.append((st,len(text)))
    return spans, st is not None
SAYV=re.compile(r'\b(said|says|say|replied|asked|answered|declares|declared|continued|told|cried|exclaimed|went on|added)\b',re.I)
def merge_spans(text,spans):
    out=[]
    for sp in spans:
        if out:
            gap=text[out[-1][1]:sp[0]]
            if len(gap)<=40 and SAYV.search(gap) and not re.search(r'[.!?]\s',gap.strip()[:-1] if gap.strip().endswith(('.',',',':')) else gap):
                out[-1]=(out[-1][0],sp[1],out[-1][2]+[sp]); continue
        out.append((sp[0],sp[1],[sp]))
    return out
def mwords(t): return [(m.start(),m.end()) for m in re.finditer(r"[A-Za-z0-9’']+",t)]
def mark_modern(arr,bi,ci,vi,entries,sp,spans,oc):
    if ci>=len(arr[bi]) or vi>=len(arr[bi][ci]): return
    raw=arr[bi][ci][vi]
    if not raw: return
    f,a,b=cover(entries)
    t0=title_end(raw)
    if f>=0.92:
        arr[bi][ci][vi]=wrap(raw,t0,len(raw),*oc); stat['whole']+=1; return
    L=len(raw); lo=(a-0.08)*L; hi=(b+0.08)*L
    sel=[g for g in spans if lo<=(g[0]+g[1])/2<=hi]
    if not sel and spans:
        ov=[(min(g[1],b*L)-max(g[0],a*L),i) for i,g in enumerate(spans)]
        ov=[o for o in ov if o[0]>0]
        if ov: sel=[spans[max(ov)[1]]]
    if sel:
        stat['quote']+=1
        parts=[p for g in sel for p in g[2]]
        # contiguous-enough parts from first to last selected group
        for x,y in sorted(parts,reverse=True):
            raw=wrap(raw,max(x,t0),y,*oc)
        arr[bi][ci][vi]=raw; return
    ws=mwords(raw)
    if not ws: return
    s,e=frac_range(raw,ws,a,b); stat['frac']+=1
    arr[bi][ci][vi]=wrap(raw,max(ws[s][0],t0),end_char(raw,ws,e),*oc)

# speaker per english verse
def sp_of(entries):
    fl=[x for f,_ in entries for x in f if x]
    return 'J' if fl.count('J')>len(fl)/2 else 'G'
def split(entries):
    sps=set(x for f,_ in entries for x in f if x)
    return [(sp,[([x if x==sp else None for x in f],w) for f,w in entries]) for sp in sorted(sps)]
for (bi,ci,vi),entries in sorted(target.items()):
    if ci<len(kjv[bi]) and vi<len(kjv[bi][ci]):
        for sp,en in split(entries): mark_kjv(bi,ci,vi,en,sp)
print('kjv',stat)
for name,arr,dojesus in [('web',web,False),('bsb',bsb,True)]:
    for k in stat: stat[k]=0
    for bi,book in enumerate(arr):
        for ci,ch in enumerate(book):
            inq=False; sp_list=[]
            for vi,t in enumerate(ch):
                clean=t.replace('{','').replace('}','')
                sps,inq2=qspans(t,inq)
                sp_list.append(merge_spans(t,sps)); inq=inq2
            for vi,t in enumerate(ch):
                e=target.get((bi,ci,vi))
                if not e: continue
                for sp,en in split(e):
                    if sp=='J' and not dojesus: continue
                    mark_modern(arr,bi,ci,vi,en,sp,sp_list[vi],('{','}') if sp=='J' else ('«','»'))
    print(name,stat)
json.dump({'kjv':kjv,'web':web,'bsb':bsb},open('marked.json','w'),ensure_ascii=False)
def show(ref):
    bi,c,v=ref
    print(NAMES[bi],c,v); 
    for n,a in (('KJV',kjv),('WEB',web),('BSB',bsb)): print('  ',n,a[bi][c-1][v-1][:400])
for r in [(0,1,3),(0,12,14),(1,3,4),(1,20,2),(22,1,11),(22,1,18),(25,20,45),(28,2,28),(38,4,5),(39,3,17),(42,12,28),(17,38,4),(18,46,10),(39,5,3),(42,3,3)]: show(r)
