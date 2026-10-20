import type { Api } from './client';
import type { Mission, Primitive, Robot, Run } from './types';

const CLE = 'mpc.front.simulation.v1';
const LATENCE_MS = 120;

interface Magasin {
  robots: Robot[];
  primitives: Primitive[];
  missions: Mission[];
  runs: Run[];
}

const ilYA = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function graine(): Magasin {
  return {
    robots: [
      {
        id: 'r1', nom: 'G1-D · 01', modele: 'Unitree G1-D', site: 'Atelier A', etat: 'en_mission',
        batterie: 72, posteCourant: 'table', missionCourante: 'm1', derniereConnexion: ilYA(0),
      },
      {
        id: 'r2', nom: 'G1-D · 02', modele: 'Unitree G1-D', site: 'Atelier A', etat: 'disponible',
        batterie: 94, posteCourant: 'base', missionCourante: null, derniereConnexion: ilYA(1),
      },
      {
        id: 'r3', nom: 'G1-D · 03', modele: 'Unitree G1-D', site: 'Atelier B', etat: 'en_charge',
        batterie: 31, posteCourant: 'dock', missionCourante: null, derniereConnexion: ilYA(4),
      },
      {
        id: 'r4', nom: 'G1-D · 04', modele: 'Unitree G1-D', site: 'Atelier B', etat: 'hors_ligne',
        batterie: 0, posteCourant: null, missionCourante: null, derniereConnexion: ilYA(60 * 26),
      },
    ],
    primitives: [
      {
        id: 'p1', nom: 'Prendre la pièce Novares', type: 'prise_objet',
        description: 'Prise montrée une fois au bras, retrouvée par sa signature visuelle.',
        objet: 'Pièce Novares', ancrage: null, poste: null, vitesse: 1, creeLe: ilYA(60 * 24 * 3),
        creePar: 'Thomas', tauxReussite: 0.78, executions: 41,
      },
      {
        id: 'p2', nom: 'Déposer dans le bac B', type: 'depose',
        description: 'Pose la pièce tenue dans le bac repéré par ses étiquettes.',
        objet: null, ancrage: 'boite', poste: null, vitesse: 1, creeLe: ilYA(60 * 24 * 3),
        creePar: 'Thomas', tauxReussite: 0.93, executions: 32,
      },
      {
        id: 'p3', nom: 'Prendre le bac par ses poignées', type: 'prise_boite',
        description: 'Saisie à deux mains, par les poignées du bac.',
        objet: 'Bac Novares', ancrage: null, poste: null, vitesse: 0.8, creeLe: ilYA(60 * 24 * 9),
        creePar: 'Bilal', tauxReussite: 0.85, executions: 13,
      },
      {
        id: 'p4', nom: 'Aller à la table', type: 'deplacer',
        description: 'La base roule jusqu’au poste « table ».',
        objet: null, ancrage: null, poste: 'table', vitesse: 1, creeLe: ilYA(60 * 24 * 12),
        creePar: 'Thomas', tauxReussite: 1, executions: 57,
      },
      {
        id: 'p5', nom: 'Rentrer les bras', type: 'rentrer',
        description: 'Ramène les bras en garde, prêts à rouler.',
        objet: null, ancrage: null, poste: null, vitesse: 1, creeLe: ilYA(60 * 24 * 12),
        creePar: 'Thomas', tauxReussite: null, executions: 0,
      },
    ],
    missions: [
      {
        id: 'm1', nom: 'Vider la table dans le bac', description: 'Prend les pièces une à une et les dépose au bac B.',
        etapes: [
          { id: 'e1', primitiveId: 'p4' }, { id: 'e2', primitiveId: 'p1' },
          { id: 'e3', primitiveId: 'p2' }, { id: 'e4', primitiveId: 'p5' },
        ],
        robotId: 'r1', repetitions: 6, etat: 'en_cours', modifieeLe: ilYA(90),
      },
      {
        id: 'm2', nom: 'Déplacer le bac', description: 'Porte le bac de la table au poste d’expédition.',
        etapes: [{ id: 'e5', primitiveId: 'p3' }, { id: 'e6', primitiveId: 'p4' }],
        robotId: null, repetitions: 1, etat: 'brouillon', modifieeLe: ilYA(60 * 20),
      },
    ],
    runs: [
      { id: 'u1', missionId: 'm1', robotId: 'r1', debut: ilYA(14), dureeS: 38, issue: 'reussi', cause: null },
      { id: 'u2', missionId: 'm1', robotId: 'r1', debut: ilYA(16), dureeS: 51, issue: 'echoue', cause: 'Aucune prise atteignable' },
      { id: 'u3', missionId: 'm1', robotId: 'r1', debut: ilYA(19), dureeS: 36, issue: 'reussi', cause: null },
      { id: 'u4', missionId: 'm1', robotId: 'r2', debut: ilYA(60 * 5), dureeS: 41, issue: 'reussi', cause: null },
      { id: 'u5', missionId: 'm2', robotId: 'r3', debut: ilYA(60 * 30), dureeS: 12, issue: 'interrompu', cause: 'Arrêt d’urgence' },
    ],
  };
}

