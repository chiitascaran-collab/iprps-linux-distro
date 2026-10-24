# IPRPS OS — What It Is and What It Can Do

*Reference guide for users · October 2026*

## What IPRPS OS is

IPRPS OS is a free, ready-to-use operating system for running and creating tabletop role-playing games, built around the Infinite Plane Role Playing System (IPRPS) by Mythical Legends Publishing. It turns an ordinary 64-bit PC into a Session Master's workstation: campaign and player tracking, a player display for a second screen, music and ambience, writing, art and video tools, all in one place.

- **Built for the table.** The desktop, menus and apps are organized around preparing and running sessions, not around office work.
- **Local-first.** Campaign data lives in a database on your own computer. The IPRPS apps run on a built-in web server that only your computer can reach.
- **Built from source.** IPRPS OS is built with Linux From Scratch and Beyond Linux From Scratch, the community books for building a Linux system from source code. It isn't a re-skin of another distribution.
- **Three editions.** Lite, Medium and Advanced, so it fits anything from an older laptop to a creative studio PC.

> IPRPS OS 1.0 is in development. Features marked *In development* or *Planned* below aren't available yet.

## Who it's for

IPRPS OS is for anyone who runs, writes or produces role-playing games and wants their tools in one dedicated system.

| You are | What IPRPS OS gives you |
| --- | --- |
| **Session Master** running a regular table | Session Master Mode: campaign hub, initiative and combat tracker, dice, session log, ambience and a player display, opened with one click |
| **Storyteller or worldbuilder** | Writing and lore tools, the IPRPS Writing Assistant, document and e-book tools, and a database for NPCs, quests and handouts |
| **Content creator** (art, maps, audio, video) | Image, vector, audio and video editors, plus IPRPS production apps such as Lookbook Studio and THE DIRECTOR (Advanced) |
| **Gaming group** sharing one machine | One account per person, with each person's campaigns and files kept separate |
| **Game club, school or library** | A low-cost, consistent setup that runs on donated or older PCs (Lite) |
| **Owner of an older PC** | The Lite edition runs on 6 GB of RAM and computers that use legacy BIOS |

## Is it right for you?

IPRPS OS is a good fit if your computer is mainly for preparing and running games, writing and creating. It's a poor fit if you depend on Windows-only software.

**A good fit if you:**

- want one dedicated machine for game nights, prep and creative work
- prefer your campaign and player data stored on your own computer
- run games in person with a TV, projector or second monitor for players
- write, draw, record or edit video for your campaigns or setting
- have a 64-bit Intel or AMD PC from roughly the last 10 to 12 years

**Not a good fit (yet) if you:**

- need Windows or Mac software, such as Windows-only games, Microsoft Office or Adobe apps
- need a computer that requires **Secure Boot** to stay on (common on locked-down work PCs)
- want to keep Windows on the same disk: the 1.0 installer erases the target disk, so dual boot isn't supported
- have a 32-bit-only PC or an Apple Silicon Mac (M1 or later)
- rely on NVIDIA's proprietary driver for gaming or GPU computing; NVIDIA cards run on the open-source driver with limited performance

> **Try before you commit.** IPRPS OS runs straight from a USB stick, or in a virtual machine on Windows, without changing your computer (see *Getting IPRPS OS*).

## The three editions

All three editions share the same desktop, web server, database and campaign tools. Each step up adds more apps, so pick the one that matches your computer and what you create.

|  | **Lite** | **Medium** | **Advanced** |
| --- | --- | --- | --- |
| Best for | Running games; older or modest PCs | Most Session Masters and Storytellers | Content creators and power users |
| Minimum RAM | 6 GB | 8 GB | 16 GB |
| Storage | 64 GB or more | 64 GB or more | 128 GB or more |
| Campaign tools | Session Master Hub, initiative, dice, session log, player display | Same, plus Soundboard and IPRPS File Viewer | Same |
| IPRPS apps | Core apps | + Media Player, Genesis Character Engine, Writing Assistant | All IPRPS apps |
| Web browser | Firefox | Firefox | Firefox |
| Documents | Evince (PDF), Mousepad (text) | + LibreOffice, printing | + scanning |
| Images | Ristretto (viewer) | + GIMP, Inkscape, ImageMagick | + FontForge, Graphviz, Krita |
| Audio | Parole (music and ambience) | + VLC | + Audacity, Ardour, LMMS |
| Video | mpv | + VLC, FFmpeg | + Kdenlive, Shotcut, Blender |
| Discs | — | Xfburn (burning) | + disc mastering tools |

