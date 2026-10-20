import * as THREE from 'three';
import { CALQUE_DETECTIONS, ORDRE_SEGMENTATION } from './detections';
import { GLSL_EMISSION, GLSL_SONAR, SONAR } from './sonar';

/** Le sol : une grille de lignes et de points qui s'efface avec la distance, et un anneau sous le robot qui s'avive à
 * chaque impulsion du sonar. L'impulsion elle-même est la bande du sol (creerBandeSol). */
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
      void main() {
        vec4 monde = modelMatrix * vec4(position, 1.0);
        vXZ = monde.xz;
        gl_Position = projectionMatrix * viewMatrix * monde;
      }`,
    fragmentShader: /* glsl */ `
      uniform float uTemps;
      uniform float uRevele;
      uniform vec3 uLigne;
      uniform vec3 uAccent;
      varying vec2 vXZ;
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
        float anneau = smoothstep(0.03, 0.0, abs(r - 0.62)) * (1.6 + 2.4 * ${GLSL_EMISSION});
        vec3 couleur = uLigne * (lignes + points) * fondu + uSonarCouleur * anneau;
        // Le déploiement : la grille n'existe qu'en deçà du front, qui brille en rouge en passant.
        float front = smoothstep(0.25, 0.0, abs(r - uRevele)) * step(0.05, uRevele) * step(uRevele, 30.0);
        float dedans = 1.0 - smoothstep(uRevele - 0.3, uRevele, r);
        couleur = couleur * dedans + uAccent * front * 1.4;
        float alpha = clamp(((lignes + points) * fondu + anneau) * dedans + front, 0.0, 1.0);
        gl_FragColor = vec4(couleur, alpha);
      }`,
    extensions: { derivatives: true } as never,
  });
  const sol = new THREE.Mesh(new THREE.PlaneGeometry(80, 80), materiau);
  sol.rotation.x = -Math.PI / 2;
  sol.renderOrder = -1;
  return sol;
}

/**
 * La bande du sonar sur le sol : elle part du robot et s'étend en s'évanouissant. Tracée après les volumes des
 * meubles, à part de la grille : un meuble posé au sol lui fait de l'ombre derrière lui (sonar.eclaire), et la cache
 * à qui regarde à travers lui.
 */
export function creerBandeSol(): THREE.Mesh {
  const materiau = new THREE.ShaderMaterial({
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
        float s = sonar(vMonde) * 1.5;
        if (s < 0.01) discard;
        gl_FragColor = vec4(uSonarCouleur * s, 1.0);
      }`,
  });
  const bande = new THREE.Mesh(new THREE.PlaneGeometry(40, 40), materiau);
  bande.rotation.x = -Math.PI / 2;
  bande.position.y = 0.002;
  bande.renderOrder = ORDRE_SEGMENTATION;
  bande.layers.set(CALQUE_DETECTIONS);
  return bande;
}
