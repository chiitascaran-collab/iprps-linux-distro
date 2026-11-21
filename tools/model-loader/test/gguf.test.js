// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Self-contained checks for the GGUF reader and template checker (no model file needed).
'use strict';
const assert = require('assert');
const fs = require('fs');
const os = require('os');
const path = require('path');
const { summarize, checkTemplate, vocabFamily } = require('../lib/gguf');
const { TEMPLATES } = require('../lib/templates');

function str(s) { const b = Buffer.from(s, 'utf8'); const n = Buffer.alloc(8); n.writeBigUInt64LE(BigInt(b.length)); return Buffer.concat([n, b]); }
function u32(v) { const b = Buffer.alloc(4); b.writeUInt32LE(v); return b; }
function u64(v) { const b = Buffer.alloc(8); b.writeBigUInt64LE(BigInt(v)); return b; }
function kvStr(k, v) { return Buffer.concat([str(k), u32(8), str(v)]); }
function kvU32(k, v) { return Buffer.concat([str(k), u32(4), u32(v)]); }
function kvStrArr(k, arr) { return Buffer.concat([str(k), u32(9), u32(8), u64(arr.length), ...arr.map(str)]); }

function fakeModel(tokens, template) {
  const kvs = [kvStr('general.architecture', 'llama'), kvU32('general.file_type', 15), kvU32('llama.context_length', 4096),
    kvStrArr('tokenizer.ggml.tokens', tokens), kvU32('tokenizer.ggml.eos_token_id', tokens.length - 1)];
  if (template) kvs.push(kvStr('tokenizer.chat_template', template));
  const buf = Buffer.concat([Buffer.from('GGUF'), u32(3), u64(0), u64(kvs.length), ...kvs]);
  const p = path.join(os.tmpdir(), `fake-${Date.now()}-${Math.random()}.gguf`);
  fs.writeFileSync(p, buf);
  return p;
}

const llamaVocab = ['a', 'b', '<|begin_of_text|>', '<|start_header_id|>', '<|end_header_id|>', '<|eot_id|>'];

// 1. Llama 3 vocabulary with a ChatML template: must be flagged as an error.
let p = fakeModel(llamaVocab, TEMPLATES.chatml.jinja);
let s = summarize(p);
assert.strictEqual(s.quantization, 'Q4_K_M');
assert.strictEqual(s.contextLength, 4096);
assert.strictEqual(s.eos, '<|eot_id|>');
assert.strictEqual(s.vocabFamily, 'llama3');
assert.strictEqual(s.templateCheck.family, 'chatml');
assert.deepStrictEqual(s.templateCheck.missing.sort(), ['<|im_end|>', '<|im_start|>']);
assert.strictEqual(s.templateCheck.ok, false);
fs.rmSync(p);

// 2. Matching Llama 3 template: no errors.
p = fakeModel(llamaVocab, TEMPLATES.llama3.jinja.replace('{{- bos_token -}}', '<|begin_of_text|>'));
s = summarize(p);
assert.strictEqual(s.templateCheck.ok, true);
fs.rmSync(p);

// 3. No template at all.
p = fakeModel(llamaVocab, null);
s = summarize(p);
assert.strictEqual(s.templateCheck.ok, false);
fs.rmSync(p);

// 4. Vocabulary detection.
assert.strictEqual(vocabFamily(['<|im_start|>', '<|im_end|>']), 'chatml');
assert.strictEqual(vocabFamily(['<start_of_turn>', '<end_of_turn>']), 'gemma');
assert.strictEqual(checkTemplate(TEMPLATES.chatml.jinja, ['<|im_start|>', '<|im_end|>'], '<|im_end|>').ok, true);

console.log('All GGUF tests passed.');
