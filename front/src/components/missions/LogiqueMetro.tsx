import { useEffect, useId, useRef } from 'react';
import type { EtatLien, Ton } from './charte';
import { DEPART, FIN, MISSION, type Boucle, type Branche, type Etape, type Geste, type Instant, type Si } from './logique';
import { CarteEtape, Puce, TeteBoucle, Terminus } from './LogiqueCommun';
import { OndeChemin } from './Onde';

const W = 180;
const W_SI = 150;
const H = 40;
const ECART = 40;
const RANG = 84;
const MARGE = 22;
const TETE = 46;
const PUCE = 140;
const TERM = 26;

type Genre = 'suite' | 'echec' | 'oui' | 'retour';
const COULEUR: Record<Genre, string> = { suite: '#e9eef7', echec: '#ffb02e', oui: '#e879f9', retour: '#e879f9' };

/** Un trait de la ligne ; `aussi` : la boucle dont il porte l'entrée (ou le retour). */
interface Trait { d: string; de: string; a: string; aussi?: string; genre: Genre }

interface Plan {
  cartes: { etape: Geste | Si; x: number; y: number }[];
  cadres: { boucle: Boucle; x: number; y: number; w: number; h: number }[];
  puces: { branche: Branche; x: number; y: number }[];
  etiquettes: { x: number; y: number; texte: string }[];
  traits: Trait[];
}

/** Ce qu'une étape placée laisse à la suivante : où la ligne entre et sort, jusqu'où elle s'étend. */
interface Place { entree: string; sortie: string; gauche: number; droite: number; avance: number; etendue: number; bas: number }

function placerSuite(plan: Plan, etapes: Etape[], x0: number, y: number): Place {
  let premier: Place | undefined;
  let prec: Place | undefined;
  let x = x0;
  let etendue = x0;
  let bas = y + H;
  for (const e of etapes) {
    const p = placerEtape(plan, e, x, y);
    if (prec) plan.traits.push({ d: `M${prec.droite} ${y + H / 2}H${p.gauche}`, de: prec.sortie, a: p.entree, aussi: e.genre === 'boucle' ? e.id : undefined, genre: 'suite' });
    premier ??= p;
    prec = p;
    x = p.avance + ECART;
    etendue = Math.max(etendue, p.etendue);
    bas = Math.max(bas, p.bas);
  }
  return { entree: premier!.entree, sortie: prec!.sortie, gauche: premier!.gauche, droite: prec!.droite, avance: prec!.avance, etendue, bas };
}

/** Un geste ou une question : sa carte sur la ligne, et sa branche dessous. */
function placerEtape(plan: Plan, e: Etape, x: number, y: number): Place {
  if (e.genre === 'boucle') return placerBoucle(plan, e, x, y);
  const w = e.genre === 'si' ? W_SI : W;
  plan.cartes.push({ etape: e, x, y });
  const p: Place = { entree: e.id, sortie: e.id, gauche: x, droite: x + w, avance: x + w, etendue: x + w, bas: y + H };
  const branche = e.genre === 'si' ? e.alors : e.siEchec;
  if (!branche) return p;
  const yb = y + RANG;
  const xb = x + 36;
  const ym = yb + H / 2;
  const b = placerSuite(plan, branche.etapes, xb, yb);
  const genre: Genre = e.genre === 'si' ? 'oui' : 'echec';
  plan.traits.push({ d: `M${x + 18} ${y + H}V${ym - 8}Q${x + 18} ${ym} ${x + 26} ${ym}H${xb}`, de: e.id, a: b.entree, genre });
  if (e.genre === 'si') {
    const xr = b.etendue + 26;
    plan.traits.push({ d: `M${b.droite} ${ym}H${xr - 8}Q${xr} ${ym} ${xr} ${ym - 8}V${y + H / 2}`, de: b.sortie, a: '', genre });
    plan.etiquettes.push({ x: x + 24, y: y + H + 16, texte: 'oui' }, { x: x + w + 8, y: y + H / 2 - 6, texte: 'non' });
    return { ...p, avance: xr, etendue: xr, bas: b.bas };
  }
  const xp = b.etendue + 16;
  plan.traits.push({ d: `M${b.droite} ${ym}H${xp}`, de: b.sortie, a: '', genre });
  plan.puces.push({ branche, x: xp, y: ym - 13 });
  return { ...p, etendue: xp + PUCE, bas: b.bas };
}

/** Une boucle : un cadre que la ligne traverse ; son retour passe sous son corps, dans sa couleur. */
function placerBoucle(plan: Plan, b: Boucle, x: number, y: number): Place {
  const c = placerSuite(plan, b.corps, x + MARGE, y);
  const droite = c.etendue + MARGE;
  const bas = c.bas + 32;
  plan.cadres.push({ boucle: b, x, y: y - TETE, w: droite - x, h: bas - y + TETE });
  const ym = y + H / 2;
  const xr = droite - 12;
  const xl = x + 10;
  const yr = bas - 14;
  plan.traits.push({
    d: `M${xr - 8} ${ym}Q${xr} ${ym} ${xr} ${ym + 8}V${yr - 8}Q${xr} ${yr} ${xr - 8} ${yr}H${xl + 8}Q${xl} ${yr} ${xl} ${yr - 8}V${ym + 8}Q${xl} ${ym} ${xl + 8} ${ym}H${c.gauche}`,
    de: b.id, a: c.entree, aussi: b.id, genre: 'retour',
  });
  return { entree: c.entree, sortie: b.id, gauche: c.gauche, droite: c.droite, avance: droite, etendue: droite, bas };
}

