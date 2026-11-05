# Relais IA AFOM

La clé Gemini reste sur le serveur. AFOM l'appelle via `/AFOM/api/ai` avec le jeton Firebase du modérateur connecté.

- Accès : seuls les emails listés dans `ALLOWED_EMAILS` (séparés par des virgules).
- Plafonds : `PER_USER_DAILY_LIMIT` (300 par défaut) et `GLOBAL_DAILY_LIMIT` (1500).
- Variables : `GEMINI_API_KEY` (obligatoire), `FIREBASE_PROJECT_ID` (afom-e475f), `GEMINI_MODELS`.
- Contrôle : `GET /AFOM/api/health`.
- Test local sans clé : `node test.mjs`.

Un utilisateur qui saisit sa propre clé dans la configuration IA continue de l'utiliser directement.
