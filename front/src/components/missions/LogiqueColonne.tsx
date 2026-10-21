import { Fragment } from 'react';
import { FAMILLE, type Ton } from './charte';
import { DEPART, FIN, MISSION, etatDe, etatTrait, type Branche, type Etape, type Instant } from './logique';
import { CarteEtape, Puce, TeteBoucle, Terminus } from './LogiqueCommun';
import { OndeChemin } from './Onde';

type Genre = 'suite' | 'echec' | 'oui';

/** Un fil entre deux étapes : vertical sur la colonne, horizontal vers une branche ; l'onde y file vers l'étape en cours. */
function Fil({ de, a, inst, genre = 'suite', horizontal, boucle }: { de: string; a: string; inst: Instant; genre?: Genre; horizontal?: boolean; boucle?: boolean }) {
  const reprise = boucle && (inst.tours.get(a) ?? 1) > 1;
  const brut = etatTrait(inst, de, a);
  const etat = brut === 'actif' && reprise ? 'parcouru' : brut;
  const ton: Ton = genre === 'echec' ? 'echec' : etat === 'actif' ? inst.ton : 'ok';
  const d = horizontal ? 'M0 6H32' : 'M6 0V28';
  return (
    <svg className={`lg-fil ${horizontal ? 'lg-fil-h' : ''}`} width={horizontal ? 38 : 12} height={horizontal ? 12 : 28} aria-hidden="true">
      <path d={d} className={`lg-trait lg-trait-${genre}`} />
      <OndeChemin d={d} etat={etat} ton={ton} />
      {horizontal && <path d="M32 2l6 4-6 4z" className={`lg-fleche-${genre}`} />}
    </svg>
  );
}

/** Une suite d'étapes reliées ; `de` : l'étape d'où vient le premier fil (aucun fil si elle manque). */
function Suite({ etapes, de, inst }: { etapes: Etape[]; de?: string; inst: Instant }) {
  return (
    <>
      {etapes.map((e, i) => {
        const prec = i === 0 ? de : etapes[i - 1].id;
        return (
          <Fragment key={e.id}>
            {prec && <Fil de={prec} a={e.id} inst={inst} boucle={e.genre === 'boucle'} />}
            <Element etape={e} suivant={etapes[i + 1]?.id} inst={inst} />
          </Fragment>
        );
      })}
    </>
  );
}

/** La branche d'un geste ou d'une question, à droite de sa carte : ses étapes, puis ce qu'on fait ensuite. */
function Cote({ de, branche, genre, inst }: { de: string; branche: Branche; genre: Genre; inst: Instant }) {
  const dernier = branche.etapes[branche.etapes.length - 1].id;
  return (
    <div className="lg-cote">
      <Fil de={de} a={branche.etapes[0].id} inst={inst} genre={genre} horizontal />
      {genre === 'oui' && <span className="lg-cote-mot">oui</span>}
      <div className="lg-col">
        <Suite etapes={branche.etapes} inst={inst} />
        <Fil de={dernier} a="" inst={inst} genre={genre} />
        <Puce branche={branche} />
      </div>
    </div>
  );
}

/** Une étape de la colonne ; `suivant` : l'étape d'après, pour prolonger la ligne sous une branche. */
function Element({ etape: e, suivant, inst }: { etape: Etape; suivant?: string; inst: Instant }) {
  if (e.genre === 'boucle') {
    const reprise = inst.actif === e.id && (inst.tours.get(e.id) ?? 1) > 1;
    return (
      <div className={`lg-col-boucle ${etatDe(inst, e.id) ? `lg-c-${etatDe(inst, e.id)}` : ''}`} style={{ ['--famille' as string]: FAMILLE.logique.couleur }}>
        <TeteBoucle boucle={e} inst={inst} className="lg-col-tete" />
        <div className="lg-col">
          <Suite etapes={e.corps} de={e.id} inst={inst} />
        </div>
        <span className={`lg-col-retour ${reprise ? 'lg-col-retour-actif' : ''}`} aria-label="retour au début du tour" />
      </div>
    );
  }
  const branche = e.genre === 'si' ? e.alors : e.siEchec;
  return (
    <div className="lg-ligne">
      <div className="lg-tronc">
        <CarteEtape etape={e} inst={inst} />
        {branche && suivant && <span className={`lg-prolonge ${inst.etats.has(e.id) && inst.etats.has(suivant) ? 'lg-prolonge-parcouru' : ''}`} />}
      </div>
      {branche && <Cote de={e.id} branche={branche} genre={e.genre === 'si' ? 'oui' : 'echec'} inst={inst} />}
    </div>
  );
}

/**
 * C · La colonne, comme Zapier. La mission descend ; tout ce qui sort du chemin normal part à droite et finit par ce
 * qu'on fait ensuite ; une boucle est une boîte dont le bord gauche remonte au début du tour.
 */
export function LogiqueColonne({ inst }: { inst: Instant }) {
  const dernier = MISSION[MISSION.length - 1].id;
  return (
    <div className="lg-colonne">
      <div className="lg-col">
        <div className="lg-borne"><Terminus id={DEPART} inst={inst} />Au lancement</div>
        <Suite etapes={MISSION} de={DEPART} inst={inst} />
        <Fil de={dernier} a={FIN} inst={inst} />
        <div className="lg-borne"><Terminus id={FIN} inst={inst} />Fin</div>
      </div>
    </div>
  );
}
