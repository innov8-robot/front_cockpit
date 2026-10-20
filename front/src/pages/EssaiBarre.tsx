import { useState } from 'react';
import { api } from '../api/client';
import { ETATS_ROBOT } from '../api/libelles';
import { reinitialiserSimulation } from '../api/mock';
import { BarreRobot, type FormeBarre } from '../components/BarreRobot';
import { useCharge } from '../components/useCharge';

/** L'ordre de la barre, et d'où il vient : les clics du cockpit réel, 169 sessions du 25/09 au 20/10. */
const HIERARCHIE: [string, string][] = [
  ['E-STOP', '48 clics · toujours à droite, le plus gros, sans confirmation'],
  ['Connexion', '209 clics (le premier geste de chaque session) · pastille d’état à gauche'],
  ['Home', '36 clics · posture de travail, second clic pour confirmer'],
  ['Pinces', '31 clics « Ouvrir » · une par main, second clic pour confirmer'],
  ['Mou / Rigide', '18 / 2 clics · « mou » se confirme, « rigide » non'],
  ['Températures, batterie', 'lecture seule · le pire moteur de chaque groupe ; clic : le détail du corps'],
];

/** Page d'essai de la barre du robot, hors de l'accueil : #/essai/barre. */
export function EssaiBarre() {
  const robots = useCharge(() => api.robots());
  const [robotId, setRobotId] = useState('r1');
  const [forme, setForme] = useState<FormeBarre>('ile');

  return (
    <div className="essai-barre">
      <header className="essai-barre-tete">
        <div>
          <p className="essai-barre-sur">ESSAI · COMPOSANT</p>
          <h1>Barre du robot</h1>
        </div>
        <div className="essai-barre-reglages">
          <label>
            <span>FORME</span>
            <span className="barre-segment">
              {(['ile', 'bandeau'] as const).map((f) => (
                <button key={f} className={forme === f ? 'actif' : ''} onClick={() => setForme(f)}>
                  {f === 'ile' ? 'ÎLE' : 'BANDEAU'}
                </button>
              ))}
            </span>
          </label>
          <label>
            <span>ROBOT</span>
            <select value={robotId} onChange={(e) => setRobotId(e.target.value)}>
              {robots.donnee?.map((r) => <option key={r.id} value={r.id}>{r.nom} · {ETATS_ROBOT[r.etat].libelle}</option>)}
            </select>
          </label>
          <button className="essai-barre-raz" onClick={() => { reinitialiserSimulation(); location.reload(); }}>
            RÉINITIALISER LA SIMULATION
          </button>
        </div>
      </header>

      <ol className="essai-barre-ordre">
        {HIERARCHIE.map(([nom, pourquoi]) => <li key={nom}><strong>{nom}</strong> — {pourquoi}</li>)}
      </ol>

      <div className="essai-barre-scene" aria-hidden="true" />
      <BarreRobot key={robotId} robotId={robotId} forme={forme} />
    </div>
  );
}
