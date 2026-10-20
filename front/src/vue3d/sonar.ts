import * as THREE from 'three';

/** La vitesse de l'impulsion (m/s), sa portée (m) et le silence entre deux impulsions (s). */
const VITESSE = 4.2;
const PORTEE = 10;
const SILENCE_S = 0.7;
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
    float front = smoothstep(0.09, 0.0, abs(x));
    float traine = x > 0.0 ? exp(-x / 0.45) * 0.5 : 0.0;
    float attenue = exp(-uSonarRayon * 0.2) * smoothstep(${PORTEE.toFixed(1)}, ${(PORTEE * 0.6).toFixed(1)}, uSonarRayon);
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
