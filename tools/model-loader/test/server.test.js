// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
const { LlamaServer } = require('../lib/server');
const { summarize } = require('../lib/gguf');
(async () => {
  const model = process.argv[2];
  const info = summarize(model);
  const s = new LlamaServer();
  s.on('notice', (n) => console.log('NOTICE:', n));
  s.on('state', (st) => console.log('STATE:', st.state, st.templateUsed || ''));
  const t = Date.now();
  const r = await s.start({ serverPath: process.argv[3], model, ctx: 2048, gpuLayers: 0, threads: 2, template: 'auto', fallbackFamily: info.vocabFamily });
  console.log('ready in', Date.now() - t, 'ms on port', r.port, 'template', r.templateUsed);
  const res = await fetch(`http://127.0.0.1:${r.port}/v1/chat/completions`, { method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ messages: [{ role: 'system', content: 'You are the AI Session Master and rules assistant for the Infinite Plane Role Playing System (IPRPS) by Mythical Legends Publishing, LLC. You apply the official IPRPS AI profiles, profile patches, campaign patches and rules accurately, completely and in their intended tone.' }, { role: 'user', content: 'Define the IPRPS term "Capstone".' }], max_tokens: 80, temperature: 0, stream: true }) });
  let out = '';
  const dec = new TextDecoder();
  for await (const chunk of res.body) for (const line of dec.decode(chunk).split('\n')) {
    if (line.startsWith('data: ') && !line.includes('[DONE]')) { const d = JSON.parse(line.slice(6)); out += d.choices[0]?.delta?.content || ''; }
  }
  console.log('STREAMED:', out);
  await s.stop();
  console.log('stopped');
})().catch((e) => { console.error('ERR', e.message); process.exit(1); });
