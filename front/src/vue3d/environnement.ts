import * as THREE from 'three';
import { CALQUE_DETECTIONS, ORDRE_MASQUE, ORDRE_SEGMENTATION } from './detections';
import { MATERIAU_PEAU, sonariser } from './sonar';

/**
 * Un atelier fictif autour du robot, dans son repère (x devant, z en haut, mètres). Les mêmes formes sont
 * dessinées en traits et touchées par les rayons des capteurs simulés : ce qu'on voit et ce qu'ils mesurent
 * sont la même chose.
 */

type Forme = (
  | { type: 'boite'; min: THREE.Vector3; max: THREE.Vector3; ton: Ton }
  | { type: 'cylindre'; x: number; y: number; r: number; z0: number; z1: number; ton: Ton }
) & { objet?: number };

type Ton = 'meuble' | 'objet' | 'machine';

/** Ce qu'un rayon a touché : l'indice de l'objet déclaré, -1 pour le reste de l'atelier. */
export interface Touche { objet: number }

/** Rend la distance du premier obstacle sur le rayon ; `touche`, s'il est donné, reçoit l'objet touché. */
export type Lancer = (o: THREE.Vector3, d: THREE.Vector3, touche?: Touche) => number;

/** Un objet déclaré : sa classe, sa couleur (celle de sa classe), et sa boîte englobante dans le repère du robot. */
export interface ObjetDeclare {
  classe: string;
  nom: string;
  couleur: string;
  min: THREE.Vector3;
  max: THREE.Vector3;
}

/** La couleur de chaque classe déclarée, comme un détecteur colore ses classes. */
export const CLASSES: Record<string, string> = {
  mug: '#3dd6ff',
  carton: '#ffb02e',
  'pièce': '#3dff8a',
  bac: '#c77dff',
};

const SALLE = { x0: -4.5, x1: 6.5, y0: -5.5, y1: 5.5, h: 4 };

