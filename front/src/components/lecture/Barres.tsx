import { Fragment, type CSSProperties, type ReactNode } from 'react';
import { duree } from '../executions/donnees';
import { typePrimitive } from '../graphe/correspondance';
import { teinte } from '../missions/apparence';
import { ICONES } from '../missions/catalogue';
import type { EtatLien, EtatNoeud, Ton } from '../missions/charte';
import { BadgeEtat, IconePoints } from '../missions/Noeud';
import { OndeChemin } from '../missions/Onde';
import { useCamera } from './camera';
import { rangDansTour, type EtatLecture, type Lecture, type PasLecture } from './lecture';

interface Proprietes {
  l: Lecture;
  pause(): void;
}

const ETATS: Record<EtatLecture, string> = {
  cours: 'En cours', pause: 'En pause', urgence: 'Arrêt d’urgence', reussie: 'Terminée', echouee: 'Échouée',
};

const famille = (p: PasLecture) => ({ ['--famille' as string]: teinte(typePrimitive(p.primitive).famille, 'familles') }) as CSSProperties;
const icone = (p: PasLecture) => ICONES[typePrimitive(p.primitive).icone] ?? ICONES.note;
const nom = (p: PasLecture) => p.primitive?.nom ?? 'Primitive supprimée';
const fini = (l: Lecture) => l.etat === 'reussie' || l.etat === 'echouee';
/** L'étape que la caméra suit : celle en cours, ou la dernière jouée quand la mission est finie. */
const cible = (l: Lecture) => (l.courant >= 0 ? l.courant : l.pas.length - 1);

function etatNoeud(p: PasLecture, l: Lecture): EtatNoeud {
  if (p.issue === 'reussi') return 'ok';
  if (p.issue === 'echoue') return 'echec';
  if (p.issue === 'cours') return l.etat === 'urgence' ? 'danger' : 'cours';
  return 'attente';
}

/** La durée d'une étape en clair : jouée, ratée, en cours, ou estimée (« ~ »). */
function texteDuree(p: PasLecture): string {
  if (p.issue === 'prevu') return `~${duree(p.dureeS)}`;
  if (p.issue === 'echoue') return `ratée · ${duree(p.dureeS)}`;
  return duree(p.dureeS);
}

/** La tuile d'une étape, comme celles de l'éditeur : l'icône en points de la couleur de sa famille, l'état au coin. */
function Tuile({ p, l }: { p: PasLecture; l: Lecture }) {
  const etat = etatNoeud(p, l);
  return (
    <span className={`bl-tuile bl-tuile-${etat}`} style={famille(p)} title={nom(p)}>
      <span className="bl-tuile-matrice"><IconePoints d={icone(p)} cadre={14} /></span>
      <BadgeEtat etat={etat} />
    </span>
  );
}

/** Le lien qui mène à l'étape `i` : parcouru, actif (l'onde file vers l'étape en cours) ou à venir. */
function Lien({ l, i, largeur = 36 }: { l: Lecture; i: number; largeur?: number }) {
  const p = l.pas[i];
  const etat: EtatLien = l.courant < 0 || i < l.courant ? 'parcouru' : i === l.courant ? 'actif' : 'aucun';
  const ton: Ton = i === l.courant && l.etat === 'urgence' ? 'danger' : p.par === 'echec' ? 'echec' : 'ok';
  const d = `M1 7H${largeur - 1}`;
  return (
    <span className={`bl-lien ${p.par === 'echec' ? 'bl-lien-echec' : ''}`} style={{ width: largeur }} aria-hidden="true">
      {p.par === 'echec' && largeur >= 30 && <small>échec</small>}
      <svg width={largeur} height="14"><path d={d} className="bl-lien-trait" /><OndeChemin d={d} etat={etat} ton={ton} /></svg>
    </span>
  );
}

/** La jauge de l'étape en cours. */
function Jauge({ l }: { l: Lecture }) {
  return <span className="bl-jauge" aria-hidden="true"><i style={{ width: `${Math.round(l.avancement * 100)}%` }} /></span>;
}

/** Le passage d'un tour au suivant, sur la piste. */
function Tour({ n }: { n: number }) {
  return <span className="bl-tour" aria-label={`Tour ${n}`}><i aria-hidden="true" />↺ {n}</span>;
}

/** Le bout de la piste : le tour suivant, ou la fin de la mission. */
function Bout({ l }: { l: Lecture }) {
  if (fini(l)) return null;
  return <span className="bl-bout">{l.tour < l.tours ? `↺ tour ${l.tour + 1}` : 'fin'}</span>;
}

function IconePause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>;
}

function IconeLecture() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>;
}

