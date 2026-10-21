import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../../api/client';
import { ETATS_MISSION, ISSUES_RUN, depuis } from '../../api/libelles';
import type { EtatMission, Execution, Mission, Primitive } from '../../api/types';
import { typePrimitive } from '../graphe/correspondance';
import { teinte } from '../missions/apparence';
import { ICONES } from '../missions/catalogue';
import { chrono, COULEUR_ETAT, type Resume } from './donnees';

/** L'état d'une mission : un point de sa couleur (qui respire en cours) et son nom. */
export function PointEtat({ etat, texte = true }: { etat: EtatMission; texte?: boolean }) {
  return (
    <span className={`lm-etat lm-etat-${etat}`} style={{ ['--etat' as string]: COULEUR_ETAT[etat] }}>
      <i aria-hidden="true" />{texte && ETATS_MISSION[etat].libelle}
    </span>
  );
}

/** Une petite tuile de primitive, de la couleur de sa famille, avec son icône. */
function Tuile({ primitive, etat }: { primitive: Primitive | null; etat?: 'fait' | 'cours' }) {
  const t = typePrimitive(primitive ?? undefined);
  return (
    <span className={`lm-tuile ${etat ? `lm-tuile-${etat}` : ''}`} style={{ ['--famille' as string]: teinte(t.famille, 'familles') }} title={t.nom}>
      <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true"><path d={ICONES[t.icone] ?? ICONES.note} /></svg>
    </span>
  );
}

/** La chaîne d'une mission en tuiles, du lancement au bout ; pendant une exécution, le chemin joué et l'étape en cours. */
export function MiniChaine({ r, execution }: { r: Resume; execution: Execution | null }) {
  const enCours = execution?.missionId === r.mission.id ? execution : null;
  return (
    <span className="lm-chaine" aria-label={`${r.chaine.length} primitives`}>
      <span className="lm-tuile lm-tuile-depart" title="Au lancement">
        <svg width="11" height="11" viewBox="0 0 24 24" aria-hidden="true"><path d={ICONES.eclair} fill="currentColor" /></svg>
      </span>
      {r.chaine.map((c, i) => (
        <span key={c.noeud} className="lm-maillon">
          <span className="lm-fil" />
          <Tuile primitive={c.primitive} etat={enCours ? (i + 1 < enCours.etape ? 'fait' : i + 1 === enCours.etape ? 'cours' : undefined) : undefined} />
        </span>
      ))}
      {r.echecs > 0 && <span className="lm-echecs" title={`${r.echecs} primitive${r.echecs > 1 ? 's' : ''} avec une sortie « échec »`}>↘ {r.echecs}</span>}
      {r.chaine.length === 0 && <span className="lm-vide">aucune primitive</span>}
    </span>
  );
}

/** Les derniers runs, un trait chacun : vert réussi, ambre échoué, gris interrompu ; vides si la mission joue peu. */
export function BandeRuns({ r, nb = 8 }: { r: Resume; nb?: number }) {
  const vides = Math.max(0, nb - r.runs.length);
  return (
    <span className="lm-runs" aria-label="Derniers runs">
      {Array.from({ length: vides }, (_, i) => <i key={`v${i}`} className="lm-run-vide" />)}
      {r.runs.map((u) => (
        <i key={u.id} className={`lm-run-${u.issue}`} title={`${ISSUES_RUN[u.issue].libelle} · ${depuis(u.debut)} · ${chrono(u.dureeS)}${u.cause ? ` · ${u.cause}` : ''}`} />
      ))}
    </span>
  );
}

/** Les chiffres d'une mission : réussite, durée moyenne, répétitions, dernier lancement. */
export function Chiffres({ r }: { r: Resume }) {
  return (
    <span className="lm-chiffres">
      {r.taux !== null ? <b className={r.taux >= 0.8 ? 'lm-bon' : 'lm-moyen'}>{Math.round(r.taux * 100)} %</b>
        : <span>{r.runs.length ? 'aucun run terminé' : 'jamais lancée'}</span>}
      {r.dureeMoyS !== null && <span>{chrono(r.dureeMoyS)}</span>}
      <span>×{r.mission.repetitions}</span>
      {r.dernier && <span>{depuis(r.dernier.debut)}</span>}
    </span>
  );
}

