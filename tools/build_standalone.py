import os
import subprocess
import re
import glob

base = r'C:\Users\kyzha\.openclaw\projects\zhan\code'
artifacts_dir = r'C:\Users\kyzha\.openclaw\projects\zhan\artifacts'
repo_dir = r'C:\Users\kyzha\.openclaw\projects\zhan'

# --- Determine version ---
# MAJOR: extract from existing artifacts (e.g. zhan_v1.9.html → 1)
major = 1
existing = glob.glob(os.path.join(artifacts_dir, 'zhan_v*.html'))
if existing:
    versions = []
    for f in existing:
        m = re.search(r'zhan_v(\d+)\.(\d+)\.html', os.path.basename(f))
        if m:
            versions.append((int(m.group(1)), int(m.group(2))))
    if versions:
        major = max(v[0] for v in versions)

# COMMIT_COUNT: from git
try:
    result = subprocess.run(
        ['git', 'rev-list', '--count', 'HEAD'],
        cwd=repo_dir,
        capture_output=True, text=True
    )
    commit_count = int(result.stdout.strip())
except Exception:
    commit_count = 0

version_str = f'v{major}.{commit_count}'
out = os.path.join(artifacts_dir, f'zhan_{version_str}.html')

# --- Build ---
with open(os.path.join(base, 'index.html'), 'r', encoding='utf-8') as f:
    html = f.read()

for name in ['style.css', 'relic.css']:
    with open(os.path.join(base, name), 'r', encoding='utf-8') as f:
        html = html.replace(
            f'<link rel="stylesheet" href="{name}">',
            f'<style>\n{f.read()}\n</style>'
        )

for name in ['data.js', 'core.js', 'ui.js']:
    with open(os.path.join(base, name), 'r', encoding='utf-8') as f:
        html = html.replace(
            f'<script src="{name}"></script>',
            f'<script>\n{f.read()}\n</script>'
        )

with open(out, 'w', encoding='utf-8') as f:
    f.write(html)

print(f'{version_str}: {os.path.getsize(out)} bytes')
print(f'OUTPUT: {out}')
