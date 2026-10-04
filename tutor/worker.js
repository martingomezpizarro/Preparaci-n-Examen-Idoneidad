// =====================================================================
//  Tutor del idóneo — cerebro (Cloudflare Worker)
// ---------------------------------------------------------------------
//  La página arma la pregunta con los artículos que vienen al caso (los
//  busca ella misma en las leyes, las Normas vigentes y el glosario que ya
//  tiene cargados) y los manda acá con el token de Firebase del usuario.
//  El Worker:
//    1. verifica que el token sea de una cuenta real del proyecto,
//    2. controla el cupo diario (por persona y total),
//    3. le pregunta a Gemini, con búsqueda en Google para lo que cambia,
//    4. devuelve el texto con las citas y las fuentes web usadas.
//
//  Variables (Settings → Variables and Secrets):
//    GEMINI_API_KEY   secreto — la key de Google AI Studio
//    FIREBASE_PROJECT idoneidad-48c77
//    MODELO           gemini-3.5-flash-lite        (opcional)
//    LIMITE_DIARIO    25   consultas por persona y día (opcional)
//    TOPE_GLOBAL      1500 consultas entre todos por día (opcional)
//    ADMINS           mails sin límite, separados por coma (opcional)
//    ORIGENES         dominios permitidos, separados por coma (opcional)
//  Enlace KV (Settings → Bindings → KV namespace):  CUPOS
// =====================================================================

const ORIGENES_DEF = [
  "https://idoneidad.martingomezpizarro.com.ar",
  "https://martingomezpizarro.github.io",
  "http://localhost:8765",
  "http://127.0.0.1:8765",
];
const MODELO_DEF = "gemini-3.5-flash-lite";
const JWKS_URL = "https://www.googleapis.com/service_accounts/v1/jwk/securetoken@system.gserviceaccount.com";

const MAX_PREGUNTA = 900;
const MAX_CONTEXTO = 26000;   // caracteres de artículos que acepta por consulta
const MAX_HIST = 6;
const MAX_AUDIO_SEG = 60;

const SISTEMA = `Sos el tutor del «Mapa del idóneo», una página gratuita para estudiar el examen de idoneidad de la Comisión Nacional de Valores (CNV) de Argentina. Hablás en español rioplatense, de vos, claro y cercano, como un buen ayudante de cátedra que además trabaja en el mercado.

CÓMO RESPONDÉS
- Primero la respuesta directa en una o dos oraciones. Después la explicación simple, con un ejemplo concreto del mercado argentino cuando ayude. Viñetas solo si ordenan. Unas 120 a 250 palabras salvo que te pidan más.
- Si hay una trampa típica de examen o un número para memorizar, cerrá con una línea que empiece con «Para el examen:».
- Negrita con **así** para los conceptos clave. No uses títulos ni tablas.

DE DÓNDE SALE LO QUE DECÍS
- Tu base son los FRAGMENTOS que te paso: artículos de las leyes de la bibliografía (26.831, 27.440, 19.550, 23.576, 24.083, 24.467, 24.441, 22.169), las Normas CNV en su texto vigente, el glosario de la RG 1097 y notas de la página sobre cómo es el mercado hoy.
- Cada afirmación normativa lleva su cita con la etiqueta EXACTA del fragmento entre dobles corchetes, pegada a la frase: [[L:26831:47]] o [[N:VII|I|1]]. Copiá la etiqueta tal cual; nunca inventes una ni cambies sus números. Si citás un artículo que no está entre los fragmentos, escribilo en texto normal («art. 20 de la Ley 26.831») sin corchetes.
- Si los fragmentos no alcanzan para afirmar algo, decilo («con lo que tengo acá no lo puedo confirmar») en lugar de completar de memoria.
- Usá la búsqueda en Google solo para lo que cambia con el tiempo: valores vigentes (UVA, montos, aranceles), resoluciones generales nuevas, plazos de liquidación actuales, quiénes son hoy los mercados, ALyC, cámaras o calificadoras. Priorizá fuentes oficiales: cnv.gob.ar, argentina.gob.ar, boletinoficial.gob.ar, infoleg, bcra.gob.ar, uif.gob.ar, byma.com.ar, a3mercados.com.ar, cafci.org.ar. No tomes normas de blogs ni de foros.
- Cuando lo que dice la bibliografía del examen difiere de lo vigente, avisalo con una línea que empiece con «Ojo:» y explicá las dos cosas, porque el examen puede preguntar cualquiera de las dos.

LÍMITES
- No das recomendaciones de inversión personalizadas ni decís qué comprar o vender; si te lo piden, explicás el concepto y aclarás que eso le corresponde a un asesor con el perfil del cliente.
- Si la pregunta no tiene que ver con el mercado de capitales, el examen o las normas, respondé en una línea y volvé al tema.`;

