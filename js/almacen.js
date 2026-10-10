/* ============================================================================
   almacen.js — Estado de la aplicación, guardado permanente y separación por
   docente.

   • Cada docente que crea su usuario tiene SU propio espacio de datos: no se
     mezclan configuraciones, nóminas, planes ni notas entre docentes.
   • En MODO LOCAL los datos viven en el navegador (localStorage), bajo una
     clave distinta por usuario.
   • En MODO NUBE (Firebase configurado) los datos viven en Cloud Firestore,
     también separados por usuario, y se sincronizan automáticamente.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var CLAVE_USUARIOS = 'zazarabicoa_usuarios_v1';
  var CLAVE_SESION = 'zazarabicoa_sesion_v1';
  var CLAVE_DATOS = 'zazarabicoa_datos_v1';
  var CLAVE_COPIAS = 'zazarabicoa_copias_v1';
  var MAX_COPIAS = 12;

  var memoria = {};
  var disponible = true;
  var oyentes = [];
  var temporizador = null;
  var temporizadorNube = null;

  function probarAlmacen() {
    try {
      var k = '__zazarabicoa_prueba__';
      raiz.localStorage.setItem(k, '1');
      raiz.localStorage.removeItem(k);
      return true;
    } catch (e) { return false; }
  }

  function leerCrudo(clave) {
    try {
      return disponible ? raiz.localStorage.getItem(clave) : memoria[clave];
    } catch (e) { return null; }
  }

  function escribirCrudo(clave, texto) {
    try {
      if (disponible) raiz.localStorage.setItem(clave, texto);
      else memoria[clave] = texto;
      return true;
    } catch (e) { return false; }
  }

  var App = {
    estado: null,
    usuario: null,          // { id, nombre, correo, modo }
    modo: 'local',          // 'local' | 'nube'
    disponible: true,
    _snapshot: null,        // copia de control para saber qué cambió en la nube
    _sincronizando: false,

    /* ------------------------------------------------------------ arranque */
    iniciar: function () {
      disponible = probarAlmacen();
      App.disponible = disponible;
      App.estado = ZZ.estadoInicial();
      return true;
    },

    enNube: function () { return App.modo === 'nube' && raiz.Nube && raiz.Nube.listo(); },

    claveDatos: function (id) { return CLAVE_DATOS + '::' + (id || (App.usuario && App.usuario.id) || 'invitado'); },
    claveCopias: function (id) { return CLAVE_COPIAS + '::' + (id || (App.usuario && App.usuario.id) || 'invitado'); },

    /* ══════════════════════════ usuarios del equipo ══════════════════════ */

    usuarios: function () {
      var crudo = leerCrudo(CLAVE_USUARIOS);
      if (!crudo) return [];
      try {
        var l = JSON.parse(crudo);
        return Array.isArray(l) ? l : [];
      } catch (e) { return []; }
    },

    guardarUsuarios: function (lista) {
      escribirCrudo(CLAVE_USUARIOS, JSON.stringify(lista || []));
      return lista || [];
    },

    /** Crea un usuario local (modo sin nube). Devuelve el usuario creado. */
    crearUsuarioLocal: function (nombre, clave, correo) {
      var limpio = ZZ.limpiar(nombre);
      if (!limpio) throw new Error('Escriba el nombre del docente.');
      if (!clave || String(clave).length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
      var lista = App.usuarios();
      if (lista.some(function (u) { return u.nombre.toLowerCase() === limpio.toLowerCase(); })) {
        throw new Error('Ya existe un docente con ese nombre en este equipo.');
      }
      var sal = ZZ.salAleatoria();
      var u = {
        id: ZZ.nuevoId('usr'),
        nombre: limpio,
        correo: ZZ.limpiar(correo || ''),
        sal: sal,
        hash: ZZ.hashClave(clave, sal),
        creado: new Date().toISOString(),
        modo: 'local'
      };
      lista.push(u);
      App.guardarUsuarios(lista);
      var vacio = ZZ.estadoInicial();
      vacio.config.docente.nombres = limpio.split(' ')[0] || limpio;
      vacio.config.docente.apellidos = limpio.split(' ').slice(1).join(' ');
      vacio.config.docente.correo = u.correo;
      escribirCrudo(App.claveDatos(u.id), JSON.stringify(vacio));
      return u;
    },

    verificarClaveLocal: function (id, clave) {
      var u = App.usuarios().filter(function (x) { return x.id === id; })[0];
      if (!u) return false;
      return ZZ.hashClave(clave, u.sal) === u.hash;
    },

    cambiarClaveLocal: function (id, nueva) {
      var lista = App.usuarios();
      var u = lista.filter(function (x) { return x.id === id; })[0];
      if (!u) throw new Error('Usuario no encontrado.');
      if (!nueva || String(nueva).length < 4) throw new Error('La contraseña debe tener al menos 4 caracteres.');
      u.sal = ZZ.salAleatoria();
      u.hash = ZZ.hashClave(nueva, u.sal);
      App.guardarUsuarios(lista);
      return u;
    },

    borrarUsuarioLocal: function (id) {
      var lista = App.usuarios().filter(function (x) { return x.id !== id; });
      App.guardarUsuarios(lista);
      try {
        if (disponible) {
          raiz.localStorage.removeItem(App.claveDatos(id));
          raiz.localStorage.removeItem(App.claveCopias(id));
        }
      } catch (e) { /* sin importancia */ }
      return lista;
    },

    guardarSesion: function (id) { escribirCrudo(CLAVE_SESION, id || ''); },
    sesionRecordada: function () { return leerCrudo(CLAVE_SESION) || ''; },

    /* ═════════════════════════ entrada y salida ═══════════════════════════ */

    /**
     * Inicia la sesión de un docente y carga sus datos.
     * usuario: { id, nombre, correo }   modo: 'local' | 'nube'
     * Devuelve una promesa con el estado cargado.
     */
    entrarCon: function (usuario, modo) {
      App.usuario = usuario;
      App.modo = modo || 'local';
      App.guardarSesion(usuario.id);
      App.ponerChip('ok');
      var cargar = Promise.resolve();
      if (App.enNube()) {
        App.ponerChipNube('cargando');
        cargar = raiz.Nube.cargar(usuario).then(function (estado) {
          App.estado = estado;
          App._snapshot = ZZ.copiaProfunda(estado);
          App.ponerChipNube('ok');
        }).catch(function (e) {
          App.ponerChipNube('error', e.message);
          throw e;
        });
      } else {
        App.estado = App.leerEstadoLocal(usuario.id);
        App._snapshot = ZZ.copiaProfunda(App.estado);
      }
      return cargar.then(function () {
        App.notificar('reemplazado');
        return App.estado;
      });
    },

    salir: function () {
      App.guardar(true);
      if (App.enNube() && raiz.Nube) raiz.Nube.auth.salir();
      App.usuario = null;
      App.modo = 'local';
      App.estado = ZZ.estadoInicial();
      App._snapshot = null;
      App.ponerChipNube('oculto');
    },

    leerEstadoLocal: function (id) {
      var crudo = leerCrudo(App.claveDatos(id));
      if (!crudo) return ZZ.estadoInicial();
      try {
        return ZZ.normalizarEstado(JSON.parse(crudo));
      } catch (e) {
        App.aviso('El guardado anterior estaba dañado y no se pudo leer. Se inició un registro nuevo.');
        return ZZ.estadoInicial();
      }
    },

    /* ------------------------------------------------------------ guardado */
    marcarModificado: function () { if (App.estado) App.estado.modificado = new Date().toISOString(); },

    guardar: function (inmediato) {
      App.marcarModificado();
      App.ponerChip('guardando');
      if (temporizador) { clearTimeout(temporizador); temporizador = null; }
      if (inmediato) { App.escribir(); return; }
      temporizador = setTimeout(function () { temporizador = null; App.escribir(); }, 400);
    },

    escribir: function () {
      if (!App.usuario) return;
      var texto;
      try { texto = JSON.stringify(App.estado); }
      catch (e) { App.aviso('No se pudo preparar el guardado: ' + e.message); return; }

      if (App.modo === 'local') {
        if (!escribirCrudo(App.claveDatos(), texto)) {
          App.aviso('No se pudo guardar en el navegador (espacio insuficiente). Descargue un respaldo .json.');
        }
        App.ponerChip('ok');
      } else {
        App.ponerChip('ok');
        App.programarSincronizacion();
      }
    },

    /** Envía a la nube (con retraso) sólo lo que cambió. */
    programarSincronizacion: function () {
      if (!App.enNube()) return;
      if (temporizadorNube) clearTimeout(temporizadorNube);
      temporizadorNube = setTimeout(function () { temporizadorNube = null; App.sincronizar(); }, 1200);
    },

    sincronizar: function () {
      if (!App.enNube() || !App.usuario) return Promise.resolve(false);
      if (App._sincronizando) { App.programarSincronizacion(); return Promise.resolve(false); }
      App._sincronizando = true;
      App.ponerChipNube('guardando');
      return raiz.Nube.guardarDiferencias(App.usuario, App.estado, App._snapshot)
        .then(function (nuevo) {
          App._snapshot = nuevo;
          App._sincronizando = false;
          App.ponerChipNube('ok');
          return true;
        })
        .catch(function (e) {
          App._sincronizando = false;
          App.ponerChipNube('error', e.message);
          return false;
        });
    },

    /** Sube todo el estado actual a la nube (por ejemplo, datos locales previos). */
    subirTodoANube: function () {
      if (!App.enNube() || !App.usuario) return Promise.reject(new Error('La nube no está conectada.'));
      App.ponerChipNube('guardando');
      return raiz.Nube.subir(App.usuario, App.estado).then(function (nuevo) {
        App._snapshot = nuevo;
        App.ponerChipNube('ok');
        return true;
      }).catch(function (e) {
        App.ponerChipNube('error', e.message);
        throw e;
      });
    },

    /* ------------------------------------------------------------- chips */
    ponerChip: function (modo) {
      var chip = document.getElementById('chip-guardado');
      if (!chip) return;
      if (modo === 'guardando') {
        chip.classList.add('guardando');
        chip.innerHTML = '<span class="punto-verde"></span> Guardando…';
        return;
      }
      chip.classList.remove('guardando');
      var h = new Date();
      var hora = ('0' + h.getHours()).slice(-2) + ':' + ('0' + h.getMinutes()).slice(-2);
      var nombre = App.usuario ? UI.esc(App.usuario.nombre) : '';
      if (!disponible && App.modo === 'local') {
        chip.innerHTML = '<span class="punto-verde"></span> Guardado sólo en memoria · descargue un respaldo';
      } else if (App.modo === 'nube') {
        chip.innerHTML = '<span class="punto-verde"></span> ' + nombre + ' · datos en la nube';
      } else {
        chip.innerHTML = '<span class="punto-verde"></span> ' + nombre + ' · guardado ' + hora;
      }
    },

    ponerChipNube: function (estado, detalle) {
      var chip = document.getElementById('chip-nube');
      if (!chip) return;
      if (estado === 'oculto') { chip.hidden = true; return; }
      chip.hidden = false;
      chip.classList.remove('error', 'guardando');
      if (estado === 'guardando') {
        chip.classList.add('guardando');
        chip.innerHTML = '☁️ Guardando en la nube…';
      } else if (estado === 'cargando') {
        chip.classList.add('guardando');
        chip.innerHTML = '☁️ Cargando sus datos…';
      } else if (estado === 'error') {
        chip.classList.add('error');
        chip.innerHTML = '☁️ Sin conexión con la nube' + (detalle ? ' · ' + UI.esc(detalle) : '');
      } else {
        var h = new Date();
        chip.innerHTML = '☁️ Sincronizado ' + ('0' + h.getHours()).slice(-2) + ':' + ('0' + h.getMinutes()).slice(-2);
      }
    },

    /* ----------------------------------------------- cambios y notificación */
    /** opciones: { inmediato: bool, redibujar: bool } */
    cambio: function (motivo, opciones) {
      var op = opciones || {};
      App.guardar(op.inmediato !== false);
      App.notificar(motivo || 'cambio', op);
    },

    notificar: function (motivo, opciones) {
      oyentes.forEach(function (fn) {
        try { fn(motivo, opciones || {}); } catch (e) { console.error(e); }
      });
    },

    alCambiar: function (fn) { oyentes.push(fn); },

    aviso: function (texto, tipo) {
      if (raiz.UI && UI.avisoFlotante) UI.avisoFlotante(texto, tipo);
      else console.log(texto);
    },

    /* ------------------------------------------------- copias internas */
    leerCopias: function () {
      var crudo = leerCrudo(App.claveCopias());
      if (!crudo) return [];
      try {
        var l = JSON.parse(crudo);
        return Array.isArray(l) ? l : [];
      } catch (e) { return []; }
    },

    escribirCopias: function (lista) {
      var texto = JSON.stringify(lista.slice(0, MAX_COPIAS));
      if (!escribirCrudo(App.claveCopias(), texto)) {
        App.aviso('No hay espacio para otra copia interna. Elimine copias antiguas.');
      }
    },

    guardarCopia: function (descripcion) {
      var lista = App.leerCopias();
      var d = new Date();
      lista.unshift({
        id: ZZ.nuevoId('copia'),
        fecha: d.toISOString(),
        descripcion: descripcion || 'Copia manual',
        estado: ZZ.copiaProfunda(App.estado)
      });
      App.escribirCopias(lista.slice(0, MAX_COPIAS));
      return lista;
    },

    restaurarCopia: function (id) {
      var lista = App.leerCopias();
      for (var i = 0; i < lista.length; i++) {
        if (lista[i].id === id) {
          App.estado = ZZ.normalizarEstado(lista[i].estado);
          App.escribir();
          App.notificar('restaurado');
          return true;
        }
      }
      return false;
    },

    borrarCopia: function (id) {
      var lista = App.leerCopias().filter(function (c) { return c.id !== id; });
      App.escribirCopias(lista);
      return lista;
    },

    reemplazarEstado: function (nuevo) {
      App.estado = ZZ.normalizarEstado(nuevo);
      App.escribir();
      App.notificar('reemplazado');
    },

    borrarTodo: function () {
      if (App.modo === 'local') {
        try {
          if (disponible && App.usuario) raiz.localStorage.removeItem(App.claveDatos());
          if (temporizador) { clearTimeout(temporizador); temporizador = null; }
        } catch (e) { /* sin importancia */ }
        memoria[App.claveDatos()] = null;
      }
      App.estado = ZZ.estadoInicial();
      App._snapshot = ZZ.estadoInicial();
      App.escribir();
      if (App.enNube()) App.sincronizar();
      App.notificar('reemplazado');
    },

    /* ------------------------------------------------------------ utilidad */
    /** Recuerda el año, sección, asignatura y lapso con los que se trabaja. */
    recordarContexto: function (sel) {
      var c = App.estado.ultimoContexto = App.estado.ultimoContexto || {};
      ['anio', 'seccion', 'asignatura', 'lapso'].forEach(function (k) {
        if (sel && sel[k] !== undefined && sel[k] !== null && String(sel[k]) !== '') c[k] = String(sel[k]);
      });
      App.marcarModificado();
      App.guardar(false);
    },

    /** Aplica el contexto recordado a los selectores indicados. */
    aplicarContexto: function (ids) {
      var c = App.estado.ultimoContexto || {};
      Object.keys(ids || {}).forEach(function (k) {
        if (c[k]) UI.seleccionar(ids[k], c[k]);
      });
    },

    resumen: function () {
      var e = App.estado;
      var notas = 0, planes = 0, acts = 0;
      Object.keys(e.planes).forEach(function (k) {
        var a = e.planes[k].actividades || [];
        if (a.length) { planes += 1; acts += a.length; }
      });
      Object.keys(e.notas).forEach(function (k) {
        var m = e.notas[k];
        Object.keys(m).forEach(function (est) { notas += Object.keys(m[est]).length; });
      });
      var lapso = null, materia = null;
      var uc = e.ultimoContexto || {};
      if (uc.lapso) lapso = uc.lapso;
      if (uc.asignatura) materia = ZZ.nombreAsignatura(e, uc.asignatura);
      return {
        docente: App.usuario ? App.usuario.nombre : '',
        modo: App.modo,
        anios: e.config.anios.length,
        secciones: e.config.secciones.length,
        asignaturas: e.config.asignaturas.length,
        estudiantes: e.estudiantes.length,
        planes: planes,
        actividades: acts,
        notas: notas,
        lapso: lapso,
        materia: materia,
        modificado: e.modificado
      };
    }
  };

  raiz.App = App;
  if (typeof module === 'object' && module.exports) module.exports = App;
})(typeof window !== 'undefined' ? window : globalThis);
