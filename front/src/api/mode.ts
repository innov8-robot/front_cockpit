/** Où le front prend ses données : la simulation embarquée, ou le serveur du robot. Mémorisé par appareil. */
export type Mode = 'simulation' | 'reel';

const CLE_MODE = 'mpc.front.mode';
const CLE_URL = 'mpc.front.serveur';

function lire(cle: string): string | null {
  try {
    return localStorage.getItem(cle);
  } catch {
    return null;
  }
}

function ecrire(cle: string, valeur: string): void {
  try {
    localStorage.setItem(cle, valeur);
  } catch {
    // Stockage indisponible : le choix ne vaut que jusqu'au rechargement.
  }
}

/** Le mode courant : celui choisi sur cet appareil, sinon le réel si un serveur est déclaré à la compilation. */
export function modeCourant(): Mode {
  const m = lire(CLE_MODE);
  if (m === 'simulation' || m === 'reel') return m;
  return import.meta.env.VITE_API_URL ? 'reel' : 'simulation';
}

/** L'adresse du serveur du robot, sans barre finale. */
export function urlServeur(): string {
  const url = lire(CLE_URL) || import.meta.env.VITE_API_URL || `http://${location.hostname || 'localhost'}:8765`;
  return url.replace(/\/+$/, '');
}

/** Change de mode et d'adresse, puis recharge l'appli : chaque écran repart sur la bonne source. */
export function choisirMode(mode: Mode, url?: string): void {
  ecrire(CLE_MODE, mode);
  if (url) ecrire(CLE_URL, url.trim());
  location.reload();
}
