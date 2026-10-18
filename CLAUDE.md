# Le ciel à deux vitesses

Dashboard interactif sur le transport aérien français, construit uniquement sur les données publiques de la DGAC (data.gouv.fr).

## Commandes

- `python3 etl/fetch.py` : télécharge les 3 jeux DGAC dans `data/raw/` (data.gouv.fr doit être joignable : en local ou dans GitHub Actions, pas dans la session cloud Claude).
- `python3 etl/build.py` : lit `data/raw/`, écrit `web/public/data/*.json`. `--demo` génère des données fictives clairement signalées.
- `python3 -m pytest -q` : tests ETL (fixtures) + tests de référence (sautés si `data/raw/` est vide).
- `cd web && npm run dev | build | test` : front Vite + d3 (vanilla), tests vitest.
- `python3 web/scripts/interact.py` : parcours Playwright de toutes les interactions (servir `web/dist` sur 127.0.0.1:4173) ; `web/scripts/story_shots.py DIR "#sel,..." [--mobile]` pour les captures.
- `python3 web/scripts/audit_numbers.py` : recalcule en Python chaque chiffre écrit dans le récit et le compare au texte affiché (même serveur).
- `python3 promo/capture.py && python3 promo/render.py` : film promo (graphiques réels filmés image par image, horloge simulée), sortie dans `promo/out/` (non versionné).
- Déploiement : Vercel lit `vercel.json` (build `web/`, sortie `web/dist`) ; `SITE_URL` ou le domaine Vercel rend les balises og:image absolues. Pas d'`ignoreCommand` : Vercel ne construit que le dernier commit d'un push, et un `git diff HEAD^ HEAD` sautait tout push finissant par un commit hors `web/`.

## Contrat de données

- Le front ne lit que `web/public/data/*.json`. Toute clé ajoutée ou renommée se change dans `etl/build.py`, `tests/test_etl.py::test_outputs_match_json_contract` et `web/src/lib/data.js` en même temps.
- `meta.json.demo === true` => bandeau « données de démonstration » obligatoire dans l'UI.

## Pièges connus

- Somme APT (départs + arrivées) = double comptage des passagers domestiques. Les totaux France viennent de LSN.
- Les lignes sous seuil de diffusion (aéroports < 1 000 pax/mois, compagnies < 10 000) restent dans les totaux, jamais dans les classements.
- Un petit aéroport peut passer sous le seuil certains mois : afficher le trou, ne pas interpoler.
- La série PAP (paires d'aéroports) exclut les liaisons à moins de 3 opérateurs ou dominées à plus de 85 % : elle ne sert qu'aux cartes de liaisons (France, aéroport), jamais aux totaux, et le texte le précise.
- Les fichiers DGAC peuvent être en `;` et en cp1252 : `etl/dgac.py` normalise, et échoue bruyamment si une colonne attendue manque.
- data.gouv.fr est injoignable depuis la session cloud Claude (connexion coupée après le CONNECT) : passer par un relais `DGAC_RELAY_URL/TOKEN/KEY` (voir `etl/fetch.py`), jamais commité.
- Les CSV CO2 (EMI_TOT, EMI_UNI) sont au format large, une ligne par segment, sans unité dans l'en-tête : Mt vs g/Peq-km se distinguent par l'ordre de grandeur.
- Dans LSN, le domestique n'existe qu'agrégé par faisceau (MET_RAD, MET_TRA, MET_OM, OM_OM), pas par liaison.
- Les noms DGAC sont en majuscules sans accents : `pretty_name()` + table `ACCENTS` dans `etl/build.py`.
- Aéroports fermés absents d'OurAirports : coordonnées dans `data/ref/airports_manual.csv`.
- Les faits extérieurs aux données (taxe TSBA, Ormuz, Ryanair) sont datés et sourcés dans `sources.js` ; les vérifier avant toute mise à jour du texte, jamais de lien de cause affirmé.
- Photo de l'auteur : publiée sur le site à sa demande (`web/public/auteur.jpg`) ; le film lit sa propre copie dans `promo/out/portrait.jpg` (non versionnée) ; un graphique filmé dans une grille `.grid-2` doit passer la grille sur une colonne (CSS de scène), sinon le panneau voisin déborde dans l'image.
- Une animation d'entrée (whileVisible, IntersectionObserver) ne joue qu'une fois : `promo/capture.py` filme les scènes dans l'ordre de la page pour ne pas la consommer avant sa scène.
