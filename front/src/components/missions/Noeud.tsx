import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { ETATS, FAMILLE, type EtatNoeud, type Sortie } from './charte';
import { ICONES, type TypeNoeud } from './catalogue';

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

/** La phrase du nœud, ses réglages en pastilles : « Répéter [3]× ». */
export function Phrase({ type, valeurs }: { type: TypeNoeud; valeurs: Record<string, string | number> }) {
  const morceaux: ReactNode[] = [];
  type.phrase.split(/(\{[a-z_]+\})/).forEach((m, i) => {
    const cle = m.match(/^\{([a-z_]+)\}$/)?.[1];
    if (!cle) { if (m) morceaux.push(m); return; }
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
  /** Le tour en cours, pour un cadre de boucle. */
  tour?: number;
  desactive?: boolean;
};

export type NoeudMission = Node<DonneesNoeud, 'carte' | 'cadre'>;

/** Le nœud ordinaire de React Flow. */
export function NoeudCarte({ data, selected }: NodeProps<NoeudMission>) {
  return <CarteNoeud type={data.type} valeurs={data.valeurs} etat={data.etat} choisi={selected} desactive={data.desactive} poignees />;
}

/**
 * Un cadre de logique (répéter, pour chaque, tant que, réessayer), comme un bloc en C de Scratch : les étapes du tour
 * sont dedans. On y entre par la gauche ; le tour part de la poignée intérieure gauche (↻) et revient à la droite ; on
 * en sort par l'extérieur droit.
 */
export function NoeudCadre({ data, selected }: NodeProps<NoeudMission>) {
  const f = FAMILLE[data.type.famille];
  const e = data.etat ? ETATS[data.etat] : null;
  const sortiesExterieures = data.type.sorties.filter((s) => s !== 'corps');
  return (
    <div className={`em-cadre ${selected ? 'choisi' : ''} ${data.etat ? `em-etat-${data.etat}` : ''}`}
      style={{ ['--famille' as string]: f.couleur, ['--etat' as string]: e?.couleur ?? 'transparent' }} title={`${f.nom} · ${data.type.nom}`}>
      <Handle type="target" position={Position.Left} className="em-poignee" style={{ top: 22 }} />
      <div className="em-cadre-tete">
        <IconeNoeud nom={data.type.icone} couleur={f.couleur} />
        <Phrase type={data.type} valeurs={data.valeurs} />
        {data.tour ? <span className="em-tour" aria-label={`tour ${data.tour}`}>↻ {data.tour}</span> : null}
        <BadgeEtat etat={data.etat} />
      </div>
      <Handle type="source" position={Position.Left} id="corps" className="em-poignee em-poignee-interieure" style={{ top: 64, left: 14 }} />
      <span className="em-signe-tour" style={{ top: 56, left: 24 }}>↻</span>
      <Handle type="target" position={Position.Right} id="retour" className="em-poignee em-poignee-interieure" style={{ top: 64, right: 14 }} />
      {sortiesExterieures.map((s, i) => (
        <span key={s} className={`em-signe em-signe-${s} em-signe-cadre`} style={{ top: 22 + i * 22 }}>{SIGNES[s] ?? ''}</span>
      ))}
      {sortiesExterieures.map((s, i) => (
        <Handle key={s} type="source" position={Position.Right} id={s} className={`em-poignee em-poignee-${s}`} style={{ top: 22 + i * 22 }} />
      ))}
    </div>
  );
}
