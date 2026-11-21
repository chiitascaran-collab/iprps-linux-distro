// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Built-in chat templates (Jinja). Used when a model's embedded template is missing,
// wrong for its tokenizer, or fails to parse in llama.cpp.
'use strict';

const T = {
  llama3: {
    label: 'Llama 3 / 3.1 / Nemotron',
    stop: ['<|eot_id|>', '<|end_of_text|>'],
    jinja:
      "{{- bos_token -}}" +
      "{%- for message in messages -%}" +
      "{{- '<|start_header_id|>' + message['role'] + '<|end_header_id|>\\n\\n' + message['content'] + '<|eot_id|>' -}}" +
      "{%- endfor -%}" +
      "{%- if add_generation_prompt -%}{{- '<|start_header_id|>assistant<|end_header_id|>\\n\\n' -}}{%- endif -%}",
  },
  chatml: {
    label: 'ChatML (Qwen, Hermes, many fine-tunes)',
    stop: ['<|im_end|>', '<|im_start|>'],
    jinja:
      "{%- for message in messages -%}" +
      "{{- '<|im_start|>' + message['role'] + '\\n' + message['content'] + '<|im_end|>\\n' -}}" +
      "{%- endfor -%}" +
      "{%- if add_generation_prompt -%}{{- '<|im_start|>assistant\\n' -}}{%- endif -%}",
  },
  gemma: {
    label: 'Gemma',
    stop: ['<end_of_turn>'],
    jinja:
      "{{- bos_token -}}{%- set ns = namespace(sys='') -%}" +
      "{%- for message in messages -%}" +
      "{%- if message['role'] == 'system' -%}{%- set ns.sys = message['content'] + '\\n\\n' -%}" +
      "{%- else -%}{%- set role = 'model' if message['role'] == 'assistant' else 'user' -%}" +
      "{{- '<start_of_turn>' + role + '\\n' + (ns.sys if role == 'user' else '') + message['content'] + '<end_of_turn>\\n' -}}" +
      "{%- if role == 'user' -%}{%- set ns.sys = '' -%}{%- endif -%}{%- endif -%}" +
      "{%- endfor -%}" +
      "{%- if add_generation_prompt -%}{{- '<start_of_turn>model\\n' -}}{%- endif -%}",
  },
  phi3: {
    label: 'Phi-3 / Phi-4 mini',
    stop: ['<|end|>', '<|endoftext|>'],
    jinja:
      "{%- for message in messages -%}" +
      "{{- '<|' + message['role'] + '|>\\n' + message['content'] + '<|end|>\\n' -}}" +
      "{%- endfor -%}" +
      "{%- if add_generation_prompt -%}{{- '<|assistant|>\\n' -}}{%- endif -%}",
  },
  mistral: {
    label: 'Mistral [INST]',
    stop: ['</s>'],
    jinja:
      "{{- bos_token -}}{%- set ns = namespace(sys='') -%}" +
      "{%- for message in messages -%}" +
      "{%- if message['role'] == 'system' -%}{%- set ns.sys = message['content'] + '\\n\\n' -%}" +
      "{%- elif message['role'] == 'user' -%}{{- '[INST] ' + ns.sys + message['content'] + ' [/INST]' -}}{%- set ns.sys = '' -%}" +
      "{%- else -%}{{- ' ' + message['content'] + eos_token -}}{%- endif -%}" +
      "{%- endfor -%}",
  },
};

const OPTIONS = [
  { id: 'auto', label: 'Auto (use the model’s own template, fall back if it fails)' },
  ...Object.entries(T).map(([id, t]) => ({ id, label: t.label })),
  { id: 'file', label: 'Custom template file (.jinja)…' },
];

module.exports = { TEMPLATES: T, OPTIONS };
