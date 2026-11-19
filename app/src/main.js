/* Neon Coast Cover Studio — editor wiring.
   Owns the cover state, undo/redo history, photo tray, per-panel
   drag-and-zoom, caption controls and PNG export. */

const SAMPLE_PHOTOS = [
  { id: "boulevard", name: "Boulevard", src: "samples/boulevard.jpg" },
  { id: "pier", name: "Pier", src: "samples/pier.jpg" }
];

function defaultCoverState() {
  return {
    layout: "hero",
    grade: "sunset",
    title: "NEON HARBOR",
    subtitle: "chase the sunset, own the night",
    stars: true,
    badge: true,
    grain: true,
    vignette: true,
    panels: []
  };
}

function freshPanelsFor(layout, photoCount, previous) {
  const count = layoutPanelCount(layout);
  const panels = [];
  for (let i = 0; i < count; i++) {
    const prev = previous && previous[i % previous.length];
    panels.push({
      photo: prev ? prev.photo % Math.max(1, photoCount) : i % Math.max(1, photoCount),
      ox: prev ? prev.ox : 0,
      // Tilted snapshots are wide and short: bias the crop upward so faces
      // (usually in the top half of a photo) stay in frame.
      oy: prev ? prev.oy : (layout === "tilted" ? -0.18 : 0),
      zoom: prev ? prev.zoom : 1
    });
  }
  return panels;
}

