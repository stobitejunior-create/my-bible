import csv,json,pickle
from books import *
stream=[];pos={}
for line in open('/tmp/sq/tsv/alignment-quotations-clear.tsv',encoding='utf-8'):
    p=line.rstrip('\n').split('\t')
    if len(p)<5 or not p[1].isdigit(): continue
    ref=p[3]  # GEN 3:1!10-1
    b,rest=ref.split(' ',1); cv,wp=rest.split('!'); c,v=cv.split(':'); w=int(wp.split('-')[0])
    i=p[1]; ok=(int(i[2:5])==int(c) and int(i[5:8])==int(v))
    if p[2] not in pos or ok: pos[p[2]]=len(stream)
    stream.append((b,int(c),int(v),w))
print('parts',len(stream))
DIV={'God':'G','Holy Spirit, the':'G','Jesus':'J','Jesus (child)':'J'}
flag=[None]*len(stream); miss=0
for r in csv.DictReader(open('/tmp/sq/tsv/Clear-Aligned-Projections.tsv',encoding='utf-8'),delimiter='\t'):
    sp=DIV.get(r['SPEAKER (FCBH)'])
    if not sp: continue
    a,b=r['CLEAR START'],r['CLEAR END']
    if a not in pos or b not in pos: miss+=1; continue
    if pos[b]<pos[a] or stream[pos[a]][0]!=stream[pos[b]][0]: miss+=1; continue
    for i in range(pos[a],pos[b]+1): flag[i]=sp
print('missing',miss)
# per verse: {word: flag}
verses={}
for i,(b,c,v,w) in enumerate(stream):
    d=verses.setdefault((b,c,v),{})
    if w not in d or d[w] is None: d[w]=flag[i]
cov={}
for k,d in verses.items():
    ws=sorted(d); fl=[d[w] for w in ws]
    if any(fl): cov[k]=fl
print('verses with divine speech',len(cov), sum(1 for k in cov if k[0] in USFM[:39]))
pickle.dump((verses,cov),open('cov.pkl','wb'))
