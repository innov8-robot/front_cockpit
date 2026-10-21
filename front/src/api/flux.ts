/**
 * Les flux binaires du serveur du robot (`/ws/camera`, `/ws/lidar`) : la connexion qui se rétablit seule, et le
 * décodage des trames. Le format est décrit dans docs/code/serveur_web/serveur_web.md §Les trames.
 */

export interface TrameImage {
  seq: number;
  largeur: number;
  hauteur: number;
  /** `[fx, fy, cx, cy]` de l'image pleine. */
  intrinseques: [number, number, number, number] | null;
  /** La hand-eye `T_base_cam` (4 × 4, en lignes) : de la caméra au torse. */
  pose: number[][] | null;
  jpeg: Blob;
  /** La profondeur sous-échantillonnée, en mm. */
  profondeur: { largeur: number; hauteur: number; pas: number; mm: Uint16Array } | null;
}

export interface TrameNuage {
  seq: number;
  /** Les points (x, y, z) en mètres, repère du torse, en float32 (décodés du float16). */
  points: Float32Array;
  reflectivite: Uint8Array;
}

const TYPE_IMAGE = 1;
const TYPE_NUAGE = 2;

function float16(h: number): number {
  const s = h & 0x8000 ? -1 : 1;
  const e = (h >> 10) & 0x1f;
  const f = h & 0x3ff;
  if (e === 0) return s * 2 ** -14 * (f / 1024);
  if (e === 31) return f ? NaN : s * Infinity;
  return s * 2 ** (e - 15) * (1 + f / 1024);
}

/** Sépare l'en-tête JSON des charges ; rejette ce qui n'est pas une trame (magie « G1 »). */
function decouper(tampon: ArrayBuffer): { type: number; entete: Record<string, unknown>; debut: number } {
  const vue = new DataView(tampon);
  if (tampon.byteLength < 7 || vue.getUint8(0) !== 0x47 || vue.getUint8(1) !== 0x31) {
    throw new Error('trame sans magie G1');
  }
  const n = vue.getUint32(3, true);
  const entete = JSON.parse(new TextDecoder().decode(new Uint8Array(tampon, 7, n)));
  return { type: vue.getUint8(2), entete, debut: 7 + n };
}

export function decoderImage(tampon: ArrayBuffer): TrameImage {
  const { type, entete: e, debut } = decouper(tampon);
  if (type !== TYPE_IMAGE) throw new Error('ce n’est pas une trame d’image');
  const nJpeg = e.jpeg as number;
  const p = e.profondeur as { largeur: number; hauteur: number; pas: number } | null;
  let profondeur: TrameImage['profondeur'] = null;
  if (p) {
    // Copie : la vue d'un Uint16Array exige un décalage pair, que l'en-tête ne garantit pas.
    const octets = tampon.slice(debut + nJpeg, debut + nJpeg + p.largeur * p.hauteur * 2);
    profondeur = { ...p, mm: new Uint16Array(octets) };
  }
  return {
    seq: e.seq as number, largeur: e.largeur as number, hauteur: e.hauteur as number,
    intrinseques: e.intrinseques as TrameImage['intrinseques'], pose: (e.pose as number[][] | null) ?? null,
    jpeg: new Blob([new Uint8Array(tampon, debut, nJpeg)], { type: 'image/jpeg' }), profondeur,
  };
}

export function decoderNuage(tampon: ArrayBuffer): TrameNuage {
  const { type, entete: e, debut } = decouper(tampon);
  if (type !== TYPE_NUAGE) throw new Error('ce n’est pas une trame de nuage');
  const n = e.n as number;
  const brut = new DataView(tampon, debut, n * 6);
  const points = new Float32Array(n * 3);
  for (let k = 0; k < n * 3; k++) points[k] = float16(brut.getUint16(k * 2, true));
  return { seq: e.seq as number, points, reflectivite: new Uint8Array(tampon.slice(debut + n * 6, debut + n * 7)) };
}

/**
 * Ouvre un flux et le rétablit quand il tombe ; chaque trame reçue part à `surTrame`.
 *
 * @returns De quoi fermer le flux pour de bon.
 */
export function ouvrirFlux(url: string, chemin: string, surTrame: (t: ArrayBuffer) => void,
  surEtat?: (ouvert: boolean) => void): () => void {
  let ws: WebSocket | null = null;
  let fini = false;
  let attente = 0;
  const ouvrir = () => {
    ws = new WebSocket(`${url.replace(/^http/, 'ws')}${chemin}`);
    ws.binaryType = 'arraybuffer';
    ws.onopen = () => surEtat?.(true);
    ws.onmessage = (m) => surTrame(m.data as ArrayBuffer);
    ws.onclose = () => {
      surEtat?.(false);
      if (!fini) attente = window.setTimeout(ouvrir, 1500);
    };
  };
  ouvrir();
  return () => {
    fini = true;
    clearTimeout(attente);
    ws?.close();
  };
}
