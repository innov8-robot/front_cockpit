# Front client — flotte, primitives, missions

L'interface du client final : sa flotte de robots, ses primitives, ses missions, et l'enregistrement de
nouvelles primitives. Une seule base de code pour le web et Android (React + Vite + TypeScript, emballée
par Capacitor).

## Lancer

```bash
npm install
npm run dev          # web : http://localhost:5173
npm run build        # web de production dans dist/
npm run android      # build + copie dans le projet Android (android/)
npm run apk          # APK de debug : android/app/build/outputs/apk/debug/app-debug.apk
npx cap open android # ouvrir dans Android Studio
```

Android demande Java 21 et le SDK (`ANDROID_HOME=~/Android/Sdk`).

## Organisation

```
src/api/types.ts      le modèle de données (Robot, Primitive, Mission, Run) : la forme que le back servira
src/api/client.ts     le contrat Api ; les écrans ne parlent qu'à lui
src/api/mock.ts       l'implémentation simulée (données en mémoire, gardées dans le navigateur)
src/api/libelles.ts   libellés et tons d'affichage
src/pages/Accueil     LA page : la vue 3D et son HUD
src/components/Overlay  les autres écrans, ouverts par-dessus selon l'adresse (#/missions, #/flotte/r1…)
src/components/graphe/  l'éditeur de mission en nœuds (React Flow) : palette, nœuds à deux sorties
src/components/BarreRobot  la barre du robot : état (connexion, batterie, températures) et ordres (bras, pinces,
                      Home, E-STOP) ; IconesRobot, ses icônes. Page d'essai : #/essai/barre (pages/EssaiBarre)
src/pages/            Flotte, RobotDetail, Missions, MissionEditeur, Primitives, NouvellePrimitive
```

## Le back

Il n'existe pas encore : tout tourne sur `src/api/mock.ts`, et la barre latérale l'affiche
(« Données simulées »). Le brancher, c'est écrire une seconde implémentation de `Api` qui appelle le
serveur, choisie quand `VITE_API_URL` est défini. Aucun écran ne change.

L'enregistrement d'une primitive est simulé (2,5 s) : au réel, il pilotera la démonstration au robot.

## La proposition d'éditeur de missions

**`#/essai/missions`** : user stories, cahier des charges, primitives réelles du cockpit, principes repris de n8n et
de Scratch, charte graphique des nœuds, galerie des composants et prototype interactif. Dans le prototype : palette à
droite (on glisse un nœud sur le canevas), clic droit sur un nœud pour ses actions, double-clic pour ses réglages ;
« Simuler » joue une exécution — le nœud en cours porte un rond de chargement, le lien qui y mène une onde à 1 Hz
(verte après un succès, ambre après un échec, rouge à l'arrêt d'urgence), et la vue suit l'étape quand elle sort du
cadre. Le code est dans `src/components/missions/` : `charte.ts` (familles, sorties, états, couleurs de l'onde),
`catalogue.ts` (les types de nœuds — en ajouter un, c'est une entrée), `Noeud.tsx` (nœud et cadre de boucle),
`Prototype.tsx` (canevas, lien animé, menu, simulation), `proposition.ts` (le texte de la proposition).

**`#/essai/logique`** : la même mission (une boucle, un geste à deux essais qui appelle l'opérateur s'il rate, une
question) dessinée de trois façons — A ligne de métro, B blocs empilés façon Scratch, C colonne façon Zapier — et
jouée dans les trois à la fois. La mission est écrite une fois dans `logique.ts` ; chaque dessin est un fichier
(`LogiqueMetro.tsx`, `LogiqueBlocs.tsx`, `LogiqueColonne.tsx`), l'onde des liens vit dans `Onde.tsx`.

## Les couleurs de la scène

Une couleur = un sens. **Le rouge est réservé au danger** (arrêt d'urgence, alarme, moteur trop chaud, zone machine),
l'ambre à l'attention, le vert à l'OK ; aucun thème de la scène ne les emploie. La scène a sa propre famille : un ton
pour ce que voient les capteurs maintenant, le même éteint pour la carte mémorisée, une couleur pour le sonar, une
palette par classe pour les objets.

Les thèmes sont dans `src/vue3d/theme.ts`, et se comparent en direct sur la page d'essai **`#/essai/da`** (chacun
avec son principe d'harmonie et ses conflits avec les couleurs de sécurité).

- **Changer le thème de l'accueil** : remplacer `THEME_ACCUEIL` dans `src/vue3d/theme.ts` par la clé d'un thème
  (`'spectre'` aujourd'hui ; `'glace'`, `'phosphore'`, `'viridis'`, `'abysse'`…).
- **Créer un thème** : ajouter une entrée à `THEMES`. Une couleur par rôle (`camera`, `lidar`, `memoire`, `sonar`,
  `deploiement`, `meubles`, `sol`) ; pour colorer le vivant et la mémoire selon la hauteur, donner à `camera`,
  `lidar` et `memoire` un tableau de cinq couleurs, du sol vers le haut (famille `'hauteur'`, comme Viridis).
- **Le changer à la volée** : `scene.theme(t)` (`Scene3D`), comme le fait la page d'essai.

## La vue 3D (écran d'accueil)

`src/vue3d/` : three.js, sans viser (viser se dessine depuis un serveur Python ; ici c'est le téléphone qui dessine).

- `robot.ts` : le G1-D chargé depuis **son URDF** (`sim/assets/g1_d_description/g1_d_dex1.urdf`, celui du code
  robot), en corps sombre à liseré lumineux et arêtes. `npm run robot` copie l'URDF et ses maillages dans
  `public/robot/` (hors git, refait avant chaque `dev` et `build`).
- `nuages.ts` : les nuages de la caméra RGBD (D435i, 87°×58°) et du lidar de tête (MID360, +5° à −47°),
  SIMULÉS en lançant des rayons dans une cellule fictive. Le back les remplacera par les vrais nuages.
- `sol.ts` : la grille, l'anneau sous le robot et l'onde de balayage.
- `environnement.ts` déclare aussi les **objets** posés sur la table (mug, carton, deux pièces, bac) : chaque rayon
  des capteurs simulés dit quel objet il touche, et `nuages.ts` colore ces points de la couleur de leur classe
  (`CLASSES`). `detections.ts` pose dessus les **cadres de détection** façon YOLO (nom et confiance) autour de
  chaque objet que la caméra de tête voit. Ils sont dessinés dans la scène, sur un plan face à la caméra juste
  devant l'objet, et masqués par ce qui est devant (le robot, et les volumes invisibles de l'atelier, qui n'écrivent
  que la profondeur). La confiance est simulée ; le back servira les objets déclarés et les détections du robot.
  Calque « Objets » de la barre du bas.
- `scene.ts` : caméra orbitale, halo (bloom) et aberration chromatique.

**Le fond de la scène est `scene.background`, jamais `setClearColor`.** three.js convertit la couleur
d'effacement selon la cible de rendu active au moment où on la règle : réglée écran actif puis appliquée au
tampon linéaire du post-traitement, elle sortait grise ; chaque rendu de l'hologramme (cible linéaire) la
re-réglait en noir. L'image alternait entre les deux, une sur deux.
