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
cadre. Les nœuds sont dessinés comme dans n8n — une tuile et son icône, le nom et le résumé de ses réglages dessous —,
et la logique est faite de nœuds, pas de cadres : « Si » sort par alors / sinon ; une boucle (pour, pour chaque, tant
que, répéter, répéter jusqu'à) sort par faire à chaque tour et par fini à la fin, et la dernière étape du tour revient
dans son entrée par un fil qui passe dessous ; « Selon l'échec » a une sortie par cas. Sous un nœud de logique, son
expression s'affiche en pastille : hexagonale pour une condition (« bac plein ? », avec oui / non une fois évaluée),
arrondie pour un compte (« i de 1 à 4 »). Un geste a un paramètre
« essais » et un « si ça rate » qui ouvre sa sortie échec. Une sortie libre porte un « + » qui ouvre le choix de
l'étape suivante ; une boucle neuve arrive avec sa case à remplir. Le code est dans `src/components/missions/` : `charte.ts` (familles, sorties, états, couleurs de l'onde),
`catalogue.ts` (les types de nœuds — en ajouter un, c'est une entrée), `Noeud.tsx` (la tuile et la case à remplir),
`Prototype.tsx` (canevas, liens, menu du « + », simulation), `actions.ts` (ce que les nœuds demandent au canevas),
`apparence.ts` (icônes en points ou au trait, couleurs Spectre ou par famille — deux interrupteurs dans la barre du
prototype), `points.ts` (les icônes au trait relues en matrice de points de 12 × 12, comme le logo de démarrage),
`proposition.ts` (le texte de la proposition).

**`#/essai/logique`** (proposition écartée : on garde le canevas n8n) : la même mission (une boucle, un geste à deux essais qui appelle l'opérateur s'il rate, une
question) dessinée de trois façons — A ligne de métro, B blocs empilés façon Scratch, C colonne façon Zapier — et
jouée dans les trois à la fois. La mission est écrite une fois dans `logique.ts` ; chaque dessin est un fichier
(`LogiqueMetro.tsx`, `LogiqueBlocs.tsx`, `LogiqueColonne.tsx`), l'onde des liens vit dans `Onde.tsx`.

## L'éditeur proposé, dans l'écran des missions

`#/missions/:id` montre l'éditeur proposé par défaut ; l'interrupteur « Proposé / Actuel » de la barre ramène
l'éditeur d'origine (`EditeurGraphe`), intact, et le navigateur retient le choix. Le proposé
(`components/graphe/EditeurMission.tsx`) dessine la même mission de l'API : les primitives en tuiles, « réussi » tout
droit, « échec » en ambre quand une primitive l'ouvre (sa fiche, au double-clic : « si ça rate »), un « + » au bout
des sorties libres, la palette à droite ; la logique y est annoncée, grisée, tant que le back ne la joue pas. Pendant
une mission, il lit `Execution` : le chemin joué, l'étape en cours avec son avancement, l'onde qui y mène, le tour.
`components/graphe/correspondance.ts` fait le pont entre la mission de l'API et le canevas.

**La logique dans le contrat.** Un nœud de mission peut être une primitive (`primitiveId`), un nœud du catalogue qui
n'en est pas une — boucle, condition, compteur, appel à l'opérateur, fin — (`type`, sa clé au catalogue, et ses
`valeurs`), ou le départ ; ses sorties vont au-delà de réussi / échoué (`suite`, `alors` / `sinon`, `faire` / `fini`).
L'éditeur les dessine et les relit sans rien perdre (sa fiche montre leurs réglages), la liste, les exécutions et la
barre de lecture aussi ; on ne les ajoute pas encore depuis la palette. La simulation sert « Vider la table, en
boucle », la mission du prototype : pour chaque pièce, si le bac est plein l'opérateur le vide, prendre (la troisième
rate et appelle l'opérateur), déposer, compter ; puis rentrer, retour à la base, terminer. Le back du robot devra
accepter ces nœuds pour les jouer.

## Les onglets de l'éditeur : Éditeur · Exécutions · Analyse

Comme n8n, l'écran d'une mission (`#/missions/:id`) a trois onglets au centre de sa barre, gardés dans l'adresse
(`?onglet=executions`) : l'**éditeur** ; les **exécutions** (à gauche les runs, à droite le run choisi rejoué sur le
canevas — étapes jouées, celle qui a échoué et sa cause — et sa frise d'étapes sur l'axe du temps ; la mission en
cours en tête, en direct) ; l'**analyse** (sur une période : réussite, réussite et durée par étape avec l'étape la plus
fragile, causes d'échec, durée des derniers runs). Le détail par étape vient de `Run.etapes` (`api/types.ts`), que la
simulation sert ; le back du robot devra le servir aussi. Code : `components/executions/`.

