/**
 * Une mission qui joue, simulée pour les pages d'essai de la barre de lecture. Trois missions au format de l'API :
 * celle du prototype de l'éditeur (une boucle sur les pièces, une condition, deux appels à l'opérateur, une prise qui
 * rate), une longue (une branche « échec ») et une courte. La pause, le pas à pas, l'arrêt par l'opérateur, l'arrêt
 * d'urgence, un avertissement qui n'arrête rien et une erreur qui arrête tout. Le temps est accéléré.
 */
import { useEffect, useReducer } from 'react';
import type { Mission, NoeudMission, Primitive, TypePrimitive } from '../../api/types';
import { duree } from '../executions/donnees';
import type { Sortie } from '../missions/charte';
import { grapheDe } from './direct';
import { MESSAGE_URGENCE, prevus, suivant, type GrapheLecture, type Lecture, type MessageLecture, type PasLecture } from './lecture';

/** Ce que l'étape décide en finissant : la sortie qu'elle prend, ou qu'elle rate. */
interface Regle { sortie?: Sortie; rate?: boolean }

/** Une mission de la page d'essai : la mission de l'API, son graphe, et ce que chaque nœud est et décide. */
export interface MissionEssai {
  mission: Mission;
  graphe: GrapheLecture;
  repetitions: number;
  /** Le genre de chaque nœud (la clé du catalogue, ou le type de la primitive) : sa durée et sa cause d'échec. */
  genres: Record<string, string>;
  /** Ce que l'opérateur doit faire, pour les nœuds qui l'appellent. */
  appels: Record<string, string>;
}

const primitive = (id: string, nom: string, type: TypePrimitive): Primitive => ({
  id, nom, type, description: '', objet: null, ancrage: null, poste: null, vitesse: 1, creeLe: '', creePar: '',
  tauxReussite: null, executions: 0,
});

export const PRIMITIVES_ESSAI = [
  primitive('table', 'Aller à la table', 'deplacer'),
  primitive('prise', 'Prendre la pièce Novares', 'prise_objet'),
  primitive('bac', 'Aller au bac B', 'deplacer'),
  primitive('depose', 'Déposer dans le bac B', 'depose'),
  primitive('rentrer', 'Rentrer les bras', 'rentrer'),
  primitive('base', 'Retour à la base', 'deplacer'),
];

const noeud = (id: string, primitiveId: string | null, x: number, y: number): NoeudMission => ({ id, primitiveId, x, y });
const logique = (id: string, type: string, valeurs: Record<string, string | number>, x: number, y: number): NoeudMission => ({
  id, primitiveId: null, type, valeurs, x, y,
});
const lien = (de: string, sortie: Mission['liens'][number]['sortie'], vers: string) => ({ id: `${de}-${sortie}-${vers}`, de, sortie, vers });
const mission = (id: string, nom: string, repetitions: number, noeuds: NoeudMission[], liens: Mission['liens']): Mission => ({
  id, nom, description: '', robotId: 'r1', repetitions, etat: 'en_cours', modifieeLe: '', noeuds, liens,
});

/** L'écart entre deux colonnes et deux rangées de la mission du prototype, sur le canevas de l'éditeur. */
const COLONNE = 260;
const RANGEE = 120;
const c = (n: number) => n * COLONNE;

/**
 * La mission du prototype de l'éditeur : pour chaque pièce sur la table, si le bac est plein, appeler l'opérateur ;
 * prendre la pièce (deux essais), la poser, compter, et revenir à la boucle ; une pièce imprenable appelle l'opérateur,
 * puis la boucle passe à la suivante. Quand il n'en reste plus : rentrer les bras, aller à la base, terminer.
 */
