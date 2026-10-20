import * as THREE from 'three';
import type { Lancer } from './environnement';

/**
 * Nuages simulés : on lance les rayons des deux capteurs de tête dans l'atelier fictif (repère du robot,
 * x devant, z en haut). Le back les remplacera par les vrais nuages ; la forme des tampons ne change pas.
 */

/** Un canal (rouge, vert ou bleu) d'un nuage, décalé vers l'extérieur de l'image : l'aberration chromatique. */
function materiauCanal(couleur: string, taille: number, vie: number, canal: THREE.Vector3, decalage: number) {
  return new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    // Le maximum par canal : les trois passes se recomposent en blanc sans que les points denses s'empilent.
    blending: THREE.CustomBlending,
    blendEquation: THREE.MaxEquation,
    blendSrc: THREE.OneFactor,
    blendDst: THREE.OneFactor,
    uniforms: {
      uCouleur: { value: new THREE.Color(couleur).multiply(new THREE.Color(canal.x, canal.y, canal.z)) },
      uTaille: { value: taille },
      uTemps: { value: 0 },
      uVie: { value: vie },
      uEchelle: { value: 1 },
      uDecalage: { value: decalage },
    },
    vertexShader: /* glsl */ `
      attribute float aNaissance;
      uniform float uTaille;
      uniform float uTemps;
      uniform float uVie;
      uniform float uEchelle;
      uniform float uDecalage;
      varying float vAlpha;
      void main() {
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        float age = uVie > 0.0 ? clamp((uTemps - aNaissance) / uVie, 0.0, 1.0) : 0.0;
        float balayage = smoothstep(0.25, 0.0, abs(length(position.xy) - mod(uTemps * 1.4, 7.0)));
        vAlpha = (1.0 - age) * (0.55 + balayage * 1.6);
        gl_PointSize = clamp(uTaille * uEchelle / -vue.z, 1.5, 4.0);
        gl_Position = projectionMatrix * vue;
        vec2 ecran = gl_Position.xy / gl_Position.w;
        float r = length(ecran);
        vec2 dir = r > 1e-3 ? ecran / r : vec2(1.0, 0.0);
        gl_Position.xy += dir * uDecalage * (0.3 + r * 1.4) * gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCouleur;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vAlpha < 0.04) discard;
        gl_FragColor = vec4(uCouleur * (0.3 + 0.7 * vAlpha), 1.0);
      }`,
  });
}

const CANAUX: [THREE.Vector3, number][] = [
  [new THREE.Vector3(1, 0, 0), 0.0045],
  [new THREE.Vector3(0, 1, 0), 0],
  [new THREE.Vector3(0, 0, 1), -0.0045],
];

/** Le nuage dessiné trois fois, un canal par passe : là où les trois se recouvrent, le point est blanc. */
function nuageAberrant(geometrie: THREE.BufferGeometry, couleur: string, taille: number, vie: number) {
  const groupe = new THREE.Group();
  const materiaux = CANAUX.map(([canal, decalage]) => materiauCanal(couleur, taille, vie, canal, decalage));
  for (const m of materiaux) {
    const p = new THREE.Points(geometrie, m);
    p.frustumCulled = false;
    groupe.add(p);
  }
  return { groupe, materiaux };
}

export interface Nuages {
  camera: THREE.Group;
  lidar: THREE.Group;
  materiaux: THREE.ShaderMaterial[];
  mettreAJour(t: number): void;
}

/** Construit les deux nuages ; `tete` est le point de la tête du robot dans son repère. */
export function creerNuages(tete: THREE.Vector3, lancer: Lancer): Nuages {

  const L = 200;
  const H = 150;
  const posCam = new Float32Array(L * H * 3);
  const geoCam = new THREE.BufferGeometry();
  geoCam.setAttribute('position', new THREE.BufferAttribute(posCam, 3));
  geoCam.setAttribute('aNaissance', new THREE.BufferAttribute(new Float32Array(L * H), 1));
  const camera = nuageAberrant(geoCam, '#c4d2ea', 7, 0);
  const origineCam = tete.clone().add(new THREE.Vector3(0.07, 0, -0.02));
  const tangage = THREE.MathUtils.degToRad(48);
  const fovH = THREE.MathUtils.degToRad(87) / 2;
  const fovV = THREE.MathUtils.degToRad(58) / 2;
  const d = new THREE.Vector3();

  function rafraichirCamera(): void {
    let n = 0;
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < L; i++) {
        const u = Math.tan(fovH * (1 - (2 * (i + Math.random() * 0.3)) / L));
        const v = Math.tan(fovV * (1 - (2 * (j + Math.random() * 0.3)) / H));
        d.set(1, u, v).normalize();
        const c = Math.cos(tangage);
        const s = Math.sin(tangage);
        d.set(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
        let t = lancer(origineCam, d);
        if (t > 3.2) t = NaN;
        t *= 1 + (Math.random() - 0.5) * 0.004;
        posCam[n++] = origineCam.x + d.x * t;
        posCam[n++] = origineCam.y + d.y * t;
        posCam[n++] = origineCam.z + d.z * t;
      }
    }
    geoCam.attributes.position.needsUpdate = true;
  }

  const N = 60_000;
  const PAR_IMAGE = 2_400;
  const posLid = new Float32Array(N * 3).fill(NaN);
  const naissance = new Float32Array(N).fill(-99);
  const geoLid = new THREE.BufferGeometry();
  geoLid.setAttribute('position', new THREE.BufferAttribute(posLid, 3));
  geoLid.setAttribute('aNaissance', new THREE.BufferAttribute(naissance, 1));
  const lidar = nuageAberrant(geoLid, '#ff5a64', 7, 2.4);
  const origineLid = tete.clone().add(new THREE.Vector3(0.02, 0, 0.06));
  const elevMin = THREE.MathUtils.degToRad(-47);
  const elevMax = THREE.MathUtils.degToRad(5);
  let curseur = 0;

  function balayerLidar(t: number): void {
    for (let k = 0; k < PAR_IMAGE; k++) {
      const az = Math.random() * Math.PI * 2;
      const el = elevMin + Math.random() * (elevMax - elevMin);
      d.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      const r = lancer(origineLid, d);
      const i = curseur * 3;
      const ok = r < 12;
      posLid[i] = ok ? origineLid.x + d.x * r : NaN;
      posLid[i + 1] = ok ? origineLid.y + d.y * r : NaN;
      posLid[i + 2] = ok ? origineLid.z + d.z * r : NaN;
      naissance[curseur] = t;
      curseur = (curseur + 1) % N;
    }
    geoLid.attributes.position.needsUpdate = true;
    geoLid.attributes.aNaissance.needsUpdate = true;
  }

  rafraichirCamera();
  let derniereCam = 0;

  const materiaux = [...camera.materiaux, ...lidar.materiaux];
  return {
    camera: camera.groupe,
    lidar: lidar.groupe,
    materiaux,
    mettreAJour(t: number) {
      balayerLidar(t);
      if (t - derniereCam > 0.25) {
        rafraichirCamera();
        derniereCam = t;
      }
      for (const m of materiaux) m.uniforms.uTemps.value = t;
    },
  };
}
