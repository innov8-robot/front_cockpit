/**
 * Une mission qui joue, simulée pour la page d'essai de la barre de lecture : deux missions (longue avec une branche
 * « échec », courte), des tours, une prise qui rate au deuxième tour, la pause, l'arrêt d'urgence, un avertissement
 * qui n'arrête rien et une erreur qui arrête tout. Le temps est accéléré : une étape de 14 s en dure moins de cinq.
 */
import { useEffect, useReducer } from 'react';
import type { Mission, Primitive, TypePrimitive } from '../../api/types';
import { duree } from '../executions/donnees';
import { MESSAGE_URGENCE, prevus, suivant, type Lecture, type MessageLecture, type PasLecture } from './lecture';

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

const noeud = (id: string, primitiveId: string | null, x: number, y: number) => ({ id, primitiveId, x, y });
const lien = (de: string, sortie: 'ok' | 'echec', vers: string) => ({ id: `${de}-${sortie}-${vers}`, de, sortie, vers });

export const MISSIONS_ESSAI: Record<'longue' | 'courte', Mission> = {
  longue: {
    id: 'essai-longue', nom: 'Vider la table dans le bac', description: '', robotId: 'r1', repetitions: 3, etat: 'en_cours', modifieeLe: '',
    noeuds: [noeud('depart', null, 0, 100), noeud('n1', 'table', 250, 100), noeud('n2', 'prise', 520, 100), noeud('n3', 'bac', 800, 0),
      noeud('n4', 'depose', 1080, 0), noeud('n5', 'rentrer', 800, 230), noeud('n6', 'base', 1080, 230)],
    liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n2', 'ok', 'n3'), lien('n3', 'ok', 'n4'),
      lien('n2', 'echec', 'n5'), lien('n5', 'ok', 'n6')],
  },
  courte: {
    id: 'essai-courte', nom: 'Prendre et déposer', description: '', robotId: 'r1', repetitions: 4, etat: 'en_cours', modifieeLe: '',
    noeuds: [noeud('depart', null, 0, 80), noeud('n1', 'prise', 250, 80), noeud('n2', 'depose', 520, 0), noeud('n3', 'rentrer', 520, 190)],
    liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n1', 'echec', 'n3')],
  },
};

/** La durée d'une étape simulée, par type de primitive (s) ; elle varie d'un tour à l'autre. */
const DUREE: Record<TypePrimitive, number> = { deplacer: 14, prise_objet: 18, prise_boite: 20, depose: 11, rentrer: 6 };

/** Pourquoi une étape simulée rate, par type de primitive. */
const CAUSES: Record<TypePrimitive, string> = {
  deplacer: 'chemin bloqué', prise_objet: 'aucune prise atteignable', prise_boite: 'poignées introuvables', depose: 'bac B introuvable',
  rentrer: 'bras en butée',
};

/** Les messages que l'opérateur peut provoquer depuis la page d'essai. */
const AVERTISSEMENT = 'Relocalisation faible : qualité 41 %. La mission continue.';
const PANNE = 'Bras droit : plus de réponse depuis 2,5 s. La mission s’arrête.';

/** Après une mission réussie, elle reprend depuis le début au bout de ce temps (s, temps réel). */
const REPRISE_S = 6;
/** Un avertissement reste affiché ce temps-là (s, temps réel). */
const AVERTISSEMENT_S = 8;

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
  fin: 'reussie' | 'erreur' | null;
  attente: number;
  message: MessageLecture | null;
  /** Le temps qu'il reste à un avertissement (s, temps réel). */
  messageReste: number;
}

type Action = { type: 'tick'; reelS: number; vitesse: number }
  | { type: 'pause' | 'rater' | 'urgence' | 'rearmer' | 'avertir' | 'planter' | 'acquitter' };

const primitiveDe = (m: Mission, id: string) => PRIMITIVES.find((p) => p.id === m.noeuds.find((n) => n.id === id)?.primitiveId);

/** Un nombre entre 0 et 1, toujours le même pour le même texte : la durée d'une étape varie d'un tour à l'autre. */
function hachage(texte: string): number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const dureeEtape = (m: Moteur, id: string) => DUREE[primitiveDe(m.mission, id)?.type ?? 'deplacer'] * (0.8 + 0.45 * hachage(`${id}:${m.tour}:${m.passe.length}`));
const cle = (tour: number, index: number, id: string) => `${tour}:${index}:${id}`;

function demarrer(mission: Mission): Moteur {
  return {
    mission, t: 0, tour: 1, passe: [], noeud: suivant(mission, 'depart', 'ok') ?? null, par: 'ok', debut: 0,
    enPause: false, urgence: false, fin: null, attente: 0, message: null, messageReste: 0,
  };
}

const avertir = (m: Moteur, texte: string): Moteur => ({ ...m, message: { niveau: 'attention', texte }, messageReste: AVERTISSEMENT_S });

