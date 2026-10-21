import { useEffect, useState } from 'react';
import { choisirMode, modeCourant, urlServeur, type Mode } from '../api/mode';

type Joignable = 'inconnu' | 'oui' | 'non';

/** Interroge le serveur du robot : répond-il à `/api/robot` ? */
function sonder(url: string): Promise<Joignable> {
  const fin = new AbortController();
  const t = setTimeout(() => fin.abort(), 2500);
  return fetch(`${url.replace(/\/+$/, '')}/api/robot`, { signal: fin.signal })
    .then((r) => (r.ok ? 'oui' as const : 'non' as const))
    .catch(() => 'non' as const)
    .finally(() => clearTimeout(t));
}

/**
 * Le choix de la source des données, en bas du menu de gauche : la simulation embarquée (travailler sans robot)
 * ou le serveur du robot, avec son adresse. Le point dit si le serveur répond.
 */
export function SelecteurSource() {
  const actuel = modeCourant();
  const [ouvert, setOuvert] = useState(false);
  const [mode, setMode] = useState<Mode>(actuel);
  const [url, setUrl] = useState(urlServeur());
  const [joignable, setJoignable] = useState<Joignable>('inconnu');

  useEffect(() => {
    if (actuel !== 'reel') return;
    let vivant = true;
    const lire = () => sonder(urlServeur()).then((j) => vivant && setJoignable(j));
    lire();
    const t = setInterval(lire, 5000);
    return () => { vivant = false; clearInterval(t); };
  }, [actuel]);

  const ton = actuel === 'simulation' ? 'simulation' : joignable === 'oui' ? 'ok' : joignable === 'non' ? 'pb' : 'inconnu';
  return (
    <div className="source">
      <button className={`source-bouton source-${ton}`} aria-expanded={ouvert} onClick={() => setOuvert(!ouvert)}
        title={actuel === 'simulation' ? 'Données simulées' : `Serveur du robot : ${urlServeur()}`}>
        <span className="source-point" aria-hidden="true" />
        <span className="source-nom">{actuel === 'simulation' ? 'SIMU' : 'ROBOT'}</span>
      </button>
      {ouvert && (
        <div className="source-panneau" role="dialog" aria-label="Source des données">
          <p className="source-titre">SOURCE DES DONNÉES</p>
          <div className="source-choix" role="radiogroup">
            {(['simulation', 'reel'] as Mode[]).map((m) => (
              <button key={m} role="radio" aria-checked={mode === m} className={mode === m ? 'actif' : ''} onClick={() => setMode(m)}>
                {m === 'simulation' ? 'Simulation' : 'Robot'}
              </button>
            ))}
          </div>
          {mode === 'reel' && (
            <label className="source-url">Serveur
              <input value={url} onChange={(e) => setUrl(e.target.value)} placeholder="http://192.168.123.x:8765"
                spellCheck={false} autoCapitalize="off" />
            </label>
          )}
          <p className="source-aide">
            {mode === 'simulation' ? 'Tout est simulé dans l’appli : on travaille sans robot ni serveur.'
              : 'Le robot, son corps, ses capteurs et l’E-STOP viennent du serveur ; missions et primitives restent simulées.'}
          </p>
          <button className="source-appliquer" disabled={mode === actuel && (mode === 'simulation' || url === urlServeur())}
            onClick={() => choisirMode(mode, url)}>APPLIQUER</button>
        </div>
      )}
    </div>
  );
}
