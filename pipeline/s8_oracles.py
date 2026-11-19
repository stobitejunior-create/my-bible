"""Widen God's-words coverage in the prophets (Isaiah–Malachi).

Clear's speaker data only marks some of the prophetic oracles. The BSB and WEB put most oracles in
quotation marks, so a quotation (followed across verses) is marked as divine speech when:
  - part of it is already marked « » by the earlier pipeline, or
  - a divine speech tag follows it ("…,” declares the LORD" / "says the LORD"), or
  - a divine introduction precedes it ("This is what the LORD says: “…").
The KJV has no quotation marks, so a KJV verse is marked when the BSB and WEB both mark (nearly) the
whole verse; "saith the LORD" tags and "Thus saith the LORD" introductions are left outside the marks.

Only verses with no existing « » or { } marks are changed, so the earlier word-level work is kept.

Reads data/base/{kjv,bsb,web}.b64 (the packs from s6) and writes data/{kjv,bsb,web}.b64.
Run from the project root: python3 pipeline/s8_oracles.py
"""
import base64, gzip, json, re, sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
PROPHETS = range(22, 39)  # Isaiah .. Malachi (0-based)
LAMENT, DANIEL = 24, 26   # not oracles; left alone


def unpack(p):
    return json.loads(gzip.decompress(base64.b64decode(p.read_text())))


def pack(obj, p):
    raw = json.dumps(obj, ensure_ascii=False, separators=(',', ':')).encode()
    p.write_text(base64.b64encode(gzip.compress(raw, 9)).decode())


DIVINE_NAME = r"(?:[Tt]he\s+(?:LORD|Lord)(?:\s+(?:GOD|God|Almighty|of\s+(?:Hosts|Armies|hosts|armies)|your\s+God|God\s+of\s+(?:Israel|Hosts|Armies)(?:,\s+the\s+God\s+of\s+Israel)?))*|God|[Tt]he\s+Holy\s+One\s+of\s+Israel|your\s+Redeemer|[Tt]he\s+King\s+of\s+Jacob)"
DIVINE = r"(?<!of )" + DIVINE_NAME  # "the angel of the LORD said" is not the LORD speaking
TAG_AFTER = re.compile(r"^[\s,—–-]*(?:declares|says|said|swears|has\s+spoken)\s+" + DIVINE + r"|^[\s,—–-]*" + DIVINE + r"\s+(?:says|declares|has\s+spoken)\b")
# A divine speaker in an introduction: "the LORD said to me", "says the LORD", "the word of the LORD came".
DIV_SPEECH = re.compile(
    r"(?:(?:says|said|declares|spoke|speaks|answered|replied|swore|has\s+sworn|commanded|called|cried)\s+" + DIVINE +
    r"|" + DIVINE + r"(?:\s+(?:himself|to\s+me|to\s+\w+))?\s+(?:says|said|declares|spoke|speaks|answered|replied|swore|has\s+sworn|commanded|called|has\s+spoken)"
    r"|\bword\s+of\s+" + DIVINE_NAME + r"[^“”.]{0,60}\bcame\b|\bword\s+that\s+came\s+to\s+\w+\s+from\s+" + DIVINE_NAME + r")")
INTRO = re.compile(DIV_SPEECH.pattern + r"[^“”.]{0,160}[:,]?\s*$")
# Someone other than God introduces the quotation ("Jeremiah said to him, “…").
HUMAN = re.compile(r"\b(?:said|says|say|answered|replied|spoke|told|asked|cried|called|declared|prayed|saying|announced|proclaimed|wrote)\b[^“”]{0,80}[:,]?\s*$")
# Formula at the start of a quotation that belongs to the prophet, not to God.
LEAD = re.compile(r"^“?\s*(?:(?:Therefore|For|But|And|Now|Yes|So),?\s+)*(?:this\s+is\s+what|thus)\s+(?:says|said)\s+" + DIVINE + r"[^:“]{0,60}:\s*", re.I)

