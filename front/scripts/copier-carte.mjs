// Copie la carte active du châssis (outputs/maps/, sa grille .stcm et les postes de configs/stations.json)
// dans public/carte/carte.json. La source reste le dépôt : ce fichier n'en est qu'une copie, hors git.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const cartes = join(racine, 'outputs/maps');
const cible = resolve(racine, 'app_web/front/public/carte');

const active = JSON.parse(readFileSync(join(cartes, '.active.json'), 'utf8')).nom;
const stcm = readFileSync(join(cartes, `${active}.stcm`));

// L'en-tête est une suite « clé, longueur sur 2 octets, valeur » en texte ; la grille brute termine le fichier.
const texte = stcm.toString('latin1');
const lire = (cle) => {
  const m = texte.match(new RegExp(`${cle}[\\s\\S]{2}([-0-9.]+)`));
  if (!m) throw new Error(`carte ${active} : clé « ${cle} » absente de l'en-tête`);
  return Number(m[1]);
};
const w = lire('dimension_width');
const h = lire('dimension_height');
const grille = stcm.subarray(stcm.length - w * h);

const stations = JSON.parse(readFileSync(join(racine, 'configs/stations.json'), 'utf8'));
const bloc = stations.cartes?.[active] ?? { postes: {} };
const postes = Object.fromEntries(Object.entries(bloc.postes ?? {}).map(([n, p]) => [n, { x: p.x, y: p.y, yaw: p.yaw }]));

mkdirSync(cible, { recursive: true });
writeFileSync(join(cible, 'carte.json'), JSON.stringify({
  nom: active, x0: lire('origin_x'), y0: lire('origin_y'), res: lire('resolution_x'), w, h,
  cellules: Buffer.from(grille).toString('base64'), postes, base: bloc.base ?? null,
}));
console.log(`carte : ${active} (${w}×${h}, ${Object.keys(postes).length} postes) copiée dans public/carte`);
