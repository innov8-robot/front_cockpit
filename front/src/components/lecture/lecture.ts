/**
 * Ce que la barre de lecture montre d'une mission qui joue : son graphe, les étapes jouées (tous tours confondus),
 * celle qui se joue, et celles qu'on prévoit. Aucune durée n'est prédite : on ne sait pas combien de temps une étape
 * va tourner. Aucune branche non plus : la prévision s'arrête devant une condition ou une boucle.
 */
import type { TypeNoeud } from '../missions/catalogue';
import type { Sortie } from '../missions/charte';

/** Un nœud du graphe : sa place sur le canevas de l'éditeur, son type au catalogue, et le nom qu'on lui montre. */
export interface NoeudGraphe {
  id: string;
  x: number;
  y: number;
  type: TypeNoeud;
  nom: string;
}

export interface LienGraphe {
  id: string;
  de: string;
  sortie: Sortie;
  vers: string;
}

/** La mission telle que la barre la dessine : primitives, logique, appels à l'opérateur, fin. */
export interface GrapheLecture {
  id: string;
  nom: string;
  noeuds: NoeudGraphe[];
  liens: LienGraphe[];
}

export type IssuePas = 'reussi' | 'echoue' | 'cours' | 'prevu';

/** Une étape sur la barre. `cle` reste la même de « prévue » à « jouée » : l'élément garde son identité à l'écran. */
export interface PasLecture {
  cle: string;
  noeud: string;
  issue: IssuePas;
  /** La sortie de l'étape précédente qui y mène : « echec » se dessine en pointillé ambre. */
  par: Sortie;
  tour: number;
}

export type EtatLecture = 'cours' | 'pause' | 'urgence' | 'reussie' | 'erreur' | 'arretee';

/**
 * Ce que la barre dit autour d'elle : la mission a réussi (vert), un avertissement qui ne l'arrête pas (ambre), ce qui
 * l'a arrêtée — une erreur, l'arrêt d'urgence, le stop de l'opérateur — (rouge, jusqu'à ce qu'on l'acquitte).
 */
export interface MessageLecture {
  niveau: 'succes' | 'attention' | 'erreur';
  texte: string;
}

/** Le message de l'arrêt d'urgence : il reste jusqu'au réarmement. */
export const MESSAGE_URGENCE: MessageLecture = {
  niveau: 'erreur', texte: 'Arrêt d’urgence engagé. Réarmez-le depuis la barre du robot pour reprendre.',
};

export interface Lecture {
  mission: GrapheLecture;
  pas: PasLecture[];
  /** L'index de l'étape en cours dans `pas`, -1 quand la mission est finie. */
  courant: number;
  /** Le temps joué depuis le lancement, et dans l'étape en cours quand le robot le dit (s). */
  dureeS: number;
  dureeEtapeS: number | null;
  tour: number;
  tours: number;
  etat: EtatLecture;
  message: MessageLecture | null;
  /** La mission s'arrête après chaque étape et attend qu'on lance la suivante. */
  pasAPas?: boolean;
}

/** La mission est finie : réussie, en erreur, ou arrêtée. */
export const estFinie = (l: Lecture) => l.etat === 'reussie' || l.etat === 'erreur' || l.etat === 'arretee';

/**
 * Le halo autour de ce qui montre la mission (la barre, le workflow déplié) : le rouge d'une erreur ou d'un arrêt
 * d'abord, puis le blanc de la pause, puis l'ambre d'un avertissement, le vert d'une mission terminée.
 */
export function haloDe(l: Lecture): string | null {
  if (l.message?.niveau === 'erreur') return 'erreur';
  if (l.etat === 'pause') return 'pause';
  return l.message?.niveau ?? null;
}

/** Les sorties qu'on suit pour prévoir la suite : celles qui ne dépendent d'aucune condition. */
const SANS_CONDITION: Sortie[] = ['ok', 'suite'];

/** Le nœud où mène une sortie, s'il y en a un. */
export function suivant(g: GrapheLecture, noeud: string, sortie: Sortie): string | undefined {
  return g.liens.find((l) => l.de === noeud && l.sortie === sortie)?.vers;
}

/**
 * Les nœuds qu'on prévoit après `depuis`, avec la sortie qui y mène : on suit « réussi » ou « suite » jusqu'au bout,
 * jusqu'à repasser par un nœud vu, ou jusqu'à une condition ou une boucle, dont on ne connaît pas la branche.
 */
export function prevus(g: GrapheLecture, depuis: string, vus: Set<string>): { noeud: string; par: Sortie }[] {
  const suite: { noeud: string; par: Sortie }[] = [];
  const deja = new Set(vus);
  let de = depuis;
  for (;;) {
    const lien = g.liens.find((l) => l.de === de && SANS_CONDITION.includes(l.sortie));
    if (!lien || deja.has(lien.vers)) return suite;
    suite.push({ noeud: lien.vers, par: lien.sortie });
    deja.add(lien.vers);
    if (g.noeuds.find((n) => n.id === lien.vers)?.type.famille === 'logique') return suite;
    de = lien.vers;
  }
}
