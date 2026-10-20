import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { api } from '../api/client';
import { ETATS_ROBOT } from '../api/libelles';
import type { Cote, EtatCorps, EtatMoteur, ModeBras, Moteur, Robot } from '../api/types';

/** La barre se relit à cette période : les températures et l'état du robot sont vivants. */
const RAFRAICHI_MS = 1000;
/** Un ordre qui fait bouger le robot demande un second clic dans ce délai (ms) : le premier l'arme. */
const CONFIRMATION_MS = 3000;
/** Une erreur reste affichée ce temps (ms). */
const ERREUR_MS = 4000;

/** Les groupes de moteurs dont la barre montre la température, chacun au pire de ses moteurs. */
const GROUPES: { cle: string; libelle: string; contient: (nom: string) => boolean }[] = [
  { cle: 'mains', libelle: 'MAINS', contient: (n) => /poignet|pince/.test(n) },
  { cle: 'bras', libelle: 'BRAS', contient: (n) => /épaule|coude/.test(n) },
  { cle: 'corps', libelle: 'CORPS', contient: (n) => /torse/.test(n) },
];

/** Le pire verdict d'abord : c'est lui qui colore le groupe. */
const GRAVITE: EtatMoteur[] = ['inconnu', 'ok', 'chaud', 'trop_chaud', 'defaut'];
const TON: Record<EtatMoteur, string> = {
  ok: 'ok', chaud: 'alerte', trop_chaud: 'danger', defaut: 'danger', inconnu: 'muet',
};

export type FormeBarre = 'bandeau' | 'ile';

interface Groupe { libelle: string; temperature: number | null; etat: EtatMoteur; chaud: Moteur | null }

/** La température de chaque groupe : celle de son moteur le plus chaud, et le pire verdict du groupe. */
function groupes(corps: EtatCorps | null): Groupe[] {
  return GROUPES.map(({ libelle, contient }) => {
    const ms = (corps?.moteurs ?? []).filter((m) => contient(m.nom));
    const chaud = ms.reduce<Moteur | null>((a, m) => (m.temperature != null && (a?.temperature == null || m.temperature > a.temperature) ? m : a), null);
    const etat = ms.reduce<EtatMoteur>((a, m) => (GRAVITE.indexOf(m.etat) > GRAVITE.indexOf(a) ? m.etat : a), 'inconnu');
    return { libelle, temperature: chaud?.temperature ?? null, etat, chaud };
  });
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
      <section className="barre-groupe barre-identite" title={`Connexion : ${etat.libelle}`}>
        <span className={`barre-point ton-${horsLigne ? 'danger' : estop ? 'danger' : 'ok'}`} />
        <span className="barre-nom">{robot.nom}</span>
        <span className="barre-sous">{robot.geste ? GESTES[robot.geste] : etat.libelle}</span>
      </section>

      <section className="barre-groupe" title={`Batterie ${robot.batterie} %`}>
        <span className="barre-etiquette">BAT</span>
        <span className="barre-batterie"><span className={`fond-${tonBatterie}`} style={{ width: `${robot.batterie}%` }} /></span>
        <span className={`barre-valeur ton-${tonBatterie}`}>{robot.batterie}%</span>
      </section>

      <Link to={`/flotte/${robot.id}/corps`} className="barre-groupe barre-temperatures" title="État du corps : le détail par moteur">
        {groupes(corps).map((g) => (
          <span key={g.libelle} className="barre-temperature"
            title={g.chaud ? `${g.libelle.toLowerCase()} : le plus chaud est « ${g.chaud.nom} » (${g.chaud.temperature}°${g.chaud.rouge != null ? `, rouge à ${g.chaud.rouge}°` : ''})` : undefined}>
            <span className="barre-etiquette">{g.libelle}</span>
            <span className={`barre-valeur ton-${TON[g.etat]}`}>{g.temperature == null ? '—' : `${g.temperature}°`}</span>
          </span>
        ))}
      </Link>

      <section className="barre-groupe" aria-label="Bras">
        <span className="barre-etiquette">BRAS</span>
        <span className="barre-segment" role="radiogroup">
          {(['rigide', 'mou'] as const).map((m) => (
            <button key={m} role="radio" aria-checked={robot.modeBras === m} disabled={bloque}
              className={`${robot.modeBras === m ? 'actif' : ''} ${arme === m ? 'arme' : ''}`} onClick={() => changerMode(m)}
              title={m === 'mou' ? 'Compensation de la gravité : les bras se guident à la main' : 'Les bras tiennent leur position'}>
              {arme === m ? 'CONFIRMER ?' : m === 'mou' ? 'MOU · GRAVITÉ' : 'RIGIDE'}
            </button>
          ))}
        </span>
      </section>

      <section className="barre-groupe" aria-label="Pinces">
        <span className="barre-etiquette">PINCES</span>
        {(['gauche', 'droite'] as const).map((c) => {
          const ouverte = robot.pinces[c] > 0.5;
          const enCours = robot.geste === `pince_${c}`;
          return (
            <button key={c} className={`barre-bouton barre-pince ${arme === `pince-${c}` ? 'arme' : ''}`} disabled={bloque}
              onClick={() => pince(c)} title={`Pince ${c} ${ouverte ? 'ouverte' : 'fermée'} : clic pour ${ouverte ? 'fermer' : 'ouvrir'}`}>
              <span className="barre-mors" style={{ ['--ouverture' as string]: robot.pinces[c] }} aria-hidden="true"><i /><i /></span>
              {arme === `pince-${c}` ? (ouverte ? 'FERMER ?' : 'OUVRIR ?') : enCours ? '…' : c === 'gauche' ? 'G' : 'D'}
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
    </div>
  );
}

const GESTES: Record<NonNullable<Robot['geste']>, string> = {
  home: 'Vers la posture de travail…',
  pince_gauche: 'Pince gauche…',
  pince_droite: 'Pince droite…',
};
