# Choix d'architecture — MonMaster API

## Modèle de données

Base relationnelle (PostgreSQL) avec une table par ressource
(`users`, `programs`, `documents`, `recommendations`, `criteria`, `letters`,
`journal_entries`). Les documents et lettres référencent leur candidature
via une clé étrangère (`ON DELETE CASCADE`), plutôt que d'être imbriqués en
JSON, pour permettre des requêtes indépendantes (ex. documents manquants,
tous programmes confondus, pour le tableau de bord).

`recommendation_programs` est une table de jointure : une recommandation
peut concerner plusieurs candidatures, et inversement — relation
many-to-many non modélisable par une simple clé étrangère.

## Authentification

JWT signés, sans stockage de session côté serveur — choix adapté à une
API séparée du frontend, sans infrastructure de session à maintenir. Chaque
route de donnée passe par un middleware (`requireAuth`) qui vérifie le
token et attache `req.userId`, utilisé ensuite pour restreindre chaque
requête SQL aux données de l'utilisateur connecté.

## Transactions

Utilisées partout où une opération touche plusieurs tables de façon
atomique : création/modification de recommandations (recommandation +
liens vers les candidatures), et import de sauvegarde (remplacement complet
des données avec réattribution des identifiants).

## Déploiement

API déployée comme fonction serverless sur Vercel (`vercel.json`), avec
PostgreSQL hébergé sur Neon — choisi pour sa compatibilité native avec les
connexions serverless. Un environnement Docker (`docker-compose.yml`) est
fourni séparément pour le développement local uniquement.
