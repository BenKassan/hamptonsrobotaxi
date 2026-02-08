import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';
import { GLTFLoader } from 'three/addons/loaders/GLTFLoader.js';
import { EffectComposer } from 'three/addons/postprocessing/EffectComposer.js';
import { RenderPass } from 'three/addons/postprocessing/RenderPass.js';
import { UnrealBloomPass } from 'three/addons/postprocessing/UnrealBloomPass.js';

(() => {
    const container = document.getElementById('cybercab-canvas-container');
    if (!container) return;

    const prefersReducedMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
    const isMobile = window.innerWidth < 860;

    const scene = new THREE.Scene();
    scene.fog = new THREE.FogExp2(0x020912, 0.065);

    const camera = new THREE.PerspectiveCamera(34, container.clientWidth / container.clientHeight, 0.1, 100);
    camera.position.set(7.4, 2.6, 8.4);

    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1.35 : 2));
    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.08;
    renderer.setClearColor(0x000000, 0);

    container.innerHTML = '';
    container.appendChild(renderer.domElement);

    let composer = null;
    if (!isMobile && !prefersReducedMotion) {
        composer = new EffectComposer(renderer);
        composer.addPass(new RenderPass(scene, camera));
        composer.addPass(new UnrealBloomPass(new THREE.Vector2(container.clientWidth, container.clientHeight), 1.35, 0.62, 0.84));
    }

    const palette = {
        cyan: new THREE.Color(0x78ecff),
        cyanBright: new THREE.Color(0xbaf8ff),
        cyanDeep: new THREE.Color(0x1b6fa0),
        cyanGlow: new THREE.Color(0x4ee7ff),
        dark: new THREE.Color(0x081423)
    };

    const world = new THREE.Group();
    scene.add(world);

    const carAnchor = new THREE.Group();
    carAnchor.position.y = 0.46;
    world.add(carAnchor);

    // Lights
    scene.add(new THREE.AmbientLight(0x74ddff, 0.12));

    const keyLight = new THREE.PointLight(0xb8f3ff, 3.1, 46);
    keyLight.position.set(4.5, 5.6, 4.2);
    scene.add(keyLight);

    const rimLeft = new THREE.PointLight(0x49d6ff, 2.3, 48);
    rimLeft.position.set(-7, 1.5, -4.2);
    scene.add(rimLeft);

    const rimRight = new THREE.PointLight(0x30a4d4, 1.8, 40);
    rimRight.position.set(7, 1.8, 3.4);
    scene.add(rimRight);

    const overhead = new THREE.SpotLight(0x7fe3ff, 2.1, 46, Math.PI / 5, 0.5, 1.2);
    overhead.position.set(0, 9, 1);
    overhead.target.position.set(0, 0.7, 0);
    scene.add(overhead);
    scene.add(overhead.target);

    // Ground and atmosphere
    const floor = new THREE.Mesh(
        new THREE.CircleGeometry(22, 96),
        new THREE.MeshBasicMaterial({
            color: 0x07101c,
            transparent: true,
            opacity: 0.52,
            side: THREE.DoubleSide
        })
    );
    floor.rotation.x = -Math.PI / 2;
    floor.position.y = -0.12;
    world.add(floor);

    const floorRingA = new THREE.Mesh(
        new THREE.RingGeometry(2.9, 3.25, 96),
        new THREE.MeshBasicMaterial({
            color: palette.cyanGlow,
            transparent: true,
            opacity: 0.33,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        })
    );
    floorRingA.rotation.x = -Math.PI / 2;
    floorRingA.position.y = -0.1;
    world.add(floorRingA);

    const floorRingB = floorRingA.clone();
    floorRingB.scale.set(1.42, 1.42, 1.42);
    floorRingB.material = floorRingA.material.clone();
    floorRingB.material.opacity = 0.12;
    world.add(floorRingB);

    const grid = new THREE.GridHelper(42, 80, 0x1e7ea7, 0x12405b);
    grid.position.y = -0.11;
    grid.material.transparent = true;
    grid.material.opacity = 0.2;
    world.add(grid);

    const haze = new THREE.Mesh(
        new THREE.PlaneGeometry(26, 12),
        new THREE.MeshBasicMaterial({
            color: 0x1a6a95,
            transparent: true,
            opacity: 0.12,
            blending: THREE.AdditiveBlending,
            depthWrite: false
        })
    );
    haze.position.set(0, 1.2, -5.4);
    world.add(haze);

    const particleCount = isMobile ? 180 : 420;
    const particlePositions = new Float32Array(particleCount * 3);
    const particleVelocities = new Float32Array(particleCount);
    for (let i = 0; i < particleCount; i += 1) {
        particlePositions[i * 3] = (Math.random() - 0.5) * 20;
        particlePositions[i * 3 + 1] = Math.random() * 8;
        particlePositions[i * 3 + 2] = (Math.random() - 0.5) * 20;
        particleVelocities[i] = 0.0022 + Math.random() * 0.005;
    }

    const particleGeometry = new THREE.BufferGeometry();
    particleGeometry.setAttribute('position', new THREE.BufferAttribute(particlePositions, 3));

    const particles = new THREE.Points(
        particleGeometry,
        new THREE.PointsMaterial({
            color: 0xadf6ff,
            size: isMobile ? 0.032 : 0.024,
            transparent: true,
            opacity: 0.55,
            blending: THREE.AdditiveBlending,
            depthWrite: false,
            sizeAttenuation: true
        })
    );
    world.add(particles);

    const holoMaterials = {
        body: new THREE.MeshPhysicalMaterial({
            color: palette.dark,
            metalness: 0.9,
            roughness: 0.12,
            clearcoat: 1,
            clearcoatRoughness: 0.08,
            transmission: 0.18,
            transparent: true,
            opacity: 0.48,
            emissive: palette.cyan,
            emissiveIntensity: 0.16,
            side: THREE.DoubleSide
        }),
        glass: new THREE.MeshPhysicalMaterial({
            color: 0x0a1f35,
            metalness: 0.4,
            roughness: 0.06,
            transmission: 0.28,
            transparent: true,
            opacity: 0.26,
            emissive: 0x2ecde8,
            emissiveIntensity: 0.08,
            side: THREE.DoubleSide
        }),
        wheel: new THREE.MeshPhysicalMaterial({
            color: 0x0b1f2f,
            metalness: 0.88,
            roughness: 0.18,
            transparent: true,
            opacity: 0.52,
            emissive: 0x3bd2ef,
            emissiveIntensity: 0.14,
            side: THREE.DoubleSide
        }),
        trim: new THREE.MeshPhysicalMaterial({
            color: 0x12273e,
            metalness: 0.84,
            roughness: 0.14,
            transparent: true,
            opacity: 0.4,
            emissive: 0x47dbf4,
            emissiveIntensity: 0.17,
            side: THREE.DoubleSide
        })
    };

    const edgeMaterial = new THREE.LineBasicMaterial({
        color: palette.cyanBright,
        transparent: true,
        opacity: 0.62,
        blending: THREE.AdditiveBlending
    });

    const edgeMaterialDim = new THREE.LineBasicMaterial({
        color: palette.cyanDeep,
        transparent: true,
        opacity: 0.28
    });

    const glowShellMaterial = new THREE.MeshBasicMaterial({
        color: palette.cyanGlow,
        transparent: true,
        opacity: 0.06,
        side: THREE.BackSide,
        blending: THREE.AdditiveBlending,
        depthWrite: false
    });

    const animatedLineMaterials = [];
    const wheelObjects = [];
    let heroCar = null;
    let fallbackCar = null;
    const doorWings = [];

    const decorateMesh = (mesh, highFidelity = true) => {
        if (!mesh.geometry) return;

        const edgeThreshold = highFidelity ? 27 : 14;
        const edgeLines = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, edgeThreshold), edgeMaterial.clone());
        edgeLines.renderOrder = 4;
        mesh.add(edgeLines);
        animatedLineMaterials.push(edgeLines.material);

        if (highFidelity) {
            const detailEdges = new THREE.LineSegments(new THREE.EdgesGeometry(mesh.geometry, 8), edgeMaterialDim.clone());
            detailEdges.renderOrder = 3;
            mesh.add(detailEdges);
        }

        const shell = new THREE.Mesh(mesh.geometry, glowShellMaterial);
        shell.scale.set(1.006, 1.006, 1.006);
        shell.renderOrder = 2;
        mesh.add(shell);

        if (!isMobile) {
            const wire = new THREE.Mesh(
                mesh.geometry,
                new THREE.MeshBasicMaterial({
                    color: palette.cyan,
                    wireframe: true,
                    transparent: true,
                    opacity: 0.035,
                    blending: THREE.AdditiveBlending,
                    depthWrite: false
                })
            );
            wire.renderOrder = 5;
            mesh.add(wire);
        }
    };

    const applyHologramMaterial = (obj, material) => {
        obj.material = material;
        obj.material.needsUpdate = true;
        decorateMesh(obj, true);
    };

    const addDoorWings = (targetGroup, bounds) => {
        const size = bounds.getSize(new THREE.Vector3());
        const center = bounds.getCenter(new THREE.Vector3());

        const wingHeight = size.y * 0.56;
        const wingLength = size.x * 0.34;
        const wingGeo = new THREE.PlaneGeometry(wingLength, wingHeight, 1, 1);
        const wingMat = new THREE.MeshBasicMaterial({
            color: palette.cyanBright,
            transparent: true,
            opacity: 0.16,
            side: THREE.DoubleSide,
            blending: THREE.AdditiveBlending
        });

        const wingEdgeMat = new THREE.LineBasicMaterial({
            color: palette.cyanBright,
            transparent: true,
            opacity: 0.56,
            blending: THREE.AdditiveBlending
        });

        [1, -1].forEach((sign) => {
            const pivot = new THREE.Group();
            pivot.position.set(center.x - size.x * 0.06, center.y + size.y * 0.18, center.z + sign * size.z * 0.43);
            pivot.rotation.set(sign * 0.92, 0, -0.08);

            const wing = new THREE.Mesh(wingGeo, wingMat);
            wing.position.set(wingLength * 0.34, wingHeight * 0.06, 0);
            pivot.add(wing);

            const wingEdge = new THREE.LineSegments(new THREE.EdgesGeometry(wingGeo), wingEdgeMat);
            wingEdge.position.copy(wing.position);
            pivot.add(wingEdge);

            targetGroup.add(pivot);
            doorWings.push(pivot);
        });
    };

    const centerAndScaleCar = (carGroup) => {
        const box = new THREE.Box3().setFromObject(carGroup);
        const size = box.getSize(new THREE.Vector3());
        const center = box.getCenter(new THREE.Vector3());
        carGroup.position.sub(center);

        const targetLength = 5.2;
        const scale = targetLength / Math.max(size.x, 0.001);
        carGroup.scale.setScalar(scale);

        const scaledBox = new THREE.Box3().setFromObject(carGroup);
        const scaledSize = scaledBox.getSize(new THREE.Vector3());
        carGroup.position.y += scaledSize.y * 0.48;
        return scaledBox;
    };

    const buildFallbackCar = () => {
        const fallback = new THREE.Group();

        const body = new THREE.Mesh(
            new THREE.BoxGeometry(4.6, 0.82, 2.05, 8, 4, 8),
            new THREE.MeshPhysicalMaterial({
                color: 0x0c1d30,
                metalness: 0.86,
                roughness: 0.18,
                transmission: 0.12,
                transparent: true,
                opacity: 0.42,
                emissive: 0x44d7ef,
                emissiveIntensity: 0.14,
                side: THREE.DoubleSide
            })
        );
        body.position.y = 0.36;
        fallback.add(body);

        const cabin = new THREE.Mesh(
            new THREE.BoxGeometry(2.55, 0.72, 1.86, 6, 4, 6),
            new THREE.MeshPhysicalMaterial({
                color: 0x10263c,
                metalness: 0.5,
                roughness: 0.1,
                transmission: 0.24,
                transparent: true,
                opacity: 0.25,
                emissive: 0x3acde8,
                emissiveIntensity: 0.1,
                side: THREE.DoubleSide
            })
        );
        cabin.position.set(0.4, 0.84, 0);
        fallback.add(cabin);

        [
            [-1.45, -0.05, 1.08],
            [-1.45, -0.05, -1.08],
            [1.42, -0.05, 1.08],
            [1.42, -0.05, -1.08]
        ].forEach(([x, y, z]) => {
            const wheel = new THREE.Mesh(
                new THREE.TorusGeometry(0.42, 0.12, 12, 42),
                new THREE.MeshPhysicalMaterial({
                    color: 0x0f2434,
                    metalness: 0.9,
                    roughness: 0.2,
                    transparent: true,
                    opacity: 0.46,
                    emissive: 0x42d3ec,
                    emissiveIntensity: 0.18,
                    side: THREE.DoubleSide
                })
            );
            wheel.position.set(x, y, z);
            wheel.rotation.y = Math.PI / 2;
            fallback.add(wheel);
            wheelObjects.push(wheel);
            decorateMesh(wheel, false);
        });

        const lightBar = new THREE.Mesh(
            new THREE.BoxGeometry(0.06, 0.06, 1.92),
            new THREE.MeshBasicMaterial({ color: palette.cyanBright, transparent: true, opacity: 0.9 })
        );
        lightBar.position.set(-2.28, 0.48, 0);
        fallback.add(lightBar);

        decorateMesh(body, false);
        decorateMesh(cabin, false);

        fallback.rotation.y = -0.28;
        return fallback;
    };

    fallbackCar = buildFallbackCar();
    carAnchor.add(fallbackCar);

    const loader = new GLTFLoader();
    loader.load(
        'https://cdn.jsdelivr.net/gh/mrdoob/three.js@r162/examples/models/gltf/ferrari.glb',
        (gltf) => {
            const rawCar = gltf.scene;
            wheelObjects.length = 0;
            rawCar.traverse((node) => {
                if (!node.isMesh) return;
                node.frustumCulled = false;

                const name = node.name.toLowerCase();
                if (name.includes('body') || name.includes('trim')) {
                    applyHologramMaterial(node, holoMaterials.body);
                } else if (name.includes('glass')) {
                    applyHologramMaterial(node, holoMaterials.glass);
                } else if (name.includes('wheel') || name.includes('rim') || name.includes('tyre') || name.includes('tire')) {
                    applyHologramMaterial(node, holoMaterials.wheel);
                } else {
                    applyHologramMaterial(node, holoMaterials.trim);
                }
            });

            ['wheel_fl', 'wheel_fr', 'wheel_rl', 'wheel_rr'].forEach((wheelName) => {
                const wheel = rawCar.getObjectByName(wheelName);
                if (wheel) wheelObjects.push(wheel);
            });

            const centeredBounds = centerAndScaleCar(rawCar);
            addDoorWings(rawCar, centeredBounds);

            rawCar.rotation.y = -0.24;
            rawCar.position.y += 0.02;

            if (fallbackCar) {
                carAnchor.remove(fallbackCar);
                fallbackCar = null;
            }

            heroCar = rawCar;
            carAnchor.add(rawCar);
        },
        undefined,
        () => {
            // Fallback already rendered above.
        }
    );

    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enablePan = false;
    controls.enableZoom = false;
    controls.minPolarAngle = Math.PI / 3.5;
    controls.maxPolarAngle = Math.PI / 2.06;
    controls.target.set(0, 1.02, 0);
    controls.autoRotate = !prefersReducedMotion;
    controls.autoRotateSpeed = 0.44;
    if (isMobile) controls.enabled = false;

    let pointerX = 0;
    let pointerY = 0;

    const onPointerMove = (event) => {
        const rect = container.getBoundingClientRect();
        pointerX = ((event.clientX - rect.left) / rect.width - 0.5) * 2;
        pointerY = ((event.clientY - rect.top) / rect.height - 0.5) * 2;
    };

    if (!isMobile) {
        container.addEventListener('pointermove', onPointerMove);
    }

    const clock = new THREE.Clock();
    const animate = () => {
        const delta = Math.min(clock.getDelta(), 0.033);
        const elapsed = clock.elapsedTime;

        carAnchor.position.y = 0.46 + Math.sin(elapsed * 0.82) * 0.06;
        world.rotation.y += 0.0005;

        const activeCar = heroCar || fallbackCar;
        if (activeCar) {
            activeCar.rotation.x += ((pointerY * 0.055) - activeCar.rotation.x) * 0.04;
            const targetY = -0.24 + pointerX * 0.16;
            activeCar.rotation.y += (targetY - activeCar.rotation.y) * 0.04;
        }

        wheelObjects.forEach((wheel, idx) => {
            wheel.rotation.x -= delta * (2.9 + (idx % 2) * 0.6);
        });

        doorWings.forEach((wing, idx) => {
            const sign = idx % 2 === 0 ? 1 : -1;
            wing.rotation.x = sign * (0.9 + Math.sin(elapsed * 0.9 + idx * 0.5) * 0.08);
        });

        floorRingA.rotation.z += 0.0015;
        floorRingB.rotation.z -= 0.001;

        const positions = particleGeometry.attributes.position.array;
        for (let i = 0; i < particleCount; i += 1) {
            positions[i * 3 + 1] += particleVelocities[i];
            positions[i * 3] += Math.sin(elapsed * 0.22 + i) * 0.0013;
            if (positions[i * 3 + 1] > 8.5) {
                positions[i * 3 + 1] = -0.8;
                positions[i * 3] = (Math.random() - 0.5) * 20;
                positions[i * 3 + 2] = (Math.random() - 0.5) * 20;
            }
        }
        particleGeometry.attributes.position.needsUpdate = true;

        const pulse = 0.48 + (Math.sin(elapsed * 1.3) + 1) * 0.17;
        animatedLineMaterials.forEach((mat, idx) => {
            mat.opacity = (idx % 2 === 0 ? 1 : 0.7) * pulse;
        });

        haze.material.opacity = 0.09 + Math.sin(elapsed * 0.6) * 0.02;

        controls.update();
        if (composer) composer.render();
        else renderer.render(scene, camera);

        requestAnimationFrame(animate);
    };

    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 1.1s ease';
    requestAnimationFrame(() => {
        renderer.domElement.style.opacity = '1';
        requestAnimationFrame(animate);
    });

    const onResize = () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
        if (composer) composer.setSize(w, h);
    };

    window.addEventListener('resize', onResize);
    window.addEventListener('pagehide', () => {
        window.removeEventListener('resize', onResize);
        if (!isMobile) container.removeEventListener('pointermove', onPointerMove);
    });
})();
