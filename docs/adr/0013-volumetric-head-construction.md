# ADR-0013 — Construire les têtes par volumes et plans, pas par Loomis

**Status:** proposed · 2026-10-29

## Context

`rules/32-heads-and-faces` et `rules/38-portraits` placent les traits par
pourcentages de hauteur (méthode Loomis) et fournissent des gabarits figés
face / 3/4 / profil. Résultat observé (MON-574, buste 48 px) : crâne sans
volume, visage « masque » plat, yeux posés sur une silhouette au lieu d'être
logés dans des orbites, aucun angle de tête hors des trois gabarits. Le lint
(`validate`) passait ; la qualité artistique non.

Les pourcentages disent *où* mettre un trait sur une tête de face ; ils ne
disent rien du volume qui porte ce trait ni de ce qui se passe quand la tête
tourne. Loomis est par ailleurs peu suivi par les artistes en pratique.

## Decision

Priorité : portraits et bustes 48–96 px, puis descente vers 32 px.

La tête se construit sur une **armature** : crâne ovoïde + bloc facial en coin
(Bridgman / Vilppu), découpé en 6–9 **plans** simplifiés dérivés d'Asaro. Les
plans donnent à la fois le placement des traits et le découpage des aplats de
valeur. Des **lignes de rythme** à la Reilly s'ajoutent en appoint pour le
contour, sans servir de base.

### Point d'injection : une armature exécutable

L'échec n'est pas théorique : l'agent connaît les proportions mais ne sait pas
traduire un volume orienté en pixels. On calcule donc cette traduction.

- Nouvel op `draw` kind `headArmature` (pas de nouvel outil, ADR-0003).
- Entrées : orientation (lacet/tangage/roulis), archétype (`realistic`,
  `adventure`, `anime`, `chibi`), curseurs (mâchoire, longueur du bloc facial,
  saillie arcade/pommettes, âge, menton), boîte de la tête.
- Géométrie 3D et projection en TypeScript, testées en Node, développées en
  primitives déjà gérées par Lua — comme `grid` (`src/tools/draw.ts`). Aucun
  Lua nouveau.
- Sorties : calque `guide` (ovoïde, coin facial, axe courbé, lignes
  sourcil/yeux/nez/bouche enroulées sur le volume, frontières de plans) et
  repères en JSON.
- Option bloc-in : avec `light` et une rampe de peau, chaque plan est rempli
  de sa valeur, palette verrouillée, sur `head-planes`. Les traits restent à
  l'agent.
- Niveau de plans par taille : 9 à 96 px, 6 + dessous à 48–64 px, 3 + orbite
  à 32 px (voir CONTEXT.md).

- Yeux en guide : globe oculaire = sphère dans l'orbite (empreinte projetée,
  paupières enveloppantes, surplomb de l'arcade) ; pour `anime`/`chibi`,
  décalque plat collé au plan avant et déformé par l'orientation.
- Coquille de cheveux (ovoïde décalé de 1–3 px) et ligne d'implantation sur
  le front ; cou = cylindre inséré sous le crâne. Épaules hors v1.
- Rythmes Reilly : 3–4 courbes renvoyées en JSON pour une passe de contour
  décrite dans les règles ; jamais tracées sur le guide.

### Règles

`rules/32-heads-and-faces` et `rules/38-portraits` sont réécrits autour de
l'armature pour toute tête ≥ 32 px. Les tables et gabarits 8–24 px restent,
présentés comme « pose de pixels », sans justification Loomis. Les gabarits
32 et 48 px sont régénérés à partir de la sortie de l'op pour concorder avec
lui. `rules/33-eyes-and-expressions` est aligné sur le globe oculaire.
Les skills `studio`, `concept` et `draw` routent tout visage ≥ 32 px via
`headArmature` ; la PixelSpec porte orientation et archétype.

### Gate

Banc visage : 6 briefs fixes (`realistic` 3/4 + contre-plongée, `adventure`
3/4 remake MON-574 + face, `anime` 3/4 + face ; chibi hors banc) en 48 et
96 px, avant/après côte à côte. Le verdict visuel
de l'utilisateur décide du merge. S'y ajoutent des tests Node sur la
géométrie et une section visage dans l'agent `pixel-critic`.

Le travail vit dans le fork `monnierant/aseprite-ai-artist` (l'utilisateur n'a
que `pull` sur `with-pebbly`), branche `feat/volumetric-head-construction`,
PR sur le fork, max commits en Conventional Commits. Aucune PR upstream.

## Consequences

- Les têtes ≥ 32 px peuvent tourner à n'importe quel angle ; les traits
  suivent le volume au lieu de lignes horizontales.
- Le découpage des aplats d'ombre sort de la géométrie, plus de l'intuition.
- Coût : un op TS non trivial (projection, rastérisation des plans) et sa
  documentation dans `docs/TOOLS.md` ; l'op doit être entièrement implémenté
  et testé (règle « rien de déclaré sans implémentation », AGENTS.md).
- Le fork diverge d'upstream : les mises à jour `with-pebbly` se fusionnent à
  la main.
- Sous 32 px, rien ne change : la pose de pixels reste la méthode.
