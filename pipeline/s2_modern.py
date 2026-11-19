import re,json
from books import *
def parse(path):
    s=open(path,encoding='utf-8').read()
    out={}
    book=None;ch=0;v=None;buf=None;skip=0;title=None
    tok=re.compile(r'<book id="([A-Z0-9]+)"|<c id="(\d+)"\s*/>|<v id="(\d+)[^"]*"[^>]*/>|<ve\s*/>|<(f|x|s|h|toc|id)\b[^>]*?(/?)>|</(f|x|s|h|toc|id)>|<d\b[^>]*>|</d>|<wj>|</wj>|<[^>]+>|([^<]+)')
    ind=False;wj=False
    for m in tok.finditer(s):
        t=m.group(0)
        if m.group(1): book=m.group(1); out[book]=[]; ch=0; continue
        if m.group(2): ch=int(m.group(2)); out[book].append([]); continue
        if m.group(3):
            v=int(m.group(3)); buf=[]
            if title is not None and v==1: buf.append('[['+re.sub(r'\s+',' ',''.join(title)).strip()+']] ')
            title=None
            if wj: buf.append('{')
            continue
        if t.startswith('<ve'):
            if buf is not None:
                if wj: buf.append('}')
                txt=re.sub(r'\s+',' ',''.join(buf)).strip()
                txt=re.sub(r'\{\s*\}','',txt).replace('} {',' ').replace('}{','').replace(' }','} ').replace('{ ',' {').strip()
                vs=out[book][-1]
                while len(vs)<v-1: vs.append('')
                if len(vs)>=v: vs[v-1]=(vs[v-1]+' '+txt).strip()
                else: vs.append(txt)
            buf=None; continue
        if m.group(4) and not m.group(5): skip+=1; continue
        if m.group(6): skip=max(0,skip-1); continue
        if t.startswith('<d'): title=[]; ind=True; continue
        if t=='</d>': ind=False; continue
        if t=='<wj>':
            wj=True
            if buf is not None and not skip: buf.append('{')
            continue
        if t=='</wj>':
            wj=False
            if buf is not None and not skip: buf.append('}')
            continue
        if m.group(7) is not None and not skip:
            txt=m.group(7).replace('\n',' ')
            if ind and buf is None: title.append(txt)
            elif buf is not None: buf.append(txt)
    return out
for name,path in [('web','/tmp/webbe.xml'),('bsb','/tmp/eng-bsb.usfx.xml')]:
    o=parse(path)
    arr=[o[u] for u in USFM]
    print(name,sum(len(c) for b in arr for c in b), [ (NAMES[i],len(b)) for i,b in enumerate(arr) if len(b)!=len(json.load(open('kjv_red.json'))[i])])
    json.dump(arr,open(name+'.json','w'),ensure_ascii=False)
    for bi,c,v in [(0,0,2),(18,2,0),(39,4,2),(42,2,15),(22,52,4),(18,50,0)]:
        print('  ',arr[bi][c][v][:220])
