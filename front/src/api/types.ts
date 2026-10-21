/** Le modèle de données vu par le client final. Le back devra servir ces formes. */

export type EtatRobot = 'disponible' | 'en_mission' | 'hors_ligne' | 'arret_urgence' | 'en_charge';

/** Les bras tenus en position (rigide), ou libres sous compensation de la gravité (mou, on les guide à la main). */
export type ModeBras = 'rigide' | 'mou';

export type Cote = 'gauche' | 'droite';

/** Le geste que le robot est en train de faire sur ordre de la barre, ou null. */
export type GesteRobot = 'home' | 'pince_gauche' | 'pince_droite' | null;

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
  modeBras: ModeBras;
  /** L'ouverture de chaque pince, de 0 (fermée) à 1 (grande ouverte), mesurée. */
  pinces: Record<Cote, number>;
  geste: GesteRobot;
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

/** Un nœud du graphe de mission ; `primitiveId` est null pour le départ. */
export interface NoeudMission {
  id: string;
  primitiveId: string | null;
  x: number;
  y: number;
}

/** La sortie d'un nœud : ce qu'on fait quand la primitive a réussi, ou quand elle a échoué. */
export type Sortie = 'ok' | 'echec';

export interface LienMission {
  id: string;
  de: string;
  sortie: Sortie;
  vers: string;
}

export interface Mission {
  id: string;
  nom: string;
  description: string;
  noeuds: NoeudMission[];
  liens: LienMission[];
  robotId: string | null;
  repetitions: number;
  etat: EtatMission;
  modifieeLe: string;
}

export type IssueRun = 'reussi' | 'echoue' | 'interrompu';

/** Une étape jouée pendant un run : son nœud, quand elle a commencé et combien de temps elle a pris (s), son issue. */
export interface EtapeRun {
  noeud: string;
  debutS: number;
  dureeS: number;
  issue: IssueRun;
  cause: string | null;
}

export interface Run {
  id: string;
  missionId: string;
  robotId: string;
  debut: string;
  dureeS: number;
  issue: IssueRun;
  cause: string | null;
  /** Le détail par étape, dans l'ordre joué ; absent tant que le back ne le sert pas. */
  etapes?: EtapeRun[];
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

/** Le verdict d'un moteur, rendu par le back (la Santé) : le front le peint, il ne le calcule pas. */
export type EtatMoteur = 'ok' | 'chaud' | 'trop_chaud' | 'defaut' | 'inconnu';

/** Un moteur du corps ; `nom` est celui de la Santé du robot (« D épaule tangage », « pince gauche »…). */
export interface Moteur {
  nom: string;
  etat: EtatMoteur;
  temperature: number | null;
  rouge: number | null;
  couple: number | null;
}

export interface EtatCorps {
  moteurs: Moteur[];
  imu: { roulis: number; tangage: number; lacet: number; temperature: number } | null;
  date: string;
}

/** Le verdict d'un élément du HUD : tout va bien, un problème, ou on ne sait pas (pas de nouvelles). */
export type Verdict = 'ok' | 'pb' | 'inconnu';

/** L'état des capteurs de tête, jugé par le back. */
export interface EtatCapteurs {
  camera: Verdict;
  lidar: Verdict;
}

/** Où en est la mission en cours : le chemin joué, l'étape courante et son avancement, la pause. */
export interface Execution {
  missionId: string;
  /** Les nœuds joués dans l'ordre (le départ, puis les primitives qu'on atteint par « réussi »). */
  chemin: string[];
  /** L'index dans `chemin` de l'étape qui se joue, et son avancement de 0 à 1. */
  etape: number;
  avancement: number;
  /** La répétition en cours (à partir de 1) et leur nombre. */
  repetition: number;
  repetitions: number;
  enPause: boolean;
  /** Le temps joué depuis le lancement, pauses retirées (s). */
  dureeS: number;
}
