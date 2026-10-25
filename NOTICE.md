# Notices

## This project

Copyright © 2026 Mythical Legends Publishing, LLC.

IPRPS OS's own work — the build guide, scripts, system configuration files, database schema and the guide generator — is free software: you can redistribute it and/or modify it under the terms of the **GNU General Public License, version 2**, as published by the Free Software Foundation. It is distributed in the hope that it will be useful, but **without any warranty**; without even the implied warranty of merchantability or fitness for a particular purpose. See [LICENSE](LICENSE).

## Linux From Scratch and Beyond Linux From Scratch

The build guide reproduces commands from **Linux From Scratch 13.1** and **Beyond Linux From Scratch 13.1** (https://www.linuxfromscratch.org/). The LFS project licenses the computer instructions in its books under the **MIT license** ([LICENSES/MIT.txt](LICENSES/MIT.txt)), copyright Gerard Beekmans and the LFS/BLFS development teams. The books' descriptive text is under the **Creative Commons Attribution-NonCommercial-ShareAlike 2.0** license ([LICENSES/CC-BY-NC-SA-2.0.txt](LICENSES/CC-BY-NC-SA-2.0.txt)); where the guide quotes short descriptive sentences from the books (the labels above command blocks), those remain under that license and are credited here. All explanations, notes, IPRPS changes and scripts are original to this project.

## Distributed images

Each IPRPS OS release image contains many independent programs, each under its own license. Distributing them together is "mere aggregation": the GPL v2 of this project does not change their licenses. See [THIRD-PARTY.md](THIRD-PARTY.md).

- For every release, the **complete corresponding source code** of all included open-source components is published next to the images (see [SOURCES.md](SOURCES.md) for the upstream addresses), together with the build guide and scripts used to build them, as the GPL and LGPL require.
- License files are installed in the images under `/usr/share/licenses` and `/usr/share/doc`, and firmware licenses under `/usr/share/licenses/linux-firmware`.

## Trademarks

- **Linux®** is the registered trademark of Linus Torvalds in the U.S. and other countries.
- **Chromium** in Medium and Advanced is the unbranded, prebuilt **ungoogled-chromium** (BSD-3-Clause, with bundled third-party licenses listed in its `credits.html` / `LICENSE` files inside `/opt/chromium`); IPRPS OS doesn't use the Google Chrome name or logo.
- **Ollama** (MIT) and the bundled **Qwen3.5 4B** model (Apache-2.0, © the Qwen team, Alibaba Cloud) run the IPRPS Oracle in Medium and Advanced. The model's license ships with it as `/usr/share/iprps/ai/LICENSE-qwen3.5.txt`; `iprps-storyteller` is the unmodified model with IPRPS settings and a system prompt (`ai/Modelfile`).
- **Firefox** is a trademark of the Mozilla Foundation. IPRPS OS builds Firefox **without** official branding, as Mozilla's trademark policy requires for modified builds.
- **IPRPS**, **Infinite Plane Role Playing System**, **Mythical Legends Publishing** and their logos are trademarks of Mythical Legends Publishing, LLC. The GPL covers the code and text in this repository, not the use of these names and logos.
- Other names are trademarks of their respective owners. Mention does not imply endorsement.

## Patents and media formats

FFmpeg is built without `--enable-nonfree` and without fdk-aac, and Mesa without patented video codecs, so the images remain redistributable. Rules for media codecs vary by country.

This file is general information, not legal advice.
