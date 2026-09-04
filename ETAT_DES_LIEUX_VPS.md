# État des lieux — AFOM Ultimate

## Baseline

- Dépôt : `https://github.com/Ba-Jules/AFOM.git`
- Branche historique : `main`
- Commit : `be2df48ffb4847da55c6a3e417057a1bf8636b9b`
- Copie locale historique : `C:\Users\Utilisateur\Documents\_Projets-Code\Projets Famille BA\Boite outils gestion_planification\swot\EnLigneGithub`
- Copie de travail indépendante : `C:\Users\Utilisateur\Documents\_Projets-Code\Projets Famille BA\Boite outils gestion_planification\swot\afom-multigroupes`
- État local/GitHub au contrôle : propre, `main` identique à `origin/main` (avance 0, retard 0), aucun fichier modifié ou non suivi et aucun commit local non publié.
- Version historique utilisée : `https://ba-jules.github.io/AFOM/` (GitHub Pages, déploiement de `main`).

## Firestore

- Projet identifié : `afom-e475f`.
- Collections utilisées : `postits`, `boards`, `confrontations`.
- `postits/{autoId}` : `sessionId`, `quadrant`, `originQuadrant`, `content`, `author`, `status`, `sortIndex`, `timestamp`; selon l'état du post-it : `lastQuadrant`, `lastSortIndex`, `deletedAt`.
- `boards/{sessionId}` : `projectName`, `themeName`, `context` (`situationActuelle`, `symptomesObservables`, `perimetre`, et données extraites facultatives), `createdAt`, `updatedAt`.
- `confrontations/{sessionId}` : sélection de matrice, interactions/confrontations et orientations stratégiques associées à la session.
- Identifiant pivot : `sessionId`; il sert au document `boards`, au document `confrontations`, aux requêtes `postits`, aux URLs et au QR code.
- Temps réel : abonnements Firestore `onSnapshot` sur les `postits` filtrés par `sessionId` dans l'application/modérateur; les écritures participant sont faites par `addDoc`.
- Participant : route `?mode=participant&session=...`, nom facultatif ou anonyme, ajout dans `postits`.
- Modérateur : route `?v=work&session=...`; aucun mécanisme d'authentification ou rôle persistant n'est présent dans cette baseline.
- Règles Firestore : absentes du dépôt; état côté Firebase non vérifiable sans accès console/CLI approprié. Aucune règle n'a été modifiée.
- `VITE_GEMINI_API_KEY` : absente de l'environnement local; attendue comme secret GitHub Actions pour les fonctions IA.
- Configuration Firebase applicative (`apiKey`, `authDomain`, `projectId`) : présente dans le code; valeurs sensibles non reproduites dans ce rapport.

## VPS

- Chemin prévu : `/opt/afom-multigroupes` (à confirmer selon l'organisation réelle du VPS).
- Service/container : NON CRÉÉ.
- Port : NON ATTRIBUÉ.
- URL : NON ATTRIBUÉE.
- Contrôle ciblé : le seul accès retrouvé sur le poste, `jules@127.0.0.1:2222`, refuse actuellement la connexion. Les services, le reverse proxy, les ports et une éventuelle copie AFOM antérieure ne peuvent donc pas être vérifiés de façon fiable. Aucun service existant n'a été touché.

## Tests

```text
Build : PASS (npm ci puis npm run build)
Chargement : PASS sur la baseline GitHub Pages (assets chargés, aucune erreur console bloquante); NON TESTÉ sur VPS
Session : NON TESTÉ sur VPS
Participant : NON TESTÉ sur VPS
Temps réel : NON TESTÉ sur VPS
QR : présence et construction du lien confirmées dans le code; NON TESTÉ sur VPS
Modes existants : PASS sur GitHub Pages pour présentation, travail, participant, analyse et matrice; NON TESTÉS sur VPS
```

## Git

- Branche baseline : `main` (non modifiée).
- Branche de travail : `feature/multigroupes`, créée dans la copie indépendante depuis le commit baseline exact.
- Tag : `baseline-avant-multigroupes-2026-09-04`, créé et poussé sur GitHub.
- Commit de préparation : ce rapport uniquement; aucun code fonctionnel multi-groupes.
- Push : tag effectué; branche de travail à pousser avec le commit du rapport.

## Préparation multi-groupes

Fichiers/composants principalement concernés lors de la mission suivante :

- `src/types.ts` : ajouter les types `Workshop`/atelier maître et `Group`, et des références additives (`workshopId`, `groupId`) tout en conservant `sessionId`.
- `src/App.tsx` : routage et résolution additive atelier/groupe/session; maintien des URLs historiques basées sur `session`.
- Nouveau composant de tableau de bord maître (par exemple `src/components/MasterWorkshop.tsx`) : création/liste des groupes, progression, ouverture de chaque AFOM et agrégation.
- `src/components/PresentationMode.tsx` : création/édition du contexte d'un groupe depuis l'atelier maître.
- `src/components/WorkInterface.tsx` : affichage du groupe/responsable et remontée de progression, sans modifier le comportement des sessions historiques.
- `src/components/ParticipantInterface.tsx` : contexte du groupe et conservation du flux participant fondé sur `sessionId`.
- `src/components/QRCodeModal.tsx` et `src/components/Toolbar.tsx` : lien et QR propres à chaque groupe.
- `src/components/AnalysisMode.tsx` et `src/components/MatrixMode.tsx` : vues agrégées avec conservation de l'origine (`groupId`, `sessionId`) de chaque contribution.
- `src/components/Quadrant.tsx`, `src/components/PostIt.tsx` et `src/components/BinPanel.tsx` : propagation des références additives lors des créations, déplacements, tris et restaurations.
- `src/services/firebase.ts` : point de configuration uniquement; isoler éventuellement les accès dans un service de données dédié plutôt que modifier l'initialisation.

Évolution Firestore additive recommandée :

- `workshops/{workshopId}` : métadonnées de l'atelier maître.
- `workshops/{workshopId}/groups/{groupId}` : nom/numéro, thème, responsable, `sessionId`, état/progression et dates.
- Conserver `postits.sessionId`, `boards/{sessionId}` et `confrontations/{sessionId}`; ajouter facultativement `workshopId` et `groupId` aux nouveaux documents.
- Pour l'agrégation, résoudre les `sessionId` depuis les groupes puis associer chaque contribution à son groupe; les sessions anciennes sans `workshopId`/`groupId` restent lisibles telles quelles.

Principaux risques : règles/index Firestore à étendre sans ouvrir davantage les données; collisions de `sessionId`; requêtes agrégées et coût des abonnements temps réel; distinction réelle des droits modérateur principal/responsable/participant actuellement inexistante; compatibilité des anciennes URLs et documents partiels; conservation systématique de l'origine lors des déplacements et exports.

```text
Baseline historique préservée : OUI
Copie VPS indépendante opérationnelle : NON
Prêt à implémenter le mode multi-groupes : NON (accès VPS et tests de duplication requis)
```
