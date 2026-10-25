/*
 * actualizar_respaldo.js — Regenera js/datos-respaldo.js a partir de datos/datos.json.
 *     node pruebas/actualizar_respaldo.js
 * La copia permite abrir index.html con doble clic: los navegadores bloquean la lectura de
 * archivos .json con fetch() cuando la página se abre desde el disco (file://).
 */
'use strict';
var fs = require('fs');
var path = require('path');
var raiz = path.join(__dirname, '..');
var datos = JSON.parse(fs.readFileSync(path.join(raiz, 'datos', 'datos.json'), 'utf8'));
var texto = '/* Copia automática de datos/datos.json (generada por pruebas/actualizar_respaldo.js).\n' +
  '   Se usa solo si el navegador no permite leer el archivo .json (página abierta con doble clic).\n' +
  '   No editar a mano: modifique datos/datos.json y vuelva a generar este archivo. */\n' +
  'window.DATOS_RESPALDO = ' + JSON.stringify(datos, null, 1) + ';\n';
fs.writeFileSync(path.join(raiz, 'js', 'datos-respaldo.js'), texto, 'utf8');
console.log('js/datos-respaldo.js actualizado');
