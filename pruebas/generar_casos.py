"""
generar_casos.py - Genera casos de prueba para la aplicacion.

Crea casos aleatorios (con semilla fija, siempre los mismos) que recorren todas las
opciones de la aplicacion, mas casos limite escritos a mano. Para cada caso calcula el
resultado esperado con la implementacion independiente de referencia.py y lo guarda en
casos.js, que despues lee pruebas.html (navegador) o ejecutar_pruebas.js (Node.js).

Uso:  python generar_casos.py [numero_de_casos_aleatorios] [archivo_de_salida]
"""
import collections
import json
import math
import os
import random
import sys

import referencia

AQUI = os.path.dirname(os.path.abspath(__file__))
SEMILLA = 20261104
CLAVES_MATERIAL = ['F1-A', 'F1-B', 'F1-C', 'F1-D', 'F2-granos', 'F2-carbon', 'F2-minerales',
                   'F2-arena', 'F2-vegetal', 'F2-extractoras']


def base():
    """Entrada completa y valida (Ejemplo del Readme) sobre la que se modifican los casos limite."""
    return {
        'Q': 400, 'densidad': 1.4, 'beta': 20, 'tamMax': 100, 'granulometria': 'mixto', 'materialVel': 'F1-B',
        'L': 150, 'H': 12, 'kManual': None,
        'nRodillos': 3, 'lambda': 30, 'l3Manual': None, 'anchura': 'auto', 'metodoSeccion': 'formulas', 'Qv1': None,
        'modoVelocidad': 'normalizada', 'vManual': None,
        'f': 0.02, 'qB': 12, 'modoRodillos': 'estacion', 'mRO': 18, 'mRU': 14, 'qRO': None, 'qRU': None,
        'lRO': 1.2, 'lRU': 3, 'metodoResist': 'auto', 'CLManual': None, 'v0': 0, 'FNotras': 0, 'FS1': 0, 'FS2': 0,
        'rendimiento': 90, 'mu': 0.3, 'phi': 200, 'D': 500, 'flechaMax': 1, 'T2adoptada': None,
        'R': 160, 'zMinConstr': 3, 'zProp': None,
    }


