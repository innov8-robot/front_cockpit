import * as THREE from 'three';
import type { ObjetDeclare } from './environnement';

/** Un objet n'est « détecté » que si la caméra de tête pose au moins ce nombre de points dessus. */
const POINTS_MIN = 12;
/** La marge du cadre autour de l'objet (px), et la part du chemin parcourue à chaque image (le lissage). */
const MARGE_PX = 6;
const LISSAGE = 0.35;
/** La confiance simulée est retirée à cette période (s), comme un détecteur qui tourne moins vite que l'écran. */
const PERIODE_SCORE_S = 0.3;
/** Au démarrage, le premier cadre s'accroche ce délai (s) après la fin de l'onde, les suivants un par un. */
export const PREMIER_CADRE_S = 0.35;
const ECART_CADRES_S = 0.22;
/** L'épaisseur du trait (px) et la hauteur de l'étiquette (px). */
const TRAIT_PX = 1.5;
const ETIQUETTE_PX = 16;
/** Le cadre est posé à cette distance (m) devant le point de l'objet le plus proche : ni l'objet ni son support ne le coupent. */
const AVANCE_M = 0.03;
/** Le calque three.js des cadres et des volumes qui les masquent : la caméra principale le voit, pas l'hologramme. */
export const CALQUE_DETECTIONS = 1;
/** Les cadres sont tracés après tout le reste, et après les volumes qui les masquent. */
export const ORDRE_MASQUE = 998;
const ORDRE_CADRE = 1000;
/** L'éclat des étiquettes : sous le seuil du halo, sinon le texte se noie dans la lumière. */
const ECLAT_ETIQUETTE = 0.6;
/** L'accrochage : le clignotement [instant (s), opacité], le resserrement (s), le dépliement de l'étiquette (s). */
const CLIGNOTE: [number, number][] = [[0, 0], [0.07, 1], [0.14, 0.2], [0.2, 1], [0.27, 0.5], [0.34, 1]];
const RESSERRE_S = 0.4;
const RESSERRE_PX = 22;
const DEPLIE: [number, number] = [0.3, 0.6];

/**
 * Les cadres de détection, façon YOLO : un rectangle de la couleur de la classe autour de chaque objet déclaré que
 * la caméra de tête voit, son nom et sa confiance. Ils sont dessinés dans la scène, sur un plan face à la caméra
 * juste devant l'objet : ce qui est entre la caméra et l'objet (le robot, un meuble, un autre objet) les masque.
 * La confiance est simulée : le back servira celle du détecteur.
 */
export interface Detections {
  /** `deploye` : le temps (s) depuis la fin de l'onde de démarrage, ou null tant qu'elle se déploie. */
  mettreAJour(t: number, camera: THREE.PerspectiveCamera, monde: THREE.Object3D, deploye: number | null,
    pointsParObjet: Int32Array): void;
  afficher(oui: boolean): void;
  detruire(): void;
}

type Rect = [number, number, number, number];

interface Cadre {
  groupe: THREE.Group;
  fond: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  bord: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  fantome: THREE.Mesh<THREE.BufferGeometry, THREE.MeshBasicMaterial>;
  etiquette: THREE.Mesh<THREE.BufferGeometry, THREE.ShaderMaterial>;
  toile: HTMLCanvasElement;
  texte: string;
  largeurEtiquette: number;
  rect: Rect | null;
  accroche: number;
  score: number;
}

/** Une géométrie de `n` quadrilatères dont on réécrit les sommets à chaque image. */
function quads(n: number): THREE.BufferGeometry {
  const g = new THREE.BufferGeometry();
  g.setAttribute('position', new THREE.BufferAttribute(new Float32Array(n * 12), 3));
  g.setAttribute('uv', new THREE.BufferAttribute(new Float32Array(Array.from({ length: n }, () => [0, 1, 1, 1, 1, 0, 0, 0]).flat()), 2));
  g.setIndex(Array.from({ length: n }, (_, k) => [0, 2, 1, 0, 3, 2].map((i) => i + 4 * k)).flat());
  return g;
}

function materiau(couleur: string, opacite: number): THREE.MeshBasicMaterial {
  return new THREE.MeshBasicMaterial({
    color: couleur, transparent: true, opacity: opacite, depthWrite: false, side: THREE.DoubleSide, fog: false,
    toneMapped: false,
  });
}

