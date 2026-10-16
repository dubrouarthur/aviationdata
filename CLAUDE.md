# Le ciel à deux vitesses

Dashboard interactif sur le transport aérien français, construit uniquement sur les données publiques de la DGAC (data.gouv.fr).

## Commandes

- `python3 etl/fetch.py` : télécharge les 3 jeux DGAC dans `data/raw/` (data.gouv.fr doit être joignable : en local ou dans GitHub Actions, pas dans la session cloud Claude).
- `python3 etl/build.py` : lit `data/raw/`, écrit `web/public/data/*.json`. `--demo` génère des données fictives clairement signalées.
- `python3 -m pytest -q` : tests ETL (fixtures) + tests de référence (sautés si `data/raw/` est vide).
- `cd web && npm run dev | build | test` : front Vite + Observable Plot + d3, tests vitest.

## Contrat de données

- Le front ne lit que `web/public/data/*.json`. Toute clé ajoutée ou renommée se change dans `etl/build.py`, `tests/test_etl.py::test_outputs_match_json_contract` et `web/src/lib/data.js` en même temps.
- `meta.json.demo === true` => bandeau « données de démonstration » obligatoire dans l'UI.

## Pièges connus

- Somme APT (départs + arrivées) = double comptage des passagers domestiques. Les totaux France viennent de LSN.
- Les lignes sous seuil de diffusion (aéroports < 1 000 pax/mois, compagnies < 10 000) restent dans les totaux, jamais dans les classements.
- Un petit aéroport peut passer sous le seuil certains mois : afficher le trou, ne pas interpoler.
- La série PAP (paires d'aéroports) exclut les liaisons à moins de 3 opérateurs : inutilisable pour le domestique, non utilisée.
- Les fichiers DGAC peuvent être en `;` et en cp1252 : `etl/schema.py` normalise, et échoue bruyamment si une colonne attendue manque.