def caso_aleatorio(rnd, tablas):
    u = rnd.uniform
    e = base()
    e['Q'] = round(10 ** u(1, 3.7), 2)
    e['densidad'] = round(u(0.5, 2.5), 3)
    e['beta'] = rnd.choice([5, 10, 15, 20, 25, 30]) if rnd.random() < 0.5 else round(u(2, 30), 2)
    r = rnd.random()
    e['tamMax'] = 0 if r < 0.1 else (round(u(250, 800), 1) if r < 0.15 else round(u(1, 250), 1))
    e['granulometria'] = rnd.choice(['mixto', 'uniforme'])
    e['materialVel'] = rnd.choice(CLAVES_MATERIAL)
    e['L'] = round(10 ** u(0.7, 3.2), 2)
    if rnd.random() < 0.25:
        e['H'] = 0
    else:
        e['H'] = round(e['L'] * math.sin(math.radians(u(-15, 22))), 3)
    e['kManual'] = round(u(0.6, 1.0), 3) if rnd.random() < 0.08 else None
    e['nRodillos'] = rnd.choices([1, 2, 3], weights=[0.2, 0.2, 0.6])[0]
    e['lambda'] = (rnd.choice([20, 25, 30, 35, 40, 45]) if rnd.random() < 0.6 else round(u(5, 60), 1))
    if e['nRodillos'] == 1 and rnd.random() < 0.5:
        e['lambda'] = None      # campo oculto en la pagina: no debe influir
    e['anchura'] = 'auto' if rnd.random() < 0.75 else rnd.choice(tablas.anchos)
    if e['anchura'] != 'auto':
        if e['nRodillos'] == 3 and rnd.random() < 0.2:
            Bm = e['anchura'] / 1000
            b = 0.9 * Bm - 0.05 if Bm <= 2 else Bm - 0.2
            e['l3Manual'] = round(u(0.1, 0.9) * b * 1000)
        if rnd.random() < 0.15:
            e['metodoSeccion'] = 'catalogo'
            e['Qv1'] = round(u(20, 3500), 1)
    e['modoVelocidad'] = rnd.choices(['normalizada', 'exacta', 'maxima', 'manual'], weights=[0.45, 0.2, 0.2, 0.15])[0]
    if e['modoVelocidad'] == 'manual':
        e['vManual'] = round(u(0.5, 5.5), 2)
    e['f'] = rnd.choice([0.018, 0.02, 0.025, 0.03, 0.05]) if rnd.random() < 0.6 else round(u(0.015, 0.06), 4)
    e['qB'] = round(u(2, 60), 2)
    if rnd.random() < 0.6:
        e['modoRodillos'] = 'estacion'
        e['mRO'], e['mRU'] = round(u(2, 80), 2), round(u(1, 60), 2)
    else:
        e['modoRodillos'] = 'directo'
        e['mRO'] = e['mRU'] = None
        e['qRO'], e['qRU'] = round(u(0, 60), 2), round(u(0, 30), 2)
    e['lRO'], e['lRU'] = round(u(0.8, 1.6), 2), round(u(1.5, 4.8), 2)
    e['metodoResist'] = rnd.choices(['auto', 'simplificado', 'global'], weights=[0.6, 0.2, 0.2])[0]
    e['CLManual'] = round(u(1.0, 3.0), 3) if rnd.random() < 0.1 else None
    e['v0'] = round(u(0, 2), 2) if rnd.random() < 0.3 else 0
    e['FNotras'] = round(u(0, 800), 1) if rnd.random() < 0.3 else 0
    e['FS1'] = round(u(0, 500), 1) if rnd.random() < 0.25 else 0
    e['FS2'] = round(u(0, 500), 1) if rnd.random() < 0.3 else 0
    e['rendimiento'] = round(u(70, 98), 1)
    e['mu'] = round(u(0.15, 0.45), 3)
    e['phi'] = rnd.choice([180, 190, 200, 210, 220, 240]) if rnd.random() < 0.5 else round(u(120, 300), 1)
    e['D'] = rnd.choice([250, 315, 400, 500, 630, 800, 1000, 1250]) if rnd.random() < 0.7 else None
    e['flechaMax'] = rnd.choice([0.5, 1, 1.5, 2]) if rnd.random() < 0.7 else round(u(0.3, 3), 2)
    e['R'] = rnd.choice([100, 125, 160, 200, 250, 315, 400, 500, 630])
    e['zMinConstr'] = rnd.choice([1, 2, 3, 3, 3, 4])
    e['zProp'] = rnd.randint(1, 12) if rnd.random() < 0.25 else None
    if rnd.random() < 0.15:
        previo = referencia.calcular(e, tablas)
        if previo['datos'].get('T2min'):
            e['T2adoptada'] = round(previo['datos']['T2min'] * u(0.6, 2.5), 1)
    return e