/**
 * Ce que les trois barres partagent : à gauche le nom de la mission et son état (le tour), au centre la piste, à
 * droite le temps joué et le temps qui reste, puis le seul bouton, pause ou reprise.
 */
function Cadre({ l, pause, variante, children }: Proprietes & { variante: string; children: ReactNode }) {
  const enPause = l.etat === 'pause';
  return (
    <div className={`bl-barre bl-${variante} bl-etat-${l.etat}`} role="toolbar" aria-label={`Mission ${l.mission.nom}`}>
      <div className="bl-identite">
        <strong className="bl-nom" title={l.mission.nom}>{l.mission.nom}</strong>
        <small className="bl-etat"><i aria-hidden="true" />{ETATS[l.etat]}{l.tours > 1 && <span className="bl-etat-tour"> · tour {l.tour}/{l.tours}</span>}</small>
      </div>
      <div className="bl-centre">{children}</div>
      <div className="bl-temps">
        <b>{duree(l.dureeS)}</b>
        <small>{fini(l) ? 'au total' : l.resteS === null ? '' : `reste ~${duree(l.resteS)}`}</small>
      </div>
      <button className={`bl-bouton ${enPause ? 'bl-reprendre' : ''}`} disabled={fini(l) || l.etat === 'urgence'} onClick={pause}
        aria-label={enPause ? 'Reprendre la mission' : 'Mettre la mission en pause'}
        title={l.etat === 'urgence' ? 'Réarmez l’arrêt d’urgence d’abord' : undefined}>
        {enPause || fini(l) ? <IconeLecture /> : <IconePause />}
      </button>
    </div>
  );
}

/**
 * A · Le travelling : la chaîne de la mission sur un rail, chaque étape avec son nom. La caméra glisse d'étape en étape
 * et garde celle qui se joue au tiers gauche ; derrière, ce qui est fait (et les tours d'avant, éteints), devant, ce
 * qu'on prévoit. Sous l'étape en cours, où part la mission si elle rate.
 */
export function BarreTravelling({ l, pause }: Proprietes) {
  const { vue, piste } = useCamera(0.3);
  return (
    <Cadre l={l} pause={pause} variante="travelling">
      <div className="bl-vue" ref={vue}>
        <div className="bl-piste" ref={piste}>
          {l.pas.map((p, i) => (
            <Fragment key={p.cle}>
              {i > 0 && (p.tour !== l.pas[i - 1].tour ? <Tour n={p.tour} /> : <Lien l={l} i={i} />)}
              <div className={`bl-pas bl-pas-${p.issue}`} data-cible={i === cible(l) || undefined} data-ancien={p.tour < l.tour || undefined}>
                <Tuile p={p} l={l} />
                <span className="bl-pas-textes">
                  <span className="bl-pas-nom">{nom(p)}</span>
                  {p.issue === 'cours' && <Jauge l={l} />}
                  <small>{texteDuree(p)}</small>
                </span>
                {p.issue === 'cours' && l.siEchec && (
                  <span className="bl-fourche">
                    <svg width="11" height="10" aria-hidden="true"><path d="M1.5 0V4Q1.5 8.5 6 8.5H11" /></svg>
                    si ça rate : {l.siEchec.nom}
                  </span>
                )}
              </div>
            </Fragment>
          ))}
          {!fini(l) && <span className="bl-lien bl-lien-bout" aria-hidden="true" />}
          <Bout l={l} />
        </div>
      </div>
    </Cadre>
  );
}

/** Les mesures du fil (B), en px : la caméra calcule où est l'étape en cours sans mesurer l'écran. */
const FIL = { tuile: 30, lien: 20, ouvert: 270, tour: 40 };

/**
 * B · Le fil : les étapes en tuiles seules, celle qui se joue ouverte au centre avec son nom en grand. La caméra la
 * garde au milieu ; en dessous, un segment par étape du tour, comme des « stories », qui se refait quand la mission
 * prend une autre branche.
 */
