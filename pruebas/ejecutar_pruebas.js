/*
 * ejecutar_pruebas.js — Ejecuta todas las pruebas desde la consola con Node.js:
 *     node pruebas/ejecutar_pruebas.js
 * 1. Casos límite y aleatorios: compara la aplicación con la implementación de referencia.
 * 2. Ejemplos resueltos en clase.
 * 3. Propiedades que todo resultado debe cumplir (T1 − T2 = Fu, Tadm ≥ T1, ...).
 * 4. Validación de entradas incorrectas.
 * 5. La copia js/datos-respaldo.js es idéntica a datos/datos.json.
 * Devuelve código de salida 1 si algo falla.
 */
'use strict';
var path = require('path');
var fs = require('fs');
var raiz = path.join(__dirname, '..');
var tablas = JSON.parse(fs.readFileSync(path.join(raiz, 'datos', 'datos.json'), 'utf8'));
var Cinta = require(path.join(raiz, 'js', 'calculos.js'));
var Comparar = require('./comparar.js');
var EjemplosClase = require('./ejemplos_clase.js');
var archivoCasos = process.argv[2] ? path.resolve(process.argv[2]) : path.join(__dirname, 'casos.js');
var casos = require(archivoCasos);

var fallos = 0;
function titulo(t) { console.log('\n=== ' + t); }

/* 1. Casos límite y aleatorios */
titulo('Comparación con la implementación de referencia (Python): ' + casos.length + ' casos');
var correctos = 0;
var valores = 0;
var mostrados = 0;
var resultados = [];
casos.forEach(function (caso) {
  var r = Comparar.compararCaso(caso, Cinta, tablas);
  valores += r.valoresComparados;
  resultados.push(r.resultado);
  if (r.ok) { correctos++; return; }
  fallos++;
  if (mostrados++ < 15) {
    console.log('  FALLO ' + caso.id + ' (' + caso.nombre + ')');
    r.diferencias.slice(0, 6).forEach(function (d) {
      console.log('     ' + d.campo + ': app = ' + d.app + ' | esperado = ' + d.esperado);
    });
  }
});
console.log('  Correctos: ' + correctos + ' / ' + casos.length + '  (' + valores + ' valores comparados)');

/* 2. Ejemplos de clase */
titulo('Ejemplos resueltos en clase');
var grupos = EjemplosClase.ejecutar(Cinta, tablas);
grupos.forEach(function (gr) {
  gr.filas.forEach(function (f) {
    if (f.estado === 'fallo') {
      fallos++;
      console.log('  FALLO ' + gr.fuente + ' — ' + f.magnitud + ': clase = ' + f.clase + ', app = ' + f.app);
    } else if (f.estado !== 'ok') {
      console.log('  ' + (f.estado === 'errata' ? 'ERRATA ' : 'REDONDEO') + ' ' + gr.fuente + ' — ' + f.magnitud +
        ': clase = ' + f.clase + ', app = ' + (+f.app.toPrecision(8)) + '. ' + (f.nota || ''));
    }
  });
});
var rc = EjemplosClase.resumen(grupos);
console.log('  ' + rc.total + ' valores: ' + rc.ok + ' coinciden, ' + rc.redondeo + ' con redondeo de clase, ' +
  rc.errata + ' erratas de los apuntes, ' + rc.fallo + ' fallos');

