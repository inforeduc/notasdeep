/* ============================================================================
   firebase-config.js — Configuración de la nube (Firebase de Google).

   PROYECTO: Notaszazarabicoa  (ID: notaszazarabicoa)
   Estado: CONFIGURADO ✔  → la aplicación trabaja en MODO NUBE cuando la página
   se abre desde internet (GitHub Pages u otro servidor http/https).

   IMPORTANTE: si abre la aplicación con doble clic desde su computadora
   (dirección file://), la aplicación usa automáticamente el MODO LOCAL y se lo
   avisa en la pantalla de acceso, porque Firebase Authentication solo funciona
   en páginas publicadas. Sus datos locales siguen intactos.

   Guía completa y gratuita: GUIA-FIREBASE.md
   ========================================================================== */
(function (raiz) {
  'use strict';

  raiz.FIREBASE_CONFIG = {
    apiKey: "AIzaSyAc_RskIuWd8eZTzuqemUKjldK9_NQGnV4",
    authDomain: "notaszazarabicoa.firebaseapp.com",
    projectId: "notaszazarabicoa",
    storageBucket: "notaszazarabicoa.firebasestorage.app",
    messagingSenderId: "193286170259",
    appId: "1:193286170259:web:ca433a57c17c46feb98f66",
    measurementId: "G-HB9H6LSCQD"
  };

  /* Versión del SDK de Firebase que se carga desde el CDN de Google.
     Si algún día esa versión dejara de existir, la aplicación probará
     automáticamente con las versiones alternativas de la lista. */
  raiz.FIREBASE_VERSION = '11.0.2';
  raiz.FIREBASE_VERSIONS_ALTERNAS = ['11.0.2', '10.12.2', '9.23.0'];
})(typeof window !== 'undefined' ? window : globalThis);
