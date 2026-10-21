import type { Api } from './client';
import type { Cote, EtatCapteurs, EtatCorps, Execution, GesteRobot, Mission, Primitive, Robot, Run } from './types';

const CLE = 'mpc.front.simulation.v5';
const LATENCE_MS = 120;
/** La durée simulée d'un geste : le retour en posture de travail, l'ouverture ou la fermeture d'une pince. */
const DUREE_HOME_MS = 2600;
const DUREE_PINCE_MS = 700;
/** Les commandes de la barre dans l'état d'un robot neuf de la graine. */
const COMMANDES = { modeBras: 'rigide' as const, pinces: { gauche: 1, droite: 1 }, geste: null };

interface Magasin {
  robots: Robot[];
  primitives: Primitive[];
  missions: Mission[];
  runs: Run[];
  /** La mission que joue le robot : son lancement, et le temps passé en pause (ms). */
  execution?: { robotId: string; missionId: string; debut: number; pause: number; pauseDepuis: number | null } | null;
}

/** Une primitive simulée dure ce temps (ms). */
const DUREE_ETAPE_MS = 5000;

const ilYA = (minutes: number) => new Date(Date.now() - minutes * 60_000).toISOString();

function graine(): Magasin {
  return {
    robots: [
      {
        id: 'r1', nom: 'Mégatron', modele: 'Unitree G1-D', site: 'Atelier A', etat: 'disponible',
        batterie: 72, posteCourant: 'table', missionCourante: null, derniereConnexion: ilYA(0), ...structuredClone(COMMANDES),
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
        noeuds: [
          { id: 'depart', primitiveId: null, x: 0, y: 120 },
          { id: 'n1', primitiveId: 'p4', x: 250, y: 100 },
          { id: 'n2', primitiveId: 'p1', x: 560, y: 100 },
          { id: 'n3', primitiveId: 'p2', x: 880, y: 30 },
          { id: 'n4', primitiveId: 'p5', x: 880, y: 220 },
        ],
        liens: [
          { id: 'l1', de: 'depart', sortie: 'ok', vers: 'n1' },
          { id: 'l2', de: 'n1', sortie: 'ok', vers: 'n2' },
          { id: 'l3', de: 'n2', sortie: 'ok', vers: 'n3' },
          { id: 'l4', de: 'n2', sortie: 'echec', vers: 'n4' },
        ],
        robotId: 'r1', repetitions: 6, etat: 'prete', modifieeLe: ilYA(90),
      },
      {
        id: 'm2', nom: 'Déplacer le bac', description: 'Porte le bac de la table au poste d’expédition.',
        noeuds: [
          { id: 'depart', primitiveId: null, x: 0, y: 80 },
          { id: 'n5', primitiveId: 'p3', x: 250, y: 60 },
          { id: 'n6', primitiveId: 'p4', x: 560, y: 60 },
        ],
        liens: [
          { id: 'l5', de: 'depart', sortie: 'ok', vers: 'n5' },
          { id: 'l6', de: 'n5', sortie: 'ok', vers: 'n6' },
        ],
        robotId: 'r1', repetitions: 1, etat: 'brouillon', modifieeLe: ilYA(60 * 20),
      },
    ],
    runs: [
      { id: 'u1', missionId: 'm1', robotId: 'r1', debut: ilYA(14), dureeS: 38, issue: 'reussi', cause: null },
      { id: 'u2', missionId: 'm1', robotId: 'r1', debut: ilYA(16), dureeS: 51, issue: 'echoue', cause: 'Aucune prise atteignable' },
      { id: 'u3', missionId: 'm1', robotId: 'r1', debut: ilYA(19), dureeS: 36, issue: 'reussi', cause: null },
      { id: 'u4', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 5), dureeS: 41, issue: 'reussi', cause: null },
      { id: 'u6', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 6), dureeS: 44, issue: 'echoue', cause: 'Pièce glissée pendant la levée' },
      { id: 'u7', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 7), dureeS: 39, issue: 'reussi', cause: null },
      { id: 'u8', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 26), dureeS: 47, issue: 'reussi', cause: null },
      { id: 'u9', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 27), dureeS: 58, issue: 'echoue', cause: 'Aucune prise atteignable' },
      { id: 'u10', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 28), dureeS: 40, issue: 'reussi', cause: null },
      { id: 'u11', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 50), dureeS: 33, issue: 'echoue', cause: 'Bac B introuvable' },
      { id: 'u12', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 51), dureeS: 42, issue: 'reussi', cause: null },
      { id: 'u13', missionId: 'm1', robotId: 'r1', debut: ilYA(60 * 74), dureeS: 21, issue: 'interrompu', cause: 'Arrêtée par l’opérateur' },
      { id: 'u5', missionId: 'm2', robotId: 'r1', debut: ilYA(60 * 30), dureeS: 12, issue: 'interrompu', cause: 'Arrêt d’urgence' },
      { id: 'u14', missionId: 'm2', robotId: 'r1', debut: ilYA(60 * 48), dureeS: 26, issue: 'reussi', cause: null },
    ],
  };
}

