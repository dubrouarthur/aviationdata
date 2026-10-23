# aviationdata

Des enquêtes sur le transport aérien construites uniquement sur des données publiques. Le site est en ligne sur [aviationdata.vercel.app](https://aviationdata.vercel.app/) :

- la page d'accueil (`web/index.html`) présente les enquêtes ;
- **Le ciel à deux vitesses** (`/le-ciel-a-deux-vitesses`) : trente-cinq ans de transport aérien français d'après la DGAC (data.gouv.fr), avec un globe des destinations, la carte des liaisons intérieures, un explorateur par aéroport, la course des compagnies, le pavillon français, les prix, le fret et le CO2 ;
- **Le vent dans le dos** (`/courant-jet`) : le courant-jet et les vols transatlantiques, d'après les vols OpenSky, les vents ERA5 (Copernicus/ECMWF), la réanalyse NCEP/NCAR et l'indice NAO de la NOAA, les ballons-sondes de Météo-France (archive IGRA de la NOAA) et l'imagerie de la NASA. On y trouve une carte animée des vents, un explorateur jour par jour de la route la plus rapide, et les chiffres de l'écart entre l'aller et le retour.

Les anciens liens de la première enquête (`/#co2`, `/#aeroport-LFLL`...) sont redirigés vers sa nouvelle adresse.

## Lancer en local

```bash
cd web
npm ci
npm run dev        # http://localhost:5173
npm run build      # site statique dans web/dist
```

Les données du site sont déjà calculées dans `web/public/data/*.json`. Pour les régénérer depuis les fichiers DGAC :

```bash
python3 etl/fetch.py     # télécharge les jeux DGAC dans data/raw/
python3 etl/build.py     # écrit web/public/data/*.json
python3 -m pytest -q     # vérifie le pipeline et les chiffres de référence
```

Les données de l'enquête sur le courant-jet (`web/public/data/jet/`) se régénèrent ainsi, depuis une machine qui atteint les serveurs de Zenodo, Google Cloud, de la NOAA et de la NASA :

```bash
python3 etl/jet/opensky.py       # vols France–Amérique du Nord 2019-2022 (OpenSky, Zenodo), filtrés à la volée
python3 etl/jet/era5_daily.py --years 2019,2020,2021,2022   # vents ERA5 à 250 hPa toutes les 6 h
python3 etl/jet/era5.py --dates 2020-02-09T00                # vents ERA5 à 0,25° pour la carte d'ouverture
python3 etl/jet/reanalysis.py --monthly                      # réanalyse NCEP/NCAR depuis 1948
python3 etl/jet/nao.py           # indice NAO (NOAA CPC)
python3 etl/jet/radiosonde.py    # ballons-sondes de Trappes (IGRA 2)
python3 etl/jet/nasa.py          # image VIIRS du 8 février 2020 (NASA GIBS)
python3 etl/jet/build_jet.py     # écrit web/public/data/jet/
```

Les vols OpenSky sont publiés pour la recherche et l'enseignement à but non lucratif : seuls des agrégats sortent de `data/raw/`, sans aucun identifiant d'avion.

## Déployer sur Vercel

Le dépôt contient `vercel.json`. Rien n'est à configurer à la main.

1. Sur vercel.com, choisir **Add New… > Project** et importer le dépôt GitHub `dubrouarthur/aviationdata`.
2. Laisser le dossier racine (**Root Directory**) à la racine du dépôt. Vercel lit `vercel.json` :
   - installation : `npm ci --prefix web` ;
   - build : `npm run build --prefix web` ;
   - sortie : `web/dist`.
3. Cliquer sur **Deploy**.

Node 22 est fixé par le `package.json` racine (et `.nvmrc` en local). Chaque push sur `main` qui modifie le site le redéploie. Les balises de partage (aperçu LinkedIn, X, etc.) utilisent automatiquement le domaine de production Vercel. Avec un domaine personnalisé, définir la variable d'environnement `SITE_URL` (par exemple `https://ciel.exemple.fr`) dans les réglages du projet Vercel.

## Vérifier

Servir d'abord `web/dist` sur 127.0.0.1:4173, par exemple avec `npx vite preview --port 4173`.

```bash
cd web && npm test                       # tests unitaires (vitest)
python3 web/scripts/interact.py          # parcours de toutes les interactions, desktop et mobile
python3 web/scripts/audit_numbers.py     # chaque chiffre du texte recalculé indépendamment en Python
python3 web/scripts/check_site.py        # accueil, redirections et enquête sur le courant-jet : liens, interactions, chiffres
```

## Film promotionnel

Le dossier `promo/` fabrique la vidéo à partir des vrais graphiques du site :

- `capture.py` filme chaque graphique image par image ;
- `render.py` monte le film en MP4 1920×1080 ;
- `thumb.py` produit la miniature.

Un reel 4:5 (1080×1350) pour LinkedIn mêle de vraies images d'avions et d'aéroports aux graphiques, filmés en encre claire :

- `capture.py --theme dark` filme les graphiques en version sombre dans `promo/out/raw-dark/` ;
- `reel_footage.py` télécharge les rushes et les découpe au format 4:5 ;
- `render.py --page reel.html --size 1080x1350` monte le reel.

Les rushes viennent de [Pexels](https://www.pexels.com/license/) (usage libre, sans attribution obligatoire) ; leurs auteurs et leurs liens sont listés dans `promo/reel.json`. Ils sont téléchargés dans `promo/out/footage/` et ne sont jamais versionnés.

Les fichiers produits vont dans `promo/out/`, qui n'est pas versionné. La photo de l'auteur, affichée au début, en pied de chaque scène et à la fin, est lue dans `promo/out/portrait.jpg` : elle n'est pas versionnée et doit être déposée là avant le rendu.

## Sources

- Le ciel à deux vitesses : Direction générale de l'aviation civile (DGAC), trafic commercial mensuel, indices des prix du transport aérien de passagers, émissions de CO2.
- Le vent dans le dos : The OpenSky Network (https://opensky-network.org, Strohmeier et al., 2021) ; ERA5, Copernicus Climate Change Service / ECMWF (contient des informations modifiées du Copernicus Climate Change Service) ; NCEP/NCAR Reanalysis 1 et indice NAO, NOAA ; radiosondages de Météo-France à Trappes, archive IGRA 2 de la NOAA NCEI ; NASA Worldview / GIBS ; OurAirports.

La méthode détaillée figure en bas de chaque enquête.
