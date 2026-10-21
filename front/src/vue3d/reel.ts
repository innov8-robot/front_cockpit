import * as THREE from 'three';
import type { TrameImage, TrameNuage } from '../api/flux';
import { GLSL_SONAR, SONAR } from './sonar';

/** Le plus grand nuage que les tampons tiennent : celui du lidar (60 000 points côté serveur). */
const MAX_LIDAR = 60_000;
const MAX_CAMERA = 320 * 240;
/** Au-delà de cette profondeur, un point de la caméra est du bruit (mm). */
const PROFONDEUR_MAX_MM = 4000;

function nuageVide(max: number, taille: number): { points: THREE.Points; position: Float32Array; couleur: Float32Array } {
  const position = new Float32Array(max * 3);
  const couleur = new Float32Array(max * 3);
  const geo = new THREE.BufferGeometry();
  geo.setAttribute('position', new THREE.BufferAttribute(position, 3));
  geo.setAttribute('color', new THREE.BufferAttribute(couleur, 3));
  geo.setDrawRange(0, 0);
  const points = new THREE.Points(geo, new THREE.PointsMaterial({
    size: taille, vertexColors: true, sizeAttenuation: true, transparent: true, opacity: 0.9, depthWrite: false,
  }));
  points.frustumCulled = false;
  return { points, position, couleur };
}

/**
 * Les nuages du vrai robot, tous deux dans le repère du torse comme dans la vue 3D viser : la caméra déprojetée
 * puis portée par sa hand-eye `T_base_cam` (le repère « base » de la hand-eye est le torse), le lidar tel quel.
 * L'appelant les accroche au lien `torso_link` du modèle.
 */
export function creerNuagesReels() {
  const camera = nuageVide(MAX_CAMERA, 0.012);
  const lidar = nuageVide(MAX_LIDAR, 0.018);
  const toile = new OffscreenCanvas(1, 1);
  const contexte = toile.getContext('2d', { willReadFrequently: true })!;
  const rougeLidar = new THREE.Color('#ff5a64');

  /** Déprojette la profondeur, colorée par l'image couleur ramenée à sa résolution. */
  async function image(t: TrameImage): Promise<ImageBitmap | null> {
    const bitmap = await createImageBitmap(t.jpeg);
    const p = t.profondeur;
    if (!p || !t.intrinseques) return bitmap;
    toile.width = p.largeur;
    toile.height = p.hauteur;
    contexte.drawImage(bitmap, 0, 0, p.largeur, p.hauteur);
    const rvb = contexte.getImageData(0, 0, p.largeur, p.hauteur).data;
    const [fx, fy, cx, cy] = t.intrinseques.map((v) => v / p.pas);
    // La hand-eye, en lignes (convention OpenCV de la caméra : x à droite, y vers le bas, z devant).
    const m = t.pose ?? [[1, 0, 0, 0], [0, 1, 0, 0], [0, 0, 1, 0], [0, 0, 0, 1]];
    let n = 0;
    for (let v = 0; v < p.hauteur && n < MAX_CAMERA; v++) {
      for (let u = 0; u < p.largeur; u++) {
        const mm = p.mm[v * p.largeur + u];
        if (!mm || mm > PROFONDEUR_MAX_MM) continue;
        const z = mm / 1000;
        const x = ((u - cx) / fx) * z;
        const y = ((v - cy) / fy) * z;
        camera.position.set([
          m[0][0] * x + m[0][1] * y + m[0][2] * z + m[0][3],
          m[1][0] * x + m[1][1] * y + m[1][2] * z + m[1][3],
          m[2][0] * x + m[2][1] * y + m[2][2] * z + m[2][3],
        ], n * 3);
        const k = (v * p.largeur + u) * 4;
        camera.couleur.set([rvb[k] / 255, rvb[k + 1] / 255, rvb[k + 2] / 255], n * 3);
        n++;
      }
    }
    const geo = camera.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
    return bitmap;
  }

  /** Pose le nuage du lidar, teinté par sa réflectivité. */
  function nuage(t: TrameNuage): void {
    const n = Math.min(MAX_LIDAR, t.points.length / 3);
    lidar.position.set(t.points.subarray(0, n * 3));
    for (let i = 0; i < n; i++) {
      const eclat = 0.35 + 0.65 * Math.min(1, t.reflectivite[i] / 120);
      lidar.couleur.set([rougeLidar.r * eclat, rougeLidar.g * eclat, rougeLidar.b * eclat], i * 3);
    }
    const geo = lidar.points.geometry;
    geo.setDrawRange(0, n);
    geo.attributes.position.needsUpdate = true;
    geo.attributes.color.needsUpdate = true;
  }

  return { camera: camera.points, lidar: lidar.points, image, nuage };
}