/** La mission qui joue : l'étape, le chrono, le tour, l'avancement, et la pause. */
export function Progression({ r, execution, pause }: { r: Resume; execution: Execution; pause(): void }) {
  const etape = r.chaine[execution.etape - 1];
  const total = r.chaine.length || 1;
  const fait = (execution.etape - 1 + execution.avancement) / total;
  return (
    <div className="lm-progression">
      <span className="lm-progression-texte">
        <b>{execution.enPause ? 'En pause' : `Étape ${execution.etape}/${total}`}</b>
        {etape?.primitive && <span>{etape.primitive.nom}</span>}
        <span className="lm-chrono">{chrono(execution.dureeS)}{execution.repetitions > 1 && ` · tour ${execution.repetition}/${execution.repetitions}`}</span>
      </span>
      <span className="lm-barre"><i style={{ width: `${Math.round(fait * 100)}%` }} /></span>
      <button className="lm-bouton" onClick={pause} aria-label={execution.enPause ? 'Reprendre' : 'Mettre en pause'}>{execution.enPause ? '▶' : '❚❚'}</button>
    </div>
  );
}

/** Une icône au trait de 24 × 24, pour les boutons carrés. */
export function Trait({ d, taille = 16 }: { d: string; taille?: number }) {
  return (
    <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round"
      strokeLinejoin="round" aria-hidden="true"><path d={d} /></svg>
  );
}

const TROIS_POINTS = 'M5 12h.01M12 12h.01M19 12h.01';

/**
 * Les gestes d'une mission, toujours affichés (l'interface est faite pour la tablette) : la lancer, l'ouvrir dans
 * l'éditeur, et le menu « ⋯ » des actions rapides.
 */
export function Gestes({ m, peutLancer, lancer, menu }: { m: Mission; peutLancer: boolean; lancer(): void; menu?: ReactNode }) {
  return (
    <span className="lm-gestes">
      <button className="lm-bouton lm-lancer" disabled={!peutLancer} onClick={lancer} title={peutLancer ? 'Lancer la mission' : 'Le robot n’est pas disponible, ou la mission est vide'}>
        <Trait d="M8 5l11 7-11 7z" taille={13} />Lancer
      </button>
      <Link className="lm-bouton" to={`/missions/${m.id}`}>Éditer</Link>
      {menu}
    </span>
  );
}

/** La place qu'il faut sous le bouton pour y ouvrir le menu ; sinon il s'ouvre au-dessus (la barre du robot est en bas). */
const PLACE_SOUS_MENU = 300;

/** Où poser le menu, en position fixe : sous son bouton, aligné à droite, ou au-dessus s'il n'a pas la place. */
function placer(bouton: HTMLElement): CSSProperties {
  const r = bouton.getBoundingClientRect();
  const droite = innerWidth - r.right;
  return innerHeight - r.bottom > PLACE_SOUS_MENU ? { top: r.bottom + 6, right: droite } : { bottom: innerHeight - r.top + 6, right: droite };
}

/**
 * Le menu « ⋯ » d'une mission : renommer, dupliquer, supprimer (avec confirmation). Il s'ouvre au-dessus de tout,
 * hors de la liste qui défile et le couperait. Échap ou un appui ailleurs le ferme sans fermer l'écran des missions.
 */
export function MenuMission({ m, enCours, renommer, relire }: { m: Mission; enCours: boolean; renommer(): void; relire(): void }) {
  const [place, setPlace] = useState<CSSProperties | null>(null);
  const ouvert = place !== null;
  const [confirmer, setConfirmer] = useState(false);
  const boite = useRef<HTMLSpanElement>(null);
  const menu = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!ouvert) return;
    const dehors = (e: PointerEvent) => {
      const cible = e.target as Node;
      if (!boite.current?.contains(cible) && !menu.current?.contains(cible)) fermer();
    };
    const echap = (e: KeyboardEvent) => { if (e.key === 'Escape') { e.stopPropagation(); fermer(); } };
    document.addEventListener('pointerdown', dehors);
    window.addEventListener('keydown', echap, true);
    return () => { document.removeEventListener('pointerdown', dehors); window.removeEventListener('keydown', echap, true); };
  }, [ouvert]);
  function fermer() { setPlace(null); setConfirmer(false); }
  async function dupliquer() {
    fermer();
    await api.enregistrerMission({ ...m, id: '', nom: `${m.nom} (copie)`, etat: 'brouillon' }).catch(() => undefined);
    relire();
  }
  async function supprimer() {
    fermer();
    await api.supprimerMission(m.id).catch(() => undefined);
    relire();
  }
  return (
    <span className="lm-plus" ref={boite}>
      <button className="lm-bouton lm-carre-petit" aria-label={`Plus d’actions pour ${m.nom}`} aria-expanded={ouvert}
        onClick={(e) => (ouvert ? fermer() : setPlace(placer(e.currentTarget)))}>
        <Trait d={TROIS_POINTS} taille={18} />
      </button>
      {place && createPortal(
        <div className="lm-menu" role="menu" ref={menu} style={place}>
          <button role="menuitem" onClick={() => { fermer(); renommer(); }}><Trait d="M4 20h4L19 9l-4-4L4 16zM14 6l4 4" />Renommer</button>
          <button role="menuitem" onClick={dupliquer}><Trait d="M8 8h11v11H8zM5 15V5h10" />Dupliquer</button>
          <Link role="menuitem" to={`/missions/${m.id}`}><Trait d="M4 20h16M6 16l9-9 3 3-9 9H6z" />Ouvrir l’éditeur</Link>
          <hr />
          {confirmer ? (
            <div className="lm-menu-confirmer">
              <p>Supprimer « {m.nom} » ?</p>
              <span>
                <button className="lm-bouton" onClick={() => setConfirmer(false)}>Annuler</button>
                <button className="lm-bouton lm-danger" onClick={supprimer}>Supprimer</button>
              </span>
            </div>
          ) : (
            <button role="menuitem" className="lm-menu-suppr" disabled={enCours} title={enCours ? 'Arrêtez la mission avant de la supprimer' : undefined}
              onClick={() => setConfirmer(true)}><Trait d="M4 7h16M10 11v6M14 11v6M6 7l1 13h10l1-13M9 7V4h6v3" />Supprimer</button>
          )}
        </div>,
        document.body,
      )}
    </span>
  );
}

