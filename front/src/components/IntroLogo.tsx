import { useEffect, useMemo, useRef, useState, type CSSProperties } from 'react';

/** L'emblème Innov8 Robotics (app/cockpit_real_ui/assets/logo.png) pixelisé en 24 × 24 blocs. */
const EMBLEME = [
  '........................',
  '..........#..#..........',
  '.........##..##.........',
  '.......####..####.......',
  '......#####..#####......',
  '......#####..#####......',
  '......#####..#####......',
  '......#####..#####......',
  '......#####..#####......',
  '......#####..#####......',
  '......#####..#####......',
  '....#######..#######....',
  '..#########..#########..',
  '.#########....#########.',
  '.########......########.',
  '.######....##....######.',
  '.#####...######...#####.',
  '####....########....####',
  '##....############....##',
  '.....##############.....',
  '...##################...',
  '..#########..#########..',
  '....#####......#####....',
  '........................',
];

/** Le dégradé de la marque, du haut (orange clair) vers le bas (orange brûlé). */
const HAUT = [246, 178, 90];
const BAS = [210, 65, 15];
const teinte = (j: number) => {
  const t = j / (EMBLEME.length - 1);
  return `rgb(${HAUT.map((h, k) => Math.round(h + (BAS[k] - h) * t)).join(' ')})`;
};

/** Le noir tenu entre le terminal éteint et les premiers blocs (voir `.intro`). */
const NOIR_MS = 350;
const ASSEMBLAGE_MS = 1300;
/** Une touche ou un toucher plus tôt est celui qui a passé le BIOS : il ne doit pas sauter le logo. */
const GARDE_MS = 700;
const CHARGE_MS = 1500;

/** Après le BIOS : les blocs du logo s'assemblent, la barre se trace puis se remplit, le logo prend ses couleurs. */
export function IntroLogo({ onFini }: { onFini(): void }) {
  const [etape, setEtape] = useState<'assemble' | 'charge' | 'marque' | 'sortie'>('assemble');
  const [remplissage, setRemplissage] = useState(0);
  const finir = useRef(onFini);
  finir.current = onFini;

  const blocs = useMemo(() => EMBLEME.flatMap((ligne, j) => [...ligne].flatMap((c, i) => (
    c === '#' ? [{ i, j, delai: Math.random() * ASSEMBLAGE_MS }] : []
  ))), []);

  useEffect(() => {
    const t = setTimeout(() => setEtape('charge'), NOIR_MS + ASSEMBLAGE_MS + 200);
    return () => clearTimeout(t);
  }, []);

  // La barre avance par à-coups, comme un vrai chargement.
  useEffect(() => {
    if (etape !== 'charge') return;
    if (remplissage >= 1) {
      const t = setTimeout(() => setEtape('marque'), 150);
      return () => clearTimeout(t);
    }
    const pas = 0.06 + Math.random() * 0.22;
    const t = setTimeout(() => setRemplissage((r) => Math.min(1, r + pas)), (CHARGE_MS / 7) * (0.5 + Math.random()));
    return () => clearTimeout(t);
  }, [etape, remplissage]);

  useEffect(() => {
    if (etape === 'marque') {
      const t = setTimeout(() => setEtape('sortie'), 1600);
      return () => clearTimeout(t);
    }
    if (etape === 'sortie') {
      const t = setTimeout(() => finir.current(), 700);
      return () => clearTimeout(t);
    }
  }, [etape]);

  const ouvertA = useRef(performance.now());
  const passer = () => performance.now() - ouvertA.current > GARDE_MS && setEtape('sortie');
  useEffect(() => {
    const touche = (e: KeyboardEvent) => !e.repeat && passer();
    window.addEventListener('keydown', touche);
    return () => window.removeEventListener('keydown', touche);
  });

  return (
    <div className={`intro intro-${etape}`} onPointerDown={passer}>
      <div className="intro-embleme" role="img" aria-label="Innov8 Robotics">
        {blocs.map(({ i, j, delai }) => (
          <span key={`${i}-${j}`} className="intro-bloc"
            style={{ gridColumn: i + 1, gridRow: j + 1, animationDelay: `${NOIR_MS + delai}ms`, ['--teinte' as string]: teinte(j) } as CSSProperties} />
        ))}
      </div>
      <div className="intro-barre">
        <svg className="intro-cadre" viewBox="0 0 280 26" preserveAspectRatio="none" aria-hidden="true">
          <rect x="0.5" y="0.5" width="279" height="25" pathLength="100" />
        </svg>
        <div className="intro-plein" style={{ width: `${remplissage * 100}%` }} />
      </div>
      <p className="intro-nom">INNOV8 ROBOTICS</p>
    </div>
  );
}