def casos_limite():
    """Casos escritos a mano para los bordes de las tablas y todas las ramas del calculo."""
    lista = []

    def nuevo(nombre, **cambios):
        e = base()
        e.update(cambios)
        lista.append((nombre, e))

    nuevo('Ejemplo del Readme')
    nuevo('Cinta horizontal (k = 1 exacto)', H=0)
    nuevo('Cinta descendente suave', H=-12)
    nuevo('Descendente con Fu negativa (cinta generadora)', L=200, H=-60, f=0.018)
    nuevo('L = 80 m exacto: metodo global', L=80, H=6)
    nuevo('L = 80,01 m: metodo simplificado, C_L interpolado', L=80.01, H=6)
    nuevo('L = 100 m: C_L exacto de tabla', L=100, H=0)
    nuevo('L = 500 m: ultimo valor de C_L', L=500, H=20)
    nuevo('L = 501 m: fuera de tabla C_L', L=501, H=20)
    nuevo('L = 2,5 m forzando simplificado: fuera de tabla por abajo', L=2.5, H=0, metodoResist='simplificado')
    nuevo('L = 4,5 m forzando simplificado (tramo 4-5 m de la tabla)', L=4.5, H=0, metodoResist='simplificado')
    nuevo('Metodo global forzado en cinta larga', L=300, metodoResist='global', v0=0.5, FNotras=150)
    nuevo('Metodo simplificado con C_L manual', L=200, CLManual=1.45)
    nuevo('beta = 20 exacto (primera fila de factores)', beta=20, tamMax=150)
    nuevo('beta = 20,0001 (segunda fila de factores)', beta=20.0001, tamMax=150)
    nuevo('beta = 30 (maximo admitido)', beta=30)
    nuevo('Tamano exacto de columna (mixto 300 mm)', tamMax=300, beta=10, granulometria='mixto')
    nuevo('Material sin trozos (tamano 0)', tamMax=0)
    nuevo('Trozo demasiado grande: error', tamMax=900, granulometria='uniforme')
    nuevo('Granulometria uniforme', granulometria='uniforme', tamMax=60)
    nuevo('Un rodillo (plano)', nRodillos=1, **{'lambda': None})
    nuevo('Dos rodillos en V', nRodillos=2, **{'lambda': 30})
    nuevo('Tres rodillos a 45 grados', **{'lambda': 45})
    nuevo('Anchura fija 2000 mm (b = 0,9B - 0,05)', anchura=2000, Q=3000, materialVel='F1-A')
    nuevo('Anchura fija 2200 mm (b = B - 0,2)', anchura=2200, Q=4000, materialVel='F1-A')
    nuevo('Anchura fija con rodillo central manual', anchura=800, l3Manual=300)
    nuevo('Anchura fija demasiado estrecha (avisos)', anchura=400, modoVelocidad='exacta')
    nuevo('Velocidad exacta', modoVelocidad='exacta')
    nuevo('Velocidad maxima del fabricante', modoVelocidad='maxima')
    nuevo('Velocidad manual valida', modoVelocidad='manual', vManual=2.5)
    nuevo('Velocidad manual insuficiente con anchura fija', modoVelocidad='manual', vManual=1.0, anchura=650)
    nuevo('Sin velocidad normalizada suficiente: error', anchura=400, Q=900)
    nuevo('Ninguna anchura cumple: error', Q=20000, materialVel='F1-D')
    nuevo('Bandas extractoras con velocidad normalizada: error', materialVel='F2-extractoras', Q=50)
    nuevo('Bandas extractoras con velocidad exacta', materialVel='F2-extractoras', Q=50, modoVelocidad='exacta')
    nuevo('Fabricante 2 sin dato para 400 mm (anchura fija, maxima): error', materialVel='F2-granos', anchura=400,
          modoVelocidad='maxima', Q=50, tamMax=20)
    nuevo('Fabricante 2, arena de fundicion', materialVel='F2-arena', Q=150)
    nuevo('Metodo 2: velocidad normalizada exacta (2,09 m/s)', anchura=1000, metodoSeccion='catalogo', Qv1=100,
          densidad=1, Q=209, H=0, materialVel='F1-A')
    nuevo('Metodo 2 del Ejemplo 1 (1849 t/h)', Q=1500, densidad=1.4, beta=15, tamMax=250, materialVel='F2-granos',
          L=805, H=150, kManual=0.95, anchura=1000, metodoSeccion='catalogo', Qv1=415, modoVelocidad='manual',
          vManual=3.35, **{'lambda': 35})
    nuevo('k manual', kManual=0.9)
    nuevo('Rodillos con masas lineales directas', modoRodillos='directo', mRO=None, mRU=None, qRO=10, qRU=0)
    nuevo('Resistencias especiales FS1 y FS2', FS1=120, FS2=60)
    nuevo('Sin diametro de tambor', D=None)
    nuevo('T2 adoptada insuficiente: patina', T2adoptada=2000)
    nuevo('T2 adoptada mayor que la minima', T2adoptada=15000)
    nuevo('Adherencia determinante (mu bajo)', mu=0.12, phi=180)
    nuevo('Flecha del ramal inferior determinante', qB=40, lRU=4.5, mu=0.45, phi=240, Q=60, densidad=0.6)
    nuevo('Minimo constructivo de 1 capa', zMinConstr=1)
    nuevo('Minimo constructivo de 7 capas (S = 12)', zMinConstr=7)
    nuevo('Banda propuesta que cumple', zProp=4)
    nuevo('Banda propuesta que no cumple', zProp=1, zMinConstr=1, R=100)
    nuevo('Muchas capas (S = 13)', Q=3000, L=1200, H=150, R=100, materialVel='F1-A', tamMax=50)
    nuevo('Mas de 100 capas: error', Q=4000, L=1500, H=300, R=10, materialVel='F1-A', tamMax=50)
    return lista


