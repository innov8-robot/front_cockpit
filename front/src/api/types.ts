/** Le modèle de données vu par le client final. Le back devra servir ces formes. */

export type EtatRobot = 'disponible' | 'en_mission' | 'hors_ligne' | 'arret_urgence' | 'en_charge';

export interface Robot {
  id: string;
  nom: string;
  modele: string;
  site: string;
  etat: EtatRobot;
  batterie: number;
  posteCourant: string | null;
  missionCourante: string | null;
  derniereConnexion: string;
}

export type TypePrimitive = 'prise_objet' | 'prise_boite' | 'depose' | 'deplacer' | 'rentrer';

export type Ancrage = 'robot' | 'objet' | 'boite' | 'plan_percu';

export interface Primitive {
  id: string;
  nom: string;
  type: TypePrimitive;
  description: string;
  objet: string | null;
  ancrage: Ancrage | null;
  poste: string | null;
  vitesse: number;
  creeLe: string;
  creePar: string;
  tauxReussite: number | null;
  executions: number;
}

export type EtatMission = 'brouillon' | 'prete' | 'en_cours' | 'terminee' | 'echouee';

export interface EtapeMission {
  id: string;
  primitiveId: string;
}

export interface Mission {
  id: string;
  nom: string;
  description: string;
  etapes: EtapeMission[];
  robotId: string | null;
  repetitions: number;
  etat: EtatMission;
  modifieeLe: string;
}

export type IssueRun = 'reussi' | 'echoue' | 'interrompu';

export interface Run {
  id: string;
  missionId: string;
  robotId: string;
  debut: string;
  dureeS: number;
  issue: IssueRun;
  cause: string | null;
}

export interface NouvellePrimitive {
  nom: string;
  type: TypePrimitive;
  description: string;
  objet: string | null;
  ancrage: Ancrage | null;
  poste: string | null;
  vitesse: number;
  robotId: string;
}
