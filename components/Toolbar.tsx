
import React from 'react';

interface ToolbarProps {
    sessionId: string;
    participantCount: number;
    onNewSession: () => void;
    onClearSession: () => void;
    onGenerateQR: () => void;
    onBackToPresentation: () => void;
}

const Toolbar: React.FC<ToolbarProps> = ({ sessionId, participantCount, onNewSession, onClearSession, onGenerateQR, onBackToPresentation }) => {
    return (
        <div className="bg-white/70 backdrop-blur-sm shadow-md p-3 sticky top-0 z-40 flex flex-wrap items-center justify-between gap-4 border-b-2 border-gray-200">
            <div className="flex flex-wrap items-center gap-2">
                <ToolbarButton icon="✨" text="Nouvelle" onClick={onNewSession} color="bg-blue-500 hover:bg-blue-600" />
                <ToolbarButton icon="🗑️" text="Supprimer" onClick={onClearSession} color="bg-red-500 hover:bg-red-600" />
                <ToolbarButton icon="📱" text="QR Code" onClick={onGenerateQR} color="bg-green-500 hover:bg-green-600" />
                <ToolbarButton icon="📖" text="Formation" onClick={onBackToPresentation} color="bg-yellow-500 hover:bg-yellow-600" />
            </div>
            <div className="flex items-center gap-3 text-sm font-semibold text-gray-700">
                <div className="bg-indigo-100 text-indigo-800 px-3 py-1.5 rounded-full font-mono text-xs sm:text-sm">
                    {sessionId}
                </div>
                <div className="bg-purple-100 text-purple-800 px-3 py-1.5 rounded-full flex items-center gap-2">
                    <i className="fa-solid fa-users"></i>
                    <span>{participantCount} Participant{participantCount !== 1 ? 's' : ''}</span>
                </div>
            </div>
        </div>
    );
};

interface ToolbarButtonProps {
    icon: string;
    text: string;
    onClick: () => void;
    color: string;
}

const ToolbarButton: React.FC<ToolbarButtonProps> = ({ icon, text, onClick, color }) => (
    <button
        onClick={onClick}
        className={`px-3 py-2 text-white font-bold rounded-lg shadow-sm flex items-center gap-2 text-xs sm:text-sm transition-transform transform hover:scale-105 ${color}`}
    >
        <span>{icon}</span>
        <span className="hidden sm:inline">{text}</span>
    </button>
);


export default Toolbar;