function charger(): Magasin {
  let m = graine();
  try {
    const brut = localStorage.getItem(CLE);
    if (brut) m = JSON.parse(brut) as Magasin;
  } catch {
    // Stockage indisponible : on repart de la graine.
  }
  // Un geste interrompu par le rechargement de la page ne se terminera jamais : aucun n'est en cours au départ.
  for (const r of m.robots) r.geste = null;
  return m;
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

/** Les seuils de la Santé, copiés du dépôt (scripts/copier-corps.mjs) : le back simulé juge avec eux. */
let seuilsCorps: Promise<Record<string, { jaune: number; rouge: number }>> | null = null;
const lireSeuils = () => (seuilsCorps ??= fetch('robot/corps.json').then((r) => r.json()).then((c) => c.seuils));

/** Température de repos et couple moyen simulés par moteur, de l'ordre de ceux d'un G1-D au travail. */
const REPOS: Record<string, [number, number]> = {
  'D épaule tangage': [58, -3.4], 'D épaule roulis': [54, -1.1], 'D épaule lacet': [49, -0.6], 'D coude': [49, -3.2],
  'D poignet roulis': [42, -0.1], 'D poignet tangage': [41, -1.1], 'D poignet lacet': [40, -0.1], 'pince droite': [40, -0.1],
  'G épaule tangage': [57, 2.5], 'G épaule roulis': [50, 0.7], 'G épaule lacet': [44, 0.8], 'G coude': [48, -2.3],
  'G poignet roulis': [42, -0.1], 'G poignet tangage': [41, -1.2], 'G poignet lacet': [39, -0.1], 'pince gauche': [40, 0],
  'torse lacet': [29, -0.5],
};

async function etatCorpsSimule(robotId: string): Promise<EtatCorps> {
  const seuils = await lireSeuils();
  const r = magasin.robots.find((x) => x.id === robotId);
  const vivant = r && r.etat !== 'hors_ligne';
  const t = Date.now() / 1000;
  const moteurs = Object.entries(REPOS).map(([nom, [temp, couple]], i) => {
    const s = seuils[nom];
    if (!vivant) return { nom, etat: 'inconnu' as const, temperature: null, rouge: s?.rouge ?? null, couple: null };
    // Un bras en mission chauffe un peu ; le couple respire avec le geste.
    const chaleur = r.etat === 'en_mission' ? 4 * (0.5 + 0.5 * Math.sin(t / 40 + i)) : 0;
    const temperature = Math.round(temp + chaleur + Math.sin(t / 7 + i) * 0.6);
    const etat = !s ? 'inconnu' as const : temperature >= s.rouge ? 'trop_chaud' as const : temperature >= s.jaune ? 'chaud' as const : 'ok' as const;
    return { nom, etat, temperature, rouge: s?.rouge ?? null, couple: Math.round((couple + Math.sin(t * 1.3 + i) * 0.4) * 10) / 10 };
  });
  const imu = vivant ? { roulis: 0, tangage: 0, lacet: 0, temperature: 0 } : null;
  return plusTard({ moteurs, imu, date: new Date().toISOString() });
}

/** Le robot `robotId`, s'il peut recevoir un ordre ; sinon le rejet, avec la raison qu'en donnerait la session. */
function commandable(robotId: string): Robot {
  const r = magasin.robots.find((x) => x.id === robotId);
  if (!r) throw new Error('Robot inconnu');
  if (r.etat === 'hors_ligne') throw new Error(`${r.nom} est hors ligne`);
  if (r.etat === 'arret_urgence') throw new Error('Arrêt d’urgence engagé : réarmer d’abord');
  if (r.geste) throw new Error('Un geste est déjà en cours');
  return r;
}

/** Joue un geste simulé : il est visible dans `geste` pendant `duree`, puis `fin` l'applique. */
function geste(r: Robot, nom: GesteRobot, duree: number, fin: () => void): Promise<Robot> {
  r.geste = nom;
  sauver();
  return new Promise((ok) => setTimeout(() => {
    // Un arrêt d'urgence pendant le geste l'interrompt : rien n'est appliqué.
    if (r.etat !== 'arret_urgence') fin();
    r.geste = null;
    sauver();
    ok(structuredClone(r));
  }, duree));
}

const commande = <T>(f: () => Promise<T>): Promise<T> => {
  try {
    return f();
  } catch (e) {
    return Promise.reject(e);
  }
};

/** Le chemin joué : du départ, on suit la sortie « réussi » jusqu'au bout (la simulation réussit tout). */
function chemin(m: Mission): string[] {
  const vus = ['depart'];
  for (;;) {
    const suite = m.liens.find((l) => l.de === vus.at(-1) && l.sortie === 'ok');
    if (!suite || vus.includes(suite.vers)) return vus;
    vus.push(suite.vers);
  }
}

/** Une étape du parcours simulé d'un tour : son nœud, la sortie de l'étape d'avant qui y mène, et si elle rate. */
interface PasSimule { noeud: string; par: 'ok' | 'echec'; rate: boolean }

/**
 * Le parcours d'un tour simulé : la chaîne « réussi », sauf au deuxième tour, où la première prise qui a une sortie
 * « échec » rate et la mission suit sa branche échec — de quoi voir la barre de lecture prendre une autre branche.
 */
function parcours(m: Mission, tour: number): PasSimule[] {
  const pas: PasSimule[] = [];
  const vus = new Set(['depart']);
  let de = 'depart';
  let sortie: 'ok' | 'echec' = 'ok';
  for (;;) {
    const vers = m.liens.find((l) => l.de === de && l.sortie === sortie)?.vers;
    if (!vers || vus.has(vers)) return pas;
    vus.add(vers);
    const type = magasin.primitives.find((p) => p.id === m.noeuds.find((n) => n.id === vers)?.primitiveId)?.type;
    const rate = tour === 2 && !pas.some((p) => p.rate) && type === 'prise_objet' && m.liens.some((l) => l.de === vers && l.sortie === 'echec');
    pas.push({ noeud: vers, par: sortie, rate });
    de = vers;
    sortie = rate ? 'echec' : 'ok';
  }
}

/** Le temps joué par la mission simulée, pauses retirées (ms). */
function tempsJoue(x: NonNullable<Magasin['execution']>): number {
  return Date.now() - x.debut - x.pause - (x.pauseDepuis ? Date.now() - x.pauseDepuis : 0);
}

/** Un nombre entre 0 et 1 tiré d'un texte, toujours le même pour le même texte. */
function hachage(texte: string): number {
  let h = 2166136261;
  for (const c of texte) h = Math.imul(h ^ c.charCodeAt(0), 16777619);
  return (h >>> 0) / 2 ** 32;
}

/**
 * Le détail par étape d'un run simulé, tiré de sa mission : la chaîne « réussi » jouée jusqu'à l'étape qui a raté
 * (la prise, ou la dépose si la cause parle du bac), puis la sortie « échec » de cette étape si elle est reliée.
 * Les durées se partagent celle du run.
 */
function detailler(u: Run): Run {
  const m = magasin.missions.find((x) => x.id === u.missionId);
  if (u.etapes || u.dureeS === 0 || !m) return u;
  const c = chemin(m).slice(1);
  if (!c.length) return u;
  const typeDe = (id: string) => magasin.primitives.find((p) => p.id === m.noeuds.find((n) => n.id === id)?.primitiveId)?.type;
  const rate = u.issue === 'echoue' ? c.findIndex((id) => typeDe(id) === (/bac/i.test(u.cause ?? '') ? 'depose' : 'prise_objet')) : -1;
  const fin = u.issue === 'reussi' ? c.length - 1 : u.issue === 'echoue' ? (rate >= 0 ? rate : c.length - 1) : Math.floor((c.length - 1) / 2);
  const secours = u.issue === 'echoue' ? m.liens.find((l) => l.de === c[fin] && l.sortie === 'echec')?.vers : undefined;
  const ids = [...c.slice(0, fin + 1), ...(secours ? [secours] : [])];
  const poids = ids.map((id, i) => 0.6 + hachage(`${u.id}:${id}:${i}`));
  const total = poids.reduce((a, b) => a + b, 0);
  let debutS = 0;
  const etapes = ids.map((noeud, i) => {
    const dureeS = (u.dureeS * poids[i]) / total;
    const issue = i === fin ? u.issue : 'reussi';
    const etape = { noeud, debutS, dureeS, issue, cause: i === fin ? u.cause : null };
    debutS += dureeS;
    return etape;
  });
  return { ...u, etapes };
}

/**
 * Fait avancer la mission simulée jusqu'à maintenant : chaque étape dure DUREE_ETAPE_MS, les tours s'enchaînent ; à
 * la fin de la dernière répétition, elle se termine.
 */
function avancer(): Execution | null {
  const x = magasin.execution;
  if (!x) return null;
  const m = magasin.missions.find((y) => y.id === x.missionId);
  const r = magasin.robots.find((y) => y.id === x.robotId);
  if (!m || !r || r.missionCourante !== m.id) {
    magasin.execution = null;
    return null;
  }
  const joue = tempsJoue(x);
  const tours = Array.from({ length: m.repetitions }, (_, k) => parcours(m, k + 1));
  let i = Math.floor(joue / DUREE_ETAPE_MS);
  let tour = 0;
  while (tour < tours.length && i >= Math.max(1, tours[tour].length)) {
    i -= Math.max(1, tours[tour].length);
    tour += 1;
  }
  const p = tours[tour] ?? [];
  if (!p.length) {
    const run = magasin.runs.find((u) => u.robotId === r.id && u.missionId === m.id && u.dureeS === 0);
    if (run) run.dureeS = Math.max(1, Math.round(joue / 1000));
    m.etat = 'terminee';
    r.etat = 'disponible';
    r.missionCourante = null;
    magasin.execution = null;
    sauver();
    return null;
  }
  const ici = p[i].noeud;
  const vus = new Set(['depart', ...p.slice(0, i + 1).map((y) => y.noeud)]);
  const prevus: string[] = [];
  for (let n = m.liens.find((l) => l.de === ici && l.sortie === 'ok')?.vers; n && !vus.has(n); n = m.liens.find((l) => l.de === n && l.sortie === 'ok')?.vers) {
    prevus.push(n);
    vus.add(n);
  }
  const ratee = p.findIndex((y) => y.rate);
  const nom = magasin.primitives.find((q) => q.id === m.noeuds.find((n) => n.id === p[ratee]?.noeud)?.primitiveId)?.nom;
  const avancement = (joue % DUREE_ETAPE_MS) / DUREE_ETAPE_MS;
  return {
    missionId: m.id, chemin: ['depart', ...p.slice(0, i + 1).map((y) => y.noeud), ...prevus], etape: i + 1, avancement,
    repetition: tour + 1, repetitions: m.repetitions, enPause: x.pauseDepuis !== null, dureeS: joue / 1000,
    joues: p.slice(0, i + 1).map((y, k) => ({ noeud: y.noeud, par: y.par, issue: k < i ? (y.rate ? 'echoue' : 'reussi') : 'cours' })),
    dureeEtapeS: (avancement * DUREE_ETAPE_MS) / 1000,
    alerte: ratee >= 0 && ratee < i ? { niveau: 'attention', texte: `« ${nom} » a raté : aucune prise atteignable. La mission prend sa branche échec.` } : null,
  };
}

export const apiSimulee: Api = {
  robots: () => { avancer(); return plusTard(magasin.robots); },
  robot: (id) => plusTard(magasin.robots.find((r) => r.id === id)),
  etatCorps: (robotId) => etatCorpsSimule(robotId),
  etatCapteurs: (robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    const v = !r || r.etat === 'hors_ligne' ? 'inconnu' as const : 'ok' as const;
    return plusTard<EtatCapteurs>({ camera: v, lidar: v });
  },
  arretUrgence: (robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    if (!r) return Promise.reject(new Error('Robot inconnu'));
    r.etat = 'arret_urgence';
    // La mission en cours s'arrête là : son run se ferme, interrompu par l'arrêt d'urgence.
    const x = magasin.execution;
    const run = magasin.runs.find((u) => u.robotId === robotId && u.dureeS === 0);
    if (x && x.robotId === robotId && run) {
      run.dureeS = Math.max(1, Math.round(tempsJoue(x) / 1000));
      run.issue = 'interrompu';
      run.cause = 'Arrêt d’urgence';
      const m = magasin.missions.find((y) => y.id === x.missionId);
      if (m) m.etat = 'prete';
      magasin.execution = null;
    }
    r.missionCourante = null;
    r.geste = null;
    sauver();
    return plusTard(r);
  },
  rearmer: (robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    if (!r) return Promise.reject(new Error('Robot inconnu'));
    if (r.etat === 'arret_urgence') r.etat = 'disponible';
    sauver();
    return plusTard(r);
  },
  modeBras: (robotId, mode) => commande(() => {
    const r = commandable(robotId);
    r.modeBras = mode;
    sauver();
    return plusTard(r);
  }),
  pince: (robotId, cote: Cote, ordre) => commande(() => {
    const r = commandable(robotId);
    return geste(r, cote === 'gauche' ? 'pince_gauche' : 'pince_droite', DUREE_PINCE_MS, () => {
      r.pinces[cote] = ordre === 'ouvrir' ? 1 : 0;
    });
  }),
  home: (robotId) => commande(() => {
    const r = commandable(robotId);
    // La posture de travail se rejoint bras tenus : un bras mou ne suivrait pas la trajectoire.
    return geste(r, 'home', DUREE_HOME_MS, () => {
      r.modeBras = 'rigide';
    });
  }),

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
    magasin.execution = { robotId, missionId, debut: Date.now(), pause: 0, pauseDepuis: null };
    sauver();
    return plusTard(run);
  },
  execution: () => plusTard(avancer()),
  pauseMission: (robotId, pause) => {
    const x = magasin.execution;
    if (!x || x.robotId !== robotId) return Promise.reject(new Error('Aucune mission en cours'));
    if (pause && x.pauseDepuis === null) x.pauseDepuis = Date.now();
    if (!pause && x.pauseDepuis !== null) {
      x.pause += Date.now() - x.pauseDepuis;
      x.pauseDepuis = null;
    }
    sauver();
    return plusTard(avancer());
  },
  arreterMission: (robotId) => {
    const r = magasin.robots.find((x) => x.id === robotId);
    if (!r) return Promise.reject(new Error('Robot inconnu'));
    const m = magasin.missions.find((x) => x.id === r.missionCourante);
    const run = magasin.runs.find((u) => u.robotId === robotId && u.missionId === r.missionCourante && u.dureeS === 0);
    if (run) {
      run.dureeS = Math.round((Date.now() - new Date(run.debut).getTime()) / 1000);
      run.issue = 'interrompu';
      run.cause = 'Arrêtée par l’opérateur';
    }
    if (m) m.etat = 'prete';
    if (r.etat === 'en_mission') r.etat = 'disponible';
    r.missionCourante = null;
    magasin.execution = null;
    sauver();
    return plusTard(r);
  },

  runs: (filtre) =>
    plusTard(
      magasin.runs.map(detailler).filter(
        (u) => (!filtre?.robotId || u.robotId === filtre.robotId) && (!filtre?.missionId || u.missionId === filtre.missionId),
      ),
    ),
};
