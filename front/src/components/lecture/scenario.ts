/**
 * Une mission qui joue, simulée pour la page d'essai de la barre de lecture. Trois missions : longue (une branche
 * « échec »), courte, et celle du prototype de l'éditeur (une boucle sur les pièces, une condition, deux appels à
 * l'opérateur, une prise qui rate). La pause, l'arrêt d'urgence, un avertissement qui n'arrête rien et une erreur qui
 * arrête tout. Le temps est accéléré : une étape de 14 s en dure moins de cinq.
 */
import { useEffect, useReducer } from 'react';
import type { Mission, Primitive, TypePrimitive } from '../../api/types';
import { duree } from '../executions/donnees';
import { typeNoeud } from '../missions/catalogue';
import type { Sortie } from '../missions/charte';
import { grapheDe } from './direct';
import { MESSAGE_URGENCE, prevus, suivant, type GrapheLecture, type Lecture, type MessageLecture, type PasLecture } from './lecture';

/** Ce que l'étape décide en finissant : la sortie qu'elle prend, ou qu'elle rate. */
interface Regle { sortie?: Sortie; rate?: boolean }

/** Une mission de la page d'essai : son graphe, ses répétitions, et ce que chaque nœud est et décide. */
export interface MissionEssai {
  graphe: GrapheLecture;
  repetitions: number;
  /** Le genre de chaque nœud (la clé du catalogue, ou le type de la primitive) : sa durée et sa cause d'échec. */
  genres: Record<string, string>;
  /** Ce que l'opérateur doit faire, pour les nœuds qui l'appellent. */
  appels: Record<string, string>;
  /** La règle d'un nœud qui finit, à sa `visite`-ième fois dans le tour ; sans règle, il réussit par « ok » ou « suite ». */
  regle(id: string, genre: string, visite: number, tour: number): Regle;
}

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

/** Une mission de primitives, comme l'API les sert : sa prise rate au deuxième tour. */
function depuisApi(m: Mission): MissionEssai {
  const genres = Object.fromEntries(m.noeuds.map((n) => [n.id, PRIMITIVES.find((p) => p.id === n.primitiveId)?.type ?? 'declencheur']));
  return {
    graphe: grapheDe(m, PRIMITIVES), repetitions: m.repetitions, genres, appels: {},
    regle: (_id, genre, _visite, tour) => (tour === 2 && genre === 'prise_objet' ? { rate: true } : {}),
  };
}

const LONGUE: Mission = {
  id: 'essai-longue', nom: 'Vider la table dans le bac', description: '', robotId: 'r1', repetitions: 3, etat: 'en_cours', modifieeLe: '',
  noeuds: [noeud('depart', null, 0, 100), noeud('n1', 'table', 250, 100), noeud('n2', 'prise', 520, 100), noeud('n3', 'bac', 800, 0),
    noeud('n4', 'depose', 1080, 0), noeud('n5', 'rentrer', 800, 230), noeud('n6', 'base', 1080, 230)],
  liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n2', 'ok', 'n3'), lien('n3', 'ok', 'n4'),
    lien('n2', 'echec', 'n5'), lien('n5', 'ok', 'n6')],
};

const COURTE: Mission = {
  id: 'essai-courte', nom: 'Prendre et déposer', description: '', robotId: 'r1', repetitions: 4, etat: 'en_cours', modifieeLe: '',
  noeuds: [noeud('depart', null, 0, 80), noeud('n1', 'prise', 250, 80), noeud('n2', 'depose', 520, 0), noeud('n3', 'rentrer', 520, 190)],
  liens: [lien('depart', 'ok', 'n1'), lien('n1', 'ok', 'n2'), lien('n1', 'echec', 'n3')],
};

/** L'écart entre deux colonnes et deux rangées de la mission du prototype, sur le canevas de l'éditeur. */
const COLONNE = 260;
const RANGEE = 120;

/**
 * La mission du prototype de l'éditeur : pour chaque pièce sur la table, si le bac est plein, appeler l'opérateur ;
 * prendre la pièce (deux essais), la poser, compter, et revenir à la boucle ; une pièce imprenable appelle l'opérateur,
 * puis la boucle passe à la suivante. Quand il n'en reste plus : rentrer les bras, aller à la base, terminer. Ici, trois
 * pièces : le bac est plein à la deuxième, la troisième ne se prend pas.
 */
