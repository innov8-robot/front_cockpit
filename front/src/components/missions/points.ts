/**
 * Les icônes en points : chaque icône au trait (24 × 24) est tracée dans une toile, puis lue case par case sur une
 * grille de 12 × 12 — une case de la grille couvre 2 × 2 unités du dessin. Une case assez couverte devient un point
 * allumé, les autres restent des points éteints, comme la matrice du logo de démarrage.
 */
export const GRILLE = 12;
const SUR = 6;
const SEUIL = 0.3;

const cache = new Map<string, boolean[]>();

/** Les cases allumées d'une icône (`d` : le chemin SVG au trait), lues une fois puis gardées. */
export function points(d: string): boolean[] {
  const deja = cache.get(d);
  if (deja) return deja;
  const cote = GRILLE * SUR;
  const toile = document.createElement('canvas');
  toile.width = toile.height = cote;
  const ctx = toile.getContext('2d', { willReadFrequently: true });
  if (!ctx) return new Array<boolean>(GRILLE * GRILLE).fill(false);
  ctx.scale(cote / 24, cote / 24);
  ctx.lineWidth = 1.9;
  ctx.lineCap = 'round';
  ctx.lineJoin = 'round';
  ctx.strokeStyle = '#000';
  ctx.stroke(new Path2D(d));
  const alpha = ctx.getImageData(0, 0, cote, cote).data;
  const allumes: boolean[] = [];
  for (let j = 0; j < GRILLE; j++) {
    for (let i = 0; i < GRILLE; i++) {
      let somme = 0;
      for (let y = 0; y < SUR; y++) {
        for (let x = 0; x < SUR; x++) somme += alpha[((j * SUR + y) * cote + i * SUR + x) * 4 + 3];
      }
      allumes.push(somme / (SUR * SUR * 255) > SEUIL);
    }
  }
  cache.set(d, allumes);
  return allumes;
}
