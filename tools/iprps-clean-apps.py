#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""
iprps-clean-apps.py - make a clean, distributable copy of the IPRPS web apps.

Usage (Debian/WSL, as root):
    python3 iprps-clean-apps.py /mnt/d/IPRPS-OS/Server /build/src/iprps-apps

Never changes the source folder. In the copy it:
  * leaves out old/backup copies, Windows clutter and the SQL exports;
  * renames app folders with spaces or capitals (lowercase-with-dashes);
  * points every database setting at the local MariaDB:
      hosting host -> localhost, dbsNNN -> iprps_<app>, dbuNNN -> iprps,
      every database password -> @IPRPS_DB_PASS@ (filled in later);
  * removes API keys (Anthropic, OpenAI, Google, xAI) and stored passwords in JSON data;
  * writes a report: what changed, and anything that still looks secret.
"""
import os, re, sys, json, shutil

DB_MAP = {
    'dbs15863785': 'iprps_auth',
    'dbs15389281': 'iprps_cerebrum1', 'dbs15389600': 'iprps_cerebrum2', 'dbs15389670': 'iprps_cerebrum3',
    'dbs15994502': 'iprps_character', 'dbs15968534': 'iprps_cookbook', 'dbs15215034': 'iprps_story',
    'dbs15234695': 'iprps_interstellar', 'dbs15614716': 'iprps_crt', 'dbs16050888': 'iprps_video',
    'dbs15250527': 'iprps_language', 'dbs15926577': 'iprps_lookbook', 'dbs15772721': 'iprps_radio',
    'dbs15792286': 'iprps_storyboard', 'dbs15780226': 'iprps_storynode', 'dbs15783496': 'iprps_storytoscreen',
}
PH = '@IPRPS_DB_PASS@'
RENAME = {'ComicBookBuilder': 'comic-book-builder'}
TEXT_EXT = {'.php', '.js', '.json', '.env', '.ini', '.html', '.htm', '.inc', '.txt', '.md', '.sql'}
SKIP_DIRS = {'sql', '.git', 'node_modules'}
OLD_RE = re.compile(r'(_old|_older|-broken|_backup|\.bak$|\.orig$|~$)', re.I)
CLUTTER = re.compile(r'^(thumbs\.db|desktop\.ini|\.ds_store)$|:zone\.identifier$', re.I)

R_HOST = re.compile(r'db\d{6,}\.hosting-data\.io')
R_DBS = re.compile(r'\bdbs\d{6,}\b')
R_DBU = re.compile(r'\bdbu\d{4,}\b')
# PHP:  'pass' => 'x'   "password" => "x"   'db_pass' => 'x'
R_ARR = re.compile(r"""((['"])(?:pass|password|db_pass|dbpass|DB_PASS|DB_PASSWORD)\2\s*=>\s*)(['"])(?!\{\{)(.+?)\3""")
# PHP:  define('DB_PASS', 'x')   const DB_PASS = 'x'   $db_pass = 'x'
R_DEF = re.compile(r"""(define\(\s*(['"])(?:DB_PASS|DB_PASSWORD|DBPASS)\2\s*,\s*)(['"])(?!\{\{)(.+?)\3""")
R_VAR = re.compile(r"""((?:const\s+DB_PASS(?:WORD)?|\$(?:db_?pass(?:word)?|DB_PASS(?:WORD)?))\s*=\s*)(['"])(?!\{\{)(.+?)\2""", re.I)
# .env / .ini:  DB_PASS=x   SOMETHING_PASSWORD=x
R_ENV = re.compile(r'^(\s*[A-Z0-9_]*PASS(?:WORD)?\s*=\s*)(["\']?)(?!\{\{)(\S.*?)\2[ \t]*$', re.M)
# API keys (real formats only)
R_KEYS = [re.compile(p) for p in (r'sk-ant-[A-Za-z0-9_-]{20,}', r'sk-proj-[A-Za-z0-9_-]{20,}',
                                   r'\bsk-[A-Za-z0-9]{32,}\b', r'AIzaSy[0-9A-Za-z_-]{33,}', r'xai-[A-Za-z0-9]{20,}')]
JSON_SECRET_KEYS = re.compile(r'^(pass|password|passwd|secret|token|api[_-]?key|apikey|key)$', re.I)


def clean_json_values(obj, hits):
    if isinstance(obj, dict):
        for k, v in obj.items():
            if isinstance(v, str) and v and JSON_SECRET_KEYS.match(k):
                obj[k] = ''; hits.append(f'json value "{k}" blanked')
            else:
                clean_json_values(v, hits)
    elif isinstance(obj, list):
        for v in obj:
            clean_json_values(v, hits)


def clean_text(path, t):
    hits = []
    def sub(rx, repl, text, label):
        new, n = rx.subn(repl, text)
        if n: hits.append(f'{label} x{n}')
        return new
    t = sub(R_HOST, 'localhost', t, 'db host -> localhost')
    t = sub(R_DBS, lambda m: DB_MAP.get(m.group(0), 'iprps_unknown_' + m.group(0)), t, 'db name -> local')
    t = sub(R_DBU, 'iprps', t, 'db user -> iprps')
    t = sub(R_ARR, lambda m: m.group(1) + m.group(3) + PH + m.group(3), t, 'password -> placeholder')
    t = sub(R_DEF, lambda m: m.group(1) + m.group(3) + PH + m.group(3), t, 'DB_PASS -> placeholder')
    t = sub(R_VAR, lambda m: m.group(1) + m.group(2) + PH + m.group(2), t, 'password var -> placeholder')
    if path.endswith(('.env', '.ini')):
        t = sub(R_ENV, lambda m: m.group(1) + m.group(2) + PH + m.group(2), t, 'env password -> placeholder')
    for rx in R_KEYS:
        t = sub(rx, '', t, 'API key removed')
    return t, hits


def main(src, dst):
    if not os.path.isdir(src):
        sys.exit(f'source not found: {src}')
    if os.path.exists(dst):
        shutil.rmtree(dst)
    os.makedirs(dst)
    report, skipped, renamed = [], [], []
    for top in sorted(os.listdir(src)):
        sp = os.path.join(src, top)
        if not os.path.isdir(sp) or top in SKIP_DIRS:
            continue
        new = RENAME.get(top, top.lower().replace(' ', '-') if (' ' in top or top != top.lower()) else top)
        if new != top: renamed.append(f'{top} -> {new}')
        for root, dirs, files in os.walk(sp):
            dirs[:] = [d for d in dirs if d not in SKIP_DIRS]
            rel = os.path.relpath(root, sp)
            outdir = os.path.join(dst, new, '' if rel == '.' else rel)
            os.makedirs(outdir, exist_ok=True)
            for f in files:
                ip = os.path.join(root, f)
                relf = os.path.join(new, '' if rel == '.' else rel, f)
                if CLUTTER.search(f) or OLD_RE.search(os.path.splitext(f)[0]) or OLD_RE.search(f):
                    skipped.append(relf); continue
                op = os.path.join(outdir, f)
                ext = os.path.splitext(f)[1].lower() if not f.startswith('.env') else '.env'
                if ext in TEXT_EXT or f.startswith('.env'):
                    try:
                        t = open(ip, encoding='utf-8').read()
                    except UnicodeDecodeError:
                        shutil.copy2(ip, op); continue
                    hits = []
                    if ext == '.json':
                        try:
                            data = json.loads(t)
                            clean_json_values(data, hits)
                            if hits:
                                t = json.dumps(data, ensure_ascii=False, indent=2) + '\n'
                        except ValueError:
                            pass
                    t, h2 = clean_text(f, t)
                    hits += h2
                    open(op, 'w', encoding='utf-8', newline='').write(t)
                    shutil.copystat(ip, op)
                    if hits: report.append((relf, hits))
                else:
                    shutil.copy2(ip, op)
    # leftovers that still look secret
    left = []
    pat = re.compile(r'hosting-data\.io|\bdb[su]\d{6,}\b|sk-ant-[A-Za-z0-9_-]{8}|AIzaSy[0-9A-Za-z_-]{8}|xai-[A-Za-z0-9]{8}')
    for root, _, files in os.walk(dst):
        for f in files:
            p = os.path.join(root, f)
            try:
                for i, line in enumerate(open(p, encoding='utf-8'), 1):
                    if pat.search(line):
                        left.append(f'{os.path.relpath(p, dst)}:{i}')
            except (UnicodeDecodeError, IsADirectoryError):
                pass
    rp = os.path.join(os.path.dirname(dst.rstrip('/')), 'iprps-clean-report.txt')
    with open(rp, 'w') as r:
        r.write('== RENAMED FOLDERS\n' + '\n'.join(renamed) + '\n\n')
        r.write(f'== LEFT OUT ({len(skipped)} old/backup/clutter files)\n' + '\n'.join(skipped) + '\n\n')
        r.write(f'== CHANGED ({len(report)} files)\n')
        for f, h in report:
            r.write(f'{f}: {"; ".join(h)}\n')
        r.write(f'\n== STILL LOOKS SECRET ({len(left)}) - check these by hand\n' + '\n'.join(left) + '\n')
        r.write('\n== DATABASES\n' + '\n'.join(f'{k} -> {v}' for k, v in DB_MAP.items()) + '\n')
    print(f'Copied to {dst}: {len(renamed)} folders renamed, {len(skipped)} files left out, '
          f'{len(report)} files cleaned, {len(left)} still to check.')
    print(f'Report: {rp}')


if __name__ == '__main__':
    if len(sys.argv) != 3:
        sys.exit(__doc__)
    main(sys.argv[1].rstrip('/'), sys.argv[2].rstrip('/'))