export type NuagesReels = ReturnType<typeof creerNuagesReels>;

/** La grille du châssis, telle que la sert `/api/carte`. */
export interface GrilleChassis {
  x0: number;
  y0: number;
  res: number;
  w: number;
  h: number;
  /** Les octets de la grille en base64 : 0 jamais vu, 1 à 127 libre, au-delà occupé. */
  cellules: string;
}

const SEUIL_OCCUPE = 127;
/** Comme `navigation.grille.grille_vers_nuage` (la vue 3D viser), sans le sol : chaque mur en colonnette. */
/** Les murs sont peints sous le seuil du halo (0,7) : seule l’impulsion du sonar y brille. */
const MUR_Z = [0.2, 0.67, 1.13, 1.6];

/** Les points de la carte, que l'impulsion du sonar allume en bleu quand elle les traverse. */
function materiauCarte(): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: { ...SONAR, uTaille: { value: 0.03 } },
    vertexShader: /* glsl */ `
      ${GLSL_SONAR}
      uniform float uTaille;
      attribute vec3 color;
      varying vec3 vCouleur;
      varying float vAlpha;
      void main() {
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        float s = min(1.0, sonar((modelMatrix * vec4(position, 1.0)).xyz) * 1.3);
        vCouleur = mix(color, uSonarCouleur * uSonarEclat, s);
        vAlpha = max(0.85, s);
        gl_PointSize = clamp(uTaille * 900.0 / -vue.z, 1.5, 6.0) * (1.0 + 0.6 * s);
        gl_Position = projectionMatrix * vue;
      }`,
    fragmentShader: /* glsl */ `
      varying vec3 vCouleur;
      varying float vAlpha;
      void main() {
        if (length(gl_PointCoord - 0.5) > 0.5) discard;
        gl_FragColor = vec4(vCouleur, vAlpha);
      }`,
  });
}

/**
 * La carte du châssis en relief, dans le repère de la carte. `poserBase` la place sous le robot : le repère du
 * modèle est celui de la base, que la pose du châssis situe dans la carte.
 */
export function creerCarteChassis() {
  const groupe = new THREE.Group();
  let points: THREE.Points | null = null;

  function grille(g: GrilleChassis): void {
    const octets = Uint8Array.from(atob(g.cellules), (c) => c.charCodeAt(0));
    const xyz: number[] = [];
    const rvb: number[] = [];
    for (let j = 0; j < g.h; j++) {
      for (let i = 0; i < g.w; i++) {
        const v = octets[j * g.w + i];
        const x = g.x0 + (i + 0.5) * g.res;
        const y = g.y0 + (j + 0.5) * g.res;
        if (v > SEUIL_OCCUPE) {
          for (const z of MUR_Z) { xyz.push(x, y, z); rvb.push(0.56, 0.6, 0.68); }
        }
      }
    }
    const geo = new THREE.BufferGeometry();
    geo.setAttribute('position', new THREE.Float32BufferAttribute(xyz, 3));
    geo.setAttribute('color', new THREE.Float32BufferAttribute(rvb, 3));
    if (points) {
      points.geometry.dispose();
      points.geometry = geo;
      return;
    }
    points = new THREE.Points(geo, materiauCarte());
    points.frustumCulled = false;
    groupe.add(points);
  }

  /** Place la carte : la pose du châssis `(x, y, yaw)` dans la carte devient l'origine du modèle. */
  function poserBase(pose: { x: number; y: number; yaw: number }): void {
    groupe.rotation.set(0, 0, -pose.yaw);
    const c = Math.cos(-pose.yaw);
    const s = Math.sin(-pose.yaw);
    groupe.position.set(-(c * pose.x - s * pose.y), -(s * pose.x + c * pose.y), groupe.position.z);
  }

  return { groupe, grille, poserBase };
}