function planifier() {
  const plan: Plan = { cartes: [], cadres: [], puces: [], etiquettes: [], traits: [] };
  const y = TETE + 26;
  const ym = y + H / 2;
  const c = placerSuite(plan, MISSION, TERM + ECART, y);
  const xf = c.avance + ECART;
  plan.traits.push({ d: `M${TERM} ${ym}H${c.gauche}`, de: DEPART, a: c.entree, genre: 'suite' });
  plan.traits.push({ d: `M${c.droite} ${ym}H${xf}`, de: c.sortie, a: FIN, genre: 'suite' });
  const termini = [{ id: DEPART, x: 0, y: ym - TERM / 2 }, { id: FIN, x: xf, y: ym - TERM / 2 }];
  return { ...plan, termini, largeur: xf + TERM + 24, hauteur: c.bas + 24 };
}

const PLAN = planifier();

/** Le trait qui mène à l'étape en cours ; dans une boucle, l'entrée au premier tour, le retour ensuite. */
function traitActif(traits: Trait[], inst: Instant): Trait | undefined {
  const candidats = traits.filter((t) => inst.actif && (t.a === inst.actif || t.aussi === inst.actif));
  const tour = (t: Trait) => inst.tours.get(t.aussi ?? '') ?? 1;
  return candidats.find((t) => (t.genre === 'retour') === (tour(t) > 1)) ?? candidats[0];
}

function etatDuTrait(t: Trait, actif: Trait | undefined, inst: Instant): EtatLien {
  if (t === actif) return 'actif';
  if (t.genre === 'retour') return (inst.tours.get(t.de) ?? 1) > 1 ? 'parcouru' : 'aucun';
  return inst.etats.has(t.de) && (!t.a || inst.etats.has(t.a)) ? 'parcouru' : 'aucun';
}

/**
 * A · La ligne de métro. La mission est une ligne qui va de gauche à droite ; une boucle est un cadre qu'elle traverse,
 * et son retour passe dessous ; un échec descend en ambre et finit par ce qu'on fait ensuite ; une question descend
 * pour « oui » et rejoint la ligne plus loin.
 */
export function LogiqueMetro({ inst }: { inst: Instant }) {
  const plan = PLAN;
  const vue = useRef<HTMLDivElement>(null);
  const marque = useId().replace(/:/g, '');
  const actif = traitActif(plan.traits, inst);

  useEffect(() => {
    const v = vue.current;
    if (!v) return;
    if (inst.etats.size === 0) { v.scrollTo({ left: 0, behavior: 'smooth' }); return; }
    const x = plan.cartes.find((c) => c.etape.id === inst.actif)?.x
      ?? plan.cadres.find((c) => c.boucle.id === inst.actif)?.x
      ?? plan.termini.find((t) => t.id === inst.actif)?.x;
    if (x === undefined) return;
    if (x < v.scrollLeft + 40 || x + W > v.scrollLeft + v.clientWidth - 40) v.scrollTo({ left: x - v.clientWidth * 0.3, behavior: 'smooth' });
  }, [inst, plan]);

  const ton = (t: Trait, e: EtatLien): Ton => (t.genre === 'echec' ? 'echec' : e === 'actif' ? inst.ton : 'ok');
  return (
    <div className="lg-metro" ref={vue}>
      <div className="lg-metro-plan" style={{ width: plan.largeur, height: plan.hauteur }}>
        {plan.cadres.map((c) => (
          <div key={c.boucle.id} className="lg-cadre" style={{ left: c.x, top: c.y, width: c.w, height: c.h }}>
            <TeteBoucle boucle={c.boucle} inst={inst} className="lg-cadre-tete" />
          </div>
        ))}
        <svg className="lg-traits" width={plan.largeur} height={plan.hauteur} aria-hidden="true">
          <defs>
            {(Object.keys(COULEUR) as Genre[]).map((g) => (
              <marker key={g} id={`${marque}-${g}`} viewBox="0 0 10 10" refX="9" refY="5" markerWidth="7" markerHeight="7" orient="auto-start-reverse">
                <path d="M0 0L10 5L0 10z" fill={COULEUR[g]} />
              </marker>
            ))}
          </defs>
          {plan.traits.map((t, i) => {
            const e = etatDuTrait(t, actif, inst);
            return (
              <g key={i}>
                <path d={t.d} className={`lg-trait lg-trait-${t.genre}`} markerEnd={t.a ? `url(#${marque}-${t.genre})` : undefined} />
                <OndeChemin d={t.d} etat={e} ton={ton(t, e)} />
              </g>
            );
          })}
          {plan.etiquettes.map((l, i) => <text key={i} x={l.x} y={l.y} className="lg-etiquette">{l.texte}</text>)}
        </svg>
        {plan.cartes.map((c) => (
          <div key={c.etape.id} className="lg-pose" style={{ left: c.x, top: c.y, width: c.etape.genre === 'si' ? W_SI : W }}>
            <CarteEtape etape={c.etape} inst={inst} className="lg-carte-pleine" />
          </div>
        ))}
        {plan.puces.map((p, i) => <div key={i} className="lg-pose" style={{ left: p.x, top: p.y }}><Puce branche={p.branche} /></div>)}
        {plan.termini.map((t) => <div key={t.id} className="lg-pose" style={{ left: t.x, top: t.y }}><Terminus id={t.id} inst={inst} /></div>)}
      </div>
    </div>
  );
}