function charger(): Magasin {
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) return JSON.parse(brut) as Magasin;
  } catch {
    // Stockage indisponible : on repart de la graine.
  }
  return graine();
}

const magasin = charger();

function sauver(): void {
  try {
    localStorage.setItem(CLE, JSON.stringify(magasin));
  } catch {
    // Stockage indisponible : l'état ne vit que pendant la session.
  }
}

function plusTard<T>(valeur: T): Promise<T> {
  return new Promise((ok) => setTimeout(() => ok(structuredClone(valeur)), LATENCE_MS));
}

const nouvelId = (prefixe: string) => `${prefixe}${Date.now().toString(36)}${Math.random().toString(36).slice(2, 6)}`;

/** Réinitialise les données simulées. */
export function reinitialiserSimulation(): void {
  Object.assign(magasin, graine());
  sauver();
}

export const apiSimulee: Api = {
  robots: () => plusTard(magasin.robots),
  robot: (id) => plusTard(magasin.robots.find((r) => r.id === id)),
  arretUrgence: (robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    if (!r) return Promise.reject(new Error('Robot inconnu'));
    r.etat = 'arret_urgence';
    r.missionCourante = null;
    sauver();
    return plusTard(r);
  },

  primitives: () => plusTard(magasin.primitives),
  primitive: (id) => plusTard(magasin.primitives.find((p) => p.id === id)),
  creerPrimitive: (p) => {
    const cree: Primitive = {
      id: nouvelId('p'), nom: p.nom, type: p.type, description: p.description, objet: p.objet,
      ancrage: p.ancrage, poste: p.poste, vitesse: p.vitesse, creeLe: new Date().toISOString(),
      creePar: 'Moi', tauxReussite: null, executions: 0,
    };
    magasin.primitives.unshift(cree);
    sauver();
    return plusTard(cree);
  },
  supprimerPrimitive: (id) => {
    magasin.primitives = magasin.primitives.filter((p) => p.id !== id);
    sauver();
    return plusTard(undefined);
  },

  missions: () => plusTard(magasin.missions),
  mission: (id) => plusTard(magasin.missions.find((m) => m.id === id)),
  enregistrerMission: (m) => {
    const copie = { ...m, id: m.id || nouvelId('m'), modifieeLe: new Date().toISOString() };
    const i = magasin.missions.findIndex((x) => x.id === copie.id);
    if (i >= 0) magasin.missions[i] = copie;
    else magasin.missions.unshift(copie);
    sauver();
    return plusTard(copie);
  },
  supprimerMission: (id) => {
    magasin.missions = magasin.missions.filter((m) => m.id !== id);
    sauver();
    return plusTard(undefined);
  },
  lancerMission: (missionId, robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    const m = magasin.missions.find((x) => x.id === missionId);
    if (!r || !m) return Promise.reject(new Error('Mission ou robot inconnu'));
    if (r.etat !== 'disponible') return Promise.reject(new Error(`${r.nom} n’est pas disponible`));
    r.etat = 'en_mission';
    r.missionCourante = m.id;
    m.etat = 'en_cours';
    m.robotId = r.id;
    const run: Run = {
      id: nouvelId('u'), missionId, robotId, debut: new Date().toISOString(), dureeS: 0,
      issue: 'reussi', cause: null,
    };
    magasin.runs.unshift(run);
    sauver();
    return plusTard(run);
  },

  runs: (filtre) =>
    plusTard(
      magasin.runs.filter(
        (u) => (!filtre?.robotId || u.robotId === filtre.robotId) && (!filtre?.missionId || u.missionId === filtre.missionId),
      ),
    ),
};
