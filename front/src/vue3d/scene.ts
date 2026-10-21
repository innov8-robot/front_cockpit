import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import type { URDFRobot } from 'urdf-loader';
import { CALQUE_DETECTIONS, creerDetections, PREMIER_CADRE_S, type Detections } from './detections';
import { creerEnvironnement, teinterMeubles, type Segmentation } from './environnement';
import { creerHologramme } from './hologramme';
import { CAMERA_TETE, creerNuages, type Nuages } from './nuages';
import { allumerRobot, animerRobot, chargerRobot } from './robot';
import { creerBandeSol, creerSol } from './sol';
import { fixerObstacles, mettreAJourSonar, teinterSonar } from './sonar';
import { THEME_PAR_DEFAUT, type ThemeScene } from './theme';

/** Le fond de la scène, le gris très sombre qu'on voyait déjà (la mini-carte s'y accorde). */
const FOND = '#1a1f23';
const PLAN_SOL = new THREE.Plane(new THREE.Vector3(0, 1, 0), 0);
/** La durée du plongeon dans l'écran de la caméra, et celle du retour (s). */
const PLONGEON_S = 1.15;

/** Le clignotement du robot seul (s), puis le déploiement de l'onde (s) jusqu'à RAYON_FINAL (m). */
const ALLUMAGE_S = 1.4;
const DEPLOIEMENT_S = 2.6;
const RAYON_FINAL = 16;
/** La montée de la couleur des objets déclarés dans les nuages (s), avec leurs cadres. */
const TEINTE_S = 0.6;
/** L'allumage en néon : [instant (s), niveau], interpolé en marches. */
const NEON: [number, number][] = [
  [0, 0], [0.12, 0.9], [0.2, 0.1], [0.34, 1], [0.42, 0.2], [0.55, 0.7], [0.62, 0.05], [0.8, 1], [0.9, 0.5], [1.0, 1],
];

function niveauNeon(dt: number): number {
  let niveau = 0;
  for (const [instant, n] of NEON) if (dt >= instant) niveau = n;
  return niveau;
}


export type Calque = 'robot' | 'atelier' | 'camera' | 'lidar' | 'carte' | 'objets' | 'sol';

export interface Scene3D {
  afficher(calque: Calque, visible: boolean): void;
  /** Lance l'apparition : le robot s'allume seul, puis le reste se déploie depuis lui en onde. */
  demarrer(): void;
  /** Le point du sol sous un pixel de l'écran, dans le repère du robot (m, x devant, y à gauche) ; null hors du sol. */
  projeterSol(clientX: number, clientY: number): { x: number; y: number } | null;
  /** Ce que le pointeur survole et qu'on peut ouvrir : l'écran de la caméra, ou rien. */
  cibleSous(clientX: number, clientY: number): 'camera' | null;
  survolerCamera(actif: boolean): void;
  /** Plonge dans l'écran de la caméra jusqu'à voir par l'œil du robot (true), ou en ressort (false). */
  plongerCamera(entrer: boolean): Promise<void>;
  detruire(): void;
  pret: Promise<void>;
  /** Applique un thème de couleurs (vue3d/theme.ts) ; avant que la scène soit prête, il l'attend. */
  theme(t: ThemeScene): void;
  /** Les objets déclarés de l'atelier : leur nom et leur couleur, une fois la scène prête. */
  objets(): { nom: string; couleur: string }[];
}

