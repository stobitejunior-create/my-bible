# Bible App — project context for Claude

A personal Bible reader for Ben. He uses it on his Mac (Safari or Chrome) **and on his phone**. Since Sept 2026 it must work at both desktop and phone widths. It is a single, fully self-contained HTML file with every Bible text and dataset embedded in it. It is published as a claude.ai artifact at https://claude.ai/artifact/SxkuxHTMt2wFqqNAToQGwV (update that artifact in place; don't create a new one).

## What the app does

- **Five versions.**
  - KJV (1769) *with Strong's*.
  - The Berean Standard Bible (BSB).
  - The World English Bible, British Edition (WEB).
  - The American Standard Version 1901 (ASV), added Sept 2026.
  - The Berean Literal Bible (BLB), added Sept 2026.

  The KJV and the BSB have Strong's; the BSB's come from `pipeline/s10_bsb_strongs.py`, added Sept 2026 (`STRONGS` in app.js). Only the KJV, BSB and WEB have red-letter and God's-words marks (`MARKED` in app.js). For the ASV and BLB those switches are disabled, and `godOn()` returns false. Ben asked for the NKJV, NLT, AMP, NASB and NIV (Sept 2026). They were declined as copyrighted, and the ASV and BLB were added instead. On 28 Sept 2026 he asked again for the NKJV with Strong's, "offline only". It was still declined: fetching the text means copying Thomas Nelson's copyrighted text wholesale.
  - Instead, the version menu and the verse panel link to the NKJV with Strong's on Blue Letter Bible (`nkjvURL()`, using BLB book codes checked for all 66 books).
  - Also offered: an importer for a DRM-free NKJV file that Ben owns himself. Not built yet.
- **One verse per line**, with the verse number hanging in the left gutter.
- **Red letters** for the words of Jesus in all three versions (toggle).
- **"God's words only" mode.** Hides narration and shows only speech the text attributes to God, Jesus or the Holy Spirit, including Old Testament divine speech. Inside a verse it keeps just the spoken words. For example, Genesis 1:3 shows only "Let there be light:". Chapters with no divine speech are dimmed in the sidebar, and the ←/→ keys skip them while the mode is on.
- **Strong's popover.** Strong's words are shown as subtle underlines, not numbers; Ben asked for this in Sept 2026. Each tag's English word or phrase (the text since the previous tag) becomes one `.w` span with `data-s="G25"`, or several ids when tags repeat. Clicking one shows the word, then the lemma, transliteration, pronunciation, definition, KJV usage and origin, plus "Show all N verses", which lists every KJV verse containing that number.
- **Search** (⌘K). Plain words search the current version; exact-phrase matches are listed first. A reference jumps straight there ("ps 23", "1 cor 13:4", "jn 3:16"). A Strong's number such as "G25" or "H430" searches by word.
- **Side by side.** Two versions in aligned columns. It works with God's-words mode and with Strong's.
- **Verse panel** (click any verse). Five highlight colours, an autosaving note, copy with reference, and cross references with previews.
- **Highlights and notes list** (bookmark icon), in Bible order, filterable by colour or "With notes".
- **Phone = GitHub Pages (Nov 2026).** The repo is https://github.com/stobitejunior-create/my-bible. It is **public**, because Ben chose that after the free plan refused Pages on a private repo.
  - Pages serves `main:/docs` at https://stobitejunior-create.github.io/my-bible/. `pages/make_site.py` copies `dist/bible.html` to `docs/index.html` and adds the home-screen tags: manifest, apple-touch-icon, standalone mode, noindex, and the `docs/sw.js` service worker (network-first offline cache).
  - The phone icons are `swift mac/make_icon.swift out.png full`, sized with sips.
  - `.gitignore` keeps out `dist/` and `ePUB/`. The EPUBs are copyrighted and 200 MB, and must never be committed.
  - Ship everything with **`rebuild-bible ["what changed"]`** (scripts/rebuild-bible.sh, set up in ~/.zshrc). It builds, makes the site, installs the Mac app, commits and does a plain push, with no Actions.
  - On Pages there is no claude.ai `db`, so highlights, plans and imports stay in that phone's browser. The old claude.ai artifact is no longer the phone route.
