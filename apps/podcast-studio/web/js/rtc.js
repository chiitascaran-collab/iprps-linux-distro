// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Mythical Legends Publishing, LLC
// Full-mesh WebRTC between everyone in the session. Signalling rides the studio server (SSE + POST).
// Rule: peers already in the room call the newcomer, so there is never offer glare.
export class Mesh {
  constructor(o) { this.o = o; this.pcs = new Map(); this.closed = false; }

  connect(eventsUrl) {
    this.es = new EventSource(eventsUrl);
    this.es.onmessage = e => { let m; try { m = JSON.parse(e.data); } catch (x) { return; } this._on(m); };
    this.es.onerror = () => this.o.onStatus && this.o.onStatus(this.es.readyState === 2 ? 'closed' : 'reconnecting');
    this.es.onopen = () => this.o.onStatus && this.o.onStatus('online');
  }

  async send(to, payload) {
    try { await fetch(this.o.signalUrl, { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ to, ...payload }) }); } catch (e) { /* peer will retry via ICE restart */ }
  }
  app(to, app) { return this.send(to, { app }); }

  _on(m) {
    const o = this.o;
    if (m.type === 'hello') { this.me = m.you; this.peers = new Map(m.peers.map(p => [p.id, p])); o.onHello && o.onHello(m); }
    else if (m.type === 'replaced') { this.es.close(); o.onStatus && o.onStatus('replaced'); }
    else if (m.type === 'peer-join') { this.peers && this.peers.set(m.peer.id, m.peer); this._drop(m.from, true); o.onPeer && o.onPeer(m.peer); this._pc(m.from, true); }
    else if (m.type === 'peer-leave') { this.peers && this.peers.delete(m.from); this._drop(m.from); }
    else if (m.type === 'signal') this._signal(m.from, m.data);
    else o.onMessage && o.onMessage(m);
  }

  _pc(id, caller) {
    const pc = new RTCPeerConnection({ iceServers: this.o.iceServers || [] });
    const ent = { pc, pending: [], stream: new MediaStream() };
    this.pcs.set(id, ent);
    const local = this.o.getLocalStream();
    if (local) local.getTracks().forEach(t => pc.addTrack(t, local));
    pc.onicecandidate = e => { if (e.candidate) this.send(id, { data: { candidate: e.candidate } }); };
    pc.ontrack = e => { ent.stream.addTrack(e.track); this.o.onStream && this.o.onStream(id, ent.stream, this.peers.get(id)); };
    pc.onconnectionstatechange = () => {
      this.o.onPeerState && this.o.onPeerState(id, pc.connectionState);
      if (pc.connectionState === 'failed' && caller && !this.closed) pc.restartIce && this._offer(id, ent, true);
    };
    if (caller) this._offer(id, ent);
    return ent;
  }
  async _offer(id, ent, restart) {
    try {
      const offer = await ent.pc.createOffer(restart ? { iceRestart: true } : undefined);
      await ent.pc.setLocalDescription(offer);
      this.send(id, { data: { sdp: ent.pc.localDescription } });
    } catch (e) { console.warn('offer failed', e); }
  }
  async _signal(from, d) {
    if (!d) return;
    let ent = this.pcs.get(from);
    try {
      if (d.sdp) {
        if (d.sdp.type === 'offer') {
          if (!ent || ent.pc.signalingState === 'closed') ent = this._pc(from, false);
          await ent.pc.setRemoteDescription(d.sdp);
          await ent.pc.setLocalDescription(await ent.pc.createAnswer());
          this.send(from, { data: { sdp: ent.pc.localDescription } });
        } else if (ent) await ent.pc.setRemoteDescription(d.sdp);
        if (ent) { for (const c of ent.pending) await ent.pc.addIceCandidate(c).catch(() => {}); ent.pending = []; }
      } else if (d.candidate && ent) {
        if (ent.pc.remoteDescription) await ent.pc.addIceCandidate(d.candidate).catch(() => {});
        else ent.pending.push(d.candidate);
      }
    } catch (e) { console.warn('signal failed', e); }
  }
  _drop(id, silent) {
    const ent = this.pcs.get(id);
    if (ent) { ent.pc.close(); this.pcs.delete(id); }
    if (!silent || ent) this.o.onLeave && this.o.onLeave(id, silent);
  }
  // Swap the outgoing camera/screen/mic track on every connection without renegotiating.
  replaceTrack(kind, track) {
    for (const { pc } of this.pcs.values()) {
      const s = pc.getSenders().find(x => x.track && x.track.kind === kind);
      if (s) s.replaceTrack(track).catch(() => {});
    }
  }
  close() { this.closed = true; this.es && this.es.close(); for (const id of [...this.pcs.keys()]) this._drop(id, true); }
}
