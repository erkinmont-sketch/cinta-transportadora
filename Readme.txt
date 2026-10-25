==============================================================================
  DIMENSIONADO DE CINTAS TRANSPORTADORAS · Aplicación web
  Transporte y Manutención Industrial
  Máster Universitario en Ingeniería Industrial · Universidad de Salamanca
==============================================================================

  Autor ........... [Nombre y apellidos]
  Profesor ........ Raúl Muñoz
  Repositorio ..... https://github.com/erkinmont-sketch/cinta-transportadora
  Página web ...... https://erkinmont-sketch.github.io/cinta-transportadora/
  Fecha ........... noviembre de 2026


CONTENIDO
---------
   1. Qué hace la aplicación
   2. Cómo abrirla
   3. Archivos
   4. Datos de entrada
   5. Procedimiento de cálculo (fórmulas)
   6. Cómo reproducir los ejemplos de clase
   7. Ejemplo resuelto paso a paso
   8. Verificación de los cálculos
   9. Hipótesis y límites de la aplicación
  10. Referencias


==============================================================================
1. QUÉ HACE LA APLICACIÓN
==============================================================================

A partir de la capacidad de transporte que se necesita, del material y del
trazado de la cinta, la aplicación calcula:

  - la anchura de banda normalizada más estrecha que cumple,
  - la velocidad de la banda (normalizada según DIN 22101),
  - la sección del material y la capacidad real de transporte,
  - las resistencias al movimiento y la fuerza tangencial Fu,
  - la potencia en el tambor y la potencia del motor (y el par y las rpm
    del tambor si se da su diámetro),
  - las tensiones T1 y T2 (adherencia de Euler–Eytelwein y flecha entre
    rodillos),
  - el número de capas de la banda textil.

El resultado no es solo una cifra: cada paso se presenta como en una
resolución a mano, con la fórmula, los valores sustituidos y el resultado,
indicando de qué tabla o ecuación de los apuntes procede. Así cualquier valor
se puede comprobar con una calculadora. Los cálculos se repiten
automáticamente cada vez que se cambia un dato.

El procedimiento es el de la documentación de la asignatura (Indicaciones
para los ejercicios y Apuntes sobre cintas transportadoras). Las tablas que
se usan (velocidades normalizadas, factor k, anchuras mínimas, longitudes de
rodillos, coeficiente C_L, coeficientes de seguridad, etc.) están guardadas en
el archivo datos/datos.json, cada una con su fuente.


==============================================================================
2. CÓMO ABRIRLA
==============================================================================

No hay que instalar nada. Cualquiera de estas tres formas sirve:

  a) Abrir el archivo index.html con doble clic (Chrome, Edge, Firefox o
     Safari actuales). Funciona sin conexión a Internet.

  b) Abrir la página publicada en GitHub Pages (dirección al principio de este
     archivo).

  c) Con un servidor local, desde la carpeta del proyecto:
         python -m http.server 8000
     y abrir http://localhost:8000 en el navegador.

