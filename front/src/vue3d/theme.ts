import type { Teinte } from './nuages';

/**
 * Les thèmes de la scène 3D : une couleur par sens. Le rouge est réservé au danger (arrêt d'urgence, alarme, zone
 * machine) et n'appartient à aucun thème, sauf à la référence « Rouge », gardée pour comparer.
 */
export interface ThemeScene {
  cle: string;
  nom: string;
  /** « teinte » : une couleur par rôle ; « hauteur » : le vivant et la mémoire en dégradé selon la hauteur. */
  famille: 'teinte' | 'hauteur';
  idee: string;
  /** Le principe de couleur : le type d'harmonie, ou la palette perceptive employée. */
  harmonie: string;
  /** Ce qui entre en concurrence avec les couleurs de sécurité, s'il y en a. */
  conflit?: string;
  /** Ce que voit la caméra de tête maintenant. */
  camera: Teinte;
  /** Ce que voit le lidar maintenant. */
  lidar: Teinte;
  /** La carte mémorisée : le ton du vivant, éteint. */
  memoire: Teinte;
  /** L'impulsion du sonar et l'anneau sous le robot. */
  sonar: string;
  /** Le front qui déploie la scène au démarrage. */
  deploiement: string;
  /** Les arêtes des meubles et des objets de l'atelier. */
  meubles: string;
  /** La grille du sol. */
  sol: string;
}

/** Les dégradés par la hauteur, du sol vers le haut (matplotlib pour Viridis et Turbo). */
const VIRIDIS = ['#440154', '#3b528b', '#21918c', '#5ec962', '#fde725'] as const;
const TURBO = ['#30123b', '#28bceb', '#a4fc3c', '#fb7e21', '#7a0403'] as const;
const ABYSSE = ['#0b1d3a', '#1f4e8c', '#2a8fbf', '#4fd1d9', '#d6fbff'] as const;

