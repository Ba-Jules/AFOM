import React, { useState, useEffect } from 'react';

interface PresentationModeProps {
    onLaunchSession: (sessionId: string) => void;
    initialSessionId: string;
}

const PresentationMode: React.FC<PresentationModeProps> = ({ onLaunchSession, initialSessionId }) => {
    const [currentSlide, setCurrentSlide] = useState(0);
    const totalSlides = 3;

    const nextSlide = () => setCurrentSlide(prev => Math.min(prev + 1, totalSlides - 1));
    const prevSlide = () => setCurrentSlide(prev => Math.max(prev - 1, 0));

    useEffect(() => {
        const handleKeyDown = (e: KeyboardEvent) => {
            if (e.key === 'ArrowRight' || e.key === ' ') {
                e.preventDefault();
                nextSlide();
            }
            if (e.key === 'ArrowLeft') {
                e.preventDefault();
                prevSlide();
            }
            if (e.key === 'Enter') {
                e.preventDefault();
                onLaunchSession(initialSessionId);
            }
        };

        window.addEventListener('keydown', handleKeyDown);
        return () => window.removeEventListener('keydown', handleKeyDown);
        // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [initialSessionId]);

    const slides = [
        <Slide1 key="1" />,
        <Slide2 key="2" />,
        <Slide3 key="3" />,
    ];

    return (
        <div className="container mx-auto p-4 sm:p-8">
             <header className="text-center p-8 bg-gradient-to-r from-red-400 to-yellow-400 text-white rounded-2xl shadow-lg mb-8">
                <h1 className="text-4xl sm:text-5xl font-black tracking-tight">🚀 AFOM Ultimate</h1>
                <p className="text-lg sm:text-xl mt-2 font-semibold">Analyse Acquis • Faiblesses • Opportunités • Menaces - Formation Professionnelle</p>
            </header>

            <main className="bg-white/80 backdrop-blur-sm p-6 sm:p-10 rounded-2xl shadow-xl border border-gray-200 min-h-[550px] flex flex-col justify-between">
                <div>{slides[currentSlide]}</div>

                <div className="flex flex-col items-center">
                    <div className="flex items-center justify-center mt-8 space-x-4">
                        <button onClick={prevSlide} disabled={currentSlide === 0} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300">
                            ← Précédent
                        </button>
                        
                        <div className="flex space-x-2">
                            {Array.from({ length: totalSlides }).map((_, i) => (
                                <div key={i} className={`w-3 h-3 rounded-full transition-all duration-300 ${currentSlide === i ? 'bg-indigo-600 scale-125' : 'bg-gray-300'}`}></div>
                            ))}
                        </div>

                        <button onClick={nextSlide} disabled={currentSlide === totalSlides - 1} className="px-6 py-3 bg-indigo-600 text-white font-bold rounded-full shadow-md hover:bg-indigo-700 disabled:bg-gray-300 disabled:cursor-not-allowed transition-all duration-300">
                            Suivant →
                        </button>
                    </div>

                    <div className="text-center mt-10">
                        <button onClick={() => onLaunchSession(initialSessionId)} className="px-10 py-5 bg-gradient-to-r from-green-400 to-teal-400 text-white text-xl font-black rounded-full shadow-lg hover:shadow-2xl hover:scale-105 transform transition-all duration-300">
                            🚀 LANCER LA SESSION DE TRAVAIL
                        </button>
                    </div>
                </div>
            </main>
        </div>
    );
};


const Slide1: React.FC = () => (
    <div>
        <h2 className="text-3xl font-black text-center text-gray-800 mb-6">🎯 Bienvenue dans AFOM Ultimate</h2>
        <div className="grid md:grid-cols-2 gap-8 items-center">
            <div className="text-gray-700 space-y-4">
                <h3 className="text-xl font-bold text-indigo-700">Analyse Stratégique Collaborative</h3>
                <p>L'analyse AFOM (ou SWOT en anglais) est un outil stratégique qui permet d'analyser les forces et faiblesses d'un projet, d'une organisation ou d'une situation.</p>
                <h3 className="text-xl font-bold text-indigo-700">🔍 Les 4 Dimensions :</h3>
                 <ul className="space-y-2 font-semibold">
                    <li><span className="text-green-600">🟢 A - Acquis :</span> Forces, succès, réalisations positives (Vision Rétrospective +)</li>
                    <li><span className="text-red-600">🔴 F - Faiblesses :</span> Échecs, aspects négatifs, difficultés (Vision Rétrospective -)</li>
                    <li><span className="text-green-600">🟢 O - Opportunités :</span> Potentialités, ressources exploitables (Vision Prospective +)</li>
                    <li><span className="text-red-600">🔴 M - Menaces :</span> Risques, obstacles, craintes (Vision Prospective -)</li>
                </ul>
            </div>
            <div className="relative border-4 border-gray-800 rounded-xl min-h-[400px] bg-gray-50 p-2 shadow-inner">
                <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full">
                    <div className="bg-gradient-to-br from-green-400 to-green-500 rounded-lg flex flex-col justify-center text-center text-white p-4">
                        <h3 className="font-black text-lg">A - Acquis</h3><p className="text-sm font-semibold">Forces • Succès</p>
                    </div>
                    <div className="bg-gradient-to-br from-green-300 to-green-400 rounded-lg flex flex-col justify-center text-center text-white p-4">
                        <h3 className="font-black text-lg">O - Opportunités</h3><p className="text-sm font-semibold">Potentialités</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-500 to-red-600 rounded-lg flex flex-col justify-center text-center text-white p-4">
                        <h3 className="font-black text-lg">F - Faiblesses</h3><p className="text-sm font-semibold">Échecs • Négatifs</p>
                    </div>
                    <div className="bg-gradient-to-br from-red-400 to-red-500 rounded-lg flex flex-col justify-center text-center text-white p-4">
                        <h3 className="font-black text-lg">M - Menaces</h3><p className="text-sm font-semibold">Risques • Obstacles</p>
                    </div>
                </div>
                <div className="absolute inset-0 flex items-center justify-center">
                    <div className="w-1.5 h-full bg-gray-800"></div>
                    <div className="h-1.5 w-full bg-gray-800 absolute"></div>
                </div>
            </div>
        </div>
    </div>
);

const Slide2: React.FC = () => (
    <div>
        <h2 className="text-3xl font-black text-center text-gray-800 mb-6">🔧 Les Deux Axes d'Analyse</h2>
        <div className="relative max-w-4xl mx-auto p-8">
            {/* Axis Labels */}
            <div className="absolute top-0 left-1/2 -translate-x-1/2 text-center font-bold text-gray-700">
                <p>↑ Souhaité (Positif)</p>
            </div>
            <div className="absolute bottom-0 left-1/2 -translate-x-1/2 text-center font-bold text-gray-700">
                <p>↓ Non souhaité (Négatif)</p>
            </div>
            <div className="absolute top-1/2 left-0 -translate-y-1/2 -translate-x-full text-center font-bold text-gray-700">
                <p>← Passé</p>
            </div>
            <div className="absolute top-1/2 right-0 -translate-y-1/2 translate-x-full text-center font-bold text-gray-700">
                <p>Futur →</p>
            </div>

            {/* Grid */}
            <div className="relative border-4 border-gray-800 rounded-xl bg-gray-50 p-2 shadow-inner aspect-square">
                <div className="grid grid-cols-2 grid-rows-2 gap-1.5 h-full">
                    <div className="bg-green-100 rounded-lg flex flex-col items-center justify-center text-center p-2 border-2 border-green-300">
                        <h3 className="font-black text-lg text-green-800">Acquis</h3>
                        <p className="text-sm font-semibold text-green-700">Rétrospective Positive</p>
                    </div>
                    <div className="bg-green-100 rounded-lg flex flex-col items-center justify-center text-center p-2 border-2 border-green-300">
                        <h3 className="font-black text-lg text-green-800">Opportunités</h3>
                        <p className="text-sm font-semibold text-green-700">Prospective Positive</p>
                    </div>
                    <div className="bg-red-100 rounded-lg flex flex-col items-center justify-center text-center p-2 border-2 border-red-300">
                        <h3 className="font-black text-lg text-red-800">Faiblesses</h3>
                        <p className="text-sm font-semibold text-red-700">Rétrospective Négative</p>
                    </div>
                    <div className="bg-red-100 rounded-lg flex flex-col items-center justify-center text-center p-2 border-2 border-red-300">
                        <h3 className="font-black text-lg text-red-800">Menaces</h3>
                        <p className="text-sm font-semibold text-red-700">Prospective Négative</p>
                    </div>
                </div>
                {/* Center lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1 h-full bg-gray-800"></div>
                    <div className="h-1 w-full bg-gray-800 absolute"></div>
                </div>
                 {/* Axis Arrows */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="absolute h-full w-px bg-gray-500 top-0"></div>
                     <div className="absolute w-full h-px bg-gray-500 left-0"></div>
                </div>
            </div>
        </div>
    </div>
);


const Slide3: React.FC = () => (
    <div>
        <h2 className="text-3xl font-black text-center text-gray-800 mb-6">📋 Instructions pour la Session</h2>
        <div className="grid md:grid-cols-2 gap-8">
            <div>
                <h3 className="text-xl font-bold text-indigo-700 mb-2">🎯 Déroulement</h3>
                <ol className="list-decimal list-inside space-y-2 font-semibold text-gray-600">
                    <li><span className="font-bold">Lancement</span> - Le modérateur démarre la session</li>
                    <li><span className="font-bold">QR Code</span> - Les participants scannent pour rejoindre</li>
                    <li><span className="font-bold">Collecte</span> - Chacun ajoute ses post-its colorés</li>
                    <li><span className="font-bold">Organisation</span> - Drag & drop pour structurer</li>
                    <li><span className="font-bold">Analyse</span> - Basculement vers les insights IA</li>
                    <li><span className="font-bold">Export</span> - Génération du rapport final</li>
                </ol>
            </div>
            <div>
                <h3 className="text-xl font-bold text-indigo-700 mb-2">🎨 Post-its Intelligents</h3>
                <div className="space-y-3">
                    <div className="p-3 bg-green-100 border-l-4 border-green-500 rounded font-semibold">🟢 Vert : Aspects positifs (Acquis + Opportunités)</div>
                    <div className="p-3 bg-red-100 border-l-4 border-red-500 rounded font-semibold">🔴 Rouge : Aspects négatifs (Faiblesses + Menaces)</div>
                </div>
                 <h3 className="text-xl font-bold text-indigo-700 mb-2 mt-6">💡 Astuce</h3>
                 <p className="text-gray-600 font-semibold">Utilisez le bouton <i className="fas fa-expand-alt mx-1"></i> pour agrandir un quadrant et vous concentrer sur une catégorie spécifique !</p>
            </div>
        </div>
    </div>
);

export default PresentationMode;
