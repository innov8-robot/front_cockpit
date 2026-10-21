import { useState } from 'react';
import { useMissions } from '../components/listeMissions/donnees';
import { Cartes, ListeApercu, ListeVivante } from '../components/listeMissions/Variantes';

const PROPOSITIONS = [
  { cle: 'a', nom: 'A · Liste vivante', idee: 'Le panneau de côté gardé : chaque ligne montre la chaîne de primitives, les derniers runs, et la mission qui joue.' },
  { cle: 'b', nom: 'B · Cartes', idee: 'L’écran entier : chaque mission montre son graphe en miniature, comme une galerie.' },
  { cle: 'c', nom: 'C · Liste et aperçu', idee: 'À gauche les missions, à droite celle qu’on choisit : son graphe, ses runs et leurs causes.' },
] as const;

/** Trois propositions pour la liste des missions, sur les données de l'API (#/essai/liste-missions). */
export function EssaiListeMissions() {
  const donnees = useMissions();
  const [choix, setChoix] = useState<(typeof PROPOSITIONS)[number]['cle']>('a');
  const p = PROPOSITIONS.find((x) => x.cle === choix)!;
  return (
    <div className="lm-page fond-hud">
      <header className="lm-page-tete">
        <p className="essai-barre-sur">ESSAI · LISTE DES MISSIONS</p>
        <span className="em-segment lm-choix">
          {PROPOSITIONS.map((x) => <button key={x.cle} className={choix === x.cle ? 'actif' : ''} onClick={() => setChoix(x.cle)}>{x.nom}</button>)}
        </span>
        <p className="lm-idee">{p.idee}</p>
      </header>
      <div className={`lm-cadre ${choix === 'a' ? 'lm-cadre-cote' : 'lm-cadre-grand'}`}>
        {!donnees.pret ? <p className="lm-rien">Chargement…</p>
          : choix === 'a' ? <ListeVivante {...donnees} />
          : choix === 'b' ? <Cartes {...donnees} />
          : <ListeApercu {...donnees} />}
      </div>
    </div>
  );
}
