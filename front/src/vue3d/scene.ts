import * as THREE from 'three';
import { OrbitControls } from 'three/examples/jsm/controls/OrbitControls.js';
import { EffectComposer } from 'three/examples/jsm/postprocessing/EffectComposer.js';
import { OutputPass } from 'three/examples/jsm/postprocessing/OutputPass.js';
import { RenderPass } from 'three/examples/jsm/postprocessing/RenderPass.js';
import { ShaderPass } from 'three/examples/jsm/postprocessing/ShaderPass.js';
import { UnrealBloomPass } from 'three/examples/jsm/postprocessing/UnrealBloomPass.js';
import { RGBShiftShader } from 'three/examples/jsm/shaders/RGBShiftShader.js';
import type { URDFRobot } from 'urdf-loader';
import { creerNuages, type Nuages } from './nuages';
import { animerRobot, chargerRobot } from './robot';
import { creerSol } from './sol';

export type Calque = 'robot' | 'camera' | 'lidar' | 'sol';

export interface Scene3D {
  afficher(calque: Calque, visible: boolean): void;
  detruire(): void;
  pret: Promise<void>;
}

/** Monte la vue 3D dans `hote` : sol, robot en verre, nuages des capteurs, halo et aberration chromatique. */
export function monterScene(hote: HTMLElement): Scene3D {
  const rendu = new THREE.WebGLRenderer({ antialias: true, powerPreference: 'high-performance' });
  rendu.setPixelRatio(Math.min(window.devicePixelRatio, 2));
  rendu.setClearColor('#030405');
  hote.appendChild(rendu.domElement);

  const scene = new THREE.Scene();
  scene.fog = new THREE.FogExp2('#030405', 0.07);
  const camera = new THREE.PerspectiveCamera(38, 1, 0.05, 200);
  camera.position.set(2.5, 1.5, -2.7);

  const controles = new OrbitControls(camera, rendu.domElement);
  controles.target.set(0.35, 0.75, 0);
  controles.enableDamping = true;
  controles.autoRotate = true;
  controles.autoRotateSpeed = 0.35;
  controles.minDistance = 1.2;
  controles.maxDistance = 9;
  controles.maxPolarAngle = Math.PI * 0.49;
  controles.enablePan = false;
  controles.addEventListener('start', () => (controles.autoRotate = false));

  const sol = creerSol();
  scene.add(sol);

  // Le repère du robot (x devant, z en haut) tourné dans celui de three.js (y en haut).
  const monde = new THREE.Group();
  monde.rotation.x = -Math.PI / 2;
  scene.add(monde);

  const composeur = new EffectComposer(rendu);
  composeur.addPass(new RenderPass(scene, camera));
  const halo = new UnrealBloomPass(new THREE.Vector2(1, 1), 0.55, 0.15, 0.7);
  composeur.addPass(halo);
  const aberration = new ShaderPass(RGBShiftShader);
  aberration.uniforms.amount.value = 0.0016;
  composeur.addPass(aberration);
  composeur.addPass(new OutputPass());

  let robot: URDFRobot | null = null;
  let nuages: Nuages | null = null;
  const visibles: Record<Calque, boolean> = { robot: true, camera: true, lidar: true, sol: true };

  const pret = chargerRobot().then((r) => {
    robot = r;
    monde.add(r);
    scene.updateMatrixWorld(true);
    const bornes = new THREE.Box3().setFromObject(r);
    const zSol = bornes.isEmpty() ? 0 : bornes.min.y;
    monde.position.y = -zSol;
    scene.updateMatrixWorld(true);

    const lienTete = r.links.head_link ?? r.links.torso_link;
    const teteLocale = monde.worldToLocal(new THREE.Box3().setFromObject(lienTete).getCenter(new THREE.Vector3()));

    nuages = creerNuages(teteLocale, zSol);
    for (const p of [nuages.camera, nuages.lidar]) {
      p.frustumCulled = false;
      monde.add(p);
    }
    appliquerVisibilite();
  });

  function appliquerVisibilite(): void {
    sol.visible = visibles.sol;
    if (robot) robot.visible = visibles.robot;
    if (nuages) {
      nuages.camera.visible = visibles.camera;
      nuages.lidar.visible = visibles.lidar;
    }
  }

  function redimensionner(): void {
    const { clientWidth: l, clientHeight: h } = hote;
    rendu.setSize(l, h, false);
    composeur.setSize(l, h);
    halo.setSize(l, h);
    camera.aspect = l / h;
    camera.fov = l < 700 ? 52 : 38;
    camera.updateProjectionMatrix();
    for (const p of nuages ? [nuages.camera, nuages.lidar] : []) {
      (p.material as THREE.ShaderMaterial).uniforms.uEchelle.value = (h * rendu.getPixelRatio()) / 900;
    }
  }
  const observateur = new ResizeObserver(redimensionner);
  observateur.observe(hote);
  pret.then(redimensionner);

  const horloge = new THREE.Clock();
  let image = 0;
  function boucle(): void {
    image = requestAnimationFrame(boucle);
    const t = horloge.getElapsedTime();
    (sol.material as THREE.ShaderMaterial).uniforms.uTemps.value = t;
    if (robot) animerRobot(robot, t);
    nuages?.mettreAJour(t);
    controles.update();
    composeur.render();
  }
  boucle();

  return {
    pret,
    afficher(calque, visible) {
      visibles[calque] = visible;
      appliquerVisibilite();
    },
    detruire() {
      cancelAnimationFrame(image);
      observateur.disconnect();
      controles.dispose();
      composeur.dispose();
      rendu.dispose();
      rendu.domElement.remove();
    },
  };
}
