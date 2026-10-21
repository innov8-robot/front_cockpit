/**
 * Une mission qui joue, simulée pour la page d'essai de la barre de lecture : deux missions (longue avec une branche
 * « échec », courte), des tours, une prise qui rate au deuxième tour, la pause, l'arrêt d'urgence. Le temps est
 * accéléré : une étape de 14 s en dure moins de cinq à l'écran.
 */
import { useEffect, useReducer } from 'react';
import type { Mission, Primitive, TypePrimitive } from '../../api/types';
import { prevus, suivant, type EtatLecture, type Lecture, type PasLecture } from './lecture';

const primitive = (id: string, nom: string, type: TypePrimitive): Primitive => ({
  id, nom, type, description: '', objet: null, ancrage: null, poste: null, vitesse: 1, creeLe: '', creePar: '',
  tauxReussite: null, executions: 0,
});

const PRIMITIVES = [
  primitive('table', 'Aller à la table', 'deplacer'),
  primitive('prise', 'Prendre la pièce Novares', 'prise_objet'),
  primitive('bac', 'Aller au bac B', 'deplacer'),
  primitive('depose', 'Déposer dans le bac B', 'depose'),
  primitive('rentrer', 'Rentrer les bras', 'rentrer'),
  primitive('base', 'Retour à la base', 'deplacer'),
];

const noeud = (id: string, primitiveId: string | null) => ({ id, primitiveId, x: 0, y: 0 });
const lien = (de: string, sortie: 'ok' | 'echec', vers: string) => ({ id: `${de}-${sortie}-${vers}`, de, sortie, vers });

export const MISSIONS_ESSAI: Record<'longue' | 'courte', Mission> = {
  longue: {
    id: 'essai-longue', nom: 'Vider la table dans le bac', description: '', robotId: 'r1', repetitions: 3, etat: 'en_cours', modifieeLe: '',
    noeuds: [noeud('depart', null), noeud('n1', 'table'), noeud('n2', 'prise'), noeud('n3', 'bac'), noeud('n4', 'depose'),
      noeud('n5', 'rentrer'), noeud('n6', 'base')],
    liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n2', 'ok', 'n3'), lien('n3', 'ok', 'n4'),
      lien('n2', 'echec', 'n5'), lien('n4', 'echec', 'n5'), lien('n5', 'ok', 'n6')],
  },
  courte: {
    id: 'essai-courte', nom: 'Prendre et déposer', description: '', robotId: 'r1', repetitions: 4, etat: 'en_cours', modifieeLe: '',
    noeuds: [noeud('depart', null), noeud('n1', 'prise'), noeud('n2', 'depose'), noeud('n3', 'rentrer')],
    liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n1', 'echec', 'n3')],
  },
};

/** La durée moyenne d'une étape, par type de primitive (s). */
const MOYENNE: Record<TypePrimitive, number> = { deplacer: 14, prise_objet: 18, prise_boite: 20, depose: 11, rentrer: 6 };

/** Après la fin, la mission reprend depuis le début au bout de ce temps (s, temps réel). */
const REPRISE_S = 6;

interface Moteur {
  mission: Mission;
  t: number;
  tour: number;
  passe: PasLecture[];
  noeud: string | null;
  par: 'ok' | 'echec';
  debut: number;
  enPause: boolean;
  urgence: boolean;
  fin: 'reussie' | 'echouee' | null;
  attente: number;
}

type Action = { type: 'tick'; reelS: number; vitesse: number } | { type: 'pause' } | { type: 'rater' } | { type: 'urgence' } | { type: 'rearmer' };

const primitiveDe = (m: Mission, id: string) => PRIMITIVES.find((p) => p.id === m.noeuds.find((n) => n.id === id)?.primitiveId);
const estimee = (m: Mission, id: string) => MOYENNE[primitiveDe(m, id)?.type ?? 'deplacer'];

/** Un nombre entre 0 et 1, toujours le même pour le même texte : la durée d'une étape varie d'un tour à l'autre. */
function hachage(texte: string): number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const dureeReelle = (m: Moteur, id: string) => estimee(m.mission, id) * (0.8 + 0.45 * hachage(`${id}:${m.tour}:${m.passe.length}`));
const cle = (tour: number, index: number, id: string) => `${tour}:${index}:${id}`;

function demarrer(mission: Mission): Moteur {
  return {
    mission, t: 0, tour: 1, passe: [], noeud: suivant(mission, 'depart', 'ok') ?? null, par: 'ok', debut: 0,
    enPause: false, urgence: false, fin: null, attente: 0,
  };
}

