"""
referencia.py - Implementacion de referencia en Python del dimensionado de cintas.

Se ha escrito de forma INDEPENDIENTE de js/calculos.js, directamente a partir de las
formulas de los apuntes, para comprobar la aplicacion web: si las dos implementaciones
dan el mismo resultado en cientos de casos distintos, un error tendria que haberse
cometido dos veces, en dos lenguajes distintos, de la misma manera.

Solo usa la biblioteca estandar de Python. Lee las tablas de datos/datos.json.
"""
import bisect
import json
import math
import os

TOL = 1e-9


def ge(a, b):
    """a >= b con la misma tolerancia relativa que la aplicacion."""
    return a >= b - TOL * max(1.0, abs(b))


def le(a, b):
    return a <= b + TOL * max(1.0, abs(b))


def cargar_tablas(ruta=None):
    if ruta is None:
        ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'datos', 'datos.json')
    with open(ruta, encoding='utf-8') as fh:
        return Tablas(json.load(fh))


class Tablas:
    def __init__(self, datos):
        self.g = datos['g']
        self.velocidades = list(datos['velocidadesNormalizadas']['valores'])
        self.tabla_k = [tuple(p) for p in datos['factorInclinacion']['filas']]
        self.fab1 = {f['B']: f for f in datos['anchurasYVelocidades']['filas']}
        self.anchos = sorted(self.fab1)
        self.fab2 = {m['id']: m['tramos'] for m in datos['velocidadesFabricante2']['materiales']}
        self.factor_trozo = datos['factorTamanoTerron']['filas']
        self.rodillos = {f['B']: f for f in datos['longitudRodillos']['filas']}
        self.tabla_cl = [tuple(p) for p in datos['coeficienteCL']['filas']]
        self.seguridad = datos['coeficienteSeguridadCapas']['filas']


def interpolar(tabla, x):
    """Interpolacion lineal; fuera de la tabla, valor del extremo."""
    xs = [p[0] for p in tabla]
    if x <= xs[0]:
        return tabla[0][1]
    if x >= xs[-1]:
        return tabla[-1][1]
    j = bisect.bisect_right(xs, x)          # xs[j-1] <= x < xs[j]
    (x1, y1), (x2, y2) = tabla[j - 1], tabla[j]
    if x == x1:
        return y1
    return y1 + (y2 - y1) * (x - x1) / (x2 - x1)


def coef_seguridad(t, z):
    for fila in t.seguridad:
        if z >= fila['zMin'] and (fila['zMax'] is None or z <= fila['zMax']):
            return fila['S']
    raise ValueError(z)


def velocidad_maxima(t, B, clave):
    fabricante, categoria = clave.split('-')
    if fabricante == 'F1':
        fila = t.fab1.get(B)
        return (fila['vmax'][categoria], None) if fila else (None, None)
    for tramo in t.fab2[categoria]:
        if (tramo['desde'] is None or B >= tramo['desde']) and (tramo['hasta'] is None or B <= tramo['hasta']):
            return tramo['vmax'], tramo.get('vmin')
    return None, None


