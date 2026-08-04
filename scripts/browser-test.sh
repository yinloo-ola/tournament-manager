#!/usr/bin/env bash
#
# browser-test.sh — repeatable agent-browser smoke test for Tournament Manager.
#
# Drives the running dev server through every user-facing feature:
#   0. Open + clean slate (clear autosave) + deterministic dialog/download shim
#   1. Tournament + Singles-category configuration
#   2. Singles entry import (.xlsx)
#   3. Draw (auto) + round generation      [covers the odd-group-size path]
#   4. Matches view (Group / Groups / Knockout tabs)
#   5. Export round-robin charts (.xlsx)
#   6. Export draft schedule (.xlsx)
#   7. Import final schedule (.xlsx read-back + merge)
#   8. Export scoresheets from a template (.xlsx)
#   9. Save tournament (.json)
#  10. Load tournament .json (brings in Doubles + Team categories)
#  11. Doubles + Team entry import (all three importers)
#  12. Add / remove category
#
# Prerequisites:
#   - dev server:  cd web && npm run dev   (serves $BASE_URL)
#   - agent-browser CLI on PATH, and node on PATH
#
# Usage:
#   BASE_URL=http://localhost:5173/tournament-manager ./scripts/browser-test.sh
#
# Design notes:
#   * Uses one named browser session ("tm-test") across all steps.
#   * Hash routing + IndexedDB autosave mean reloads resume state, so Phase 0
#     clears the autosave stores and forces a real reload for a clean slate.
#   * window.confirm is forced true and window.alert is captured to
#     window.__lastAlert so JS-dialog flows are deterministic. Toast feedback
#     (M3 SnackbarHost, [role="status"]) is captured to window.__lastToast via
#     a MutationObserver, since success/error messages migrated off alert().
#   * Click-triggered blob downloads (RR chart, draft schedule) are captured
#     with `download <sel> <path>`. Upload-triggered blob downloads
#     (scoresheet, save) cannot be caught by a later wait, so the shim wraps
#     URL.createObjectURL and rebuilds a persistent <a id="__cap_download">
#     from the captured bytes, which `download` then clicks into a known path.
#   * Selectors use data-test hooks added next to this script.

set -euo pipefail

BASE_URL="${BASE_URL:-http://localhost:5173/tournament-manager}"
APP="$BASE_URL/#/tournament"
OUT="${OUT:-/tmp/tm-test}"
REPO="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
TD="$REPO/web/testdata"
SESSION="${SESSION:-tm-test}"

