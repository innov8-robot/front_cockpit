import { BaseEdge, getBezierPath, type EdgeProps } from '@xyflow/react';
import { cheminRetour, type LienCanevas } from './liens';
import { OndeChemin } from './Onde';

/** Un lien de mission : une courbe vers l'avant, un retour par-dessous ; parcouru ou actif, l'onde par-dessus. */
export function LienPulse({ id, sourceX, sourceY, targetX, targetY, sourcePosition, targetPosition, data, style }: EdgeProps<LienCanevas>) {
  const retour = targetX < sourceX + 20 ? cheminRetour(sourceX, sourceY, targetX, targetY) : null;
  const d = retour?.d ?? getBezierPath({ sourceX, sourceY, sourcePosition, targetX, targetY, targetPosition })[0];
  const etat = data?.etat ?? 'aucun';
  return (
    <>
      <BaseEdge id={id} path={d} style={{ ...style, opacity: etat === 'aucun' ? 0.75 : 1 }} />
      {retour && <path d={retour.fleche} fill={String(style?.stroke ?? '#9aa3ae')} />}
      <OndeChemin d={d} etat={etat} ton={data?.ton ?? 'neutre'} />
    </>
  );
}
