import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { AppUser, PostIt, QuadrantKey, Workshop, WorkshopGroup } from "../types";
import UserBadge from "./UserBadge";

interface OriginPost extends PostIt { groupId: string; groupName: string; groupTheme: string; }
const labels: Record<QuadrantKey, string> = { acquis: "Forces", faiblesses: "Faiblesses", opportunites: "Opportunités", menaces: "Menaces" };
const colors: Record<QuadrantKey, string> = { acquis: "border-green-300 bg-green-50", faiblesses: "border-red-300 bg-red-50", opportunites: "border-emerald-300 bg-emerald-50", menaces: "border-orange-300 bg-orange-50" };

export default function ConsolidatedAFOM({ workshopId, onBack, user }: { workshopId: string; onBack: () => void; user: AppUser }) {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [groups, setGroups] = useState<WorkshopGroup[]>([]);
  const [postsByGroup, setPostsByGroup] = useState<Record<string, PostIt[]>>({});
  const [groupFilter, setGroupFilter] = useState("all");
  const [quadrantFilter, setQuadrantFilter] = useState<"all" | QuadrantKey>("all");
  const [search, setSearch] = useState("");

  useEffect(() => onSnapshot(doc(db, "workshops", workshopId), snap => setWorkshop(snap.exists() ? { id: snap.id, ...snap.data() } as Workshop : null)), [workshopId]);
  useEffect(() => onSnapshot(query(collection(db, "workshops", workshopId, "groups"), orderBy("order")), snap => setGroups(snap.docs.map(d => ({ id: d.id, workshopId, ...d.data() } as WorkshopGroup)).filter(g => g.active !== false))), [workshopId]);
  useEffect(() => {
    const stops = groups.map(group => onSnapshot(query(collection(db, "postits"), where("sessionId", "==", group.sessionId)), snap => setPostsByGroup(current => ({ ...current, [group.id]: snap.docs.map(d => ({ id: d.id, ...d.data() } as PostIt)) }))));
    return () => stops.forEach(stop => stop());
  }, [groups.map(g => `${g.id}:${g.sessionId}`).join("|")]);

  const posts = useMemo(() => groups.flatMap(group => (postsByGroup[group.id] || []).filter(post => post.status !== "bin").map(post => ({ ...post, groupId: group.id, groupName: group.name || group.number, groupTheme: group.theme }))), [groups, postsByGroup]);
  const visible = posts.filter(post => (groupFilter === "all" || post.groupId === groupFilter) && (quadrantFilter === "all" || post.quadrant === quadrantFilter) && (!search.trim() || `${post.content} ${post.author}`.toLowerCase().includes(search.toLowerCase())));
  const quadrants: QuadrantKey[] = quadrantFilter === "all" ? ["acquis", "faiblesses", "opportunites", "menaces"] : [quadrantFilter];

  return <main className="min-h-screen bg-slate-50 print:bg-white">
    <header className="border-b bg-white print:border-0"><div className="mx-auto max-w-7xl px-4 py-5"><div className="flex items-center justify-between gap-2 print:hidden"><button onClick={onBack} className="text-sm font-semibold text-indigo-700">← Tableau de bord</button><UserBadge user={user} className="text-gray-500" /></div><div className="mt-2 flex items-end justify-between gap-3"><div><div className="text-xs font-bold uppercase text-indigo-600">Consolidation AFOM</div><h1 className="text-3xl font-black">{workshop?.title || "Atelier"}</h1><p className="text-gray-500">{visible.length} contribution(s), origine conservée</p></div><button onClick={() => window.print()} className="rounded-lg border px-4 py-2 font-semibold print:hidden">Mode projection / imprimer</button></div></div></header>
    <section className="mx-auto max-w-7xl p-4">
      <div className="mb-5 grid gap-3 rounded-xl border bg-white p-4 sm:grid-cols-3 print:hidden"><label className="text-sm font-bold">Groupe<select aria-label="Filtrer par groupe" value={groupFilter} onChange={e => setGroupFilter(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 font-normal"><option value="all">Tous les groupes</option>{groups.map(group => <option key={group.id} value={group.id}>{group.name || group.number}</option>)}</select></label><label className="text-sm font-bold">Quadrant<select aria-label="Filtrer par quadrant" value={quadrantFilter} onChange={e => setQuadrantFilter(e.target.value as any)} className="mt-1 block w-full rounded-lg border p-2 font-normal"><option value="all">Tous les quadrants</option>{Object.entries(labels).map(([key, label]) => <option key={key} value={key}>{label}</option>)}</select></label><label className="text-sm font-bold">Recherche<input aria-label="Rechercher" value={search} onChange={e => setSearch(e.target.value)} className="mt-1 block w-full rounded-lg border p-2 font-normal" placeholder="Texte ou auteur" /></label></div>
      <div className="grid gap-5 lg:grid-cols-2">{quadrants.map(quadrant => <section key={quadrant} className={`rounded-2xl border-2 p-4 ${colors[quadrant]}`}><h2 className="mb-3 text-xl font-black uppercase">{labels[quadrant]} <span className="text-sm font-normal">({visible.filter(p => p.quadrant === quadrant).length})</span></h2><div className="space-y-3">{visible.filter(p => p.quadrant === quadrant).map(post => <article key={post.id} className="rounded-xl bg-white p-4 shadow-sm"><p className="font-semibold text-gray-900">{post.content}</p><p className="mt-2 text-xs font-bold text-indigo-700">{post.groupName} — {post.groupTheme}</p>{post.author && <p className="text-xs text-gray-500">par {post.author}</p>}</article>)}{!visible.some(p => p.quadrant === quadrant) && <p className="text-sm text-gray-500">Aucune contribution.</p>}</div></section>)}</div>
    </section>
  </main>;
}
