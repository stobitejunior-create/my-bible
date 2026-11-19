"""Pack the extra public-domain versions: ASV (1901) and BLB (Berean Literal Bible).

Sources (not kept in this folder; fetch them into a directory and pass it as the argument):
  curl -sL -o asv.xml https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-asv.zefania.xml
  curl -sL -o blb.txt https://literalbible.com/blb.txt

Run from the project root: python3 pipeline/s9_versions.py /path/to/sources
Writes data/asv.b64 and data/blb.b64 in the same shape as the other versions: [book][chapter][verse], 0-based.

Choices:
  - The divine name is shown as "LORD" (and "Lord GOD" for "Lord Jehovah" / "Lord YHWH"), matching the KJV, BSB and
    WEB (British) that Ben chose for this reason. The ASV prints "Jehovah"; the BLB prints "YHWH".
  - BLB [supplied words] become <em>…</em>, the same markup as the KJV translators' italics.
  - BLB Psalm titles, which the source runs into verse 1, become [[…]] superscriptions.
  - Neither version has speaker data, so there are no red letters or God's-words marks.
"""
import base64, gzip, json, re, sys
import xml.etree.ElementTree as ET
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]


def put(bible, b, c, v, text):
    bk = bible[b]
    while len(bk) < c:
        bk.append([])
    ch = bk[c - 1]
    while len(ch) < v:
        ch.append('')
    ch[v - 1] = text


def divine(t, name):
    """Replace the divine name with LORD the way the KJV does: "O LORD", "LORD, how…" (address), else "the LORD"."""
    t = re.sub(r'\b(?:[Tt]he )?Lord ' + name + r'\b(?!-)', lambda m: ('the ' if m[0][0] in 'Tt' else '') + 'Lord GOD' if not m[0].startswith('The') else 'The Lord GOD', t)
    def one(m):
        before = t[:m.start()]
        if re.search(r'\bO\s*$', before):                       # "O Jehovah"
            return 'LORD'
        if not before.strip() and t[m.end():m.end() + 1] == ',':  # verse opens by addressing him
            return 'LORD'
        if re.search(r'(?:^|[.!?:;]\s*[“‘"]?|[“‘"])\s*$', before):  # start of a sentence or quotation
            return 'The LORD'
        return 'the LORD'
    return re.sub(r'\b' + name + r'\b(?!-)', one, t)


def tidy(s):
    return re.sub(r'\s+', ' ', s).strip()


def asv(src):
    bible = [[] for _ in NAMES]
    root = ET.parse(src / 'asv.xml').getroot()
    for book in root.iter('BIBLEBOOK'):
        b = int(book.get('bnumber')) - 1
        for ch in book.iter('CHAPTER'):
            for vs in ch.iter('VERS'):
                t = tidy(''.join(vs.itertext()))
                t = divine(t, 'Jehovah')
                put(bible, b, int(ch.get('cnumber')), int(vs.get('vnumber')), t)
    return bible


def blb(src):
    bible = [[] for _ in NAMES]
    idx = {n: i for i, n in enumerate(NAMES)}
    idx['Psalm'] = idx['Psalms']
    for line in (src / 'blb.txt').read_text(encoding='utf-8-sig').splitlines():
        parts = line.split('\t')
        m = len(parts) == 2 and re.match(r'(.+) (\d+):(\d+)$', parts[0])
        if not m:
            continue
        t = parts[1]
        title = ''
        tm = re.match(r'(.*?)\s*<span class=\|reftext\|>.*?</a>\s*(.*)$', t)
        if tm:  # Psalm title run into verse 1
            title, t = tm[1], tm[2]
        t = re.sub(r'<[^>]+>', ' ', t)
        title = re.sub(r'<[^>]+>', ' ', title)
        fix = lambda s: divine(s, 'YHWH')
        t = fix(tidy(t))
        title = fix(tidy(title))
        t = re.sub(r'\[([^\[\]]+)\]', r'<em>\1</em>', t)
        title = re.sub(r'\[([^\[\]]+)\]', r'\1', title)
        put(bible, idx[m[1]], int(m[2]), int(m[3]), (f'[[{title}]] ' if title else '') + t)
    return bible


def pack(obj, p):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    p.write_text(base64.b64encode(gzip.compress(raw, 9)).decode())
    return len(raw) // 1024, p.stat().st_size // 1024


if __name__ == '__main__':
    if len(sys.argv) != 2:
        sys.exit(__doc__)
    src = Path(sys.argv[1])
    for name, fn in (('asv', asv), ('blb', blb)):
        bible = fn(src)
        n = sum(len(c) for b in bible for c in b)
        assert all(bible), f'{name}: a book is missing'
        raw, packed = pack(bible, ROOT / 'data' / f'{name}.b64')
        print(f'{name}: {n} verses, {raw} KB raw, {packed} KB packed')