def resumen_esperado(r):
    datos = {}
    for clave, valor in r['datos'].items():
        if isinstance(valor, float):
            valor = float('%.12g' % valor)
        datos[clave] = valor
    cands = [[c['B'], c['valida'], c['motivo']] for c in r['candidatos']]
    return {'errores': r['errores'], 'avisos': r['avisos'], 'datos': datos, 'candidatos': cands}


def main():
    n = int(sys.argv[1]) if len(sys.argv) > 1 else 1000
    salida = sys.argv[2] if len(sys.argv) > 2 else os.path.join(AQUI, 'casos.js')
    tablas = referencia.cargar_tablas()
    rnd = random.Random(SEMILLA)
    casos = []
    for nombre, e in casos_limite():
        casos.append({'id': 'L%02d' % (len(casos) + 1), 'nombre': nombre, 'entradas': e,
                      'esperado': resumen_esperado(referencia.calcular(e, tablas))})
    nlim = len(casos)
    for i in range(n):
        e = caso_aleatorio(rnd, tablas)
        casos.append({'id': 'A%05d' % (i + 1), 'nombre': 'Caso aleatorio %d' % (i + 1), 'entradas': e,
                      'esperado': resumen_esperado(referencia.calcular(e, tablas))})

    # Cobertura: cuantas veces se recorre cada rama
    cob = collections.Counter()
    for c in casos:
        e, x = c['entradas'], c['esperado']
        d = x['datos']
        cob['rodillos=%s' % e['nRodillos']] += 1
        cob['anchura=%s' % ('auto' if e['anchura'] == 'auto' else 'fija')] += 1
        cob['seccion=%s' % e['metodoSeccion']] += 1
        cob['velocidad=%s' % e['modoVelocidad']] += 1
        cob['material=%s' % e['materialVel'].split('-')[0]] += 1
        cob['trazado=%s' % ('horizontal' if e['H'] == 0 else ('sube' if e['H'] > 0 else 'baja'))] += 1
        for err in x['errores']:
            cob['ERROR ' + err] += 1
        for av in x['avisos']:
            cob['aviso ' + av] += 1
        if 'metodoResist' in d:
            cob['resistencias=%s' % d['metodoResist']] += 1
        if 'gobierna' in d:
            cob['T2 gobierna=%s' % d['gobierna']] += 1
        if 'Sz' in d:
            cob['S de la banda=%s' % d['Sz']] += 1
        if not x['errores'] and 'z' in d:
            cob['calculo completo'] += 1

    with open(salida, 'w', encoding='utf-8') as fh:
        fh.write('/* Casos de prueba generados por pruebas/generar_casos.py (semilla %d).\n' % SEMILLA)
        fh.write('   %d casos limite + %d casos aleatorios. Resultado esperado calculado con\n' % (nlim, n))
        fh.write('   pruebas/referencia.py (implementacion independiente en Python). No editar a mano. */\n')
        fh.write('var CASOS_PRUEBA = ')
        json.dump(casos, fh, ensure_ascii=False, separators=(',', ':'))
        fh.write(';\nif (typeof module !== "undefined") { module.exports = CASOS_PRUEBA; }\n')
    print('Generados %d casos (%d limite + %d aleatorios) en %s' % (len(casos), nlim, n, salida))
    for clave in sorted(cob):
        print('  %-40s %6d' % (clave, cob[clave]))


if __name__ == '__main__':
    main()
