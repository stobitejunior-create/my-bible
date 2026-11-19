import json,re,gzip,base64
m=json.load(open('marked.json'))
def lexload(p,var):
    s=open(p,encoding='utf-8').read(); s=s[s.index('{',s.index(var)):]; s=s[:s.rindex('}')+1]
    return json.loads(s)
lex={}
for p,v in [('/tmp/strongs/hebrew/strongs-hebrew-dictionary.js','strongsHebrewDictionary'),('/tmp/strongs/greek/strongs-greek-dictionary.js','strongsGreekDictionary')]:
    d=lexload(p,v)
    for k,x in d.items():
        lex[k]=[x.get('lemma',''),x.get('translit') or x.get('xlit',''),x.get('pron',''),x.get('strongs_def','').strip(),x.get('kjv_def','').strip(),x.get('derivation','').strip()]
print(len(lex), lex['H430'], lex['G25'])
for name in ('kjv','web','bsb'):
    b=json.dumps(m[name],ensure_ascii=False,separators=(',',':')).encode()
    g=gzip.compress(b,9); open(f'{name}.b64','w').write(base64.b64encode(g).decode())
    print(name,len(b)//1024,'KB raw',len(g)//1024,'KB gz')
b=json.dumps(lex,ensure_ascii=False,separators=(',',':')).encode(); g=gzip.compress(b,9)
open('lex.b64','w').write(base64.b64encode(g).decode()); print('lex',len(b)//1024,len(g)//1024)
