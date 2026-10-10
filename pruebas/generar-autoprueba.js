/* Genera pruebas/autoprueba.html a partir de index.html inyectando la
   autoprueba de extremo a extremo. Ejecutar: node pruebas/generar-autoprueba.js */
'use strict';
const fs = require('fs');
const path = require('path');

const raiz = path.join(__dirname, '..');
let html = fs.readFileSync(path.join(raiz, 'index.html'), 'utf8');
html = html.replace(/href="css\//g, 'href="../css/')
  .replace(/src="js\//g, 'src="../js/')
  .replace(/<\/body>/, '  <script src="e2e.js"></script>\n</body>');
fs.writeFileSync(path.join(__dirname, 'autoprueba.html'), html, 'utf8');
console.log('autoprueba.html generado (' + html.length + ' caracteres)');

/* Si se pasa un archivo con el DOM volcado, extrae el resultado */
const volcado = process.argv[2];
if (volcado && fs.existsSync(volcado)) {
  const texto = fs.readFileSync(volcado, 'utf8');
  const m = texto.match(/\[\[RESULTADO\]\]([\s\S]*?)\[\[FIN\]\]/);
  if (m) {
    console.log('\n' + m[1].trim());
    process.exit(/E2E FALLAS: 0/.test(m[1]) ? 0 : 1);
  }
  console.log('No se encontró el bloque de resultado. Últimos 1500 caracteres del DOM:\n');
  console.log(texto.slice(-1500));
  process.exit(2);
}