/** Monte la vue 3D dans `hote` : sol, robot en verre, nuages des capteurs, halo ; l'aberration chromatique est dans les points. */
export function monterScene(hote: HTMLElement): Scene3D {
  const rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  hote.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  // Le fond est porté par la scène, pas par la couleur d'effacement du moteur : three.js convertit celle-ci
  // selon la cible active au moment du réglage, et l'image alternait entre deux fonds (docs : README §Vue 3D).
  scene.background = new THREE.Color(FOND);
  scene.fog = new THREE.FogExp2(FOND, 0.07);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  camera.position.set(3.7, 2.0, 1.6);
  // Les cadres de détection et leurs volumes de masquage : vus par cette caméra, pas par celle de l'hologramme.
  camera.layers.enable(CALQUE_DETECTIONS);

  const controles = new OrbitControls(camera, rendu.domElement);
  controles.target.set(0.35, 0.75, 0);
  controles.enableDamping = true;
  controles.autoRotate = true;
  controles.autoRotateSpeed = 0.35;
  controles.minDistance = 1.2;
  controles.maxDistance = 12;
  controles.maxPolarAngle = Math.PI * 0.49;
  controles.enablePan = false;
  controles.addEventListener('start', () => (controles.autoRotate = false));

  const sol = creerSol();
  scene.add(sol);
  const bandeSol = creerBandeSol();
  scene.add(bandeSol);

  // Le repère du robot (x devant, z en haut) tourné dans celui de three.js (y en haut).
  const monde = new THREE.Group();
  monde.rotation.x = -Math.PI / 2;
  scene.add(monde);

  const composeur = new EffectComposer(rendu);
  composeur.addPass(new RenderPass(scene, camera));
  const halo = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.15, 0.7);
  composeur.addPass(halo);
  composeur.addPass(new OutputPass());

  let robot: URDFRobot | null = null;
  let nuages: Nuages | null = null;
  const visibles: Record<Calque, boolean> = {
    robot: true, atelier: true, camera: true, lidar: true, carte: true, objets: true, sol: true,
  };
  let detections: Detections | null = null;
  let objets: { nom: string; couleur: string }[] = [];
  let atelier: THREE.Object3D | null = null;
  let hologramme: ReturnType<typeof creerHologramme> | null = null;
  let debutApparition: number | null = null;
  let rayon = 0;
  /** Le temps (s) depuis la fin de l'onde de démarrage, ou null tant qu'elle se déploie. */
  let deploye: number | null = null;
  /** La couleur des objets déclarés, de 0 à 1, et la plongée dans la caméra de tête, de 0 (orbite) à 1 (dedans). */
  let teinte = 0;
  let plongee = 0;
  let segmentation: Segmentation | null = null;
  let peau: THREE.Object3D | null = null;
  let themeCourant: ThemeScene = THEME_PAR_DEFAUT;
  const origineSonarLocale = new THREE.Vector3();

  const pret = chargerRobot().then((r) => {
    robot = r;
    monde.add(r);
    scene.updateMatrixWorld(true);
    const bornes = new THREE.Box3().setFromObject(r);
    const zSol = bornes.isEmpty() ? 0 : bornes.min.y;
    monde.position.y = -zSol;
    // Le sonar part du sol, au centre de l'anneau sous le robot.
    origineSonarLocale.set(0, 0, zSol + 0.02);
    scene.updateMatrixWorld(true);

    const lienTete = r.links.head_link ?? r.links.torso_link;
    const teteLocale = monde.worldToLocal(new THREE.Box3().setFromObject(lienTete).getCenter(new THREE.Vector3()));

    const env = creerEnvironnement(zSol);
    atelier = env.objet;
    // Chaque meuble apparaît quand l'onde l'atteint ; le contour de la salle, en dernier.
    for (const meuble of atelier.children) {
      meuble.userData.distance = meuble.position.lengthSq() > 0 ? Math.hypot(meuble.position.x, meuble.position.y) : RAYON_FINAL * 0.8;
    }
    monde.add(atelier);
    nuages = creerNuages(teteLocale, env.lancer, env.objets);
    monde.add(env.masque);
    // Les ombres du sonar : les obstacles de l'atelier, ramenés dans le monde.
    fixerObstacles(env.obstacles.map((b) => b.clone().applyMatrix4(monde.matrixWorld)));
    peau = env.peau;
    monde.add(peau);
    segmentation = env.segmentation;
    monde.add(segmentation.groupe);
    detections = creerDetections(scene, hote, env.objets);
    objets = env.objets.map(({ nom, couleur }) => ({ nom, couleur }));
    hologramme = creerHologramme(rendu, scene, teteLocale.clone().add(CAMERA_TETE.decalage));
    monde.add(hologramme.groupe);
    monde.add(nuages.carte, nuages.camera, nuages.lidar);
    appliquerVisibilite();
    appliquerTheme(themeCourant);
  });

  /** Pose les couleurs du thème sur la scène : nuages, sonar, arêtes, sol et front du déploiement. */
  function appliquerTheme(t: ThemeScene): void {
    themeCourant = t;
    nuages?.teinter(t.camera, t.lidar, t.memoire);
    teinterSonar(t.sonar);
    teinterMeubles(t.meubles);
    const u = (sol.material as THREE.ShaderMaterial).uniforms;
    u.uLigne.value.set(t.sol);
    u.uAccent.value.set(t.deploiement);
  }

  function appliquerVisibilite(): void {
    sol.visible = visibles.sol;
    bandeSol.visible = visibles.sol;
    if (atelier) atelier.visible = visibles.atelier;
    if (peau) peau.visible = visibles.atelier;
    if (nuages) {
      nuages.camera.visible = visibles.camera;
      if (hologramme) hologramme.groupe.visible = visibles.camera && rayon > 0.4;
      nuages.lidar.visible = visibles.lidar;
      nuages.carte.visible = visibles.carte;
    }
    detections?.afficher(visibles.objets && visibles.camera);
  }

  function redimensionner(): void {
    const { clientWidth: l, clientHeight: h } = hote;
    rendu.setSize(l, h, false);
    composeur.setSize(l, h);
    halo.setSize(l, h);
    camera.aspect = l / h;
    if (!dansCamera && !vol) camera.fov = l < 700 ? 52 : 38;
    camera.updateProjectionMatrix();
    for (const m of nuages?.materiaux ?? []) m.uniforms.uEchelle.value = (h * rendu.getPixelRatio()) / 900;
  }
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  pret.then(redimensionner);

  /** Avant `demarrer` tout est éteint ; ensuite le robot clignote seul, puis l'onde déploie le reste. */
  function apparaitre(t: number): void {
    const dt = debutApparition === null ? -1 : t - debutApparition;
    if (robot) allumerRobot(robot, visibles.robot ? (dt < 0 ? 0 : niveauNeon(dt)) : 0);
    const avance = Math.min(1, Math.max(0, (dt - ALLUMAGE_S) / DEPLOIEMENT_S));
    rayon = avance >= 1 ? 1000 : RAYON_FINAL * (1 - (1 - avance) ** 2.2);
    (sol.material as THREE.ShaderMaterial).uniforms.uRevele.value = rayon;
    nuages?.reveler(rayon);
    if (atelier) for (const meuble of atelier.children) meuble.visible = meuble.userData.distance <= rayon;
    if (hologramme) hologramme.groupe.visible = visibles.camera && rayon > 0.4;
    deploye = avance >= 1 ? dt - ALLUMAGE_S - DEPLOIEMENT_S : null;
    // Les objets prennent leur couleur quand leurs cadres s'accrochent, pas pendant l'onde.
    teinte = deploye === null ? 0 : Math.min(1, Math.max(0, (deploye - PREMIER_CADRE_S) / TEINTE_S));
    nuages?.colorerObjets(visibles.objets ? teinte : 0);
    // Par l'œil du robot, les objets apparaissent segmentés : la silhouette monte avec le plongeon.
    segmentation?.regler(visibles.objets ? teinte * plongee : 0);
  }

  const rayonSouris = new THREE.Raycaster();
  const horloge = new THREE.Clock();
  let image = 0;
  /** Le vol de la vue entre son orbite et l'œil du robot ; `retour` garde la pose d'orbite pour y revenir. */
  interface Pose { position: THREE.Vector3; quaternion: THREE.Quaternion; fov: number }
  let vol: { de: Pose; vers: () => Pose; debut: number; entre: boolean; fin: () => void } | null = null;
  let dansCamera = false;
  let retour: Pose | null = null;
  const poseActuelle = (): Pose => ({ position: camera.position.clone(), quaternion: camera.quaternion.clone(), fov: camera.fov });
  const poseOeil = (): Pose => {
    const oeil = hologramme!.oeil;
    oeil.updateMatrixWorld(true);
    return { position: oeil.getWorldPosition(new THREE.Vector3()), quaternion: oeil.getWorldQuaternion(new THREE.Quaternion()), fov: oeil.fov };
  };

  function voler(t: number): void {
    if (!vol) return;
    const k = Math.min(1, (t - vol.debut) / PLONGEON_S);
    const e = k < 0.5 ? 4 * k * k * k : 1 - (-2 * k + 2) ** 3 / 2;
    const vers = vol.vers();
    camera.position.lerpVectors(vol.de.position, vers.position, e);
    camera.quaternion.slerpQuaternions(vol.de.quaternion, vers.quaternion, e);
    camera.fov = THREE.MathUtils.lerp(vol.de.fov, vers.fov, e);
    camera.updateProjectionMatrix();
    // En approchant de l'écran, on le traverse : il disparaît juste avant qu'on soit dedans.
    if (vol.entre) hologramme?.masquer(e > 0.82);
    plongee = vol.entre ? e : 1 - e;
    if (k >= 1) {
      const fin = vol.fin;
      vol = null;
      fin();
    }
  }

  const origineSonar = new THREE.Vector3();
  const oeilSonar = new THREE.Vector3();
  function boucle(): void {
    image = requestAnimationFrame(boucle);
    const t = horloge.getElapsedTime();
    (sol.material as THREE.ShaderMaterial).uniforms.uTemps.value = t;
    apparaitre(t);
    // Le sonar part de la tête une fois la scène déployée, et monte en force sur une seconde.
    if (nuages) {
      origineSonar.copy(origineSonarLocale);
      oeilSonar.copy(nuages.origineLidar);
      mettreAJourSonar(t, monde.localToWorld(origineSonar), monde.localToWorld(oeilSonar),
        deploye === null ? 0 : Math.min(1, deploye));
    }
    if (robot) animerRobot(robot, t);
    nuages?.mettreAJour(t);
    hologramme?.mettreAJour(t);
    voler(t);
    if (!vol) plongee = dansCamera ? 1 : 0;
    if (!vol && !dansCamera) controles.update();
    // Les cadres se posent avant le rendu : sinon ils suivent la vue avec une image de retard.
    camera.updateMatrixWorld();
    if (nuages) detections?.mettreAJour(t, camera, monde, deploye, nuages.pointsParObjet);
    composeur.render();
  }
  boucle();

  return {
    pret,
    objets: () => objets,
    theme: appliquerTheme,
    projeterSol(clientX, clientY) {
      const r = rendu.domElement.getBoundingClientRect();
      rayonSouris.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      const point = rayonSouris.ray.intersectPlane(PLAN_SOL, new THREE.Vector3());
      if (!point) return null;
      const local = monde.worldToLocal(point);
      return { x: local.x, y: local.y };
    },
    cibleSous(clientX, clientY) {
      if (!hologramme || !hologramme.groupe.visible || dansCamera || vol) return null;
      const r = rendu.domElement.getBoundingClientRect();
      rayonSouris.setFromCamera(new THREE.Vector2(((clientX - r.left) / r.width) * 2 - 1, -((clientY - r.top) / r.height) * 2 + 1), camera);
      return rayonSouris.intersectObject(hologramme.panneau, false).length ? 'camera' : null;
    },
    survolerCamera(actif) {
      hologramme?.survoler(actif);
    },
    plongerCamera(entrer) {
      return new Promise((fini) => {
        if (!hologramme || entrer === dansCamera || vol) return fini();
        const t = horloge.getElapsedTime();
        if (entrer) {
          retour = poseActuelle();
          controles.enabled = false;
          dansCamera = true;
          hologramme.survoler(false);
          vol = { de: retour, vers: poseOeil, debut: t, entre: true, fin: fini };
        } else {
          hologramme.masquer(false);
          const arrivee = retour!;
          vol = { de: poseActuelle(), vers: () => arrivee, debut: t, entre: false, fin: () => {
            dansCamera = false;
            controles.enabled = true;
            fini();
          } };
        }
      });
    },
    demarrer() {
      if (debutApparition === null) debutApparition = horloge.getElapsedTime();
    },
    afficher(calque, visible) {
      visibles[calque] = visible;
      appliquerVisibilite();
    },
    detruire() {
      cancelAnimationFrame(image);
      observateur.disconnect();
      controles.dispose();
      hologramme?.detruire();
      detections?.detruire();
      composeur.dispose();
      rendu.dispose();
      rendu.domElement.remove();
    },
  };
}
