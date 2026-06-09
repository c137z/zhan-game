import sys, io, re
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('zhan_standalone.html', 'r', encoding='utf-8') as f:
    t = f.read()

print(f"File size: {len(t)} bytes ({len(t)/1024:.1f} KB)")

# Check no debug log area
print(f"Has #log: {'#log' in t}")
print(f"Has 'log': {'<div id=\"log\"' in t or '<div id=log' in t}")
print(f"Has JUNK: {'JUNK' in t}")

# Check critical ids
ids_to_check = [
    'player-avatar', 'player-hp', 'player-shield', 'player-badges',
    'enemy-avatar', 'enemy-name', 'enemy-hp', 'enemy-shield', 'enemy-power',
    'enemy-badges', 'enemy-intent', 'deck-remain', 'hidden-cards', 'visible-cards',
    'spirit-bar-inner', 'spirit-text', 'boss-portrait-bg', 'damage-popup-container',
    'slot-bar', 'removed-bar', 'board', 'combo-bar',
    'btn-end-turn', 'btn-remove-card', 'btn-shuffle', 'btn-settings',
    'remove-ad-count', 'shuffle-ad-count', 'actions'
]
missing = [eid for eid in ids_to_check if f'id="{eid}"' not in t]
if missing:
    print(f"MISSING ids: {missing}")
else:
    print("All critical ids: OK")

# Check layout order
for sec in ['top-row', 'slot-bar', 'removed-bar', 'board', 'actions']:
    idx = t.find(f'id="{sec}"')
    print(f"  {sec}: byte {idx}")

# Check no external src
external_srcs = []
for m in re.finditer(r'src="([^"]+)"', t):
    s = m.group(1)
    if not s.startswith('data:') and not s.startswith('javascript:'):
        external_srcs.append(s)
if external_srcs:
    print(f"External srcs: {external_srcs}")
else:
    print("No external src references: OK")

# Check CSS style tags
style_open = t.count('<style>')
style_close = t.count('</style>')
print(f"Style tags: {style_open} open, {style_close} close")

print("Verification complete!")
