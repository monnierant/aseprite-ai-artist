# Context — vocabulaire du projet

Glossaire des termes canoniques. Un terme ici a un seul sens ; les règles, skills
et ADR l'emploient tel quel.

## Construction de tête (rules 32, 38)

**Armature de tête** — le volume 3D simplifié sur lequel on construit un visage
avant tout trait : un **crâne ovoïde** plus un **bloc facial**. Remplace la
méthode Loomis (sphère tranchée + lignes en pourcentages). Voir ADR-0013.

**Crâne ovoïde** — la masse arrière et haute de la tête, un œuf plus long que
large vu de profil, qui porte le front et l'arrière du crâne.

**Bloc facial** — le coin (wedge) accroché à l'avant du crâne ovoïde, du sourcil
au menton ; ses faces sont les **plans** du visage.

**Plan** — une face plate du bloc facial (dérivée de la tête planaire d'Asaro,
simplifiée à 6–9 plans). Un plan = un aplat de valeur = un cluster de pixels.

**Jeu de plans** — les 9 types de plans canoniques (paire symétrique = un type) :
1 front · 2 tempe (côté du crâne) · 3 orbite (en creux, porte l'œil) · 4 nez
(dos + flancs) · 5 joue avant (zygomatique) · 6 joue latérale / branche de
mâchoire · 7 museau (cylindre autour de la bouche) · 8 boîte du menton ·
9 dessous de mâchoire.

**Niveau de plans** — fusion du jeu de plans selon la hauteur de tête :
96 px = 9 plans ; 48–64 px = 6 (front · tempe+joue latérale · orbite · nez ·
joue avant+museau · mâchoire+menton) + dessous ; 32 px = 3 (face · côté ·
dessous) + orbite.

**Orientation** — lacet (yaw, gauche/droite), tangage (pitch, haut/bas), roulis
(roll, inclinaison) de l'armature, en degrés. Remplace les trois gabarits
fixes face / 3/4 / profil.

**Archétype** — préréglage de proportions de l'armature : `realistic`,
`adventure` (stylisé JRPG/aventure), `anime`, `chibi`.

**Curseurs** — surcharges continues d'un archétype : largeur de mâchoire,
longueur du bloc facial, saillie arcade/pommettes, âge, forme du menton.

**Op armature** — `draw` kind `headArmature` : calcule l'armature orientée en
TypeScript, rastérise un calque `guide` (contours, axe courbé, lignes de
repères enroulées, frontières de plans) et renvoie les repères en JSON.

**Bloc-in des plans** — sortie optionnelle de l'op armature : avec une
direction de lumière et une rampe de peau, chaque plan est rempli de sa
valeur (palette verrouillée) sur le calque `head-planes`. L'agent raffine
ensuite ; l'op ne dessine jamais les traits.

**Globe oculaire** — sphère logée dans l'orbite ; l'op armature renvoie son
empreinte projetée, la courbe des paupières qui l'enveloppe et le surplomb de
l'arcade. En guide seulement, jamais peint.

**Décalque oculaire** — pour `anime` et `chibi` : l'œil est une forme plate
collée sur le plan avant et déformée par l'orientation, pas une sphère.

**Coquille de cheveux** — ovoïde du crâne décalé de 1–3 px vers l'extérieur ;
avec la **ligne d'implantation** enroulée sur le front, elle donne au volume
des cheveux sa place hors du crâne (contre l'effet « casque »).

**Cou** — cylindre inséré sous le crâne, en arrière du menton, jamais planté
sous le menton. Épaules hors périmètre v1.

**Passe de contour** — étape des règles après le bloc-in : on corrige la
silhouette avec les lignes de rythme (courbes opposées décalées, droite contre
courbe, front→pommette→mâchoire). L'op renvoie 3–4 courbes de rythme en JSON,
jamais sur le guide.

**Pose de pixels** — régime des têtes 8–24 px : tables et gabarits fixes, sans
armature (le volume n'y change presque rien).

**Banc visage** — 6 briefs fixes : `realistic` 3/4 + contre-plongée,
`adventure` 3/4 (remake MON-574) + face, `anime` 3/4 + face ; chibi hors
banc ; rendus en 48 et 96 px, avant/après côte à côte. Le
verdict visuel de l'utilisateur est le gate ; le lint n'en est pas un.

**Ligne de rythme** — courbe de liaison à la Reilly (front→joue, pommette→mâchoire)
utilisée en appoint pour donner de la tension au contour, jamais comme base
de construction.

**Taille cible** — portraits et bustes 48–96 px d'abord, puis descente vers 32 px.
