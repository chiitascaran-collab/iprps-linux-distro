# IPRPS OS Walkthrough: Your First Game Night

*From first boot to the final scene of "Fog on Pier Nine", a ready-to-run IPRPS one-shot · Beta, October 2026*

![IPRPS OS wallpaper artwork](images/iprps-wallpaper.jpg "w=5")

## How to use this walkthrough

This tutorial takes you through IPRPS OS the way you'll actually use it: set the computer up, prepare a session, then run it with your players. Part 1 covers the system. Part 2 is a complete short adventure, **Fog on Pier Nine**, written so that every scene uses one of the IPRPS OS tools. Run it once with friends (or with a second device playing every part yourself) and you'll know the whole system.

| Part | What you do | Time |
| --- | --- | --- |
| 1. First boot | Create your account, connect to Wi-Fi | 10 minutes |
| 2. The desktop and the Hub | Find your apps, choose what the Hub shows | 10 minutes |
| 3. Prepare the session | Gather pictures and sound, write notes in IPRPS Writer | 20 minutes |
| 4. Open the IPRPS Table | Get your players connected | 10 minutes |
| 5. Run the scenario | Play "Fog on Pier Nine" | 2 to 3 hours |
| 6. After the game | Save, close the table, back up | 5 minutes |

**What you need:** a computer running IPRPS OS (any edition; Medium and Advanced add the IPRPS Oracle), and for the players, any phones, tablets or laptops on the same Wi-Fi. A second monitor or projector is optional.

> IPRPS OS is in beta. Some tools mentioned in the Hub, such as the initiative tracker, the session log and the campaign screens, are still being built. This walkthrough uses only what works today, and says so where a workaround is needed.

## Part 1: First boot

### 1.1 Start IPRPS OS

Start the computer from your IPRPS OS USB stick (or its internal disk, if you installed it). The first start takes a minute or two while IPRPS OS grows its file system to fill the disk and makes swap space. Then the setup screens appear.

### 1.2 The setup screens

Setup runs in a blue and gold text window. Use **Tab** and the arrow keys to move, **Enter** to choose.

1. **Welcome to IPRPS OS:** what the system is. Choose **Continue**.
2. **The IPRPS OS editions:** which edition you're running and what each one includes. Choose **Continue**.
3. **Good to know:** a few limits worth knowing (64-bit PCs only, Secure Boot off, NVIDIA on the open-source driver). Choose **Continue**.
4. **Your account:** a user name in lowercase letters (for example `alex`), then your full name, which appears on the login screen.
5. **Password:** at least 8 characters, typed twice. You'll also use it for administrator tasks, such as saving system settings.
6. **Computer name:** how the computer appears on your network, for example `gametable`.
7. **Time zone:** choose **US & Canada** for the common zones, or a region and then the city nearest you.
8. **Ready:** check the summary and choose **Create account**, or **Change something** to go back.

The login screen appears next. Sign in with the user name and password you just chose.

> **Tip:** Every person who uses the computer can have their own account, with their own files, documents and Hub choices. To add one, open **Terminal** and run `sudo useradd -m -G users,audio,video,iprps sam` then `sudo passwd sam` (replace `sam` with the new name).

### 1.3 Connect to Wi-Fi

The IPRPS Table needs the computer and your players' devices on the same network.

