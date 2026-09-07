import React, { useState, useEffect, useMemo } from 'react';
import { collection, addDoc, onSnapshot, query, serverTimestamp, where, doc as fsDoc, getDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import { PostIt, QuadrantKey } from '../types';
import { QUADRANT_INFO } from '../constants';

interface ParticipantInterfaceProps {
    sessionId: string;
    workshopId?: string;
    groupId?: string;
}

type BoardMeta = {
  projectName?: string;
  themeName?: string;
};

const MAX_LEN = 50;

const ParticipantInterface: React.FC<ParticipantInterfaceProps> = ({ sessionId, workshopId, groupId }) => {
    const [name, setName] = useState('');
    const [isAnonymous, setIsAnonymous] = useState(false);
    const [quadrant, setQuadrant] = useState<QuadrantKey | ''>('');
    const [content, setContent] = useState('');
    const [submitting, setSubmitting] = useState(false);
    const [notification, setNotification] = useState<{ message: string; type: 'success' | 'error' } | null>(null);

    // Projet / Thème (lecture boards/{sessionId})
    const [meta, setMeta] = useState<BoardMeta | null>(null);
    const [workshopTitle, setWorkshopTitle] = useState('');
    const [groupName, setGroupName] = useState('');
    const [linkInvalid, setLinkInvalid] = useState(false);
    const [tab, setTab] = useState<'contribute' | 'view'>('contribute');
    const [ourPostIts, setOurPostIts] = useState<PostIt[]>([]);

    useEffect(() => {
        const savedName = localStorage.getItem('afom_user_name') || '';
        const savedAnonymous = localStorage.getItem('afom_anonymous') === 'true';
        if (savedName) setName(savedName);
        setIsAnonymous(savedAnonymous);
    }, []);

    useEffect(() => {
        if (!sessionId) return;
        (async () => {
            try {
                const snap = await getDoc(fsDoc(db, 'boards', sessionId));
                if (snap.exists()) {
                    setMeta(snap.data() as BoardMeta);
                }
            } catch (e) {
                console.error('Unable to load board meta', e);
            }
        })();
    }, [sessionId]);

    useEffect(() => {
        if (!sessionId) return;
        return onSnapshot(
            query(collection(db, 'postits'), where('sessionId', '==', sessionId)),
            (snap) => setOurPostIts(snap.docs.map((d) => ({ id: d.id, ...(d.data() as any) })) as PostIt[])
        );
    }, [sessionId]);

    useEffect(() => {
        if (!workshopId || !groupId) return;
        (async () => {
            try {
                const [workshopSnap, groupSnap] = await Promise.all([
                    getDoc(fsDoc(db, 'workshops', workshopId)),
                    getDoc(fsDoc(db, 'workshops', workshopId, 'groups', groupId)),
                ]);
                if (!workshopSnap.exists() || !groupSnap.exists() || groupSnap.data()?.active === false) {
                    setLinkInvalid(true);
                    return;
                }
                setWorkshopTitle(String(workshopSnap.data().title || ''));
                const data = groupSnap.data();
                setGroupName(String(data.name || data.number || ''));
                setMeta(current => ({ ...current, projectName: String(data.name || data.number || current?.projectName || ''), themeName: String(data.theme || current?.themeName || '') }));
            } catch (e) {
                console.error('Unable to load workshop/group', e);
                setLinkInvalid(true);
            }
        })();
    }, [workshopId, groupId]);

    const handleNameChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        setName(e.target.value);
        if (!isAnonymous) {
            localStorage.setItem('afom_user_name', e.target.value);
        }
    };

    const handleAnonymousChange = (e: React.ChangeEvent<HTMLInputElement>) => {
        const checked = e.target.checked;
        setIsAnonymous(checked);
        localStorage.setItem('afom_anonymous', String(checked));
        if (checked) {
            localStorage.removeItem('afom_user_name');
        } else if (name) {
             localStorage.setItem('afom_user_name', name);
        }
    };

    const showNotification = (message: string, type: 'success' | 'error') => {
        setNotification({ message, type });
        setTimeout(() => setNotification(null), 3000);
    };

    const clearForm = () => {
        setQuadrant('');
        setContent('');
    };

    const printProduction = () => { window.print(); };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!quadrant || !content.trim()) {
            showNotification('Veuillez choisir une catégorie et écrire une contribution.', 'error');
            return;
        }
        setSubmitting(true);

        try {
            const author = isAnonymous || !name.trim() ? 'Anonyme' : name.trim();
            await addDoc(collection(db, 'postits'), {
                sessionId,
                quadrant,
                originQuadrant: quadrant, // fige la couleur d’origine côté modérateur
                content: content.trim(),
                author,
                status: 'active',
                sortIndex: Date.now(),
                timestamp: serverTimestamp(),
            });
            showNotification('Post-it envoyé avec succès !', 'success');
            clearForm();
        } catch (error) {
            console.error('Error sending post-it:', error);
            showNotification("Erreur lors de l'envoi.", 'error');
        } finally {
            setSubmitting(false);
        }
    };

    const charsLeft = useMemo(() => Math.max(0, MAX_LEN - content.length), [content]);

    const byQuadrant = useMemo(() => {
        const res: Record<QuadrantKey, PostIt[]> = { acquis: [], faiblesses: [], opportunites: [], menaces: [] };
        for (const p of ourPostIts) {
            if ((p as any).status === 'bin') continue;
            res[p.quadrant]?.push(p);
        }
        return res;
    }, [ourPostIts]);
    const totalOurPostIts = useMemo(
        () => (Object.values(byQuadrant) as PostIt[][]).reduce((sum, arr) => sum + arr.length, 0),
        [byQuadrant]
    );

    if (linkInvalid) {
        return (
            <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50">
                <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border p-8 text-center">
                    <div className="text-4xl mb-3">🔗</div>
                    <h2 className="text-lg font-black text-gray-900 mb-2">Lien non disponible</h2>
                    <p className="text-sm text-gray-600 mb-6">
                        Ce lien d'atelier n'est pas valide ou n'est plus disponible.
                    </p>
                    <a
                        href={window.location.origin + window.location.pathname}
                        className="inline-block px-5 py-2.5 rounded-lg bg-indigo-600 text-white text-sm font-bold hover:bg-indigo-700 transition-colors"
                    >
                        Retour à l'accueil
                    </a>
                </div>
            </div>
        );
    }

    return (
        <div className="flex items-center justify-center min-h-screen p-4 bg-gray-50 print:block print:min-h-0 print:p-0 print:bg-white">
            <style>{`
                @media print {
                    .no-print { display: none !important; }
                    body { -webkit-print-color-adjust: exact; print-color-adjust: exact; }
                }
            `}</style>
            <div className="w-full max-w-md print:max-w-none">
                <div className="bg-white rounded-2xl shadow-2xl overflow-hidden border-2 border-gray-200 print:shadow-none print:border-0 print:rounded-none">
                    {/* Bandeau Projet / Thème */}
                    <div className="px-6 py-3 bg-gray-100 border-b">
                        {workshopTitle && <div className="mb-1 text-xs font-bold uppercase tracking-wide text-indigo-600">{workshopTitle}</div>}
                        {groupName && <div className="mb-1 text-lg font-black text-gray-900">{groupName}</div>}
                        <div className="text-sm md:text-base flex flex-wrap items-center gap-x-4 gap-y-1">
                            <div><span className="font-extrabold text-gray-900">Projet :</span> <span className="font-semibold text-gray-800">{meta?.projectName || '—'}</span></div>
                            <div><span className="font-extrabold text-gray-900">Thème :</span> <span className="font-semibold text-gray-800">{meta?.themeName || '—'}</span></div>
                        </div>
                    </div>

                    {/* Onglets Contribuer / Notre production */}
                    <div className="no-print flex border-b bg-white">
                        <button
                            type="button"
                            onClick={() => setTab('contribute')}
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'contribute' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            📝 Contribuer
                        </button>
                        <button
                            type="button"
                            onClick={() => setTab('view')}
                            className={`flex-1 py-3 text-sm font-bold transition-colors ${tab === 'view' ? 'text-indigo-700 border-b-2 border-indigo-600' : 'text-gray-400 hover:text-gray-600'}`}
                        >
                            👀 Notre production ({totalOurPostIts})
                        </button>
                    </div>

                    {tab === 'view' ? (
                        <div className="p-5 space-y-4 max-h-[70vh] overflow-y-auto print:max-h-none print:overflow-visible">
                            {totalOurPostIts > 0 && (
                                <button
                                    type="button"
                                    onClick={printProduction}
                                    className="no-print w-full py-2.5 rounded-lg border-2 border-indigo-600 text-indigo-700 text-sm font-bold hover:bg-indigo-50 transition-colors"
                                    title="Imprimer ou enregistrer en PDF"
                                >
                                    🖨️ Imprimer / Enregistrer en PDF
                                </button>
                            )}
                            {totalOurPostIts === 0 && (
                                <p className="text-center text-sm text-gray-500 py-6">Aucune contribution enregistrée pour l'instant.</p>
                            )}
                            {(Object.keys(QUADRANT_INFO) as QuadrantKey[]).map((key) => (
                                byQuadrant[key].length > 0 && (
                                    <div key={key} className={`rounded-xl border-2 p-3 ${QUADRANT_INFO[key].borderColor} ${QUADRANT_INFO[key].bgColor}`}>
                                        <h3 className={`text-sm font-black uppercase mb-2 ${QUADRANT_INFO[key].textColor}`}>
                                            {QUADRANT_INFO[key].title} <span className="font-normal">({byQuadrant[key].length})</span>
                                        </h3>
                                        <div className="space-y-2">
                                            {byQuadrant[key].map((p) => (
                                                <div key={p.id} className="rounded-lg bg-white p-2.5 shadow-sm">
                                                    <p className="text-sm font-semibold text-gray-800">{p.content}</p>
                                                    {p.author && <p className="mt-0.5 text-xs text-gray-500">par {p.author}</p>}
                                                </div>
                                            ))}
                                        </div>
                                    </div>
                                )
                            ))}
                        </div>
                    ) : (
                    <>
                    {/* En-tête */}
                    <div className="p-6 bg-gradient-to-r from-indigo-600 to-purple-600 text-white text-center">
                        <h2 className="text-2xl font-black">📝 Post-it AFOM</h2>
                        <p className="font-semibold mt-1">Contribuez à l'analyse collaborative</p>
                    </div>

                    {/* Formulaire */}
                    <form onSubmit={handleSubmit} className="p-6 space-y-6">
                        <div>
                            <label htmlFor="participant-name" className="block text-sm font-bold text-gray-700 mb-1">Votre nom (optionnel)</label>
                            <input
                                type="text"
                                id="participant-name"
                                value={name}
                                onChange={handleNameChange}
                                disabled={isAnonymous}
                                placeholder="Votre nom..."
                                className="w-full h-11 px-4 border-2 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition disabled:bg-gray-100"
                            />
                            <div className="flex items-center mt-2">
                                <input
                                    type="checkbox"
                                    id="stay-anonymous"
                                    checked={isAnonymous}
                                    onChange={handleAnonymousChange}
                                    className="h-4 w-4 text-indigo-600 border-gray-300 rounded focus:ring-indigo-500"
                                />
                                <label htmlFor="stay-anonymous" className="ml-2 block text-sm text-gray-900">Rester anonyme</label>
                            </div>
                        </div>

                        <div>
                            <label htmlFor="quadrant-select" className="block text-sm font-bold text-gray-700 mb-1">Catégorie</label>
                            <select
                                id="quadrant-select"
                                value={quadrant}
                                onChange={(e) => setQuadrant(e.target.value as QuadrantKey | '')}
                                required
                                className="w-full h-11 px-4 border-2 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition font-bold"
                            >
                                <option value="" disabled>-- Choisir une catégorie --</option>
                                <option value="acquis" className="bg-green-100 text-green-800">🟢 Acquis (Positif - Passé)</option>
                                <option value="faiblesses" className="bg-red-100 text-red-800">🔴 Faiblesses (Négatif - Passé)</option>
                                <option value="opportunites" className="bg-green-100 text-green-800">🟢 Opportunités (Positif - Futur)</option>
                                <option value="menaces" className="bg-red-100 text-red-800">🔴 Menaces (Négatif - Futur)</option>
                            </select>
                        </div>

                        <div>
                            <label htmlFor="postit-content" className="block text-sm font-bold text-gray-700 mb-1">
                                Votre contribution <span className="text-gray-400">(max {MAX_LEN} caractères)</span>
                            </label>
                            {/* Champ homogène et limité à 50 caractères */}
                            <input
                                id="postit-content"
                                type="text"
                                value={content}
                                onChange={(e) => {
                                  const v = e.target.value.slice(0, MAX_LEN);
                                  setContent(v);
                                }}
                                placeholder="Saisissez une idée courte…"
                                required
                                maxLength={MAX_LEN}
                                className="w-full h-12 px-4 border-2 border-gray-300 rounded-lg focus:ring-indigo-500 focus:border-indigo-500 transition"
                            />
                            <div className={`mt-1 text-xs ${charsLeft === 0 ? 'text-red-600' : 'text-gray-500'}`}>
                                {MAX_LEN - content.length}/{MAX_LEN} caractères utilisés
                            </div>
                        </div>

                        <div className="flex items-center space-x-4">
                            <button
                                type="submit"
                                disabled={submitting}
                                className="flex-1 py-3 px-4 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 disabled:bg-indigo-300 transition-colors"
                            >
                                {submitting ? 'Envoi...' : '📤 Envoyer'}
                            </button>
                            <button
                                type="button"
                                onClick={clearForm}
                                className="flex-1 py-3 px-4 bg-gray-600 text-white font-bold rounded-lg shadow-md hover:bg-gray-700 transition-colors"
                            >
                                🗑️ Nouveau
                            </button>
                        </div>
                    </form>
                    </>
                    )}

                    <div className="py-2 text-center text-xs text-gray-500 bg-gray-50">
                        Session : <span className="font-mono">{sessionId}</span>
                    </div>
                </div>

                {notification && (
                    <div className={`fixed bottom-5 right-5 p-4 rounded-lg shadow-lg text-white font-bold ${notification.type === 'success' ? 'bg-green-500' : 'bg-red-500'}`}>
                        {notification.message}
                    </div>
                )}
            </div>
        </div>
    );
};

export default ParticipantInterface;