These RAM amounts are for smooth everyday use. **All three editions run on a 6 GB system**, but Medium and Advanced may feel slow there, especially with several large apps open at once (Firefox, LibreOffice, GIMP, Blender or a video editor). On 6 GB, close apps you aren't using and work on one big project at a time. IPRPS OS creates a swap file at first boot, which helps when memory runs short, at the cost of speed.

You can start with Lite and add software yourself later. Moving to a higher edition means a fresh install, so back up your campaign data first.

## System requirements

Any 64-bit Intel or AMD PC with 6 GB of RAM and 64 GB of storage (128 GB for Advanced) can run any IPRPS OS edition; 16 GB of RAM is recommended.

| Item | Minimum | Recommended |
| --- | --- | --- |
| Processor | 64-bit Intel or AMD (x86-64) | 4 or more cores |
| Memory (RAM) | 6 GB, all editions (Medium and Advanced may run slowly) | 16 GB |
| Storage | 64 GB (128 GB for Advanced) | SSD, 128 GB or more |
| Firmware | UEFI or legacy BIOS | UEFI |
| Secure Boot | Must be **off** | Off |
| Graphics | Intel, AMD or NVIDIA (open-source drivers) | Intel or AMD |
| Network | Wired or Wi-Fi (most common chips supported) | Any |
| Second screen | Optional | TV, projector or monitor for the player display |
| Internet | Not needed to run games | Needed for downloads, updates and online AI features |

> **Secure Boot** is a firmware setting. You turn it off once in the computer's setup screen (usually opened with F2 or Del at power-on).

## What you can do

IPRPS OS covers the whole cycle of a campaign: prepare it, run it at the table, track what happened, and turn it into something you can publish or share.

### Run sessions

- **Session Master Mode** opens your campaign hub, starts your ambience playlist and puts a full-screen **player display** on a second monitor or projector, all with one click.
- The **player display** shows players only what you reveal: maps, handouts and the current initiative order.
- **Initiative and combat tracker:** turn order, hit points and conditions, round by round.
- **Dice roller** for IPRPS mechanics, with every roll recorded in the session log.

### Track campaigns and players

The built-in campaign database records:

- campaigns, players and their characters, including level, XP and full character sheets
- each session: date, recap, Session Master notes, who attended and the XP awarded
- NPCs, quests and their status, and handouts with what's been revealed
- a timeline of notes, rolls, combat, loot and XP for every session

### Create

- **Write:** LibreOffice for rulebooks and campaign documents, Mousepad for quick notes, and the IPRPS Writing Assistant for lore and session prep.
- **Draw and map:** GIMP for images, Inkscape for maps, symbols and character sheet layouts, Krita for painting (Advanced).
- **Sound:** Parole for music and ambience, Audacity for narration and effects, Ardour and LMMS for soundtracks (Advanced).
- **Video:** mpv and VLC for playback, Kdenlive and Shotcut for trailers and session recaps, Blender for 3D (Advanced).
- **Print:** character sheets, handouts and maps, with CUPS printer support (Medium and up).

### Status of the IPRPS tools in version 1.0

| Tool | What it does | Status |
| --- | --- | --- |
| Session Master Hub | Campaigns, players, characters, sessions, NPCs, quests | In development |
| Initiative and combat tracker | Turn order, hit points, conditions | In development |
| Dice roller | IPRPS dice mechanics with logged rolls | In development |
| Session log and recap | Timeline of each session; exportable recaps | In development |
| Player display | Full-screen maps, handouts and initiative for players | In development |
| Campaign database | Stores everything the tools above track | Included |
| Universal Login | One sign-in for all local IPRPS apps | Included |
| IPRPS Media Player | Music, ambience, CDs, DVDs and IPRPS radio | Included (Medium and up) |
| Genesis Character Engine | AI character reference sheets | Included (Medium and up; needs internet) |
| IPRPS Writing Assistant | AI-assisted writing for lore and prep | Included (Medium and up; needs internet) |
| Soundboard | One-click effects and ambience during play | Planned |
| IPRPS File Viewer | Opens and checks .iprps, .ipai, .srpatch and .capstone files | Planned |
| IPRPS Welcome | First-run tour, settings and API keys | Planned |

