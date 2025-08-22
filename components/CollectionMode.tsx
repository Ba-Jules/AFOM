
import React, { useState } from 'react';
import Quadrant from './Quadrant';
import { PostIt, QuadrantKey } from '../types';
import { QUADRANT_INFO } from '../constants';

interface CollectionModeProps {
    postIts: PostIt[];
}

const CollectionMode: React.FC<CollectionModeProps> = ({ postIts }) => {
    const [expandedQuadrant, setExpandedQuadrant] = useState<QuadrantKey | null>(null);

    const handleToggleExpand = (quadrantKey: QuadrantKey) => {
        setExpandedQuadrant(prev => (prev === quadrantKey ? null : quadrantKey));
    };

    const filterPostIts = (quadrant: QuadrantKey) => {
        return postIts.filter(p => p.quadrant === quadrant);
    };

    if (expandedQuadrant) {
        const quadrantKey = expandedQuadrant;
        const info = QUADRANT_INFO[quadrantKey];
        const posts = filterPostIts(quadrantKey);
        return (
            <div className="p-4 sm:p-6 lg:p-8 h-full w-full">
                <Quadrant
                    quadrantKey={quadrantKey}
                    info={info}
                    postIts={posts}
                    onToggleExpand={() => handleToggleExpand(quadrantKey)}
                    isExpanded={true}
                />
            </div>
        );
    }

    return (
        <div className="p-4 sm:p-6 lg:p-8">
            <div className="relative border-4 border-gray-800 rounded-2xl bg-gray-100 shadow-2xl">
                {/* Axis Labels */}
                <div className="absolute -top-12 left-1/2 -translate-x-1/2 text-center">
                    <div className="bg-white border-2 border-gray-800 px-4 py-1 rounded-full shadow-md font-bold text-gray-700 text-sm">Axe du Jugement</div>
                </div>
                 <div className="absolute top-1/2 -left-12 -translate-y-1/2 -rotate-90 text-center">
                    <div className="bg-white border-2 border-gray-800 px-4 py-1 rounded-full shadow-md font-bold text-gray-700 text-sm">Axe du Temps</div>
                </div>
                
                {/* Quadrant Lines */}
                <div className="absolute inset-0 flex items-center justify-center pointer-events-none">
                    <div className="w-1.5 h-full bg-gray-800"></div>
                    <div className="h-1.5 w-full bg-gray-800 absolute"></div>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2">
                    <Quadrant quadrantKey="acquis" info={QUADRANT_INFO.acquis} postIts={filterPostIts('acquis')} onToggleExpand={() => handleToggleExpand('acquis')} isExpanded={false} />
                    <Quadrant quadrantKey="opportunites" info={QUADRANT_INFO.opportunites} postIts={filterPostIts('opportunites')} onToggleExpand={() => handleToggleExpand('opportunites')} isExpanded={false} />
                    <Quadrant quadrantKey="faiblesses" info={QUADRANT_INFO.faiblesses} postIts={filterPostIts('faiblesses')} onToggleExpand={() => handleToggleExpand('faiblesses')} isExpanded={false} />
                    <Quadrant quadrantKey="menaces" info={QUADRANT_INFO.menaces} postIts={filterPostIts('menaces')} onToggleExpand={() => handleToggleExpand('menaces')} isExpanded={false} />
                </div>
            </div>
        </div>
    );
};

export default CollectionMode;
