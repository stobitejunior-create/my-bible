import re,json,pickle
from books import *
kjv=json.load(open('kjv_red.json'))
verses,cov=pickle.load(open('cov.pkl','rb'))
TAG=re.compile(r'\[H(\d+)\]')
heb={}  # (usfm,c,v)-> list of word strongs (int or None)
for bi in range(39):
    s=open(f'/tmp/morphhb/wlc/{OSIS[bi]}.xml',encoding='utf-8').read()
    for m in re.finditer(r'<verse osisID="[^.]+\.(\d+)\.(\d+)">(.*?)</verse>',s,re.S):
        ws=[]
        for w in re.finditer(r'<w lemma="([^"]*)"',m.group(3)):
            nums=re.findall(r'\d+',w.group(1)); ws.append(int(nums[-1]) if nums else None)
        heb[(USFM[bi],int(m.group(1)),int(m.group(2)))]=ws
# compare word counts with Clear
same=diff=0
for k,ws in heb.items():
    if k in verses:
        if len(verses[k])==len(ws): same+=1
        else: diff+=1
print('wordcount same',same,'diff',diff)
hmap={}  # (usfm,c,v) hebrew -> (bi,ci,vi) english 0-based
for bi in range(39):
    H=sorted([k for k in heb if k[0]==USFM[bi]],key=lambda k:(k[1],k[2]))
    K=[(ci,vi) for ci,ch in enumerate(kjv[bi]) for vi,_ in enumerate(ch)]
    Hs=[set(x for x in heb[k] if x) for k in H]
    Ks=[set(int(x) for x in TAG.findall(kjv[bi][ci][vi])) for ci,vi in K]
    n,m=len(H),len(K); band=max(12,abs(n-m)+12)
    NEG=-1e9; GAP=-0.25
    score={}; back={}
    score[(0,0)]=0
    for i in range(n+1):
        jc=round(i*m/n) if n else 0
        for j in range(max(0,jc-band),min(m,jc+band)+1):
            if i==0 and j==0: continue
            best=NEG;bk=None
            if i>0 and j>0 and (i-1,j-1) in score:
                a,b=Hs[i-1],Ks[j-1]; sim=len(a&b)/(len(a|b) or 1)
                v=score[(i-1,j-1)]+sim
                if v>best: best,bk=v,'d'
            if i>0 and (i-1,j) in score:
                v=score[(i-1,j)]+GAP
                if v>best: best,bk=v,'h'
            if j>0 and (i,j-1) in score:
                v=score[(i,j-1)]+GAP
                if v>best: best,bk=v,'k'
            if bk: score[(i,j)]=best; back[(i,j)]=bk
    i,j=n,m; pairs=[]
    while i>0 or j>0:
        bk=back[(i,j)]
        if bk=='d': pairs.append((i-1,j-1)); i-=1;j-=1
        elif bk=='h': pairs.append((i-1,None)); i-=1
        else: j-=1
    pairs.reverse()
    last=0
    for hi,kj in pairs:
        if kj is None:
            # choose best neighbour
            cands=[x for x in (last,last+1) if x<m]
            kj=max(cands,key=lambda x:len(Hs[hi]&Ks[x])) if cands else last
        hmap[H[hi]]=(bi,)+K[kj]; last=kj
    shifted=[(H[hi],K[kj]) for hi,kj in pairs if kj is not None and (H[hi][1]-1,H[hi][2]-1)!=K[kj]]
    if shifted: print(USFM[bi],len(shifted),shifted[:2])
pickle.dump((heb,hmap),open('hmap.pkl','wb'))
for k in [('MAL',3,19),('JOL',3,1),('EZK',21,1),('PSA',3,9),('PSA',51,3),('JOB',40,25),('GEN',1,3)]:
    print(k,'->',hmap.get(k))
