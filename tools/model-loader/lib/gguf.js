// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Minimal GGUF header reader: reads only the metadata block (never the tensor data),
// so it is fast even on multi-gigabyte model files.
'use strict';
const fs = require('fs');

const FILE_TYPES = {
  0: 'F32', 1: 'F16', 2: 'Q4_0', 3: 'Q4_1', 7: 'Q8_0', 8: 'Q5_0', 9: 'Q5_1',
  10: 'Q2_K', 11: 'Q3_K_S', 12: 'Q3_K_M', 13: 'Q3_K_L', 14: 'Q4_K_S', 15: 'Q4_K_M',
  16: 'Q5_K_S', 17: 'Q5_K_M', 18: 'Q6_K', 19: 'IQ2_XXS', 20: 'IQ2_XS', 21: 'Q2_K_S',
  22: 'IQ3_XS', 23: 'IQ3_XXS', 24: 'IQ1_S', 25: 'IQ4_NL', 26: 'IQ3_S', 27: 'IQ3_M',
  28: 'IQ2_S', 29: 'IQ2_M', 30: 'IQ4_XS', 31: 'IQ1_M', 32: 'BF16', 36: 'TQ1_0', 37: 'TQ2_0',
  38: 'MXFP4',
};

class Reader {
  constructor(fd) { this.fd = fd; this.buf = Buffer.alloc(0); this.pos = 0; this.filePos = 0; this.eof = false; }
  ensure(n) {
    while (this.buf.length - this.pos < n) {
      if (this.eof) throw new Error('Unexpected end of file while reading GGUF header');
      const chunk = Buffer.alloc(Math.max(1 << 20, n));
      const read = fs.readSync(this.fd, chunk, 0, chunk.length, this.filePos);
      if (read === 0) this.eof = true;
      this.filePos += read;
      this.buf = Buffer.concat([this.buf.subarray(this.pos), chunk.subarray(0, read)]);
      this.pos = 0;
    }
  }
  u8() { this.ensure(1); return this.buf.readUInt8(this.pos++); }
  i8() { this.ensure(1); return this.buf.readInt8(this.pos++); }
  u16() { this.ensure(2); const v = this.buf.readUInt16LE(this.pos); this.pos += 2; return v; }
  i16() { this.ensure(2); const v = this.buf.readInt16LE(this.pos); this.pos += 2; return v; }
  u32() { this.ensure(4); const v = this.buf.readUInt32LE(this.pos); this.pos += 4; return v; }
  i32() { this.ensure(4); const v = this.buf.readInt32LE(this.pos); this.pos += 4; return v; }
  f32() { this.ensure(4); const v = this.buf.readFloatLE(this.pos); this.pos += 4; return v; }
  f64() { this.ensure(8); const v = this.buf.readDoubleLE(this.pos); this.pos += 8; return v; }
  u64() { this.ensure(8); const v = this.buf.readBigUInt64LE(this.pos); this.pos += 8; return Number(v); }
  i64() { this.ensure(8); const v = this.buf.readBigInt64LE(this.pos); this.pos += 8; return Number(v); }
  str(lenFn) { const n = lenFn(); this.ensure(n); const s = this.buf.toString('utf8', this.pos, this.pos + n); this.pos += n; return s; }
}

function readGGUF(path) {
  const fd = fs.openSync(path, 'r');
  try {
    const r = new Reader(fd);
    r.ensure(4);
    const magic = r.buf.toString('latin1', 0, 4); r.pos = 4;
    if (magic !== 'GGUF') throw new Error('Not a GGUF file (bad magic bytes)');
    const version = r.u32();
    const len = version === 1 ? () => r.u32() : () => r.u64();
    const nTensors = len();
    const nKV = len();
    const scalar = {
      0: () => r.u8(), 1: () => r.i8(), 2: () => r.u16(), 3: () => r.i16(), 4: () => r.u32(),
      5: () => r.i32(), 6: () => r.f32(), 7: () => r.u8() !== 0, 8: () => r.str(len),
      10: () => r.u64(), 11: () => r.i64(), 12: () => r.f64(),
    };
    const meta = {};
    for (let i = 0; i < nKV; i++) {
      const key = r.str(len);
      const type = r.u32();
      if (type === 9) {
        const at = r.u32(); const n = len();
        const fn = scalar[at];
        if (!fn) throw new Error(`Unsupported array type ${at} for ${key}`);
        const arr = new Array(n);
        for (let j = 0; j < n; j++) arr[j] = fn();
        meta[key] = arr;
      } else {
        const fn = scalar[type];
        if (!fn) throw new Error(`Unsupported value type ${type} for ${key}`);
        meta[key] = fn();
      }
    }
    return { version, nTensors, meta };
  } finally { fs.closeSync(fd); }
}

