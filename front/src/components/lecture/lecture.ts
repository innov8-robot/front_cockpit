/**
 * Ce que la barre de lecture montre d'une mission qui joue : les étapes jouées (tous tours confondus), celle qui se
 * joue, celles qu'on prévoit en suivant « réussi », et où partirait la mission si l'étape en cours ratait.
 */
import type { Mission, Primitive } from '../../api/types';

export type IssuePas = 'reussi' | 'echoue' | 'cours' | 'prevu';

/** Une étape sur la barre. `cle` reste la même de « prévue » à « jouée » : l'élément garde son identité à l'écran. */
export interface PasLecture {
  cle: string;
  noeud: string;
  primitive: Primitive | undefined;
  issue: IssuePas;
  /** La sortie de l'étape précédente qui y mène : « echec » se dessine en pointillé ambre. */
  par: 'ok' | 'echec';
  /** Jouée : sa durée ; en cours : le temps écoulé ; prévue : la durée estimée (s). */
  dureeS: number;
  /** Estimée (s), pour l'étape en cours. */
  estimeeS: number;
  tour: number;
}

export type EtatLecture = 'cours' | 'pause' | 'urgence' | 'reussie' | 'echouee';

export interface Lecture {
  mission: Mission;
  pas: PasLecture[];
  /** L'index de l'étape en cours dans `pas`, -1 quand la mission est finie. */
  courant: number;
  avancement: number;
  dureeS: number;
  tour: number;
  tours: number;
  etat: EtatLecture;
  /** Le temps qui reste, estimé sur les durées moyennes (s). */
  resteS: number | null;
  /** La primitive où part la mission si l'étape en cours rate ; null si elle n'a pas de sortie « échec ». */
  siEchec: Primitive | null;
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

/** La place d'une étape dans son tour : « 3/5 ». */
export function rangDansTour(l: Lecture, i: number): { rang: number; nombre: number } {
  const duTour = l.pas.filter((p) => p.tour === l.pas[i]?.tour);
  return { rang: duTour.indexOf(l.pas[i]) + 1, nombre: duTour.length };
}
