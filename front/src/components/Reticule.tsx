import { useEffect, useRef } from 'react';

/** Le décalage du badge par rapport au pointeur (px), pour ne jamais être sous lui. */
const DECALAGE = 14;
const pad = (n: number) => String(Math.max(0, Math.round(n))).padStart(4, '0');
const metres = (v: number) => `${v >= 0 ? '+' : '−'}${Math.abs(v).toFixed(2)}`;

/**
 * Le réticule CAO : deux lignes de 1 px qui traversent l'écran au pointeur, et un badge de télémétrie qui le
 * suit. Au-dessus de la scène 3D, le badge dit aussi où tombe le pointeur au sol, dans le repère du robot.
 * Seulement avec une souris : au doigt, il n'y a pas de pointeur à suivre.
 */
export function Reticule({ projeterSol, indice }: {
  projeterSol?: (x: number, y: number) => { x: number; y: number } | null;
  /** Une ligne d'aide sous les coordonnées, quand le pointeur survole quelque chose qu'on peut ouvrir. */
  indice?: (x: number, y: number) => string | null;
}) {
  const lignes = useRef<{ x: HTMLDivElement | null; y: HTMLDivElement | null; badge: HTMLDivElement | null }>({ x: null, y: null, badge: null });
  const projeter = useRef(projeterSol);
  projeter.current = projeterSol;
  const aide = useRef(indice);
  aide.current = indice;

  useEffect(() => {
    if (!matchMedia('(hover: hover) and (pointer: fine)').matches) return;
    document.documentElement.classList.add('avec-reticule');
    let image = 0;
    let dernier: PointerEvent | null = null;

    const dessiner = () => {
      image = 0;
      const e = dernier;
      const { x: lx, y: ly, badge } = lignes.current;
      if (!e || !lx || !ly || !badge) return;
      const { clientX: x, clientY: y } = e;
      lx.style.transform = `translateX(${x}px)`;
      ly.style.transform = `translateY(${y}px)`;
      // Le badge passe de l'autre côté du pointeur près des bords droit et bas.
      const droite = x + DECALAGE + badge.offsetWidth > innerWidth;
      const bas = y + DECALAGE + badge.offsetHeight > innerHeight;
      badge.style.transform = `translate(${droite ? x - DECALAGE - badge.offsetWidth : x + DECALAGE}px, ${bas ? y - DECALAGE - badge.offsetHeight : y + DECALAGE}px)`;

      const surScene = (e.target as Element | null)?.closest?.('.accueil-scene');
      const sol = surScene ? projeter.current?.(x, y) : null;
      const astuce = aide.current?.(x, y);
      badge.textContent = `X:${pad(x)} Y:${pad(y)} // [G1-D:01]` + (sol ? `\nSOL  x ${metres(sol.x)} m  y ${metres(sol.y)} m` : '')
        + (astuce ? `\n▸ ${astuce}` : '');
      document.documentElement.classList.add('reticule-actif');
    };

    const bouger = (e: PointerEvent) => {
      if (e.pointerType !== 'mouse') return;
      dernier = e;
      if (!image) image = requestAnimationFrame(dessiner);
    };
    const sortir = () => document.documentElement.classList.remove('reticule-actif');

    addEventListener('pointermove', bouger, { passive: true });
    document.addEventListener('pointerleave', sortir);
    addEventListener('blur', sortir);
    return () => {
      cancelAnimationFrame(image);
      removeEventListener('pointermove', bouger);
      document.removeEventListener('pointerleave', sortir);
      removeEventListener('blur', sortir);
      document.documentElement.classList.remove('avec-reticule', 'reticule-actif');
    };
  }, []);

  return (
    <div className="reticule" aria-hidden="true">
      <div className="reticule-x" ref={(el) => { lignes.current.x = el; }} />
      <div className="reticule-y" ref={(el) => { lignes.current.y = el; }} />
      <div className="reticule-badge" ref={(el) => { lignes.current.badge = el; }} />
    </div>
  );
}
