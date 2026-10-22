import type { Api } from './client';
import { apiSimulee } from './mock';
import type { EtatCapteurs, EtatCorps, Robot } from './types';

/** Ce qui ne passe pas encore par le serveur du robot : l'appel échoue en le disant, jamais en silence. */
const pasEncore = (quoi: string) => () => Promise.reject(new Error(`${quoi} : pas encore branché au serveur du robot`));

/**
 * Le client du serveur du robot (`python -m oc_svfp.serveur_web`). Le robot, son corps, ses capteurs et l'E-STOP
 * viennent du serveur ; les primitives et les missions restent simulées tant qu'il ne les sert pas, et leur
 * lancement est refusé (il vit encore dans le cockpit).
 */
export function apiReelle(url: string): Api {
  async function demander<T>(chemin: string, init?: RequestInit): Promise<T> {
    let r: Response;
    try {
      r = await fetch(`${url}${chemin}`, { ...init, headers: { 'content-type': 'application/json' } });
    } catch {
      throw new Error(`serveur du robot injoignable (${url})`);
    }
    if (!r.ok) {
      const detail = await r.json().then((j) => j.detail).catch(() => r.statusText);
      throw new Error(String(detail));
    }
    return r.json() as Promise<T>;
  }
  // Un serveur plus ancien que le front peut omettre des champs : on comble avec des valeurs neutres plutôt
  // que de laisser un écran tomber sur un champ absent.
  const robot = () => demander<Partial<Robot>>('/api/robot').then((r): Robot => ({
    id: 'robot', nom: 'Robot', modele: '', site: '', etat: 'hors_ligne', posteCourant: null, missionCourante: null,
    derniereConnexion: new Date().toISOString(), modeBras: 'rigide', geste: null, ...r,
    batterie: r.batterie ?? 0, pinces: { gauche: 1, droite: 1, ...r.pinces },
  }));
  const arret = (actif: boolean) => demander('/api/arret', { method: 'POST', body: JSON.stringify({ actif }) }).then(robot);

  return {
    ...apiSimulee,
    robots: () => robot().then((r) => [r]),
    robot: (id) => robot().then((r) => (r.id === id ? r : undefined)),
    arretUrgence: () => arret(true),
    rearmer: () => arret(false),
    modeBras: pasEncore('Le mode des bras'),
    pince: pasEncore('Les pinces'),
    home: pasEncore('HOME'),
    etatCorps: () => demander<EtatCorps>('/api/corps'),
    etatCapteurs: () => demander<EtatCapteurs>('/api/capteurs'),
    lancerMission: pasEncore('Le lancement des missions'),
    arreterMission: pasEncore('L’arrêt des missions'),
    pauseMission: pasEncore('La pause des missions'),
    pasAPas: pasEncore('Le pas à pas'),
    etapeSuivante: pasEncore('Le pas à pas'),
    execution: () => Promise.resolve(null),
  };
}
