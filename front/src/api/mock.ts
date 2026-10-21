import type { Api } from './client';
import type { AlerteMission, Cote, EtatCapteurs, EtatCorps, Execution, GesteRobot, Mission, Primitive, Robot, Run, Sortie } from './types';

const CLE = 'mpc.front.simulation.v6';
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

/** Une primitive simulée dure ce temps (ms) ; une décision de logique, le temps d'un coup d'œil ; un appel, celui d'un humain. */
const DUREE_ETAPE_MS = 5000;
const DUREE_LOGIQUE_MS = 1500;
const DUREE_APPEL_MS = 6000;

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
      {
        id: 'p6', nom: 'Retour à la base', type: 'deplacer',
        description: 'La base roule jusqu’au poste « base », bras rentrés.',
        objet: null, ancrage: null, poste: 'base', vitesse: 1, creeLe: ilYA(60 * 24 * 12),
        creePar: 'Thomas', tauxReussite: 1, executions: 24,
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
      {
        id: 'm3', nom: 'Vider la table, en boucle',
        description: 'Pour chaque pièce sur la table : si le bac est plein, l’opérateur le vide ; prendre la pièce, la déposer, compter. Une pièce imprenable appelle l’opérateur. Puis rentrer les bras et retourner à la base.',
        noeuds: [
          { id: 'depart', primitiveId: null, x: 0, y: 200 },
          { id: 'b1', primitiveId: 'p4', x: 240, y: 200 },
          { id: 'b2', primitiveId: null, type: 'pour_chaque', valeurs: { objet: 'pièce', zone: 'la table' }, x: 480, y: 200 },
          { id: 'b3', primitiveId: null, type: 'si', valeurs: { condition: 'bac plein' }, x: 720, y: 212 },
          { id: 'b4', primitiveId: null, type: 'demander', valeurs: { message: 'Videz le bac' }, x: 960, y: 80 },
          { id: 'b5', primitiveId: 'p1', x: 1200, y: 212 },
          { id: 'b6', primitiveId: 'p2', x: 1440, y: 200 },
          { id: 'b7', primitiveId: null, type: 'compteur', valeurs: { variable: 'déposées', pas: 1 }, x: 1680, y: 200 },
          { id: 'b8', primitiveId: null, type: 'demander', valeurs: { message: 'Retirez la pièce' }, x: 1440, y: 392 },
          { id: 'b9', primitiveId: 'p5', x: 720, y: -76 },
          { id: 'b10', primitiveId: 'p6', x: 960, y: -76 },
          { id: 'b11', primitiveId: null, type: 'terminer', valeurs: { verdict: 'réussie' }, x: 1200, y: -76 },
        ],
        liens: [
          { id: 'k1', de: 'depart', sortie: 'ok', vers: 'b1' },
          { id: 'k2', de: 'b1', sortie: 'ok', vers: 'b2' },
          { id: 'k3', de: 'b2', sortie: 'faire', vers: 'b3' },
          { id: 'k4', de: 'b3', sortie: 'alors', vers: 'b4' },
          { id: 'k5', de: 'b4', sortie: 'ok', vers: 'b5' },
          { id: 'k6', de: 'b3', sortie: 'sinon', vers: 'b5' },
          { id: 'k7', de: 'b5', sortie: 'ok', vers: 'b6' },
          { id: 'k8', de: 'b6', sortie: 'ok', vers: 'b7' },
          { id: 'k9', de: 'b7', sortie: 'suite', vers: 'b2' },
          { id: 'k10', de: 'b5', sortie: 'echec', vers: 'b8' },
          { id: 'k11', de: 'b8', sortie: 'ok', vers: 'b2' },
          { id: 'k12', de: 'b2', sortie: 'fini', vers: 'b9' },
          { id: 'k13', de: 'b9', sortie: 'ok', vers: 'b10' },
          { id: 'k14', de: 'b10', sortie: 'ok', vers: 'b11' },
        ],
        robotId: 'r1', repetitions: 1, etat: 'prete', modifieeLe: ilYA(30),
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
      { id: 'u15', missionId: 'm3', robotId: 'r1', debut: ilYA(60 * 3), dureeS: 74, issue: 'reussi', cause: null },
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
  // L'accueil s'ouvre sans rien de lancé : une mission qui jouait au rechargement s'arrête, et son run, jamais fini, s'efface
  // (sa durée compterait le temps où la page était fermée).
  if (m.execution) {
    const mission = m.missions.find((y) => y.id === m.execution?.missionId);
    if (mission?.etat === 'en_cours') mission.etat = 'prete';
    m.runs = m.runs.filter((u) => u.dureeS > 0);
    m.execution = null;
    for (const r of m.robots) {
      if (r.etat === 'en_mission') r.etat = 'disponible';
      r.missionCourante = null;
    }
    try {
      localStorage.setItem(CLE, JSON.stringify(m));
    } catch {
      // Stockage indisponible : l'état ne vit que pendant la session.
    }
  }
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

/** Une étape du parcours simulé d'un tour : son nœud, la sortie de l'étape d'avant qui y mène, et si elle rate. */
interface PasSimule { noeud: string; par: Sortie; rate: boolean }

/** Les nœuds de boucle : « faire » tant qu'il reste des pièces, puis « fini ». */
const BOUCLES = ['pour_chaque', 'pour', 'repeter', 'tant_que'];
/** Combien de pièces une boucle simulée trouve sur la table. */
const PIECES = 3;
/** Au-delà, un tour simulé s'arrête : une mission qui tournerait en rond sans fin. */
const ETAPES_MAX = 60;

const aUneBoucle = (m: Mission) => m.noeuds.some((n) => n.type && BOUCLES.includes(n.type));

/**
 * La règle d'un nœud simulé à sa `visite`-ième fois dans le tour : une boucle fait « faire » trois fois puis « fini » ;
 * une condition est vraie à la deuxième pièce ; une prise rattrapée par une sortie « échec » rate à la dernière pièce
 * d'une boucle, ou au deuxième tour d'une mission sans boucle. Le reste réussit par « ok » ou « suite ».
 */
function regle(m: Mission, id: string, visite: number, tour: number): { sortie?: Sortie; rate: boolean } {
  const n = m.noeuds.find((x) => x.id === id);
  if (n?.type && BOUCLES.includes(n.type)) return { sortie: visite <= PIECES ? 'faire' : 'fini', rate: false };
  if (n?.type === 'si') return { sortie: visite === 2 ? 'alors' : 'sinon', rate: false };
  const prise = magasin.primitives.find((p) => p.id === n?.primitiveId)?.type === 'prise_objet';
  const rattrapee = m.liens.some((l) => l.de === id && l.sortie === 'echec');
  return { rate: prise && rattrapee && (aUneBoucle(m) ? visite === PIECES : tour === 2 && visite === 1) };
}

/** Le parcours d'un tour simulé, nœud par nœud, selon leurs règles : de quoi voir la barre de lecture tout suivre. */
function parcours(m: Mission, tour: number): PasSimule[] {
  const pas: PasSimule[] = [];
  const visites = new Map<string, number>();
  const boucle = aUneBoucle(m);
  let de = 'depart';
  let sortie: Sortie | undefined = 'ok';
  while (sortie && pas.length < ETAPES_MAX) {
    const vers = m.liens.find((l) => l.de === de && l.sortie === sortie)?.vers;
    if (!vers || (!boucle && visites.has(vers))) return pas;
    const visite = (visites.get(vers) ?? 0) + 1;
    visites.set(vers, visite);
    const r = regle(m, vers, visite, tour);
    pas.push({ noeud: vers, par: sortie, rate: r.rate });
    de = vers;
    sortie = r.rate ? 'echec' : r.sortie ?? m.liens.find((l) => l.de === vers && (l.sortie === 'ok' || l.sortie === 'suite'))?.sortie;
  }
  return pas;
}

/** La durée d'une étape simulée (ms). */
function dureeMs(m: Mission, id: string): number {
  const type = m.noeuds.find((n) => n.id === id)?.type;
  return !type ? DUREE_ETAPE_MS : type === 'demander' ? DUREE_APPEL_MS : DUREE_LOGIQUE_MS;
}

/** Le nom d'un nœud simulé, pour une alerte. */
function nomNoeud(m: Mission, id: string): string {
  const n = m.noeuds.find((x) => x.id === id);
  return magasin.primitives.find((p) => p.id === n?.primitiveId)?.nom ?? n?.type ?? id;
}

/**
 * L'alerte de l'étape en cours : celle d'avant a raté et une branche l'a rattrapée, ou la mission attend l'opérateur.
 */
function alerteDe(m: Mission, avant: PasSimule | undefined, ici: string): AlerteMission | null {
  const n = m.noeuds.find((x) => x.id === ici);
  const appel = n?.type === 'demander' ? String(n.valeurs?.message ?? 'une intervention').toLowerCase() : null;
  if (avant?.rate) {
    const suite = appel ? `La mission appelle l’opérateur : ${appel}.` : 'La mission prend sa branche échec.';
    return { niveau: 'attention', texte: `« ${nomNoeud(m, avant.noeud)} » a raté : aucune prise atteignable. ${suite}` };
  }
  return appel ? { niveau: 'attention', texte: `La mission attend l’opérateur : ${appel}.` } : null;
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
  const tour = parcours(m, 1);
  const c = tour.map((y) => y.noeud);
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
    const rattrapee = i !== fin && tour[i]?.rate;
    const issue = i === fin ? u.issue : rattrapee ? 'echoue' : 'reussi';
    const etape = { noeud, debutS, dureeS, issue, cause: i === fin ? u.cause : rattrapee ? 'Aucune prise atteignable' : null };
    debutS += dureeS;
    return etape;
  });
  return { ...u, etapes };
}

