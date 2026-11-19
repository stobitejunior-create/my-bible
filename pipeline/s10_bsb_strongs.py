"""Add Strong's tags to the BSB, so it works like the KJV (underlined words that open the Hebrew/Greek entry).

Source: the Berean Bible's own interlinear tables (bereanbible.com/bsb_tables.xlsx, public domain). Each row is one
Hebrew or Greek word with its Strong's number and the English BSB phrase it became, in English order.
Extract them first (see extract step below), then run from the project root:
    python3 pipeline/s10_bsb_strongs.py /path/to/bsb_strongs.json

The phrases are aligned word-by-word to the existing BSB verses (which already carry the red-letter and God's-words
marks from s5/s8), and a [H123]/[G123] tag is inserted after the last word of each phrase, after any trailing
punctuation, the same way the KJV is tagged. The verse text itself is not changed.
Run after s8_oracles.py: it reads data/bsb.b64 (without tags) and writes it back with tags; existing tags are
stripped first, so re-running is safe.

Extract step (streams the 344 MB sheet in about 15 s): for each row in sheet "biblosinterlinear96" (sheet5.xml),
carry VerseId (col M) forward, and keep [English (col S), 'H'+Str Heb (col K) or 'G'+Str Grk (col L)] for rows
whose English is not empty or "-". Output: {"order": [...], "v": {"Genesis 1:1": [["In the beginning","H7225"], ...]}}
"""
import base64, difflib, gzip, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
NAMES = ["Genesis","Exodus","Leviticus","Numbers","Deuteronomy","Joshua","Judges","Ruth","1 Samuel","2 Samuel","1 Kings","2 Kings","1 Chronicles","2 Chronicles","Ezra","Nehemiah","Esther","Job","Psalms","Proverbs","Ecclesiastes","Song of Solomon","Isaiah","Jeremiah","Lamentations","Ezekiel","Daniel","Hosea","Joel","Amos","Obadiah","Jonah","Micah","Nahum","Habakkuk","Zephaniah","Haggai","Zechariah","Malachi","Matthew","Mark","Luke","John","Acts","Romans","1 Corinthians","2 Corinthians","Galatians","Ephesians","Philippians","Colossians","1 Thessalonians","2 Thessalonians","1 Timothy","2 Timothy","Titus","Philemon","Hebrews","James","1 Peter","2 Peter","1 John","2 John","3 John","Jude","Revelation"]
IDX = {n: i for i, n in enumerate(NAMES)}
IDX.update({'Psalm': 18, 'Song of Songs': 21})
WORD = re.compile(r"[A-Za-z0-9]+(?:[’'][A-Za-z]+)*")
TAGS = re.compile(r"\[[HG]\d+\]")


def unpack(p):
    return json.loads(gzip.decompress(base64.b64decode(p.read_text())))


def pack(obj, p):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    p.write_text(base64.b64encode(gzip.compress(raw, 9)).decode())


def tag_verse(s, phrases):
    """Insert Strong's tags into verse string s. Returns (new string, words matched, phrase count)."""
    # words of the verse, skipping markup; remember where each word ends
    vw, vend = [], []
    for m in WORD.finditer(s):
        vw.append(m.group().lower().replace('’', "'")); vend.append(m.end())
    tw, tp = [], []
    for pi, (en, _) in enumerate(phrases):
        for w in WORD.findall(en):
            tw.append(w.lower().replace('’', "'")); tp.append(pi)
    sm = difflib.SequenceMatcher(None, tw, vw, autojunk=False)
    last = {}  # phrase index -> verse word index of its last matched word
    for a, b, n in sm.get_matching_blocks():
        for k in range(n):
            last[tp[a + k]] = b + k
    ins = {}
    for pi, vi in last.items():
        pos = vend[vi]
        while pos < len(s) and s[pos] in ',.;:!?':
            pos += 1
        ins.setdefault(pos, []).append(phrases[pi][1])
    out, prev = [], 0
    for pos in sorted(ins):
        out.append(s[prev:pos]); out.append(''.join(f'[{t}]' for t in dict.fromkeys(ins[pos]))); prev = pos
    out.append(s[prev:])
    matched = sum(n for _, _, n in sm.get_matching_blocks())
    return ''.join(out), matched, len(tw)


def main():
    src = json.load(open(sys.argv[1]))
    bsb = unpack(ROOT / 'data' / 'bsb.b64')
    tot = hit = verses = 0
    for ref, phrases in src['v'].items():
        m = re.match(r'(.+) (\d+):(\d+)$', ref)
        b, c, v = IDX[m[1]], int(m[2]) - 1, int(m[3]) - 1
        try:
            s = bsb[b][c][v]
        except IndexError:
            continue
        new, got, n = tag_verse(TAGS.sub('', s), phrases)
        bsb[b][c][v] = new
        hit += got; tot += n; verses += 1
    pack(bsb, ROOT / 'data' / 'bsb.b64')
    print(f'bsb: tagged {verses} verses, {hit}/{tot} phrase words aligned ({hit / tot:.1%})')


if __name__ == '__main__':
    main()
