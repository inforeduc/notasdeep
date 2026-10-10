/* ============================================================================
   dom-minimo.js — Implementación mínima pero fiel del DOM suficiente para
   ejecutar la aplicación completa dentro de Node (sin navegador): análisis de
   HTML, selectores, clases, eventos con propagación, formularios y textContent.
   Sólo se usa para las pruebas automatizadas.
   ========================================================================== */
'use strict';

const VOID = { input: 1, br: 1, img: 1, meta: 1, link: 1, hr: 1, col: 1, source: 1, area: 1, base: 1, wbr: 1, embed: 1, track: 1 };

function decodificar(t) {
  return String(t == null ? '' : t)
    .replace(/&nbsp;/g, '\u00a0').replace(/&middot;/g, '·').replace(/&amp;/g, '&')
    .replace(/&lt;/g, '<').replace(/&gt;/g, '>').replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'").replace(/&aacute;/g, 'á').replace(/&eacute;/g, 'é');
}

function escapar(t) {
  return String(t).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
}

class ClaseLista {
  constructor(el) { this.el = el; }
  contains(n) { return (this.el._clases || []).indexOf(n) >= 0; }
  add() { for (const n of arguments) if (!this.contains(n)) this.el._clases.push(n); }
  remove() { const q = Array.prototype.slice.call(arguments); this.el._clases = (this.el._clases || []).filter(c => q.indexOf(c) < 0); }
  toggle(n, fuerza) {
    const tiene = this.contains(n);
    const poner = fuerza === undefined ? !tiene : !!fuerza;
    if (poner) this.add(n); else this.remove(n);
    return poner;
  }
  get value() { return (this.el._clases || []).join(' '); }
  toString() { return this.value; }
}

let DOC = null;

class Nodo {
  constructor(tag) {
    this.tagName = String(tag).toUpperCase();
    this.nodeName = this.tagName;
    this.nodeType = 1;
    this.atributos = {};
    this.hijos = [];
    this.padre = null;
    this._clases = [];
    this._texto = '';
    this._oyentes = {};
    this._estilo = {};
    this._valor = '';
    this._selectedIndex = 0;
    this.checked = false;
    this.selected = false;
    this.hidden = false;
    this.disabled = false;
    this.files = [];
    this._cl = new ClaseLista(this);
  }

  /* ---------------------------------------------------------- estructura */
  get children() { return this.hijos.filter(h => h.nodeType === 1); }
  get childNodes() { return this.hijos; }
  get firstChild() { return this.hijos[0] || null; }
  get parentNode() { return this.padre; }
  get options() { return this.hijos.filter(h => h.nodeType === 1 && h.tagName === 'OPTION'); }
  get style() { return this._estilo; }

  appendChild(n) {
    if (n.padre) n.padre.removeChild(n);
    n.padre = this;
    const eraVacio = this.tagName === 'SELECT' && this.options.length === 0;
    this.hijos.push(n);
    if (eraVacio && n.tagName === 'OPTION') n.selected = true;
    return n;
  }
  removeChild(n) {
    const i = this.hijos.indexOf(n);
    if (i >= 0) { this.hijos.splice(i, 1); n.padre = null; }
    return n;
  }
  remove() { if (this.padre) this.padre.removeChild(this); }
  get nextSibling() {
    if (!this.padre) return null;
    const h = this.padre.hijos, i = h.indexOf(this);
    return i >= 0 ? (h[i + 1] || null) : null;
  }

  /* --------------------------------------------------------------- valor */
  get value() {
    if (this.tagName === 'SELECT') {
      const ops = this.options;
      if (this._valor !== '' && this._valor !== undefined) {
        const hay = ops.some(o => String(o.value) === String(this._valor));
        if (hay) return String(this._valor);
      }
      const marcada = ops.filter(o => o.selected)[0];
      if (marcada) return String(marcada.value);
      return ops.length ? String(ops[0].value) : '';
    }
    if (this.tagName === 'OPTION') return String(this._valor);
    return String(this._valor == null ? '' : this._valor);
  }
  set value(v) {
    this._valor = String(v == null ? '' : v);
    this.atributos.value = this._valor;
    if (this.tagName === 'SELECT') {
      this.options.forEach(o => { o.selected = String(o.value) === this._valor; });
    }
  }
  get selectedIndex() {
    if (this.tagName !== 'SELECT') return 0;
    const ops = this.options;
    for (let i = 0; i < ops.length; i++) if (ops[i].selected) return i;
    return ops.length ? 0 : -1;
  }
  set selectedIndex(i) {
    if (this.tagName !== 'SELECT') return;
    this.options.forEach((o, k) => { o.selected = k === Number(i); });
    const ops = this.options;
    if (ops[Number(i)]) this._valor = String(ops[Number(i)].value);
  }