/* 3. Propiedades */
titulo('Propiedades de los resultados');
var nProp = 0;
function propiedad(cond, texto, caso) {
  nProp++;
  if (!cond) { fallos++; console.log('  FALLO propiedad (' + caso + '): ' + texto); }
}
function cerca(a, b) { return Math.abs(a - b) <= 1e-9 * Math.max(1, Math.abs(a), Math.abs(b)); }
resultados.forEach(function (r, i) {
  var d = r.datos;
  var id = casos[i].id;
  var e = r.entradas;
  if (!r.ok) { propiedad(r.errores.length > 0, 'si no termina debe haber un error', id); return; }
  propiedad(d.S > 0, 'sección positiva', id);
  if (d.S1 !== null) {
    propiedad(d.S1 >= 0 && d.S2 >= 0 && cerca(d.S1 + d.S2, d.S), 'S = S1 + S2 con S1, S2 ≥ 0', id);
    propiedad(d.l3 < d.b, 'l3 < b', id);
  }
  propiedad(cerca(d.Qreal, 3600 * d.v * d.S * e.densidad * d.k), 'Q = 3600·v·S·γ·k', id);
  if (d.capacidadOK) propiedad(d.Qreal >= e.Q * (1 - 1e-9), 'capacidad suficiente', id);
  if (e.anchura === 'auto') {
    propiedad(d.capacidadOK && d.velocidadOK && d.trozoOK, 'la anchura automática cumple todo', id);
    if (r.candidatos.length > 1) propiedad(!r.candidatos[r.candidatos.length - 2].sel.valida, 'es la menor anchura válida', id);
  }
  if (e.modoVelocidad === 'normalizada') {
    propiedad(tablas.velocidadesNormalizadas.valores.indexOf(d.v) >= 0, 'velocidad normalizada DIN', id);
  }
  propiedad(cerca(d.qG * 3.6 * d.v, e.Q), 'qG = Q/(3,6·v)', id);
  propiedad(cerca(d.Fu, d.FHN + e.FS1 + e.FS2 + d.FSt), 'Fu = suma de resistencias', id);
  propiedad(cerca(d.Pm * e.rendimiento / 100, d.Fu * d.v), 'Pm·η = Fu·v', id);
  if (d.Fu > 0) {
    propiedad(cerca(d.T1 - d.T2, d.Fu), 'T1 − T2 = Fu', id);
    propiedad(d.T2min >= d.T2adh * (1 - 1e-12) && d.T2min >= d.TsupMin * (1 - 1e-12) && d.T2min >= d.TinfMin * (1 - 1e-12),
      'T2min es el máximo de las tres condiciones', id);
    if (e.T2adoptada === null) {
      propiedad(d.adherenciaOK && d.flechaSupOK && d.flechaInfOK, 'con T2 = T2min se cumplen adherencia y flecha', id);
      propiedad(d.relacion <= d.E * (1 + 1e-9), 'T1/T2 ≤ e^(μφ)', id);
    }
    propiedad(d.Tadm >= d.T1 * (1 - 1e-9), 'Tadm ≥ T1', id);
    propiedad(d.z >= d.zRes && d.z >= e.zMinConstr, 'z ≥ z por resistencia y ≥ mínimo constructivo', id);
    if (d.zRes > 1) {
      var zAnt = d.zRes - 1;
      propiedad(e.R * zAnt * d.B / Cinta.coeficienteSeguridad(tablas, zAnt) < d.T1, 'una capa menos no bastaría', id);
    }
    var cap = Cinta.capas(tablas, d.T1, e.R, d.B, e.zMinConstr, null);
    var it = cap.iteraciones[cap.iteraciones.length - 1];
    propiedad(it.coherente && it.zEntero === d.zRes, 'la iteración del Ejercicio 12 da el mismo z', id);
  }
});
console.log('  ' + nProp + ' comprobaciones realizadas');

