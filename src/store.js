/* =====================================================================
   store.js — estado, historial, autoguardado y sincronía con disco
   ---------------------------------------------------------------------
   El historial funciona por TRANSACCIONES: varias mutaciones seguidas se
   agrupan en un solo paso de deshacer. Es lo que permite que un agente
   (Claude Code) haga 20 cambios y que Ctrl+Z los revierta todos juntos.
   ===================================================================== */

import { normalize, maxIdSeq, sceneBytes, LIMITS, SCHEMA_VERSION } from "./schema.js";
import { wolfITTemplate } from "./templates.js";

const HIST_MAX = 80;

/* ---------------- IndexedDB mínimo (el autoguardado ya no muere por cuota) ---------------- */
const DB_NAME = "wolfit-designer";
const STORE = "kv";

function idb(){
  return new Promise((res, rej) => {
    const rq = indexedDB.open(DB_NAME, 1);
    rq.onupgradeneeded = () => rq.result.createObjectStore(STORE);
    rq.onsuccess = () => res(rq.result);
    rq.onerror = () => rej(rq.error);
  });
}
async function idbGet(key){
  try {
    const db = await idb();
    return await new Promise((res, rej) => {
      const tx = db.transaction(STORE, "readonly").objectStore(STORE).get(key);
      tx.onsuccess = () => res(tx.result);
      tx.onerror = () => rej(tx.error);
    });
  } catch { return undefined; }
}
async function idbSet(key, val){
  const db = await idb();
  return new Promise((res, rej) => {
    const tx = db.transaction(STORE, "readwrite").objectStore(STORE).put(val, key);
    tx.onsuccess = () => res(true);
    tx.onerror = () => rej(tx.error);
  });
}

/* ===================================================================== */
export class Store extends EventTarget {
  constructor(){
    super();
    this.scene = null;
    this.sel = [];               // ids seleccionados (multi-selección)
    this.seq = 0;                // contador de ids
    this.hist = [];
    this.hidx = -1;
    this._depth = 0;
    this._before = null;
    this._autosaveTimer = null;
    this._fileHandle = null;
    this._fileTimer = null;
    this._pollTimer = null;
    this._lastWrite = 0;
    this._suspendFileWrite = false;
  }

  /* ---------------- carga ---------------- */
  load(raw, { resetHistory = true } = {}){
    const scene = normalize(raw);
    this.scene = scene;
    this.seq = maxIdSeq(scene);          // ← arregla la colisión de ids
    this.sel = [];
    if (resetHistory){
      this.hist = [JSON.stringify(scene)];
      this.hidx = 0;
    }
    this.emit("load");
    this.emit("change");
    return scene;
  }

  uid(){
    let id;
    const used = new Set(this.scene ? this.scene.elements.map(e => e.id) : []);
    do { id = "el" + (++this.seq); } while (used.has(id));
    return id;
  }

  emit(type, detail){ this.dispatchEvent(new CustomEvent(type, { detail })); }

  /* ---------------- transacciones ---------------- */
  begin(){
    if (this._depth === 0) this._before = JSON.stringify(this.scene);
    this._depth++;
  }
  end(label){
    this._depth = Math.max(0, this._depth - 1);
    if (this._depth > 0) return;
    const after = JSON.stringify(this.scene);
    if (this._before !== null && after !== this._before){
      this.hist = this.hist.slice(0, this.hidx + 1);
      this.hist.push(after);
      if (this.hist.length > HIST_MAX) this.hist.shift();
      this.hidx = this.hist.length - 1;
      this.emit("history", { label });
      this.scheduleAutosave();
      this.scheduleFileWrite();
    }
    this._before = null;
    this.emit("change", { label });
  }
  /* Azúcar: una edición atómica */
  tx(label, fn){
    this.begin();
    try { return fn(); } finally { this.end(label); }
  }
  /* Cambios en vivo (arrastre) que ya empezaron con begin() */
  touch(){ this.emit("change"); }

  canUndo(){ return this.hidx > 0; }
  canRedo(){ return this.hidx < this.hist.length - 1; }
  undo(){
    if (!this.canUndo()) return false;
    this.hidx--;
    this._restore();
    return true;
  }
  redo(){
    if (!this.canRedo()) return false;
    this.hidx++;
    this._restore();
    return true;
  }
  _restore(){
    this.scene = JSON.parse(this.hist[this.hidx]);
    this.seq = Math.max(this.seq, maxIdSeq(this.scene));
    this.sel = this.sel.filter(id => this.scene.elements.some(e => e.id === id));
    this.emit("load");
    this.emit("change");
    this.scheduleAutosave();
    this.scheduleFileWrite();
  }

  /* ---------------- selección ---------------- */
  get selected(){
    return this.sel
      .map(id => this.scene.elements.find(e => e.id === id))
      .filter(Boolean);
  }
  get one(){ return this.sel.length === 1 ? this.selected[0] : null; }
  select(ids, { additive = false } = {}){
    const list = Array.isArray(ids) ? ids : (ids ? [ids] : []);
    if (additive){
      for (const id of list){
        const i = this.sel.indexOf(id);
        if (i >= 0) this.sel.splice(i, 1); else this.sel.push(id);
      }
    } else {
      this.sel = list.slice();
    }
    this.emit("selection");
  }
  clearSelection(){ this.sel = []; this.emit("selection"); }

  byId(id){ return this.scene.elements.find(e => e.id === id) || null; }

