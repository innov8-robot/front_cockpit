import { useEffect, useRef, useState } from 'react';

/** Les lettres du logo en 5×7, deux lignes de deux ; chaque pixel devient 2×2 points. */
const LOGO = ['G1', '-D'];
const LETTRES: Record<string, string[]> = {
  G: ['.###.', '#...#', '#....', '#.###', '#...#', '#...#', '.###.'],
  '1': ['..#..', '.##..', '..#..', '..#..', '..#..', '..#..', '.###.'],
  '-': ['.....', '.....', '.....', '#####', '.....', '.....', '.....'],
  D: ['####.', '#...#', '#...#', '#...#', '#...#', '#...#', '####.'],
};

/** Le journal du POST : [texte, statut, délai avant la ligne (ms)]. `null` = attend le chargement réel du robot. */
const JOURNAL: [string, string | null, number][] = [
  ['DRAM Training.. 32768MB LPDDR5 Detected at 3200MHz', 'OK', 260],
  ['Map Internal Memory Bus..', 'OK', 140],
  ['Probing Jetson Orin Compute Module..', 'OK', 180],
  ['Initializing Power Distribution Unit (PDU-A/B)..', '04 Rails Found', 160],
  ['DDS Domain 0 Discovery.. 192.168.123.0/24', 'BOUND', 220],
  ['Enumerating rt/lowstate..', '35 Motors FOUND', 200],
  ['Dex1 Grippers [31][33]..', 'ALIVE', 150],
  ['RealSense D435i (SN 335522072400)..', 'STREAM 30Hz', 240],
  ['Livox MID360 @ 192.168.123.120..', '200k pts/s', 200],
  ['Slamtec Chassis REST :1448..', 'LOCALIZED', 180],
  ['Telescopic Column Homing..', 'REF OK', 220],
  ['Loading Kinematics URDF g1_d_dex1..', null, 160],
  ['Compiling Motion Planner (cuRobo)..', 'READY', 260],
  ['Grasp Detector grasp6d [nov3]..', 'LOADED', 180],
  ['Arming E-STOP Latch..', 'ARMED', 200],
];

const COLONNES = [
  ['PWR_STATE: GOOD', 'BATT_V: 52.8V', 'BMS_TEMP: 31C'],
  ['CPU_CLUSTER: 12C', 'GPU_SM: 2048', 'MEM_ECC: ON'],
  ['NET_LINK: 1000M', 'EEE: DISABLED', 'MTU: 1500'],
  ['IMU_200HZ: OK', 'GRAVITY: -1.00G', 'ROLL: 180.0'],
  ['ARM_SDK: FREE', 'LATCH: CLEAR', 'TORSO: 0.00'],
];

/** L'extinction du terminal en néon, puis le noir complet avant le logo (voir `.boot-sortie`). */
const EXTINCTION_MS = 1500;

const hex = (i: number) => `0x${(0x2b80 + i * 0x1c + ((i * 37) % 11)).toString(16).toUpperCase()}`;

