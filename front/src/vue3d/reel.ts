import * as THREE from 'three';
import type { TrameImage, TrameNuage } from '../api/flux';

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
