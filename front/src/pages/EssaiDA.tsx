import { useEffect, useRef, useState } from 'react';
import { CLASSES } from '../vue3d/environnement';
import { monterScene, type Scene3D } from '../vue3d/scene';
import { THEME_PAR_DEFAUT, THEMES, type ThemeScene } from '../vue3d/theme';

/** Les couleurs qui ont un sens dans toute l'appli, quel que soit le thème de la scène. */
const SENS: [string, string, string][] = [
  ['#ff2d3a', 'Danger', 'arrêt d’urgence, alarme, moteur trop chaud, zone machine — et rien d’autre'],
  ['#ffb02e', 'Attention', 'moteur chaud, ordre armé qui attend sa confirmation'],
  ['#3dff8a', 'OK', 'connecté, batterie, réarmé'],
];

/** Les rôles de couleur de la scène, dans l'ordre de la légende. */
const ROLES: { cle: keyof ThemeScene; nom: string; sens: string }[] = [
  { cle: 'lidar', nom: 'Vu maintenant · lidar', sens: 'les points du balayage en cours' },
  { cle: 'camera', nom: 'Vu maintenant · caméra', sens: 'la profondeur de la caméra de tête' },
  { cle: 'memoire', nom: 'Mémoire', sens: 'ce qui a été vu : la carte, en gros points éteints' },
  { cle: 'sonar', nom: 'Impulsion', sens: 'le sonar, l’anneau sous le robot : l’action' },
  { cle: 'meubles', nom: 'Atelier', sens: 'les arêtes des meubles' },
];

/** Page d'essai de la direction artistique de la scène : #/essai/da. */
export function EssaiDA() {
  const hote = useRef<HTMLDivElement>(null);
  const scene = useRef<Scene3D | null>(null);
  const [theme, setTheme] = useState<ThemeScene>(THEME_PAR_DEFAUT);

  useEffect(() => {
    if (!hote.current) return;
    const s = monterScene(hote.current);
    scene.current = s;
    s.pret.then(() => s.demarrer());
    return () => s.detruire();
  }, []);

  function choisir(t: ThemeScene) {
    setTheme(t);
    scene.current?.theme(t);
  }

  return (
    <div className="essai-da">
      <div className="essai-da-scene" ref={hote} />
      <aside className="essai-da-panneau">
        <p className="essai-barre-sur">ESSAI · DIRECTION ARTISTIQUE</p>
        <h1>Couleurs de la scène</h1>
        <div className="essai-da-themes" role="radiogroup" aria-label="Thème">
          {THEMES.map((t) => (
            <button key={t.cle} role="radio" aria-checked={t.cle === theme.cle} className={t.cle === theme.cle ? 'actif' : ''}
              onClick={() => choisir(t)}>
              <span className="essai-da-pastilles" aria-hidden="true">
                {[t.lidar, t.memoire, t.sonar].map((c, i) => <i key={i} style={{ background: c }} />)}
              </span>
              {t.nom}
            </button>
          ))}
        </div>
        <p className="essai-da-idee">{theme.idee}</p>

        <p className="essai-da-titre">LA SCÈNE · {theme.nom.toUpperCase()}</p>
        <ul className="essai-da-legende">
          {ROLES.map((r) => (
            <li key={r.cle}><i style={{ background: theme[r.cle] }} /><span><strong>{r.nom}</strong>{r.sens}</span></li>
          ))}
          <li><i className="essai-da-classes" style={{ background: `conic-gradient(${Object.values(CLASSES).map((c, i, a) => `${c} 0 ${((i + 1) / a.length) * 100}%`).join(', ')})` }} />
            <span><strong>Objets</strong>une couleur par classe, avec son cadre et son nom</span></li>
        </ul>

        <p className="essai-da-titre">PARTOUT, QUEL QUE SOIT LE THÈME</p>
        <ul className="essai-da-legende">
          {SENS.map(([c, nom, sens]) => <li key={nom}><i style={{ background: c }} /><span><strong>{nom}</strong>{sens}</span></li>)}
        </ul>
      </aside>
    </div>
  );
}