  /* ----------------------------------------------------------- atributos */
  getAttribute(n) { return this.atributos[n] === undefined ? null : this.atributos[n]; }
  hasAttribute(n) { return this.atributos[n] !== undefined; }
  setAttribute(n, v) {
    const valor = v === undefined || v === null ? '' : String(v);
    this.atributos[n] = valor;
    if (n === 'id') { this._id = valor; if (DOC) DOC._indice.set(valor, this); }
    if (n === 'class') this._clases = valor.split(/\s+/).filter(Boolean);
    if (n === 'hidden') this.hidden = true;
    if (n === 'checked') this.checked = true;
    if (n === 'disabled') this.disabled = true;
    if (n === 'value') this.value = valor;
    return valor;
  }
  removeAttribute(n) {
    delete this.atributos[n];
    if (n === 'hidden') this.hidden = false;
    if (n === 'checked') this.checked = false;
  }
  get id() { return this.atributos.id || ''; }
  set id(v) { this.setAttribute('id', v); }
  get className() { return (this._clases || []).join(' '); }
  set className(v) { this._clases = String(v || '').split(/\s+/).filter(Boolean); this.atributos['class'] = String(v || ''); }
  get classList() { return this._cl; }
  get dataset() {
    const d = {};
    Object.keys(this.atributos).forEach(k => {
      if (k.indexOf('data-') === 0) d[k.slice(5).replace(/-([a-z])/g, (m, c) => c.toUpperCase())] = this.atributos[k];
    });
    return d;
  }

  /* ------------------------------------------------------ texto/Html */
  get textContent() {
    if (this.nodeType === 3) return this._texto;
    return this.hijos.map(h => h.textContent).join('');
  }
  set textContent(v) {
    this.hijos = [];
    if (v !== '' && v != null) {
      const t = new Nodo('#text');
      t.nodeType = 3;
      t._texto = String(v);
      t.padre = this;
      this.hijos.push(t);
    }
  }
  get innerHTML() { return this.hijos.map(serializar).join(''); }
  set innerHTML(v) {
    this.hijos = [];
    const nodos = parsearFragmento(String(v == null ? '' : v));
    nodos.forEach(n => { n.padre = this; this.hijos.push(n); });
    if (this.tagName === 'SELECT') this.value = '';
  }

  /* --------------------------------------------------------- selectores */
  querySelectorAll(sel) { return buscar(this, sel); }
  querySelector(sel) { return buscar(this, sel)[0] || null; }
  matches(sel) { return coincideCompuestos(this, parsearSelector(sel)); }
  closest(sel) {
    let n = this;
    while (n && n.nodeType === 1) {
      if (n.matches(sel)) return n;
      n = n.padre;
    }
    return null;
  }

  /* ------------------------------------------------------------ eventos */
  addEventListener(tipo, fn, opciones) {
    if (!fn) return;
    const captura = opciones === true || !!(opciones && opciones.capture);
    (this._oyentes[tipo] = this._oyentes[tipo] || []).push({ fn: fn, captura: captura });
  }
  removeEventListener(tipo, fn) {
    const l = this._oyentes[tipo];
    if (!l) return;
    this._oyentes[tipo] = l.filter(o => o.fn !== fn);
  }
  dispatchEvent(ev) {
    if (!ev.target) ev.target = this;
    const camino = [];
    let n = this;
    while (n) { camino.push(n); n = n.padre; }
    // fase de captura: de la raíz hacia el padre del objetivo
    ev.eventPhase = 1;
    for (let i = camino.length - 1; i >= 1 && !ev._detenido; i--) invocar(camino[i], ev, true);
    // en el objetivo se ejecutan todos los manejadores, en orden de registro
    ev.eventPhase = 2;
    if (!ev._detenido) invocar(camino[0], ev, null);
    for (let i = 1; i < camino.length && !ev._detenido; i++) invocar(camino[i], ev, false);
    return !ev.defaultPrevented;
  }
  click() {
    const ev = new Evento('click', { bubbles: true, cancelable: true });
    this.dispatchEvent(ev);
  }
  focus() { if (DOC) DOC.activeElement = this; }
  blur() { const ev = new Evento('blur', { bubbles: false }); this.dispatchEvent(ev); }
  select() { }
  setSelectionRange() { }
  insertBefore(nodo, ref) {
    const i = ref ? this.hijos.indexOf(ref) : -1;
    nodo.padre = this;
    if (i < 0) this.hijos.push(nodo); else this.hijos.splice(i, 0, nodo);
    return nodo;
  }
  contains(n) {
    if (n === this) return true;
    return this.hijos.some(h => h.nodeType === 1 && h.contains(n));
  }
  getBoundingClientRect() { return { top: 0, left: 0, width: 100, height: 20 }; }
}

