// Copie l'URDF du G1-D (celui du code robot, pinces dex1) et ses maillages visuels dans public/robot/.
// La source reste sim/assets/g1_d_description : ce dossier n'en est qu'une copie, hors git.
import { copyFileSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const ici = dirname(fileURLToPath(import.meta.url));
const source = resolve(ici, '../../../sim/assets/g1_d_description');
const cible = resolve(ici, '../public/robot/g1_d');

const urdf = readFileSync(join(source, 'g1_d_dex1.urdf'), 'utf8');
const visuels = [...urdf.matchAll(/<visual>[\s\S]*?<\/visual>/g)].map((m) => m[0]);
const maillages = new Set(
  visuels.flatMap((v) => [...v.matchAll(/filename="([^"]+\.stl)"/gi)].map((m) => m[1])),
);

rmSync(cible, { recursive: true, force: true });
mkdirSync(join(cible, 'meshes'), { recursive: true });
for (const m of maillages) copyFileSync(join(source, m), join(cible, m));
writeFileSync(join(cible, 'g1_d_dex1.urdf'), urdf);
console.log(`robot : ${maillages.size} maillages copiés dans public/robot/g1_d`);
