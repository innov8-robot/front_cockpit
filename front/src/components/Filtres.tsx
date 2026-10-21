import { useState } from 'react';
import type { Verdict } from '../api/types';
import type { Calque } from '../vue3d/scene';
import type { DescriptionCalque } from './calques';
import { IconeAtelier, IconeCamera, IconeCarte, IconeCorps, IconeGrille, IconeLidar, IconeObjets } from './IconesRobot';

/** Ce que reçoit chaque proposition de filtres : les calques, ceux qui sont montrés, et la bascule. */
export interface ProprietesFiltres {
  calques: DescriptionCalque[];
  actifs: Record<Calque, boolean>;
  basculer(cle: Calque): void;
  /** La santé de chaque calque (point vert, rouge ou gris), et sa raison au survol. */
  verdicts?: Partial<Record<Calque, { verdict: Verdict; raison: string }>>;
  /** Les calques toujours montrés : leur ligne n'a pas d'interrupteur. */
  fixes?: Calque[];
}

const TITRES_VERDICT: Record<Verdict, string> = { ok: 'tout va bien', pb: 'problème', inconnu: 'pas de nouvelles' };

const ICONES: Record<Calque, typeof IconeCorps> = {
  robot: IconeCorps, atelier: IconeAtelier, camera: IconeCamera, lidar: IconeLidar, carte: IconeCarte, objets: IconeObjets,
  sol: IconeGrille,
};

/** Le pire verdict des calques : un seul rouge suffit à rougir la tête, repliée. */
const pire = (p: ProprietesFiltres): Verdict | null => {
  const v = Object.values(p.verdicts ?? {}).map((x) => x!.verdict);
  return v.includes('pb') ? 'pb' : v.includes('inconnu') ? 'inconnu' : v.length ? 'ok' : null;
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
function LigneInterrupteur({ c, actif, basculer, sante, fixe }: {
  c: DescriptionCalque; actif: boolean; basculer(cle: Calque): void;
  sante?: { verdict: Verdict; raison: string }; fixe?: boolean;
}) {
  const Icone = ICONES[c.cle];
  const titre = sante ? `${c.libelle} : ${TITRES_VERDICT[sante.verdict]}${sante.raison ? ` (${sante.raison})` : ''}` : undefined;
  const textes = (
    <span className="filtres-textes">
      <span>{sante && <span className={`hud-verdict verdict-${sante.verdict}`} />}{c.libelle}</span><small>{c.detail}</small>
    </span>
  );
  if (fixe) {
    return <div className="actif filtres-fixe" title={titre}><Icone />{textes}<span className="filtres-toujours">toujours</span></div>;
  }
  return (
    <button role="switch" aria-checked={actif} className={actif ? 'actif' : ''} onClick={() => basculer(c.cle)} title={titre}>
      <Icone />
      {textes}
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
        <IconeGrille /><span>CALQUES</span>
        {pire(p) && <span className={`hud-verdict verdict-${pire(p)}`} title="La santé la plus mauvaise des calques" />}
        <span className="filtres-compte">{compte(p)}</span>
        <span className="filtres-chevron" aria-hidden="true">▾</span>
      </button>
      <div className="filtres-depli" inert={!ouvert}>
        <div className="filtres-interrupteurs filtres-depli-liste">
          {p.calques.map((c) => (
            <LigneInterrupteur key={c.cle} c={c} actif={p.actifs[c.cle]} basculer={p.basculer}
              sante={p.verdicts?.[c.cle]} fixe={p.fixes?.includes(c.cle)} />
          ))}
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
        <IconeGrille /><span>CALQUES</span>
        {pire(p) && <span className={`hud-verdict verdict-${pire(p)}`} title="La santé la plus mauvaise des calques" />}
        <span className="filtres-compte">{compte(p)}</span>
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
