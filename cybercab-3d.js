import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { DRACOLoader } from 'three/addons/loaders/DRACOLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(() => {
    const container = document.getElementById('cybercab-canvas-container');
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 860;

    /* Scene — pure black background, no fog */
    const scene = new THREE.Scene();
    scene.background = new THREE.Color(0x000000);

    const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(7.4, 2.6, 8.4);

    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile, alpha: false, powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.12;
    renderer.setClearColor(0x000000, 1.0);
    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    /* Post-processing */
    let composer = null;
    if (!isMobile && !prefersReducedMotion) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(
            new THREE.Vector2(container.clientWidth, container.clientHeight), 1.6, 0.7, 0.72
        ));
    }

    /* Palette */
    const P = {
        cyan: new THREE.Color(0x00dcff),
        cyanBright: new THREE.Color(0x80f0ff),
        cyanDeep: new THREE.Color(0x1b8fc0),
        cyanGlow: new THREE.Color(0x00dcff),
        dark: new THREE.Color(0x061018)
    };

    const world = new THREE.Group();
    scene.add(world);
    const carAnchor = new THREE.Group();
    carAnchor.position.y = 0.46;
    world.add(carAnchor);

    /* Lights */
    scene.add(new THREE.AmbientLight(0x00ccff, 0.2));
    const kl = new THREE.PointLight(0xb8f3ff, 3.4, 46); kl.position.set(4.5, 5.6, 4.2); scene.add(kl);
    const rl = new THREE.PointLight(0x49d6ff, 2.5, 48); rl.position.set(-7, 1.5, -4.2); scene.add(rl);
    const rr = new THREE.PointLight(0x30a4d4, 2.0, 40); rr.position.set(7, 1.8, 3.4); scene.add(rr);
    const oh = new THREE.SpotLight(0x7fe3ff, 2.4, 46, Math.PI / 5, 0.5, 1.2);
    oh.position.set(0, 9, 1); oh.target.position.set(0, 0.7, 0);
    scene.add(oh); scene.add(oh.target);

    /* Ground — rings and grid only */
    const ringMat = new THREE.MeshBasicMaterial({
        color: P.cyanGlow, transparent: true, opacity: 0.33,
        side: THREE.DoubleSide, blending: THREE.AdditiveBlending
    });
    const ringA = new THREE.Mesh(new THREE.RingGeometry(2.9, 3.25, 96), ringMat);
    ringA.rotation.x = -Math.PI / 2; ringA.position.y = -0.1; world.add(ringA);
    const ringB = ringA.clone(); ringB.scale.set(1.42, 1.42, 1.42);
    ringB.material = ringMat.clone(); ringB.material.opacity = 0.12; world.add(ringB);

    const grid = new THREE.GridHelper(42, 80, 0x1e7ea7, 0x12405b);
    grid.position.y = -0.11; grid.material.transparent = true; grid.material.opacity = 0.18; world.add(grid);

    /* Particles */
    const pCount = isMobile ? 180 : 420;
    const pPos = new Float32Array(pCount * 3);
    const pVel = new Float32Array(pCount);
    for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 20;
        pPos[i * 3 + 1] = Math.random() * 8;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 20;
        pVel[i] = 0.0022 + Math.random() * 0.005;
    }
    const pGeo = new THREE.BufferGeometry();
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    world.add(new THREE.Points(pGeo, new THREE.PointsMaterial({
        color: 0xadf6ff, size: isMobile ? 0.032 : 0.024,
        transparent: true, opacity: 0.55, blending: THREE.AdditiveBlending,
        depthWrite: false, sizeAttenuation: true
    })));

    const animatedLineMaterials = [];
    let scanTexture = null;

    /* ═══════════════════════════════════════
       LOAD TESLA CYBERCAB GLB MODEL
       ═══════════════════════════════════════ */
    let modelRef = null;

    const loadModel = () => {
        const loader = new GLTFLoader();

        const dracoLoader = new DRACOLoader();
        dracoLoader.setDecoderPath('https://cdn.jsdelivr.net/npm/three@0.162.0/examples/jsm/libs/draco/');
        loader.setDRACOLoader(dracoLoader);

        loader.load('tesla_cybercab_3d_model.glb', (gltf) => {
            const model = gltf.scene;

            /* Scale model to ~4 units longest dimension */
            const box = new THREE.Box3().setFromObject(model);
            const size = box.getSize(new THREE.Vector3());
            const center = box.getCenter(new THREE.Vector3());
            const maxDim = Math.max(size.x, size.y, size.z);
            const s = 4.0 / maxDim;
            model.scale.setScalar(s);

            /* Center on X/Z, sit bottom at y=0 */
            model.position.set(-center.x * s, -box.min.y * s, -center.z * s);
            const scaledSize = size.clone().multiplyScalar(s);

            /* Traverse the single mesh and apply hologram treatment */
            model.traverse((node) => {
                if (!node.isMesh) return;
                node.castShadow = false;
                node.receiveShadow = false;

                /* Step 1: Near-invisible ghost body */
                node.material = new THREE.MeshPhysicalMaterial({
                    color: 0x040d18,
                    metalness: 0.95,
                    roughness: 0.1,
                    transparent: true,
                    opacity: 0.15,
                    emissive: 0x0a3a50,
                    emissiveIntensity: 0.08,
                    side: THREE.DoubleSide,
                    depthWrite: false
                });

                /* Step 2: Multi-threshold edge lines — this IS the hologram */

                // Primary edges — strong, catches major body lines
                const edgeMat1 = new THREE.LineBasicMaterial({
                    color: 0xbaf8ff, transparent: true, opacity: 0.85,
                    blending: THREE.AdditiveBlending
                });
                const edges1 = new THREE.LineSegments(
                    new THREE.EdgesGeometry(node.geometry, 15), edgeMat1
                );
                edges1.renderOrder = 10;
                node.add(edges1);
                animatedLineMaterials.push(edgeMat1);

                // Secondary edges — medium, catches panel lines and curves
                const edgeMat2 = new THREE.LineBasicMaterial({
                    color: 0x4ee7ff, transparent: true, opacity: 0.35,
                    blending: THREE.AdditiveBlending
                });
                const edges2 = new THREE.LineSegments(
                    new THREE.EdgesGeometry(node.geometry, 8), edgeMat2
                );
                edges2.renderOrder = 9;
                node.add(edges2);
                animatedLineMaterials.push(edgeMat2);

                if (!isMobile) {
                    // Fine detail edges — subtle, catches surface curvature
                    const edgeMat3 = new THREE.LineBasicMaterial({
                        color: 0x1b6fa0, transparent: true, opacity: 0.12,
                        blending: THREE.AdditiveBlending
                    });
                    const edges3 = new THREE.LineSegments(
                        new THREE.EdgesGeometry(node.geometry, 3), edgeMat3
                    );
                    edges3.renderOrder = 8;
                    node.add(edges3);
                    animatedLineMaterials.push(edgeMat3);
                }

                /* Step 3: Glow shell — rim-light hologram effect */
                const glowShell = new THREE.Mesh(
                    node.geometry,
                    new THREE.MeshBasicMaterial({
                        color: 0x4ee7ff, transparent: true, opacity: 0.04,
                        side: THREE.BackSide, blending: THREE.AdditiveBlending,
                        depthWrite: false
                    })
                );
                glowShell.scale.set(1.015, 1.015, 1.015);
                glowShell.renderOrder = 1;
                node.add(glowShell);

                /* Step 4: Sparse wireframe overlay — "data" look */
                if (!isMobile) {
                    const wireOverlay = new THREE.Mesh(
                        node.geometry,
                        new THREE.MeshBasicMaterial({
                            color: 0x78ecff, wireframe: true, transparent: true, opacity: 0.03,
                            blending: THREE.AdditiveBlending, depthWrite: false
                        })
                    );
                    wireOverlay.renderOrder = 7;
                    node.add(wireOverlay);
                }
            });

            /* Step 5: Animated scan lines — CanvasTexture stripe pattern */
            const scanCanvas = document.createElement('canvas');
            scanCanvas.width = 4;
            scanCanvas.height = 256;
            const ctx = scanCanvas.getContext('2d');
            for (let y = 0; y < 256; y++) {
                ctx.fillStyle = y % 8 < 1 ? 'rgba(78, 231, 255, 0.12)' : 'rgba(0,0,0,0)';
                ctx.fillRect(0, y, 4, 1);
            }
            scanTexture = new THREE.CanvasTexture(scanCanvas);
            scanTexture.wrapS = THREE.RepeatWrapping;
            scanTexture.wrapT = THREE.RepeatWrapping;
            scanTexture.repeat.set(1, 3);

            const scanPlane = new THREE.Mesh(
                new THREE.PlaneGeometry(6, 4),
                new THREE.MeshBasicMaterial({
                    map: scanTexture, transparent: true,
                    blending: THREE.AdditiveBlending, depthWrite: false,
                    side: THREE.DoubleSide
                })
            );
            scanPlane.renderOrder = 11;
            scanPlane.position.y = scaledSize.y * 0.45;
            carAnchor.add(scanPlane);

            /* Holographic dust near car */
            const dustCount = isMobile ? 60 : 150;
            const dustPos = new Float32Array(dustCount * 3);
            for (let i = 0; i < dustCount; i++) {
                dustPos[i * 3]     = (Math.random() - 0.5) * scaledSize.x * 1.5;
                dustPos[i * 3 + 1] = Math.random() * scaledSize.y * 1.2;
                dustPos[i * 3 + 2] = (Math.random() - 0.5) * scaledSize.z * 1.5;
            }
            const dustGeo = new THREE.BufferGeometry();
            dustGeo.setAttribute('position', new THREE.BufferAttribute(dustPos, 3));
            model.add(new THREE.Points(dustGeo, new THREE.PointsMaterial({
                color: 0x00eeff, size: 0.018, transparent: true, opacity: 0.6,
                blending: THREE.AdditiveBlending, depthWrite: false, sizeAttenuation: true
            })));

            model.rotation.y = -0.24;
            carAnchor.add(model);
            modelRef = model;

            /* Fade in canvas */
            renderer.domElement.style.opacity = '1';
        },
        undefined,
        (err) => {
            console.warn('GLB load error:', err);
            renderer.domElement.style.opacity = '1';
        });
    };

    loadModel();

    /* OrbitControls — zoom enabled, wide polar range, works on mobile */
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true; controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = true;
    controls.minDistance = 3;
    controls.maxDistance = 12;
    controls.minPolarAngle = 0.3;
    controls.maxPolarAngle = Math.PI / 2.0;
    controls.target.set(0, 1.02, 0);
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.3;

    let pointerX = 0, pointerY = 0;
    const onPointerMove = (e) => {
        const r = container.getBoundingClientRect();
        pointerX = ((e.clientX - r.left) / r.width - 0.5) * 2;
        pointerY = ((e.clientY - r.top) / r.height - 0.5) * 2;
    };
    if (!isMobile) container.addEventListener('pointermove', onPointerMove);

    /* Animation loop */
    const clock = new THREE.Clock();
    const animate = () => {
        requestAnimationFrame(animate);
        const elapsed = clock.elapsedTime;
        clock.getDelta();

        /* Car bob */
        carAnchor.position.y = 0.46 + Math.sin(elapsed * 0.82) * 0.06;
        world.rotation.y += 0.0005;

        /* Pointer parallax */
        if (modelRef) {
            modelRef.rotation.x += ((pointerY * 0.055) - modelRef.rotation.x) * 0.04;
            modelRef.rotation.y += ((-0.24 + pointerX * 0.16) - modelRef.rotation.y) * 0.04;
        }

        /* Floor rings */
        ringA.rotation.z += 0.0015;
        ringB.rotation.z -= 0.001;

        /* World particles */
        const pos = pGeo.attributes.position.array;
        for (let i = 0; i < pCount; i++) {
            pos[i * 3 + 1] += pVel[i];
            pos[i * 3] += Math.sin(elapsed * 0.22 + i) * 0.0013;
            if (pos[i * 3 + 1] > 8.5) {
                pos[i * 3 + 1] = -0.8;
                pos[i * 3] = (Math.random() - 0.5) * 20;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 20;
            }
        }
        pGeo.attributes.position.needsUpdate = true;

        /* Edge pulse — animate all edge line opacities */
        const pulse = 0.52 + (Math.sin(elapsed * 1.3) + 1) * 0.18;
        animatedLineMaterials.forEach((m, i) => {
            const base = i % 3 === 0 ? 0.85 : i % 3 === 1 ? 0.35 : 0.12;
            m.opacity = base * pulse;
        });

        /* Scan line scroll */
        if (scanTexture) scanTexture.offset.y += 0.002;

        controls.update();
        if (composer) composer.render(); else renderer.render(scene, camera);
    };

    /* Canvas starts hidden, fades in when model loads */
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 1.1s ease';
    requestAnimationFrame(() => animate());

    /* Resize handler */
    const onResize = () => {
        const w = container.clientWidth, h = container.clientHeight;
        camera.aspect = w / h; camera.updateProjectionMatrix();
        renderer.setSize(w, h); if (composer) composer.setSize(w, h);
    };
    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', () => {
        window.removeEventListener('resize', onResize);
        if (!isMobile) container.removeEventListener('pointermove', onPointerMove);
    });
})();
