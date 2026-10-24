# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
import json
u = json.load(open('/home/claude/blfs_units.json'))
PROVIDED = {'dbus','gcc','shadow','systemd','vim','python3'}
SKIP = {'plasma-build','xorg7','xorg-env','postlfs-config-profile','wiki','unpacking','la-files',
        'apache-ant','postgresql','redland','unixodbc','gpgmepp',
        'valgrind','doxygen','texlive','tl-installer','samba','qt6','qt5-components',
        'java','openjdk','ojdk-conf','elogind','python311','gwenview','power-profiles-daemon',
        'libgnome-keyring','sysklogd','sysvinit','xorg7-legacy','xwayland','links','w3m',
        'krb5','mitkrb','fdk-aac','gpm','tk','sendmail','postfix','exim','dovecot'}
REC_DROP = {'NetworkManager': {'vala'}, 'lightdm': {'vala'}, 'xdg-desktop-portal-gtk': {'gnome-desktop'}, 'xfce4-pulseaudio-plugin': {'pavucontrol'}}
RT_PREFER = {'notification-daemon': 'xfce4-notifyd'}
WHY = {}
STAGES = [
 ('A','Foundations: downloads, security, admin tools and sudo','make-ca wget linux-pam sudo libtasn1 p11-kit curl git openssh cpio which nano zip dosfstools parted efibootmgr pciutils usbutils rsync lsof polkit'),
 ('B','Graphics stack (X11 + Mesa)','mesa xorg-server xorg7-app xorg7-font xkeyboard-config xorg7-input-driver xcursor-themes xinit vulkan-loader'),
 ('C','Audio (ALSA + PipeWire)','alsa-lib alsa-utils alsa-plugins pipewire wireplumber pulseaudio'),
 ('D','Networking: wired, wireless and Bluetooth','NetworkManager wpa_supplicant iw bluez'),
 ('E','The IPRPS Desktop (Xfce + LightDM)','lightdm xfce4-session xfce4-panel thunar thunar-volman tumbler xfce4-appfinder xfce4-power-manager xfce4-settings xfdesktop xfwm4 xfce4-terminal mousepad ristretto xfce4-notifyd xfce4-pulseaudio-plugin xarchiver polkit-gnome gvfs udisks2 upower xdg-utils xdg-user-dirs desktop-file-utils shared-mime-info adwaita-icon-theme gnome-themes-extra TTF-and-OTF-fonts xscreensaver network-manager-applet'),
 ('F','Web server and database','apache php mariadb'),
 ('G','Lite edition apps','firefox evince parole mpv'),
 ('H','Medium edition apps','libreoffice gimp inkscape vlc ffmpeg imagemagick cups cups-filters gutenprint gs xfburn libva intel-media-driver'),
 ('I','Advanced edition apps (BLFS part)','sane fontforge graphviz cdrdao libisoburn fuse3'),
]
# Pages that build several packages (e.g. xorg7-input-driver): the page inherits every sub-package's
# dependencies, and a dependency on a sub-package means a dependency on the page.
# Requirements found during the real build that the BLFS 13.1 dependency lists don't capture
EXTRA_REQ = {
    'NetworkManager': ['pygobject3', 'newt'],      # docs generator imports gi; nmtui needs libnewt
    'accountsservice': ['json-c'],                 # 26.x requires json-c (not listed in BLFS 13.1)
    'lightdm': ['gtk-doc'],                        # autoreconf needs gtk-doc.make / gtkdocize
    'gtk-doc': ['pygments'],
}
for _k, _v in EXTRA_REQ.items():
    if _k in u:
        u[_k]['req'] = list(dict.fromkeys(u[_k]['req'] + _v))
MULTI_PACKAGE_PAGES = {'xorg7-input-driver'}   # module pages (python-modules, perl-modules) stay per-module
SUB_TO_GROUP = {}
for gid, g in list(u.items()):
    if g.get('kind') == 'group' and g.get('subs') and gid in MULTI_PACKAGE_PAGES:
        subs = set(g['subs'])
        for sid in subs: SUB_TO_GROUP[sid] = gid
        for key in ('req', 'rec', 'req_rt', 'rec_rt'):
            g[key] = sorted({d for sid in subs for d in u.get(sid, {}).get(key, []) if d not in subs})
for k, v in u.items():
    for key in ('req', 'rec', 'req_rt', 'rec_rt'):
        v[key] = [SUB_TO_GROUP.get(d, d) for d in v.get(key, []) if SUB_TO_GROUP.get(d, d) != k]
def ok(x): return x in u and x not in SKIP and x not in PROVIDED
built=set(); out=[]; dropped=[]
for code,name,targets in STAGES:
    T=[t for t in targets.split() if t not in built]
    # closure via req + rec
    S=set(); stack=list(T)
    while stack:
        p=stack.pop()
        if p in S or p in built or not ok(p): continue
        S.add(p)
        info=u[p]
        nxt = info['req'] + [r for r in info['rec'] if r not in REC_DROP.get(p,set())] + [RT_PREFER.get(r,r) for r in info['req_rt']+info['rec_rt'] if r not in REC_DROP.get(p,set())]
        for n in nxt: WHY.setdefault(n, p)
        stack += nxt
    # edges: required always; recommended only if no cycle
    E={p:set() for p in S}
    def reach(a,b):
        seen=set(); st=[a]
        while st:
            x=st.pop()
            if x==b: return True
            if x in seen: continue
            seen.add(x); st+=list(E.get(x,()))
        return False
    for p in S:
        for d in u[p]['req']:
            if d in S and d!=p: E[p].add(d)
    for p in sorted(S):
        for d in u[p]['rec']:
            if d in S and d!=p and d not in REC_DROP.get(p,set()):
                if reach(d,p): dropped.append((p,d))
                else: E[p].add(d)
    # DFS postorder from targets for a readable order
    order=[]; vis=set()
    def dfs(p):
        if p in vis or p not in S: return
        vis.add(p)
        for d in sorted(E[p]): dfs(d)
        order.append(p)
    for t in T: dfs(t)
    for p in sorted(S): dfs(p)
    built |= set(order)
    out.append((code,name,order))
# sanity: every required dep built earlier or provided
pos={p:i for i,p in enumerate([x for _,_,o in out for x in o])}
bad=[(p,d) for p in pos for d in u[p]['req'] if d in pos and pos[d]>pos[p]]
json.dump({'stages':out,'rec_cycles':dropped}, open('/home/claude/stages.json','w'), indent=0)
for code,name,order in out: print(f'Stage {code}: {len(order):3d}  {name}')
def chain(p):
    c=[p]
    while c[-1] in WHY and WHY[c[-1]] not in c and len(c)<12: c.append(WHY[c[-1]])
    return ' <- '.join(c)
allb={p:c for c,n,o in out for p in o}
for p in ['kf6-frameworks','phonon','libreoffice','qt6','webkitgtk','gtk4','llvm','rust','nodejs','xdg-desktop-portal','boost','openjdk','gnome-desktop','libadwaita1','samba','texlive']:
    if p in allb: print(f'  {p:20} stage {allb[p]}: {chain(p)}')
ALLOWED_MISSING = {'xorg-env'}   # xorg-env = Part 2.2 setup (not a package)
missing = sorted({(p,d) for p in pos for d in u[p]['req'] if d not in pos and d not in PROVIDED and d not in ALLOWED_MISSING})
print('required deps missing from the build:', missing)
assert not missing, 'A required dependency is missing from the build'
print('TOTAL',sum(len(o) for _,_,o in out),'| required-order violations:',bad,'| recommended edges dropped for cycles:',len(dropped))
