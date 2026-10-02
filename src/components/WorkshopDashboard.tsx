import React, { useEffect, useMemo, useRef, useState } from "react";
import { collection, doc, onSnapshot, orderBy, query, serverTimestamp, updateDoc, where } from "firebase/firestore";
import { db } from "../services/firebase";
import { createGroup, createWorkshop, deleteGroup, deleteWorkshopCascade, restoreGroup, restoreWorkshop, TRASH_RETENTION_DAYS, trashGroup, trashWorkshop } from "../services/workshopService";
import { AppUser, PostIt, Workshop, WorkshopGroup } from "../types";
import QRCodeModal from "./QRCodeModal";
import UserBadge from "./UserBadge";
import { usePreferences } from "../i18n";

interface Props {
  workshopId?: string;
  onOpenSession: (group: WorkshopGroup) => void;
  onSelectWorkshop: (workshopId: string) => void;
  onConsolidate: (workshopId: string) => void;
  onBack: () => void;
  user: AppUser;
}

function formatWorkshopDate(value: any): string {
  const date = value?.toDate ? value.toDate() : null;
  if (!date) return "";
  return date.toLocaleDateString("fr-FR", { day: "numeric", month: "long", year: "numeric" });
}

function daysRemaining(deletedAt: any): number | null {
  const date = deletedAt?.toDate ? deletedAt.toDate() : null;
  if (!date) return null;
  const elapsedDays = (Date.now() - date.getTime()) / (1000 * 60 * 60 * 24);
  return Math.max(0, Math.ceil(TRASH_RETENTION_DAYS - elapsedDays));
}

const blank = { number: "", theme: "" };

function GroupCard({ group, workshopTitle, onOpen, onEdit, onArchive, onDelete, onCount }: {
  group: WorkshopGroup;
  workshopTitle: string;
  onOpen: () => void;
  onEdit: () => void;
  onArchive: () => void;
  onDelete: () => void;
  onCount: (count: number | null) => void;
}) {
  const { t } = usePreferences();
  const [posts, setPosts] = useState<PostIt[]>([]);
  // Tant que Firestore n'a pas répondu, on affiche « … » et non 0 : un groupe en cours de
  // chargement ne doit pas ressembler à un groupe vide.
  const [loaded, setLoaded] = useState(false);
  const [loadError, setLoadError] = useState(false);
  const [qr, setQr] = useState(false);
  useEffect(() => {
    setLoaded(false); setLoadError(false);
    return onSnapshot(
      query(collection(db, "postits"), where("sessionId", "==", group.sessionId)),
      snap => { setPosts(snap.docs.map(d => ({ id: d.id, ...d.data() } as PostIt))); setLoaded(true); setLoadError(false); },
      error => { console.error("Unable to load group contributions", error); setLoadError(true); },
    );
  }, [group.sessionId]);
  useEffect(() => {
    if (loadError) onCount(null);
    else if (loaded) onCount(posts.filter(p => p.status !== "bin").length);
  }, [posts, loaded, loadError, onCount]);
  const show = (n: number) => loadError ? "!" : loaded ? n : "…";
  const counts = useMemo(() => ({
    acquis: posts.filter(p => p.status !== "bin" && p.quadrant === "acquis").length,
    faiblesses: posts.filter(p => p.status !== "bin" && p.quadrant === "faiblesses").length,
    opportunites: posts.filter(p => p.status !== "bin" && p.quadrant === "opportunites").length,
    menaces: posts.filter(p => p.status !== "bin" && p.quadrant === "menaces").length,
  }), [posts]);
  return <article className="rounded-2xl border bg-white p-5 shadow-sm">
    <div className="flex items-start justify-between gap-3">
      <div><div className="text-xs font-bold uppercase text-indigo-600">{group.number}</div><h3 className="text-xl font-black text-gray-900">{group.name}</h3><p className="mt-1 text-gray-600">{group.theme}</p></div>
      <span className="rounded-full bg-emerald-50 px-2 py-1 text-xs font-bold text-emerald-700">{t("workshopDashboard.active")}</span>
    </div>
    <div className="mt-4 grid grid-cols-5 gap-1 text-center text-xs">
      <div className="rounded bg-gray-100 p-2"><b className="block text-lg">{show(posts.filter(p => p.status !== "bin").length)}</b>{t("workshopDashboard.total")}</div>
      <div className="rounded bg-green-50 p-2"><b className="block text-lg">{show(counts.acquis)}</b>{t("workshopDashboard.forces")}</div>
      <div className="rounded bg-red-50 p-2"><b className="block text-lg">{show(counts.faiblesses)}</b>{t("workshopDashboard.weak")}</div>
      <div className="rounded bg-blue-50 p-2"><b className="block text-lg">{show(counts.opportunites)}</b>{t("workshopDashboard.opp")}</div>
      <div className="rounded bg-orange-50 p-2"><b className="block text-lg">{show(counts.menaces)}</b>{t("workshopDashboard.threats")}</div>
    </div>
    {loadError && <p className="mt-2 text-xs font-semibold text-red-600">{t("workshopDashboard.countLoadError")}</p>}
    <div className="mt-4 flex flex-wrap gap-2">
      <button onClick={onOpen} className="rounded-lg bg-indigo-600 px-3 py-2 text-sm font-bold text-white">{t("workshopDashboard.openBtn")}</button>
      <button onClick={() => setQr(true)} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("workshopDashboard.share")}</button>
      <button onClick={onEdit} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("workshopDashboard.edit")}</button>
      <button onClick={onArchive} className="ml-auto rounded-lg border border-red-200 px-3 py-2 text-sm text-red-600">{t("workshopDashboard.archive")}</button>
      <button onClick={onDelete} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("workshopDashboard.trash")}</button>
    </div>
    <QRCodeModal isOpen={qr} onClose={() => setQr(false)} sessionId={group.sessionId} workshopId={group.workshopId} groupId={group.id} workshopTitle={workshopTitle} groupName={group.name} groupTheme={group.theme} />
  </article>;
}