## The IPRPS Desktop and Session Master Mode

The IPRPS Desktop is a customized Xfce desktop: light enough for 6 GB machines, with everything for play one click away.

- **IPRPS menu:** every IPRPS app in one category of the applications menu.
- **Panel:** launchers for Session Master Mode and the Hub, plus volume, network and battery indicators.
- **Look:** IPRPS branding on the boot menu, login screen and wallpaper, with a dark theme.
- **Your folders:** each user gets a *Campaigns* folder with *Handouts*, *Maps* and *Audio* inside, ready for session material.

**Session Master Mode** is the heart of game night. One click:

1. opens the **Session Master Hub** in your browser
2. plays your *Campaigns/Audio* folder as shuffled, looping **ambience**, in a small window with play, pause and volume controls
3. opens the **player display** full screen, ready to drag to the TV, projector or second monitor

You run the game from the Hub on your screen; players see only what you put on the display.

## Getting IPRPS OS

Each edition is one compressed disk image. Write it to a USB stick, boot from it, and IPRPS OS is ready; installing to the computer's internal disk is optional.

**Downloads per edition** (from the IPRPS GitHub releases page and the infiniteplane.space download site):

| File | Use it for |
| --- | --- |
| `iprps-os-1.0-<edition>.img.xz` | A USB stick or an internal disk; boots on UEFI and BIOS computers |
| `iprps-os-1.0-<edition>.vhdx` | Trying it in Hyper-V on Windows |
| `iprps-os-1.0-<edition>.qcow2` | Trying it in QEMU, virt-manager or Proxmox |
| `SHA256SUMS-<edition>` | Checking that your download is complete and unaltered |

Large images on GitHub may come in parts (`.part00`, `.part01`, ...). Join them before use, as the release notes explain.

**From download to desktop:**

1. Check the download against `SHA256SUMS`.
2. Write the `.img.xz` to a USB stick of 64 GB or more with **Rufus** or **balenaEtcher**. Everything on the stick is erased.
3. Turn off **Secure Boot** in the computer's firmware settings.
4. Boot from the stick, using the computer's one-time boot menu (often F12, F11, F8 or Esc).
5. **First boot:** IPRPS OS expands to fill the stick, creates swap space, and asks for your user name, password, computer name and time zone.
6. Log in. You're at the IPRPS Desktop.

**To install on the computer itself:** run *Install IPRPS OS to This Computer* from the IPRPS menu, choose the internal disk, and confirm. That disk is **completely erased**, so back up anything you need first.

**To try it without touching your PC:** use the `.vhdx` in Hyper-V (Generation 2, Secure Boot off) or the `.qcow2` in QEMU.

## Your data and privacy

Your campaigns, players and session records stay on your computer. Nothing is sent anywhere unless you use an online feature.

- **Local web server.** The IPRPS apps run on a web server (Apache with PHP) that accepts connections **only from the computer itself**. Other devices on your network can't reach it.
- **Local database.** Campaign data lives in a MariaDB database with no network port at all. Each installation gets its own randomly generated database password on first boot.
- **Your accounts.** Each person who uses the computer gets their own account, files and settings. The first user can administer the system with `sudo`; the root account is locked.
- **Online AI features are opt-in.** The Genesis Character Engine and the Writing Assistant send your prompts to an online AI service using **your own API key**. No keys ship with IPRPS OS. Without a key and internet, those two apps don't work; everything else does.
- **Player data.** If you store players' real names or contact details, you're responsible for keeping them safe. Back up your *Campaigns* folder and the campaign database regularly.

> A future release adds a fully **local** AI assistant, so AI features can work without internet or API keys (see *Future expansion*).

## Updates, customization and open source

**Updates.** In version 1.x, updates arrive as new edition images (1.0.1, 1.0.2, and so on) with release notes listing security fixes. To update, back up your *Campaigns* folder and database, then install the new image. A package manager for in-place updates is planned (see *Future expansion*).

**Make it yours.** IPRPS OS ships ready to use, but nothing is locked down:

- the first user has `sudo` for full administrator access
- compilers and build tools are included, so you can add any software from source, following the Beyond Linux From Scratch book
- drivers for nearly all hardware are included as loadable modules, and you can rebuild the kernel for your exact machine
- the desktop's theme, panel and menus are standard Xfce settings you can change

