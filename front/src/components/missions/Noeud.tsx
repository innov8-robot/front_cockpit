import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { Fragment, type ReactNode } from 'react';
import { ETATS, FAMILLE, type EtatNoeud, type Sortie } from './charte';
import { ICONES, type TypeNoeud } from './catalogue';
import { BARRE, PIED, placerSections, RAIL, TETE } from './structure';

/** Le signe d'une sortie, posé à côté de sa poignée : peu de texte, un symbole. */
const SIGNES: Partial<Record<Sortie, string>> = { ok: '✓', echec: '✕', vrai: 'oui', faux: 'non', cas1: '1', cas2: '2', autre: '…' };

/** L'icône d'un nœud, dans le carré de la couleur de sa famille. */
export function IconeNoeud({ nom, couleur, taille = 16 }: { nom: string; couleur: string; taille?: number }) {
  return (
    <span className="em-icone" style={{ color: couleur, borderColor: `${couleur}55`, background: `${couleur}18` }}>
      <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONES[nom] ?? ICONES.note} /></svg>
    </span>
  );
}

/** Un mot-clé de pseudocode : écrit tout en capitales dans le catalogue (SI, ALORS, POUR, À, JUSQU'À). */
const MOT_CLE = /^[A-ZÀÂÄÇÉÈÊËÎÏÔÖÙÛÜŒ'’]+$/;

/** Le texte d'une phrase, ses mots-clés mis à part. */
function texte(m: string, cle: string): ReactNode[] {
  return m.split(/(\s+)/).map((mot, j) => (MOT_CLE.test(mot) ? <span key={`${cle}-${j}`} className="em-mot">{mot}</span> : mot));
}

/**
 * La phrase du nœud, ses réglages en pastilles : « RÉPÉTER [3] FOIS ». `modele` remplace la phrase du type, pour la
 * barre d'une section ou la ligne de fin d'une structure.
 */
export function Phrase({ type, valeurs, modele }: { type: TypeNoeud; valeurs: Record<string, string | number>; modele?: string }) {
  const morceaux: ReactNode[] = [];
  (modele ?? type.phrase).split(/(\{[a-z0-9_]+\})/).forEach((m, i) => {
    const cle = m.match(/^\{([a-z0-9_]+)\}$/)?.[1];
    if (!cle) { if (m) morceaux.push(...texte(m, String(i))); return; }
    const r = type.reglages.find((x) => x.cle === cle);
    const v = valeurs[cle] ?? r?.defaut ?? '…';
    morceaux.push(<span key={i} className={`em-pastille ${r?.type === 'condition' ? 'em-pastille-question' : ''}`}>
      {v}{r?.unite ? ` ${r.unite}` : ''}</span>);
  });
  return <span className="em-phrase">{morceaux}</span>;
}

/** L'état d'exécution en haut à droite : un rond qui tourne pendant l'étape, puis ✓, ! ou ■. */
export function BadgeEtat({ etat }: { etat?: EtatNoeud }) {
  if (!etat || etat === 'attente' || etat === 'saute') return null;
  const e = ETATS[etat];
  if (etat === 'cours') return <span className="em-chargement" role="status" aria-label={e.libelle} />;
  return <span className="em-badge-etat" title={e.libelle} aria-label={e.libelle}>{e.icone}</span>;
}

/** Le badge des nœuds qui font bouger le robot : quatre flèches, sans texte. */
function BadgeBouge() {
  return (
    <span className="em-badge-bouge" title="Fait bouger le robot" aria-label="Fait bouger le robot">
      <svg width="11" height="11" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.4" strokeLinecap="round"
        strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" /></svg>
    </span>
  );
}

/** Les sorties d'un nœud : une poignée par sortie, et son signe à côté. */
function Sorties({ sorties, poignees }: { sorties: Sortie[]; poignees?: boolean }) {
  const hauteur = (i: number) => (sorties.length === 1 ? '50%' : `${30 + i * (40 / (sorties.length - 1))}%`);
  return (
    <>
      {sorties.map((s, i) => (
        <span key={s} className={`em-signe em-signe-${s}`} style={{ top: hauteur(i) }}>{SIGNES[s] ?? ''}</span>
      ))}
      {poignees && sorties.map((s, i) => (
        <Handle key={s} type="source" position={Position.Right} id={s} className={`em-poignee em-poignee-${s}`} style={{ top: hauteur(i) }} />
      ))}
    </>
  );
}

export interface ProprietesCarte {
  type: TypeNoeud;
  valeurs?: Record<string, string | number>;
  etat?: EtatNoeud;
  choisi?: boolean;
  desactive?: boolean;
  /** Les poignées de React Flow ; sans elles, la carte est une image (galerie). */
  poignees?: boolean;
}

/**
 * Un nœud de mission : une icône, une phrase courte, son état. La forme dit le rôle (chapeau, action, question, fin),
 * la couleur la famille ; le titre complet est dans l'info-bulle.
 */
export function CarteNoeud({ type, valeurs = {}, etat, choisi, desactive, poignees }: ProprietesCarte) {
  const f = FAMILLE[type.famille];
  const e = etat ? ETATS[etat] : null;
  return (
    <div className={`em-noeud em-forme-${f.forme} ${choisi ? 'choisi' : ''} ${etat ? `em-etat-${etat}` : ''} ${desactive ? 'em-desactive' : ''}`}
      style={{ ['--famille' as string]: f.couleur, ['--etat' as string]: e?.couleur ?? 'transparent' }} title={`${f.nom} · ${type.nom}`}>
      {poignees && type.entree && <Handle type="target" position={Position.Left} className="em-poignee" />}
      <IconeNoeud nom={type.icone} couleur={f.couleur} />
      <Phrase type={type} valeurs={valeurs} />
      {type.bouge && <BadgeBouge />}
      <BadgeEtat etat={etat} />
      <Sorties sorties={type.sorties} poignees={poignees} />
    </div>
  );
}

/** Les données d'un nœud du prototype. */
export type DonneesNoeud = {
  type: TypeNoeud;
  valeurs: Record<string, string | number>;
  etat?: EtatNoeud;
  /** Le tour en cours, pour une boucle. */
  tour?: number;
  /** L'essai en cours, pour « ESSAYER ». */
  essai?: number;
  /** La section prise, pour un « SI » ou un « SELON » qui a choisi. */
  branche?: string;
  /** La boucle revient au début d'un tour : son rail s'allume. */
  reprise?: boolean;
  /** Les hauteurs des sections d'une structure, et celles qui sont vides. */
  hauteurs?: number[];
  vides?: string[];
  desactive?: boolean;
};

export type NoeudMission = Node<DonneesNoeud, 'carte' | 'cadre'>;

/** Le nœud ordinaire de React Flow. */
export function NoeudCarte({ data, selected }: NodeProps<NoeudMission>) {
  return <CarteNoeud type={data.type} valeurs={data.valeurs} etat={data.etat} choisi={selected} desactive={data.desactive} poignees />;
}

/** Ce que la structure vit pendant l'exécution, dans sa tête : « i = 2 », « tour 3 », « essai 2/2 », « vrai ». */
function Direct({ type, valeurs, tour, essai, branche }: { type: TypeNoeud; valeurs: Record<string, string | number>; tour?: number; essai?: number; branche?: string }) {
  const val = (cle: string) => valeurs[cle] ?? type.reglages.find((r) => r.cle === cle)?.defaut;
  if (essai) return <span className={`em-direct ${essai > 1 ? 'em-direct-relance' : ''}`}>essai {essai}/{val('fois')}</span>;
  if (tour && type.cle === 'pour') return <span className="em-direct">{val('variable')} = {Number(val('de')) + (tour - 1) * Number(val('pas') ?? 1)}</span>;
  if (tour) return <span className="em-direct">tour {tour}</span>;
  if (branche === 'alors' || branche === 'sinon') return <span className="em-direct">{branche === 'alors' ? 'vrai' : 'faux'}</span>;
  return null;
}

export interface ProprietesStructure extends Omit<DonneesNoeud, 'desactive'> {
  choisi?: boolean;
  /** Les poignées de React Flow ; sans elles, la structure est une image (galerie). */
  poignees?: boolean;
  /** Ce qu'on écrit dans une section vide. */
  vide?: string;
}

/**
 * Une structure de logique, comme une ligne de pseudocode : une tête (« SI bac plein ALORS »), ses sections séparées
 * par leurs barres (« SINON »), une ligne de fin (« FIN SI »). On y entre par la tête ; ▸ marque où commencent les
 * étapes d'une section ; une section finit à sa dernière étape, sans fil de retour. Le rail de gauche est le chemin du
 * retour d'une boucle : il s'allume quand elle repart pour un tour.
 */
export function CadreStructure({ type, valeurs, etat, tour, essai, branche, reprise, hauteurs, vides, vide = 'rien', choisi, poignees }: ProprietesStructure) {
  const f = FAMILLE[type.famille];
  const { sections, pied, hauteur } = placerSections(type, hauteurs);
  return (
    <div className={`em-struct ${choisi ? 'choisi' : ''} ${etat ? `em-struct-${etat}` : ''} ${reprise ? 'em-struct-reprise' : ''}`}
      style={{ ['--famille' as string]: f.couleur, ['--etat' as string]: etat ? ETATS[etat].couleur : 'transparent', height: poignees ? '100%' : hauteur }}
      title={`${f.nom} · ${type.nom}`}>
      {poignees && <Handle type="target" position={Position.Left} className="em-poignee" style={{ top: TETE / 2 }} />}
      <div className="em-struct-tete" style={{ height: TETE }}>
        <IconeNoeud nom={type.icone} couleur={f.couleur} />
        <Phrase type={type} valeurs={valeurs} />
        <Direct type={type} valeurs={valeurs} tour={tour} essai={essai} branche={branche} />
        {etat !== 'cours' && <BadgeEtat etat={etat} />}
      </div>
      <div className="em-struct-rail" style={{ top: TETE, height: pied - TETE, width: RAIL }} />
      {sections.map((s) => (
        <Fragment key={s.cle}>
          {s.barre !== undefined && (
            <div className={`em-struct-barre em-struct-barre-${s.cle}`} style={{ top: s.barre, height: BARRE }}>
              <Phrase type={type} valeurs={valeurs} modele={s.titre} />
            </div>
          )}
          <div className={`em-struct-section ${branche ? (branche === s.cle ? 'em-struct-prise' : 'em-struct-laissee') : ''}`}
            style={{ top: s.haut, height: s.h, left: RAIL }}>
            {vides?.includes(s.cle) && <span className="em-struct-vide">{vide}</span>}
          </div>
          {poignees
            ? <Handle type="source" position={Position.Right} id={s.cle} className={`em-poignee em-depart em-depart-${s.cle}`} style={{ top: s.depart, left: RAIL + 6, right: 'auto' }} />
            : <span className={`em-depart em-depart-${s.cle} em-depart-image`} style={{ top: s.depart, left: RAIL + 6 }} />}
        </Fragment>
      ))}
      <div className="em-struct-pied" style={{ top: pied, height: PIED }}>
        <Phrase type={type} valeurs={valeurs} modele={type.structure?.fin} />
        {type.structure?.boucle && <span className="em-struct-boucle" aria-label="la boucle revient au début">↻</span>}
      </div>
      {poignees && type.sorties.includes('suite') && <Handle type="source" position={Position.Right} id="suite" className="em-poignee" style={{ top: TETE / 2 }} />}
    </div>
  );
}

/** Une structure posée sur le canevas. */
export function NoeudCadre({ data, selected }: NodeProps<NoeudMission>) {
  return <CadreStructure {...data} choisi={selected} poignees />;
}
