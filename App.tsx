
import React, { useState, useEffect } from 'react';
import PresentationMode from './components/PresentationMode';
import WorkInterface from './components/WorkInterface';
import ParticipantInterface from './components/ParticipantInterface';
import { PostIt } from './types';

const App: React.FC = () => {
    const [view, setView] = useState<'presentation' | 'work' | 'participant'>('presentation');
    const [sessionId, setSessionId] = useState<string | null>(null);

    useEffect(() => {
        const urlParams = new URLSearchParams(window.location.search);
        const sessionParam = urlParams.get('session');
        const modeParam = urlParams.get('mode');

        if (sessionParam && modeParam === 'participant') {
            setSessionId(sessionParam);
            setView('participant');
        } else {
            // Default to a new session for the trainer
            setSessionId('SESSION-' + new Date().getFullYear() + '-' + String(Math.floor(Math.random() * 1000)).padStart(3, '0'));
        }
    }, []);

    const handleLaunchSession = (newSessionId: string) => {
        setSessionId(newSessionId);
        setView('work');
    };
    
    const handleBackToPresentation = () => {
        setView('presentation');
    }

    const renderView = () => {
        switch (view) {
            case 'presentation':
                return <PresentationMode onLaunchSession={handleLaunchSession} initialSessionId={sessionId || ''} />;
            case 'work':
                return sessionId ? <WorkInterface sessionId={sessionId} onBackToPresentation={handleBackToPresentation} /> : <div>Loading...</div>;
            case 'participant':
                return sessionId ? <ParticipantInterface sessionId={sessionId} /> : <div>Invalid session ID.</div>;
            default:
                return <PresentationMode onLaunchSession={handleLaunchSession} initialSessionId={sessionId || ''} />;
        }
    };

    return (
        <div className="min-h-screen bg-gradient-to-br from-indigo-100 via-purple-100 to-pink-100 font-sans">
            {renderView()}
        </div>
    );
};

export default App;
