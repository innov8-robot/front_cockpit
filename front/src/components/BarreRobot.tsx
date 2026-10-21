import { useCallback, useEffect, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_ROBOT } from '../api/libelles';
import type { Cote, EtatCorps, EtatMoteur, EtatRobot, ModeBras, Moteur, Robot } from '../api/types';
import { IconeBras, IconeCorps, IconeMains, IconePince } from './IconesRobot';

/** La barre se relit à cette période : les températures et l'état du robot sont vivants. */
const RAFRAICHI_MS = 1000;
/** Un ordre qui fait bouger le robot demande un second clic dans ce délai (ms) : le premier l'arme. */
const CONFIRMATION_MS = 3000;
/** Une erreur reste affichée ce temps (ms). */
const ERREUR_MS = 4000;
/** La durée de l'animation de retour des bords de l'écran au réarmement (index.css, estop-retour). */
const RETOUR_MS = 900;

/** Les groupes de moteurs dont la barre montre la température, chacun au pire de ses moteurs. */
const GROUPES: { libelle: string; Icone: typeof IconeMains; contient: (nom: string) => boolean }[] = [
  { libelle: 'Mains', Icone: IconeMains, contient: (n) => /poignet|pince/.test(n) },
  { libelle: 'Bras', Icone: IconeBras, contient: (n) => /épaule|coude/.test(n) },
  { libelle: 'Corps', Icone: IconeCorps, contient: (n) => /torse/.test(n) },
];

/** Le pire verdict d'abord : c'est lui qui colore le groupe. */
const GRAVITE: EtatMoteur[] = ['inconnu', 'ok', 'chaud', 'trop_chaud', 'defaut'];
const TON: Record<EtatMoteur, string> = {
  ok: 'ok', chaud: 'alerte', trop_chaud: 'danger', defaut: 'danger', inconnu: 'muet',
};
/** La couleur de la pastille de connexion : l'état du robot se lit dans sa couleur et dans son info-bulle. */
const TON_ROBOT: Record<EtatRobot, string> = {
  disponible: 'ok', en_mission: 'ok', en_charge: 'info', hors_ligne: 'danger', arret_urgence: 'danger',
};

export type FormeBarre = 'bandeau' | 'ile';

interface Groupe { libelle: string; Icone: typeof IconeMains; temperature: number | null; etat: EtatMoteur; chaud: Moteur | null }

/** La température de chaque groupe : celle de son moteur le plus chaud, et le pire verdict du groupe. */
function groupes(corps: EtatCorps | null): Groupe[] {
  return GROUPES.map(({ libelle, Icone, contient }) => {
    const ms = (corps?.moteurs ?? []).filter((m) => contient(m.nom));
    const chaud = ms.reduce<Moteur | null>((a, m) => (m.temperature != null && (a?.temperature == null || m.temperature > a.temperature) ? m : a), null);
    const etat = ms.reduce<EtatMoteur>((a, m) => (GRAVITE.indexOf(m.etat) > GRAVITE.indexOf(a) ? m.etat : a), 'inconnu');
    return { libelle, Icone, temperature: chaud?.temperature ?? null, etat, chaud };
  });
}

/** Les bords de l'écran : rouges tant que l'arrêt d'urgence est engagé, puis l'animation de retour au réarmement. */
function useBordsEstop(engage: boolean): 'engage' | 'retour' | null {
  const [precedent, setPrecedent] = useState(engage);
  const [retour, setRetour] = useState(false);
  if (engage !== precedent) {
    setPrecedent(engage);
    setRetour(!engage);
  }
  useEffect(() => {
    if (!retour) return;
    const t = setTimeout(() => setRetour(false), RETOUR_MS);
    return () => clearTimeout(t);
  }, [retour]);
  return engage ? 'engage' : retour ? 'retour' : null;
}

/**
 * La barre du robot : son état d'un coup d'œil (connexion, batterie, températures) et les ordres les plus
 * fréquents du cockpit (posture de travail, pinces, bras mou ou rigide), l'arrêt d'urgence toujours à droite.
 */
