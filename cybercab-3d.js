import * as THREE from 'three';
import { OrbitControls } from 'three/addons/controls/OrbitControls.js';

(() => {
    const container = document.getElementById('cybercab-canvas-container');
    if (!container) return;

    const isMobile = window.innerWidth < 768;

    // ── Scene ────────────────────────────────────────────────
    const scene = new THREE.Scene();

    const camera = new THREE.PerspectiveCamera(
        40,
        container.clientWidth / container.clientHeight,
        0.1,
        100
    );
    camera.position.set(5, 2.8, 6);

    const renderer = new THREE.WebGLRenderer({
        antialias: !isMobile,
        alpha: true,
        powerPreference: 'high-performance'
    });
    renderer.setSize(container.clientWidth, container.clientHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, isMobile ? 1 : 2));
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.2;
    container.appendChild(renderer.domElement);

    // ── Colors ───────────────────────────────────────────────
    const GOLD = 0xc9a962;
    const GOLD_COLOR = new THREE.Color(GOLD);

    // ── Lights ───────────────────────────────────────────────
    scene.add(new THREE.AmbientLight(GOLD, 0.12));

    const keyLight = new THREE.PointLight(GOLD, 2.5, 25);
    keyLight.position.set(6, 5, 4);
    scene.add(keyLight);

    const fillLight = new THREE.PointLight(0x4466aa, 0.8, 18);
    fillLight.position.set(-5, 3, -4);
    scene.add(fillLight);

    const rimLight = new THREE.PointLight(0xffffff, 1.5, 12);
    rimLight.position.set(0, 6, -6);
    scene.add(rimLight);

    const underGlow = new THREE.PointLight(GOLD, 0.6, 5);
    underGlow.position.set(0, -0.3, 0);
    scene.add(underGlow);

    // ── CyberCab Model ──────────────────────────────────────
    const cybercab = new THREE.Group();

    // Body — side profile extruded to width
    // CyberCab: wedge shape, low front hood, steep windshield, flat roof, sloped rear
    const bodyShape = new THREE.Shape();
    bodyShape.moveTo(-1.7, 0.12);     // front bottom
    bodyShape.lineTo(-1.7, 0.35);     // front face bottom
    bodyShape.lineTo(-1.6, 0.42);     // front face top (LED bar level)
    bodyShape.lineTo(-1.2, 0.48);     // hood start
    bodyShape.lineTo(-0.5, 0.55);     // hood end / windshield base
    bodyShape.lineTo(0.0, 1.15);      // windshield top / roof front
    bodyShape.lineTo(0.9, 1.2);       // roof peak
    bodyShape.lineTo(1.4, 1.05);      // rear glass top
    bodyShape.lineTo(1.65, 0.65);     // rear glass bottom / trunk top
    bodyShape.lineTo(1.7, 0.55);      // trunk
    bodyShape.lineTo(1.7, 0.35);      // rear face top
    bodyShape.lineTo(1.7, 0.12);      // rear bottom
    bodyShape.lineTo(-1.7, 0.12);     // close bottom

    const extrudeSettings = {
        steps: 1,
        depth: 1.5,
        bevelEnabled: !isMobile,
        bevelThickness: 0.04,
        bevelSize: 0.04,
        bevelSegments: 2
    };

    const bodyGeo = new THREE.ExtrudeGeometry(bodyShape, extrudeSettings);
    // Center on Z axis (depth direction)
    bodyGeo.translate(0, 0, -0.75);

    // Dark glass-like body
    const bodyMat = new THREE.MeshPhysicalMaterial({
        color: 0x0a0a14,
        transparent: true,
        opacity: 0.3,
        roughness: 0.15,
        metalness: 0.9,
        clearcoat: 0.5,
        clearcoatRoughness: 0.1,
        side: THREE.DoubleSide,
    });
    const bodyMesh = new THREE.Mesh(bodyGeo, bodyMat);
    cybercab.add(bodyMesh);

    // Gold wireframe edges
    const edgesGeo = new THREE.EdgesGeometry(bodyGeo, 12);
    const edgesMat = new THREE.LineBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.85,
    });
    cybercab.add(new THREE.LineSegments(edgesGeo, edgesMat));

    // ── Windshield (separate translucent panel) ─────────────
    const wsShape = new THREE.Shape();
    wsShape.moveTo(-0.65, 0);
    wsShape.lineTo(0.65, 0);
    wsShape.lineTo(0.55, 0.6);
    wsShape.lineTo(-0.55, 0.6);
    wsShape.lineTo(-0.65, 0);
    const wsGeo = new THREE.ShapeGeometry(wsShape);
    const wsMat = new THREE.MeshPhysicalMaterial({
        color: 0x1a1a3e,
        transparent: true,
        opacity: 0.12,
        roughness: 0.05,
        metalness: 0.2,
        clearcoat: 1.0,
        side: THREE.DoubleSide,
    });
    const windshield = new THREE.Mesh(wsGeo, wsMat);
    // Position on the windshield slope
    windshield.position.set(-0.25, 0.85, 0);
    windshield.rotation.y = 0;
    windshield.rotation.x = -0.55;
    cybercab.add(windshield);

    // Windshield edge glow
    const wsEdges = new THREE.EdgesGeometry(wsGeo);
    const wsEdgeMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.5 });
    const wsLines = new THREE.LineSegments(wsEdges, wsEdgeMat);
    wsLines.position.copy(windshield.position);
    wsLines.rotation.copy(windshield.rotation);
    cybercab.add(wsLines);

    // ── Rear window ─────────────────────────────────────────
    const rwShape = new THREE.Shape();
    rwShape.moveTo(-0.55, 0);
    rwShape.lineTo(0.55, 0);
    rwShape.lineTo(0.45, 0.35);
    rwShape.lineTo(-0.45, 0.35);
    rwShape.lineTo(-0.55, 0);
    const rwGeo = new THREE.ShapeGeometry(rwShape);
    const rearWindow = new THREE.Mesh(rwGeo, wsMat);
    rearWindow.position.set(1.52, 0.7, 0);
    rearWindow.rotation.x = 0.3;
    rearWindow.rotation.y = Math.PI * 0.03;
    cybercab.add(rearWindow);

    const rwEdges = new THREE.EdgesGeometry(rwGeo);
    const rwLines = new THREE.LineSegments(rwEdges, wsEdgeMat);
    rwLines.position.copy(rearWindow.position);
    rwLines.rotation.copy(rearWindow.rotation);
    cybercab.add(rwLines);

    // ── LED Headlight bar ───────────────────────────────────
    const hlGeo = new THREE.BoxGeometry(0.06, 0.06, 1.35);
    const hlMat = new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.95,
    });
    const headlight = new THREE.Mesh(hlGeo, hlMat);
    headlight.position.set(-1.62, 0.39, 0);
    cybercab.add(headlight);

    // Headlight glow sprite
    const hlGlowGeo = new THREE.PlaneGeometry(0.6, 0.3);
    const hlGlowMat = new THREE.MeshBasicMaterial({
        color: GOLD,
        transparent: true,
        opacity: 0.15,
        side: THREE.DoubleSide,
    });
    const hlGlow = new THREE.Mesh(hlGlowGeo, hlGlowMat);
    hlGlow.position.set(-1.75, 0.39, 0);
    hlGlow.rotation.y = Math.PI / 2;
    cybercab.add(hlGlow);

    // ── Taillight bar ───────────────────────────────────────
    const tlGeo = new THREE.BoxGeometry(0.06, 0.06, 1.35);
    const tlMat = new THREE.MeshBasicMaterial({
        color: 0xee2233,
        transparent: true,
        opacity: 0.85,
    });
    const taillight = new THREE.Mesh(tlGeo, tlMat);
    taillight.position.set(1.72, 0.42, 0);
    cybercab.add(taillight);

    // Taillight glow
    const tlGlow = new THREE.Mesh(hlGlowGeo, new THREE.MeshBasicMaterial({
        color: 0xff2233,
        transparent: true,
        opacity: 0.12,
        side: THREE.DoubleSide,
    }));
    tlGlow.position.set(1.82, 0.42, 0);
    tlGlow.rotation.y = Math.PI / 2;
    cybercab.add(tlGlow);

    // ── Butterfly door lines ────────────────────────────────
    const doorMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.45 });

    function makeDoorLine(zSign) {
        const z = 0.76 * zSign;
        const points = [
            new THREE.Vector3(-0.8, 0.15, z),
            new THREE.Vector3(-0.8, 0.95, z),
            new THREE.Vector3(-0.15, 1.12, z),
            new THREE.Vector3(0.7, 1.15, z),
            new THREE.Vector3(0.7, 0.15, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, doorMat);
    }
    cybercab.add(makeDoorLine(1));
    cybercab.add(makeDoorLine(-1));

    // ── Side accent lines ───────────────────────────────────
    const accentMat = new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.25 });
    function makeSideLine(zSign) {
        const z = 0.77 * zSign;
        const points = [
            new THREE.Vector3(-1.6, 0.3, z),
            new THREE.Vector3(-1.2, 0.3, z),
            new THREE.Vector3(1.5, 0.4, z),
            new THREE.Vector3(1.7, 0.4, z),
        ];
        const geo = new THREE.BufferGeometry().setFromPoints(points);
        return new THREE.Line(geo, accentMat);
    }
    cybercab.add(makeSideLine(1));
    cybercab.add(makeSideLine(-1));

    // ── Wheels ──────────────────────────────────────────────
    const wheelGeo = new THREE.CylinderGeometry(0.25, 0.25, 0.14, 20);
    const wheelMat = new THREE.MeshPhysicalMaterial({
        color: 0x111118,
        roughness: 0.7,
        metalness: 0.6,
    });
    const rimGeo = new THREE.TorusGeometry(0.25, 0.018, 8, 28);
    const rimMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.55 });
    // Hub cap
    const hubGeo = new THREE.CircleGeometry(0.12, 16);
    const hubMat = new THREE.MeshBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3, side: THREE.DoubleSide });

    const wheelPositions = [
        [-1.1, 0.07, 0.72],
        [-1.1, 0.07, -0.72],
        [1.15, 0.07, 0.72],
        [1.15, 0.07, -0.72],
    ];

    wheelPositions.forEach(([x, y, z]) => {
        const wheel = new THREE.Mesh(wheelGeo, wheelMat);
        wheel.position.set(x, y, z);
        wheel.rotation.x = Math.PI / 2;
        cybercab.add(wheel);

        const rim = new THREE.Mesh(rimGeo, rimMat);
        rim.position.set(x, y, z);
        cybercab.add(rim);

        // Hub cap facing outward
        const hub = new THREE.Mesh(hubGeo, hubMat);
        hub.position.set(x, y, z + (z > 0 ? 0.08 : -0.08));
        cybercab.add(hub);
    });

    // ── Roof accent line ────────────────────────────────────
    const roofPoints = [
        new THREE.Vector3(0.0, 1.19, -0.6),
        new THREE.Vector3(0.0, 1.19, 0.6),
    ];
    const roofGeo = new THREE.BufferGeometry().setFromPoints(roofPoints);
    cybercab.add(new THREE.Line(roofGeo, new THREE.LineBasicMaterial({ color: GOLD, transparent: true, opacity: 0.3 })));

    scene.add(cybercab);

    // ── Ground plane + grid ─────────────────────────────────
    const groundGeo = new THREE.PlaneGeometry(40, 40);
    const groundMat = new THREE.MeshPhysicalMaterial({
        color: 0x030308,
        roughness: 0.9,
        metalness: 0.1,
        transparent: true,
        opacity: 0.4,
    });
    const ground = new THREE.Mesh(groundGeo, groundMat);
    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.15;
    scene.add(ground);

    const grid = new THREE.GridHelper(24, 48, GOLD, GOLD);
    grid.position.y = -0.14;
    grid.material.transparent = true;
    grid.material.opacity = 0.04;
    scene.add(grid);

    // ── Floating particles ──────────────────────────────────
    const pCount = isMobile ? 30 : 80;
    const pGeo = new THREE.BufferGeometry();
    const pPos = new Float32Array(pCount * 3);
    const pVel = new Float32Array(pCount); // y velocities
    for (let i = 0; i < pCount; i++) {
        pPos[i * 3] = (Math.random() - 0.5) * 14;
        pPos[i * 3 + 1] = Math.random() * 6;
        pPos[i * 3 + 2] = (Math.random() - 0.5) * 14;
        pVel[i] = 0.002 + Math.random() * 0.004;
    }
    pGeo.setAttribute('position', new THREE.BufferAttribute(pPos, 3));
    const pMat = new THREE.PointsMaterial({
        color: GOLD,
        size: isMobile ? 0.04 : 0.035,
        transparent: true,
        opacity: 0.55,
        sizeAttenuation: true,
    });
    const particles = new THREE.Points(pGeo, pMat);
    scene.add(particles);

    // ── Controls ────────────────────────────────────────────
    const controls = new OrbitControls(camera, renderer.domElement);
    controls.enableDamping = true;
    controls.dampingFactor = 0.05;
    controls.enableZoom = false;
    controls.enablePan = false;
    controls.minPolarAngle = Math.PI / 5;
    controls.maxPolarAngle = Math.PI / 2.1;
    controls.autoRotate = true;
    controls.autoRotateSpeed = 0.7;
    controls.target.set(0, 0.45, 0);

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

    // ── Animation loop ──────────────────────────────────────
    const clock = new THREE.Clock();

    function animate() {
        requestAnimationFrame(animate);
        const t = clock.getElapsedTime();

        // Gentle hover/bob
        cybercab.position.y = Math.sin(t * 0.7) * 0.04;

        // Particle drift
        const pos = pGeo.attributes.position.array;
        for (let i = 0; i < pCount; i++) {
            pos[i * 3 + 1] += pVel[i];
            pos[i * 3] += Math.sin(t * 0.5 + i) * 0.0005;
            if (pos[i * 3 + 1] > 6) {
                pos[i * 3 + 1] = -0.5;
                pos[i * 3] = (Math.random() - 0.5) * 14;
                pos[i * 3 + 2] = (Math.random() - 0.5) * 14;
            }
        }
        pGeo.attributes.position.needsUpdate = true;

        // Headlight pulse
        hlMat.opacity = 0.8 + Math.sin(t * 1.5) * 0.15;
        hlGlowMat.opacity = 0.1 + Math.sin(t * 1.5) * 0.08;

        // Under glow pulse
        underGlow.intensity = 0.4 + Math.sin(t * 1.2) * 0.2;

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

    // ── Fade in once ready ──────────────────────────────────
    renderer.domElement.style.opacity = '0';
    renderer.domElement.style.transition = 'opacity 1.5s ease';
    requestAnimationFrame(() => {
        requestAnimationFrame(() => {
            renderer.domElement.style.opacity = '1';
        });
    });

})();
