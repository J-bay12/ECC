---
description: Cartographier un projet avec graphify (graphe de connaissances) au lieu de lire tous les fichiers
argument-hint: [chemin, defaut .]
---

Cartographie `$ARGUMENTS` (defaut `.`) avec graphify.

1. Si `graphify` est absent: dis a l'utilisateur d'executer `uv tool install graphifyy` puis `graphify claude install --project`. Ne l'installe pas toi-meme. Stop.
2. Sinon lance `graphify update <chemin>` (AST local, sans cout API) ou `graphify extract <chemin>` pour inclure docs/PDF.
3. Lis uniquement `graphify-out/GRAPH_REPORT.md` (resume court). Ne lis pas le code source.
4. Reponds avec: modules principaux, god nodes, 3 points d'entree. Max 15 lignes.

Ensuite, pour toute question: `graphify query "<question>"`, `graphify path "<A>" "<B>"`, `graphify explain "<concept>"` avant grep.