/**
 * Fait avancer la mission simulée jusqu'à maintenant : chaque étape dure le temps de son genre, les tours
 * s'enchaînent ; à la fin de la dernière répétition, elle se termine.
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
  let reste = joue;
  let tour = 0;
  let i = 0;
  let p: PasSimule[] = [];
  cherche: for (; tour < m.repetitions; tour++) {
    p = parcours(m, tour + 1);
    for (i = 0; i < p.length; i++) {
      const d = dureeMs(m, p[i].noeud);
      if (reste < d) break cherche;
      reste -= d;
    }
  }
  if (tour >= m.repetitions || !p.length) {
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
  const prevus: string[] = [];
  const vus = new Set([ici]);
  for (let de = ici; ;) {
    const type = m.noeuds.find((n) => n.id === de)?.type;
    if (de !== ici && type && (BOUCLES.includes(type) || type === 'si')) break;
    const n = m.liens.find((l) => l.de === de && (l.sortie === 'ok' || l.sortie === 'suite'))?.vers;
    if (!n || vus.has(n)) break;
    prevus.push(n);
    vus.add(n);
    de = n;
  }
  const avancement = reste / dureeMs(m, ici);
  return {
    missionId: m.id, chemin: ['depart', ...p.slice(0, i + 1).map((y) => y.noeud), ...prevus], etape: i + 1, avancement,
    repetition: tour + 1, repetitions: m.repetitions, enPause: x.pauseDepuis !== null, dureeS: joue / 1000,
    joues: p.slice(0, i + 1).map((y, k) => ({ noeud: y.noeud, par: y.par, issue: k < i ? (y.rate ? 'echoue' : 'reussi') : 'cours' })),
    dureeEtapeS: reste / 1000,
    alerte: alerteDe(m, p[i - 1], ici),
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
