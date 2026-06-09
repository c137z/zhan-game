import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('zhan_standalone.html', 'r', encoding='utf-8') as f:
    t = f.read()

print("=== FINAL VERIFICATION ===")
print(f"File size: {len(t)} bytes ({len(t)/1024:.1f} KB)")

# Layout order check
sections = ["top-row", "deck-info", "slot-bar", "combo-bar", "removed-bar", "board", "actions"]
positions = {}
for sec in sections:
    q = 'id="' + sec + '"'
    idx = t.find(q)
    if idx >= 0:
        positions[sec] = idx
    else:
        print(f"  MISSING: {sec}")

# Check positions are in order
sorted_secs = sorted(positions.items(), key=lambda x: x[1])
print("\nLayout order in HTML body:")
for sec, pos in sorted_secs:
    print(f"  {sec}: byte {pos}")

# Spirit bomb position
sb_idx = t.find("spirit-bar-wrap")
if sb_idx >= 0:
    # Check context before it for position property
    before = t[sb_idx-500:sb_idx]
    if "position: fixed" in t:
        print("\nSpirit bar: position: fixed - OK")
    elif "position: absolute" in t and "spirit-bar-wrap" in t:
        print("\nWARNING: Spirit bar uses position: absolute!")
    else:
        print("\nSpirit bar position check: looking...")
        # Find the CSS block for spirit-bar-wrap
        css_start = t.find("#spirit-bar-wrap", sb_idx-5000)
        if css_start >= 0:
            block = t[css_start:css_start+400]
            print(f"CSS for spirit-bar-wrap: {block[:300]}")

# Check btn-end-turn styling
et_idx = t.find("#btn-end-turn")
if et_idx >= 0:
    block = t[et_idx:et_idx+400]
    if "width: 50%" in block:
        print("btn-end-turn: width 50% - OK")
    if "f1c40f" in block or "e67e22" in block:
        print("btn-end-turn: gold styling - OK")

# Check btn-remove-card and btn-shuffle sizing
for bid in ["#btn-remove-card", "#btn-shuffle"]:
    idx = t.find(bid)
    if idx >= 0:
        block = t[idx:idx+200]
        if "aspect-ratio: 1.2" in block:
            print(f"{bid}: aspect-ratio OK")

# Character sizes
for cls in [".avatar", ".enemy-avatar"]:
    idx = t.find(cls)
    if idx >= 0:
        block = t[idx:idx+100]
        print(f"{cls}: {block[:80]}")

# Verify no <div id="log"
if '<div id="log"' in t or "<div id='log'" in t:
    print("ERROR: #log div still present!")
else:
    print("\nNo #log div: OK")

# Check JS showDamagePopup
dmg_idx = t.find("showDamagePopup = function")
if dmg_idx >= 0:
    dmg_code = t[dmg_idx:dmg_idx+30]
    print(f"\nshowDamagePopup updated: {dmg_code}")

print("\n=== VERIFICATION COMPLETE ===")
