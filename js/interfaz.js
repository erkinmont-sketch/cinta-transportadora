/*
 * interfaz.js — Conecta la página (index.html) con el motor de cálculo (calculos.js).
 * Lee el formulario, llama a Cinta.calcular() y muestra el resultado paso a paso: fórmula,
 * valores sustituidos y resultado. También dibuja la sección del material y presenta las
 * tablas de clase (leídas de datos/datos.json) resaltando los valores utilizados.
 */
(function () {
  'use strict';

  var tablas = null;

  var NUMERICOS = ['Q', 'densidad', 'beta', 'tamMax', 'L', 'H', 'kManual', 'lambda', 'l3Manual', 'Qv1', 'vManual',
    'f', 'qB', 'mRO', 'mRU', 'qRO', 'qRU', 'lRO', 'lRU', 'CLManual', 'v0', 'FNotras', 'FS1', 'FS2',
    'rendimiento', 'mu', 'phi', 'D', 'flechaMax', 'T2adoptada', 'R', 'zMinConstr', 'zProp'];
  var OPCIONALES = ['kManual', 'l3Manual', 'Qv1', 'vManual', 'mRO', 'mRU', 'qRO', 'qRU', 'lambda', 'CLManual', 'D',
    'T2adoptada', 'zProp'];
  var SELECTORES = ['granulometria', 'materialVel', 'nRodillos', 'anchura', 'metodoSeccion', 'modoVelocidad',
    'modoRodillos', 'metodoResist'];
  var ETIQUETAS_VELOCIDAD = {
    normalizada: 'la menor velocidad normalizada (DIN 22101) que transporta Q',
    exacta: 'la velocidad exacta necesaria, sin normalizar',
    maxima: 'la velocidad máxima admisible del fabricante',
    manual: 'velocidad introducida a mano'
  };

  function $(id) { return document.getElementById(id); }

  /* ------------------------------------------------------------ números */

  // Coma decimal; espacio fino de miles solo a partir de 5 cifras (como en los apuntes).
  function fmt(x, dec) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var t = Math.abs(x).toFixed(dec);
    if (/^[0.]+$/.test(t)) return t.replace('.', ',');
    var partes = t.split('.');
    var entero = partes[0];
    if (entero.length >= 5) entero = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + entero + (partes.length > 1 ? ',' + partes[1] : '');
  }
  // Valor tal y como lo introdujo el usuario (sin redondear).
  function fe(x) {
    if (typeof x !== 'number' || !isFinite(x)) return '—';
    var t = String(Math.abs(x));
    if (t.indexOf('e') >= 0) return fmt(x, 6);
    var partes = t.split('.');
    var entero = partes[0];
    if (entero.length >= 5) entero = entero.replace(/\B(?=(\d{3})+(?!\d))/g, ' ');
    return (x < 0 ? '−' : '') + entero + (partes.length > 1 ? ',' + partes[1] : '');
  }
  // Velocidad: 2 decimales si es un valor de tabla, 4 si es un valor calculado.
  function fv(v) {
    if (typeof v !== 'number') return '—';
    return Math.abs(v * 100 - Math.round(v * 100)) < 1e-9 ? fmt(v, 2) : fmt(v, 4);
  }
  // Entre paréntesis si es negativo (para sustituir en una fórmula).
  function par(texto, x) { return x < 0 ? '(' + texto + ')' : texto; }

  function convertir(texto) {
    var t = texto.trim().replace(',', '.');
    if (!/^[+-]?(\d+\.?\d*|\.\d+)([eE][+-]?\d+)?$/.test(t)) return NaN;
    return Number(t);
  }

  /* ---------------------------------------------------- símbolos (HTML) */
  function v_(base, sub) { return '<var>' + base + '</var>' + (sub ? '<sub>' + sub + '</sub>' : ''); }
  var SIM = {
    Q: v_('Q'), S: v_('S'), S1: v_('S', '1'), S2: v_('S', '2'), b: v_('b'), B: v_('B'), l3: v_('l', '3'),
    lam: v_('λ'), beta: v_('β'), gam: v_('γ'), k: v_('k'), v: v_('v'), delta: v_('δ'), H: v_('H'), L: v_('L'),
    qG: v_('q', 'G'), qB: v_('q', 'B'), qRO: v_('q', 'RO'), qRU: v_('q', 'RU'), mRO: v_('m', 'RO'), mRU: v_('m', 'RU'),
    lRO: v_('l', 'RO'), lRU: v_('l', 'RU'), f: v_('f'), g: v_('g'), CL: v_('C', 'L'), Lc: v_('L', 'c'),
    FH: v_('F', 'H'), FN: v_('F', 'N'), FSt: v_('F', 'St'), FS1: v_('F', 'S1'), FS2: v_('F', 'S2'), Fu: v_('F', 'u'),
    mu: v_('μ'), phi: v_('φ'), eta: v_('η'), T1: v_('T', '1'), T2: v_('T', '2'), h: v_('h'), z: v_('z'), R: v_('R'),
    Sseg: v_('S'), P: v_('P'), D: v_('D'), M: v_('M'), n: v_('n'), w: v_('ω')
  };

  /* -------------------------------------------------- piezas de HTML */
  // Una línea de cálculo: nombre | fórmula = sustitución = resultado [marca].
  // extra.sep cambia el signo que precede al resultado (p. ej. '→' en líneas descriptivas).
  function calc(nombre, formula, sustitucion, resultado, extra) {
    extra = extra || {};
    var sep = extra.sep ? extra.sep + ' ' : '= ';
    return '<div class="calc"><div class="calc-nombre">' + nombre + '</div><div class="calc-expr">' +
      (formula ? '<span class="f">' + formula + '</span>' : '') +
      (sustitucion ? ' <span class="s">= ' + sustitucion + '</span>' : '') +
      (resultado ? ' <span class="r' + (extra.final ? ' final' : '') + '">' + (formula || sustitucion ? sep : '') + resultado + '</span>' : '') +
      (extra.marca || '') + '</div></div>';
  }
  function marca(ok, textoOk, textoNo) {
    return '<span class="marca ' + (ok ? 'ok' : 'no') + '">' + (ok ? '✓ ' + (textoOk || 'cumple') : '✗ ' + (textoNo || 'no cumple')) + '</span>';
  }
  function info(texto) { return '<span class="marca info">' + texto + '</span>'; }
  function paso(n, id, titulo, fuente, cuerpo) {
    return '<section class="paso" id="' + id + '"><h3><span class="paso-num">' + n + '</span><span>' + titulo + '</span></h3>' +
      '<p class="fuente">' + fuente + '</p>' + cuerpo + '</section>';
  }
  function escapar(t) {
    return String(t).replace(/[&<>"]/g, function (c) { return { '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;' }[c]; });
  }

  /* ------------------------------------------------------- formulario */
  function grupoVisible(nombre, visible) {
    document.querySelectorAll('[data-visible="' + nombre + '"]').forEach(function (el) { el.hidden = !visible; });
  }

  function actualizarVisibilidad() {
    var n = $('nRodillos').value;
    grupoVisible('artesa', n !== '1');
    grupoVisible('tresRodillos', n === '3');
    grupoVisible('catalogo', $('metodoSeccion').value === 'catalogo');
    grupoVisible('velocidadManual', $('modoVelocidad').value === 'manual');
    grupoVisible('estacion', $('modoRodillos').value === 'estacion');
    grupoVisible('directo', $('modoRodillos').value === 'directo');
    var metodo = $('metodoResist').value;
    var L = convertir($('L').value);
    if (metodo === 'auto') metodo = isFinite(L) ? (L > 80 ? 'simplificado' : 'global') : 'ambos';
    grupoVisible('simplificado', metodo !== 'global');
    grupoVisible('global', metodo !== 'simplificado');
  }

  function campoOculto(el) {
    var campo = el.closest('.campo');
    return campo ? campo.hidden : false;
  }

  function leerEntradas() {
    var e = {};
    NUMERICOS.forEach(function (id) {
      var el = $(id);
      var texto = el.value.trim();
      if (campoOculto(el)) {
        // v0 y FNotras solo intervienen en el método global: si están ocultos valen 0.
        e[id] = (id === 'v0' || id === 'FNotras') ? 0 : null;
      } else if (texto === '' && OPCIONALES.indexOf(id) >= 0) {
        e[id] = null;
      } else {
        e[id] = convertir(texto);
      }
    });
    SELECTORES.forEach(function (id) { e[id] = $(id).value; });
    e.nRodillos = Number(e.nRodillos);
    if (e.anchura !== 'auto') e.anchura = Number(e.anchura);
    return e;
  }

  function rellenar(entradas) {
    Object.keys(entradas).forEach(function (id) {
      var el = $(id);
      if (!el) return;
      var valor = entradas[id];
      if (el.tagName === 'SELECT') el.value = String(valor);
      else el.value = (valor === null || valor === undefined) ? '' : String(valor).replace('.', ',');
    });
    actualizarVisibilidad();
  }

  function prepararSelectores() {
    var mv = $('materialVel');
    var g1 = document.createElement('optgroup');
    g1.label = 'Fabricante 1 · Tabla 1.3 (Indicaciones, Fig. 2)';
    var cats = tablas.anchurasYVelocidades.categorias;
    Object.keys(cats).forEach(function (c) {
      var o = document.createElement('option');
      o.value = 'F1-' + c;
      o.textContent = c + ' · ' + cats[c];
      g1.appendChild(o);
    });
    var g2 = document.createElement('optgroup');
    g2.label = 'Fabricante 2 · Indicaciones, Fig. 3';
    tablas.velocidadesFabricante2.materiales.forEach(function (m) {
      var o = document.createElement('option');
      o.value = 'F2-' + m.id;
      o.textContent = m.nombre;
      g2.appendChild(o);
    });
    mv.appendChild(g1);
    mv.appendChild(g2);

    var an = $('anchura');
    var auto = document.createElement('option');
    auto.value = 'auto';
    auto.textContent = 'Automática: la menor que cumpla';
    an.appendChild(auto);
    Cinta.anchurasNormalizadas(tablas).forEach(function (B) {
      var o = document.createElement('option');
      o.value = String(B);
      o.textContent = B + ' mm';
      an.appendChild(o);
    });

    var ej = $('ejemplo');
    tablas.ejemplos.forEach(function (x, i) {
      var o = document.createElement('option');
      o.value = String(i);
      o.textContent = x.nombre;
      ej.appendChild(o);
    });
  }

  function cargarEjemplo(i) {
    var ej = tablas.ejemplos[i];
    rellenar(ej.entradas);
    $('descripcionEjemplo').textContent = ej.descripcion;
    recalcular();
  }

  /* ------------------------------------------------- errores en campos */
  function limpiarErrores() {
    document.querySelectorAll('.campo.invalido').forEach(function (c) { c.classList.remove('invalido'); });
    document.querySelectorAll('.error-campo').forEach(function (p) { p.remove(); });
    document.querySelectorAll('[aria-invalid]').forEach(function (el) { el.removeAttribute('aria-invalid'); });
  }
  function marcarError(id, mensaje) {
    var el = $(id);
    if (!el) return;
    var campo = el.closest('.campo');
    if (!campo) return;
    campo.classList.add('invalido');
    el.setAttribute('aria-invalid', 'true');
    var p = document.createElement('p');
    p.className = 'error-campo';
    p.textContent = mensaje;
    campo.appendChild(p);
  }

  /* --------------------------------------------------------- dibujo */
  function dibujoSeccion(geo, B) {
    var Bm = B / 1000;
    var l3 = geo.l3;
    var lam = geo.lambda;
    var c = Math.cos(lam);
    var s = Math.sin(lam);
    var W = geo.anchoSuperior;
    var h2 = geo.profundidad;
    var h1 = geo.alturaCasquete;
    var lado = (Bm - l3) / 2;                          // longitud de banda en cada rodillo lateral
    var bordeX = l3 / 2 + lado * c;
    var bordeY = lado * s;
    var arriba = Math.max(h2 + h1, bordeY) * 1.12 + 0.02 * Bm;
    var abajo = -0.09 * Bm;
    var anchoTotal = 2 * bordeX * 1.08;
    var escala = 560 / anchoTotal;
    var alto = (arriba - abajo) * escala;
    function X(x) { return (320 + x * escala).toFixed(1); }
    function Y(y) { return (20 + (arriba - y) * escala).toFixed(1); }
    var p = [];
    // Material: trapecio S2 y casquete parabólico S1
    if (h2 > 0) {
      p.push('<polygon class="s2" points="' + [X(-l3 / 2) + ',' + Y(0), X(l3 / 2) + ',' + Y(0), X(W / 2) + ',' + Y(h2),
        X(-W / 2) + ',' + Y(h2)].join(' ') + '"/>');
    }
    var parab = [];
    for (var i = 0; i <= 40; i++) {
      var x = -W / 2 + W * i / 40;
      parab.push(X(x) + ',' + Y(h2 + h1 * (1 - Math.pow(2 * x / W, 2))));
    }
    p.push('<polygon class="s1" points="' + parab.join(' ') + '"/>');
    // Banda
    var banda = [X(-bordeX) + ',' + Y(bordeY), X(-l3 / 2) + ',' + Y(0), X(l3 / 2) + ',' + Y(0), X(bordeX) + ',' + Y(bordeY)];
    p.push('<polyline class="banda" fill="none" stroke-width="4" stroke-linejoin="round" points="' + banda.join(' ') + '"/>');
    // Rodillos: se dibujan desplazados hacia fuera de la artesa, por debajo de la banda.
    // El desplazamiento es perpendicular al tramo y hacia su derecha, recorriéndolo de x1 a x2.
    var off = 0.035 * Bm;
    function rodillo(x1, y1, x2, y2) {
      var dx = x2 - x1;
      var dy = y2 - y1;
      var len = Math.sqrt(dx * dx + dy * dy) || 1;
      var nx = dy / len * off;
      var ny = -dx / len * off;
      return '<line stroke-width="' + (off * escala * 1.3).toFixed(1) + '" stroke-linecap="round" style="stroke:var(--rodillo)" x1="' +
        X(x1 + nx) + '" y1="' + Y(y1 + ny) + '" x2="' + X(x2 + nx) + '" y2="' + Y(y2 + ny) + '"/>';
    }
    if (geo.nRodillos === 1) {
      p.push(rodillo(-bordeX * 0.98, 0, bordeX * 0.98, 0));
    } else {
      if (l3 > 0) p.push(rodillo(-l3 / 2 * 0.94, 0, l3 / 2 * 0.94, 0));
      var x0 = l3 / 2 + 0.05 * lado * c;
      var y0 = 0.05 * lado * s;
      var x1 = bordeX - 0.03 * lado * c;
      var y1 = bordeY - 0.03 * lado * s;
      p.push(rodillo(x0, y0, x1, y1));     // lado derecho: de dentro a fuera
      p.push(rodillo(-x1, y1, -x0, y0));   // lado izquierdo: de fuera a dentro
    }
    // Línea de la cuerda y etiquetas
    p.push('<line class="cota" stroke-width="1" stroke-dasharray="4 3" x1="' + X(-W / 2) + '" y1="' + Y(h2) + '" x2="' + X(W / 2) + '" y2="' + Y(h2) + '"/>');
    p.push('<text class="etiqueta-area" text-anchor="middle" x="' + X(0) + '" y="' + Y(h2 + h1 * 0.38) + '">S₁</text>');
    if (h2 > 0) p.push('<text class="etiqueta-area" text-anchor="middle" x="' + X(0) + '" y="' + Y(h2 * 0.42) + '">S₂</text>');
    // Ángulos: β a la derecha (por fuera de la banda) y λ a la izquierda.
    p.push('<text text-anchor="start" x="' + (Number(X(bordeX)) + 8) + '" y="' + (Number(Y(bordeY)) + 5) + '">β = ' + fe(geo.betaGrados) + '°</text>');
    if (geo.nRodillos > 1) {
      p.push('<text text-anchor="end" x="' + (Number(X(-bordeX)) - 8) + '" y="' + (Number(Y(bordeY)) + 5) + '">λ = ' + fe(geo.lambdaGrados) + '°</text>');
    }
    if (l3 > 0) p.push('<text text-anchor="middle" x="' + X(0) + '" y="' + (Number(Y(0)) + off * escala * 2 + 14) + '">l₃ = ' + fmt(l3, 3) + ' m</text>');
    return '<div class="dibujo"><svg viewBox="0 0 640 ' + (alto + 40).toFixed(0) + '" role="img" aria-label="Sección transversal del material sobre la banda">' +
      p.join('') + '</svg><p class="leyenda">Dibujo a escala: banda de ' + B + ' mm, anchura útil b = ' + fmt(geo.b, 3) +
      ' m. S₁ es el casquete parabólico del talud y S₂ el trapecio sobre los rodillos.</p></div>';
  }

  /* --------------------------------------------------------- pasos */
  function textoMotivo(sel) {
    switch (sel.motivo) {
      case 'sinNormalizada': return 'v necesaria mayor que 5,24 m/s';
      case 'sinVmax': return 'la tabla no da velocidad máxima';
      case 'superaVmax': return 'supera la velocidad máxima';
      case 'insuficiente': return 'velocidad insuficiente';
      default: return '';
    }
  }

  function descripcionVmax(e, d, eleccion) {
    var vi = eleccion.vmaxInfo;
    if (!vi) return 'sin dato en la tabla para B = ' + d.B + ' mm';
    if (vi.tabla === 'F1') return 'Tabla 1.3, B = ' + d.B + ' mm, categoría ' + vi.columna;
    var mat = tablas.velocidadesFabricante2.materiales[vi.fila];
    return 'Figura 3, «' + mat.nombre + '»' + (vi.vmin !== null ? ' (intervalo ' + fmt(vi.vmin, 2) + '–' + fmt(vi.vmax, 2) + ' m/s)' : '');
  }

  function pasoInclinacion(e, d, res) {
    var ki = res.info.k;
    var h = calc('Inclinación', SIM.delta + ' = arcsen(' + SIM.H + ' / ' + SIM.L + ')', 'arcsen(' + par(fe(e.H), e.H) + ' / ' + fe(e.L) + ')',
      fmt(d.deltaGrados, 3) + '°');
    if (ki.origen === 'manual') {
      h += calc('Factor ' + SIM.k, 'introducido a mano', '', fmt(d.k, 4), { final: true });
    } else if (ki.interp.tipo === 'interpolado') {
      var it = ki.interp;
      h += calc('Factor ' + SIM.k + ' (interpolación lineal)',
        SIM.k + ' = ' + v_('k', '1') + ' + (' + v_('k', '2') + ' − ' + v_('k', '1') + ')·(|' + SIM.delta + '| − ' + v_('α', '1') + ') / (' + v_('α', '2') + ' − ' + v_('α', '1') + ')',
        fmt(it.y1, 2) + ' + (' + fmt(it.y2, 2) + ' − ' + fmt(it.y1, 2) + ')·(' + fmt(ki.angulo, 3) + ' − ' + it.x1 + ') / (' + it.x2 + ' − ' + it.x1 + ')',
        fmt(d.k, 5), { final: true });
    } else {
      h += calc('Factor ' + SIM.k, '|' + SIM.delta + '| = ' + fmt(ki.angulo, 3) + '° está en la tabla', '', SIM.k + ' = ' + fmt(d.k, 4), { final: true, sep: '→' });
    }
    if (e.H < 0) h += '<p class="nota">La cinta baja: la reducción de capacidad depende del valor absoluto de la inclinación.</p>';
    return paso(1, 'paso-1', 'Inclinación y factor de reducción <var>k</var>',
      'Indicaciones, Tabla 2 · Apuntes, Tabla 1.1 (interpolación lineal según la nota del Ejercicio 13)', h);
  }

  function pasoAnchuraMinima(e, d, res) {
    var am = res.info.anchuraMinima;
    var h;
    var nombreGran = e.granulometria === 'mixto' ? 'Mixto' : 'Uniforme';
    if (am.sinTrozos) {
      h = '<p>Material sin trozos: el tamaño no limita la anchura. Se parte de la menor anchura de la tabla, ' + d.Bmin + ' mm.</p>';
    } else {
      h = calc('Tabla 1.3, columna «' + nombreGran + '»', 'tamaño máximo = ' + fe(e.tamMax) + ' mm', '',
        am.BTabla !== null ? 'admitido a partir de ' + am.BTabla + ' mm' : 'ninguna anchura lo admite', { sep: '→' });
      var textoFila = am.filaFactor === 0 ? SIM.beta + ' = ' + fe(e.beta) + '° ≤ 20°' : '20° < ' + SIM.beta + ' = ' + fe(e.beta) + '° ≤ 30°';
      h += calc('Tabla 1.2 (' + textoFila + ', ' + (e.granulometria === 'mixto' ? '10 % gruesos' : '100 % gruesos') + ')',
        SIM.B + ' ≥ factor · tamaño', am.factor + ' · ' + fe(e.tamMax) + ' = ' + fmt(am.BFactorReq, 1) + ' mm',
        am.BFactor !== null ? am.BFactor + ' mm (normalizada)' : 'mayor que 2200 mm', { sep: '→' });
      h += calc('Anchura mínima', v_('B', 'mín') + ' = máx(' + (am.BTabla !== null ? am.BTabla : '—') + ', ' + (am.BFactor !== null ? am.BFactor : '—') + ')', '',
        am.Bmin !== null ? am.Bmin + ' mm' : 'no existe', { final: true });
    }
    return paso(2, 'paso-2', 'Anchura mínima por el tamaño de los trozos',
      'Indicaciones, Figura 2 y tabla de gruesos y finos · Apuntes, Tablas 1.2 y 1.3', h);
  }

  function pasoEleccion(e, d, res) {
    var h;
    if (e.anchura === 'auto') {
      h = '<p>Se prueban las anchuras normalizadas de menor a mayor, empezando por la mínima del paso 2. Para cada una se calcula la sección ' +
        SIM.S + ' (paso 4) y la velocidad necesaria ' + v_('v', 'nec') + ' = ' + SIM.Q + ' / (3600·' + SIM.S + '·' + SIM.gam + '·' + SIM.k +
        '). Criterio de velocidad: ' + ETIQUETAS_VELOCIDAD[e.modoVelocidad] + '. Se elige la primera anchura cuya velocidad no supera la máxima del fabricante, ' +
        'porque interesa la banda más estrecha posible.</p>';
    } else {
      h = '<p>Anchura fijada por el usuario. Criterio de velocidad: ' + ETIQUETAS_VELOCIDAD[e.modoVelocidad] + '.</p>';
    }
    h += '<div class="tabla-scroll"><table><thead><tr><th>B (mm)</th><th>S (m²)</th><th>v necesaria (m/s)</th><th>v máx. tabla (m/s)</th><th>v elegida (m/s)</th><th>Resultado</th></tr></thead><tbody>';
    res.candidatos.forEach(function (c) {
      var ok = c.sel.valida;
      h += '<tr' + (d.B === c.B && res.ok ? ' class="elegida"' : '') + '><td>' + c.B + '</td><td>' + fmt(c.S, 6) + '</td><td>' + fmt(c.vReq, 4) +
        '</td><td>' + (c.vmax !== null ? fmt(c.vmax, 2) : '—') + '</td><td>' + (c.sel.v !== null ? fv(c.sel.v) : '—') + '</td><td class="' +
        (ok ? 'ok' : 'no') + '">' + (ok ? '✓ cumple' : '✗ ' + textoMotivo(c.sel)) + '</td></tr>';
    });
    h += '</tbody></table></div>';
    if (res.ok) {
      h += calc('Resultado', '', '', SIM.B + ' = ' + d.B + ' mm, ' + SIM.v + ' = ' + fv(d.v) + ' m/s', { final: true });
    }
    return paso(3, 'paso-3', 'Elección de la anchura y de la velocidad',
      'Indicaciones, Figuras 2 y 3 y Tabla 1 (DIN 22101) · Apuntes, Tablas 1.3 y 1.4', h);
  }

  function pasoSeccion(e, d, res) {
    var el = res.info.eleccion;
    var h;
    if (e.metodoSeccion === 'catalogo') {
      h = '<p>Método 2: el fabricante da el caudal volumétrico para v = 1 m/s; la sección equivalente se obtiene dividiendo entre 3600 s/h.</p>';
      h += calc('Caudal de catálogo (v = 1 m/s)', v_('Q', 'v,1'), '', fe(e.Qv1) + ' m³/h');
      h += calc('Sección equivalente', SIM.S + ' = ' + v_('Q', 'v,1') + ' / 3600', fe(e.Qv1) + ' / 3600', fmt(d.S, 6) + ' m²', { final: true });
      return paso(4, 'paso-4', 'Sección transversal del material (Método 2)', 'Indicaciones, Método 2: caudal volumétrico · Apuntes, ec. (1.3)', h);
    }
    var geo = el.geo;
    var Bm = d.B / 1000;
    h = Bm <= 2
      ? calc('Anchura útil (B ≤ 2 m)', SIM.b + ' = 0,9·' + SIM.B + ' − 0,05', '0,9·' + fmt(Bm, 3) + ' − 0,05', fmt(d.b, 4) + ' m')
      : calc('Anchura útil (B > 2 m)', SIM.b + ' = ' + SIM.B + ' − 0,2', fmt(Bm, 3) + ' − 0,2', fmt(d.b, 4) + ' m');
    if (e.nRodillos === 3) {
      h += calc('Rodillo central', SIM.l3 + (el.l3Origen === 'manual' ? ' (introducido)' : ' (Figura 6, B = ' + d.B + ' mm)'), '',
        fmt(d.l3 * 1000, 0) + ' mm = ' + fmt(d.l3, 3) + ' m');
    } else {
      h += '<p class="nota">Con ' + e.nRodillos + (e.nRodillos === 1 ? ' rodillo' : ' rodillos') + ' la longitud del rodillo central es ' + SIM.l3 +
        ' = 0' + (e.nRodillos === 1 ? ' y el ángulo de artesa es λ = 0, por lo que ' + SIM.S2 + ' = 0' : '') + '.</p>';
    }
    var lamTxt = fe(geo.lambdaGrados) + '°';
    var l3 = fmt(d.l3, 3);
    var b = fmt(d.b, 4);
    h += calc('Casquete del talud', SIM.S1 + ' = [' + SIM.l3 + ' + (' + SIM.b + ' − ' + SIM.l3 + ')·cos ' + SIM.lam + ']²·tan ' + SIM.beta + ' / 6',
      '[' + l3 + ' + (' + b + ' − ' + l3 + ')·cos ' + lamTxt + ']²·tan ' + fe(e.beta) + '° / 6', fmt(d.S1, 6) + ' m²');
    h += calc('Trapecio sobre la artesa', SIM.S2 + ' = [' + SIM.l3 + ' + (' + SIM.b + ' − ' + SIM.l3 + ')/2·cos ' + SIM.lam + ']·[(' + SIM.b + ' − ' + SIM.l3 + ')/2·sen ' + SIM.lam + ']',
      '[' + l3 + ' + (' + b + ' − ' + l3 + ')/2·cos ' + lamTxt + ']·[(' + b + ' − ' + l3 + ')/2·sen ' + lamTxt + ']', fmt(d.S2, 6) + ' m²');
    h += calc('Sección total', SIM.S + ' = ' + SIM.S1 + ' + ' + SIM.S2, fmt(d.S1, 6) + ' + ' + fmt(d.S2, 6), fmt(d.S, 6) + ' m²', { final: true });
    h += dibujoSeccion(geo, d.B);
    return paso(4, 'paso-4', 'Sección transversal del material (Método 1)',
      'Indicaciones, Figuras 5 y 6 · Apuntes, ec. (1.1) y Figura 1.1 (ángulos en la fórmula en radianes)', h);
  }

  function pasoCapacidad(e, d, res) {
    var h = calc('Velocidad necesaria', v_('v', 'nec') + ' = ' + SIM.Q + ' / (3600·' + SIM.S + '·' + SIM.gam + '·' + SIM.k + ')',
      fe(e.Q) + ' / (3600·' + fmt(d.S, 6) + '·' + fe(e.densidad) + '·' + fmt(d.k, 5) + ')', fmt(d.vReq, 4) + ' m/s');
    h += calc('Velocidad máxima recomendada', descripcionVmax(e, d, res.info.eleccion), '', d.vmax !== null ? fmt(d.vmax, 2) + ' m/s' : '—', { sep: '→' });
    var criterio = e.modoVelocidad === 'normalizada' ? 'menor valor normalizado ≥ ' + fmt(d.vReq, 4) + ' m/s'
      : (e.modoVelocidad === 'exacta' ? 'la velocidad necesaria, sin normalizar' : (e.modoVelocidad === 'maxima' ? 'la máxima del fabricante' : 'introducida a mano'));
    h += calc('Velocidad adoptada', criterio, '', SIM.v + ' = ' + fv(d.v) + ' m/s', {
      final: true,
      sep: '→',
      marca: d.vmax !== null ? marca(d.velocidadOK, '≤ ' + fmt(d.vmax, 2) + ' m/s', '> ' + fmt(d.vmax, 2) + ' m/s') : info('sin v máx.')
    });
    h += calc('Capacidad de transporte', SIM.Q + ' = 3600·' + SIM.v + '·' + SIM.S + '·' + SIM.gam + '·' + SIM.k,
      '3600·' + fv(d.v) + '·' + fmt(d.S, 6) + '·' + fe(e.densidad) + '·' + fmt(d.k, 5), fmt(d.Qreal, 2) + ' t/h',
      { final: true, marca: marca(d.capacidadOK, '≥ ' + fe(e.Q) + ' t/h requeridas', '< ' + fe(e.Q) + ' t/h requeridas') });
    h += calc('Caudal volumétrico', v_('Q', 'v') + ' = 3600·' + SIM.v + '·' + SIM.S + '·' + SIM.k,
      '3600·' + fv(d.v) + '·' + fmt(d.S, 6) + '·' + fmt(d.k, 5), fmt(d.QvReal, 2) + ' m³/h');
    h += calc('Caudal volumétrico a 1 m/s (para comparar con catálogos)', '3600·' + SIM.S, '', fmt(d.Qv1m, 1) + ' m³/h');
    h += calc('Grado de llenado', SIM.Q + ' requerida / ' + SIM.Q, fe(e.Q) + ' / ' + fmt(d.Qreal, 2), fmt(d.llenado * 100, 1) + ' %');
    if (d.vmin !== null) h += '<p class="nota">La tabla del fabricante recomienda velocidades entre ' + fmt(d.vmin, 2) + ' y ' + fmt(d.vmax, 2) + ' m/s.</p>';
    return paso(5, 'paso-5', 'Velocidad y capacidad de transporte',
      'Indicaciones, Figura 1: Q = 3600·v·A·γ·k (Q en t/h, γ en t/m³) · Apuntes, ec. (1.2) y (1.3)', h);
  }

  function pasoMasas(e, d) {
    var h = calc('Carga transportada', SIM.qG + ' = ' + SIM.Q + ' / (3,6·' + SIM.v + ')', fe(e.Q) + ' / (3,6·' + fv(d.v) + ')', fmt(d.qG, 3) + ' kg/m');
    if (e.modoRodillos === 'estacion') {
      h += calc('Rodillos superiores', SIM.qRO + ' = ' + SIM.mRO + ' / ' + SIM.lRO, fe(e.mRO) + ' / ' + fe(e.lRO), fmt(d.qRO, 3) + ' kg/m');
      h += calc('Rodillos inferiores', SIM.qRU + ' = ' + SIM.mRU + ' / ' + SIM.lRU, fe(e.mRU) + ' / ' + fe(e.lRU), fmt(d.qRU, 3) + ' kg/m');
    } else {
      h += calc('Rodillos superiores', SIM.qRO + ' (dato)', '', fe(d.qRO) + ' kg/m');
      h += calc('Rodillos inferiores', SIM.qRU + ' (dato)', '', fe(d.qRU) + ' kg/m');
    }
    h += calc('Banda (cada ramal)', SIM.qB + ' (dato)', '', fe(e.qB) + ' kg/m');
    return paso(6, 'paso-6', 'Masas por unidad de longitud', 'Indicaciones, Ejemplo 3 · Apuntes, ec. (2.2)', h);
  }

  function pasoResistencias(e, d, res) {
    var g = fmt(tablas.g, 2);
    var corchete = '[' + fmt(d.qRO, 3) + ' + ' + fmt(d.qRU, 3) + ' + (2·' + fe(e.qB) + ' + ' + fmt(d.qG, 3) + ')·cos ' + fmt(d.deltaGrados, 3) + '°]';
    var simbCorchete = '[' + SIM.qRO + ' + ' + SIM.qRU + ' + (2·' + SIM.qB + ' + ' + SIM.qG + ')·cos ' + SIM.delta + ']';
    var h;
    if (d.metodoResist === 'simplificado') {
      h = '<p>Método simplificado' + (e.metodoResist === 'auto' ? ' (L = ' + fe(e.L) + ' m > 80 m)' : ' (elegido por el usuario)') +
        ': las resistencias secundarias se incluyen alargando la longitud con el coeficiente ' + SIM.CL + '.</p>';
      var cl = res.info.CL;
      if (cl.origen === 'manual') {
        h += calc('Coeficiente ' + SIM.CL, 'introducido a mano', '', fmt(d.CL, 4));
      } else if (cl.interp.tipo === 'interpolado') {
        var it = cl.interp;
        h += calc('Coeficiente ' + SIM.CL + ' (interpolación)', SIM.CL + ' = ' + v_('C', '1') + ' + (' + v_('C', '2') + ' − ' + v_('C', '1') + ')·(' + SIM.L + ' − ' + v_('L', '1') + ') / (' + v_('L', '2') + ' − ' + v_('L', '1') + ')',
          fe(it.y1) + ' + (' + fe(it.y2) + ' − ' + fe(it.y1) + ')·(' + fe(e.L) + ' − ' + it.x1 + ') / (' + it.x2 + ' − ' + it.x1 + ')', fmt(d.CL, 4));
      } else if (cl.interp.tipo === 'exacto') {
        h += calc('Coeficiente ' + SIM.CL, SIM.L + ' = ' + fe(e.L) + ' m está en la tabla', '', SIM.CL + ' = ' + fmt(d.CL, 4), { sep: '→' });
      } else {
        h += calc('Coeficiente ' + SIM.CL, SIM.L + ' = ' + fe(e.L) + ' m está fuera de la tabla; se toma el valor del extremo', '',
          SIM.CL + ' = ' + fmt(d.CL, 4), { sep: '→', marca: info('fuera de tabla') });
      }
      h += calc('Longitud corregida', SIM.Lc + ' = ' + SIM.CL + '·' + SIM.L, fmt(d.CL, 4) + '·' + fe(e.L), fmt(d.Lc, 2) + ' m');
      h += calc('Resistencias principales y secundarias', SIM.FH + ' + ' + SIM.FN + ' = ' + SIM.f + '·' + SIM.Lc + '·' + SIM.g + '·' + simbCorchete,
        fe(e.f) + '·' + fmt(d.Lc, 2) + '·' + g + '·' + corchete, fmt(d.FHN, 2) + ' N');
    } else {
      h = '<p>Método global' + (e.metodoResist === 'auto' ? ' (L = ' + fe(e.L) + ' m ≤ 80 m)' : ' (elegido por el usuario)') +
        ': las resistencias secundarias se calculan una a una.</p>';
      h += calc('Resistencias principales', SIM.FH + ' = ' + SIM.f + '·' + SIM.L + '·' + SIM.g + '·' + simbCorchete,
        fe(e.f) + '·' + fe(e.L) + '·' + g + '·' + corchete, fmt(d.FH, 2) + ' N');
      h += calc('Caudal másico', v_('ṁ') + ' = ' + SIM.qG + '·' + SIM.v, fmt(d.qG, 3) + '·' + fv(d.v), fmt(d.mPunto, 3) + ' kg/s');
      h += calc('Aceleración del material', v_('F', 'N,acc') + ' = ' + v_('ṁ') + '·(' + SIM.v + ' − ' + v_('v', '0') + ')',
        fmt(d.mPunto, 3) + '·(' + fv(d.v) + ' − ' + fe(e.v0) + ')', fmt(d.FNacc, 2) + ' N');
      h += calc('Resistencias secundarias', SIM.FN + ' = ' + v_('F', 'N,acc') + ' + otras', fmt(d.FNacc, 2) + ' + ' + fe(e.FNotras), fmt(d.FN, 2) + ' N');
    }
    h += calc('Resistencia por la inclinación', SIM.FSt + ' = ' + SIM.qG + '·' + SIM.g + '·' + SIM.H, fmt(d.qG, 3) + '·' + g + '·' + par(fe(e.H), e.H), fmt(d.FSt, 2) + ' N');
    h += calc('Resistencias especiales', SIM.FS1 + ' + ' + SIM.FS2, fe(e.FS1) + ' + ' + fe(e.FS2), fmt(e.FS1 + e.FS2, 2) + ' N');
    var suma = d.metodoResist === 'simplificado'
      ? fmt(d.FHN, 2) + ' + ' + fe(e.FS1) + ' + ' + fe(e.FS2) + ' + ' + par(fmt(d.FSt, 2), d.FSt)
      : fmt(d.FH, 2) + ' + ' + fmt(d.FN, 2) + ' + ' + fe(e.FS1) + ' + ' + fe(e.FS2) + ' + ' + par(fmt(d.FSt, 2), d.FSt);
    h += calc('Fuerza tangencial en el tambor', SIM.Fu + ' = ' + SIM.FH + ' + ' + SIM.FN + ' + ' + SIM.FS1 + ' + ' + SIM.FS2 + ' + ' + SIM.FSt, suma,
      fmt(d.Fu, 2) + ' N', { final: true });
    return paso(7, 'paso-7', 'Resistencias al movimiento y fuerza tangencial ' + SIM.Fu,
      'Indicaciones, Resistencias al movimiento y Factor de corrección de la longitud · Apuntes, ec. (2.1) a (2.7)', h);
  }

  function pasoPotencia(e, d) {
    var h = calc('Potencia en el tambor', v_('P', 'a') + ' = ' + SIM.Fu + '·' + SIM.v, par(fmt(d.Fu, 2), d.Fu) + '·' + fv(d.v),
      fmt(d.Pt, 1) + ' W = ' + fmt(d.Pt / 1000, 3) + ' kW');
    h += calc('Potencia del motor', v_('P', 'm') + ' = ' + v_('P', 'a') + ' / ' + SIM.eta, fmt(d.Pt / 1000, 3) + ' / ' + fe(e.rendimiento / 100),
      fmt(d.Pm / 1000, 3) + ' kW', { final: true });
    if (d.M !== null) {
      h += calc('Par en el tambor', SIM.M + ' = ' + SIM.Fu + '·' + SIM.D + '/2', par(fmt(d.Fu, 2), d.Fu) + '·' + fmt(e.D / 2000, 4), fmt(d.M, 2) + ' N·m');
      h += calc('Velocidad angular', SIM.w + ' = ' + SIM.v + ' / (' + SIM.D + '/2)', fv(d.v) + ' / ' + fmt(e.D / 2000, 4), fmt(d.omega, 3) + ' rad/s');
      h += calc('Velocidad de giro', SIM.n + ' = 60·' + SIM.w + ' / (2π)', '60·' + fmt(d.omega, 3) + ' / (2π)', fmt(d.rpm, 1) + ' rpm');
    }
    if (!(d.Fu > 0)) {
      h += '<p class="nota">' + SIM.Fu + ' ≤ 0: la cinta descendente arrastra al motor, que debe funcionar como freno o generador. ' +
        'Las tensiones y el número de capas no se calculan en este caso.</p>';
    }
    return paso(8, 'paso-8', 'Potencia de accionamiento', 'Indicaciones, Potencia del motor · Apuntes, ec. (3.7) y (4.14)', h);
  }

  function pasoTensiones(e, d, res) {
    var t = res.info.tensiones;
    var g = fmt(tablas.g, 2);
    var cosTxt = 'cos ' + fmt(d.deltaGrados, 3) + '°';
    var hRel = fe(e.flechaMax / 100);
    var h = calc('Ángulo de abrazamiento', SIM.phi + ' = ' + fe(e.phi) + '°', '', fmt(t.phi, 4) + ' rad');
    h += calc('Límite de Euler–Eytelwein', v_('e') + '<sup>' + SIM.mu + '·' + SIM.phi + '</sup>', 'e<sup>' + fe(e.mu) + '·' + fmt(t.phi, 4) + '</sup>', fmt(d.E, 4));
    h += calc(SIM.T2 + ' mínima por adherencia', v_('T', '2,adh') + ' = ' + SIM.Fu + ' / (' + v_('e') + '<sup>' + SIM.mu + SIM.phi + '</sup> − 1)',
      fmt(d.Fu, 2) + ' / (' + fmt(d.E, 4) + ' − 1)', fmt(d.T2adh, 2) + ' N');
    h += calc(SIM.T2 + ' mínima por flecha, ramal superior', '(' + SIM.qB + ' + ' + SIM.qG + ')·' + SIM.g + '·cos ' + SIM.delta + '·' + SIM.lRO + ' / (8·' + v_('h', 'rel') + ')',
      '(' + fe(e.qB) + ' + ' + fmt(d.qG, 3) + ')·' + g + '·' + cosTxt + '·' + fe(e.lRO) + ' / (8·' + hRel + ')', fmt(d.TsupMin, 2) + ' N');
    h += calc(SIM.T2 + ' mínima por flecha, ramal inferior', SIM.qB + '·' + SIM.g + '·cos ' + SIM.delta + '·' + SIM.lRU + ' / (8·' + v_('h', 'rel') + ')',
      fe(e.qB) + '·' + g + '·' + cosTxt + '·' + fe(e.lRU) + ' / (8·' + hRel + ')', fmt(d.TinfMin, 2) + ' N');
    var gob = { adherencia: 'la adherencia', flechaSup: 'la flecha del ramal superior', flechaInf: 'la flecha del ramal inferior' }[d.gobierna];
    h += calc(SIM.T2 + ' mínima de diseño', v_('T', '2,mín') + ' = máx(' + fmt(d.T2adh, 1) + '; ' + fmt(d.TsupMin, 1) + '; ' + fmt(d.TinfMin, 1) + ')', '',
      fmt(d.T2min, 2) + ' N (manda ' + gob + ')');
    if (t.T2deUsuario) {
      h += calc(SIM.T2 + ' adoptada', 'introducida a mano', '', fmt(d.T2, 2) + ' N', {
        final: true, marca: d.T2 >= d.T2min * (1 - 1e-9) ? marca(true, '≥ T2 mínima') : marca(false, '', '< T2 mínima')
      });
    } else {
      h += calc(SIM.T2 + ' adoptada', SIM.T2 + ' = ' + v_('T', '2,mín'), '', fmt(d.T2, 2) + ' N', { final: true });
    }
    h += calc('Tensión del ramal tenso', SIM.T1 + ' = ' + SIM.T2 + ' + ' + SIM.Fu, fmt(d.T2, 2) + ' + ' + fmt(d.Fu, 2), fmt(d.T1, 2) + ' N', { final: true });
    h += calc('Comprobación de adherencia', SIM.T1 + ' / ' + SIM.T2 + ' ≤ ' + v_('e') + '<sup>' + SIM.mu + SIM.phi + '</sup>',
      fmt(d.T1, 2) + ' / ' + fmt(d.T2, 2), fmt(d.relacion, 4) + ' ' + (d.adherenciaOK ? '≤' : '>') + ' ' + fmt(d.E, 4),
      { marca: marca(d.adherenciaOK, 'no patina', 'patina') });
    h += calc('Fuerza máxima transmisible', v_('F', 'u,máx') + ' = ' + SIM.T2 + '·(' + v_('e') + '<sup>' + SIM.mu + SIM.phi + '</sup> − 1)',
      fmt(d.T2, 2) + '·(' + fmt(d.E, 4) + ' − 1)', fmt(d.FuMaxAdh, 2) + ' N (reserva ' + fmt(d.reservaAdh * 100, 1) + ' %)');
    h += calc('Ángulo mínimo de abrazamiento', v_('φ', 'mín') + ' = ln(' + SIM.Fu + '/' + SIM.T2 + ' + 1) / ' + SIM.mu,
      'ln(' + fmt(d.Fu, 2) + '/' + fmt(d.T2, 2) + ' + 1) / ' + fe(e.mu), fmt(d.phiMinGrados, 1) + '°');
    h += calc('Flecha ramal superior (con ' + SIM.T2 + ')', SIM.h + ' = (' + SIM.qB + ' + ' + SIM.qG + ')·' + SIM.g + '·cos ' + SIM.delta + '·' + SIM.lRO + '² / (8·' + SIM.T2 + ')',
      '(' + fe(e.qB) + ' + ' + fmt(d.qG, 3) + ')·' + g + '·' + cosTxt + '·' + fe(e.lRO) + '² / (8·' + fmt(d.T2, 2) + ')',
      fmt(d.hSup * 1000, 2) + ' mm = ' + fmt(d.hRelSup * 100, 3) + ' %', { marca: marca(d.flechaSupOK, '≤ ' + fe(e.flechaMax) + ' %', '> ' + fe(e.flechaMax) + ' %') });
    h += calc('Flecha ramal inferior (con ' + SIM.T2 + ')', SIM.h + ' = ' + SIM.qB + '·' + SIM.g + '·cos ' + SIM.delta + '·' + SIM.lRU + '² / (8·' + SIM.T2 + ')',
      fe(e.qB) + '·' + g + '·' + cosTxt + '·' + fe(e.lRU) + '² / (8·' + fmt(d.T2, 2) + ')',
      fmt(d.hInf * 1000, 2) + ' mm = ' + fmt(d.hRelInf * 100, 3) + ' %', { marca: marca(d.flechaInfOK, '≤ ' + fe(e.flechaMax) + ' %', '> ' + fe(e.flechaMax) + ' %') });
    h += calc('Separación máxima entre rodillos (con ' + SIM.T2 + ')', v_('l', 'máx') + ' = 8·' + SIM.T2 + '·' + v_('h', 'rel') + ' / (' + v_('q') + '·' + SIM.g + '·cos ' + SIM.delta + ')', '',
      fmt(d.lSupMax, 3) + ' m (superiores) · ' + fmt(d.lInfMax, 3) + ' m (inferiores)');
    h += '<p class="nota">Se supone un único tambor motriz. La flecha se comprueba con la tensión mínima ' + SIM.T2 +
      ' en los dos ramales, que es la hipótesis más desfavorable (Apuntes, ec. 4.12).</p>';
    return paso(9, 'paso-9', 'Tensiones de la banda: adherencia y flecha',
      'Indicaciones, Tensión de la cinta (Euler–Eytelwein) · Apuntes, ec. (3.4) a (3.12) y (4.9) a (4.13)', h);
  }

  function pasoCapas(e, d, res) {
    var c = res.info.capas;
    var h = '<p>Se busca el menor número de capas ' + SIM.z + ' que cumple ' + SIM.R + '·' + SIM.z + '·' + SIM.B + ' / ' + SIM.Sseg + ' ≥ ' +
      v_('T', 'máx') + ', con ' + v_('T', 'máx') + ' = ' + SIM.T1 + ' = ' + fmt(d.T1, 2) + ' N. El coeficiente de seguridad ' + SIM.Sseg +
      ' depende del propio número de capas, por lo que se itera como en el Ejercicio 12.</p>';
    c.iteraciones.forEach(function (it, i) {
      var rango = it.zMax === null ? 'más de ' + (it.zMin - 1) + ' capas' : (it.zMin === 1 ? 'hasta ' + it.zMax + ' capas' : 'de ' + it.zMin + ' a ' + it.zMax + ' capas');
      h += calc('Hipótesis ' + (i + 1) + ': ' + rango + ' (S = ' + it.S + ')', SIM.z + ' ≥ ' + SIM.Sseg + '·' + v_('T', 'máx') + ' / (' + SIM.R + '·' + SIM.B + ')',
        it.S + '·' + fmt(d.T1, 2) + ' / (' + fe(e.R) + '·' + d.B + ')', fmt(it.zCalculado, 3) + ' → ' + it.zEntero + ' capas',
        { marca: it.coherente ? marca(true, 'coherente') : marca(false, '', 'fuera del intervalo') });
    });
    h += calc('Capas por resistencia', '', '', d.zRes + ' capas');
    h += calc('Mínimo constructivo', '', '', e.zMinConstr + ' capas');
    h += calc('Capas adoptadas', SIM.z + ' = máx(' + d.zRes + '; ' + e.zMinConstr + ')', '', d.z + ' capas, S = ' + d.Sz, { final: true });
    h += calc('Tensión admisible', v_('T', 'adm') + ' = ' + SIM.R + '·' + SIM.z + '·' + SIM.B + ' / ' + SIM.Sseg,
      fe(e.R) + '·' + d.z + '·' + d.B + ' / ' + d.Sz, fmt(d.Tadm, 2) + ' N',
      { marca: marca(d.resistenciaOK, '≥ T1 = ' + fmt(d.T1, 0) + ' N', '< T1') });
    if (d.zProp !== undefined && d.zProp !== null) {
      h += calc('Banda propuesta de ' + d.zProp + ' capas', v_('T', 'adm') + ' = ' + SIM.R + '·' + SIM.z + '·' + SIM.B + ' / ' + SIM.Sseg,
        fe(e.R) + '·' + d.zProp + '·' + d.B + ' / ' + d.SzProp, fmt(d.TadmProp, 2) + ' N',
        { marca: marca(d.propOK, 'adecuada', 'insuficiente') });
    }
    h += '<p class="nota">Equivale a la fórmula de las transparencias ' + SIM.z + ' = ' + SIM.Sseg + '·' + v_('T', 'm') + ' / (100·' + SIM.B + '·' + v_('R', '1') +
      ') con ' + v_('T', 'm') + ' en kgf, ' + SIM.B + ' en m y ' + v_('R', '1') + ' en kgf/cm: aquí ' + SIM.R + ' va en N/mm, ' + SIM.B + ' en mm y ' + v_('T', 'máx') + ' en N.</p>';
    return paso(10, 'paso-10', 'Número de capas de la banda',
      'Indicaciones, Banda o cinta · Apuntes, ec. (4.2) a (4.6), Tabla 4.1 y Ejercicio 12', h);
  }

  /* --------------------------------------------------------- resumen */
  function tarjeta(etiqueta, valor, detalle, bien) {
    return '<div class="tarjeta-resumen' + (bien === false ? ' mal' : '') + '"><div class="etiqueta">' + etiqueta + '</div><div class="valor">' +
      valor + '</div><div class="detalle">' + detalle + '</div></div>';
  }

  function pintarResumen(e, d, res) {
    var conf = e.metodoSeccion === 'catalogo' ? 'sección de catálogo' : (e.nRodillos === 1 ? 'banda plana' : e.nRodillos + ' rodillos a ' + fe(e.lambda) + '°');
    var h = tarjeta('Anchura de banda', d.B + ' mm', conf, d.trozoOK);
    h += tarjeta('Velocidad', fv(d.v) + ' m/s', (d.vmax !== null ? 'máxima ' + fmt(d.vmax, 2) + ' m/s' : 'sin velocidad máxima'), d.velocidadOK);
    h += tarjeta('Capacidad', fmt(d.Qreal, 1) + ' t/h', 'requerida ' + fe(e.Q) + ' t/h' + (d.capacidadOK ? ' ✓' : ' ✗'), d.capacidadOK);
    h += tarjeta('Potencia del motor', fmt(d.Pm / 1000, 2) + ' kW', 'en el tambor ' + fmt(d.Pt / 1000, 2) + ' kW · η = ' + fe(e.rendimiento) + ' %', d.Fu > 0);
    if (d.T1 !== undefined) {
      h += tarjeta('Tensiones', fmt(d.T1, 0) + ' N', 'T1 (ramal tenso) · T2 = ' + fmt(d.T2, 0) + ' N', d.adherenciaOK && d.flechaSupOK && d.flechaInfOK);
    }
    if (d.z !== undefined) {
      h += tarjeta('Banda', d.z + ' capas', 'R = ' + fe(e.R) + ' N/mm · T_adm = ' + fmt(d.Tadm, 0) + ' N', d.resistenciaOK);
    }
    $('resumen').innerHTML = h;
  }

  function pintarMensajes(res) {
    var h = '';
    var sinCampo = res.errores.filter(function (x) { return !x.campo; });
    var conCampo = res.errores.filter(function (x) { return x.campo; });
    if (conCampo.length) {
      h += '<div class="mensaje mensaje-error"><h3>Revise los datos</h3><ul>' + conCampo.map(function (x) { return '<li>' + escapar(x.mensaje) + '</li>'; }).join('') + '</ul></div>';
    }
    if (sinCampo.length) {
      h += '<div class="mensaje mensaje-error"><h3>No hay solución con estos datos</h3><ul>' + sinCampo.map(function (x) { return '<li>' + escapar(x.mensaje) + '</li>'; }).join('') + '</ul></div>';
    }
    if (res.avisos.length) {
      h += '<div class="mensaje mensaje-aviso"><h3>Avisos</h3><ul>' + res.avisos.map(function (x) { return '<li>' + escapar(x.mensaje) + '</li>'; }).join('') + '</ul></div>';
    }
    if (res.ok && !res.avisos.length) {
      h += '<div class="mensaje mensaje-ok"><h3>Diseño válido</h3>Se cumplen la anchura mínima, la velocidad máxima, la capacidad, la adherencia, la flecha y la resistencia de la banda.</div>';
    }
    $('mensajes').innerHTML = h;
  }

  /* ------------------------------------------------------ tablas JSON */
  function tablasUsadas(e, d, res) {
    var am = res.info.anchuraMinima || {};
    var el = res.info.eleccion;
    var vi = el ? el.vmaxInfo : null;
    var h = '';
    function cab(titulo, fuente) { return '<h4>' + titulo + '</h4><p class="fuente">' + escapar(fuente) + '</p>'; }

    var t13 = tablas.anchurasYVelocidades;
    h += cab('Anchura mínima y velocidad máxima (fabricante 1)', t13.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>B (mm)</th><th>Uniforme (mm)</th><th>Mixto (mm)</th><th>A</th><th>B</th><th>C</th><th>D</th></tr></thead><tbody>';
    t13.filas.forEach(function (f, i) {
      var tamRes = am.filaTabla === i ? e.granulometria : null;
      var velRes = vi && vi.tabla === 'F1' && vi.fila === i ? vi.columna : null;
      h += '<tr' + (d.B === f.B ? ' class="elegida"' : '') + '><td>' + f.B + '</td>' +
        '<td' + (tamRes === 'uniforme' ? ' class="resaltada"' : '') + '>' + f.uniforme + '</td>' +
        '<td' + (tamRes === 'mixto' ? ' class="resaltada"' : '') + '>' + f.mixto + '</td>' +
        ['A', 'B', 'C', 'D'].map(function (c) { return '<td' + (velRes === c ? ' class="resaltada"' : '') + '>' + fmt(f.vmax[c], 2) + '</td>'; }).join('') + '</tr>';
    });
    h += '</tbody></table></div><p class="fuente">' + Object.keys(t13.categorias).map(function (c) { return c + ': ' + escapar(t13.categorias[c]); }).join(' · ') + '</p>';

    var t2 = tablas.velocidadesFabricante2;
    h += cab('Velocidad máxima según el material (fabricante 2)', t2.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th class="izq">Material</th><th class="izq">Anchura B (mm) → velocidad máxima (m/s)</th></tr></thead><tbody>';
    t2.materiales.forEach(function (m, i) {
      h += '<tr><td class="izq">' + escapar(m.nombre) + '</td><td class="izq">' + m.tramos.map(function (t, j) {
        var txt = (t.desde === null ? 'cualquier anchura' : (t.desde === t.hasta ? t.desde : t.desde + ' a ' + t.hasta)) + ' → ' +
          (t.vmin !== undefined ? fmt(t.vmin, 2) + '–' : '') + fmt(t.vmax, 2);
        var usado = vi && vi.tabla === 'F2' && vi.fila === i && vi.tramo === j;
        return usado ? '<mark>' + txt + '</mark>' : txt;
      }).join(' · ') + '</td></tr>';
    });
    h += '</tbody></table></div>';

    var tf = tablas.factorTamanoTerron;
    h += cab('Factor de anchura según el tamaño de los trozos', tf.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>Ángulo de sobrecarga</th><th>10 % gruesos, 90 % finos</th><th>100 % gruesos</th></tr></thead><tbody>';
    tf.filas.forEach(function (f, i) {
      var usado = am.filaFactor === i;
      h += '<tr><td>' + (i === 0 ? 'β ≤ ' + f.betaMax + '°' : f.betaMin + '° < β ≤ ' + f.betaMax + '°') + '</td><td' +
        (usado && e.granulometria === 'mixto' ? ' class="resaltada"' : '') + '>' + f.mixto + '</td><td' +
        (usado && e.granulometria === 'uniforme' ? ' class="resaltada"' : '') + '>' + f.uniforme + '</td></tr>';
    });
    h += '</tbody></table></div>';

    var tr = tablas.longitudRodillos;
    h += cab('Longitud de los rodillos (mm)', tr.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>B (mm)</th><th>1 rodillo (plano)</th><th>2 rodillos</th><th>3 rodillos (central l₃)</th></tr></thead><tbody>';
    tr.filas.forEach(function (f) {
      var fila = d.B === f.B;
      h += '<tr' + (fila ? ' class="elegida"' : '') + '><td>' + f.B + '</td><td>' + f.plano + '</td><td>' + f.dos + '</td><td' +
        (fila && e.nRodillos === 3 && e.metodoSeccion === 'formulas' && el && el.l3Origen === 'tabla' ? ' class="resaltada"' : '') + '>' + (f.tres === null ? '—' : f.tres) + '</td></tr>';
    });
    h += '</tbody></table></div>';

    var tk = tablas.factorInclinacion;
    var ki = res.info.k;
    h += cab('Factor de reducción k por la inclinación', tk.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>Inclinación (°)</th>' + tk.filas.map(function (f) {
      var usado = ki && ki.origen === 'tabla' && (f[0] === ki.interp.x1 || f[0] === ki.interp.x2);
      return '<th' + (usado ? ' class="resaltada"' : '') + '>' + f[0] + '</th>';
    }).join('') + '</tr></thead><tbody><tr><th>k</th>' + tk.filas.map(function (f) {
      var usado = ki && ki.origen === 'tabla' && (f[0] === ki.interp.x1 || f[0] === ki.interp.x2);
      return '<td' + (usado ? ' class="resaltada"' : '') + '>' + fmt(f[1], 2) + '</td>';
    }).join('') + '</tr></tbody></table></div>';

    var tv = tablas.velocidadesNormalizadas;
    h += cab('Velocidades normalizadas (m/s)', tv.fuente);
    h += '<div class="tabla-scroll"><table><tbody><tr>' + tv.valores.map(function (v) {
      return '<td' + (d.v === v ? ' class="resaltada"' : '') + '>' + fmt(v, 2) + '</td>';
    }).join('') + '</tr></tbody></table></div>';

    var tc = tablas.coeficienteCL;
    var ci = res.info.CL;
    h += cab('Coeficiente de corrección de la longitud C_L', tc.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>L (m)</th>' + tc.filas.map(function (f) {
      var usado = ci && ci.origen === 'tabla' && (f[0] === ci.interp.x1 || f[0] === ci.interp.x2);
      return '<th' + (usado ? ' class="resaltada"' : '') + '>' + f[0] + '</th>';
    }).join('') + '</tr></thead><tbody><tr><th>C<sub>L</sub></th>' + tc.filas.map(function (f) {
      var usado = ci && ci.origen === 'tabla' && (f[0] === ci.interp.x1 || f[0] === ci.interp.x2);
      return '<td' + (usado ? ' class="resaltada"' : '') + '>' + fe(f[1]) + '</td>';
    }).join('') + '</tr></tbody></table></div><p class="fuente">' + escapar(tc.nota) + '</p>';

    var tcf = tablas.coeficienteF;
    h += cab('Coeficiente de fricción f', tcf.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th class="izq">Cojinete</th><th class="izq">Estado</th><th>f</th></tr></thead><tbody>' +
      tcf.filas.map(function (f) { return '<tr><td class="izq">' + f.cojinete + '</td><td class="izq">' + f.estado + '</td><td>' + f.f + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    var ts = tablas.coeficienteSeguridadCapas;
    h += cab('Coeficiente de seguridad de bandas textiles', ts.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th>Número de capas</th><th>S</th></tr></thead><tbody>' + ts.filas.map(function (f) {
      var usado = d.z !== undefined && d.z >= f.zMin && (f.zMax === null || d.z <= f.zMax);
      var txt = f.zMax === null ? 'más de ' + (f.zMin - 1) : (f.zMin === 1 ? 'hasta ' + f.zMax + ' (3 a 5 en la tabla)' : f.zMin + ' a ' + f.zMax);
      return '<tr' + (usado ? ' class="elegida"' : '') + '><td>' + txt + '</td><td>' + f.S + '</td></tr>';
    }).join('') + '</tbody></table></div><p class="fuente">' + escapar(ts.nota) + '</p>';

    var ta = tablas.anguloSobrecarga;
    h += cab('Ángulo de sobrecarga orientativo', ta.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr><th class="izq">Fluidez</th><th>Ángulo de reposo</th><th>Sobrecarga β</th><th class="izq">Materiales</th></tr></thead><tbody>' +
      ta.filas.map(function (f) { return '<tr><td class="izq">' + f.fluidez + '</td><td>' + f.reposo + '</td><td>' + f.sobrecarga + '</td><td class="izq">' + escapar(f.ejemplos) + '</td></tr>'; }).join('') +
      '</tbody></table></div>';

    var tp = tablas.pesoPartesMoviles;
    h += cab('Peso de las partes móviles (orientativo)', tp.fuente);
    h += '<div class="tabla-scroll"><table><thead><tr>' + tp.columnas.map(function (c) { return '<th>' + escapar(c) + '</th>'; }).join('') + '</tr></thead><tbody>' +
      tp.filas.map(function (f) { return '<tr>' + f.map(function (x) { return '<td>' + (x === null ? '—' : x) + '</td>'; }).join('') + '</tr>'; }).join('') +
      '</tbody></table></div><p class="fuente">' + escapar(tp.nota) + '</p>';

    $('contenidoTablas').innerHTML = h;
  }

  /* --------------------------------------------- informe (impresión) */
  function informeDatos() {
    var filas = [];
    document.querySelectorAll('#formulario .campo').forEach(function (c) {
      if (c.hidden) return;
      var etiqueta = c.querySelector('label');
      var control = c.querySelector('input, select');
      if (!etiqueta || !control) return;
      var valor = control.tagName === 'SELECT' ? control.options[control.selectedIndex].text : (control.value || '(automático)');
      var unidad = c.querySelector('.unidad');
      filas.push('<tr><td class="izq">' + etiqueta.textContent.replace(/opcional/, '').trim() + '</td><td class="izq">' + escapar(valor) +
        (unidad && control.value ? ' ' + unidad.textContent : '') + '</td></tr>');
    });
    $('informeDatos').innerHTML = '<section class="paso"><h3>Datos de partida</h3><div class="tabla-scroll"><table><tbody>' + filas.join('') + '</tbody></table></div></section>';
  }

  /* -------------------------------------------------------- pintar */
  function pintar(res) {
    limpiarErrores();
    res.errores.forEach(function (x) { if (x.campo) marcarError(x.campo, x.mensaje); });
    pintarMensajes(res);
    var e = res.entradas;
    var d = res.datos;
    var pasos = '';
    var indice = [];
    var hayCalculo = res.errores.every(function (x) { return !x.campo; });
    if (hayCalculo) {
      pasos += pasoInclinacion(e, d, res);
      pasos += pasoAnchuraMinima(e, d, res);
      indice.push([1, 'Inclinación'], [2, 'Anchura mínima']);
      if (res.candidatos.length) {
        pasos += pasoEleccion(e, d, res);
        indice.push([3, 'Anchura y velocidad']);
      }
      if (d.B !== undefined) {
        pasos += pasoSeccion(e, d, res) + pasoCapacidad(e, d, res) + pasoMasas(e, d) + pasoResistencias(e, d, res) + pasoPotencia(e, d);
        indice.push([4, 'Sección'], [5, 'Capacidad'], [6, 'Masas'], [7, 'Resistencias'], [8, 'Potencia']);
        if (d.T1 !== undefined) {
          pasos += pasoTensiones(e, d, res);
          indice.push([9, 'Tensiones']);
        }
        if (d.z !== undefined) {
          pasos += pasoCapas(e, d, res);
          indice.push([10, 'Capas']);
        }
        pintarResumen(e, d, res);
      } else {
        $('resumen').innerHTML = '';
      }
      tablasUsadas(e, d, res);
    } else {
      $('resumen').innerHTML = '';
      $('contenidoTablas').innerHTML = '';
    }
    $('pasos').innerHTML = pasos;
    $('indice').innerHTML = indice.map(function (x) { return '<a href="#paso-' + x[0] + '">' + x[0] + ' · ' + x[1] + '</a>'; }).join('');
    informeDatos();
  }

  var temporizador = null;
  function recalcular() {
    clearTimeout(temporizador);
    temporizador = null;
    var res = Cinta.calcular(leerEntradas(), tablas);
    pintar(res);
    window.ultimoResultado = res;   // para consultarlo desde la consola del navegador
  }
  function recalcularPronto() {
    clearTimeout(temporizador);
    temporizador = setTimeout(recalcular, 150);
  }

  /* ------------------------------------------------------- arranque */
  function cargarDatos() {
    var respaldo = {
      datos: window.DATOS_RESPALDO,
      origen: 'js/datos-respaldo.js, copia de datos/datos.json (el navegador no permite leer archivos .json en páginas abiertas desde el disco)'
    };
    if (location.protocol === 'file:' && window.DATOS_RESPALDO) return Promise.resolve(respaldo);
    return fetch('datos/datos.json', { cache: 'no-store' })
      .then(function (r) {
        if (!r.ok) throw new Error('HTTP ' + r.status);
        return r.json();
      })
      .then(function (datos) { return { datos: datos, origen: 'datos/datos.json' }; })
      .catch(function () {
        if (window.DATOS_RESPALDO) return respaldo;
        throw new Error('No se han podido cargar las tablas');
      });
  }

  function iniciar() {
    cargarDatos().then(function (r) {
      tablas = r.datos;
      $('origenDatos').textContent = 'Tablas leídas de: ' + r.origen + ' (versión ' + tablas.version + ').';
      prepararSelectores();
      $('formulario').addEventListener('input', function () { actualizarVisibilidad(); recalcularPronto(); });
      $('formulario').addEventListener('change', function () { actualizarVisibilidad(); recalcular(); });
      $('formulario').addEventListener('submit', function (ev) { ev.preventDefault(); recalcular(); });
      $('cargarEjemplo').addEventListener('click', function () { cargarEjemplo(Number($('ejemplo').value)); });
      $('ejemplo').addEventListener('change', function () {
        $('descripcionEjemplo').textContent = tablas.ejemplos[Number($('ejemplo').value)].descripcion;
      });
      $('imprimir').addEventListener('click', function () {
        $('tablas').open = true;
        window.print();
      });
      cargarEjemplo(0);
    }).catch(function (err) {
      $('mensajes').innerHTML = '<div class="mensaje mensaje-error"><h3>Error</h3>' + escapar(err.message) + '</div>';
    });
  }

  document.addEventListener('DOMContentLoaded', iniciar);
}());