// ---------------------------------------------------------------- utilidades
function cors(req, env) {
  const permitidos = env.ORIGENES ? env.ORIGENES.split(",").map(s => s.trim()) : ORIGENES_DEF;
  const o = req.headers.get("Origin") || "";
  return {
    "Access-Control-Allow-Origin": permitidos.includes(o) ? o : permitidos[0],
    "Access-Control-Allow-Methods": "GET, POST, OPTIONS",
    "Access-Control-Allow-Headers": "Authorization, Content-Type",
    "Access-Control-Max-Age": "86400",
    "Vary": "Origin",
  };
}
function json(req, env, obj, status = 200) {
  return new Response(JSON.stringify(obj), {
    status, headers: { "Content-Type": "application/json; charset=utf-8", ...cors(req, env) },
  });
}
const b64u = s => Uint8Array.from(atob(s.replace(/-/g, "+").replace(/_/g, "/") + "===".slice((s.length + 3) % 4)), c => c.charCodeAt(0));
const hoyAR = () => new Date(Date.now() - 3 * 3600e3).toISOString().slice(0, 10);

// ---------------------------------------------------------------- token de Firebase
let JWKS = null, JWKS_VENCE = 0;
async function llaves() {
  if (JWKS && Date.now() < JWKS_VENCE) return JWKS;
  const r = await fetch(JWKS_URL, { cf: { cacheTtl: 3600 } });
  if (!r.ok) throw new Error("No se pudieron bajar las llaves de Google");
  const j = await r.json();
  JWKS = {};
  for (const k of j.keys) {
    JWKS[k.kid] = await crypto.subtle.importKey("jwk", k, { name: "RSASSA-PKCS1-v1_5", hash: "SHA-256" }, false, ["verify"]);
  }
  JWKS_VENCE = Date.now() + 3600e3;
  return JWKS;
}
async function usuario(req, env) {
  const m = (req.headers.get("Authorization") || "").match(/^Bearer\s+(.+)$/);
  if (!m) return null;
  const partes = m[1].split(".");
  if (partes.length !== 3) return null;
  const cab = JSON.parse(new TextDecoder().decode(b64u(partes[0])));
  const p = JSON.parse(new TextDecoder().decode(b64u(partes[1])));
  if (cab.alg !== "RS256") return null;
  let ks = await llaves();
  if (!ks[cab.kid]) { JWKS = null; ks = await llaves(); }
  const llave = ks[cab.kid];
  if (!llave) return null;
  const ok = await crypto.subtle.verify("RSASSA-PKCS1-v1_5", llave, b64u(partes[2]),
    new TextEncoder().encode(partes[0] + "." + partes[1]));
  if (!ok) return null;
  const proy = env.FIREBASE_PROJECT || "idoneidad-48c77";
  const ahora = Math.floor(Date.now() / 1000);
  if (p.aud !== proy || p.iss !== "https://securetoken.google.com/" + proy) return null;
  if (!p.sub || p.exp < ahora || p.iat > ahora + 300) return null;
  return { uid: p.sub, mail: (p.email || "").toLowerCase(), verificado: !!p.email_verified };
}

