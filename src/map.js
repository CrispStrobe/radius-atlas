// SPDX-License-Identifier: MIT
// Dependency-free slippy map. Basemap requests are only for the current viewport.
import { project, unproject, destination, distanceKm } from './geo.js';
export class RadiusMap {
  constructor(canvas, { config, onSelect, onPick, onStatus }) {
    this.canvas = canvas; this.ctx = canvas.getContext('2d'); this.config = config;
    this.onSelect = onSelect; this.onPick = onPick; this.onStatus = onStatus;
    this.center = { latitude: 48.5725, longitude: 7.8131 }; this.zoom = 10;
    this.tiles = new Map(); this.markers = []; this.contextPoints = []; this.hits = [];
    this.pick = false; this.selectedId = null; this.pending = false;
    this.observer = new ResizeObserver(() => this.resize()); this.observer.observe(canvas);
    canvas.addEventListener('pointerdown', e => {
      if (e.button !== 0) return;
      this.drag = { id: e.pointerId, x: e.clientX, y: e.clientY, center: project(this.center, this.zoom), moved: false };
      canvas.setPointerCapture(e.pointerId); canvas.classList.add('dragging');
    });
    canvas.addEventListener('pointermove', e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const dx = e.clientX - this.drag.x, dy = e.clientY - this.drag.y;
      if (Math.hypot(dx, dy) > 4) this.drag.moved = true;
      const size = 256 * 2 ** this.zoom;
      this.center = unproject({ x: this.drag.center.x - dx, y: Math.max(0, Math.min(size, this.drag.center.y - dy)) }, this.zoom);
      this.drawSoon();
    });
    canvas.addEventListener('pointerup', e => {
      if (!this.drag || this.drag.id !== e.pointerId) return;
      const wasClick = !this.drag.moved; this.drag = null; canvas.classList.remove('dragging');
      if (!wasClick) return;
      const rect = canvas.getBoundingClientRect(), x = e.clientX - rect.left, y = e.clientY - rect.top;
      if (this.pick) { this.onPick(this.fromScreen(x, y)); return; }
      const hit = [...this.hits].reverse().find(h => Math.hypot(h.x - x, h.y - y) < 13);
      if (hit) { this.selectedId = hit.marker.id; this.onSelect(hit.marker); this.drawSoon(); }
    });
    canvas.addEventListener('pointercancel', () => { this.drag = null; canvas.classList.remove('dragging'); });
    canvas.addEventListener('wheel', e => { e.preventDefault(); if (this.wheelLock) return; this.wheelLock = true;
      setTimeout(() => this.wheelLock = false, 140); this.changeZoom(e.deltaY < 0 ? 1 : -1); }, { passive: false });
    canvas.addEventListener('keydown', e => {
      if (['+', '=', '-'].includes(e.key)) { e.preventDefault(); this.changeZoom(e.key === '-' ? -1 : 1); }
      const delta = { ArrowLeft: [-80, 0], ArrowRight: [80, 0], ArrowUp: [0, -80], ArrowDown: [0, 80] }[e.key];
      if (delta) { e.preventDefault(); const p = project(this.center, this.zoom); this.center = unproject({ x: p.x + delta[0], y: p.y + delta[1] }, this.zoom); this.drawSoon(); }
      if (e.key === 'Enter' && this.pick) this.onPick(this.center);
    });
  }
  resize() {
    const rect = this.canvas.getBoundingClientRect(); this.width = rect.width; this.height = rect.height;
    const dpr = Math.min(window.devicePixelRatio || 1, 2); this.canvas.width = Math.round(rect.width * dpr); this.canvas.height = Math.round(rect.height * dpr);
    this.ctx.setTransform(dpr, 0, 0, dpr, 0, 0); this.drawSoon();
  }
  setData(query, answer, places, fit = true) {
    this.query = query; this.markers = answer.markers; this.contextPoints = places; this.selectedId = null;
    if (fit) this.fit(); else this.drawSoon();
  }
  fit() {
    if (!this.query) return;
    this.center = { ...this.query.center };
    const spanKm = Math.max(this.query.radiusKm * 2.45, 2);
    const metresPerPixel = spanKm * 1000 / Math.max(100, Math.min(this.width || 600, this.height || 450) - 60);
    this.zoom = Math.max(3, Math.min(16, Math.floor(Math.log2(156543.03392 * Math.cos(this.center.latitude * Math.PI / 180) / metresPerPixel))));
    this.drawSoon();
  }
  changeZoom(delta) { this.zoom = Math.max(3, Math.min(18, this.zoom + delta)); this.drawSoon(); }
  fromScreen(x, y) { const p = project(this.center, this.zoom); return unproject({ x: p.x + x - this.width / 2, y: p.y + y - this.height / 2 }, this.zoom); }
  screen(point) {
    const a = project(point, this.zoom), b = project(this.center, this.zoom), size = 256 * 2 ** this.zoom;
    let dx = a.x - b.x; if (dx > size / 2) dx -= size; if (dx < -size / 2) dx += size;
    return { x: dx + this.width / 2, y: a.y - b.y + this.height / 2 };
  }
  drawSoon() { if (this.pending) return; this.pending = true; requestAnimationFrame(() => { this.pending = false; this.draw(); }); }
  tile(x, y, z) {
    const n = 2 ** z; if (y < 0 || y >= n) return null; x = ((x % n) + n) % n;
    const key = `${z}/${x}/${y}`;
    if (this.tiles.has(key)) return this.tiles.get(key);
    const img = new Image(); const tile = { img, loaded: false }; this.tiles.set(key, tile);
    img.onload = () => { tile.loaded = true; this.onStatus?.('Basemap: OpenStreetMap'); this.drawSoon(); };
    img.onerror = () => { this.onStatus?.('Basemap unavailable · points and exports still work'); };
    img.referrerPolicy = 'strict-origin-when-cross-origin';
    img.src = this.config.tileUrl.replace('{z}', z).replace('{x}', x).replace('{y}', y);
    // Keep a modest in-memory cache. Normal HTTP caching remains the browser's responsibility.
    if (this.tiles.size > 384) this.tiles.delete(this.tiles.keys().next().value);
    return tile;
  }
  draw() {
    if (!this.width || !this.height) return;
    const ctx = this.ctx, w = this.width, h = this.height;
    ctx.clearRect(0, 0, w, h); ctx.fillStyle = '#edf0e9'; ctx.fillRect(0, 0, w, h);
    const p = project(this.center, this.zoom), left = p.x - w / 2, top = p.y - h / 2;
    for (let x = Math.floor(left / 256); x <= Math.floor((left + w) / 256); x++) {
      for (let y = Math.floor(top / 256); y <= Math.floor((top + h) / 256); y++) {
        const sx = x * 256 - left, sy = y * 256 - top;
        const tile = this.config.tilesEnabled ? this.tile(x, y, this.zoom) : null;
        if (tile?.loaded) { ctx.globalAlpha = 0.83; ctx.drawImage(tile.img, sx, sy, 256, 256); ctx.globalAlpha = 1; }
        else { ctx.strokeStyle = '#dfe5dc'; ctx.lineWidth = 1; ctx.strokeRect(sx, sy, 256, 256); }
      }
    }
    // A coordinate grid makes the points-only fallback an honest map, not fictional geography.
    if (!this.config.tilesEnabled || ![...this.tiles.values()].some(t => t.loaded)) {
      ctx.font = '11px ui-monospace, monospace'; ctx.fillStyle = '#849289';
      for (let x = 28; x < w; x += 180) { const coord = this.fromScreen(x, 20); ctx.fillText(`${coord.longitude.toFixed(2)}° E`, x, 23); }
      for (let y = 65; y < h - 30; y += 110) { const coord = this.fromScreen(0, y); ctx.fillText(`${coord.latitude.toFixed(2)}° N`, 14, y); }
    }
    if (!this.query) return;
    // Render a geodesic circle, not a circle in unprojected degrees.
    ctx.beginPath(); for (let bearing = 0; bearing <= 360; bearing += 3) {
      const xy = this.screen(destination(this.query.center, this.query.radiusKm, bearing));
      if (bearing === 0) ctx.moveTo(xy.x, xy.y); else ctx.lineTo(xy.x, xy.y);
    }
    ctx.closePath(); ctx.fillStyle = '#16695814'; ctx.fill(); ctx.strokeStyle = '#267666'; ctx.lineWidth = 1.8;
    ctx.setLineDash([6, 5]); ctx.stroke(); ctx.setLineDash([]);
    // Context is visual only. Country filters still apply to matching records.
    let count = 0;
    for (const place of this.contextPoints) {
      const xy = this.screen(place); if (xy.x < 0 || xy.x > w || xy.y < 0 || xy.y > h) continue;
      if (++count > 2500) break;
      ctx.beginPath(); ctx.arc(xy.x, xy.y, 2, 0, Math.PI * 2); ctx.fillStyle = '#8d9e9470'; ctx.fill();
    }
    this.hits = []; const labels = [];
    for (const marker of this.markers) {
      const xy = this.screen(marker); if (xy.x < -10 || xy.x > w + 10 || xy.y < -10 || xy.y > h + 10) continue;
      if (this.hits.length >= 3000) break;
      const selected = marker.id === this.selectedId;
      ctx.beginPath(); ctx.arc(xy.x, xy.y, selected ? 7 : 5, 0, Math.PI * 2);
      ctx.fillStyle = marker.country === 'FR' ? '#bb643e' : marker.country === 'CH' ? '#9b3444' : '#207d6a'; ctx.fill(); ctx.strokeStyle = '#ffffff'; ctx.lineWidth = 2; ctx.stroke();
      this.hits.push({ ...xy, marker });
      if (labels.length >= 32 || marker.distanceKm < 0.03) continue;
      ctx.font = '12px system-ui, sans-serif'; const width = ctx.measureText(marker.name).width + 10;
      const box = { x: xy.x + 8, y: xy.y - 10, width, height: 20 };
      if (box.x + width > w - 12 || box.y < 42 || box.y > h - 35 || labels.some(b => box.x < b.x + b.width + 5 && box.x + width > b.x - 5 && box.y < b.y + 24 && box.y + 20 > b.y - 4)) continue;
      labels.push(box); ctx.fillStyle = '#fffffff0'; ctx.fillRect(box.x, box.y, width, 20); ctx.fillStyle = '#293e35'; ctx.fillText(marker.name, box.x + 5, box.y + 14);
    }
    const center = this.screen(this.query.center);
    ctx.beginPath(); ctx.arc(center.x, center.y, 12, 0, Math.PI * 2); ctx.fillStyle = '#e67742'; ctx.fill(); ctx.strokeStyle = '#fff'; ctx.lineWidth = 3; ctx.stroke();
    ctx.beginPath(); ctx.arc(center.x, center.y, 3, 0, Math.PI * 2); ctx.fillStyle = '#fff'; ctx.fill();
    ctx.font = 'bold 13px system-ui, sans-serif'; ctx.fillStyle = '#293e35';
    const label = this.query.center.name || 'Map point', labelWidth = ctx.measureText(label).width + 16;
    ctx.fillStyle = '#ffffffef'; ctx.fillRect(center.x - labelWidth / 2, center.y + 16, labelWidth, 24);
    ctx.fillStyle = '#293e35'; ctx.fillText(label, center.x - labelWidth / 2 + 8, center.y + 33);
    // Scale bar, calculated at the current latitude.
    const km = distanceKm(this.fromScreen(0, h / 2), this.fromScreen(100, h / 2));
    const magnitude = 10 ** Math.floor(Math.log10(km)); const nice = [1, 2, 5].map(x => x * magnitude).filter(x => x <= km).at(-1) || magnitude;
    const pixels = 100 * nice / km;
    ctx.strokeStyle = '#34493e'; ctx.lineWidth = 2; ctx.beginPath(); ctx.moveTo(20, h - 30); ctx.lineTo(20, h - 24); ctx.lineTo(20 + pixels, h - 24); ctx.lineTo(20 + pixels, h - 30); ctx.stroke();
    ctx.font = '11px system-ui, sans-serif'; ctx.fillStyle = '#34493e'; ctx.fillText(nice >= 1 ? `${nice} km` : `${Math.round(nice * 1000)} m`, 20, h - 36);
  }
}
