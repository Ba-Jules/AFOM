import React from "react";

const MatrixMode: React.FC<{ sessionId: string }> = ({ sessionId }) => {
  return (
    <div className="max-w-7xl mx-auto px-4 py-8">
      <div className="mb-6">
        <h1 className="text-3xl font-black text-gray-900">
          Matrice de confrontation
        </h1>
        <p className="text-gray-600">
          Session <span className="font-mono">{sessionId}</span>
        </p>
      </div>

      <div className="rounded-2xl border bg-white shadow p-6">
        <p className="text-gray-700">
          Page « Matrice » prête. Nous allons y injecter l’auto-préremplissage
          et le calcul des scores (O×A, O×F, M×A, M×F) dans l’étape suivante.
        </p>
      </div>
    </div>
  );
};

export default MatrixMode;
