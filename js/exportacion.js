/* ============================================================================
   exportacion.js — Documentos oficiales para PDF/impresión y exportación a
   Excel (.xls nativo, con varias hojas, colores y estadísticas).
   ========================================================================== */
(function (raiz) {
  'use strict';

  var COLORES = {
    aprobado: 'background:#D8F2E0;color:#0A5C2E;font-weight:bold;',
    reprobado: 'background:#FDE8E6;color:#B3261E;font-weight:bold;',
    revision: 'background:#FFF2DC;color:#A86200;font-weight:bold;',
    encabezado: 'background:#0F6B3D;color:#FFFFFF;font-weight:bold;',
    subtotal: 'background:#E8F3EC;color:#0B4D2C;font-weight:bold;',
    titulo: 'background:#0B4D2C;color:#F3D34A;font-weight:bold;font-size:14px;',
    etiqueta: 'background:#F4F7F5;color:#0B4D2C;font-weight:bold;',
    sin: 'color:#9AA8A0;font-style:italic;'
  };

  var Export = {

    /* ══════════════════════════════ DOCUMENTOS PDF ═════════════════════════ */

    membrete: function () {
      var i = App.estado.config.institucion;
      var esc = UI.escudoHtml('escudo-img');
      return '' +
        '<div class="membrete">' +
        '<div class="escudo-doc">' + esc + '</div>' +
        '<div class="membrete-texto">' +
        '<p class="linea-fuerte">REPÚBLICA BOLIVARIANA DE VENEZUELA</p>' +
        '<p class="linea-fuerte">MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN</p>' +
        '<p class="linea-plantel">' + UI.esc(i.nombre || 'COMPLEJO EDUCATIVO "ZAZARABICOA"') + '</p>' +
        '<p class="linea-datos">Fundado en ' + UI.esc(i.fundado || '1946') +
        (i.codigoDEA ? ' &middot; Código DEA: ' + UI.esc(i.codigoDEA) : '') +
        (i.circuito ? ' &middot; Circuito Escolar: ' + UI.esc(i.circuito) : '') + '</p>' +
        '<p class="linea-datos">' +
        (i.municipio ? 'Municipio ' + UI.esc(i.municipio) + ' ' : '') +
        (i.estado ? '&middot; Estado ' + UI.esc(i.estado) + ' ' : '') +
        '&middot; Año Escolar ' + UI.esc(i.anioEscolar || '') + '</p>' +
        '</div>' +
        '<div class="escudo-doc escudo-doc-der"></div>' +
        '</div>';
    },

    ficha: function (pares) {
      var filas = (pares || []).filter(Boolean).map(function (p) {
        return '<div><b>' + UI.esc(p[0]) + ':</b> ' + UI.esc(p[1] || '') + '</div>';
      });
      return '<div class="doc-ficha">' + filas.join('') + '</div>';
    },

    firmas: function () {
      var n = UI.nombresFirmas();
      var coordinadoras = ZZ.coordinadores(App.estado.config)
        .map(function (c) { return UI.esc(c); })
        .join('<br>');
      return '' +
        '<div class="doc-firmas">' +
        '<div class="firma"><div class="linea-firma"></div>' +
        '<div class="cargo">Docente de la asignatura</div>' +
        '<div class="nombre">' + UI.esc(n.docente) + '</div>' +
        '<div class="cedula">C.I. ' + UI.esc(n.docenteCedula || '________') + '</div></div>' +
        '<div class="firma"><div class="linea-firma"></div>' +
        '<div class="cargo">Coordinador(a) de Evaluación<br>y Control de Estudios</div>' +
        '<div class="nombre">' + (coordinadoras || '__________________________') + '</div></div>' +
        '<div class="firma"><div class="linea-firma"></div>' +
        '<div class="cargo">Director(a) del Plantel</div>' +
        '<div class="nombre">' + UI.esc(n.director) + '</div></div>' +
        '</div>';
    },

    /** Imprime un conjunto de documentos oficiales (cada uno en página propia). */
    imprimir: function (docs) {
      var area = UI.$('area-impresion');
      if (!area) return;
      var lista = Array.isArray(docs) ? docs : [docs];
      area.innerHTML = lista.join('');
      var tituloOriginal = document.title;
      document.title = 'Evaluación Zazarabicoa — ' + UI.selloArchivo();
      var restaurar = function () { document.title = tituloOriginal; };
      raiz.addEventListener('afterprint', restaurar, { once: true });
      setTimeout(function () {
        raiz.print();
        setTimeout(restaurar, 1500);
      }, 60);
    },

    /* ══════════════════════════════ EXCEL (.xlsx) ═════════════════════════ */

    /**
     * hojas: [{ nombre, titulo, subtitulos:[], columnas:[], anchos:[],
     *           filas:[[celda,...]], pie:[], nota:'' }]
     * celda: valor simple u objeto { v, c, colspan }
     *
     * Se genera un libro .xlsx nativo (OOXML) con xlsx.js. Si por alguna razón
     * no estuviera disponible, se recurre al formato .xls de compatibilidad.
     */
    excel: function (nombreArchivo, hojas) {
      if (raiz.XLSX && typeof raiz.XLSX.descargar === 'function') {
        raiz.XLSX.descargar(nombreArchivo, hojas);
        return;
      }
      Export.excelLegado(nombreArchivo, hojas);
    },

    /** Libro .xls de compatibilidad (tabla HTML interpretada por Excel). */
    excelLegado: function (nombreArchivo, hojas) {
      var contenido = Export.libroHtml(hojas);
      var nombre = String(nombreArchivo || 'libro.xls').replace(/\.xlsx$/i, '.xls');
      UI.descargar(nombre, '\ufeff' + contenido, 'application/vnd.ms-excel;charset=utf-8');
    },

    nombreHoja: function (nombre, indice) {
      var n = String(nombre || ('Hoja' + (indice + 1))).replace(/[\\\/\?\*\[\]:]/g, '-').slice(0, 31).trim();
      return n || ('Hoja' + (indice + 1));
    },

    celdaHtml: function (celda, totalColumnas) {
      var c = (celda && typeof celda === 'object') ? celda : { v: celda };
      var estilo = '';
      if (typeof c.c === 'string' && COLORES[c.c]) estilo += COLORES[c.c];
      if (c.estilo) estilo += c.estilo;
      if (c.centro || typeof c.v === 'number') estilo += 'text-align:center;';
      if (c.v === null || c.v === undefined || c.v === '') {
        return '<td style="' + estilo + 'mso-number-format:\'\\@\';">&nbsp;</td>';
      }
      var colspan = c.colspan && c.colspan > 1 ? ' colspan="' + c.colspan + '"' : '';
      if (typeof c.v === 'number' && isFinite(c.v)) {
        var txt = String(Math.round(c.v * 100) / 100).replace('.', ',');
        return '<td style="' + estilo + '" x:num="' + c.v + '"' + colspan + '>' + txt + '</td>';
      }
      return '<td style="' + estilo + 'mso-number-format:\'\\@\';vertical-align:top;"' + colspan + '>' +
        UI.esc(c.v).replace(/\n/g, '<br>') + '</td>';
    },

    hojaHtml: function (hoja, indice) {
      var columnas = hoja.columnas || [];
      var n = columnas.length || 1;
      var filas = [];
      filas.push('<tr><td colspan="' + n + '" style="' + COLORES.titulo + 'height:26px;vertical-align:middle;">' +
        UI.esc(hoja.titulo || 'REPÚBLICA BOLIVARIANA DE VENEZUELA — MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN') + '</td></tr>');
      (hoja.subtitulos || []).forEach(function (s) {
        filas.push('<tr><td colspan="' + n + '" style="background:#E8F3EC;color:#0B4D2C;font-weight:bold;text-align:center;">' + UI.esc(s) + '</td></tr>');
      });
      filas.push('<tr>' + (columnas.length
        ? columnas.map(function (col, j) {
          var ancho = (hoja.anchos && hoja.anchos[j]) ? 'width:' + hoja.anchos[j] + 'px;' : '';
          return '<th style="' + COLORES.encabezado + ancho + 'text-align:center;border:1px solid #0B4D2C;">' + UI.esc(col) + '</th>';
        }).join('')
        : '<th style="' + COLORES.encabezado + '">&nbsp;</th>') + '</tr>');

      (hoja.filas || []).forEach(function (fila) {
        var celdas = (fila || []).map(function (c) { return Export.celdaHtml(c, n); });
        var ocupadas = (fila || []).reduce(function (a, c) {
          return a + ((c && typeof c === 'object' && c.colspan) ? c.colspan : 1);
        }, 0);
        while (ocupadas < n) { celdas.push('<td style="mso-number-format:\'\\@\';"></td>'); ocupadas += 1; }
        filas.push('<tr>' + celdas.join('') + '</tr>');
      });

      (hoja.pie || []).forEach(function (t) {
        filas.push('<tr><td colspan="' + n + '" style="' + COLORES.subtotal + '">' + UI.esc(t) + '</td></tr>');
      });
      if (hoja.nota) {
        filas.push('<tr><td colspan="' + n + '" style="font-size:10px;color:#64756C;">' + UI.esc(hoja.nota) + '</td></tr>');
      }

      return '<table border="1" cellspacing="0" cellpadding="4" style="border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:11px;border:1px solid #0B4D2C;">' +
        filas.join('') + '</table>';
    },

    libroHtml: function (hojas) {
      var lista = (hojas || []).map(function (h, i) {
        var c = JSON.parse(JSON.stringify(h));
        c.nombre = Export.nombreHoja(h.nombre, i);
        return c;
      });
      var xml = '<xml><x:ExcelWorkbook><x:ExcelWorksheets>' +
        lista.map(function (h) {
          return '<x:ExcelWorksheet><x:Name>' + UI.esc(h.nombre) + '</x:Name>' +
            '<x:WorksheetOptions><x:DisplayGridlines/></x:WorksheetOptions></x:ExcelWorksheet>';
        }).join('') +
        '</x:ExcelWorksheets></x:ExcelWorkbook></xml>';

      return '<html xmlns:o="urn:schemas-microsoft-com:office:office" ' +
        'xmlns:x="urn:schemas-microsoft-com:office:excel" ' +
        'xmlns="http://www.w3.org/TR/REC-html40"><head><meta charset="utf-8">' +
        '<title>' + UI.esc(lista.length ? lista[0].nombre : 'Libro') + '</title>' +
        '<!--[if gte mso 9]>' + xml + '<![endif]-->' +
        '<style>td,th{vertical-align:top;} br{mso-data-placement:same-cell;}</style>' +
        '</head><body>' +
        lista.map(function (h, i) { return Export.hojaHtml(h, i); }).join('<br style="page-break-before:always">') +
        '</body></html>';
    },

    /* ═══════════════════ Encabezados estándar para Excel ═══════════════════ */

    encabezadoExcel: function (documento) {
      var c = App.estado.config;
      var i = c.institucion;
      return {
        titulo: 'REPÚBLICA BOLIVARIANA DE VENEZUELA — MINISTERIO DEL PODER POPULAR PARA LA EDUCACIÓN',
        subtitulos: [
          (i.nombre || 'COMPLEJO EDUCATIVO "ZAZARABICOA"') + ' — Fundado en ' + (i.fundado || 1946),
          (i.codigoDEA ? 'Código DEA: ' + i.codigoDEA + '  |  ' : '') +
          (i.circuito ? 'Circuito Escolar: ' + i.circuito + '  |  ' : '') +
          (i.municipio ? 'Municipio: ' + i.municipio + '  |  ' : '') +
          (i.estado ? 'Estado: ' + i.estado + '  |  ' : '') + 'Año Escolar: ' + (i.anioEscolar || ''),
          documento,
          'Docente: ' + ZZ.nombreDocente(c) + (c.docente.cedula ? '  |  C.I. ' + c.docente.cedulaTipo + '-' + c.docente.cedula : '') +
          '  |  Generado: ' + UI.fechaHora()
        ]
      };
    },

    /** Hoja de sábana anual por asignatura (reutilizada en varios módulos). */
    hojaSabana: function (estado, sel, filas) {
      var ajustes = estado.config.ajustes;
      var enc = Export.encabezadoExcel('SÁBANA DEFINITIVA ANUAL (CONSOLIDADO DE LOS 3 LAPSOS)');
      var columnas = ['N°', 'Cédula', 'Apellidos y Nombres', '1er Lapso', '2do Lapso', '3er Lapso',
        'Promedio Anual', 'Calificación Definitiva', 'Condición Final'];
      var cuerpo = filas.map(function (f, i) {
        return [
          i + 1,
          f.estudiante.cedula || '',
          ZZ.nombreCompleto(f.estudiante),
          f.consolidado.l1 === null ? '' : f.consolidado.l1,
          f.consolidado.l2 === null ? '' : f.consolidado.l2,
          f.consolidado.l3 === null ? '' : f.consolidado.l3,
          f.consolidado.promedio === null ? '' : f.consolidado.promedio,
          { v: f.consolidado.definitiva === null ? '' : f.consolidado.definitiva, c: f.consolidado.condicion === 'APROBADO' ? 'aprobado' : (f.consolidado.revision ? 'revision' : 'reprobado') },
          { v: f.consolidado.condicion, c: f.consolidado.condicion === 'APROBADO' ? 'aprobado' : (f.consolidado.revision ? 'revision' : 'reprobado') }
        ];
      });
      var est = ZZ.estadisticas(filas.map(function (f) { return { definitiva: f.consolidado.definitiva }; }), ajustes);
      return {
        nombre: 'Sábana ' + sel.anio + '° ' + sel.seccion,
        titulo: enc.titulo,
        subtitulos: enc.subtitulos.concat([
          'Asignatura: ' + ZZ.nombreAsignatura(estado, sel.asignatura) +
          '  |  Año: ' + sel.anio + '°  |  Sección: ' + sel.seccion
        ]),
        columnas: columnas,
        anchos: [40, 95, 250, 70, 70, 70, 80, 95, 150],
        filas: cuerpo,
        pie: [
          'Matrícula: ' + est.matricula + '   |   Evaluados: ' + est.evaluados +
          '   |   Aprobados: ' + est.aprobados + ' (' + ZZ.fmtPct(est.porcAprobados) + ')' +
          '   |   Reprobados: ' + est.reprobados + ' (' + ZZ.fmtPct(est.porcReprobados) + ')' +
          '   |   Promedio general: ' + ZZ.fmt2(est.promedio)
        ],
        nota: 'Promedio anual = media de las calificaciones definitivas de los 3 lapsos. Colores: verde = aprobado, rojo = reprobado, ámbar = derecho a revisión.'
      };
    }
  };

  raiz.Export = Export;
})(typeof window !== 'undefined' ? window : globalThis);
