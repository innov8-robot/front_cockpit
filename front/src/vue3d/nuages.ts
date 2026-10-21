import * as THREE from 'three';
import type { Lancer, ObjetDeclare, Touche } from './environnement';
import { GLSL_SONAR, SONAR } from './sonar';

/** La caméra de tête (RealSense D435i) : son décalage depuis le centre de la tête, son tangage et son champ. */
export const CAMERA_TETE = { decalage: new THREE.Vector3(0.07, 0, -0.02), tangageDeg: 48, champHDeg: 87, champVDeg: 58 };

/**
 * Nuages simulés : on lance les rayons des deux capteurs de tête dans l'atelier fictif (repère du robot,
 * x devant, z en haut). Le back les remplacera par les vrais nuages ; la forme des tampons ne change pas.
 */

/** Le nombre d'objets déclarés que les nuages savent colorer. */
const MAX_OBJETS = 8;
/**
 * Ce que voient les capteurs maintenant : des points blancs, dans les quelques mètres autour du robot. Un blanc
 * retenu : les nuages se fondent au maximum par canal, et l'impulsion du sonar doit pouvoir le dépasser.
 */
const VIVANT = { couleur: '#ffffff', taille: 7, tailleMax: 4, opacite: 0.42, portee: 4 };
/** La carte mémorisée : un point par cube de `VOXEL_M` déjà vu, plus gros et presque transparent, partout. */
const CARTE = { couleur: '#6f86ad', taille: 15, tailleMax: 8, opacite: 0.2, portee: 1000 };
const VOXEL_M = 0.05;
/** La hauteur (m) que couvre un dégradé par la hauteur, du sol à son dernier palier. */
const HAUTEUR_RAMPE_M = 1.8;
/** L'éclat de la carte mémorisée dans un dégradé : le même dégradé, éteint. */
const ECLAT_MEMOIRE_RAMPE = 0.9;

/** Une couleur, ou un dégradé par la hauteur de cinq paliers, du sol vers le haut. */
export type Teinte = string | readonly string[];
const CAPACITE_CARTE = 150_000;

/** `portee` : au-delà de cette distance au robot (m), le nuage s'efface. */
interface Rendu { couleur: string; taille: number; tailleMax: number; opacite: number; portee: number }

