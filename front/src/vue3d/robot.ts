import * as THREE from 'three';
import { STLLoader } from 'three/examples/jsm/loaders/STLLoader.js';
import URDFLoader, { type URDFRobot } from 'urdf-loader';

const URDF = 'robot/g1_d/g1_d_dex1.urdf';

/** Corps sombre dont seuls les bords vus de biais s'allument (effet de Fresnel) : la silhouette en verre. */
const verre = new THREE.ShaderMaterial({
  polygonOffset: true,
  polygonOffsetFactor: 1,
  polygonOffsetUnits: 1,
  uniforms: { uCouleur: { value: new THREE.Color('#e9f0ff') }, uPuissance: { value: 2.6 }, uAllume: { value: 1 } },
  vertexShader: /* glsl */ `
    varying vec3 vNormale;
    varying vec3 vVue;
    void main() {
      vec4 vue = modelViewMatrix * vec4(position, 1.0);
      vNormale = normalize(normalMatrix * normal);
      vVue = normalize(-vue.xyz);
      gl_Position = projectionMatrix * vue;
    }`,
  fragmentShader: /* glsl */ `
    uniform vec3 uCouleur;
    uniform float uPuissance;
    uniform float uAllume;
    varying vec3 vNormale;
    varying vec3 vVue;
    void main() {
      float f = pow(1.0 - abs(dot(normalize(vNormale), normalize(vVue))), uPuissance);
      gl_FragColor = vec4(vec3(0.012, 0.016, 0.022) + uCouleur * f * 1.6 * uAllume, 1.0);
    }`,
});

const aretes = new THREE.LineBasicMaterial({ color: '#cdd8ee', transparent: true, opacity: 0.55 });

/** Les angles de la posture de garde affichée. */
const POSTURE: Record<string, number> = {
  left_shoulder_pitch_joint: -0.35, right_shoulder_pitch_joint: -0.35,
  left_shoulder_roll_joint: 0.22, right_shoulder_roll_joint: -0.22,
  left_elbow_joint: 0.95, right_elbow_joint: 0.95,
  left_wrist_roll_joint: 0, right_wrist_roll_joint: 0,
};

/** Charge le G1-D depuis son URDF et habille chaque maillage en verre et arêtes. */
export function chargerRobot(): Promise<URDFRobot> {
  return new Promise((ok, echec) => {
    const stl = new STLLoader();
    const chargeur = new URDFLoader();
    let robot: URDFRobot | null = null;
    let enAttente = 0;
    const peutEtreFini = () => (robot && enAttente === 0 ? ok(robot) : undefined);

    chargeur.loadMeshCb = (chemin, _manager, _materiau, fini) => {
      if (!/\.stl$/i.test(chemin)) {
        fini(new THREE.Object3D());
        return;
      }
      enAttente++;
      const rendre = (objet: THREE.Object3D, e?: Error) => {
        fini(objet, e);
        enAttente--;
        peutEtreFini();
      };
      stl.load(chemin, (geometrie) => {
        geometrie.computeVertexNormals();
        const groupe = new THREE.Group();
        groupe.add(new THREE.Mesh(geometrie, verre));
        groupe.add(new THREE.LineSegments(new THREE.EdgesGeometry(geometrie, 35), aretes));
        rendre(groupe);
      }, undefined, (e) => rendre(new THREE.Object3D(), e as Error));
    };

    chargeur.load(URDF, (r) => {
      robot = r;
      for (const [nom, angle] of Object.entries(POSTURE)) r.setJointValue(nom, angle);
      peutEtreFini();
    }, undefined, echec);
  });
}

/** Une respiration lente : le buste et les bras bougent à peine, pour que la scène vive. */
export function animerRobot(robot: URDFRobot, t: number): void {
  robot.setJointValue('torso_Joint', Math.sin(t * 0.35) * 0.18);
  for (const cote of ['left', 'right']) {
    robot.setJointValue(`${cote}_elbow_joint`, POSTURE[`${cote}_elbow_joint`] + Math.sin(t * 0.9) * 0.05);
    robot.setJointValue(`${cote}_shoulder_pitch_joint`, POSTURE[`${cote}_shoulder_pitch_joint`] + Math.sin(t * 0.6) * 0.04);
  }
}

/** L'allumage du robot, de 0 (éteint) à 1 : au-dessous de 0,15 il disparaît, au-dessus son éclat suit. */
export function allumerRobot(robot: URDFRobot, niveau: number): void {
  robot.visible = niveau > 0.15;
  verre.uniforms.uAllume.value = niveau;
  aretes.opacity = 0.55 * niveau;
}
