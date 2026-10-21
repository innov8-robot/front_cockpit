/**
 * Ce que les listes de missions montrent, calculé une fois depuis l'API : pour chaque mission, son chemin principal,
 * ses derniers runs, son taux de réussite et sa durée moyenne ; et la mission en cours, relue chaque seconde.
 */
import { useEffect, useMemo, useState } from 'react';
import { api, robotUnique } from '../../api/client';
import type { EtatMission, Execution, Mission, Primitive, Robot, Run, Sortie } from '../../api/types';
import { nomDuNoeud, typeDuNoeud } from '../graphe/correspondance';
import type { TypeNoeud } from '../missions/catalogue';

/** Le résumé d'une mission pour une liste. */
export interface Resume {
  mission: Mission;
  /** Les nœuds du chemin principal depuis le départ, dans l'ordre, avec leur type et leur nom. */
  chaine: { noeud: string; type: TypeNoeud; nom: string }[];
  /** Le nombre de primitives qui ont une sortie « échec » reliée. */
  echecs: number;
  /** Les derniers runs, du plus ancien au plus récent. */
  runs: Run[];
  taux: number | null;
  dureeMoyS: number | null;
  dernier: Run | null;
}

const NB_RUNS = 8;

/** Les sorties du chemin principal, dans l'ordre où on les suit : réussi, puis dans une boucle et quand rien n'arrive. */
const PRINCIPALES: Sortie[] = ['ok', 'suite', 'faire', 'sinon'];

/**
 * Le chemin principal d'une mission : du départ, on suit « réussi » (ou la suite d'une boucle, la branche « sinon »
 * d'une condition) jusqu'au bout ou jusqu'à repasser par un nœud vu.
 */
function chaine(m: Mission, parId: Map<string, Primitive>): Resume['chaine'] {
  const vus: string[] = ['depart'];
  for (;;) {
    const suite = PRINCIPALES.map((s) => m.liens.find((l) => l.de === vus.at(-1) && l.sortie === s)).find(Boolean);
    if (!suite || vus.includes(suite.vers)) break;
    vus.push(suite.vers);
  }
  return vus.slice(1).flatMap((id) => {
    const n = m.noeuds.find((x) => x.id === id);
    return n ? [{ noeud: id, type: typeDuNoeud(n, parId), nom: nomDuNoeud(n, parId) }] : [];
  });
}

export function resumer(m: Mission, primitives: Primitive[], runs: Run[]): Resume {
  const parId = new Map(primitives.map((p) => [p.id, p]));
  const siens = runs.filter((r) => r.missionId === m.id && r.dureeS > 0).sort((a, b) => a.debut.localeCompare(b.debut));
  const finis = siens.filter((r) => r.issue !== 'interrompu');
  return {
    mission: m,
    chaine: chaine(m, parId),
    echecs: new Set(m.liens.filter((l) => l.sortie === 'echec').map((l) => l.de)).size,
    runs: siens.slice(-NB_RUNS),
    taux: finis.length ? finis.filter((r) => r.issue === 'reussi').length / finis.length : null,
    dureeMoyS: siens.length ? siens.reduce((s, r) => s + r.dureeS, 0) / siens.length : null,
    dernier: siens.at(-1) ?? null,
  };
}

/** Les missions résumées, le robot et sa mission en cours ; relus chaque seconde pour que la liste vive. */
export function useMissions() {
  const [donnees, setDonnees] = useState<{ missions: Mission[]; primitives: Primitive[]; runs: Run[]; robot: Robot | null; execution: Execution | null } | null>(null);
  const [tic, setTic] = useState(0);
  useEffect(() => {
    let vivant = true;
    const lire = async () => {
      const [missions, primitives, runs, robot] = await Promise.all([api.missions(), api.primitives(), api.runs(), robotUnique()]);
      const execution = robot ? await api.execution(robot.id) : null;
      if (vivant) setDonnees({ missions, primitives, runs, robot: robot ?? null, execution });
    };
    lire().catch(() => undefined);
    const t = setInterval(() => lire().catch(() => undefined), 1000);
    return () => { vivant = false; clearInterval(t); };
  }, [tic]);
  const resumes = useMemo(
    () => (donnees ? donnees.missions.map((m) => resumer(m, donnees.primitives, donnees.runs)) : []),
    [donnees],
  );
  return {
    resumes, primitives: donnees?.primitives ?? [], robot: donnees?.robot ?? null, execution: donnees?.execution ?? null,
    pret: donnees !== null, relire: () => setTic((x) => x + 1),
  };
}

export const chrono = (s: number) => `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(Math.floor(s % 60)).padStart(2, '0')}`;

/** La couleur d'un état de mission dans la DA : vert prêt ou terminé, ambre échoué, blanc en cours, gris brouillon. */
export const COULEUR_ETAT: Record<EtatMission, string> = {
  brouillon: '#8a93a3', prete: '#3dff8a', en_cours: '#e9eef7', terminee: '#3dff8a', echouee: '#ffb02e',
};

/** L'état montré d'une mission : en cours si le robot la joue maintenant, sinon celui qu'elle a gardé. */
export function etatDe(r: Resume, execution: Execution | null): EtatMission {
  return execution?.missionId === r.mission.id ? 'en_cours' : r.mission.etat === 'en_cours' ? 'prete' : r.mission.etat;
}
