import type { Mission, NouvellePrimitive, Primitive, Robot, Run } from './types';
import { apiSimulee } from './mock';

/** Le contrat entre le front et le back. Les écrans ne parlent qu'à lui. */
export interface Api {
  robots(): Promise<Robot[]>;
  robot(id: string): Promise<Robot | undefined>;
  arretUrgence(robotId: string): Promise<Robot>;

  primitives(): Promise<Primitive[]>;
  primitive(id: string): Promise<Primitive | undefined>;
  creerPrimitive(p: NouvellePrimitive): Promise<Primitive>;
  supprimerPrimitive(id: string): Promise<void>;

  missions(): Promise<Mission[]>;
  mission(id: string): Promise<Mission | undefined>;
  enregistrerMission(m: Mission): Promise<Mission>;
  supprimerMission(id: string): Promise<void>;
  lancerMission(missionId: string, robotId: string): Promise<Run>;

  runs(filtre?: { robotId?: string; missionId?: string }): Promise<Run[]>;
}

/** Tant qu'aucun back n'est déclaré (VITE_API_URL), le front tourne sur des données simulées. */
export const api: Api = apiSimulee;
export const enSimulation = !import.meta.env.VITE_API_URL;
