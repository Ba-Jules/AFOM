# AFOM Ultimate — mode multi-groupes

## Architecture

Le mode multi-groupes est une extension de l'application AFOM existante. Un atelier maître référence des groupes, et chaque groupe référence une session AFOM standard. Les composants historiques continuent donc à lire et écrire les contributions avec `sessionId`.

- `WorkshopDashboard` gère l'atelier, les groupes, leurs compteurs temps réel et leurs accès.
- `ConsolidatedAFOM` agrège sans fusion ni déduplication les contributions des sessions des groupes.
- `WorkshopDashboard`, `WorkInterface`, `ParticipantInterface` et `QRCodeModal` partagent les identifiants `workshop`, `group` et `session`.
- Les vues analyse et matrice restent attachées à une session individuelle.

## Modèle Firestore

```text
workshops/{workshopId}
  title, createdAt, updatedAt

workshops/{workshopId}/groups/{groupId}
  number, name, theme, sessionId, order, active, createdAt, updatedAt
```

À la création d'un groupe, `boards/{sessionId}` est également initialisé avec le nom, la thématique, `workshopId` et `groupId`. Les contributions restent dans `postits/{autoId}` et conservent leur `sessionId`. Les collections historiques ne sont ni migrées ni dupliquées.

La suppression depuis le tableau de bord est un archivage (`active: false`). Les contributions et la session restent conservées.

## Routes et paramètres

- Création d'atelier : `?v=workshop`
- Tableau de bord : `?v=workshop&workshop={workshopId}`
- Consolidation : `?v=consolidation&workshop={workshopId}`
- Groupe/modérateur : `?v=work&session={sessionId}&workshop={workshopId}&group={groupId}`
- Participant d'un groupe : `?session={sessionId}&mode=participant&workshop={workshopId}&group={groupId}`
- Ancienne session : `?session={sessionId}` ou `?v=work&session={sessionId}` reste acceptée.

## Créer un atelier et ses groupes

Depuis l'accueil AFOM, choisir **Ateliers multi-groupes**, saisir le nom de l'atelier puis sélectionner **Créer l'atelier**. Dans le tableau de bord, **+ Ajouter un groupe AFOM** demande le numéro/nom et la thématique. Un `sessionId` unique est produit automatiquement.

Chaque carte permet d'ouvrir le groupe, modifier son nom/thématique, afficher son QR, copier son lien ou archiver le groupe. Les compteurs total/Forces/Faiblesses/Opportunités/Menaces sont alimentés par `onSnapshot`.

## QR et liens

Chaque URL contient la session, l'atelier et le groupe. Le modal affiche le nom de l'atelier, le groupe et la thématique. La page participant relit ces informations dans Firestore afin que le participant puisse vérifier son groupe avant d'envoyer une contribution.

## Consolidation

La vue **Consolidation AFOM** écoute les contributions de toutes les sessions actives de l'atelier. Elle présente les quatre quadrants et indique pour chaque contribution le groupe et la thématique d'origine. Elle ne fusionne et ne supprime aucun doublon.

Filtres disponibles : tous/un groupe, tous/un quadrant, et recherche texte/auteur. Le bouton **Mode projection / imprimer** utilise une mise en page épurée à l'impression/projection.

## Compatibilité

`sessionId` demeure la clé des flux historiques : participant, travail, analyse, matrice, QR historique et temps réel. Les paramètres `workshop` et `group` sont facultatifs et strictement additifs. Aucune donnée historique n'est migrée.

## Déploiement

La branche `feature/multigroupes` est déployée indépendamment sur le VPS dans `/opt/afom-multigroupes`. Le build est servi par le conteneur Docker `afom-multigroupes` sur le port `8830`, avec redémarrage `unless-stopped`.

URL : `http://187.124.34.82:8830/AFOM/`

## Tests

L'atelier `Atelier du 7 septembre 2026` a été utilisé avec les quatre groupes demandés puis un cinquième. Les 22 scénarios demandés ont couvert création, édition, sessions distinctes, QR/liens, participant contextualisé, contributions multi-groupes, temps réel, compteurs, consolidation, origine, filtres, routes historiques, présentation, analyse, matrice et build production. Les contrôles P0 ont aussi été rejoués sur le VPS. Les données de test isolées ont été supprimées après validation.

## Limites

- Aucun système d'authentification ou de rôles n'a été ajouté; la baseline n'en possède pas.
- L'analyse reste individuelle par session. La consolidation d'atelier est fidèle aux contributions mais ne lance pas d'analyse IA globale.
- Un groupe archivé est masqué du tableau de bord et de la consolidation; ses données restent conservées.
