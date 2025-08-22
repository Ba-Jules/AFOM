
import React, { useState, useEffect, useCallback } from 'react';
import { collection, onSnapshot, query, where, orderBy, deleteDoc, doc as firestoreDoc, QuerySnapshot } from 'firebase/firestore';
import { db } from '../services/firebase';
import Toolbar from './Toolbar';
import CollectionMode from './CollectionMode';
import AnalysisMode from './AnalysisMode';
import { PostIt } from '../types';
import QRCodeModal from './QRCodeModal';

interface WorkInterfaceProps {
    sessionId: string;
    onBackToPresentation: () => void;
}

const WorkInterface: React.FC<WorkInterfaceProps> = ({ sessionId: initialSessionId, onBackToPresentation }) => {
    const [sessionId, setSessionId] = useState(initialSessionId);
    const [mode, setMode] = useState<'collect' | 'analyze'>('collect');
    const [postIts, setPostIts] = useState<PostIt[]>([]);
    const [isQRModalOpen, setQRModalOpen] = useState(false);
    
    useEffect(() => {
        const postitsQuery = query(
            collection(db, 'postits'),
            where('sessionId', '==', sessionId),
            orderBy('timestamp', 'asc')
        );

        const unsubscribe = onSnapshot(postitsQuery, (snapshot: QuerySnapshot) => {
            const fetchedPostIts = snapshot.docs.map(doc => ({
                id: doc.id,
                ...doc.data(),
            } as PostIt));
            setPostIts(fetchedPostIts);
        }, (error) => {
            console.error("Error fetching post-its:", error);
        });

        return () => unsubscribe();
    }, [sessionId]);
    
    const handleNewSession = () => {
        if (window.confirm("Créer une nouvelle session ? Les données actuelles ne seront plus affichées.")) {
             const newSessionId = 'SESSION-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0');
             setSessionId(newSessionId);
             setPostIts([]);
             setMode('collect');
        }
    }
    
    const handleClearSession = async () => {
         if (window.confirm(`Voulez-vous vraiment supprimer tous les post-its de la session ${sessionId} ? Cette action est irréversible.`)) {
            const deletePromises = postIts.map(p => deleteDoc(firestoreDoc(db, 'postits', p.id)));
            try {
                await Promise.all(deletePromises);
                setPostIts([]);
            } catch (error) {
                console.error("Error clearing session:", error);
                alert("Une erreur est survenue lors de la suppression des données.");
            }
        }
    }

    return (
        <div className="min-h-screen flex flex-col">
            <header className="text-center p-6 bg-gradient-to-r from-red-400 to-yellow-400 text-white shadow-lg relative">
                <h1 className="text-4xl font-black tracking-tight">🚀 AFOM Ultimate</h1>
                <p className="text-lg mt-1 font-semibold">Interface de Travail</p>
                <div className="absolute top-4 left-4 flex space-x-2">
                     <button onClick={() => setMode('collect')} className={`px-4 py-2 font-bold rounded-full text-sm transition-colors ${mode === 'collect' ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/30 hover:bg-white/50 text-white'}`}>
                        📝 Collecte
                    </button>
                    <button onClick={() => setMode('analyze')} className={`px-4 py-2 font-bold rounded-full text-sm transition-colors ${mode === 'analyze' ? 'bg-white text-indigo-700 shadow-md' : 'bg-white/30 hover:bg-white/50 text-white'}`}>
                        📊 Analyse
                    </button>
                </div>
            </header>

            <Toolbar
                sessionId={sessionId}
                participantCount={new Set(postIts.map(p => p.author)).size}
                onNewSession={handleNewSession}
                onClearSession={handleClearSession}
                onGenerateQR={() => setQRModalOpen(true)}
                onBackToPresentation={onBackToPresentation}
            />

            <main className="flex-grow">
                {mode === 'collect' && <CollectionMode postIts={postIts} />}
                {mode === 'analyze' && <AnalysisMode postIts={postIts} />}
            </main>
            
            <QRCodeModal 
                isOpen={isQRModalOpen} 
                onClose={() => setQRModalOpen(false)}
                sessionId={sessionId}
            />
        </div>
    );
};

export default WorkInterface;
