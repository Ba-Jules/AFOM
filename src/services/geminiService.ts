// Service Gemini — compat ancien SDK (@google/generative-ai) et nouveau (@google/genai).
// Fournit: getAIAnalysis, proposeCentralProblem, proposeMatrixSelection, proposeOrientations.
// Tous renvoient du JSON, avec fallback heuristique quand l'API n'est pas dispo.

import type { PostIt, QuadrantKey, BoardContext } from "../types";

export type MatrixInteractionType = "O×A" | "O×F" | "M×A" | "M×F";

export type MatrixInteraction = {
  type: MatrixInteractionType;
  row: string;   // libellé opportunité ou menace
  col: string;   // libellé acquis ou faiblesse
};

/** Décode les marks Firestore ("r,c") en interactions typées */
export function decodeMatrixInteractions(
  marks: string[],
  selection: { acquis: string[]; faiblesses: string[]; opportunites: string[]; menaces: string[] }
): MatrixInteraction[] {
  const { acquis, faiblesses, opportunites, menaces } = selection;
  return marks
    .map((m) => {
      const [r, c] = m.split(",").map(Number);
      const isO = r < opportunites.length;
      const isA = c < acquis.length;
      const row = isO ? opportunites[r] : menaces[r - opportunites.length];
      const col = isA ? acquis[c] : faiblesses[c - acquis.length];
      if (!row || !col) return null;
      const type: MatrixInteractionType = isO
        ? (isA ? "O×A" : "O×F")
        : (isA ? "M×A" : "M×F");
      return { type, row, col };
    })
    .filter(Boolean) as MatrixInteraction[];
}

type Insight = { title: string; content: string };
type Recommendation = { title: string; content: string; priority?: "HIGH" | "MEDIUM" | "LOW" };

const API_KEY: string | undefined = import.meta.env.VITE_GEMINI_API_KEY as any;

/** Charge dynamiquement le constructeur GoogleGenerativeAI depuis l'un des SDKs */
let _CtorCache: any | undefined;
async function loadGoogleCtor(): Promise<any | null> {
  if (_CtorCache !== undefined) return _CtorCache;
  // Try legacy @google/generative-ai
  try {
    const mod: any = await import(/* @vite-ignore */ "@google/generative-ai");
    if (mod && (mod as any).GoogleGenerativeAI) {
      _CtorCache = (mod as any).GoogleGenerativeAI;
      return _CtorCache;
    }
  } catch (e) {
    // ignore
  }
  // Try new @google/genai
  try {
    const mod: any = await import(/* @vite-ignore */ "@google/genai");
    const ctor = (mod as any).GoogleGenerativeAI || (mod as any).GoogleAI || null;
    _CtorCache = ctor;
    return _CtorCache;
  } catch (e) {
    _CtorCache = null;
    return null;
  }
}

async function getModel(modelName = "gemini-1.5-flash"): Promise<any | null> {
  if (!API_KEY) return null;
  const Ctor = await loadGoogleCtor();
  if (!Ctor) return null;
  try {
    const genAI = new (Ctor as any)(API_KEY);
    const model = (genAI as any).getGenerativeModel
      ? (genAI as any).getGenerativeModel({
          model: modelName,
          generationConfig: { temperature: 0.7, responseMimeType: "application/json" },
        })
      : null;
    return model;
  } catch {
    return null;
  }
}

/** -------- Fallbacks locaux (sans IA) -------- */
function localAnalysisFallback(postIts: PostIt[]): { insights: Insight[]; recommendations: Recommendation[] } {
  const counts: Record<string, number> = { acquis: 0, faiblesses: 0, opportunites: 0, menaces: 0 };
  for (const p of postIts) counts[p.quadrant] = (counts[p.quadrant] || 0) + 1;

  const insights: Insight[] = [
    { title: "Répartition AFOM", content: `A:${counts.acquis} • F:${counts.faiblesses} • O:${counts.opportunites} • M:${counts.menaces}` },
  ];
  const recommendations: Recommendation[] = [];
  if (counts.faiblesses + counts.menaces > counts.acquis + counts.opportunites) {
    recommendations.push({ title: "Réduire les risques", content: "Prioriser la correction des faiblesses et l'atténuation des menaces.", priority: "HIGH" });
  } else {
    recommendations.push({ title: "Capitaliser sur les acquis", content: "Accélérer les initiatives qui exploitent les acquis et opportunités.", priority: "MEDIUM" });
  }
  return { insights, recommendations };
}

