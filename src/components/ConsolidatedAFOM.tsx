import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { AppUser, PostIt, QuadrantKey, Workshop, WorkshopGroup } from "../types";
import UserBadge from "./UserBadge";
import { PreferenceControls, quadrantTitle, usePreferences } from "../i18n";

interface OriginPost extends PostIt { groupId: string; groupName: string; groupTheme: string; }
const colors: Record<QuadrantKey, string> = { acquis: "border-green-300 bg-green-50", faiblesses: "border-red-300 bg-red-50", opportunites: "border-blue-300 bg-blue-50", menaces: "border-orange-300 bg-orange-50" };

export default function ConsolidatedAFOM({ workshopId, onBack, user }: { workshopId: string; onBack: () => void; user: AppUser }) {
  const { t, lang } = usePreferences();
  const labels: Record<QuadrantKey, string> = { acquis: quadrantTitle(lang, "acquis"), faiblesses: quadrantTitle(lang, "faiblesses"), opportunites: quadrantTitle(lang, "opportunites"), menaces: quadrantTitle(lang, "menaces") };
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [groups, setGroups] = useState<WorkshopGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, PostIt[]>>({});
  const [groupFilter, setGroupFilter] = useState("all");
  const [quadrantFilter, setQuadrantFilter] = useState<"all" | QuadrantKey>("all");
  const [search, setSearch] = useState("");
  const [showIdentity, setShowIdentity] = useState(true);

  useEffect(() => onSnapshot(doc(db, "workshops", workshopId), snap => setWorkshop(snap.exists() ? { id: snap.id, ...snap.data() } as Workshop : null)), [workshopId]);
  useEffect(() => onSnapshot(query(collection(db, "workshops", workshopId, "groups"), orderBy("order")), snap => setGroups(snap.docs.map(d => ({ id: d.id, workshopId, ...d.data() } as WorkshopGroup)).filter(g => g.active !== false && !g.deletedAt))), [workshopId]);
  useEffect(() => {
    const stops = groups.map(group => onSnapshot(query(collection(db, "postits"), where("sessionId", "==", group.sessionId)), snap => setPostsByGroup(current => ({ ...current, [group.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as PostIt)) }))));
    return () => stops.forEach(stop => stop());
  }, [groups.map(g => `${g.id}:${g.sessionId}`).join("|")]);

  const posts = useMemo(() => groups.flatMap(group => (postsByGroup[group.id] || []).filter(post => post.status !== "bin").map(post => ({ ...post, groupId: group.id, groupName: group.name || group.number, groupTheme: group.theme }))), [groups, postsByGroup]);
  const visible = posts.filter(post => (groupFilter === "all" || post.groupId === groupFilter) && (quadrantFilter === "all" || post.quadrant === quadrantFilter) && (!search.trim() || `${post.content} ${post.author}`.toLowerCase().includes(search.toLowerCase())));
  const quadrants: QuadrantKey[] = quadrantFilter === "all" ? ["acquis", "faiblesses", "opportunites", "menaces"] : [quadrantFilter];

  return <main className="min-h-screen bg-slate-50 print:bg-white">
    <header className="border-b bg-white print:border-0"><div className="mx-auto max-w-7xl px-4 py-5"><div className="flex items-center justify-between gap-2 print:hidden"><button onClick={onBack} className="text-sm font-semibold text-indigo-700">{t("consolidated.backToDashboard")}</button><div className="flex items-center gap-3"><PreferenceControls /><UserBadge user={user} className="text-gray-500" /></div></div><div className="mt-2 flex items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase text-indigo-600">{t("consolidated.eyebrow")}</div><h1 className="text-3xl font-black">{workshop?.title || t("consolidated.defaultTitle")}</h1><p className="text-gray-500">{t("consolidated.contributionsOrigin", { n: visible.length })}</p></div><button onClick={() => window.print()} className="rounded-lg border px-4 py-2 font-semibold print:hidden">{t("consolidated.printMode")}</button></div></div></header>
    <section className="mx-auto max-w-7xl p-4">
      <div className="mb-5 rounded-xl border bg-white p-4 print:hidden">
        <div className="grid gap-3 sm:grid-cols-3"><label className="text-sm font-bold">{t("consolidated.groupLabel")}<select aria-label={t("consolidated.groupLabel")} value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 font-normal"><option value="all">{t("consolidated.allGroups")}</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name || group.number}</option>)}</select></label><label className="text-sm font-bold">{t("consolidated.quadrantLabel")}<select aria-label={t("consolidated.quadrantLabel")} value={quadrantFilter} onChange={e => setQuadrantFilter(e.target.value as any)} className="mt-1 block w-full rounded-lg border p-2 font-normal"><option value="all">{t("consolidated.allQuadrants")}</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm font-bold">{t("consolidated.searchLabel")}<input aria-label={t("consolidated.searchLabel")} value={search} onChange={e => setSearch(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 font-normal" placeholder={t("consolidated.searchPlaceholder")} /></label></div>
        <label className="mt-3 flex items-center gap-2 text-sm font-bold"><input type="checkbox" checked={showIdentity} onChange={e => setShowIdentity(e.target.checked)} className="h-4 w-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500" />{t("consolidated.showIdentity")}</label>
      </div>
      <div className="grid gap-5 lg:grid-cols-2">{quadrants.map(quadrant => <section key={quadrant} className={`rounded-2xl border-2 p-4 ${colors[quadrant]}`}><h2 className="mb-3 text-xl font-black uppercase">{labels[quadrant]} <span className="text-sm font-normal">({visible.filter(p => p.quadrant === quadrant).length})</span></h2><div className="space-y-3">{visible.filter(p => p.quadrant === quadrant).map(post => <article key={post.id} className="rounded-xl bg-white p-4 shadow-sm"><p className="font-semibold text-gray-900">{post.content}</p>{showIdentity && <p className="mt-2 text-xs font-bold text-indigo-700">{post.groupName} — {post.groupTheme}</p>}{showIdentity && post.author && <p className="text-xs text-gray-500">{t("consolidated.byAuthor", { author: post.author })}</p>}</article>)}{!visible.some(p => p.quadrant === quadrant) && <p className="text-sm text-gray-500">{t("consolidated.noContribution")}</p>}</div></section>)}</div>
    </section>
  </main>;
}
