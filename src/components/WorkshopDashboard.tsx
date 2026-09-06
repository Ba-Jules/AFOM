import React, { useEffect, useMemo, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { createGroup, createWorkshop } from "../services/workshopService";
import { PostIt, Workshop, WorkshopGroup } from "../types";
import QRCodeModal from "./QRCodeModal";

interface Props {
  workshopId?: string;
  onOpenSession: (group: WorkshopGroup) => void;
  onConsolidate: (workshopId: string) => void;
  onBack: () => void;
}

const blank = { number: "", theme: "" };

function GroupCard({ group, workshopTitle, onOpen, onEdit, onArchive, onCount }: {
  group: WorkshopGroup;
  workshopTitle: string;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onCount: (count: number) => void;
}) {
  const [posts, setPosts] = useState<PostIt[]>([]);
  const [qr, setQr] = useState(false);
  useEffect(() => onSnapshot(
    query(collection(db, "postits"), where("sessionId", "==", group.sessionId)),
    snap => setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostIt))),
  ), [group.sessionId]);
  useEffect(() => onCount(posts.filter(p => p.status !== "bin").length), [posts, onCount]);
  const counts = useMemo(() => ({
    acquis: posts.filter(p => p.status !== "bin" && p.quadrant === "acquis").length,
    faiblesses: posts.filter(p => p.status !== "bin" && p.quadrant === "faiblesses").length,
    opportunites: posts.filter(p => p.status !== "bin" && p.quadrant === "opportunites").length,
    menaces: posts.filter(p => p.status !== "bin" && p.quadrant === "menaces").length,
  }), [posts]);
  return <article className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-xs font-bold uppercase text-indigo-600">{group.number}</div><h3 className="text-xl font-black text-gray-900">{group.name}</h3><p className="mt-1 text-gray-600">{group.theme}</p></div>
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">Actif</span>
    </div>
    <div className="mt-4 grid grid-cols-5 gap-1 text-center text-xs">
      <div className="rounded bg-gray-100 p-2"><b className="block text-lg">{posts.filter(p => p.status !== "bin").length}</b>Total</div>
      <div className="rounded bg-green-50 p-2"><b className="block text-lg">{counts.acquis}</b>Forces</div>
      <div className="rounded bg-red-50 p-2"><b className="block text-lg">{counts.faiblesses}</b>Faib.</div>
      <div className="rounded bg-emerald-50 p-2"><b className="block text-lg">{counts.opportunites}</b>Opp.</div>
      <div className="rounded bg-orange-50 p-2"><b className="block text-lg">{counts.menaces}</b>Men.</div>
    </div>
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={onOpen} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">Ouvrir</button>
      <button onClick={() => setQr(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold">Partager</button>
      <button onClick={onEdit} className="rounded-lg border px-3 py-2 text-sm font-semibold">Modifier</button>
      <button onClick={onArchive} className="ml-auto rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">Archiver</button>
    </div>
    <QRCodeModal isOpen={qr} onClose={() => setQr(false)} sessionId={group.sessionId} workshopId={group.workshopId} groupId={group.id} workshopTitle={workshopTitle} groupName={group.name} groupTheme={group.theme} />
  </article>;
}

export default function WorkshopDashboard({ workshopId, onOpenSession, onConsolidate, onBack }: Props) {
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [groups, setGroups] = useState<WorkshopGroup[]>([]);
  const [title, setTitle] = useState("Atelier du 7 septembre 2026");
  const [titleTouched, setTitleTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const [formErrors, setFormErrors] = useState<{ number?: string; theme?: string }>({});
  const [editing, setEditing] = useState<WorkshopGroup | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  const [groupCounts, setGroupCounts] = useState<Record<string, number>>({});

  useEffect(() => {
    if (!workshopId) return;
    const stopWorkshop = onSnapshot(doc(db, "workshops", workshopId), snap => setWorkshop(snap.exists() ? { id: snap.id, ...snap.data() } as Workshop : null));
    const stopGroups = onSnapshot(query(collection(db, "workshops", workshopId, "groups"), orderBy("order")), snap => setGroups(snap.docs.map(d => ({ id: d.id, workshopId, ...d.data() } as WorkshopGroup)).filter(g => g.active !== false)));
    return () => { stopWorkshop(); stopGroups(); };
  }, [workshopId]);

  if (!workshopId) return <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 flex items-center justify-center">
    <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl">
      <button onClick={onBack} className="mb-5 text-sm text-indigo-700">← Retour à AFOM</button>
      <h1 className="text-3xl font-black">Préparer votre atelier AFOM</h1>
      <p className="mt-2 text-gray-500">Donnez un titre à l'atelier et organisez les participants selon vos besoins.</p>
      <label className="mt-6 block text-sm font-bold">Nom de l’atelier</label>
      <input aria-label="Nom de l’atelier" value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setTitleTouched(true)} className="mt-2 w-full rounded-xl border px-4 py-3" />
      {titleTouched && !title.trim() && <p className="mt-1.5 text-sm text-red-600">Indiquez un nom pour continuer.</p>}
      <button
        disabled={!title.trim() || creating}
        onClick={async () => {
          setTitleTouched(true);
          if (!title.trim()) return;
          setCreating(true);
          try {
            const ref = await createWorkshop(title);
            window.location.href = `${window.location.pathname}?v=workshop&workshop=${ref.id}`;
          } catch (e) {
            console.error(e);
            alert("Impossible de créer l’atelier.");
            setCreating(false);
          }
        }}
        className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-40"
      >
        {creating ? "Création…" : "Créer l’atelier"}
      </button>
    </section>
  </main>;

  const total = groups.reduce((sum, group) => sum + (groupCounts[group.id] || 0), 0);
  const save = async () => {
    const errors: { number?: string; theme?: string } = {};
    if (!form.number.trim()) errors.number = "Indiquez un nom pour continuer.";
    if (!form.theme.trim()) errors.theme = "Indiquez une thématique pour continuer.";
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "workshops", workshopId, "groups", editing.id), { number: form.number.trim(), name: form.number.trim(), theme: form.theme.trim(), updatedAt: serverTimestamp() });
        await updateDoc(doc(db, "boards", editing.sessionId), { projectName: form.number.trim(), themeName: form.theme.trim(), updatedAt: serverTimestamp() });
      } else {
        await createGroup(workshopId, { number: form.number, name: form.number, theme: form.theme, order: groups.length + 1 });
      }
      setForm(blank); setFormErrors({}); setEditing(null); setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen bg-gray-50">
    <header className="border-b bg-gradient-to-r from-indigo-700 to-purple-700 text-white"><div className="mx-auto max-w-7xl px-4 py-6">
      <button onClick={onBack} className="text-sm text-indigo-100">← Accueil AFOM</button>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><div className="text-sm font-bold uppercase text-indigo-200">Tableau de bord atelier</div><h1 className="text-3xl font-black">{workshop?.title || "Chargement…"}</h1></div>
      <div className="flex gap-2"><button onClick={() => onConsolidate(workshopId)} className="rounded-xl bg-white px-4 py-2 font-bold text-indigo-700">Consolider les productions</button><button onClick={() => { setEditing(null); setForm({ number: `Groupe ${groups.length + 1}`, theme: "" }); setFormErrors({}); setShowForm(true); }} className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-emerald-950">+ Ajouter un groupe</button></div></div>
    </div></header>
    <section className="mx-auto max-w-7xl p-4">
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md"><div className="rounded-xl bg-white p-4 shadow-sm"><b className="text-3xl">{groups.length}</b><span className="ml-2 text-gray-500">groupes</span></div><div className="rounded-xl bg-white p-4 shadow-sm"><b className="text-3xl">{total || "—"}</b><span className="ml-2 text-gray-500">contributions</span></div></div>
      {showForm && <div className="mb-6 rounded-2xl border bg-white p-5 shadow">
        <h2 className="text-lg font-black">{editing ? "Modifier le groupe" : "Nouveau groupe"}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Nom du groupe</label>
            <input aria-label="Numéro ou nom du groupe" placeholder="Groupe 1" value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="w-full rounded-lg border px-3 py-2"/>
            {formErrors.number && <p className="mt-1 text-xs text-red-600">{formErrors.number}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">Thématique</label>
            <input aria-label="Thématique du groupe" placeholder="Thématique" value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} className="w-full rounded-lg border px-3 py-2"/>
            {formErrors.theme && <p className="mt-1 text-xs text-red-600">{formErrors.theme}</p>}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? "Enregistrement…" : "Enregistrer"}</button>
          <button onClick={() => { setShowForm(false); setFormErrors({}); }} className="rounded-lg border px-4 py-2">Annuler</button>
        </div>
      </div>}
      <div className="grid gap-4 lg:grid-cols-2">{groups.map(group => <GroupCard key={group.id} group={group} workshopTitle={workshop?.title || ""} onOpen={() => onOpenSession(group)} onEdit={() => { setEditing(group); setForm({ number: group.name || group.number, theme: group.theme }); setFormErrors({}); setShowForm(true); }} onArchive={async () => { if (confirm(`Archiver ${group.name} ? Les contributions seront conservées.`)) await updateDoc(doc(db, "workshops", workshopId, "groups", group.id), { active: false, updatedAt: serverTimestamp() }); }} onCount={(count) => setGroupCounts(current => current[group.id] === count ? current : { ...current, [group.id]: count })} />)}</div>
    </section>
  </main>;
}
