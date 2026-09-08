import React, { useState, useEffect, useMemo, useRef } from 'react';
import {
  PostIt,
  AnalysisData,
  Contributor,
  Insight,
  Recommendation,
  AnalysisMetrics,
  QuadrantAnalysis,
  QuadrantKey,
} from '../types';
import { getAIAnalysis, decodeMatrixInteractions, MatrixInteraction, proposeCentralProblem, proposeImplicationsEnjeux, runCustomFFOMQuery } from '../services/geminiService';
import AIConfigPanel from './AIConfigPanel';
import { useAIConfig } from '../hooks/useAIConfig';
import { isAIAvailable } from '../services/aiProviderService';
import * as geminiAny from '../services/geminiService';
import {
  BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { QUADRANT_INFO, QUADRANT_ORDER, PRIORITY_STYLES } from '../constants';
import { doc as fsDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { BoardMeta, BoardContext } from '../types';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';

interface AnalysisModeProps { postIts: PostIt[]; onBack?: () => void; }

type CentralProblem = {
  text: string;
  textCourt?: string;
  source: 'manual' | 'ai_full' | 'ai_fm';
  rationale?: string;
  updatedAt?: any;
};

// Zone "Analyse IA du FFOM" (4 fonctions demandées par Mouhamed) — distincte du
// problème central manuel ci-dessus : chaque résultat a son propre emplacement,
// aucun des quatre ne doit écraser un autre.
type AIRunResult = { text: string; rationale?: string; generatedAt?: any };
type AICustomRun = { prompt: string; result: string; generatedAt?: any };
type AIExploration = {
  problemFull?: AIRunResult;
  problemFM?: AIRunResult;
  implicationsEnjeux?: { implications: string[]; enjeux: string[]; rationale?: string; generatedAt?: any };
  customRuns: AICustomRun[];
};
const blankExploration: AIExploration = { customRuns: [] };

// ---- Sélection des rubriques du rapport PDF (case à cocher avant génération) ----
type PdfSectionKey =
  | 'groupe' | 'ffom' | 'indicateurs' | 'camembert' | 'histogramme'
  | 'problemeCentral' | 'implications' | 'enjeux' | 'analysesIA';

const PDF_SECTION_LABELS: Record<PdfSectionKey, string> = {
  groupe: 'Informations du groupe / thématique',
  ffom: 'FFOM / idées retenues',
  indicateurs: 'Indicateurs et synthèse chiffrée',
  camembert: 'Camembert (répartition AFOM)',
  histogramme: 'Histogramme (timeline des contributions)',
  problemeCentral: 'Problème central',
  implications: 'Implications organisationnelles',
  enjeux: 'Enjeux',
  analysesIA: 'Analyses IA disponibles',
};
const PDF_SECTION_ORDER: PdfSectionKey[] = [
  'groupe', 'ffom', 'indicateurs', 'camembert', 'histogramme',
  'problemeCentral', 'implications', 'enjeux', 'analysesIA',
];

const AnalysisMode: React.FC<AnalysisModeProps> = ({ postIts, onBack }) => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);
  const [boardContext, setBoardContext] = useState<BoardContext | undefined>();
  const [groupMeta, setGroupMeta] = useState<{ name: string; theme: string }>({ name: '', theme: '' });
  const [matrixInteractions, setMatrixInteractions] = useState<MatrixInteraction[]>([]);
  const { config: aiCfg } = useAIConfig();
  const [aiConfigured, setAiConfigured] = useState(aiCfg.configured);
  const [showAIPanel, setShowAIPanel] = useState(false);

  // ---- Session / navigation ----
  const sessionId = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get('session') || localStorage.getItem('sessionId') || '';
  }, []);
  const goBack = () => {
    if (onBack) { onBack(); return; }
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=work&session=${encodeURIComponent(sessionId)}`;
  };

  // ---- Contexte du board (Firestore) ----
  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const snap = await getDoc(fsDoc(db, 'boards', sessionId));
        if (snap.exists()) {
          const m = snap.data() as BoardMeta;
          if (m.context) setBoardContext(m.context);
          setGroupMeta({ name: m.projectName || '', theme: m.themeName || '' });
        }
      } catch (e) {
        console.error('Load boardContext failed', e);
      }
    })();
  }, [sessionId]);

  // ---- Problème central (Firestore) ----
  const [central, setCentral] = useState<CentralProblem>({ text: '', source: 'manual' });
  const [savingCentral, setSavingCentral] = useState(false);
  const [aiRunningCentral, setAiRunningCentral] = useState<'full' | 'fm' | null>(null);

  useEffect(() => {
    (async () => {
      if (!sessionId) return;
      try {
        const ref = fsDoc(db, 'confrontations', sessionId);
        const snap = await getDoc(ref);
        if (snap.exists()) {
          const d = snap.data() as any;
          if (d.centralProblem) {
            setCentral({
              text: d.centralProblem.text || '',
              textCourt: d.centralProblem.textCourt || '',
              source: d.centralProblem.source || 'manual',
              rationale: d.centralProblem.rationale || '',
              updatedAt: d.centralProblem.updatedAt,
            });
          }
          // Décoder les interactions matrice si disponibles
          if (d.selection && Array.isArray(d.marks)) {
            const interactions = decodeMatrixInteractions(d.marks, d.selection);
            setMatrixInteractions(interactions);
          }
          if (d.aiExploration) {
            setAiExploration({
              problemFull: d.aiExploration.problemFull || undefined,
              problemFM: d.aiExploration.problemFM || undefined,
              implicationsEnjeux: d.aiExploration.implicationsEnjeux || undefined,
              customRuns: Array.isArray(d.aiExploration.customRuns) ? d.aiExploration.customRuns : [],
            });
          }
        }
      } catch (e) {
        console.error('Load confrontation data failed', e);
      }
    })();
  }, [sessionId]);

  const saveCentral = async (next: CentralProblem) => {
    setSavingCentral(true);
    try {
      await setDoc(
        fsDoc(db, 'confrontations', sessionId),
        { centralProblem: { text: next.text, textCourt: next.textCourt || '', source: next.source, rationale: next.rationale || '', updatedAt: new Date() } },
        { merge: true }
      );
      setCentral(next);
    } catch (e) {
      console.error(e);
      alert("Impossible d'enregistrer le problème central.");
    } finally {
      setSavingCentral(false);
    }
  };

  const askAIForCentral = async (mode: 'full' | 'fm') => {
    if (!postIts.length) {
      alert('Pas de données AFOM.');
      return;
    }
    if (!isAIAvailable()) {
      alert("Aucun provider IA configuré.\n\nOuvrez le bandeau « Assistance IA » ci-dessus pour renseigner votre clé API.");
      return;
    }
    try {
      setAiRunningCentral(mode);
      const fn = (geminiAny as any).proposeCentralProblem;
      if (typeof fn !== 'function') {
        alert("La génération IA n'est pas disponible dans ce build.");
        return;
      }
      const input = mode === 'full'
        ? postIts
        : postIts.filter((p) => p.quadrant === 'faiblesses' || p.quadrant === 'menaces');

      const result = await fn(input, { mode, context: boardContext, matrixInteractions });
      const next: CentralProblem = {
        text: (result?.problem || result?.text || '').slice(0, 400),
        textCourt: result?.problemCourt || '',
        rationale: result?.rationale || '',
        source: mode === 'full' ? 'ai_full' : 'ai_fm',
      };
      if (!next.text) { alert("L'IA n'a pas renvoyé de problème central exploitable."); return; }
      await saveCentral(next);
    } catch (e) {
      console.error(e);
      const msg = e instanceof Error ? e.message : String(e);
      alert(`Échec de la génération IA du problème central.\n\nErreur : ${msg}`);
    } finally {
      setAiRunningCentral(null);
    }
  };

  // ---- Refs pour capturer les graphiques (camembert + histogramme) dans l'export PDF ----
  const pieChartRef = useRef<HTMLDivElement>(null);
  const barChartRef = useRef<HTMLDivElement>(null);
  const [exportingPDF, setExportingPDF] = useState(false);
  const [showPdfModal, setShowPdfModal] = useState(false);
  const [pdfSections, setPdfSections] = useState<Record<PdfSectionKey, boolean>>({
    groupe: true, ffom: true, indicateurs: true, camembert: true, histogramme: true,
    problemeCentral: true, implications: true, enjeux: true, analysesIA: true,
  });

  // ---- Analyse IA du FFOM (4 fonctions, zone dédiée, distincte du problème central manuel) ----
  const [aiExploration, setAiExploration] = useState<AIExploration>(blankExploration);
  const [aiExplorationRunning, setAiExplorationRunning] = useState<'full' | 'fm' | 'implications' | 'custom' | null>(null);
  const [customPrompt, setCustomPrompt] = useState('');

  // Seules les contributions réelles de CE groupe/session (prop postIts, déjà filtrée par
  // sessionId côté App.tsx) sont utilisées — jamais celles d'un autre groupe ou atelier.
  const activePostIts = useMemo(() => postIts.filter((p) => p.status !== 'bin'), [postIts]);
  const fmPostIts = useMemo(() => activePostIts.filter((p) => p.quadrant === 'faiblesses' || p.quadrant === 'menaces'), [activePostIts]);

  // Firestore refuse toute valeur `undefined` (ex: rationale absente d'une reponse IA) :
  // on la retire recursivement avant setDoc plutot que de laisser planter l'ecriture.
  const stripUndefined = (value: any): any => {
    if (Array.isArray(value)) return value.map(stripUndefined);
    if (value && typeof value === 'object' && !(value instanceof Date)) {
      const out: Record<string, any> = {};
      for (const [k, v] of Object.entries(value)) {
        if (v !== undefined) out[k] = stripUndefined(v);
      }
      return out;
    }
    return value;
  };

  const saveAiExploration = async (patch: Partial<AIExploration>) => {
    const next = { ...aiExploration, ...patch };
    setAiExploration(next);
    await setDoc(fsDoc(db, 'confrontations', sessionId), { aiExploration: stripUndefined(next) }, { merge: true });
  };

  const requireAIAndData = (needFM = false): string | null => {
    if (!isAIAvailable()) return "Aucun provider IA configuré.\n\nOuvrez le bandeau « Assistance IA » ci-dessus pour renseigner votre clé API.";
    if (needFM ? fmPostIts.length === 0 : activePostIts.length === 0)
      return needFM
        ? "Aucune Faiblesse ni Menace n'a été saisie pour ce groupe : impossible de lancer cette analyse."
        : "Ajoutez des contributions à ce FFOM avant de lancer une analyse IA.";
    return null;
  };

  const runExplorationFull = async () => {
    const err = requireAIAndData();
    if (err) { alert(err); return; }
    setAiExplorationRunning('full');
    try {
      const res = await proposeCentralProblem(activePostIts, { mode: 'full', context: boardContext, matrixInteractions });
      if (!res.problem) { alert("L'IA n'a pas renvoyé de problème central exploitable."); return; }
      await saveAiExploration({ problemFull: { text: res.problem, rationale: res.rationale, generatedAt: new Date() } });
    } catch (e) {
      alert(`Échec de la génération.\n\nErreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiExplorationRunning(null);
    }
  };

  const runExplorationFM = async () => {
    const err = requireAIAndData(true);
    if (err) { alert(err); return; }
    setAiExplorationRunning('fm');
    try {
      // proposeCentralProblem filtre en interne sur Faiblesses+Menaces quand mode==='fm' :
      // seules ces contributions sont effectivement envoyées à l'IA.
      const res = await proposeCentralProblem(activePostIts, { mode: 'fm', context: boardContext, matrixInteractions });
      if (!res.problem) { alert("L'IA n'a pas renvoyé de problème central exploitable."); return; }
      await saveAiExploration({ problemFM: { text: res.problem, rationale: res.rationale, generatedAt: new Date() } });
    } catch (e) {
      alert(`Échec de la génération.\n\nErreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiExplorationRunning(null);
    }
  };

  const runExplorationImplications = async () => {
    const err = requireAIAndData();
    if (err) { alert(err); return; }
    setAiExplorationRunning('implications');
    try {
      const res = await proposeImplicationsEnjeux(activePostIts, boardContext);
      if (res.implications.length === 0 && res.enjeux.length === 0) { alert("L'IA n'a renvoyé aucun résultat exploitable."); return; }
      await saveAiExploration({ implicationsEnjeux: { ...res, generatedAt: new Date() } });
    } catch (e) {
      alert(`Échec de la génération.\n\nErreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiExplorationRunning(null);
    }
  };

  const runExplorationCustom = async () => {
    if (!customPrompt.trim()) { alert('Saisissez une consigne avant de générer.'); return; }
    const err = requireAIAndData();
    if (err) { alert(err); return; }
    setAiExplorationRunning('custom');
    try {
      const res = await runCustomFFOMQuery(activePostIts, customPrompt, boardContext);
      const entry: AICustomRun = { prompt: customPrompt.trim(), result: res.result, generatedAt: new Date() };
      await saveAiExploration({ customRuns: [entry, ...aiExploration.customRuns].slice(0, 5) });
      setCustomPrompt('');
    } catch (e) {
      alert(`Échec de l'analyse personnalisée.\n\nErreur : ${e instanceof Error ? e.message : String(e)}`);
    } finally {
      setAiExplorationRunning(null);
    }
  };

  // ---- Exports ----
  const download = (filename: string, mime: string, data: string | Blob) => {
    const blob = data instanceof Blob ? data : new Blob([data], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = filename; document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  };

  const toExcelHTML = (d: AnalysisData) => {
    const cell = (v: any, bold = false) =>
      `<td style="border:1px solid #ccc;padding:6px 10px;${bold ? 'font-weight:bold;background:#f0f4ff;' : ''}">${String(v ?? '').replace(/</g, '&lt;')}</td>`;
    const hdr = (...cols: string[]) =>
      `<tr>${cols.map((c) => `<th style="background:#4f46e5;color:#fff;padding:6px 10px;border:1px solid #3730a3;font-weight:bold">${c}</th>`).join('')}</tr>`;
    const sectionTitle = (t: string) =>
      `<tr><td colspan="4" style="background:#e0e7ff;font-weight:bold;padding:8px 10px;border:1px solid #c7d2fe;font-size:13px">${t}</td></tr>`;

    const rows: string[] = [];

    // Groupe
    rows.push(sectionTitle('👥 Groupe'));
    rows.push(hdr('Champ', 'Valeur', '', ''));
    rows.push(`<tr>${cell('Groupe', true)}${cell(groupMeta.name || '—')}<td></td><td></td></tr>`);
    rows.push(`<tr>${cell('Thématique', true)}${cell(groupMeta.theme || '—')}<td></td><td></td></tr>`);
    rows.push(`<tr><td colspan="4"></td></tr>`);

    // Problème central
    rows.push(sectionTitle('🎯 Problème central'));
    rows.push(hdr('Champ', 'Valeur', '', ''));
    rows.push(`<tr>${cell('Texte', true)}${cell(central.text || '—')}<td></td><td></td></tr>`);
    rows.push(`<tr>${cell('Source', true)}${cell(central.source || '—')}<td></td><td></td></tr>`);
    if (central.rationale) rows.push(`<tr>${cell('Justification', true)}${cell(central.rationale)}<td></td><td></td></tr>`);
    rows.push(`<tr><td colspan="4"></td></tr>`);

    // Métriques
    rows.push(sectionTitle('📊 Métriques de session'));
    rows.push(hdr('Indicateur', 'Valeur', '', ''));
    rows.push(`<tr>${cell('Total contributions', true)}${cell(d.metrics.totalContributions)}<td></td><td></td></tr>`);
    rows.push(`<tr>${cell('Participants uniques', true)}${cell(d.metrics.uniqueParticipants)}<td></td><td></td></tr>`);
    rows.push(`<tr>${cell('Durée (min)', true)}${cell(d.metrics.sessionDuration)}<td></td><td></td></tr>`);
    rows.push(`<tr>${cell('Score d\'engagement', true)}${cell(d.metrics.engagementScore)}<td></td><td></td></tr>`);
    rows.push(`<tr><td colspan="4"></td></tr>`);

    // Quadrants AFOM (totaux, ordre imposé A → F → O → M)
    rows.push(sectionTitle('🔲 Quadrants AFOM'));
    rows.push(hdr('Quadrant', 'Nombre de contributions', 'Nombre de mots', ''));
    QUADRANT_ORDER.forEach((k) => {
      const q = d.quadrants[k];
      rows.push(`<tr>${cell(QUADRANT_INFO[k].title, true)}${cell(q.count)}${cell(q.wordCount)}<td></td></tr>`);
    });
    rows.push(`<tr><td colspan="4"></td></tr>`);

    // Idées retenues, lisibles et rattachées à leur quadrant (ordre imposé A → F → O → M)
    rows.push(sectionTitle('💬 Idées retenues'));
    rows.push(hdr('Quadrant', 'Idée', 'Auteur', ''));
    retainedByQuadrant.forEach(({ label, items }) => {
      if (items.length === 0) {
        rows.push(`<tr>${cell(label, true)}${cell('—')}<td></td><td></td></tr>`);
        return;
      }
      items.forEach((item) => {
        rows.push(`<tr>${cell(label, true)}${cell(item.content)}${cell(item.author)}<td></td></tr>`);
      });
    });
    rows.push(`<tr><td colspan="4"></td></tr>`);

    // Insights IA
    if (d.insights.length > 0) {
      rows.push(sectionTitle('💡 Insights IA'));
      rows.push(hdr('#', 'Titre', 'Contenu', ''));
      d.insights.forEach((ins, i) => {
        rows.push(`<tr>${cell(i + 1)}${cell(ins.title, true)}${cell(ins.content)}<td></td></tr>`);
      });
      rows.push(`<tr><td colspan="4"></td></tr>`);
    }

    // Recommandations
    if (d.recommendations.length > 0) {
      rows.push(sectionTitle('✅ Recommandations'));
      rows.push(hdr('#', 'Titre', 'Contenu', 'Priorité'));
      d.recommendations.forEach((r, i) => {
        const pColor: Record<string, string> = { HIGH: '#fca5a5', URGENT: '#f87171', MEDIUM: '#fde68a', LOW: '#bbf7d0' };
        const bg = pColor[r.priority || ''] || '';
        rows.push(`<tr>${cell(i + 1)}${cell(r.title, true)}${cell(r.content)}<td style="border:1px solid #ccc;padding:6px 10px;background:${bg};font-weight:bold">${r.priority || ''}</td></tr>`);
      });
      rows.push(`<tr><td colspan="4"></td></tr>`);
    }

    // Contributeurs
    if (d.contributors.length > 0) {
      rows.push(sectionTitle('👥 Contributeurs'));
      rows.push(hdr('Nom', 'Contributions', 'Total mots', ''));
      d.contributors.forEach((c) => {
        rows.push(`<tr>${cell(c.name, true)}${cell(c.count)}${cell(c.totalWords)}<td></td></tr>`);
      });
    }

    return `<html xmlns:o="urn:schemas-microsoft-com:office:office" xmlns:x="urn:schemas-microsoft-com:office:excel" xmlns="http://www.w3.org/TR/REC-html40">
<head><meta charset="UTF-8">
<style>table{border-collapse:collapse;font-family:Calibri,Arial,sans-serif;font-size:12px}td,th{white-space:pre-wrap;max-width:400px}</style>
</head><body>
<h2 style="font-family:Calibri,sans-serif;color:#4f46e5">Rapport AFOM — ${groupMeta.name || `Session ${sessionId || ''}`}${groupMeta.theme ? ' — ' + groupMeta.theme : ''}</h2>
<table>${rows.join('')}</table>
</body></html>`;
  };

  const toWordHTML = (d: AnalysisData) => {
    const sec = (title: string, content: string) =>
      `<h2 style="color:#4f46e5;border-bottom:2px solid #4f46e5;padding-bottom:4pt;margin-top:18pt">${title}</h2>${content}`;
    const p = (t: string) => `<p style="margin:6pt 0;line-height:1.5">${String(t ?? '').replace(/</g, '&lt;')}</p>`;
    const label = (l: string, v: string) =>
      `<p style="margin:4pt 0"><strong>${l} :</strong> ${String(v ?? '').replace(/</g, '&lt;')}</p>`;

    const prioColor: Record<string, string> = { HIGH: '#dc2626', URGENT: '#7f1d1d', MEDIUM: '#d97706', LOW: '#16a34a' };

    const sections: string[] = [
      sec('👥 Groupe', [
        label('Groupe', groupMeta.name || '—'),
        label('Thématique', groupMeta.theme || '—'),
      ].join('')),

      sec('🎯 Problème central', [
        label('Énoncé', central.text || '—'),
        central.textCourt ? label('Titre court', central.textCourt) : '',
        central.rationale ? label('Justification IA', central.rationale) : '',
        label('Source', central.source === 'ai_full' ? 'IA (analyse complète)' : central.source === 'ai_fm' ? 'IA (F+M)' : 'Manuel'),
      ].join('')),

      sec('📊 Métriques de session', [
        label('Total contributions', String(d.metrics.totalContributions)),
        label('Participants uniques', String(d.metrics.uniqueParticipants)),
        label('Durée', `${d.metrics.sessionDuration} min`),
        label("Score d'engagement", String(d.metrics.engagementScore)),
      ].join('')),

      sec('🔲 Quadrants AFOM', QUADRANT_ORDER.map((k) =>
        label(QUADRANT_INFO[k].title, `${d.quadrants[k].count} contributions — ${d.quadrants[k].wordCount} mots`)
      ).join('')),

      sec('💬 Idées retenues', retainedByQuadrant.map(({ label: quadLabel, items }) =>
        `<p style="margin:10pt 0 2pt"><strong style="color:#4f46e5">${quadLabel}</strong></p>` +
        (items.length === 0
          ? p('—')
          : `<ul style="margin:2pt 0 6pt;padding-left:18pt">${items.map((item) =>
              `<li style="margin:2pt 0">${String(item.content ?? '').replace(/</g, '&lt;')}${item.author ? ` <span style="color:#6b7280;font-size:9pt">(${String(item.author).replace(/</g, '&lt;')})</span>` : ''}</li>`
            ).join('')}</ul>`)
      ).join('')),

      d.insights.length > 0 ? sec('💡 Insights IA', d.insights.map((ins, i) =>
        `<p style="margin:8pt 0 2pt"><strong style="color:#4f46e5">${i + 1}. ${ins.title.replace(/</g, '&lt;')}</strong></p>${p(ins.content)}`
      ).join('')) : '',

      d.recommendations.length > 0 ? sec('✅ Recommandations', d.recommendations.map((r, i) => {
        const col = prioColor[r.priority || ''] || '#374151';
        return `<p style="margin:8pt 0 2pt"><strong>${i + 1}. ${r.title.replace(/</g, '&lt;')}</strong> <span style="color:${col};font-size:9pt">[${r.priority || ''}]</span></p>${p(r.content)}`;
      }).join('')) : '',

      d.contributors.length > 0 ? sec('👥 Contributeurs', d.contributors.map((c) =>
        label(c.name, `${c.count} contributions — ${c.totalWords} mots`)
      ).join('')) : '',
    ].filter(Boolean);

    return `<!DOCTYPE html><html><head><meta charset="UTF-8">
<style>body{font-family:Calibri,Georgia,serif;font-size:12pt;color:#111;margin:2cm;line-height:1.6}
h1{color:#4f46e5;font-size:18pt}h2{font-size:13pt}strong{font-weight:600}</style>
</head><body>
<h1>Rapport d'analyse AFOM</h1>
<p style="color:#6b7280;margin-bottom:18pt">${groupMeta.name || `Session ${sessionId || '—'}`}${groupMeta.theme ? ' — ' + groupMeta.theme : ''} &nbsp;|&nbsp; Exporté le ${new Date().toLocaleDateString('fr-FR')}</p>
${sections.join('')}
</body></html>`;
  };

  const exportExcel = () => {
    if (!analysisData) return;
    const html = toExcelHTML(analysisData);
    download(`AFOM_${sessionId || 'session'}.xls`, 'application/vnd.ms-excel', '﻿' + html);
  };
  const exportWord = () => {
    if (!analysisData) return;
    const html = toWordHTML(analysisData);
    download(`AFOM_${sessionId || 'session'}.doc`, 'application/msword', html);
  };
  // Capture un graphique Recharts (camembert/histogramme) en image PNG pour l'export PDF.
  const captureChart = async (el: HTMLDivElement | null): Promise<string | null> => {
    if (!el) return null;
    try {
      const canvas = await html2canvas(el, { scale: 2, backgroundColor: '#ffffff', logging: false });
      return canvas.toDataURL('image/png');
    } catch (e) {
      console.error('Capture graphique échouée', e);
      return null;
    }
  };

  // Génère et télécharge un vrai fichier .pdf (pas une impression navigateur à configurer) :
  // aucune ambiguïté possible avec l'export Excel/Word, le fichier est directement conservable.
  // Composé uniquement des rubriques cochées dans la modale de sélection (sections).
  const exportPDF = async (sections: Record<PdfSectionKey, boolean>) => {
    if (!analysisData) return;
    setExportingPDF(true);
    // Laisse le temps au navigateur de peindre les graphiques (SVG Recharts) avant capture,
    // pour ne jamais photographier un rendu partiel/vide (ex: page tout juste chargée).
    await new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
    const [pieImg, barImg] = await Promise.all([
      sections.camembert ? captureChart(pieChartRef.current) : Promise.resolve(null),
      sections.histogramme ? captureChart(barChartRef.current) : Promise.resolve(null),
    ]);
    const d = analysisData;
    const doc = new jsPDF({ unit: 'pt', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    const pageHeight = doc.internal.pageSize.getHeight();
    const marginX = 48;
    const maxWidth = pageWidth - marginX * 2;
    let y = 56;

    const ensureSpace = (needed: number) => {
      if (y + needed > pageHeight - 48) { doc.addPage(); y = 56; }
    };
    const title = (text: string) => {
      ensureSpace(28);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(16); doc.setTextColor('#4f46e5');
      doc.text(text, marginX, y); y += 24;
    };
    const heading = (text: string) => {
      ensureSpace(24);
      doc.setFont('helvetica', 'bold'); doc.setFontSize(12); doc.setTextColor('#4f46e5');
      doc.text(text, marginX, y); y += 6;
      doc.setDrawColor('#4f46e5'); doc.line(marginX, y, pageWidth - marginX, y); y += 14;
    };
    const paragraph = (text: string, opts: { bold?: boolean; indent?: number; color?: string } = {}) => {
      doc.setFont('helvetica', opts.bold ? 'bold' : 'normal'); doc.setFontSize(10.5);
      doc.setTextColor(opts.color || '#111111');
      const lines = doc.splitTextToSize(text || '—', maxWidth - (opts.indent || 0));
      lines.forEach((line: string) => {
        ensureSpace(14);
        doc.text(line, marginX + (opts.indent || 0), y); y += 14;
      });
    };
    const spacer = (h = 8) => { y += h; };
    const image = (dataUrl: string | null, caption: string) => {
      if (!dataUrl) return;
      const props = doc.getImageProperties(dataUrl);
      const w = maxWidth;
      const h = (props.height * w) / props.width;
      ensureSpace(h + 16);
      doc.addImage(dataUrl, 'PNG', marginX, y, w, h);
      y += h + 4;
      doc.setFont('helvetica', 'italic'); doc.setFontSize(8.5); doc.setTextColor('#6b7280');
      doc.text(caption, marginX, y); y += 14;
    };

    title('Rapport d\'analyse AFOM');
    doc.setFont('helvetica', 'normal'); doc.setFontSize(9.5); doc.setTextColor('#6b7280');
    doc.text(`${groupMeta.name || `Session ${sessionId || '—'}`}${groupMeta.theme ? ' — ' + groupMeta.theme : ''}  |  Exporté le ${new Date().toLocaleDateString('fr-FR')}`, marginX, y);
    y += 22;

    if (sections.groupe) {
      heading('Groupe');
      paragraph(`Groupe : ${groupMeta.name || '—'}`, { bold: true });
      paragraph(`Thématique : ${groupMeta.theme || '—'}`);
      spacer();
    }

    if (sections.problemeCentral && central.text) {
      heading('Problème central');
      paragraph(central.text);
      if (central.textCourt) paragraph(`Titre court : ${central.textCourt}`);
      if (central.rationale) paragraph(`Justification IA : ${central.rationale}`);
      spacer();
    }

    if (sections.indicateurs) {
      heading('Métriques de session');
      paragraph(`Total contributions : ${d.metrics.totalContributions}`);
      paragraph(`Participants uniques : ${d.metrics.uniqueParticipants}`);
      paragraph(`Durée : ${d.metrics.sessionDuration} min`);
      paragraph(`Score d'engagement : ${d.metrics.engagementScore}`);
      spacer();

      heading('Quadrants AFOM');
      QUADRANT_ORDER.forEach((k) => paragraph(`${QUADRANT_INFO[k].title} : ${d.quadrants[k].count} contributions — ${d.quadrants[k].wordCount} mots`, { bold: true }));
      spacer();

      if (d.contributors.length > 0) {
        heading('Contributeurs');
        d.contributors.forEach((c) => paragraph(`${c.name} : ${c.count} contributions — ${c.totalWords} mots`));
        spacer();
      }
    }

    if ((sections.camembert && pieImg) || (sections.histogramme && barImg)) {
      heading('Graphiques');
      if (sections.camembert) image(pieImg, 'Répartition AFOM');
      if (sections.histogramme) image(barImg, 'Timeline des contributions');
      spacer();
    }

    if (sections.ffom) {
      heading('Idées retenues');
      retainedByQuadrant.forEach(({ label, items }) => {
        paragraph(label, { bold: true, color: '#4f46e5' });
        if (items.length === 0) {
          paragraph('—', { indent: 12 });
        } else {
          items.forEach((item) => paragraph(`•  ${item.content}${item.author ? `  (${item.author})` : ''}`, { indent: 12 }));
        }
        spacer(4);
      });
    }

    if (sections.implications && aiExploration.implicationsEnjeux?.implications?.length) {
      heading('Implications organisationnelles');
      aiExploration.implicationsEnjeux.implications.forEach((t) => paragraph(`•  ${t}`, { indent: 12 }));
      spacer();
    }

    if (sections.enjeux && aiExploration.implicationsEnjeux?.enjeux?.length) {
      heading('Enjeux');
      aiExploration.implicationsEnjeux.enjeux.forEach((t) => paragraph(`•  ${t}`, { indent: 12 }));
      spacer();
    }

    if (sections.analysesIA) {
      if (d.insights.length > 0) {
        heading('Insights IA');
        d.insights.forEach((ins, i) => { paragraph(`${i + 1}. ${ins.title}`, { bold: true }); paragraph(ins.content, { indent: 12 }); spacer(2); });
      }
      if (d.recommendations.length > 0) {
        heading('Recommandations');
        d.recommendations.forEach((r, i) => { paragraph(`${i + 1}. ${r.title} [${r.priority || ''}]`, { bold: true }); paragraph(r.content, { indent: 12 }); spacer(2); });
      }
      if (aiExploration.problemFull) {
        heading('Analyse IA du FFOM — Problème central (FFOM complet)');
        paragraph(aiExploration.problemFull.text);
        if (aiExploration.problemFull.rationale) paragraph(`Justification IA : ${aiExploration.problemFull.rationale}`, { indent: 12 });
        spacer();
      }
      if (aiExploration.problemFM) {
        heading('Analyse IA du FFOM — Problème central (Faiblesses + Menaces)');
        paragraph(aiExploration.problemFM.text);
        if (aiExploration.problemFM.rationale) paragraph(`Justification IA : ${aiExploration.problemFM.rationale}`, { indent: 12 });
        spacer();
      }
      if (aiExploration.customRuns.length > 0) {
        heading('Analyses personnalisées');
        aiExploration.customRuns.forEach((run) => {
          paragraph(`Consigne : ${run.prompt}`, { bold: true });
          paragraph(run.result, { indent: 12 });
          spacer(2);
        });
      }
    }

    doc.save(`AFOM_${groupMeta.name || sessionId || 'session'}.pdf`);
    setExportingPDF(false);
  };

  const handleGeneratePDF = async () => {
    await exportPDF(pdfSections);
    setShowPdfModal(false);
  };

  const toggleAllPdfSections = (value: boolean) => {
    setPdfSections((prev) => {
      const next = { ...prev };
      PDF_SECTION_ORDER.forEach((k) => { if (availableSections[k]) next[k] = value; });
      return next;
    });
  };

  // ---- Traitement des données de base ----
  const processData = (rawData: PostIt[]): Omit<AnalysisData, 'insights' | 'recommendations'> => {
    const metrics: AnalysisMetrics = {
      totalContributions: rawData.length,
      uniqueParticipants: new Set(rawData.map((p) => p.author)).size,
      sessionDuration: 0,
      engagementScore: 0,
    };
    if (rawData.length > 0) {
      const timestamps = rawData.filter((p) => p.timestamp).map((p) => (p.timestamp as any).seconds * 1000);
      if (timestamps.length > 0) {
        const minTs = Math.min(...timestamps);
        const maxTs = Math.max(...timestamps);
        metrics.sessionDuration = Math.round((maxTs - minTs) / (1000 * 60));
      }
    }
    metrics.engagementScore = Math.round(
      (metrics.totalContributions * 0.3 + metrics.uniqueParticipants * 0.4 + Math.min(metrics.sessionDuration, 120) * 0.3) * 0.83
    );
    const quadrants: Record<QuadrantKey, QuadrantAnalysis> = {} as any;
    QUADRANT_ORDER.forEach((key) => {
      const items = rawData.filter((p) => p.quadrant === key);
      quadrants[key] = {
        count: items.length,
        wordCount: items.reduce((sum, item) => sum + item.content.split(' ').length, 0),
      };
    });
    const contributorMap: Record<string, Contributor> = {};
    rawData.forEach((p) => {
      if (!contributorMap[p.author]) { contributorMap[p.author] = { name: p.author, count: 0, totalWords: 0 }; }
      contributorMap[p.author].count++; contributorMap[p.author].totalWords += p.content.split(' ').length;
    });
    const contributors = Object.values(contributorMap).sort((a, b) => b.count - a.count).slice(0, 5);
    const timelineMap: Record<string, { time: string; acquis: number; faiblesses: number; opportunites: number; menaces: number }> = {};
    rawData.filter((p) => p.timestamp).forEach((p) => {
      const date = (p.timestamp as any).toDate ? (p.timestamp as any).toDate() : new Date((p.timestamp as any).seconds * 1000);
      const timeKey = date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
      if (!timelineMap[timeKey]) { timelineMap[timeKey] = { time: timeKey, acquis: 0, faiblesses: 0, opportunites: 0, menaces: 0 }; }
      (timelineMap[timeKey] as any)[p.quadrant]++;
    });
    const timeline = Object.values(timelineMap);
    return { metrics, quadrants, contributors, timeline };
  };

  const runAIAnalysis = (its: PostIt[], ctx: BoardContext | undefined, interactions: MatrixInteraction[]) => {
    setLoadingAI(true);
    getAIAnalysis(its, ctx, interactions).then((res) => {
      const insights: Insight[] = Array.isArray((res as any)?.insights)
        ? (res as any).insights.map((i: any) => ({ title: String(i.title ?? ''), content: String(i.content ?? '') })) as Insight[]
        : [];
      const recommendations: Recommendation[] = Array.isArray((res as any)?.recommendations)
        ? (res as any).recommendations.map((r: any) => ({
            title: String(r.title ?? ''),
            content: String(r.content ?? ''),
            priority: (r.priority as any) ?? 'moyenne',
          })) as Recommendation[]
        : [];
      setAnalysisData((prev) => prev ? { ...prev, insights, recommendations } : prev);
      setLoadingAI(false);
    });
  };

  useEffect(() => {
    if (postIts.length > 0) {
      const basicData = processData(postIts);
      setAnalysisData({ ...basicData, insights: [], recommendations: [] });
      const timer = setTimeout(() => runAIAnalysis(postIts, boardContext, matrixInteractions), 500);
      return () => clearTimeout(timer);
    } else {
      setAnalysisData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIts, matrixInteractions]);

  const doughnutData = useMemo(() => {
    if (!analysisData) return [];
    return QUADRANT_ORDER.map((key) => ({
      name: QUADRANT_INFO[key].title,
      value: analysisData.quadrants[key].count,
      color: QUADRANT_INFO[key].color,
    }));
  }, [analysisData]);

  // Idées retenues par quadrant, dans l'ordre imposé A → F → O → M
  const retainedByQuadrant = useMemo(() => {
    const active = postIts.filter((p) => p.status !== 'bin');
    return QUADRANT_ORDER.map((key) => ({
      key,
      label: QUADRANT_INFO[key].title,
      items: active.filter((p) => p.quadrant === key),
    }));
  }, [postIts]);

  // Rubriques réellement disponibles pour CETTE session — n'affiche pas de case pour une
  // rubrique dont les données n'existent pas (ex: implications/enjeux jamais générées).
  const availableSections = useMemo<Record<PdfSectionKey, boolean>>(() => ({
    groupe: true,
    ffom: true,
    indicateurs: true,
    camembert: true,
    histogramme: true,
    problemeCentral: !!central.text,
    implications: !!aiExploration.implicationsEnjeux?.implications?.length,
    enjeux: !!aiExploration.implicationsEnjeux?.enjeux?.length,
    analysesIA: !!(
      (analysisData?.insights?.length) ||
      (analysisData?.recommendations?.length) ||
      aiExploration.problemFull ||
      aiExploration.problemFM ||
      aiExploration.customRuns.length
    ),
  }), [central.text, aiExploration, analysisData]);

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PrintStyles />
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b no-print">
          <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2">
            <button onClick={goBack} className="px-2 sm:px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm">← Retour</button>
            <div className="text-sm font-semibold text-gray-600">Analyse{groupMeta.name ? ` — ${groupMeta.name}${groupMeta.theme ? ' — ' + groupMeta.theme : ''}` : ''}</div>
          </div>
        </header>
        <div className="p-8 text-center text-gray-500">Commencez à ajouter des post-its pour voir l'analyse.</div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gray-50">
      <PrintStyles />
      {/* Header */}
      <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b no-print">
        <div className="max-w-7xl mx-auto px-3 sm:px-4 py-2 flex items-center gap-2 min-w-0">
          <button onClick={goBack} className="px-2 sm:px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm flex-shrink-0">← Retour</button>
          <div className="text-sm font-semibold text-gray-600 flex-shrink-0 truncate">Analyse{groupMeta.name ? ` — ${groupMeta.name}${groupMeta.theme ? ' — ' + groupMeta.theme : ''}` : ''}</div>
          <div className="flex items-center gap-1 sm:gap-2 ml-auto overflow-x-auto" style={{ scrollbarWidth: "none" }}>
            <button
              onClick={() => {
                if (!isAIAvailable()) {
                  alert("Aucun provider IA configuré.\n\nOuvrez le bandeau « Assistance IA » ci-dessous pour renseigner votre clé API.");
                  return;
                }
                runAIAnalysis(postIts, boardContext, matrixInteractions);
              }}
              disabled={loadingAI}
              className="px-2 sm:px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 disabled:opacity-50"
              title="Relancer l'analyse IA avec le provider configuré"
            >
              {loadingAI ? 'IA…' : '⟳ Analyse IA'}
            </button>
            <button onClick={exportExcel} title="Télécharge un fichier .xls" className="px-2 sm:px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
              <span className="sm:hidden">.xls</span><span className="hidden sm:inline">Exporter en Excel (.xls)</span>
            </button>
            <button onClick={exportWord} title="Télécharge un fichier .doc" className="px-2 sm:px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-xs sm:text-sm whitespace-nowrap flex-shrink-0">
              <span className="sm:hidden">.doc</span><span className="hidden sm:inline">Exporter en Word (.doc)</span>
            </button>
            <button onClick={() => setShowPdfModal(true)} disabled={exportingPDF} title="Choisir les rubriques puis télécharger un fichier .pdf" className="px-2 sm:px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-xs sm:text-sm whitespace-nowrap flex-shrink-0 disabled:opacity-50">
              <span className="sm:hidden">{exportingPDF ? '…' : '.pdf'}</span><span className="hidden sm:inline">{exportingPDF ? 'Génération du PDF…' : 'Télécharger le rapport PDF (.pdf)'}</span>
            </button>
          </div>
        </div>
      </header>

      {/* Bandeau Assistance IA — collapsible */}
      <div className="no-print">
        <div
          className="bg-gradient-to-r from-indigo-600 via-indigo-500 to-purple-600 px-6 py-3 flex items-center gap-3 cursor-pointer select-none"
          onClick={() => setShowAIPanel((v) => !v)}
        >
          <span className="text-lg leading-none">🤖</span>
          <div className="flex-1 min-w-0">
            <p className="text-sm font-bold text-white leading-tight">Assistance IA</p>
            <p className="text-[11px] text-indigo-200">Analyse · Recommandations · Problème central</p>
          </div>
          {aiConfigured ? (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-bold bg-emerald-400/30 text-white border border-emerald-300/50">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-300 animate-pulse" />
              Prête
            </span>
          ) : (
            <span className="inline-flex items-center gap-1.5 px-2.5 py-1 rounded-full text-xs font-semibold bg-white/15 text-indigo-100 border border-white/25">
              <span className="w-1.5 h-1.5 rounded-full bg-amber-300" />
              Non configurée
            </span>
          )}
          <span className="text-white/60 text-xs ml-1">{showAIPanel ? '▲' : '▼'}</span>
        </div>
        {showAIPanel && (
          <div className="bg-white border-b border-indigo-100 px-6 py-5 max-w-2xl">
            <AIConfigPanel onConfigured={(next) => setAiConfigured(!!next?.configured)} />
          </div>
        )}
      </div>

      <div className="p-4 sm:p-8 space-y-8 print:p-0">
        {/* ---- Problème central ---- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3 flex-wrap gap-2">
            <h3 className="text-lg font-black text-gray-800">🎯 Problème central</h3>
            <div className="flex items-center gap-2">
              {matrixInteractions.length > 0 && (
                <span className="text-xs bg-emerald-50 text-emerald-700 border border-emerald-200 px-2 py-0.5 rounded-full">
                  {matrixInteractions.length} interaction{matrixInteractions.length > 1 ? 's' : ''} matrice utilisée{matrixInteractions.length > 1 ? 's' : ''}
                </span>
              )}
              <div className="text-xs text-gray-500">Source : <span className="font-bold">{central.source}</span></div>
            </div>
          </div>

          {/* Formulation longue */}
          <label className="text-xs font-semibold text-gray-600 mb-1 block">Formulation complète</label>
          <textarea
            value={central.text}
            onChange={(e) => setCentral({ ...central, text: e.target.value, source: 'manual' })}
            placeholder="Saisissez ou générez le problème central… (état négatif, spécifique aux données)"
            className="w-full min-h-[90px] rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400 text-sm"
          />

          {/* Formulation courte — arbre à problème */}
          <div className="mt-3">
            <label className="text-xs font-semibold text-gray-600 mb-1 block">
              Titre pour arbre à problème
              <span className="font-normal text-gray-400 ml-1">(max 5 mots)</span>
            </label>
            <div className="flex items-center gap-2">
              <input
                value={central.textCourt || ''}
                onChange={(e) => setCentral({ ...central, textCourt: e.target.value, source: 'manual' })}
                placeholder="Ex : Participation faible et sous-financement"
                className="flex-1 rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                maxLength={60}
              />
              {central.textCourt && (
                <span className="shrink-0 px-3 py-1.5 bg-red-600 text-white text-xs font-bold rounded-lg shadow">
                  {central.textCourt}
                </span>
              )}
            </div>
          </div>

          {central.rationale && (
            <div className="mt-2 text-xs text-gray-500 bg-gray-50 rounded px-3 py-2">
              <span className="font-semibold text-gray-700">Justification IA :</span> {central.rationale}
            </div>
          )}

          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => askAIForCentral('full')} disabled={!!aiRunningCentral} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm">
              {aiRunningCentral === 'full' ? 'Génération…' : 'IA – AFOM complet'}
            </button>
            <button onClick={() => askAIForCentral('fm')} disabled={!!aiRunningCentral} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm">
              {aiRunningCentral === 'fm' ? 'Génération…' : 'IA – Faiblesses + Menaces'}
            </button>
            <button onClick={() => saveCentral({ ...central, source: 'manual' })} disabled={savingCentral} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700 text-sm">
              {savingCentral ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => saveCentral({ text: '', textCourt: '', source: 'manual' })} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50 text-sm text-gray-500">Effacer</button>
          </div>
        </div>

        <AIExplorationPanel
          activeCount={activePostIts.length}
          fmCount={fmPostIts.length}
          aiConfigured={isAIAvailable()}
          exploration={aiExploration}
          running={aiExplorationRunning}
          customPrompt={customPrompt}
          onCustomPromptChange={setCustomPrompt}
          onRunFull={runExplorationFull}
          onRunFM={runExplorationFM}
          onRunImplications={runExplorationImplications}
          onRunCustom={runExplorationCustom}
        />

        {/* ---- Métriques / Graphs ---- */}
        <MetricGrid metrics={analysisData.metrics} />

        <div className="grid lg:grid-cols-2 gap-8">
          <ChartCard title="Répartition AFOM">
            <div ref={pieChartRef} className="bg-white">
              <ResponsiveContainer width="100%" height={300}>
                <PieChart>
                  <Pie data={doughnutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label isAnimationActive={false}>
                    {doughnutData.map((entry, index) => <Cell key={`cell-${index}`} fill={(entry as any).color} />)}
                  </Pie>
                  <Tooltip /><Legend content={<QuadrantLegend />} />
                </PieChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
          <ChartCard title="Timeline des Contributions">
            <div ref={barChartRef} className="bg-white">
              <ResponsiveContainer width="100%" height={300}>
                <BarChart data={analysisData.timeline}>
                  <XAxis dataKey="time" /><YAxis /><Tooltip /><Legend content={<QuadrantLegend />} />
                  <Bar dataKey="acquis" stackId="a" fill={QUADRANT_INFO.acquis.color} isAnimationActive={false} />
                  <Bar dataKey="faiblesses" stackId="a" fill={QUADRANT_INFO.faiblesses.color} isAnimationActive={false} />
                  <Bar dataKey="opportunites" stackId="a" fill={QUADRANT_INFO.opportunites.color} isAnimationActive={false} />
                  <Bar dataKey="menaces" stackId="a" fill={QUADRANT_INFO.menaces.color} isAnimationActive={false} />
                </BarChart>
              </ResponsiveContainer>
            </div>
          </ChartCard>
        </div>

        <RetainedIdeasList groups={retainedByQuadrant} />

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3"><InsightsList insights={analysisData.insights} loading={loadingAI} /></div>
          <div className="lg:col-span-2"><ContributorsList contributors={analysisData.contributors} /></div>
        </div>

        <RecommendationsList recommendations={analysisData.recommendations} loading={loadingAI} />
      </div>

      {/* ---- Modale de sélection des rubriques avant génération du PDF ---- */}
      {showPdfModal && (
        <div className="fixed inset-0 z-50 bg-black/60 flex items-center justify-center p-4 no-print">
          <div className="bg-white rounded-2xl shadow-2xl w-full max-w-lg max-h-[90vh] overflow-y-auto p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-lg font-bold text-gray-900">Rubriques du rapport PDF</h2>
              <button onClick={() => setShowPdfModal(false)} className="text-gray-400 hover:text-gray-600 text-2xl leading-none">×</button>
            </div>
            <div className="flex items-center gap-3 mb-3 text-xs">
              <button onClick={() => toggleAllPdfSections(true)} className="text-indigo-600 hover:underline font-semibold">Tout sélectionner</button>
              <button onClick={() => toggleAllPdfSections(false)} className="text-indigo-600 hover:underline font-semibold">Tout désélectionner</button>
            </div>
            <div className="space-y-2 mb-5">
              {PDF_SECTION_ORDER.filter((k) => availableSections[k]).map((k) => (
                <label key={k} className="flex items-center gap-2 text-sm text-gray-800 cursor-pointer">
                  <input
                    type="checkbox"
                    checked={pdfSections[k]}
                    onChange={(e) => setPdfSections((prev) => ({ ...prev, [k]: e.target.checked }))}
                    className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-400"
                  />
                  {PDF_SECTION_LABELS[k]}
                </label>
              ))}
            </div>
            <div className="flex justify-end gap-3 border-t pt-4">
              <button onClick={() => setShowPdfModal(false)} className="px-4 py-2 rounded-lg border text-sm hover:bg-gray-50">Annuler</button>
              <button
                onClick={handleGeneratePDF}
                disabled={exportingPDF || PDF_SECTION_ORDER.every((k) => !availableSections[k] || !pdfSections[k])}
                className="px-4 py-2 rounded-lg bg-indigo-600 text-white text-sm hover:bg-indigo-700 disabled:opacity-50"
              >
                {exportingPDF ? 'Génération du PDF…' : 'Générer le PDF'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

// Légende figée dans l'ordre imposé A → F → O → M : Recharts (v3) ne garantit pas
// l'ordre de sa légende auto-générée pour un PieChart/BarChart empilé, même quand les
// séries/données sont déjà dans le bon ordre (constaté en recette) — on ignore donc
// entièrement le payload que Recharts fournit et on rend notre propre légende fixe.
const QuadrantLegend: React.FC = () => (
  <ul className="mt-2 flex flex-wrap justify-center gap-4 text-sm text-gray-600">
    {QUADRANT_ORDER.map((key) => (
      <li key={key} className="flex items-center gap-1.5">
        <span className="inline-block h-2.5 w-2.5 rounded-sm" style={{ background: QUADRANT_INFO[key].color }} />
        {QUADRANT_INFO[key].title}
      </li>
    ))}
  </ul>
);

/** Styles impression */
const PrintStyles: React.FC = () => (
  <style>{`
    @media print {
      .no-print { display: none !important; }
      body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
      @page { margin: 16mm; }
    }
  `}</style>
);

const MetricGrid: React.FC<{ metrics: AnalysisMetrics }> = ({ metrics }) => (
  <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
    <MetricCard label="Contributions" value={metrics.totalContributions} />
    <MetricCard label="Participants" value={metrics.uniqueParticipants} />
    <MetricCard label="Durée (min)" value={metrics.sessionDuration} />
    <MetricCard label="Engagement" value={metrics.engagementScore} />
  </div>
);

const MetricCard: React.FC<{ label: string; value: number }> = ({ label, value }) => (
  <div className="bg-white p-4 rounded-xl shadow-lg border border-gray-200 text-center">
    <div className="text-3xl font-black text-indigo-600">{value}</div>
    <div className="text-sm font-bold text-gray-500">{label}</div>
  </div>
);

const ChartCard: React.FC<{ title: string; children: React.ReactNode }> = ({ title, children }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
    <h3 className="text-lg font-black text-gray-700 mb-4">{title}</h3>
    {children}
  </div>
);

function formatAIDate(v: any): string {
  const d = v?.toDate ? v.toDate() : v instanceof Date ? v : null;
  return d ? d.toLocaleString('fr-FR') : '';
}

const AIExplorationPanel: React.FC<{
  activeCount: number;
  fmCount: number;
  aiConfigured: boolean;
  exploration: AIExploration;
  running: 'full' | 'fm' | 'implications' | 'custom' | null;
  customPrompt: string;
  onCustomPromptChange: (v: string) => void;
  onRunFull: () => void;
  onRunFM: () => void;
  onRunImplications: () => void;
  onRunCustom: () => void;
}> = ({ activeCount, fmCount, aiConfigured, exploration, running, customPrompt, onCustomPromptChange, onRunFull, onRunFM, onRunImplications, onRunCustom }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
    <h3 className="text-lg font-black text-gray-800">🧠 Analyse IA du FFOM</h3>
    <p className="mt-1 text-xs text-gray-500">
      Fondée uniquement sur les {activeCount} contribution{activeCount > 1 ? 's' : ''} réelle{activeCount > 1 ? 's' : ''} de ce groupe — jamais mélangée avec un autre groupe ou atelier.
    </p>
    {!aiConfigured && (
      <p className="mt-3 text-sm text-amber-700 bg-amber-50 border border-amber-200 rounded-lg px-3 py-2">
        Aucun provider IA configuré — ouvrez le bandeau « Assistance IA » ci-dessus pour renseigner une clé API.
      </p>
    )}

    <div className="mt-4 grid gap-4 sm:grid-cols-2">
      <div className="rounded-lg border p-4">
        <h4 className="font-bold text-gray-800">Problème central — FFOM complet</h4>
        <p className="text-xs text-gray-500 mt-0.5">À partir de l'ensemble Acquis / Faiblesses / Opportunités / Menaces.</p>
        <button onClick={onRunFull} disabled={running !== null || activeCount === 0} className="mt-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
          {running === 'full' ? 'Génération…' : 'Générer'}
        </button>
        {exploration.problemFull && (
          <div className="mt-3 text-sm bg-indigo-50 border border-indigo-100 rounded-lg p-3">
            <p className="text-gray-800">{exploration.problemFull.text}</p>
            {exploration.problemFull.rationale && <p className="mt-1 text-xs text-gray-500">{exploration.problemFull.rationale}</p>}
            <p className="mt-1 text-[10px] text-gray-400">{formatAIDate(exploration.problemFull.generatedAt)}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4">
        <h4 className="font-bold text-gray-800">Problème central — Faiblesses + Menaces</h4>
        <p className="text-xs text-gray-500 mt-0.5">À partir uniquement des Faiblesses et Menaces ({fmCount}).</p>
        <button onClick={onRunFM} disabled={running !== null || fmCount === 0} className="mt-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
          {running === 'fm' ? 'Génération…' : 'Générer'}
        </button>
        {fmCount === 0 && <p className="mt-2 text-xs text-gray-400">Aucune Faiblesse ni Menace saisie pour ce groupe.</p>}
        {exploration.problemFM && (
          <div className="mt-3 text-sm bg-orange-50 border border-orange-100 rounded-lg p-3">
            <p className="text-gray-800">{exploration.problemFM.text}</p>
            {exploration.problemFM.rationale && <p className="mt-1 text-xs text-gray-500">{exploration.problemFM.rationale}</p>}
            <p className="mt-1 text-[10px] text-gray-400">{formatAIDate(exploration.problemFM.generatedAt)}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 sm:col-span-2">
        <h4 className="font-bold text-gray-800">Implications organisationnelles et enjeux</h4>
        <button onClick={onRunImplications} disabled={running !== null || activeCount === 0} className="mt-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
          {running === 'implications' ? 'Génération…' : 'Générer'}
        </button>
        {exploration.implicationsEnjeux && (
          <div className="mt-3 grid gap-3 sm:grid-cols-2 text-sm">
            <div className="bg-blue-50 border border-blue-100 rounded-lg p-3">
              <p className="font-semibold text-blue-800 mb-1">Implications organisationnelles</p>
              <ul className="list-disc pl-4 space-y-1 text-gray-800">
                {exploration.implicationsEnjeux.implications.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <div className="bg-purple-50 border border-purple-100 rounded-lg p-3">
              <p className="font-semibold text-purple-800 mb-1">Enjeux</p>
              <ul className="list-disc pl-4 space-y-1 text-gray-800">
                {exploration.implicationsEnjeux.enjeux.map((t, i) => <li key={i}>{t}</li>)}
              </ul>
            </div>
            <p className="sm:col-span-2 text-[10px] text-gray-400">{formatAIDate(exploration.implicationsEnjeux.generatedAt)}</p>
          </div>
        )}
      </div>

      <div className="rounded-lg border p-4 sm:col-span-2">
        <h4 className="font-bold text-gray-800">Analyse personnalisée</h4>
        <p className="text-xs text-gray-500 mt-0.5">Écrivez votre propre consigne, elle sera appliquée aux données de ce FFOM.</p>
        <textarea
          value={customPrompt}
          onChange={(e) => onCustomPromptChange(e.target.value)}
          placeholder="Ex : À partir de ce FFOM, propose trois priorités d'action."
          className="mt-2 w-full min-h-[70px] rounded-lg border px-3 py-2 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
        />
        <button onClick={onRunCustom} disabled={running !== null || activeCount === 0 || !customPrompt.trim()} className="mt-2 px-3 py-1.5 rounded-md bg-indigo-600 text-white text-sm font-semibold disabled:opacity-50">
          {running === 'custom' ? 'Génération…' : 'Générer'}
        </button>
        {exploration.customRuns.length > 0 && (
          <div className="mt-3 space-y-2">
            {exploration.customRuns.map((run, i) => (
              <div key={i} className="text-sm bg-gray-50 border rounded-lg p-3">
                <p className="text-xs font-semibold text-gray-500">« {run.prompt} »</p>
                <p className="mt-1 whitespace-pre-wrap text-gray-800">{run.result}</p>
                <p className="mt-1 text-[10px] text-gray-400">{formatAIDate(run.generatedAt)}</p>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  </div>
);

const RetainedIdeasList: React.FC<{ groups: { key: QuadrantKey; label: string; items: PostIt[] }[] }> = ({ groups }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
    <h3 className="text-lg font-black text-gray-700 mb-4">💬 Idées retenues</h3>
    <div className="grid gap-4 sm:grid-cols-2">
      {groups.map(({ key, label, items }) => (
        <div key={key} className={`rounded-lg border-l-4 p-4 ${QUADRANT_INFO[key].bgColor} ${QUADRANT_INFO[key].borderColor}`}>
          <h4 className={`font-bold mb-2 ${QUADRANT_INFO[key].textColor}`}>{label} <span className="font-normal text-gray-500">({items.length})</span></h4>
          {items.length === 0
            ? <p className="text-sm text-gray-500">Aucune idée retenue.</p>
            : <ul className="space-y-1.5">
                {items.map((item) => (
                  <li key={item.id} className="text-sm text-gray-800">
                    • {item.content}
                    {item.author && <span className="text-gray-400"> — {item.author}</span>}
                  </li>
                ))}
              </ul>}
        </div>
      ))}
    </div>
  </div>
);

const InsightsList: React.FC<{ insights: Insight[]; loading: boolean }> = ({ insights, loading }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200 h-full">
    <h3 className="text-lg font-black text-gray-700 mb-4">🧠 Insights Stratégiques (IA)</h3>
    {loading ? <div className="text-center p-4">Analyse par IA en cours...</div> :
      !insights.length ? <div className="text-center p-4 text-gray-500">Pas assez de données pour l'analyse IA.</div> :
      <div className="space-y-4">
        {insights.map((insight, i) => (
          <div key={i} className="bg-blue-50 border-l-4 border-blue-500 p-4 rounded-r-lg">
            <h4 className="font-bold text-blue-800">{insight.title}</h4>
            <p className="text-sm text-blue-700">{insight.content}</p>
          </div>
        ))}
      </div>}
  </div>
);

const RecommendationsList: React.FC<{ recommendations: Recommendation[]; loading: boolean }> = ({ recommendations, loading }) => (
  <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
    <h3 className="text-lg font-black text-gray-700 mb-4">🎯 Recommandations Stratégiques (IA)</h3>
    {loading ? <div className="text-center p-4">Génération des recommandations par IA...</div> :
      !recommendations.length ? <div className="text-center p-4 text-gray-500">Pas assez de données pour les recommandations IA.</div> :
      <div className="space-y-4">
        {recommendations.map((rec, i) => {
          const styles = (PRIORITY_STYLES as any)[rec.priority] || { bg: 'bg-gray-100', color: 'text-gray-800', icon: '💡', borderColor: 'border-gray-500' };
          return (
            <div key={i} className={`p-4 rounded-lg border-l-4 ${styles.bg} ${styles.borderColor}`}>
              <h4 className={`font-bold ${styles.color}`}>
                {styles.icon} {rec.title}
                <span className={`ml-2 text-xs font-bold px-2 py-0.5 rounded-full ${styles.bg}`}>{rec.priority}</span>
              </h4>
              <p className="text-sm text-gray-700">{rec.content}</p>
            </div>
          );
        })}
      </div>}
  </div>
);

const ContributorsList: React.FC<{ contributors: Contributor[] }> = ({ contributors }) => {
  const medals = ['🥇', '🥈', '🥉', '🏅', '🏅'];
  return (
    <div className="bg-gradient-to-br from-indigo-600 to-purple-600 text-white p-6 rounded-xl shadow-lg h-full">
      <h3 className="text-lg font-black mb-4">🏆 Top Contributeurs</h3>
      <div className="space-y-3">
        {contributors.map((c, i) => (
          <div key={i} className="bg-white/20 p-3 rounded-lg flex justify-between items-center">
            <div>
              <div className="font-bold">{medals[i]} {c.name}</div>
              <div className="text-xs opacity-80">{c.totalWords} mots</div>
            </div>
            <div className="text-lg font-black">{c.count}</div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default AnalysisMode;
