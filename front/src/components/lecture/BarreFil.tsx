import type { CSSProperties } from 'react';
import { Link } from 'react-router-dom';
import { duree } from '../executions/donnees';
import { typePrimitive } from '../graphe/correspondance';
import { teinte } from '../missions/apparence';
import { ICONES, typeNoeud } from '../missions/catalogue';
import { ETATS as ETATS_NOEUD, TONS } from '../missions/charte';
import { BadgeEtat, IconePoints } from '../missions/Noeud';
import { OndeChemin } from '../missions/Onde';
import { construireFil, trajet, type NoeudFil } from './fil';
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
};

/** Le signe d'un message, dans sa couleur. */
const SIGNES: Record<MessageLecture['niveau'], string> = { succes: '✓', attention: '!', erreur: '✕' };

/**
 * Le message sous la barre, de la couleur de son halo. Une erreur reste jusqu'à ce qu'on l'acquitte ; un avertissement
 * s'efface seul, ou d'une croix.
 */
function Message({ m, urgence, acquitter }: { m: MessageLecture; urgence: boolean; acquitter(): void }) {
  return (
    <div className={`bl-message bl-message-${m.niveau}`} role={m.niveau === 'erreur' ? 'alert' : 'status'}>
      <b aria-hidden="true">{urgence ? '■' : SIGNES[m.niveau]}</b>
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

function IconePause() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><rect x="6" y="5" width="4" height="14" rx="1" fill="currentColor" /><rect x="14" y="5" width="4" height="14" rx="1" fill="currentColor" /></svg>;
}

function IconeLecture() {
  return <svg width="18" height="18" viewBox="0 0 24 24" aria-hidden="true"><path d="M7 5l12 7-12 7z" fill="currentColor" /></svg>;
}

/** Une tuile du fil : celle de l'éditeur en petit, l'icône en points de sa famille, l'état au coin. */
function Tuile({ n }: { n: NoeudFil }) {
  const type = n.depart ? typeNoeud('au_lancement') : typePrimitive(n.primitive);
  const badge = n.depart ? undefined : n.etat === 'ok' || n.etat === 'echec' || n.etat === 'danger' || n.etat === 'cours' ? n.etat : undefined;
  const style = {
    ['--famille' as string]: teinte(type.famille, 'familles'), ['--t' as string]: `${n.taille}px`,
    ['--etat' as string]: badge ? ETATS_NOEUD[badge].couleur : 'transparent',
  } as CSSProperties;
  return (
    <span className={`bl-tuile bf-tuile-${n.etat} ${n.depart ? 'bf-depart' : ''}`} style={style}>
      <span className="bl-tuile-matrice"><IconePoints d={ICONES[type.icone] ?? ICONES.note} cadre={14} /></span>
      {n.etat === 'pause' ? <span className="bf-badge bf-badge-pause" aria-label="en pause">‖</span>
        : n.etat === 'erreur' ? <span className="bf-badge bf-badge-erreur" aria-label="erreur">✕</span> : <BadgeEtat etat={badge} />}
    </span>
  );
}

/**
 * La barre de la mission qui joue. À gauche son nom et son état, au centre le graphe de la mission tel que l'éditeur le
 * dessine, à droite le temps joué et le temps de l'étape, puis le seul bouton : pause, ou reprise.
 *
 * Quand une étape finit, une étincelle part sur le fil qu'a pris la mission — vert pour « réussi », ambre pour
 * « échec » — et la caméra la suit dans tous les sens jusqu'à l'étape suivante, qui s'ouvre à son arrivée.
 */
export function BarreFil({ l, pause, acquitter, lien }: { l: Lecture; pause(): void; acquitter(): void; lien?: string }) {
  const t = trajet(l);
  const { vue, monde, etincelle, arrivee } = useTravelling(t.cle, t.cible, t.lien, ANCRE);
  const arrive = arrivee === t.cle;
  const f = construireFil(l, arrive);
  const ouvert = l.courant >= 0 && arrive ? f.noeuds.find((n) => n.id === t.noeud) : undefined;
  const fini = l.etat === 'reussie' || l.etat === 'erreur';
  const enPause = l.etat === 'pause';
  const e = ETATS[l.etat];
  return (
    <div className="bl-pile">
      <div className={`bl-barre bl-etat-${l.etat} ${l.message ? `bl-halo-${l.message.niveau}` : ''}`} role="toolbar" aria-label={`Mission ${l.mission.nom}`}>
        <div className="bl-identite">
          {lien ? <Link className="bl-nom" to={lien} title={`Ouvrir ${l.mission.nom}`}>{l.mission.nom}</Link>
            : <strong className="bl-nom" title={l.mission.nom}>{l.mission.nom}</strong>}
          <small className="bl-etat">
            {e.signe ? <b aria-hidden="true">{e.signe}</b> : <i aria-hidden="true" />}
            {e.libelle}{l.tours > 1 && <span className="bl-etat-tour"> · tour {l.tour}/{l.tours}</span>}
          </small>
        </div>

        <div className="bl-centre">
          <div className="bf-vue" ref={vue}>
            <div className="bf-monde" ref={monde}>
              <svg className="bf-liens" width="1" height="1" aria-hidden="true">
                {f.liens.map((k) => (
                  <g key={k.id} className={k.hors ? 'bf-hors' : undefined}>
                    <path d={k.d} data-lien={k.id} className={`bf-lien ${k.echec ? 'bf-lien-echec' : ''}`} />
                    {k.fleche && <path d={k.fleche} className={`bf-fleche ${k.echec ? 'bf-lien-echec' : ''}`} />}
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
                  title={n.depart ? 'Lancement' : n.primitive?.nom}>
                  <Tuile n={n} />
                </div>
              ))}
              {ouvert && (
                <span key={t.cle} className="bf-etiquette" style={{ left: ouvert.x, top: ouvert.y + ouvert.taille / 2 + 6 }}>
                  {ouvert.primitive?.nom ?? 'Primitive supprimée'}
                </span>
              )}
            </div>
          </div>
        </div>

        <div className="bl-temps">
          <b>{duree(l.dureeS)}</b>
          <small>{l.etat === 'erreur' ? 'arrêtée' : fini ? 'au total' : l.dureeEtapeS !== null ? `étape ${duree(l.dureeEtapeS)}` : ''}</small>
        </div>
        <button className={`bl-bouton ${enPause ? 'bl-principal' : ''}`} disabled={fini || l.etat === 'urgence'} onClick={pause}
          aria-label={enPause ? 'Reprendre la mission' : 'Mettre la mission en pause'}
          title={l.etat === 'urgence' ? 'Réarmez l’arrêt d’urgence d’abord' : undefined}>
          {enPause || fini ? <IconeLecture /> : <IconePause />}
        </button>
      </div>
      {l.message && <Message key={l.message.texte} m={l.message} urgence={l.etat === 'urgence'} acquitter={acquitter} />}
    </div>
  );
}
