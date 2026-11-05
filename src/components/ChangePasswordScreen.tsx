import React, { useState } from "react";
import { changePassword, logout } from "../services/authService";
import { PreferenceControls, usePreferences } from "../i18n";

interface Props {
  displayName: string;
}

const MIN_LEN = 8;

const ChangePasswordScreen: React.FC<Props> = ({ displayName }) => {
  const { t } = usePreferences();
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const tooShort = password.length > 0 && password.length < MIN_LEN;
  const mismatch = confirm.length > 0 && password !== confirm;

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (password.length < MIN_LEN || password !== confirm || submitting) return;
    setSubmitting(true);
    try {
      await changePassword(password);
    } catch (err) {
      console.error(err);
      setError(t("changePassword.failed"));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-50 via-white to-purple-50 flex items-center justify-center p-4">
      <div className="w-full max-w-sm bg-white rounded-2xl shadow-xl border p-8">
        <div className="flex justify-end mb-2"><PreferenceControls /></div>
        <div className="text-center mb-6">
          <h1 className="text-2xl font-black text-gray-900">{t("login.title")}</h1>
          <p className="text-sm text-gray-500 mt-1">
            {t("changePassword.greeting", { name: displayName })}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t("changePassword.newLabel")}</label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={t("changePassword.newPlaceholder", { min: MIN_LEN })}
            />
            {touched && tooShort && (
              <p className="mt-1 text-xs text-red-600">{t("changePassword.tooShort", { min: MIN_LEN })}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t("changePassword.confirmLabel")}</label>
            <input
              type="password"
              value={confirm}
              onChange={(e) => setConfirm(e.target.value)}
              autoComplete="new-password"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={t("changePassword.confirmPlaceholder")}
            />
            {touched && mismatch && (
              <p className="mt-1 text-xs text-red-600">{t("changePassword.mismatch")}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t("changePassword.submitting") : t("changePassword.submitCta")}
          </button>

          <button
            type="button"
            onClick={() => logout()}
            className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
          >
            {t("changePassword.logout")}
          </button>
        </form>
      </div>
    </div>
  );
};

export default ChangePasswordScreen;
