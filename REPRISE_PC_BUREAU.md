# Reprise AFOM Ultimate — PC Bureau

Ce fichier permet de reprendre le chantier AFOM Ultimate immédiatement depuis un autre poste (PC bureau, Claude Code, Codex, ou manuellement), sans dépendance au PC actuel.

## Dépôt et branche

- Dépôt GitHub : https://github.com/Ba-Jules/AFOM.git
- Branche de référence opérationnelle : `feature/multigroupes`
- Ne PAS créer de nouvelle branche, ne PAS travailler sur `main`.
- Commit HEAD figé pour cette reprise : voir le tag `atelier-2026-09-07-ready` (pointe exactement sur ce commit)
- Baseline historique intacte : branche `main` au commit `be2df48ffb4847da55c6a3e417057a1bf8636b9b`
- Tag de baseline existant (avant tout travail multi-groupes) : `baseline-avant-multigroupes-2026-09-04`
- Tag de reprise créé pour cette mission : `atelier-2026-09-07-ready`

## Procédure de reprise

**Cas A — dépôt déjà présent sur le nouveau PC :**

```
git fetch origin
git checkout feature/multigroupes
git pull --ff-only origin feature/multigroupes
git status
```

**Cas B — dépôt absent (nouveau poste) :**

```
git clone https://github.com/Ba-Jules/AFOM.git
cd AFOM
git checkout feature/multigroupes
npm ci
npm run build
```

## Production / déploiement

- URL production : http://187.124.34.82:8830/AFOM/
- Chemin sur le VPS : `/opt/afom-multigroupes` (checkout git de `feature/multigroupes`)
- Méthode de déploiement : `git pull` puis `npm ci` si nécessaire puis `npm run build` — pas de pipeline CI/CD.
- Conteneur Docker : `afom-multigroupes` (nginx:alpine), bind-mount **read-only** de `dist/` sur `/usr/share/nginx/html/AFOM`, port `8830→80`.
- Le bind-mount étant live, **aucun redémarrage de conteneur n'est nécessaire** après un rebuild : reconstruire `dist/` sur le VPS suffit.
- Vérification d'un déploiement : comparer le hash du bundle JS (`assets/index-XXXXXXXX.js`) entre le build local et un `curl` de l'URL live.

## Architecture Firebase / authentification

- Projet Firebase : `afom-e475f` (partagé avec `main` — une seule base Firestore pour les deux branches).
- Authentification : Firebase Authentication (email/password), activée manuellement dans la console (jamais activée avant cette mission).
- Modèle : collection `users/{uid}` avec champ `role` (`moderator` ou `admin`).
- Comptes existants (mot de passe non inscrit ici, volontairement — voir hygiène des secrets) :
  - Mouhamed BA : `mouhba@gmail.com` — rôle moderator
  - Administrateur : `bapamadou@gmail.com` — rôle admin
- Le mot de passe provisoire est partagé et connu de l'utilisateur ; il n'y a pas de changement de mot de passe forcé (choix explicite de l'utilisateur, priorité à la simplicité pour un outil familial).

## État actuel des règles Firestore

Fichier source : `firestore.rules` (racine du dépôt), à publier manuellement dans la console Firebase (pas d'accès CLI/service-account) :
https://console.firebase.google.com/project/afom-e475f/firestore/rules

- `boards`, `postits`, `confrontations` : ouverts (`allow read, write: if true`), exactement comme avant l'ajout de l'authentification.
- `workshops`, `workshops/*/groups`, `users` : protégés, nécessitent un compte moderator/admin authentifié.

**Pourquoi ouverts pour boards/postits/confrontations :** la branche historique `main` (déjà utilisée par Mouhamed BA, sans aucune notion de compte) partage le même projet Firebase et les mêmes collections. Les documents `postits` ne portent pas de champ `workshopId`/`groupId` (seul le `board` qui les référence le porte), donc il n'existe pas de moyen propre de restreindre uniquement le sous-ensemble multi-groupes sans casser `main`. Restreindre ces collections a été testé (2026-09-06) et cassait entièrement le flux anonyme de `main` (lecture, écriture, temps réel, Analyse, Matrice). Choix assumé : ces collections restent ouvertes ; seules les collections strictement nouvelles et absentes de `main` (`workshops`, `groups`, `users`) sont protégées.

## Fonctionnalités validées (dernier test réel, 2026-09-06/07)

| Fonctionnalité | Statut |
|---|---|
| Présentation | PASS |
| Préparation atelier | PASS |
| Multi-groupes | PASS |
| QR / liens | PASS |
| Participant public | PASS |
| Temps réel | PASS |
| Consolidation | PASS |
| Authentification | PASS |
| Compte Mouhamed (mouhba@gmail.com) | PASS |
| Compte admin (bapamadou@gmail.com) | PASS |
| Compatibilité main (anonyme, sans compte) | PASS |
| Analyse | PASS |
| Matrice | PASS |

Tous les tests ont été effectués directement en production (http://187.124.34.82:8830/AFOM/), avec nettoyage systématique des données de test créées (post-its, boards, groupes, ateliers supprimés après vérification).

## Limites connues

- Pas de récupération de mot de passe par email (hors périmètre de la mission d'authentification, exclu explicitement).
- Le changement de mot de passe est volontaire (composant `ChangePasswordScreen` présent mais non branché), pas de rotation forcée.
- `boards`/`postits`/`confrontations` restent ouverts à quiconque possède l'identifiant de session — pas de cloisonnement par atelier au niveau des règles Firestore (limitation du modèle de données existant, pas un oubli).
- Pas de pipeline CI/CD sur le VPS : le déploiement est manuel (SSH + git pull + build).
- Pas d'accès Firebase CLI/service-account : toute modification des règles Firestore doit être publiée manuellement via la console (copier-coller par presse-papiers, pas de frappe directe — l'éditeur Monaco corrompt les accolades en cas de frappe simulée).

## Hygiène des secrets

- Aucun mot de passe, token, ou clé n'est inscrit dans ce fichier ni dans aucun fichier versionné.
- `consignes_claude.txt` est suivi par Git mais ne doit jamais être commité s'il contient un mot de passe en clair (vérifier le diff avant chaque commit).
