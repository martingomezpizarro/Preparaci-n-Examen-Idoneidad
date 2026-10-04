# Activar el tutor del idóneo (unos 10 minutos)

La página ya tiene el tutor: el botón redondo abajo a la derecha. Falta encender el «cerebro»: un Worker de Cloudflare igual al de Jarvis, pero separado. Mientras no exista, el tutor avisa «todavía no está activado» y el resto de la página sigue igual.

## 1. Sacar la key de Gemini
1. Entrá a https://aistudio.google.com/apikey con tu cuenta de Google.
2. **Create API key** → elegí o creá un proyecto (por ejemplo `idoneo-tutor`). Copiá la key (`AIza…`).
3. Plan gratuito: alcanza para empezar. Si después querés más cupo o que Google no use los datos para entrenar, activás facturación en ese proyecto (Flash-Lite cuesta unos USD 0,002 por consulta; la búsqueda en Google trae 5.000 gratis por mes y después USD 14 cada 1.000).

## 2. Crear el Worker
1. https://dash.cloudflare.com → **Workers & Pages** → **Create** → **Create Worker**.
2. Nombre: **`idoneo-tutor`** (así queda en `https://idoneo-tutor.gomezpizarromartin.workers.dev`, que es la dirección que ya espera la página). → **Deploy**.
3. **Edit code** → borrá todo, pegá el contenido de `tutor/worker.js` de este repo → **Deploy**.

## 3. Cupos (KV)
1. **Storage & Databases → KV → Create** → nombre `idoneo-tutor-cupos`.
2. Volvé al Worker → **Settings → Bindings → Add → KV namespace** → nombre de variable **`CUPOS`**, namespace `idoneo-tutor-cupos` → Deploy.

## 4. Variables
Worker → **Settings → Variables and Secrets → Add**:

| Nombre | Tipo | Valor |
|---|---|---|
| `GEMINI_API_KEY` | **Secret** | la key del paso 1 |
| `FIREBASE_PROJECT` | Text | `idoneidad-48c77` |
| `ADMINS` | Text | `gomezpizarromartin@gmail.com` (vos sin tope) |
| `LIMITE_DIARIO` | Text | `25` (consultas por persona y día) |
| `TOPE_GLOBAL` | Text | `1500` (entre todos, por día) |
| `MODELO` | Text | opcional; por defecto `gemini-3.5-flash-lite` |

## 5. Probar
1. Abrí `https://idoneo-tutor.gomezpizarromartin.workers.dev/estado` → tiene que decir `"ok":true` y `"kv":true`.
2. En la página, con tu cuenta iniciada → botón del tutor → una pregunta. Tocá una cita: se abre el artículo.

## Cómo funciona
- La página busca en el navegador los artículos que vienen al caso (8 leyes, Normas vigentes, glosario de la RG 1097 y las notas de «Quién es quién hoy» y las fichas de agentes) y se los pasa al Worker con el token de la cuenta.
- El Worker verifica el token, controla el cupo y le pregunta a Gemini. Gemini responde citando esos artículos con etiquetas que la página verifica: si una cita no existe, aparece «sin verificar» en vez de botón.
- Para lo que cambia (valores en UVA, RG nuevas, plazos, actores del mercado) Gemini busca en Google priorizando fuentes oficiales, y la respuesta muestra las fuentes con la marca «oficial».
- Audio: el micrófono graba hasta un minuto, Gemini lo transcribe y lo pregunta.
- La conversación queda guardada en el dispositivo; «Nueva» la borra.
