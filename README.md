# Le ciel à deux vitesses

Trente-cinq ans de transport aérien français racontés avec les seules données publiques de la DGAC (data.gouv.fr). On y trouve :

- un globe des destinations ;
- la carte des liaisons intérieures ;
- un explorateur par aéroport ;
- la course des compagnies ;
- les compagnies françaises face aux étrangères ;
- les prix des billets face au trafic ;
- le fret aérien ;
- les émissions de CO2 et ce qui les fait bouger.

Le site est en ligne sur [aviationdata.vercel.app](https://aviationdata.vercel.app/).

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

## Déployer sur Vercel

Le dépôt contient `vercel.json`. Rien n'est à configurer à la main.

1. Sur vercel.com, choisir **Add New… > Project** et importer le dépôt GitHub `dubrouarthur/aviationdata`.
2. Laisser le dossier racine (**Root Directory**) à la racine du dépôt. Vercel lit `vercel.json` :
   - installation : `npm ci --prefix web` ;
   - build : `npm run build --prefix web` ;
   - sortie : `web/dist`.
3. Cliquer sur **Deploy**.

Node 22 est fixé par le `package.json` racine (et `.nvmrc` en local). Les commits qui ne touchent ni `web/` ni la configuration de déploiement ne relancent pas de build. Chaque push sur `main` qui modifie le site le redéploie. Les balises de partage (aperçu LinkedIn, X, etc.) utilisent automatiquement le domaine de production Vercel. Avec un domaine personnalisé, définir la variable d'environnement `SITE_URL` (par exemple `https://ciel.exemple.fr`) dans les réglages du projet Vercel.

## Vérifier

Servir d'abord `web/dist` sur 127.0.0.1:4173, par exemple avec `npx vite preview --port 4173`.

```bash
cd web && npm test                       # tests unitaires (vitest)
python3 web/scripts/interact.py          # parcours de toutes les interactions, desktop et mobile
python3 web/scripts/audit_numbers.py     # chaque chiffre du texte recalculé indépendamment en Python
```

## Film promotionnel

Le dossier `promo/` fabrique la vidéo à partir des vrais graphiques du site :

- `capture.py` filme chaque graphique image par image ;
- `render.py` monte le film en MP4 1920×1080 ;
- `thumb.py` produit la miniature.

Les fichiers produits vont dans `promo/out/`, qui n'est pas versionné. La photo de l'auteur, affichée au début, en pied de chaque scène et à la fin, est lue dans `promo/out/portrait.jpg` : elle n'est pas versionnée et doit être déposée là avant le rendu.

## Sources

Toutes les données viennent de la Direction générale de l'aviation civile (DGAC) : trafic commercial mensuel, indices des prix du transport aérien de passagers, émissions de CO2. La méthode détaillée figure en bas de la page.
