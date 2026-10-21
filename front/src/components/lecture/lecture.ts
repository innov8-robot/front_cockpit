/**
 * Ce que la barre de lecture montre d'une mission qui joue : les étapes jouées (tous tours confondus), celle qui se
 * joue, et celles qu'on prévoit en suivant « réussi ». Aucune durée n'est prédite : on ne sait pas combien de temps
 * une étape va tourner.
 */
import type { Mission, Primitive } from '../../api/types';

export type IssuePas = 'reussi' | 'echoue' | 'cours' | 'prevu';

/** Une étape sur la barre. `cle` reste la même de « prévue » à « jouée » : l'élément garde son identité à l'écran. */
export interface PasLecture {
  cle: string;
  noeud: string;
  issue: IssuePas;
  /** La sortie de l'étape précédente qui y mène : « echec » se dessine en pointillé ambre. */
  par: 'ok' | 'echec';
  tour: number;
}

export type EtatLecture = 'cours' | 'pause' | 'urgence' | 'reussie' | 'erreur';

/**
 * Ce que la barre dit autour d'elle : la mission a réussi (vert), un avertissement qui ne l'arrête pas (ambre), une
 * erreur qui l'a arrêtée (rouge, jusqu'à ce qu'on l'acquitte).
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
  mission: Mission;
  primitives: Primitive[];
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
}

/** Le nœud où mène une sortie, s'il y en a un. */
export function suivant(m: Mission, noeud: string, sortie: 'ok' | 'echec'): string | undefined {
  return m.liens.find((l) => l.de === noeud && l.sortie === sortie)?.vers;
}

/** Les nœuds qu'on prévoit après `depuis` en suivant « réussi », jusqu'au bout ou jusqu'à repasser par un nœud vu. */
export function prevus(m: Mission, depuis: string, vus: Set<string>): string[] {
  const suite: string[] = [];
  const deja = new Set(vus);
  for (let n = suivant(m, depuis, 'ok'); n && !deja.has(n); n = suivant(m, n, 'ok')) {
    suite.push(n);
    deja.add(n);
  }
  return suite;
}