Nota sobre los datos: cuando la página se abre con doble clic (dirección
file://), los navegadores no permiten leer archivos .json por seguridad. Por
eso existe js/datos-respaldo.js, que es una copia exacta de datos/datos.json
generada automáticamente. La página usa datos/datos.json siempre que puede y la
copia solo en ese caso; al pie de la página se indica de dónde se han leído
las tablas. Las pruebas comprueban que las dos son idénticas.

Uso:
  1. Elegir un ejemplo en «Cargar un ejemplo» o escribir los datos propios
     (se admite coma o punto decimal).
  2. Leer el resumen (anchura, velocidad, capacidad, potencia, tensiones y
     capas) y, debajo, los 10 pasos del cálculo.
  3. Si falta un dato o es incorrecto, el campo se marca en rojo con una
     explicación. Si el diseño no cumple alguna comprobación, aparece un
     aviso en amarillo y la comprobación se marca con ✗.
  4. Al final, «Tablas de clase utilizadas» muestra las tablas del archivo
     JSON con los valores usados resaltados.
  5. «Imprimir informe» genera un informe con los datos y todos los pasos
     (se puede guardar como PDF).


==============================================================================
3. ARCHIVOS
==============================================================================

  index.html ................ Estructura de la página: formulario y zona de
                              resultados.
  css/estilos.css ........... Aspecto de la página (incluye modo oscuro y
                              estilo de impresión).
  js/calculos.js ............ Motor de cálculo. Contiene todas las fórmulas.
                              No toca la página: recibe los datos y las tablas
                              y devuelve todos los resultados intermedios.
                              Funciona igual en el navegador y en Node.js, lo
                              que permite probarlo automáticamente.
  js/interfaz.js ............ Lee el formulario, llama al motor y escribe los
                              pasos con las fórmulas; dibuja la sección.
  js/datos-respaldo.js ...... Copia automática de datos/datos.json (ver 2).
  datos/datos.json .......... Tablas de clase (con su fuente) y ejemplos.
  pruebas/pruebas.html ...... Página que ejecuta todas las pruebas en el
                              navegador y muestra el resultado.
  pruebas/referencia.py ..... Segunda implementación, independiente, en Python.
  pruebas/generar_casos.py .. Genera los casos de prueba y su resultado
                              esperado con referencia.py.
  pruebas/casos.js .......... 1053 casos de prueba generados.
  pruebas/ejemplos_clase.js . Ejemplos resueltos en clase y sus valores.
  pruebas/comparar.js ....... Compara la aplicación con los casos.
  pruebas/ejecutar_pruebas.js Ejecuta todas las pruebas desde la consola.
  pruebas/actualizar_respaldo.js  Regenera js/datos-respaldo.js.
  Readme.txt ................ Este archivo.


==============================================================================
4. DATOS DE ENTRADA
==============================================================================

1 · Material y capacidad
  Q .............. capacidad de transporte requerida (t/h).
  γ .............. densidad aparente del material (t/m³).
  β .............. ángulo de sobrecarga o de talud dinámico (°), hasta 30°.
                   Orientativo (Figura 7): fluidez muy buena 5°, buena 10°,
                   normal 20–25°, mala 30°.
  Tamaño máximo .. de los trozos (mm); 0 si no hay trozos.
  Granulometría .. mixta (10 % de gruesos, 90 % de finos) o uniforme (100 %
                   de gruesos).
  Tipo de material para la velocidad máxima: categorías A, B, C, D de la
                   Tabla 1.3 (fabricante 1) o materiales de la Figura 3 de las
                   Indicaciones (fabricante 2).

2 · Trazado
  L .............. longitud entre ejes de los tambores extremos (m).
  H .............. desnivel (m): positivo si sube, negativo si baja.
  k (opcional) ... factor de inclinación; vacío = se interpola en la tabla.

3 · Rodillos y anchura
  Estación de 1 rodillo (plana), 2 (en V) o 3 (en artesa); ángulo de artesa λ.
  Anchura B: automática (la menor que cumple) o fijada por el usuario.
  l3 (opcional): longitud del rodillo central si no es la de la tabla.
  Sección: Método 1 (fórmulas S1 + S2) o Método 2 (caudal volumétrico de
           catálogo a 1 m/s; exige fijar la anchura).

4 · Velocidad
  Normalizada DIN 22101 (recomendado): la menor normalizada que transporta Q.
  Exacta: la velocidad necesaria, sin normalizar.
  Máxima: la máxima admisible del fabricante.
  Manual: un valor elegido por el usuario.

5 · Resistencias al movimiento
  f .............. coeficiente de fricción (0,018 favorable; 0,020 normal;
                   0,023–0,030 desfavorable; 0,050 cojinetes de fricción).
  qB ............. masa de la banda por metro, en cada ramal (kg/m).
  Rodillos ....... masa de una estación superior e inferior (kg) y su
                   separación lRO, lRU (m); o directamente qRO, qRU (kg/m).
                   Las separaciones se usan también para la flecha.
  Método ......... automático (C_L si L > 80 m; global si L ≤ 80 m),
                   simplificado o global.
  C_L (opcional) . vacío = se interpola en la tabla.
  v0, otras FN ... solo en el método global: velocidad del material al caer en
                   el sentido de la cinta (m/s) y otras resistencias
                   secundarias (N).
  FS1, FS2 ....... resistencias especiales (N); 0 si no hay.

6 · Accionamiento y tensiones
  η (%), μ (rozamiento banda–tambor), φ (ángulo de abrazamiento, °),
  D (diámetro del tambor, mm, opcional), flecha relativa máxima (%),
  T2 adoptada (opcional; vacío = la mínima necesaria).

7 · Banda
  R .............. resistencia nominal de cada capa (N/mm), p. ej. EP 160.
  Mínimo constructivo de capas (normalmente 3).
  Comprobar una banda de z capas (opcional).


==============================================================================
5. PROCEDIMIENTO DE CÁLCULO
==============================================================================

Unidades: longitudes de la instalación en m, anchuras y rodillos en mm, Q en
t/h, γ en t/m³, masas lineales en kg/m, fuerzas en N, g = 9,81 m/s². Los
ángulos se introducen en grados y se pasan a radianes para calcular.
Los cálculos internos no se redondean; la página muestra los valores con
4 a 6 cifras significativas.

PASO 1 · Inclinación y factor k  (Indicaciones, Tabla 2; Apuntes, Tabla 1.1)
    δ = arcsen(H / L)
    k se interpola linealmente en la tabla con |δ| (nota del Ejercicio 13):
        k = k1 + (k2 − k1)·(|δ| − α1)/(α2 − α1)
    La tabla va de 0° a 30° (de 20° a 30° según la tabla del Ejemplo 1).

PASO 2 · Anchura mínima por el tamaño de los trozos  (Tablas 1.2 y 1.3)
    a) Tabla 1.3: menor anchura cuya columna «Uniforme» o «Mixto» admite el
       tamaño máximo.
    b) Tabla 1.2: B ≥ factor · tamaño máximo, con factor 3 (mixto) o 5
       (uniforme) si β ≤ 20°, y 6 o 10 si 20° < β ≤ 30°; se redondea a la
       anchura normalizada superior.
    B_mín = el mayor de los dos valores.

