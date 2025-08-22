
import React from 'react';
import { PostIt, QuadrantKey } from '../types';
import { doc, deleteDoc, updateDoc } from 'firebase/firestore';
import { db } from '../services/firebase';

interface PostItProps {
    data: PostIt;
}

const getQuadrantColors = (quadrant: QuadrantKey): string => {
    switch (quadrant) {
        case 'acquis':
            return 'bg-green-100 border-green-400';
        case 'opportunites':
            return 'bg-green-200 border-green-500';
        case 'faiblesses':
            return 'bg-red-100 border-red-400';
        case 'menaces':
            return 'bg-red-200 border-red-500';
        default:
            return 'bg-gray-100 border-gray-400';
    }
};

const PostItComponent: React.FC<PostItProps> = ({ data }) => {
    const bgColor = getQuadrantColors(data.quadrant);

    const handleDragStart = (e: React.DragEvent<HTMLDivElement>) => {
        e.dataTransfer.setData('postItId', data.id);
    };
    
    const handleDelete = async () => {
        if(window.confirm('Supprimer ce post-it ?')) {
             try {
                await deleteDoc(doc(db, "postits", data.id));
            } catch (error) {
                console.error("Error deleting document: ", error);
            }
        }
    }
    
    const handleEdit = async () => {
        const newContent = prompt("Modifier le contenu:", data.content);
        if (newContent !== null && newContent.trim() !== '') {
            const postitRef = doc(db, 'postits', data.id);
            try {
                await updateDoc(postitRef, { content: newContent.trim() });
            } catch (error) {
                console.error("Error updating post-it: ", error);
            }
        }
    }
    
    const getTimestamp = () => {
        if (!data.timestamp) return '';
        const date = (data.timestamp as any).toDate ? (data.timestamp as any).toDate() : new Date((data.timestamp as any).seconds * 1000);
        return date.toLocaleTimeString('fr-FR', { hour: '2-digit', minute: '2-digit' });
    }

    return (
        <div
            draggable
            onDragStart={handleDragStart}
            className={`p-3 rounded-lg shadow-md border-l-4 cursor-grab group relative ${bgColor}`}
        >
            <p className="text-sm font-semibold text-gray-800 break-words">{data.content}</p>
            <div className="text-xs text-gray-500 mt-2 pt-2 border-t flex justify-between">
                <span className="font-bold">{data.author}</span>
                <span className="font-mono">{getTimestamp()}</span>
            </div>
            <div className="absolute top-1 right-1 flex opacity-0 group-hover:opacity-100 transition-opacity">
                <button onClick={handleEdit} className="w-6 h-6 rounded-full bg-blue-500 text-white flex items-center justify-center text-xs hover:bg-blue-600 mr-1">
                    <i className="fas fa-pencil-alt"></i>
                </button>
                 <button onClick={handleDelete} className="w-6 h-6 rounded-full bg-red-500 text-white flex items-center justify-center text-xs hover:bg-red-600">
                    <i className="fas fa-times"></i>
                </button>
            </div>
        </div>
    );
};

export default PostItComponent;
