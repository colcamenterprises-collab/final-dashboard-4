import { useEffect, useRef } from "react";
import * as THREE from "three";

interface DishPreview3DProps {
  className?: string;
}

export function DishPreview3D({ className }: DishPreview3DProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const container = containerRef.current;
    if (!container) return;

    const scene = new THREE.Scene();
    const camera = new THREE.PerspectiveCamera(45, 1, 0.1, 1000);
    const renderer = new THREE.WebGLRenderer({ antialias: true, alpha: true });

    renderer.setPixelRatio(window.devicePixelRatio || 1);
    renderer.setSize(container.clientWidth, container.clientHeight);
    container.appendChild(renderer.domElement);

    const ambient = new THREE.AmbientLight(0xffffff, 0.8);
    scene.add(ambient);

    const pointLight = new THREE.PointLight(0xffffff, 1);
    pointLight.position.set(5, 5, 5);
    scene.add(pointLight);

    const plateGeometry = new THREE.TorusGeometry(2.2, 0.35, 16, 100);
    const plateMaterial = new THREE.MeshStandardMaterial({ color: 0xe2e8f0, metalness: 0.2, roughness: 0.7 });
    const plate = new THREE.Mesh(plateGeometry, plateMaterial);
    scene.add(plate);

    const bunGeometry = new THREE.SphereGeometry(1.2, 32, 32);
    const bunMaterial = new THREE.MeshStandardMaterial({ color: 0xfbbf24, roughness: 0.6 });
    const bun = new THREE.Mesh(bunGeometry, bunMaterial);
    bun.position.set(0, 0.7, 0);
    scene.add(bun);

    const pattyGeometry = new THREE.CylinderGeometry(1.1, 1.1, 0.5, 32);
    const pattyMaterial = new THREE.MeshStandardMaterial({ color: 0x7c2d12, roughness: 0.8 });
    const patty = new THREE.Mesh(pattyGeometry, pattyMaterial);
    patty.position.set(0, 0.1, 0);
    scene.add(patty);

    camera.position.set(0, 3, 6);
    camera.lookAt(0, 0.5, 0);

    let frameId = 0;
    const animate = () => {
      plate.rotation.y += 0.004;
      bun.rotation.y -= 0.003;
      patty.rotation.y += 0.003;
      renderer.render(scene, camera);
      frameId = requestAnimationFrame(animate);
    };

    animate();

    const handleResize = () => {
      if (!container) return;
      camera.aspect = container.clientWidth / container.clientHeight;
      camera.updateProjectionMatrix();
      renderer.setSize(container.clientWidth, container.clientHeight);
    };

    window.addEventListener("resize", handleResize);

    return () => {
      window.removeEventListener("resize", handleResize);
      cancelAnimationFrame(frameId);
      renderer.dispose();
      container.removeChild(renderer.domElement);
    };
  }, []);

  return (
    <div
      ref={containerRef}
      className={className ?? "h-48 w-full rounded-[12px] bg-gradient-to-br from-slate-50 to-slate-100"}
    />
  );
}
