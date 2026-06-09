# -*- coding: utf-8 -*-
import re, sys, io
sys.stdout = io.TextIOWrapper(sys.stdout.buffer, encoding='utf-8')

with open('zhan_standalone_design_in.html', 'r', encoding='utf-8') as f:
    text = f.read()

# ---- 1. Find boundaries ----
style1_start = text.find('<style>')
style1_end = text.find('</style>', style1_start) + 8
body_start = text.find('<body>')
script_start = text.find('<script>', body_start)

# ---- 2. Extract ----
css1 = text[style1_start:style1_end]
scripts = text[script_start:]

# ---- 3. Card colors CSS ----
marker = '/* card colors */'
idx1 = css1.find(marker)
idx2 = css1.find(marker, idx1 + 1)
card_colors = css1[idx2:]

# ---- 4. New CSS ----
new_css = open('new_css_part.txt', 'r', encoding='utf-8').read()
new_css_full = '<style>\n' + new_css + '\n' + card_colors

# ---- 5. New Body ----
new_body = open('new_body_part.txt', 'r', encoding='utf-8').read()

# ---- 6. Combine ----
result = '<!DOCTYPE html>\n<html lang="zh-CN">\n<head>\n<meta charset="UTF-8">\n<meta name="viewport" content="width=device-width, initial-scale=1.0, user-scalable=no">\n<title>斩 v10.0</title>\n'
result += new_css_full + '\n</head>\n' + new_body + '\n' + scripts

# ---- 7. Verify ----
ids_to_check = [
    'player-avatar', 'player-hp', 'player-shield', 'player-badges',
    'enemy-avatar', 'enemy-name', 'enemy-hp', 'enemy-shield', 'enemy-power',
    'enemy-badges', 'enemy-intent', 'deck-remain', 'hidden-cards', 'visible-cards',
    'spirit-bar-inner', 'spirit-text', 'boss-portrait-bg', 'damage-popup-container',
    'slot-bar', 'removed-bar', 'board', 'combo-bar',
    'btn-end-turn', 'btn-remove-card', 'btn-shuffle', 'btn-settings'
]
for eid in ids_to_check:
    if '"' + eid + '"' not in result and "'" + eid + "'" not in result:
        print(f'WARNING: id="{eid}" not found!')

# Check no #log
if '#log' in result:
    print('WARNING: #log still present!')

# Check external src
ext_srcs = re.findall(r'src="([^"]+)"', result)
for s in ext_srcs:
    if not s.startswith('data:') and not s.startswith('javascript:'):
        print(f'External src: {s}')

# Check for JUNK content
if 'JUNK' in result:
    print('WARNING: JUNK still present in result!')

# ---- 8. Write ----
with open('zhan_standalone.html', 'w', encoding='utf-8') as f:
    f.write(result)
print(f'Done: {len(result)} bytes ({len(result)/1024:.1f} KB)')
