import type { Cote, EtatCapteurs, EtatCorps, Execution, Mission, ModeBras, NouvellePrimitive, Primitive, Robot, Run } from './types';
import { apiSimulee } from './mock';
import { modeCourant, urlServeur } from './mode';
import { apiReelle } from './reel';

/** Le contrat entre le front et le back. Les écrans ne parlent qu'à lui. */
export interface Api {
  robots(): Promise<Robot[]>;
  robot(id: string): Promise<Robot | undefined>;
  arretUrgence(robotId: string): Promise<Robot>;
  /** Acquitte l'arrêt d'urgence ; au réel, c'est la reconnexion des bras. */
  rearmer(robotId: string): Promise<Robot>;
  /** Les commandes de la barre du robot : refusées (rejet avec la raison) hors ligne ou en arrêt d'urgence. */
  modeBras(robotId: string, mode: ModeBras): Promise<Robot>;
  pince(robotId: string, cote: Cote, ordre: 'ouvrir' | 'fermer'): Promise<Robot>;
  /** Ramène les bras dans la posture de travail. */
  home(robotId: string): Promise<Robot>;
  /** L'état de chaque moteur du corps et l'attitude du torse, avec le verdict de la Santé. */
  etatCorps(robotId: string): Promise<EtatCorps>;
  /** Si la caméra et le lidar de tête envoient des données. */
  etatCapteurs(robotId: string): Promise<EtatCapteurs>;

  primitives(): Promise<Primitive[]>;
  primitive(id: string): Promise<Primitive | undefined>;
  creerPrimitive(p: NouvellePrimitive): Promise<Primitive>;
  supprimerPrimitive(id: string): Promise<void>;

  missions(): Promise<Mission[]>;
  mission(id: string): Promise<Mission | undefined>;
  enregistrerMission(m: Mission): Promise<Mission>;
  supprimerMission(id: string): Promise<void>;
  lancerMission(missionId: string, robotId: string): Promise<Run>;
  /** Arrête la mission en cours du robot : il finit son geste et s'immobilise ; le run est noté interrompu. */
  arreterMission(robotId: string): Promise<Robot>;
  /** La mission en cours du robot et où elle en est ; null s'il n'en joue aucune. */
  execution(robotId: string): Promise<Execution | null>;
  /** Met la mission en pause (le robot finit son mouvement et s'immobilise), ou la reprend. */
  pauseMission(robotId: string, pause: boolean): Promise<Execution | null>;
  /** Le pas à pas : la mission se met en pause à la fin de chaque étape, celle en cours comprise. */
  pasAPas(robotId: string, actif: boolean): Promise<Execution | null>;
  /** En pas à pas et en pause : joue l'étape suivante, puis se remet en pause. */
  etapeSuivante(robotId: string): Promise<Execution | null>;

  runs(filtre?: { robotId?: string; missionId?: string }): Promise<Run[]>;
}

/** La source choisie sur cet appareil (`mode.ts`) : la simulation embarquée, ou le serveur du robot. */
export const enSimulation = modeCourant() === 'simulation';
export const api: Api = enSimulation ? apiSimulee : apiReelle(urlServeur());

/** Le robot de l'appli : il n'y en a qu'un pour l'instant, le premier que le back connaît. */
export const robotUnique = () => api.robots().then((rs) => rs[0]);