  /* Si el elemento pertenece a un grupo, devuelve todos sus hermanos.
     Agrupación liviana: no hay anidado, solo un id compartido. */
  expandGroup(id){
    const el = this.byId(id);
    if (!el || !el.group) return [id];
    return this.scene.elements.filter(e => e.group === el.group).map(e => e.id);
  }
  groupSelection(){
    if (this.sel.length < 2) return false;
    const gid = "g" + Date.now().toString(36);
    this.tx("agrupar", () => { for (const e of this.selected) e.group = gid; });
    return true;
  }
  ungroupSelection(){
    if (!this.sel.length) return false;
    this.tx("desagrupar", () => { for (const e of this.selected) e.group = ""; });
    return true;
  }

  /* ---------------- autoguardado ---------------- */
  scheduleAutosave(){
    clearTimeout(this._autosaveTimer);
    this._autosaveTimer = setTimeout(() => this.autosave(), 600);
  }
  async autosave(){
    if (!this.scene) return;
    const bytes = sceneBytes(this.scene);
    try {
      await idbSet("autosave", this.scene);
      this.emit("saved", { bytes });
    } catch (e){
      /* Antes esto se tragaba el error y el usuario creía que estaba guardado. */
      this.emit("saveerror", { error: e, bytes });
    }
    if (bytes > LIMITS.projectMB * 1024 * 1024){
      this.emit("warn", {
        message: `El proyecto pesa ${(bytes / 1048576).toFixed(1)} MB (límite sugerido ${LIMITS.projectMB} MB). Guardá una copia .json.`
      });
    }
  }
  async restoreAutosave(){
    const s = await idbGet("autosave");
    if (s && s.elements && s.w && s.h) return s;
    /* Compatibilidad: autoguardado viejo en localStorage */
    try {
      const legacy = localStorage.getItem("wolfit.designer.v1");
      if (legacy){
        const parsed = JSON.parse(legacy);
        if (parsed && parsed.elements) return parsed;
      }
    } catch {}
    return null;
  }

  /* ---------------------------------------------------------------------
     Sincronía con archivo en disco (File System Access API)
     Esto es lo que permite trabajar por texto/audio: el proyecto vive como
     .flyer.json y Claude Code lo edita; el editor detecta el cambio y recarga.
     --------------------------------------------------------------------- */
  get fileSupported(){ return typeof window.showSaveFilePicker === "function"; }
  get fileName(){ return this._fileHandle ? this._fileHandle.name : null; }

  async linkNewFile(){
    if (!this.fileSupported) throw new Error("Tu navegador no soporta abrir/guardar archivos directamente. Usá Edge o Chrome.");
    const handle = await window.showSaveFilePicker({
      suggestedName: slug(this.scene.name || "proyecto") + ".flyer.json",
      types: [{ description: "Proyecto de flyer", accept: { "application/json": [".json"] } }]
    });
    this._fileHandle = handle;
    await this.writeFile();
    this.startPolling();
    this.emit("filelink", { name: handle.name });
    return handle.name;
  }

  async linkExistingFile(){
    if (!this.fileSupported) throw new Error("Tu navegador no soporta abrir/guardar archivos directamente. Usá Edge o Chrome.");
    const [handle] = await window.showOpenFilePicker({
      types: [{ description: "Proyecto de flyer", accept: { "application/json": [".json"] } }]
    });
    this._fileHandle = handle;
    const file = await handle.getFile();
    const text = await file.text();
    this.load(JSON.parse(text));
    this._lastWrite = file.lastModified;
    this.startPolling();
    this.emit("filelink", { name: handle.name });
    return handle.name;
  }

  unlinkFile(){
    this._fileHandle = null;
    clearInterval(this._pollTimer);
    this._pollTimer = null;
    this.emit("filelink", { name: null });
  }

  scheduleFileWrite(){
    if (!this._fileHandle || this._suspendFileWrite) return;
    clearTimeout(this._fileTimer);
    this._fileTimer = setTimeout(() => this.writeFile(), 400);
  }

  async writeFile(){
    if (!this._fileHandle) return;
    try {
      const w = await this._fileHandle.createWritable();
      await w.write(JSON.stringify(this.scene, null, 2));
      await w.close();
      const f = await this._fileHandle.getFile();
      this._lastWrite = f.lastModified;
      this.emit("filesync", { direction: "out", name: this._fileHandle.name });
    } catch (e){
      this.emit("warn", { message: "No se pudo escribir el archivo: " + e.message });
    }
  }

  /* Detecta ediciones hechas por fuera (Claude Code, editor de texto…) */
  startPolling(){
    clearInterval(this._pollTimer);
    this._pollTimer = setInterval(async () => {
      if (!this._fileHandle) return;
      try {
        const f = await this._fileHandle.getFile();
        if (f.lastModified <= this._lastWrite) return;
        const text = await f.text();
        const raw = JSON.parse(text);
        this._lastWrite = f.lastModified;
        this._suspendFileWrite = true;          // no rebotar el cambio de vuelta
        this.begin();
        this.load(raw, { resetHistory: false });
        this.end("cambio externo");
        this._suspendFileWrite = false;
        this.emit("filesync", { direction: "in", name: this._fileHandle.name });
      } catch (e){
        /* archivo a medio escribir: se reintenta en el próximo tick */
      }
    }, 1200);
  }
}

function slug(s){
  return String(s).toLowerCase()
    .normalize("NFD").replace(/[̀-ͯ]/g, "")
    .replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "proyecto";
}

export { slug, SCHEMA_VERSION };
