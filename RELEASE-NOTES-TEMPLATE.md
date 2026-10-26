# IPRPS OS <VERSION> — <Edition>

## Downloads

| File | SHA256 |
|---|---|
| `iprps-<VERSION>-<edition>.img.xz` | `<sha256>` |
| `iprps-<VERSION>-<edition>.vhdx` | `<sha256>` |
| `iprps-<VERSION>-<edition>.qcow2` | `<sha256>` |

Large files may be split (`.part00`, `.part01`, ...). Join them first — Linux: `cat file.part* > file`; Windows: `copy /b file.part00 + file.part01 file` — then check the SHA256.

## Requirements

64-bit Intel or AMD PC, **Secure Boot off**, 6 GB RAM minimum (16 GB recommended), 64 GB storage (128 GB for Advanced).

## Install

1. Write the `.img.xz` to a USB stick (64 GB+) with Rufus or balenaEtcher.
2. Boot from it (one-time boot menu: F12 / F11 / F8 / Esc).
3. First boot: the system grows to fill the drive, creates swap, and asks for user name, password, computer name and time zone.
4. Optional: *Install IPRPS OS to This Computer* (erases the chosen disk).

## What's new

- ...

## Known issues

- ...

## Source code

Complete corresponding source: <link to the source archive for this release>.
