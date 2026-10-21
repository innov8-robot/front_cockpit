/**
 * Les thèmes de la scène 3D : une couleur par sens. Le rouge est réservé au danger (arrêt d'urgence, alarme, zone
 * machine) et n'appartient à aucun thème, sauf à la référence « Rouge », gardée pour comparer.
 */
export interface ThemeScene {
  cle: string;
  nom: string;
  idee: string;
  /** Ce que voit la caméra de tête maintenant. */
  camera: string;
  /** Ce que voit le lidar maintenant. */
  lidar: string;
  /** La carte mémorisée : le ton du vivant, éteint. */
  memoire: string;
  /** L'impulsion du sonar et l'anneau sous le robot. */
  sonar: string;
  /** Le front qui déploie la scène au démarrage. */
  deploiement: string;
  /** Les arêtes des meubles et des objets de l'atelier. */
  meubles: string;
  /** La grille du sol. */
  sol: string;
}

export const THEMES: ThemeScene[] = [
  {
    cle: 'rouge', nom: 'Rouge', idee: 'La version d’avant, pour comparer : saturée et belle, mais le rouge dit « danger ».',
    camera: '#c4d2ea', lidar: '#ff5a64', memoire: '#b0303d', sonar: '#ff2d3a', deploiement: '#ff2d3a',
    meubles: '#8793a8', sol: '#cfd6e4',
  },
  {
    cle: 'glace', nom: 'Glace', idee: 'Sobre : le vivant en blanc, la mémoire gris-bleu, une seule couleur d’action.',
    camera: '#ffffff', lidar: '#ffffff', memoire: '#6f86ad', sonar: '#3d9bff', deploiement: '#3d9bff',
    meubles: '#8793a8', sol: '#cfd6e4',
  },
  {
    cle: 'phosphore', nom: 'Phosphore', idee: 'L’énergie du rouge en cyan : un lidar saturé qui teinte la pièce, un sonar blanc.',
    camera: '#e6fbff', lidar: '#22e6ff', memoire: '#1e9fbd', sonar: '#e8fdff', deploiement: '#22e6ff',
    meubles: '#5f8d99', sol: '#bfe9f2',
  },
  {
    cle: 'ultraviolet', nom: 'Ultraviolet', idee: 'Un laser UV : lidar violet, mémoire indigo, sonar cyan en contrepoint.',
    camera: '#f1ecff', lidar: '#8f5bff', memoire: '#5e49d1', sonar: '#4dd9ff', deploiement: '#8f5bff',
    meubles: '#7d76a8', sol: '#d6cff2',
  },
  {
    cle: 'spectre', nom: 'Spectre', idee: 'Monochrome : tout en gris, l’impulsion seule en lumière. Les couleurs sont pour le sens.',
    camera: '#ffffff', lidar: '#c9ced6', memoire: '#4f5663', sonar: '#ffffff', deploiement: '#ffffff',
    meubles: '#6f7685', sol: '#c9ced6',
  },
];

/** Le thème de l'accueil tant qu'aucun n'est choisi : celui d'aujourd'hui. */
export const THEME_PAR_DEFAUT = THEMES[1];
