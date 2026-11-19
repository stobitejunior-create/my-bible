"""Assemble dist/bible.html from src/template.html, src/app.js and the packed data in data/."""
from pathlib import Path
root = Path(__file__).parent
t = (root / "src/template.html").read_text(encoding="utf-8")
for key, name in [("__KJV__","kjv"),("__BSB__","bsb"),("__WEB__","web"),("__ASV__","asv"),("__BLB__","blb"),("__LEX__","lex"),("__XREF__","xref")]:
    t = t.replace(key, (root / f"data/{name}.b64").read_text())
t = t.replace("__JS__", (root / "src/makarios.js").read_text(encoding="utf-8") + "\n" + (root / "src/app.js").read_text(encoding="utf-8"))
(root / "dist").mkdir(exist_ok=True)
(root / "dist/bible.html").write_text(t, encoding="utf-8")
print(f"dist/bible.html  {len(t)/1e6:.2f} MB  (hosting limit 16 MB)")
