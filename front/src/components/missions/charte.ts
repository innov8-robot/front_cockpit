/**
 * La charte de l'éditeur de missions : les familles de nœuds, leur couleur et leur forme, les sorties et les états
 * d'exécution. Les couleurs vivent dans la direction artistique de l'appli : le rouge n'y sert qu'au danger, l'ambre
 * qu'à l'attention, le vert qu'à l'OK (README §Les couleurs de la scène) ; aucune famille ne les emprunte.
 */

/** La forme d'un nœud dit son rôle, comme les blocs de Scratch : on la lit avant la couleur. */
export type Forme = 'chapeau' | 'action' | 'cadre' | 'question' | 'fin' | 'note';

export interface Famille {
  cle: string;
  nom: string;
  couleur: string;
  forme: Forme;
  role: string;
}

/** Les familles, dans l'ordre de la palette. */
export const FAMILLES: Famille[] = [
  { cle: 'declencheur', nom: 'Déclencheurs', couleur: '#e9eef7', forme: 'chapeau', role: 'ce qui lance la mission' },
  { cle: 'robot', nom: 'Gestes du robot', couleur: '#5b8cff', forme: 'action', role: 'les primitives enregistrées : prendre, déposer' },
  { cle: 'deplacement', nom: 'Déplacements', couleur: '#38bdf8', forme: 'action', role: 'rouler jusqu’à un poste, rentrer les bras' },
  { cle: 'perception', nom: 'Perception', couleur: '#a78bfa', forme: 'question', role: 'voir, compter, reconnaître : rend une valeur' },
  { cle: 'logique', nom: 'Logique', couleur: '#e879f9', forme: 'cadre', role: 'SI … ALORS, POUR … ALLANT DE, TANT QUE : des structures qui se lisent comme du pseudocode' },
  { cle: 'donnees', nom: 'Données', couleur: '#cbd5e1', forme: 'action', role: 'compteurs et variables' },
  { cle: 'temps', nom: 'Temps', couleur: '#7c8798', forme: 'action', role: 'attendre une durée, un signal' },
  { cle: 'operateur', nom: 'Opérateur', couleur: '#ffb02e', forme: 'action', role: 'demander une action humaine : c’est une attention' },
  { cle: 'fin', nom: 'Fin', couleur: '#e9eef7', forme: 'fin', role: 'terminer la mission, avec son verdict' },
];

export const FAMILLE = Object.fromEntries(FAMILLES.map((f) => [f.cle, f])) as Record<string, Famille>;

/** Les sorties d'un nœud et leur trait : le chemin normal plein, l'échec pointillé ambre, jamais rouge. */
export const SORTIES = {
  ok: { libelle: 'réussi', couleur: '#e9eef7', pointille: false },
  echec: { libelle: 'échoué', couleur: '#ffb02e', pointille: true },
  vrai: { libelle: 'oui', couleur: '#e9eef7', pointille: false },
  faux: { libelle: 'non', couleur: '#8a93a3', pointille: true },
  corps: { libelle: 'à chaque tour', couleur: '#e879f9', pointille: false },
  alors: { libelle: 'alors', couleur: '#e879f9', pointille: false },
  sinon: { libelle: 'sinon', couleur: '#e879f9', pointille: false },
  fini: { libelle: 'ensuite', couleur: '#e9eef7', pointille: false },
  suite: { libelle: '', couleur: '#e9eef7', pointille: false },
  cas1: { libelle: 'cas 1', couleur: '#e9eef7', pointille: false },
  cas2: { libelle: 'cas 2', couleur: '#e9eef7', pointille: false },
  autre: { libelle: 'autre', couleur: '#8a93a3', pointille: true },
} as const;

/** Ce que l'éditeur sait du nœud aujourd'hui, par rapport au robot : la proposition ne cache pas ce qui manque. */
export const STATUTS = {
  existe: { libelle: 'existe', aide: 'déjà dans les missions du cockpit' },
  atome: { libelle: 'existe en atome', aide: 'présent dans l’arbre de comportement, pas encore au niveau mission' },
  nouveau: { libelle: 'à construire', aide: 'nouveau : le robot ne le sait pas encore' },
} as const;

export type Statut = keyof typeof STATUTS;

export type Sortie = keyof typeof SORTIES;

/** Les états d'un nœud pendant une exécution : la couleur ET une icône, jamais la couleur seule. */
export const ETATS = {
  attente: { libelle: 'en attente', couleur: '#5b636e', icone: '·' },
  cours: { libelle: 'en cours', couleur: '#e9eef7', icone: '◌' },
  ok: { libelle: 'réussi', couleur: '#3dff8a', icone: '✓' },
  echec: { libelle: 'échoué', couleur: '#ffb02e', icone: '!' },
  danger: { libelle: 'arrêt de sécurité', couleur: '#ff2d3a', icone: '■' },
  saute: { libelle: 'non joué', couleur: '#3a4049', icone: '–' },
} as const;

export type EtatNoeud = keyof typeof ETATS;

/** L'état d'un lien pendant une exécution : au repos, déjà parcouru, ou menant à l'étape en cours. */
export type EtatLien = 'aucun' | 'parcouru' | 'actif';

/** La couleur de l'onde d'un lien pendant une exécution : l'issue qu'elle porte ; l'entrée dans une boucle est neutre. */
export type Ton = 'ok' | 'echec' | 'danger' | 'neutre';
export const TONS: Record<Ton, string> = { ok: '#3dff8a', echec: '#ffb02e', danger: '#ff2d3a', neutre: '#e9eef7' };