function localCentralFallback(mode: "full" | "fm"): { problem: string; rationale: string } {
  return mode === "fm"
    ? { problem: "Réduire l'impact des menaces en corrigeant les faiblesses prioritaires.", rationale: "Synthèse heuristique F+M (fallback sans IA)." }
    : { problem: "Focaliser les efforts sur un levier unique de transformation à fort impact.", rationale: "Synthèse heuristique AFOM complet (fallback sans IA)." };
}

function pickTopPerQuadrant(postIts: PostIt[], n = 4): Record<QuadrantKey, string[]> {
  const result: Record<QuadrantKey, string[]> = {
    acquis: [], faiblesses: [], opportunites: [], menaces: []
  };
  const byQ: Record<QuadrantKey, PostIt[]> = { acquis: [], faiblesses: [], opportunites: [], menaces: [] };
  for (const p of postIts) {
    if ((p as any).status === "bin") continue;
    byQ[p.quadrant].push(p);
  }
  (Object.keys(byQ) as QuadrantKey[]).forEach((k) => {
    const arr = byQ[k].slice().sort((a: any, b: any) => {
      // Favori d'abord si flag présent, sinon par sortIndex croissant puis timestamp
      const fa = (a as any).favorite ? 1 : 0;
      const fb = (b as any).favorite ? 1 : 0;
      if (fa !== fb) return fb - fa;
      const sa = (a as any).sortIndex ?? 0;
      const sb = (b as any).sortIndex ?? 0;
      if (sa !== sb) return sa - sb;
      const ta = (a as any).timestamp?.seconds ?? 0;
      const tb = (b as any).timestamp?.seconds ?? 0;
      return ta - tb;
    });
    result[k] = arr.slice(0, n).map((x) => x.id);
  });
  return result;
}

/** -------- Helpers contexte -------- */

/** Construit le bloc matrice pour les prompts */
function buildMatrixBlock(interactions?: MatrixInteraction[]): string {
  if (!interactions || interactions.length === 0) return "";
  const LABELS: Record<MatrixInteractionType, string> = {
    "O×A": "LEVIER (opportunité activable grâce à une force)",
    "O×F": "FREIN (opportunité bloquée par une faiblesse)",
    "M×A": "RÉSISTANCE (menace atténuée par une force)",
    "M×F": "BLOCAGE (menace amplifiant une faiblesse)",
  };
  const grouped: Record<MatrixInteractionType, string[]> = {
    "O×A": [], "O×F": [], "M×A": [], "M×F": []
  };
  for (const i of interactions) {
    grouped[i.type].push(`"${i.row}" × "${i.col}"`);
  }
  const lines: string[] = ["\n\nINTERACTIONS MATRICE :"];
  (["O×A", "O×F", "M×A", "M×F"] as MatrixInteractionType[]).forEach((t) => {
    if (grouped[t].length > 0) {
      lines.push(`  ${LABELS[t]} :\n    ${grouped[t].join("\n    ")}`);
    }
  });
  return lines.join("\n");
}

function buildContextBlock(ctx?: BoardContext): string {
  if (!ctx) return "";
  const parts: string[] = [];
  if (ctx.situationActuelle) parts.push(`Situation actuelle : ${ctx.situationActuelle}`);
  if (ctx.symptomesObservables) parts.push(`Symptômes observables : ${ctx.symptomesObservables}`);
  if (ctx.perimetre) parts.push(`Périmètre : ${ctx.perimetre}`);
  if (ctx.problematique) parts.push(`Problématique identifiée : ${ctx.problematique}`);
  if (ctx.acteurs) parts.push(`Acteurs : ${ctx.acteurs}`);
  if (ctx.zone) parts.push(`Zone / Population : ${ctx.zone}`);
  if (ctx.enjeux) parts.push(`Enjeux : ${ctx.enjeux}`);
  if (parts.length === 0) return "";
  return `\n\nCONTEXTE DE LA SESSION :\n${parts.join("\n")}`;
}