1. Open **Settings** in the applications menu and choose **Wi-Fi and Network Connections**.
2. The **Wi-Fi Networks** window scans and lists nearby networks with their signal strength. Select yours and choose **Connect**. (**Hidden network…** handles networks that don't broadcast their name.)
3. Type the Wi-Fi password when asked.

Wired networks connect by themselves. The network icon on the panel shows the connection at any time.

## Part 2: The desktop and the Hub

### 2.1 Find your way around

The IPRPS Desktop is built on Xfce, a light desktop that works like the one on most PCs:

- the **applications menu** holds every program; the **IPRPS** category has all the IPRPS apps in one place
- the **panel** holds launchers for **Session Master Mode** and the **Session Master Hub**, plus volume, network and battery
- your **home folder** has a **Campaigns** folder with **Handouts**, **Maps** and **Audio** inside

![The IPRPS login screen artwork](images/iprps-login.jpg "w=4.5")

### 2.2 Open the Session Master Hub

Open **Session Master Hub** from the panel or the IPRPS menu. The first time, it asks you to sign in with the **Universal Login**; that one sign-in then covers every IPRPS app on the computer.

![The Session Master Hub](images/hub.jpg "w=6.5")

Each tile opens an app. In Medium and Advanced every app opens in its own window, like a desktop program; in Lite they open in Firefox.

### 2.3 Choose your apps

1. Choose **Manage apps** at the top right.
2. The list shows **every IPRPS app on this computer**, each with an on/off switch.
3. Switch on what you use at the table, switch off what you don't, and choose **Save**.

Your choice belongs to your account, so another Session Master on the same computer keeps their own set. **Reset to defaults** brings back the standard list.

## Part 3: Prepare the session

### 3.1 Gather pictures and sound

Fog on Pier Nine uses a few pictures and sounds. Any images and audio files you own or have the rights to use will do; there are many free collections of RPG maps and ambience online.

| Put this | In this folder | For |
| --- | --- | --- |
| A map of a harbor or docks (PNG or JPEG) | *Campaigns/Maps* | Scene 2 |
| A tavern or jazz-club picture | *Campaigns/Handouts* | Scene 1 |
| A picture of a crate or strange device | *Campaigns/Handouts* | Scene 3 |
| Rain, harbor or fog ambience (MP3, OGG, WAV or M4A) | *Campaigns/Audio* | All night |
| A short tense track or alarm bell | *Campaigns/Audio* | Scene 4 |

> **Tip:** Session Master Mode plays everything in *Campaigns/Audio* as a shuffled, looping ambience playlist on your own speakers. Sound you want on the **players'** devices is sent from the IPRPS Table instead (Part 5).

### 3.2 Write your notes in IPRPS Writer

1. Open **IPRPS Writer** from the Hub or the menu.
2. Type the title at the top: *Fog on Pier Nine: SM notes*.
3. Use the **Normal text** menu to make headings for each scene, and the list buttons for clues and NPCs. Copy in whatever you need from Part 5 of this walkthrough.

Writer saves automatically to your account; the document list on the left shows everything you've written. **Save as** makes a copy as a Word file, an OpenDocument file, plain text or a web page, and **Ctrl+P** prints or makes a PDF, for example to print the character sheets below.

![IPRPS Writer with a session-prep document](images/writer.jpg "w=6.5")

### 3.3 Medium and Advanced: brief the IPRPS Oracle

The IPRPS Oracle can improvise NPCs, places and descriptions that fit your campaign. It reads the campaign you choose from the campaign database.

**Create the campaign first.** The Hub's campaign screens are still in development, so for this beta add the campaign with one command in **Terminal**:

```
sudo mariadb iprps -e "INSERT INTO campaigns (name, setting, status) VALUES ('Iron City Blues', 'Iron City, the Infinite Plane', 'active');"
```

1. Create the campaign with the command above (once).
2. Open **IPRPS Oracle** and choose **Iron City Blues** in the **Campaign** menu at the top.
3. Under **Campaign memory**, pin facts the Oracle should always respect, one at a time, with **Pin**. For this scenario: *The Harbor Guild pays the Night Watch to look away on Thursdays*, and *Inspector Hale Ostrander is honest but owes the Guild a favor*.
4. Try a quick generator: type *a nervous dockhand who saw something* in the box above the buttons and choose **NPC**. Save anyone you like with **Save NPC**.

![The IPRPS Oracle (example answer)](images/oracle.jpg "w=6.5")

The Oracle runs entirely on your computer. Its first answer of the day takes longer while the model loads; Session Master Mode warms it up for you.

## Part 4: Open the IPRPS Table

### 4.1 Start Session Master Mode

About fifteen minutes before players arrive, choose **Session Master Mode** on the panel. It:

- opens the Session Master Hub
- starts your *Campaigns/Audio* ambience in a small **IPRPS Ambience** window (**Space** pauses, **9** and **0** change the volume, **>** skips, **q** stops)
- with a second screen or projector, opens the **player display** full screen there; with **one screen**, it opens the **IPRPS Table** console instead
- in Medium and Advanced, warms up the IPRPS Oracle

You can also open **IPRPS Table** on its own from the IPRPS menu or its tile in the Hub.

### 4.2 Open the table

1. In the IPRPS Table console, click the campaign name at the top and type **Fog on Pier Nine** (players see it).
2. Choose **Open the table**. The status changes to **Open**, and the **Players join here** box shows a **join code**, the computer's address (for example `http://192.168.1.20:7777/`) and a **QR code**.

### 4.3 Get the players in

Each player, on their own phone, tablet or laptop connected to the same Wi-Fi:

1. scans the QR code with the camera (the code is filled in for them), or opens the address in any web browser and types the join code
2. types their name and, if they like, their character's name
3. chooses **Join the table**

Each player appears under **At the table** in your console, with a green dot when online and the kind of device they're using. Once everyone is in, tick **Lock** so nobody else can join.

> **Tip:** Phones stay silent until the player touches the page once. When you start sound, any player who hasn't will see **Tap to turn on the table sound**.

### 4.4 Make a group

For a split party, select players with their checkboxes, type a name under **Groups** (for example *Rooftop*) and choose **Make from selected**. You can then send messages, pictures and sound to that group only.

### 4.5 A quick tour for the players

Ask everyone to try these once before the game starts:

- send a message to **Everyone**, then a private one using the **To** menu
- roll a **d20** from the dice toolbar
- open **IPRPS ▾**, choose **Skill check**, enter an Attribute and a Skill, and roll

![A player's phone at the table](images/table-phone.jpg "w=2.6")

## Part 5: The scenario, "Fog on Pier Nine"

### 5.1 Overview

| | |
| --- | --- |
| **Setting** | Iron City, a noir Region of the Infinite Plane: rain, lamplight, seven districts, and a harbor that never sleeps |
| **Era and technology** | Steam and gaslight, early firearms |
| **Tone** | Noir mystery with one sharp fight |
| **Combat system** | Mode 4, **Dual-Die** (gritty and wound-based) |
| **Players** | 2 to 5 |
| **Length** | 2 to 3 hours |
| **Tools used** | IPRPS Table (chat, whispers, groups, dice, pictures, sound, text cards), IPRPS Writer, IPRPS Oracle (optional) |

**The hook.** A dockhand named Tibbet Crane was pulled from the water below Pier Nine this morning, Harbor Guild ink on his wrist and a shipping tag clenched in his fist: *GRAY HERON, HOLD 3, MARKED*. Inspector Hale Ostrander of the Night Watch can't investigate the Guild openly. He can hire people who aren't the Watch.

**What's really going on.** The *Gray Heron* brought in a sealed Necronian canister, an ancient case of **Nanytes** scavenged from the edge of the Region. The Harbor Guild means to sell it tonight to a buyer from the Heights. Tibbet saw the crate, recognized the old sigils, and tried to warn his sister Vessa. The Guild got to him first.

### 5.2 Pre-generated characters

Hand these out, or let players bring their own. Each line gives the attribute scores, the skills (0 to 100) and what to type into the Table's **IPRPS ▾** rolls.

| Character | Species | Key attributes | Key skills | Gear | HP |
| --- | --- | --- | --- | --- | --- |
| **Brenna Holt**, ex-Watch tracker | Wolffolk | STR 14, DEX 12, CON 14, WIS 14 | Tracking 30, Brawling 20, Intimidation 20 | Knife 1d6, heavy coat AR 2 | 195 |
| **Tobin Fairweather**, insurance investigator | Human | DEX 11, CON 11, INT 13, CHA 12 | Investigation 30, Persuasion 20, Pistol 10 | Pistol 2d6, lantern | 165 |
| **Mira Quickstep**, cat burglar | Catfolk | DEX 16, INT 12, WIS 14, CHA 14 | Stealth 30, Lockpicking 30, Acrobatics 20 | Shortsword 1d6+1, picks, night vision | 155 |
| **Dr. Oro Kessel**, harbor physician | Gemps | INT 18, WIS 14, WIL 12 | Medicine 30, Lore (Necronian) 20, Perception 20 | Medical bag, cane | 135 |

HP follows the IPRPS formula: 50 + (CON × 10) + (Level × 5), for level 1 characters. Unlisted attributes are the species' usual values.

**Rolling a check at the Table:** **IPRPS ▾ → Skill check**, then type the Attribute score and the Skill level. The roll is 1d20 + Skill Shift (Skill ÷ 10) + Attribute Shift (Attribute − 10). Type the **BTN** given in the scene, and the Table says whether the total beats it, along with the band of the d20.

### 5.3 Scene 1: The Blue Lantern

**Before the scene:** in the console under **Push to screens**, choose **Everyone**, **Add media…** your tavern picture, and **Show** it. Then open **Show a text card** and send the read-aloud below.

> *Rain hammers the windows of the Blue Lantern. Smoke curls under the gas lamps, and on the little stage an Elf woman sings something slow and sad. Inspector Hale Ostrander, grey at the muzzle, slides a wet shipping tag across your table. "Gray Heron. Hold three. The Guild killed a boy over whatever's in it, and I can't touch them. You can."*

**What happens:** Ostrander (Wolffolk, gruff, fair) offers 50 silver each to find the marked crate before midnight. He says nothing about owing the Guild.

**Vessa Crane**, the singer, is Tibbet's sister. She'll talk after her set, but only privately.

- Gaining her trust: **Skill check**, CHA with Persuasion, **BTN 12**. On a success she tells them Tibbet saw "old writing, like the stones at the edge of the world" on the crate, and names the fence who handles Guild goods: **Marrow Pell**.
- In the Zone of Uncertainty (d20 of 7 to 12): she tells them, but a Guild man at the bar notices them leave.

**Table moves:**
- When a player approaches Vessa, **message that player privately** (choose their name in the **To** menu) and play her as a whisper. The rest of the table sees nothing.
- If anyone asks Ostrander about the Guild, roll his reaction **in secret** (dice visibility **Secret (only me)**).

### 5.4 Scene 2: Pier Nine at midnight

**Before the scene:** **Show** the harbor map to everyone. Select the rain or fog track in your media list, tick **Loop**, and choose **♪ Play** so the fog follows the players onto their own devices.

> *Fog swallows the end of Pier Nine. The Gray Heron rocks at her moorings, hold three open to the night. Somewhere in the dark, someone is whistling.*

**Marrow Pell** (Rabbitfolk fence, twitchy and polite, a brass monocle, never sits with his back to the water) is waiting for the Heights buyer.

- Spotting him before he spots them: **Skill check**, WIS with Perception, **BTN 14**. The best scout in the party rolls; tell only them what they see with a private message.
- Making him talk: CHA with Persuasion, or STR with Intimidation, **BTN 14**. He knows which crate is marked and that four Guild enforcers guard it. He bolts at the first sign of a blade.
- If the party splits (one sneaks aboard, the rest stay with Pell), **select** the sneakers in the console, **Make from selected** a group called *Aboard*, and send that group its own description.

**Medium and Advanced:** if the players go somewhere you didn't plan, ask the Oracle for a quick **Location** or **NPC**, then send it to the players with **Show players**, or paste it into the Table chat with the copy button.

### 5.5 Scene 3: Hold three

> *The crate is small, the size of a child's coffin, and wrapped in chains. Beneath the Guild's chalk mark, older letters are cut into the wood: angular, beautiful, and wrong. They seem to move when you aren't looking at them.*

**Show** your crate picture to the players in the hold only (your *Aboard* group, if you made one).

- Reading the sigils: INT with Lore (Necronian), **BTN 15**. Success: it's a Necronian **Nanyte canister**, sealed, still active. Dr. Kessel's player recognizes it on any success; others need the full BTN.
- Opening the chains quietly: DEX with Lockpicking, **BTN 13**.
- Every failed roll here is a **Noise Spike**: the guards get closer. After two, Scene 4 starts immediately.

Opening the canister itself is a terrible idea. If a player insists, describe a hum in their teeth and the lamp flames bending toward it, and let them choose again.

### 5.6 Scene 4: The Guild arrives

Start the tense track or alarm bell for **Everyone** with **♪ Play** (untick **Loop** for a one-off bell), then send a text card:

> *Lanterns swing up the gangplank. Four Guild enforcers in oilcloth coats, clubs and knives out. The biggest one smiles. "That crate's spoken for."*

**The enforcers** (one per player, at most four):

| | Attack | Guard | AR | Weapon | HP |
| --- | --- | --- | --- | --- | --- |
| Guild enforcer (Human) | d20 + 2 | 12 | 2 (oilcloth) | Club or knife, 1d6 | 165 |
| Their boss, Sully Marr (Orc) | d20 + 4 | 13 | 3 | Heavy club, 2d6 | 215 |

**Running the fight in Dual-Die (Mode 4):**

1. Each player uses **IPRPS ▾ → Dual-Die attack**, entering their Attribute, their Skill and the target's **Guard**.
2. The Table reports **Hit** or **Miss**. On a hit it rolls the **1d6 Impact** at once: 1 to 2 **Glancing** (−1 on the next action), 3 to 4 **Solid** (−2 on all actions for 1d6 rounds, bleeding), 5 to 6 **Critical** (incapacitated unless the target makes CON Effectiveness 15+).
3. For damage, roll the weapon from **IPRPS ▾ → Weapon damage** and type the target's **AR**; the Table shows the damage after armor.
4. Roll the enforcers' attacks yourself with **Secret (only me)** if you want to keep their numbers hidden.

Keep a quick tally of HP in your Writer notes (the Hub's initiative and combat tracker is still in development). The fight ends when Sully falls or flees; the others scatter when he does.

### 5.7 Ending: who gets the canister?

Let the players decide. Send each choice's outcome as a **text card**:

- **Hand it to Ostrander:** he locks it in the Night Watch vault, pays double, and quietly asks them to keep working the Guild. He owes them now, which he likes less than owing the Guild.
- **Sell it to the Heights buyer:** 2,000 silver and a powerful new enemy in the Night Watch. Someone in the Heights now has Nanytes, and that will matter later.
- **Keep it:** the canister hums in their room at night. Lamps lean toward it. A Goddess of this Region may have noticed.
- **Give Vessa justice:** however they end it, if they tell her who killed Tibbet, she sings it on the Blue Lantern stage the next night, and the Guild knows exactly who talked.

**Rewards:** 50 silver each from Ostrander plus whatever they negotiated, and experience for the session as your table usually awards it.

### 5.8 Quick reference for the Session Master

| Moment | Tool | Where |
| --- | --- | --- |
| Show a picture | Push to screens → Show | Table console, right |
| Read-aloud text | Show a text card | Table console, right |
| Music or sound on players' devices | ♪ Play, Loop, Stop sound | Table console, right |
| Whisper to one player | To menu → their name | Table console, message box |
| Talk to part of the party | Make from selected, then To → the group | Table console, left |
| Secret roll | Dice visibility: Secret (only me) | Dice toolbar |
| IPRPS checks and combat | IPRPS ▾ | Dice toolbar |
| A quick NPC or place | NPC, Location buttons | IPRPS Oracle (Medium and up) |
| Clear the players' screens | Clear screens | Table console, right |

![The IPRPS Table console](images/table-console.jpg "w=6.5")

## Part 6: After the game

1. **Stop sound** and **Clear screens** in the Table console.
2. Choose **Close the table**. Everyone is disconnected; the chat, players and media are kept for next time. After a restart, the table is always closed until you open it.
3. Save anything worth keeping. The copy button on each message copies it, so you can paste the best moments into your IPRPS Writer notes.
4. Next session, choose **New session (clear chat)** for a clean chat with the same players, or **Reset everything** to start over with a new join code.
5. **Back up** your *Campaigns* folder to a USB stick or cloud drive now and then. IPRPS Writer documents and the campaign database live on the computer too; the IPRPS OS overview explains how to keep them safe.

## Troubleshooting at the table

| Problem | Fix |
| --- | --- |
| A player's phone can't open the address | Check it's on the same Wi-Fi (turn off mobile data to be sure). Guest networks often block devices from seeing each other; use the main network or a phone hotspot for everyone. Make sure the table is **Open**. |
| "That join code is not right" | Read the code from the console again, or scan the QR code instead. If you made a **New code**, the old one no longer works. |
| A player hears nothing | They need to tap **Tap to turn on the table sound** once, and check their volume. |
| Someone joined who shouldn't have | **Remove** them under **At the table**, make a **New code**, and tick **Lock**. |
| The Oracle is slow | Its first answer loads the model; later ones are quicker. Close large programs you aren't using. |
| A player closed their browser | They open the address again; they're still at the table with the same name and history. |

## Glossary

| Term | Meaning |
| --- | --- |
| **BTN** | Base Target Number: the total a check must reach |
| **AR** | Armor Rating: subtracted from damage |
| **Band A / Band B** | How the d20 is read: Band A for yes or no (1–6 failure, 7–12 Zone of Uncertainty, 13–20 success); Band B for how well (1–6 weak, 7–14 standard, 15–19 strong, 20 peak) |
| **Skill Shift / Attribute Shift** | Skill ÷ 10 and Attribute − 10, added to a d20 check |
| **Dual-Die** | Combat Mode 4: attack against Guard, then 1d6 for how bad the wound is |
| **Noise Spike** | One of the Five Signals: loud action that draws attention |
| **Join code** | The six characters players type to join an open IPRPS Table |

*IPRPS OS is beta software from Mythical Legends Publishing, LLC, free under the GNU General Public License version 2, without warranty. The Infinite Plane Role Playing System and its setting belong to Mythical Legends Publishing, LLC. "Fog on Pier Nine" may be copied and run freely at your own table. Download IPRPS OS at https://infiniteplane.space/downloads/iprps/1.0; source code and bug reports at https://github.com/chiitascaran-collab/iprps-linux-distro.*
