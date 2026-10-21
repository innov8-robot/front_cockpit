import { useEffect, useLayoutEffect, useRef } from 'react';

/**
 * La caméra d'une barre de lecture : la piste glisse sous la vue pour poser sa cible à `ancre` (une fraction de la
 * largeur de la vue). La cible est une position sur la piste (px) ou, sans elle, l'élément marqué `data-cible`.
 * Le glissé est la transition CSS de la piste ; au premier placement et quand la vue change de taille, la piste se pose
 * sans glisser.
 */
export function useCamera(ancre: number, position?: number) {
  const vue = useRef<HTMLDivElement>(null);
  const piste = useRef<HTMLDivElement>(null);
  const premier = useRef(true);
  const placer = useRef<(sansGlisser: boolean) => void>(() => undefined);

  useLayoutEffect(() => {
    placer.current = (sansGlisser) => {
      const v = vue.current;
      const p = piste.current;
      if (!v || !p) return;
      let centre = position;
      if (centre === undefined) {
        const c = p.querySelector<HTMLElement>('[data-cible]');
        if (!c) return;
        centre = c.offsetLeft + c.offsetWidth / 2;
      }
      if (sansGlisser) p.style.transition = 'none';
      p.style.transform = `translateX(${Math.round(v.clientWidth * ancre - centre)}px)`;
      if (sansGlisser) {
        void p.offsetWidth;
        p.style.transition = '';
      }
    };
    placer.current(premier.current);
    premier.current = false;
  });

  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    let initial = true;
    const observateur = new ResizeObserver(() => {
      if (initial) {
        initial = false;
        return;
      }
      placer.current(true);
    });
    observateur.observe(v);
    return () => observateur.disconnect();
  }, []);

  return { vue, piste };
}