export const THEMES: ThemeScene[] = [
  {
    cle: 'rouge', nom: 'Rouge', famille: 'teinte',
    idee: 'La version d’avant, pour comparer : saturée et belle.', harmonie: 'Monochrome rouge.',
    conflit: 'Le rouge dit « danger » (ISO 3864, ANSI Z535) : toute la scène crierait.',
    camera: '#c4d2ea', lidar: '#ff5a64', memoire: '#b0303d', sonar: '#ff2d3a', deploiement: '#ff2d3a',
    meubles: '#8793a8', sol: '#cfd6e4',
  },
  {
    cle: 'glace', nom: 'Glace', famille: 'teinte',
    idee: 'Sobre : le vivant en blanc, la mémoire gris-bleu, une seule couleur d’action.',
    harmonie: 'Neutres et un accent froid.',
    camera: '#ffffff', lidar: '#ffffff', memoire: '#6f86ad', sonar: '#3d9bff', deploiement: '#3d9bff',
    meubles: '#8793a8', sol: '#cfd6e4',
  },
  {
    cle: 'phosphore', nom: 'Phosphore', famille: 'teinte',
    idee: 'L’énergie du rouge en cyan : un lidar saturé qui teinte la pièce, un sonar blanc.',
    harmonie: 'Monochrome cyan, l’impulsion en blanc.',
    camera: '#e6fbff', lidar: '#22e6ff', memoire: '#1e9fbd', sonar: '#e8fdff', deploiement: '#22e6ff',
    meubles: '#5f8d99', sol: '#bfe9f2',
  },
  {
    cle: 'ultraviolet', nom: 'Ultraviolet', famille: 'teinte',
    idee: 'Un laser UV : lidar violet, mémoire indigo, sonar cyan en contrepoint.',
    harmonie: 'Analogue violet-indigo, l’impulsion en cyan voisin.',
    camera: '#f1ecff', lidar: '#8f5bff', memoire: '#5e49d1', sonar: '#4dd9ff', deploiement: '#8f5bff',
    meubles: '#7d76a8', sol: '#d6cff2',
  },
  {
    cle: 'tungstene', nom: 'Tungstène', famille: 'teinte',
    idee: 'L’orange chaud d’un filament, le sonar cyan en face : le contraste des affiches et du cinéma.',
    harmonie: 'Complémentaire : orange et cyan, opposés sur le cercle.',
    conflit: 'L’orange dit « avertissement » (ANSI Z535) : l’attention passerait au jaune.',
    camera: '#fff1e6', lidar: '#ff8a3d', memoire: '#b8561f', sonar: '#39d5ff', deploiement: '#ff8a3d',
    meubles: '#9a7e70', sol: '#f2d9c9',
  },
  {
    cle: 'ambre', nom: 'Terminal ambre', famille: 'teinte',
    idee: 'Les écrans à phosphore ambre des terminaux : tout en ambre, l’impulsion en blanc chaud.',
    harmonie: 'Monochrome chaud.',
    conflit: 'L’ambre est la couleur d’attention de la barre du robot : il faudrait la changer.',
    camera: '#ffe7b0', lidar: '#ffb000', memoire: '#a06a00', sonar: '#fff3d6', deploiement: '#ffb000',
    meubles: '#8f7a55', sol: '#f0dfb8',
  },
  {
    cle: 'synthwave', nom: 'Synthwave', famille: 'teinte',
    idee: 'Néons de nuit : un lidar magenta, une mémoire prune, le sonar cyan.',
    harmonie: 'Complémentaire décalée : magenta, et cyan à côté de son opposé.',
    camera: '#ffe0fb', lidar: '#ff3df2', memoire: '#9a2aa8', sonar: '#3df7ff', deploiement: '#ff3df2',
    meubles: '#8a6f9e', sol: '#f0d0f0',
  },
  {
    cle: 'spectre', nom: 'Spectre', famille: 'teinte',
    idee: 'Monochrome : tout en gris, l’impulsion seule en lumière. Les couleurs sont pour le sens.',
    harmonie: 'Achromatique.',
    camera: '#ffffff', lidar: '#c9ced6', memoire: '#4f5663', sonar: '#ffffff', deploiement: '#ffffff',
    meubles: '#6f7685', sol: '#c9ced6',
  },
  {
    cle: 'viridis', nom: 'Viridis', famille: 'hauteur',
    idee: 'La couleur dit la hauteur : le sol violet, les plateaux verts, le haut des étagères jaune.',
    harmonie: 'Palette perceptivement uniforme, lisible par les daltoniens : la référence scientifique.',
    conflit: 'Elle traverse le vert et le jaune (OK, prudence) : la hauteur prime sur le sens.',
    camera: VIRIDIS, lidar: VIRIDIS, memoire: VIRIDIS, sonar: '#ffffff', deploiement: '#21918c',
    meubles: '#6f7f88', sol: '#c9ced6',
  },
  {
    cle: 'abysse', nom: 'Abysse', famille: 'hauteur',
    idee: 'La hauteur en bleus : du marine au sol jusqu’au blanc glacé en haut.',
    harmonie: 'Dégradé froid à luminance croissante, aucune couleur de sécurité.',
    camera: ABYSSE, lidar: ABYSSE, memoire: ABYSSE, sonar: '#ffffff', deploiement: '#4fd1d9',
    meubles: '#5f7a91', sol: '#c9d8e6',
  },
  {
    cle: 'turbo', nom: 'Turbo', famille: 'hauteur',
    idee: 'L’arc-en-ciel de Google, celui des logiciels de nuages de points : chaque hauteur a sa couleur.',
    harmonie: 'Arc-en-ciel amélioré : les écarts se voient mieux, mais la luminance n’est pas uniforme.',
    conflit: 'Il finit en rouge : le haut des étagères ressemblerait à une alarme.',
    camera: TURBO, lidar: TURBO, memoire: TURBO, sonar: '#ffffff', deploiement: '#28bceb',
    meubles: '#6f7f88', sol: '#c9ced6',
  },
];

/** Le thème de l'accueil tant qu'aucun n'est choisi : celui d'aujourd'hui. */
export const THEME_PAR_DEFAUT = THEMES[1];