const PROTOTYPE = mission('essai-prototype', 'Vider la table, en boucle', 1, [
  noeud('depart', null, c(0), 200),
  noeud('aller', 'table', c(1), 200),
  logique('boucle', 'pour_chaque', { objet: 'pièce', zone: 'la table' }, c(2), 200),
  logique('si', 'si', { condition: 'bac plein' }, c(3), 212),
  logique('appel_bac', 'demander', { message: 'Videz le bac' }, c(4), 200 - RANGEE),
  noeud('prendre', 'prise', c(5), 212),
  noeud('poser', 'depose', c(6), 200),
  logique('compter', 'compteur', { variable: 'déposées', pas: 1 }, c(7), 200),
  logique('appel_prise', 'demander', { message: 'Retirez la pièce' }, c(6), 200 + 1.6 * RANGEE),
  noeud('rentrer', 'rentrer', c(3), 200 - 2.3 * RANGEE),
  noeud('base', 'base', c(4), 200 - 2.3 * RANGEE),
  logique('fin', 'terminer', { verdict: 'réussie' }, c(5), 200 - 2.3 * RANGEE),
], [
  lien('depart', 'ok', 'aller'), lien('aller', 'ok', 'boucle'), lien('boucle', 'faire', 'si'), lien('si', 'alors', 'appel_bac'),
  lien('appel_bac', 'ok', 'prendre'), lien('si', 'sinon', 'prendre'), lien('prendre', 'ok', 'poser'), lien('poser', 'ok', 'compter'),
  lien('compter', 'suite', 'boucle'), lien('prendre', 'echec', 'appel_prise'), lien('appel_prise', 'ok', 'boucle'),
  lien('boucle', 'fini', 'rentrer'), lien('rentrer', 'ok', 'base'), lien('base', 'ok', 'fin'),
]);

const LONGUE = mission('essai-longue', 'Vider la table dans le bac', 3, [
  noeud('depart', null, 0, 100), noeud('n1', 'table', 250, 100), noeud('n2', 'prise', 520, 100), noeud('n3', 'bac', 800, 0),
  noeud('n4', 'depose', 1080, 0), noeud('n5', 'rentrer', 800, 230), noeud('n6', 'base', 1080, 230),
], [
  lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n2', 'ok', 'n3'), lien('n3', 'ok', 'n4'), lien('n2', 'echec', 'n5'),
  lien('n5', 'ok', 'n6'),
]);

