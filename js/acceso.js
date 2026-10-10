/* ============================================================================
   acceso.js — Pantalla de acceso y separación de datos por docente.

   Paso 1: clave general de la institución (CONFIG_ACCESO.clave).
   Paso 2: cada docente entra con SU usuario y SU contraseña:

     • Modo nube (Firebase configurado): correo y contraseña reales
       (Firebase Authentication); sus datos viven en Cloud Firestore.
     • Modo local (sin nube): el docente crea su usuario en este equipo; sus
       datos quedan guardados en el navegador, separados de los demás docentes.

   En ambos casos los datos de un docente nunca se mezclan con los de otro.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var autenticado = false;          // ¿ya pasó la clave general?
  var conectandoNube = false;

  function cfg() {
    return raiz.CONFIG_ACCESO || { clave: '', exigirClave: false };
  }

  function $(id) { return document.getElementById(id); }

  /**
   * ¿Se puede usar la nube ahora?
   * Firebase Authentication solo funciona en páginas publicadas (http o https).
   * Si la aplicación se abre con doble clic (file://), se usa el modo local y se
   * avisa al usuario en lugar de mostrar un error confuso.
   */
  function situacionNube() {
    var protocolo = (raiz.location && raiz.location.protocol) || '';
    var configurado = !!(raiz.Nube && raiz.Nube.configurado());
    var esArchivo = protocolo === 'file:';
    return {
      configurado: configurado,
      esArchivo: esArchivo,
      enLinea: configurado && !esArchivo,
      protocolo: protocolo
    };
  }

  var Acceso = {
    iniciar: function () {
      var c = cfg();
      UI.texto('acceso-titulo', UI.esc(c.titulo || 'Evaluación Docente de Zazarabicoa'));
      UI.texto('acceso-subtitulo', UI.esc(c.subtitulo || ''));
      var esc = $('acceso-escudo');
      if (esc) esc.innerHTML = UI.escudoHtml('escudo-acceso');

      var s = situacionNube();
      Acceso.situacion = s;
      Acceso.modo = s.enLinea ? 'nube' : 'local';
      if (s.enLinea) {
        UI.texto('acceso-modo-chip', 'Modo nube (Firebase): sus datos se guardan en internet, separados por docente');
      } else if (s.configurado && s.esArchivo) {
        UI.texto('acceso-modo-chip', 'Modo local: la nube está configurada y se activará cuando la página esté publicada en internet (GitHub Pages).');
      } else {
        UI.texto('acceso-modo-chip', 'Modo local: sus datos se guardan en este equipo, separados por docente');
      }

      boton('btn-acceso-clave', Acceso.probarClave);
      boton('btn-acceso-volver', function () { Acceso.pasoClave(); });
      boton('btn-crear-usuario', Acceso.crearUsuarioLocal);
      boton('btn-nube-entrar', function () { Acceso.nube('entrar'); });
      boton('btn-nube-crear', function () { Acceso.nube('crear'); });

      var clave = $('acceso-clave');
      if (clave) clave.addEventListener('keydown', function (ev) {
        if (ev.key === 'Enter') { ev.preventDefault(); Acceso.probarClave(); }
      });
      ['acceso-nueva-clave', 'acceso-nueva-clave2', 'acceso-nombre'].forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); Acceso.crearUsuarioLocal(); }
        });
      });
      ['acceso-correo-clave'].forEach(function (id) {
        var el = $(id);
        if (el) el.addEventListener('keydown', function (ev) {
          if (ev.key === 'Enter') { ev.preventDefault(); Acceso.nube('entrar'); }
        });
      });

      Acceso.mostrar();
      if (!c.exigirClave || !c.clave) {
        autenticado = true;
        Acceso.pasoUsuarios();
      }
    },

    mostrar: function () {
      var p = $('pantalla-acceso');
      if (p) p.hidden = false;
      var c = $('acceso-clave');
      if (c) c.value = '';
      UI.mostrar('acceso-clave-error', false);
    },

    ocultar: function () {
      var p = $('pantalla-acceso');
      if (p) p.hidden = true;
    },

    /* ----------------------------------------------------- paso 1: la clave */
    probarClave: function () {
      var c = cfg();
      var escrita = UI.valor('acceso-clave');
      if (!escrita) { errorClave('Escriba la clave de acceso.'); return; }
      if (!c.exigirClave || !c.clave) { autenticado = true; Acceso.pasoUsuarios(); return; }
      if (escrita === c.clave) {
        autenticado = true;
        UI.mostrar('acceso-clave-error', false);
        Acceso.pasoUsuarios();
      } else {
        errorClave('Clave incorrecta. Verifíquela con la coordinación de evaluación.');
      }
    },

    pasoClave: function () {
      autenticado = false;
      UI.mostrar('acceso-paso-usuario', false);
      UI.mostrar('acceso-paso-clave', true);
      var c = $('acceso-clave');
      if (c) c.value = '';
    },

    /* ------------------------------------------------ paso 2: los docentes */
    pasoUsuarios: function () {
      UI.mostrar('acceso-paso-clave', false);
      UI.mostrar('acceso-paso-usuario', true);
      UI.listaAvisos('acceso-avisos', []);
      var enNube = Acceso.modo === 'nube';
      UI.mostrar('acceso-nube', enNube);
      UI.mostrar('acceso-local', !enNube);
      UI.texto('acceso-modo-texto', enNube
        ? 'Entre con su correo y su contraseña. Si es la primera vez, pulse «Crear cuenta»: sus datos quedarán guardados en internet, separados de los demás docentes.'
        : 'Elija su nombre para entrar con su contraseña, o cree su usuario. Cada docente tiene sus propios datos en este equipo.');

      if (enNube) {
        conectarNube();
        var actual = raiz.Nube.auth.actual && raiz.Nube.auth.actual();
        if (actual) {
          aviso('Se encontró una sesión abierta de ' + actual.correo + '. Entrando…', 'ok');
          Acceso.entrarComo(actual, 'nube');
        }
      } else {
        pintarUsuariosLocales();
      }
    },

    /* -------------------------------------------------------- modo local */
    crearUsuarioLocal: function () {
      var nombre = UI.valor('acceso-nombre');
      var c1 = UI.valor('acceso-nueva-clave');
      var c2 = UI.valor('acceso-nueva-clave2');
      if (!nombre) { aviso('Escriba su nombre y apellido.', 'error'); return; }
      if (!c1 || c1.length < 4) { aviso('La contraseña debe tener al menos 4 caracteres.', 'error'); return; }
      if (c1 !== c2) { aviso('Las dos contraseñas no coinciden.', 'error'); return; }
      var usuario;
      try {
        usuario = App.crearUsuarioLocal(nombre, c1, '');
      } catch (e) {
        aviso(e.message, 'error');
        return;
      }
      UI.ponerValor('acceso-nombre', '');
      UI.ponerValor('acceso-nueva-clave', '');
      UI.ponerValor('acceso-nueva-clave2', '');
      aviso('Usuario creado. Bienvenido(a), ' + usuario.nombre + '.', 'ok');
      Acceso.entrarComo(usuario, 'local');
    },

    /* --------------------------------------------------------- modo nube */
    nube: function (accion) {
      if (!raiz.Nube || !raiz.Nube.listo()) {
        aviso('Todavía no hay conexión con la nube. ' + (raiz.Nube ? raiz.Nube.error : ''), 'error');
        conectarNube(true);
        return;
      }
      var correo = UI.valor('acceso-correo');
      var clave = UI.valor('acceso-correo-clave');
      if (!correo || correo.indexOf('@') < 0) { aviso('Escriba un correo electrónico válido.', 'error'); return; }
      if (!clave || clave.length < 6) { aviso('La contraseña debe tener al menos 6 caracteres.', 'error'); return; }
      aviso(accion === 'crear' ? 'Creando su cuenta…' : 'Ingresando…', 'ok');
      var tarea = accion === 'crear'
        ? raiz.Nube.auth.registrar(correo, clave)
        : raiz.Nube.auth.entrar(correo, clave);
      tarea.then(function (usuario) {
        UI.ponerValor('acceso-correo-clave', '');
        aviso('Bienvenido(a), ' + (usuario.correo || usuario.nombre) + '.', 'ok');
        Acceso.entrarComo(usuario, 'nube');
      }).catch(function (e) {
        aviso(raiz.Nube.auth.traducirError(e), 'error');
      });
    },

    /* -------------------------------------------------------------- entrar */
    entrarComo: function (usuario, modo) {
      Acceso.ocultar();
      App.entrarCon(usuario, modo).then(function () {
        if (raiz.App.iniciarSesion) raiz.App.iniciarSesion();
      }).catch(function (e) {
        Acceso.mostrar();
        UI.mostrar('acceso-paso-usuario', true);
        UI.mostrar('acceso-paso-clave', false);
        aviso('No se pudieron cargar sus datos: ' + (e && e.message ? e.message : e), 'error');
        if (raiz.Nube && raiz.Nube.auth && raiz.Nube.auth.traducirError) {
          aviso(raiz.Nube.auth.traducirError(e), 'error');
        }
      });
    },

    salir: function () {
      App.salir();
      autenticado = false;
      Acceso.pasoClave();
      Acceso.mostrar();
      if (raiz.App.limpiarVistas) raiz.App.limpiarVistas();
    }
  };

  /* ------------------------------------------------------------- auxiliares */

  function boton(id, fn) {
    var el = $(id);
    if (el) el.addEventListener('click', fn);
  }

  function errorClave(texto) {
    var caja = $('acceso-clave-error');
    if (caja) { caja.hidden = false; caja.textContent = texto; }
  }

  function aviso(texto, tipo) {
    var caja = $('acceso-avisos');
    if (!caja) return;
    var d = document.createElement('div');
    d.className = 'aviso-item' + (tipo ? ' ' + tipo : '');
    d.textContent = texto;
    caja.appendChild(d);
    caja.scrollTop = caja.scrollHeight;
  }

  function pintarUsuariosLocales() {
    var caja = $('acceso-usuarios-lista');
    if (!caja) return;
    var lista = App.usuarios();
    var recordado = App.sesionRecordada();
    if (!lista.length) {
      caja.innerHTML = '<p class="ayuda">Todavía no hay docentes registrados en este equipo. Cree el primero aquí abajo.</p>';
      return;
    }
    caja.innerHTML = lista.map(function (u) {
      return '<div class="usuario-fila' + (u.id === recordado ? ' recordado' : '') + '">' +
        '<div class="usuario-datos"><b>' + UI.esc(u.nombre) + '</b>' +
        '<span>' + (u.correo ? UI.esc(u.correo) + ' · ' : '') + 'desde ' + UI.fechaHora(u.creado) + '</span></div>' +
        '<button class="btn btn-primario btn-mini" data-entrar="' + u.id + '">Entrar</button>' +
        '<button class="btn-icono" data-borrar="' + u.id + '" title="Eliminar este usuario y sus datos">🗑️</button>' +
        '</div>';
    }).join('');

    UI.$$('[data-entrar]', caja).forEach(function (b) {
      b.addEventListener('click', function () { pedirClaveUsuario(b.getAttribute('data-entrar')); });
    });
    UI.$$('[data-borrar]', caja).forEach(function (b) {
      b.addEventListener('click', function () {
        var id = b.getAttribute('data-borrar');
        var u = App.usuarios().filter(function (x) { return x.id === id; })[0];
        UI.confirmar('Eliminar usuario',
          'Se borrarán el usuario «' + UI.esc(u ? u.nombre : '') + '» y TODOS sus datos (nóminas, planes y notas) guardados en este equipo.\n' +
          'Si no ha descargado un respaldo, cancele y descárguelo primero.',
          function () {
            App.borrarUsuarioLocal(id);
            pintarUsuariosLocales();
            aviso('Usuario eliminado.', 'ok');
          }, { aceptar: 'Sí, eliminar', peligro: true });
      });
    });
  }

  function pedirClaveUsuario(id) {
    var u = App.usuarios().filter(function (x) { return x.id === id; })[0];
    if (!u) return;
    UI.modal({
      titulo: 'Entrar como ' + u.nombre,
      texto: 'Escriba su contraseña para abrir sus datos.',
      campo: 'clave', etiqueta: 'Contraseña', aceptar: 'Entrar',
      onAceptar: function (clave) {
        if (App.verificarClaveLocal(id, clave)) {
          accionEntrar(u);
        } else {
          errorClave('Contraseña incorrecta.');
          UI.modal({
            titulo: 'Contraseña incorrecta',
            texto: 'La contraseña de «' + UI.esc(u.nombre) + '» no es correcta. Intente otra vez.',
            aceptar: 'Reintentar',
            onAceptar: function () { pedirClaveUsuario(id); }
          });
        }
      }
    });
  }

  function accionEntrar(u) {
    UI.mostrar('acceso-clave-error', false);
    Acceso.entrarComo({ id: u.id, nombre: u.nombre, correo: u.correo, modo: 'local' }, 'local');
  }

  /* Conexión con Firebase (sólo en modo nube). */
  function conectarNube(forzar) {
    if (!raiz.Nube || !raiz.Nube.configurado() || raiz.Nube.listo()) return;
    if (conectandoNube && !forzar) return;
    conectandoNube = true;
    aviso('Conectando con la nube de Google…', 'ok');
    var tarea;
    try {
      tarea = raiz.Nube.conectar();
    } catch (e) {
      conectandoNube = false;
      aviso('No se pudo conectar con la nube: ' + (e && e.message ? e.message : e), 'error');
      aviso('Puede seguir trabajando en modo local o revisar GUIA-FIREBASE.md.', '');
      return;
    }
    Promise.resolve(tarea).then(function () {
      conectandoNube = false;
      aviso('Conectado con la nube (SDK ' + raiz.Nube.version + ').', 'ok');
    }).catch(function (e) {
      conectandoNube = false;
      aviso('No se pudo conectar con la nube: ' + (e && e.message ? e.message : e), 'error');
      aviso('Puede seguir trabajando en modo local o revisar GUIA-FIREBASE.md.', '');
    });
  }

  raiz.Acceso = Acceso;
  if (typeof module === 'object' && module.exports) module.exports = Acceso;
})(typeof window !== 'undefined' ? window : globalThis);
