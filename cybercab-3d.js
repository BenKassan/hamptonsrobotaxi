import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(() => {
    const container = document.getElementById('cybercab-canvas-container');
    if (!container) return;

    const isMobile = window.innerWidth < 768;

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        35,
        container.clientWidth / container.clientHeight,
        0.1,
        200
    );
    camera.position.set(6, 3, 7);

    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.5;
    container.appendChild(renderer.domElement);

    // ── Holographic Cyan palette ─────────────────────────────
    const CYAN = 0x00d4ff;
    const CYAN_BRIGHT = 0x40e8ff;
    const CYAN_DIM = 0x006688;
    const CYAN_GLOW = 0x00aadd;
    const TEAL = 0x00ff88;

    // ── Lights ───────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(CYAN, 0.08));

    const keyLight = new THREE.PointLight(CYAN_BRIGHT, 3, 30);
    keyLight.position.set(5, 6, 5);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x0044aa, 1.2, 20);
    fillLight.position.set(-6, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(CYAN, 2, 15);
    rimLight.position.set(0, 8, -8);
    scene.add(rimLight);

    const underGlow = new THREE.PointLight(CYAN_GLOW, 1.0, 6);
    underGlow.position.set(0, -0.2, 0);
    scene.add(underGlow);

    const frontSpot = new THREE.PointLight(CYAN_BRIGHT, 1.5, 10);
    frontSpot.position.set(-3, 1, 0);
    scene.add(frontSpot);

    // ── Materials ────────────────────────────────────────────
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x001520,
        transparent: true,
        opacity: 0.12,
        roughness: 0.05,
        metalness: 0.9,
        side: THREE.DoubleSide,
    });

    const edgeMat = new THREE.LineBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.85,
    });

    const edgeGlowMat = new THREE.LineBasicMaterial({
        color: CYAN_BRIGHT,
        transparent: true,
        opacity: 0.25,
    });

    const glassMat = new THREE.MeshPhysicalMaterial({
        color: 0x002233,
        transparent: true,
        opacity: 0.08,
        roughness: 0.02,
        metalness: 0.3,
        clearcoat: 1.0,
        side: THREE.DoubleSide,
    });

    const glassEdgeMat = new THREE.LineBasicMaterial({
        color: CYAN_BRIGHT,
        transparent: true,
        opacity: 0.6,
    });

    const accentLineMat = new THREE.LineBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.35,
    });

    const internalLineMat = new THREE.LineBasicMaterial({
        color: CYAN_DIM,
        transparent: true,
        opacity: 0.2,
    });

    // ── CyberCab Group ──────────────────────────────────────
    const cybercab = new THREE.Group();

    // ── Main Body ───────────────────────────────────────────
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.75, 0.10);
    bodyShape.lineTo(-1.75, 0.38);
    bodyShape.lineTo(-1.65, 0.45);
    bodyShape.lineTo(-1.25, 0.50);
    bodyShape.lineTo(-0.55, 0.58);
    bodyShape.lineTo(-0.05, 1.18);
    bodyShape.lineTo(0.85, 1.22);
    bodyShape.lineTo(1.35, 1.08);
    bodyShape.lineTo(1.60, 0.68);
    bodyShape.lineTo(1.72, 0.58);
    bodyShape.lineTo(1.75, 0.40);
    bodyShape.lineTo(1.75, 0.10);
    bodyShape.lineTo(-1.75, 0.10);

    const extrudeSettings = {
        steps: 1,
        depth: 1.55,
        bevelEnabled: true,
        bevelThickness: 0.03,
        bevelSize: 0.03,
        bevelSegments: 2
    };

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    bodyGeo.translate(0, 0, -0.775);

    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    cybercab.add(bodyMesh);

    // Primary wireframe edges
    const edgesGeo = new THREE.EdgesGeometry(bodyGeo, 8);
    cybercab.add(new THREE.LineSegments(edgesGeo, edgeMat));

    // Glow layer (slightly thicker visual) using same edges
    const glowEdges = new THREE.LineSegments(edgesGeo.clone(), edgeGlowMat);
    glowEdges.scale.multiplyScalar(1.003);
    cybercab.add(glowEdges);

    // ── Windshield ──────────────────────────────────────────
    const wsShape = new THREE.Shape();
    wsShape.moveTo(-0.68, 0);
    wsShape.lineTo(0.68, 0);
    wsShape.lineTo(0.58, 0.58);
    wsShape.lineTo(-0.58, 0.58);
    wsShape.lineTo(-0.68, 0);

    const wsGeo = new THREE.ShapeGeometry(wsShape);
    const windshield = new THREE.Mesh(wsGeo, glassMat);
    windshield.position.set(-0.30, 0.88, 0);
    windshield.rotation.x = -0.50;
    cybercab.add(windshield);

    const wsEdgesGeo = new THREE.EdgesGeometry(wsGeo);
    const wsLines = new THREE.LineSegments(wsEdgesGeo, glassEdgeMat);
    wsLines.position.copy(windshield.position);
    wsLines.rotation.copy(windshield.rotation);
    cybercab.add(wsLines);

    // ── Rear Window ─────────────────────────────────────────
    const rwShape = new THREE.Shape();
    rwShape.moveTo(-0.58, 0);
    rwShape.lineTo(0.58, 0);
    rwShape.lineTo(0.48, 0.36);
    rwShape.lineTo(-0.48, 0.36);
    rwShape.lineTo(-0.58, 0);

    const rwGeo = new THREE.ShapeGeometry(rwShape);
    const rearWindow = new THREE.Mesh(rwGeo, glassMat);
    rearWindow.position.set(1.48, 0.72, 0);
    rearWindow.rotation.x = 0.28;
    cybercab.add(rearWindow);

    const rwEdgesGeo = new THREE.EdgesGeometry(rwGeo);
    const rwLines = new THREE.LineSegments(rwEdgesGeo, glassEdgeMat);
    rwLines.position.copy(rearWindow.position);
    rwLines.rotation.copy(rearWindow.rotation);
    cybercab.add(rwLines);

    // ── Butterfly Doors (open!) ─────────────────────────────
    function createDoor(zSign) {
        const door = new THREE.Group();
        const doorShape = new THREE.Shape();
        doorShape.moveTo(0, 0);
        doorShape.lineTo(0.9, 0);
        doorShape.lineTo(0.9, 0.75);
        doorShape.lineTo(0.6, 0.9);
        doorShape.lineTo(0, 0.85);
        doorShape.lineTo(0, 0);

        const doorGeo = new THREE.ShapeGeometry(doorShape);
        const doorMesh = new THREE.Mesh(doorGeo, glassMat);
        door.add(doorMesh);

        const doorEdges = new THREE.EdgesGeometry(doorGeo);
        door.add(new THREE.LineSegments(doorEdges, glassEdgeMat));

        // Position at hinge point (top of car body)
        const z = 0.78 * zSign;
        door.position.set(-0.6, 1.15, z);

        // Rotate open — butterfly style (rotate around X axis at top)
        door.rotation.x = zSign * 0.85; // ~50 degrees open
        door.rotation.z = -0.1;

        if (zSign < 0) {
            door.scale.z = -1;
        }

        return door;
    }

    cybercab.add(createDoor(1));
    cybercab.add(createDoor(-1));

    // ── Door Frame Lines (on body) ──────────────────────────
    function makeDoorFrame(zSign) {
        const z = 0.785 * zSign;
        const points = [
            new THREE.Vector3(-0.85, 0.12, z),
            new THREE.Vector3(-0.85, 1.00, z),
            new THREE.Vector3(-0.20, 1.15, z),
            new THREE.Vector3(0.65, 1.18, z),
            new THREE.Vector3(0.65, 0.12, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, accentLineMat);
    }
    cybercab.add(makeDoorFrame(1));
    cybercab.add(makeDoorFrame(-1));

    // ── Internal Structure (seats, dashboard wireframe) ─────
    function createInternalWireframe() {
        const group = new THREE.Group();
        const mat = internalLineMat;

        // Front seats (two box wireframes)
        [-0.35, 0.35].forEach(z => {
            const seatPoints = [
                // Seat base
                [-0.2, 0.15, z - 0.18], [-0.2, 0.15, z + 0.18],
                [0.2, 0.15, z + 0.18], [0.2, 0.15, z - 0.18],
                // Seat back
                [-0.2, 0.15, z - 0.18], [-0.2, 0.65, z - 0.15],
                [-0.2, 0.65, z + 0.15], [-0.2, 0.15, z + 0.18],
                // Top of backrest
                [-0.2, 0.65, z - 0.15], [-0.2, 0.65, z + 0.15],
            ];
            for (let i = 0; i < seatPoints.length - 1; i += 2) {
                const geo = new THREE.BufferGeometry().setFromPoints([
                    new THREE.Vector3(...seatPoints[i]),
                    new THREE.Vector3(...seatPoints[i + 1]),
                ]);
                group.add(new THREE.Line(geo, mat));
            }

            // Seat outline box
            const w = 0.36, d = 0.4, h = 0.06;
            const boxGeo = new THREE.BoxGeometry(d, h, w);
            const boxEdges = new THREE.EdgesGeometry(boxGeo);
            const boxLines = new THREE.LineSegments(boxEdges, mat);
            boxLines.position.set(0, 0.18, z);
            group.add(boxLines);

            // Backrest
            const backGeo = new THREE.BoxGeometry(0.06, 0.45, w * 0.85);
            const backEdges = new THREE.EdgesGeometry(backGeo);
            const backLines = new THREE.LineSegments(backEdges, mat);
            backLines.position.set(-0.18, 0.42, z);
            group.add(backLines);
        });

        // Dashboard
        const dashGeo = new THREE.BoxGeometry(0.08, 0.25, 1.1);
        const dashEdges = new THREE.EdgesGeometry(dashGeo);
        const dashLines = new THREE.LineSegments(dashEdges, mat);
        dashLines.position.set(-0.65, 0.38, 0);
        group.add(dashLines);

        // Steering column / screen
        const screenGeo = new THREE.PlaneGeometry(0.35, 0.2);
        const screenEdges = new THREE.EdgesGeometry(screenGeo);
        const screenLines = new THREE.LineSegments(screenEdges, new THREE.LineBasicMaterial({
            color: CYAN, transparent: true, opacity: 0.3
        }));
        screenLines.position.set(-0.58, 0.52, 0);
        screenLines.rotation.y = Math.PI / 2;
        group.add(screenLines);

        return group;
    }

    cybercab.add(createInternalWireframe());

    // ── LED Headlight Bar ───────────────────────────────────
    const hlGeo = new THREE.BoxGeometry(0.05, 0.05, 1.40);
    const hlMat = new THREE.MeshBasicMaterial({
        color: CYAN_BRIGHT,
        transparent: true,
        opacity: 0.95,
    });
    const headlight = new THREE.Mesh(hlGeo, hlMat);
    headlight.position.set(-1.68, 0.42, 0);
    cybercab.add(headlight);

    // Headlight glow plane
    const hlGlowGeo = new THREE.PlaneGeometry(0.8, 0.35);
    const hlGlowMat = new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
    });
    const hlGlow = new THREE.Mesh(hlGlowGeo, hlGlowMat);
    hlGlow.position.set(-1.82, 0.42, 0);
    hlGlow.rotation.y = Math.PI / 2;
    cybercab.add(hlGlow);

    // ── Taillight Bar ───────────────────────────────────────
    const tlGeo = new THREE.BoxGeometry(0.05, 0.05, 1.40);
    const tlMat = new THREE.MeshBasicMaterial({
        color: CYAN,
        transparent: true,
        opacity: 0.7,
    });
    const taillight = new THREE.Mesh(tlGeo, tlMat);
    taillight.position.set(1.77, 0.46, 0);
    cybercab.add(taillight);

    // ── Side Accent Lines ───────────────────────────────────
    function makeSideLine(zSign) {
        const z = 0.79 * zSign;
        const points = [
            new THREE.Vector3(-1.65, 0.32, z),
            new THREE.Vector3(-1.25, 0.32, z),
            new THREE.Vector3(1.50, 0.42, z),
            new THREE.Vector3(1.72, 0.42, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, accentLineMat);
    }
    cybercab.add(makeSideLine(1));
    cybercab.add(makeSideLine(-1));

    // Lower body line
    function makeLowerLine(zSign) {
        const z = 0.79 * zSign;
        const points = [
            new THREE.Vector3(-1.70, 0.14, z),
            new THREE.Vector3(1.72, 0.14, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, new THREE.LineBasicMaterial({
            color: CYAN_DIM, transparent: true, opacity: 0.15
        }));
    }
    cybercab.add(makeLowerLine(1));
    cybercab.add(makeLowerLine(-1));

    // ── Wheels ──────────────────────────────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.26, 0.26, 0.13, 24);
    const wheelMat = new THREE.MeshPhysicalMaterial({
        color: 0x001118,
        roughness: 0.6,
        metalness: 0.7,
        transparent: true,
        opacity: 0.4,
    });
    const rimGeo = new THREE.TorusGeometry(0.26, 0.015, 8, 32);
    const rimMat = new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.7 });

    // Spoke pattern
    function createWheel(x, y, z) {
        const group = new THREE.Group();

        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.rotation.x = Math.PI / 2;
        group.add(wheel);

        // Rim edge
        const rimEdges = new THREE.EdgesGeometry(rimGeo);
        const rim = new THREE.LineSegments(rimEdges, rimMat);
        group.add(rim);

        // Spokes (5-spoke pattern)
        for (let i = 0; i < 5; i++) {
            const angle = (i / 5) * Math.PI * 2;
            const points = [
                new THREE.Vector3(0, 0, 0),
                new THREE.Vector3(Math.cos(angle) * 0.22, Math.sin(angle) * 0.22, 0),
            ];
            const spokeGeo = new THREE.BufferGeometry().setFromPoints(points);
            const spoke = new THREE.Line(spokeGeo, new THREE.LineBasicMaterial({
                color: CYAN_DIM, transparent: true, opacity: 0.35
            }));
            group.add(spoke);
        }

        // Hub
        const hubGeo = new THREE.RingGeometry(0.03, 0.06, 16);
        const hubEdges = new THREE.EdgesGeometry(hubGeo);
        const hub = new THREE.LineSegments(hubEdges, new THREE.LineBasicMaterial({
            color: CYAN, transparent: true, opacity: 0.5
        }));
        hub.position.z = z > 0 ? 0.07 : -0.07;
        group.add(hub);

        group.position.set(x, y, z);
        return group;
    }

    cybercab.add(createWheel(-1.15, 0.05, 0.74));
    cybercab.add(createWheel(-1.15, 0.05, -0.74));
    cybercab.add(createWheel(1.18, 0.05, 0.74));
    cybercab.add(createWheel(1.18, 0.05, -0.74));

    // ── Wheel Arcs ──────────────────────────────────────────
    function makeWheelArc(cx, zSign) {
        const z = 0.79 * zSign;
        const points = [];
        for (let i = 0; i <= 12; i++) {
            const angle = Math.PI + (i / 12) * Math.PI;
            points.push(new THREE.Vector3(
                cx + Math.cos(angle) * 0.34,
                0.05 + Math.sin(angle) * 0.34,
                z
            ));
        }
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, accentLineMat);
    }
    cybercab.add(makeWheelArc(-1.15, 1));
    cybercab.add(makeWheelArc(-1.15, -1));
    cybercab.add(makeWheelArc(1.18, 1));
    cybercab.add(makeWheelArc(1.18, -1));

    // ── Roof Line ───────────────────────────────────────────
    const roofPoints = [
        new THREE.Vector3(-0.05, 1.24, -0.65),
        new THREE.Vector3(-0.05, 1.24, 0.65),
    ];
    cybercab.add(new THREE.Line(
        new THREE.BufferGeometry().setFromPoints(roofPoints),
        new THREE.LineBasicMaterial({ color: CYAN, transparent: true, opacity: 0.4 })
    ));

    scene.add(cybercab);

    // ── Ground ──────────────────────────────────────────────
    const grid = new THREE.GridHelper(30, 60, CYAN, CYAN);
    grid.position.y = -0.18;
    grid.material.transparent = true;
    grid.material.opacity = 0.03;
    scene.add(grid);

    // Ground reflection plane
    const groundGeo = new THREE.PlaneGeometry(50, 50);
    const groundMat = new THREE.MeshPhysicalMaterial({
        color: 0x000508,
        roughness: 0.95,
        metalness: 0.1,
        transparent: true,
        opacity: 0.3,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.17;
    scene.add(ground);

    // ── Particles ───────────────────────────────────────────
    const pCount = isMobile ? 60 : 200;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pSizes = new Float32Array(pCount);
    const pVel = new Float32Array(pCount);

    for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 16;
        pPos[i * 3 + 1] = Math.random() * 8;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 16;
        pSizes[i] = 0.02 + Math.random() * 0.04;
        pVel[i] = 0.001 + Math.random() * 0.003;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));

    const pMat = new THREE.PointsMaterial({
        color: CYAN_BRIGHT,
        size: isMobile ? 0.05 : 0.04,
        transparent: true,
        opacity: 0.6,
        sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── Horizontal Scan Line ────────────────────────────────
    const scanGeo = new THREE.PlaneGeometry(6, 0.02);
    const scanMat = new THREE.MeshBasicMaterial({
        color: CYAN_BRIGHT,
        transparent: true,
        opacity: 0.0,
        side: THREE.DoubleSide,
    });
    const scanLine = new THREE.Mesh(scanGeo, scanMat);
    scanLine.rotation.x = -Math.PI / 2;
    scanLine.position.y = -0.1;
    scene.add(scanLine);

    // ── Controls ────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.04;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 5;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.5;
    controls.target.set(0, 0.5, 0);

    if (isMobile) {
        controls.enabled = false;
    }

    let resumeTimer = null;
    controls.addEventListener('start', () => {
        controls.autoRotate = false;
        if (resumeTimer) clearTimeout(resumeTimer);
    });
    controls.addEventListener('end', () => {
        resumeTimer = setTimeout(() => { controls.autoRotate = true; }, 3000);
    });

    // ── Animation Loop ──────────────────────────────────────
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Gentle hover
        cybercab.position.y = Math.sin(t * 0.6) * 0.03;

        // Particle drift
        const pos = pGeo.attributes.position.array;
        for (let i = 0; i < pCount; i++) {
            pos[i * 3 + 1] += pVel[i];
            pos[i * 3] += Math.sin(t * 0.3 + i * 0.7) * 0.0003;
            if (pos[i * 3 + 1] > 8) {
                pos[i * 3 + 1] = -0.5;
                pos[i * 3] = (Math.random() - 0.5) * 16;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 16;
            }
        }
        pGeo.attributes.position.needsUpdate = true;

        // Headlight pulse
        hlMat.opacity = 0.8 + Math.sin(t * 1.2) * 0.15;
        hlGlowMat.opacity = 0.08 + Math.sin(t * 1.2) * 0.06;

        // Under glow pulse
        underGlow.intensity = 0.6 + Math.sin(t * 0.8) * 0.3;

        // Scan line sweep (every ~6 seconds)
        const scanCycle = (t % 6) / 6;
        if (scanCycle < 0.3) {
            const scanProgress = scanCycle / 0.3;
            scanLine.position.y = -0.1 + scanProgress * 1.6;
            scanMat.opacity = Math.sin(scanProgress * Math.PI) * 0.15;
        } else {
            scanMat.opacity = 0;
        }

        // Edge glow pulse
        edgeGlowMat.opacity = 0.15 + Math.sin(t * 0.9) * 0.1;

        controls.update();
        renderer.render(scene, camera);
    }

    animate();

    // ── Resize ──────────────────────────────────────────────
    window.addEventListener('resize', () => {
        const w = container.clientWidth;
        const h = container.clientHeight;
        camera.aspect = w / h;
        camera.updateProjectionMatrix();
        renderer.setSize(w, h);
    });

    // ── Fade in ─────────────────────────────────────────────
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 2s ease';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderer.domElement.style.opacity = '1';
        });
    });

})();