/** Le nom d'une mission : un lien vers l'éditeur, ou un champ quand on la renomme (Entrée garde, Échap annule). */
export function NomMission({ m, enEdition, finir, relire }: { m: Mission; enEdition: boolean; finir(): void; relire(): void }) {
  const [nom, setNom] = useState(m.nom);
  if (!enEdition) return <Link className="lm-nom" to={`/missions/${m.id}`}>{m.nom}</Link>;
  async function garder() {
    finir();
    const propre = nom.trim();
    if (propre && propre !== m.nom) await api.enregistrerMission({ ...m, nom: propre }).catch(() => undefined);
    relire();
  }
  return (
    <input className="lm-nom-edition" value={nom} autoFocus aria-label="Nouveau nom de la mission" onChange={(e) => setNom(e.target.value)}
      onBlur={garder} onKeyDown={(e) => {
        if (e.key === 'Enter') garder();
        if (e.key === 'Escape') { e.stopPropagation(); setNom(m.nom); finir(); }
      }} />
  );
}

/** Le graphe d'une mission en miniature, pour une carte : les tuiles à leur place, les liens, l'étape en cours. */
export function MiniGraphe({ m, primitives, execution, largeur = 300, hauteur = 120 }: {
  m: Mission; primitives: Primitive[]; execution: Execution | null; largeur?: number; hauteur?: number;
}) {
  const parId = new Map(primitives.map((p) => [p.id, p]));
  const xs = m.noeuds.map((n) => n.x);
  const ys = m.noeuds.map((n) => n.y);
  const marge = 18;
  const [x0, x1, y0, y1] = [Math.min(...xs), Math.max(...xs) + 76, Math.min(...ys), Math.max(...ys) + 76];
  const k = Math.min((largeur - 2 * marge) / Math.max(x1 - x0, 1), (hauteur - 2 * marge) / Math.max(y1 - y0, 1), 0.3);
  const ox = (largeur - (x1 - x0) * k) / 2;
  const oy = (hauteur - (y1 - y0) * k) / 2;
  const cote = 76 * k;
  const pos = (id: string) => {
    const n = m.noeuds.find((x) => x.id === id)!;
    return { x: ox + (n.x - x0) * k, y: oy + (n.y - y0) * k };
  };
  const enCours = execution?.missionId === m.id ? execution.chemin[execution.etape] : null;
  return (
    <svg className="lm-graphe" viewBox={`0 0 ${largeur} ${hauteur}`} aria-hidden="true">
      {m.liens.map((l) => {
        const a = pos(l.de);
        const b = pos(l.vers);
        const [sx, sy, tx, ty] = [a.x + cote, a.y + cote / 2, b.x, b.y + cote / 2];
        const c = Math.max(12, (tx - sx) / 2);
        return <path key={l.id} d={`M${sx} ${sy}C${sx + c} ${sy} ${tx - c} ${ty} ${tx} ${ty}`} className={`lm-graphe-lien ${l.sortie === 'echec' ? 'lm-graphe-echec' : ''}`} />;
      })}
      {m.noeuds.map((n) => {
        const p = pos(n.id);
        const t = n.primitiveId === null ? null : typePrimitive(parId.get(n.primitiveId));
        const couleur = t ? teinte(t.famille, 'familles') : '#e9eef7';
        return (
          <rect key={n.id} x={p.x} y={p.y} width={cote} height={cote} rx={n.primitiveId === null ? cote / 2 : 3}
            className={n.id === enCours ? 'lm-graphe-cours' : ''} style={{ fill: `${couleur}26`, stroke: couleur }} />
        );
      })}
    </svg>
  );
}
