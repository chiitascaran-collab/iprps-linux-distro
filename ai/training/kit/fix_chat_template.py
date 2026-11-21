#!/usr/bin/env python3
# SPDX-License-Identifier: GPL-2.0-only
# Copyright (C) 2026 Mythical Legends Publishing, LLC
"""Replace the chat template embedded in an IPRPS GGUF model, in place.

The new template is padded to the exact byte length of the old one, so only those
bytes change and the multi-gigabyte file is not rewritten. The original template is
saved next to the model as <model>.original_chat_template.jinja so the change can be undone
(run with --restore).

Usage:  python fix_chat_template.py MODEL.gguf [MODEL2.gguf ...]
        python fix_chat_template.py --restore MODEL.gguf
"""
import struct, sys, os

SYSTEM = ("You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) "
          "by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, "
          "campaign patches and rules accurately, completely and in their intended tone.")

# Llama 3 format (this model's native tokenizer). Uses the IPRPS system prompt when none is given.
TEMPLATE = (
    "{{- bos_token -}}"
    "{%- if messages[0]['role'] == 'system' -%}{%- set system = messages[0]['content'] -%}{%- set loop_messages = messages[1:] -%}"
    "{%- else -%}{%- set system = '" + SYSTEM + "' -%}{%- set loop_messages = messages -%}{%- endif -%}"
    "{{- '<|start_header_id|>system<|end_header_id|>\\n\\n' + system + '<|eot_id|>' -}}"
    "{%- for message in loop_messages -%}"
    "{{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\\n\\n' + message['content'] + '<|eot_id|>' -}}"
    "{%- endfor -%}"
    "{%- if add_generation_prompt -%}{{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' -}}{%- endif -%}"
)
TEMPLATE = TEMPLATE.replace("\\n", "\n")

def find_template(path):
    """Return (offset_of_length_field, byte_length) of tokenizer.chat_template."""
    with open(path, "rb") as f:
        def r(fmt):
            n = struct.calcsize("<" + fmt); return struct.unpack("<" + fmt, f.read(n))[0]
        sizes = {0:1,1:1,2:2,3:2,4:4,5:4,6:4,7:1,10:8,11:8,12:8}
        if f.read(4) != b"GGUF": raise SystemExit(f"{path}: not a GGUF file")
        ver = r("I")
        if ver < 2: raise SystemExit("GGUF v1 files are not supported")
        r("Q"); nkv = r("Q")
        for _ in range(nkv):
            key = f.read(r("Q")).decode("utf8")
            t = r("I")
            if t == 8:
                pos = f.tell(); n = r("Q")
                if key == "tokenizer.chat_template": return pos, n
                f.seek(n, 1)
            elif t == 9:
                at = r("I"); n = r("Q")
                if at == 8:
                    for _ in range(n): f.seek(r("Q"), 1)
                else: f.seek(sizes[at] * n, 1)
            else: f.seek(sizes[t], 1)
    raise SystemExit(f"{path}: no tokenizer.chat_template key found")

def patch(path, new_text):
    pos, n = find_template(path)
    with open(path, "rb") as f:
        f.seek(pos + 8); old = f.read(n)
    new = new_text.encode("utf8")
    if len(new) > n:
        raise SystemExit(f"{path}: new template ({len(new)} bytes) is longer than the old one ({n} bytes)")
    if len(new) < n:  # pad with a Jinja comment so the byte length is unchanged
        pad = n - len(new)
        if pad < 6: new = new + b" " * pad
        else: new = new + b"{#" + b" " * (pad - 4) + b"#}"
    assert len(new) == n
    return pos, old, new

def main():
    args = sys.argv[1:]
    restore = "--restore" in args
    files = [a for a in args if a != "--restore"]
    if not files: print(__doc__); return
    for path in files:
        backup = path + ".original_chat_template.jinja"
        if restore:
            if not os.path.exists(backup): raise SystemExit(f"{path}: no backup at {backup}")
            pos, old, _ = patch(path, "")
            orig = open(backup, "rb").read()
            if len(orig) != len(old): raise SystemExit("backup length does not match the file")
            new = orig
        else:
            pos, old, new = patch(path, TEMPLATE)
            if not os.path.exists(backup):
                open(backup, "wb").write(old)
        with open(path, "r+b") as f:
            f.seek(pos + 8); f.write(new)
        print(f"{'Restored' if restore else 'Patched'}: {path}  ({len(new)} bytes of template rewritten in place)")

if __name__ == "__main__":
    main()
