import type { Ref } from 'react';
import { ETATS, FAMILLE } from './charte';
import { typeNoeud } from './catalogue';
import { DEPART, etatDe, PUIS, type Boucle, type Branche, type Geste, type Instant, type Si } from './logique';
import { BadgeEtat, IconeNoeud, Phrase } from './Noeud';

/** Les variables CSS d'une étape : la couleur de sa famille et celle de son état. */
function couleurs(famille: string, etat?: keyof typeof ETATS) {
  return { ['--famille' as string]: FAMILLE[famille].couleur, ['--etat' as string]: etat ? ETATS[etat].couleur : 'transparent' };
}

/** Les essais d'un geste : « ↻ 2 » au repos, « ↻ 2/2 » quand il réessaie. */
function Essais({ n, essai }: { n: number; essai?: number }) {
  return (
    <span className={`lg-essais ${essai && essai > 1 ? 'lg-essais-relance' : ''}`} title={`${n} essais`}>
      ↻ {essai ? `${essai}/${n}` : n}
    </span>
  );
}

interface ProprietesCarte { etape: Geste | Si; inst: Instant; className?: string; ref?: Ref<HTMLDivElement> }

/** Une étape, compacte : son icône, deux ou trois mots, ses essais, la réponse d'une question, son état. */
export function CarteEtape({ etape, inst, className = '', ref }: ProprietesCarte) {
  const t = typeNoeud(etape.genre === 'si' ? 'si' : etape.cle);
  const etat = etatDe(inst, etape.id);
  const reponse = inst.reponses.get(etape.id);
  return (
    <div ref={ref} className={`lg-carte ${etape.genre === 'si' ? 'lg-carte-si' : ''} ${etat ? `em-etat-${etat}` : ''} ${className}`}
      style={couleurs(t.famille, etat)} title={`${FAMILLE[t.famille].nom} · ${t.nom}`}>
      <IconeNoeud nom={t.icone} couleur={FAMILLE[t.famille].couleur} taille={14} />
      <Phrase type={t} valeurs={etape.valeurs ?? {}} />
      {etape.genre === 'geste' && etape.essais ? <Essais n={etape.essais} essai={inst.essais.get(etape.id)} /> : null}
      {reponse && <span className={`lg-reponse lg-reponse-${reponse}`}>{reponse}</span>}
      <BadgeEtat etat={etat} />
    </div>
  );
}

/** La tête d'une boucle : son icône, sa phrase, le tour en cours, son état ; le rond de chargement reste à l'étape du tour. */
export function TeteBoucle({ boucle, inst, className = '', ref }: { boucle: Boucle; inst: Instant; className?: string; ref?: Ref<HTMLDivElement> }) {
  const t = typeNoeud(boucle.cle);
  const etat = etatDe(inst, boucle.id);
  const tour = inst.tours.get(boucle.id);
  return (
    <div ref={ref} className={`lg-carte lg-carte-boucle ${etat ? `em-etat-${etat}` : ''} ${className}`} style={couleurs(t.famille, etat)}
      title={`Logique · ${t.nom}`}>
      <IconeNoeud nom={t.icone} couleur={FAMILLE[t.famille].couleur} taille={14} />
      <Phrase type={t} valeurs={boucle.valeurs ?? {}} />
      {tour ? <span className="lg-tour" aria-label={`tour ${tour}`}>n° {tour}</span> : null}
      {etat !== 'cours' && <BadgeEtat etat={etat} />}
    </div>
  );
}

/** Le bout d'une branche : ce que la mission fait ensuite, écrit au lieu d'un fil qui remonte. */
export function Puce({ branche }: { branche: Branche }) {
  const p = PUIS[branche.puis];
  return <span className={`lg-puis lg-puis-${branche.puis}`}><b>{p.icone}</b>{branche.texte ?? p.texte}</span>;
}

/** Le début ou la fin de la mission : un rond, comme un terminus. */
export function Terminus({ id, inst, ref }: { id: string; inst: Instant; ref?: Ref<HTMLSpanElement> }) {
  const etat = etatDe(inst, id);
  return (
    <span ref={ref} className={`lg-terminus ${etat ? `em-etat-${etat}` : ''}`} style={couleurs('declencheur', etat)}
      title={id === DEPART ? 'Lancement' : 'Fin'}>
      {id === DEPART ? '▶' : '■'}
    </span>
  );
}