function construire(sol: number): { formes: Forme[]; classes: string[] } {
  const f: Forme[] = [];
  const classes: string[] = [];
  // Les formes ajoutées pendant `declarer` appartiennent à l'objet déclaré.
  let courant: number | undefined;
  const declarer = (classe: string, ajouter: () => void) => {
    courant = classes.push(classe) - 1;
    ajouter();
    courant = undefined;
  };
  const boite = (x0: number, y0: number, z0: number, x1: number, y1: number, z1: number, ton: Ton = 'meuble') =>
    f.push({ type: 'boite', min: new THREE.Vector3(x0, y0, sol + z0), max: new THREE.Vector3(x1, y1, sol + z1), ton, objet: courant });
  const cylindre = (x: number, y: number, r: number, z0: number, z1: number, ton: Ton = 'objet') =>
    f.push({ type: 'cylindre', x, y, r, z0: sol + z0, z1: sol + z1, ton, objet: courant });
  const pieds = (x0: number, y0: number, x1: number, y1: number, h: number, e = 0.04) => {
    for (const [x, y] of [[x0, y0], [x1 - e, y0], [x0, y1 - e], [x1 - e, y1 - e]]) boite(x, y, 0, x + e, y + e, h);
  };

  // La table de travail et ce qui est posé dessus, déclaré : le mug, le carton, deux pièces et le bac.
  const t = 0.75;
  boite(0.38, -0.6, t - 0.03, 1.08, 0.6, t);
  pieds(0.38, -0.6, 1.08, 0.6, t - 0.03);
  declarer('pièce', () => boite(0.46, -0.21, t, 0.58, -0.11, t + 0.06, 'objet'));
  declarer('carton', () => boite(0.6, 0.02, t, 0.7, 0.1, t + 0.09, 'objet'));
  declarer('pièce', () => boite(0.52, -0.42, t, 0.6, -0.32, t + 0.05, 'objet'));
  declarer('mug', () => cylindre(0.42, -0.06, 0.055, t, t + 0.23));
  const bac = (x0: number, y0: number, x1: number, y1: number, z: number, h: number) => {
    boite(x0, y0, z, x1, y0 + 0.02, z + h, 'objet');
    boite(x0, y1 - 0.02, z, x1, y1, z + h, 'objet');
    boite(x0, y0, z, x0 + 0.02, y1, z + h, 'objet');
    boite(x1 - 0.02, y0, z, x1, y1, z + h, 'objet');
    boite(x0, y0, z, x1, y1, z + 0.01, 'objet');
  };
  declarer('bac', () => bac(0.72, 0.18, 1.02, 0.42, t, 0.13));

  // Le convoyeur, à gauche, avec ses cartons.
  boite(-0.6, 1.3, 0.72, 3.4, 1.8, 0.8);
  boite(-0.6, 1.26, 0.8, 3.4, 1.3, 0.86);
  boite(-0.6, 1.8, 0.8, 3.4, 1.84, 0.86);
  for (const x of [-0.5, 0.6, 1.7, 2.8, 3.3]) pieds(x, 1.32, x + 0.08, 1.78, 0.72);
  for (const [x, l, h] of [[0.1, 0.3, 0.22], [1.2, 0.4, 0.3], [2.3, 0.3, 0.18]]) boite(x, 1.38, 0.8, x + l, 1.72, 0.8 + h, 'objet');

  // La machine, à droite : le bâti, la porte vitrée, le pupitre.
  boite(1.9, -3.4, 0, 3.0, -1.8, 2.0, 'machine');
  boite(1.88, -3.1, 0.7, 1.9, -2.1, 1.6, 'machine');
  boite(1.7, -1.75, 0.95, 1.9, -1.4, 1.35, 'machine');
  boite(1.78, -1.62, 0, 1.84, -1.56, 0.95, 'machine');

  // L'étagère, derrière à gauche, et ses cartons.
  for (const x of [-2.6, -1.4, -0.2]) for (const y of [2.7, 3.2]) boite(x, y, 0, x + 0.06, y + 0.06, 2.2);
  for (const z of [0.15, 0.85, 1.55]) boite(-2.6, 2.7, z, -0.14, 3.26, z + 0.04);
  for (const [x, z, l, h] of [[-2.5, 0.19, 0.5, 0.35], [-1.9, 0.19, 0.4, 0.3], [-1.2, 0.89, 0.6, 0.4], [-0.9, 1.59, 0.5, 0.3], [-2.4, 1.59, 0.7, 0.45]]) {
    boite(x, 2.78, z, x + l, 3.18, z + h, 'objet');
  }

  // La palette chargée, devant à droite.
  boite(3.2, 0.2, 0, 4.4, 1.0, 0.14);
  for (const [x, y, h] of [[3.25, 0.25, 0.5], [3.85, 0.25, 0.4], [3.25, 0.62, 0.45], [3.85, 0.62, 0.55], [3.5, 0.4, 0.3]]) {
    boite(x, y, h > 0.5 ? 0.14 : 0.14, x + 0.52, y + 0.35, 0.14 + h, 'objet');
  }

  // La station de charge, derrière le robot.
  boite(-1.7, -0.45, 0, -1.15, 0.45, 0.55, 'machine');
  boite(-1.2, -0.25, 0.1, -1.1, 0.25, 0.35, 'machine');

  // Les piliers du bâtiment.
  for (const [x, y] of [[5, -4.5], [5, 4.5], [-3.5, -4.5], [-3.5, 4.5], [5, 0]]) cylindre(x, y, 0.22, 0, SALLE.h, 'meuble');
  return { formes: f, classes };
}

/** Les objets déclarés, numérotés dans leur classe (« pièce 1 », « pièce 2 »), et leur boîte englobante. */
function objetsDeclares(formes: Forme[], classes: string[]): ObjetDeclare[] {
  const parClasse: Record<string, number> = {};
  return classes.map((classe, i) => {
    const boite = new THREE.Box3();
    for (const f of formes) {
      if (f.objet !== i) continue;
      if (f.type === 'boite') boite.expandByPoint(f.min).expandByPoint(f.max);
      else boite.expandByPoint(new THREE.Vector3(f.x - f.r, f.y - f.r, f.z0)).expandByPoint(new THREE.Vector3(f.x + f.r, f.y + f.r, f.z1));
    }
    const rang = (parClasse[classe] = (parClasse[classe] ?? 0) + 1);
    const nombre = classes.filter((c) => c === classe).length;
    return { classe, nom: nombre > 1 ? `${classe} ${rang}` : classe, couleur: CLASSES[classe], min: boite.min, max: boite.max };
  });
}

function lancerContre(formes: Forme[], sol: number): Lancer {
  return (o, d, touche) => {
    let meilleur = Infinity;
    let objet = -1;
    for (const f of formes) {
      const t = f.type === 'boite' ? contreBoite(o, d, f.min, f.max) : contreCylindre(o, d, f);
      if (t > 0.02 && t < meilleur) {
        meilleur = t;
        objet = f.objet ?? -1;
      }
    }
    const murs: [number, number, number][] = [
      [SALLE.x0, SALLE.x1, 0], [SALLE.y0, SALLE.y1, 1], [sol, sol + SALLE.h, 2],
    ];
    for (const [bas, haut, k] of murs) {
      const dk = d.getComponent(k);
      const ok = o.getComponent(k);
      const t = dk > 0 ? (haut - ok) / dk : (bas - ok) / dk;
      if (t > 0 && t < meilleur) {
        meilleur = t;
        objet = -1;
      }
    }
    if (touche) touche.objet = objet;
    return meilleur;
  };
}

