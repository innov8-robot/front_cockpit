import { useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { duree } from '../executions/donnees';
import { teinte } from '../missions/apparence';
import { ICONES } from '../missions/catalogue';
import { ETATS as ETATS_NOEUD, FAMILLE, TONS } from '../missions/charte';
import { BadgeEtat, IconePoints } from '../missions/Noeud';
import { OndeChemin } from '../missions/Onde';
import { construireFil, trajets, type NoeudFil } from './fil';
import { useGlisser } from './glisser';
import type { EtatLecture, Lecture, MessageLecture } from './lecture';
import { useTravelling, type Point } from './travelling';

/**
 * L'état de la mission, dans le système de la barre : le blanc pour ce qui vit, le gris pour ce qui est suspendu, le
 * vert pour ce qui a réussi, l'ambre pour ce qui n'arrête rien mais demande de l'attention, le rouge pour ce qui a
 * arrêté la mission (une erreur, l'arrêt d'urgence). Toujours un signe avec la couleur.
 */
const ETATS: Record<EtatLecture, { libelle: string; signe: string | null }> = {
  cours: { libelle: 'En cours', signe: null },
  pause: { libelle: 'En pause', signe: '‖' },
  urgence: { libelle: 'Arrêt d’urgence', signe: '■' },
  reussie: { libelle: 'Terminée', signe: '✓' },
  erreur: { libelle: 'Erreur', signe: '✕' },
  arretee: { libelle: 'Arrêtée', signe: '■' },
};

/** Le signe d'un message, dans sa couleur. */
const SIGNES: Record<MessageLecture['niveau'], string> = { succes: '✓', attention: '!', erreur: '✕' };

/**
 * Le message sous la barre, de la couleur de son halo. Une erreur ou un arrêt reste jusqu'à ce qu'on l'acquitte ; un
 * avertissement s'efface seul, ou d'une croix. Un arrêt (urgence, ou par l'opérateur) porte le carré.
 */
function Message({ m, urgence, arret, acquitter }: { m: MessageLecture; urgence: boolean; arret: boolean; acquitter(): void }) {
  return (
    <div className={`bl-message bl-message-${m.niveau}`} role={m.niveau === 'erreur' ? 'alert' : 'status'}>
      <b aria-hidden="true">{urgence || arret ? '■' : SIGNES[m.niveau]}</b>
      <span>{m.texte}</span>
      {m.niveau === 'erreur' && !urgence && <button className="bl-acquitter" onClick={acquitter}>Acquitter</button>}
      {m.niveau === 'attention' && (
        <button className="bl-fermer" onClick={acquitter} aria-label="Fermer l’avertissement">
          <svg width="14" height="14" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round" aria-hidden="true"><path d="M6 6l12 12M18 6L6 18" /></svg>
        </button>
      )}
    </div>
  );
}

/** L'étape en cours se pose au centre, un peu au-dessus du milieu : son nom tient dessous. */
const ANCRE: Point = { x: 0.5, y: 0.36 };

/** Le temps qu'il faut maintenir le bouton stop : un effleurement n'arrête pas une mission. */
const MAINTIEN_MS = 1000;

export function IconePause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>;
}

export function IconeLecture() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>;
}

function IconeStop() {
  return <svg width="16" height="16" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="6" width="12" height="12" rx="2" fill="currentColor" /></svg>;
}

/**
 * Le bouton stop : il faut le maintenir une seconde ; pendant l'appui, il rougit et son anneau se remplit, et au bout,
 * la mission s'arrête (le halo rouge de la barre). Un appui trop court le dit au lieu de ne rien faire.
 */