function prototype(): MissionEssai {
  const c = (n: number) => n * COLONNE;
  const n = (id: string, cle: string, x: number, y: number, nom: string) => ({ cle, noeud: { id, type: typeNoeud(cle), x, y, nom } });
  const noeuds = [
    n('depart', 'au_lancement', c(0), 200, 'Lancement'),
    n('aller', 'deplacer', c(1), 200, 'Aller à la table'),
    n('boucle', 'pour_chaque', c(2), 200, 'Pour chaque pièce sur la table'),
    n('si', 'si', c(3), 212, 'Le bac est plein ?'),
    n('appel_bac', 'demander', c(4), 200 - RANGEE, 'Opérateur : videz le bac'),
    n('prendre', 'prise_objet', c(5), 212, 'Prendre la pièce (2 essais)'),
    n('poser', 'depose_objet', c(6), 200, 'Poser dans le bac B'),
    n('compter', 'compteur', c(7), 200, 'Compter les pièces déposées'),
    n('appel_prise', 'demander', c(6), 200 + 1.6 * RANGEE, 'Opérateur : retirez la pièce'),
    n('rentrer', 'rentrer', c(3), 200 - 2.3 * RANGEE, 'Rentrer les bras'),
    n('base', 'deplacer', c(4), 200 - 2.3 * RANGEE, 'Aller à la base'),
    n('fin', 'terminer', c(5), 200 - 2.3 * RANGEE, 'Terminer : réussie'),
  ];
  const l = (id: string, de: string, sortie: Sortie, vers: string) => ({ id, de, sortie, vers });
  return {
    graphe: {
      id: 'essai-prototype', nom: 'Vider la table, en boucle',
      noeuds: noeuds.map((x) => x.noeud),
      liens: [
        l('e1', 'depart', 'suite', 'aller'), l('e2', 'aller', 'ok', 'boucle'), l('e3', 'boucle', 'faire', 'si'),
        l('e4', 'si', 'alors', 'appel_bac'), l('e5', 'appel_bac', 'ok', 'prendre'), l('e6', 'si', 'sinon', 'prendre'),
        l('e7', 'prendre', 'ok', 'poser'), l('e8', 'poser', 'ok', 'compter'), l('e9', 'compter', 'suite', 'boucle'),
        l('e10', 'prendre', 'echec', 'appel_prise'), l('e11', 'appel_prise', 'ok', 'boucle'), l('e12', 'boucle', 'fini', 'rentrer'),
        l('e13', 'rentrer', 'ok', 'base'), l('e14', 'base', 'ok', 'fin'),
      ],
    },
    repetitions: 1,
    genres: Object.fromEntries(noeuds.map((x) => [x.noeud.id, x.cle])),
    appels: { appel_bac: 'videz le bac', appel_prise: 'retirez la pièce' },
    regle: (id, _genre, visite) => {
      if (id === 'boucle') return { sortie: visite <= 3 ? 'faire' : 'fini' };
      if (id === 'si') return { sortie: visite === 2 ? 'alors' : 'sinon' };
      if (id === 'prendre') return { rate: visite === 3 };
      return {};
    },
  };
}

export const MISSIONS_ESSAI = { longue: depuisApi(LONGUE), courte: depuisApi(COURTE), prototype: prototype() };

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

/** Après une mission réussie, elle reprend depuis le début au bout de ce temps (s, temps réel). */
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
  urgence: boolean;
  fin: 'reussie' | 'erreur' | null;
  attente: number;
  message: MessageLecture | null;
  /** Le temps qu'il reste à un avertissement (s, temps réel) ; un appel à l'opérateur dure, lui, tant que l'étape. */
  messageReste: number;
}

type Action = { type: 'tick'; reelS: number; vitesse: number }
  | { type: 'pause' | 'rater' | 'urgence' | 'rearmer' | 'avertir' | 'planter' | 'acquitter' };

/** Un nombre entre 0 et 1, toujours le même pour le même texte : la durée d'une étape varie d'un tour à l'autre. */
function hachage(texte: string): number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