mkdir -p "$OUT"
rm -f "$OUT"/*.xlsx "$OUT"/*.json "$OUT"/*.png 2>/dev/null || true

AB="agent-browser --session $SESSION --json --download-path $OUT"

FAILS=0
phase(){ printf '\n\033[1;36m== %s ==\033[0m\n' "$1"; }
pass(){  printf '  \033[32mPASS\033[0m %s\n' "$1"; }
fail(){  printf '  \033[31mFAIL\033[0m %s\n' "$1"; FAILS=$((FAILS+1)); }

# Dot-path field from JSON on stdin:  echo "$j" | jget data.result
jget(){ node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{try{let v=JSON.parse(d);for(const k of process.argv[1].split("."))v=v==null?v:v[k];process.stdout.write(v==null?"":String(v));}catch(e){process.exit(1);}})' "$1"; }
pv(){ echo "$1" | $AB eval --stdin | jget data.result; }        # page eval -> string
cap_reset(){ pv "(()=>{[...document.querySelectorAll('a#__cap_download')].forEach(a=>a.remove());window.__capReady=false;window.__capName='';return 'ok';})()"; }

read -r -d '' SHIM <<'JS' || true
(() => {
  window.__lastAlert = null;
  window.__lastToast = null;
  window.confirm = () => true;
  window.alert = (m) => { window.__lastAlert = String(m); };
  try { delete window.showSaveFilePicker; } catch(e) {}
  try { delete window.showOpenFilePicker; } catch(e) {}
  window.__capReady = false; window.__capName = ''; window.__capReplay = false;
  // Toast capture: the M3 SnackbarHost renders [role="status"][aria-live] and
  // auto-dismisses after 4s. A MutationObserver records the latest toast text
  // into __lastToast, mirroring the old __lastAlert pattern for alert()-based
  // feedback that has since migrated to non-blocking toasts.
  new MutationObserver(() => {
    const el = document.querySelector('[role="status"][aria-live="polite"]');
    if (el && el.textContent) window.__lastToast = el.textContent.trim();
  }).observe(document.body, { childList: true, subtree: true });
  const origCreate = URL.createObjectURL;
  URL.createObjectURL = function(blob) {
    const url = origCreate.apply(this, arguments);
    if (!window.__capReplay && blob && typeof blob.size === 'number' && blob.size > 0) {
      blob.arrayBuffer().then((buf) => {
        try {
          window.__capReplay = true;
          const repl = origCreate.call(URL, new Blob([new Uint8Array(buf)], { type: blob.type }));
          [...document.querySelectorAll('a#__cap_download')].forEach(a=>a.remove());
          const a = document.createElement('a');
          a.id = '__cap_download'; a.href = repl; a.download = window.__capName || 'download.bin';
          a.textContent = 'CAP';
          a.style.cssText = 'position:fixed;top:0;left:0;z-index:99999;padding:8px;background:#fff;color:#000;font-size:12px;';
          document.body.appendChild(a);
          window.__capReady = true;
        } finally { window.__capReplay = false; }
      });
    }
    return url;
  };
  const origClick = HTMLAnchorElement.prototype.click;
  HTMLAnchorElement.prototype.click = function() { if (this.download) window.__capName = this.download; return origClick.apply(this, arguments); };
  return 'shim';
})()
JS

echo "Target: $APP"
echo "Output: $OUT"

# --- 0. clean slate + open + shim -----------------------------------------
phase "0. Open + clean slate"
$AB open "$APP" --load networkidle >/dev/null
pv "(async()=>{const db=await new Promise((r,j)=>{const q=indexedDB.open('tournament-manager');q.onsuccess=()=>r(q.result);q.onerror=()=>j(q.error);});await new Promise((r,j)=>{const t=db.transaction(['autosave','recents'],'readwrite');t.objectStore('autosave').clear();t.objectStore('recents').clear();t.oncomplete=()=>r();t.onerror=()=>j(t.error);});db.close();return 'cleared';})()" >/dev/null
$AB open about:blank >/dev/null
$AB open "$APP" --load networkidle >/dev/null
echo "$SHIM" | $AB eval --stdin >/dev/null
pass "clean slate + shim installed"

# --- 1. configuration ------------------------------------------------------
phase "1. Tournament + Singles category configuration"
$AB fill "input[name='tournament']" "Test Cup" >/dev/null
$AB fill "input[name='tables']" "4" >/dev/null
$AB fill "input[name='category']" "Men's Singles" >/dev/null
$AB fill "input[name='categoryShort']" "MS" >/dev/null
$AB fill "input[name='durationMinutes']" "30" >/dev/null
$AB fill "input[name='numQualifiedPerGroup']" "2" >/dev/null
[ "$(pv "document.querySelector(\"input[name='tournament']\").value")" = "Test Cup" ] && pass "tournament name set" || fail "name"
[ "$(pv "document.querySelector(\"select[name='entryType']\").value")" = "Singles" ] && pass "entry type Singles" || fail "entry type"

# --- 2. singles import -----------------------------------------------------
phase "2. Import Singles entries"
$AB upload "input[data-test='input-entries']" "$TD/Men Singles.xlsx" >/dev/null
sleep 1
n="$(pv "document.querySelector(\"input[name='playerCount']\").value")"
[ "${n:-0}" -gt 0 ] 2>/dev/null && pass "imported $n singles" || fail "singles import ($n)"

# --- 3. draw + rounds ------------------------------------------------------
phase "3. Draw + round generation"
pv "window.__lastToast=null;window.__lastAlert=null" >/dev/null
$AB click "button[data-test='do-draw']" >/dev/null
sleep 1
$AB fill "input[placeholder='sleep']" "0" >/dev/null
$AB click "text=AUTO DRAW" >/dev/null
sleep 3
$AB click "button[aria-label='Close dialog']" >/dev/null      # close modal -> drawDone -> generateRounds
sleep 1
a="$(pv "window.__lastToast||window.__lastAlert||''")"
{ [ -z "$a" ] || ! [[ "$a" =~ (error|should|difference|encounter) ]]; } && pass "draw + rounds generated" || fail "draw error: $a"

# --- 4. matches view -------------------------------------------------------
phase "4. Matches view (3 tabs)"
$AB click "button[data-test='matches']" >/dev/null
sleep 1
gm="$(pv "document.body.textContent.includes('Group Matches')?'yes':'no'")"
$AB click "text=Groups" >/dev/null
g1="$(pv "document.body.textContent.includes('Group 1')?'yes':'no'")"
$AB click "text=Knockout" >/dev/null
ko="$(pv "/Knockout/.test(document.body.textContent)?'yes':'no'")"
$AB open "$APP" --load networkidle >/dev/null
echo "$SHIM" | $AB eval --stdin >/dev/null     # re-install after reload
[ "$gm" = yes ] && [ "$g1" = yes ] && [ "$ko" = yes ] && pass "all 3 tabs render" || fail "matches tabs (gm=$gm g=$g1 ko=$ko)"

# --- 5. RR charts ----------------------------------------------------------
phase "5. Export round-robin charts"
$AB click "text=Document" >/dev/null
$AB download "text=Export round-robin charts" "$OUT/rr.xlsx" >/dev/null
[ -s "$OUT/rr.xlsx" ] && pass "rr.xlsx ($(wc -c <"$OUT/rr.xlsx") B)" || fail "RR chart export"

# --- 6. draft schedule -----------------------------------------------------
phase "6. Export draft schedule"
$AB click "text=Document" >/dev/null
$AB download "text=Export draft schedule" "$OUT/draft.xlsx" >/dev/null
[ -s "$OUT/draft.xlsx" ] && pass "draft.xlsx ($(wc -c <"$OUT/draft.xlsx") B)" || fail "draft schedule export"

# --- 7. import final schedule ---------------------------------------------
phase "7. Import final schedule"
# Let any prior toast (phase 6's "Draft schedule exported") auto-dismiss first,
# so __lastToast captures only this phase's result.
sleep 4
pv "window.__lastToast=null;window.__lastAlert=null" >/dev/null
$AB upload "input[data-test='input-final-schedule']" "$OUT/draft.xlsx" >/dev/null
# The import is async (ExcelJS parse + merge); poll for the toast up to 8s.
a=""
for _ in $(seq 1 16); do
  sleep 0.5
  a="$(pv "window.__lastToast||window.__lastAlert||''")"
  [ -n "$a" ] && break
done
[ "$a" = "Final schedule imported successfully" ] && pass "final schedule merged" || fail "final schedule ($a)"

# --- 8. scoresheet (upload-triggered blob) --------------------------------
phase "8. Export scoresheets from template"
cap_reset >/dev/null
$AB upload "input[data-test='input-scoresheet-template']" "$TD/scoresheet template.xlsx" >/dev/null
$AB wait --fn "window.__capReady===true" --timeout 15000 >/dev/null
$AB download "a#__cap_download" "$OUT/scoresheet.xlsx" >/dev/null
[ -s "$OUT/scoresheet.xlsx" ] && pass "scoresheet.xlsx ($(wc -c <"$OUT/scoresheet.xlsx") B)" || fail "scoresheet export"

# --- 9. save (download fallback) ------------------------------------------
phase "9. Save tournament"
cap_reset >/dev/null
$AB click "text=Save" >/dev/null
$AB wait --fn "window.__capReady===true" --timeout 10000 >/dev/null
$AB download "a#__cap_download" "$OUT/saved.json" >/dev/null
if [ -s "$OUT/saved.json" ] && node -e 'JSON.parse(require("fs").readFileSync(process.argv[1],"utf8"))' "$OUT/saved.json" 2>/dev/null; then
  pass "saved.json valid ($(wc -c <"$OUT/saved.json") B)"
else
  fail "save / invalid JSON"
fi

# --- 10. load tournament.json ---------------------------------------------
phase "10. Load tournament.json"
$AB upload "input[data-test='input-load']" "$TD/tournament.json" >/dev/null
sleep 1
h="$(pv "document.querySelector('header').textContent.includes('Singapore Open 2025')?'yes':'no'")"
[ "$h" = yes ] && pass "loaded (Singapore Open 2025, 3 categories)" || fail "load"

# --- 11. doubles + team import --------------------------------------------
phase "11. Doubles + Team import (3 importers)"
$AB upload ":nth-match(input[data-test='input-entries'], 2)" "$TD/Mens Doubles.xlsx" >/dev/null
sleep 1
$AB upload ":nth-match(input[data-test='input-entries'], 3)" "$TD/Mens Team.xlsx" >/dev/null
sleep 1
counts="$(pv "JSON.stringify([...document.querySelectorAll('[data-test=category-card]')].map(c=>+c.querySelector(\"input[name='playerCount']\").value))")"
echo "  entry counts [MS,MD,MT]: $counts"
md="$(echo "$counts" | node -e 'let d="";process.stdin.on("data",c=>d+=c).on("end",()=>{const a=JSON.parse(d);process.stdout.write(a[1]>0&&a[2]>0?"yes":"no")})')"
[ "$md" = yes ] && pass "doubles + team imported" || fail "doubles/team import"

# --- 12. add / remove category --------------------------------------------
phase "12. Add / remove category"
$AB click "text=Add category" >/dev/null
c="$(pv "document.querySelectorAll('[data-test=category-card]').length")"
# Remove the last (just-added) card via its title'd remove button, scoped inside the card.
$AB click "[data-test=category-card]:last-of-type button[title='Remove category']" >/dev/null
c2="$(pv "document.querySelectorAll('[data-test=category-card]').length")"
[ "$c" = "$(( ${c2:-0} + 1 ))" ] && pass "add ($c) then remove ($c2)" || fail "add/remove ($c -> $c2)"

# --------------------------------------------------------------------------
echo ""
$AB screenshot --full "$OUT/final.png" >/dev/null 2>&1 || true
if [ "$FAILS" -eq 0 ]; then printf '\033[1;32mALL CHECKS PASSED\033[0m  (screenshot: %s)\n' "$OUT/final.png";
else printf '\033[1;31m%d CHECK(S) FAILED\033[0m\n' "$FAILS"; fi
# $AB close >/dev/null 2>&1 || true   # uncomment to close the browser when done
exit "$FAILS"