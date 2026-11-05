# État des lieux — AFOM Ultimate

## Baseline

- Dépôt : `https://github.com/Ba-Jules/AFOM.git`
- Branche historique : `main`
- Commit : `be2df48ffb4847da55c6a3e417057a1bf8636b9b`
- Copie locale historique : `C:\Users\Utilisateur\Documents\_Projets-Code\Projets Famille BA\Boite outils gestion_planification\swot\EnLigneGithub`
- Copie de travail indépendante : `C:\Users\Utilisateur\Documents\_Projets-Code\Projets Famille BA\Boite outils gestion_planification\swot\afom-multigroupes`
- État local/GitHub au contrôle : propre, `main` identique à `origin/main` (avance 0, retard 0), aucun fichier modifié ou non suivi et aucun commit local non publié.
- Version historique utilisée : `https://ba-jules.github.io/AFOM/` (GitHub Pages, déploiement de `main`).
- Profil Windows réellement chargé : `C:\Users\Utilisateur` (`%USERPROFILE%` et compte Windows actif). Le workspace fourni par Codex se trouve réellement sous ce profil; `C:\Users\asus` n'est pas le profil actif de cette session. Aucune ancienne copie d'un autre profil n'a été utilisée.

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

- Accès retrouvé dans les traces de déploiement EPC et des autres applications : utilisateur `root` sur le VPS personnel, avec la clé dédiée `~/.ssh/epc_vps_deploy` (adresse non reproduite dans ce rapport).
- Connexion SSH : PASS.
- Architecture ciblée constatée : Docker pour les applications et Nginx comme reverse proxy frontal.
- Copie historique VPS détectée : route Nginx `/AFOM/` vers `/opt/cadre-logique/www/afom/`; laissée intacte.
- Chemin indépendant : `/opt/afom-multigroupes`.
- Service/container : `afom-multigroupes` (`nginx:alpine`, politique de redémarrage `unless-stopped`).
- Port : `8830`, vérifié libre avant attribution.
- URL de test : `http://187.124.34.82:8830/AFOM/`.
- Commit déployé : `4cd07562c4727e8699e5fd7b377ca333bf569a1a`, branche `feature/multigroupes`.
- Aucun service existant n'a été interrompu ou reconfiguré.

## Tests

```text
Build : PASS sur VPS (npm ci puis npm run build)
Chargement : PASS (HTTP 200 externe, assets HTTP 200, aucune erreur console bloquante)
Session : PASS (session isolée CODEX-VPS-TEST-20260904 créée, lue puis nettoyée)
Participant : PASS (route participant et contexte Firestore chargés)
Contribution : PASS (création puis modification de quadrant confirmées)
Temps réel : PASS (contribution apparue dans la vue modérateur VPS déjà ouverte via onSnapshot)
QR : PASS (QR affiché et lien participant exact confirmé)
Modes existants : PASS pour présentation, travail, participant, analyse et matrice
Nettoyage : PASS (documents de test postit et board supprimés; aucune donnée existante touchée)
```

## Git

- Branche baseline : `main` (non modifiée).
- Branche de travail : `feature/multigroupes`, créée dans la copie indépendante depuis le commit baseline exact.
- Tag : `baseline-avant-multigroupes-2026-09-04`, créé et poussé sur GitHub.
- Commit de préparation : rapport uniquement; aucun code fonctionnel multi-groupes.
- Push : tag et branche `feature/multigroupes` effectués.

## Préparation multi-groupes

État final de la branche de développement : le mode multi-groupes P0 est implémenté. Il comprend la création d'ateliers et de groupes extensibles, l'édition/archivage, les liens et QR individuels, le participant contextualisé, le tableau de bord temps réel et la consolidation fidèle avec filtres. L'analyse et la matrice historiques restent individuelles par session.

Fichiers d'implémentation principaux : `src/components/WorkshopDashboard.tsx`, `src/components/ConsolidatedAFOM.tsx`, `src/services/workshopService.ts`, ainsi que les adaptations additives de `src/App.tsx`, `src/types.ts`, `src/components/ParticipantInterface.tsx`, `src/components/WorkInterface.tsx` et `src/components/QRCodeModal.tsx`.

Le build local et le build VPS de production sont PASS. Les 22 scénarios locaux demandés sont PASS. L'instance VPS indépendante a été mise à jour depuis `feature/multigroupes`; création/lecture de l'atelier, groupes, participant contextualisé, QR/lien, compteurs temps réel et consolidation ont été validés sur `http://187.124.34.82:8830/AFOM/`. Les données de test isolées ont ensuite été supprimées.

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
Copie VPS indépendante opérationnelle : OUI
Prêt à implémenter le mode multi-groupes : OUI
```
