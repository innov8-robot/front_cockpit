import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { api, robotUnique } from '../api/client';
import { depuis } from '../api/libelles';
import type { EtatCorps, EtatMoteur, Moteur } from '../api/types';
import { Chargement, Icone } from '../components/ui';
import { useCharge } from '../components/useCharge';

/** La place de chaque moteur sur le dessin (% de l'image), copiée du cockpit (scripts/copier-corps.mjs). */
interface Ancre { nom: string; x: number; y: number }

const TORSE = 'torse lacet';
const RAFRAICHI_MS = 1000;
/** La largeur d'un tableau (index.css, .corps-tableau) et ce que l'attitude IMU déborde du sien (px). */
const LARGEUR_TABLEAU = 440;
const DEBORD_IMU = 70;
/** La hauteur prise par l'en-tête et les marges de l'overlay, et la plus grande figure (px). */
const MARGE_VERTICALE = 200;
const HAUTEUR_FIGURE_MAX = 640;
/** Les marges de l'overlay de chaque côté (px). */
const MARGE_HORIZONTALE = 100;
/** Sous cette largeur (un téléphone), la planche se replie en colonne ; au-dessus, elle se réduit pour tenir. */
const LARGEUR_REPLI = 700;
/** Le dessin s'arrête aux roues, à 95 % de l'image : le reste est blanc. */
const FIGURE_UTILE = 0.95;
/** Le rapport largeur / hauteur de assets/robot_lines.png. */
const RAPPORT_FIGURE = 983 / 1100;
const ECART_FIGURE = 18;
const HAUTEUR_RANGEE = 22;

const ETATS: Record<EtatMoteur, { libelle: string; ton: string }> = {
  ok: { libelle: 'OK', ton: 'ok' },
  chaud: { libelle: 'chaud', ton: 'alerte' },
  trop_chaud: { libelle: 'trop chaud', ton: 'danger' },
  defaut: { libelle: 'DÉFAUT', ton: 'danger' },
  inconnu: { libelle: '?', ton: 'muet' },
};

/** Le nom du moteur dans sa rangée : le côté est dans le titre du tableau, on ne le répète pas. */
const libelle = (nom: string) => nom.replace(/^[DG] /, '').replace(/ (droite|gauche)$/, '');
const signe = (v: number) => `${v >= 0 ? '+' : ''}${v.toFixed(1)}`;

function Cellules({ m }: { m: Moteur | undefined }) {
  const e = ETATS[m?.etat ?? 'inconnu'];
  return (
    <>
      <span className={`corps-etat ton-${e.ton}`}>{e.libelle}</span>
      <span className={`ton-${e.ton}`}>
        {m?.temperature == null ? '—' : `${m.temperature}°`}{m?.rouge != null && <span className="corps-rouge"> · rouge {m.rouge}</span>}
      </span>
      <span className="ton-info">{m?.couple == null ? '—' : `${m.couple.toFixed(1)} N·m`}</span>
    </>
  );
}

function Entete() {
  return <div className="corps-entete"><span>MOTEUR</span><span>ÉTAT</span><span>TEMPÉRATURE</span><span>COUPLE</span></div>;
}

