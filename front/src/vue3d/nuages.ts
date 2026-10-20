import * as THREE from 'three';

/**
 * Nuages simulés : on lance les rayons des deux capteurs de tête dans une cellule fictive (repère du robot,
 * x devant, z en haut). Le back les remplacera par les vrais nuages ; la forme des tampons ne change pas.
 */

interface Boite { min: THREE.Vector3; max: THREE.Vector3 }

const boite = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number): Boite => ({
  min: new THREE.Vector3(x0, y0, z0), max: new THREE.Vector3(x1, y1, z1),
});

function cellule(sol: number): { boites: Boite[]; piece: Boite } {
  const t = sol + 0.75;
  const boites = [
    boite(0.38, -0.6, t - 0.03, 1.08, 0.6, t),
    ...[[0.4, -0.58], [1.02, -0.58], [0.4, 0.54], [1.02, 0.54]].map(([x, y]) => boite(x, y, sol, x + 0.04, y + 0.04, t - 0.03)),
    boite(0.46, -0.21, t, 0.58, -0.11, t + 0.06),
    boite(0.6, 0.02, t, 0.7, 0.1, t + 0.09),
    boite(0.36, -0.12, t, 0.47, -0.01, t + 0.23),
    boite(0.72, 0.18, t, 1.02, 0.2, t + 0.13), boite(0.72, 0.4, t, 1.02, 0.42, t + 0.13),
    boite(0.72, 0.18, t, 0.74, 0.42, t + 0.13), boite(1.0, 0.18, t, 1.02, 0.42, t + 0.13),
    boite(0.72, 0.18, t, 1.02, 0.42, t + 0.01),
    boite(1.9, -3.2, sol, 2.8, -1.7, sol + 1.6),
    boite(2.0, -1.6, sol + 0.9, 2.6, -1.4, sol + 1.2),
    boite(-0.4, 2.2, sol, 1.8, 2.6, sol + 1.9),
    boite(-0.4, 2.2, sol + 0.6, 1.8, 2.0, sol + 0.63), boite(-0.4, 2.2, sol + 1.2, 1.8, 2.0, sol + 1.23),
    boite(3.2, 0.6, sol, 3.8, 1.4, sol + 0.9),
  ];
  return { boites, piece: boites[5] };
}

const SALLE = { min: new THREE.Vector3(-4, -5, 0), max: new THREE.Vector3(6, 5, 3.2) };

function rayon(o: THREE.Vector3, d: THREE.Vector3, boites: Boite[], sol: number): number {
  let meilleur = Infinity;
  for (const b of boites) {
    let tmin = -Infinity;
    let tmax = Infinity;
    for (const k of ['x', 'y', 'z'] as const) {
      const inv = 1 / d[k];
      let t0 = (b.min[k] - o[k]) * inv;
      let t1 = (b.max[k] - o[k]) * inv;
      if (t0 > t1) [t0, t1] = [t1, t0];
      tmin = Math.max(tmin, t0);
      tmax = Math.min(tmax, t1);
    }
    if (tmax >= tmin && tmin > 0.02 && tmin < meilleur) meilleur = tmin;
  }
  for (const k of ['x', 'y', 'z'] as const) {
    const bas = k === 'z' ? sol : SALLE.min[k];
    const haut = k === 'z' ? sol + SALLE.max.z : SALLE.max[k];
    const t = d[k] > 0 ? (haut - o[k]) / d[k] : (bas - o[k]) / d[k];
    if (t > 0 && t < meilleur) meilleur = t;
  }
  return meilleur;
}

function materiauPoints(couleur: string, taille: number, vie: number): THREE.ShaderMaterial {
  return new THREE.ShaderMaterial({
    uniforms: {
      uCouleur: { value: new THREE.Color(couleur) },
      uTaille: { value: taille },
      uTemps: { value: 0 },
      uVie: { value: vie },
      uEchelle: { value: 1 },
    },
    vertexShader: /* glsl */ `
      attribute float aNaissance;
      uniform float uTaille;
      uniform float uTemps;
      uniform float uVie;
      uniform float uEchelle;
      varying float vAlpha;
      varying float vHauteur;
      void main() {
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        float age = uVie > 0.0 ? clamp((uTemps - aNaissance) / uVie, 0.0, 1.0) : 0.0;
        float balayage = smoothstep(0.25, 0.0, abs(length(position.xy) - mod(uTemps * 1.4, 7.0)));
        vAlpha = (1.0 - age) * (0.55 + balayage * 1.6);
        vHauteur = position.z;
        gl_PointSize = clamp(uTaille * uEchelle / -vue.z, 1.5, 4.0);
        gl_Position = projectionMatrix * vue;
      }`,
    fragmentShader: /* glsl */ `
      uniform vec3 uCouleur;
      varying float vAlpha;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5) discard;
        if (vAlpha < 0.04) discard;
        gl_FragColor = vec4(uCouleur * (0.2 + 0.6 * vAlpha), 1.0);
      }`,
  });
}

export interface Nuages {
  camera: THREE.Points;
  lidar: THREE.Points;
  mettreAJour(t: number): void;
}

/** Construit les deux nuages ; `tete` est le point de la tête du robot dans son repère. */
export function creerNuages(tete: THREE.Vector3, sol: number): Nuages {
  const { boites } = cellule(sol);

  const L = 200;
  const H = 150;
  const posCam = new Float32Array(L * H * 3);
  const geoCam = new THREE.BufferGeometry();
  geoCam.setAttribute('position', new THREE.BufferAttribute(posCam, 3));
  geoCam.setAttribute('aNaissance', new THREE.BufferAttribute(new Float32Array(L * H), 1));
  const camera = new THREE.Points(geoCam, materiauPoints('#a9bcdc', 7, 0));
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
        let t = rayon(origineCam, d, boites, sol);
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
  const lidar = new THREE.Points(geoLid, materiauPoints('#ff2d3a', 7, 2.4));
  const origineLid = tete.clone().add(new THREE.Vector3(0.02, 0, 0.06));
  const elevMin = THREE.MathUtils.degToRad(-47);
  const elevMax = THREE.MathUtils.degToRad(5);
  let curseur = 0;

  function balayerLidar(t: number): void {
    for (let k = 0; k < PAR_IMAGE; k++) {
      const az = Math.random() * Math.PI * 2;
      const el = elevMin + Math.random() * (elevMax - elevMin);
      d.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      const r = rayon(origineLid, d, boites, sol);
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

  return {
    camera,
    lidar,
    mettreAJour(t: number) {
      balayerLidar(t);
      if (t - derniereCam > 0.25) {
        rafraichirCamera();
        derniereCam = t;
      }
      for (const p of [camera, lidar]) (p.material as THREE.ShaderMaterial).uniforms.uTemps.value = t;
    },
  };
}
