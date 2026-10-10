/* ============================================================================
   escudo.js — Emblema institucional integrado (Complejo Educativo Zazarabicoa,
   fundado en 1946). Es un emblema vectorial de respaldo: en Configuración se
   puede cargar la imagen real del escudo del plantel y se usará en su lugar.
   ========================================================================== */
(function (raiz) {
  'use strict';

  var ID = 0;

  function svgEscudo() {
    ID += 1;
    var g = 'gradOro' + ID;
    return '' +
      '<svg viewBox="0 0 120 142" xmlns="http://www.w3.org/2000/svg" role="img" aria-label="Escudo del Complejo Educativo Zazarabicoa, fundado en 1946">' +
      '<defs>' +
      '<linearGradient id="' + g + '" x1="0" y1="0" x2="1" y2="1">' +
      '<stop offset="0" stop-color="#f7e58c"/><stop offset=".45" stop-color="#d4af37"/><stop offset="1" stop-color="#9c7a20"/>' +
      '</linearGradient>' +
      '</defs>' +
      '<path d="M60 3 L113 21 V72 C113 104 89 128 60 139 C31 128 7 104 7 72 V21 Z" fill="#0b4d2c" stroke="url(#' + g + ')" stroke-width="4"/>' +
      '<path d="M60 12 L104 27 V72 C104 100 84 121 60 131 C36 121 16 100 16 72 V27 Z" fill="#0f6b3d" stroke="#d4af37" stroke-width="1.4"/>' +
      '<path d="M60 20 L96 32 V71 C96 95 79 113 60 122 C41 113 24 95 24 71 V32 Z" fill="#12854b" stroke="#f0dc9a" stroke-width="1"/>' +
      /* sol naciente */
      '<circle cx="60" cy="52" r="11" fill="#f3d34a" stroke="#a8842a" stroke-width="1"/>' +
      '<g stroke="#f3d34a" stroke-width="1.6" stroke-linecap="round">' +
      '<path d="M60 34 V41"/><path d="M60 63 V70"/><path d="M42 52 H49"/><path d="M71 52 H78"/>' +
      '<path d="M47 39 L52 44"/><path d="M68 60 L73 65"/><path d="M73 39 L68 44"/><path d="M52 60 L47 65"/>' +
      '</g>' +
      /* libro abierto */
      '<path d="M30 88 C42 82 52 84 60 90 C68 84 78 82 90 88 L90 98 C78 92 68 94 60 100 C52 94 42 92 30 98 Z" fill="#fdfbf3" stroke="#a8842a" stroke-width="1.2"/>' +
      '<path d="M60 90 V100" stroke="#a8842a" stroke-width="1"/>' +
      /* cinta */
      '<path d="M22 106 C40 116 80 116 98 106 L98 114 C80 124 40 124 22 114 Z" fill="url(#' + g + ')" stroke="#7a5f16" stroke-width="0.8"/>' +
      '<text x="60" y="115" text-anchor="middle" font-family="Georgia, serif" font-size="7.2" font-weight="bold" fill="#2c2200">1946</text>' +
      '<text x="60" y="128" text-anchor="middle" font-family="Georgia, serif" font-size="8.2" font-weight="bold" fill="#ffffff" letter-spacing="0.4">ZAZARABICOA</text>' +
      '<text x="60" y="136" text-anchor="middle" font-family="Georgia, serif" font-size="5.6" fill="#d9f0e2">C.E. · 1946</text>' +
      '</svg>';
  }

  raiz.ESCUDO_SVG = svgEscudo;
})(typeof window !== 'undefined' ? window : globalThis);