function contreBoite(o: THREE.Vector3, d: THREE.Vector3, min: THREE.Vector3, max: THREE.Vector3): number {
  let tmin = -Infinity;
  let tmax = Infinity;
  for (let k = 0; k < 3; k++) {
    const inv = 1 / d.getComponent(k);
    let t0 = (min.getComponent(k) - o.getComponent(k)) * inv;
    let t1 = (max.getComponent(k) - o.getComponent(k)) * inv;
    if (t0 > t1) [t0, t1] = [t1, t0];
    tmin = Math.max(tmin, t0);
    tmax = Math.min(tmax, t1);
  }
  return tmax >= tmin ? tmin : Infinity;
}

function contreCylindre(o: THREE.Vector3, d: THREE.Vector3, c: { x: number; y: number; r: number; z0: number; z1: number }): number {
  let meilleur = Infinity;
  const ox = o.x - c.x;
  const oy = o.y - c.y;
  const a = d.x * d.x + d.y * d.y;
  const b = 2 * (ox * d.x + oy * d.y);
  const disc = b * b - 4 * a * (ox * ox + oy * oy - c.r * c.r);
  if (a > 1e-9 && disc >= 0) {
    const t = (-b - Math.sqrt(disc)) / (2 * a);
    const z = o.z + d.z * t;
    if (t > 0 && z >= c.z0 && z <= c.z1) meilleur = t;
  }
  if (Math.abs(d.z) > 1e-9) {
    const t = (c.z1 - o.z) / d.z;
    const x = ox + d.x * t;
    const y = oy + d.y * t;
    if (t > 0 && x * x + y * y <= c.r * c.r) meilleur = Math.min(meilleur, t);
  }
  return meilleur;
}

const TONS: Record<Ton, THREE.LineBasicMaterial> = {
  meuble: new THREE.LineBasicMaterial({ color: '#8793a8', transparent: true, opacity: 0.32 }),
  objet: new THREE.LineBasicMaterial({ color: '#c3cde0', transparent: true, opacity: 0.45 }),
  machine: new THREE.LineBasicMaterial({ color: '#ff2d3a', transparent: true, opacity: 0.4 }),
};
// L'impulsion du sonar épouse les arêtes des meubles en passant.
for (const materiau of Object.values(TONS)) sonariser(materiau);

function dessiner(formes: Forme[], sol: number): THREE.Group {
  const groupe = new THREE.Group();
  for (const f of formes) {
    let geometrie: THREE.BufferGeometry;
    const centre = new THREE.Vector3();
    if (f.type === 'boite') {
      const taille = f.max.clone().sub(f.min);
      geometrie = new THREE.BoxGeometry(taille.x, taille.y, taille.z);
      centre.addVectors(f.min, f.max).multiplyScalar(0.5);
    } else {
      geometrie = new THREE.CylinderGeometry(f.r, f.r, f.z1 - f.z0, 24, 1, true).rotateX(Math.PI / 2);
      centre.set(f.x, f.y, (f.z0 + f.z1) / 2);
    }
    const traits = new THREE.LineSegments(new THREE.EdgesGeometry(geometrie, 20), TONS[f.ton]);
    traits.position.copy(centre);
    groupe.add(traits);
  }

  const contour = [
    [SALLE.x0, SALLE.y0], [SALLE.x1, SALLE.y0], [SALLE.x1, SALLE.y1], [SALLE.x0, SALLE.y1],
  ].map(([x, y]) => new THREE.Vector3(x, y, sol));
  const murs = new THREE.BufferGeometry().setFromPoints([...contour, contour[0]]);
  groupe.add(new THREE.Line(murs, TONS.meuble));
  return groupe;
}

/**
 * Les volumes pleins de l'atelier, invisibles : ils n'écrivent que la profondeur, après les nuages et les traits,
 * pour que les cadres de détection soient masqués par ce qui est devant eux sans rien cacher d'autre.
 */
