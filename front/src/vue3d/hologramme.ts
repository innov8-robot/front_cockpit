import * as THREE from 'three';
import { CAMERA_TETE } from './nuages';

/** La distance de l'écran à la caméra (m) : c'est aussi le rayon de sa courbure. */
const DISTANCE = 0.25;
/** L'écran est présenté devant le visage, presque de face : l'image, elle, garde le vrai tangage de la caméra. */
const TANGAGE_AFFICHAGE_DEG = 12;
const LARGEUR_IMAGE = 384;
/** L'image de la caméra se rafraîchit une image sur deux : elle coûte un second rendu de la scène. */
const UNE_SUR = 2;

const DEG = THREE.MathUtils.degToRad;

/**
 * L'écran incurvé de la caméra de tête, en hologramme : un arc de cylindre centré sur la caméra, de l'angle exact
 * de son champ, et la pyramide qui le relie à elle. L'image est la scène vue depuis la vraie pose de la caméra.
 */
export function creerHologramme(rendu: THREE.WebGLRenderer, scene: THREE.Scene, origine: THREE.Vector3) {
  const demiH = DEG(CAMERA_TETE.champHDeg) / 2;
  const demiV = DEG(CAMERA_TETE.champVDeg) / 2;
  const aspect = Math.tan(demiH) / Math.tan(demiV);

  // Un repère de caméra dans celui du robot (x devant, z en haut) : il regarde vers -z, son haut est y.
  const repere = (tangageDeg: number) => {
    const t = DEG(tangageDeg);
    const devant = new THREE.Vector3(Math.cos(t), 0, -Math.sin(t));
    const haut = new THREE.Vector3(Math.sin(t), 0, Math.cos(t));
    const cote = new THREE.Vector3().crossVectors(haut, devant.clone().negate());
    return new THREE.Quaternion().setFromRotationMatrix(new THREE.Matrix4().makeBasis(cote, haut, devant.negate()));
  };
  const groupe = new THREE.Group();
  groupe.position.copy(origine).add(new THREE.Vector3(0, 0, 0.06));
  const vraie = new THREE.Group();
  vraie.quaternion.copy(repere(CAMERA_TETE.tangageDeg));
  groupe.add(vraie);

  const oeil = new THREE.PerspectiveCamera(CAMERA_TETE.champVDeg, aspect, 0.05, 20);
  vraie.add(oeil);
  const cible = new THREE.WebGLRenderTarget(LARGEUR_IMAGE, Math.round(LARGEUR_IMAGE / aspect), { samples: 2 });

  // L'arc : chaque colonne de l'écran est à DISTANCE de la caméra, dans la direction qu'elle voit.
  const hauteur = 2 * DISTANCE * Math.tan(demiV);
  const ecran = new THREE.PlaneGeometry(1, hauteur, 48, 1);
  const p = ecran.attributes.position;
  for (let k = 0; k < p.count; k++) {
    const angle = p.getX(k) * 2 * demiH;
    p.setXYZ(k, DISTANCE * Math.sin(angle), p.getY(k), -DISTANCE * Math.cos(angle));
  }
  ecran.computeVertexNormals();

  const materiau = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    side: THREE.DoubleSide,
    uniforms: { uImage: { value: cible.texture }, uTemps: { value: 0 }, uSurvol: { value: 0 } },
    vertexShader: /* glsl */ `
      varying vec2 vUv;
      void main() { vUv = uv; gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0); }`,
    fragmentShader: /* glsl */ `
      uniform sampler2D uImage;
      uniform float uTemps;
      uniform float uSurvol;
      varying vec2 vUv;
      void main() {
        // Vu de l'extérieur, on regarde l'écran de dos : on retourne l'image pour qu'elle se lise à l'endroit.
        vec2 uv = gl_FrontFacing ? vUv : vec2(1.0 - vUv.x, vUv.y);
        vec3 image = texture2D(uImage, uv).rgb;
        float lum = dot(image, vec3(0.3, 0.55, 0.15));
        vec3 couleur = mix(image, vec3(0.45, 0.85, 1.0) * (0.15 + lum * 1.8), 0.5);
        float lignes = 0.78 + 0.22 * sin(vUv.y * 260.0 - uTemps * 6.0);
        float bande = smoothstep(0.06, 0.0, abs(fract(vUv.y - uTemps * 0.18) - 0.5)) * 0.35;
        float bord = smoothstep(0.0, 0.05, vUv.x) * smoothstep(1.0, 0.95, vUv.x)
                   * smoothstep(0.0, 0.07, vUv.y) * smoothstep(1.0, 0.93, vUv.y);
        float scintille = 0.92 + 0.08 * sin(uTemps * 31.0) * sin(uTemps * 7.0);
        // Survolé, l'écran s'avive : on comprend qu'on peut cliquer dessus.
        vec3 eclat = couleur * lignes * (1.0 + 0.7 * uSurvol) + vec3(0.5, 0.9, 1.0) * (bande + 0.12 * uSurvol);
        gl_FragColor = vec4(eclat, (0.62 + bande + 0.25 * uSurvol) * bord * scintille);
      }`,
  });
  const panneau = new THREE.Mesh(ecran, materiau);

  // Le cadre de l'écran et la pyramide jusqu'à la caméra.
  const traits = new THREE.LineBasicMaterial({ color: '#8fe3ff', transparent: true, opacity: 0.55, depthWrite: false });
  const arc = (y: number) => Array.from({ length: 33 }, (_, k) => {
    const angle = -demiH + (2 * demiH * k) / 32;
    return new THREE.Vector3(DISTANCE * Math.sin(angle), y, -DISTANCE * Math.cos(angle));
  });
  const bas = arc(-hauteur / 2);
  const dessus = arc(hauteur / 2);
  const coins = [bas[0], bas[32], dessus[32], dessus[0]];
  const cadre = new THREE.Group();
  cadre.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(bas), traits));
  cadre.add(new THREE.Line(new THREE.BufferGeometry().setFromPoints(dessus), traits));
  cadre.add(new THREE.LineSegments(new THREE.BufferGeometry().setFromPoints(
    [bas[0], dessus[0], bas[32], dessus[32], ...coins.flatMap((c) => [new THREE.Vector3(), c])],
  ), traits));

  const affiche = new THREE.Group();
  affiche.quaternion.copy(repere(TANGAGE_AFFICHAGE_DEG));
  affiche.add(panneau, cadre);
  groupe.add(affiche);

  let image = 0;
  // Une vraie image de la caméra de tête, si un run en a laissé une (scripts/copier-camera.mjs) : l'écran la
  // montre à la place de la scène filmée, qu'il cesse alors de rendre.
  let photo = false;
  new THREE.TextureLoader().load('camera/apercu.jpg', (texture) => {
    texture.colorSpace = THREE.SRGBColorSpace;
    materiau.uniforms.uImage.value = texture;
    photo = true;
  }, undefined, () => undefined);
  let survol = 0;
  let cibleSurvol = 0;
  return {
    groupe,
    /** L'écran, pour savoir si le pointeur le survole. */
    panneau,
    /** La caméra de tête elle-même : la vue plein écran vole jusqu'à elle. */
    oeil,
    /** Le repère de la caméra (regarde vers -z) : le nuage réel de la caméra s'y accroche. */
    vraie,
    /** Montre une image du vrai flux sur l'écran, à la place de la scène filmée. */
    afficherImage(bitmap: ImageBitmap) {
      const ancienne = materiau.uniforms.uImage.value as THREE.Texture;
      const texture = new THREE.Texture(bitmap);
      texture.colorSpace = THREE.SRGBColorSpace;
      texture.flipY = false;
      texture.needsUpdate = true;
      materiau.uniforms.uImage.value = texture;
      if (photo && ancienne !== cible.texture) ancienne.dispose();
      photo = true;
    },
    /** Cache l'écran et sa pyramide (quand on regarde par la caméra, on ne doit pas les voir). */
    masquer(masque: boolean) {
      affiche.visible = !masque;
    },
    survoler(actif: boolean) {
      cibleSurvol = actif ? 1 : 0;
    },
    mettreAJour(t: number) {
      materiau.uniforms.uTemps.value = t;
      survol += (cibleSurvol - survol) * 0.18;
      materiau.uniforms.uSurvol.value = survol;
      traits.opacity = 0.55 + 0.45 * survol * (0.6 + 0.4 * Math.sin(t * 7));
      if (photo || !groupe.visible || image++ % UNE_SUR) return;
      // L'hologramme ne se filme pas lui-même.
      const visible = affiche.visible;
      affiche.visible = false;
      const avant = rendu.getRenderTarget();
      rendu.setRenderTarget(cible);
      rendu.render(scene, oeil);
      rendu.setRenderTarget(avant);
      affiche.visible = visible;
    },
    detruire() {
      cible.dispose();
      ecran.dispose();
      materiau.dispose();
    },
  };
}
