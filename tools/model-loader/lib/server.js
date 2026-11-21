// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Starts, monitors and stops a bundled llama.cpp `llama-server` process.
'use strict';
const { spawn } = require('child_process');
const fs = require('fs');
const net = require('net');
const os = require('os');
const path = require('path');
const http = require('http');
const { EventEmitter } = require('events');
const { TEMPLATES } = require('./templates');

const EXE = process.platform === 'win32' ? 'llama-server.exe' : 'llama-server';

function freePort() {
  return new Promise((resolve, reject) => {
    const s = net.createServer();
    s.unref();
    s.on('error', reject);
    s.listen(0, '127.0.0.1', () => { const { port } = s.address(); s.close(() => resolve(port)); });
  });
}

function getJSON(url, timeout = 3000) {
  return new Promise((resolve) => {
    const req = http.get(url, { timeout }, (res) => {
      let body = '';
      res.on('data', (d) => (body += d));
      res.on('end', () => { try { resolve({ status: res.statusCode, json: JSON.parse(body) }); } catch { resolve({ status: res.statusCode, json: null }); } });
    });
    req.on('error', () => resolve({ status: 0, json: null }));
    req.on('timeout', () => { req.destroy(); resolve({ status: 0, json: null }); });
  });
}

// Find llama-server: user override → packaged resources → dev folder → PATH.
function findServer({ override, resourcesPath, appPath }) {
  const plat = { win32: 'win', darwin: 'mac', linux: 'linux' }[process.platform];
  const candidates = [];
  if (override) candidates.push(override);
  if (resourcesPath) candidates.push(path.join(resourcesPath, 'bin', EXE));
  if (appPath) candidates.push(path.join(appPath, 'bin', `${plat}-${process.arch}`, EXE));
  for (const dir of (process.env.PATH || '').split(path.delimiter)) if (dir) candidates.push(path.join(dir, EXE));
  for (const c of candidates) { try { if (fs.statSync(c).isFile()) return c; } catch { /* keep looking */ } }
  return null;
}

class LlamaServer extends EventEmitter {
  constructor() { super(); this.proc = null; this.port = null; this.log = []; this.state = 'stopped'; this.info = null; }

  _log(line) {
    this.log.push(line);
    if (this.log.length > 2000) this.log.splice(0, this.log.length - 2000);
    this.emit('log', line);
  }

  _setState(state, extra = {}) { this.state = state; this.emit('state', { state, port: this.port, ...this.info, ...extra }); }

  // opts: { serverPath, model, ctx, gpuLayers, threads, template ('auto'|name|'file'), templateFile, templateDir, extraArgs, fallbackFamily }
  async start(opts) {
    await this.stop();
    if (!opts.serverPath) throw new Error('llama-server was not found. Set its location in Settings → Engine.');
    if (process.platform !== 'win32') { try { fs.chmodSync(opts.serverPath, 0o755); } catch { /* read-only install is fine */ } }
    this.port = await freePort();
    const args = ['-m', opts.model, '--host', '127.0.0.1', '--port', String(this.port),
      '-c', String(opts.ctx || 4096), '-ngl', String(opts.gpuLayers ?? 99), '--jinja',
      '--alias', path.basename(opts.model, '.gguf')];
    if (opts.threads) args.push('-t', String(opts.threads));
    let templateUsed = 'embedded';
    if (opts.template === 'file' && opts.templateFile) { args.push('--chat-template-file', opts.templateFile); templateUsed = path.basename(opts.templateFile); }
    else if (opts.template && TEMPLATES[opts.template]) {
      const f = path.join(opts.templateDir || os.tmpdir(), `iprps-template-${opts.template}.jinja`);
      fs.writeFileSync(f, TEMPLATES[opts.template].jinja);
      args.push('--chat-template-file', f); templateUsed = opts.template;
    }
    if (opts.extraArgs) args.push(...opts.extraArgs.split(/\s+/).filter(Boolean));

    this.info = { model: opts.model, templateUsed };
    if (!opts._retry) this.log = [];
    this._log(`$ ${path.basename(opts.serverPath)} ${args.join(' ')}`);
    const binDir = path.dirname(opts.serverPath);
    const env = { ...process.env };
    if (process.platform === 'linux') env.LD_LIBRARY_PATH = [binDir, env.LD_LIBRARY_PATH].filter(Boolean).join(':');
    if (process.platform === 'darwin') env.DYLD_LIBRARY_PATH = [binDir, env.DYLD_LIBRARY_PATH].filter(Boolean).join(':');

    this._setState('loading');
    const proc = spawn(opts.serverPath, args, { cwd: binDir, env, windowsHide: true });
    this.proc = proc;
    const onData = (buf) => buf.toString().split(/\r?\n/).filter(Boolean).forEach((l) => this._log(l));
    proc.stdout.on('data', onData);
    proc.stderr.on('data', onData);

    const exited = new Promise((resolve) => proc.on('exit', (code, sig) => resolve({ code, sig })));
    proc.on('error', (e) => this._log(`Failed to start: ${e.message}`));
    exited.then(({ code, sig }) => {
      if (this.proc === proc) { this.proc = null; this._setState('stopped', { exitCode: code, signal: sig }); }
    });

    // Wait until the model is loaded (/health returns 200) or the process dies.
    const deadline = Date.now() + 20 * 60 * 1000;
    while (Date.now() < deadline) {
      const raced = await Promise.race([exited.then((e) => ({ exited: e })), new Promise((r) => setTimeout(() => r(null), 700))]);
      if (raced && raced.exited) {
        const text = this.log.join('\n');
        const templateFailed = /chat template parsing error|Unable to generate parser for this template|failed to parse chat template/i.test(text);
        if (templateFailed && opts.template === 'auto' && opts.fallbackFamily && TEMPLATES[opts.fallbackFamily]) {
          this._log(`The model's embedded chat template could not be parsed. Retrying with the built-in ${opts.fallbackFamily} template.`);
          this.emit('notice', `This model's built-in chat template is broken, so the ${TEMPLATES[opts.fallbackFamily].label} template is being used instead.`);
          return this.start({ ...opts, template: opts.fallbackFamily, _retry: true });
        }
        const last = this.log.filter((l) => /error|failed|unable|not enough|out of memory/i.test(l)).slice(-4).join('\n');
        throw new Error(`llama-server stopped while loading the model.\n${last || this.log.slice(-6).join('\n')}`);
      }
      const h = await getJSON(`http://127.0.0.1:${this.port}/health`, 1500);
      if (h.status === 200) {
        const props = await getJSON(`http://127.0.0.1:${this.port}/props`);
        this.info.props = props.json ? { ctx: props.json.default_generation_settings?.n_ctx, template: props.json.chat_template } : null;
        this._setState('ready');
        return { port: this.port, ...this.info };
      }
    }
    await this.stop();
    throw new Error('Timed out waiting for the model to load.');
  }

  stop() {
    const proc = this.proc;
    if (!proc) return Promise.resolve();
    this.proc = null;
    return new Promise((resolve) => {
      let fin = false;
      const done = () => { if (fin) return; fin = true; this._setState('stopped'); resolve(); };
      proc.once('exit', done);
      try { proc.kill(); } catch { /* already gone */ }
      setTimeout(() => { try { proc.kill('SIGKILL'); } catch { /* ignore */ } }, 4000);
      setTimeout(done, 6000);
    });
  }
}

module.exports = { LlamaServer, findServer, EXE };