- **One verse at a time (Nov 2026).** Settings → Layout → **One verse** (`S.layout='one'`, `oneMode()`, `drawOne()`). It shows a single large verse with its reference (tap the reference for the verse panel), a progress line and "n of N".
  - `stepVerse(±1)` is driven by ← →, the edge arrows (`#prev`/`#next`), swipe, or a tap on the left third or right two-thirds. It carries on into the next or previous chapter. God's-words mode limits it to verses with divine speech.
  - The position is kept in `ONE`/`ONEKEY` (saved as `S.ov`/`S.ovk`). `applyMarks()` redraws in this mode.
- **Verse shuffle (Nov 2026), modelled on Stobite TV's Bible screen.** Opens from ☰ → Verse shuffle, the dice sheet, or Mac Go → Verse Shuffle (⇧⌘V). It shows `#shuf` full screen, in `--shbg` (#f4f1ea light, #0b0c0f dark).
  - Each verse is a random readable one (40–320 characters; only divine speech when God's words is on) from the current version. It changes every `S.shufEvery` seconds (15/30/60/120/300; the button cycles through them), with a fade-up and a progress bar along the bottom.
  - ← → step through a history of the last 200, space pauses, tap or swipe advances, **Open** jumps to the chapter, and Esc closes.
  - The controls hide after 3 seconds idle. The screen wake lock keeps the display on. Full screen uses the Fullscreen API (`isElementFullscreenEnabled` in the Mac app; the button is hidden where it isn't supported, such as iPhone Safari).
- **Settings (Nov 2026).** The **Aa** panel has a short main page with three sections: Reading (switches), Text (Font ›, Size, Line spacing, Margins) and Page (Layout, Chapter heading ›, Appearance). Font and Chapter heading are sub-pages (`PREFPAGE`). Highlights and About live only in ☰.
- **Reading plan (Nov 2026).** ☰ → Reading plan (Mac: Go → Reading Plan, ⇧⌘P) opens `#planp`.
  - Ben picks a start chapter, an end chapter, a finish date and optional days off. Presets: Whole Bible, Old Testament, New Testament, Here to Revelation.
  - His original request was 2 Samuel → Revelation by 31 Dec. That is 922 chapters, which gives about 22 chapters (about 1 h 8 min) a day over 42 days.
  - `planSchedule()` splits **by verse count**, not chapter count. Each day takes chapters until it is as close as it can get to "remaining ÷ days left", so days vary between 11 and 35 chapters but stay at about 550 verses.
  - Today's list is frozen in `PLAN.today`, so ticking chapters off doesn't hand out more. At the next day's first open (`ensureToday()`), anything unread is rebalanced across the remaining days.
  - Rest days and a finish date in the past are handled.
  - Chapters are ticked in the sheet, or with the "Mark as read" / "Read ✓" pill at the end of any chapter that is inside the plan (`planBtn()`).
  - Saved in localStorage `bible.plan`, and in the db doc `x-plan` in the artifact (`{gone:true}` when deleted). The Mac app has no db, so its plan is separate from the phone's.
  - Verse counts come from `VD()` (the KJV). The reading-time estimate is words ÷ 200 wpm.
- **Oct 2026 follow-up (from Ben's Tecarta screenshot).**
  - The top bar centre is one **island** (`.island`): `#ref` "Judges 3" | `#verb` "KJV ⌄". It has no audio button and no separate version pill.
  - The default chapter heading is `dropcap` (`S.hs`, migrated once via `S.hsv=2`). The book heading is gone; the chapter number is a large float (`.dc`) that verse 1 wraps around, and verse 1's own number is hidden. Side by side falls back to the `line` heading.
  - Settings now scrolls (`#prefs` max-height plus overflow).
  - **Margins** slider (`S.mw`, in rem, drives `--mw` and the column max-width).
  - Fonts: `S.font` can be `f:<family>`. The Mac app injects `window.MAC_FONTS`, which is all 1,145+ installed families, searchable in Settings. In browsers you can type a font name or use `queryLocalFonts()` (Chrome).
  - The document click handler ignores `!e.isTrusted` clicks, because the settings switches press the hidden toolbar buttons and that used to close the panel.
- **Tecarta-style layout (Oct 2026).** Ben asked for "the look of Tecarta" with no left-hand book list. The sidebar is gone.
  - Top bar: ☰ menu (left), the centred title "John 3 ⌄", and the version pill, dice and **Aa** (right).
  - The title (or ⌘K) opens the **navigator** `#navp`. It has the search/reference box (`#q`), book tiles colour-coded by section (`GENRE()`, `[data-g]` colours), then a chapter grid; picking a chapter goes there and closes it.
  - ☰ (`#menup`) holds Search, Highlights and notes, Import a Bible (XML), the list of imported Bibles (with Remove) and About.
  - Chapter arrows `#prev`/`#next` float at the page edges on desktop and appear on hover. On phones, swipe left or right instead.
  - **Layout** setting (`S.layout`): `verse` (one verse per line, the default) or `para` (Tecarta-like flowing paragraph with small inline numbers). Side by side always uses rows.
  - `buildBooks()` now only refreshes the title and an open navigator. Use `$('#reft')` for the title text, never `$('#ref').textContent`, because that would wipe out the chevron.
- **XML import (Oct 2026).** `parseBibleXML()` reads Zefania, OSIS (container or milestone verses, `q who="Jesus"`), USFX (`wj`, `w s=`, `add`), Beblia and OpenSong into the app's markup. Strong's (`gr str`, `w lemma=strong:`, `w s`) becomes `word[H123]`, words of Jesus become `{…}`, supplied words become `<em>`, and notes are dropped.
  - Imports are saved in IndexedDB `bible-imports` (store `meta` holds id/name/abbr/strongs/red; store `data` holds the text). The ids start with `x_`, `load()` reads them from IndexedDB, and `registerImport()` adds them to `VN`/`STRONGS`/`MARKED` at boot.
  - Tested with the open-bibles OSIS KJV, USFX WEB and Zefania ASV, the Beblia KJV and hand-made Strong's files: all have 31,102 verses and 1,189 chapters, and each parses in under 1 second.
  - This is how Ben can add an NKJV he owns himself.
- **Mac app (Oct 2026).** `mac/MyBible.swift` is an AppKit window with WKWebView. It serves `Contents/Resources/web/bible.html` through the private `bible://app/` scheme (no server, no localhost). localStorage and IndexedDB persist per app; `MYBIBLE_SELFTEST=1` checks this.
  - Menus: ⌘O import (read natively, then `importXMLText()`), ⌘K go to, ⌘[ / ⌘] chapters, ⌘R random, ⌘, settings, zoom and full screen. External links open in the default browser.
  - Build: `python3 build.py && mac/build.sh --install`. This makes a universal binary with an ad-hoc signature, the icon from `mac/make_icon.swift`, and installs `/Applications/My Bible.app`.
  - The Mac app has no claude.ai `db`, so its highlights stay on the Mac. The published artifact is still the phone version.
- **Minimal layout (Sept 2026).** The toolbar holds only: books, ‹, the reference, ›, the version pill, the dice and **Aa**.
  - Tapping the reference toggles the books sidebar, which is closed by default (`S.side`).
  - The version pill opens `#verp`: the versions, the NKJV link-out and side by side.
  - **Aa** holds the display switches (Strong's, red letters, God's words), the heading style, font, size, spacing, appearance, highlights and About.
  - The old toolbar controls (`#ver`, the `.tg` switches, `#marks`, `#theme`, `#info`) still exist in a hidden `<div>`, and the menus call them. Keep them.
  - The bar slides away when scrolling down and returns when scrolling up.
- **Random reading (dice button, Sept 2026).** Two tabs:
  - **Bible:** a random book, then a random chapter. The scope can be the whole Bible, the Old Testament or the New Testament.
  - **Dag Heward-Mills:** a random book from `MAKARIOS` in `src/makarios.js`, then a random chapter. This is Ben's "Makarios" list, originally `Makarios.java` in this folder. Since 28 Sept 2026 the list is built from Ben's `ePUB/` folder (297 EPUBs in the collections "Makarios All", "Makarios Mini", "105 Makarios Ghana", "Layschools", "Manthano" and loose files).
    - Chapter counts are read from each EPUB's table of contents.
    - Duplicates were merged, giving 216 books tagged `makarios`, `mini` or `school`. The picker has a chip for each collection.
    - Spurgeon's *Treasury of David* was left out, because it isn't by Dag Heward-Mills.
    - Where an EPUB's contents page was broken, the `Makarios.java` count was kept (Church Administration 59, Tell Them 125, Forgiveness Made Easy 5).
    - Only *The Love of the Spirit* has no count.
    - The extraction scripts were one-off and ran in scratch space; to redo it, parse the EPUBs' nav/NCX again.
  - 35 newer books have `null` counts, because dagbooks.org only gives the book files after a details form. Ben chose to enter those counts himself in the app.
  - Counts he enters (`READ.counts`, keyed by title) and recent picks (`READ.hist`) are stored in the db doc `x-reading` in his user collection, with localStorage `bible.reading` as the fallback.
- **Shuffle animation.** `pick()` renders the real result, then `shuffle()` flicks through random candidates, slowing down over about 1 second, and lands. A newer pick or a tab switch cancels it (`RP.token`). It is skipped under `prefers-reduced-motion`.
- **Chapter heading styles.** Chosen in settings (`S.hs`): `refined` (default), `classic` (centred), `line` ("John 3" on one line) and `bookchap` ("CHAPTER 3 · KJV"). `headHTML()` builds the markup, and `.hd.h-*` holds the CSS.
- **Phones (≤700 px).** The toolbar keeps navigation and icons only. The version picker and the four switches move into the **Aa** sheet (`.mob` section, which calls the hidden toolbar buttons). Settings, random picker, Strong's popup and verse panel open as bottom sheets over `#scrim`. `openSheet()` and `closeSheets()` manage the sheets.
- **Other controls.** The **Aa** reading-settings popover sets the Bible font (nine installed Mac fonts, `FONTS` in app.js, applied through the `--bf` CSS variable), the text size and the line spacing (`S.font`, `S.fs`, `S.lh`). It replaced the old A/A buttons. Also light/dark/automatic appearance, a collapsible sidebar, and an About modal with data credits and limitations. The app remembers the last position and settings.

## Project layout

```
CLAUDE.md
build.py                 # assembles dist/bible.html (run: python3 build.py)
src/template.html        # all HTML + CSS; placeholders __KJV__ __BSB__ __WEB__ __ASV__ __BLB__ __LEX__ __XREF__ __JS__
src/app.js               # all application JavaScript (plain JS, no framework, no build step)
src/makarios.js          # Dag Heward-Mills book list for the random picker; build.py puts it before app.js
Makarios.java            # Ben's original Java randomiser (source of the chapter counts); not used by the build
data/*.b64               # packed datasets: gzip -> base64 JSON (see "Data formats")
data/base/*.b64          # kjv/bsb/web as s6 wrote them, before s8; input to s8_oracles.py
pipeline/                # Python scripts that produced data/*.b64 from the raw sources
pipeline/fetch_sources.sh
dist/bible.html          # the built, publishable file (~11.8 MB)
dist/My Bible.app        # the Mac app (mac/build.sh)
mac/                     # MyBible.swift, Info.plist, make_icon.swift, build.sh
```

**Workflow:** edit `src/`, run `python3 build.py`, and test `dist/bible.html` by opening it locally. Everything works offline. Highlights fall back to localStorage when the page is not running on claude.ai. Then publish `dist/bible.html` over the existing artifact URL.

Only re-run `pipeline/` when the text data itself must change. The raw sources are not in this folder; `fetch_sources.sh` downloads them. The scripts read absolute `/tmp/...` paths from the sandbox they were written in, so either fetch the sources to `/tmp` or update the paths. The order is `s1` → `s7`, and `s6_pack.py` writes the `.b64` files. Then copy the new `kjv`, `bsb` and `web` packs into `data/base/` and run `python3 pipeline/s8_oracles.py` from the project root. It reads `data/base/` and writes `data/`, so it is safe to re-run. `s8` is the only script that runs without the raw sources.

## Hosting constraints (claude.ai published artifact)

- **One self-contained file under 16 MB.** It is currently about 10.8 MB, leaving about 5 MB of headroom, enough for about three more versions.
- **Content-security policy.** External scripts may load only from cdnjs.cloudflare.com, cdn.jsdelivr.net/npm, cdn.tailwindcss.com and code.jquery.com, and fonts only from Google Fonts. **No network fetches** to other sites, no remote images. All data is embedded as `<script type="application/octet-stream" id="d-…">` blocks and decompressed at runtime with `DecompressionStream('gzip')`. Don't use `fetch('data:…')`.
- **Runtime capabilities declared:** `{db: {}, user: {}}`. Keep declaring both on every republish, or omit `capabilities` to carry them forward. Declaring `db` makes the artifact organisation-internal, so it can't be shared by public link; Ben accepted this.
- The chat preview's `window.storage` and `fetch` to api.anthropic.com do not work in a published page. Use the runtime capabilities instead: `claude.use('sample')` for AI features, `db` for stored data and `downloads` for file export. Call `claude.use(name)`, handle a `null` result, and never block first paint on it.
- localStorage works, but only for per-browser conveniences, and is always wrapped in try/catch. Keys: `bible.state` (position and settings) and `bible.marks` (offline fallback for highlights).

## Data formats (after unpacking)

- **Bible text:** `DATA[v][book][chapter][verse]`, all indexes 0-based. Books are 0–65 in Protestant canon order; indexes 0–38 are the Old Testament. `v` is one of `kjv`, `bsb`, `web`. Verse counts follow English (KJV) versification. The WEB has one extra verse (3 John 1:15).
- **Inline markup inside each verse string:**
  - `[[…]]` is a Psalm superscription. It is rendered as an italic title above the verse and hidden in God's-words mode.
  - `[H430]` / `[G25]` is a Strong's tag. It **follows** the English word or phrase it belongs to (for example, `only begotten[G3439]`). A verse can start with a tag for an untranslated word.
  - `<em>…</em>` marks the KJV translators' italics for supplied words.
  - `{…}` marks the words of Jesus (red letters).
  - `«…»` marks other divine speech (God the Father / LORD / Holy Spirit).
  - In God's-words mode the renderer shows only text inside `{}` or `«»`, and puts a muted "…" between separate spoken pieces within a verse.
- **Strong's dictionary (`lex`):** `{ "H430": [lemma, translit, pron, strongs_def, kjv_def, derivation], … }`, with 14,197 entries.
- **Cross references (`xref`):** same `[book][chapter][verse]` shape. Each value is a space-separated string of up to 30 targets, strongest first. A target is `b.c.v`, `b.c.v-v2` or `b.c.v-c2.v2`, where the book is 0-based and chapter/verse are 1-based. Only references with at least 3 votes are kept.
- **Highlights and notes (db):** collection `data/users/<viewer id>`, which is private per viewer. There is one document per verse, with id `m-<b>.<c>.<v>` (book 0-based, chapter and verse 1-based) and body `{b, c, v, color, note, t}`. `color` is one of `y g b p v` or `''`. A mark with no colour and an empty note is deleted. Any marks saved in localStorage are moved into db once, on first load.

## How "God's words only" was built (important decisions)

- **Source.** Clear Bible's *MACULA Quotation and Speaker Data* (github.com/Clear-Bible/speaker-quotations, CC BY 4.0). It marks quoted speech per original-language word. The divine speakers used are `God`, `Holy Spirit, the`, `Jesus` and `Jesus (child)`. **"Angel of the LORD" is deliberately excluded**, because Ben wants only clear words of God.
- **Versification.** Clear's Old Testament references use Hebrew verse numbering. The pipeline maps Hebrew verses to KJV verses by aligning each book's verses on their Strong's-number overlap (banded dynamic-programming alignment in `s4_map.py`). Verified examples: Mal 3:19 → 4:1, Joel 3:1 → 2:28, Ezek 21:1 → 20:45, Ps 51:3 → 51:1, Job 40:25 → 41:1.
- **Cutting the KJV mid-verse.** The KJV has no quotation marks. Each KJV word is scored by whether its Strong's number belongs to the quoted or the narrative Hebrew words (using the OpenScriptures morphhb lemmas), and the maximum-scoring run of words is kept. If that fails, the cut falls back to the position of the speech within the verse, snapped to punctuation. Words of Jesus in the KJV come from CrossWire's word-level red-letter markup, not from Clear.
- **Cutting the BSB and WEB.** These use their quotation marks. Quote spans separated only by a short speech tag ("said Jesus", "says the LORD") are grouped together when choosing the span, but each quoted part is wrapped separately so the tag itself isn't marked. The WEB's red letters come from its own `\wj` markup; the BSB's red letters are derived from Clear's data plus quotation marks.
- **Known limitations (also shown in the app's About box):**
  - Only *quoted* speech is covered. Prophetic oracles that translations don't put in quotation marks are only partly included. The biggest remaining gap is Hosea 4–14, where the BSB and WEB use almost no quotation marks and the voice switches between God and the prophet.
- **Prophetic oracles (`s8_oracles.py`, added Sept 2026).** Clear's data misses many oracles that the BSB and WEB do put in quotation marks, such as Hosea 2:2–15. `s8` follows each BSB/WEB quotation across verses, Isaiah–Malachi only, skipping Lamentations and Daniel. It marks a quotation as God's when any of these hold:
  - a divine speech tag follows it ("declares the LORD", "says the LORD", "says the King of Jacob")
  - a divine introduction precedes it ("This is what the LORD says:", "The LORD said to me:", "the word of the LORD came to me, saying,")
  - part of it is already marked at the top quotation level

  Guards:
  - A quotation a person introduces ("Jeremiah said to him, “…") is not marked, even if it quotes God inside.
  - "the angel of the LORD said" does not count.
  - A “…” opened inside a ‘…’ is nested speech, never a new quotation.
  - A leading "This is what the LORD says:" inside a quotation is left outside the mark.

  The KJV verse is marked only when both the BSB and WEB mark at least 80% of it. "saith the LORD …" tags and "Thus saith the LORD …;" introductions are left outside the marks. **Only verses with no existing marks are changed.** Result: KJV +178, BSB +277, WEB +306 verses.
  - Known source errors it does not fix: Jer 51:35 (Zion's words are marked as God's) and KJV Hos 2:16 (the cut keeps only "me Ishi…").
  - Verses with two speakers can keep the other speaker's line. For example, in Exodus 3:4 the BSB keeps Moses's "Here I am".
  - John 12:28: Clear labels the Father's voice from heaven as Jesus, so in the BSB it shows red. The KJV is correct there.

## Data decisions and fixes already made

- **BSB Strong's (`pipeline/s10_bsb_strongs.py`).**
  - Source: bereanbible.com `bsb_tables.xlsx`, 55 MB, sheet5 "biblosinterlinear96". Each row is one Hebrew or Greek word in English order, with its Strong's number and its BSB English phrase (columns M VerseId, S English, K/L Strong's).
  - The phrases are aligned by word to the existing BSB strings, and a tag is inserted after each phrase and its trailing punctuation. 99.1% of phrase words align.
  - It runs **after** s8 (it reads and writes `data/bsb.b64`) and strips old tags first.
  - The renderer keeps opening quotes and trailing punctuation outside the underline, but in the same red-letter colour.
- **ASV and BLB (`pipeline/s9_versions.py`).**
  - Sources: open-bibles `eng-asv.zefania.xml` and literalbible.com `blb.txt`.
  - The divine name ("Jehovah" in the ASV, "YHWH" in the BLB) is shown as the KJV does it:
    - "O LORD"
    - "LORD, …" when a verse opens by addressing him
    - "Lord GOD"
    - otherwise "the LORD" or "The LORD"
    - Compounds such as "Jehovah-jireh" are left as they are.
  - BLB [supplied words] become `<em>`, and BLB Psalm titles become `[[…]]`. The BLB's "⁺" (plural *you*) is kept.
  - The open-bibles YLT file has the New Testament only, so the YLT was skipped.
- **NKJV is excluded because it is copyrighted (Thomas Nelson).** Never add NKJV, NIV, ESV or any other copyrighted text. The BSB (public domain since 2023) is the stand-in closest in feel to the NKJV. The *British Edition* of the WEB was chosen because it uses "LORD" rather than "Yahweh", and its British spelling suits Ben in New Zealand.
- **The KJV + Strong's source (kaiserlik/kjv) has defects the pipeline works around:**
  - Several book files are invalid JSON, so the `en` field is extracted with a regex.
  - Chapter buckets contain verses from other chapters, so verses are regrouped by the chapter in their own key.
  - `Phm.json` also contains Philippians, so keys are filtered by book prefix.
  - **3,435 verses had their final words dropped** (for example, Gen 1:9 "and it was so"). These were restored from the CrossWire OSIS KJV, so a few restored words have no Strong's tag.
- **Cross references:** OpenBible.info data (CC BY), via github.com/joshbabu/openbible.
- **Strong's dictionaries:** github.com/openscriptures/strongs (CC BY-SA).
- **Credits** for all of the above are listed in the app's About modal. Keep them there.

## Design rules

- **Apple-influenced, clean and quiet.** Ben prefers Apple aesthetics. It should feel like a native Mac app (think Apple Books or Notes), not a website.
- **Type.** The interface uses the system font (`-apple-system` / SF Pro). The Bible text uses `ui-serif` ("New York" on macOS), with Georgia as the fallback. Verse numbers are small, tabular and muted.
- **Plain hand-written CSS, no Tailwind.** Tailwind was tried and removed. It isn't needed, and plain CSS keeps the file offline and lean. Colours are CSS custom properties on `:root`, redefined for dark mode under `@media (prefers-color-scheme: dark)` with `:root:not([data-theme="light"])`, and again under `:root[data-theme="dark"]`. The appearance button cycles between automatic, light and dark.
- **Key tokens.** Text is `#1d1d1f` on `#ffffff` (dark: `#f2f2f7` on `#1c1c1e`). The sidebar is `#f5f5f7`. The accent is Apple blue `#0071e3` (dark `#0a84ff`). Red letters are `#b3141c` (dark `#ff6b6b`). Highlight tints are yellow, green, blue, pink and purple at low alpha.
- **Layout.** Frosted translucent toolbar (backdrop blur). 268 px book sidebar with a chapter grid. Reading column about 44rem wide (74rem side by side). A 340 px verse panel on the right. The chapter header is the book name in the Bible font (34 px, ink), above a large, light chapter numeral, then a thin rule and the version's full name in small spaced capitals. Ben chose this "keep it, refine it" look in Sept 2026.
- **One verse per line is a hard requirement.** Don't switch to paragraph layout unless Ben explicitly asks for it as an option.
- **Copy style.** Short, plain, sentence case. Buttons name the action ("Copy verse", "Show all 760 verses"). No jargon, no exclamation marks.
- **Viewport and appearance.** Keep the viewport meta with `viewport-fit=cover`, the safe-area padding and the explicit body background. Respect `prefers-reduced-motion`.

## Code conventions (src/app.js)

- Plain browser JavaScript, a single global state object `S` (saved to `bible.state`), and full re-render per chapter via `draw()`. `render(str, opts)` parses one verse's markup into HTML; `opts` is `{strongs, god, q (search highlight regex), hl (Strong's id to highlight)}`.
- `searchMode` is `null` while reading, or `{type:'t'|'s'|'m'}` for text search, Strong's search and the highlights list. `rerunSearch()` redraws whichever is active after a setting changes.
- Keep data loading lazy. The current version loads first; the others, the lexicon and the cross references load in the background about 600 ms after first paint.
- Test after changes by opening `dist/bible.html` in a real browser. The development loop used Playwright/Chromium screenshots of John 3, Exodus 20 and Isaiah 1 in God's-words mode, Genesis 1 side by side, and the highlights list.

## Ideas discussed but not built yet

Ben has asked what would take the app further. He hasn't picked anything yet. Recommended first:

1. **Ask about a passage**: an AI explanation of a verse in context, via the `sample` capability. It uses the viewer's own Claude usage and asks consent on first use.
2. **Better God's-words coverage**: the quoted oracles were done in Sept 2026 (`s8_oracles.py`). Still open:
   - Hosea 4–14 and other unquoted first-person oracles, which would need verse-by-verse first-person detection.
   - God's words quoted *inside* a prophet's speech that Clear missed, for example Jer 21:7 and 21:10 (‘…,’ declares the LORD, ‘…’).
3. **Reading plans**: daily checklist and streak, stored in db.

Also discussed: word-study pages for Strong's numbers, a Hebrew/Greek interlinear line, tags on notes, memorisation mode, exporting notes (`downloads` capability), read-aloud, and maps and timeline.

Earlier ideas still open:
- Fill Strong's tags for the restored KJV words.
- Review verses with two speakers.
- About 36 KJV verses still end mid-sentence, 24 of them in Psalms with titles, where the end-of-verse restoration missed. For example, Ps 3:1 ends "…they that rise up" without "against me". Some flagged verses legitimately continue into the next verse, such as Gen 23:17.
- Red letters and God's words for the BLB, perhaps transferred from the BSB, since the two share a translation committee.