/**
 * L'étape en cours se termine à `finS`, réussie ou ratée ; la mission prend la sortie qui suit, ou change de tour.
 * Une étape ratée que sa branche « échec » rattrape est un avertissement ; sans branche, ou sur une `panne`, c'est une
 * erreur qui arrête la mission.
 */
function terminer(m: Moteur, finS: number, rate: boolean, panne?: string): Moteur {
  const id = m.noeud!;
  const prim = primitiveDe(m.mission, id);
  const fait: PasLecture = { cle: cle(m.tour, m.passe.length, id), noeud: id, issue: rate ? 'echoue' : 'reussi', par: m.par, tour: m.tour };
  const sortie = rate ? 'echec' : 'ok';
  const vers = panne ? undefined : suivant(m.mission, id, sortie);
  const base = { ...m, passe: [...m.passe, fait], debut: finS };
  const rateTexte = `« ${prim?.nom} » a raté : ${CAUSES[prim?.type ?? 'deplacer']}.`;
  if (vers) return rate ? avertir({ ...base, noeud: vers, par: sortie }, `${rateTexte} La mission prend sa branche échec.`) : { ...base, noeud: vers, par: sortie };
  if (rate) return { ...base, t: finS, noeud: null, fin: 'erreur', message: { niveau: 'erreur', texte: panne ?? `${rateTexte} Pas de branche échec : la mission s’arrête.` } };
  if (m.tour < m.mission.repetitions) return { ...base, tour: m.tour + 1, noeud: suivant(m.mission, 'depart', 'ok') ?? null, par: 'ok' };
  const tours = m.mission.repetitions > 1 ? `${m.mission.repetitions} tours` : 'la mission';
  return { ...base, t: finS, noeud: null, fin: 'reussie', message: { niveau: 'succes', texte: `Terminée : ${tours} en ${duree(finS)}.` } };
}

function reduire(m: Moteur, a: Action): Moteur {
  switch (a.type) {
    case 'pause': return m.fin || m.urgence ? m : { ...m, enPause: !m.enPause };
    case 'urgence': return m.fin ? m : { ...m, urgence: true };
    case 'rearmer': return demarrer(m.mission);
    case 'rater': return m.noeud && !m.urgence ? terminer(m, m.t, true) : m;
    case 'avertir': return m.fin || m.urgence ? m : avertir(m, AVERTISSEMENT);
    case 'planter': return m.noeud && !m.urgence ? terminer(m, m.t, true, PANNE) : m;
    case 'acquitter': return m.fin === 'erreur' ? demarrer(m.mission) : { ...m, message: m.fin ? m.message : null };
    case 'tick': {
      if (m.fin === 'reussie') return m.attente + a.reelS > REPRISE_S ? demarrer(m.mission) : { ...m, attente: m.attente + a.reelS };
      const n = m.message?.niveau !== 'attention' ? m
        : m.messageReste > a.reelS ? { ...m, messageReste: m.messageReste - a.reelS } : { ...m, message: null, messageReste: 0 };
      if (n.fin || n.enPause || n.urgence || !n.noeud) return n;
      const t = n.t + a.reelS * a.vitesse;
      const d = dureeEtape(n, n.noeud);
      if (t - n.debut < d) return { ...n, t };
      const rate = n.tour === 2 && primitiveDe(n.mission, n.noeud)?.type === 'prise_objet';
      return terminer({ ...n, t }, n.debut + d, rate);
    }
  }
}

/** Ce que la barre montre du moteur : le passé, l'étape en cours, la suite prévue. */
function lire(m: Moteur): Lecture {
  const pas = [...m.passe];
  let courant = -1;
  if (m.noeud) {
    courant = pas.length;
    pas.push({ cle: cle(m.tour, pas.length, m.noeud), noeud: m.noeud, issue: 'cours', par: m.par, tour: m.tour });
    const vus = new Set([...m.passe.filter((p) => p.tour === m.tour).map((p) => p.noeud), m.noeud]);
    for (const id of prevus(m.mission, m.noeud, vus)) pas.push({ cle: cle(m.tour, pas.length, id), noeud: id, issue: 'prevu', par: 'ok', tour: m.tour });
  }
  return {
    mission: m.mission, primitives: PRIMITIVES, pas, courant, dureeS: m.t, dureeEtapeS: m.noeud ? m.t - m.debut : 0,
    tour: m.tour, tours: m.mission.repetitions, etat: m.urgence ? 'urgence' : m.fin ?? (m.enPause ? 'pause' : 'cours'),
    message: m.urgence ? MESSAGE_URGENCE : m.message,
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
    avertir: () => envoyer({ type: 'avertir' }),
    planter: () => envoyer({ type: 'planter' }),
    acquitter: () => envoyer({ type: 'acquitter' }),
  };
}
