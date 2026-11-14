# IPRPS Release Desk

A walkthrough for everything after release (guide Part 17): **update an app**, **add a new app**, **retire an app**, apply a **security update**, make a **point release**, **publish** the package repository, and **prepare GitHub**. Each task is a numbered list of steps. Every step is labeled with the window it belongs in (**DEBIAN ROOT**, **BUILDER**, **IPRPS CHROOT**, **TEST VM**, **WINDOWS**, or **RELEASE DESK** when the Desk changes files itself), explains what it does, shows the exact command with a **Copy** button, and, where it can, **runs it for you** and shows the output.

It's a browser page served by a small Node.js program on your own computer, plus the same walkthrough as a terminal menu. It needs no npm packages and works on Windows (through Debian in WSL), Linux and macOS.

## Install (build PC, once)

**[DEBIAN ROOT]**

```bash
apt install nodejs unzip git rsync
bash /mnt/g/IPRPS/iprps-os/tools/release-desk/iprps-desk install
```

`install` copies the Desk to `/usr/local/lib/iprps-desk` and adds the command `iprps-desk`, so it keeps working while you replace the repository folder with a newer one. Run `install` again after unzipping a repository that has a newer Desk.

**Windows:** copy `IPRPS Release Desk.cmd` to your desktop and double-click it. It starts the Desk in Debian (as root) and opens it in your browser. Keep its window open while you use the Desk.

## Start

| Where | How |
|---|---|
| Windows | Double-click **IPRPS Release Desk.cmd** |
| DEBIAN ROOT | `iprps-desk` (opens the browser), or `iprps-desk menu` (in the terminal) |
| BUILDER or IPRPS CHROOT | `bash /build/src/iprps-os/tools/release-desk/iprps-desk menu` |
| macOS or another Linux | double-click **IPRPS Release Desk.command** (Mac), or run `./iprps-desk` |

The page opens at `http://127.0.0.1:7791/#k=…`. The `#k=` part is a key that changes each time the Desk starts. Only a page opened with that link can use the Desk.

**Run the Desk in DEBIAN ROOT.** From there it does every step itself: it runs BUILDER and IPRPS CHROOT steps inside the build image (it uses `chroot` and `su - builder`, the same as your windows). The image must be open (`bash /root/iprps-enter.sh` in the IPRPS CHROOT window). Your tasks are saved in `/build/.iprps-desk`, which Debian and the image both see. So `iprps-desk menu` in any of the three windows shows the same tasks, at the same step.

**The signing step needs your passphrase.** GnuPG asks for the signing key's passphrase in a terminal. Do that one step from `iprps-desk menu` in DEBIAN ROOT, or copy its command there. Then go back to the page and click **Mark done**.

## Folders

The **Folders** tab sets where everything is. Windows paths (`G:\IPRPS\…`) work too. Each folder is checked, and a missing one can be created with **Create**.

| Folder | Default |
|---|---|
| Local repository (your Git copy) | `G:\IPRPS\iprps-os` |
| Incoming (new app versions you download) | `G:\IPRPS\incoming` |
| Upload folder for the package repository (FileZilla) | `G:\IPRPS\repo-upload\1` |
| GitHub upload folder (web uploader) | `G:\IPRPS\github-upload` |
| Build image, where it's opened, the repository copy inside it, built packages | `/root/iprps-system.img`, `/mnt/iprps`, `/build/src/iprps-os`, `/build/repo` |
| Repository script, signed repository | `/root/iprps-repo.sh`, `/root/iprps-repo/1` |
| Edition of the build image | `advanced` |

## The tasks

| Task | What the Desk changes in your repository | Then |
|---|---|---|
| **Update an app** | Replaces `apps/<folder>/` with the new folder or `.zip`. Files you list are kept from the IPRPS OS version, for example `config.php`, which reads the local database instead of the site's. Raises the `iprps-apps` version to today's date. | copy into the image → build → install in the image → sign and add → check → test → stage → FileZilla → online check → changelog → GitHub |
| **Add a new app** | Copies it to `apps/<folder>/` and adds its `package_iprps-…()` and `pkgname` entries. Also writes a menu entry, an icon if the app has none, the Hub name and default list, and the edition list. If the app saves files, it adds an install script that lets the web server write to those folders. Raises the versions. | the same, with `iprps-base` too |
| **Retire an app** | Takes the app out of the recipe, the menu, the Hub and the editions. Adds it to `packages/iprps-base/retired-apps`, and moves its files to `retired/` (or deletes them). | builds `iprps-base`, removes the app from the repository; IPRPS Updates removes it from computers after their next update |
| **Update IPRPS OS files or a recipe** | Raises the version of a package folder you changed (`iprps-base`, `iprps-keyring`…). | the same publishing steps |
| **Apply a security update** (17.2) | Copies the recipe from `packages/examples/` if needed and sets the fixed version. It can fill in the download checksums with `makepkg -g`. | build, install with `--overwrite '/usr/*'` the first time, publish; then a point release |
| **Make a point release** (17.3) | Sets `iprps-base`'s version and adds required packages to its `depends=()`. | build and publish the four `iprps-base` packages; make new images |
| **Publish the repository** | nothing | list → check → test → stage → FileZilla → online check |
| **Prepare GitHub** | nothing | password check → `git commit` and `push`, or copy the changed files to the GitHub upload folder for github.com's **Upload files** |

## Safety

- **Passwords and keys never ship.** Before an app is built, and before anything goes to GitHub, the Desk looks through the files for:
  - database passwords written in the code (including `new PDO(…, 'password')`)
  - API keys (Anthropic, OpenAI, Google, GitHub, AWS)
  - hosting database server and user names, and private keys
  - files such as `.env` and `migrate/sources.php`

  The step stops until they're gone. If something it found is only an example value, **Mark as safe** records it in `.iprps-desk-allow` in the repository. Delete a line there to check that item again.
- **Backups:** the Desk copies every file before changing it, to `/build/.iprps-desk/backups/<date-time>/`.
- **Only this computer:** the Desk listens on `127.0.0.1` only, answers only requests that carry the key from its link, and runs only the steps of your tasks. It never takes a command typed into the page.
- It never stores your hosting login, GitHub login or signing passphrase.
- **Git as you:** the Desk runs as root, so it runs Git as the owner of your repository folder (`runuser -l <owner>`) and gives the files it writes back to that owner.

## When the repository is replaced

If you unzip a newer repository from Claude over `G:\IPRPS\iprps-os`, it replaces your local changes. Commit and push your Desk tasks first. Then compare with `git status` / `git diff`, and put back anything the new zip doesn't have.

## Files

| File | |
|---|---|
| `iprps-desk` | launcher: `web` (default), `menu`, `status`, `install` |
| `IPRPS Release Desk.cmd` / `.command` | Windows and macOS launchers |
| `desk.js` | the server, the task runner and the terminal menu |
| `lib/core.js` | folders, recipe reading and editing, password check |
| `lib/workflows.js` | the tasks and their steps |
| `lib/actions.js` | the steps the Desk does itself |
| `ui/` | the page |