/** -------- Fonctions exportées -------- */

/** extractContextFromDocument — analyse un texte extrait d'un TDR/rapport et renvoie un contexte structuré */
export async function extractContextFromDocument(text: string): Promise<{
  problematique: string; acteurs: string; zone: string; enjeux: string;
}> {
  const model = await getModel();
  if (!model) return { problematique: "", acteurs: "", zone: "", enjeux: "" };

  const sys = `
Tu es un assistant d'analyse documentaire. À partir du texte ci-dessous (extrait d'un TDR ou document de projet),
identifie et extrais les éléments clés suivants. Retourne STRICTEMENT du JSON :
{
  "problematique": "formulation courte de la problématique principale (2-3 phrases max)",
  "acteurs": "liste des acteurs / parties prenantes principaux, séparés par des virgules",
  "zone": "zone géographique ou population concernée",
  "enjeux": "principaux enjeux en 2-3 phrases"
}
Si un élément n'est pas clairement identifiable dans le texte, renvoie une chaîne vide "".
AUCUN texte hors JSON.
`.trim();

  try {
    const res: any = await model.generateContent(`${sys}\n\nDOCUMENT :\n${text}`);
    const raw = res?.response?.text?.() ?? "";
    const json = JSON.parse(raw || "{}");
    return {
      problematique: String(json.problematique || ""),
      acteurs: String(json.acteurs || ""),
      zone: String(json.zone || ""),
      enjeux: String(json.enjeux || ""),
    };
  } catch (e) {
    console.error("extractContextFromDocument failed:", e);
    return { problematique: "", acteurs: "", zone: "", enjeux: "" };
  }
}

