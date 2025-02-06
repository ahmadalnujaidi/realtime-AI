// ThreeAnimation.jsx
import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

export default function ThreeAnimation({ analyzer }) {
  const mountRef = useRef(null);

  // Uniforms for time, frequency, and color.
  const uniformsRef = useRef({
    u_time: { value: 0.0 },
    u_frequency: { value: 0.0 },
    u_red: { value: 0.6 },
    u_green: { value: 0.0 },
    u_blue: { value: 0.6 },
  });

  useEffect(() => {
    const container = mountRef.current;
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -2, 20);
    camera.lookAt(0, 0, 0);

    // Setup postprocessing.
    const renderScene = new RenderPass(scene, camera);
    const bloomPass = new UnrealBloomPass(new THREE.Vector2(width, height));
    bloomPass.threshold = 1;
    bloomPass.strength = 0.56;
    bloomPass.radius = 0.8;
    const bloomComposer = new EffectComposer(renderer);
    bloomComposer.addPass(renderScene);
    bloomComposer.addPass(bloomPass);
    const outputPass = new OutputPass();
    bloomComposer.addPass(outputPass);

    const uniforms = uniformsRef.current;

    // Updated vertex shader:
    // The "soundFactor" is 0 when u_frequency is low (no audio) and approaches 1 as u_frequency increases.
    const vertexShader = `
      uniform float u_time;
      uniform float u_frequency;
      
      void main() {
        // Compute a sound factor: when u_frequency is below 5, soundFactor is 0;
        // when above 20, soundFactor is 1. Adjust these values as needed.
        float soundFactor = smoothstep(5.0, 20.0, u_frequency);
        
        // Create a bubbly vibration that only applies when soundFactor > 0.
        float vibration = soundFactor * (
          sin(u_time * 15.0 + position.x * 10.0) * 0.05 +
          cos(u_time * 20.0 + position.y * 10.0) * 0.05
        );
        
        // Also include your sound-based expansion (if desired).
        vec3 newPosition = position + normal * (vibration + u_frequency / 200.0);
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

    const material = new THREE.ShaderMaterial({
      uniforms,
      vertexShader,
      fragmentShader,
      wireframe: true,
    });

    // Use a detailed icosahedron geometry to better show the bubbly effect.
    const geometry = new THREE.IcosahedronGeometry(4, 30);
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);
      const elapsedTime = clock.getElapsedTime();

      // Basic hovering and rotation.
      mesh.position.y = Math.sin(elapsedTime) * 0.5;
      mesh.rotation.x += 0.005;
      mesh.rotation.y += 0.005;

      // Update audio-based expansion and vibration.
      if (analyzer) {
        const freqData = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(freqData);
        let avg = 0;
        for (let i = 0; i < freqData.length; i++) {
          avg += freqData[i];
        }
        avg = avg / freqData.length;
        uniforms.u_frequency.value = avg;

        // You can also adjust scale here if you want expansion with audio.
        const scaleFactor = 1 + avg / 200.0;
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      } else {
        mesh.scale.set(1, 1, 1);
      }

      uniforms.u_time.value = elapsedTime;
      bloomComposer.render();
    }

    animate();

    function onResize() {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      bloomComposer.setSize(newWidth, newHeight);
    }
    window.addEventListener("resize", onResize);

    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analyzer]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
