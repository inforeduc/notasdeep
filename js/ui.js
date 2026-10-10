/* ============================================================================
   ui.js — Utilidades de interfaz: avisos flotantes, ventanas de confirmación,
   descargas de archivos, manejo de escudo y ayudas de formulario.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var UI = {
    $: function (id) { return document.getElementById(id); },
    $$: function (sel, cont) { return Array.prototype.slice.call((cont || document).querySelectorAll(sel)); },
    esc: function (t) { return ZZ.escapar(t); },

    valor: function (id) { var el = UI.$(id); return el ? String(el.value == null ? '' : el.value).trim() : ''; },
    ponerValor: function (id, v) { var el = UI.$(id); if (el) el.value = v == null ? '' : v; },
    texto: function (id, t) { var el = UI.$(id); if (el) el.innerHTML = t == null ? '' : t; },
    mostrar: function (id, si) { var el = UI.$(id); if (el) el.hidden = !si; },

    /* ---------------------------------------------------- avisos flotantes */
    avisoFlotante: function (mensaje, tipo) {
      var caja = UI.$('avisos-flotantes');
      if (!caja) { console.log(mensaje); return; }
      var d = document.createElement('div');
      d.className = 'toast' + (tipo ? ' ' + tipo : '');
      d.textContent = mensaje;
      caja.appendChild(d);
      setTimeout(function () {
        d.style.transition = 'opacity .3s, transform .3s';
        d.style.opacity = '0';
        d.style.transform = 'translateX(20px)';
        setTimeout(function () { if (d.parentNode) d.parentNode.removeChild(d); }, 320);
      }, tipo === 'error' ? 6500 : 3600);
    },

    /* ------------------------------------------------------- ventana modal */
    modal: function (op) {
      var o = op || {};
      var fondo = UI.$('fondo-modal');
      var titulo = UI.$('modal-titulo');
      var texto = UI.$('modal-texto');
      var aceptar = UI.$('modal-aceptar');
      var cancelar = UI.$('modal-cancelar');
      if (!fondo) return;

      titulo.textContent = o.titulo || 'Confirmación';
      texto.innerHTML = '';
      var p = document.createElement('p');
      p.innerHTML = o.texto || '';
      texto.appendChild(p);

      var entrada = null;
      if (o.campo) {
        var caja = document.createElement('div');
        caja.className = 'campo';
        caja.style.marginBottom = '16px';
        var et = document.createElement('span');
        et.textContent = o.etiqueta || '';
        caja.appendChild(et);
        if (o.campo === 'select') {
          entrada = document.createElement('select');
          (o.opciones || []).forEach(function (op2) {
            var opt = document.createElement('option');
            if (op2 && typeof op2 === 'object') { opt.value = op2.valor; opt.textContent = op2.texto; }
            else { opt.value = op2; opt.textContent = op2; }
            entrada.appendChild(opt);
          });
        } else {
          entrada = document.createElement('input');
          entrada.type = o.campo === 'numero' ? 'number' : (o.campo === 'clave' ? 'password' : 'text');
          if (o.min != null) entrada.min = o.min;
          if (o.max != null) entrada.max = o.max;
          if (o.paso != null) entrada.step = o.paso;
          if (o.placeholder) entrada.placeholder = o.placeholder;
        }
        if (o.valor != null) entrada.value = o.valor;
        caja.appendChild(entrada);
        texto.appendChild(caja);
      }

      aceptar.textContent = o.aceptar || 'Aceptar';
      aceptar.className = 'btn ' + (o.peligro ? 'btn-peligro' : 'btn-primario');
      cancelar.textContent = o.cancelarTexto || 'Cancelar';
      fondo.hidden = false;
      setTimeout(function () { if (entrada) entrada.focus(); else aceptar.focus(); }, 30);

      function cerrar() {
        fondo.hidden = true;
        aceptar.onclick = null;
        cancelar.onclick = null;
        fondo.onclick = null;
        document.removeEventListener('keydown', tecla);
      }
      function tecla(ev) {
        if (ev.key === 'Escape') { cerrar(); if (o.onCancelar) o.onCancelar(); }
        if (ev.key === 'Enter' && entrada) { ev.preventDefault(); aceptar.click(); }
      }
      aceptar.onclick = function () {
        var v = entrada ? entrada.value : null;
        cerrar();
        if (o.onAceptar) o.onAceptar(v);
      };
      cancelar.onclick = function () { cerrar(); if (o.onCancelar) o.onCancelar(); };
      fondo.onclick = function (ev) { if (ev.target === fondo) { cerrar(); if (o.onCancelar) o.onCancelar(); } };
      document.addEventListener('keydown', tecla);
    },

    confirmar: function (titulo, texto, onAceptar, opciones) {
      var o = opciones || {};
      UI.modal({
        titulo: titulo, texto: texto, onAceptar: onAceptar,
        aceptar: o.aceptar || 'Sí, continuar', peligro: !!o.peligro
      });
    },

    /* ------------------------------------------------------------ descargas */
    descargar: function (nombre, contenido, mime) {
      var tipo = mime || 'text/plain;charset=utf-8';
      var blob = new Blob([contenido], { type: tipo });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = nombre;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        document.body.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
    },

    leerArchivo: function (archivo, comoTexto, cb) {
      var lector = new FileReader();
      lector.onload = function () { cb(lector.result, null); };
      lector.onerror = function () { cb(null, 'No se pudo leer el archivo.'); };
      if (comoTexto) lector.readAsText(archivo, 'utf-8');
      else lector.readAsDataURL(archivo);
    },

    /* --------------------------------------------------------------- escudo */
    /** Escudo institucional: si el docente cargó una imagen propia se usa esa;
        en caso contrario se usa el escudo real del plantel ya integrado. */
    escudoHtml: function (clase) {
      var propio = (App.estado.config.institucion || {}).escudo || raiz.ESCUDO_REAL || '';
      var c = clase || '';
      if (propio) {
        return '<img class="' + c + '" src="' + propio + '" alt="Escudo del Complejo Educativo Zazarabicoa, fundado en 1946">';
      }
      return '<span class="' + c + '">' + raiz.ESCUDO_SVG() + '</span>';
    },

    /* ------------------------------------------------------------ selects */
    llenarSelect: function (id, opciones, valorPreferido) {
      var sel = UI.$(id);
      if (!sel) return;
      var anterior = valorPreferido != null ? String(valorPreferido) : String(sel.value);
      sel.innerHTML = '';
      (opciones || []).forEach(function (o) {
        var opt = document.createElement('option');
        if (o && typeof o === 'object') { opt.value = o.valor; opt.textContent = o.texto; }
        else { opt.value = o; opt.textContent = o; }
        sel.appendChild(opt);
      });
      var existe = (opciones || []).some(function (o) {
        var v = (o && typeof o === 'object') ? String(o.valor) : String(o);
        return v === anterior;
      });
      if (existe) sel.value = anterior;
      else if (sel.options.length) sel.selectedIndex = 0;
    },

    seleccionar: function (id, valor) {
      var sel = UI.$(id);
      if (!sel) return;
      var v = String(valor);
      var hay = Array.prototype.some.call(sel.options, function (o) { return o.value === v; });
      if (hay) sel.value = v;
    },

    /* ------------------------------------------------------------- avisos */
    listaAvisos: function (idContenedor, lista, tipo) {
      var caja = UI.$(idContenedor);
      if (!caja) return;
      caja.innerHTML = '';
      (lista || []).forEach(function (t) {
        var d = document.createElement('div');
        d.className = 'aviso-item' + (tipo ? ' ' + tipo : '');
        d.innerHTML = t;
        caja.appendChild(d);
      });
    },

    nombresFirmas: function () {
      var c = App.estado.config;
      return {
        docente: ZZ.nombreDocente(c),
        docenteCedula: ZZ.limpiar((c.docente.cedulaTipo ? c.docente.cedulaTipo + '-' : '') + (c.docente.cedula || '')),
        docenteArea: c.docente.area || '',
        coordinadores: ZZ.coordinadores(c),
        director: c.institucion.director || '__________________________'
      };
    },

    fechaLarga: function (fecha) {
      var d = fecha ? new Date(fecha) : new Date();
      var meses = ['enero', 'febrero', 'marzo', 'abril', 'mayo', 'junio', 'julio',
        'agosto', 'septiembre', 'octubre', 'noviembre', 'diciembre'];
      return d.getDate() + ' de ' + meses[d.getMonth()] + ' de ' + d.getFullYear();
    },

    fechaHora: function (fecha) {
      var d = fecha ? new Date(fecha) : new Date();
      var p = function (n) { return ('0' + n).slice(-2); };
      return p(d.getDate()) + '/' + p(d.getMonth() + 1) + '/' + d.getFullYear() + ' ' + p(d.getHours()) + ':' + p(d.getMinutes());
    },

    selloArchivo: function () {
      var d = new Date(), p = function (n) { return ('0' + n).slice(-2); };
      return d.getFullYear() + p(d.getMonth() + 1) + p(d.getDate()) + '-' + p(d.getHours()) + p(d.getMinutes());
    }
  };

  raiz.UI = UI;
})(typeof window !== 'undefined' ? window : globalThis);
