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
src/pages/            Flotte, RobotDetail, Missions, MissionEditeur, Primitives, NouvellePrimitive
```

## Le back

Il n'existe pas encore : tout tourne sur `src/api/mock.ts`, et la barre latérale l'affiche
(« Données simulées »). Le brancher, c'est écrire une seconde implémentation de `Api` qui appelle le
serveur, choisie quand `VITE_API_URL` est défini. Aucun écran ne change.

L'enregistrement d'une primitive est simulé (2,5 s) : au réel, il pilotera la démonstration au robot.

## La vue 3D (écran d'accueil)

`src/vue3d/` : three.js, sans viser (viser se dessine depuis un serveur Python ; ici c'est le téléphone qui dessine).

- `robot.ts` : le G1-D chargé depuis **son URDF** (`sim/assets/g1_d_description/g1_d_dex1.urdf`, celui du code
  robot), en corps sombre à liseré lumineux et arêtes. `npm run robot` copie l'URDF et ses maillages dans
  `public/robot/` (hors git, refait avant chaque `dev` et `build`).
- `nuages.ts` : les nuages de la caméra RGBD (D435i, 87°×58°) et du lidar de tête (MID360, +5° à −47°),
  SIMULÉS en lançant des rayons dans une cellule fictive. Le back les remplacera par les vrais nuages.
- `sol.ts` : la grille, l'anneau sous le robot et l'onde de balayage.
- `scene.ts` : caméra orbitale, halo (bloom) et aberration chromatique.

**Le fond de la scène est `scene.background`, jamais `setClearColor`.** three.js convertit la couleur
d'effacement selon la cible de rendu active au moment où on la règle : réglée écran actif puis appliquée au
tampon linéaire du post-traitement, elle sortait grise ; chaque rendu de l'hologramme (cible linéaire) la
re-réglait en noir. L'image alternait entre les deux, une sur deux.