/** La vue « corps » d'un robot : le dessin au centre, une rangée par moteur à la hauteur de son point. */
export function CorpsRobot() {
  const robot = useCharge(robotUnique);
  const id = robot.donnee?.id;
  const [ancres, setAncres] = useState<Ancre[] | null>(null);
  const [etat, setEtat] = useState<EtatCorps | null>(null);
  // La planche se taille sur la fenêtre, et l'overlay sur la planche : il épouse exactement son contenu.
  const [fenetre, setFenetre] = useState({ l: innerWidth, h: innerHeight });
  useEffect(() => {
    const suivre = () => setFenetre({ l: innerWidth, h: innerHeight });
    addEventListener('resize', suivre);
    return () => removeEventListener('resize', suivre);
  }, []);

  useEffect(() => {
    fetch('robot/corps.json').then((r) => r.json()).then((c) => setAncres(c.ancres)).catch(() => setAncres([]));
  }, []);

  useEffect(() => {
    if (!id) return;
    let vivant = true;
    const lire = () => api.etatCorps(id).then((e) => vivant && setEtat(e)).catch(() => undefined);
    lire();
    const t = setInterval(lire, RAFRAICHI_MS);
    return () => { vivant = false; clearInterval(t); };
  }, [id]);

  if (!ancres || robot.enCours && !robot.donnee) return <Chargement />;
  const parNom = new Map(etat?.moteurs.map((m) => [m.nom, m]));
  const gauche = ancres.filter((a) => a.x < 50).sort((a, b) => a.y - b.y);
  const droite = ancres.filter((a) => a.x >= 50 && a.nom !== TORSE).sort((a, b) => a.y - b.y);
  const torse = ancres.find((a) => a.nom === TORSE);
  // La figure tient dans la hauteur de la fenêtre ; les tableaux se collent à elle de chaque côté.
  const hFigure = Math.max(420, Math.min(fenetre.h - MARGE_VERTICALE, HAUTEUR_FIGURE_MAX));
  const lFigure = hFigure * RAPPORT_FIGURE;
  const x0 = LARGEUR_TABLEAU + ECART_FIGURE;
  const largeur = 2 * (LARGEUR_TABLEAU + ECART_FIGURE) + lFigure + DEBORD_IMU;
  const compacte = fenetre.l < LARGEUR_REPLI;
  // Trop large pour l'écran (une tablette) : la même planche, réduite d'un bloc, plutôt qu'une autre mise en page.
  const echelle = Math.min(1, (fenetre.l - MARGE_HORIZONTALE) / largeur);
  const point = (a: Ancre) => ({ x: x0 + (a.x / 100) * lFigure, y: (a.y / 100) * hFigure });
  const yTorse = torse ? point(droite.at(-1) ?? torse).y + 70 : 0;
  const hauteur = Math.max(hFigure * FIGURE_UTILE, yTorse + 34 + 2 * HAUTEUR_RANGEE + 12);

  return (
    <div className="page-corps">
      <div className="corps-barre">
        <Link to="/robot" className="retour"><Icone nom="retour" taille={16} />{robot.donnee?.nom ?? 'Robot'}</Link>
        <h1>ÉTAT DU CORPS</h1>
        <span className="espace" />
        <span className="discret nombre">{etat ? `relevé ${depuis(etat.date)}` : 'en attente du robot…'}</span>
      </div>

      <div className={`corps-planche ${compacte ? 'compacte' : ''}`}
        style={compacte ? undefined : { width: largeur * echelle, height: hauteur * echelle }}>
        {!compacte && (
          <div className="corps-echelle" style={{ width: largeur, height: hauteur, transform: `scale(${echelle})` }}>
            <img className="corps-figure" src="robot/robot_lines.png" alt="" style={{ left: x0, width: lFigure, height: hFigure }} />
            <svg className="corps-traits" width={largeur} height={hauteur} aria-hidden="true">
              {gauche.map((a) => {
                const p = point(a);
                return <line key={a.nom} x1={x0 - ECART_FIGURE} y1={p.y} x2={p.x} y2={p.y} />;
              })}
              {droite.map((a) => {
                const p = point(a);
                return <line key={a.nom} x1={p.x} y1={p.y} x2={x0 + lFigure + ECART_FIGURE} y2={p.y} />;
              })}
              {torse && (() => {
                const p = point(torse);
                const coude = x0 + lFigure + ECART_FIGURE / 2;
                return <polyline points={`${p.x},${p.y} ${coude},${p.y} ${coude},${yTorse + 34} ${coude + ECART_FIGURE / 2},${yTorse + 34}`} />;
              })()}
              {ancres.map((a) => {
                const p = point(a);
                return <circle key={a.nom} cx={p.x} cy={p.y} r={5} className={`ton-${ETATS[parNom.get(a.nom)?.etat ?? 'inconnu'].ton}`} />;
              })}
            </svg>

            <section className="corps-tableau" style={{ left: 0 }}>
              <h2>BRAS DROIT</h2>
              <Entete />
              {gauche.map((a) => (
                <div key={a.nom} className="corps-rangee" style={{ top: point(a).y - HAUTEUR_RANGEE / 2 }}>
                  <span>{libelle(a.nom)}</span><Cellules m={parNom.get(a.nom)} />
                </div>
              ))}
            </section>
            <section className="corps-tableau" style={{ left: x0 + lFigure + ECART_FIGURE }}>
              <h2>BRAS GAUCHE</h2>
              <Entete />
              {droite.map((a) => (
                <div key={a.nom} className="corps-rangee" style={{ top: point(a).y - HAUTEUR_RANGEE / 2 }}>
                  <span>{libelle(a.nom)}</span><Cellules m={parNom.get(a.nom)} />
                </div>
              ))}
              {torse && (
                <>
                  <h2 className="corps-titre-torse" style={{ top: yTorse - 22 }}>TORSE</h2>
                  <div className="corps-rangee" style={{ top: yTorse + 34 - HAUTEUR_RANGEE / 2 }}>
                    <span>{libelle(TORSE)}</span><Cellules m={parNom.get(TORSE)} />
                  </div>
                  <div className="corps-rangee corps-imu" style={{ top: yTorse + 34 + HAUTEUR_RANGEE }}>
                    <span>attitude IMU</span>
                    <span className="ton-info">{etat?.imu ? `roulis ${signe(etat.imu.roulis)}° · tangage ${signe(etat.imu.tangage)}° · lacet ${signe(etat.imu.lacet)}° · ${etat.imu.temperature} °C` : '—'}</span>
                  </div>
                </>
              )}
            </section>
          </div>
        )}

        {compacte && (
          <div className="corps-replie">
            <div className="corps-figure-repliee">
              <img src="robot/robot_lines.png" alt="" />
              {ancres.map((a) => (
                <span key={a.nom} className={`corps-point ton-${ETATS[parNom.get(a.nom)?.etat ?? 'inconnu'].ton}`}
                  style={{ left: `${a.x}%`, top: `${a.y}%` }} title={a.nom} />
              ))}
            </div>
            {[['BRAS DROIT', gauche], ['BRAS GAUCHE', droite], ['TORSE', torse ? [torse] : []]].map(([titre, liste]) => (
              <section key={titre as string} className="corps-liste">
                <h2>{titre as string}</h2>
                <Entete />
                {(liste as Ancre[]).map((a) => (
                  <div key={a.nom} className="corps-rangee"><span>{libelle(a.nom)}</span><Cellules m={parNom.get(a.nom)} /></div>
                ))}
              </section>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
