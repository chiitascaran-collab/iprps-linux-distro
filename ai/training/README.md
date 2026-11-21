# IPRPS AI model training

Tools for building a custom IPRPS model for the IPRPS Oracle: making the training data, fine-tuning,
scoring each version, and installing the result. The base model is NVIDIA's **Llama 3.1 Nemotron Nano 4B v1.1**,
fine-tuned with Unsloth (LoRA) and exported as GGUF.

| Folder | What's in it |
|---|---|
| `dataset/` | `build_jsonl.py` and its generators: they turn the AI Training Files folder (the AI profiles, patches and First Edition rulebook) into `iprps_train.jsonl` and `iprps_eval.jsonl`. Also `IPRPS_Core_Dictionary.md` (288 core terms). |
| `kit/` | `train_iprps.py` (fine-tuning and GGUF export), `score_model.py` with `iprps_testset.jsonl` (137 test questions with answer keys), `make_testset.py`, and `fix_chat_template.py` for older GGUF files |
| `oracle/` | `Modelfile` for installing a trained model as the Oracle's `iprps-storyteller` |
| `../../tools/model-loader/` | IPRPS Model Loader, a desktop app (Windows, macOS, Linux) for loading any GGUF model and chatting with it |

The training data itself (the source documents and the generated `.jsonl` files) is not in this repository.

## Steps

1. **Build the data** from the AI Training Files folder:
   ```
   python dataset/build_jsonl.py "<AI Training Files folder>" "<output folder>"
   ```
2. **Train.** You need an NVIDIA GPU with 8 GB or more and `pip install unsloth`. WSL2 is the most reliable setup on Windows.
   ```
   python kit/train_iprps.py --data "<output folder>" --run-name iprps-v2
   ```
   This writes `runs/iprps-v2/lora/` (the adapter) and `runs/iprps-v2/gguf/` (Q4_K_M and Q8_0 files with the right chat template).
3. **Score it** against a running llama-server, LM Studio or Ollama:
   ```
   llama-server -m runs/iprps-v2/gguf/<model>.Q4_K_M.gguf --port 8080 -c 8192
   python kit/score_model.py --label v2
   python kit/score_model.py --compare results_v1.json results_v2.json
   ```
4. **Install it in the Oracle** (Medium and Advanced): copy `oracle/Modelfile` next to the `.gguf` file, set its `FROM` line,
   then run `sudo iprps-ai-model install-modelfile Modelfile`. Undo with `sudo iprps-ai-model reset`.

## Chat format

The model uses the **Llama 3** chat format. Its tokenizer has no ChatML tokens (`<|im_start|>`, `<|im_end|>`), so a
model trained or loaded with ChatML never stops its replies. `train_iprps.py` sets the same Llama 3 template
that `fix_chat_template.py` writes into GGUF files. When no system message is given, that template uses the training
system prompt:

> You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) by Mythical
> Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, campaign patches and rules
> accurately, completely and in their intended tone.

## The training sessions so far

| Date | Dataset | What changed |
|---|---|---|
| 2026-11-18 | v1: 1,068 examples | Every AI profile and patch split into sections of under 4,096 tokens, with headers, tables of contents, index entries and repeated passages removed; 90/10 train/eval split |
| 2026-11-18 | v2: 9,127 examples | Added the First Edition rulebook and the IPRPS Glossary (7,961 one-term examples) |
| 2026-11-20 | Model check | The first GGUF exports carried NVIDIA's original chat template, which current llama.cpp can't parse ("Incorrect chat template"). In tests the model answered best in the Llama 3 format and never stopped in ChatML. `fix_chat_template.py` swaps the template in place (about 2 KB of the file; the original is backed up). IPRPS Model Loader was built and tested with the Q4_K_M model. |
| 2026-11-20 | v3: 3,061 examples | Glossary removed (it outweighed the rules and taught short glossary-style answers). Added the core dictionary and rule-checked worked examples: character builds, skill checks and contests, reaction rolls, all five combat systems, and spellcasting with the 107 official trap and anti-magick spells |
| 2026-11-20 | Training kit | `train_iprps.py`, the 137-question test set and `score_model.py`. The first glossary-trained model passed 2 of the first 8 questions. |
| 2026-11-21 | v4: 5,089 examples | Added 560 formula examples (242 of them Mana Pool), 288 builds of all 18 species in administrative, religious, combat and adventurer roles (including roles against their species' reputation), NPC reactions and behavior, weather effects on skills and spellcasting, and dungeon rooms and checks for solo and group play |

v4 contents: 1,166 document sections, 305 dictionary entries and 3,618 worked examples. Every roll total, DP total and
Mana Pool in the worked examples was recalculated by script, with no errors.

## Rules notes

- **The two rule books differ.** The worked examples follow the **First Edition rulebook** where it differs from
  the Master AI Profile v6.0: attribute shifts are clamped by a table, and damage is scaled by a separate
  Effectiveness Roll. They also differ on Rock-Paper-Scissors results, Dual-Die wounds and critical ranges. For
  those terms, the dictionary gives both versions.
- **Interpretations** where the documents give no exact rule:
  - The five NPC Social Behavior inputs and the Weather Engine's mood modifiers are added to the Reaction Roll.
  - Weather Potency is added to spell damage after the Effectiveness Roll.
  - A miscast check (when Stability is below −2) is a d20 roll where 1–6 means a miscast.
  - Solo play gets about half the dungeon spawn budget.
