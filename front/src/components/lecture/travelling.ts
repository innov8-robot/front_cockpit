import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';

export interface Point { x: number; y: number }

/** Une étape du parcours de la caméra : la clé de l'étape, le fil qui y mène, et le point à cadrer en arrivant. */
export interface EtapeCamera { cle: string; lien: string | null; cible: Point }

/** La vitesse de la caméra le long du fil (px/s), et les bornes d'un trajet (ms). */
const VITESSE = 300;
const DUREE_MIN = 160;
const DUREE_MAX = 1800;
/** Un trajet tient dans cette part du temps entre deux étapes : la caméra ne prend pas de retard sur la mission. */
const PART_DU_RYTHME = 0.7;

const lisse = (u: number) => (u < 0.5 ? 4 * u ** 3 : 1 - (-2 * u + 2) ** 3 / 2);
const entre = (a: Point, b: Point, u: number): Point => ({ x: a.x + (b.x - a.x) * u, y: a.y + (b.y - a.y) * u });
const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);

/** Pose la caméra : le point `p` du monde va à l'ancre de la vue. */
function placer(vue: HTMLElement, monde: HTMLElement, p: Point, ancre: Point) {
  monde.style.transform = `translate(${Math.round(vue.clientWidth * ancre.x - p.x)}px, ${Math.round(vue.clientHeight * ancre.y - p.y)}px)`;
}

/**
 * Le travelling de la barre de lecture. `etapes` est le parcours de la mission jusqu'à l'étape en cours, la dernière.
 * Quand elle change, la caméra parcourt dans l'ordre chaque fil emprunté depuis la dernière étape où elle s'est posée
 * — une entrée, puis une sortie de boucle rapides, une étape sautée entre deux relectures — : l'étincelle reste sous
 * elle et le fil s'allume derrière. Sa vitesse s'adapte : plus il reste de fils à parcourir et plus les étapes
 * s'enchaînent vite, plus elle va vite. `arrivee` vaut la clé de la dernière étape atteinte : l'étape ne s'ouvre qu'à
 * l'arrivée de l'étincelle.
 */
export function useTravelling(etapes: EtapeCamera[], ancre: Point) {
  const vue = useRef<HTMLDivElement>(null);
  const monde = useRef<HTMLDivElement>(null);
  const etincelle = useRef<SVGGElement>(null);
  const camera = useRef<Point | null>(null);
  const file = useRef<EtapeCamera[]>([]);
  const derniere = useRef<string | null>(null);
  const image = useRef(0);
  const rythme = useRef(DUREE_MAX / PART_DU_RYTHME);
  const dernierAjout = useRef(0);
  const cible = etapes.at(-1);
  const [arrivee, setArrivee] = useState(cible?.cle ?? '');

  /** Parcourt le fil suivant de la file, puis le suivant ; à la fin, l'étape est atteinte. */
  const parcourir = useCallback(function suivre() {
    const v = vue.current;
    const m = monde.current;
    const etape = file.current.shift();
    if (!v || !m || !etape) return;
    const chemin = etape.lien ? m.querySelector<SVGPathElement>(`[data-lien="${etape.lien}"]`) : null;
    const derniereEtape = file.current.length === 0;
    const trace = derniereEtape ? m.querySelector<SVGPathElement>('[data-trace]') : null;
    const longueur = chemin?.getTotalLength() ?? 0;
    const depart = camera.current ?? etape.cible;
    const entree = chemin ? chemin.getPointAtLength(0) : depart;
    const sortie = chemin ? chemin.getPointAtLength(longueur) : depart;
    const a = distance(depart, entree);
    const c = distance(sortie, etape.cible);
    const total = a + longueur + c;
    const reste = file.current.length + 1;
    const reduit = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const voulue = Math.min(DUREE_MAX, (total / VITESSE) * 1000, (rythme.current * PART_DU_RYTHME) / reste);
    const duree = reduit ? 0 : Math.max(DUREE_MIN, voulue);
    let t0 = -1;
    const pas = (maintenant: number) => {
      if (t0 < 0) t0 = maintenant;
      const u = duree ? Math.min(1, (maintenant - t0) / duree) : 1;
      const s = lisse(u) * total;
      const surFil = chemin !== null && s > a && s < a + longueur;
      const p = s <= a ? entre(depart, entree, a ? s / a : 1)
        : s < a + longueur ? chemin!.getPointAtLength(s - a)
        : entre(sortie, etape.cible, c ? (s - a - longueur) / c : 1);
      camera.current = { x: p.x, y: p.y };
      placer(v, m, camera.current, ancre);
      if (trace) trace.style.strokeDashoffset = String(1 - Math.min(1, Math.max(0, (s - a) / (longueur || 1))));
      if (etincelle.current) {
        etincelle.current.style.opacity = surFil ? '1' : '0';
        etincelle.current.setAttribute('transform', `translate(${p.x} ${p.y})`);
      }
      if (u < 1) {
        image.current = requestAnimationFrame(pas);
        return;
      }
      image.current = 0;
      if (file.current.length) suivre();
      else setArrivee(etape.cle);
    };
    image.current = requestAnimationFrame(pas);
  }, [ancre]);

  useLayoutEffect(() => {
    const v = vue.current;
    const m = monde.current;
    if (!cible || !v || !m) return;
    if (!camera.current) {
      camera.current = cible.cible;
      derniere.current = cible.cle;
      placer(v, m, cible.cible, ancre);
      return;
    }
    if (derniere.current === cible.cle) return;
    const i = etapes.findIndex((e) => e.cle === derniere.current);
    derniere.current = cible.cle;
    const maintenant = performance.now();
    if (dernierAjout.current) rythme.current = 0.6 * rythme.current + 0.4 * (maintenant - dernierAjout.current);
    dernierAjout.current = maintenant;
    file.current.push(...(i >= 0 ? etapes.slice(i + 1) : [cible]));
    if (!image.current) parcourir();
  }, [cible?.cle]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => () => cancelAnimationFrame(image.current), []);

  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    const observateur = new ResizeObserver(() => {
      if (!image.current && camera.current && monde.current) placer(v, monde.current, camera.current, ancre);
    });
    observateur.observe(v);
    return () => observateur.disconnect();
  }, [ancre]);

  return { vue, monde, etincelle, arrivee };
}
