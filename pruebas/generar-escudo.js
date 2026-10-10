/* Genera js/escudo-real.js integrando el escudo institucional como imagen
   incrustada (data URL), para que aparezca siempre —también al imprimir— sin
   depender de la carga de archivos externos.
   Uso:  node pruebas/generar-escudo.js [ruta-de-la-imagen]                 */
'use strict';
const fs = require('fs');
const path = require('path');

const RAIZ = path.join(__dirname, '..');
const origen = process.argv[2] || path.join(RAIZ, 'img', 'escudo-zazarabicoa.jpg');
if (!fs.existsSync(origen)) {
  console.error('No se encontró la imagen: ' + origen);
  process.exit(1);
}
const bytes = fs.readFileSync(origen);
const ext = path.extname(origen).toLowerCase();
const mime = ext === '.png' ? 'image/png' : (ext === '.webp' ? 'image/webp' : 'image/jpeg');
const dataUrl = 'data:' + mime + ';base64,' + bytes.toString('base64');

const contenido = `/* ============================================================================
   escudo-real.js — Escudo institucional del Complejo Educativo "Zazarabicoa"
   (Fundado en 1946), integrado como imagen incrustada para que aparezca en la
   cabecera y en todos los documentos oficiales (pantalla e impresión) sin
   depender de archivos externos. El archivo original también se conserva en
   img/escudo-zazarabicoa.jpg y puede reemplazarse con «Cargar escudo» desde la
   pestaña Configuración (esa imagen propia tiene prioridad sobre esta).
   Generado con: node pruebas/generar-escudo.js
   ========================================================================== */
(function (raiz) {
  'use strict';
  raiz.ESCUDO_REAL_ARCHIVO = 'img/escudo-zazarabicoa.jpg';
  raiz.ESCUDO_REAL = '${dataUrl}';
})(typeof window !== 'undefined' ? window : globalThis);
`;

fs.writeFileSync(path.join(RAIZ, 'js', 'escudo-real.js'), contenido, 'utf8');
console.log('js/escudo-real.js generado: ' + Math.round(contenido.length / 1024) + ' KB (' +
  bytes.length + ' bytes de imagen ' + mime + ')');
