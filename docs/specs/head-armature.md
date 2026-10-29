# Spec — `draw` kind `headArmature`

Contrat de l'op décidé dans [ADR-0013](../adr/0013-volumetric-head-construction.md).
Vocabulaire : [CONTEXT.md](../../CONTEXT.md).

## Entrée

| Champ | Type | Défaut | Rôle |
|---|---|---|---|
| `kind` | `"headArmature"` | — | |
| `rect` | `{x,y,width,height}` | requis | boîte de la tête, coquille de cheveux comprise, cou exclu |
| `archetype` | `realistic` \| `adventure` \| `anime` \| `chibi` | `adventure` | préréglage de proportions |
| `yaw` | degrés −90…90 | 0 | lacet, positif = la tête tourne vers la droite du spectateur |
| `pitch` | degrés −45…45 | 0 | tangage, positif = tête levée (contre-plongée) |
| `roll` | degrés −30…30 | 0 | roulis, positif = sens horaire |
| `sliders` | objet, chaque valeur −1…1 | 0 | `jawWidth`, `faceLength`, `browRidge`, `cheekbones`, `age`, `chin` |
| `guideLayer` | string | `"guide"` | calque des repères ; créé s'il manque |
| `guideColor` | couleur | palette, la plus éloignée de la rampe | tracés de structure |
| `featureColor` | couleur | palette, la suivante | axe, lignes des traits, paupières, implantation, oreilles |
| `hair` | bool | true | coquille de cheveux + ligne d'implantation |
| `neck` | bool | true | cylindre du cou |
| `planes` | objet optionnel | absent | bloc-in des plans, voir ci-dessous |

`planes` : `{ light: {x,y,z} | "upper-left" | "upper-right" | "front" | …,
ramp: [couleurs du sombre au clair], layer: "head-planes", values: "masses" | "planes" }`.
`outline` (vrai par défaut avec `masses`) ferme la peau d'un contour sélectif : le cran
le plus sombre du côté opposé à la lumière, le cran suivant côté éclairé ; le bas du cou
reste ouvert (le col le couvre).
`values: "masses"` (défaut) donne trois masses — lumière, demi-teinte, ombre
— sur les crans intérieurs de la rampe, les extrêmes restant libres pour les
accents. Pour `realistic` et `adventure`, la lumière est enveloppée puis lissée
pixel par pixel (flou de rayon ≈ hauteur/14) : le terminateur se courbe sur la
pommette au lieu de suivre une arête de plan ; orbites, dessous de mâchoire et
cou restent dans l'ombre. Pour `anime` et `chibi`, deux valeurs seulement
(cel shading) : le visage reste un aplat, seuls les côtés tournés, le dessous
de la mâchoire et le cou prennent l'ombre, et les yeux en décalque n'ont pas
d'orbite. `values: "planes"` donne à chaque plan le cran de son éclairement
lambertien : une étude de construction, jamais une peau finie (des facettes
laissées dans un visage fini lisent comme un masque — constat du banc visage).
`paletteLock` s'applique comme pour les autres ops.

Le niveau de plans se déduit de `rect.height` : ≥ 80 → 9, 40–79 → 6 + dessous,
28–39 → 3 + orbite. En dessous de 28 px l'op refuse et renvoie l'erreur
`too_small` qui renvoie aux tables de pose de pixels de `rules://32`.

## Modèle

- **Crâne ovoïde** : ellipsoïde ; proportions par archétype (le crâne de
  `chibi` et `anime` est plus large et haut relativement au bloc facial).
- **Bloc facial** : coin fixé à l'avant du crâne, de l'arcade au menton ; les
  curseurs modifient sa longueur, la largeur de la mâchoire, la saillie de
  l'arcade et des pommettes, la forme du menton ; `age` agit sur le rapport
  crâne/bloc facial et la hauteur des yeux.
- **Plans** : polygones 3D sur le bloc facial et le crâne, nommés par le jeu
  de plans (CONTEXT.md), fusionnés selon le niveau de plans.
- **Globe oculaire** : sphère par orbite (`realistic`, `adventure`) ;
  décalque plat sur le plan avant (`anime`, `chibi`).
