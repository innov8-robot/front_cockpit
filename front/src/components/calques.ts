import type { Calque } from '../vue3d/scene';

/** Un calque de la vue 3D, tel que les filtres le montrent : son nom, son détail, la couleur qu'il a dans la scène. */
export interface DescriptionCalque {
  cle: Calque;
  libelle: string;
  detail: string;
  /** Une couleur CSS, ou un dégradé quand le calque en a plusieurs (les objets, chacun la sienne). */
  couleur: string;
}

/** Les calques de l'accueil, dans l'ordre des filtres ; la grille n'en est pas un, elle est toujours là. Les couleurs sont celles de la scène (vue3d/). */
export const CALQUES: DescriptionCalque[] = [
  { cle: 'robot', libelle: 'Robot', detail: 'G1-D', couleur: '#e9f0ff' },
  { cle: 'atelier', libelle: 'Atelier', detail: 'simulé', couleur: '#8793a8' },
  { cle: 'camera', libelle: 'Caméra', detail: 'RGBD · 30 i/s', couleur: '#ffffff' },
  { cle: 'lidar', libelle: 'Lidar', detail: '360° · 200 k pts/s', couleur: '#ffffff' },
  { cle: 'carte', libelle: 'Carte', detail: 'mémorisée · 5 cm', couleur: '#8fa6c8' },
  { cle: 'objets', libelle: 'Objets', detail: 'déclarés', couleur: 'conic-gradient(#3dd6ff 0 25%, #ffb02e 0 50%, #3dff8a 0 75%, #c77dff 0)' },
];
