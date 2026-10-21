import type { GrilleChassis } from '../vue3d/reel';

/** Une carte servie au front : la grille, ses postes, et si c'est bien celle que tient le châssis. */
export interface CarteServie extends GrilleChassis {
  nom: string;
  postes: Record<string, { x: number; y: number; yaw: number }>;
  /** Faux : la pose du châssis est dans une autre carte, le robot n'y est pas à sa place. */
  surLeChassis?: boolean;
}

const CLE = 'mpc.front.carte';
/** La carte que tient le châssis, relue en direct. */
export const CHASSIS = '__chassis__';
const EVENEMENT = 'mpc-carte-choisie';

/** La carte choisie sur cet appareil : le nom d'une carte enregistrée, `CHASSIS`, ou null (l'active du serveur). */
export function carteChoisie(): string | null {
  try {
    return localStorage.getItem(CLE);
  } catch {
    return null;
  }
}

/** Choisit la carte montrée par la vue 3D et la mini-carte ; elles la rechargent aussitôt. */
export function choisirCarte(nom: string): void {
  try {
    localStorage.setItem(CLE, nom);
  } catch {
    // Stockage indisponible : le choix vaut jusqu'au rechargement.
  }
  window.dispatchEvent(new Event(EVENEMENT));
}

/** Appelle `faire` à chaque changement de carte choisie ; rend de quoi arrêter d'écouter. */
export function surChangementDeCarte(faire: () => void): () => void {
  window.addEventListener(EVENEMENT, faire);
  return () => window.removeEventListener(EVENEMENT, faire);
}

/** Les cartes enregistrées du robot, et celle qu'il a posée en dernier. */
export function listerCartes(url: string): Promise<{ active: string; cartes: { nom: string }[] }> {
  return fetch(`${url}/api/cartes`).then((r) => (r.ok ? r.json() : { active: '', cartes: [] }));
}

/** Charge la carte choisie : une carte enregistrée (l'active du serveur par défaut), sinon celle du châssis. */
export async function chargerCarte(url: string): Promise<CarteServie | null> {
  let nom = carteChoisie();
  if (nom === null) {
    const l = await listerCartes(url).catch(() => ({ active: '', cartes: [] }));
    nom = l.active || l.cartes[0]?.nom || CHASSIS;
  }
  const chemin = nom === CHASSIS ? '/api/carte' : `/api/cartes/${encodeURIComponent(nom)}`;
  const r = await fetch(`${url}${chemin}`).catch(() => null);
  if (!r?.ok) return null;
  const c = await r.json();
  return { postes: {}, surLeChassis: true, ...c, nom: nom === CHASSIS ? 'châssis' : nom };
}