/** Un canal (rouge, vert ou bleu) d'un nuage, décalé vers l'extérieur de l'image : l'aberration chromatique. */
function materiauCanal(rendu: Rendu, vie: number, canal: THREE.Vector3, decalage: number, teintes: THREE.Color[]) {
  const { couleur, taille, tailleMax, opacite, portee } = rendu;
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
      uDegrade: { value: 0 },
      uRampe: { value: Array.from({ length: 5 }, () => new THREE.Color(couleur)) },
      uTaille: { value: taille },
      uTemps: { value: 0 },
      uVie: { value: vie },
      uEchelle: { value: 1 },
      uRevele: { value: 1000 },
      uDecalage: { value: decalage },
      uCanal: { value: new THREE.Color(canal.x, canal.y, canal.z) },
      uTeintes: { value: teintes },
      uObjets: { value: 0 },
      uOpacite: { value: opacite },
      ...SONAR,
    },
    vertexShader: /* glsl */ `
      ${GLSL_SONAR}
      uniform float uOpacite;
      attribute float aNaissance;
      attribute float aObjet;
      uniform vec3 uCouleur;
      uniform vec3 uCanal;
      uniform float uDegrade;
      uniform vec3 uRampe[5];
      // La couleur selon la hauteur au-dessus du sol (0 à HAUTEUR_RAMPE_M), en cinq paliers interpolés.
      vec3 rampe(float h) {
        float x = clamp(h, 0.0, 1.0) * 4.0;
        vec3 c = uRampe[4];
        for (int k = 0; k < 4; k++) if (x < float(k + 1)) { c = mix(uRampe[k], uRampe[k + 1], x - float(k)); break; }
        return c;
      }
      uniform vec3 uTeintes[${MAX_OBJETS}];
      uniform float uObjets;
      varying vec3 vCouleur;
      uniform float uTaille;
      uniform float uTemps;
      uniform float uVie;
      uniform float uEchelle;
      uniform float uRevele;
      uniform float uDecalage;
      varying float vAlpha;
      void main() {
        vec4 vue = modelViewMatrix * vec4(position, 1.0);
        float age = uVie > 0.0 ? clamp((uTemps - aNaissance) / uVie, 0.0, 1.0) : 0.0;
        // Le vivant n'est blanc que près du robot : au-delà de sa portée, seule la carte mémorisée reste.
        vAlpha = (1.0 - age) * uOpacite * (1.0 - smoothstep(${(portee * 0.6).toFixed(2)}, ${portee.toFixed(2)}, length(position.xy)));
        // Le déploiement : rien au-delà du front de l'onde (rayon uRevele autour du robot), le front éclairé.
        float distanceRobot = length(position.xy);
        vAlpha = distanceRobot > uRevele ? 0.0 : vAlpha + smoothstep(0.4, 0.0, uRevele - distanceRobot) * 0.9;
        // Un point qui touche un objet déclaré prend la couleur de sa classe, un peu plus gros et plus vif.
        int k = int(aObjet + 0.5) - 1;
        bool objet = k >= 0;
        float teinte = objet ? uObjets : 0.0;
        vec3 base = uDegrade > 0.5 ? rampe((modelMatrix * vec4(position, 1.0)).y / ${HAUTEUR_RAMPE_M.toFixed(2)}) * uCanal : uCouleur;
        vCouleur = base;
        for (int i = 0; i < ${MAX_OBJETS}; i++) if (objet && i == k) vCouleur = mix(base, uTeintes[i] * uCanal, teinte);
        vAlpha = min(1.0, vAlpha + 0.35 * teinte);
        // L'impulsion du sonar : le point qu'elle traverse s'allume en bleu, plus gros, le temps qu'elle passe.
        float s = min(1.0, sonar((modelMatrix * vec4(position, 1.0)).xyz) * 1.3);
        vCouleur = mix(vCouleur, uSonarCouleur * uCanal * uSonarEclat, s);
        vAlpha = max(vAlpha, s * (1.0 - age));
        gl_PointSize = clamp(uTaille * uEchelle / -vue.z, 1.5, ${tailleMax.toFixed(1)}) * (1.0 + 0.4 * teinte + 0.5 * s);
        gl_Position = projectionMatrix * vue;
        vec2 ecran = gl_Position.xy / gl_Position.w;
        float r = length(ecran);
        vec2 dir = r > 1e-3 ? ecran / r : vec2(1.0, 0.0);
        gl_Position.xy += dir * uDecalage * (0.3 + r * 1.4) * gl_Position.w;
      }`,
    fragmentShader: /* glsl */ `
      varying float vAlpha;
      varying vec3 vCouleur;
      void main() {
        float d = length(gl_PointCoord - 0.5);
        if (d > 0.5 || vAlpha < 0.04) discard;
        gl_FragColor = vec4(vCouleur * (0.3 + 0.7 * vAlpha), 1.0);
      }`,
  });
}

const CANAUX: [THREE.Vector3, number][] = [
  [new THREE.Vector3(1, 0, 0), 0.0045],
  [new THREE.Vector3(0, 1, 0), 0],
  [new THREE.Vector3(0, 0, 1), -0.0045],
];

/** Le nuage dessiné trois fois, un canal par passe : là où les trois se recouvrent, le point est blanc. */
function nuageAberrant(geometrie: THREE.BufferGeometry, rendu: Rendu, vie: number, teintes: THREE.Color[]) {
  const groupe = new THREE.Group();
  const materiaux = CANAUX.map(([canal, decalage]) => materiauCanal(rendu, vie, canal, decalage, teintes));
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
  /** La carte mémorisée : tout ce que les capteurs ont vu, un point par cube de 5 cm. */
  carte: THREE.Group;
  /** Le lidar de tête, dans le repère du robot : l'œil d'où se calculent les ombres du sonar. */
  origineLidar: THREE.Vector3;
  materiaux: THREE.ShaderMaterial[];
  mettreAJour(t: number): void;
  /** Le rayon (m) jusqu'où les nuages sont révélés, pendant le déploiement. */
  reveler(rayon: number): void;
  /** La part de la couleur de leur classe dans les points des objets déclarés, de 0 (aucune) à 1. */
  colorerObjets(niveau: number): void;
  /** Change les couleurs : la caméra et le lidar (ce qui est vu maintenant), la carte mémorisée. */
  teinter(camera: Teinte, lidar: Teinte, memoire: Teinte): void;
  /** Le nombre de points de la caméra sur chaque objet déclaré, à sa dernière image : 0 = l'objet n'est pas vu. */
  pointsParObjet: Int32Array;
}

