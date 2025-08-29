// src/components/MatrixMode.tsx
import React, { useEffect, useMemo, useState } from "react";
import {
  collection,
  doc as fsDoc,
  onSnapshot,
  query,
  serverTimestamp,
  setDoc,
  updateDoc,
  where,
} from "firebase/firestore";
import { db } from "../services/firebase";
import { PostIt, QuadrantKey } from "../types";
import { proposeMatrixSelection, proposeOrientations } from "../services/geminiService";

type Cell = boolean;

type Selection = {
  acquis: string[];
  faiblesses: string[];
  opportunites: string[];
  menaces: string[];
};

type SelectionSource = "auto" | "ia" | "manual";

type MatrixDoc = {
  sessionId: string;
  selection: Selection;
  selectionSource?: SelectionSource;
  marks: string[]; // "r,c"
  orientations?: string[];
  orientationsSource?: SelectionSource;
  updatedAt?: any;
};

interface Props { sessionId: string; }

/* ---------------------- Utils texte ----------------------- */
const STOPWORDS = new Set([
  "le","la","les","de","des","du","un","une","et","en","au","aux","pour","par","dans",
  "sur","avec","sans","à","d'","l'","que","qui","ce","cet","cette","ces","on","nous",
  "vous","ils","elles","se","son","sa","ses"
]);
function tokens(s: string): string[] {
  return (s || "")
    .toLowerCase()
    .normalize("NFD").replace(/\p{Diacritic}/gu, "")
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter(t => t && !STOPWORDS.has(t));
}
function similar(a: string, b: string): boolean {
  const A = new Set(tokens(a)); const B = new Set(tokens(b)); let inter = 0;
  A.forEach(t => { if (B.has(t)) inter++; });
  return inter >= 1;
}
function uniqKeepOrder(list: string[]): string[] {
  const seen = new Set<string>(); const out: string[] = [];
  for (const s of list) {
    const k = (s || "").trim();
    if (!k) continue;
    if (!seen.has(k)) { seen.add(k); out.push(k); }
  }
  return out;
}
function pickFirst4(items: string[]): string[] { return items.slice(0, 4); }

const enc = (r: number, c: number) => `${r},${c}`;
const dec = (s: string): [number, number] => {
  const [r, c] = s.split(",").map(Number);
  return [r || 0, c || 0];
};

/* --------------------------- Composant ------------------------------ */

