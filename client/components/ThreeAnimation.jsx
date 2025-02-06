// ThreeAnimation.jsx

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

export default function ThreeAnimation({ analyzer }) {
  const mountRef = useRef(null);
  const uniformsRef = useRef({
    u_time: { value: 0.0 },
    u_frequency: { value: 0.0 },
    u_red: { value: 0.7 },
    u_green: { value: 0.7 },
    u_blue: { value: 1.0 },
  });

  useEffect(() => {
    // 1) Grab the container from the ref
    const container = mountRef.current;

    // 1. Setup scene, camera, renderer
    const renderer = new THREE.WebGLRenderer({ antialias: true });

    // 3) Measure parent size
    const width = container.clientWidth;
    const height = container.clientHeight;

    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);
    // mountRef.current.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(
      45,
      window.innerWidth / window.innerHeight,
      0.1,
      1000,
    );
    camera.position.set(0, -2, 14);
    camera.lookAt(0, 0, 0);

    // 2. Setup postprocessing
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(
      new THREE.Vector2(window.innerWidth, window.innerHeight),
    );
    bloomPass.threshold = 1;
    bloomPass.strength = 0.56;
    bloomPass.radius = 0.8;

    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);

    const outputPass = new OutputPass();
    bloomComposer.addPass(outputPass);

    // 3. Create geometry + shader material
    const uniforms = uniformsRef.current; // this is our "global" reference

    const vertexShader = `
      uniform float u_time;
      uniform float u_frequency;

      // put your pnoise() or Perlin noise code here…

      void main() {
        // basic example: we move vertices based on the frequency
        // (your actual noise logic can go here)
        vec3 newPosition = position + normal * (u_frequency / 50.0);
        gl_Position = projectionMatrix * modelViewMatrix * vec4(newPosition, 1.0);
      }
    `;

    const fragmentShader = `
      uniform float u_red;
      uniform float u_green;
      uniform float u_blue;

      void main() {
        gl_FragColor = vec4(u_red, u_green, u_blue, 1.0);
      }
    `;

    const mat = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      wireframe: true,
    });

    const geo = new THREE.IcosahedronGeometry(4, 30);
    const mesh = new THREE.Mesh(geo, mat);
    scene.add(mesh);

    // 4. Animation loop
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      // If we have an analyzer (passed from App.jsx), get freq data
      if (analyzer) {
        const freqData = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(freqData);
        let avg = 0;
        for (let i = 0; i < freqData.length; i++) {
          avg += freqData[i];
        }
        avg = avg / freqData.length;
        uniforms.u_frequency.value = avg;
      }

      uniforms.u_time.value = clock.getElapsedTime();
      bloomComposer.render();
    }

    animate();

    // 9) Handle container resizing
    function onResize() {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      bloomComposer.setSize(newWidth, newHeight);
    }
    window.addEventListener("resize", onResize);

    // 10) Cleanup
    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analyzer]);
  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
