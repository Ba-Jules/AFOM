
import React from 'react';
import { QRCodeSVG } from 'qrcode.react';

interface QRCodeModalProps {
    isOpen: boolean;
    onClose: () => void;
    sessionId: string;
}

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, sessionId }) => {
    if (!isOpen) return null;

    const participantUrl = `${window.location.origin}${window.location.pathname}?session=${sessionId}&mode=participant`;

    return (
        <div 
            className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50"
            onClick={onClose}
        >
            <div 
                className="bg-white rounded-2xl shadow-2xl p-8 max-w-sm w-full text-center transform transition-all"
                onClick={(e) => e.stopPropagation()}
            >
                <h3 className="text-2xl font-black text-gray-800 mb-4">📱 Scannez pour Participer</h3>
                <div className="p-4 bg-gray-100 rounded-lg inline-block border-4 border-gray-200">
                    <QRCodeSVG value={participantUrl} size={200} />
                </div>
                <div className="mt-4 p-2 bg-gray-100 rounded-lg font-mono text-xs text-gray-600 break-all">
                    {participantUrl}
                </div>
                <button 
                    onClick={onClose}
                    className="mt-6 w-full py-3 bg-indigo-600 text-white font-bold rounded-lg shadow-md hover:bg-indigo-700 transition"
                >
                    Fermer
                </button>
            </div>
        </div>
    );
};

export default QRCodeModal;
