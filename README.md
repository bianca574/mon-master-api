# MonMaster API

API backend de [MonMaster Companion](https://github.com/bianca574/mon-master-companion) :
authentification, candidatures, documents, recommandations, critères de
décision, lettres de motivation et journal.

API en ligne : https://mon-master-api.vercel.app

## Documentation

- DESIGN : choix d'architecture du projet
- LICENSE : licence du projet
- [monmaster-companion](https://github.com/bianca574/mon-master-companion) : dépôt du frontend

## Stack technique

- Node.js + Express
- PostgreSQL (hébergé sur Neon en production)
- Authentification par JWT + bcrypt
- Vitest + Supertest (tests)
- GitHub Actions (lint, build, test avec PostgreSQL en service container)
- Docker (environnement de développement local)
- Déployé sur Vercel (fonctions serverless)

## Lancer le projet en local

### Avec Docker (recommandé)

```bash
cp .env.example .env
# renseigner JWT_SECRET dans .env
docker-compose up
```

Le schéma de base de données est chargé automatiquement au premier lancement.

### Sans Docker

Prérequis : Node 20+, PostgreSQL installé localement.

```bash
npm install
cp .env.example .env
psql -U postgres -c "CREATE DATABASE monmaster;"
psql -U postgres -d monmaster -f schema.sql
npm run dev
```

## Tests

Nécessite une base `monmaster_test` avec le schéma chargé :

```bash
psql -U postgres -c "CREATE DATABASE monmaster_test;"
psql -U postgres -d monmaster_test -f schema.sql
npm run test
```

## Variables d'environnement

Voir `.env.example`.

## Lint

```bash
npm run lint
```
