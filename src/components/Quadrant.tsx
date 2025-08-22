
import React, { useState } from 'react';
import { doc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';
import PostItComponent from './PostIt';
import { PostIt, QuadrantKey } from '../types';

interface QuadrantProps {
    info: {
        title: string;
        subtitle: string;
        textColor: string;
        borderColor: string;
        bgColor: string;
    };
    postIts: PostIt[];
    quadrantKey: QuadrantKey;
    isExpanded: boolean;
    onToggleExpand: () => void;
}

const Quadrant: React.FC<QuadrantProps> = ({ info, postIts, quadrantKey, isExpanded, onToggleExpand }) => {
    const [isDragOver, setIsDragOver] = useState(false);

    const handleDrop = async (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(false);
        const postItId = e.dataTransfer.getData('postItId');
        const newQuadrant = e.currentTarget.dataset.quadrant as QuadrantKey;

        if (postItId && newQuadrant) {
            const postitRef = doc(db, 'postits', postItId);
            try {
                await updateDoc(postitRef, { quadrant: newQuadrant });
            } catch (error) {
                console.error("Error moving post-it: ", error);
            }
        }
    };

    const handleDragOver = (e: React.DragEvent<HTMLDivElement>) => {
        e.preventDefault();
        setIsDragOver(true);
    };

    const handleDragLeave = () => {
        setIsDragOver(false);
    };

    return (
        <div
            data-quadrant={quadrantKey}
            onDrop={handleDrop}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            className={`p-4 transition-all duration-300 ${isDragOver ? 'bg-indigo-100' : ''} ${isExpanded ? 'bg-white rounded-xl shadow-2xl min-h-[calc(100vh-160px)]' : 'min-h-[40vh]'}`}
        >
            <div className={`p-2 sticky top-[76px] bg-white/80 backdrop-blur-sm z-10 border-b-4 ${info.borderColor} flex items-center justify-between`}>
                 <div>
                    <h3 className={`text-xl font-black text-center sm:text-left ${info.textColor}`}>{info.title}</h3>
                    <p className="text-xs text-center sm:text-left text-gray-500 font-semibold hidden sm:block">{info.subtitle}</p>
                 </div>
                 <button
                    onClick={onToggleExpand}
                    title={isExpanded ? 'Réduire' : 'Agrandir'}
                    className="p-2 w-10 h-10 flex items-center justify-center rounded-full hover:bg-gray-200 transition-colors text-gray-600"
                 >
                    <i className={`fas fa-lg ${isExpanded ? 'fa-compress-alt' : 'fa-expand-alt'}`}></i>
                </button>
            </div>
            <div className={`pt-4 grid gap-3 ${isExpanded ? 'grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5' : 'grid-cols-2'}`}>
                {postIts.map(postit => (
                    <PostItComponent key={postit.id} data={postit} />
                ))}
            </div>
        </div>
    );
};

export default Quadrant;
