# Contributing

Thank you for helping. IPRPS OS is licensed under the **GNU GPL v2** ([LICENSE](LICENSE)); by contributing you agree that your contribution is released under the same license.

- Report a build problem with: the guide section and package, the window you ran it in ([DEBIAN ROOT], [IPRPS CHROOT] or [BUILDER]), and the **last 20 lines** of output.
- Changes to the build guide go into `tools/guide-generator/` (the template or the generator scripts), not the generated `docs/` files, so they survive regeneration.
- Keep new files under the GPL v2 with an `SPDX-License-Identifier: GPL-2.0-only` line where the format allows. Don't add code under licenses incompatible with GPL v2.
