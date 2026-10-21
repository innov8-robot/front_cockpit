import { useLayoutEffect, useRef, useState, type ReactNode } from 'react';
import { FAMILLE } from './charte';
import { DEPART, FIN, MISSION, etatDe, type Etape, type Instant } from './logique';
import { CarteEtape, Puce, TeteBoucle, Terminus } from './LogiqueCommun';

type Noter = (id: string) => (el: HTMLElement | null) => void;

/** Un bloc en C : une tête, un bras qui tient les étapes, un pied. */
function BlocC({ couleur, tete, pied, etat, children }: { couleur: string; tete: ReactNode; pied?: ReactNode; etat?: string; children: ReactNode }) {
  return (
    <div className={`lg-c ${etat ? `lg-c-${etat}` : ''}`} style={{ ['--famille' as string]: couleur }}>
      {tete}
      <div className="lg-c-bras" />
      <div className="lg-c-corps">{children}</div>
      <div className="lg-c-pied">{pied}</div>
    </div>
  );
}

function Pile({ etapes, inst, noter }: { etapes: Etape[]; inst: Instant; noter: Noter }) {
  return <div className="lg-pile">{etapes.map((e) => <Bloc key={e.id} etape={e} inst={inst} noter={noter} />)}</div>;
}

function Bloc({ etape: e, inst, noter }: { etape: Etape; inst: Instant; noter: Noter }) {
  if (e.genre === 'boucle') {
    return (
      <BlocC couleur={FAMILLE.logique.couleur} etat={etatDe(inst, e.id)} pied={<span className="lg-c-signe">↻</span>}
        tete={<TeteBoucle boucle={e} inst={inst} className="lg-c-tete" ref={noter(e.id)} />}>
        <Pile etapes={e.corps} inst={inst} noter={noter} />
      </BlocC>
    );
  }
  if (e.genre === 'si') {
    return (
      <BlocC couleur={FAMILLE.logique.couleur} tete={<CarteEtape etape={e} inst={inst} className="lg-c-tete" ref={noter(e.id)} />}>
        <Pile etapes={e.alors.etapes} inst={inst} noter={noter} />
      </BlocC>
    );
  }
  return (
    <div className="lg-geste">
      <CarteEtape etape={e} inst={inst} className="lg-carte-bloc" ref={noter(e.id)} />
      {e.siEchec && (
        <BlocC couleur="#ffb02e" tete={<div className="lg-c-tete lg-c-tete-echec">✕ si ça rate</div>} pied={<Puce branche={e.siEchec} />}>
          <Pile etapes={e.siEchec.etapes} inst={inst} noter={noter} />
        </BlocC>
      )}
    </div>
  );
}

/**
 * B · Les blocs empilés, comme Scratch. La mission se lit de haut en bas comme un texte ; une boucle ou une question
 * tient ses étapes dans un bloc en C ; « si ça rate » s'accroche sous le geste. Aucun fil. Une tête de lecture, à
 * gauche, montre l'étape en cours.
 */
export function LogiqueBlocs({ inst }: { inst: Instant }) {
  const boite = useRef<HTMLDivElement>(null);
  const reperes = useRef(new Map<string, HTMLElement>());
  const [lecture, setLecture] = useState<number | null>(null);
  const noter: Noter = (id) => (el) => {
    if (el) reperes.current.set(id, el);
    else reperes.current.delete(id);
  };
  useLayoutEffect(() => {
    const el = inst.actif ? reperes.current.get(inst.actif) : undefined;
    const b = boite.current;
    if (!el || !b) { setLecture(null); return; }
    const r = el.getBoundingClientRect();
    setLecture(r.top - b.getBoundingClientRect().top + r.height / 2);
  }, [inst.actif]);
  return (
    <div className="lg-blocs" ref={boite}>
      <span className={`lg-tete-lecture ${lecture === null ? 'lg-cachee' : ''}`} style={{ transform: `translateY(${lecture ?? 0}px)` }} aria-hidden="true" />
      <div className="lg-bloc-chapeau" ref={noter(DEPART)}><Terminus id={DEPART} inst={inst} />Au lancement</div>
      <Pile etapes={MISSION} inst={inst} noter={noter} />
      <div className="lg-bloc-fin" ref={noter(FIN)}><Terminus id={FIN} inst={inst} />Fin</div>
    </div>
  );
}