PASO 3 · Elección de la anchura y de la velocidad
    Se prueban las anchuras normalizadas (400, 500, 650, 800, 1000, 1200,
    1400, 1600, 1800, 2000 y 2200 mm) de menor a mayor desde B_mín. Para cada
    una se calcula la sección S (paso 4) y la velocidad necesaria
        v_nec = Q / (3600·S·γ·k)
    y se elige la velocidad según el criterio. Se adopta la primera anchura
    cuya velocidad no supera la máxima recomendada por el fabricante, porque
    interesa la banda más estrecha posible. Velocidades normalizadas
    (DIN 22101): 0,66 · 0,84 · 1,05 · 1,31 · 1,68 · 2,09 · 2,62 · 3,35 ·
    4,19 · 5,24 m/s.

PASO 4 · Sección transversal  (Indicaciones, Figuras 5 y 6; Apuntes ec. 1.1)
    Anchura útil:  b = 0,9·B − 0,05 si B ≤ 2 m;   b = B − 0,2 si B > 2 m
    l3 = longitud del rodillo central (tabla de la Figura 6) con 3 rodillos;
    l3 = 0 con 1 o 2 rodillos, y λ = 0 con 1 rodillo.
        S1 = [l3 + (b − l3)·cos λ]² · tan β / 6
        S2 = [l3 + (b − l3)/2 · cos λ] · [(b − l3)/2 · sen λ]
        S  = S1 + S2
    S1 es el casquete parabólico del talud y S2 el trapecio sobre la artesa.
    Método 2: S = Qv(1 m/s) / 3600, con Qv de la tabla del fabricante.

PASO 5 · Velocidad y capacidad  (Indicaciones, Figura 1; Apuntes ec. 1.2)
    Q  = 3600·v·S·γ·k   (t/h)          Qv = 3600·v·S·k   (m³/h)
    Se comprueba que v ≤ v_máx del fabricante y que Q ≥ Q requerida.

PASO 6 · Masas por unidad de longitud  (Indicaciones, Ejemplo 3)
    qG  = Q / (3,6·v)        (masa de la carga, kg/m)
    qRO = masa de una estación superior / separación lRO
    qRU = masa de una estación inferior / separación lRU