function nouveauCadre(o: ObjetDeclare): Cadre {
  const toile = document.createElement('canvas');
  const etiquette = new THREE.Mesh(quads(1), new THREE.ShaderMaterial({
    transparent: true, depthWrite: false, side: THREE.DoubleSide, toneMapped: false,
    uniforms: { uImage: { value: new THREE.CanvasTexture(toile) }, uDeplie: { value: 1 }, uOpacite: { value: 1 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uImage;
      uniform float uDeplie;
      uniform float uOpacite;
      varying vec2 vUv;
      void main() {
        if (vUv.x > uDeplie) discard;
        vec4 c = texture2D(uImage, vUv);
        gl_FragColor = vec4(c.rgb * ${ECLAT_ETIQUETTE.toFixed(2)}, c.a * uOpacite);
      }`,
  }));
  const fond = new THREE.Mesh(quads(1), materiau(o.couleur, 0.07));
  const bord = new THREE.Mesh(quads(4), materiau(o.couleur, 1));
  const fantome = new THREE.Mesh(quads(4), materiau(o.couleur, 0));
  const groupe = new THREE.Group();
  for (const m of [fond, bord, fantome, etiquette]) {
    m.renderOrder = ORDRE_CADRE;
    m.frustumCulled = false;
    m.layers.set(CALQUE_DETECTIONS);
    groupe.add(m);
  }
  groupe.visible = false;
  return { groupe, fond, bord, fantome, etiquette, toile, texte: '', largeurEtiquette: 0, rect: null, accroche: 0, score: 0 };
}

/** Redessine l'étiquette « nom 0.93 » : fond de la couleur de la classe, texte sombre. */
function ecrire(cadre: Cadre, texte: string, couleur: string): void {
  if (texte === cadre.texte) return;
  const echelle = 2;
  const ctx = cadre.toile.getContext('2d')!;
  const police = `700 ${11 * echelle}px ui-monospace, SFMono-Regular, Menlo, monospace`;
  ctx.font = police;
  const largeur = Math.ceil(ctx.measureText(texte).width) + 12 * echelle;
  cadre.toile.width = largeur;
  cadre.toile.height = ETIQUETTE_PX * echelle;
  ctx.fillStyle = couleur;
  ctx.fillRect(0, 0, largeur, cadre.toile.height);
  ctx.font = police;
  ctx.fillStyle = '#000000';
  ctx.textBaseline = 'middle';
  ctx.fillText(texte, 6 * echelle, cadre.toile.height / 2 + echelle);
  const texture = cadre.etiquette.material.uniforms.uImage.value as THREE.CanvasTexture;
  texture.dispose();
  cadre.etiquette.material.uniforms.uImage.value = new THREE.CanvasTexture(cadre.toile);
  cadre.texte = texte;
  cadre.largeurEtiquette = largeur / echelle;
}

/** Le contour d'un rectangle (px), en quatre bandes de `e` px vers l'intérieur. */
function contour([x0, y0, x1, y1]: Rect, e: number): Rect[] {
  return [[x0, y0, x1, y0 + e], [x0, y1 - e, x1, y1], [x0, y0, x0 + e, y1], [x1 - e, y0, x1, y1]];
}

function niveauClignote(dt: number): number {
  let niveau = 0;
  for (const [instant, n] of CLIGNOTE) if (dt >= instant) niveau = n;
  return niveau;
}

const sortie = (x: number) => 1 - (1 - Math.min(1, Math.max(0, x))) ** 3;

export function creerDetections(scene: THREE.Scene, hote: HTMLElement, objets: ObjetDeclare[]): Detections {
  const racine = new THREE.Group();
  scene.add(racine);
  let visibles = true;
  let dernierScore = -Infinity;
  const cadres = objets.map((o) => {
    const c = nouveauCadre(o);
    racine.add(c.groupe);
    return c;
  });

  const coins = objets.map((o) => [0, 1, 2, 3, 4, 5, 6, 7].map((k) => new THREE.Vector3(
    k & 1 ? o.max.x : o.min.x, k & 2 ? o.max.y : o.min.y, k & 4 ? o.max.z : o.min.z)));
  const centres = objets.map((o) => o.min.clone().add(o.max).multiplyScalar(0.5));
  // L'ordre d'accrochage au démarrage : du plus proche du robot au plus loin.
  const rangs = new Array<number>(objets.length);
  centres.map((c, i) => [Math.hypot(c.x, c.y), i]).sort((a, b) => a[0] - b[0]).forEach(([, i], r) => (rangs[i] = r));
  const p = new THREE.Vector3();

  /** Le rectangle de l'objet `i` à l'écran (px) et la profondeur de vue de son point le plus proche, ou null. */
  function mesurer(i: number, camera: THREE.PerspectiveCamera, monde: THREE.Object3D): { rect: Rect; profondeur: number } | null {
    const { clientWidth: l, clientHeight: h } = hote;
    let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity, profondeur = Infinity;
    for (const c of coins[i]) {
      p.copy(c).applyMatrix4(monde.matrixWorld).applyMatrix4(camera.matrixWorldInverse);
      if (p.z > -camera.near) return null;
      profondeur = Math.min(profondeur, -p.z);
      p.applyMatrix4(camera.projectionMatrix);
      const x = ((p.x + 1) / 2) * l;
      const y = ((1 - p.y) / 2) * h;
      x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y);
    }
    return { rect: [x0 - MARGE_PX, y0 - MARGE_PX, x1 + MARGE_PX, y1 + MARGE_PX], profondeur };
  }

  /** Pose les quadrilatères `rects` (px) sur le plan face à la caméra, à la profondeur NDC `z`. */
  function poser(geometrie: THREE.BufferGeometry, rects: Rect[], z: number, camera: THREE.Camera): void {
    const { clientWidth: l, clientHeight: h } = hote;
    const pos = geometrie.attributes.position as THREE.BufferAttribute;
    rects.forEach(([x0, y0, x1, y1], k) => {
      [[x0, y0], [x1, y0], [x1, y1], [x0, y1]].forEach(([x, y], j) => {
        p.set((x / l) * 2 - 1, 1 - (y / h) * 2, z).unproject(camera);
        pos.setXYZ(4 * k + j, p.x, p.y, p.z);
      });
    });
    pos.needsUpdate = true;
  }

  return {
    mettreAJour(t, camera, monde, deploye, pointsParObjet) {
      const tirer = t - dernierScore > PERIODE_SCORE_S;
      if (tirer) dernierScore = t;
      cadres.forEach((cadre, i) => {
        const accroche = deploye !== null && deploye >= PREMIER_CADRE_S + rangs[i] * ECART_CADRES_S;
        const mesure = visibles && accroche && pointsParObjet[i] >= POINTS_MIN ? mesurer(i, camera, monde) : null;
        if (!mesure) {
          cadre.groupe.visible = false;
          cadre.rect = null;
          return;
        }
        // Chaque apparition rejoue l'accrochage : au démarrage, et quand on rallume le calque.
        if (!cadre.rect) {
          cadre.accroche = t;
          dernierScore = -Infinity;
        }
        const cible = mesure.rect;
        cadre.rect = cadre.rect ? cadre.rect.map((v, k) => v + (cible[k] - v) * LISSAGE) as Rect : cible;
        if (tirer || !cadre.texte) {
          // Plus l'objet est vu, plus le détecteur est sûr ; un peu de bruit, comme un vrai.
          const base = 0.6 + 0.35 * Math.min(1, pointsParObjet[i] / 300);
          cadre.score = Math.min(0.99, base + (Math.random() - 0.5) * 0.04);
          ecrire(cadre, `${objets[i].nom} ${cadre.score.toFixed(2)}`, objets[i].couleur);
        }
        const plan = new THREE.Vector3(0, 0, -Math.max(camera.near, mesure.profondeur - AVANCE_M))
          .applyMatrix4(camera.projectionMatrix).z;
        const r = cadre.rect;
        const dt = t - cadre.accroche;
        const resserre = RESSERRE_PX * (1 - sortie(dt / RESSERRE_S));
        poser(cadre.fond.geometry, [r], plan, camera);
        poser(cadre.bord.geometry, contour(r, TRAIT_PX), plan, camera);
        poser(cadre.fantome.geometry, contour([r[0] - resserre, r[1] - resserre, r[2] + resserre, r[3] + resserre], TRAIT_PX), plan, camera);
        poser(cadre.etiquette.geometry, [[r[0], r[1] - ETIQUETTE_PX, r[0] + cadre.largeurEtiquette, r[1]]], plan, camera);
        const opacite = niveauClignote(dt);
        cadre.bord.material.opacity = opacite;
        cadre.fond.material.opacity = 0.07 * opacite;
        cadre.fantome.material.opacity = dt < RESSERRE_S ? 0.9 * (1 - dt / RESSERRE_S) : 0;
        cadre.etiquette.material.uniforms.uDeplie.value = sortie((dt - DEPLIE[0]) / (DEPLIE[1] - DEPLIE[0]));
        cadre.etiquette.material.uniforms.uOpacite.value = opacite;
        cadre.groupe.visible = true;
      });
    },
    afficher(oui) {
      visibles = oui;
    },
    detruire() {
      scene.remove(racine);
      for (const c of cadres) {
        for (const m of [c.fond, c.bord, c.fantome, c.etiquette]) {
          m.geometry.dispose();
          m.material.dispose();
        }
        (c.etiquette.material.uniforms.uImage.value as THREE.Texture).dispose();
      }
    },
  };
}
