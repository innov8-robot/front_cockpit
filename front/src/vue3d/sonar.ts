import * as THREE from 'three';

/** La vitesse de l'impulsion (m/s), sa portée (m) et le silence entre deux impulsions (s). */
const VITESSE = 3.6;
const PORTEE = 9;
const SILENCE_S = 0.6;
/** La distance (m) sur laquelle l'impulsion perd les deux tiers de son éclat : elle s'évanouit en s'éloignant. */
const EVANESCENCE_M = 2.6;
/** La couleur de l'impulsion. */
export const BLEU_SONAR = new THREE.Color('#3d9bff');

/**
 * Les uniformes de l'impulsion, partagés par tous les matériaux qui la montrent (nuages, sol, arêtes des meubles) :
 * un seul objet, mis à jour une fois par image, et tout s'allume au même instant.
 */
export const SONAR = {
  uSonarOrigine: { value: new THREE.Vector3() },
  uSonarRayon: { value: 0 },
  uSonarForce: { value: 0 },
  uSonarCouleur: { value: BLEU_SONAR },
};

/**
 * L'intensité de l'impulsion en un point du monde : un front net sur la sphère, une traîne derrière lui, et le tout
 * s'éteint avec la distance parcourue, comme l'écho d'un sonar.
 */
export const GLSL_SONAR = /* glsl */ `
  uniform vec3 uSonarOrigine;
  uniform float uSonarRayon;
  uniform float uSonarForce;
  uniform vec3 uSonarCouleur;
  float sonar(vec3 p) {
    float x = uSonarRayon - distance(p, uSonarOrigine);
    float front = smoothstep(0.1, 0.0, abs(x));
    float traine = x > 0.0 ? exp(-x / 0.3) * 0.55 : 0.0;
    float attenue = exp(-uSonarRayon / ${EVANESCENCE_M.toFixed(2)}) * (1.0 - smoothstep(${(PORTEE * 0.55).toFixed(1)}, ${PORTEE.toFixed(1)}, uSonarRayon));
    return (front + traine) * attenue * uSonarForce;
  }
`;

/** Avance l'impulsion : `origine` est la tête du robot dans le monde, `force` de 0 (éteinte) à 1. */
export function mettreAJourSonar(t: number, origine: THREE.Vector3, force: number): void {
  const periode = PORTEE / VITESSE + SILENCE_S;
  SONAR.uSonarRayon.value = (t % periode) * VITESSE;
  SONAR.uSonarOrigine.value.copy(origine);
  SONAR.uSonarForce.value = force;
}

/** L'éclat de l'anneau sous le robot à l'émission : fort au départ de l'impulsion, nul quand elle s'est éloignée. */
export const GLSL_EMISSION = /* glsl */ `exp(-uSonarRayon * 2.5) * uSonarForce`;

/**
 * La peau du sonar : posée sur les surfaces des meubles et des objets, elle ne s'allume que dans la bande de
 * l'impulsion, qui s'enroule ainsi sur leurs formes. Tracée juste après les volumes de masquage, à leur profondeur :
 * ce qui est devant la cache, comme pour un vrai balayage laser.
 */
export const MATERIAU_PEAU = new THREE.ShaderMaterial({
  transparent: true,
  depthWrite: false,
  blending: THREE.AdditiveBlending,
  uniforms: SONAR,
  vertexShader: /* glsl */ `
    varying vec3 vMonde;
    void main() {
      vec4 monde = modelMatrix * vec4(position, 1.0);
      vMonde = monde.xyz;
      gl_Position = projectionMatrix * viewMatrix * monde;
    }`,
  fragmentShader: /* glsl */ `
    varying vec3 vMonde;
    ${GLSL_SONAR}
    void main() {
      float s = sonar(vMonde);
      if (s < 0.01) discard;
      gl_FragColor = vec4(mix(uSonarCouleur, vec3(1.0), smoothstep(0.7, 1.2, s) * 0.5) * s * 1.3, 1.0);
    }`,
});

/** Fait passer l'impulsion sur les arêtes d'un matériau de traits : elles s'allument en bleu au passage du front. */
export function sonariser(materiau: THREE.LineBasicMaterial): void {
  materiau.onBeforeCompile = (shader) => {
    Object.assign(shader.uniforms, SONAR);
    shader.vertexShader = shader.vertexShader
      .replace('void main() {', 'varying vec3 vSonarMonde;\nvoid main() {')
      .replace('#include <begin_vertex>', '#include <begin_vertex>\nvSonarMonde = (modelMatrix * vec4(transformed, 1.0)).xyz;');
    shader.fragmentShader = shader.fragmentShader
      .replace('void main() {', `varying vec3 vSonarMonde;\n${GLSL_SONAR}\nvoid main() {`)
      .replace('#include <opaque_fragment>', `#include <opaque_fragment>
        float s = sonar(vSonarMonde);
        gl_FragColor = vec4(gl_FragColor.rgb + uSonarCouleur * s * 2.2, max(gl_FragColor.a, min(1.0, s * 1.4)));`);
  };
}
