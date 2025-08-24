import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc as fsDoc,
  getDoc,
  getDocs,
  onSnapshot,
  query,
  setDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt, QuadrantKey } from "../types";

type Picked = Record<QuadrantKey, string[]>;
type CellMap = Record<string, boolean>; // key = `${rowKey}:::${colKey}`

function norm(s: string) {
  return (s || "").trim().toLowerCase().replace(/\s+/g, " ");
}
function pad2(n: number) {
  const s = String(Math.abs(n)).padStart(2, "0");
  return (n > 0 ? "+" : n < 0 ? "-" : "0") + s;
}

function top4ByFreq(items: string[]): string[] {
  const map = new Map<string, { raw: string; n: number }>();
  for (const t of items) {
    const k = norm(t);
    if (!k) continue;
    map.set(k, { raw: t, n: (map.get(k)?.n || 0) + 1 });
  }
  return [...map.values()]
    .sort((a, b) => b.n - a.n || a.raw.length - b.raw.length)
    .slice(0, 4)
    .map((v) => v.raw);
}

const COLORS = {
  head: "bg-slate-900 text-white",
  card: "bg-white/80 backdrop-blur-sm",
  border: "border-slate-200",
};

const Pill: React.FC<{ children: React.ReactNode; tone?: "pos" | "neg" | "mut" }> = ({
  children,
  tone = "mut",
}) => {
  const base = "text-xs font-bold px-2 py-1 rounded-full";
  const toneCls =
    tone === "pos"
      ? "bg-emerald-100 text-emerald-800"
      : tone === "neg"
      ? "bg-rose-100 text-rose-800"
      : "bg-slate-100 text-slate-600";
  return <span className={`${base} ${toneCls}`}>{children}</span>;
};