const CoverApp = {
  state: defaultCoverState(),
  photos: [],
  selectedPhoto: 0,
  selectedPanel: -1,
  undoStack: [],
  redoStack: [],

  init() {
    this.canvas = document.getElementById("coverCanvas");
    this.ctx = this.canvas.getContext("2d");
    this.shot = readShotParams();
    this.mode = applyShotMode(this.shot);
    if (this.shot.layout && COVER_LAYOUTS.indexOf(this.shot.layout) >= 0) {
      this.state.layout = this.shot.layout;
    }
    if (this.shot.grade && COVER_GRADES[this.shot.grade]) this.state.grade = this.shot.grade;
    if (this.shot.title) this.state.title = this.shot.title;
    if (this.shot.subtitle) this.state.subtitle = this.shot.subtitle;
    if (this.mode === "cover") {
      this.canvas.width = window.innerWidth;
      this.canvas.height = window.innerHeight;
      if (!this.shot.layout) this.state.layout = "grid9";
    }
    this.loadSamples().then(() => {
      this.state.panels = freshPanelsFor(this.state.layout, this.photos.length, null);
      this.buildTray();
      this.bindControls();
      this.render();
      return waitForShotAssets(this.photos.map((p) => p.img));
    }).then(() => {
      this.render();
      markShotReady();
    });
  },

  loadSamples() {
    const loads = SAMPLE_PHOTOS.map((s) => new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { this.photos.push({ id: s.id, name: s.name, img, src: s.src }); resolve(); };
      img.onerror = () => resolve();
      img.src = s.src;
    }));
    return Promise.all(loads);
  },

  /* ----- history ----- */
  snapshot() { return JSON.stringify(this.state); },
  pushHistory() {
    this.undoStack.push(this.snapshot());
    if (this.undoStack.length > 60) this.undoStack.shift();
    this.redoStack.length = 0;
    this.syncHistoryButtons();
  },
  undo() {
    if (!this.undoStack.length) return;
    this.redoStack.push(this.snapshot());
    this.state = JSON.parse(this.undoStack.pop());
    this.syncControls();
    this.render();
    this.syncHistoryButtons();
  },
  redo() {
    if (!this.redoStack.length) return;
    this.undoStack.push(this.snapshot());
    this.state = JSON.parse(this.redoStack.pop());
    this.syncControls();
    this.render();
    this.syncHistoryButtons();
  },
  syncHistoryButtons() {
    const u = document.getElementById("undoBtn");
    const r = document.getElementById("redoBtn");
    if (u) u.disabled = !this.undoStack.length;
    if (r) r.disabled = !this.redoStack.length;
  },

  /* ----- rendering ----- */
  render() {
    if (!this.photos.length) return;
    this.geometry = renderCover(this.ctx, this.canvas.width, this.canvas.height,
      this.state, this.photos, { selected: this.selectedPanel });
    this.syncPanelInfo();
  },

  /* ----- photo tray ----- */
  buildTray() {
    const tray = document.getElementById("photoTray");
    tray.innerHTML = "";
    this.photos.forEach((photo, i) => {
      const thumb = document.createElement("img");
      thumb.src = photo.src;
      thumb.alt = photo.name;
      thumb.title = photo.name;
      if (i === this.selectedPhoto) thumb.classList.add("selected");
      thumb.addEventListener("click", () => {
        this.selectedPhoto = i;
        this.buildTray();
      });
      tray.appendChild(thumb);
    });
  },

  addUploadedPhoto(file) {
    const reader = new FileReader();
    reader.onload = () => {
      const img = new Image();
      img.onload = () => {
        this.photos.push({ id: "upload-" + Date.now(), name: file.name, img, src: reader.result });
        this.selectedPhoto = this.photos.length - 1;
        this.buildTray();
        this.render();
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  },

  /* ----- controls ----- */
  bindControls() {
    const self = this;
    document.getElementById("undoBtn").addEventListener("click", () => self.undo());
    document.getElementById("redoBtn").addEventListener("click", () => self.redo());
    document.getElementById("shuffleBtn").addEventListener("click", () => {
      self.pushHistory();
      const order = self.state.panels.map((p) => p.photo);
      for (let i = order.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        const t = order[i]; order[i] = order[j]; order[j] = t;
      }
      self.state.panels.forEach((p, i) => { p.photo = order[i]; });
      self.render();
    });
    document.getElementById("fillAllBtn").addEventListener("click", () => {
      self.pushHistory();
      self.state.panels.forEach((p) => { p.photo = self.selectedPhoto; });
      self.render();
    });
    document.getElementById("uploadInput").addEventListener("change", (ev) => {
      Array.from(ev.target.files || []).forEach((f) => self.addUploadedPhoto(f));
      ev.target.value = "";
    });

    document.querySelectorAll("#layoutRow button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.layout === self.state.layout) return;
        self.pushHistory();
        self.state.layout = btn.dataset.layout;
        self.state.panels = freshPanelsFor(self.state.layout, self.photos.length, self.state.panels);
        self.selectedPanel = -1;
        self.syncControls();
        self.render();
      });
    });
    document.querySelectorAll("#gradeRow button").forEach((btn) => {
      btn.addEventListener("click", () => {
        if (btn.dataset.grade === self.state.grade) return;
        self.pushHistory();
        self.state.grade = btn.dataset.grade;
        self.syncControls();
        self.render();
      });
    });

    const titleInput = document.getElementById("titleInput");
    const subtitleInput = document.getElementById("subtitleInput");
    let titleTimer = null;
    titleInput.addEventListener("input", () => {
      if (!titleTimer) self.pushHistory();
      clearTimeout(titleTimer);
      titleTimer = setTimeout(() => { titleTimer = null; }, 600);
      self.state.title = titleInput.value;
      self.render();
    });
    let subTimer = null;
    subtitleInput.addEventListener("input", () => {
      if (!subTimer) self.pushHistory();
      clearTimeout(subTimer);
      subTimer = setTimeout(() => { subTimer = null; }, 600);
      self.state.subtitle = subtitleInput.value;
      self.render();
    });
    [["starsInput", "stars"], ["badgeInput", "badge"], ["grainInput", "grain"], ["vignetteInput", "vignette"]].forEach(([id, key]) => {
      document.getElementById(id).addEventListener("change", (ev) => {
        self.pushHistory();
        self.state[key] = ev.target.checked;
        self.render();
      });
    });

    const zoomSlider = document.getElementById("zoomSlider");
    zoomSlider.addEventListener("input", () => {
      const p = self.state.panels[self.selectedPanel];
      if (!p) return;
      p.zoom = parseFloat(zoomSlider.value);
      self.render();
    });
    zoomSlider.addEventListener("change", () => self.pushHistory());
    document.getElementById("resetCropBtn").addEventListener("click", () => {
      const p = self.state.panels[self.selectedPanel];
      if (!p) return;
      self.pushHistory();
      p.ox = 0; p.oy = 0; p.zoom = 1;
      self.render();
    });

    document.querySelectorAll("[data-export]").forEach((btn) => {
      btn.addEventListener("click", () => {
        const [w, h] = btn.dataset.export.split("x").map(Number);
        self.exportPng(w, h);
      });
    });

    document.addEventListener("keydown", (ev) => {
      if ((ev.ctrlKey || ev.metaKey) && ev.key.toLowerCase() === "z") {
        ev.preventDefault();
        if (ev.shiftKey) self.redo(); else self.undo();
      }
    });

    this.bindCanvasPointer();
    this.syncControls();
    this.syncHistoryButtons();
  },

  syncControls() {
    document.querySelectorAll("#layoutRow button").forEach((b) => {
      b.classList.toggle("active", b.dataset.layout === this.state.layout);
    });
    document.querySelectorAll("#gradeRow button").forEach((b) => {
      b.classList.toggle("active", b.dataset.grade === this.state.grade);
    });
    document.getElementById("titleInput").value = this.state.title;
    document.getElementById("subtitleInput").value = this.state.subtitle;
    document.getElementById("starsInput").checked = this.state.stars;
    document.getElementById("badgeInput").checked = this.state.badge;
    document.getElementById("grainInput").checked = this.state.grain;
    document.getElementById("vignetteInput").checked = this.state.vignette;
    const p = this.state.panels[this.selectedPanel];
    document.getElementById("zoomSlider").value = p ? p.zoom : 1;
  },

  syncPanelInfo() {
    const info = document.getElementById("panelInfo");
    if (!info) return;
    const p = this.state.panels[this.selectedPanel];
    if (!p) { info.textContent = "No panel selected yet — click a panel on the cover."; return; }
    const photo = this.photos[p.photo];
    info.textContent = "Panel " + (this.selectedPanel + 1) + " of " + this.state.panels.length +
      " — photo: " + (photo ? photo.name : "none") +
      " — zoom " + p.zoom.toFixed(2) + "×. Drag to move, scroll to zoom.";
  },

  /* ----- per-panel drag + zoom on the canvas ----- */
  hitPanel(clientX, clientY) {
    const rect = this.canvas.getBoundingClientRect();
    const x = (clientX - rect.left) * (this.canvas.width / rect.width);
    const y = (clientY - rect.top) * (this.canvas.height / rect.height);
    const panels = (this.geometry && this.geometry.panels) || [];
    for (let i = panels.length - 1; i >= 0; i--) {
      const r = panels[i];
      const cx = r.x + r.w / 2;
      const cy = r.y + r.h / 2;
      const dx = x - cx;
      const dy = y - cy;
      const rot = -(r.rot || 0);
      const lx = dx * Math.cos(rot) - dy * Math.sin(rot);
      const ly = dx * Math.sin(rot) + dy * Math.cos(rot);
      if (Math.abs(lx) <= r.w / 2 && Math.abs(ly) <= r.h / 2) return i;
    }
    return -1;
  },

  bindCanvasPointer() {
    const self = this;
    let drag = null;
    let wheelTimer = null;
    this.canvas.addEventListener("pointerdown", (ev) => {
      const idx = self.hitPanel(ev.clientX, ev.clientY);
      if (idx < 0) return;
      self.selectedPanel = idx;
      const panel = self.state.panels[idx];
      const rect = self.canvas.getBoundingClientRect();
      drag = {
        panel,
        startX: ev.clientX,
        startY: ev.clientY,
        ox: panel.ox,
        oy: panel.oy,
        scaleX: self.canvas.width / rect.width,
        scaleY: self.canvas.height / rect.height,
        moved: false
      };
      self.canvas.classList.add("dragging");
      self.canvas.setPointerCapture(ev.pointerId);
      self.render();
    });
    // A plain click (no drag) places the tray's selected photo into the panel.
    this.canvas.addEventListener("click", () => {
      if (self._dragMoved) return;
      const panel = self.state.panels[self.selectedPanel];
      if (!panel || panel.photo === self.selectedPhoto) return;
      self.pushHistory();
      panel.photo = self.selectedPhoto;
      self.render();
    });
    this.canvas.addEventListener("pointermove", (ev) => {
      if (!drag) return;
      const geo = self.geometry.panels[self.selectedPanel];
      if (!geo) return;
      const dx = (ev.clientX - drag.startX) * drag.scaleX;
      const dy = (ev.clientY - drag.startY) * drag.scaleY;
      if (Math.abs(dx) + Math.abs(dy) > 2) drag.moved = true;
      drag.panel.ox = Math.max(-1, Math.min(1, drag.ox + dx / geo.w));
      drag.panel.oy = Math.max(-1, Math.min(1, drag.oy + dy / geo.h));
      self.render();
    });
    const endDrag = () => {
      if (drag && drag.moved) self.pushHistory();
      self._dragMoved = !!(drag && drag.moved);
      drag = null;
      self.canvas.classList.remove("dragging");
    };
    this.canvas.addEventListener("pointerup", endDrag);
    this.canvas.addEventListener("pointercancel", endDrag);
    this.canvas.addEventListener("wheel", (ev) => {
      const idx = self.selectedPanel >= 0 ? self.selectedPanel : self.hitPanel(ev.clientX, ev.clientY);
      if (idx < 0) return;
      ev.preventDefault();
      self.selectedPanel = idx;
      const panel = self.state.panels[idx];
      panel.zoom = Math.max(1, Math.min(3, panel.zoom * Math.exp(-ev.deltaY * 0.0012)));
      if (!wheelTimer) self.pushHistory();
      clearTimeout(wheelTimer);
      wheelTimer = setTimeout(() => { wheelTimer = null; }, 500);
      document.getElementById("zoomSlider").value = panel.zoom;
      self.render();
    }, { passive: false });
  },

  /* ----- export ----- */
  exportPng(w, h) {
    const canvas = exportCoverCanvas(this.state, this.photos, w, h);
    canvas.toBlob((blob) => {
      if (!blob) return;
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = "neon-coast-cover-" + w + "x" + h + ".png";
      a.click();
      setTimeout(() => URL.revokeObjectURL(url), 5000);
    }, "image/png");
  }
};

document.addEventListener("DOMContentLoaded", () => CoverApp.init());
