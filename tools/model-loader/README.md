# IPRPS Model Loader

A desktop app for Windows, macOS and Linux that loads GGUF models (your IPRPS AI models, or any
llama.cpp-compatible model) and lets you chat with them. Everything runs locally. Nothing is sent online.

It bundles the official **llama.cpp** engine (`llama-server`): Vulkan on Windows and Linux, which works
with NVIDIA, AMD and Intel GPUs and falls back to the CPU, and Metal on macOS.

## Features
- **Model library.** Add `.gguf` files and load or unload them with one click.
- **Chat template check.** Reads the model header and checks that the embedded chat template matches the
  model's tokenizer. If the template is missing or can't be parsed, the app switches to the matching built-in
  template (Llama 3, ChatML, Gemma, Phi-3 or Mistral) by itself. You can also pick one, or load a `.jinja` file.
- **Chat.** Replies stream in as they're written, with stop and regenerate buttons and saved conversations.
  You can export a conversation to Markdown. Tables and code are formatted, and `<think>` reasoning folds away.
- **Default system prompt.** The IPRPS Session Master system prompt is set by default. It's the same one the
  training data used.
- **Settings.** Temperature, top-p, top-k, repeat penalty, reply length, context size, GPU layers and CPU threads.
  You can point the app at your own `llama-server` build, for example a CUDA build.

## Build the installers

### Option A: GitHub (builds all three systems)
The workflow is `.github/workflows/model-loader.yml` in this repository.
1. On GitHub, open **Actions → Build IPRPS Model Loader → Run workflow**.
   Pushing a tag such as `model-loader-v1.0.0` also publishes a GitHub Release.
2. Download the results:
   - **Windows:** the installer (`Setup…exe`) and a portable `.exe`
   - **macOS:** `.dmg` files for Apple Silicon and Intel
   - **Linux:** an `.AppImage` and a `.deb` (the `.deb` is for Debian and Ubuntu)

### Option B: on the computer you're building for
You need [Node.js](https://nodejs.org) 20 or newer. Run these in `tools/model-loader/`.
```
npm install
npm run dist:win      # on Windows
npm run dist:mac      # on a Mac
npm run dist:linux    # on Linux
```
Installers appear in `dist/`. For a test run without building, use `npm run fetch-engine` and then `npm start`.

To use an NVIDIA GPU with CUDA on Windows instead of Vulkan, run
`node scripts/fetch-llama.js --os win --arch x64 --backend cuda` before building.

## First run
- **macOS:** the app isn't signed, so the first time, right-click it and choose **Open**.
- **Linux AppImage:** run `chmod +x IPRPS-Model-Loader-*.AppImage` first.
- **Virtual machines** such as VirtualBox: set **GPU layers** to `0` in Settings → Model loading.
  Give the VM at least 8 GB of RAM for a 4B Q4 model.

## Data
Settings, the model list and conversations are stored in the app's data folder
(**Settings → Engine → Open app data folder**). Set the `IPRPS_USER_DATA` environment variable to use a
different folder, for example a portable one.

© 2026 Mythical Legends Publishing, LLC. Licensed under the GNU GPL v2 (see the repository LICENSE).