/** getAIAnalysis — JSON { insights[], recommendations[] } */
export async function getAIAnalysis(
  postIts: PostIt[],
  context?: BoardContext,
  matrixInteractions?: MatrixInteraction[]
): Promise<{ insights: Insight[]; recommendations: Recommendation[] }> {
  const model = await getModel();
  if (!model) return localAnalysisFallback(postIts);

  const sys = `
Tu es un analyste stratégique AFOM expert. Tu dois produire une analyse SPÉCIFIQUE et ANCRÉE dans les données réelles fournies.

CADRE D'ANALYSE DES INTERACTIONS MATRICE :
- O×A = LEVIER : opportunité activable grâce à une force → action à prioriser
- O×F = FREIN : opportunité bloquée par une faiblesse → lever le blocage en priorité
- M×A = RÉSISTANCE : menace atténuée par une force → capitaliser sur cette protection
- M×F = BLOCAGE/VULNÉRABILITÉ : menace amplifiant une faiblesse → risque critique

DÉTECTE et commente :
- Contradictions : un même item apparaît en levier ET en frein/blocage
- Blocages structurels : plusieurs M×F sans O×A compensateurs
- Leviers prioritaires : O×A à fort enjeu contextuel

RÈGLES ABSOLUES (violation = résultat invalide) :
1. Chaque insight et recommandation DOIT citer NOMINATIVEMENT au moins un post-it réel entre guillemets
2. Chaque recommandation DOIT référencer une interaction matrice concrète si disponible
3. INTERDICTION FORMELLE de ces formulations génériques : "capitaliser sur les acquis", "réduire les menaces", "améliorer la stratégie", "renforcer les capacités", "mobiliser les forces", "développer des partenariats"
4. Maximum 5 insights — chacun doit être IMPOSSIBLE à copier-coller dans une autre session
5. Les recommandations doivent être actionnables : qui fait quoi, sur quelle base concrète

RETOURNE STRICTEMENT du JSON :
{
  "insights": [{"title": "...", "content": "..."}],
  "recommendations": [{"title": "...", "content": "...", "priority": "URGENT|HIGH|MEDIUM|LOW"}]
}
Aucun texte hors JSON.
`.trim();

  const ctxBlock = buildContextBlock(context);
  const matrixBlock = buildMatrixBlock(matrixInteractions);
  const data = postIts.map((p) => ({ quadrant: p.quadrant, text: p.content }));
  const prompt = `${sys}${ctxBlock}${matrixBlock}\n\nPOST-ITS AFOM :\n${JSON.stringify(data, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const insights: Insight[] = Array.isArray(json.insights) ? json.insights : [];
    const recommendations: Recommendation[] = Array.isArray(json.recommendations) ? json.recommendations : [];
    return { insights, recommendations };
  } catch (e) {
    console.error("Gemini getAIAnalysis failed:", e);
    return localAnalysisFallback(postIts);
  }
}

/** proposeCentralProblem — JSON { problem, problemCourt, rationale } ; options.mode : 'full' | 'fm' */
export async function proposeCentralProblem(
  postIts: PostIt[],
  options: { mode?: "full" | "fm"; context?: BoardContext; matrixInteractions?: MatrixInteraction[] } = {}
): Promise<{ problem: string; problemCourt?: string; rationale?: string }> {
  const { mode = "full", context, matrixInteractions } = options;
  const model = await getModel();
  if (!model) {
    const fb = localCentralFallback(mode);
    return { problem: fb.problem, rationale: fb.rationale };
  }

  const filtered = mode === "fm"
    ? postIts.filter((p) => p.quadrant === "faiblesses" || p.quadrant === "menaces")
    : postIts;

  const sys = `
Tu es un analyste stratégique. À partir des données AFOM, formule le problème central de la situation.

RÈGLES DU PROBLÈME CENTRAL :
1. ÉTAT NÉGATIF : formule ce qui ne fonctionne pas ou ce qui bloque (pas un objectif, pas une solution)
2. SPÉCIFIQUE : cite des éléments réels des post-its — la formulation doit être impossible à réutiliser ailleurs
3. ANCRÉ dans les interactions matrice (blocages M×F prioritaires, freins O×F critiques)
4. INTERDIT : "manque de ressources", "problème de gouvernance", "absence de coordination" seuls (trop génériques)

DEUX FORMULATIONS OBLIGATOIRES :
- "long" : une phrase complète, ≤ 240 caractères, état négatif, cite du contenu réel
  Exemple : "La faible participation des bénéficiaires combinée aux retards de financement empêche l'atteinte des résultats du programme X"
- "court" : MAX 5 MOTS, titre pour un arbre à problème
  Exemple : "Participation faible et sous-financement"

Retourne STRICTEMENT du JSON :
{
  "long": "...",
  "court": "...",
  "rationale": "pourquoi ces données pointent vers ce problème"
}
Aucun texte hors JSON.
`.trim();

  const ctxBlock = buildContextBlock(context);
  const matrixBlock = buildMatrixBlock(matrixInteractions);
  const data = filtered.map((p) => ({ quadrant: p.quadrant, text: p.content }));
  const prompt = `${sys}${ctxBlock}${matrixBlock}\nMODE: ${mode}\nDONNÉES:\n${JSON.stringify(data, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    return {
      problem: String(json.long || json.problem || "").slice(0, 400),
      problemCourt: String(json.court || "").slice(0, 60) || undefined,
      rationale: typeof json.rationale === "string" ? json.rationale : undefined,
    };
  } catch (e) {
    console.error("Gemini proposeCentralProblem failed:", e);
    const fb = localCentralFallback(mode);
    return { problem: fb.problem, rationale: fb.rationale };
  }
}

/** proposeMatrixSelection — choisit N étiquettes par quadrant (par défaut 4) ; renvoie { selection } */
export async function proposeMatrixSelection(
  postIts: PostIt[],
  options: { perQuadrant?: number; context?: BoardContext } = {}
): Promise<{ selection: Record<QuadrantKey, string[]>; rationale?: string }> {
  const n = options.perQuadrant ?? 4;
  const { context } = options;

  // Si IA indisponible, heuristique locale
  const model = await getModel();
  if (!model) {
    const selection = pickTopPerQuadrant(postIts, n);
    return { selection, rationale: "Sélection heuristique locale (favoris, ordre, timestamp)." };
  }

  // Prompt IA — renvoyer uniquement des IDs
  const byQ: Record<QuadrantKey, Array<{ id: string; text: string }>> = {
    acquis: [], faiblesses: [], opportunites: [], menaces: []
  };
  for (const p of postIts) {
    if ((p as any).status === "bin") continue;
    byQ[p.quadrant].push({ id: p.id, text: p.content });
  }

  const sys = `
Tu aides à préparer une Matrice de confrontation AFOM.
Pour chaque quadrant, choisis jusqu'à ${n} étiquettes les PLUS représentatives (équilibre, diversité, impact).
Retourne STRICTEMENT du JSON:
{
  "selection": {
    "acquis": ["id1","id2","id3","id4"],
    "faiblesses": ["..."],
    "opportunites": ["..."],
    "menaces": ["..."]
  },
  "rationale": "..."
}
Uniquement des IDs dans "selection". Pas de texte libre hors JSON.
`.trim();

  const ctxBlock = buildContextBlock(context);
  const prompt = `${sys}${ctxBlock}\nDONNÉES:\n${JSON.stringify(byQ, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const selection = json.selection && typeof json.selection === "object"
      ? json.selection
      : pickTopPerQuadrant(postIts, n);
    return { selection, rationale: typeof json.rationale === "string" ? json.rationale : undefined };
  } catch (e) {
    console.error("Gemini proposeMatrixSelection failed:", e);
    const selection = pickTopPerQuadrant(postIts, n);
    return { selection, rationale: "Erreur IA, sélection heuristique locale." };
  }
}

/** proposeOrientations — à partir d'une matrice (paires O×A / O×F / M×A / M×F), génère 4–8 orientations synthétiques */
export async function proposeOrientations(
  input: any,
  context?: BoardContext
): Promise<{ orientations: string[]; rationale?: string }> {
  const model = await getModel();
  if (!model) {
    return {
      orientations: [
        "Activer les leviers O×A identifiés dans la matrice en priorité.",
        "Lever les freins O×F bloquant les opportunités à fort enjeu.",
        "Réduire les vulnérabilités M×F par des mesures correctives ciblées.",
        "Exploiter les résistances M×A comme protection face aux menaces prioritaires.",
      ],
      rationale: "Généré localement (fallback) — relancer avec l'IA pour des orientations spécifiques."
    };
  }

  const sys = `
Tu es un stratège. À partir des interactions réelles de la matrice AFOM (paires O×A, O×F, M×A, M×F),
propose 4 à 8 orientations stratégiques concrètes.

RÈGLES :
1. Chaque orientation DOIT citer les libellés réels des post-its impliqués
2. Précise le type d'interaction (levier, frein, résistance, blocage) qui justifie l'orientation
3. Formule en mode actionnable : "Faire X pour Y parce que Z"
4. INTERDIT : orientations génériques sans référence aux données réelles

Retourne STRICTEMENT du JSON :
{
  "orientations": ["...", "..."],
  "rationale": "..."
}
Aucun texte hors JSON.
`.trim();

  const ctxBlock = buildContextBlock(context);
  const prompt = `${sys}${ctxBlock}\nDONNÉES MATRICE:\n${JSON.stringify(input ?? {}, null, 2)}`;

  try {
    const res: any = await model.generateContent(prompt);
    const text = res?.response?.text?.() ?? "";
    const json = JSON.parse(text || "{}");
    const orientations: string[] = Array.isArray(json.orientations) ? json.orientations : [];
    return {
      orientations: orientations.length ? orientations : [
        "Prioriser 2 actions défensives pour réduire les menaces majeures.",
        "Accélérer 1 initiative offensive s’appuyant sur les acquis pour saisir une opportunité clé."
      ],
      rationale: typeof json.rationale === "string" ? json.rationale : undefined
    };
  } catch (e) {
    console.error("Gemini proposeOrientations failed:", e);
    return {
      orientations: [
        "Structurer un plan d'atténuation des risques critiques (M×F).",
        "Mobiliser les forces existantes pour capter une opportunité prioritaire (O×A).",
      ],
      rationale: "Erreur IA, orientations de repli."
    };
  }
}