PASO 7 · Resistencias y fuerza tangencial  (Apuntes ec. 2.1 a 2.7)
    Método simplificado (L > 80 m):
        FH + FN = f · C_L·L · g · [qRO + qRU + (2·qB + qG)·cos δ]
        C_L se interpola en la tabla de clase; fuera de ella (L > 500 m) se
        toma el valor del extremo (1,05).
    Método global (L ≤ 80 m):
        FH = f · L · g · [qRO + qRU + (2·qB + qG)·cos δ]
        FN = ṁ·(v − v0) + otras,   con ṁ = qG·v (kg/s)
    Resistencia por la inclinación:  FSt = qG · g · H   (H con signo)
    Fuerza tangencial:  Fu = FH + FN + FS1 + FS2 + FSt

PASO 8 · Potencia  (Indicaciones, Potencia del motor)
    Pa = Fu · v            Pm = Pa / η
    Con el diámetro D del tambor: M = Fu·D/2;  ω = v/(D/2);  n = 60·ω/(2π)

PASO 9 · Tensiones  (Indicaciones, Euler–Eytelwein; Apuntes ec. 3.4 a 4.13)
    Adherencia:    T2,adh = Fu / (e^(μ·φ) − 1)
    Flecha (h relativa máxima, normalmente 1 %):
        ramal superior   T ≥ (qB + qG)·g·cos δ·lRO / (8·h)
        ramal inferior   T ≥ qB·g·cos δ·lRU / (8·h)
    T2 = máx(T2,adh; flecha superior; flecha inferior)  (Apuntes ec. 4.12)
    T1 = T2 + Fu
    Comprobaciones: T1/T2 ≤ e^(μ·φ); flechas h = q·g·cos δ·l²/(8·T2) ≤ límite.
    Información adicional: fuerza máxima transmisible T2·(e^(μφ) − 1),
    ángulo mínimo de abrazamiento ln(Fu/T2 + 1)/μ y separación máxima entre
    rodillos 8·T2·h/(q·g·cos δ).

PASO 10 · Número de capas  (Apuntes ec. 4.5 y 4.6, Tabla 4.1, Ejercicio 12)
    z ≥ S·Tmáx / (R·B)   con Tmáx = T1, R en N/mm y B en mm
    S = 11 hasta 5 capas, 12 de 6 a 9 capas y 13 con más de 9 capas. Como S
    depende de z, se itera igual que en el Ejercicio 12. Se adopta
    z = máx(z por resistencia; mínimo constructivo) y se comprueba
        T_adm = R·z·B / S ≥ T1
    Es la misma fórmula de las transparencias z = S·Tm/(100·B·R1), con Tm en
    kgf, B en m y R1 en kgf/cm.


==============================================================================
6. CÓMO REPRODUCIR LOS EJEMPLOS DE CLASE
==============================================================================

La lista «Cargar un ejemplo» incluye:

  - Ejemplo resuelto de este Readme (apartado 7).

  - Ejemplo 3 de las Indicaciones (granito, 100 t/h). Se usa el criterio de
    velocidad «exacta», como en la resolución de clase: v = 1,519 m/s,
    Fu = 1069,0 N y Pm = 1,91 kW (en clase 1068,56 N porque se redondea qG a
    18,27 kg/m). La aplicación completa el último apartado: con μ = 0,02 y
    φ = 210° resulta T1 = 15 124 N y la banda de 3 capas de 200 N/mm tiene
    T_adm = 200·3·400/11 = 21 818 N > T1, luego SÍ es adecuada.
    El enunciado pide la velocidad normalizada; con ese criterio (el
    recomendado) la aplicación da v = 1,68 m/s y Pm = 2,00 kW.

  - Ejemplo 1 de las Indicaciones con el Método 1 (fórmulas): la aplicación
    elige B = 1000 mm y v = 3,35 m/s, igual que la resolución de clase. La
    capacidad sale 1644 t/h (en lugar de 1849 t/h) porque la sección se
    calcula con las fórmulas y no con la tabla del fabricante.

  - Ejemplo 1 de las Indicaciones con el Método 2: B = 1000 mm,
    Qv = 415 m³/h a 1 m/s, v = 3,35 m/s y k = 0,95 (introducido a mano, como
    en clase) → Q = 415·3,35·1,4·0,95 = 1849 t/h.

