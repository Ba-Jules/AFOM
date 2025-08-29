import React, { useState, useEffect, useMemo } from 'react';
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
import { getAIAnalysis } from '../services/geminiService';
import * as geminiAny from '../services/geminiService';
import {
  BarChart, Bar, PieChart, Pie, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer, Cell,
} from 'recharts';
import { QUADRANT_INFO, PRIORITY_STYLES } from '../constants';
import { doc as fsDoc, getDoc, setDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface AnalysisModeProps { postIts: PostIt[]; }

type CentralProblem = {
  text: string;
  source: 'manual' | 'ai_full' | 'ai_fm';
  rationale?: string;
  updatedAt?: any;
};

const AnalysisMode: React.FC<AnalysisModeProps> = ({ postIts }) => {
  const [analysisData, setAnalysisData] = useState<AnalysisData | null>(null);
  const [loadingAI, setLoadingAI] = useState(false);

  // ---- Session / navigation ----
  const sessionId = useMemo(() => {
    const qs = new URLSearchParams(window.location.search);
    return qs.get('session') || localStorage.getItem('sessionId') || '';
  }, []);
  const goBack = () => {
    const { origin, pathname } = window.location;
    window.location.href = `${origin}${pathname}?v=work&session=${encodeURIComponent(sessionId)}`;
  };

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
              source: d.centralProblem.source || 'manual',
              rationale: d.centralProblem.rationale || '',
              updatedAt: d.centralProblem.updatedAt,
            });
          }
        }
      } catch (e) {
        console.error('Load centralProblem failed', e);
      }
    })();
  }, [sessionId]);

  const saveCentral = async (next: CentralProblem) => {
    setSavingCentral(true);
    try {
      await setDoc(
        fsDoc(db, 'confrontations', sessionId),
        { centralProblem: { ...next, updatedAt: new Date() } },
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

      const result = await fn(input, { mode });
      const next: CentralProblem = {
        text: (result?.problem || result?.text || '').slice(0, 400),
        rationale: result?.rationale || '',
        source: mode === 'full' ? 'ai_full' : 'ai_fm',
      };
      if (!next.text) { alert("L'IA n'a pas renvoyé de problème central exploitable."); return; }
      await saveCentral(next);
    } catch (e) {
      console.error(e);
      alert('Échec de la génération IA du problème central.');
    } finally {
      setAiRunningCentral(null);
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

  const toCSV = (d: AnalysisData) => {
    const esc = (v: any) => `"${String(v).replace(/"/g, '""')}"`;
    const lines: string[] = [];
    lines.push('Section,Sous-section,Clé,Valeur');
    lines.push(`Problème central,,Texte,${esc(central.text || '')}`);
    lines.push(`Problème central,,Source,${esc(central.source || '')}`);
    lines.push(`Métriques,,Contributions,${d.metrics.totalContributions}`);
    lines.push(`Métriques,,Participants,${d.metrics.uniqueParticipants}`);
    lines.push(`Métriques,,Durée (min),${d.metrics.sessionDuration}`);
    lines.push(`Métriques,,Engagement,${d.metrics.engagementScore}`);
    (Object.keys(d.quadrants) as QuadrantKey[]).forEach((k) => {
      const q = d.quadrants[k];
      lines.push(`Quadrants,${k},Count,${q.count}`);
      lines.push(`Quadrants,${k},WordCount,${q.wordCount}`);
    });
    d.timeline.forEach((t) => {
      lines.push(`Timeline,${t.time},acquis,${(t as any).acquis}`);
      lines.push(`Timeline,${t.time},faiblesses,${(t as any).faiblesses}`);
      lines.push(`Timeline,${t.time},opportunites,${(t as any).opportunites}`);
      lines.push(`Timeline,${t.time},menaces,${(t as any).menaces}`);
    });
    d.contributors.forEach((c) => {
      lines.push(`Contributeurs,${esc(c.name)},Count,${c.count}`);
      lines.push(`Contributeurs,${esc(c.name)},TotalWords,${c.totalWords}`);
    });
    d.insights.forEach((i, idx) => {
      lines.push(`Insights,${idx + 1},Titre,${esc(i.title)}`);
      lines.push(`Insights,${idx + 1},Contenu,${esc(i.content)}`);
    });
    d.recommendations.forEach((r, idx) => {
      lines.push(`Recommandations,${idx + 1},Titre,${esc(r.title)}`);
      lines.push(`Recommandations,${idx + 1},Contenu,${esc(r.content)}`);
      lines.push(`Recommandations,${idx + 1},Priorité,${esc(r.priority)}`);
    });
    return lines.join('\n');
  };

  const exportCSV = () => { if (analysisData) download(`analysis_${sessionId || 'session'}.csv`, 'text/csv;charset=utf-8', toCSV(analysisData)); };
  const exportJSON = () => { if (analysisData) download(`analysis_${sessionId || 'session'}.json`, 'application/json', JSON.stringify({ sessionId, centralProblem: central, analysis: analysisData }, null, 2)); };
  const exportPDF = () => window.print();

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
    const quadrantKeys: QuadrantKey[] = ['acquis', 'faiblesses', 'opportunites', 'menaces'];
    const quadrants: Record<QuadrantKey, QuadrantAnalysis> = {} as any;
    quadrantKeys.forEach((key) => {
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

  useEffect(() => {
    if (postIts.length > 0) {
      const basicData = processData(postIts);
      setAnalysisData({ ...basicData, insights: [], recommendations: [] });

      setLoadingAI(true);
      const timer = setTimeout(() => {
        getAIAnalysis(postIts).then((res) => {
          // 🛠 Normalisation stricte vers nos types locaux pour éviter le conflit de modules
          const insights: Insight[] = Array.isArray((res as any)?.insights)
            ? (res as any).insights.map((i: any) => ({
                title: String(i.title ?? ''),
                content: String(i.content ?? ''),
              })) as Insight[]
            : [];
          const recommendations: Recommendation[] = Array.isArray((res as any)?.recommendations)
            ? (res as any).recommendations.map((r: any) => ({
                title: String(r.title ?? ''),
                content: String(r.content ?? ''),
                // on garde la valeur si connue sinon "moyenne" par défaut
                priority: (r.priority as any) ?? 'moyenne',
              })) as Recommendation[]
            : [];

          setAnalysisData((prev) => {
            if (!prev) return prev; // null
            const updated: AnalysisData = { ...prev, insights, recommendations };
            return updated;
          });
          setLoadingAI(false);
        });
      }, 500);
      return () => clearTimeout(timer);
    } else {
      setAnalysisData(null);
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [postIts]);

  const doughnutData = useMemo(() => {
    if (!analysisData) return [];
    return Object.entries(analysisData.quadrants).map(([key, value]) => ({
      name: QUADRANT_INFO[key as QuadrantKey].title,
      value: (value as QuadrantAnalysis).count,
      color: QUADRANT_INFO[key as QuadrantKey].color,
    }));
  }, [analysisData]);

  if (!analysisData) {
    return (
      <div className="min-h-screen bg-gray-50">
        <PrintStyles />
        <header className="sticky top-0 z-30 bg-white/80 backdrop-blur border-b no-print">
          <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between">
            <button onClick={goBack} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">← Retour</button>
            <div className="text-sm font-semibold text-gray-600">Analyse</div>
            <div />
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
        <div className="max-w-7xl mx-auto px-4 py-2 flex items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <button onClick={goBack} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">← Retour</button>
            <div className="text-sm font-semibold text-gray-600">Analyse</div>
          </div>
          <div className="flex items-center gap-2">
            <button onClick={exportCSV} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">Exporter CSV</button>
            <button onClick={exportJSON} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">Exporter JSON</button>
            <button onClick={exportPDF} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">Exporter PDF</button>
          </div>
        </div>
      </header>

      <div className="p-4 sm:p-8 space-y-8 print:p-0">
        {/* ---- Problème central ---- */}
        <div className="bg-white p-6 rounded-xl shadow-lg border border-gray-200">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-lg font-black text-gray-800">🎯 Problème central</h3>
            <div className="text-xs text-gray-500">Source : <span className="font-bold">{central.source}</span></div>
          </div>
          <textarea
            value={central.text}
            onChange={(e) => setCentral({ ...central, text: e.target.value, source: 'manual' })}
            placeholder="Saisissez ou générez le problème central…"
            className="w-full min-h-[110px] rounded-lg border px-3 py-2 outline-none focus:ring-2 focus:ring-indigo-400"
          />
          {central.rationale ? (
            <div className="mt-2 text-xs text-gray-600"><span className="font-semibold">Justification IA :</span> {central.rationale}</div>
          ) : null}
          <div className="mt-3 flex flex-wrap gap-2">
            <button onClick={() => askAIForCentral('full')} disabled={!!aiRunningCentral} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">
              {aiRunningCentral === 'full' ? 'Génération…' : 'Proposer (IA – AFOM complet)'}
            </button>
            <button onClick={() => askAIForCentral('fm')} disabled={!!aiRunningCentral} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">
              {aiRunningCentral === 'fm' ? 'Génération…' : 'Proposer (IA – Faiblesses + Menaces)'}
            </button>
            <button onClick={() => saveCentral({ ...central, source: 'manual' })} disabled={savingCentral} className="px-3 py-1.5 rounded-md bg-indigo-600 text-white hover:bg-indigo-700">
              {savingCentral ? 'Enregistrement…' : 'Enregistrer'}
            </button>
            <button onClick={() => saveCentral({ text: '', source: 'manual' })} className="px-3 py-1.5 rounded-md border bg-white hover:bg-gray-50">Effacer</button>
          </div>
        </div>

        {/* ---- Métriques / Graphs ---- */}
        <MetricGrid metrics={analysisData.metrics} />

        <div className="grid lg:grid-cols-2 gap-8">
          <ChartCard title="Répartition AFOM">
            <ResponsiveContainer width="100%" height={300}>
              <PieChart>
                <Pie data={doughnutData} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={100} label>
                  {doughnutData.map((entry, index) => <Cell key={`cell-${index}`} fill={(entry as any).color} />)}
                </Pie>
                <Tooltip /><Legend />
              </PieChart>
            </ResponsiveContainer>
          </ChartCard>
          <ChartCard title="Timeline des Contributions">
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={analysisData.timeline}>
                <XAxis dataKey="time" /><YAxis /><Tooltip /><Legend />
                <Bar dataKey="acquis" stackId="a" fill={QUADRANT_INFO.acquis.color} />
                <Bar dataKey="faiblesses" stackId="a" fill={QUADRANT_INFO.faiblesses.color} />
                <Bar dataKey="opportunites" stackId="a" fill={QUADRANT_INFO.opportunites.color} />
                <Bar dataKey="menaces" stackId="a" fill={QUADRANT_INFO.menaces.color} />
              </BarChart>
            </ResponsiveContainer>
          </ChartCard>
        </div>

        <div className="grid lg:grid-cols-5 gap-8">
          <div className="lg:col-span-3"><InsightsList insights={analysisData.insights} loading={loadingAI} /></div>
          <div className="lg:col-span-2"><ContributorsList contributors={analysisData.contributors} /></div>
        </div>

        <RecommendationsList recommendations={analysisData.recommendations} loading={loadingAI} />
      </div>
    </div>
  );
};

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
