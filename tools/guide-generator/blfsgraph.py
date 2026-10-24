# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
import json, re
from lxml import etree
root = etree.parse('/home/claude/blfs-full.xml').getroot()
for el in root.xpath('//*[@revision="sysv"]'):
    el.getparent().remove(el)
txt = lambda e: ''.join(e.itertext())
DOCTEST = re.compile(r'test|documentation|manual page|man page|\bdocs?\b|api doc|handbook', re.I)
def deps_of(node):
    d = {'req': [], 'req_rt': [], 'rec': [], 'rec_rt': [], 'opt': []}
    for p in node.xpath('.//para[@role="required" or @role="recommended" or @role="optional"]'):
        role = {'required':'req','recommended':'rec','optional':'opt'}[p.get('role')]
        xs = p.xpath('.//xref')
        for x in xs:
            lk = x.get('linkend'); xr = x.get('role')
            tail = (x.tail or '')[:80]
            if xr == 'nodep': continue
            if role == 'opt': d['opt'].append(lk); continue
            if role == 'rec' and DOCTEST.search(tail): continue
            if xr == 'runtime': d[role+'_rt'].append(lk)
            else: d[role].append(lk)
    return d
units = {}
def add(node, kind):
    t = node.find('title')
    units[node.get('id')] = dict(title=' '.join(txt(t).split()) if t is not None else node.get('id'), kind=kind, **deps_of(node))
for s in root.xpath('//sect1[@id]'):
    subs = s.xpath('./sect2[@id][sect3[@role="package"]]')
    if subs:
        units[s.get('id')] = dict(title=' '.join(txt(s.find('title')).split()), kind='group', req=[], req_rt=[], rec=[], rec_rt=[], opt=[], subs=[x.get('id') for x in subs])
        for x in subs: add(x, 'sect2')
    else:
        add(s, 'sect1')
json.dump(units, open('/home/claude/blfs_units.json', 'w'), indent=0)
print(len(units), 'units')
for k in ['libnotify','xdg-desktop-portal','cups','mesa','lightdm','firefox']:
    v=units[k]; print(k,'REQ',v['req'],'RT',v['req_rt'],'REC',v['rec'],'REC_RT',v['rec_rt'])
