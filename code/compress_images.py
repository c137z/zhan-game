# -*- coding: utf-8 -*-
"""压缩 index.html 中的 base64 卡牌图片，目标 ~1MB"""
import re, io, base64
from PIL import Image

with open('index.html', 'r', encoding='utf-8') as f:
    html = f.read()

print(f'原始大小: {len(html)/1024:.0f} KB ({len(html)/1024/1024:.1f} MB)')

# 匹配 url(data:image/jpeg;base64,XXXXX)
pattern = re.compile(r'url\(data:image/(jpeg|png);base64,([A-Za-z0-9+/=]+)\)')
matches = list(pattern.finditer(html))
print(f'找到 {len(matches)} 张图片')

total_before = sum(len(m.group(2)) for m in matches)
print(f'图片编码总大小: {total_before/1024:.0f} KB')

# 从后往前替换
count = 0
total_after = 0
for m in reversed(matches):
    fmt = m.group(1)  # jpeg or png
    b64_str = m.group(2)
    raw = base64.b64decode(b64_str)

    img = Image.open(io.BytesIO(raw))
    w, h = img.size

    # 缩小到 50%，JPEG quality 50
    new_w, new_h = max(1, w // 2), max(1, h // 2)
    img = img.resize((new_w, new_h), Image.LANCZOS)

    buf = io.BytesIO()
    img.save(buf, format='JPEG', quality=50, optimize=True)
    compressed = base64.b64encode(buf.getvalue()).decode('ascii')

    # 替换 base64 数据部分
    start, end = m.start(2), m.end(2)
    html = html[:start] + compressed + html[end:]

    count += 1
    total_after += len(compressed)
    print(f'  [{count}/{len(matches)}] {w}x{h} -> {new_w}x{new_h}, {len(b64_str)/1024:.0f}KB -> {len(compressed)/1024:.0f}KB')

print(f'\n图片总大小: {total_before/1024:.0f}KB -> {total_after/1024:.0f}KB')
print(f'文件总大小: {len(html)/1024:.0f} KB ({(len(html)/1024/1024):.1f} MB)')

with open('index.html', 'w', encoding='utf-8') as f:
    f.write(html)

print('Done.')