export function BoutonStop({ arreter, actif }: { arreter(): void; actif: boolean }) {
  const [appui, setAppui] = useState(false);
  const [indice, setIndice] = useState<{ x: number; y: number } | null>(null);
  const minuteur = useRef(0);
  const bouton = useRef<HTMLButtonElement>(null);
  const debut = useRef(0);
  const presser = () => {
    if (!actif) return;
    debut.current = performance.now();
    setAppui(true);
    minuteur.current = window.setTimeout(() => { setAppui(false); arreter(); }, MAINTIEN_MS);
  };
  const lacher = () => {
    if (!appui) return;
    clearTimeout(minuteur.current);
    setAppui(false);
    const r = bouton.current?.getBoundingClientRect();
    if (r && performance.now() - debut.current < MAINTIEN_MS) {
      setIndice({ x: r.left + r.width / 2, y: r.bottom + 8 });
      window.setTimeout(() => setIndice(null), 1600);
    }
  };
  return (
    <button ref={bouton} className={`bl-bouton bl-stop ${appui ? 'bl-stop-appui' : ''}`} disabled={!actif}
      aria-label="Arrêter la mission : maintenir une seconde" title="Maintenir pour arrêter la mission"
      onClick={(ev) => ev.stopPropagation()} onPointerDown={(ev) => { ev.stopPropagation(); presser(); }} onPointerUp={lacher} onPointerLeave={lacher}
      onKeyDown={(ev) => { if ((ev.key === 'Enter' || ev.key === ' ') && !ev.repeat) presser(); }} onKeyUp={lacher}>
      <svg className="bl-stop-anneau" viewBox="0 0 52 52" aria-hidden="true"><rect x="2" y="2" width="48" height="48" rx="13" pathLength={1} /></svg>
      <IconeStop />
      {indice && createPortal(<span className="bl-stop-indice" role="status" style={{ left: indice.x, top: indice.y }}>Maintenir pour arrêter</span>, document.body)}
    </button>
  );
}

/**
 * Une tuile du fil : celle de l'éditeur en petit, l'icône en points de sa famille, sa forme (un déclencheur arrondi à
 * gauche, une fin à droite), l'état au coin.
 */
function Tuile({ n }: { n: NoeudFil }) {
  const depart = n.type.famille === 'declencheur';
  const badge = depart ? undefined : n.etat === 'ok' || n.etat === 'echec' || n.etat === 'danger' || n.etat === 'cours' ? n.etat : undefined;
  const autre = { pause: ['‖', 'en pause'], erreur: ['✕', 'erreur'], arrete: ['■', 'arrêtée'] }[n.etat as 'pause' | 'erreur' | 'arrete'];
  const style = {
    ['--famille' as string]: teinte(n.type.famille, 'familles'), ['--t' as string]: `${n.taille}px`,
    ['--etat' as string]: badge ? ETATS_NOEUD[badge].couleur : 'transparent',
  } as CSSProperties;
  return (
    <span className={`bl-tuile bf-tuile-${n.etat} bf-forme-${FAMILLE[n.type.famille]?.forme ?? 'action'}`} style={style}>
      <span className="bl-tuile-matrice"><IconePoints d={ICONES[n.type.icone] ?? ICONES.note} cadre={14} /></span>
      {autre ? <span className={`bf-badge bf-badge-${n.etat}`} aria-label={autre[1]}>{autre[0]}</span> : <BadgeEtat etat={badge} />}
    </span>
  );
}

/**
 * La barre de la mission qui joue. À gauche son nom et son état, au centre le graphe de la mission tel que l'éditeur le
 * dessine, à droite le temps joué et le temps de l'étape, puis le seul bouton : pause, ou reprise.
 *
 * Quand une étape finit, une étincelle part sur le fil qu'a pris la mission — vert pour « réussi », ambre pour
 * « échec » — et la caméra la suit dans tous les sens jusqu'à l'étape suivante, qui s'ouvre à son arrivée.
 *
 * Un clic sur la barre appelle `ouvrir` (déplier le workflow, ou ouvrir l'exécution) ; un clic sur une étape du fil,
 * `ouvrirEtape` s'il est donné. Avec `arreter`, un bouton stop à maintenir. Ce que la barre déplie se range dessous
 * (`children`) ; `developpe` dit qu'il est ouvert. Avec `degager`, une mission en pause, arrêtée ou finie se dégage
 * d'un glissé vers le haut ou vers la droite, comme une notification.
 */