## La liste des missions : trois propositions

**`#/essai/liste-missions`**, sur les données de l'API : A · liste vivante (le panneau de côté : chaque ligne montre
la chaîne de primitives en tuiles, les huit derniers runs, réussite, durée moyenne, répétitions ; Lancer et Éditer au
survol ; la mission qui joue montre son étape, son tour et sa pause), B · cartes (l'écran entier, le graphe de chaque
mission en miniature), C · liste et aperçu (la mission choisie : son graphe dans l'éditeur en lecture, ses derniers
runs et leur cause). « Nouvelle mission » y est blanc : le rouge est réservé au danger. Code : `components/listeMissions/`.

## La barre de la mission qui joue : le fil

En haut de l'accueil (`components/BarreMission.tsx`) : au repos, choisir une mission et la lancer (LANCER est blanc,
le vert n'est jamais un bouton) ; pendant la mission, le fil ; à la fin, son issue, lue dans son dernier run. Le nom
de la mission ouvre son onglet Exécutions. Pendant une mission, les écrans ouverts et les calques se rangent sous le
fil, plus haut que la barre au repos. Banc d'essai : **`#/essai/barre-lecture`**, sur une mission simulée (branche
« échec », tours, pause, avertissement, erreur bloquante, arrêt d'urgence) : celle du prototype de l'éditeur (une
boucle sur les pièces, une condition, deux appels à l'opérateur, une prise qui rate), une longue, une courte. Le fil
dessine tout nœud du catalogue — primitives, logique, opérateur, fin — avec ses sorties (alors / sinon, fini / faire) ;
la prévision s'arrête devant une condition ou une boucle, et un nouveau tour de boucle remet son corps à neuf.

Le fil : le graphe de la mission tel que l'éditeur le dessine, réduit dans la barre. Quand une étape finit, une
étincelle part sur le fil que la mission a pris (vert « réussi », ambre « échec ») et la caméra la suit dans tous les
sens jusqu'à l'étape suivante, qui s'ouvre à son arrivée avec son nom. Aucune durée n'est prédite : on ne sait pas
combien de temps une étape va tourner. Le système de la barre : blanc ce qui vit, gris ce qui est suspendu (la pause
n'est pas une alerte : un halo blanc qui respire), vert ce qui a réussi, ambre ce qui n'arrête rien mais demande de l'attention, rouge ce qui a
arrêté la mission ; les actions sont blanches, pleine pour la principale (Reprendre, Acquitter), en contour pour la
secondaire (Pause). Un halo autour de la barre et un message dessous disent l'issue : vert la mission terminée, ambre
un avertissement ou une étape rattrapée par sa branche « échec » (il s'efface seul), rouge une erreur qui l'arrête
(✕ sur l'étape fautive, jusqu'à l'acquittement) ou l'arrêt d'urgence (■, jusqu'au réarmement). Pour la brancher, le
contrat `Execution` porte, en champs optionnels que le back du robot devra servir : `joues` (les étapes jouées dans le
tour, avec la sortie qui y a mené et leur issue — sans eux, la barre suppose que tout a réussi), `dureeEtapeS` et
`alerte` (niveau « attention » ou « erreur », et son texte) ; `chemin` est le chemin réellement pris, puis le chemin
prévu. La simulation les sert : au tour 2, la première prise qui a une sortie « échec » rate et la mission suit sa
branche ; l'arrêt d'urgence ferme le run en cours (interrompu). Code : `components/lecture/`.

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