function TrashPanel({ groups, onRestore, onPurge, onClose }: {
  groups: WorkshopGroup[];
  onRestore: (group: WorkshopGroup) => void;
  onPurge: (group: WorkshopGroup) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  return <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/50 p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-gray-900">{t("workshopDashboard.trashTitle")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("workshopDashboard.trashBody", { days: TRASH_RETENTION_DAYS })}</p>
      </div>
      <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("common.close")}</button>
    </div>
    {groups.length === 0
      ? <p className="mt-4 text-sm text-gray-500">{t("workshopDashboard.trashEmpty")}</p>
      : <div className="mt-4 space-y-2">{groups.map(group => {
        const remaining = daysRemaining(group.deletedAt);
        return <div key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400">{group.number}</div>
            <div className="font-bold text-gray-900">{group.name}</div>
            <div className="text-sm text-gray-500">{group.theme}</div>
            <div className="mt-1 text-xs text-red-600">{remaining === null ? t("workshopDashboard.purgeImminent") : remaining <= 0 ? t("workshopDashboard.purgeSoon") : t("workshopDashboard.purgeIn", { n: remaining })}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onRestore(group)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">{t("common.restore")}</button>
            <button onClick={() => onPurge(group)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("workshopDashboard.deleteForever")}</button>
          </div>
        </div>;
      })}</div>}
  </div>;
}

