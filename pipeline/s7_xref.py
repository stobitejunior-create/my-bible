import csv,json,gzip,base64
from books import *
OI={o:i for i,o in enumerate(OSIS)}
kjv=json.load(open('marked.json'))['kjv']
x=[[[[] for _ in c] for c in b] for b in kjv]
n=0
for r in csv.DictReader(open('/tmp/ob/cross_references_expanded.csv')):
    v=int(r['Votes'])
    if v<3: continue
    fb=OI.get(r['From Book']); tb=OI.get(r['To Verse start Book'])
    if fb is None or tb is None: continue
    fc,fv=int(r['From Chapter'])-1,int(r['From Verse number'])-1
    try: lst=x[fb][fc][fv]
    except IndexError: continue
    t=f"{tb}.{r['To Verse start Chapter']}.{r['To Verse start number']}"
    if r['To Verse end']:
        ec,ev=str(int(float(r['To Verse end Chapter']))),str(int(float(r['To Verse end number'])))
        t+=('-'+ev) if ec==r['To Verse start Chapter'] else f'-{ec}.{ev}'
    lst.append((v,t)); n+=1
out=[[[' '.join(t for _,t in sorted(l,reverse=True)[:30]) for l in c] for c in b] for b in x]
b=json.dumps(out,separators=(',',':')).encode(); g=gzip.compress(b,9)
open('xref.b64','w').write(base64.b64encode(g).decode())
print(n,len(b)//1024,len(g)//1024, out[42][2][15])