def calcular(e, t):
    """Devuelve {'errores': [codigos], 'avisos': [codigos], 'datos': {...}, 'candidatos': [...]}."""
    out = {'errores': [], 'avisos': [], 'datos': {}, 'candidatos': []}
    d = out['datos']
    g = t.g

    # 1. Inclinacion delta = arcsen(H/L) y factor k (tabla interpolada con |delta|)
    seno = e['H'] / e['L']
    delta = math.asin(seno)
    grados = math.degrees(delta)
    k = e['kManual'] if e.get('kManual') is not None else interpolar(t.tabla_k, abs(grados))
    d.update(seno=seno, delta=delta, deltaGrados=grados, k=k)

    # 2. Anchura minima por el tamano de los trozos
    gran, tam = e['granulometria'], e['tamMax']
    if tam <= 0:
        b_tabla, factor, b_req, b_factor = t.anchos[0], None, 0, t.anchos[0]
    else:
        b_tabla = next((B for B in t.anchos if ge(t.fab1[B][gran], tam)), None)
        fila = next(f for f in t.factor_trozo if le(e['beta'], f['betaMax']))
        factor = fila[gran]
        b_req = factor * tam
        b_factor = next((B for B in t.anchos if ge(B, b_req)), None)
    b_min = max(b_tabla, b_factor) if (b_tabla is not None and b_factor is not None) else None
    d.update(BminTabla=b_tabla, factorTrozo=factor, BminFactorReq=b_req, BminFactor=b_factor, Bmin=b_min)

    # 3. Recorrido de anchuras candidatas
    automatica = e['anchura'] == 'auto'
    if automatica:
        if b_min is None:
            out['errores'].append('TROZO_GRANDE')
            return out
        lista = [B for B in t.anchos if B >= b_min]
    else:
        lista = [e['anchura']]

    elegido = None
    for B in lista:
        c = {'B': B, 'b': None, 'l3': None, 'S1': None, 'S2': None}
        if e['metodoSeccion'] == 'catalogo':
            c['S'] = e['Qv1'] / 3600.0
        else:
            Bm = B / 1000.0
            b = 0.9 * Bm - 0.05 if Bm <= 2 else Bm - 0.2
            n = e['nRodillos']
            lam = 0.0 if n == 1 else math.radians(e['lambda'])
            if n == 3:
                l3_mm = e['l3Manual'] if e.get('l3Manual') is not None else t.rodillos[B]['tres']
                l3 = l3_mm / 1000.0
            else:
                l3 = 0.0
            tg = math.tan(math.radians(e['beta']))
            s1 = (l3 + (b - l3) * math.cos(lam)) ** 2 * tg / 6.0
            s2 = (l3 + (b - l3) / 2.0 * math.cos(lam)) * ((b - l3) / 2.0 * math.sin(lam))
            c.update(b=b, l3=l3, S1=s1, S2=s2, S=s1 + s2)
        vmax, vmin = velocidad_maxima(t, B, e['materialVel'])
        vreq = e['Q'] / (3600.0 * c['S'] * e['densidad'] * k)
        modo, v, motivo = e['modoVelocidad'], None, None
        if modo == 'normalizada':
            v = next((x for x in t.velocidades if ge(x, vreq)), None)
            if v is None:
                motivo = 'sinNormalizada'
        elif modo == 'exacta':
            v = vreq
        elif modo == 'maxima':
            v = vmax
            if v is None:
                motivo = 'sinVmax'
        else:
            v = e['vManual']
        if motivo is None:
            if vmax is None:
                motivo = 'sinVmax'
            elif not le(v, vmax):
                motivo = 'superaVmax'
            elif not ge(v, vreq):
                motivo = 'insuficiente'
        c.update(vmax=vmax, vmin=vmin, vReq=vreq, v=v, valida=motivo is None, motivo=motivo)
        out['candidatos'].append(c)
        if not automatica or c['valida']:
            elegido = c
            break
    if elegido is None:
        out['errores'].append('SIN_ANCHURA')
        return out
    if elegido['v'] is None:
        out['errores'].append('SIN_VELOCIDAD')
        return out

    B, S, v = elegido['B'], elegido['S'], elegido['v']
    vmax, vmin = elegido['vmax'], elegido['vmin']
    Q, rho = e['Q'], e['densidad']
    q_real = 3600.0 * v * S * rho * k
    d.update(B=B, b=elegido['b'], l3=elegido['l3'], S1=elegido['S1'], S2=elegido['S2'], S=S,
             Qv1m=3600.0 * S, vmax=vmax, vmin=vmin, vReq=elegido['vReq'], v=v,
             Qreal=q_real, QvReal=3600.0 * v * S * k, llenado=Q / q_real,
             trozoOK=b_min is not None and B >= b_min,
             velocidadOK=vmax is not None and le(v, vmax),
             capacidadOK=ge(q_real, Q))
    if not d['trozoOK']:
        out['avisos'].append('TROZO')
    if vmax is None:
        out['avisos'].append('SIN_VMAX')
    elif not d['velocidadOK']:
        out['avisos'].append('VELOCIDAD')
    if vmin is not None and v < vmin - TOL:
        out['avisos'].append('VELOCIDAD_BAJA')
    if not d['capacidadOK']:
        out['avisos'].append('CAPACIDAD')

    # 4. Masas por unidad de longitud
    qG = Q / (3.6 * v)
    if e['modoRodillos'] == 'estacion':
        qRO, qRU = e['mRO'] / e['lRO'], e['mRU'] / e['lRU']
    else:
        qRO, qRU = e['qRO'], e['qRU']
    d.update(qG=qG, mPunto=qG * v, qRO=qRO, qRU=qRU)

    # 5. Resistencias al movimiento
    L, H, qB = e['L'], e['H'], e['qB']
    metodo = e['metodoResist']
    if metodo == 'auto':
        metodo = 'simplificado' if L > 80 else 'global'
    cosd = math.cos(delta)
    corchete = qRO + qRU + (2 * qB + qG) * cosd
    CL = Lc = FH = FNacc = FN = None
    if metodo == 'simplificado':
        if e.get('CLManual') is not None:
            CL = e['CLManual']
        else:
            CL = interpolar(t.tabla_cl, L)
            if L < t.tabla_cl[0][0] or L > t.tabla_cl[-1][0]:
                out['avisos'].append('CL_FUERA')
        if L <= 80:
            out['avisos'].append('CL_CORTA')
        Lc = CL * L
        FHN = e['f'] * Lc * g * corchete
    else:
        FH = e['f'] * L * g * corchete
        FNacc = d['mPunto'] * (v - e['v0'])
        FN = FNacc + e['FNotras']
        FHN = FH + FN
    FSt = qG * g * H
    Fu = FHN + e['FS1'] + e['FS2'] + FSt
    d.update(metodoResist=metodo, CL=CL, cosDelta=cosd, corchete=corchete, Lc=Lc, FH=FH,
             FNacc=FNacc, FN=FN, FHN=FHN, FSt=FSt, Fu=Fu)

    # 6. Potencia
    Pt = Fu * v
    d.update(Pt=Pt, Pm=Pt / (e['rendimiento'] / 100.0), M=None, omega=None, rpm=None)
    if e.get('D') is not None:
        radio = e['D'] / 2000.0
        d.update(M=Fu * radio, omega=v / radio, rpm=(v / radio) * 60 / (2 * math.pi))

    if not Fu > 0:
        out['avisos'].append('FU_NO_POSITIVA')
        return out

    # 7. Tensiones: Euler-Eytelwein y flecha
    E = math.exp(e['mu'] * math.radians(e['phi']))
    h = e['flechaMax'] / 100.0
    T2adh = Fu / (E - 1)
    Tsup = (qB + qG) * g * cosd * e['lRO'] / (8 * h)
    Tinf = qB * g * cosd * e['lRU'] / (8 * h)
    T2min = max(T2adh, Tsup, Tinf)
    gobierna = 'adherencia' if T2min == T2adh else ('flechaSup' if T2min == Tsup else 'flechaInf')
    T2 = e['T2adoptada'] if e.get('T2adoptada') is not None else T2min
    T1 = T2 + Fu
    h_sup = (qB + qG) * g * cosd * e['lRO'] ** 2 / (8 * T2)
    h_inf = qB * g * cosd * e['lRU'] ** 2 / (8 * T2)
    d.update(E=E, T2adh=T2adh, TsupMin=Tsup, TinfMin=Tinf, T2min=T2min, gobierna=gobierna,
             T2=T2, T1=T1, relacion=T1 / T2, adherenciaOK=le(T1 / T2, E),
             FuMaxAdh=T2 * (E - 1), reservaAdh=T2 * (E - 1) / Fu - 1,
             phiMinGrados=math.degrees(math.log(Fu / T2 + 1) / e['mu']),
             hSup=h_sup, hRelSup=h_sup / e['lRO'], flechaSupOK=le(h_sup / e['lRO'], h),
             hInf=h_inf, hRelInf=h_inf / e['lRU'], flechaInfOK=le(h_inf / e['lRU'], h),
             lSupMax=8 * T2 * h / ((qB + qG) * g * cosd), lInfMax=8 * T2 * h / (qB * g * cosd))
    if not d['adherenciaOK']:
        out['avisos'].append('ADHERENCIA')
    if not d['flechaSupOK']:
        out['avisos'].append('FLECHA_SUP')
    if not d['flechaInfOK']:
        out['avisos'].append('FLECHA_INF')
    if e.get('T2adoptada') is None and gobierna == 'adherencia':
        out['avisos'].append('ADHERENCIA_LIMITE')    # apuntes pag. 25: no disenar en el limite

    # 8. Numero de capas: menor z con R*z*B/S(z) >= Tmax
    R, Tmax = e['R'], T1
    z_res = next((z for z in range(1, 101) if ge(R * z * B / coef_seguridad(t, z), Tmax)), None)
    if z_res is None:
        out['errores'].append('CAPAS')
        return out
    z = max(z_res, e['zMinConstr'])
    Sz = coef_seguridad(t, z)
    d.update(zRes=z_res, SzRes=coef_seguridad(t, z_res), zCalc=coef_seguridad(t, z_res) * Tmax / (R * B),
             z=z, Sz=Sz, Trotura=R * z * B, Tadm=R * z * B / Sz, reservaBanda=(R * z * B / Sz) / Tmax,
             resistenciaOK=le(Tmax, R * z * B / Sz))
    if e.get('zProp') is not None:
        zp = e['zProp']
        Sp = coef_seguridad(t, zp)
        d.update(zProp=zp, SzProp=Sp, zCalcProp=Sp * Tmax / (R * B), TadmProp=R * zp * B / Sp,
                 propOK=le(Tmax, R * zp * B / Sp))
        if not d['propOK']:
            out['avisos'].append('BANDA_PROPUESTA')
    return out


if __name__ == '__main__':
    tablas = cargar_tablas()
    ruta = os.path.join(os.path.dirname(os.path.abspath(__file__)), '..', 'datos', 'datos.json')
    with open(ruta, encoding='utf-8') as fh:
        ejemplos = json.load(fh)['ejemplos']
    for ej in ejemplos:
        r = calcular(ej['entradas'], tablas)
        dd = r['datos']
        print(ej['id'], r['errores'], r['avisos'],
              {c: dd.get(c) for c in ('B', 'v', 'Qreal', 'Fu', 'Pm', 'T2', 'T1', 'z')})