/** L'étape en cours se termine à `finS`, réussie ou ratée ; la mission prend la sortie qui suit, ou change de tour. */
function terminer(m: Moteur, finS: number, rate: boolean): Moteur {
  const id = m.noeud!;
  const fait: PasLecture = {
    cle: cle(m.tour, m.passe.length, id), noeud: id, primitive: primitiveDe(m.mission, id), issue: rate ? 'echoue' : 'reussi',
    par: m.par, dureeS: finS - m.debut, estimeeS: estimee(m.mission, id), tour: m.tour,
  };
  const sortie = rate ? 'echec' : 'ok';
  const vers = suivant(m.mission, id, sortie);
  const base = { ...m, passe: [...m.passe, fait], debut: finS };
  if (vers) return { ...base, noeud: vers, par: sortie };
  if (rate) return { ...base, noeud: null, fin: 'echouee' };
  if (m.tour < m.mission.repetitions) return { ...base, tour: m.tour + 1, noeud: suivant(m.mission, 'depart', 'ok') ?? null, par: 'ok' };
  return { ...base, noeud: null, fin: 'reussie' };
}

function reduire(m: Moteur, a: Action): Moteur {
  switch (a.type) {
    case 'pause': return m.fin || m.urgence ? m : { ...m, enPause: !m.enPause };
    case 'urgence': return m.fin ? m : { ...m, urgence: true };
    case 'rearmer': return demarrer(m.mission);
    case 'rater': return m.noeud && !m.urgence ? terminer(m, m.t, true) : m;
    case 'tick': {
      if (m.fin) return m.attente + a.reelS > REPRISE_S ? demarrer(m.mission) : { ...m, attente: m.attente + a.reelS };
      if (m.enPause || m.urgence || !m.noeud) return m;
      const t = m.t + a.reelS * a.vitesse;
      const d = dureeReelle(m, m.noeud);
      if (t - m.debut < d) return { ...m, t };
      const rate = m.tour === 2 && primitiveDe(m.mission, m.noeud)?.type === 'prise_objet';
      return terminer({ ...m, t }, m.debut + d, rate);
    }
  }
}

/** Ce que la barre montre du moteur : le passé, l'étape en cours, la suite prévue, le temps qui reste. */
function lire(m: Moteur): Lecture {
  const pas = [...m.passe];
  let courant = -1;
  let avancement = 0;
  let resteS: number | null = null;
  const etat: EtatLecture = m.urgence ? 'urgence' : m.fin ?? (m.enPause ? 'pause' : 'cours');
  const echec = m.noeud ? suivant(m.mission, m.noeud, 'echec') : undefined;
  if (m.noeud) {
    courant = pas.length;
    const ecoule = m.t - m.debut;
    const est = estimee(m.mission, m.noeud);
    avancement = Math.min(0.97, ecoule / est);
    pas.push({ cle: cle(m.tour, pas.length, m.noeud), noeud: m.noeud, primitive: primitiveDe(m.mission, m.noeud), issue: 'cours', par: m.par, dureeS: ecoule, estimeeS: est, tour: m.tour });
    const vus = new Set([...m.passe.filter((p) => p.tour === m.tour).map((p) => p.noeud), m.noeud]);
    for (const id of prevus(m.mission, m.noeud, vus)) {
      pas.push({ cle: cle(m.tour, pas.length, id), noeud: id, primitive: primitiveDe(m.mission, id), issue: 'prevu', par: 'ok', dureeS: estimee(m.mission, id), estimeeS: estimee(m.mission, id), tour: m.tour });
    }
    const tourEntier = [suivant(m.mission, 'depart', 'ok') ?? '', ...prevus(m.mission, suivant(m.mission, 'depart', 'ok') ?? '', new Set())]
      .reduce((s, id) => s + (id ? estimee(m.mission, id) : 0), 0);
    resteS = Math.max(0, est - ecoule) + pas.slice(courant + 1).reduce((s, p) => s + p.dureeS, 0) + (m.mission.repetitions - m.tour) * tourEntier;
  }
  return {
    mission: m.mission, pas, courant, avancement, dureeS: m.t, tour: m.tour, tours: m.mission.repetitions, etat, resteS,
    siEchec: echec ? primitiveDe(m.mission, echec) ?? null : null,
  };
}

/** Le pas de la simulation, en temps réel (ms). */
const PAS_MS = 100;

/** La mission simulée qui joue, et les gestes de l'opérateur sur elle. */
export function useScenario(mission: Mission, vitesse: number) {
  const [moteur, envoyer] = useReducer(reduire, mission, demarrer);
  useEffect(() => {
    const t = setInterval(() => envoyer({ type: 'tick', reelS: PAS_MS / 1000, vitesse }), PAS_MS);
    return () => clearInterval(t);
  }, [vitesse]);
  return {
    lecture: lire(moteur),
    pause: () => envoyer({ type: 'pause' }),
    rater: () => envoyer({ type: 'rater' }),
    urgence: () => envoyer({ type: 'urgence' }),
    rearmer: () => envoyer({ type: 'rearmer' }),
  };
}
