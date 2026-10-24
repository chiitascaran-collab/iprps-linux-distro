# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
import re, sys
p = '/home/claude/iprps_template.md'
lines = open(p).read().split('\n')
DR, CH, BU, PS, TV, RC = 'DEBIAN ROOT', 'IPRPS CHROOT', 'BUILDER', 'WINDOWS POWERSHELL', 'TEST VM', 'RELEASE COPY CHROOT'
SECTION_DEFAULT = [  # (heading prefix, default label)
 ('### 0.2', DR), ('### 0.4', DR), ('### 1.1', DR), ('### 1.2', DR), ('### 1.3', DR), ('### 1.4', DR),
 ('### 2.1', CH), ('### 2.2', CH), ('### 2.3', BU), ('### 2.4', BU), ('### 2.5', BU),
 ('### After Stage A', CH),
 ('### 4.2', BU), ('### 4.3', DR), ('### 4.4', BU), ('### 4.5', BU), ('### 4.6', BU), ('### 4.7', BU), ('### 4.8', BU),
 ('### 4.9', CH), ('### 4.10', CH),
 ('### Switch from', CH), ('## Part 8', CH), ('## Part 9', CH), ('### 9.', CH), ('### 10.', CH), ('## Part 10', CH),
 ('### 12.', CH), ('### 13.1', CH), ('### 13.2', CH), ('### 13.3', CH), ('### 13.4', DR), ('### 13.5', DR), ('### 13.8', DR),
 ('### Printing', CH), ('### 16.1', CH),
]
report = []
heading = ''; out = []; i = 0; prev_text = ''
in_code = False
while i < len(lines):
    l = lines[i]
    if l.startswith('```') and not in_code:
        lang = l[3:].strip()
        label = None
        if lang == 'powershell': label = PS
        elif lang in ('bash',):
            label = next((d for h, d in SECTION_DEFAULT if heading.startswith(h)), None)
            pt = prev_text.lower()
            if 'as root' in pt: label = CH
            if 'inside that chroot' in pt: label = RC
            if 'back in wsl' in pt or 'in wsl, as root' in pt or 'on the debian' in pt or 'in debian' in pt or 'debian as root' in pt: label = DR
            if heading.startswith('### 4.10') and ('test vm' in pt or 'boot-test a copy' in pt): label = TV
            if heading.startswith('### 4.3'): label = DR
        # skip if previous non-empty line already a window label or a placeholder area
        j = len(out) - 1
        while j >= 0 and out[j].strip() == '': j -= 1
        already = j >= 0 and re.match(r'\*\*\[(DEBIAN ROOT|IPRPS CHROOT|BUILDER|WINDOWS POWERSHELL|TEST VM|RELEASE COPY CHROOT)\]\*\*', out[j])
        if label and not already:
            if j >= 0 and out[j].strip() == '**As root:**':
                out[j] = f'**[{label}]**'
            else:
                out += [f'**[{label}]**', '']
            report.append((heading[:34], label, lines[i+1][:60] if i+1 < len(lines) else ''))
        elif lang in ('bash','powershell') and not already:
            report.append((heading[:34], '*** NO LABEL ***', lines[i+1][:60]))
        in_code = True
        out.append(l); i += 1; continue
    if l.startswith('```') and in_code:
        in_code = False; out.append(l); i += 1; prev_text = ''; continue
    if not in_code:
        if l.startswith('#'): heading = l; prev_text = ''
        elif l.strip() and not l.startswith('{{'): prev_text = l
    out.append(l); i += 1
if '--write' in sys.argv:
    open(p, 'w').write('\n'.join(out)); print('WRITTEN')
for r in report: print(f'{r[0]:36} {r[1]:22} {r[2]}')
