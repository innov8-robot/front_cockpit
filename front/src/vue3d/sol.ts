import * as THREE from 'three';
import { GLSL_EMISSION, GLSL_SONAR, SONAR } from './sonar';

/**
 * Le sol : une grille de lignes et de points qui s'efface avec la distance, un anneau sous le robot, et la trace de
 * l'impulsion du sonar, là où sa sphère coupe le sol.
 */
export function creerSol(): THREE.Mesh {
  const materiau = new THREE.ShaderMaterial({
    transparent: true,
    depthWrite: false,
    uniforms: {
      uTemps: { value: 0 },
      uRevele: { value: 1000 },
      uLigne: { value: new THREE.Color('#cfd6e4') },
      uAccent: { value: new THREE.Color('#ff2d3a') },
      ...SONAR,
    },
    vertexShader: /* glsl */ `
      varying vec2 vXZ;
      varying vec3 vMonde;
      void main() {
        vec4 monde = modelMatrix * vec4(position, 1.0);
        vXZ = monde.xz;
        vMonde = monde.xyz;
        gl_Position = projectionMatrix * viewMatrix * monde;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTemps;
      uniform float uRevele;
      uniform vec3 uLigne;
      uniform vec3 uAccent;
      varying vec2 vXZ;
      varying vec3 vMonde;
      ${GLSL_SONAR}

      float ligne(vec2 p, float pas, float epaisseur) {
        vec2 g = abs(fract(p / pas - 0.5) - 0.5) / fwidth(p / pas);
        return 1.0 - min(min(g.x, g.y) / epaisseur, 1.0);
      }

      float point(vec2 p, float pas, float rayon) {
        vec2 c = fract(p / pas) - 0.5;
        float d = length(c) * pas;
        float aa = fwidth(d);
        return 1.0 - smoothstep(rayon - aa, rayon + aa, d);
      }

      void main() {
        float r = length(vXZ);
        float fondu = exp(-r * 0.16);
        float lignes = ligne(vXZ, 1.0, 1.0) * 0.32;
        float points = point(vXZ, 0.25, 0.012) * 0.45;
        // L'anneau sous le robot s'avive quand l'impulsion part ; l'onde est la trace de sa sphère sur le sol.
        float anneau = smoothstep(0.03, 0.0, abs(r - 0.62)) * (1.6 + 2.4 * ${GLSL_EMISSION});
        float onde = sonar(vMonde) * 1.6;
        vec3 couleur = uLigne * (lignes + points) * fondu + uSonarCouleur * (anneau + onde);
        // Le déploiement : la grille n'existe qu'en deçà du front, qui brille en rouge en passant.
        float front = smoothstep(0.25, 0.0, abs(r - uRevele)) * step(0.05, uRevele) * step(uRevele, 30.0);
        float dedans = 1.0 - smoothstep(uRevele - 0.3, uRevele, r);
        couleur = couleur * dedans + uAccent * front * 1.4;
        float alpha = clamp(((lignes + points) * fondu + anneau + onde) * dedans + front, 0.0, 1.0);
        gl_FragColor = vec4(couleur, alpha);
      }`,
    extensions: { derivatives: true } as never,
  });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), materiau);
  sol.rotation.x = -Math.PI / 2;
  sol.renderOrder = -1;
  return sol;
}
