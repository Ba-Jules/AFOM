# RECETTE CLAUDE — CONTRE-RECETTE INDÉPENDANTE

Date : 2026-09-04
Recetteur : Claude (rôle testeur/contradicteur indépendant, aucune correction appliquée)
Branche testée : `feature/multigroupes`
Commit testé : `1689f5023d8c5eb8a1b5ff3cb7dbbd5cd399d8c9` ("docs: consigner la validation multi-groupes")
Copie locale : `C:\Users\Utilisateur\Documents\_Projets-Code\Projets Famille BA\Boite outils gestion_planification\swot\afom-multigroupes`
URL VPS testée (documentée dans MULTIGROUPES.md / ETAT_DES_LIEUX_VPS.md) : `http://187.124.34.82:8830/AFOM/`
URL locale testée (même Firestore `afom-e475f`) : `http://localhost:5173/AFOM/` (via `npm run dev`)

---

## A. Vérification Git/code

- Branche active : `feature/multigroupes`, à jour avec `origin/feature/multigroupes`. `git status` propre (seul fichier non suivi : `consignes_claude.txt`, fourni par l'utilisateur).
- HEAD : `1689f5023d8c5eb8a1b5ff3cb7dbbd5cd399d8c9`, message conforme à l'annonce.
- `main` (origin) : HEAD = `be2df48ffb4847da55c6a3e417057a1bf8636b9b`, identique à la baseline documentée. **Aucune contamination multi-groupes sur `main`.**
- Tag `baseline-avant-multigroupes-2026-09-04` : pointe bien sur `be2df48...`.
- Diff baseline → HEAD : 10 fichiers modifiés, tous cohérents avec l'annonce :
  - Nouveaux : `src/components/WorkshopDashboard.tsx`, `src/components/ConsolidatedAFOM.tsx`, `src/services/workshopService.ts`
  - Adaptés : `src/App.tsx`, `src/types.ts`, `src/components/ParticipantInterface.tsx`, `src/components/QRCodeModal.tsx`, `src/components/WorkInterface.tsx`
  - Documentation : `MULTIGROUPES.md`, `ETAT_DES_LIEUX_VPS.md` (présents, lus intégralement)
- Existence réelle confirmée par lecture de code (pas seulement par nom de fichier) : `WorkshopDashboard` ✅, `ConsolidatedAFOM` ✅, `workshopService` (createWorkshop/createGroup/participantLink/makeSessionId) ✅, types `Workshop`/`WorkshopGroup` ✅, adaptation participant (bandeau atelier/groupe) ✅, adaptation QR (paramètres workshop/group) ✅, adaptation WorkInterface (bouton "Atelier", QR enrichi) ✅.

**Verdict A : PASS.**

---

## B. Recette modérateur

Effectuée en réel depuis l'interface (pas de lecture de code seule), atelier `RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026`.

- Création de l'atelier : PASS (workshop Firestore créé, ex. id local `PzNrrkY4nHUY0ioHQb7j`).
- Création des 4 groupes demandés avec thématiques exactes : PASS
  - Groupe 1 / Transformation numérique
  - Groupe 2 / Economie numérique
  - Groupe 3 / Poste et services universels
  - Groupe 4 / Coordination et pilotage administratifs
- Ajout d'un 5ᵉ groupe ("Test groupe supplémentaire"), numérotation auto-incrémentée correcte (Groupe 5, puis Groupe 6 proposé) : PASS
- Modification numéro + thématique du Groupe 1 ("Groupe 1 (modifié)" / thème modifié) : appliquée, **persistante après rechargement complet de la page**, **aucun effet sur les Groupes 2/3/4/5** (vérifié par capture après reload). Revert manuel effectué ensuite pour la suite des tests. PASS
- Tableau de bord : compteurs groupes/contributions globaux, carte par groupe avec compteurs Total/Forces/Faib./Opp./Men. par groupe, actions Ouvrir/QR-lien/Modifier/Copier le lien/Archiver. Lisibilité immédiate, aucune fonctionnalité "techniquement présente mais introuvable" observée. PASS

**Verdict B (en local, cf. section I pour le blocage VPS) : PASS.**

---

## C. Recette participants

- QR/lien obtenus pour Groupe 1 et Groupe 2 (puis 3 et 4) : liens tous différents (session + groupId distincts pour chaque groupe, vérifié texte brut des 4 liens).
- QR affiché correspond au lien texte (même URL encodée).
- Parcours participant ouvert depuis chaque lien, dans des onglets/contextes séparés (4 groupes testés, pas seulement 2) : chaque participant voit sans ambiguïté le nom de l'atelier, son groupe et sa thématique en tête de page.
- Aucune contamination croisée observée : une contribution saisie sur le lien du Groupe 2 n'apparaît jamais dans le Groupe 1 (vérifié sur le tableau de bord ET sur la vue modérateur du Groupe 1 restée ouverte).

**Verdict C : PASS.**

---

## D. Temps réel

Protocole : onglet A = tableau de bord modérateur (ou vue groupe), onglet B = participant, contextes de navigation distincts (onglets séparés, sessions/URLs différentes).

- Contribution "RECETTE FORCE GROUPE 1" envoyée côté participant Groupe 1 → apparaît **instantanément** dans la vue modérateur du Groupe 1 (quadrant Acquis) sans rechargement, ET dans les compteurs du tableau de bord atelier (1 Total / 1 contributions), sans rechargement.
- Répété pour Groupe 2 (Faiblesse), Groupe 3 (Opportunité), Groupe 4 (Menace) : propagation temps réel confirmée à chaque fois, compteurs globaux et par groupe mis à jour en direct.
- Isolation confirmée à chaque ajout : les autres groupes/vues ouvertes ne bougent pas.

**Verdict D : PASS (en environnement où la création de groupe fonctionne, cf. section I).**

---

## E. Consolidation

- Ouverture de la Consolidation AFOM : les 4 contributions créées apparaissent, une par quadrant (Forces/Faiblesses/Opportunités/Menaces), avec mention explicite de l'origine ("Groupe X — Thématique") et de l'auteur pour chacune.
- Total consolidé (4) = total réellement créé (4). Aucune contribution manquante, dupliquée, ou changée de groupe/quadrant.
- Filtres testés : tous les groupes / un groupe seul / un quadrant seul / **combinaison Groupe 2 + Faiblesses** → résultat exact (1 contribution, la bonne).
- Rechargement complet de la page de consolidation : les 4 contributions et leur origine sont toujours affichées à l'identique. PASS persistance.

**Verdict E : PASS.**

---

## F. Compatibilité historique

- Local : ouverture de l'accueil classique, génération d'une session classique via "Aller au modérateur", test des modes Travail / Analyse / Matrice : tous fonctionnels, aucune erreur console. **Point d'attention (voir Anomalies, MINEUR) :** le mode classique réutilise le `sessionId` précédemment stocké en `localStorage`, y compris celui d'un groupe d'atelier multi-groupes ouvert juste avant — comportement documenté (MULTIGROUPES.md : "sessionId demeure la clé des flux historiques"), sans perte de donnée, mais potentiellement surprenant pour un modérateur qui pense repartir d'une session vierge.
- VPS : route historique `?v=work&session=SESSION-2026-XXX` testée directement sur `http://187.124.34.82:8830/AFOM/` → chargement propre, quadrants opérationnels, boutons Analyse/Matrice/QR Code/Supprimer/Présentation présents, **aucune erreur console**.

**Verdict F : PASS.**

---

## G. Smartphone / responsive

- Redimensionnement de fenêtre à une résolution réduite (~662×665 px, obtenue via l'outil de redimensionnement disponible dans cette session — **pas un véritable émulateur de device mobile**, limite à noter) :
  - Parcours participant : carte centrée, lisible, tous les champs et boutons (nom, catégorie, contribution, Envoyer/Nouveau) accessibles sans coupure.
  - Tableau de bord modérateur : bascule en une colonne, cartes groupe lisibles, toutes les actions accessibles.
  - Vue modérateur "Travail" (quadrants) : quadrants empilés verticalement, lisibles ; le bandeau de boutons supérieur (Analyse/Matrice/QR Code/Supprimer/Présentation) est visuellement dense à cette largeur mais reste cliquable, aucun bouton essentiel inaccessible.

**Verdict G : PASS avec réserve mineure (bandeau de boutons dense en très faible largeur) et limite d'outil (pas de device réel testé).**

---

## H. Robustesse (erreurs plausibles)

| Scénario | Comportement observé | Sévérité |
|---|---|---|
| Thématique vide à la création/modification d'un groupe | Clic "Enregistrer" sans effet, aucun message d'erreur visible pour le modérateur | MINEUR |
| Nom/numéro de groupe vide | Idem : refus silencieux, aucun message | MINEUR |
| URL participant avec `session`/`group` inexistants | Page se charge sans erreur bloquante, affiche "Projet : — / Thème : —", aucun message avertissant que le lien est invalide ; une contribution orpheline pourrait être soumise sans que le participant soit prévenu | MINEUR |
| Double-clic sur "Envoyer" (participant) | **Protégé** : bouton désactivé pendant l'envoi (`disabled={submitting}`), pas de doublon possible | — (PASS, hérité de la baseline) |
| Double-clic sur "Enregistrer" (création/édition de groupe, modérateur) ou sur "Créer l'atelier" | **Non protégé** : aucun état `submitting`/`disabled` pendant l'écriture Firestore asynchrone → un double-clic rapide pourrait créer un groupe ou un atelier en double (non testé en conditions de double-clic réel, constaté par lecture de code) | MINEUR |
| Navigation retour / ouverture successive de plusieurs groupes | Testé (4 groupes ouverts successivement en vues modérateur séparées) : aucun mélange, chaque vue reste liée à son `session`/`group` | PASS |

**Verdict H : PASS global, avec anomalies MINEURES documentées ci-dessus.**

---

## I. Risque critique Firestore / VPS — ANOMALIE BLOQUANTE

**C'est le point central de cette contre-recette : les affirmations de Codex sur la validation VPS ne sont pas reproductibles telles quelles.**

### I.1 — Constat

En testant réellement l'URL VPS documentée (`http://187.124.34.82:8830/AFOM/`) depuis un navigateur :
1. Création de l'atelier "RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026" : **PASS** (le document `workshops/{id}` est bien créé).
2. Création d'un groupe ("+ Ajouter un groupe AFOM" → "Enregistrer") : **échec systématique**, sans aucun retour visuel (le compteur reste à "0 groupes", le formulaire reste ouvert).
3. Console navigateur (`http://187.124.34.82:8830/AFOM/`) :
   ```
   TypeError: crypto.randomUUID is not a function
       at (workshopService.ts → makeSessionId)
   ```
4. Diagnostic confirmé par exécution JS sur la page :
   ```json
   {"isSecureContext": false, "protocol": "http:", "hasRandomUUID": "undefined", "hostname": "187.124.34.82"}
   ```

### I.2 — Cause exacte

`makeSessionId()` (`src/services/workshopService.ts`) appelle `crypto.randomUUID()` sans garde. Cette API n'est disponible que dans un **contexte sécurisé** au sens du navigateur (HTTPS, ou `localhost`/`127.0.0.1`). Le VPS est servi en **HTTP brut sur une adresse IP** (`http://187.124.34.82:8830/`), qui n'est **pas** un contexte sécurisé pour n'importe quel navigateur (Chrome, Firefox, Safari, y compris mobile) — ce n'est pas une particularité de l'outil de test, c'est une règle du standard Web Crypto appliquée par tous les navigateurs.

En local (`http://localhost:5173/`), `localhost` est un contexte sécurisé par exception du navigateur : c'est pourquoi la création de groupe fonctionne parfaitement en local et échoue à l'identique sur le VPS déployé.

**Conséquence directe :** sur l'URL VPS telle que documentée et déployée, **le modérateur ne peut créer aucun groupe**, donc ne peut pas obtenir les 4 FFOM demandées. Le participant (qui ne fait que `addDoc` sur `postits`, sans appel à `crypto.randomUUID`) ne serait pas affecté une fois qu'un groupe existe — mais aucun groupe ne peut exister sur cette URL.

### I.3 — Écart avec les affirmations de Codex

`MULTIGROUPES.md` ("Tests") et `ETAT_DES_LIEUX_VPS.md` ("Préparation multi-groupes") annoncent : *"L'instance VPS indépendante a été mise à jour depuis feature/multigroupes ; création/lecture de l'atelier, groupes, participant contextualisé, QR/lien, compteurs temps réel et consolidation ont été validés sur http://187.124.34.82:8830/AFOM/."*

Ce constat **n'est pas reproductible** : la création de groupe échoue à 100% des tentatives (2 tentatives distinctes, même résultat, même exception). Soit le contrôle annoncé n'a pas été rejoué sur cette URL exacte après le dernier déploiement du code multi-groupes, soit il a été fait autrement qu'en conditions réelles de navigateur (ex. build antérieur au commit qui introduit `crypto.randomUUID`, ou test via un canal différent). Le commit VPS noté dans `ETAT_DES_LIEUX_VPS.md` (`4cd0756...`) est d'ailleurs **antérieur** à l'introduction du code multi-groupes (il correspond au commit "docs: documenter la baseline avant multi-groupes"), ce qui suggère que cette section de documentation n'a pas été mise à jour après un redéploiement ultérieur — le VPS actuellement en ligne exécute pourtant bien le code multi-groupes (bouton "Ateliers multi-groupes" présent, atelier créable), donc un redéploiement a bien eu lieu, mais sans que la validation "groupes" ait été rejouée dessus avec succès.

### I.4 — Isolation Firestore (ce qui fonctionne)

Indépendamment du bug ci-dessus, l'isolation testée en local est saine :
- `sessionId` unique par groupe (`AFOM-{année}-{8 hex}`), pas de collision observée sur 4 créations.
- Requêtes `postits` filtrées par `sessionId` : aucun mélange entre groupes observé sur 4 groupes + contributions croisées testées.
- `workshops/{id}/groups/{id}` correctement isolé par atelier.
- Cohérence `sessionId ↔ groupId ↔ workshopId` vérifiée par lecture des documents `boards/{sessionId}` (contient bien `workshopId`/`groupId`).

Aucune règle Firestore modifiée, aucune donnée existante (hors données de recette créées par ce test) touchée.

### I.5 — Accès VPS / SSH

La vérification indépendante du commit exact exécuté sur le VPS via SSH (`~/.ssh/epc_vps_deploy`) a été **bloquée par le classificateur de sécurité de l'environnement d'exécution** (accès root à un serveur distant refusé automatiquement, avant même toute tentative de commande). Ce point n'a donc pas pu être vérifié autrement que par observation du comportement HTTP/JS de l'application déployée (section I.1-I.3), qui suffit à démontrer l'anomalie indépendamment du commit exact.

**Verdict I : BLOQUANT.**

---

## J. Anomalies — synthèse et classification

| # | Anomalie | Sévérité | Composant | Reproductibilité |
|---|---|---|---|---|
| 1 | Création de groupe impossible sur l'URL VPS documentée (`crypto.randomUUID` indisponible en contexte HTTP non-localhost) | **BLOQUANT** | `src/services/workshopService.ts` (`makeSessionId`) | 100% (2/2 tentatives) |
| 2 | Pas de protection anti-double-clic sur "Enregistrer" (groupe) / "Créer l'atelier" côté modérateur | MINEUR | `src/components/WorkshopDashboard.tsx` | Non testé en direct (constat code) |
| 3 | Validation silencieuse (thématique/nom vide) sans message d'erreur | MINEUR | `src/components/WorkshopDashboard.tsx` | 100% |
| 4 | Lien participant invalide (session/groupe inexistants) sans message d'erreur explicite | MINEUR | `src/components/ParticipantInterface.tsx` | 100% |
| 5 | Réutilisation surprenante du `sessionId` du dernier groupe visité par le mode classique (accueil sans paramètres) | MINEUR/COSMÉTIQUE | `src/App.tsx` (localStorage partagé) | 100%, comportement documenté et volontaire |
| 6 | Redondance d'affichage "Groupe X" côté participant (titre + libellé Projet) | COSMÉTIQUE | `src/components/ParticipantInterface.tsx` | — |

**Aucun bug MAJEUR** identifié rendant une fonction demandée non fiable *dans un contexte sécurisé* (local/HTTPS). **Un bug BLOQUANT** identifié spécifiquement sur le déploiement VPS documenté.

---

## K. Note de méthode — écart avec le protocole demandé

Les consignes demandaient de recetter prioritairement l'instance VPS déployée. La création de groupe y étant bloquante (section I), la majorité des scénarios fonctionnels (sections B à H) ont été rejoués sur l'environnement local (`npm run dev`, même projet Firestore `afom-e475f` que le VPS — vérifié via `src/services/firebase.ts`), qui est le seul environnement où la fonctionnalité est utilisable de bout en bout avec les outils disponibles dans cette session. Les résultats PASS de ces sections attestent donc que **la logique applicative est correcte**, mais **ne couvrent pas** le déploiement VPS tel qu'il est actuellement exposé.

Un contournement opérationnel *existe déjà dans l'application sans aucune modification de code* : le modal QR affiche un avertissement "Serveur local détecté" avec un champ pour saisir une IP réseau — ce mécanisme, combiné à un lancement de l'outil sur la machine du modérateur (contexte sécurisé `localhost` pour la création de groupes) et à une distribution des liens participants via l'IP locale du réseau Wi-Fi, contournerait le bug pour un atelier en présentiel sur un même réseau local, sans dépendre du VPS. Ceci est une **observation**, pas une correction ni une proposition de développement.

Données de recette créées (à nettoyer avant l'atelier réel) :
- Local (Firestore `afom-e475f`) : atelier "RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026" (5 groupes, 4 contributions) + atelier antérieur "Atelier du 7 septembre 2026" (1 groupe "Marketing digital", créé lors d'un test applicatif préalable à cette mission).
- VPS (même projet Firestore) : atelier "RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026" (0 groupe, la création ayant échoué — cf. section I).
- Nettoyage non effectué via l'interface : l'archivage déclenche une boîte de dialogue JavaScript (`confirm()`) que les règles de sécurité de cet environnement m'interdisent de déclencher automatiquement. Suppression manuelle recommandée (console Firebase ou interface, en confirmant soi-même les dialogues) avant lundi.

---

## Vérité de non-modification (au moment de la recette initiale, avant correctif)

- Code fonctionnel modifié par Claude : NON
- `main` modifiée : NON
- Firestore / règles modifiés : NON
- VPS modifié : NON
- Commit / push effectués par Claude : NON

---

## ADDENDUM — 2026-09-04 (suite à la demande explicite de l'utilisateur) : correction du bug BLOQUANT #1

À la demande explicite de l'utilisateur ("corrige le bug crypto.randomUUID sur le VPS"), le rôle de ce recetteur est passé de testeur strict à correcteur pour cette seule anomalie. Toutes les autres anomalies (MINEURES/COSMÉTIQUES, section J) n'ont **pas** été corrigées et restent telles que documentées ci-dessus.

**Correctif appliqué** : `src/services/workshopService.ts` — `makeSessionId()` n'appelle plus `crypto.randomUUID()` (indisponible hors contexte sécurisé) mais un générateur d'hexadécimal aléatoire basé sur `crypto.getRandomValues()` (disponible dans tous les contextes, y compris HTTP sur adresse IP), avec repli `Math.random()` en dernier recours si l'API Crypto est totalement absente.

**Étapes réalisées :**
1. Build local (`tsc -noEmit && vite build`) : PASS.
2. Non-régression locale : création d'un 6ᵉ groupe sur `http://localhost:5173/AFOM/` : PASS.
3. Commit `968a5c7` sur `feature/multigroupes` ("fix: remplacer crypto.randomUUID par un generateur compatible HTTP"), poussé sur `origin/feature/multigroupes`.
4. Déploiement VPS : `git pull` (fast-forward `1689f50` → `968a5c7`) puis `npm run build` dans `/opt/afom-multigroupes`, exécutés via SSH (`~/.ssh/epc_vps_deploy`). Le conteneur `afom-multigroupes` (nginx:alpine) sert le dossier `dist/` en bind-mount en lecture seule : aucun redémarrage de conteneur n'a été nécessaire, le nouveau build est servi immédiatement (bundle `index-Di_omQxU.js` confirmé via `curl`).
5. **Re-test réel sur le VPS après déploiement** : création des 4 groupes demandés (Transformation numérique / Economie numérique / Poste et services universels / Coordination et pilotage administratifs) directement sur `http://187.124.34.82:8830/AFOM/?v=workshop&workshop=jc5z1BhCtR0quEdbGsid` : **PASS** (aucune exception, `isSecureContext` toujours `false` mais `crypto.getRandomValues` bien utilisé).
6. Circuit complet re-testé sur le VPS : QR/lien du Groupe 1 → ouverture participant → contribution "VALIDATION CORRECTIF VPS" en catégorie Acquis → **apparition instantanée côté modérateur sans rechargement** (temps réel confirmé sur le VPS). Aucune erreur console.

**Vérité de non-modification, mise à jour après l'addendum :**
- Code fonctionnel modifié par Claude : **OUI** (1 fichier, `src/services/workshopService.ts`, à la demande explicite de l'utilisateur)
- `main` modifiée : NON (modification uniquement sur `feature/multigroupes`)
- Firestore / règles modifiés : NON
- VPS modifié : **OUI** (pull + rebuild à la demande explicite de l'utilisateur ; aucune autre configuration touchée)
- Commit / push effectués par Claude : **OUI**, à la demande explicite de l'utilisateur (commit `968a5c7`, poussé sur `origin/feature/multigroupes`)

**Anomalie #1 (BLOQUANT) reclassée : RÉSOLUE ET VÉRIFIÉE EN CONDITIONS RÉELLES SUR LE VPS.**

Les anomalies #2 à #6 (section J) restent ouvertes, non corrigées, à traiter séparément si besoin.

**Nouveau verdict global (sous réserve de traiter ou d'accepter les anomalies MINEURES restantes) :**

PRÊT POUR L'ATELIER DU 7 SEPTEMBRE 2026 : **OUI**, avec réserves mineures documentées en section J (aucune ne bloque l'usage prévu par Mouhamed BA).

Données de test créées durant cette vérification post-correctif sur le VPS (atelier "RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026", 4 groupes, 1 contribution) à nettoyer avant lundi, au même titre que les données mentionnées en section K.

**Mise à jour 2026-09-05 :** à la demande explicite de l'utilisateur, l'ensemble des données de recette a été supprimé de Firestore (`afom-e475f`, projet unique partagé par le local et le VPS) via un script ponctuel utilisant le SDK client Firebase (mêmes permissions que l'application, aucune règle modifiée). Quatre ateliers de test supprimés intégralement (documents `workshops`, sous-collection `groups`, `boards/{sessionId}`, `confrontations/{sessionId}`, `postits` associés) : `LQ1im64HlWgBpERPYjnV` ("Atelier du 7 septembre 2026", 1 groupe), `hmxA47O2Lk66xathN2aX` (doublon vide du même titre), `PzNrrkY4nHUY0ioHQb7j` ("RECETTE CLAUDE — ATELIER 7 SEPTEMBRE 2026", local, 6 groupes), `jc5z1BhCtR0quEdbGsid` (idem, VPS, 4 groupes). Vérification finale : collection `workshops` vide. Le script temporaire n'a pas été conservé dans le dépôt.