// Archiver ≠ Corbeille : un groupe archivé est volontairement mis de côté des
// productions actives, conservé indéfiniment, retrouvable et restaurable — il n'est
// PAS destiné à être supprimé (contrairement à la corbeille, avec sa purge automatique).
function ArchivePanel({ groups, onRestore, onTrash, onClose }: {
  groups: WorkshopGroup[];
  onRestore: (group: WorkshopGroup) => void;
  onTrash: (group: WorkshopGroup) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  return <div className="mb-6 rounded-2xl border border-slate-300 bg-slate-50 p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-gray-900">{t("workshopDashboard.archiveTitle")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("workshopDashboard.archiveBody")}</p>
      </div>
      <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("common.close")}</button>
    </div>
    {groups.length === 0
      ? <p className="mt-4 text-sm text-gray-500">{t("workshopDashboard.archiveEmpty")}</p>
      : <div className="mt-4 space-y-2">{groups.map(group => <div key={group.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div>
            <div className="text-xs font-bold uppercase text-gray-400">{group.number}</div>
            <div className="font-bold text-gray-900">{group.name}</div>
            <div className="text-sm text-gray-500">{group.theme}</div>
            <span className="mt-1 inline-block rounded-full bg-slate-200 px-2 py-0.5 text-xs font-bold text-slate-700">{t("workshopDashboard.archivedBadge")}</span>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onRestore(group)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">{t("common.restore")}</button>
            <button onClick={() => onTrash(group)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("workshopDashboard.sendToTrash")}</button>
          </div>
        </div>)}</div>}
  </div>;
}

function WorkshopTrashPanel({ workshops, onRestore, onPurge, onClose }: {
  workshops: Workshop[];
  onRestore: (workshop: Workshop) => void;
  onPurge: (workshop: Workshop) => void;
  onClose: () => void;
}) {
  const { t } = usePreferences();
  return <div className="mb-6 rounded-2xl border border-red-200 bg-red-50/50 p-5">
    <div className="flex items-center justify-between gap-3">
      <div>
        <h2 className="text-lg font-black text-gray-900">{t("workshopDashboard.workshopTrashTitle")}</h2>
        <p className="mt-1 text-sm text-gray-600">{t("workshopDashboard.workshopTrashBody", { days: TRASH_RETENTION_DAYS })}</p>
      </div>
      <button onClick={onClose} className="rounded-lg border px-3 py-2 text-sm font-semibold">{t("common.close")}</button>
    </div>
    {workshops.length === 0
      ? <p className="mt-4 text-sm text-gray-500">{t("workshopDashboard.workshopTrashEmpty")}</p>
      : <div className="mt-4 space-y-2">{workshops.map(w => {
        const remaining = daysRemaining(w.deletedAt);
        return <div key={w.id} className="flex flex-wrap items-center justify-between gap-3 rounded-xl border bg-white p-4">
          <div>
            <div className="font-bold text-gray-900">{w.title}</div>
            <div className="mt-1 text-xs text-red-600">{remaining === null ? t("workshopDashboard.purgeImminent") : remaining <= 0 ? t("workshopDashboard.purgeSoon") : t("workshopDashboard.purgeIn", { n: remaining })}</div>
          </div>
          <div className="flex gap-2">
            <button onClick={() => onRestore(w)} className="rounded-lg bg-emerald-600 px-3 py-2 text-sm font-bold text-white">{t("common.restore")}</button>
            <button onClick={() => onPurge(w)} className="rounded-lg border border-red-300 bg-red-50 px-3 py-2 text-sm font-semibold text-red-700">{t("workshopDashboard.deleteForever")}</button>
          </div>
        </div>;
      })}</div>}
  </div>;
}

export default function WorkshopDashboard({ workshopId, onOpenSession, onSelectWorkshop, onConsolidate, onBack, user }: Props) {
  const { t } = usePreferences();
  const [workshop, setWorkshop] = useState<Workshop | null>(null);
  const [groups, setGroups] = useState<WorkshopGroup[]>([]);
  const [existingWorkshops, setExistingWorkshops] = useState<Workshop[]>([]);
  const [title, setTitle] = useState("Atelier du 7 septembre 2026");
  const [titleTouched, setTitleTouched] = useState(false);
  const [creating, setCreating] = useState(false);
  const [form, setForm] = useState(blank);
  const [formErrors, setFormErrors] = useState<{ number?: string; theme?: string }>({});
  const [editing, setEditing] = useState<WorkshopGroup | null>(null);
  const [showForm, setShowForm] = useState(false);
  const [saving, setSaving] = useState(false);
  // null = erreur de chargement ; clé absente = pas encore chargé
  const [groupCounts, setGroupCounts] = useState<Record<string, number | null>>({});
  const [showTrash, setShowTrash] = useState(false);
  const [showArchive, setShowArchive] = useState(false);
  const [showWorkshopTrash, setShowWorkshopTrash] = useState(false);
  const formRef = useRef<HTMLDivElement | null>(null);
  const purgingRef = useRef<Set<string>>(new Set());
  const purgingWorkshopRef = useRef<Set<string>>(new Set());

  useEffect(() => {
    if (showForm) formRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
  }, [showForm]);

  useEffect(() => {
    if (!workshopId) return;
    const stopWorkshop = onSnapshot(doc(db, "workshops", workshopId), snap => setWorkshop(snap.exists() ? { id: snap.id, ...snap.data() } as Workshop : null));
    const stopGroups = onSnapshot(query(collection(db, "workshops", workshopId, "groups"), orderBy("order")), snap => setGroups(snap.docs.map(d => ({ id: d.id, workshopId, ...d.data() } as WorkshopGroup))));
    return () => { stopWorkshop(); stopGroups(); };
  }, [workshopId]);

  const activeGroups = useMemo(() => groups.filter(g => g.active !== false && !g.deletedAt), [groups]);
  const archivedGroups = useMemo(() => groups.filter(g => g.active === false && !g.deletedAt), [groups]);
  const trashedGroups = useMemo(() => groups.filter(g => g.deletedAt), [groups]);

  // Purge automatique (comme une corbeille d'ordinateur) : au-delà du délai de
  // rétention, la suppression définitive se déclenche au prochain chargement du
  // tableau de bord — il n'y a pas de tâche planifiée côté serveur sur ce projet.
  useEffect(() => {
    trashedGroups.forEach(group => {
      const remaining = daysRemaining(group.deletedAt);
      if (remaining !== null && remaining <= 0 && !purgingRef.current.has(group.id)) {
        purgingRef.current.add(group.id);
        deleteGroup(workshopId!, group.id, group.sessionId).catch(e => console.error("Purge auto échouée", e));
      }
    });
  }, [trashedGroups, workshopId]);

  useEffect(() => {
    if (workshopId) return;
    return onSnapshot(query(collection(db, "workshops"), orderBy("updatedAt", "desc")), snap => setExistingWorkshops(snap.docs.map(d => ({ id: d.id, ...d.data() } as Workshop))));
  }, [workshopId]);

  const activeWorkshops = useMemo(() => existingWorkshops.filter(w => !w.deletedAt), [existingWorkshops]);
  const trashedWorkshops = useMemo(() => existingWorkshops.filter(w => w.deletedAt), [existingWorkshops]);

  useEffect(() => {
    trashedWorkshops.forEach(w => {
      const remaining = daysRemaining(w.deletedAt);
      if (remaining !== null && remaining <= 0 && !purgingWorkshopRef.current.has(w.id)) {
        purgingWorkshopRef.current.add(w.id);
        deleteWorkshopCascade(w.id).catch(e => console.error("Purge auto atelier échouée", e));
      }
    });
  }, [trashedWorkshops]);

  if (!workshopId) return <main className="min-h-screen bg-gradient-to-br from-indigo-50 to-purple-100 p-4 flex items-center justify-center">
    <section className="w-full max-w-xl rounded-2xl bg-white p-8 shadow-xl">
      <div className="mb-5 flex items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm text-indigo-700">{t("workshopDashboard.backToAfom")}</button>
        <div className="flex items-center gap-3">
          <button onClick={() => setShowWorkshopTrash(v => !v)} className="text-sm font-semibold text-red-600">{t("workshopDashboard.workshopTrashLink", { n: trashedWorkshops.length })}</button>
          <UserBadge user={user} className="text-gray-500" />
        </div>
      </div>
      {showWorkshopTrash && <WorkshopTrashPanel
        workshops={trashedWorkshops}
        onClose={() => setShowWorkshopTrash(false)}
        onRestore={async (w) => { await restoreWorkshop(w.id); }}
        onPurge={async (w) => { if (confirm(t("workshopDashboard.confirmPurgeWorkshop", { title: w.title }))) await deleteWorkshopCascade(w.id); }}
      />}
      {activeWorkshops.length > 0 && <div className="mb-6">
        <h1 className="text-2xl font-black text-gray-900">{t("workshopDashboard.resumeTitle")}</h1>
        <p className="mt-1 text-sm text-gray-500">{t("workshopDashboard.resumeBody")}</p>
        <div className="mt-3 space-y-2">
          {activeWorkshops.map(w => <div key={w.id} className="flex w-full items-center justify-between gap-2 rounded-xl border px-4 py-3 hover:border-indigo-400 hover:bg-indigo-50">
            <button onClick={() => onSelectWorkshop(w.id)} className="flex-1 text-left">
              <span className="block font-bold text-gray-900">{w.title}</span>{formatWorkshopDate(w.updatedAt) && <span className="block text-xs text-gray-500">{t("workshopDashboard.modifiedOn", { date: formatWorkshopDate(w.updatedAt) })}</span>}
            </button>
            <button onClick={() => onSelectWorkshop(w.id)} className="text-sm font-semibold text-indigo-600 flex-shrink-0">{t("workshopDashboard.openArrow")}</button>
            <button
              onClick={(e) => { e.stopPropagation(); if (confirm(t("workshopDashboard.confirmTrashWorkshop", { title: w.title, days: TRASH_RETENTION_DAYS }))) trashWorkshop(w.id); }}
              className="flex-shrink-0 rounded-lg border border-red-200 px-2 py-1.5 text-xs font-semibold text-red-600 hover:bg-red-50"
              title={t("workshopDashboard.sendToTrash")}
            >
              {t("common.delete")}
            </button>
          </div>)}
        </div>
        <div className="mt-6 border-t pt-6" />
      </div>}
      <h2 className={activeWorkshops.length > 0 ? "text-xl font-black" : "text-3xl font-black"}>{activeWorkshops.length > 0 ? t("workshopDashboard.createNewWorkshop") : t("workshopDashboard.prepareWorkshop")}</h2>
      <p className="mt-2 text-gray-500">{t("workshopDashboard.prepareBody")}</p>
      <label className="mt-6 block text-sm font-bold">{t("workshopDashboard.workshopNameLabel")}</label>
      <input aria-label={t("workshopDashboard.workshopNameLabel")} value={title} onChange={e => setTitle(e.target.value)} onBlur={() => setTitleTouched(true)} className="mt-2 w-full rounded-xl border px-4 py-3" />
      {titleTouched && !title.trim() && <p className="mt-1.5 text-sm text-red-600">{t("workshopDashboard.nameRequired")}</p>}
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
            alert(t("workshopDashboard.createWorkshopFailed"));
            setCreating(false);
          }
        }}
        className="mt-5 w-full rounded-xl bg-indigo-600 px-4 py-3 font-bold text-white disabled:opacity-40"
      >
        {creating ? t("workshopDashboard.creating") : t("workshopDashboard.createWorkshopCta")}
      </button>
    </section>
  </main>;

  const total = activeGroups.reduce((sum, group) => sum + (groupCounts[group.id] || 0), 0);
  const countsPending = activeGroups.some(group => !(group.id in groupCounts));
  const countsFailed = activeGroups.some(group => groupCounts[group.id] === null);
  const totalLabel = countsPending ? "…" : countsFailed ? "!" : (total || "—");
  const save = async () => {
    const errors: { number?: string; theme?: string } = {};
    if (!form.number.trim()) errors.number = t("workshopDashboard.numberRequired");
    if (!form.theme.trim()) errors.theme = t("workshopDashboard.themeRequired");
    setFormErrors(errors);
    if (Object.keys(errors).length > 0 || saving) return;
    setSaving(true);
    try {
      if (editing) {
        await updateDoc(doc(db, "workshops", workshopId, "groups", editing.id), { number: form.number.trim(), name: form.number.trim(), theme: form.theme.trim(), updatedAt: serverTimestamp() });
        await updateDoc(doc(db, "boards", editing.sessionId), { projectName: form.number.trim(), themeName: form.theme.trim(), updatedAt: serverTimestamp() });
      } else {
        await createGroup(workshopId, { number: form.number, name: form.number, theme: form.theme, order: activeGroups.length + 1 });
      }
      setForm(blank); setFormErrors({}); setEditing(null); setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  return <main className="min-h-screen bg-gray-50">
    <header className="border-b bg-gradient-to-r from-indigo-700 to-purple-700 text-white"><div className="mx-auto max-w-7xl px-4 py-6">
      <div className="flex items-center justify-between gap-2">
        <button onClick={onBack} className="text-sm text-indigo-100">{t("workshopDashboard.backToAfom")}</button>
        <div className="flex items-center gap-3"><UserBadge user={user} className="text-indigo-100" /></div>
      </div>
      <div className="mt-3 flex flex-wrap items-end justify-between gap-3"><div><div className="text-sm font-bold uppercase text-indigo-200">{t("workshopDashboard.dashboardEyebrow")}</div><h1 className="text-3xl font-black">{workshop?.title || t("workshopDashboard.loading")}</h1></div>
      <div className="flex flex-wrap gap-2">
        <button onClick={() => onConsolidate(workshopId)} className="rounded-xl bg-white px-4 py-2 font-bold text-indigo-700">{t("workshopDashboard.consolidate")}</button>
        <button onClick={() => { setEditing(null); setForm({ number: `Groupe ${activeGroups.length + 1}`, theme: "" }); setFormErrors({}); setShowForm(true); }} className="rounded-xl bg-emerald-400 px-4 py-2 font-bold text-emerald-950">{t("workshopDashboard.addGroup")}</button>
        <button onClick={() => setShowArchive(v => !v)} className="rounded-xl border border-white/40 px-4 py-2 font-bold text-white">{t("workshopDashboard.archivesLink", { n: archivedGroups.length })}</button>
        <button onClick={() => setShowTrash(v => !v)} className="rounded-xl border border-white/40 px-4 py-2 font-bold text-white">{t("workshopDashboard.trashLink", { n: trashedGroups.length })}</button>
      </div></div>
    </div></header>
    <section className="mx-auto max-w-7xl p-4">
      <div className="mb-5 grid grid-cols-2 gap-3 sm:max-w-md"><div className="rounded-xl bg-white p-4 shadow-sm"><b className="text-3xl">{activeGroups.length}</b><span className="ml-2 text-gray-500">{t("workshopDashboard.groupsCount")}</span></div><div className="rounded-xl bg-white p-4 shadow-sm"><b className="text-3xl">{totalLabel}</b><span className="ml-2 text-gray-500">{t("workshopDashboard.contributionsCount")}</span></div></div>
      {showArchive && <ArchivePanel
        groups={archivedGroups}
        onClose={() => setShowArchive(false)}
        onRestore={async (group) => { await restoreGroup(workshopId, group.id); }}
        onTrash={async (group) => { if (confirm(t("workshopDashboard.confirmDeleteGroup", { name: group.name, days: TRASH_RETENTION_DAYS }))) await trashGroup(workshopId, group.id); }}
      />}
      {showTrash && <TrashPanel
        groups={trashedGroups}
        onClose={() => setShowTrash(false)}
        onRestore={async (group) => { await restoreGroup(workshopId, group.id); }}
        onPurge={async (group) => { if (confirm(t("workshopDashboard.confirmPurgeGroup", { name: group.name }))) await deleteGroup(workshopId, group.id, group.sessionId); }}
      />}
      {showForm && <div ref={formRef} className="mb-6 rounded-2xl border bg-white p-5 shadow">
        <h2 className="text-lg font-black">{editing ? t("workshopDashboard.editGroupTitle") : t("workshopDashboard.newGroupTitle")}</h2>
        <div className="mt-3 grid gap-3 sm:grid-cols-2">
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t("workshopDashboard.groupNameLabel")}</label>
            <input aria-label={t("workshopDashboard.groupNameLabel")} placeholder={t("workshopDashboard.groupNamePlaceholder")} value={form.number} onChange={e => setForm({ ...form, number: e.target.value })} className="w-full rounded-lg border px-3 py-2"/>
            {formErrors.number && <p className="mt-1 text-xs text-red-600">{formErrors.number}</p>}
          </div>
          <div>
            <label className="mb-1 block text-xs font-semibold text-gray-600">{t("workshopDashboard.themeFieldLabel")}</label>
            <input aria-label={t("workshopDashboard.themeFieldLabel")} placeholder={t("workshopDashboard.themeFieldPlaceholder")} value={form.theme} onChange={e => setForm({ ...form, theme: e.target.value })} className="w-full rounded-lg border px-3 py-2"/>
            {formErrors.theme && <p className="mt-1 text-xs text-red-600">{formErrors.theme}</p>}
          </div>
        </div>
        <div className="mt-3 flex gap-2">
          <button onClick={save} disabled={saving} className="rounded-lg bg-indigo-600 px-4 py-2 font-bold text-white disabled:opacity-50">{saving ? t("common.saving") : t("common.save")}</button>
          <button onClick={() => { setShowForm(false); setFormErrors({}); }} className="rounded-lg border px-4 py-2">{t("common.cancel")}</button>
        </div>
      </div>}
      <div className="grid gap-4 lg:grid-cols-2">{activeGroups.map(group => <GroupCard key={group.id} group={group} workshopTitle={workshop?.title || ""} onOpen={() => onOpenSession(group)} onEdit={() => { setEditing(group); setForm({ number: group.name || group.number, theme: group.theme }); setFormErrors({}); setShowForm(true); }} onArchive={async () => { if (confirm(t("workshopDashboard.confirmArchive", { name: group.name }))) await updateDoc(doc(db, "workshops", workshopId, "groups", group.id), { active: false, updatedAt: serverTimestamp() }); }} onDelete={async () => { if (confirm(t("workshopDashboard.confirmDeleteGroup", { name: group.name, days: TRASH_RETENTION_DAYS }))) await trashGroup(workshopId, group.id); }} onCount={(count) => setGroupCounts(current => current[group.id] === count ? current : { ...current, [group.id]: count })} />)}</div>
    </section>
  </main>;
}
