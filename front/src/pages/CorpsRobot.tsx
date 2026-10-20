import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import { api } from '../api/client';
import { depuis } from '../api/libelles';
import type { EtatCorps, EtatMoteur, Moteur } from '../api/types';
import { Chargement, Icone } from '../components/ui';
import { useCharge } from '../components/useCharge';

/** La place de chaque moteur sur le dessin (% de l'image), copiée du cockpit (scripts/copier-corps.mjs). */
interface Ancre { nom: string; x: number; y: number }

const TORSE = 'torse lacet';
const RAFRAICHI_MS = 1000;
/** En dessous de cette largeur, la planche se replie : la figure, puis les tableaux l'un sous l'autre. */
const LARGEUR_PLANCHE = 1080;
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
  const { id = '' } = useParams();
  const robot = useCharge(() => api.robot(id), [id]);
  const [ancres, setAncres] = useState<Ancre[] | null>(null);
  const [etat, setEtat] = useState<EtatCorps | null>(null);
  const [mesure, setMesure] = useState({ largeur: 0, hauteur: 0 });
  // La planche se mesure dès qu'elle existe, quel que soit l'ordre d'arrivée de la fiche et des ancres.
  const observateur = useRef<ResizeObserver | null>(null);
  const planche = useCallback((el: HTMLDivElement | null) => {
    observateur.current?.disconnect();
    observateur.current = null;
    if (!el) return;
    const o = new ResizeObserver(() => setMesure({ largeur: el.clientWidth, hauteur: el.clientHeight }));
    o.observe(el);
    observateur.current = o;
  }, []);

  useEffect(() => {
    fetch('robot/corps.json').then((r) => r.json()).then((c) => setAncres(c.ancres)).catch(() => setAncres([]));
  }, []);

  useEffect(() => {
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
  const compacte = mesure.largeur > 0 && mesure.largeur < LARGEUR_PLANCHE;

  // La figure tient dans la hauteur ; les tableaux se collent à elle de chaque côté.
  const hFigure = Math.max(420, Math.min(mesure.hauteur - 8, 700));
  const lFigure = hFigure * RAPPORT_FIGURE;
  const x0 = (mesure.largeur - lFigure) / 2;
  const point = (a: Ancre) => ({ x: x0 + (a.x / 100) * lFigure, y: (a.y / 100) * hFigure });
  const yTorse = torse ? point(droite.at(-1) ?? torse).y + 70 : 0;

  return (
    <div className="page-corps">
      <div className="corps-barre">
        <Link to={`/flotte/${id}`} className="retour"><Icone nom="retour" taille={16} />{robot.donnee?.nom ?? 'Robot'}</Link>
        <h1>ÉTAT DU CORPS</h1>
        <span className="espace" />
        <span className="discret nombre">{etat ? `relevé ${depuis(etat.date)}` : 'en attente du robot…'}</span>
      </div>

      <div ref={planche} className={`corps-planche ${compacte ? 'compacte' : ''}`}>
        {!compacte && mesure.largeur > 0 && (
          <>
            <img className="corps-figure" src="robot/robot_lines.png" alt="" style={{ left: x0, width: lFigure, height: hFigure }} />
            <svg className="corps-traits" width={mesure.largeur} height={hFigure + 160} aria-hidden="true">
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

            <section className="corps-tableau" style={{ right: mesure.largeur - x0 + ECART_FIGURE }}>
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
          </>
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