strip = lambda s: re.sub(r"[«»{}]", "", s)


def outer_depth(text):
    """How many ‘…’ quotations are still open at the end of text."""
    depth = 0
    for i, x in enumerate(text):
        if x == '‘':
            depth += 1
        elif x == '’' and depth and not (i + 1 < len(text) and text[i + 1].isalpha()):
            depth -= 1
    return depth


def outer_mark(text):
    """True if a « » mark starts at the top quotation level (not inside a nested ‘…’)."""
    depth = 0
    for i, x in enumerate(text):
        if x == '‘':
            depth += 1
        elif x == '’' and depth and not (i + 1 < len(text) and text[i + 1].isalpha()):
            depth -= 1
        elif x in '«{' and depth == 0 and text[i + 1:i + 2] != '‘':
            return True
    return False


def modern(bible, name):
    """Mark divine quotations in one modern version. Returns {(b,c,v): new string}."""
    out = {}
    for b in PROPHETS:
        if b in (LAMENT, DANIEL):
            continue
        book = bible[b]
        # Pass 1: segments = runs of quoted text, as lists of (c, v, start, end) on the verse string.
        segs, cur = [], None
        for c, ch in enumerate(book):
            for v, s in enumerate(ch):
                i = 0
                if cur is not None:
                    cur['pieces'].append([c, v, 0, None])
                for i, x in enumerate(s):
                    if x == '“':
                        if cur is None and not outer_depth(s[:i]):
                            cur = {'pieces': [[c, v, i, None]], 'start': (c, v, i)}
                    elif x == '”' and cur is not None:
                        cur['pieces'][-1][3] = i + 1
                        cur['end'] = (c, v, i + 1)
                        segs.append(cur)
                        cur = None
                if cur is not None:
                    cur['pieces'][-1][3] = len(s)
        # Pass 2: decide which segments are divine.
        for seg in segs:
            texts = [book[c][v][a:z] for c, v, a, z in seg['pieces']]
            c0, v0, a0 = seg['start']
            before = strip(book[c0][v0][:a0])
            if not before.strip():
                prev = book[c0][v0 - 1] if v0 else (book[c0 - 1][-1] if c0 else '')
                before = strip(prev)[-200:]
            c1, v1, z1 = seg['end']
            after = strip(book[c1][v1][z1:])
            intro = before.rstrip(' “')
            if INTRO.search(intro) or TAG_AFTER.search(after) or any(
                    re.search(r",?”\s+(?:declares|says)\s+" + DIVINE, book[c][v]) for c, v, _, _ in seg['pieces']):
                seg['divine'] = True
            else:
                # Already partly marked, as long as a person doesn't introduce it and the mark
                # isn't on a quotation nested inside it (a prophet quoting God).
                human = HUMAN.search(intro) and not DIV_SPEECH.search(intro[-200:])
                seg['divine'] = not human and outer_mark(''.join(texts))
        # Pass 3: wrap divine pieces in verses that have no marks yet.
        pieces = {}
        for seg in segs:
            if seg['divine']:
                for c, v, a, z in seg['pieces']:
                    pieces.setdefault((c, v), []).append((a, z))
        for (c, v), ps in pieces.items():
            s = book[c][v]
            if re.search(r"[«{]", s):
                continue
            ns, last = '', 0
            for a, z in sorted(ps):
                body = s[a:z]
                lead = LEAD.match(body)
                if lead and lead.end() < len(body):
                    ns += s[last:a] + body[:lead.end()]
                    a += lead.end()
                    body = s[a:z]
                if not re.search(r"\w", body):
                    ns += s[last:z]
                    last = z
                    continue
                ns += s[last:a] + '«' + body + '»'
                last = z
            ns += s[last:]
            if ns != s:
                out[(b, c, v)] = ns
    return out