/* 4. Validación de entradas */
titulo('Validación de entradas incorrectas');
var base = tablas.ejemplos[0].entradas;
function conCambios(cambios) {
  var e = {};
  Object.keys(base).forEach(function (c) { e[c] = base[c]; });
  Object.keys(cambios).forEach(function (c) { e[c] = cambios[c]; });
  return e;
}
var invalidos = [
  [{ Q: 0 }, 'Q'], [{ Q: -5 }, 'Q'], [{ Q: NaN }, 'Q'], [{ densidad: 0 }, 'densidad'],
  [{ beta: 0 }, 'beta'], [{ beta: 31 }, 'beta'], [{ tamMax: -1 }, 'tamMax'], [{ granulometria: 'x' }, 'granulometria'],
  [{ materialVel: 'F1-Z' }, 'materialVel'], [{ materialVel: 'F3-A' }, 'materialVel'], [{ L: 0 }, 'L'],
  [{ H: 150 }, 'H'], [{ H: 100 }, 'H'], [{ kManual: 1.2 }, 'kManual'], [{ kManual: 0 }, 'kManual'],
  [{ nRodillos: 4 }, 'nRodillos'], [{ lambda: 0 }, 'lambda'], [{ lambda: 70 }, 'lambda'],
  [{ anchura: 700 }, 'anchura'], [{ l3Manual: 300 }, 'l3Manual'], [{ anchura: 400, l3Manual: 400 }, 'l3Manual'],
  [{ nRodillos: 2, anchura: 650, l3Manual: 200 }, 'l3Manual'], [{ metodoSeccion: 'catalogo', Qv1: 100 }, 'anchura'],
  [{ metodoSeccion: 'catalogo', anchura: 650, Qv1: null }, 'Qv1'], [{ modoVelocidad: 'manual', vManual: null }, 'vManual'],
  [{ modoVelocidad: 'x' }, 'modoVelocidad'], [{ f: 0 }, 'f'], [{ qB: 0 }, 'qB'], [{ mRO: -1 }, 'mRO'],
  [{ modoRodillos: 'directo', qRO: null, qRU: 0 }, 'qRO'], [{ lRO: 0 }, 'lRO'], [{ lRU: -2 }, 'lRU'],
  [{ metodoResist: 'x' }, 'metodoResist'], [{ CLManual: 0 }, 'CLManual'], [{ v0: -1 }, 'v0'], [{ FS2: -3 }, 'FS2'],
  [{ rendimiento: 0 }, 'rendimiento'], [{ rendimiento: 101 }, 'rendimiento'], [{ mu: 0 }, 'mu'], [{ phi: 0 }, 'phi'],
  [{ phi: 400 }, 'phi'], [{ D: 0 }, 'D'], [{ flechaMax: 0 }, 'flechaMax'], [{ T2adoptada: -10 }, 'T2adoptada'],
  [{ R: 0 }, 'R'], [{ zMinConstr: 2.5 }, 'zMinConstr'], [{ zProp: 0 }, 'zProp']
];
var nInv = 0;
invalidos.forEach(function (par) {
  var r = Cinta.calcular(conCambios(par[0]), tablas);
  var campos = r.errores.map(function (x) { return x.campo; });
  nInv++;
  if (r.ok || campos.indexOf(par[1]) < 0) {
    fallos++;
    console.log('  FALLO: ' + JSON.stringify(par[0]) + ' debería dar error en ' + par[1] + ' y da ' + JSON.stringify(campos));
  }
});
var valido = Cinta.calcular(conCambios({ nRodillos: 1, lambda: null }), tablas);
nInv++;
if (!valido.ok) { fallos++; console.log('  FALLO: 1 rodillo sin ángulo de artesa debería ser válido'); }
console.log('  ' + nInv + ' entradas comprobadas');

/* 5. Copia de respaldo de los datos */
titulo('Copia de respaldo de las tablas');
global.window = {};
require(path.join(raiz, 'js', 'datos-respaldo.js'));
var iguales = JSON.stringify(global.window.DATOS_RESPALDO) === JSON.stringify(tablas);
if (!iguales) { fallos++; console.log('  FALLO: js/datos-respaldo.js no coincide con datos/datos.json'); }
else console.log('  js/datos-respaldo.js coincide con datos/datos.json');

titulo(fallos === 0 ? 'TODAS LAS PRUEBAS SUPERADAS' : 'HAY ' + fallos + ' FALLOS');
process.exit(fallos === 0 ? 0 : 1);
