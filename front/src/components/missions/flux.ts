/**
 * L'onde du parcours : une seule tête de lumière part du lancement, suit dans l'ordre les liens que l'exécution a
 * réellement pris — la branche choisie, le retour d'une boucle, la sortie d'échec — jusqu'à l'étape en cours, puis
 * repart. Le parcours s'allonge à chaque pas ; l'onde continue sur sa lancée.
 */
import { createContext, useEffect, useMemo, useRef, type RefObject } from 'react';

/** Un lien inscrit : sa longueur et les deux traits (tête, traîne) que l'onde allume quand elle y passe. */
export interface TraceFlux { longueur: number; tete: SVGPathElement | null; traine: SVGPathElement | null }

export interface RegistreFlux {
  inscrire(id: string, trace: TraceFlux): void;
  desinscrire(id: string): void;
}

export const Flux = createContext<RegistreFlux | null>(null);

/** La vitesse de l'onde (px du canevas par seconde), la longueur de sa tête et de sa traîne, son repos à l'arrivée. */
const VITESSE = 1100;
const TETE = 26;
const TRAINE = 120;
const REPOS_S = 0.3;

/** Allume la tête et la traîne d'un lien, `h` px après son début ; `null` les éteint. */
function dessiner(trace: TraceFlux, h: number | null) {
  for (const [el, long] of [[trace.tete, TETE], [trace.traine, TRAINE]] as const) {
    if (!el) continue;
    if (h === null) {
      el.style.visibility = 'hidden';
      continue;
    }
    el.style.visibility = 'visible';
    el.style.strokeDasharray = `${long} ${trace.longueur + long + 10}`;
    el.style.strokeDashoffset = String(long - h);
  }
}

/** Où se trouve l'onde sur un lien, s'il est sur le parcours et qu'elle y passe en ce moment. */
function position(id: string, trace: TraceFlux, s: number, ids: string[], debuts: number[]): number | null {
  for (let i = 0; i < ids.length; i++) {
    const h = s - debuts[i];
    if (ids[i] === id && h > 0 && h < trace.longueur + TRAINE) return h;
  }
  return null;
}

/**
 * Fait courir l'onde sur `parcours` (les identifiants des liens pris, dans l'ordre) et rend le registre où chaque lien
 * s'inscrit. Une boucle d'animation pose les traits directement, sans rendu React.
 */
export function useFlux(parcours: RefObject<string[]>): RegistreFlux {
  const inscrits = useRef(new Map<string, TraceFlux>());
  useEffect(() => {
    const lent = matchMedia('(prefers-reduced-motion: reduce)').matches ? 3 : 1;
    let s = 0;
    let repos = 0;
    let avant = performance.now();
    let image = 0;
    const pas = (t: number) => {
      const dt = Math.min((t - avant) / 1000, 0.1);
      avant = t;
      const ids = parcours.current;
      const debuts: number[] = [];
      let total = 0;
      for (const id of ids) {
        debuts.push(total);
        total += inscrits.current.get(id)?.longueur ?? 0;
      }
      if (!ids.length) s = 0;
      else if (repos > 0) repos -= dt;
      else {
        s += (VITESSE / lent) * dt;
        if (s > total + TRAINE) { s = 0; repos = REPOS_S; }
      }
      for (const [id, trace] of inscrits.current) dessiner(trace, ids.length && repos <= 0 ? position(id, trace, s, ids, debuts) : null);
      image = requestAnimationFrame(pas);
    };
    image = requestAnimationFrame(pas);
    return () => cancelAnimationFrame(image);
  }, [parcours]);
  return useMemo(() => ({
    inscrire: (id, trace) => { inscrits.current.set(id, trace); },
    desinscrire: (id) => { inscrits.current.delete(id); },
  }), []);
}