export function BarreFil({ l, pause, acquitter, ouvrir, ouvrirEtape, arreter, developpe, degager, children }: {
  l: Lecture; pause(): void; acquitter(): void; ouvrir?(): void; ouvrirEtape?(noeud: string): void; arreter?(): void;
  developpe?: boolean; degager?(): void; children?: ReactNode;
}) {
  const etapes = trajets(l);
  const t = etapes.at(-1) ?? { cle: '', noeud: null, cible: { x: 0, y: 0 }, lien: null };
  const { vue, monde, etincelle, arrivee } = useTravelling(etapes, ANCRE);
  const arrive = arrivee === t.cle;
  const f = construireFil(l, arrive);
  const ouvert = l.courant >= 0 && arrive ? f.noeuds.find((n) => n.id === t.noeud) : undefined;
  const fini = l.etat === 'reussie' || l.etat === 'erreur' || l.etat === 'arretee';
  const enPause = l.etat === 'pause';
  const e = ETATS[l.etat];
  const halo = l.message?.niveau === 'erreur' ? 'erreur' : enPause ? 'pause' : l.message?.niveau ?? null;
  const degageable = Boolean(degager) && (enPause || fini);
  const { ref: pile, ...gestes } = useGlisser(degageable, degager);
  return (
    <div className={`bl-pile ${degageable ? 'bl-degageable' : ''}`} ref={pile} {...gestes}>
      <div className={`bl-barre bl-etat-${l.etat} ${halo ? `bl-halo-${halo}` : ''} ${ouvrir ? 'bl-cliquable' : ''}`} role="toolbar"
        aria-label={`Mission ${l.mission.nom}`} onClick={ouvrir}>
        <div className="bl-identite">
          {ouvrir ? (
            <button className="bl-nom" aria-expanded={developpe} onClick={(ev) => { ev.stopPropagation(); ouvrir(); }}>{l.mission.nom}</button>
          ) : <strong className="bl-nom" title={l.mission.nom}>{l.mission.nom}</strong>}
          <small className="bl-etat">
            {e.signe ? <b aria-hidden="true">{e.signe}</b> : <i aria-hidden="true" />}
            {l.pasAPas && !fini ? (enPause ? 'Pas à pas · en attente' : 'Pas à pas') : e.libelle}
            {l.tours > 1 && <span className="bl-etat-tour"> · tour {l.tour}/{l.tours}</span>}
          </small>
        </div>

        <div className="bl-centre">
          <div className="bf-vue" ref={vue}>
            <div className="bf-monde" ref={monde}>
              <svg className="bf-liens" width="1" height="1" aria-hidden="true">
                {f.liens.map((k) => (
                  <g key={k.id} className={k.hors ? 'bf-hors' : undefined}>
                    <path d={k.d} data-lien={k.id} className={`bf-lien ${k.pointille ? 'bf-lien-echec' : ''}`} />
                    {k.fleche && <path d={k.fleche} className={`bf-fleche ${k.pointille ? 'bf-lien-echec' : ''}`} />}
                    <OndeChemin d={k.d} etat={k.etat} ton={k.ton} />
                  </g>
                ))}
                {!arrive && f.lienCourant && (
                  <path d={f.lienCourant.d} data-trace pathLength={1} className="bf-trace"
                    style={{ stroke: TONS[f.lienCourant.ton], color: TONS[f.lienCourant.ton], strokeDashoffset: 1 }} />
                )}
                <g ref={etincelle} className="bf-etincelle" style={{ color: TONS[f.lienCourant?.ton ?? 'ok'], opacity: 0 }}>
                  <circle r="8" className="bf-halo" /><circle r="3.2" />
                </g>
              </svg>
              {f.noeuds.map((n) => (
                <div key={n.id} className={`bf-noeud ${n === ouvert ? 'bf-arrive' : ''}`} style={{ left: n.x, top: n.y }}
                  title={n.nom} onClick={ouvrirEtape && ((ev) => { ev.stopPropagation(); ouvrirEtape(n.id); })}>
                  <Tuile n={n} />
                </div>
              ))}
              {ouvert && (
                <span key={t.cle} className="bf-etiquette" style={{ left: ouvert.x, top: ouvert.y + ouvert.taille / 2 + 6 }}>
                  {ouvert.nom}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bl-temps">
          <b>{duree(l.dureeS)}</b>
          <small>{l.etat === 'erreur' || l.etat === 'arretee' ? 'arrêtée' : fini ? 'au total' : l.dureeEtapeS !== null ? `étape ${duree(l.dureeEtapeS)}` : ''}</small>
        </div>
        <button className={`bl-bouton ${enPause && !(l.pasAPas && developpe) ? 'bl-principal' : ''}`} disabled={fini || l.etat === 'urgence'}
          onClick={(ev) => { ev.stopPropagation(); pause(); }}
          aria-label={enPause ? 'Reprendre la mission' : 'Mettre la mission en pause'}
          title={l.etat === 'urgence' ? 'Réarmez l’arrêt d’urgence d’abord' : undefined}>
          {enPause || fini ? <IconeLecture /> : <IconePause />}
        </button>
        {arreter && <BoutonStop arreter={arreter} actif={!fini && l.etat !== 'urgence'} />}
      </div>
      {l.message && <Message key={l.message.texte} m={l.message} urgence={l.etat === 'urgence'} arret={l.etat === 'arretee'} acquitter={acquitter} />}
      {children}
    </div>
  );
}