// ---------------------------------------------------------------- cupos
const MEM = new Map();   // respaldo si no hay KV enlazado (cuenta por instancia, no es exacto)
async function leer(env, k) {
  if (env.CUPOS) return +(await env.CUPOS.get(k)) || 0;
  return MEM.get(k) || 0;
}
async function sumar(env, k, n) {
  if (env.CUPOS) return env.CUPOS.put(k, String(n), { expirationTtl: 60 * 60 * 48 });
  MEM.set(k, n);
}
async function cupo(env, u, tipo) {
  const dia = hoyAR();
  const admin = (env.ADMINS || "").toLowerCase().split(",").map(s => s.trim()).filter(Boolean).includes(u.mail);
  const lim = admin ? Infinity : (+env.LIMITE_DIARIO || 25) * (tipo === "voz" ? 2 : 1);
  const tope = +env.TOPE_GLOBAL || 1500;
  const kU = `${tipo}:${dia}:${u.uid}`, kG = `${tipo}:${dia}:todos`;
  const [usados, global] = await Promise.all([leer(env, kU), leer(env, kG)]);
  if (usados >= lim) return { ok: false, motivo: `Llegaste al tope de ${lim} consultas de hoy. Mañana se renueva.` };
  if (!admin && global >= tope * (tipo === "voz" ? 2 : 1)) return { ok: false, motivo: "El tutor llegó al tope del día entre todos los usuarios. Mañana vuelve." };
  return {
    ok: true,
    quedan: lim === Infinity ? null : lim - usados - 1,
    anotar: () => Promise.all([sumar(env, kU, usados + 1), sumar(env, kG, global + 1)]),
  };
}

