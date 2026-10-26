/*
 * calculos.js — Motor de cálculo para el dimensionado de cintas transportadoras.
 *
 * Sigue el procedimiento de los apuntes de Transporte y Manutención Industrial (USAL):
 *   1. Inclinación δ = arcsen(H/L) y factor de reducción k (tabla, interpolación lineal).
 *   2. Anchura mínima según el tamaño máximo de los trozos (Tabla 1.3 y Tabla 1.2).
 *   3. Sección transversal S = S1 + S2 (Método 1) o caudal volumétrico de catálogo (Método 2).
 *   4. Velocidad (máxima del fabricante, normalizada DIN 22101) y capacidad Q = 3600·v·S·γ·k.
 *   5. Resistencias al movimiento (método simplificado con C_L o método global) y Fu.
 *   6. Potencia en el tambor y del motor.
 *   7. Tensiones: adherencia (Euler–Eytelwein) y flecha entre rodillos.
 *   8. Número de capas de la banda textil.
 *
 * No accede a la página: recibe las entradas y las tablas (datos/datos.json) y devuelve todos
 * los resultados intermedios para poder mostrarlos y comprobarlos. Funciona en el navegador
 * (objeto global Cinta) y en Node.js (require), lo que permite probarlo automáticamente.
 *
 * Unidades: Q en t/h, densidad en t/m³, longitudes de la instalación en m, anchuras y
 * longitudes de rodillo en mm, velocidades en m/s, masas lineales en kg/m, fuerzas en N,
 * potencias en W, ángulos de entrada en grados.
 */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.Cinta = fabrica();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var GRADOS = Math.PI / 180;
  // Tolerancia relativa en las comparaciones: evita que un redondeo binario (p. ej.
  // 1,6800000000000002 frente a 1,68) cambie una decisión de diseño.
  var TOL = 1e-9;

  function mayorOIgual(a, b) { return a >= b - TOL * Math.max(1, Math.abs(b)); }
  function menorOIgual(a, b) { return a <= b + TOL * Math.max(1, Math.abs(b)); }
  function esNumero(x) { return typeof x === 'number' && isFinite(x); }

  /* ---------------------------------------------------------------- tablas */

  // Interpolación lineal en una tabla [[x, y], ...] ordenada por x creciente.
  // Fuera de la tabla devuelve el valor del extremo e indica tipo 'bajo' o 'alto'.
  function interpolar(filas, x) {
    var n = filas.length;
    var primera = filas[0];
    var ultima = filas[n - 1];
    if (x <= primera[0]) {
      return { valor: primera[1], x1: primera[0], y1: primera[1], x2: null, y2: null,
        tipo: x === primera[0] ? 'exacto' : 'bajo' };
    }
    if (x >= ultima[0]) {
      return { valor: ultima[1], x1: ultima[0], y1: ultima[1], x2: null, y2: null,
        tipo: x === ultima[0] ? 'exacto' : 'alto' };
    }
    for (var i = 0; i < n - 1; i++) {
      var x1 = filas[i][0];
      var y1 = filas[i][1];
      var x2 = filas[i + 1][0];
      var y2 = filas[i + 1][1];
      if (x === x1) {
        return { valor: y1, x1: x1, y1: y1, x2: null, y2: null, tipo: 'exacto' };
      }
      if (x > x1 && x < x2) {
        return { valor: y1 + (y2 - y1) * (x - x1) / (x2 - x1), x1: x1, y1: y1, x2: x2, y2: y2,
          tipo: 'interpolado' };
      }
    }
    return { valor: ultima[1], x1: ultima[0], y1: ultima[1], x2: null, y2: null, tipo: 'alto' };
  }

  function anchurasNormalizadas(tablas) {
    return tablas.anchurasYVelocidades.filas.map(function (f) { return f.B; });
  }

  function longitudRodilloCentral(tablas, B) {
    var filas = tablas.longitudRodillos.filas;
    for (var i = 0; i < filas.length; i++) {
      if (filas[i].B === B) return filas[i].tres;
    }
    return null;
  }

  // Velocidad máxima recomendada para la anchura B (mm) y el tipo de material elegido.
  // clave: 'F1-A'..'F1-D' (Tabla 1.3) o 'F2-<id>' (Figura 3 de las Indicaciones).
  function velocidadMaxima(tablas, B, clave) {
    var partes = clave.split('-');
    var i;
    if (partes[0] === 'F1') {
      var filas = tablas.anchurasYVelocidades.filas;
      for (i = 0; i < filas.length; i++) {
        if (filas[i].B === B) {
          return { vmax: filas[i].vmax[partes[1]], vmin: null, tabla: 'F1', fila: i, columna: partes[1] };
        }
      }
      return null;
    }
    var materiales = tablas.velocidadesFabricante2.materiales;
    for (i = 0; i < materiales.length; i++) {
      if (materiales[i].id !== partes[1]) continue;
      var tramos = materiales[i].tramos;
      for (var t = 0; t < tramos.length; t++) {
        var desde = tramos[t].desde;
        var hasta = tramos[t].hasta;
        if ((desde === null || B >= desde) && (hasta === null || B <= hasta)) {
          return { vmax: tramos[t].vmax, vmin: esNumero(tramos[t].vmin) ? tramos[t].vmin : null,
            tabla: 'F2', fila: i, tramo: t };
        }
      }
      return null;
    }
    return null;
  }

  function claveMaterialValida(tablas, clave) {
    if (typeof clave !== 'string') return false;
    var partes = clave.split('-');
    if (partes.length !== 2) return false;
    if (partes[0] === 'F1') return tablas.anchurasYVelocidades.categorias.hasOwnProperty(partes[1]);
    if (partes[0] === 'F2') {
      return tablas.velocidadesFabricante2.materiales.some(function (m) { return m.id === partes[1]; });
    }
    return false;
  }

  // Coeficiente de seguridad S de la banda textil según el número de capas z (Tabla 4.1).
  function coeficienteSeguridad(tablas, z) {
    var filas = tablas.coeficienteSeguridadCapas.filas;
    for (var i = 0; i < filas.length; i++) {
      if (z >= filas[i].zMin && (filas[i].zMax === null || z <= filas[i].zMax)) return filas[i].S;
    }
    return null;
  }

  /* ----------------------------------------------------------- 1. inclinación */

  function inclinacion(L, H) {
    var seno = H / L;
    var delta = Math.asin(seno);
    return { seno: seno, delta: delta, grados: delta / GRADOS };
  }

  // Factor k de reducción de la capacidad por la inclinación (se usa |δ|).
  function factorK(tablas, deltaGrados, kManual) {
    var angulo = Math.abs(deltaGrados);
    if (esNumero(kManual)) return { k: kManual, origen: 'manual', angulo: angulo, interp: null };
    var it = interpolar(tablas.factorInclinacion.filas, angulo);
    return { k: it.valor, origen: 'tabla', angulo: angulo, interp: it };
  }

  /* ------------------------------------------------------ 2. anchura mínima */

  // granulometria: 'mixto' (10 % gruesos, 90 % finos) o 'uniforme' (100 % gruesos).
  function anchuraMinima(tablas, tamMax, granulometria, beta) {
    var filas = tablas.anchurasYVelocidades.filas;
    var r = { tamMax: tamMax, granulometria: granulometria, sinTrozos: false, BTabla: null,
      filaTabla: null, filaFactor: null, factor: null, BFactorReq: null, BFactor: null, Bmin: null };
    var i;
    if (tamMax <= 0) {
      r.sinTrozos = true;
      r.BTabla = filas[0].B;
      r.BFactorReq = 0;
      r.BFactor = filas[0].B;
      r.Bmin = filas[0].B;
      return r;
    }
    for (i = 0; i < filas.length; i++) {
      if (mayorOIgual(filas[i][granulometria], tamMax)) { r.BTabla = filas[i].B; r.filaTabla = i; break; }
    }
    var filasFactor = tablas.factorTamanoTerron.filas;
    for (i = 0; i < filasFactor.length; i++) {
      if (menorOIgual(beta, filasFactor[i].betaMax)) {
        r.filaFactor = i;
        r.factor = filasFactor[i][granulometria];
        break;
      }
    }
    if (r.factor !== null) {
      r.BFactorReq = r.factor * tamMax;
      for (i = 0; i < filas.length; i++) {
        if (mayorOIgual(filas[i].B, r.BFactorReq)) { r.BFactor = filas[i].B; break; }
      }
    }
    if (r.BTabla !== null && r.BFactor !== null) r.Bmin = Math.max(r.BTabla, r.BFactor);
    return r;
  }

  /* ------------------------------------------------------------ 3. sección */

  // Anchura útil b (m) a partir de la anchura real B (m).
  function anchuraUtil(Bm) {
    return Bm <= 2 ? 0.9 * Bm - 0.05 : Bm - 0.2;
  }

  // Sección transversal del material (Indicaciones, Figura 5 / Apuntes, ec. 1.1).
  // B en mm; l3m (longitud del rodillo central) en m, solo para estaciones de 3 rodillos.
  function seccion(B, nRodillos, lambdaGrados, betaGrados, l3m) {
    var Bm = B / 1000;
    var b = anchuraUtil(Bm);
    var lambda = nRodillos === 1 ? 0 : lambdaGrados * GRADOS;
    var l3 = nRodillos === 3 ? l3m : 0;
    var tanBeta = Math.tan(betaGrados * GRADOS);
    var cosL = Math.cos(lambda);
    var senL = Math.sin(lambda);
    var lateral = b - l3;                    // anchura útil apoyada en los rodillos laterales
    var anchoSuperior = l3 + lateral * cosL; // cuerda de la parábola del talud
    var S1 = anchoSuperior * anchoSuperior * tanBeta / 6;
    // S2 es el área del trapecio de base menor l3, base mayor l3 + (b − l3)·cos λ y altura
    // (b − l3)/2·sen λ: fórmula de la Figura 5 de las Indicaciones, con la que salen los
    // Ejemplos 2 y 3 resueltos. (La ec. 1.1 de los apuntes v1 trae 1/cos λ: es una errata.)
    var S2 = (l3 + lateral / 2 * cosL) * (lateral / 2 * senL);
    return {
      Bm: Bm, b: b, l3: l3, nRodillos: nRodillos,
      lambdaGrados: nRodillos === 1 ? 0 : lambdaGrados, lambda: lambda, betaGrados: betaGrados,
      anchoSuperior: anchoSuperior, alturaCasquete: anchoSuperior * tanBeta / 4,
      profundidad: lateral / 2 * senL, S1: S1, S2: S2, S: S1 + S2
    };
  }

  /* ---------------------------------------------------------- 4. velocidad */

  // Elige la velocidad según el criterio y comprueba que cumple. Motivos de rechazo:
  // 'sinNormalizada' (vReq > máxima normalizada), 'sinVmax' (la tabla no da vmax para B),
  // 'superaVmax' (v > vmax) e 'insuficiente' (v < vReq).
  function elegirVelocidad(tablas, vReq, vmax, modo, vManual) {
    var normalizadas = tablas.velocidadesNormalizadas.valores;
    var r = { modo: modo, vReq: vReq, vmax: vmax, v: null, valida: false, motivo: null };
    if (modo === 'normalizada') {
      for (var i = 0; i < normalizadas.length; i++) {
        if (mayorOIgual(normalizadas[i], vReq)) { r.v = normalizadas[i]; break; }
      }
      if (r.v === null) { r.motivo = 'sinNormalizada'; return r; }
    } else if (modo === 'exacta') {
      r.v = vReq;
    } else if (modo === 'maxima') {
      if (vmax === null) { r.motivo = 'sinVmax'; return r; }
      r.v = vmax;
    } else {
      r.v = vManual;
    }
    if (vmax === null) { r.motivo = 'sinVmax'; return r; }
    if (!menorOIgual(r.v, vmax)) { r.motivo = 'superaVmax'; return r; }
    if (!mayorOIgual(r.v, vReq)) { r.motivo = 'insuficiente'; return r; }
    r.valida = true;
    return r;
  }

  /* ------------------------------------------------------ 5. resistencias */

  function coeficienteCL(tablas, L, CLManual) {
    if (esNumero(CLManual)) return { CL: CLManual, origen: 'manual', interp: null };
    var it = interpolar(tablas.coeficienteCL.filas, L);
    return { CL: it.valor, origen: 'tabla', interp: it };
  }

  // p: { metodo ('simplificado' | 'global'), f, L, CL, g, qRO, qRU, qB, qG, delta (rad),
  //      v, v0, mPunto, FNotras, FS1, FS2, H }
  function resistencias(p) {
    var cosDelta = Math.cos(p.delta);
    var corchete = p.qRO + p.qRU + (2 * p.qB + p.qG) * cosDelta;
    var r = { metodo: p.metodo, cosDelta: cosDelta, corchete: corchete, Lc: null, FH: null,
      FNacc: null, FN: null, FHN: null };
    if (p.metodo === 'simplificado') {
      r.Lc = p.CL * p.L;
      r.FHN = p.f * r.Lc * p.g * corchete;           // FH + FN = f·Lc·g·[...]
    } else {
      r.FH = p.f * p.L * p.g * corchete;             // FH = f·L·g·[...]
      r.FNacc = p.mPunto * (p.v - p.v0);             // aceleración del material
      r.FN = r.FNacc + p.FNotras;
      r.FHN = r.FH + r.FN;
    }
    r.FSt = p.qG * p.g * p.H;                        // elevación del material (H con signo)
    r.Fu = r.FHN + p.FS1 + p.FS2 + r.FSt;
    return r;
  }

  /* ---------------------------------------------------------- 6. potencia */

  function potencia(Fu, v, rendimiento, D) {
    var eta = rendimiento / 100;
    var r = { eta: eta, Pt: Fu * v };
    r.Pm = r.Pt / eta;
    if (esNumero(D) && D > 0) {
      r.radio = D / 2000;
      r.M = Fu * r.radio;
      r.omega = v / r.radio;
      r.rpm = r.omega * 60 / (2 * Math.PI);
    }
    return r;
  }

  /* ---------------------------------------------------------- 7. tensiones */

  // Flecha de la banda entre dos rodillos separados l (m) con tensión T (N).
  function flecha(q, g, cosDelta, l, T) {
    var h = q * g * cosDelta * l * l / (8 * T);
    return { h: h, hRel: h / l };
  }

  // Tensión mínima para que la flecha relativa no supere hRel (en tanto por uno).
  function tensionMinimaFlecha(q, g, cosDelta, l, hRel) {
    return q * g * cosDelta * l / (8 * hRel);
  }

  // Separación máxima entre rodillos para una tensión T y una flecha relativa hRel.
  function separacionMaxima(q, g, cosDelta, T, hRel) {
    return 8 * T * hRel / (q * g * cosDelta);
  }

  // p: { Fu, mu, phiGrados, qB, qG, delta (rad), lRO, lRU, flechaMax (%), g, T2adoptada }
  function tensiones(p) {
    var phi = p.phiGrados * GRADOS;
    var E = Math.exp(p.mu * phi);
    var hRelMax = p.flechaMax / 100;
    var cosDelta = Math.cos(p.delta);
    var qSup = p.qB + p.qG;
    var r = { phi: phi, E: E, hRelMax: hRelMax, cosDelta: cosDelta, qSup: qSup, qInf: p.qB };
    r.T2adh = p.Fu / (E - 1);
    r.TsupMin = tensionMinimaFlecha(qSup, p.g, cosDelta, p.lRO, hRelMax);
    r.TinfMin = tensionMinimaFlecha(p.qB, p.g, cosDelta, p.lRU, hRelMax);
    r.T2min = Math.max(r.T2adh, r.TsupMin, r.TinfMin);
    r.gobierna = r.T2min === r.T2adh ? 'adherencia' : (r.T2min === r.TsupMin ? 'flechaSup' : 'flechaInf');
    r.T2deUsuario = esNumero(p.T2adoptada);
    r.T2 = r.T2deUsuario ? p.T2adoptada : r.T2min;
    r.T1 = r.T2 + p.Fu;
    r.relacion = r.T1 / r.T2;
    r.adherenciaOK = menorOIgual(r.relacion, E);
    r.FuMaxAdh = r.T2 * (E - 1);
    r.reservaAdh = r.FuMaxAdh / p.Fu - 1;
    r.phiMinGrados = Math.log(p.Fu / r.T2 + 1) / p.mu / GRADOS;
    var fs = flecha(qSup, p.g, cosDelta, p.lRO, r.T2);
    var fi = flecha(p.qB, p.g, cosDelta, p.lRU, r.T2);
    r.hSup = fs.h;
    r.hRelSup = fs.hRel;
    r.flechaSupOK = menorOIgual(fs.hRel, hRelMax);
    r.hInf = fi.h;
    r.hRelInf = fi.hRel;
    r.flechaInfOK = menorOIgual(fi.hRel, hRelMax);
    r.lSupMax = separacionMaxima(qSup, p.g, cosDelta, r.T2, hRelMax);
    r.lInfMax = separacionMaxima(p.qB, p.g, cosDelta, r.T2, hRelMax);
    return r;
  }

  /* ------------------------------------------------------------- 8. capas */

  // Menor número de capas z que cumple R·z·B/S(z) ≥ Tmax (Apuntes, ec. 4.5 y Ejercicio 12).
  function capas(tablas, Tmax, R, B, zMinConstr, zProp) {
    var r = { Tmax: Tmax, R: R, B: B, zRes: null, iteraciones: [] };
    for (var z = 1; z <= 100; z++) {
      var Sz = coeficienteSeguridad(tablas, z);
      if (mayorOIgual(R * z * B / Sz, Tmax)) { r.zRes = z; r.SzRes = Sz; break; }
    }
    if (r.zRes === null) return r;
    r.zCalc = r.SzRes * Tmax / (R * B);
    r.z = Math.max(r.zRes, zMinConstr);
    r.Sz = coeficienteSeguridad(tablas, r.z);
    r.Trotura = R * r.z * B;
    r.Tadm = r.Trotura / r.Sz;
    r.reserva = r.Tadm / Tmax;
    r.resistenciaOK = menorOIgual(Tmax, r.Tadm);

    // Misma solución presentada como en el Ejercicio 12: se supone un intervalo de capas,
    // se calcula z con su S y se comprueba que el resultado cae dentro del intervalo.
    var filas = tablas.coeficienteSeguridadCapas.filas;
    for (var i = 0; i < filas.length; i++) {
      var zS = filas[i].S * Tmax / (R * B);
      var entero = Math.max(Math.ceil(zS - TOL * Math.max(1, zS)), filas[i].zMin);
      var coherente = filas[i].zMax === null || entero <= filas[i].zMax;
      r.iteraciones.push({ S: filas[i].S, zMin: filas[i].zMin, zMax: filas[i].zMax, zCalculado: zS,
        zEntero: entero, coherente: coherente });
      if (coherente) break;
    }

    if (esNumero(zProp)) {
      r.zProp = zProp;
      r.SzProp = coeficienteSeguridad(tablas, zProp);
      r.zCalcProp = r.SzProp * Tmax / (R * B);
      r.TadmProp = R * zProp * B / r.SzProp;
      r.propOK = menorOIgual(Tmax, r.TadmProp);
    }
    return r;
  }

  /* -------------------------------------------------------- validación */

  var CAMPOS_OPCIONALES = ['kManual', 'l3Manual', 'Qv1', 'vManual', 'qRO', 'qRU', 'mRO', 'mRU',
    'CLManual', 'D', 'T2adoptada', 'zProp'];

  function validar(e, tablas) {
    var errores = [];
    function error(campo, mensaje) { errores.push({ campo: campo, codigo: 'ENTRADA', mensaje: mensaje }); }
    function numero(campo, nombre, condicion, texto) {
      var x = e[campo];
      if (!esNumero(x)) { error(campo, nombre + ': introduzca un número.'); return false; }
      if (condicion && !condicion(x)) { error(campo, nombre + ' ' + texto); return false; }
      return true;
    }
    function opcional(campo, nombre, condicion, texto) {
      if (e[campo] === null || e[campo] === undefined) return true;
      return numero(campo, nombre, condicion, texto);
    }
    function positivo(x) { return x > 0; }
    function noNegativo(x) { return x >= 0; }

    numero('Q', 'Capacidad Q', positivo, 'debe ser mayor que 0.');
    numero('densidad', 'Densidad', function (x) { return x > 0 && x <= 10; }, 'debe estar entre 0 y 10 t/m³.');
    numero('beta', 'Ángulo de sobrecarga β', function (x) { return x > 0 && x <= 30; },
      'debe ser mayor que 0° y como máximo 30° (límite de las tablas).');
    numero('tamMax', 'Tamaño máximo de trozo', noNegativo, 'no puede ser negativo.');
    if (e.granulometria !== 'mixto' && e.granulometria !== 'uniforme') error('granulometria', 'Elija la granulometría.');
    if (!claveMaterialValida(tablas, e.materialVel)) error('materialVel', 'Elija el tipo de material para la velocidad máxima.');

    var LOK = numero('L', 'Longitud L', positivo, 'debe ser mayor que 0.');
    var HOK = numero('H', 'Desnivel H');
    if (LOK && HOK) {
      if (Math.abs(e.H) >= e.L) {
        error('H', 'El desnivel |H| debe ser menor que la longitud L.');
      } else if (Math.abs(Math.asin(e.H / e.L) / GRADOS) > 30) {
        error('H', 'La inclinación supera 30°, límite de la tabla del factor k.');
      }
    }
    opcional('kManual', 'Factor k', function (x) { return x > 0 && x <= 1; }, 'debe estar entre 0 y 1.');

    var nOK = e.nRodillos === 1 || e.nRodillos === 2 || e.nRodillos === 3;
    if (!nOK) error('nRodillos', 'El número de rodillos debe ser 1, 2 o 3.');
    if (nOK && e.nRodillos > 1) {
      numero('lambda', 'Ángulo de artesa λ', function (x) { return x > 0 && x <= 60; }, 'debe estar entre 0° y 60°.');
    }
    var anchos = anchurasNormalizadas(tablas);
    var anchuraFija = e.anchura !== 'auto';
    if (anchuraFija && anchos.indexOf(e.anchura) < 0) error('anchura', 'Elija una anchura normalizada.');
    if (e.l3Manual !== null && e.l3Manual !== undefined) {
      if (!(nOK && e.nRodillos === 3)) {
        error('l3Manual', 'La longitud del rodillo central solo se aplica a estaciones de 3 rodillos.');
      } else if (!anchuraFija) {
        error('l3Manual', 'Para fijar la longitud del rodillo central, fije también la anchura B.');
      } else if (numero('l3Manual', 'Longitud del rodillo central', noNegativo, 'no puede ser negativa.') &&
                 anchos.indexOf(e.anchura) >= 0 && !(e.l3Manual / 1000 < anchuraUtil(e.anchura / 1000))) {
        error('l3Manual', 'La longitud del rodillo central debe ser menor que la anchura útil b.');
      }
    }
    if (e.metodoSeccion === 'catalogo') {
      if (!anchuraFija) error('anchura', 'Con el Método 2 (catálogo) hay que fijar la anchura B.');
      numero('Qv1', 'Caudal volumétrico de catálogo', positivo, 'debe ser mayor que 0.');
    } else if (e.metodoSeccion !== 'formulas') {
      error('metodoSeccion', 'Elija el método de cálculo de la sección.');
    }

    if (['normalizada', 'exacta', 'maxima', 'manual'].indexOf(e.modoVelocidad) < 0) {
      error('modoVelocidad', 'Elija el criterio de velocidad.');
    } else if (e.modoVelocidad === 'manual') {
      numero('vManual', 'Velocidad', positivo, 'debe ser mayor que 0.');
    }

    numero('f', 'Coeficiente f', function (x) { return x > 0 && x <= 0.2; }, 'debe estar entre 0 y 0,2.');
    numero('qB', 'Masa de la banda qB', positivo, 'debe ser mayor que 0.');
    if (e.modoRodillos === 'estacion') {
      numero('mRO', 'Masa de la estación superior', noNegativo, 'no puede ser negativa.');
      numero('mRU', 'Masa de la estación inferior', noNegativo, 'no puede ser negativa.');
    } else if (e.modoRodillos === 'directo') {
      numero('qRO', 'qRO', noNegativo, 'no puede ser negativa.');
      numero('qRU', 'qRU', noNegativo, 'no puede ser negativa.');
    } else {
      error('modoRodillos', 'Elija cómo introducir la masa de los rodillos.');
    }
    numero('lRO', 'Separación entre rodillos superiores', positivo, 'debe ser mayor que 0.');
    numero('lRU', 'Separación entre rodillos inferiores', positivo, 'debe ser mayor que 0.');

    if (['auto', 'simplificado', 'global'].indexOf(e.metodoResist) < 0) error('metodoResist', 'Elija el método de cálculo de las resistencias.');
    opcional('CLManual', 'Coeficiente C_L', positivo, 'debe ser mayor que 0.');
    numero('v0', 'Velocidad inicial del material v0', noNegativo, 'no puede ser negativa.');
    numero('FNotras', 'Otras resistencias secundarias', noNegativo, 'no pueden ser negativas.');
    numero('FS1', 'FS1', noNegativo, 'no puede ser negativa.');
    numero('FS2', 'FS2', noNegativo, 'no puede ser negativa.');

    numero('rendimiento', 'Rendimiento', function (x) { return x > 0 && x <= 100; }, 'debe estar entre 0 y 100 %.');
    numero('mu', 'Coeficiente de rozamiento μ', function (x) { return x > 0 && x <= 1.5; }, 'debe estar entre 0 y 1,5.');
    numero('phi', 'Ángulo de abrazamiento', function (x) { return x > 0 && x <= 360; }, 'debe estar entre 0° y 360°.');
    opcional('D', 'Diámetro del tambor', positivo, 'debe ser mayor que 0.');
    numero('flechaMax', 'Flecha relativa máxima', function (x) { return x > 0 && x <= 10; }, 'debe estar entre 0 y 10 %.');
    opcional('T2adoptada', 'Tensión T2 adoptada', positivo, 'debe ser mayor que 0.');

    numero('R', 'Resistencia por capa R', positivo, 'debe ser mayor que 0.');
    numero('zMinConstr', 'Número mínimo de capas', function (x) { return Number.isInteger(x) && x >= 1 && x <= 30; },
      'debe ser un entero entre 1 y 30.');
    opcional('zProp', 'Número de capas a comprobar', function (x) { return Number.isInteger(x) && x >= 1 && x <= 100; },
      'debe ser un entero entre 1 y 100.');
    return errores;
  }

  /* ------------------------------------------------- cálculo completo */

  function calcular(entradas, tablas) {
    var e = {};
    Object.keys(entradas).forEach(function (c) { e[c] = entradas[c]; });
    CAMPOS_OPCIONALES.forEach(function (c) { if (e[c] === undefined) e[c] = null; });

    var res = { ok: false, errores: validar(e, tablas), avisos: [], datos: {}, info: {}, candidatos: [], entradas: e };
    if (res.errores.length) return res;
    var d = res.datos;
    var g = tablas.g;
    function aviso(codigo, mensaje) { res.avisos.push({ codigo: codigo, mensaje: mensaje }); }
    function fallo(codigo, mensaje) { res.errores.push({ campo: null, codigo: codigo, mensaje: mensaje }); return res; }

    // 1. Inclinación y factor k
    var inc = inclinacion(e.L, e.H);
    d.seno = inc.seno;
    d.delta = inc.delta;
    d.deltaGrados = inc.grados;
    var kInfo = factorK(tablas, inc.grados, e.kManual);
    res.info.k = kInfo;
    d.k = kInfo.k;

    // 2. Anchura mínima por el tamaño de los trozos
    var am = anchuraMinima(tablas, e.tamMax, e.granulometria, e.beta);
    res.info.anchuraMinima = am;
    d.BminTabla = am.BTabla;
    d.factorTrozo = am.factor;
    d.BminFactorReq = am.BFactorReq;
    d.BminFactor = am.BFactor;
    d.Bmin = am.Bmin;

    // 3. Elección de la anchura y de la velocidad
    var anchuraAuto = e.anchura === 'auto';
    var lista;
    if (anchuraAuto) {
      if (am.Bmin === null) {
        return fallo('TROZO_GRANDE', 'El tamaño de los trozos exige una anchura mayor que la máxima de la tabla (2200 mm).');
      }
      lista = anchurasNormalizadas(tablas).filter(function (B) { return B >= am.Bmin; });
    } else {
      lista = [e.anchura];
    }

    var elegido = null;
    for (var i = 0; i < lista.length; i++) {
      var B = lista[i];
      var cand = { B: B, geo: null, S: null, l3Origen: null };
      if (e.metodoSeccion === 'catalogo') {
        cand.S = e.Qv1 / 3600;
      } else {
        var l3mm = null;
        if (e.nRodillos === 3) {
          l3mm = esNumero(e.l3Manual) ? e.l3Manual : longitudRodilloCentral(tablas, B);
          cand.l3Origen = esNumero(e.l3Manual) ? 'manual' : 'tabla';
        }
        cand.geo = seccion(B, e.nRodillos, e.lambda, e.beta, l3mm === null ? 0 : l3mm / 1000);
        cand.S = cand.geo.S;
      }
      cand.vmaxInfo = velocidadMaxima(tablas, B, e.materialVel);
      cand.vmax = cand.vmaxInfo ? cand.vmaxInfo.vmax : null;
      cand.vReq = e.Q / (3600 * cand.S * e.densidad * d.k);
      cand.sel = elegirVelocidad(tablas, cand.vReq, cand.vmax, e.modoVelocidad, e.vManual);
      res.candidatos.push(cand);
      if (!anchuraAuto || cand.sel.valida) { elegido = cand; break; }
    }
    if (elegido === null) {
      return fallo('SIN_ANCHURA', 'Ninguna anchura normalizada cumple a la vez la capacidad pedida y la velocidad máxima.' +
        (e.modoVelocidad === 'normalizada' ? ' Si la velocidad máxima del material es menor que la menor velocidad normalizada (0,66 m/s), ' +
          'use el criterio de velocidad «exacta» o «manual».' : ''));
    }
    if (elegido.sel.v === null) {
      return fallo('SIN_VELOCIDAD', elegido.sel.motivo === 'sinVmax'
        ? 'La tabla de velocidades máximas no da valor para esta anchura y este material.'
        : 'La velocidad necesaria supera la mayor velocidad normalizada (5,24 m/s).');
    }
    res.info.eleccion = elegido;

    var geo = elegido.geo;
    d.B = elegido.B;
    d.b = geo ? geo.b : null;
    d.l3 = geo ? geo.l3 : null;
    d.S1 = geo ? geo.S1 : null;
    d.S2 = geo ? geo.S2 : null;
    d.S = elegido.S;
    d.Qv1m = 3600 * elegido.S;
    d.vmax = elegido.vmax;
    d.vmin = elegido.vmaxInfo ? elegido.vmaxInfo.vmin : null;
    d.vReq = elegido.vReq;
    d.v = elegido.sel.v;
    d.Qreal = 3600 * d.v * d.S * e.densidad * d.k;
    d.QvReal = 3600 * d.v * d.S * d.k;
    d.llenado = e.Q / d.Qreal;
    d.trozoOK = am.Bmin !== null && d.B >= am.Bmin;
    d.velocidadOK = d.vmax !== null && menorOIgual(d.v, d.vmax);
    d.capacidadOK = mayorOIgual(d.Qreal, e.Q);
    if (!d.trozoOK) aviso('TROZO', 'La anchura elegida es menor que la mínima exigida por el tamaño de los trozos.');
    if (d.vmax === null) aviso('SIN_VMAX', 'La tabla de velocidades máximas no da valor para esta anchura: no se puede comprobar la velocidad.');
    else if (!d.velocidadOK) aviso('VELOCIDAD', 'La velocidad supera la máxima recomendada por el fabricante.');
    if (d.vmin !== null && d.v < d.vmin - TOL) aviso('VELOCIDAD_BAJA', 'La velocidad es menor que el intervalo recomendado por la tabla.');
    if (!d.capacidadOK) aviso('CAPACIDAD', 'La capacidad de la cinta es menor que la capacidad requerida.');

    // 4. Masas por unidad de longitud
    d.qG = e.Q / (3.6 * d.v);
    d.mPunto = d.qG * d.v;
    if (e.modoRodillos === 'estacion') {
      d.qRO = e.mRO / e.lRO;
      d.qRU = e.mRU / e.lRU;
    } else {
      d.qRO = e.qRO;
      d.qRU = e.qRU;
    }

    // 5. Resistencias al movimiento
    var metodo = e.metodoResist === 'auto' ? (e.L > 80 ? 'simplificado' : 'global') : e.metodoResist;
    d.metodoResist = metodo;
    d.CL = null;
    if (metodo === 'simplificado') {
      var cl = coeficienteCL(tablas, e.L, e.CLManual);
      res.info.CL = cl;
      d.CL = cl.CL;
      if (cl.origen === 'tabla' && cl.interp.tipo !== 'exacto' && cl.interp.tipo !== 'interpolado') {
        aviso('CL_FUERA', 'La longitud está fuera de la tabla de C_L; se ha tomado el valor del extremo de la tabla.');
      }
      if (e.L <= 80) aviso('CL_CORTA', 'El método simplificado (C_L) está pensado para L > 80 m.');
    }
    var rr = resistencias({ metodo: metodo, f: e.f, L: e.L, CL: d.CL, g: g, qRO: d.qRO, qRU: d.qRU,
      qB: e.qB, qG: d.qG, delta: d.delta, v: d.v, v0: e.v0, mPunto: d.mPunto, FNotras: e.FNotras,
      FS1: e.FS1, FS2: e.FS2, H: e.H });
    d.cosDelta = rr.cosDelta;
    d.corchete = rr.corchete;
    d.Lc = rr.Lc;
    d.FH = rr.FH;
    d.FNacc = rr.FNacc;
    d.FN = rr.FN;
    d.FHN = rr.FHN;
    d.FSt = rr.FSt;
    d.Fu = rr.Fu;

    // 6. Potencia
    var pp = potencia(d.Fu, d.v, e.rendimiento, e.D);
    d.Pt = pp.Pt;
    d.Pm = pp.Pm;
    d.M = esNumero(pp.M) ? pp.M : null;
    d.omega = esNumero(pp.omega) ? pp.omega : null;
    d.rpm = esNumero(pp.rpm) ? pp.rpm : null;

    if (!(d.Fu > 0)) {
      aviso('FU_NO_POSITIVA', 'La fuerza Fu no es positiva: la cinta descendente arrastra al motor (funciona como freno). ' +
        'El cálculo de tensiones y capas de esta aplicación supone un tambor motriz, por lo que no se realiza.');
      res.ok = true;
      return res;
    }

    // 7. Tensiones
    var tt = tensiones({ Fu: d.Fu, mu: e.mu, phiGrados: e.phi, qB: e.qB, qG: d.qG, delta: d.delta,
      lRO: e.lRO, lRU: e.lRU, flechaMax: e.flechaMax, g: g, T2adoptada: e.T2adoptada });
    res.info.tensiones = tt;
    ['E', 'T2adh', 'TsupMin', 'TinfMin', 'T2min', 'gobierna', 'T2', 'T1', 'relacion', 'adherenciaOK',
      'FuMaxAdh', 'reservaAdh', 'phiMinGrados', 'hSup', 'hRelSup', 'flechaSupOK', 'hInf', 'hRelInf',
      'flechaInfOK', 'lSupMax', 'lInfMax'].forEach(function (c) { d[c] = tt[c]; });
    if (!tt.adherenciaOK) aviso('ADHERENCIA', 'Con la T2 adoptada la banda patinaría sobre el tambor motriz.');
    if (!tt.flechaSupOK) aviso('FLECHA_SUP', 'Con la T2 adoptada la flecha del ramal superior supera el límite.');
    if (!tt.flechaInfOK) aviso('FLECHA_INF', 'Con la T2 adoptada la flecha del ramal inferior supera el límite.');
    // Apuntes, pág. 25: no es recomendable diseñar exactamente en el límite teórico de deslizamiento.
    if (!tt.T2deUsuario && tt.gobierna === 'adherencia') {
      aviso('ADHERENCIA_LIMITE', 'La T2 mínima la fija la adherencia, así que la banda trabaja justo en el límite teórico de ' +
        'deslizamiento (reserva 0 %). Los apuntes recomiendan no diseñar exactamente en ese límite: introduzca en «T2 adoptada» un valor algo mayor.');
    }

    // 8. Número de capas
    var cc = capas(tablas, d.T1, e.R, d.B, e.zMinConstr, e.zProp);
    res.info.capas = cc;
    if (cc.zRes === null) {
      return fallo('CAPAS', 'Harían falta más de 100 capas: aumente la resistencia por capa R o la anchura B.');
    }
    d.zRes = cc.zRes;
    d.SzRes = cc.SzRes;
    d.zCalc = cc.zCalc;
    d.z = cc.z;
    d.Sz = cc.Sz;
    d.Trotura = cc.Trotura;
    d.Tadm = cc.Tadm;
    d.reservaBanda = cc.reserva;
    d.resistenciaOK = cc.resistenciaOK;
    if (esNumero(e.zProp)) {
      d.zProp = cc.zProp;
      d.SzProp = cc.SzProp;
      d.zCalcProp = cc.zCalcProp;
      d.TadmProp = cc.TadmProp;
      d.propOK = cc.propOK;
      if (!cc.propOK) aviso('BANDA_PROPUESTA', 'La banda propuesta no resiste la tensión máxima.');
    }
    res.ok = true;
    return res;
  }

  return {
    version: '1.0',
    GRADOS: GRADOS,
    interpolar: interpolar,
    anchurasNormalizadas: anchurasNormalizadas,
    longitudRodilloCentral: longitudRodilloCentral,
    velocidadMaxima: velocidadMaxima,
    coeficienteSeguridad: coeficienteSeguridad,
    inclinacion: inclinacion,
    factorK: factorK,
    anchuraMinima: anchuraMinima,
    anchuraUtil: anchuraUtil,
    seccion: seccion,
    elegirVelocidad: elegirVelocidad,
    coeficienteCL: coeficienteCL,
    resistencias: resistencias,
    potencia: potencia,
    flecha: flecha,
    tensionMinimaFlecha: tensionMinimaFlecha,
    separacionMaxima: separacionMaxima,
    tensiones: tensiones,
    capas: capas,
    validar: validar,
    calcular: calcular
  };
}));
