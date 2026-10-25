/*
 * comparar.js — Compara el resultado de la aplicación (js/calculos.js) con el resultado
 * esperado de cada caso de prueba (calculado con pruebas/referencia.py).
 * Lo usan pruebas.html (navegador) y ejecutar_pruebas.js (Node.js).
 */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.Comparar = fabrica();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var TOL_REL = 1e-9;   // diferencia relativa admitida entre las dos implementaciones
  var TOL_ABS = 1e-9;   // para valores que deberían ser 0

  function iguales(a, b) {
    if (a === undefined) a = null;
    if (b === undefined) b = null;
    if (typeof a === 'number' && typeof b === 'number') {
      if (a === b) return true;
      return Math.abs(a - b) <= TOL_REL * Math.max(Math.abs(a), Math.abs(b)) + TOL_ABS;
    }
    return a === b;
  }

  function compararCaso(caso, Cinta, tablas) {
    var r = Cinta.calcular(caso.entradas, tablas);
    var esp = caso.esperado;
    var dif = [];

    var errApp = r.errores.map(function (x) { return x.codigo; });
    if (errApp.join(',') !== esp.errores.join(',')) {
      dif.push({ campo: 'errores', app: errApp.join(',') || '—', esperado: esp.errores.join(',') || '—' });
    }
    var avApp = r.avisos.map(function (x) { return x.codigo; }).sort();
    var avEsp = esp.avisos.slice().sort();
    if (avApp.join(',') !== avEsp.join(',')) {
      dif.push({ campo: 'avisos', app: avApp.join(',') || '—', esperado: avEsp.join(',') || '—' });
    }

    var claves = {};
    Object.keys(r.datos).forEach(function (c) { claves[c] = true; });
    Object.keys(esp.datos).forEach(function (c) { claves[c] = true; });
    var comparados = 0;
    Object.keys(claves).forEach(function (c) {
      comparados++;
      if (!iguales(r.datos[c], esp.datos[c])) {
        dif.push({ campo: c, app: r.datos[c], esperado: esp.datos[c] });
      }
    });

    var cApp = r.candidatos.map(function (c) { return [c.B, c.sel.valida, c.sel.motivo].join('/'); }).join(' ');
    var cEsp = esp.candidatos.map(function (c) { return c.join('/'); }).join(' ');
    if (cApp !== cEsp) dif.push({ campo: 'candidatos', app: cApp, esperado: cEsp });

    return { ok: dif.length === 0, diferencias: dif, valoresComparados: comparados, resultado: r };
  }

  return { compararCaso: compararCaso, iguales: iguales, TOL_REL: TOL_REL };
}));
