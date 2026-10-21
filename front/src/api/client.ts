import type { Cote, EtatCapteurs, EtatCorps, Mission, ModeBras, NouvellePrimitive, Primitive, Robot, Run } from './types';
import { apiSimulee } from './mock';

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

  runs(filtre?: { robotId?: string; missionId?: string }): Promise<Run[]>;
}

/** Tant qu'aucun back n'est déclaré (VITE_API_URL), le front tourne sur des données simulées. */
export const api: Api = apiSimulee;
export const enSimulation = !import.meta.env.VITE_API_URL;

/** Le robot de l'appli : il n'y en a qu'un pour l'instant, le premier que le back connaît. */
export const robotUnique = () => api.robots().then((rs) => rs[0]);