Opciones útiles para comparar con una resolución a mano:
  - velocidad «exacta» o «manual» en lugar de la normalizada,
  - k o C_L introducidos a mano (p. ej. k = 0,95 o C = 1,45),
  - T2 adoptada a mano (para comprobar si una tensión dada patina),
  - número de capas a comprobar.


==============================================================================
7. EJEMPLO RESUELTO PASO A PASO
==============================================================================

ENUNCIADO
Dimensionar una cinta transportadora para 400 t/h de caliza fragmentada.

  Material: γ = 1,4 t/m³; ángulo de sobrecarga β = 20° (fluidez normal);
            tamaño máximo 100 mm; granulometría mixta (10 % de gruesos);
            material no abrasivo de tamaño medio → categoría B (Tabla 1.3).
  Trazado:  L = 150 m entre ejes de tambores; sube H = 12 m.
  Rodillos: estaciones de 3 rodillos con artesa λ = 30°. Estación superior de
            18 kg cada 1,2 m; estación inferior de 14 kg cada 3 m.
  Banda:    qB = 12 kg/m por ramal; tejido EP 160 (R = 160 N/mm); mínimo
            constructivo 3 capas.
  Otros:    f = 0,020 (rodamientos, estado normal); sin resistencias
            especiales (FS1 = FS2 = 0); rendimiento η = 90 %; tambor motriz
            de D = 500 mm con μ = 0,30 y φ = 200°; flecha máxima 1 %.
  Criterio: velocidad normalizada (DIN 22101).

Este ejemplo es el que se carga por defecto al abrir la aplicación; todos los
valores siguientes coinciden con los que muestra.

PASO 1 · Inclinación y factor k
    δ = arcsen(12/150) = arcsen(0,08) = 4,589°
    En la tabla: 4° → 0,99 y 6° → 0,98. Interpolando:
    k = 0,99 + (0,98 − 0,99)·(4,589 − 4)/(6 − 4) = 0,98706

PASO 2 · Anchura mínima
    Tabla 1.3, columna Mixto: 100 mm se admite desde B = 400 mm.
    Tabla 1.2: β = 20° ≤ 20° y 10 % de gruesos → factor 3:
               B ≥ 3·100 = 300 mm → 400 mm normalizada.
    B_mín = 400 mm.

PASO 3 · Elección de la anchura y la velocidad
    B (mm)   S (m²)     v_nec (m/s)   v_máx (m/s)   v adoptada   Resultado
    400      0,013534   5,941         2,09          —            no: v_nec > 5,24 m/s
    500      0,022779   3,530         2,62          4,19         no: 4,19 > 2,62
    650      0,041578   1,934         2,62          2,09         CUMPLE
    → B = 650 mm y v = 2,09 m/s.

PASO 4 · Sección (B = 650 mm)
    b  = 0,9·0,650 − 0,05 = 0,535 m
    l3 = 250 mm = 0,250 m (Figura 6, 3 rodillos)
    S1 = [0,250 + (0,535 − 0,250)·cos 30°]²·tan 20°/6
       = [0,250 + 0,24682]²·0,36397/6 = 0,49682²·0,060662 = 0,014973 m²
    S2 = [0,250 + 0,1425·cos 30°]·[0,1425·sen 30°]
       = 0,37341·0,07125 = 0,026605 m²
    S  = 0,014973 + 0,026605 = 0,041578 m²

PASO 5 · Velocidad y capacidad
    v_nec = 400 / (3600·0,041578·1,4·0,98706) = 400/206,84 = 1,9338 m/s
    v_máx (Tabla 1.3, 650 mm, categoría B) = 2,62 m/s
    v = 2,09 m/s (menor velocidad normalizada ≥ 1,9338)        2,09 ≤ 2,62 ✓
    Q = 3600·2,09·0,041578·1,4·0,98706 = 432,30 t/h             ≥ 400 t/h ✓
    Qv = 3600·2,09·0,041578·0,98706 = 308,79 m³/h; grado de llenado 92,5 %

PASO 6 · Masas por unidad de longitud
    qG  = 400/(3,6·2,09) = 53,163 kg/m
    qRO = 18/1,2 = 15,000 kg/m       qRU = 14/3 = 4,667 kg/m       qB = 12 kg/m

