import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { ETATS } from '../components/missions/charte';
import { typeNoeud } from '../components/missions/catalogue';
import { DEPART, DEROULE, FIN, instant, trouver } from '../components/missions/logique';
import { LogiqueBlocs } from '../components/missions/LogiqueBlocs';
import { LogiqueColonne } from '../components/missions/LogiqueColonne';
import { LogiqueMetro } from '../components/missions/LogiqueMetro';

/** Un pas dure un peu plus d'une période de l'onde (1 Hz). */
const PAS_MS = 1100;

/** Le pas en cours, en mots : « Prendre un objet · en cours · essai 2 ». */
function decrire(k: number): string {
  const p = DEROULE[k];
  if (!p) return 'prête';
  const e = trouver(p.id);
  const nom = p.id === DEPART ? 'Lancement' : p.id === FIN ? 'Fin' : e ? typeNoeud(e.genre === 'si' ? 'si' : e.cle).nom : p.id;
  const plus = p.tour ? ` · tour ${p.tour}` : p.essai && p.essai > 1 ? ` · essai ${p.essai}` : p.reponse ? ` · ${p.reponse}` : '';
  return `${nom} · ${ETATS[p.etat].libelle}${plus}`;
}

function Proposition({ lettre, nom, idee, plus, moins, children }: { lettre: string; nom: string; idee: string; plus: string; moins: string; children: ReactNode }) {
  return (
    <section className="lg-prop">
      <header className="lg-prop-tete">
        <span className="lg-lettre">{lettre}</span>
        <div><h2>{nom}</h2><p>{idee}</p></div>
        <ul className="lg-pour-contre"><li className="lg-plus">{plus}</li><li className="lg-moins">{moins}</li></ul>
      </header>
      {children}
    </section>
  );
}

/** Trois dessins de la même logique de mission, joués ensemble (#/essai/logique). */
export function EssaiLogique() {
  const [k, setK] = useState(-1);
  const [joue, setJoue] = useState(false);
  const pas = useRef(-1);
  const inst = useMemo(() => instant(k), [k]);

  useEffect(() => {
    if (!joue) return;
    const minuterie = window.setInterval(() => {
      if (pas.current >= DEROULE.length - 1) { setJoue(false); return; }
      pas.current += 1;
      setK(pas.current);
    }, PAS_MS);
    return () => clearInterval(minuterie);
  }, [joue]);

  function aller(x: number) {
    pas.current = x;
    setK(x);
  }
  function basculer() {
    if (!joue && k >= DEROULE.length - 1) aller(-1);
    setJoue(!joue);
  }

  return (
    <div className="lg-page fond-hud">
      <main className="lg-contenu">
        <header className="lg-entete">
          <p className="essai-barre-sur">ESSAI · LOGIQUE DES MISSIONS</p>
          <h1>Trois façons de dessiner la logique</h1>
          <p className="lg-mission">
            La même mission dans les trois : <b>pour chaque pièce</b>, la prendre (<b>2 essais</b>, sinon appeler
            l’opérateur), la poser, compter ; <b>si le bac est plein</b>, appeler l’opérateur.
          </p>
          <ul className="lg-regles">
            <li><b>↻ 2</b>Réessayer devient un réglage du geste, plus un cadre.</li>
            <li><b className="lg-ambre">✕</b>L’échec sort sur le côté, en ambre ; le chemin normal va tout droit.</li>
            <li><b>↩</b>Aucun fil ne revient en arrière : une branche finit par ce qu’on fait ensuite.</li>
            <li><b className="lg-magenta">↻</b>La boucle dessine elle-même son retour.</li>
          </ul>
        </header>

        <div className="lg-lecteur">
          <button className="lg-jouer" onClick={basculer}>{joue ? '❚❚ Pause' : '▶ Jouer les trois'}</button>
          <input type="range" min={-1} max={DEROULE.length - 1} value={k} aria-label="Pas de l’exécution"
            onChange={(e) => { setJoue(false); aller(Number(e.target.value)); }} />
          <span className="lg-pas">{k >= 0 ? `${k + 1} / ${DEROULE.length}` : ''}</span>
          <span className="lg-decrit">{decrire(k)}</span>
        </div>

        <Proposition lettre="A" nom="Ligne de métro" idee="Horizontale, comme n8n. La boucle est un cadre que la ligne traverse ; l’échec descend."
          plus="garde le canevas" moins="large : la vue défile">
          <LogiqueMetro inst={inst} />
        </Proposition>

        <div className="lg-deux">
          <Proposition lettre="B" nom="Blocs empilés" idee="Comme Scratch : se lit de haut en bas comme un texte. Aucun fil."
            plus="zéro fil, zéro croisement" moins="les branches prennent de la hauteur">
            <LogiqueBlocs inst={inst} />
          </Proposition>
          <Proposition lettre="C" nom="Colonne" idee="Comme Zapier : la mission descend, ce qui sort du chemin part à droite."
            plus="tient sur une tablette" moins="moins de vue d’ensemble">
            <LogiqueColonne inst={inst} />
          </Proposition>
        </div>
      </main>
    </div>
  );
}
