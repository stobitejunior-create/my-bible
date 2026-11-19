import json,re,difflib
from books import *
# 1. kaiserlik KJV
kjv=[]
for k in KAI:
    _raw=open(f'/tmp/kjv/{k}.json',encoding='utf-8').read(); d={'x':{m.group(1):{'en':json.loads('"'+m.group(2)+'"')} for m in re.finditer(r'"([^"|]+\|\d+\|\d+)"\s*:\s*\{\s*"en"\s*:\s*"((?:[^"\\\\]|\\\\.)*)"',_raw) if m.group(1).split('|')[0]==k}}
    allv={}
    for ch in d.values():
        for kk,vv in ch.items():
            _,c_,v_=kk.split('|'); allv[(int(c_),int(v_))]=vv['en'].strip()
    nch=max(c_ for c_,_ in allv)
    book=[]
    for c_ in range(1,nch+1):
        nums=sorted(v_ for cc,v_ in allv if cc==c_)
        assert nums==list(range(1,len(nums)+1)),(k,c_,nums[:5],len(nums))
        book.append([allv[(c_,v_)] for v_ in nums])
    kjv.append(book)
allt=''.join(v for b in kjv for c in b for v in c)
print('verses',sum(len(c) for b in kjv for c in b), 'braces', allt.count('{'),allt.count('}'),allt.count('«'), set(re.findall(r'<[^>]+>',allt)))

# --- repair words the scraped KJV dropped, using the OSIS KJV text
_s=open('/tmp/eng-kjv.osis.xml',encoding='utf-8').read()
_os={};_cur=None
for _m in re.finditer(r'<verse osisID="([^"]+)"[^>]*/>|<verse eID[^>]*/>|<note.*?</note>|<[^>]+>|([^<]+)',_s,re.S):
    if _m.group(1): _cur=_m.group(1); _os[_cur]=[]
    elif _m.group(0).startswith('<verse eID'): _cur=None
    elif _m.group(2) and _cur: _os[_cur].append(_m.group(2))
_W=re.compile(r"\[\[|\]\]|\[[HG]\d+\]|</?em>|([A-Za-z]+)")
fixed=0
for bi,b in enumerate(kjv):
    for ci,c in enumerate(b):
        for vi,raw in enumerate(c):
            ot=re.sub(r'\s+',' ',''.join(_os.get(f'{OSIS[bi]}.{ci+1}.{vi+1}',[]))).strip()
            if not ot: continue
            ow=[(m.start(),m.end(),m.group(0)) for m in re.finditer(r"[A-Za-z]+",ot)]
            kw=[(m.start(),m.end(),m.group(1)) for m in _W.finditer(raw) if m.group(1)]
            if len(ow)<=len(kw): continue
            sm=difflib.SequenceMatcher(None,[w[2].lower() for w in kw],[w[2].lower() for w in ow],autojunk=False)
            ins=[]
            for tag,i1,i2,j1,j2 in sm.get_opcodes():
                if tag!='insert': continue
                if j2==len(ow): txt=ot[ow[j1][0]:].strip()
                else: txt=ot[ow[j1][0]:ow[j2-1][1]]
                if i1<len(kw):
                    pos=kw[i1][0]; ins.append((pos,txt+' '))
                else:
                    tail=raw.rstrip()
                    # drop a dangling end punctuation duplicate
                    ins.append((len(tail),' '+txt))
            for pos,txt in sorted(ins,reverse=True): raw=raw[:pos]+txt+raw[pos:]
            if ins: c[vi]=re.sub(r'  +',' ',raw).strip(); fixed+=1
print('repaired verses',fixed)
print(kjv[0][0][8]); print(kjv[1][19][4]); print(kjv[0][0][15])

# 2. OSIS red letters
s=open('/tmp/eng-kjv.osis.xml',encoding='utf-8').read()
red={}  # (osisbook,ch,v) -> list of (word,isred)
cur=None; inred=False
tok=re.compile(r'<verse osisID="([^"]+)"[^>]*/>|<verse eID[^>]*/>|<q who="Jesus"[^>]*sID[^>]*/>|<q [^>]*eID[^>]*/>|<note.*?</note>|<[^>]+>|([^<]+)',re.S)
for m in tok.finditer(s):
    t=m.group(0)
    if m.group(1): cur=m.group(1); red.setdefault(cur,[]); continue
    if t.startswith('<verse eID'): cur=None; continue
    if t.startswith('<q who="Jesus"') and 'sID' in t: inred=True; continue
    if t.startswith('<q ') and 'eID' in t: inred=False; continue
    if m.group(2) and cur:
        for w in re.findall(r"[A-Za-z]+",m.group(2)): red[cur].append((w.lower(),inred))
print('osis verses',len(red), sum(1 for v in red.values() if any(r for _,r in v)))
WORD=re.compile(r"\[\[|\]\]|\[[HG]\d+\]|</?em>|([A-Za-z]+(?:['’][A-Za-z]+)*)")
def words(raw):
    return [(m.start(),m.end(),m.group(1)) for m in WORD.finditer(raw) if m.group(1)]
stats=[0,0]
for bi,b in enumerate(kjv):
    if bi<39: continue
    for ci,c in enumerate(b):
        for vi,raw in enumerate(c):
            key=f'{OSIS[bi]}.{ci+1}.{vi+1}'
            o=red.get(key,[])
            if not any(r for _,r in o): continue
            ws=words(raw)
            a=[w.lower() for _,_,w in ws]; bw=[w for w,_ in o]
            flags=[False]*len(ws)
            sm=difflib.SequenceMatcher(None,a,bw,autojunk=False)
            for tag,i1,i2,j1,j2 in sm.get_opcodes():
                if tag=='equal':
                    for k in range(i2-i1): flags[i1+k]=o[j1+k][1]
                elif tag=='replace':
                    rr=[o[j][1] for j in range(j1,j2)]
                    val=sum(rr)>len(rr)/2
                    for k in range(i1,i2): flags[k]=val
            # smooth isolated gaps of 1 word between reds
            for k in range(1,len(flags)-1):
                if not flags[k] and flags[k-1] and flags[k+1]: flags[k]=True
            stats[0]+=1; stats[1]+=sm.ratio()<0.9
            # insert markers
            out=[];pos=0;k=0;n=len(ws)
            while k<n:
                if flags[k]:
                    j=k
                    while j+1<n and flags[j+1]: j+=1
                    st=ws[k][0]
                    en=ws[j+1][0] if j+1<n else len(raw)
                    seg=raw[st:en]; stripped=seg.rstrip()
                    out.append(raw[pos:st]); out.append('{'+stripped+'}'); pos=st+len(stripped); k=j+1
                else: k+=1
            out.append(raw[pos:]); c[vi]=''.join(out)
print('red verses',stats)
json.dump(kjv,open('kjv_red.json','w'),ensure_ascii=False)
print(kjv[39][4][2]); print(kjv[42][2][15]); print(kjv[42][2][2])