- **Coquille de cheveux** : crâne gonflé de 1–3 px selon la taille ; ligne
  d'implantation enroulée sur le plan du front.
- **Cou** : cylindre sous le crâne, en arrière du menton.
- Projection orthographique ; tri par profondeur ; faces arrière éliminées.

## Sortie

Rastérisée, en une transaction (un Ctrl+Z) :

- sur `guideLayer` : contour du crâne, contour du bloc facial, axe médian
  courbé sur le volume, lignes arcade / yeux / base du nez / bouche enroulées,
  frontières des plans visibles, empreintes des globes, coquille de cheveux,
  ligne d'implantation, cou ;
- si `planes` : chaque plan visible rempli de sa valeur sur `planes.layer`,
  silhouette de la tête comprise.

Renvoyée en JSON (coordonnées entières de la toile) :

```json
{
  "level": 6, "archetype": "adventure",
  "orientation": { "yaw": 30, "pitch": 0, "roll": 0 }, "scale": 63.95,
  "silhouette": [[x,y], …], "axis": [[x,y], …],
  "landmarks": { "brow": [[x,y],…], "eyeLine": [[x,y],…], "noseBase": [[x,y],…],
                 "mouth": [[x,y],…], "chin": [x,y], "hairline": [[x,y],…] },
  "eyes": [{ "side": "left"|"right", "near": true, "kind": "sphere"|"decal",
             "center": [x,y], "footprint": [[x,y],…], "upperLid": [[x,y],…],
             "lowerLid": [[x,y],…], "browOverhang": [[x,y],…], "visible": true }],
  "planes": [{ "name": "side-left", "type": "side", "side": "left"|"right"|"center",
               "area": 627, "bounds": {x,y,width,height}, "centroid": [x,y],
               "value": 0.59, "rampIndex": 3, "color": "#…" }],
  "ears": [{ "side": "left", "near": true, "polygon": [[x,y],…], "visible": true }],
  "hairShell": [[x,y], …], "neck": [[x,y], …],
  "rhythm": [{ "name": "brow-cheek-jaw-near", "points": [[x,y],…] }]
}
```

`side` est celui du spectateur ; `near` désigne l'œil (ou l'oreille) tourné
vers lui. `value` est l'éclairement brut ; `rampIndex` le répartit sur la
rampe, le pas le plus sombre étant réservé à l'orbite et au dessous de
mâchoire. `footprint` est une surface remplie, pas un contour.

Côté Aseprite, l'op passe par `draw.passes` (extension) : une passe
`draw.batch` par calque, calques créés s'ils manquent, le tout dans une seule
transaction. Les couleurs de guide par défaut sont les deux entrées de palette
les plus éloignées (ΔE) de la rampe de peau.

Les courbes `rhythm` (3–4) ne sont jamais tracées.

## Tests (Node)

- Face, `yaw=0` : silhouette et repères symétriques à ±1 px.
- `yaw` croissant : l'empreinte de l'œil lointain rétrécit ; l'axe se déplace
  vers le côté du tour ; l'œil lointain disparaît (`visible:false`) avant 90°.
- `pitch>0` : la ligne des yeux se courbe vers le haut au centre ; le dessous
  de mâchoire devient visible.
- `roll` : rotation des repères autour du centre de la tête.
- Niveaux 3/6/9 selon `rect.height` ; refus `too_small` sous 28 px.
- Avec `planes` : chaque couleur appartient à `ramp` ; plan le plus éclairé
  du côté de `light`.
- Chaque champ déclaré a un test qui échoue sans sa branche (AGENTS.md).

## Banc visage

6 briefs fixes dans `docs/evals/`, chibi hors banc :

| # | Archétype | Vue |
|---|---|---|
| 1 | `realistic` | 3/4 |
| 2 | `realistic` | contre-plongée |
| 3 | `adventure` | 3/4 — remake du buste MON-574 |
| 4 | `adventure` | face |
| 5 | `anime` | 3/4 |
| 6 | `anime` | face |

Chacun rendu à 48 et 96 px, avant (règles actuelles) et après,
assemblés en planche côte à côte pour verdict visuel de l'utilisateur.
