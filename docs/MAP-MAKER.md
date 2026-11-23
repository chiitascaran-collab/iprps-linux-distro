# IPRPS Map Maker

**IPRPS Map Maker** makes top-down maps for Session Masters: travel and terrain maps, battle maps, dungeon levels, and towns, cities and villages. It is an IPRPS web app (`apps/map-maker/`, package `iprps-map-maker`), on every edition (Lite, Medium and Advanced). Open it from the Hub or the IPRPS menu.

Everything works offline. Maps are saved in the IPRPS database, in each Session Master's own library.

## Make a map

1. Choose **＋ New**.
2. Pick the kind of map:

   | Map | Options | Grid and scale it starts with |
   |---|---|---|
   | **Travel / terrain** | coast, island, islands or inland; temperate, cold or hot | hexes, 1 hex = 6 miles |
   | **Battle map** | forest clearing, crossroads, camp, river crossing with a bridge, cavern, ruined temple, tavern interior | squares, 1 square = 5 feet |
   | **Dungeon level** | number of rooms, 10-foot squares, secret doors | squares, 1 square = 5 feet |
   | **Town, city or village** | hamlet, village, town (walled), city (walled); river | no grid, 1 square = 10 feet |

3. Choose the size, **landscape** (wide) or **portrait** (tall), the grid and the style. Leave **Name** empty for a generated name.
4. Choose **Make the map**.

**⟳ Regenerate** makes the same kind of map again with a new seed. The **seed** is the map's recipe: the same kind, options and seed always make the same map, so you can share a seed instead of a file. **Start blank** gives you an empty map to paint yourself.

Generated maps already have names, populations and people (demographics) for every settlement, numbered rooms for dungeons, and names for forests, mountains, seas and districts. Change anything.

## Change the map

The tools are on the left. Their options show in the **Tool** tab on the right.

| Tool | Key | What it does |
|---|---|---|
| Select | V | Click something to change it in the **Tool** tab; drag to move it. **Delete** removes it, **Ctrl+D** copies it, **[** and **]** turn objects. |
| Move view | H | Drag the map around. Any time: hold **Space**, or drag with the middle mouse button. The mouse wheel zooms; **0** fits the map. |
| Paint | B | Paint terrain: grass, forest, hills, mountains, water, floors, walls… |
| Fill | G | Fill all touching squares of one terrain. |
| Stamp | S | Trees, rocks, doors, secret doors, stairs, traps, chests, pillars, altars, furniture, tents, buildings, bridges, boats and more. |
| Place | P | Name a place: city, town, village, hamlet, port, fort, dungeon, cave, ruin, landmark, region, district, numbered room, point of interest. |
| Path | R | Roads, trails, rivers, streets and walls. Click the points; double-click, right-click or **Enter** finishes. |
| Pen, line, arrow, rectangle, ellipse, text | D, L, A, Q, O, T | Draw notes on the map in any color. |
| Erase | E | Remove an object, note, place or path. |
| Measure | M | Drag between two points to see the distance in feet or miles, and in squares. |

**Ctrl+Z** undoes and **Ctrl+Y** redoes.

## Places, populations and people

Open the **Places** tab, or click a place with the Select tool. For each place you can set:

- its **name**, **kind** and label size;
- the **population** (settlements);
- the **people (demographics)**: species and their share, for example *Human 60%, Dwarf 25%, Elf 15%*. The IPRPS species are suggested, and you can type any other. **Make it 100%** fixes ratios that don't add up, and the panel shows about how many of each live there;
- **notes**: rulers, rumors, hooks, treasure;
- **areas inside**, for dungeons, caves, ruins and rooms: for example *Entrance, Flooded Gallery, Throne Room*, each with its own notes;
- **its own map**: link a map from your library, open it, or choose **Make one** to make a dungeon level (for a dungeon, cave or ruin) or a settlement map (for a city, town or village) named after the place. The new map is linked to the place for you.

## How the map looks

The **Map** tab sets:

- the **style**: full color, parchment, ink (black and white, easy on printer ink), old-school blue, or night;
- the **grid** (squares, hexes or none), its strength, and the **scale** (1 square = 5 feet, 6 miles, a day's travel…);
- the **size** (columns and rows), **Turn 90°** to switch between landscape and portrait, and which way **north** points;
- what's printed on the map: the **title**, **legend**, **compass** (rose or arrow), **scale bar** (each in a corner you choose), place names, **populations**, **people**, the **key / gazetteer** (numbered rooms, or places with their people and notes, beside the map), terrain symbols and the painted texture.

Turn **Painted texture** off if the editor is slow on an older computer.

## Preview, save, print

- **Preview** shows the finished map exactly as it will be saved and printed. Click it to switch between fit and actual size.
- **Save** keeps the map in your library, in the campaign chosen at the top. **Library** opens, copies and deletes saved maps.
- **Print** prints on one page, or at **battle scale**: one inch per square, over as many pages as it needs, for miniatures. Each page is labeled with its row and column.
- **Show to players** puts the map on the player display (Session Master Mode's second screen or projector).

The editor keeps your current map in the browser too, so it is still there if the window closes before you save.

## Export, share and import

**Export** downloads the map as:

| Format | Use it for |
|---|---|
| **PNG** | Pictures for virtual tabletops and printing (normal, double or triple size) |
| **JPG** | Smaller pictures to send or post |
| **SVG** | A drawing that stays sharp at any size; opens in browsers and Inkscape. The map rides inside it, so **Import** can open it for editing again |
| **GIF** | A picture with 256 colors, for old programs and forums |
| **ASCII** | A text map: one character per square or hex, with the legend and every place, its square, population and people |
| **.ipmap** | The whole map: to trade, share, back up, and edit on another computer |

**Import** opens a `.ipmap` file, an SVG made by Map Maker, or an ASCII map (from Map Maker, or any text map that uses its characters).

## Notes for people building IPRPS OS

- Files: `apps/map-maker/` (`index.html`, `map.css`, `api.php`, `favicon.svg`, `js/core.js`, `js/generators.js`, `js/render.js`, `js/exporters.js`, `js/app.js`). No outside libraries, fonts or network access.
- Database: `api.php` creates the table `maps` on first use (one row per map: owner, campaign, name, kind, the map as JSON, a thumbnail). It reads the database settings from `/etc/iprps/db.php` like the other session tools and needs the Universal Login.
- The player display (`apps/hub/display.php`) shows pictures sent with `display_items.kind = 'image'` (PNG or JPEG data URLs only; anything else stays text).
- The `.ipmap` format is JSON with `"format": "iprps-map"` and `"version": 1`. Terrain is a string of one character per square, the same characters as the ASCII export.
- Test: `python3 tests/map-maker/browser_test.py` (needs `php`, Playwright for Python and Chromium).