function invocar(nodo, ev, captura) {
  const lista = nodo._oyentes[ev.type] || [];
  ev.currentTarget = nodo;
  lista.forEach(o => {
    if (captura !== null && o.captura !== captura) return;
    try { o.fn.call(nodo, ev); } catch (e) { ev._error = e; throw e; }
  });
  if (captura === false || captura === null) {
    const directo = nodo['on' + ev.type];
    if (typeof directo === 'function') directo.call(nodo, ev);
  }
}

class Evento {
  constructor(tipo, opciones) {
    const o = opciones || {};
    this.type = tipo;
    this.bubbles = !!o.bubbles;
    this.cancelable = !!o.cancelable;
    this.target = null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this._detenido = false;
    this.key = o.key || '';
    this.ctrlKey = !!o.ctrlKey;
    this.metaKey = !!o.metaKey;
  }
  preventDefault() { this.defaultPrevented = true; }
  stopPropagation() { this._detenido = true; }
  stopImmediatePropagation() { this._detenido = true; }
}

/* ══════════════════════════ Análisis de HTML ══════════════════════════ */

function buscarFinEtiqueta(html, desde) {
  let i = desde + 1, comilla = null;
  while (i < html.length) {
    const c = html[i];
    if (comilla) { if (c === comilla) comilla = null; }
    else if (c === '"' || c === "'") comilla = c;
    else if (c === '>') return i;
    i++;
  }
  return html.length - 1;
}

function agregarTexto(padre, texto) {
  if (!texto || !/\S/.test(texto)) return;
  const t = new Nodo('#text');
  t.nodeType = 3;
  t._texto = decodificar(texto);
  t.padre = padre;
  padre.hijos.push(t);
}

function parsearFragmento(html) {
  const raiz = new Nodo('#fragmento');
  const pila = [raiz];
  let i = 0;
  while (i < html.length) {
    if (html.startsWith('<!--', i)) { const f = html.indexOf('-->', i); i = f < 0 ? html.length : f + 3; continue; }
    if (html.startsWith('<!', i)) { const f = html.indexOf('>', i); i = f < 0 ? html.length : f + 1; continue; }
    const lt = html.indexOf('<', i);
    if (lt < 0) { agregarTexto(pila[pila.length - 1], html.slice(i)); break; }
    if (lt > i) agregarTexto(pila[pila.length - 1], html.slice(i, lt));
    if (html[lt + 1] === '/') {
      const gt = html.indexOf('>', lt);
      const nombre = html.slice(lt + 2, gt).trim().toLowerCase().split(/\s/)[0];
      for (let k = pila.length - 1; k > 0; k--) {
        if (pila[k].tagName.toLowerCase() === nombre) { pila.length = k; break; }
      }
      i = gt + 1;
      continue;
    }
    const gt = buscarFinEtiqueta(html, lt);
    let dentro = html.slice(lt + 1, gt);
    const autocierre = /\/\s*$/.test(dentro);
    if (autocierre) dentro = dentro.replace(/\/\s*$/, '');
    const m = dentro.match(/^([A-Za-z0-9:_-]+)/);
    const tag = m ? m[1].toLowerCase() : 'div';
    const el = new Nodo(tag);
    const resto = dentro.slice(tag.length);
    const reAttr = /([A-Za-z_:@][-A-Za-z0-9_:.]*)(?:\s*=\s*(?:"([^"]*)"|'([^']*)'|([^\s"'>]+)))?/g;
    let a;
    while ((a = reAttr.exec(resto))) {
      const nombre = a[1];
      const valor = a[2] !== undefined ? a[2] : (a[3] !== undefined ? a[3] : (a[4] !== undefined ? a[4] : ''));
      el.setAttribute(nombre, decodificar(valor));
    }
    pila[pila.length - 1].appendChild(el);
    if (tag === 'script' || tag === 'style') {
      const fin = html.toLowerCase().indexOf('</' + tag, gt);
      i = fin < 0 ? html.length : html.indexOf('>', fin) + 1;
      continue;
    }
    if (!VOID[tag] && !autocierre) pila.push(el);
    i = gt + 1;
  }
  return raiz.hijos.slice();
}

