/**
 * La barre de lecture sur les données de l'API : la mission qui joue (son exécution, relue chaque seconde), puis son
 * issue, lue dans son dernier run une fois qu'elle est finie.
 */
import type { Execution, Mission, Primitive, Run } from '../../api/types';
import { duree } from '../executions/donnees';
import { poignee, typePrimitive } from '../graphe/correspondance';
import { typeNoeud } from '../missions/catalogue';
import { MESSAGE_URGENCE, prevus, type GrapheLecture, type Lecture, type PasLecture } from './lecture';

/**
 * Le graphe d'une mission de l'API : le départ devient le déclencheur « au lancement » (sa sortie « réussi » devient
 * « suite », comme sur le canevas), chaque primitive sa tuile.
 */
export function grapheDe(m: Mission, primitives: Primitive[]): GrapheLecture {
  return {
    id: m.id, nom: m.nom,
    noeuds: m.noeuds.map((n) => {
      const p = primitives.find((x) => x.id === n.primitiveId);
      return n.primitiveId === null
        ? { id: n.id, x: n.x, y: n.y, type: typeNoeud('au_lancement'), nom: 'Lancement' }
        : { id: n.id, x: n.x, y: n.y, type: typePrimitive(p), nom: p?.nom ?? 'Primitive supprimée' };
    }),
    liens: m.liens.map((l) => ({ id: l.id, de: l.de, sortie: poignee(l.de, l.sortie), vers: l.vers })),
  };
}

/** La mission qui joue, telle que la barre la montre. */
export function lectureDirecte(m: Mission, primitives: Primitive[], x: Execution, urgence: boolean): Lecture {
  const g = grapheDe(m, primitives);
  const joues = x.joues ?? x.chemin.slice(1, x.etape + 1).map((noeud, i, t) => ({
    noeud, par: 'ok' as const, issue: i < t.length - 1 ? ('reussi' as const) : ('cours' as const),
  }));
  const pas: PasLecture[] = joues.map((j, i) => ({
    cle: `${x.repetition}:${i}:${j.noeud}`, noeud: j.noeud, issue: j.issue, par: poignee(joues[i - 1]?.noeud ?? 'depart', j.par), tour: x.repetition,
  }));
  const courant = pas.findIndex((p) => p.issue === 'cours');
  if (courant >= 0) {
    for (const s of prevus(g, pas[courant].noeud, new Set([pas[courant].noeud]))) {
      pas.push({ cle: `${x.repetition}:${pas.length}:${s.noeud}`, noeud: s.noeud, issue: 'prevu', par: s.par, tour: x.repetition });
    }
  }
  return {
    mission: g, pas, courant, dureeS: x.dureeS, dureeEtapeS: x.dureeEtapeS ?? null, tour: x.repetition, tours: x.repetitions,
    etat: urgence ? 'urgence' : x.enPause ? 'pause' : 'cours',
    message: urgence ? MESSAGE_URGENCE : x.alerte ? { niveau: x.alerte.niveau, texte: x.alerte.texte } : null,
  };
}

/**
 * La mission finie, d'après son dernier run : réussie (halo vert), arrêtée par une erreur (halo rouge, l'étape en cours
 * devient l'étape fautive) ou par l'arrêt d'urgence (rouge tant qu'il n'est pas réarmé, puis une erreur à acquitter).
 * Une mission arrêtée par l'opérateur n'a pas d'issue à montrer : `null`.
 */
export function lectureFinale(l: Lecture, run: Run, urgence: boolean): Lecture | null {
  const parUrgence = /urgence/i.test(run.cause ?? '');
  if (run.issue === 'interrompu' && !parUrgence) return null;
  const reussie = run.issue === 'reussi';
  const joues = l.pas.filter((p) => p.issue !== 'prevu');
  if (urgence && parUrgence) {
    return { ...l, pas: joues, courant: joues.findIndex((p) => p.issue === 'cours'), dureeS: run.dureeS, dureeEtapeS: null, etat: 'urgence', message: MESSAGE_URGENCE };
  }
  const pas = joues.map((p) => (p.issue === 'cours' ? { ...p, issue: reussie ? ('reussi' as const) : ('echoue' as const) } : p));
  const tours = l.tours > 1 ? `${l.tours} tours` : 'la mission';
  return {
    ...l, pas, courant: -1, dureeS: run.dureeS, dureeEtapeS: null, etat: reussie ? 'reussie' : 'erreur',
    message: reussie ? { niveau: 'succes', texte: `Terminée : ${tours} en ${duree(run.dureeS)}.` }
      : { niveau: 'erreur', texte: parUrgence ? 'La mission a été arrêtée par l’arrêt d’urgence.' : `La mission s’est arrêtée : ${run.cause ?? 'erreur du robot'}.` },
  };
}
