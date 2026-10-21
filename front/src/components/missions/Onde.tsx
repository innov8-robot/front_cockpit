import { useLayoutEffect, useRef, useState, type CSSProperties } from 'react';
import { TONS, type EtatLien, type Ton } from './charte';

/**
 * Un trait de l'onde, en fraction du chemin (pathLength = 1) : `longueur` de trait qui file jusqu'à ce que sa tête ait
 * dépassé la traîne la plus longue ; la tête et la traîne arrivent ensemble au bout.
 */
function trait(longueur: number, traine: number, couleur: string): CSSProperties {
  return {
    stroke: couleur, color: couleur, strokeDasharray: `${longueur} 3`,
    ['--de' as string]: longueur, ['--a' as string]: longueur - 1 - traine,
  };
}

/**
 * La lueur et l'onde d'un chemin SVG, par-dessus le trait de base que l'appelant dessine. Parcouru : une lueur de la
 * couleur de l'issue. Actif : une tête vive et sa traîne filent vers le bout du chemin, une fois par seconde.
 */
export function OndeChemin({ d, etat, ton }: { d: string; etat: EtatLien; ton: Ton }) {
  const lueur = useRef<SVGPathElement>(null);
  const [px, setPx] = useState(200);
  useLayoutEffect(() => {
    if (lueur.current) setPx(Math.max(lueur.current.getTotalLength(), 1));
  }, [d, etat]);
  if (etat === 'aucun') return null;
  const couleur = TONS[ton];
  const tete = Math.min(Math.max(26 / px, 0.06), 0.3);
  const traine = Math.min(Math.max(110 / px, 0.18), 0.7);
  return (
    <>
      <path ref={lueur} d={d} className="em-lien-lueur" style={{ stroke: couleur }} />
      {etat === 'actif' && <>
        <path d={d} pathLength={1} className="em-lien-onde em-lien-traine" style={trait(traine, traine, couleur)} />
        <path d={d} pathLength={1} className="em-lien-onde" style={trait(tete, traine, couleur)} />
      </>}
    </>
  );
}

/** L'onde seule, sur un lien droit : la charte la montre dans chaque couleur. */
export function OndeExemple({ ton, largeur = 140 }: { ton: Ton; largeur?: number }) {
  return (
    <svg width={largeur + 10} height="16" aria-hidden="true" style={{ overflow: 'visible' }}>
      <OndeChemin d={`M4 8H${largeur}`} etat="actif" ton={ton} />
      <path d={`M${largeur} 3l8 5-8 5z`} fill={TONS[ton]} />
    </svg>
  );
}
