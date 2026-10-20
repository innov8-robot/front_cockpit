// Copie la dernière image de la caméra de tête enregistrée par un run réel (outputs/runs/<run>/frames/000.jpg)
// dans public/camera/, hors git : c'est l'image montrée tant que le back ne sert pas le flux. Sans run, rien.
import { copyFileSync, existsSync, mkdirSync, readdirSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const runs = join(racine, 'outputs/runs');
const cible = resolve(racine, 'app_web/front/public/camera');

const avecImage = existsSync(runs)
  ? readdirSync(runs).filter((r) => existsSync(join(runs, r, 'frames/000.jpg'))).sort()
  : [];
const run = avecImage.at(-1);
if (!run) {
  console.log('caméra : aucun run avec image, la vue 3D tiendra lieu d\'image');
  process.exit(0);
}
mkdirSync(cible, { recursive: true });
copyFileSync(join(runs, run, 'frames/000.jpg'), join(cible, 'apercu.jpg'));
writeFileSync(join(cible, 'apercu.json'), JSON.stringify({ run }));
console.log(`caméra : image du run ${run} copiée dans public/camera`);