// ---------------------------------------------------------------- Gemini
async function gemini(env, cuerpo) {
  const modelo = env.MODELO || MODELO_DEF;
  const r = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/${modelo}:generateContent`, {
    method: "POST",
    headers: { "Content-Type": "application/json", "x-goog-api-key": env.GEMINI_API_KEY },
    body: JSON.stringify(cuerpo),
  });
  const j = await r.json().catch(() => ({}));
  if (!r.ok) {
    const msg = (j.error && j.error.message) || ("Gemini respondió " + r.status);
    const e = new Error(r.status === 429 ? "El tutor está saturado. Probá de nuevo en un minuto." : msg);
    e.status = r.status === 429 ? 429 : 502;
    throw e;
  }
  return j;
}
function textoDe(j) {
  const c = j.candidates && j.candidates[0];
  const partes = (c && c.content && c.content.parts) || [];
  return partes.filter(p => p.text && !p.thought).map(p => p.text).join("").trim();
}

async function preguntar(req, env, u) {
  const d = await req.json().catch(() => null);
  if (!d || typeof d.pregunta !== "string" || !d.pregunta.trim()) return json(req, env, { error: "Falta la pregunta." }, 400);
  const pregunta = d.pregunta.trim().slice(0, MAX_PREGUNTA);
  let resto = MAX_CONTEXTO;
  const frag = [];
  for (const c of Array.isArray(d.contexto) ? d.contexto.slice(0, 14) : []) {
    if (!c || typeof c.id !== "string" || typeof c.txt !== "string") continue;
    const t = `[[${c.id.slice(0, 40)}]] ${String(c.et || "").slice(0, 160)}\n${c.txt.slice(0, Math.min(4000, resto))}`;
    resto -= t.length;
    frag.push(t);
    if (resto <= 0) break;
  }
  const c = await cupo(env, u, "consulta");
  if (!c.ok) return json(req, env, { error: c.motivo, tope: true }, 429);

  const hist = (Array.isArray(d.historial) ? d.historial : []).slice(-MAX_HIST)
    .filter(h => h && typeof h.txt === "string" && (h.rol === "user" || h.rol === "model"))
    .map(h => ({ role: h.rol, parts: [{ text: h.txt.slice(0, 2500) }] }));
  const turno = `Fecha de hoy: ${hoyAR()}.\n\n<fragmentos>\n${frag.join("\n\n") || "(no se encontraron fragmentos para esta pregunta)"}\n</fragmentos>\n\n<pregunta>\n${pregunta}\n</pregunta>`;
  const cuerpo = {
    systemInstruction: { parts: [{ text: SISTEMA }] },
    contents: [...hist, { role: "user", parts: [{ text: turno }] }],
    generationConfig: { temperature: 0.3, maxOutputTokens: 1400 },
  };
  if (d.web !== false) cuerpo.tools = [{ googleSearch: {} }];

  const j = await gemini(env, cuerpo);
  const texto = textoDe(j);
  if (!texto) return json(req, env, { error: "El tutor no devolvió respuesta. Probá reformular la pregunta." }, 502);
  await c.anotar();
  const g = (j.candidates[0] && j.candidates[0].groundingMetadata) || {};
  const web = [];
  for (const ch of g.groundingChunks || []) {
    if (ch.web && ch.web.uri && !web.some(w => w.uri === ch.web.uri)) web.push({ uri: ch.web.uri, titulo: ch.web.title || "" });
  }
  return json(req, env, {
    texto,
    web: web.slice(0, 8),
    busquedas: g.webSearchQueries || [],
    sugerencias: (g.searchEntryPoint && g.searchEntryPoint.renderedContent) || "",
    quedan: c.quedan,
  });
}

async function transcribir(req, env, u) {
  const d = await req.json().catch(() => null);
  if (!d || typeof d.audio !== "string") return json(req, env, { error: "Falta el audio." }, 400);
  if ((+d.segundos || 0) > MAX_AUDIO_SEG || d.audio.length > 2_800_000) return json(req, env, { error: "El audio es muy largo (máximo un minuto)." }, 413);
  const c = await cupo(env, u, "voz");
  if (!c.ok) return json(req, env, { error: c.motivo, tope: true }, 429);
  const j = await gemini(env, {
    contents: [{
      role: "user", parts: [
        { inlineData: { mimeType: "audio/wav", data: d.audio } },
        { text: "Transcribí este audio en español rioplatense, tal cual lo dijo la persona, con buena puntuación. Es una consulta de estudio sobre el mercado de capitales argentino: escribí bien siglas y números de normas (CNV, ALyC, AN, AP, AAGI, FCI, ON, OPA, UIF, PLAFT, SGR, BYMA, A3, Ley 26.831, RG 622, Título VII). Devolvé solo la transcripción, sin comillas ni comentarios. Si no se entiende nada, devolvé vacío." },
      ],
    }],
    generationConfig: { temperature: 0, maxOutputTokens: 400 },
  });
  await c.anotar();
  return json(req, env, { texto: textoDe(j) });
}

// ---------------------------------------------------------------- entrada
export default {
  async fetch(req, env) {
    if (req.method === "OPTIONS") return new Response(null, { status: 204, headers: cors(req, env) });
    const ruta = new URL(req.url).pathname.replace(/\/+$/, "") || "/";
    try {
      if (req.method === "GET" && (ruta === "/" || ruta === "/estado")) {
        return json(req, env, {
          ok: !!env.GEMINI_API_KEY, servicio: "tutor-idoneo", modelo: env.MODELO || MODELO_DEF,
          limite: +env.LIMITE_DIARIO || 25, kv: !!env.CUPOS,
        });
      }
      if (req.method !== "POST" || (ruta !== "/preguntar" && ruta !== "/transcribir")) return json(req, env, { error: "No existe." }, 404);
      if (!env.GEMINI_API_KEY) return json(req, env, { error: "Falta cargar la GEMINI_API_KEY en el Worker." }, 500);
      const u = await usuario(req, env);
      if (!u) return json(req, env, { error: "Tenés que ingresar con tu cuenta para usar el tutor.", login: true }, 401);
      return ruta === "/preguntar" ? await preguntar(req, env, u) : await transcribir(req, env, u);
    } catch (e) {
      return json(req, env, { error: (e && e.message) || "Algo salió mal en el tutor." }, e.status || 500);
    }
  },
};
