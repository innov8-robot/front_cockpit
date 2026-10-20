import { useState } from 'react';
import type { Calque } from '../vue3d/scene';
import type { DescriptionCalque } from './calques';
import { IconeAtelier, IconeCamera, IconeCarte, IconeCorps, IconeGrille, IconeLidar, IconeObjets } from './IconesRobot';

/** Ce que reçoit chaque proposition de filtres : les calques, ceux qui sont montrés, et la bascule. */
export interface ProprietesFiltres {
  calques: DescriptionCalque[];
  actifs: Record<Calque, boolean>;
  basculer(cle: Calque): void;
}

const ICONES: Record<Calque, typeof IconeCorps> = {
  robot: IconeCorps, atelier: IconeAtelier, camera: IconeCamera, lidar: IconeLidar, carte: IconeCarte, objets: IconeObjets,
  sol: IconeGrille,
};

const compte = ({ calques, actifs }: ProprietesFiltres) => `${calques.filter((c) => actifs[c.cle]).length}/${calques.length}`;

/** A · Le rail d'icônes : le plus discret ; le nom et le détail s'affichent au survol. */
export function FiltresRail(p: ProprietesFiltres) {
  return (
    <nav className="filtres filtres-rail" aria-label="Calques">
      {p.calques.map((c) => {
        const Icone = ICONES[c.cle];
        return (
          <button key={c.cle} className={p.actifs[c.cle] ? 'actif' : ''} aria-pressed={p.actifs[c.cle]}
            aria-label={`${c.libelle} · ${c.detail}`} onClick={() => p.basculer(c.cle)}>
            <Icone />
            <span className="filtres-bulle"><strong>{c.libelle}</strong>{c.detail}</span>
          </button>
        );
      })}
    </nav>
  );
}

/** Une ligne d'interrupteur : l'icône du calque, son nom et son détail, l'interrupteur. */
function LigneInterrupteur({ c, actif, basculer }: { c: DescriptionCalque; actif: boolean; basculer(cle: Calque): void }) {
  const Icone = ICONES[c.cle];
  return (
    <button role="switch" aria-checked={actif} className={actif ? 'actif' : ''} onClick={() => basculer(c.cle)}>
      <Icone />
      <span className="filtres-textes"><span>{c.libelle}</span><small>{c.detail}</small></span>
      <span className="filtres-interrupteur" aria-hidden="true"><i /></span>
    </button>
  );
}

/**
 * Les filtres retenus pour l'accueil : les interrupteurs (B) dans la coque repliable (D). Repliés, un bouton et le
 * compte des calques montrés ; dépliés, chaque calque avec son détail et son interrupteur.
 */
export function FiltresCalques(p: ProprietesFiltres & { className?: string }) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <nav className={`filtres filtres-dock filtres-repliable ${ouvert ? 'ouvert' : ''} ${p.className ?? ''}`} aria-label="Calques">
      <button className="filtres-dock-tete" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <IconeGrille /><span>CALQUES</span><span className="filtres-compte">{compte(p)}</span>
        <span className="filtres-chevron" aria-hidden="true">▾</span>
      </button>
      <div className="filtres-depli" inert={!ouvert}>
        <div className="filtres-interrupteurs filtres-depli-liste">
          {p.calques.map((c) => <LigneInterrupteur key={c.cle} c={c} actif={p.actifs[c.cle]} basculer={p.basculer} />)}
        </div>
      </div>
    </nav>
  );
}

/** B · Les interrupteurs : chaque calque, son détail et un interrupteur ; le compte des calques montrés en tête. */
export function FiltresInterrupteurs(p: ProprietesFiltres) {
  return (
    <nav className="filtres filtres-interrupteurs" aria-label="Calques">
      <p className="filtres-tete"><span>CALQUES</span><span>{compte(p)}</span></p>
      {p.calques.map((c) => <LigneInterrupteur key={c.cle} c={c} actif={p.actifs[c.cle]} basculer={p.basculer} />)}
    </nav>
  );
}

/** C · La légende : la couleur de chaque calque dans la scène, qu'on éteint ou rallume d'un clic. */
export function FiltresLegende(p: ProprietesFiltres) {
  return (
    <nav className="filtres filtres-legende" aria-label="Calques">
      <p className="filtres-tete"><span>LÉGENDE</span><span>{compte(p)}</span></p>
      {p.calques.map((c) => (
        <button key={c.cle} className={p.actifs[c.cle] ? 'actif' : ''} aria-pressed={p.actifs[c.cle]}
          onClick={() => p.basculer(c.cle)} title={p.actifs[c.cle] ? 'Clic : masquer' : 'Clic : montrer'}>
          <span className="filtres-pastille" style={{ background: c.couleur }} aria-hidden="true" />
          <span className="filtres-nom">{c.libelle}</span>
          <small>{c.detail}</small>
        </button>
      ))}
    </nav>
  );
}

/** D · Le repliable : un seul bouton et le compte ; la liste se déplie au clic. */
export function FiltresDock(p: ProprietesFiltres) {
  const [ouvert, setOuvert] = useState(false);
  return (
    <nav className={`filtres filtres-dock ${ouvert ? 'ouvert' : ''}`} aria-label="Calques">
      <button className="filtres-dock-tete" aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}>
        <IconeGrille /><span>CALQUES</span><span className="filtres-compte">{compte(p)}</span>
        <span className="filtres-chevron" aria-hidden="true">▾</span>
      </button>
      {ouvert && (
        <div className="filtres-dock-liste">
          {p.calques.map((c) => {
            const Icone = ICONES[c.cle];
            return (
              <button key={c.cle} className={p.actifs[c.cle] ? 'actif' : ''} aria-pressed={p.actifs[c.cle]}
                onClick={() => p.basculer(c.cle)} title={c.detail}>
                <Icone /><span>{c.libelle}</span><span className="filtres-coche" aria-hidden="true">{p.actifs[c.cle] ? '●' : '○'}</span>
              </button>
            );
          })}
        </div>
      )}
    </nav>
  );
}
