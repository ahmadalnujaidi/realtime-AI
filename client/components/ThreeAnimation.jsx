// ThreeAnimation.jsx

import { useEffect, useRef } from "react";
import * as THREE from "three";
import { EffectComposer } from "three/examples/jsm/postprocessing/EffectComposer";
import { RenderPass } from "three/examples/jsm/postprocessing/RenderPass";
import { UnrealBloomPass } from "three/examples/jsm/postprocessing/UnrealBloomPass";
import { OutputPass } from "three/examples/jsm/postprocessing/OutputPass";

export default function ThreeAnimation({ analyzer }) {
  const mountRef = useRef(null);
  // Update uniforms for purple color (if you need them in your shader)
  const uniformsRef = useRef({
    u_time: { value: 0.0 },
    u_frequency: { value: 0.0 },
    u_red: { value: 0.6 },
    u_green: { value: 0.0 },
    u_blue: { value: 0.6 },
  });

  useEffect(() => {
    // 1) Grab the container from the ref
    const container = mountRef.current;

    // 2) Setup renderer, scene, and camera
    const renderer = new THREE.WebGLRenderer({ antialias: true });
    const width = container.clientWidth;
    const height = container.clientHeight;
    renderer.setSize(width, height);
    container.appendChild(renderer.domElement);

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, width / height, 0.1, 1000);
    camera.position.set(0, -2, 14);
    camera.lookAt(0, 0, 0);

    // 3) Setup postprocessing
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

    // 4) Create geometry and shader material
    const uniforms = uniformsRef.current;
    const vertexShader = `
      uniform float u_time;
      uniform float u_frequency;
      
      // A simple vertex shader that just passes through position.
      // We do not use u_time for displacement here since we'll animate hovering via object transforms.
      // (Alternatively, you could add additional noise or oscillation here.)
      void main() {
        // Add a displacement only if sound is present.
        vec3 newPosition = position + normal * (u_frequency / 200.0);
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

    // Use an icosahedron geometry with sufficient detail.
    const geometry = new THREE.IcosahedronGeometry(4, 30);
    // Create the mesh and add it to the scene.
    const mesh = new THREE.Mesh(geometry, material);
    scene.add(mesh);

    // 5) Animation loop: hovering & sound-based expansion
    const clock = new THREE.Clock();

    function animate() {
      requestAnimationFrame(animate);

      const elapsedTime = clock.getElapsedTime();

      // Always apply a hovering effect (bobbing and slow rotation)
      mesh.position.y = Math.sin(elapsedTime) * 0.5; // Bobbing effect
      mesh.rotation.x += 0.005;
      mesh.rotation.y += 0.005;

      // If sound data is available, calculate the average frequency and use it to expand the mesh
      if (analyzer) {
        const freqData = new Uint8Array(analyzer.frequencyBinCount);
        analyzer.getByteFrequencyData(freqData);
        let avg = 0;
        for (let i = 0; i < freqData.length; i++) {
          avg += freqData[i];
        }
        avg = avg / freqData.length;
        uniforms.u_frequency.value = avg; // send to the shader if needed

        // Determine a scale factor based on the average frequency.
        // When no sound is present, avg is near 0 (scale factor ~1). When sound increases, the object expands.
        const scaleFactor = 1 + avg / 200.0; // Adjust divisor for sensitivity as needed.
        mesh.scale.set(scaleFactor, scaleFactor, scaleFactor);
      } else {
        // Ensure a default scale when no analyzer is available
        mesh.scale.set(1, 1, 1);
      }

      uniforms.u_time.value = elapsedTime;
      bloomComposer.render();
    }

    animate();

    // 6) Handle container resizing
    function onResize() {
      const newWidth = container.clientWidth;
      const newHeight = container.clientHeight;
      renderer.setSize(newWidth, newHeight);
      camera.aspect = newWidth / newHeight;
      camera.updateProjectionMatrix();
      bloomComposer.setSize(newWidth, newHeight);
    }
    window.addEventListener("resize", onResize);

    // 7) Cleanup on unmount
    return () => {
      window.removeEventListener("resize", onResize);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, [analyzer]);

  return <div ref={mountRef} style={{ width: "100%", height: "100%" }} />;
}