PASO 7 · Resistencias (L = 150 m > 80 m → método simplificado)
    C_L entre 125 m (1,6) y 160 m (1,5):
        C_L = 1,6 + (1,5 − 1,6)·(150 − 125)/(160 − 125) = 1,52857
    Lc = 1,52857·150 = 229,29 m
    cos δ = cos 4,589° = 0,996795
    FH + FN = 0,02·229,29·9,81·[15 + 4,667 + (2·12 + 53,163)·0,996795]
            = 44,986·96,583 = 4344,85 N
    FSt = 53,163·9,81·12 = 6258,37 N
    Fu  = 4344,85 + 0 + 0 + 6258,37 = 10 603,22 N

PASO 8 · Potencia
    Pa = 10 603,22·2,09 = 22 160,7 W = 22,16 kW
    Pm = 22,161/0,90 = 24,62 kW
    Tambor de 500 mm: M = 10 603,22·0,25 = 2650,81 N·m;
    ω = 2,09/0,25 = 8,36 rad/s;  n = 60·8,36/(2π) = 79,8 rpm

PASO 9 · Tensiones
    φ = 200° = 3,4907 rad;   e^(μφ) = e^(0,3·3,4907) = 2,8497
    Adherencia:      T2 ≥ 10 603,22/(2,8497 − 1) = 5732,54 N
    Flecha superior: T2 ≥ (12 + 53,163)·9,81·0,996795·1,2/(8·0,01) = 9558,03 N
    Flecha inferior: T2 ≥ 12·9,81·0,996795·3/(8·0,01) = 4400,35 N
    T2 = máx(5732,54; 9558,03; 4400,35) = 9558,03 N
         (manda la flecha del ramal superior)
    T1 = 9558,03 + 10 603,22 = 20 161,26 N
    Comprobaciones:
      T1/T2 = 2,1094 ≤ 2,8497 → no patina ✓
        (fuerza máxima transmisible 9558,03·1,8497 = 17 679 N; reserva 66,7 %)
      flecha superior = 12,00 mm = 1,000 % ≤ 1 % ✓ (justo en el límite)
      flecha inferior = 13,81 mm = 0,460 % ≤ 1 % ✓

PASO 10 · Número de capas
    Hipótesis 3 a 5 capas (S = 11):
        z ≥ 11·20 161,26/(160·650) = 2,132 → 3 capas (dentro del intervalo ✓)
    Mínimo constructivo: 3 capas → z = 3, S = 11
    T_adm = 160·3·650/11 = 28 363,6 N ≥ T1 = 20 161,3 N ✓

RESULTADO
    Banda de 650 mm en artesa de 3 rodillos a 30°, v = 2,09 m/s,
    capacidad 432,3 t/h, motor de al menos 24,62 kW, T1 = 20 161 N,
    T2 = 9558 N y banda EP 160 de 3 capas.


==============================================================================
8. VERIFICACIÓN DE LOS CÁLCULOS
==============================================================================

Para asegurar que no hay errores se han hecho tres tipos de comprobación. Se
pueden repetir abriendo pruebas/pruebas.html (no requiere instalar nada) o
con Node.js:   node pruebas/ejecutar_pruebas.js

1) Ejemplos resueltos en clase (pruebas/ejemplos_clase.js)
   Se han repetido con la aplicación los ejemplos de las Indicaciones
   (Ejemplos 1, 2 y 3) y de los Apuntes (Ejemplos 1 a 10 y Ejercicios 11 a
   15): 135 valores publicados. Resultado:
     - 120 coinciden hasta la última cifra publicada.
     - 11 difieren solo porque la resolución de clase redondea un valor
       intermedio (por ejemplo e^(μθ) = 2,566 o qG = 18,27 kg/m); la nota de
       cada uno indica el redondeo y el valor sin redondear.
     - 4 son erratas de los apuntes; la aplicación da el valor correcto, que
       se comprueba con un cálculo directo:
         · Apuntes, Ejemplo 6: T_adm = 160·2·800/11 = 23 273 N (en los
           apuntes 32 000 N; la reserva es 1,29 y no 1,78). La conclusión no
           cambia: 2 capas siguen siendo válidas.
         · Apuntes, Ejemplo 9: e^1,4137 = 4,111 (en los apuntes 4,112) y, en
           consecuencia, Fu,máx = 3000·(4,1112 − 1) = 9334 N (no 9336 N).
           La conclusión no cambia.
         · Apuntes, Ejercicio 13: 3,6·1,68·0,014·1500·0,81 = 102,88 t/h (en
           los apuntes 103,1 t/h).
   Además, la tabla de C_L de clase da 5,6 para L = 4 m (la norma DIN 22101
   da 7,6). No afecta a los resultados porque la aplicación solo usa C_L para
   L > 80 m, salvo que el usuario fuerce el método simplificado.

