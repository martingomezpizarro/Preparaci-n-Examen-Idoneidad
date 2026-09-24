# Mapa normativo del idóneo

Las ocho leyes de la bibliografía del **examen de idoneidad de la Comisión Nacional de Valores** (Argentina), abiertas por dentro: cómo está construida cada una, qué regula cada bloque y el **texto literal de cada artículo**. Más un glosario de definiciones legales y un cuestionario de **942 preguntas** con corrección inmediata.

Una sola página HTML, sin dependencias ni build. Abrís `index.html` y funciona.

> ⚠️ **Esto no es material oficial de la CNV**, no cuenta con su aval ni con su autorización. Es una ayuda de estudio, de uso libre y sin fines de lucro. Ante cualquier duda de examen, manda el texto legal, no el resumen.

## Qué tiene

**Las leyes.** Las ocho de la bibliografía, con su estructura completa de títulos, capítulos y secciones, y el texto actualizado de cada artículo desplegable:

| Ley | Materia |
|---|---|
| 26.831 | Mercado de Capitales |
| 27.440 | Financiamiento Productivo |
| 19.550 | Sociedades Comerciales |
| 23.576 | Obligaciones Negociables |
| 24.083 | Fondos Comunes de Inversión |
| 24.441 | Fideicomiso y letras hipotecarias |
| 22.169 | Funciones de la CNV |
| 24.467 | PyME y Sociedades de Garantía Recíproca |

Los artículos que la bibliografía pide expresamente están marcados con el módulo del programa que los toma. El filtro «Solo bibliografía» deja nada más esos. Cada artículo muestra además las otras leyes que su propio texto cita, y de qué reforma viene su redacción actual.

**El glosario.** Las definiciones que las propias leyes dan de sí mismas, literales, con un chip que te lleva al artículo exacto. La mayoría sale del art. 2 de la Ley 26.831. Además están las 135 definiciones del Título I de las Normas CNV, tal como quedó con la RG 1097/2025 (arts. 2 y 3: siglas, tipos de acción, Inversor Calificado, Valor Negociable Temático y más). El PDF de la resolución está en el repo.

Cada definición se puede practicar también como tarjeta para completar: se tapan algunas palabras clave (siempre las mismas para cada término; en las más importantes, como «Inversor Calificado», elegidas a mano: plazos, porcentajes, humanas/jurídicas, «Comisión Nacional de Valores»…) y hay que escribirlas. No importan tildes ni mayúsculas y se perdona un error de tipeo. Entran en la sesión diaria de micro-learning con la misma repetición espaciada que las demás tarjetas, o se practican solas desde el botón del glosario.

**El cuestionario.** 942 preguntas en tres modos: práctica (una por vez, con corrección inmediata), simulacro (todas seguidas, cronometradas) y repaso (todo a la vista para leer de corrido). Filtrás por módulo, por origen y por «solo las que fallé». El progreso queda en el navegador.

## Los dos bancos de preguntas

No son lo mismo y la página los distingue con un filtro de origen:

| Origen | Cantidad | Estado |
|---|---|---|
| Simulaciones corregidas | 221 | Verificadas contra el texto legal, con el artículo que las fundamenta enganchado |
| Guía de Estudio de la CNV, vía idoneocnv.com | 721 | Traen la clave de su autor; **no** están cruzadas contra la ley ni enganchadas a un artículo |

Las del segundo grupo aparecen marcadas con el chip **«Respuesta a confirmar»**. Sirven para practicar volumen y reflejo, no para citar. Si una choca con el artículo, gana el artículo.

Por módulo:

| | M1 | M2 | M3 | M4 | M5 | M6 |
|---|---|---|---|---|---|---|
| Simulaciones corregidas | 51 | 0 | 12 | 14 | 95 | 49 |
| Guía CNV · idoneocnv | 126 | 112 | 104 | 132 | 126 | 121 |
| **Total** | **177** | **112** | **116** | **146** | **221** | **170** |

## Estructura del examen

| | Examen total | Examen parcial |
|---|---|---|
| Preguntas | 60 multiple choice | 30 multiple choice |
| Módulos | 6 (10 cada uno) | según corresponda |
| Duración | 45 minutos | 23 minutos |
| Aprobación | 70% (42 correctas) | 70% (21 correctas) |

## Correr y editar

```bash
git clone https://github.com/TU-USUARIO/mapa-idoneo.git
cd mapa-idoneo
# abrilo con doble clic, o levantá un servidor local:
python3 -m http.server 8000   # y entrá a http://localhost:8000
```

Todo vive en `index.html`. Los datos están en constantes al principio del `<script>`:

| Constante | Qué guarda |
|---|---|
| `LEYES` | Estructura de cada ley: títulos, capítulos, artículos, módulos que los piden |
| `TEXTOS` | Texto literal de cada artículo, indexado por ley y número |
| `GLOSARIO` | Términos, definición literal y el artículo de donde sale (`l: "RG1097"` para el Título I de las Normas; `nc` la deja fuera de las tarjetas; `hue` fija los huecos a mano) |
| `PREGUNTAS` | El banco completo |

Una pregunta tiene esta forma:

```js
{
  id: "M1-01",          // único
  mod: 1,               // módulo 1 a 6
  q: "…",               // enunciado
  op: ["…", "…", "…"],  // opciones
  ok: [1],              // índices correctos; más de uno = multiple choice múltiple
  verif: true,          // false muestra el chip "Respuesta a confirmar"
  ley: "26831",         // engancha con TEXTOS; null si no está fundamentada
  art: "19",
  cita: null,           // texto libre extra al lado del fundamento
  porque: "…",          // explicación que se muestra al corregir
  aviso: null,          // advertencia destacada, si la clave es dudosa
  src: "…"              // de dónde salió
}
```

Para verificar una pregunta del banco de la Guía: buscá el artículo que la responde, completá `ley`, `art` y `porque`, y pasá `verif` a `true`.

## Errores y aportes

Si encontrás una respuesta mal, un artículo desactualizado o una reforma que falta, abrí un [issue](../../issues). Las correcciones sobre el texto legal tienen prioridad sobre cualquier otra cosa.

## Licencia y atribuciones

El código y la organización de esta página van bajo licencia MIT (ver [LICENSE](LICENSE)).

Las preguntas y los textos legales tienen cada uno su procedencia: está detallada en [ATRIBUCIONES.md](ATRIBUCIONES.md). Léelo antes de reutilizar el contenido.