export function BarreFil({ l, pause }: Proprietes) {
  const c = cible(l);
  let x = 0;
  let centre = 0;
  const elements: ReactNode[] = [];
  l.pas.forEach((p, i) => {
    if (i > 0) {
      const nouveau = p.tour !== l.pas[i - 1].tour;
      elements.push(nouveau ? <Tour key={`t${p.cle}`} n={p.tour} /> : <Lien key={`l${p.cle}`} l={l} i={i} largeur={FIL.lien} />);
      x += nouveau ? FIL.tour : FIL.lien;
    }
    const ouvert = i === c;
    const largeur = ouvert ? FIL.ouvert : FIL.tuile;
    if (ouvert) centre = x + largeur / 2;
    const { rang, nombre } = rangDansTour(l, i);
    elements.push(
      <div key={p.cle} className={`bl-maille bl-pas-${p.issue} ${ouvert ? 'bl-ouverte' : ''}`} style={{ width: largeur }}
        data-ancien={p.tour < l.tour || undefined}>
        <Tuile p={p} l={l} />
        <span className="bl-maille-textes">
          <span className="bl-maille-nom">{nom(p)}</span>
          <small>étape {rang}/{nombre} · {texteDuree(p)}</small>
        </span>
      </div>,
    );
    x += largeur;
  });
  const { vue, piste } = useCamera(0.5, centre);
  const duTour = l.pas.filter((p) => p.tour === l.pas[c]?.tour);
  return (
    <Cadre l={l} pause={pause} variante="fil">
      <div className="bl-vue" ref={vue}>
        <div className="bl-piste" ref={piste}>{elements}</div>
      </div>
      <div className="bl-segments" aria-hidden="true">
        {duTour.map((p) => (
          <i key={p.cle} className={`bl-segment bl-segment-${p.issue} ${p.par === 'echec' ? 'bl-segment-par-echec' : ''}`}>
            <b style={p.issue === 'cours' ? { width: `${Math.round(l.avancement * 100)}%` } : undefined} />
          </i>
        ))}
      </div>
    </Cadre>
  );
}

/** L'échelle de la frise (C), en px par seconde, et l'écart entre deux étapes. */
const PX_S = 10;
const ECART = 3;
/** Une graduation toutes les 15 s, nommée toutes les 30 s. */
const GRADUATION_S = 15;

/**
 * C · La frise du temps : chaque étape est un bloc aussi long que sa durée, la tête de lecture reste fixe et le temps
 * défile dessous. Devant elle, les étapes prévues à leur durée moyenne : on voit ce qui reste, et la fin.
 */
export function BarreFrise({ l, pause }: Proprietes) {
  let x = 0;
  let t = 0;
  let tete = 0;
  const graduations: { x: number; t: number }[] = [];
  const blocs: { p: PasLecture; i: number; x: number; largeur: number; nouveau: boolean }[] = [];
  for (const [i, p] of l.pas.entries()) {
    const longueurS = p.issue === 'cours' ? Math.max(p.dureeS, p.estimeeS) : p.dureeS;
    const largeur = Math.max(10, longueurS * PX_S);
    for (let g = Math.ceil(t / GRADUATION_S) * GRADUATION_S; g < t + longueurS; g += GRADUATION_S) {
      graduations.push({ x: x + (g - t) * PX_S, t: g });
    }
    blocs.push({ p, i, x, largeur, nouveau: i > 0 && p.tour !== l.pas[i - 1].tour });
    if (p.issue === 'cours') tete = x + p.dureeS * PX_S;
    x += largeur + ECART;
    t += longueurS;
  }
  if (l.courant < 0) tete = x - ECART;
  const { vue, piste } = useCamera(0.62, tete);
  return (
    <Cadre l={l} pause={pause} variante="frise">
      <div className="bl-vue" ref={vue}>
        <div className="bl-piste" ref={piste}>
          {graduations.map((g) => (
            <span key={g.t} className={`bl-graduation ${g.t % 30 === 0 ? 'bl-graduation-nommee' : ''}`} style={{ left: g.x }}>
              {g.t % 30 === 0 && g.t > 0 && <small>{duree(g.t)}</small>}
            </span>
          ))}
          {blocs.map(({ p, i, x: gauche, largeur, nouveau }) => (
            <Fragment key={p.cle}>
              {nouveau && <span className="bl-frise-tour" style={{ left: gauche - 2 }}>↺ {p.tour}</span>}
              <div className={`bl-bloc bl-pas-${p.issue} ${p.par === 'echec' ? 'bl-bloc-par-echec' : ''}`} data-ancien={p.tour < l.tour || undefined}
                style={{ ...famille(p), left: gauche, width: largeur }} title={`${nom(p)} · ${texteDuree(p)}`}>
                {p.issue === 'cours' && <i className="bl-bloc-joue" style={{ width: p.dureeS * PX_S }} />}
                <svg className="bl-bloc-icone" width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2"
                  strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={icone(p)} /></svg>
                {largeur > 70 && <span className="bl-bloc-nom">{nom(p)}</span>}
                {p.issue === 'echoue' && <b className="bl-bloc-rate" aria-label="ratée">!</b>}
                {i === l.courant && l.etat === 'urgence' && <b className="bl-bloc-urgence" aria-label="arrêt d’urgence">■</b>}
              </div>
            </Fragment>
          ))}
        </div>
        <span className="bl-tete" aria-hidden="true" />
      </div>
    </Cadre>
  );
}
