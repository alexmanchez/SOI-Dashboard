"""Auto-remove unused named imports flagged by eslint no-unused-vars.

Rules:
- Only touches NAMED imports (e.g. `import { A, B } from 'x'`).
- Skips default imports, namespace imports, and non-import declarations.
- For each unused name eslint reports at column C of a line containing
  `import { ... }`, strip that name from the braces.
- If the final import statement has no remaining names, delete the whole line.
"""
import json
import re
import subprocess
from pathlib import Path

ROOT = Path(__file__).resolve().parent

# Run eslint once, get JSON output
proc = subprocess.run(
    ['npx', 'eslint', 'src', '--format=json'],
    cwd=ROOT, capture_output=True, shell=True,
)
# eslint exits nonzero when there are errors; still parse stdout.
# Decode as utf-8 ignoring bad bytes (eslint may emit Windows smart quotes).
raw = proc.stdout.decode('utf-8', errors='replace')
data = json.loads(raw)

# Build: { filepath: [(line, name), ...] }
by_file = {}
for entry in data:
    fp = entry['filePath']
    for m in entry.get('messages', []):
        if m.get('ruleId') != 'no-unused-vars':
            continue
        # Extract the unused name from the message "X' is defined but never used. ..."
        msg = m.get('message', '')
        name_match = re.match(r"'([^']+)'", msg)
        if not name_match:
            continue
        name = name_match.group(1)
        line = m.get('line')
        by_file.setdefault(fp, []).append((line, name))

total_removed = 0
for fp, items in by_file.items():
    p = Path(fp)
    src = p.read_text(encoding='utf-8')
    lines = src.splitlines(keepends=True)

    # Collect names to remove per line
    per_line = {}
    for line, name in items:
        per_line.setdefault(line, set()).add(name)

    removed_here = 0
    for line_no, names in sorted(per_line.items(), reverse=True):
        # Consider: eslint lines are 1-based; multi-line imports have all names
        # reported on the line their identifier appears. Need to handle both
        # single- and multi-line import blocks.

        # Find the containing import statement: scan upward to find
        # `import { ... }` opening, scan downward to find `} from '...'` close.
        start = line_no - 1
        while start > 0 and 'import ' not in lines[start] and '{' not in lines[start]:
            start -= 1
        # If the line at `start` doesn't start with `import`, keep walking up
        while start > 0 and not lines[start].lstrip().startswith('import '):
            start -= 1
        # Find end of import block
        end = start
        while end < len(lines) and 'from ' not in lines[end]:
            end += 1
        if end >= len(lines):
            continue  # couldn't find `from` — skip

        # Reconstruct the import block
        block = ''.join(lines[start:end + 1])
        # Match `import { ... } from '...'` shape
        m = re.search(
            r"(import\s+)(?:([A-Za-z_]\w*)\s*,\s*)?\{\s*([^}]+)\}\s*(from\s+['\"][^'\"]+['\"]\s*;?)",
            block,
            re.DOTALL,
        )
        if not m:
            continue
        lead = m.group(1)
        default_import = m.group(2)
        inner = m.group(3)
        tail = m.group(4)

        # Split names (respect `A as B` aliases — remove if original identifier is flagged)
        parts = [p_.strip() for p_ in inner.split(',') if p_.strip()]
        kept = []
        for part in parts:
            # `A as B` → effective name is `B`; we check `B` in names set
            if ' as ' in part:
                effective = part.split(' as ')[-1].strip()
            else:
                effective = part
            if effective in names:
                removed_here += 1
                continue
            kept.append(part)

        if kept:
            new_inner = ', '.join(kept)
            # If the block was multi-line, keep it multi-line; else single-line
            is_multiline = block.count('\n') > 0
            if is_multiline:
                new_block = f"{lead}{default_import + ', ' if default_import else ''}{{\n  {new_inner},\n}} {tail}\n"
            else:
                new_block = f"{lead}{default_import + ', ' if default_import else ''}{{ {new_inner} }} {tail}\n"
        else:
            # No names remain — check if there's a default import still; if so keep it.
            if default_import:
                new_block = f"{lead}{default_import} {tail}\n"
            else:
                new_block = ''  # delete whole line

        # Replace lines[start:end+1] with new_block
        lines[start:end + 1] = [new_block] if new_block else ['']

    if removed_here > 0:
        p.write_text(''.join(lines), encoding='utf-8')
        total_removed += removed_here
        print(f'  {p.relative_to(ROOT)}: removed {removed_here}')

print(f'\nTotal unused imports removed: {total_removed}')
