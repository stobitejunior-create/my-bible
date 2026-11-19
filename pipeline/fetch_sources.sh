#!/usr/bin/env bash
# Downloads the raw sources the pipeline scripts expect. The scripts were written
# in a sandbox and read from absolute /tmp paths: run this with SRC=/tmp, or
# update the paths in each script.
set -e
SRC=${SRC:-/tmp}; cd "$SRC"
git clone --depth 1 https://github.com/kaiserlik/kjv.git                       # KJV + Strong's (per-book JSON)
git clone --depth 1 https://github.com/Clear-Bible/speaker-quotations.git sq   # speaker data (CC BY 4.0)
git clone --depth 1 https://github.com/openscriptures/morphhb.git              # WLC Hebrew with Strong's lemmas
git clone --depth 1 https://github.com/openscriptures/strongs.git              # Strong's dictionaries
for f in eng-kjv.osis.xml eng-bsb.usfx.xml; do
  curl -sL -o "$f" "https://raw.githubusercontent.com/seven1m/open-bibles/master/$f"
done
curl -sL -o webbe.xml https://raw.githubusercontent.com/seven1m/open-bibles/master/eng-gb-webbe.usfx.xml
git clone --depth 1 --filter=blob:none --no-checkout https://github.com/joshbabu/openbible.git ob
(cd ob && git checkout HEAD -- cross_references_expanded.csv)                  # OpenBible.info cross refs (CC BY)