export function BarreRobot({ robotId, forme }: { robotId: string; forme: FormeBarre }) {
  const [robot, setRobot] = useState<Robot | null>(null);
  const [corps, setCorps] = useState<EtatCorps | null>(null);
  const [erreur, setErreur] = useState<string | null>(null);
  const [arme, setArme] = useState<string | null>(null);
  const minuterie = useRef<number | undefined>(undefined);

  const relire = useCallback(() => {
    api.robot(robotId).then((r) => setRobot(r ?? null)).catch(() => undefined);
    api.etatCorps(robotId).then(setCorps).catch(() => setCorps(null));
  }, [robotId]);

  useEffect(() => {
    relire();
    const t = setInterval(relire, RAFRAICHI_MS);
    return () => clearInterval(t);
  }, [relire]);
  useEffect(() => () => clearTimeout(minuterie.current), []);
  const bords = useBordsEstop(robot?.etat === 'arret_urgence');

  const dire = (e: unknown) => {
    setErreur(e instanceof Error ? e.message : String(e));
    window.setTimeout(() => setErreur(null), ERREUR_MS);
  };
  /** Lance un ordre ; l'état du robot revient dans la réponse, et pendant un geste la relecture le montre. */
  const ordonner = (promesse: Promise<Robot>) => {
    promesse.then(setRobot).catch(dire);
    window.setTimeout(relire, 150);
  };
  /** Le premier clic arme l'ordre `cle`, le second l'exécute ; un autre ordre désarme le précédent. */
  const confirmer = (cle: string, executer: () => void) => {
    clearTimeout(minuterie.current);
    if (arme === cle) {
      setArme(null);
      executer();
      return;
    }
    setArme(cle);
    minuterie.current = window.setTimeout(() => setArme(null), CONFIRMATION_MS);
  };

  if (!robot) return <div className={`barre-robot barre-${forme}`} aria-busy="true"><span className="barre-muet">ROBOT…</span></div>;

  const etat = ETATS_ROBOT[robot.etat];
  const estop = robot.etat === 'arret_urgence';
  const horsLigne = robot.etat === 'hors_ligne';
  const bloque = estop || horsLigne || robot.geste !== null;
  const tonBatterie = robot.batterie < 20 ? 'danger' : robot.batterie < 40 ? 'alerte' : 'ok';
  const changerMode = (mode: ModeBras) => {
    if (mode === robot.modeBras) return;
    // Rendre les bras mous les laisse tomber s'ils portent quelque chose : on confirme. Les raidir, non.
    if (mode === 'mou') confirmer('mou', () => ordonner(api.modeBras(robot.id, 'mou')));
    else ordonner(api.modeBras(robot.id, 'rigide'));
  };
  const pince = (cote: Cote) => {
    const ordre = robot.pinces[cote] > 0.5 ? 'fermer' : 'ouvrir';
    confirmer(`pince-${cote}`, () => ordonner(api.pince(robot.id, cote, ordre)));
  };

  return (
    <div className={`barre-robot barre-${forme} ${estop ? 'barre-estop' : ''}`} role="toolbar" aria-label={`Barre du robot ${robot.nom}`}>
      {/* Sur un écran étroit, tout défile sauf l'arrêt d'urgence, qui ne sort jamais de l'écran. */}
      <div className="barre-defile">
      <section className="barre-groupe barre-identite" title={`${etat.libelle}${robot.geste ? ` · ${GESTES[robot.geste]}` : ''}`}>
        <span className={`barre-point ton-${TON_ROBOT[robot.etat]}`} aria-label={etat.libelle} />
        <span className="barre-identite-textes">
          <span className="barre-nom">{robot.nom}</span>
          <span className="barre-modele">{robot.modele}</span>
        </span>
      </section>

      <section className="barre-groupe" title={`Batterie ${robot.batterie} %`} aria-label="Batterie">
        <span className="barre-batterie"><span className={`fond-${tonBatterie}`} style={{ width: `${robot.batterie}%` }} /></span>
        <span className={`barre-valeur ton-${tonBatterie}`}>{robot.batterie}%</span>
      </section>

      <Link to="/robot/corps" className="barre-groupe barre-temperatures" aria-label="Températures : le détail du corps">
        {groupes(corps).map(({ libelle, Icone, temperature, etat: e, chaud }) => (
          <span key={libelle} className="barre-temperature"
            title={chaud ? `${libelle} : le plus chaud est « ${chaud.nom} », ${chaud.temperature}°${chaud.rouge != null ? ` (rouge à ${chaud.rouge}°)` : ''}` : `${libelle} : —`}>
            <Icone />
            <span className={`barre-valeur ton-${TON[e]}`}>{temperature == null ? '—' : `${temperature}°`}</span>
          </span>
        ))}
      </Link>

      <section className="barre-groupe" aria-label="Bras : rigides ou en gravité" title="Bras : rigides, ou libres sous compensation de la gravité">
        <IconeBras />
        <span className="barre-segment" role="radiogroup">
          {(['rigide', 'mou'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={robot.modeBras === m} disabled={bloque}
              className={`${robot.modeBras === m ? 'actif' : ''} ${arme === m ? 'arme' : ''}`} onClick={() => changerMode(m)}
              title={m === 'mou' ? 'Compensation de la gravité : les bras se guident à la main' : 'Les bras tiennent leur position'}>
              {arme === m ? 'CONFIRMER ?' : m === 'mou' ? 'GRAVITÉ' : 'RIGIDE'}
            </button>
          ))}
        </span>
      </section>

      <section className="barre-groupe" aria-label="Pinces">
        {(['gauche', 'droite'] as const).map((c) => {
          const ouverte = robot.pinces[c] > 0.5;
          const enCours = robot.geste === `pince_${c}`;
          return (
            <button key={c} className={`barre-bouton barre-pince ${arme === `pince-${c}` ? 'arme' : ''}`} disabled={bloque}
              onClick={() => pince(c)} title={`Pince ${c} ${ouverte ? 'ouverte' : 'fermée'} : clic pour ${ouverte ? 'fermer' : 'ouvrir'}`}>
              <IconePince ouverture={robot.pinces[c]} />
              <span className="barre-lettre">{arme === `pince-${c}` ? (ouverte ? 'FERMER ?' : 'OUVRIR ?') : enCours ? '…' : c === 'gauche' ? 'G' : 'D'}</span>
            </button>
          );
        })}
      </section>

      <button className={`barre-bouton barre-home ${arme === 'home' ? 'arme' : ''}`} disabled={bloque}
        onClick={() => confirmer('home', () => ordonner(api.home(robot.id)))} title="Ramener les bras dans la posture de travail">
        {robot.geste === 'home' ? 'HOME…' : arme === 'home' ? 'CONFIRMER ?' : '⌂ HOME'}
      </button>
      </div>

      <span className="barre-espace" />
      {erreur && <span className="barre-erreur" role="alert">{erreur}</span>}

      {estop ? (
        <button className="barre-estop-bouton engage" onClick={() => ordonner(api.rearmer(robot.id))}
          title="Arrêt d'urgence engagé : clic pour réarmer">
          <span>E-STOP ENGAGÉ</span><small>RÉARMER</small>
        </button>
      ) : (
        <button className="barre-estop-bouton" disabled={horsLigne} onClick={() => ordonner(api.arretUrgence(robot.id))}
          title="Arrêt d'urgence : coupe tout, immédiatement">
          <span>■ E-STOP</span>
        </button>
      )}
      {/* Hors de la barre : son flou d'arrière-plan et sa translation confineraient le liseré à sa propre boîte. */}
      {bords && createPortal(bords === 'engage'
        ? <div className="estop-bords" role="alert" aria-label="Arrêt d'urgence engagé" />
        : <div className="estop-bords estop-retour" aria-hidden="true" />, document.body)}
    </div>
  );
}

const GESTES: Record<NonNullable<Robot['geste']>, string> = {
  home: 'vers la posture de travail…',
  pince_gauche: 'pince gauche…',
  pince_droite: 'pince droite…',
};