function serializar(n) {
  if (n.nodeType === 3) return escapar(n._texto);
  const attrs = Object.keys(n.atributos).map(k => ' ' + k + '="' + String(n.atributos[k]).replace(/"/g, '&quot;') + '"').join('');
  const tag = n.tagName.toLowerCase();
  if (VOID[tag]) return '<' + tag + attrs + '>';
  return '<' + tag + attrs + '>' + n.hijos.map(serializar).join('') + '</' + tag + '>';
}

/* ══════════════════════════════ Selectores ═════════════════════════════ */

function parsearSelector(sel) {
  const partes = String(sel).trim().split(/\s+/).filter(Boolean);
  return partes.map(p => {
    const comp = { tag: null, id: null, clases: [], attrs: [], nth: null };
    let resto = p;
    const nth = resto.match(/:nth-child\((\d+)\)/);
    if (nth) { comp.nth = parseInt(nth[1], 10); resto = resto.replace(/:nth-child\(\d+\)/, ''); }
    const attrs = resto.match(/\[[^\]]+\]/g) || [];
    attrs.forEach(a => {
      const m = a.slice(1, -1).match(/^([^=]+)(?:=["']?([^"']*)["']?)?$/);
      if (m) comp.attrs.push([m[1].trim(), m[2] === undefined ? null : decodificar(m[2])]);
    });
    resto = resto.replace(/\[[^\]]+\]/g, '');
    const idm = resto.match(/#([A-Za-z0-9_-]+)/);
    if (idm) { comp.id = idm[1]; resto = resto.replace(/#[A-Za-z0-9_-]+/, ''); }
    (resto.match(/\.[A-Za-z0-9_-]+/g) || []).forEach(c => comp.clases.push(c.slice(1)));
    resto = resto.replace(/\.[A-Za-z0-9_-]+/g, '');
    const tag = resto.trim();
    if (tag && tag !== '*') comp.tag = tag.toLowerCase();
    return comp;
  });
}

function coincide(nodo, comp) {
  if (nodo.nodeType !== 1) return false;
  if (comp.tag && nodo.tagName.toLowerCase() !== comp.tag) return false;
  if (comp.id && nodo.getAttribute('id') !== comp.id) return false;
  for (const c of comp.clases) if (!nodo.classList.contains(c)) return false;
  for (const [n, v] of comp.attrs) {
    if (!nodo.hasAttribute(n)) return false;
    if (v !== null && v !== '' && nodo.getAttribute(n) !== v) return false;
  }
  if (comp.nth !== null) {
    if (!nodo.padre) return false;
    const hermanos = nodo.padre.children;
    if (hermanos.indexOf(nodo) + 1 !== comp.nth) return false;
  }
  return true;
}

function coincideCompuestos(nodo, compuestos) {
  if (!compuestos.length) return false;
  if (!coincide(nodo, compuestos[compuestos.length - 1])) return false;
  let idx = compuestos.length - 2;
  let n = nodo.padre;
  while (idx >= 0 && n) {
    if (coincide(n, compuestos[idx])) idx--;
    n = n.padre;
  }
  return idx < 0;
}

function recorrer(raiz, fn) {
  raiz.children.forEach(h => { fn(h); recorrer(h, fn); });
}

function buscar(raiz, sel) {
  const compuestos = parsearSelector(sel);
  const res = [];
  recorrer(raiz, n => { if (coincideCompuestos(n, compuestos)) res.push(n); });
  return res;
}

/* ═══════════════════════════ Documento/Ventana ═════════════════════════ */

function crearDocumento(html) {
  const doc = new Nodo('#document');
  doc.nodeType = 9;
  doc._indice = new Map();
  doc.readyState = 'complete';
  doc.title = 'Evaluación Docente de Zazarabicoa';
  DOC = doc;
  const nodos = parsearFragmento(html);
  nodos.forEach(n => doc.appendChild(n));
  indexar(doc);
  doc.documentElement = doc.children.filter(c => c.tagName === 'HTML')[0] || doc;
  doc.body = doc.querySelector('body') || doc;
  doc.head = doc.querySelector('head') || doc;
  doc.getElementById = id => doc._indice.get(String(id)) || null;
  doc.createElement = tag => new Nodo(tag);
  doc.createTextNode = t => {
    const n = new Nodo('#text');
    n.nodeType = 3; n._texto = String(t);
    return n;
  };
  doc.querySelector = sel => buscar(doc, sel)[0] || null;
  doc.querySelectorAll = sel => buscar(doc, sel);
  doc.defaultView = null;
  return doc;
}

function indexar(raiz) {
  if (raiz.nodeType === 1 && raiz.atributos.id) raiz._id = raiz.atributos.id;
  if (raiz.atributos && raiz.atributos.id) DOC._indice.set(raiz.atributos.id, raiz);
  raiz.hijos.forEach(indexar);
}

/* ═══════════════════════════ Almacenamiento falso ══════════════════════ */

function crearLocalStorage() {
  const datos = new Map();
  return {
    getItem: k => (datos.has(String(k)) ? datos.get(String(k)) : null),
    setItem: (k, v) => { datos.set(String(k), String(v)); },
    removeItem: k => { datos.delete(String(k)); },
    clear: () => datos.clear(),
    get length() { return datos.size; },
    key: i => Array.from(datos.keys())[i] || null
  };
}

module.exports = {
  Nodo, Evento, ClaseLista,
  crearDocumento, crearLocalStorage, parsearFragmento, buscar
};