**Open source.** IPRPS OS is built from open-source software. For each release, the complete source code of its open-source components is published next to the images, as their licenses require. A few choices keep the system legally redistributable:

- **Firefox** is built without Mozilla's official branding, so it carries a generic name and icon; it's the same browser.
- **Media formats.** FFmpeg is built without its non-free options, and some patent-encumbered hardware video acceleration is turned off. Common formats still play; users who need more can add it themselves where it's legal.
- **Firmware.** Hardware firmware comes from the official linux-firmware collection, with its license texts included.

IPRPS apps are by Mythical Legends Publishing; each app states its own license. IPRPS OS's own system scripts, configuration and build guide are free software under the GNU General Public License, version 2.

## Future expansion

The biggest planned addition is a **local AI assistant** for Session Masters. These are plans, not promises, and dates aren't set; each release's notes say what actually shipped.

1. **Version 1.0:** the three editions, Session Master Mode, the campaign database and the core IPRPS tools.
2. **Version 1.1: Live ISO.** A try-before-you-install image that boots read-only from USB or DVD and installs from there.
3. **More IPRPS apps:** Soundboard, IPRPS File Viewer for `.iprps`, `.ipai`, `.srpatch` and `.capstone` files, and the IPRPS Welcome app with a protected place for API keys.
4. **Local AI assistant** (Advanced edition first): NPC dialogue, encounter ideas and session recaps, running entirely on your computer with no internet or API keys. It will draw on your campaign database and session logs, which stay private. Expect 16 GB of RAM as a minimum; a supported graphics card speeds it up, and AI models download on demand rather than shipping in the image.
5. **Package manager:** install and update software, and apply security updates, without reinstalling the whole system.

Follow the IPRPS GitHub releases page and infiniteplane.space for announcements.

## Frequently asked questions

**Is IPRPS OS free?** Yes, the operating system is free to download and use. IPRPS apps state their own licenses.

**Do I need to know Linux?** No. First-boot setup, the desktop and the IPRPS apps are point-and-click. Linux knowledge helps only if you want to customize the system deeply.

**Can I keep Windows on the same computer?** Not with the 1.0 installer, which erases the target disk. You can run IPRPS OS from a USB stick instead, install it on a second disk, or try it in a virtual machine on Windows.

**Does it need the internet?** No, not for running games. You need internet to download it, for updates, and for the online AI apps (Genesis Character Engine, Writing Assistant).

**Can I play my Windows games on it?** No. IPRPS OS is built for running and creating tabletop RPGs, not for Windows games.

**Will my Wi-Fi, sound and graphics work?** On most Intel and AMD computers, yes: drivers and firmware for common hardware are included. NVIDIA graphics use the open-source driver, which works for the desktop but has limited 3D performance. If the screen stays black, choose *IPRPS OS (safe graphics)* in the boot menu.

**Can several people use one computer?** Yes. Each person gets their own account with separate files and settings.

**Can my players use the apps from their own phones or laptops?** Not in 1.0: for privacy, the IPRPS web server only accepts connections from the computer itself. Players see what you share on the player display.

**How do I get updates?** Through new edition images in 1.x; back up your *Campaigns* folder and database, then install the new image. In-place updates arrive with the planned package manager.

**Where's the source code?** Published with each release on GitHub, next to the images.

## Glossary

| Term | Meaning |
| --- | --- |
| **IPRPS** | Infinite Plane Role Playing System, the tabletop RPG system by Mythical Legends Publishing |
| **Session Master** | The person who runs a game session (often called a game master) |
| **Storyteller** | A writer or worldbuilder who creates campaigns, lore and settings |
| **Edition** | One of the three versions of IPRPS OS: Lite, Medium or Advanced |
| **Session Master Mode** | One-click setup for game night: Hub, ambience and player display |
| **Player display** | A full-screen window for players on a second screen, showing what the Session Master reveals |
| **Disk image** | A single file containing a complete, bootable copy of the system, written to a USB stick or disk |
| **Secure Boot** | A firmware setting that only allows signed systems to start; it must be off for IPRPS OS |
| **Firmware** | Small programs some hardware (Wi-Fi, graphics) loads to work |
| **sudo** | The command that lets an authorized user run administrator tasks |
| **Linux From Scratch (LFS)** | The book IPRPS OS's base system is built from, compiled entirely from source code |
| **.iprps, .ipai, .srpatch, .capstone** | IPRPS file formats for characters, AI profiles, session run patches and capstones |