export default function MatrixMode({ sessionId }: Props) {
  // 1) Post-its
  const [postIts, setPostIts] = useState<PostIt[]>([]);
  useEffect(() => {
    const q = query(collection(db, "postits"), where("sessionId", "==", sessionId));
    const unsub = onSnapshot(q, snap => {
      const arr = snap.docs
        .map(d => ({ id: d.id, ...(d.data() as any) }) as PostIt)
        .filter(p => (p as any).status !== "bin")
        .sort((a, b) => (a.sortIndex ?? 0) - (b.sortIndex ?? 0));
      setPostIts(arr);
    });
    return () => unsub();
  }, [sessionId]);

  // 2) Listes par quadrant (libellés)
  const allLists = useMemo(() => {
    const A = uniqKeepOrder(postIts.filter(p => p.quadrant === "acquis").map(p => p.content || "").filter(Boolean));
    const F = uniqKeepOrder(postIts.filter(p => p.quadrant === "faiblesses").map(p => p.content || "").filter(Boolean));
    const O = uniqKeepOrder(postIts.filter(p => p.quadrant === "opportunites").map(p => p.content || "").filter(Boolean));
    const M = uniqKeepOrder(postIts.filter(p => p.quadrant === "menaces").map(p => p.content || "").filter(Boolean));
    return { A, F, O, M };
  }, [postIts]);

  // 3) Sélection 4×4 (stockée en libellés)
  const [Acols, setAcols] = useState<string[]>([]);
  const [Fcols, setFcols] = useState<string[]>([]);
  const [Orows, setOrows] = useState<string[]>([]);
  const [Mrows, setMrows] = useState<string[]>([]);
  const [selectionSource, setSelectionSource] = useState<SelectionSource>("auto");

  const colCount = Acols.length + Fcols.length;
  const rowCount = Orows.length + Mrows.length;

  // 4) Cells/marks
  const [cells, setCells] = useState<Cell[][]>([]);
  const [marks, setMarks] = useState<Set<string>>(new Set());

  // 5) Orientations
  const [orientations, setOrientations] = useState<string[]>([]);
  const [orientationsSource, setOrientationsSource] = useState<SelectionSource>("auto");

  // 6) Firestore
  const docRef = React.useMemo(() => fsDoc(db, "confrontations", sessionId), [sessionId]);
  const [loadingDoc, setLoadingDoc] = useState(true);
  const [saving, setSaving] = useState<"idle"|"saving"|"saved">("idle");
  const [lastSavedAt, setLastSavedAt] = useState<number | null>(null);
  const [iaLoading, setIaLoading] = useState(false);
  const [iaOrientLoading, setIaOrientLoading] = useState(false);

  useEffect(() => {
    setLoadingDoc(true);
    const unsub = onSnapshot(docRef, async snap => {
      if (snap.exists()) {
        const data = snap.data() as MatrixDoc;
        const sel = data.selection;
        setAcols(sel?.acquis ?? []);
        setFcols(sel?.faiblesses ?? []);
        setOrows(sel?.opportunites ?? []);
        setMrows(sel?.menaces ?? []);
        setMarks(new Set(data.marks || []));
        setSelectionSource(data.selectionSource ?? "auto");
        setOrientations(Array.isArray(data.orientations) ? data.orientations : []);
        setOrientationsSource(data.orientationsSource ?? "auto");
        setLoadingDoc(false);
      } else {
        const initialSel: Selection = {
          acquis: pickFirst4(allLists.A),
          faiblesses: pickFirst4(allLists.F),
          opportunites: pickFirst4(allLists.O),
          menaces: pickFirst4(allLists.M),
        };
        await setDoc(docRef, {
          sessionId,
          selection: initialSel,
          selectionSource: "auto",
          marks: [],
          orientations: [],
          orientationsSource: "auto",
          updatedAt: serverTimestamp(),
        } as MatrixDoc);
      }
    });
    return () => unsub();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [docRef, sessionId, allLists.A.length, allLists.F.length, allLists.O.length, allLists.M.length]);

  // 7) Cells depuis marks
  useEffect(() => {
    const next = Array.from({ length: rowCount }, () => Array(colCount).fill(false) as boolean[]);
    for (const m of marks) {
      const [r, c] = dec(m);
      if (r >= 0 && r < rowCount && c >= 0 && c < colCount) next[r][c] = true;
    }
    setCells(next);
  }, [rowCount, colCount, marks]);

  // 8) Save
  const currentSelection = useMemo<Selection>(() => ({
    acquis: Acols, faiblesses: Fcols, opportunites: Orows, menaces: Mrows
  }), [Acols, Fcols, Orows, Mrows]);

  const saveMatrix = async (nextSel: Selection, nextCells: boolean[][], src: SelectionSource = selectionSource) => {
    try {
      setSaving("saving");
      const nextMarks: string[] = [];
      for (let r = 0; r < nextCells.length; r++) {
        for (let c = 0; c < (nextCells[r]?.length ?? 0); c++) {
          if (nextCells[r][c]) nextMarks.push(enc(r, c));
        }
      }
      await updateDoc(docRef, {
        selection: nextSel,
        selectionSource: src,
        marks: nextMarks,
        updatedAt: serverTimestamp(),
      });
      setMarks(new Set(nextMarks));
      setSelectionSource(src);
      setSaving("saved");
      setLastSavedAt(Date.now());
      setTimeout(() => setSaving("idle"), 700);
    } catch (e) {
      console.error(e);
      alert("Impossible d’enregistrer la matrice.");
      setSaving("idle");
    }
  };

  const saveOrientations = async (items: string[], src: SelectionSource) => {
    try {
      setSaving("saving");
      await updateDoc(docRef, {
        orientations: items,
        orientationsSource: src,
        updatedAt: serverTimestamp(),
      });
      setOrientations(items);
      setOrientationsSource(src);
      setSaving("saved");
      setLastSavedAt(Date.now());
      setTimeout(() => setSaving("idle"), 700);
    } catch (e) {
      console.error(e);
      alert("Impossible d’enregistrer les orientations.");
      setSaving("idle");
    }
  };

  // 9) Actions matrice
  function toggle(r: number, c: number) {
    setCells(prev => {
      const n = prev.map(row => [...row]);
      n[r][c] = !n[r][c];
      saveMatrix(currentSelection, n, selectionSource);
      return n;
    });
  }
  function autoFill() {
    const next = cells.map(row => [...row]);
    for (let r = 0; r < Orows.length; r++) {
      const label = Orows[r];
      for (let c = 0; c < Acols.length; c++) next[r][c] = similar(label, Acols[c]);
      for (let c = 0; c < Fcols.length; c++) next[r][Acols.length + c] = similar(label, Fcols[c]);
    }
    for (let r2 = 0; r2 < Mrows.length; r2++) {
      const r = Orows.length + r2;
      const label = Mrows[r2];
      for (let c = 0; c < Acols.length; c++) next[r][c] = similar(label, Acols[c]);
      for (let c = 0; c < Fcols.length; c++) next[r][Acols.length + c] = similar(label, Fcols[c]);
    }
    setCells(next);
    saveMatrix(currentSelection, next, selectionSource);
  }
  function clearAll() {
    const empty = Array.from({ length: rowCount }, () => Array(colCount).fill(false));
    setCells(empty);
    saveMatrix(currentSelection, empty, selectionSource);
  }

  /** IA sélection (on garde la logique, on n'affecte que l'UI) */
  async function proposeIASelection() {
    if (iaLoading) return;
    setIaLoading(true);
    try {
      const iaSel = await proposeMatrixSelection(postIts, { perQuadrant: 4 });
      const byId: Record<string, string> = {};
      for (const p of postIts) byId[p.id] = p.content || "";

      const mapIdsToLabels = (ids: string[] | undefined, fallback: string[]) => {
        const labels = (ids || []).map((id) => byId[id]).filter(Boolean);
        return (labels.length ? labels : fallback).slice(0, 4);
        };
      const nextSel: Selection = {
        acquis: mapIdsToLabels(iaSel.selection?.acquis, pickFirst4(allLists.A)),
        faiblesses: mapIdsToLabels(iaSel.selection?.faiblesses, pickFirst4(allLists.F)),
        opportunites: mapIdsToLabels(iaSel.selection?.opportunites, pickFirst4(allLists.O)),
        menaces: mapIdsToLabels(iaSel.selection?.menaces, pickFirst4(allLists.M)),
      };

      const prevRows = [...Orows, ...Mrows];
      const prevCols = [...Acols, ...Fcols];
      const newRows = [...nextSel.opportunites, ...nextSel.menaces];
      const newCols = [...nextSel.acquis, ...nextSel.faiblesses];
      const newCells: boolean[][] = Array.from({ length: newRows.length }, () => Array(newCols.length).fill(false));
      for (let r = 0; r < prevRows.length; r++) {
        for (let c = 0; c < prevCols.length; c++) {
          if (!cells[r]?.[c]) continue;
          const rr = newRows.indexOf(prevRows[r]);
          const cc = newCols.indexOf(prevCols[c]);
          if (rr >= 0 && cc >= 0) newCells[rr][cc] = true;
        }
      }

      setAcols(nextSel.acquis);
      setFcols(nextSel.faiblesses);
      setOrows(nextSel.opportunites);
      setMrows(nextSel.menaces);
      setCells(newCells);
      await saveMatrix(nextSel, newCells, "ia");
    } catch (e) {
      console.error(e);
      alert("Proposition IA indisponible.");
    } finally {
      setIaLoading(false);
    }
  }

  // 10) Totaux
  const rowMarkCounts = useMemo(() => cells.map(row => row.reduce((a,b) => a + (b ? 1 : 0), 0)), [cells]);
  const colMarkCounts = useMemo(() => {
    const totals = Array(colCount).fill(0);
    for (let r = 0; r < cells.length; r++) {
      for (let c = 0; c < colCount; c++) totals[c] += cells[r][c] ? 1 : 0;
    }
    return totals;
  }, [cells, colCount]);

  const rowTotals = useMemo(() => {
    return cells.map((row) => {
      let score = 0;
      for (let c = 0; c < row.length; c++) if (row[c]) {
        const isA = c < Acols.length;
        score += isA ? +1 : -1;
      }
      return score;
    });
  }, [cells, Acols.length]);

  const colTotals = useMemo(() => {
    const totals = Array(colCount).fill(0);
    for (let r = 0; r < cells.length; r++) {
      const isOpp = r < Orows.length;
      for (let c = 0; c < colCount; c++) if (cells[r][c]) {
        const isA = c < Acols.length;
        totals[c] += isA ? (isOpp ? +1 : -1) : (isOpp ? -1 : +1);
      }
    }
    return totals;
  }, [cells, colCount, Acols.length, Orows.length]);

  const fmt = (n: number) => {
    const sign = n > 0 ? "+" : n < 0 ? "−" : "0";
    const val = Math.abs(n).toString().padStart(2, "0");
    return `${sign} ${val}`.replace("−", "-");
  };

  // 11) Résumé
  const summary = useMemo(() => {
    const rowsAll = [...Orows, ...Mrows];
    const colsAll = [...Acols, ...Fcols];

    const opps = rowsAll
      .map((label, r) => ({ label, score: rowTotals[r], kind: r < Orows.length ? "O" : "M" }))
      .filter(x => x.kind === "O")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const threats = rowsAll
      .map((label, r) => ({ label, score: rowTotals[r], kind: r < Orows.length ? "O" : "M" }))
      .filter(x => x.kind === "M")
      .sort((a, b) => a.score - b.score)
      .slice(0, 3);

    const leverCols = colsAll
      .map((label, c) => ({ label, score: colTotals[c], kind: c < Acols.length ? "A" : "F" }))
      .filter(x => x.kind === "A")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    const weakCols = colsAll
      .map((label, c) => ({ label, score: colTotals[c], kind: c < Acols.length ? "A" : "F" }))
      .filter(x => x.kind === "F")
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);

    return { opps, threats, leverCols, weakCols };
  }, [Acols, Fcols, Orows, Mrows, rowTotals, colTotals]);

  // 12) Orientations auto
  function generateAutoOrientations() {
    const items: { text: string; score: number }[] = [];
    const add = (text: string, score: number) => {
      const key = text.trim();
      const found = items.findIndex(x => x.text === key);
      if (found >= 0) items[found].score = Math.max(items[found].score, score);
      else items.push({ text: key, score });
    };

    const rows = [...Orows, ...Mrows];
    const cols = [...Acols, ...Fcols];
    for (let r = 0; r < rows.length; r++) {
      const isOpp = r < Orows.length;
      for (let c = 0; c < cols.length; c++) {
        if (!cells[r]?.[c]) continue;
        const isA = c < Acols.length;
        const row = rows[r], col = cols[c];
        const weight = rowMarkCounts[r] + colMarkCounts[c];

        if (isOpp && isA) add(`Capitaliser «${col}» pour saisir «${row}».`, 10 + weight);
        if (isOpp && !isA) add(`Corriger «${col}» pour exploiter «${row}».`, 8 + weight);
        if (!isOpp && isA) add(`Mobiliser «${col}» pour contrer «${row}».`, 8 + weight);
        if (!isOpp && !isA) add(`Réduire «${col}» pour se prémunir de «${row}».`, 9 + weight);
      }
    }

    if (items.length === 0) {
      const bestO = Orows.map((t, i) => ({ t, s: rowTotals[i] })).sort((a,b)=>b.s-a.s)[0];
      const bestM = Mrows.map((t, i) => ({ t, s: rowTotals[Orows.length+i] })).sort((a,b)=>a.s-b.s)[0];
      const bestA = Acols.map((t, i) => ({ t, s: colTotals[i] })).sort((a,b)=>b.s-a.s)[0];
      const bestF = Fcols.map((t, i) => ({ t, s: colTotals[Acols.length+i] })).sort((a,b)=>b.s-a.s)[0];
      if (bestA && bestO) items.push({ text: `Capitaliser «${bestA.t}» pour saisir «${bestO.t}».`, score: 5 });
      if (bestF && bestO) items.push({ text: `Corriger «${bestF.t}» pour exploiter «${bestO.t}».`, score: 4 });
      if (bestA && bestM) items.push({ text: `Mobiliser «${bestA.t}» pour contrer «${bestM.t}».`, score: 4 });
      if (bestF && bestM) items.push({ text: `Réduire «${bestF.t}» pour se prémunir de «${bestM.t}».`, score: 5 });
    }

    items.sort((a, b) => b.score - a.score);
    const out = items.map(x => x.text).slice(0, 10);
    setOrientations(out);
    saveOrientations(out, "auto");
  }

  async function proposeIAOrientations() {
    if (iaOrientLoading) return;
    setIaOrientLoading(true);
    try {
      const resp = await proposeOrientations({
        acquis: Acols, faiblesses: Fcols, opportunites: Orows, menaces: Mrows,
        marks: Array.from(marks),
      });
      const list: string[] = Array.isArray(resp.orientations) ? resp.orientations : [];
      if (list.length === 0) {
        generateAutoOrientations();
      } else {
        setOrientations(list);
        await saveOrientations(list, "ia");
      }
    } catch (e) {
      console.error(e);
      alert("Proposition d’orientations IA indisponible.");
    } finally {
      setIaOrientLoading(false);
    }
  }

  // 13) Export
  const exportCSV = () => {
    const rowsLabels = [...Orows, ...Mrows];
    const colsLabels = [...Acols, ...Fcols];

    const header = ["", ...colsLabels, "Total"];
    const lines: string[][] = [header];

    for (let r = 0; r < Orows.length; r++) {
      const line = [rowsLabels[r]];
      for (let c = 0; c < colsLabels.length; c++) line.push(cells[r]?.[c] ? "1" : "0");
      line.push(String(rowTotals[r]));
      lines.push(line);
    }
    for (let r2 = 0; r2 < Mrows.length; r2++) {
      const r = Orows.length + r2;
      const line = [rowsLabels[r]];
      for (let c = 0; c < colsLabels.length; c++) line.push(cells[r]?.[c] ? "1" : "0");
      line.push(String(rowTotals[r]));
      lines.push(line);
    }
    const footer = ["Total", ...colTotals.map(String), ""];
    lines.push(footer);

    lines.push([]);
    lines.push(["Orientations stratégiques"]);
    orientations.forEach((o, i) => lines.push([String(i + 1), o]));

    const csv = lines
      .map(line => line.map(v => `"${(v || "").replace(/"/g, '""')}"`).join(","))
      .join("\n");

    const blob = new Blob([csv], { type: "text/csv;charset=utf-8;" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `matrice_${sessionId}.csv`;
    a.click();
    URL.revokeObjectURL(url);
  };
  const printPDF = () => { window.print(); };

  // 14) Nav
  const gotoWork = () => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=work&session=${encodeURIComponent(sessionId)}`;
  };

  // 15) UI
  return (
    <div className="p-6">
      <style>{`
        @media print {
          @page { size: A4 landscape; margin: 10mm; }
          body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
          .no-print { display: none !important; }
          .print-card { box-shadow: none !important; border-color: #ddd !important; }
          table { font-size: 11px; }
          th, td { padding: 6px !important; }
        }
      `}</style>

      <div className="mb-4 flex items-center justify-between gap-4">
        <div className="flex items-start gap-3">
          <button onClick={gotoWork} className="no-print px-3 py-2 rounded-md border bg-white hover:bg-gray-50">← Retour</button>
          <div>
            <h1 className="text-2xl font-extrabold">Matrice de confrontation</h1>
            <div className="text-sm text-gray-500">
              Session <span className="font-mono">{sessionId}</span>
              {!loadingDoc ? null : <span className="ml-2 text-gray-400">(chargement…)</span>}
            </div>
            <div className="text-xs text-gray-500 mt-0.5">
              {saving === "saving" && "Enregistrement…"}
              {saving === "saved" && "Enregistré."}
              {lastSavedAt ? <span className="ml-2 text-gray-400">({new Date(lastSavedAt).toLocaleTimeString()})</span> : null}
              <span className="ml-3 text-gray-400">Source sélection : {selectionSource.toUpperCase()}</span>
              <span className="ml-3 text-gray-400">Source orientations : {orientationsSource.toUpperCase()}</span>
            </div>
          </div>
        </div>

        <div className="no-print flex flex-wrap gap-2">
          <button onClick={proposeIASelection} className="px-3 py-2 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" disabled={loadingDoc || iaLoading}>
            {iaLoading ? "IA…" : "Proposer une sélection IA"}
          </button>
          <button onClick={autoFill} className="px-3 py-2 rounded-md bg-emerald-600 text-white hover:bg-emerald-700" disabled={loadingDoc}>
            Auto-préremplir
          </button>
          <button onClick={clearAll} className="px-3 py-2 rounded-md border hover:bg-gray-50" disabled={loadingDoc}>
            Tout effacer
          </button>
          <button onClick={exportCSV} className="px-3 py-2 rounded-md border hover:bg-gray-50">
            Export CSV
          </button>
          <button onClick={printPDF} className="px-3 py-2 rounded-md border hover:bg-gray-50" title="PDF via imprimer">
            Export PDF
          </button>
        </div>
      </div>

      {/* Légende axe du temps, style slide 2 : rétro (A/F) à gauche, prospectif (O/M) à droite */}
      <div className="mb-3 grid grid-cols-2 gap-3">
        <div className="rounded-lg border bg-green-50 border-green-200 px-3 py-2">
          <div className="text-xs font-bold text-green-800">Vision rétrospective (Passé)</div>
          <div className="text-[11px] text-green-700">Acquis & Faiblesses</div>
        </div>
        <div className="rounded-lg border bg-amber-50 border-amber-200 px-3 py-2 text-right">
          <div className="text-xs font-bold text-amber-800">Vision prospective (Futur)</div>
          <div className="text-[11px] text-amber-700">Opportunités & Menaces</div>
        </div>
      </div>

      {/* Tableau */}
      <div className="overflow-auto rounded-xl border bg-white shadow print-card">
        <table className="min-w-[980px] w-full border-collapse">
          <thead>
            {/* Bandeau rétrospective au-dessus des colonnes A+F */}
            <tr>
              <th className="w-60 bg-white border"></th>
              <th colSpan={Acols.length + Fcols.length} className="bg-gradient-to-r from-green-100 via-green-50 to-red-100 border p-2 text-center font-black text-gray-700">
                Vision rétrospective (Passé) — Acquis & Faiblesses
              </th>
              <th className="bg-white border p-2 text-left font-black">Total</th>
            </tr>

            {/* Rangée d'en-tête classique : A | F */}
            <tr>
              <th className="bg-yellow-50 border p-2 text-left font-bold">Opportunités</th>
              {Acols.map((t, i) => <th key={"A"+i} className="bg-green-50 border p-2 text-sm">{t}</th>)}
              {Fcols.map((t, i) => <th key={"F"+i} className="bg-red-50 border p-2 text-sm">{t}</th>)}
              <th className="bg-yellow-50 border"></th>
            </tr>
          </thead>

          <tbody>
            {/* Bandeau prospectif au-dessus des lignes O+M */}
            <tr>
              <td colSpan={colCount + 2} className="bg-gradient-to-r from-amber-50 via-amber-50 to-amber-100 border-t p-2 text-right font-bold text-amber-800">
                Vision prospective (Futur) — Opportunités & Menaces
              </td>
            </tr>

            {Orows.map((label, r) => (
              <tr key={"O"+r}>
                <td className="border p-2 align-top text-sm">{label}</td>
                {[...Array(colCount)].map((_, c) => (
                  <td key={c} className="border p-0 text-center">
                    <button
                      onClick={() => toggle(r, c)}
                      className={"w-full h-8 md:h-10 " + (cells[r]?.[c] ? "bg-black text-white font-bold" : "bg-white hover:bg-gray-50")}
                      title={cells[r]?.[c] ? "Retirer la marque" : "Ajouter une marque"}
                    >
                      {cells[r]?.[c] ? "X" : ""}
                    </button>
                  </td>
                ))}
                <td className="border p-2 text-center font-bold">{fmt(rowTotals[r])}</td>
              </tr>
            ))}
            <tr>
              <th className="bg-yellow-50 border p-2 text-left font-bold">Menaces</th>
              {[...Array(colCount + 1)].map((_, i) => <td key={i} className="border p-2 bg-yellow-50"></td>)}
            </tr>
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
                        title={cells[r]?.[c] ? "Retirer la marque" : "Ajouter une marque"}
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

      {/* Résumé */}
      <div className="mt-4 rounded-xl border bg-white shadow p-4 print-card">
        <h3 className="font-bold mb-2">Résumé synthétique</h3>
        <div className="grid md:grid-cols-2 gap-4 text-sm">
          <div>
            <div className="font-semibold mb-1">Leviers (Acquis les plus porteurs)</div>
            <ul className="list-disc pl-5 space-y-1">
              {summary.leverCols.length === 0 && <li className="text-gray-500">—</li>}
              {summary.leverCols.map((x, i) => (<li key={i}><span className="font-medium">{x.label}</span> — score {fmt(x.score)}</li>))}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-1">Faiblesses majeures</div>
            <ul className="list-disc pl-5 space-y-1">
              {summary.weakCols.length === 0 && <li className="text-gray-500">—</li>}
              {summary.weakCols.map((x, i) => (<li key={i}><span className="font-medium">{x.label}</span> — score {fmt(x.score)}</li>))}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-1">Opportunités prioritaires</div>
            <ul className="list-disc pl-5 space-y-1">
              {summary.opps.length === 0 && <li className="text-gray-500">—</li>}
              {summary.opps.map((x, i) => (<li key={i}><span className="font-medium">{x.label}</span> — score {fmt(x.score)}</li>))}
            </ul>
          </div>
          <div>
            <div className="font-semibold mb-1">Menaces critiques</div>
            <ul className="list-disc pl-5 space-y-1">
              {summary.threats.length === 0 && <li className="text-gray-500">—</li>}
              {summary.threats.map((x, i) => (<li key={i}><span className="font-medium">{x.label}</span> — score {fmt(x.score)}</li>))}
            </ul>
          </div>
        </div>
      </div>

      {/* Orientations stratégiques */}
      <div className="mt-4 rounded-xl border bg-white shadow p-4 print-card">
        <div className="flex items-center justify-between">
          <h3 className="font-bold">Orientations stratégiques</h3>
          <div className="no-print flex gap-2">
            <button onClick={generateAutoOrientations} className="px-3 py-1.5 rounded-md border hover:bg-gray-50">Générer (auto)</button>
            <button onClick={proposeIAOrientations} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 disabled:opacity-60" disabled={iaOrientLoading}>
              {iaOrientLoading ? "IA…" : "Proposer via IA"}
            </button>
            <button
              onClick={() => { const next = [...orientations, ""]; setOrientations(next); saveOrientations(next, "manual"); }}
              className="px-3 py-1.5 rounded-md border hover:bg-gray-50"
            >
              + Ajouter
            </button>
          </div>
        </div>

        {orientations.length === 0 && (
          <p className="text-sm text-gray-500 mt-2">Aucune orientation enregistrée. Utilisez “Générer (auto)” ou “Proposer via IA”, puis modifiez la liste.</p>
        )}

        <ul className="mt-3 space-y-2">
          {orientations.map((o, i) => (
            <li key={i} className="flex items-start gap-2">
              <span className="mt-2 text-sm text-gray-400 w-6 text-right">{i + 1}.</span>
              <input
                value={o}
                onChange={(e) => {
                  const next = [...orientations]; next[i] = e.target.value; setOrientations(next);
                }}
                onBlur={() => saveOrientations(orientations, "manual")}
                className="flex-1 rounded-md border px-3 py-2 text-sm"
                placeholder="Renseigner l’orientation…"
              />
              <button
                onClick={() => {
                  const next = orientations.filter((_, k) => k !== i);
                  setOrientations(next);
                  saveOrientations(next, "manual");
                }}
                className="no-print px-2 py-1 rounded-md border hover:bg-gray-50"
                title="Supprimer"
              >
                Suppr
              </button>
            </li>
          ))}
        </ul>

        <p className="text-xs text-gray-500 mt-3">
          Source : {orientationsSource.toUpperCase()} — Modifiez librement avant export PDF/CSV.
        </p>
      </div>
    </div>
  );
}
