// Copie la planche des moteurs du cockpit réel dans public/robot/ : le dessin (assets/robot_lines.png), la
// place de chaque moteur sur lui (ANCRES de robot_ctl_page.py) et les seuils de température de la Santé
// (configs/robot.json, sante.temperature_c). Aucun de ces nombres n'est recopié à la main dans le front.
import { copyFileSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { fileURLToPath } from 'node:url';

const racine = resolve(dirname(fileURLToPath(import.meta.url)), '../../..');
const ui = join(racine, 'app/cockpit_real_ui');
const cible = resolve(racine, 'app_web/front/public/robot');

const page = readFileSync(join(ui, 'robot_ctl_page.py'), 'utf8');
const bloc = page.match(/^ANCRES = \[([\s\S]*?)^\]/m);
if (!bloc) throw new Error('robot_ctl_page.py : liste ANCRES introuvable');
const ancres = [...bloc[1].matchAll(/\("([^"]+)",\s*([\d.]+),\s*([\d.]+)\)/g)]
  .map(([, nom, x, y]) => ({ nom, x: Number(x), y: Number(y) }));

// La classe d'un moteur, comme sante.moteurs : « D épaule tangage » -> epaule_tangage, « pince droite » -> pince.
const classe = (nom) => {
  const sansCote = nom.replace(/^[DG] /, '').replace(/ (droite|gauche)$/, '');
  return sansCote.normalize('NFD').replace(/[̀-ͯ]/g, '').replace(/ /g, '_');
};
const temperatures = JSON.parse(readFileSync(join(racine, 'configs/robot.json'), 'utf8')).sante.temperature_c;
const seuils = Object.fromEntries(ancres.map(({ nom }) => {
  const s = temperatures[classe(nom)] ?? temperatures.defaut;
  return [nom, { jaune: s.jaune, rouge: s.rouge, coupure: s.coupure ?? null }];
}));

mkdirSync(cible, { recursive: true });
copyFileSync(join(ui, 'assets/robot_lines.png'), join(cible, 'robot_lines.png'));
writeFileSync(join(cible, 'corps.json'), JSON.stringify({ ancres, seuils }));
console.log(`corps : ${ancres.length} ancres, seuils de ${Object.keys(seuils).length} moteurs copiés dans public/robot`);
