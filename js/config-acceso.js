/* ============================================================================
   config-acceso.js — Clave general de acceso a la aplicación.

   IMPORTANTE (lea esto): esta clave viaja dentro de la página, así que
   cualquiera que abra el código fuente puede verla. Sirve como PORTÓN de
   entrada (para que un estudiante que tome el teléfono no entre de casualidad),
   no como seguridad real. La seguridad de verdad la da el modo nube con
   Firebase (usuario y contraseña por docente): vea GUIA-FIREBASE.md.
   ========================================================================== */
(function (raiz) {
  'use strict';

  raiz.CONFIG_ACCESO = {
    /* Clave general que se pide al abrir la aplicación. */
    clave: 'zazarabicoa123',

    /* Si algún día quiere entrar sin clave general, ponga false. */
    exigirClave: true,

    /* Título y subtítulo que se muestran en la pantalla de acceso. */
    titulo: 'Evaluación Docente de Zazarabicoa',
    subtitulo: 'Complejo Educativo "Zazarabicoa" · Fundado en 1946 · Morán, Estado Lara',

    /* Permite que cada docente cree su usuario en este equipo (modo local,
       sin nube). En modo nube los usuarios se crean con Firebase. */
    permitirUsuariosLocales: true
  };
})(typeof window !== 'undefined' ? window : globalThis);