const COURTE = mission('essai-courte', 'Prendre et déposer', 4, [
  noeud('depart', null, 0, 80), noeud('n1', 'prise', 250, 80), noeud('n2', 'depose', 520, 0), noeud('n3', 'rentrer', 520, 190),
], [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n1', 'echec', 'n3')]);

/** Une mission de l'API, prête pour la simulation. */
function essai(m: Mission): MissionEssai {
  const genres = Object.fromEntries(m.noeuds.map((n) => [n.id, n.type ?? PRIMITIVES_ESSAI.find((p) => p.id === n.primitiveId)?.type ?? 'declencheur']));
  const appels = Object.fromEntries(m.noeuds.filter((n) => n.type === 'demander').map((n) => [n.id, String(n.valeurs?.message ?? '').toLowerCase()]));
  return { mission: m, graphe: grapheDe(m, PRIMITIVES_ESSAI), repetitions: m.repetitions, genres, appels };
}

export const MISSIONS_ESSAI = { prototype: essai(PROTOTYPE), longue: essai(LONGUE), courte: essai(COURTE) };

/** Les nœuds de boucle : « faire » tant qu'il reste des pièces, puis « fini ». */
const BOUCLES = ['pour_chaque', 'pour', 'repeter', 'tant_que'];
/** Combien de pièces une boucle simulée trouve sur la table. */
const PIECES = 3;

/**
 * La règle d'un nœud qui finit, à sa `visite`-ième fois dans le tour : une boucle fait « faire » trois fois puis
 * « fini » ; une condition est vraie à la deuxième pièce ; une prise rattrapée par une sortie « échec » rate à la
 * dernière pièce d'une boucle, ou au deuxième tour d'une mission sans boucle. Le reste réussit par « ok » ou « suite ».
 */
function regle(m: MissionEssai, id: string, visite: number, tour: number): Regle {
  const genre = m.genres[id];
  if (BOUCLES.includes(genre)) return { sortie: visite <= PIECES ? 'faire' : 'fini' };
  if (genre === 'si') return { sortie: visite === 2 ? 'alors' : 'sinon' };
  const rattrapee = m.mission.liens.some((l) => l.de === id && l.sortie === 'echec');
  const boucle = Object.values(m.genres).some((g) => BOUCLES.includes(g));
  return { rate: genre === 'prise_objet' && rattrapee && (boucle ? visite === PIECES : tour === 2 && visite === 1) };
}

/** La durée d'une étape simulée, par genre de nœud (s) ; elle varie d'un tour à l'autre. */
const DUREE: Record<string, number> = {
  deplacer: 14, prise_objet: 18, prise_boite: 20, depose: 11, depose_objet: 11, rentrer: 6, demander: 9, si: 2.5,
  pour_chaque: 2, compteur: 2, terminer: 1.5,
};

/** Pourquoi une étape simulée rate, par genre de nœud. */
const CAUSES: Record<string, string> = {
  deplacer: 'chemin bloqué', prise_objet: 'aucune prise atteignable', prise_boite: 'poignées introuvables', depose: 'bac B introuvable',
  depose_objet: 'bac B introuvable', rentrer: 'bras en butée', demander: 'personne n’a répondu',
};

/** Les messages que l'opérateur peut provoquer depuis la page d'essai. */
const AVERTISSEMENT = 'Relocalisation faible : qualité 41 %. La mission continue.';
const PANNE = 'Bras droit : plus de réponse depuis 2,5 s. La mission s’arrête.';

/** Après une mission réussie ou arrêtée, elle reprend depuis le début au bout de ce temps (s, temps réel). */
const REPRISE_S = 6;
/** Un avertissement reste affiché ce temps-là (s, temps réel). */
const AVERTISSEMENT_S = 8;

interface Moteur {
  mission: MissionEssai;
  t: number;
  tour: number;
  passe: PasLecture[];
  noeud: string | null;
  par: Sortie;
  debut: number;
  /** Combien de fois chaque nœud a été atteint dans ce tour. */
  visites: Record<string, number>;
  enPause: boolean;
  /** Le pas à pas : la mission se met en pause à la fin de chaque étape. */
  pasAPas: boolean;
  urgence: boolean;
  fin: 'reussie' | 'erreur' | 'arretee' | null;
  attente: number;
  message: MessageLecture | null;
  /** Le temps qu'il reste à un avertissement (s, temps réel) ; un appel à l'opérateur dure, lui, tant que l'étape. */
  messageReste: number;
}

type Action = { type: 'tick'; reelS: number; vitesse: number }
  | { type: 'pause' | 'rater' | 'urgence' | 'rearmer' | 'avertir' | 'planter' | 'acquitter' | 'arreter' | 'etape' };

/** Un nombre entre 0 et 1, toujours le même pour le même texte : la durée d'une étape varie d'un tour à l'autre. */
function hachage(texte: string): number {
  let h = 2166136261;
  for (const ch of texte) h = Math.imul(h ^ ch.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const genre = (m: Moteur, id: string) => m.mission.genres[id] ?? 'deplacer';
const nom = (m: Moteur, id: string) => m.mission.graphe.noeuds.find((n) => n.id === id)?.nom ?? id;
const dureeEtape = (m: Moteur, id: string) => (DUREE[genre(m, id)] ?? 5) * (0.8 + 0.45 * hachage(`${id}:${m.tour}:${m.passe.length}`));
const cle = (tour: number, index: number, id: string) => `${tour}:${index}:${id}`;
/** Le premier lien d'un tour : celui qui part du départ. */
const premier = (g: GrapheLecture) => g.liens.find((l) => l.de === 'depart');
/** La sortie que prend un nœud qui réussit sans règle : « ok » ou « suite », sinon la première reliée. */
const sortieParDefaut = (g: GrapheLecture, id: string) =>
  g.liens.find((l) => l.de === id && (l.sortie === 'ok' || l.sortie === 'suite'))?.sortie ?? g.liens.find((l) => l.de === id && l.sortie !== 'echec')?.sortie;

/** Le moteur entre dans un nœud : il le compte, et un nœud qui appelle l'opérateur le dit tant qu'il dure. */
function entrer(m: Moteur, id: string, par: Sortie): Moteur {
  const appel = m.mission.appels[id];
  const n = { ...m, noeud: id, par, visites: { ...m.visites, [id]: (m.visites[id] ?? 0) + 1 } };
  return appel ? { ...n, message: { niveau: 'attention', texte: `La mission attend l’opérateur : ${appel}.` }, messageReste: Infinity } : n;
}

function demarrer(mission: MissionEssai, pasAPas = false): Moteur {
  const p = premier(mission.graphe);
  const m: Moteur = {
    mission, t: 0, tour: 1, passe: [], noeud: null, par: 'suite', debut: 0, visites: {}, enPause: false, pasAPas,
    urgence: false, fin: null, attente: 0, message: null, messageReste: 0,
  };
  return p ? entrer(m, p.vers, p.sortie) : m;
}

const avertir = (m: Moteur, texte: string): Moteur => ({ ...m, message: { niveau: 'attention', texte }, messageReste: AVERTISSEMENT_S });

/**
 * L'étape en cours se termine à `finS` : réussie par `sortie`, ou ratée. La mission prend la sortie qui suit, ou
 * change de tour ; en pas à pas, elle se met en pause sur l'étape suivante. Une étape ratée que sa branche « échec »
 * rattrape est un avertissement ; sans branche, ou sur une `panne`, c'est une erreur qui arrête la mission.
 */
function terminer(m: Moteur, finS: number, rate: boolean, sortie?: Sortie, panne?: string): Moteur {
  const id = m.noeud!;
  const g = m.mission.graphe;
  const fait: PasLecture = { cle: cle(m.tour, m.passe.length, id), noeud: id, issue: rate ? 'echoue' : 'reussi', par: m.par, tour: m.tour };
  const prise = rate ? 'echec' : sortie ?? sortieParDefaut(g, id);
  const vers = panne || !prise ? undefined : suivant(g, id, prise);
  const appelEnCours = m.message?.niveau === 'attention' && m.messageReste === Infinity;
  const base = { ...m, passe: [...m.passe, fait], debut: finS, enPause: m.pasAPas, ...(appelEnCours ? { message: null, messageReste: 0 } : {}) };
  const rateTexte = `« ${nom(m, id)} » a raté : ${CAUSES[genre(m, id)] ?? 'erreur du robot'}.`;
  if (vers && prise) {
    const suite = entrer(base, vers, prise);
    if (!rate) return suite;
    return avertir(suite, `${rateTexte} ${m.mission.appels[vers] ? 'La mission appelle l’opérateur.' : 'La mission prend sa branche échec.'}`);
  }
  if (rate) return { ...base, t: finS, noeud: null, enPause: false, fin: 'erreur', message: { niveau: 'erreur', texte: panne ?? `${rateTexte} Pas de branche échec : la mission s’arrête.` } };
  const p = premier(g);
  if (m.tour < m.mission.repetitions && p) return entrer({ ...base, tour: m.tour + 1, visites: {} }, p.vers, p.sortie);
  const tours = m.mission.repetitions > 1 ? `${m.mission.repetitions} tours` : 'la mission';
  return { ...base, t: finS, noeud: null, enPause: false, fin: 'reussie', message: { niveau: 'succes', texte: `Terminée : ${tours} en ${duree(finS)}.` } };
}

/** L'opérateur arrête la mission : l'étape en cours s'interrompt, rien n'est en faute. */
function arreter(m: Moteur): Moteur {
  if (!m.noeud || m.fin || m.urgence) return m;
  const fait: PasLecture = { cle: cle(m.tour, m.passe.length, m.noeud), noeud: m.noeud, issue: 'echoue', par: m.par, tour: m.tour };
  return {
    ...m, passe: [...m.passe, fait], noeud: null, enPause: false, fin: 'arretee', attente: 0,
    message: { niveau: 'neutre', texte: `Arrêtée par l’opérateur à « ${nom(m, m.noeud)} ».` },
  };
}

function reduire(m: Moteur, a: Action): Moteur {
  switch (a.type) {
    case 'pause': return m.fin || m.urgence ? m : m.enPause ? { ...m, enPause: false, pasAPas: false } : { ...m, enPause: true };
    case 'etape': return m.fin || m.urgence ? m : { ...m, enPause: false, pasAPas: true };
    case 'arreter': return arreter(m);
    case 'urgence': return m.fin ? m : { ...m, urgence: true };
    case 'rearmer': return demarrer(m.mission, m.pasAPas);
    case 'rater': return m.noeud && !m.urgence ? terminer(m, m.t, true) : m;
    case 'avertir': return m.fin || m.urgence ? m : avertir(m, AVERTISSEMENT);
    case 'planter': return m.noeud && !m.urgence ? terminer(m, m.t, true, undefined, PANNE) : m;
    case 'acquitter': return m.fin === 'erreur' ? demarrer(m.mission, m.pasAPas) : { ...m, message: m.fin ? m.message : null };
    case 'tick': {
      if (m.fin === 'reussie' || m.fin === 'arretee') {
        return m.attente + a.reelS > REPRISE_S ? demarrer(m.mission, m.pasAPas) : { ...m, attente: m.attente + a.reelS };
      }
      const n = m.message?.niveau !== 'attention' ? m
        : m.messageReste > a.reelS ? { ...m, messageReste: m.messageReste - a.reelS } : { ...m, message: null, messageReste: 0 };
      if (n.fin || n.enPause || n.urgence || !n.noeud) return n;
      const t = n.t + a.reelS * a.vitesse;
      const d = dureeEtape(n, n.noeud);
      if (t - n.debut < d) return { ...n, t };
      const r = regle(n.mission, n.noeud, n.visites[n.noeud] ?? 1, n.tour);
      return terminer({ ...n, t }, n.debut + d, r.rate ?? false, r.sortie);
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
    for (const s of prevus(m.mission.graphe, m.noeud, new Set([m.noeud]))) {
      pas.push({ cle: cle(m.tour, pas.length, s.noeud), noeud: s.noeud, issue: 'prevu', par: s.par, tour: m.tour });
    }
  }
  return {
    mission: m.mission.graphe, pas, courant, dureeS: m.t, dureeEtapeS: m.noeud ? m.t - m.debut : 0,
    tour: m.tour, tours: m.mission.repetitions, etat: m.urgence ? 'urgence' : m.fin ?? (m.enPause ? 'pause' : 'cours'),
    message: m.urgence ? MESSAGE_URGENCE : m.message, pasAPas: m.pasAPas,
  };
}

/** Le pas de la simulation, en temps réel (ms). */
const PAS_MS = 100;

/** La mission simulée qui joue, et les gestes de l'opérateur sur elle. */
export function useScenario(mission: MissionEssai, vitesse: number) {
  const [moteur, envoyer] = useReducer(reduire, mission, (x) => demarrer(x));
  useEffect(() => {
    const t = setInterval(() => envoyer({ type: 'tick', reelS: PAS_MS / 1000, vitesse }), PAS_MS);
    return () => clearInterval(t);
  }, [vitesse]);
  return {
    lecture: lire(moteur),
    /** Pause, ou reprise en continu (le pas à pas s'arrête). */
    pause: () => envoyer({ type: 'pause' }),
    /** Une étape, puis la pause : le pas à pas. */
    etape: () => envoyer({ type: 'etape' }),
    arreter: () => envoyer({ type: 'arreter' }),
    rater: () => envoyer({ type: 'rater' }),
    urgence: () => envoyer({ type: 'urgence' }),
    rearmer: () => envoyer({ type: 'rearmer' }),
    avertir: () => envoyer({ type: 'avertir' }),
    planter: () => envoyer({ type: 'planter' }),
    acquitter: () => envoyer({ type: 'acquitter' }),
  };
}
