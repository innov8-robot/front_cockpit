import { Handle, Position, type Node, type NodeProps } from '@xyflow/react';
import { TYPES_PRIMITIVE } from '../../api/libelles';
import type { Primitive, TypePrimitive } from '../../api/types';

export const COULEURS_TYPE: Record<TypePrimitive, string> = {
  prise_objet: '#5b8cff',
  prise_boite: '#9b7bff',
  depose: '#35c47c',
  deplacer: '#f2a93b',
  rentrer: '#8a93a3',
};

const GLYPHES: Record<TypePrimitive | 'depart', string> = {
  prise_objet: 'M7 4v6a5 5 0 0 0 10 0V4M7 4h3M14 4h3M12 15v5',
  prise_boite: 'M4 9h16v10H4zM8 9V6h8v3M2 12h2M20 12h2',
  depose: 'M12 4v10M8 10l4 4 4-4M5 20h14',
  deplacer: 'M5 12h14M13 6l6 6-6 6',
  rentrer: 'M15 6l-6 6 6 6',
  depart: 'M7 5l12 7-12 7z',
};

export type DonneesNoeud = {
  primitive: Primitive | null;
  depart: boolean;
  relie: boolean;
  modifiable: boolean;
  supprimer?: () => void;
};

export type NoeudGraphe = Node<DonneesNoeud, 'primitive'>;

function Glyphe({ chemin, couleur }: { chemin: string; couleur: string }) {
  return (
    <span className="noeud-glyphe" style={{ color: couleur, borderColor: `${couleur}55`, background: `${couleur}14` }}>
      <svg width="18" height="18" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"
        strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={chemin} /></svg>
    </span>
  );
}

/** Un nœud de mission : une entrée à gauche, deux sorties à droite (réussi, échoué). Le départ n'a qu'une sortie. */
export function NoeudPrimitive({ data, selected }: NodeProps<NoeudGraphe>) {
  if (data.depart) {
    return (
      <div className={`noeud noeud-depart ${selected ? 'choisi' : ''}`}>
        <Glyphe chemin={GLYPHES.depart} couleur="#ff2d3a" />
        <div className="noeud-texte"><strong>Départ</strong><span>Début de la mission</span></div>
        <Handle type="source" position={Position.Right} id="ok" className="poignee poignee-ok" />
      </div>
    );
  }

  const p = data.primitive;
  const couleur = p ? COULEURS_TYPE[p.type] : '#8a93a3';
  return (
    <div className={`noeud ${selected ? 'choisi' : ''} ${data.relie ? '' : 'non-relie'}`} style={{ ['--couleur' as string]: couleur }}>
      <Handle type="target" position={Position.Left} className="poignee" />
      <Glyphe chemin={p ? GLYPHES[p.type] : GLYPHES.rentrer} couleur={couleur} />
      <div className="noeud-texte">
        <span className="noeud-type">{p ? TYPES_PRIMITIVE[p.type].libelle : 'Primitive supprimée'}</span>
        <strong>{p?.nom ?? '—'}</strong>
        {!data.relie && <span className="noeud-alerte">Non relié au départ</span>}
      </div>
      {data.modifiable && data.supprimer && (
        <button className="noeud-suppr nodrag" aria-label="Retirer" onClick={data.supprimer}>×</button>
      )}
      <div className="noeud-sorties">
        <span className="noeud-sortie">réussi</span>
        <span className="noeud-sortie echec">échoué</span>
      </div>
      <Handle type="source" position={Position.Right} id="ok" className="poignee poignee-ok" style={{ top: '34%' }} />
      <Handle type="source" position={Position.Right} id="echec" className="poignee poignee-echec" style={{ top: '72%' }} />
    </div>
  );
}
