"""God's words in Hosea 4-14, which neither Clear's speaker data nor the translations' quotation marks cover.

These chapters switch between the LORD speaking (mostly in the first person: "My people are destroyed for lack of
knowledge") and the prophet or the people speaking about Him ("Come, let us return to the LORD"). The speaker was
decided verse by verse; the BSB's own quotation (4:1b-5:15) and its capitalised divine pronouns (My, Me) were the main
guides, and 10:12-15 and 11:10 follow the WEB translators, who put them inside the LORD's speech. Verses where the prophet speaks (9:1-9, 9:14, 9:17, 10:1-8, 12:2-6, 12:12-14, 13:1-3,
13:15-16, 14:9), or the people (6:1-3, 14:1-3), are left out.

Whole verses are wrapped in « » in the KJV, BSB and WEB, except 4:1, where only the charge itself is God's words
(from the BSB/WEB opening quote, and from "because there is no truth" in the KJV).
Only verses with no marks yet are changed, so running it again changes nothing.
Run from the project root after s8/s10/s11:  python3 pipeline/s12_hosea.py
"""
import base64, gzip, json, re
from pathlib import Path

ROOT = Path(__file__).resolve().parent.parent
HOSEA = 27
GOD = [((4, 2), (5, 15)), ((6, 4), (7, 16)), ((8, 1), (8, 14)), ((9, 10), (9, 13)), ((9, 15), (9, 16)),
       ((10, 9), (10, 15)), ((11, 1), (12, 1)), ((12, 7), (12, 11)), ((13, 4), (13, 14)),
       ((14, 4), (14, 8))]


def verses(bible):
    for (c0, v0), (c1, v1) in GOD:
        for c in range(c0, c1 + 1):
            ch = bible[HOSEA][c - 1]
            for v in range(v0 if c == c0 else 1, (v1 if c == c1 else len(ch)) + 1):
                yield c, v


def main():
    for name in ('kjv', 'bsb', 'web'):
        p = ROOT / 'data' / f'{name}.b64'
        bible = json.loads(gzip.decompress(base64.b64decode(p.read_text())))
        n = 0
        for c, v in verses(bible):
            s = bible[HOSEA][c - 1][v - 1]
            if s and not re.search(r'[«{]', s):
                bible[HOSEA][c - 1][v - 1] = '«' + s + '»'; n += 1
        s = bible[HOSEA][3][0]                     # 4:1 — only the charge after the introduction
        if not re.search(r'[«{]', s):
            m = re.search(r'“', s) if name != 'kjv' else re.search(r'\bbecause\b', s)
            if m: bible[HOSEA][3][0] = s[:m.start()] + '«' + s[m.start():] + '»'; n += 1
        raw = json.dumps(bible, ensure_ascii=False, separators=(',', ':')).encode()
        p.write_text(base64.b64encode(gzip.compress(raw, 9)).decode())
        print(f'{name}: marked {n} verses in Hosea 4-14')


if __name__ == '__main__':
    main()