// Recognise the conversation format a Jinja chat template produces.
function templateFamily(t) {
  if (!t) return 'none';
  if (t.includes('<|im_start|>')) return 'chatml';
  if (t.includes('<|start_header_id|>')) return 'llama3';
  if (t.includes('<start_of_turn>')) return 'gemma';
  if (t.includes('[INST]')) return 'mistral';
  if (t.includes('<|user|>') && t.includes('<|end|>')) return 'phi3';
  if (t.includes('<|User|>')) return 'deepseek';
  return 'custom';
}

// Which chat format the tokenizer itself was built for (based on its special tokens).
function vocabFamily(tokens) {
  const v = new Set(tokens || []);
  if (v.has('<|start_header_id|>') && v.has('<|eot_id|>')) return 'llama3';
  if (v.has('<|im_start|>') && v.has('<|im_end|>')) return 'chatml';
  if (v.has('<start_of_turn>')) return 'gemma';
  if (v.has('<|user|>') && v.has('<|end|>')) return 'phi3';
  if (v.has('[INST]')) return 'mistral';
  return 'chatml';
}

const TURN_END = { chatml: '<|im_end|>', llama3: '<|eot_id|>', gemma: '<end_of_turn>', phi3: '<|end|>', mistral: '</s>' };

// Check that a template's special tokens exist in the model vocabulary and that the
// model's end-of-sequence token matches the template's end-of-turn marker.
function checkTemplate(template, tokens, eosToken) {
  const issues = [];
  const vocab = new Set(tokens || []);
  const markers = [...new Set((template || '').match(/<\|[^|<>\s]{1,40}\|>|<\/?s>|<(?:start|end)_of_turn>/g) || [])];
  const missing = markers.filter((m) => !vocab.has(m));
  const family = templateFamily(template);
  const vf = vocabFamily(tokens);
  if (template && family !== 'custom' && family !== vf && missing.length) {
    issues.push({ level: 'error', text: `The embedded template is ${family.toUpperCase()}, but this model's tokenizer is built for ${vf.toUpperCase()}. Select "${vf}" under Chat template.` });
  }
  if (!template) issues.push({ level: 'error', text: 'The model has no embedded chat template. Choose one in Settings → Chat template.' });
  if (missing.length) {
    issues.push({ level: 'error', text: `The template uses ${missing.join(', ')}, which ${missing.length > 1 ? 'are' : 'is'} not in this model's vocabulary. Those markers would be split into ordinary text pieces, so the template does not match the model's tokenizer.` });
  }
  const end = TURN_END[family];
  if (end && eosToken && end !== eosToken && vocab.has(end)) {
    issues.push({ level: 'warn', text: `The template ends turns with ${end} but the model's end-of-sequence token is ${eosToken}. The app adds ${end} as a stop string so replies still end cleanly.` });
  } else if (end && eosToken && end !== eosToken) {
    issues.push({ level: 'warn', text: `The model's end-of-sequence token is ${eosToken}, not ${end}. Replies may not stop on their own; the app adds stop strings to compensate.` });
  }
  return { family, vocabFamily: vf, markers, missing, issues, ok: !issues.some((i) => i.level === 'error') };
}

function summarize(path) {
  const st = fs.statSync(path);
  const { version, nTensors, meta } = readGGUF(path);
  const arch = meta['general.architecture'] || 'unknown';
  const tokens = meta['tokenizer.ggml.tokens'] || [];
  const tok = (id) => (id === undefined || id === null ? null : tokens[id] ?? `#${id}`);
  const template = meta['tokenizer.chat_template'] || '';
  const eos = tok(meta['tokenizer.ggml.eos_token_id']);
  const check = checkTemplate(template, tokens, eos);
  const plain = {};
  for (const [k, v] of Object.entries(meta)) {
    if (k === 'tokenizer.chat_template') continue;
    plain[k] = Array.isArray(v) ? `[${v.length} items]` : v;
  }
  return {
    path, sizeBytes: st.size, ggufVersion: version, nTensors,
    name: meta['general.name'] || null,
    architecture: arch,
    sizeLabel: meta['general.size_label'] || null,
    quantization: FILE_TYPES[meta['general.file_type']] || (meta['general.file_type'] !== undefined ? `type ${meta['general.file_type']}` : null),
    contextLength: meta[`${arch}.context_length`] || null,
    vocabSize: tokens.length,
    bos: tok(meta['tokenizer.ggml.bos_token_id']),
    eos,
    eot: tok(meta['tokenizer.ggml.eot_token_id']),
    pad: tok(meta['tokenizer.ggml.padding_token_id']),
    chatTemplate: template,
    templateCheck: check,
    vocabFamily: vocabFamily(tokens),
    metadata: plain,
  };
}

module.exports = { readGGUF, summarize, checkTemplate, templateFamily, vocabFamily, FILE_TYPES };