def coverage(s):
    """Share of letters inside « » (0..1)."""
    inside = total = 0
    on = False
    for x in re.sub(r"\[\[.*?\]\]", "", s):
        if x == '«': on = True
        elif x == '»': on = False
        elif x.isalpha():
            total += 1
            inside += on
    return inside / total if total else 0


# KJV: a word may be followed by punctuation, then its Strong's tags ("day,[H3117]"), and <em> may sit between words.
GAP = r"(?:\[[HG]\d+\]|</?em>|\s)+"
T = r"[,.;:!?]?(?:\[[HG]\d+\])*"
def kre(words):
    return GAP.join(w if w.startswith('(') else re.escape(w) for w in words.split(' ')) + T

K_NAME = kre("the LORD") + r"(?:" + GAP + r"(?:" + kre("of hosts") + "|" + kre("God of hosts") + "|" + kre("God of Israel") + "|" + kre("the God of Israel") + "|" + kre("(?:thy|your|thine) (?:God|Redeemer|Saviour)") + "|" + kre("(?:the|thy) Holy One of Israel") + r"))*" + "|" + kre("the Lord GOD") + r"(?:" + GAP + kre("of hosts") + r")?|" + kre("the Lord") + "|" + kre("God")
K_TAG = re.compile(r"\s*(?:" + kre("saith") + "|" + kre("hath spoken") + ")" + GAP + "(?:" + K_NAME + ")")
K_LEAD = re.compile(r"^(?:(?:Therefore|For|But|And|Now|Yea|So)" + T + r"\s+)*" + kre("(?:Thus|thus) saith") + GAP + "(?:" + K_NAME + r")\s*")
K_SKIP = re.compile(r"(?:\s|[,.;:!?]|\[[HG]\d+\])*")


def kjv_wrap(s):
    """Wrap a whole KJV verse, leaving speech tags and introductions outside the marks."""
    if s.count('<em>') != s.count('</em>'):
        return None
    lead = K_LEAD.match(s)
    start = lead.end() if lead else 0
    parts, pos = [], start
    for m in K_TAG.finditer(s, start):
        parts.append((pos, m.start()))
        pos = m.end()
    parts.append((pos, len(s)))
    out, last = '', 0
    for a, z in parts:
        a = K_SKIP.match(s, a).end()   # never open a mark on the previous word's punctuation or tags
        seg = s[a:z].rstrip()
        z = a + len(seg)
        if seg.count('<em>') != seg.count('</em>') or not re.search(r"[A-Za-z]{2}", re.sub(r"\[[HG]\d+\]|</?em>", "", seg)):
            continue
        out += s[last:a] + '«' + seg + '»'
        last = z
    out += s[last:]
    return out if '«' in out else None


def main():
    base = ROOT / 'data' / 'base'
    if not base.exists():
        sys.exit('data/base/ is missing: copy the s6 packs (kjv, bsb, web .b64) there first.')
    D = {v: unpack(base / f'{v}.b64') for v in ('kjv', 'bsb', 'web')}
    changes = {v: modern(D[v], v) for v in ('bsb', 'web')}
    for v, ch in changes.items():
        for (b, c, i), s in ch.items():
            D[v][b][c][i] = s
    kjv = {}
    for key in set(changes['bsb']) | set(changes['web']):
        b, c, i = key
        s = D['kjv'][b][c][i]
        if re.search(r"[«{]", s):
            continue
        if coverage(D['bsb'][b][c][i]) >= 0.8 and coverage(D['web'][b][c][i]) >= 0.8:
            ns = kjv_wrap(s)
            if ns:
                kjv[key] = ns
    for (b, c, i), s in kjv.items():
        D['kjv'][b][c][i] = s
    changes['kjv'] = kjv
    for v in ('kjv', 'bsb', 'web'):
        pack(D[v], ROOT / 'data' / f'{v}.b64')
        print(f'{v}: {len(changes[v])} verses newly marked')
    return D, changes


if __name__ == '__main__':
    main()
