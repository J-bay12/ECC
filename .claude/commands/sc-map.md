---
description: Cartographier un projet avec graphify (graphe de connaissances) au lieu de lire tous les fichiers
argument-hint: [chemin, defaut .]
---

Cartographie `$ARGUMENTS` (defaut `.`) avec graphify.

1. Binaire: `.venv/bin/graphify`. S'il est absent: `uv venv .venv && uv pip install -p .venv -e _external_tools/graphify`.
2. Lance `.venv/bin/graphify update <chemin>` (AST local, sans cout API) ou `.venv/bin/graphify extract <chemin>` pour inclure docs/PDF.
3. Lis uniquement `graphify-out/GRAPH_REPORT.md` (resume court). Ne lis pas le code source.
4. Reponds avec: modules principaux, god nodes, 3 points d'entree. Max 15 lignes.

Ensuite: `.venv/bin/graphify query "<question>"`, `path "<A>" "<B>"`, `explain "<concept>"` avant grep.
