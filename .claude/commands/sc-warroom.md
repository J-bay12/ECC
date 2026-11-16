---
description: Analyser du matériel (consignes, résultats, rapports) et relancer les simulations War Room
argument-hint: <chemin ou texte du matériel>
---

Matériel: $ARGUMENTS

1. Extrais les données chiffrées (par équipe et par tour: price, mkt, rd, rev, profit, share) avec `sc-scout` si le matériel est volumineux. Écris-les en CSV ou JSON dans `war-room/data/` (colonnes: round,team,price,mkt,rd,rev,profit,share).
2. Lance `node war-room/cli.js war-room/data/<fichier> --rounds 3 --obj prudent`, puis `--obj profit` et `--aggr 1` pour comparer les scénarios.
3. Fais challenger les hypothèses (paramètres estimés, plafonds, règles du jeu) par `sc-architect`.
4. Réponse: décision recommandée par tour, risque, mouvements attendus des concurrents, hypothèses douteuses. 15 lignes max.
Rappel: le modèle est une approximation calibrée sur l'historique fourni, pas les règles exactes du simulateur.
