/* ============================================================================
   xlsx.js — Generador de libros .xlsx (OOXML) sin dependencias externas.
   Escribe un paquete ZIP con entradas sin comprimir (método «store»), por lo
   que funciona sin conexión y sin librerías. Produce archivos que Microsoft
   Excel, LibreOffice Calc y Google Sheets abren de forma nativa, con varias
   hojas, colores, bordes, anchos de columna y filas de encabezado congeladas.

   Especificación de hoja (la misma que usa exportacion.js):
     { nombre, titulo, subtitulos: [], columnas: [], anchos: [], filas: [[]],
       pie: [], nota }
   Celda: valor simple u objeto { v, c, colspan }
     c: 'aprobado' | 'reprobado' | 'revision' | 'encabezado' | 'subtotal' |
        'titulo' | 'etiqueta' | 'sin'
   ========================================================================== */
(function (raiz) {
  'use strict';

  /* ─────────────────────────────── utilidades ───────────────────────────── */

  var tablaCrc = (function () {
    var t = new Uint32Array(256);
    for (var n = 0; n < 256; n++) {
      var c = n;
      for (var k = 0; k < 8; k++) c = (c & 1) ? (0xEDB88320 ^ (c >>> 1)) : (c >>> 1);
      t[n] = c >>> 0;
    }
    return t;
  })();

  function crc32(bytes) {
    var c = 0xFFFFFFFF;
    for (var i = 0; i < bytes.length; i++) c = tablaCrc[(c ^ bytes[i]) & 0xFF] ^ (c >>> 8);
    return (c ^ 0xFFFFFFFF) >>> 0;
  }

  function utf8(texto) {
    if (typeof TextEncoder !== 'undefined') return new TextEncoder().encode(texto);
    var esc = unescape(encodeURIComponent(texto));
    var bytes = new Uint8Array(esc.length);
    for (var i = 0; i < esc.length; i++) bytes[i] = esc.charCodeAt(i);
    return bytes;
  }

  function xml(t) {
    return String(t == null ? '' : t)
      .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;').replace(/'/g, '&apos;')
      .replace(/[\x00-\x08\x0B\x0C\x0E-\x1F]/g, '');
  }

  function letraColumna(n) {
    var s = '';
    while (n > 0) {
      var r = (n - 1) % 26;
      s = String.fromCharCode(65 + r) + s;
      n = Math.floor((n - 1) / 26);
    }
    return s || 'A';
  }

  /* ─────────────────────────────── ZIP ─────────────────────────────── */

  function zip(archivos) {
    var partes = [], central = [], offset = 0;
    var d = new Date();
    var hora = ((d.getHours() & 31) << 11) | ((d.getMinutes() & 63) << 5) | ((d.getSeconds() / 2) & 31);
    var fecha = (((d.getFullYear() - 1980) & 127) << 9) | (((d.getMonth() + 1) & 15) << 5) | (d.getDate() & 31);

    function u16(v) { return [v & 0xFF, (v >>> 8) & 0xFF]; }
    function u32(v) { return [v & 0xFF, (v >>> 8) & 0xFF, (v >>> 16) & 0xFF, (v >>> 24) & 0xFF]; }

    archivos.forEach(function (a) {
      var nombre = utf8(a.nombre);
      var datos = typeof a.datos === 'string' ? utf8(a.datos) : a.datos;
      var crc = crc32(datos);
      var cabecera = [].concat(
        u32(0x04034b50), u16(20), u16(0), u16(0), u16(hora), u16(fecha),
        u32(crc), u32(datos.length), u32(datos.length), u16(nombre.length), u16(0)
      );
      partes.push(new Uint8Array(cabecera), nombre, datos);
      central.push({
        nombre: nombre, crc: crc, tam: datos.length, offset: offset
      });
      offset += cabecera.length + nombre.length + datos.length;
    });

    var inicioCentral = offset, tamCentral = 0;
    central.forEach(function (e) {
      var entrada = [].concat(
        u32(0x02014b50), u16(20), u16(20), u16(0), u16(0), u16(hora), u16(fecha),
        u32(e.crc), u32(e.tam), u32(e.tam), u16(e.nombre.length), u16(0), u16(0),
        u16(0), u16(0), u32(0), u32(e.offset)
      );
      partes.push(new Uint8Array(entrada), e.nombre);
      tamCentral += entrada.length + e.nombre.length;
    });

    partes.push(new Uint8Array([].concat(
      u32(0x06054b50), u16(0), u16(0), u16(central.length), u16(central.length),
      u32(tamCentral), u32(inicioCentral), u16(0)
    )));

    var total = partes.reduce(function (s, p) { return s + p.length; }, 0);
    var salida = new Uint8Array(total), pos = 0;
    partes.forEach(function (p) { salida.set(p, pos); pos += p.length; });
    return salida;
  }

  /* ───────────────────────────── estilos ───────────────────────────── */

  var ESTILOS = [
    /* 0 */ { fuente: 0, relleno: 0, borde: 1 },                                  // texto normal
    /* 1 */ { fuente: 1, relleno: 2, borde: 1, centrado: 1, ajuste: 1 },          // encabezado de columna
    /* 2 */ { fuente: 2, relleno: 3, borde: 1, ajuste: 1 },                       // título principal
    /* 3 */ { fuente: 3, relleno: 7, borde: 1, ajuste: 1 },                       // subtítulo
    /* 4 */ { fuente: 1, relleno: 4, borde: 1, centrado: 1 },                     // aprobado
    /* 5 */ { fuente: 1, relleno: 5, borde: 1, centrado: 1 },                     // reprobado
    /* 6 */ { fuente: 1, relleno: 6, borde: 1, centrado: 1 },                     // derecho a revisión
    /* 7 */ { fuente: 1, relleno: 7, borde: 1 },                                  // subtotal / pie
    /* 8 */ { fuente: 1, relleno: 8, borde: 1 },                                  // etiqueta
    /* 9 */ { fuente: 0, relleno: 0, borde: 1, centrado: 1 },                     // número centrado
    /* 10 */ { fuente: 4, relleno: 0, borde: 1, centrado: 1 },                    // sin datos
    /* 11 */ { fuente: 5, relleno: 0, borde: 1, ajuste: 1 }                       // nota al pie pequeña
  ];

  var CLASE_ESTILO = {
    encabezado: 1, titulo: 2, subtotal: 7, etiqueta: 8,
    aprobado: 4, reprobado: 5, revision: 6, sin: 10, nota: 11
  };

  function stylesXml() {
    var fuentes = [
      '<font><sz val="10"/><name val="Calibri"/><color rgb="FF1D2A24"/></font>',
      '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF1D2A24"/></font>',
      '<font><b/><sz val="13"/><name val="Calibri"/><color rgb="FFFFFFFF"/></font>',
      '<font><b/><sz val="10"/><name val="Calibri"/><color rgb="FF0B4D2C"/></font>',
      '<font><i/><sz val="10"/><name val="Calibri"/><color rgb="FF9AA8A0"/></font>',
      '<font><sz val="9"/><name val="Calibri"/><color rgb="FF64756C"/></font>'
    ];
    var rellenos = [
      '<fill><patternFill patternType="none"/></fill>',
      '<fill><patternFill patternType="gray125"/></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0F6B3D"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FF0B4D2C"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFD8F2E0"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFDE8E6"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFFFF2DC"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFE8F3EC"/><bgColor indexed="64"/></patternFill></fill>',
      '<fill><patternFill patternType="solid"><fgColor rgb="FFF4F7F5"/><bgColor indexed="64"/></patternFill></fill>'
    ];
    var bordes = [
      '<border><left/><right/><top/><bottom/><diagonal/></border>',
      '<border><left style="thin"><color rgb="FFB9C4BC"/></left><right style="thin"><color rgb="FFB9C4BC"/></right>' +
      '<top style="thin"><color rgb="FFB9C4BC"/></top><bottom style="thin"><color rgb="FFB9C4BC"/></bottom><diagonal/></border>'
    ];
    var xfs = ESTILOS.map(function (e) {
      var alin = '<alignment vertical="' + (e.centrado ? 'center' : 'top') + '"' +
        (e.centrado ? ' horizontal="center"' : '') + (e.ajuste ? ' wrapText="1"' : '') + '/>';
      return '<xf numFmtId="0" fontId="' + e.fuente + '" fillId="' + e.relleno + '" borderId="' + e.borde +
        '" xfId="0" applyFont="1" applyFill="1" applyBorder="1" applyAlignment="1">' + alin + '</xf>';
    }).join('');

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<styleSheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main">' +
      '<fonts count="' + fuentes.length + '">' + fuentes.join('') + '</fonts>' +
      '<fills count="' + rellenos.length + '">' + rellenos.join('') + '</fills>' +
      '<borders count="' + bordes.length + '">' + bordes.join('') + '</borders>' +
      '<cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs>' +
      '<cellXfs count="' + ESTILOS.length + '">' + xfs + '</cellXfs>' +
      '<cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles>' +
      '</styleSheet>';
  }

  /* ─────────────────────────── hoja de cálculo ─────────────────────────── */

  function celda(c) {
    return (c && typeof c === 'object') ? c : { v: c };
  }

  function valorCelda(c) {
    if (c.v === null || c.v === undefined) return '';
    if (typeof c.v === 'number' && isFinite(c.v)) return Math.round(c.v * 100) / 100;
    return String(c.v);
  }

  function hojaXml(hoja) {
    var columnas = hoja.columnas || [];
    var nColumnas = columnas.length || 1;
    var filas = [];
    var merges = [];
    var r = 0;

    function fila(celdas, alto, congelar) {
      r += 1;
      var xmlCeldas = '';
      var col = 0;
      (celdas || []).forEach(function (celdaCruda) {
        var c = celda(celdaCruda);
        var clase = CLASE_ESTILO[c.c];
        var v = valorCelda(c);
        var esNumero = typeof v === 'number';
        var estilo = clase !== undefined ? clase : (esNumero ? 9 : 0);
        var span = (c.colspan && c.colspan > 1) ? c.colspan : 1;
        var ref = letraColumna(col + 1) + r;
        if (v === '' && clase === undefined) {
          xmlCeldas += '<c r="' + ref + '" s="' + estilo + '"/>';
        } else if (esNumero) {
          xmlCeldas += '<c r="' + ref + '" s="' + estilo + '"><v>' + v + '</v></c>';
        } else {
          var preservar = /^\s|\s$/.test(v) ? ' xml:space="preserve"' : '';
          xmlCeldas += '<c r="' + ref + '" s="' + estilo + '" t="inlineStr"><is><t' + preservar + '>' +
            xml(v) + '</t></is></c>';
        }
        if (span > 1) {
          merges.push(letraColumna(col + 1) + r + ':' + letraColumna(col + span) + r);
        }
        col += span;
      });
      filas.push('<row r="' + r + '"' + (alto ? ' ht="' + alto + '" customHeight="1"' : '') + '>' + xmlCeldas + '</row>');
    }

    // Encabezado del documento
    fila([{ v: hoja.titulo || 'REPÚBLICA BOLIVARIANA DE VENEZUELA', c: 'titulo', colspan: nColumnas }], 24);
    (hoja.subtitulos || []).forEach(function (s) {
      fila([{ v: s, c: 'subtitulo', colspan: nColumnas }], 16);
    });
    var filaCabecera = r + 1;
    fila(columnas.map(function (col) { return { v: col, c: 'encabezado' }; }), 26);
    // Si la hoja no define columnas, se deja una fila de encabezado vacía
    if (!columnas.length) filas[filas.length - 1] = '<row r="' + r + '"><c r="A' + r + '" s="1"/></row>';

    (hoja.filas || []).forEach(function (f) { fila(f); });
    (hoja.pie || []).forEach(function (t) {
      fila([{ v: t, c: 'subtotal', colspan: nColumnas }], 16);
    });
    if (hoja.nota) fila([{ v: hoja.nota, c: 'nota' }], 14);

    var cols = '';
    if (hoja.anchos && hoja.anchos.length) {
      cols = '<cols>' + hoja.anchos.map(function (px, i) {
        var ancho = Math.max(4, Math.min(70, Math.round((px || 80) / 7)));
        return '<col min="' + (i + 1) + '" max="' + (i + 1) + '" width="' + ancho + '" customWidth="1"/>';
      }).join('') + '</cols>';
    }

    var paneles = '<sheetViews><sheetView workbookViewId="0">' +
      '<pane ySplit="' + filaCabecera + '" topLeftCell="A' + (filaCabecera + 1) + '" activePane="bottomLeft" state="frozen"/>' +
      '<selection pane="bottomLeft" activeCell="A' + (filaCabecera + 1) + '" sqref="A' + (filaCabecera + 1) + '"/>' +
      '</sheetView></sheetViews>';

    return '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
      '<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
      'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
      paneles +
      '<sheetFormatPr defaultRowHeight="14"/>' +
      cols +
      '<sheetData>' + filas.join('') + '</sheetData>' +
      (merges.length ? '<mergeCells count="' + merges.length + '">' +
        merges.map(function (m) { return '<mergeCell ref="' + m + '"/>'; }).join('') + '</mergeCells>' : '') +
      '<pageMargins left="0.5" right="0.5" top="0.5" bottom="0.5" header="0.3" footer="0.3"/>' +
      '<pageSetup orientation="' + (hoja.horizontal ? 'landscape' : 'portrait') + '" fitToWidth="1" fitToHeight="0"/>' +
      '</worksheet>';
  }

  function nombreValido(nombre, indice, usados) {
    var n = String(nombre || ('Hoja' + (indice + 1))).replace(/[\\\/\?\*\[\]:]/g, '-').replace(/^'+|'+$/g, '').slice(0, 31).trim();
    if (!n) n = 'Hoja' + (indice + 1);
    var base = n, k = 2;
    while (usados[n.toLowerCase()]) { n = base.slice(0, 28) + ' ' + k; k += 1; }
    usados[n.toLowerCase()] = true;
    return n;
  }

  /* ─────────────────────────────── libro ─────────────────────────────── */

  var XLSX = {
    /** Devuelve un Uint8Array con el paquete .xlsx completo. */
    libro: function (hojas) {
      var lista = (hojas || []).filter(Boolean);
      if (!lista.length) lista = [{ nombre: 'Hoja1', titulo: '', columnas: [], filas: [] }];
      var usados = {};
      lista = lista.map(function (h, i) {
        var copia = {};
        for (var k in h) if (Object.prototype.hasOwnProperty.call(h, k)) copia[k] = h[k];
        copia.nombre = nombreValido(h.nombre, i, usados);
        copia.horizontal = !!(h.columnas && h.columnas.length > 8);
        return copia;
      });

      var archivos = [];
      archivos.push({
        nombre: '[Content_Types].xml',
        datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">' +
          '<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>' +
          '<Default Extension="xml" ContentType="application/xml"/>' +
          '<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>' +
          lista.map(function (h, i) {
            return '<Override PartName="/xl/worksheets/sheet' + (i + 1) + '.xml" ' +
              'ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>';
          }).join('') +
          '<Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>' +
          '</Types>'
      });

      archivos.push({
        nombre: '_rels/.rels',
        datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          '<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>' +
          '</Relationships>'
      });

      archivos.push({
        nombre: 'xl/workbook.xml',
        datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ' +
          'xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">' +
          '<workbookPr/><bookViews><workbookView activeTab="0"/></bookViews>' +
          '<sheets>' + lista.map(function (h, i) {
            return '<sheet name="' + xml(h.nombre) + '" sheetId="' + (i + 1) + '" r:id="rId' + (i + 1) + '"/>';
          }).join('') + '</sheets>' +
          '<calcPr calcId="0"/></workbook>'
      });

      archivos.push({
        nombre: 'xl/_rels/workbook.xml.rels',
        datos: '<?xml version="1.0" encoding="UTF-8" standalone="yes"?>' +
          '<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">' +
          lista.map(function (h, i) {
            return '<Relationship Id="rId' + (i + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet' + (i + 1) + '.xml"/>';
          }).join('') +
          '<Relationship Id="rId' + (lista.length + 1) + '" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/>' +
          '</Relationships>'
      });

      archivos.push({ nombre: 'xl/styles.xml', datos: stylesXml() });
      lista.forEach(function (h, i) {
        archivos.push({ nombre: 'xl/worksheets/sheet' + (i + 1) + '.xml', datos: hojaXml(h) });
      });

      return zip(archivos);
    },

    /** Descarga el libro con el nombre indicado (fuerza la extensión .xlsx). */
    descargar: function (nombre, hojas) {
      var bytes = XLSX.libro(hojas);
      var archivo = String(nombre || 'libro.xlsx').replace(/\.(xls|xlsx)$/i, '') + '.xlsx';
      var blob = new Blob([bytes], {
        type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'
      });
      var url = URL.createObjectURL(blob);
      var a = document.createElement('a');
      a.href = url;
      a.download = archivo;
      document.body.appendChild(a);
      a.click();
      setTimeout(function () {
        if (a.parentNode) a.parentNode.removeChild(a);
        URL.revokeObjectURL(url);
      }, 200);
      return archivo;
    }
  };

  raiz.XLSX = XLSX;
  if (typeof module === 'object' && module.exports) module.exports = XLSX;
})(typeof window !== 'undefined' ? window : globalThis);
