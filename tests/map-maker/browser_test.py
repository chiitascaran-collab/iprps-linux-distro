#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""IPRPS Map Maker: browser test.

Serves apps/ with PHP's built-in server (no sign-in, so the app runs in its "files only" mode) and checks in
headless Chromium that every map type generates and draws, every export works (SVG, PNG, JPG, GIF, ASCII,
.ipmap), files import again, and the main tools edit the map.

Needs: php, python3-playwright and a Chromium/Chrome (set CHROME=/path/to/chrome if it isn't found).
Run from the repository:  python3 tests/map-maker/browser_test.py
"""
import asyncio, os, shutil, subprocess, sys, time

REPO = os.path.abspath(os.path.join(os.path.dirname(__file__), '..', '..'))
PORT = int(os.environ.get('PORT', '8799'))
CHROME = os.environ.get('CHROME') or shutil.which('chromium') or shutil.which('chromium-browser') or shutil.which('google-chrome')

CASES = [('travel', '', {'landform': 'coast'}), ('travel', '', {'landform': 'island', 'grid': 'hex'}), ('travel', '', {'landform': 'inland', 'climate': 'cold'}),
         ('battle', 'forest', {}), ('battle', 'road', {}), ('battle', 'camp', {}), ('battle', 'river', {}), ('battle', 'cavern', {}), ('battle', 'ruins', {}), ('battle', 'tavern', {}),
         ('dungeon', '', {}), ('dungeon', '', {'size': 'large', 'feet10': True}),
         ('settlement', 'hamlet', {}), ('settlement', 'village', {}), ('settlement', 'town', {}), ('settlement', 'city', {})]

failures = []
def check(ok, what):
    print(('  ok   ' if ok else '  FAIL ') + what)
    if not ok: failures.append(what)

async def main():
    from playwright.async_api import async_playwright
    async with async_playwright() as p:
        b = await p.chromium.launch(executable_path=CHROME, args=['--no-sandbox']) if CHROME else await p.chromium.launch()
        pg = await b.new_page(viewport={'width': 1500, 'height': 950})
        errors = []
        pg.on('pageerror', lambda e: errors.append(str(e)))
        pg.on('dialog', lambda d: asyncio.ensure_future(d.accept()))
        await pg.goto(f'http://127.0.0.1:{PORT}/map-maker/')
        await pg.wait_for_function('window.MM && MM.app && MM.app.map', timeout=15000)

        print('Generators')
        for kind, sub, extra in CASES:
            g = dict(kind=kind, subtype=sub, seed='test' + kind + sub, size=extra.get('size', 'medium'), orientation='landscape', name=''); g.update(extra)
            r = await pg.evaluate('''g => { const m = MM.app.makeMap(g, false); MM.app.setMap(m, null, true); MM.app.render();
                const again = MM.app.makeMap(g, false);
                return { name: m.name, things: m.features.length + m.places.length + m.paths.length, same: again.terrain === m.terrain && again.places.length === m.places.length,
                         svg: !!document.querySelector('#stage svg #terrain') }; }''', g)
            check(r['svg'] and r['things'] > 0 and r['same'], f"{kind} {sub or extra}: {r['name']} ({r['things']} objects, places and paths; same seed, same map)")

        print('Exports and imports')
        for kind, sub in [('dungeon', ''), ('settlement', 'village'), ('travel', ''), ('battle', 'tavern')]:
            r = await pg.evaluate('''async ([kind, sub]) => {
                const m = MM.app.makeMap({ kind, subtype: sub, seed: 'exp' + kind, size: 'small' }, false);
                const svgBack = MM.io.parse(MM.io.toSVG(m)), ipBack = MM.io.parse(MM.io.toIpmap(m)), ascBack = MM.io.parse(MM.io.toASCII(m), 'x.txt');
                const head = async blob => [...new Uint8Array(await blob.slice(0, 8).arrayBuffer())].map(x => x.toString(16).padStart(2, '0')).join('');
                const png = await MM.io.toBlob(m, 'image/png', 1), jpg = await MM.io.toBlob(m, 'image/jpeg', 1, .85), gif = await MM.io.toGIF(m, 1);
                const gifSize = await new Promise(res => { const im = new Image(); im.onload = () => res(im.naturalWidth); im.onerror = () => res(0); im.src = URL.createObjectURL(gif); });
                return { svg: svgBack.terrain === m.terrain && svgBack.places.length === m.places.length && svgBack.features.length === m.features.length,
                         ip: ipBack.terrain === m.terrain && ipBack.places.map(q => [q.name, q.kind, q.x, q.y, q.population, JSON.stringify(q.demographics)].join()).join() === m.places.map(q => [q.name, q.kind, q.x, q.y, q.population, JSON.stringify(q.demographics)].join()).join(),
                         ascii: ascBack.cols === m.cols && ascBack.rows === m.rows,
                         png: (await head(png)).startsWith('89504e47'), jpg: (await head(jpg)).startsWith('ffd8ff'), gif: (await head(gif)).startsWith('474946383961') && gifSize > 0 }; }''', [kind, sub])
            for k, v in r.items(): check(v, f'{kind}: {k}')

        print('Editing')
        await pg.evaluate("MM.app.setMap(MM.app.makeMap({kind:'battle',subtype:'forest',seed:'ui',size:'small'},false),null,false)")
        await pg.wait_for_timeout(200)
        box = await (await pg.query_selector('#stage svg')).bounding_box(); cx, cy = box['x'] + box['width'] / 2, box['y'] + box['height'] / 2
        t0 = await pg.evaluate('MM.app.map.terrain')
        await pg.keyboard.press('b'); await pg.click('#pane-tool .pal button[title^="Deep water"]'); await pg.mouse.move(cx, cy); await pg.mouse.down(); await pg.mouse.move(cx + 90, cy + 10, steps=6); await pg.mouse.up()
        check(await pg.evaluate('MM.app.map.terrain') != t0, 'paint terrain')
        n = await pg.evaluate('MM.app.map.features.length'); await pg.keyboard.press('s'); await pg.mouse.click(cx - 100, cy - 60)
        check(await pg.evaluate('MM.app.map.features.length') == n + 1, 'stamp an object')
        await pg.keyboard.press('p'); await pg.mouse.click(cx + 100, cy - 80); await pg.wait_for_timeout(100)
        check(await pg.query_selector('#plName') is not None, 'add a place and open its editor')
        await pg.evaluate('document.activeElement.blur()'); await pg.keyboard.press('Escape'); await pg.keyboard.press('a')
        await pg.mouse.move(cx, cy + 50); await pg.mouse.down(); await pg.mouse.move(cx + 120, cy + 120, steps=5); await pg.mouse.up()
        check(await pg.evaluate('MM.app.map.annotations.length') == 1, 'draw an arrow')
        await pg.keyboard.press('Control+z')
        check(await pg.evaluate('MM.app.map.annotations.length') == 0, 'undo')
        check(not errors, 'no script errors' + (': ' + '; '.join(errors) if errors else ''))
        await b.close()

srv = subprocess.Popen(['php', '-S', f'127.0.0.1:{PORT}', '-t', os.path.join(REPO, 'apps')], stdout=subprocess.DEVNULL, stderr=subprocess.DEVNULL)
try:
    time.sleep(1)
    asyncio.run(main())
finally:
    srv.terminate()
print(f'\n{len(failures)} failure(s)' if failures else '\nAll passed.')
sys.exit(1 if failures else 0)
