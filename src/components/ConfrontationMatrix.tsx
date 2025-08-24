import React, { useEffect, useMemo, useState } from "react";
import { collection, onSnapshot, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt } from "../types";

type Cell = boolean; // case cochée (X) ou non

interface Props {
  sessionId: string;
}

const STOPWORDS = new Set([
  "le","la","les","de","des","du","un","une","et","en","au","aux",
  "pour","par","dans","sur","avec","sans","à","d'", "l'", "que","qui",
  "ce","cet","cette","ces","on","nous","vous","ils","elles"
]);

function tokens(s: string): string[] {
  return s
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}

function similar(a: string, b: string): boolean {
  const A = new Set(tokens(a));
  const B = new Set(tokens(b));
  let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  // Heuristique douce : au moins 1 mot significatif en commun
  return inter >= 1;
}

function uniqKeepOrder(list: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const s of list) { const k = s.trim(); if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}

function pickTop4(items: string[]): string[] {
  // Priorise les libellés informatifs (longueur) puis l'ordre d’arrivée
  return [...items].sort((a, b) => b.length - a.length).slice(0, 4);
}

export default function ConfrontationMatrix({ sessionId }: Props) {
  const [postIts, setPostIts] = useState<PostIt[]>([]);

  useEffect(() => {
    const q = query(collection(db, "postits"), where("sessionId", "==", sessionId));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs.map(d => ({ id: d.id, ...(d.data() as any) })) as PostIt[];
      setPostIts(arr);
    });
    return () => unsub();
  }, [sessionId]);

  // Sélectionne 4 constats par quadrant
  const { Acols, Fcols, Orows, Mrows } = useMemo(() => {
    const A = uniqKeepOrder(postIts.filter(p => p.quadrant === "acquis").map(p => p.content));
    const F = uniqKeepOrder(postIts.filter(p => p.quadrant === "faiblesses").map(p => p.content));
    const O = uniqKeepOrder(postIts.filter(p => p.quadrant === "opportunites").map(p => p.content));
    const M = uniqKeepOrder(postIts.filter(p => p.quadrant === "menaces").map(p => p.content));
    return {
      Acols: pickTop4(A),
      Fcols: pickTop4(F),
      Orows: pickTop4(O),
      Mrows: pickTop4(M),
    };
  }, [postIts]);

  const colCount = Acols.length + Fcols.length;
  const rowCount = Orows.length + Mrows.length;

  // Grille des cases cochées
  const [cells, setCells] = useState<Cell[][]>([]);

  useEffect(() => {
    setCells(Array.from({ length: rowCount }, () => Array(colCount).fill(false)));
  }, [rowCount, colCount]);

  // Auto-préremplissage (heuristique sémantique légère)
  function autoFill() {
    const next = cells.map(row => [...row]);
    for (let r = 0; r < Orows.length; r++) {
      const label = Orows[r];
      for (let c = 0; c < Acols.length; c++) next[r][c] = similar(label, Acols[c]);
      for (let c = 0; c < Fcols.length; c++) next[r][Acols.length + c] = similar(label, Fcols[c]);
    }
    for (let r2 = 0; r2 < Mrows.length; r2++) {
      const idx = Orows.length + r2;
      const label = Mrows[r2];
      for (let c = 0; c < Acols.length; c++) next[idx][c] = similar(label, Acols[c]);
      for (let c = 0; c < Fcols.length; c++) next[idx][Acols.length + c] = similar(label, Fcols[c]);
    }
    setCells(next);
  }

  function toggle(r: number, c: number) {
    setCells(prev => {
      const n = prev.map(row => [...row]);
      n[r][c] = !n[r][c];
      return n;
    });
  }

  // Scores
  const rowTotals = useMemo(() => {
    return cells.map((row, r) => {
      const isOpportunity = r < Orows.length;
      let score = 0;
      for (let c = 0; c < row.length; c++) if (row[c]) {
        const isA = c < Acols.length;
        // Ligne = (#A) - (#F)
        score += isA ? +1 : -1;
      }
      return score;
    });
  }, [cells, Acols.length, Orows.length]);

  const colTotals = useMemo(() => {
    const totals = Array(colCount).fill(0);
    for (let r = 0; r < cells.length; r++) {
      const isOpp = r < Orows.length;
      for (let c = 0; c < colCount; c++) if (cells[r][c]) {
        const isA = c < Acols.length;
        // Col A: +1 (Opp) / -1 (Men) ; Col F: +1 (Men) / -1 (Opp)
        totals[c] += isA ? (isOpp ? +1 : -1) : (isOpp ? -1 : +1);
      }
    }
    return totals;
  }, [cells, colCount, Acols.length, Orows.length]);

  // Helpers d’affichage
  function fmt(n: number) {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "0";
    const val = Math.abs(n).toString().padStart(2, "0");
    return `${sign} ${val}`.replace("−", "-");
  }

  if (!sessionId) {
    return <div className="p-6">Session introuvable.</div>;
  }

  return (
    <div className="p-6">
      <div className="mb-4 flex items-center justify-between">
        <h1 className="text-2xl font-extrabold">Matrice de confrontation</h1>
        <div className="flex gap-2">
          <button onClick={autoFill}
                  className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700">
            Auto-préremplir
          </button>
          <button onClick={() => setCells(Array.from({ length: rowCount }, () => Array(colCount).fill(false)))}
                  className="px-3 py-2 rounded-md border hover:bg-gray-50">
            Tout effacer
          </button>
        </div>
      </div>

      <div className="overflow-auto rounded-xl border bg-white shadow">
        {/* En-têtes */}
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            <tr>
              <th className="w-60"></th>
              <th colSpan={Acols.length} className="bg-green-100 border p-2 text-left font-black">Acquis</th>
              <th colSpan={Fcols.length} className="bg-red-100 border p-2 text-left font-black">Faiblesses</th>
              <th className="bg-gray-50 border p-2 text-left font-black">Total</th>
            </tr>
            <tr>
              <th className="bg-yellow-50 border p-2 text-left font-bold">Opportunités</th>
              {Acols.map((t, i) => <th key={"A"+i} className="bg-green-50 border p-2 text-sm">{t}</th>)}
              {Fcols.map((t, i) => <th key={"F"+i} className="bg-red-50 border p-2 text-sm">{t}</th>)}
              <th className="bg-gray-50 border"></th>
            </tr>
          </thead>

          <tbody>
            {/* Lignes Opportunités */}
            {Orows.map((label, r) => (
              <tr key={"O"+r}>
                <td className="border p-2 align-top text-sm">{label}</td>
                {[...Array(colCount)].map((_, c) => (
                  <td key={c} className="border p-0 text-center">
                    <button
                      onClick={() => toggle(r, c)}
                      className={"w-full h-8 md:h-10 " + (cells[r]?.[c] ? "bg-black text-white font-bold" : "bg-white hover:bg-gray-50")}
                      title="Basculer X"
                    >
                      {cells[r]?.[c] ? "X" : ""}
                    </button>
                  </td>
                ))}
                <td className="border p-2 text-center font-bold">{fmt(rowTotals[r])}</td>
              </tr>
            ))}

            {/* Séparateur Menaces */}
            <tr>
              <th className="bg-yellow-50 border p-2 text-left font-bold">Menaces</th>
              {[...Array(colCount + 1)].map((_, i) => <td key={i} className="border p-2 bg-yellow-50"></td>)}
            </tr>

            {/* Lignes Menaces */}
            {Mrows.map((label, r2) => {
              const r = Orows.length + r2;
              return (
                <tr key={"M"+r2}>
                  <td className="border p-2 align-top text-sm">{label}</td>
                  {[...Array(colCount)].map((_, c) => (
                    <td key={c} className="border p-0 text-center">
                      <button
                        onClick={() => toggle(r, c)}
                        className={"w-full h-8 md:h-10 " + (cells[r]?.[c] ? "bg-black text-white font-bold" : "bg-white hover:bg-gray-50")}
                        title="Basculer X"
                      >
                        {cells[r]?.[c] ? "X" : ""}
                      </button>
                    </td>
                  ))}
                  <td className="border p-2 text-center font-bold">{fmt(rowTotals[r])}</td>
                </tr>
              );
            })}
          </tbody>

          {/* Totaux de colonnes */}
          <tfoot>
            <tr>
              <th className="bg-gray-100 border p-2 text-left">Total</th>
              {colTotals.map((t, i) => (
                <th key={i} className="bg-gray-100 border p-2 text-center font-black">{fmt(t)}</th>
              ))}
              <th className="bg-gray-100 border"></th>
            </tr>
          </tfoot>
        </table>
      </div>

      <p className="text-xs text-gray-500 mt-3">
        Règle de calcul reproduite d’après ton exemple de matrice (+/− par croisement A/F avec O/M). :contentReference[oaicite:1]{index=1}
      </p>
    </div>
  );
}