function masquer(formes: Forme[]): THREE.Group {
  const groupe = new THREE.Group();
  const materiau = new THREE.MeshBasicMaterial({ colorWrite: false, transparent: true, side: THREE.DoubleSide });
  for (const f of formes) {
    const volume = new THREE.Mesh(volumePlein(f), materiau);
    poserVolume(volume, f);
    volume.renderOrder = ORDRE_MASQUE;
    volume.layers.set(CALQUE_DETECTIONS);
    groupe.add(volume);
  }
  return groupe;
}

/** Les obstacles qui font de l'ombre au sonar, dans le repère du robot ; les pieds fins n'en font pas qui se voie. */
function obstacles(formes: Forme[]): THREE.Box3[] {
  const boites = formes.map((f) => (f.type === 'boite'
    ? new THREE.Box3(f.min.clone(), f.max.clone())
    : new THREE.Box3(new THREE.Vector3(f.x - f.r, f.y - f.r, f.z0), new THREE.Vector3(f.x + f.r, f.y + f.r, f.z1))));
  return boites.filter((b) => Math.min(b.max.x - b.min.x, b.max.y - b.min.y) >= 0.06);
}

/** La peau du sonar sur chaque meuble et chaque objet (sonar.MATERIAU_PEAU). */
function peauSonar(formes: Forme[]): THREE.Group {
  const groupe = new THREE.Group();
  for (const f of formes) {
    const peau = new THREE.Mesh(volumePlein(f), MATERIAU_PEAU);
    poserVolume(peau, f);
    peau.renderOrder = ORDRE_SEGMENTATION;
    peau.layers.set(CALQUE_DETECTIONS);
    groupe.add(peau);
  }
  return groupe;
}

function volumePlein(f: Forme): THREE.BufferGeometry {
  return f.type === 'boite'
    ? new THREE.BoxGeometry(...f.max.clone().sub(f.min).toArray())
    : new THREE.CylinderGeometry(f.r, f.r, f.z1 - f.z0, 24).rotateX(Math.PI / 2);
}

function poserVolume(o: THREE.Object3D, f: Forme): void {
  if (f.type === 'boite') o.position.addVectors(f.min, f.max).multiplyScalar(0.5);
  else o.position.set(f.x, f.y, (f.z0 + f.z1) / 2);
}

/** La segmentation des objets déclarés : leur silhouette remplie de la couleur de leur classe, et son contour. */
export interface Segmentation {
  groupe: THREE.Group;
  /** De 0 (éteinte) à 1 (pleine). */
  regler(niveau: number): void;
}

/**
 * Les masques de segmentation, façon YOLO-seg : les volumes des objets déclarés, colorés et translucides. Ils sont
 * tracés à la même profondeur que les volumes de masquage, juste après eux : ce qui est devant un objet le coupe.
 */
function segmenter(formes: Forme[], objets: ObjetDeclare[]): Segmentation {
  const groupe = new THREE.Group();
  const remplis = objets.map((o) => new THREE.MeshBasicMaterial({
    color: o.couleur, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false,
  }));
  const contours = objets.map((o) => new THREE.LineBasicMaterial({
    color: o.couleur, transparent: true, opacity: 0, depthWrite: false, fog: false, toneMapped: false,
  }));
  for (const f of formes) {
    if (f.objet === undefined) continue;
    const geometrie = volumePlein(f);
    const rempli = new THREE.Mesh(geometrie, remplis[f.objet]);
    const contour = new THREE.LineSegments(new THREE.EdgesGeometry(geometrie, 20), contours[f.objet]);
    for (const m of [rempli, contour]) {
      poserVolume(m, f);
      m.renderOrder = ORDRE_SEGMENTATION;
      m.layers.set(CALQUE_DETECTIONS);
      groupe.add(m);
    }
  }
  groupe.visible = false;
  return {
    groupe,
    regler(niveau) {
      groupe.visible = niveau > 0.001;
      for (const m of remplis) m.opacity = 0.42 * niveau;
      for (const m of contours) m.opacity = 0.95 * niveau;
    },
  };
}

/** L'atelier : ses traits, ses volumes de masquage, la segmentation, le lancer de rayon et les objets déclarés. */
export function creerEnvironnement(sol: number): {
  objet: THREE.Group; masque: THREE.Group; peau: THREE.Group; segmentation: Segmentation; lancer: Lancer;
  objets: ObjetDeclare[]; obstacles: THREE.Box3[];
} {
  const { formes, classes } = construire(sol);
  const objets = objetsDeclares(formes, classes);
  return {
    objet: dessiner(formes, sol), masque: masquer(formes), peau: peauSonar(formes), segmentation: segmenter(formes, objets),
    lancer: lancerContre(formes, sol), objets, obstacles: obstacles(formes),
  };
}
