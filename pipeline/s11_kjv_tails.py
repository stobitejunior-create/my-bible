"""Restore KJV verse endings that are still missing (e.g. Ps 3:1 ended "...they that rise up" without "against me.").

s1 already restored 3,435 cut-off verses from CrossWire, but some verses (mostly psalms with titles) were missed.
This compares every KJV verse with the CrossWire OSIS KJV (open-bibles eng-kjv.osis.xml) word by word; where our verse
is the start of CrossWire's verse and CrossWire has more, the missing words are added at the end (untagged, inside any
closing red-letter or God's-words mark). Nothing else changes, and running it again changes nothing.

Run from the project root:  python3 pipeline/s11_kjv_tails.py /path/to/eng-kjv.osis.xml
It fixes both data/base/kjv.b64 (the input to s8) and data/kjv.b64.
"""
import base64, gzip, json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
OSIS = 'Gen Exod Lev Num Deut Josh Judg Ruth 1Sam 2Sam 1Kgs 2Kgs 1Chr 2Chr Ezra Neh Esth Job Ps Prov Eccl Song Isa Jer Lam Ezek Dan Hos Joel Amos Obad Jonah Mic Nah Hab Zeph Hag Zech Mal Matt Mark Luke John Acts Rom 1Cor 2Cor Gal Eph Phil Col 1Thess 2Thess 1Tim 2Tim Titus Phlm Heb Jas 1Pet 2Pet 1John 2John 3John Jude Rev'.split()
SKIP = {'note', 'title', 'reference', 'rdg', 'milestone', 'header', 'work'}


def crosswire(path):
    """{'b.c.v': text} from an OSIS file with container or milestone verses."""
    root = ET.parse(path).getroot()
    out, cur = {}, [None]

    def walk(el):
        tag = el.tag.split('}')[-1]
        if tag in SKIP:
            if el.tail and cur[0]: out[cur[0]] += el.tail
            return
        if tag == 'verse':
            if el.get('eID'):
                cur[0] = None
            else:
                ref = (el.get('osisID') or el.get('sID') or '').split()[0].split('.')
                if ref[0] in OSIS:
                    cur[0] = f'{OSIS.index(ref[0])}.{ref[1]}.{ref[2]}'
                    out.setdefault(cur[0], '')
        if el.text and cur[0] and tag != 'verse': out[cur[0]] += el.text
        elif el.text and cur[0] and tag == 'verse' and not el.get('sID'): out[cur[0]] += el.text
        for ch in el:
            walk(ch)
        if el.tail and cur[0]: out[cur[0]] += el.tail
    walk(root)
    return {k: re.sub(r'\s+', ' ', v).strip() for k, v in out.items()}


words = lambda s: re.findall(r"[a-z0-9']+", s.lower().replace('’', "'"))
plain = lambda s: re.sub(r'\[\[.*?\]\]|\[[HG]\d+\]|</?em>|[{}«»]', '', s)


def fix(bible, cw):
    fixed = []
    for b, bk in enumerate(bible):
        for c, ch in enumerate(bk):
            for v, s in enumerate(ch):
                ref = cw.get(f'{b}.{c + 1}.{v + 1}')
                if not s or not ref:
                    continue
                ours, theirs = words(plain(s)), words(ref)
                if len(theirs) <= len(ours) or theirs[:len(ours)] != ours or not ours:
                    continue
                # find where our last word ends in CrossWire's text, and take everything after it
                n, pos = 0, 0
                for m in re.finditer(r"[A-Za-z0-9'’]+", ref):
                    n += 1
                    if n == len(ours):
                        pos = m.end(); break
                tail = ref[pos:].strip()
                tail = re.sub(r'^[,.;:]\s*', lambda m: m.group(0).strip(), tail)
                if not re.search(r'[A-Za-z]', tail):
                    continue
                body = s.rstrip()
                end = re.search(r'[{}«»]*$', body).group(0)          # keep closing marks after the restored words
                core = body[:len(body) - len(end)] if end else body
                sep = '' if re.match(r'^[,.;:!?]', tail) else ' '
                ch[v] = core + sep + tail + end
                fixed.append((b, c, v, tail))
    return fixed


# Five more endings the word-by-word check can't line up (CrossWire spells e.g. "Jabesh-gilead" differently).
# Each lost word is one the translators supplied, which the KJV prints in italics.
MANUAL = {(6, 20, 8): 'there', (18, 118, 128): 'them', (40, 10, 23): 'them', (40, 11, 14): 'it', (41, 16, 21): 'it'}


def fix_manual(bible):
    done = []
    for (b, c, v), w in MANUAL.items():
        s = bible[b][c][v]
        body = s.rstrip(); end = re.search(r'[{}«»]*$', body).group(0); core = body[:len(body) - len(end)] if end else body
        if re.search(r'(?:<em>)?' + w + r'(?:</em>)?\.?$', plain(core).strip()) or core.endswith(f'<em>{w}</em>.'):
            continue
        bible[b][c][v] = core + f' <em>{w}</em>.' + end
        done.append((b, c, v, w + '.'))
    return done


def main():
    cw = crosswire(sys.argv[1])
    for rel in ('data/base/kjv.b64', 'data/kjv.b64'):
        p = ROOT / rel
        bible = json.loads(gzip.decompress(base64.b64decode(p.read_text())))
        fixed = fix(bible, cw) + fix_manual(bible)
        raw = json.dumps(bible, ensure_ascii=False, separators=(',', ':')).encode()
        p.write_text(base64.b64encode(gzip.compress(raw, 9)).decode())
        print(f'{rel}: restored the end of {len(fixed)} verses')
    return fixed


if __name__ == '__main__':
    NAMES = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]
    for b, c, v, tail in main():
        print(f'  {NAMES[b]} {c + 1}:{v + 1}  + "{tail}"')
