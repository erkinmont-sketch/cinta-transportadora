/*
 * ejemplos_clase.js — Comprueba la aplicación con los ejemplos resueltos en la documentación
 * de clase (Indicaciones-ejercicios_v6 y apuntes_cintastransportadoras_v1).
 *
 * Cada fila compara un valor publicado en clase con el que calcula la aplicación.
 * Estados:
 *   'ok'       → coinciden hasta la última cifra publicada (diferencia ≤ media unidad).
 *   'redondeo' → la diferencia se debe a un redondeo intermedio hecho en la resolución de
 *                clase (se explica en la nota) y está dentro de la tolerancia indicada.
 *   'errata'   → el valor de clase contiene una errata; la aplicación da el valor correcto,
 *                que se comprueba aquí con un cálculo directo.
 *   'fallo'    → la aplicación no coincide (no debería aparecer nunca).
 */
(function (raiz, fabrica) {
  'use strict';
  if (typeof module === 'object' && module.exports) {
    module.exports = fabrica();
  } else {
    raiz.EjemplosClase = fabrica();
  }
}(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  function evaluar(fila) {
    var dif = Math.abs(fila.app - fila.clase);
    var mediaUnidad = 0.5 * Math.pow(10, -fila.decimales);
    fila.diferencia = fila.app - fila.clase;
    if (fila.errata) {
      var ok = Math.abs(fila.app - fila.correcto) <= 1e-9 * Math.abs(fila.correcto);
      fila.estado = ok ? 'errata' : 'fallo';
    } else if (dif <= mediaUnidad * (1 + 1e-9)) {
      fila.estado = 'ok';
    } else if (fila.tolerancia !== undefined && dif <= fila.tolerancia) {
      fila.estado = 'redondeo';
    } else {
      fila.estado = 'fallo';
    }
    return fila;
  }

  function ejecutar(Cinta, tablas) {
    var g = tablas.g;
    var grupos = [];
    function grupo(fuente, titulo) {
      var gr = { fuente: fuente, titulo: titulo, filas: [] };
      grupos.push(gr);
      // fila(magnitud, unidad, valor de clase, cifras decimales publicadas, valor de la app, opciones)
      return function (magnitud, unidad, clase, decimales, app, opciones) {
        var f = { magnitud: magnitud, unidad: unidad, clase: clase, decimales: decimales, app: app };
        if (opciones) Object.keys(opciones).forEach(function (c) { f[c] = opciones[c]; });
        gr.filas.push(evaluar(f));
      };
    }
    var GR = Math.PI / 180;
    var fila, s, r, t, c, res;

    /* ---------- Indicaciones, Ejemplo 2: sección para B = 650 mm y β = 15° ---------- */
    fila = grupo('Indicaciones, Ejemplo 2', 'Sección máxima de material para B = 650 mm, β = 15°');
    fila('Anchura útil b', 'm', 0.535, 3, Cinta.anchuraUtil(0.65));
    s = Cinta.seccion(650, 1, 0, 15, 0);
    fila('1 rodillo plano: S = S1', 'm²', 0.01278, 5, s.S);
    fila('1 rodillo plano: S2', 'm²', 0, 5, s.S2);
    s = Cinta.seccion(650, 2, 30, 15, 0);
    fila('2 rodillos en V a 30°: S1', 'm²', 0.00959, 5, s.S1);
    fila('2 rodillos en V a 30°: S2', 'm²', 0.03098, 5, s.S2);
    fila('2 rodillos en V a 30°: S', 'm²', 0.04057, 5, s.S);
    s = Cinta.seccion(650, 3, 45, 15, 0.25);
    fila('3 rodillos a 45° (l3 = 0,25 m): S1', 'm²', 0.00910, 5, s.S1);
    fila('3 rodillos a 45° (l3 = 0,25 m): S2', 'm²', 0.03534, 5, s.S2);
    fila('3 rodillos a 45° (l3 = 0,25 m): S', 'm²', 0.04444, 5, s.S, { tolerancia: 1e-5,
      nota: 'En clase se suman S1 y S2 ya redondeados (0,00910 + 0,03534); sin redondear sale 0,04445 m².' });

    /* ---------- Indicaciones, Ejemplo 3: granito, 100 t/h ---------- */
    fila = grupo('Indicaciones, Ejemplo 3', 'Granito, 100 t/h, L = 100 m horizontal, 3 rodillos a 30°');
    var ej3 = { Q: 100, densidad: 1.5, beta: 15, tamMax: 10, granulometria: 'uniforme', materialVel: 'F1-C',
      L: 100, H: 0, kManual: null, nRodillos: 3, lambda: 30, l3Manual: null, anchura: 'auto',
      metodoSeccion: 'formulas', Qv1: null, modoVelocidad: 'manual', vManual: 1.52, f: 0.02, qB: 3.8,
      modoRodillos: 'estacion', mRO: 5.4, mRU: 4.0, qRO: null, qRU: null, lRO: 1.2, lRU: 2.4,
      metodoResist: 'auto', CLManual: null, v0: 0, FNotras: 0, FS1: 0, FS2: 0, rendimiento: 85,
      mu: 0.02, phi: 210, D: null, flechaMax: 1, T2adoptada: null, R: 200, zMinConstr: 3, zProp: 3 };
    res = Cinta.calcular(ej3, tablas);
    r = res.datos;
    fila('Anchura mínima (tamaño 10 mm uniforme)', 'mm', 400, 0, r.Bmin);
    fila('Anchura útil b', 'm', 0.31, 2, r.b);
    fila('Rodillo central l3 (tabla)', 'm', 0.16, 2, r.l3);
    fila('S1', 'm²', 0.00375, 5, r.S1);
    fila('S2', 'm²', 0.008435, 6, r.S2, { tolerancia: 1e-6,
      nota: 'En clase el valor está truncado (0,0084357 → 0,008435).' });
    fila('S = S1 + S2', 'm²', 0.012185, 6, r.S, { tolerancia: 5e-6,
      nota: 'En clase se suman los valores ya redondeados de S1 y S2.' });
    fila('Velocidad necesaria v = Q/(3600·S·γ·k)', 'm/s', 1.52, 2, r.vReq);
    fila('Velocidad máxima (opción C, B = 400 mm)', 'm/s', 2.09, 2, r.vmax,
      { nota: 'En el texto se redondea a «2 m/s».' });
    fila('Masa lineal de la carga qG (con v = 1,52 m/s)', 'kg/m', 18.27, 2, r.qG);
    fila('Coeficiente C_L (L = 100 m)', '—', 1.7, 1, r.CL);
    fila('Fuerza tangencial Fu (con v = 1,52 m/s)', 'N', 1068.56, 2, r.Fu, { tolerancia: 0.2,
      nota: 'En clase se usa qG redondeado (18,27 kg/m); sin redondear sale 1068,71 N.' });
    fila('Potencia del motor (con v = 1,52 m/s)', 'kW', 1.91, 2, r.Pm / 1000);
    var ej3b = {};
    Object.keys(ej3).forEach(function (k) { ej3b[k] = ej3[k]; });
    ej3b.modoVelocidad = 'exacta';
    ej3b.vManual = null;
    fila('Potencia del motor (velocidad exacta, sin redondear)', 'kW', 1.91, 2,
      Cinta.calcular(ej3b, tablas).datos.Pm / 1000);
    fila('Banda de 3 capas de 200 N/mm: ¿es adecuada? (1 = sí)', '—', 1, 0, r.propOK ? 1 : 0,
      { nota: 'La resolución de clase no llega a este apartado; T1 = ' + r.T1.toFixed(0) +
        ' N < T_adm = ' + r.TadmProp.toFixed(0) + ' N.' });

    /* ---------- Indicaciones, Ejemplo 1: caliza, 1500 t/h ---------- */
    fila = grupo('Indicaciones, Ejemplo 1', 'Caliza, 1500 t/h, L = 805 m, H = 150 m, artesa de 35°');
    var inc = Cinta.inclinacion(805, 150);
    fila('Inclinación δ', '°', 10.73, 2, inc.grados, { tolerancia: 0.01,
      nota: 'En clase el ángulo está truncado (10,739° → 10,73°).' });
    fila('Factor k', '—', 0.95, 2, Cinta.factorK(tablas, inc.grados, null).k, { tolerancia: 0.01,
      nota: 'En clase se toma el valor tabulado de 10° (0,95); la aplicación interpola entre 10° y 12° (0,9426). Con k = 0,95 introducido a mano se reproduce la resolución de clase.' });
    var am = Cinta.anchuraMinima(tablas, 250, 'mixto', 15);
    fila('Anchura por tamaño: 3 × 250 mm', 'mm', 750, 0, am.BFactorReq);
    fila('Anchura mínima normalizada', 'mm', 800, 0, am.Bmin);
    var m2 = { Q: 1500, densidad: 1.4, beta: 15, tamMax: 250, granulometria: 'mixto', materialVel: 'F2-granos',
      L: 805, H: 150, kManual: 0.95, nRodillos: 3, lambda: 35, l3Manual: null, anchura: 800,
      metodoSeccion: 'catalogo', Qv1: 258, modoVelocidad: 'manual', vManual: 3.35, f: 0.02, qB: 16,
      modoRodillos: 'estacion', mRO: 26.4, mRU: 24, qRO: null, qRU: null, lRO: 1.2, lRU: 3,
      metodoResist: 'auto', CLManual: null, v0: 0, FNotras: 0, FS1: 0, FS2: 0, rendimiento: 90,
      mu: 0.35, phi: 210, D: 1000, flechaMax: 1, T2adoptada: null, R: 400, zMinConstr: 3, zProp: null };
    r = Cinta.calcular(m2, tablas).datos;
    fila('Método 2, B = 800 mm: caudal volumétrico (v = 3,35 m/s, k = 0,95)', 'm³/h', 821, 0, r.QvReal);
    fila('Método 2, B = 800 mm: caudal másico', 't/h', 1150, 0, r.Qreal);
    fila('Método 2, B = 800 mm: ¿cumple 1500 t/h? (0 = no)', '—', 0, 0, r.capacidadOK ? 1 : 0);
    m2.anchura = 1000;
    m2.Qv1 = 415;
    r = Cinta.calcular(m2, tablas).datos;
    fila('Método 2, B = 1000 mm: caudal volumétrico', 'm³/h', 1320.7, 1, r.QvReal);
    fila('Método 2, B = 1000 mm: caudal másico', 't/h', 1849, 0, r.Qreal);
    var ej1 = null;
    tablas.ejemplos.forEach(function (e) { if (e.id === 'indicaciones1-metodo1') ej1 = e.entradas; });
    r = Cinta.calcular(ej1, tablas).datos;
    fila('Método 1 (fórmulas): anchura elegida', 'mm', 1000, 0, r.B);
    fila('Método 1 (fórmulas): velocidad elegida', 'm/s', 3.35, 2, r.v);

    /* ---------- Apuntes, Ejemplo 1: resistencias con L < 80 m ---------- */
    fila = grupo('Apuntes, Ejemplo 1', 'Resistencias de avance, L = 60 m (método global)');
    var a1 = Cinta.resistencias({ metodo: 'global', f: 0.02, L: 60, CL: null, g: g, qRO: 10, qRU: 0, qB: 8,
      qG: 25, delta: 0, v: 2, v0: 0, mPunto: 25 * 2, FNotras: 20, FS1: 0, FS2: 40, H: 0 });
    fila('FH', 'N', 600.37, 2, a1.FH);
    fila('FN,acc = ṁ·(v − v0)', 'N', 100, 0, a1.FNacc);
    fila('FN', 'N', 120, 0, a1.FN);
    fila('Fu', 'N', 760.37, 2, a1.Fu);

    /* ---------- Apuntes, Ejemplo 2: longitud corregida ---------- */
    fila = grupo('Apuntes, Ejemplo 2', 'Cálculo con longitud corregida, L = 200 m, C = 1,45');
    var a2 = Cinta.resistencias({ metodo: 'simplificado', f: 0.02, L: 200, CL: 1.45, g: g, qRO: 10, qRU: 0,
      qB: 8, qG: 25, delta: 0, v: 2, v0: 0, mPunto: 50, FNotras: 0, FS1: 0, FS2: 40, H: 0 });
    fila('Lc = C·L', 'm', 290, 0, a2.Lc);
    fila('FH + FN', 'N', 2901.80, 2, a2.FHN);
    fila('Fu', 'N', 2941.80, 2, a2.Fu);
    fila('Potencia útil Pu', 'kW', 5.88, 2, Cinta.potencia(a2.Fu, 2, 100, null).Pt / 1000);

    /* ---------- Apuntes, Ejemplo 3: potencia ---------- */
    fila = grupo('Apuntes, Ejemplo 3', 'Potencia para la cinta del Ejemplo 1 (η = 0,90, r = 0,20 m)');
    var p3 = Cinta.potencia(a1.Fu, 2, 90, 400);
    fila('Pu', 'W', 1520.74, 2, p3.Pt);
    fila('Potencia en el eje del motor', 'kW', 1.69, 2, p3.Pm / 1000);
    fila('Par en el tambor', 'N·m', 152.07, 2, p3.M);
    fila('Velocidad angular ω', 'rad/s', 10, 0, p3.omega);
    fila('Velocidad de giro', 'rpm', 95.5, 1, p3.rpm);

    /* ---------- Apuntes, Ejemplo 4: deslizamiento ---------- */
    fila = grupo('Apuntes, Ejemplo 4', 'Tensiones límite, μ = 0,30, θ = 180°, Fu = 760,37 N');
    function tens(Fu, mu, phi, T2) {
      return Cinta.tensiones({ Fu: Fu, mu: mu, phiGrados: phi, qB: 8, qG: 25, delta: 0, lRO: 1.2, lRU: 2.4,
        flechaMax: 1, g: g, T2adoptada: T2 });
    }
    t = tens(760.37, 0.30, 180, 400);
    fila('e^(μθ)', '—', 2.5663, 4, t.E);
    fila('T1 con T2 = 400 N', 'N', 1160.37, 2, t.T1);
    fila('T1/T2 con T2 = 400 N', '—', 2.901, 3, t.relacion);
    fila('¿Adherencia con T2 = 400 N? (0 = patina)', '—', 0, 0, t.adherenciaOK ? 1 : 0);
    fila('Fu máxima transmisible con T2 = 400 N', 'N', 626.53, 2, t.FuMaxAdh);
    fila('T2 mínima por adherencia', 'N', 485.45, 2, t.T2adh);
    fila('T1 con la T2 mínima', 'N', 1245.82, 2, t.T2adh + 760.37);
    t = tens(760.37, 0.30, 180, 600);
    fila('T1 con T2 = 600 N', 'N', 1360.37, 2, t.T1);
    fila('Fu máxima transmisible con T2 = 600 N', 'N', 939.80, 2, t.FuMaxAdh);
    fila('Reserva frente al deslizamiento', '%', 23.6, 1, t.reservaAdh * 100);

    /* ---------- Apuntes, Ejemplo 5: flecha ---------- */
    fila = grupo('Apuntes, Ejemplo 5', 'Flecha entre rodillos (qb = 8, qg = 25 kg/m)');
    var fs = Cinta.flecha(33, g, 1, 1.2, 5000);
    var fi = Cinta.flecha(8, g, 1, 2.4, 2500);
    fila('Flecha ramal superior (T = 5000 N)', 'mm', 11.65, 2, fs.h * 1000);
    fila('Flecha relativa ramal superior', '%', 0.971, 3, fs.hRel * 100);
    fila('Flecha ramal inferior (T = 2500 N)', 'mm', 22.60, 2, fi.h * 1000);
    fila('Flecha relativa ramal inferior', '%', 0.942, 3, fi.hRel * 100);
    fila('Tensión mínima ramal superior (1 %)', 'N', 4855.95, 2, Cinta.tensionMinimaFlecha(33, g, 1, 1.2, 0.01));
    fila('Tensión mínima ramal inferior (1 %)', 'N', 2354.40, 2, Cinta.tensionMinimaFlecha(8, g, 1, 2.4, 0.01));

    /* ---------- Apuntes, Ejemplo 6: número de capas ---------- */
    fila = grupo('Apuntes, Ejemplo 6', 'Número de capas, Tmáx = 18 000 N, B = 800 mm, R = 160 N/mm');
    c = Cinta.capas(tablas, 18000, 160, 800, 1, null);
    fila('z calculado', '—', 1.547, 3, c.zCalc);
    fila('z adoptado (entero superior)', 'capas', 2, 0, c.zRes);
    fila('Tensión admisible con 2 capas', 'N', 32000, 0, c.Tadm, { errata: true, correcto: 160 * 2 * 800 / 11,
      nota: 'Errata en los apuntes: 256 000/11 = 23 273 N (no 32 000 N); la reserva es 1,29 y no 1,78. La banda de 2 capas sigue siendo válida.' });

    /* ---------- Apuntes, Ejemplo 7: resistencias con desnivel ---------- */
    fila = grupo('Apuntes, Ejemplo 7', 'Resistencias de avance, L = 50 m, H = 4 m (método global)');
    inc = Cinta.inclinacion(50, 4);
    fila('Inclinación δ', '°', 4.59, 2, inc.grados);
    var a7 = Cinta.resistencias({ metodo: 'global', f: 0.025, L: 50, CL: null, g: g, qRO: 12, qRU: 0, qB: 10,
      qG: 30, delta: inc.delta, v: 1.5, v0: 0.5, mPunto: 30 * 1.5, FNotras: 25, FS1: 0, FS2: 50, H: 4 });
    fila('FH', 'N', 758.31, 2, a7.FH);
    fila('FN,acc', 'N', 45, 0, a7.FNacc);
    fila('FN', 'N', 70, 0, a7.FN);
    fila('FSt', 'N', 1177.2, 1, a7.FSt);
    fila('Fu', 'N', 2055.51, 2, a7.Fu);

    /* ---------- Apuntes, Ejemplo 8: longitud corregida y desnivel ---------- */
    fila = grupo('Apuntes, Ejemplo 8', 'L = 250 m, H = 12 m, v = 2,5 m/s, C = 1,35');
    inc = Cinta.inclinacion(250, 12);
    fila('Inclinación', '°', 2.75, 2, inc.grados);
    var a8 = Cinta.resistencias({ metodo: 'simplificado', f: 0.025, L: 250, CL: 1.35, g: g, qRO: 12, qRU: 0,
      qB: 9, qG: 30, delta: inc.delta, v: 2.5, v0: 0, mPunto: 75, FNotras: 0, FS1: 0, FS2: 60, H: 12 });
    fila('Lc', 'm', 337.5, 1, a8.Lc);
    fila('FH + FN', 'N', 4961.73, 2, a8.FHN);
    fila('FSt', 'N', 3531.60, 2, a8.FSt);
    fila('Fu', 'N', 8553.33, 2, a8.Fu);
    fila('Potencia útil Pu', 'W', 21383.33, 2, Cinta.potencia(a8.Fu, 2.5, 100, null).Pt,
      { tolerancia: 0.01, nota: 'En clase se multiplica Fu ya redondeado (8553,33 · 2,5).' });

    /* ---------- Apuntes, ejemplo completo de las páginas 39 a 44 ---------- */
    fila = grupo('Apuntes, págs. 39–44', 'Ejemplo completo: L = 200 m, H = 10 m, v = 2 m/s, C = 1,45');
    inc = Cinta.inclinacion(200, 10);
    fila('Inclinación δ', '°', 2.87, 2, inc.grados);
    var a9 = Cinta.resistencias({ metodo: 'simplificado', f: 0.02, L: 200, CL: 1.45, g: g, qRO: 10, qRU: 0,
      qB: 8, qG: 25, delta: inc.delta, v: 2, v0: 0, mPunto: 50, FNotras: 0, FS1: 0, FS2: 40, H: 10 });
    fila('FH + FN', 'N', 2898.88, 2, a9.FHN);
    fila('FSt', 'N', 2452.50, 2, a9.FSt);
    fila('Fu', 'N', 5391.38, 2, a9.Fu);
    var p9 = Cinta.potencia(a9.Fu, 2, 90, 400);
    fila('Pu', 'kW', 10.78, 2, p9.Pt / 1000);
    fila('Potencia en el eje del motor', 'kW', 11.98, 2, p9.Pm / 1000);
    fila('Par en el tambor', 'N·m', 1078.28, 2, p9.M);
    fila('Velocidad de giro', 'rpm', 95.5, 1, p9.rpm);
    t = Cinta.tensiones({ Fu: a9.Fu, mu: 0.30, phiGrados: 180, qB: 8, qG: 25, delta: inc.delta, lRO: 1.2,
      lRU: 2.4, flechaMax: 1, g: g, T2adoptada: 4000 });
    fila('T2 mínima por adherencia', 'N', 3442, 0, t.T2adh);
    fila('T1 con T2 = 4000 N', 'N', 9391.38, 2, t.T1);
    fila('T1/T2', '—', 2.3478, 4, t.relacion);
    fila('Fu máxima transmisible', 'N', 6265, 0, t.FuMaxAdh);
    fila('Reserva frente al deslizamiento', '%', 16.2, 1, t.reservaAdh * 100);
    fs = Cinta.flecha(33, g, Math.cos(inc.delta), 1.2, 6000);
    fi = Cinta.flecha(8, g, Math.cos(inc.delta), 2.4, 4000);
    fila('Flecha ramal portante (T = 6000 N)', 'mm', 9.70, 2, fs.h * 1000);
    fila('Flecha relativa ramal portante', '%', 0.81, 2, fs.hRel * 100);
    fila('Flecha ramal de retorno (T = 4000 N)', 'mm', 14.11, 2, fi.h * 1000);
    fila('Flecha relativa ramal de retorno', '%', 0.59, 2, fi.hRel * 100);
    fila('Tensión mínima por flecha, ramal portante', 'N', 4849.88, 2, t.TsupMin);
    fila('Tensión mínima por flecha, ramal de retorno', 'N', 2351.46, 2, t.TinfMin);
    c = Cinta.capas(tablas, t.T1, 160, 800, 3, null);
    fila('z calculado', '—', 0.807, 3, c.zCalc);
    fila('Capas adoptadas', 'capas', 3, 0, c.z);
    fila('Tensión admisible con 3 capas', 'N', 34909, 0, c.Tadm);

    /* ---------- Apuntes, Ejemplo 9 ---------- */
    fila = grupo('Apuntes, Ejemplo 9', 'Adherencia: Fu = 8000 N, T2 = 3000 N, μ = 0,30');
    t = tens(8000, 0.30, 180, 3000);
    fila('e^(μθ) con θ = 180°', '—', 2.566, 3, t.E);
    fila('Fu máxima con θ = 180°', 'N', 4698, 0, t.FuMaxAdh, { tolerancia: 1.5,
      nota: 'En clase se usa e^(μθ) redondeado a 2,566 (sin redondear: 4699 N).' });
    fila('Ángulo mínimo de abrazamiento', '°', 248.1, 1, t.phiMinGrados);
    t = tens(8000, 0.30, 270, 3000);
    fila('e^(μθ) con θ = 270°', '—', 4.112, 3, t.E, { errata: true, correcto: Math.exp(0.3 * 1.5 * Math.PI),
      nota: 'Errata en los apuntes: e^1,4137 = 4,111 (no 4,112).' });
    fila('Fu máxima con θ = 270°', 'N', 9336, 0, t.FuMaxAdh, { errata: true,
      correcto: 3000 * (Math.exp(0.3 * 1.5 * Math.PI) - 1),
      nota: 'Consecuencia de la errata anterior: 3000·(4,1112 − 1) = 9334 N. La conclusión (la adherencia es suficiente) no cambia.' });
    fila('Reserva frente al deslizamiento', '%', 16.7, 1, t.reservaAdh * 100);
    fila('T1', 'N', 11000, 0, t.T1);
    fila('T1/T2', '—', 3.667, 3, t.relacion);

    /* ---------- Apuntes, Ejemplo 10 ---------- */
    fila = grupo('Apuntes, Ejemplo 10', 'Fu = 12 000 N, T2 = 3500 N, μ = 0,28, B = 800 mm, R = 160 N/mm, z = 3');
    t = tens(12000, 0.28, 180, 3500);
    fila('e^(μθ) con θ = 180°', '—', 2.410, 3, t.E);
    fila('Fu máxima con θ = 180°', 'N', 4935, 0, t.FuMaxAdh);
    fila('T2 necesaria por adherencia', 'N', 8511, 0, t.T2adh, { tolerancia: 1,
      nota: 'En clase se usa e^(μθ) redondeado a 2,410 (sin redondear: 8510 N).' });
    fila('T1 con esa T2', 'N', 20511, 0, t.T2adh + 12000, { tolerancia: 1,
      nota: 'Mismo redondeo que la fila anterior.' });
    c = Cinta.capas(tablas, 15500, 160, 800, 3, 3);
    fila('Tensión admisible con 3 capas', 'N', 34909, 0, c.TadmProp);
    fila('Tensión mínima por flecha, retorno (2,40 m)', 'N', 2354, 0, Cinta.tensionMinimaFlecha(8, g, 1, 2.4, 0.01));
    fila('Ángulo mínimo de abrazamiento', '°', 304.5, 1, t.phiMinGrados);
    t = tens(12000, 0.28, 315, 3500);
    fila('e^(μθ) con θ = 315°', '—', 4.662, 3, t.E);
    fila('Fu máxima con θ = 315°', 'N', 12817, 0, t.FuMaxAdh, { tolerancia: 1.5,
      nota: 'En clase se usa e^(μθ) redondeado a 4,662 (sin redondear: 12 816 N).' });
    fila('Reserva frente al deslizamiento', '%', 6.8, 1, t.reservaAdh * 100);
    fila('T1', 'N', 15500, 0, t.T1);
    fila('T1/T2', '—', 4.429, 3, t.relacion);

    /* ---------- Apuntes, Ejercicio 11 ---------- */
    fila = grupo('Apuntes, Ejercicio 11', 'Potencia: Ft = 1000 N, v = 2 m/s, η = 90 %, D = 200 mm');
    var p11 = Cinta.potencia(1000, 2, 90, 200);
    fila('Potencia útil', 'W', 2000, 0, p11.Pt);
    fila('Potencia del motor', 'W', 2222.2, 1, p11.Pm);
    fila('Velocidad angular', 'rad/s', 20, 0, p11.omega);
    fila('Velocidad de giro', 'rpm', 191, 0, p11.rpm);

    /* ---------- Apuntes, Ejercicio 12 ---------- */
    fila = grupo('Apuntes, Ejercicio 12', 'Capas: B = 800 mm, R = 180 N/mm, Tmáx = 125 000 N');
    c = Cinta.capas(tablas, 125000, 180, 800, 1, null);
    fila('Primera iteración (S = 12): z', '—', 10.42, 2, 12 * 125000 / (180 * 800));
    fila('Segunda iteración (S = 13): z', '—', 11.28, 2, c.zCalc);
    fila('Número mínimo de capas', 'capas', 12, 0, c.zRes);
    fila('Coeficiente de seguridad aplicado', '—', 13, 0, c.SzRes);

    /* ---------- Apuntes, Ejercicio 13 ---------- */
    fila = grupo('Apuntes, Ejercicio 13', 'Capacidad: 20°, v = 1,68 m/s, A = 0,014 m², 1500 kg/m³');
    var k20 = Cinta.factorK(tablas, 20, null).k;
    fila('Factor k a 20°', '—', 0.81, 2, k20);
    // Se calcula con el motor completo: sección de catálogo A = 0,014 m² (Qv = 50,4 m³/h a 1 m/s).
    var e13 = {};
    Object.keys(ej3).forEach(function (k) { e13[k] = ej3[k]; });
    e13.anchura = 650;
    e13.metodoSeccion = 'catalogo';
    e13.Qv1 = 0.014 * 3600;
    e13.vManual = 1.68;
    e13.kManual = k20;
    fila('Capacidad Q = 3600·v·A·γ·k', 't/h', 103.1, 1, Cinta.calcular(e13, tablas).datos.Qreal,
      { errata: true, correcto: 3.6 * 1.68 * 0.014 * 1500 * 0.81,
        nota: 'Errata en los apuntes: 3,6 · 1,68 · 0,014 · 1500 · 0,81 = 102,88 t/h (no 103,1).' });

    /* ---------- Apuntes, Ejercicio 14 ---------- */
    fila = grupo('Apuntes, Ejercicio 14', 'Tensión mínima: P = 100 kW, v = 2 m/s, μ = 0,2, θ = 160°');
    var Ft = 100000 / 2;
    t = tens(Ft, 0.2, 160, null);
    fila('Fuerza tangencial', 'N', 50000, 0, Ft);
    fila('Ángulo en radianes', 'rad', 2.793, 3, t.phi);
    fila('e^(μθ)', '—', 1.748, 3, t.E);
    fila('T2 mínima', 'kN', 66.85, 2, t.T2adh / 1000, { tolerancia: 0.02,
      nota: 'En clase se usa e^(μθ) redondeado a 1,748 (sin redondear: 66,84 kN).' });

    /* ---------- Apuntes, Ejercicio 15 ---------- */
    fila = grupo('Apuntes, Ejercicio 15', 'Separación máxima entre rodillos: T = 20 kN, q = 150 kg/m, flecha 1 %');
    fila('Separación máxima', 'm', 1.087, 3, Cinta.separacionMaxima(150, g, 1, 20000, 0.01));

    return grupos;
  }

  function resumen(grupos) {
    var r = { total: 0, ok: 0, redondeo: 0, errata: 0, fallo: 0 };
    grupos.forEach(function (gr) {
      gr.filas.forEach(function (f) { r.total++; r[f.estado]++; });
    });
    return r;
  }

  return { ejecutar: ejecutar, resumen: resumen };
}));
