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
 * Les nuages du vrai robot : la caméra déprojetée dans le repère de la caméra de tête (qui regarde vers -z,
 * comme une caméra three.js), le lidar dans le repère du torse. L'appelant les accroche à ces repères.
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
    let n = 0;
    for (let v = 0; v < p.hauteur && n < MAX_CAMERA; v++) {
      for (let u = 0; u < p.largeur; u++) {
        const mm = p.mm[v * p.largeur + u];
        if (!mm || mm > PROFONDEUR_MAX_MM) continue;
        const z = mm / 1000;
        camera.position.set([((u - cx) / fx) * z, -((v - cy) / fy) * z, -z], n * 3);
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
