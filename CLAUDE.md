# aviationdata

Site d'enquêtes en données ouvertes sur le transport aérien : une page d'accueil (`web/index.html`) et une page par enquête, chacune dans son dossier (`web/le-ciel-a-deux-vitesses/`, données DGAC ; `web/courant-jet/`, courant-jet et vols transatlantiques). Une nouvelle enquête = un dossier + une entrée dans `PAGES` (`web/vite.config.js`) + une bande sur l'accueil.

## Commandes

- `python3 etl/fetch.py` : télécharge les 3 jeux DGAC dans `data/raw/` (data.gouv.fr doit être joignable : en local ou dans GitHub Actions, pas dans la session cloud Claude).
- `python3 etl/build.py` : lit `data/raw/`, écrit `web/public/data/*.json`. `--demo` génère des données fictives clairement signalées.
- `python3 -m pytest -q` : tests ETL (fixtures) + tests de référence (sautés si `data/raw/` est vide).
- `cd web && npm run dev | build | test` : front Vite + d3 (vanilla), tests vitest.
- `python3 web/scripts/interact.py` : parcours Playwright de toutes les interactions (servir `web/dist` sur 127.0.0.1:4173) ; `web/scripts/story_shots.py DIR "#sel,..." [--mobile]` pour les captures.
- `python3 web/scripts/audit_numbers.py` : recalcule en Python chaque chiffre écrit dans le récit et le compare au texte affiché (même serveur).
- `python3 web/scripts/check_site.py` : accueil, anciens liens, enquête courant-jet (liens, explorateur, mobile) et chaque chiffre de son texte recalculé depuis `web/public/data/jet/*.json`.
- Courant-jet : `etl/jet/{opensky,era5_daily,era5,reanalysis,nao,radiosonde,nasa}.py` téléchargent dans `data/raw/` (hors session cloud si un hôte est bloqué), puis `python3 etl/jet/build_jet.py` écrit `web/public/data/jet/` et `web/src/jet/route.fixture.json`. `python3 web/scripts/og_jet.py` refait `web/public/og-jet.jpg`.
- `python3 promo/capture.py && python3 promo/render.py` : film promo (graphiques réels filmés image par image, horloge simulée), sortie dans `promo/out/` (non versionné).
- Reel LinkedIn 4:5 avec vidéos de fond : `python3 promo/capture.py --theme dark && python3 promo/reel_footage.py && python3 promo/render.py --page reel.html --size 1080x1350 --out promo/out/le-ciel-a-deux-vitesses-reel-4x5.mp4`. Les rushes Pexels (auteurs et liens dans `promo/reel.json`) sont téléchargés dans `promo/out/footage/` et ne doivent jamais être versionnés (licence : pas de redistribution).
- Déploiement : Vercel lit `vercel.json` (build `web/`, sortie `web/dist`) ; `SITE_URL` ou le domaine Vercel rend les balises og:image absolues. Pas d'`ignoreCommand` : Vercel ne construit que le dernier commit d'un push, et un `git diff HEAD^ HEAD` sautait tout push finissant par un commit hors `web/`.

## Contrat de données

- Le front ne lit que `web/public/data/*.json`. Toute clé ajoutée ou renommée se change dans `etl/build.py`, `tests/test_etl.py::test_outputs_match_json_contract` et `web/src/lib/data.js` en même temps.
- `meta.json.demo === true` => bandeau « données de démonstration » obligatoire dans l'UI.
- Courant-jet : la page ne lit que `web/public/data/jet/` (JSON + champs de vent int8 `hero.bin`, `winds-<année>.bin`, ordre `[jour][u, v][lat][lon]`). Une clé changée dans `etl/jet/build_jet.py` se change aussi dans `web/src/jet/` et `web/scripts/check_site.py`.

## Pièges connus

- Adresses propres : Vercel sert `/courant-jet` depuis `courant-jet/index.html` (cleanUrls, sans barre finale) ; le plugin `clean-urls` de `vite.config.js` fait de même en dev et en preview. Les pages vivent un dossier sous la racine : chemins des données via `asset()` (`web/src/lib/site.js`, lit `<meta name="site-root">`), jamais en dur.
- Les anciens liens `/#chapitre` de la première enquête sont redirigés par le script en tête de `web/index.html` ; ne pas réutiliser ces ancres sur l'accueil. Le choix d'aéroport par défaut ne réécrit pas l'ancre (`selection.set(code, { url: false })`).
- OpenSky (Zenodo 7923702) : usage non lucratif, aucune redistribution des données brutes ni identifiant d'avion (indicatif, icao24, immatriculation) : seuls des agrégats quittent `data/raw/`. Citer « The OpenSky Network, https://opensky-network.org » ; l'auteur doit signaler la publication à OpenSky.
- ERA5 de WeatherBench 2 est stocké `[time, longitude, latitude]` : `build_jet.py` transpose. ARCO-ERA5 (0,25°) pèse 118 Mo par heure et par variable : seulement quelques instantanés.
- La meilleure route existe en deux exemplaires (Python `etl/jet/analysis.py`, navigateur `web/src/jet/route.js`) : toute modification se fait dans les deux, `route.test.js` compare au fixture écrit par `build_jet.py`. Les temps quotidiens de `routing.json` sont calculés sur les mêmes champs int8 recadrés que ceux de l'explorateur, pour que la page et le texte tombent à la minute.
- Trappes (IGRA 2) : seuls les sondages de 00 h et 12 h UTC depuis 1973 ; un lâcher à 23 h compte pour 00 h le lendemain ; une valeur à 250 hPa supérieure de plus de 60 km/h aux deux niveaux voisins est écartée.
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
- Les faits extérieurs aux données (taxe TSBA, Ormuz, Ryanair ; record BA112, North Atlantic Tracks, Williams 2016, Prosser 2023 pour le courant-jet) sont datés et sourcés dans `sources.js` et `web/src/jet/sources.js` ; les vérifier avant toute mise à jour du texte, jamais de lien de cause affirmé.
- Photo de l'auteur : publiée sur le site à sa demande (`web/public/auteur.jpg`) ; le film lit sa propre copie dans `promo/out/portrait.jpg` (non versionnée) ; un graphique filmé dans une grille `.grid-2` doit passer la grille sur une colonne (CSS de scène), sinon le panneau voisin déborde dans l'image.
- Une animation d'entrée (whileVisible, IntersectionObserver) ne joue qu'une fois : `promo/capture.py` filme les scènes dans l'ordre de la page pour ne pas la consommer avant sa scène.
- Espaces françaises : `watchFrenchSpacing` (`web/src/lib/ui.js`) pose l'espace fine avant ? ! : ; et entre chiffre et unité sur tout le DOM ; Archivo et Source Serif dessinent U+202F trop étroite, d'où `web/src/fonts/nnbsp.woff` (`web/scripts/make_nnbsp_font.py`) déclarée avec `unicode-range: U+202F`. Les scripts de test comparent les textes après avoir normalisé U+202F et U+00A0.