2) Implementación independiente (pruebas/referencia.py)
   El mismo cálculo se ha programado por separado en Python a partir de las
   fórmulas. Con él se han generado 53 casos límite (bordes de las tablas,
   todas las opciones, todos los avisos y errores) y 1000 casos aleatorios
   que recorren todas las ramas: 1, 2 y 3 rodillos; anchura automática y
   fija; Métodos 1 y 2; los cuatro criterios de velocidad; cintas
   horizontales, ascendentes y descendentes; métodos simplificado y global;
   T2 limitada por adherencia o por flecha; S = 11, 12 y 13...
   En los 1053 casos coinciden los 66 774 valores comparados (tolerancia
   relativa 10⁻⁹), así como los avisos, los errores y la lista de anchuras
   probadas. Durante el desarrollo se comprobaron también otros 20 053 casos
   con otra semilla (más de 1,2 millones de valores), todos coincidentes.
   Los casos se regeneran con:   python pruebas/generar_casos.py

3) Propiedades que debe cumplir todo resultado
   En cada caso se comprueba, por ejemplo, que T1 − T2 = Fu, que
   Q = 3600·v·S·γ·k, que T_adm ≥ T1, que con una capa menos no bastaría, que
   la anchura automática es la menor válida y que la iteración del Ejercicio
   12 da el mismo número de capas. También se comprueba que los datos
   incorrectos (vacíos, negativos, fuera de tabla...) se rechazan señalando
   el campo correcto, y que js/datos-respaldo.js es idéntico a
   datos/datos.json.


==============================================================================
9. HIPÓTESIS Y LÍMITES DE LA APLICACIÓN
==============================================================================

  - Cinta con un único tambor motriz; las tensiones se calculan con
    Euler–Eytelwein para ese tambor.
  - La flecha se comprueba con la tensión mínima T2 en los dos ramales, que
    es la hipótesis más desfavorable (Apuntes, ec. 4.12).
  - Bandas de carcasa textil (coeficientes de seguridad 11, 12 y 13). Para
    menos de 3 capas se aplica S = 11, como en el Ejemplo 6 de los apuntes.
  - Si Fu ≤ 0 (cinta descendente que arrastra al motor) se calculan las
    resistencias y la potencia, pero no las tensiones ni las capas, porque
    el motor trabajaría como freno y el planteamiento es distinto.
  - Anchuras normalizadas de 400 a 2200 mm; β hasta 30° (límite de la
    Tabla 1.2); inclinación hasta 30° (límite de la tabla de k).
  - La tabla de C_L llega a 500 m; para longitudes mayores se toma 1,05 y la
    aplicación avisa.
  - qG se calcula con la capacidad requerida, como en el Ejemplo 3 de las
    Indicaciones.
  - No se consideran el arranque ni el frenado.


==============================================================================
10. REFERENCIAS
==============================================================================

  - R. Muñoz. Indicaciones para los ejercicios: breves notas sobre el
    cálculo de cintas transportadoras (v6). Universidad de Salamanca.
  - R. Muñoz. Apuntes sobre cintas transportadoras (v1, 2026).
    Universidad de Salamanca.
  - Transparencias de clase: Cintas transportadoras, Tablas de cintas
    transportadoras, Transmisión de fuerza, Euler–Eytelwein.
  - DIN 22101. Continuous conveyors. Belt conveyors for loose bulk
    materials. Basis for calculation and dimensioning.
  - ISO 5048:1989. Belt conveyors with carrying idlers. Calculation of
    operating power and tensile forces.
  - J. Fuentes Losa (coord.) et al. Ingeniería del transporte. UNED, 2012.
  - Rulmeca. Rodillos y componentes para el transporte por banda de material
    a granel.
