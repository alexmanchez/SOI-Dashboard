"""Remove unused `React` default imports from files that don't reference React
directly (e.g., no React.Fragment, no React.Children, no React.createContext).

Vite + React 18's automatic JSX runtime means `import React` is not needed for
JSX to compile. We keep it only in files that use `React.*` directly.
"""
import re
from pathlib import Path
import subprocess, json

ROOT = Path(__file__).resolve().parent

# Run eslint, find files where no-unused-vars flags 'React'
proc = subprocess.run(
    ['npx', 'eslint', 'src', '--format=json'],
    cwd=ROOT, capture_output=True, shell=True,
)
raw = proc.stdout.decode('utf-8', errors='replace')
data = json.loads(raw)

files_to_fix = set()
for entry in data:
    for m in entry.get('messages', []):
        if m.get('ruleId') == 'no-unused-vars' and "'React'" in m.get('message', ''):
            files_to_fix.add(entry['filePath'])

for fp in sorted(files_to_fix):
    p = Path(fp)
    src = p.read_text(encoding='utf-8')
    # Case 1: `import React, { A, B } from 'react';` → `import { A, B } from 'react';`
    new_src = re.sub(
        r"import\s+React\s*,\s*\{",
        "import {",
        src,
        count=1,
    )
    # Case 2: `import React, {` on multi-line (same regex covers this when DOTALL is off)
    # Case 3: `import React from 'react';\n` → remove the whole line
    new_src = re.sub(
        r"^import\s+React\s+from\s+['\"]react['\"]\s*;\s*\n",
        "",
        new_src,
        flags=re.MULTILINE,
    )
    if new_src != src:
        p.write_text(new_src, encoding='utf-8')
        print(f'  fixed {p.relative_to(ROOT)}')

print('\nDone.')