/** Construit les deux nuages ; `tete` est le point de la tête du robot dans son repère. */
export function creerNuages(tete: THREE.Vector3, lancer: Lancer, objets: ObjetDeclare[]): Nuages {
  const teintes = Array.from({ length: MAX_OBJETS }, (_, i) => new THREE.Color(objets[i]?.couleur ?? '#ffffff'));
  const touche: Touche = { objet: -1 };
  const pointsParObjet = new Int32Array(objets.length);

  const posCarte = new Float32Array(CAPACITE_CARTE * 3);
  const geoCarte = new THREE.BufferGeometry();
  geoCarte.setAttribute('position', new THREE.BufferAttribute(posCarte, 3));
  geoCarte.setAttribute('aNaissance', new THREE.BufferAttribute(new Float32Array(CAPACITE_CARTE), 1));
  geoCarte.setAttribute('aObjet', new THREE.BufferAttribute(new Float32Array(CAPACITE_CARTE), 1));
  geoCarte.setDrawRange(0, 0);
  const carte = nuageAberrant(geoCarte, CARTE, 0, teintes);
  const vus = new Set<number>();
  /** Mémorise le point (x, y, z) s'il tombe dans un cube encore jamais vu. */
  function memoriser(x: number, y: number, z: number): void {
    if (vus.size >= CAPACITE_CARTE || !Number.isFinite(x)) return;
    const cle = ((Math.round(x / VOXEL_M) + 4096) * 8192 + (Math.round(y / VOXEL_M) + 4096)) * 8192 + Math.round(z / VOXEL_M) + 4096;
    if (vus.has(cle)) return;
    posCarte.set([x, y, z], vus.size * 3);
    vus.add(cle);
  }
  function publierCarte(): void {
    geoCarte.setDrawRange(0, vus.size);
    geoCarte.attributes.position.needsUpdate = true;
  }

  const L = 200;
  const H = 150;
  const posCam = new Float32Array(L * H * 3);
  const geoCam = new THREE.BufferGeometry();
  geoCam.setAttribute('position', new THREE.BufferAttribute(posCam, 3));
  geoCam.setAttribute('aNaissance', new THREE.BufferAttribute(new Float32Array(L * H), 1));
  const objetCam = new Float32Array(L * H);
  geoCam.setAttribute('aObjet', new THREE.BufferAttribute(objetCam, 1));
  const camera = nuageAberrant(geoCam, VIVANT, 0, teintes);
  const origineCam = tete.clone().add(CAMERA_TETE.decalage);
  const tangage = THREE.MathUtils.degToRad(CAMERA_TETE.tangageDeg);
  const fovH = THREE.MathUtils.degToRad(CAMERA_TETE.champHDeg) / 2;
  const fovV = THREE.MathUtils.degToRad(CAMERA_TETE.champVDeg) / 2;
  const d = new THREE.Vector3();

  function rafraichirCamera(): void {
    let n = 0;
    pointsParObjet.fill(0);
    for (let j = 0; j < H; j++) {
      for (let i = 0; i < L; i++) {
        const u = Math.tan(fovH * (1 - (2 * (i + Math.random() * 0.3)) / L));
        const v = Math.tan(fovV * (1 - (2 * (j + Math.random() * 0.3)) / H));
        d.set(1, u, v).normalize();
        const c = Math.cos(tangage);
        const s = Math.sin(tangage);
        d.set(d.x * c + d.z * s, d.y, -d.x * s + d.z * c);
        let t = lancer(origineCam, d, touche);
        if (t > 3.2) t = NaN;
        t *= 1 + (Math.random() - 0.5) * 0.004;
        const objet = Number.isNaN(t) ? -1 : touche.objet;
        objetCam[n / 3] = objet + 1;
        if (objet >= 0) pointsParObjet[objet]++;
        posCam[n++] = origineCam.x + d.x * t;
        posCam[n++] = origineCam.y + d.y * t;
        posCam[n++] = origineCam.z + d.z * t;
        memoriser(posCam[n - 3], posCam[n - 2], posCam[n - 1]);
      }
    }
    geoCam.attributes.position.needsUpdate = true;
    geoCam.attributes.aObjet.needsUpdate = true;
    publierCarte();
  }

  const N = 60_000;
  const PAR_IMAGE = 2_400;
  const posLid = new Float32Array(N * 3).fill(NaN);
  const naissance = new Float32Array(N).fill(-99);
  const geoLid = new THREE.BufferGeometry();
  geoLid.setAttribute('position', new THREE.BufferAttribute(posLid, 3));
  geoLid.setAttribute('aNaissance', new THREE.BufferAttribute(naissance, 1));
  const objetLid = new Float32Array(N);
  geoLid.setAttribute('aObjet', new THREE.BufferAttribute(objetLid, 1));
  const lidar = nuageAberrant(geoLid, VIVANT, 2.4, teintes);
  const origineLid = tete.clone().add(new THREE.Vector3(0.02, 0, 0.06));
  const elevMin = THREE.MathUtils.degToRad(-47);
  const elevMax = THREE.MathUtils.degToRad(5);
  let curseur = 0;

  function balayerLidar(t: number): void {
    for (let k = 0; k < PAR_IMAGE; k++) {
      const az = Math.random() * Math.PI * 2;
      const el = elevMin + Math.random() * (elevMax - elevMin);
      d.set(Math.cos(el) * Math.cos(az), Math.cos(el) * Math.sin(az), Math.sin(el));
      const r = lancer(origineLid, d, touche);
      const i = curseur * 3;
      const ok = r < 12;
      objetLid[curseur] = ok ? touche.objet + 1 : 0;
      posLid[i] = ok ? origineLid.x + d.x * r : NaN;
      posLid[i + 1] = ok ? origineLid.y + d.y * r : NaN;
      posLid[i + 2] = ok ? origineLid.z + d.z * r : NaN;
      if (ok) memoriser(posLid[i], posLid[i + 1], posLid[i + 2]);
      naissance[curseur] = t;
      curseur = (curseur + 1) % N;
    }
    geoLid.attributes.position.needsUpdate = true;
    geoLid.attributes.aNaissance.needsUpdate = true;
    geoLid.attributes.aObjet.needsUpdate = true;
    publierCarte();
  }

  rafraichirCamera();
  let derniereCam = 0;

  const materiaux = [...camera.materiaux, ...lidar.materiaux, ...carte.materiaux];
  return {
    camera: camera.groupe,
    lidar: lidar.groupe,
    carte: carte.groupe,
    origineLidar: origineLid,
    materiaux,
    pointsParObjet,
    teinter(couleurCamera: Teinte, couleurLidar: Teinte, couleurMemoire: Teinte) {
      const groupes = [[camera.materiaux, couleurCamera, 1], [lidar.materiaux, couleurLidar, 1],
        [carte.materiaux, couleurMemoire, ECLAT_MEMOIRE_RAMPE]] as const;
      for (const [ms, t, eclat] of groupes) {
        for (const m of ms) {
          const u = m.uniforms;
          u.uDegrade.value = typeof t === 'string' ? 0 : 1;
          if (typeof t === 'string') u.uCouleur.value.set(t).multiply(u.uCanal.value);
          else t.forEach((c, i) => u.uRampe.value[i].set(c).multiplyScalar(eclat));
        }
      }
    },
    colorerObjets(niveau: number) {
      for (const m of materiaux) m.uniforms.uObjets.value = niveau;
    },
    reveler(rayon: number) {
      for (const m of materiaux) m.uniforms.uRevele.value = rayon;
    },
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
