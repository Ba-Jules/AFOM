import React, { useEffect, useState } from "react";
import { QRCodeSVG } from "qrcode.react";

interface QRCodeModalProps {
  isOpen: boolean;
  onClose: () => void;
  sessionId: string;
}

const isLocalhost =
  window.location.hostname === "localhost" ||
  window.location.hostname === "127.0.0.1";

const QRCodeModal: React.FC<QRCodeModalProps> = ({ isOpen, onClose, sessionId }) => {
  // IP réseau saisie manuellement (utile en local uniquement)
  const [networkIP, setNetworkIP] = useState(
    () => localStorage.getItem("afom_network_ip") || ""
  );
  const [editingIP, setEditingIP] = useState(false);
  const [ipDraft, setIpDraft] = useState(networkIP);

  useEffect(() => {
    if (isOpen) setIpDraft(networkIP);
  }, [isOpen, networkIP]);

  if (!isOpen) return null;

  // URL de base : IP réseau si fournie, sinon origin
  const base =
    isLocalhost && networkIP.trim()
      ? networkIP.trim().replace(/\/$/, "")
      : window.location.origin;

  const participantUrl = `${base}${window.location.pathname}?session=${encodeURIComponent(sessionId)}&mode=participant`;

  const handleSaveIP = () => {
    const val = ipDraft.trim();
    setNetworkIP(val);
    localStorage.setItem("afom_network_ip", val);
    setEditingIP(false);
  };

  const copyUrl = async () => {
    await navigator.clipboard.writeText(participantUrl);
    alert("Lien copié !");
  };

  return (
    <div
      className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose}
    >
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-sm text-center"
        onClick={(e) => e.stopPropagation()}
      >
        {/* En-tête */}
        <div className="px-6 pt-6 pb-4">
          <h3 className="text-xl font-black text-gray-800 mb-1">
            📱 Scannez pour participer
          </h3>
          <p className="text-xs text-gray-500">
            Session : <span className="font-mono">{sessionId}</span>
          </p>
        </div>

        {/* Alerte localhost */}
        {isLocalhost && (
          <div className="mx-4 mb-3 rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-left">
            <div className="text-xs font-bold text-amber-800 mb-1">
              ⚠️ Serveur local détecté
            </div>
            {!networkIP ? (
              <>
                <p className="text-xs text-amber-700 mb-2">
                  Les participants sur d'autres appareils ne peuvent pas
                  accéder à <code>localhost</code>. Entrez l'adresse IP de
                  votre machine sur le réseau Wi-Fi.
                </p>
                <p className="text-[11px] text-amber-600 mb-2">
                  Retrouvez-la avec{" "}
                  <code className="bg-amber-100 px-1 rounded">
                    ipconfig
                  </code>{" "}
                  (Windows) ou{" "}
                  <code className="bg-amber-100 px-1 rounded">
                    ifconfig
                  </code>{" "}
                  (Mac/Linux) — ex. <strong>192.168.1.42</strong>
                </p>
              </>
            ) : (
              <p className="text-xs text-amber-700 mb-2">
                IP réseau configurée :{" "}
                <span className="font-mono font-bold">{networkIP}</span>
              </p>
            )}

            {editingIP ? (
              <div className="flex gap-2 mt-1">
                <input
                  autoFocus
                  value={ipDraft}
                  onChange={(e) => setIpDraft(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSaveIP()}
                  placeholder="http://192.168.1.42:5173"
                  className="flex-1 text-xs border rounded-lg px-2 py-1.5 font-mono focus:outline-none focus:ring-2 focus:ring-amber-400"
                />
                <button
                  onClick={handleSaveIP}
                  className="px-3 py-1.5 rounded-lg bg-amber-500 text-white text-xs font-bold"
                >
                  OK
                </button>
                <button
                  onClick={() => setEditingIP(false)}
                  className="px-2 py-1.5 rounded-lg border text-xs text-gray-500"
                >
                  ×
                </button>
              </div>
            ) : (
              <button
                onClick={() => setEditingIP(true)}
                className="text-xs text-amber-700 underline font-medium"
              >
                {networkIP ? "Modifier l'IP réseau" : "Entrer l'IP réseau →"}
              </button>
            )}
          </div>
        )}

        {/* QR Code */}
        <div className="flex justify-center px-6 pb-2">
          <div className="p-4 bg-gray-50 rounded-xl border-2 border-gray-200 inline-block">
            <QRCodeSVG value={participantUrl} size={200} />
          </div>
        </div>

        {/* URL */}
        <div className="mx-4 mb-4 p-2 bg-gray-100 rounded-lg font-mono text-[10px] text-gray-600 break-all text-left leading-relaxed">
          {participantUrl}
        </div>

        {/* Actions */}
        <div className="px-4 pb-5 flex gap-2">
          <button
            onClick={copyUrl}
            className="flex-1 py-2.5 border border-gray-300 bg-white rounded-xl text-sm font-semibold text-gray-700 hover:bg-gray-50 transition"
          >
            📋 Copier le lien
          </button>
          <button
            onClick={onClose}
            className="flex-1 py-2.5 bg-indigo-600 text-white font-bold rounded-xl text-sm hover:bg-indigo-700 transition"
          >
            Fermer
          </button>
        </div>
      </div>
    </div>
  );
};

export default QRCodeModal;