const genre = (m: Moteur, id: string) => m.mission.genres[id] ?? 'deplacer';
const nom = (m: Moteur, id: string) => m.mission.graphe.noeuds.find((n) => n.id === id)?.nom ?? id;
const dureeEtape = (m: Moteur, id: string) => (DUREE[genre(m, id)] ?? 5) * (0.8 + 0.45 * hachage(`${id}:${m.tour}:${m.passe.length}`));
const cle = (tour: number, index: number, id: string) => `${tour}:${index}:${id}`;
/** Le premier nœud d'un tour, et la sortie du départ qui y mène. */
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

function demarrer(mission: MissionEssai): Moteur {
  const p = premier(mission.graphe);
  const m: Moteur = {
    mission, t: 0, tour: 1, passe: [], noeud: null, par: 'suite', debut: 0, visites: {},
    enPause: false, urgence: false, fin: null, attente: 0, message: null, messageReste: 0,
  };
  return p ? entrer(m, p.vers, p.sortie) : m;
}

const avertir = (m: Moteur, texte: string): Moteur => ({ ...m, message: { niveau: 'attention', texte }, messageReste: AVERTISSEMENT_S });

/**
 * L'étape en cours se termine à `finS` : réussie par `sortie`, ou ratée. La mission prend la sortie qui suit, ou
 * change de tour. Une étape ratée que sa branche « échec » rattrape est un avertissement ; sans branche, ou sur une
 * `panne`, c'est une erreur qui arrête la mission.
 */
function terminer(m: Moteur, finS: number, rate: boolean, sortie?: Sortie, panne?: string): Moteur {
  const id = m.noeud!;
  const g = m.mission.graphe;
  const fait: PasLecture = { cle: cle(m.tour, m.passe.length, id), noeud: id, issue: rate ? 'echoue' : 'reussi', par: m.par, tour: m.tour };
  const prise = rate ? 'echec' : sortie ?? sortieParDefaut(g, id);
  const vers = panne || !prise ? undefined : suivant(g, id, prise);
  const appelEnCours = m.message?.niveau === 'attention' && m.messageReste === Infinity;
  const base = { ...m, passe: [...m.passe, fait], debut: finS, ...(appelEnCours ? { message: null, messageReste: 0 } : {}) };
  const rateTexte = `« ${nom(m, id)} » a raté : ${CAUSES[genre(m, id)] ?? 'erreur du robot'}.`;
  if (vers && prise) {
    const suite = entrer(base, vers, prise);
    if (!rate) return suite;
    return avertir(suite, `${rateTexte} ${m.mission.appels[vers] ? 'La mission appelle l’opérateur.' : 'La mission prend sa branche échec.'}`);
  }
  if (rate) return { ...base, t: finS, noeud: null, fin: 'erreur', message: { niveau: 'erreur', texte: panne ?? `${rateTexte} Pas de branche échec : la mission s’arrête.` } };
  const p = premier(g);
  if (m.tour < m.mission.repetitions && p) return entrer({ ...base, tour: m.tour + 1, visites: {} }, p.vers, p.sortie);
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
    case 'planter': return m.noeud && !m.urgence ? terminer(m, m.t, true, undefined, PANNE) : m;
    case 'acquitter': return m.fin === 'erreur' ? demarrer(m.mission) : { ...m, message: m.fin ? m.message : null };
    case 'tick': {
      if (m.fin === 'reussie') return m.attente + a.reelS > REPRISE_S ? demarrer(m.mission) : { ...m, attente: m.attente + a.reelS };
      const n = m.message?.niveau !== 'attention' ? m
        : m.messageReste > a.reelS ? { ...m, messageReste: m.messageReste - a.reelS } : { ...m, message: null, messageReste: 0 };
      if (n.fin || n.enPause || n.urgence || !n.noeud) return n;
      const t = n.t + a.reelS * a.vitesse;
      const d = dureeEtape(n, n.noeud);
      if (t - n.debut < d) return { ...n, t };
      const r = n.mission.regle(n.noeud, genre(n, n.noeud), n.visites[n.noeud] ?? 1, n.tour);
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
    message: m.urgence ? MESSAGE_URGENCE : m.message,
  };
}

/** Le pas de la simulation, en temps réel (ms). */
const PAS_MS = 100;

/** La mission simulée qui joue, et les gestes de l'opérateur sur elle. */
export function useScenario(mission: MissionEssai, vitesse: number) {
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
