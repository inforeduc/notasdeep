/* ============================================================================
   respaldo.js — Módulo 6: guardado permanente, respaldo .json, restauración,
   copias internas y borrado total.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var VISTAS = raiz.VISTAS = raiz.VISTAS || {};

  function estado() { return App.estado; }
  function config() { return App.estado.config; }

  function render() {
    pintarResumen();
    pintarCopias();
    pintarNube();
  }

  function pintarResumen() {
    var caja = UI.$('resumen-datos');
    if (!caja) return;
    var r = App.resumen();
    var c = config();
    var pares = [
      ['Docente de esta sesión', (App.usuario ? App.usuario.nombre : 'sin sesión') +
        (App.usuario && App.usuario.correo ? ' — ' + App.usuario.correo : '')],
      ['Dónde se guardan sus datos', App.modo === 'nube'
        ? 'En internet, en su cuenta de Firebase (separados de los demás docentes)'
        : 'En este equipo, en su propio espacio de usuario del navegador'],
      ['Área de desempeño', c.docente.area || 'sin definir'],
      ['Plantel', (c.institucion.nombre || '') + ' — Año escolar ' + (c.institucion.anioEscolar || '')],
      ['Años que atiende', c.anios.length ? c.anios.map(function (n) { return n + '°'; }).join(', ') : 'sin definir'],
      ['Secciones', c.secciones.length ? c.secciones.join(', ') : 'sin definir'],
      ['Asignaturas', String(r.asignaturas)],
      ['Estudiantes registrados', String(r.estudiantes)],
      ['Planes de evaluación', r.planes + ' lapso(s) con ' + r.actividades + ' actividad(es)'],
      ['Notas registradas', String(r.notas)],
      ['Última modificación', r.modificado ? UI.fechaHora(r.modificado) : '—'],
      ['Almacenamiento del navegador', App.disponible ? 'Disponible' : 'No disponible (¡descargue respaldos!)']
    ];
    caja.innerHTML = pares.map(function (p) {
      return '<div><dt>' + UI.esc(p[0]) + '</dt><dd>' + UI.esc(p[1]) + '</dd></div>';
    }).join('');
  }

  function pintarNube() {
    var caja = UI.$('nube-detalle');
    if (!caja) return;
    var enNube = App.modo === 'nube';
    var configurado = raiz.Nube && raiz.Nube.configurado();
    if (enNube) {
      caja.innerHTML = '<p class="aviso-item ok">☁️ Conectado con Firebase. Sus datos se guardan en internet y solo usted puede verlos: ' +
        'cada docente entra con su propio correo y contraseña.</p>' +
        '<p class="ayuda">Estado: ' + (raiz.Nube.listo() ? 'sesión iniciada' : 'conectando') +
        (raiz.Nube.version ? ' · SDK ' + UI.esc(raiz.Nube.version) : '') + '</p>' +
        '<p class="ayuda">Si trabajó antes en modo local en este equipo, use «Subir todos mis datos a la nube» para no perder nada.</p>';
      var card = UI.$('tarjeta-nube');
      if (card) card.hidden = false;
    } else {
      caja.innerHTML = '<p class="aviso-item">ℹ️ Ahora mismo la aplicación trabaja <b>en modo local</b>: sus datos se guardan en este equipo ' +
        '(cada docente con su propio usuario). Para que se guarden en internet y pueda entrar desde cualquier computadora, ' +
        'siga la guía <b>GUIA-FIREBASE.md</b> y pegue la configuración en <code>js/firebase-config.js</code>.</p>' +
        (configurado ? '' : '<p class="ayuda">Firebase todavía no está configurado.</p>');
      var card2 = UI.$('tarjeta-nube');
      if (card2) card2.hidden = false;
    }
  }

  function pintarCopias() {
    var cuerpo = UI.$('cuerpo-copias');
    if (!cuerpo) return;
    var copias = App.leerCopias();
    if (!copias.length) {
      cuerpo.innerHTML = '<tr><td colspan="5" class="sin-datos">Todavía no hay copias internas. Use «Guardar copia interna» antes de hacer cambios importantes.</td></tr>';
      return;
    }
    cuerpo.innerHTML = copias.map(function (cp, i) {
      var e = cp.estado || {};
      var nEst = (e.estudiantes || []).length;
      var nNotas = 0;
      Object.keys(e.notas || {}).forEach(function (k) {
        Object.keys(e.notas[k]).forEach(function (x) { nNotas += Object.keys(e.notas[k][x]).length; });
      });
      return '<tr>' +
        '<td class="celda-num">' + (i + 1) + '</td>' +
        '<td>' + UI.fechaHora(cp.fecha) + '</td>' +
        '<td>' + UI.esc(cp.descripcion) + '</td>' +
        '<td>' + nEst + ' estudiante(s) · ' + nNotas + ' nota(s)</td>' +
        '<td class="col-acciones">' +
        '<button class="btn-mini" data-copia-accion="restaurar" data-id="' + cp.id + '">Restaurar</button> ' +
        '<button class="btn-mini" data-copia-accion="descargar" data-id="' + cp.id + '">Descargar</button> ' +
        '<button class="btn-mini peligro" data-copia-accion="borrar" data-id="' + cp.id + '">Borrar</button>' +
        '</td></tr>';
    }).join('');
  }

  function contenidoRespaldo(origen) {
    return JSON.stringify({
      aplicacion: 'Evaluación Docente de Zazarabicoa',
      institucion: config().institucion.nombre,
      docente: App.usuario ? App.usuario.nombre : '',
      modo: App.modo,
      version: ZZ.VERSION_DATOS,
      exportado: new Date().toISOString(),
      datos: origen || estado()
    }, null, 2);
  }

  function nombreArchivo(prefijo) {
    var quien = ZZ.limpiar(App.usuario ? App.usuario.nombre : 'docente').replace(/[^\wáéíóúñÁÉÍÓÚÑ ]/g, '').replace(/\s+/g, '-');
    return 'Zazarabicoa-' + prefijo + '-' + quien + '-' + UI.selloArchivo() + '.json';
  }

  function descargarRespaldo() {
    var nombre = nombreArchivo('Respaldo');
    UI.descargar(nombre, contenidoRespaldo(), 'application/json;charset=utf-8');
    App.guardarCopia('Respaldo descargado ' + UI.fechaHora());
    pintarCopias();
    UI.avisoFlotante('Respaldo descargado: ' + nombre);
  }

  function restaurarDesdeTexto(texto) {
    var datos;
    try { datos = JSON.parse(texto); }
    catch (e) { UI.avisoFlotante('El archivo no es un respaldo válido (JSON dañado).', 'error'); return; }
    var contenido = datos && datos.datos ? datos.datos : datos;
    if (!contenido || typeof contenido !== 'object') {
      UI.avisoFlotante('El respaldo no contiene datos reconocibles.', 'error');
      return;
    }
    var copiaPrevia = App.resumen();
    UI.confirmar('Restaurar respaldo',
      'Se reemplazarán los datos actuales (' + copiaPrevia.estudiantes + ' estudiante(s), ' + copiaPrevia.notas + ' nota(s)) ' +
      'por los del respaldo' + (datos && datos.exportado ? ' del ' + UI.fechaHora(datos.exportado) : '') + '.\n' +
      'Se guardará automáticamente una copia de los datos actuales por seguridad.',
      function () {
        App.guardarCopia('Antes de restaurar ' + UI.fechaHora());
        App.reemplazarEstado(contenido);
        App.refrescarSelectores();
        render();
        UI.listaAvisos('avisos-respaldo', [{ texto: 'Respaldo restaurado correctamente. Revise la nómina y las notas.', clase: 'ok' }]);
        UI.avisoFlotante('Respaldo restaurado.');
      }, { aceptar: 'Sí, restaurar', peligro: true });
  }

  function iniciar() {
    var btnDescargar = UI.$('btn-descargar-json');
    if (btnDescargar) btnDescargar.addEventListener('click', descargarRespaldo);

    var btnCopia = UI.$('btn-guardar-copia');
    if (btnCopia) btnCopia.addEventListener('click', function () {
      UI.modal({
        titulo: 'Guardar copia interna',
        texto: 'La copia se guarda en este navegador con la fecha y hora actuales.',
        campo: 'texto', etiqueta: 'Descripción', valor: 'Copia del ' + UI.fechaHora(),
        aceptar: 'Guardar copia',
        onAceptar: function (v) {
          App.guardarCopia(v || ('Copia del ' + UI.fechaHora()));
          pintarCopias();
          UI.avisoFlotante('Copia interna guardada.');
        }
      });
    });

    var archivo = UI.$('archivo-restaurar');
    if (archivo) archivo.addEventListener('change', function () {
      var f = archivo.files && archivo.files[0];
      if (!f) return;
      UI.leerArchivo(f, true, function (texto, err) {
        if (err) { UI.avisoFlotante(err, 'error'); return; }
        restaurarDesdeTexto(texto);
      });
      archivo.value = '';
    });

    var cuerpoCopias = UI.$('cuerpo-copias');
    if (cuerpoCopias) cuerpoCopias.addEventListener('click', function (ev) {
      var btn = ev.target.closest ? ev.target.closest('[data-copia-accion]') : null;
      if (!btn) return;
      var id = btn.getAttribute('data-id');
      var accion = btn.getAttribute('data-copia-accion');
      var copia = App.leerCopias().filter(function (c) { return c.id === id; })[0];
      if (!copia) return;
      if (accion === 'restaurar') {
        UI.confirmar('Restaurar copia interna',
          'Se reemplazarán los datos actuales por la copia del ' + UI.fechaHora(copia.fecha) + ' («' + copia.descripcion + '»).\n' +
          'Se guardará una copia de seguridad de los datos actuales.',
          function () {
            App.guardarCopia('Antes de restaurar copia ' + UI.fechaHora());
            App.restaurarCopia(id);
            App.refrescarSelectores();
            render();
            UI.avisoFlotante('Copia interna restaurada.');
          }, { aceptar: 'Sí, restaurar', peligro: true });
      } else if (accion === 'descargar') {
        UI.descargar('Zazarabicoa-Copia-' + UI.selloArchivo() + '.json', contenidoRespaldo(copia.estado), 'application/json;charset=utf-8');
      } else if (accion === 'borrar') {
        UI.confirmar('Borrar copia interna', '¿Eliminar la copia del ' + UI.fechaHora(copia.fecha) + '?',
          function () { App.borrarCopia(id); pintarCopias(); UI.avisoFlotante('Copia eliminada.'); },
          { aceptar: 'Sí, eliminar', peligro: true });
      }
    });

    var btnExportarTodo = UI.$('btn-exportar-todo');
    if (btnExportarTodo) btnExportarTodo.addEventListener('click', function () {
      if (!VISTAS.sabana) return;
      var hojas = VISTAS.sabana.libroCompleto();
      if (hojas.length < 2) { UI.avisoFlotante('Todavía no hay datos suficientes para exportar el libro completo.', 'error'); return; }
      Export.excel('Zazarabicoa-Libro-Completo-' + UI.selloArchivo() + '.xls', hojas);
      UI.avisoFlotante('Libro completo exportado con ' + hojas.length + ' hojas.');
    });

    /* ------------------------------------------------------------ nube */
    var btnSinc = UI.$('btn-nube-sincronizar');
    if (btnSinc) btnSinc.addEventListener('click', function () {
      if (App.modo !== 'nube') {
        UI.avisoFlotante('La aplicación está en modo local. Configure Firebase para usar la nube (vea GUIA-FIREBASE.md).', 'info');
        return;
      }
      UI.avisoFlotante('Sincronizando con la nube…');
      App.sincronizar().then(function (ok) {
        pintarResumen();
        if (ok) UI.avisoFlotante('Datos sincronizados en la nube.');
        else UI.avisoFlotante('No se pudo sincronizar. Revise su conexión.', 'error');
      });
    });

    var btnSubir = UI.$('btn-nube-subir');
    if (btnSubir) btnSubir.addEventListener('click', function () {
      if (App.modo !== 'nube') {
        UI.avisoFlotante('La aplicación está en modo local. Configure Firebase para usar la nube (vea GUIA-FIREBASE.md).', 'info');
        return;
      }
      UI.confirmar('Subir todos mis datos a la nube',
        'Se enviarán a su cuenta de la nube la configuración, la nómina, los planes de evaluación y todas las notas de este equipo.\n' +
        'Los datos que ya estén en la nube serán reemplazados por los de aquí.',
        function () {
          App.subirTodoANube().then(function () {
            pintarResumen();
            UI.listaAvisos('avisos-respaldo', [{ texto: 'Todos sus datos fueron subidos a la nube.', clase: 'ok' }]);
            UI.avisoFlotante('Datos subidos a la nube.');
          }).catch(function (e) {
            UI.listaAvisos('avisos-respaldo', [{ texto: 'No se pudieron subir los datos: ' + UI.esc(e.message || e), clase: 'error' }]);
          });
        }, { aceptar: 'Sí, subir todo' });
    });

    var btnBorrar = UI.$('btn-borrar-todo');
    if (btnBorrar) btnBorrar.addEventListener('click', function () {
      UI.confirmar('Borrar todos los datos',
        'Se eliminarán TODOS los datos: configuración, nómina, planes de evaluación y notas.\n' +
        'Esta acción no se puede deshacer. ¿Desea continuar?',
        function () {
          UI.confirmar('Confirme otra vez',
            'Última advertencia: se perderán ' + App.resumen().notas + ' nota(s) y ' + App.resumen().estudiantes + ' estudiante(s). ' +
            'Si no ha descargado un respaldo, cancele y descárguelo primero.',
            function () {
              App.guardarCopia('Copia automática antes de borrar todo ' + UI.fechaHora());
              App.borrarTodo();
              App.refrescarSelectores();
              render();
              UI.listaAvisos('avisos-respaldo', [{ texto: 'Todos los datos fueron borrados. Se guardó una copia interna por seguridad.', clase: 'ok' }]);
              UI.avisoFlotante('Datos borrados. Se guardó una copia interna de seguridad.');
            }, { aceptar: 'Sí, borrar todo', peligro: true });
        }, { aceptar: 'Continuar', peligro: true });
    });

    App.alCambiar(function (motivo) {
      if (motivo === 'reemplazado' || motivo === 'restaurado') { pintarResumen(); pintarCopias(); pintarNube(); }
    });
  }

  VISTAS.respaldo = {
    render: render,
    iniciar: iniciar,
    refrescarSelectores: function () { },
    descargarRespaldo: descargarRespaldo,
    contenido: contenidoRespaldo
  };
})(typeof window !== 'undefined' ? window : globalThis);
