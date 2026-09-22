import React, { useState } from "react";
import { login } from "../services/authService";
import { PreferenceControls, usePreferences } from "../i18n";

interface Props {
  onCancel?: () => void;
}

const LoginScreen: React.FC<Props> = ({ onCancel }) => {
  const { t } = usePreferences();
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [touched, setTouched] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setTouched(true);
    setError(null);
    if (!email.trim() || !password || submitting) return;
    setSubmitting(true);
    try {
      await login(email, password);
    } catch (err) {
      console.error(err);
      setError(t("login.failed"));
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
          <p className="text-sm text-gray-500 mt-1">{t("login.subtitle")}</p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t("login.idLabel")}</label>
            <input
              type="text"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
              className="w-full rounded-lg border px-3 py-2.5 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
              placeholder={t("login.idPlaceholder")}
            />
            {touched && !email.trim() && (
              <p className="mt-1 text-xs text-red-600">{t("login.idRequired")}</p>
            )}
          </div>

          <div>
            <label className="block text-sm font-semibold text-gray-700 mb-1">{t("login.passwordLabel")}</label>
            <div className="relative">
              <input
                type={showPassword ? "text" : "password"}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                className="w-full rounded-lg border px-3 py-2.5 pr-16 text-sm outline-none focus:ring-2 focus:ring-indigo-400"
                placeholder={t("login.passwordPlaceholder")}
              />
              <button
                type="button"
                onClick={() => setShowPassword((v) => !v)}
                className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-semibold text-indigo-600 px-2 py-1"
              >
                {showPassword ? t("login.hide") : t("login.show")}
              </button>
            </div>
            {touched && !password && (
              <p className="mt-1 text-xs text-red-600">{t("login.passwordRequired")}</p>
            )}
          </div>

          {error && <p className="text-sm text-red-600 text-center">{error}</p>}

          <button
            type="submit"
            disabled={submitting}
            className="w-full py-2.5 rounded-lg bg-indigo-600 text-white font-bold text-sm hover:bg-indigo-700 disabled:opacity-50 transition-colors"
          >
            {submitting ? t("login.connecting") : t("login.submitCta")}
          </button>

          {onCancel && (
            <button
              type="button"
              onClick={onCancel}
              className="w-full py-2 text-sm text-gray-500 hover:text-gray-700"
            >
              {t("login.backToPresentation")}
            </button>
          )}
        </form>
      </div>
    </div>
  );
};

export default LoginScreen;
