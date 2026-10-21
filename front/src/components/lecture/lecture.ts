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

export type EtatLecture = 'cours' | 'pause' | 'urgence' | 'reussie' | 'echouee';

export interface Lecture {
  mission: Mission;
  primitives: Primitive[];
  pas: PasLecture[];
  /** L'index de l'étape en cours dans `pas`, -1 quand la mission est finie. */
  courant: number;
  /** Le temps joué depuis le lancement, et dans l'étape en cours (s). */
  dureeS: number;
  dureeEtapeS: number;
  tour: number;
  tours: number;
  etat: EtatLecture;
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
