import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import type { ReactNode } from 'react';
import { ETATS, FAMILLE, SORTIES, type EtatNoeud } from './charte';
import { ICONES, type TypeNoeud } from './catalogue';

/** L'icône d'un nœud, dans le carré de la couleur de sa famille. */
export function IconeNoeud({ nom, couleur, taille = 16 }: { nom: string; couleur: string; taille?: number }) {
  return (
    <span className="em-icone" style={{ color: couleur, borderColor: `${couleur}55`, background: `${couleur}18` }}>
      <svg width={taille} height={taille} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={ICONES[nom] ?? ICONES.note} /></svg>
    </span>
  );
}

/** La phrase du nœud, ses réglages en pastilles : « Répéter [3] fois ». */
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

export interface ProprietesCarte {
  type: TypeNoeud;
  valeurs?: Record<string, string | number>;
  titre?: string;
  etat?: EtatNoeud;
  choisi?: boolean;
  /** Les poignées de React Flow ; sans elles, la carte est une image (galerie). */
  poignees?: boolean;
}

/**
 * Un nœud de mission. La forme dit le rôle (chapeau, action, question, cadre, fin), la couleur la famille, la
 * bordure l'état d'exécution ; un nœud qui fait bouger le robot porte un badge.
 */
export function CarteNoeud({ type, valeurs = {}, titre, etat, choisi, poignees }: ProprietesCarte) {
  const f = FAMILLE[type.famille];
  const e = etat ? ETATS[etat] : null;
  return (
    <div className={`em-noeud em-forme-${f.forme} ${choisi ? 'choisi' : ''} ${etat ? `em-etat-${etat}` : ''}`}
      style={{ ['--famille' as string]: f.couleur, ['--etat' as string]: e?.couleur ?? 'transparent' }}>
      {poignees && type.entree && <Handle type="target" position={Position.Left} className="em-poignee" />}
      <div className="em-noeud-tete">
        <IconeNoeud nom={type.icone} couleur={f.couleur} />
        <span className="em-noeud-famille">{titre ?? type.nom}</span>
        {type.bouge && (
          <span className="em-badge-bouge" title="Fait bouger le robot" aria-label="Fait bouger le robot">
            <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2.2" strokeLinecap="round"
              strokeLinejoin="round" aria-hidden="true"><path d="M12 2v20M2 12h20M12 2l-3 3M12 2l3 3M12 22l-3-3M12 22l3-3M2 12l3-3M2 12l3 3M22 12l-3-3M22 12l-3 3" /></svg>
          </span>
        )}
        {e && <span className="em-badge-etat" title={e.libelle}>{e.icone}</span>}
      </div>
      <Phrase type={type} valeurs={valeurs} />
      {type.sorties.length > 0 && (
        <div className="em-sorties">
          {type.sorties.filter((s) => SORTIES[s].libelle).map((s) => (
            <span key={s} className={`em-sortie em-sortie-${s}`}>{SORTIES[s].libelle}</span>
          ))}
        </div>
      )}
      {poignees && type.sorties.map((s, i) => (
        <Handle key={s} type="source" position={Position.Right} id={s} className={`em-poignee em-poignee-${s}`}
          style={{ top: type.sorties.length === 1 ? '50%' : `${62 + i * 20}%` }} />
      ))}
    </div>
  );
}

/** Les données d'un nœud du prototype. */
export type DonneesNoeud = {
  type: TypeNoeud;
  valeurs: Record<string, string | number>;
  titre?: string;
  etat?: EtatNoeud;
};

export type NoeudMission = Node<DonneesNoeud, 'carte' | 'cadre'>;

/** Le nœud ordinaire de React Flow. */
export function NoeudCarte({ data, selected }: NodeProps<NoeudMission>) {
  return <CarteNoeud type={data.type} valeurs={data.valeurs} titre={data.titre} etat={data.etat} choisi={selected} poignees />;
}

/**
 * Un cadre de logique (répéter, pour chaque, tant que, réessayer), comme un bloc en C de Scratch : les étapes du tour
 * sont dedans. On y entre par la gauche ; le tour part de la poignée intérieure gauche et revient à la droite ; on en
 * sort par l'extérieur droit (« ensuite », ou « réussi » / « échoué » pour un réessai).
 */
export function NoeudCadre({ data, selected }: NodeProps<NoeudMission>) {
  const f = FAMILLE[data.type.famille];
  const e = data.etat ? ETATS[data.etat] : null;
  const sortiesExterieures = data.type.sorties.filter((s) => s !== 'corps');
  return (
    <div className={`em-cadre ${selected ? 'choisi' : ''} ${data.etat ? `em-etat-${data.etat}` : ''}`}
      style={{ ['--famille' as string]: f.couleur, ['--etat' as string]: e?.couleur ?? 'transparent' }}>
      <Handle type="target" position={Position.Left} className="em-poignee" style={{ top: 26 }} />
      <div className="em-cadre-tete">
        <IconeNoeud nom={data.type.icone} couleur={f.couleur} />
        <Phrase type={data.type} valeurs={data.valeurs} />
        {e && <span className="em-badge-etat" title={e.libelle}>{e.icone}</span>}
      </div>
      <Handle type="source" position={Position.Left} id="corps" className="em-poignee em-poignee-interieure"
        style={{ top: 78, left: 14 }} />
      <Handle type="target" position={Position.Right} id="retour" className="em-poignee em-poignee-interieure"
        style={{ top: 78, right: 14 }} />
      <span className="em-cadre-tour">{data.type.cle === 'essayer' ? 'à chaque essai' : 'à chaque tour'}</span>
      <div className="em-cadre-sorties">
        {sortiesExterieures.map((s) => <span key={s} className={`em-sortie em-sortie-${s}`}>{SORTIES[s].libelle}</span>)}
      </div>
      {sortiesExterieures.map((s, i) => (
        <Handle key={s} type="source" position={Position.Right} id={s} className={`em-poignee em-poignee-${s}`}
          style={{ top: 26 + i * 22 }} />
      ))}
    </div>
  );
}