export default function MatrixMode({ sessionId, onBack }: { sessionId: string; onBack: () => void }) {
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  const [picked, setPicked] = useState<Picked>({
    acquis: [],
    faiblesses: [],
    opportunites: [],
    menaces: [],
  });
  const [cells, setCells] = useState<CellMap>({});
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 1) Live post-its
  useEffect(() => {
    const q = query(collection(db, "postits"), where("sessionId", "==", sessionId));
    const unsub = onSnapshot(q, (snap) => {
      const arr = snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
      setPostIts(arr);
    });
    return () => unsub();
  }, [sessionId]);

  // 2) Charger sauvegarde existante (sélection + cases X)
  useEffect(() => {
    (async () => {
      setLoading(true);
      const ref = fsDoc(db, "confrontations", sessionId);
      const snap = await getDoc(ref);
      if (snap.exists()) {
        const data = snap.data() as any;
        setPicked({
          acquis: data?.picked?.acquis || [],
          faiblesses: data?.picked?.faiblesses || [],
          opportunites: data?.picked?.opportunites || [],
          menaces: data?.picked?.menaces || [],
        });
        setCells(data?.cells || {});
      } else {
        // pré-remplissage auto
        const byQ: Record<QuadrantKey, string[]> = { acquis: [], faiblesses: [], opportunites: [], menaces: [] };
        for (const p of postIts) byQ[p.quadrant]?.push(p.content || "");
        setPicked({
          acquis: top4ByFreq(byQ.acquis),
          faiblesses: top4ByFreq(byQ.faiblesses),
          opportunites: top4ByFreq(byQ.opportunites),
          menaces: top4ByFreq(byQ.menaces),
        });
      }
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [sessionId, postIts.length]);

  // 3) Persistance
  async function save() {
    setSaving(true);
    try {
      const ref = fsDoc(db, "confrontations", sessionId);
      await setDoc(
        ref,
        {
          picked,
          cells,
          updatedAt: new Date(),
        },
        { merge: true }
      );
    } finally {
      setSaving(false);
    }
  }

  // helpers
  const cols = useMemo(
    () => [
      ...picked.acquis.map((t, i) => ({ key: `A${i + 1}`, title: t, group: "A" as const })),
      ...picked.faiblesses.map((t, i) => ({ key: `F${i + 1}`, title: t, group: "F" as const })),
    ],
    [picked]
  );

  const rows = useMemo(
    () => [
      ...picked.opportunites.map((t, i) => ({ key: `O${i + 1}`, title: t, group: "O" as const })),
      ...picked.menaces.map((t, i) => ({ key: `M${i + 1}`, title: t, group: "M" as const })),
    ],
    [picked]
  );

  function toggle(rk: string, ck: string) {
    const k = `${rk}:::${ck}`;
    setCells((m) => ({ ...m, [k]: !m[k] }));
  }

  // Totaux lignes/colonnes (règles simples et lisibles)
  const rowTotals = rows.map((r) => {
    let a = 0,
      f = 0;
    for (const c of cols) {
      if (cells[`${r.key}:::${c.key}`]) {
        if (c.group === "A") a++;
        else f++;
      }
    }
    if (r.group === "O") return a - f; // Opportunités: plus il y a de correspondances avec Acquis vs Faiblesses, mieux c'est
    // Menaces: toute correspondance pèse négatif
    return -(a + f);
  });

  const colTotals = cols.map((c) => {
    let o = 0,
      m = 0;
    for (const r of rows) {
      if (cells[`${r.key}:::${c.key}`]) {
        if (r.group === "O") o++;
        else m++;
      }
    }
    // Lecture simple et cohérente avec l'exemple :
    // - Colonne Acquis: + (#X en Opportunités)
    // - Colonne Faiblesses: - (#X en Menaces)
    return c.group === "A" ? o : -m;
  });

  if (loading) {
    return (
      <div className="p-8">
        <div className="animate-pulse h-6 w-48 bg-slate-200 rounded mb-6"></div>
        <div className="h-64 rounded-xl bg-slate-100"></div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-slate-100">
      {/* Header */}
      <div className={`sticky top-0 z-40 ${COLORS.head} border-b border-slate-800/40`}>
        <div className="max-w-7xl mx-auto px-4 py-3 flex items-center justify-between">
          <div className="font-black tracking-wide">Matrice de confrontation</div>
          <div className="flex gap-2">
            <button onClick={onBack} className="px-3 py-1.5 rounded-md bg-white text-slate-900 hover:bg-slate-100">
              ← Retour
            </button>
            <button
              onClick={save}
              disabled={saving}
              className="px-3 py-1.5 rounded-md bg-emerald-500 hover:bg-emerald-600 text-white"
            >
              {saving ? "Enregistrement…" : "Enregistrer"}
            </button>
          </div>
        </div>
      </div>

      {/* Sélections */}
      <div className="max-w-7xl mx-auto px-4 py-6 grid md:grid-cols-2 gap-6">
        {(
          [
            ["acquis", "Acquis", "bg-emerald-50 border-emerald-200"],
            ["faiblesses", "Faiblesses", "bg-rose-50 border-rose-200"],
            ["opportunites", "Opportunités", "bg-teal-50 border-teal-200"],
            ["menaces", "Menaces", "bg-orange-50 border-orange-200"],
          ] as [QuadrantKey, string, string][]
        ).map(([k, label, tone]) => (
          <div key={k} className={`${COLORS.card} border ${COLORS.border} rounded-xl p-4`}>
            <div className="flex items-center justify-between mb-3">
              <div className="font-bold">{label} (4 max)</div>
              <Pill tone="mut">éditable</Pill>
            </div>
            <div className="grid gap-2">
              {(picked[k] || []).map((t, i) => (
                <div key={i} className={`rounded-lg ${tone} p-2`}>
                  <input
                    value={t}
                    onChange={(e) =>
                      setPicked((p) => {
                        const arr = [...p[k]];
                        arr[i] = e.target.value;
                        return { ...p, [k]: arr };
                      })
                    }
                    className="w-full bg-transparent outline-none"
                  />
                </div>
              ))}
            </div>
            {(picked[k] || []).length < 4 && (
              <button
                onClick={() =>
                  setPicked((p) => ({ ...p, [k]: [...p[k], ""] }))
                }
                className="mt-3 text-sm px-2 py-1 rounded bg-white border hover:bg-slate-50"
              >
                + Ajouter
              </button>
            )}
          </div>
        ))}
      </div>

      {/* Grille */}
      <div className="max-w-7xl mx-auto px-4 pb-16">
        <div className="overflow-x-auto">
          <table className="w-full border-collapse rounded-xl overflow-hidden shadow">
            <thead>
              <tr className="bg-slate-800 text-white">
                <th className="text-left px-3 py-2 w-56"> </th>
                {cols.map((c) => (
                  <th key={c.key} className="px-3 py-2 text-left align-bottom">
                    <div className="text-xs opacity-70 mb-1">{c.group === "A" ? "Acquis" : "Faiblesses"}</div>
                    <div className="font-semibold leading-snug">{c.title || <span className="opacity-50">—</span>}</div>
                  </th>
                ))}
                <th className="px-3 py-2 text-right">Total</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((r, ri) => (
                <tr key={r.key} className="bg-white even:bg-slate-50">
                  <td className="px-3 py-2 align-top w-56">
                    <div className="text-xs opacity-60 mb-1">{r.group === "O" ? "Opportunité" : "Menace"}</div>
                    <div className="font-medium">{r.title || <span className="opacity-50">—</span>}</div>
                  </td>
                  {cols.map((c) => {
                    const k = `${r.key}:::${c.key}`;
                    const on = !!cells[k];
                    return (
                      <td key={c.key} className="px-2 py-2 text-center">
                        <button
                          onClick={() => toggle(r.key, c.key)}
                          className={`w-7 h-7 rounded-md border text-sm font-bold ${
                            on
                              ? c.group === "A"
                                ? "bg-emerald-500/90 border-emerald-600 text-white"
                                : "bg-rose-500/95 border-rose-600 text-white"
                              : "bg-white hover:bg-slate-50 border-slate-200 text-slate-500"
                          }`}
                          title="Basculer X"
                        >
                          {on ? "X" : "·"}
                        </button>
                      </td>
                    );
                  })}
                  <td className="px-3 py-2 text-right font-bold">
                    <Pill tone={rowTotals[ri] > 0 ? "pos" : rowTotals[ri] < 0 ? "neg" : "mut"}>
                      {pad2(rowTotals[ri])}
                    </Pill>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot>
              <tr className="bg-slate-100 border-t">
                <td className="px-3 py-2 text-right font-semibold">Total</td>
                {colTotals.map((v, i) => (
                  <td key={i} className="px-2 py-2 text-center">
                    <Pill tone={v > 0 ? "pos" : v < 0 ? "neg" : "mut"}>{pad2(v)}</Pill>
                  </td>
                ))}
                <td className="px-3 py-2"></td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="mt-4 text-sm text-slate-600">
          <div className="mb-1">Règles de signe utilisées :</div>
          <ul className="list-disc pl-5 space-y-1">
            <li>
              Lignes <b>Opportunités</b> : <code>+ (#X côté Acquis) – (#X côté Faiblesses)</code>.
            </li>
            <li>
              Lignes <b>Menaces</b> : <code>– (#X côté Acquis + #X côté Faiblesses)</code>.
            </li>
            <li>
              Bas de colonne : <b>Acquis</b> = <code>+ #X (Opportunités)</code> ; <b>Faiblesses</b> ={" "}
              <code>– #X (Menaces)</code>.
            </li>
          </ul>
        </div>
      </div>
    </div>
  );
}