function LogoPoints() {
  const toile = useRef<HTMLCanvasElement>(null);
  useEffect(() => {
    const c = toile.current;
    if (!c) return;
    const N = 34;
    const encre = new Set<string>();
    LOGO.forEach((ligne, j) => [...ligne].forEach((lettre, i) => {
      LETTRES[lettre].forEach((rangee, y) => [...rangee].forEach((px, x) => {
        if (px !== '#') return;
        for (const [dx, dy] of [[0, 0], [1, 0], [0, 1], [1, 1]]) {
          encre.add(`${6 + i * 12 + x * 2 + dx},${2 + j * 16 + y * 2 + dy}`);
        }
      }));
    }));

    const pas = 3;
    const ctx = c.getContext('2d')!;
    c.width = c.height = N * pas * 2;
    ctx.scale(2, 2);
    for (let y = 0; y < N; y++) {
      for (let x = 0; x < N; x++) {
        const plein = encre.has(`${x},${y}`);
        ctx.fillStyle = plein ? '#0a0b0d' : `rgb(205 210 218 / ${0.55 + ((x * 7 + y * 13) % 5) * 0.08})`;
        ctx.beginPath();
        ctx.arc(x * pas + pas / 2, y * pas + pas / 2, pas * 0.36, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  }, []);
  return <canvas ref={toile} className="boot-logo" aria-hidden="true" />;
}

/** L'écran de démarrage façon BIOS. Il couvre le chargement réel et se termine quand le robot est prêt. */
export function Demarrage({ pret, onFini }: { pret: boolean; onFini(): void }) {
  const [colonnes, setColonnes] = useState(0);
  const [lignes, setLignes] = useState(0);
  const [statuts, setStatuts] = useState(0);
  const [sortie, setSortie] = useState(false);
  const reduit = typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;
  const vitesse = reduit ? 0.3 : 1;
  const finir = useRef(onFini);
  finir.current = onFini;

  useEffect(() => {
    const t = setInterval(() => setColonnes((n) => (n >= COLONNES.length ? n : n + 1)), 260 * vitesse);
    return () => clearInterval(t);
  }, [vitesse]);

  // Une ligne apparaît, puis son statut ; la ligne du robot attend le chargement réel.
  useEffect(() => {
    if (colonnes < 2) return;
    if (lignes > statuts) {
      const enAttente = JOURNAL[statuts][1] === null && !pret;
      if (enAttente) return;
      const t = setTimeout(() => setStatuts(statuts + 1), (90 + Math.random() * 220) * vitesse);
      return () => clearTimeout(t);
    }
    if (lignes < JOURNAL.length) {
      const t = setTimeout(() => setLignes(lignes + 1), JOURNAL[lignes][2] * vitesse);
      return () => clearTimeout(t);
    }
    const t = setTimeout(() => setSortie(true), 700 * vitesse);
    return () => clearTimeout(t);
  }, [colonnes, lignes, statuts, pret, vitesse]);

  useEffect(() => {
    if (!sortie) return;
    const t = setTimeout(() => finir.current(), EXTINCTION_MS);
    return () => clearTimeout(t);
  }, [sortie]);

  // Passer : un toucher ou une touche, dès que le robot est chargé.
  useEffect(() => {
    const passer = () => pret && setSortie(true);
    window.addEventListener('keydown', passer);
    return () => window.removeEventListener('keydown', passer);
  }, [pret]);

  return (
    <div className={`boot ${sortie ? 'boot-sortie' : ''}`} onPointerDown={() => pret && setSortie(true)}>
      <div className="boot-gauche">
        <LogoPoints />
        <div className="boot-colonnes">
          {COLONNES.slice(0, colonnes).map((bloc, i) => (
            <p key={i}>{bloc.map((l) => <span key={l}>{l}</span>)}</p>
          ))}
        </div>
      </div>

      {colonnes >= 2 && (
        <div className="boot-journal">
          <p className="boot-titre">G1-D POWER-ON SELF-TEST (POST) // BUILD 0.448.0</p>
          <p className="boot-titre">INITIALIZING LOW-LEVEL EMBEDDED SYSTEM CONTROLLER..</p>
          <p>&nbsp;</p>
          {JOURNAL.slice(0, lignes).map(([texte, statut], i) => {
            const fait = i < statuts;
            const attente = !fait && statut === null;
            return (
              <p key={i}>
                <span className="boot-adr">{hex(i)}</span>{' '}
                <span className="boot-temps">[ {(i * 0.0137 + i * i * 0.0011).toFixed(3)} ]</span>{' '}
                {texte}{' '}
                {fait && <span className={statut === null ? 'boot-ok' : 'boot-statut'}>{statut ?? '32 Meshes OK'}</span>}
                {attente && <span className="boot-curseur">_</span>}
              </p>
            );
          })}
          {lignes === JOURNAL.length && statuts === JOURNAL.length && (
            <>
              <p>&nbsp;</p>
              <p className="boot-pret">SYSTEM READY — ENTERING OPERATOR VIEW<span className="boot-curseur">_</span></p>
            </>
          )}
        </div>
      )}

      {pret && !sortie && <p className="boot-passer">Toucher pour passer</p>}
    </div>
  );
}
