(() => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    const width = 900;
    const height = 540;
    const topZone = 90;
    const bottomZone = 90;
    const laneCount = 4;
    const laneHeight = (height - topZone - bottomZone) / laneCount;

    const fares = {
        fare: 30,
        feeRate: 0.275,
        varOpex: 11.65,
        baseTripsPerDay: 13.5,
        baseMonthlyContribution: 4091.45
    };

    const perTrip = {
        fee: fares.fare * fares.feeRate,
        contribution: 0
    };
    perTrip.contribution = fares.fare - perTrip.fee - fares.varOpex;

    const ui = {
        timeLeft: document.getElementById('timeLeft'),
        tripCount: document.getElementById('tripCount'),
        tripStreak: document.getElementById('tripStreak'),
        fareTotal: document.getElementById('fareTotal'),
        feeTotal: document.getElementById('feeTotal'),
        opexTotal: document.getElementById('opexTotal'),
        contribTotal: document.getElementById('contribTotal'),
        paceTrips: document.getElementById('paceTrips'),
        runRate: document.getElementById('runRate'),
        status: document.getElementById('gameStatus'),
        start: document.getElementById('startGame'),
        reset: document.getElementById('resetGame'),
        modeHuman: document.getElementById('modeHuman'),
        modeAuto: document.getElementById('modeAuto')
    };

    const state = {
        running: false,
        mode: 'human',
        timeLeft: 60,
        sessionDuration: 60,
        trips: 0,
        streak: 0,
        totalFare: 0,
        totalFee: 0,
        totalOpex: 0,
        totalContrib: 0,
        message: '',
        messageTimer: 0
    };

    const keys = {};

    const modeLabels = {
        human: 'Human',
        auto: 'Self-Driving'
    };

    const autoSettings = {
        speedMultiplier: 2.0,
        alignDeadzone: 3,
        planCooldown: 0.05,
        laneBuffer: 12
    };

    const autoState = {
        direction: 1,
        targetX: width / 2,
        targetLane: null,
        planTimer: 0,
        lastX: width / 2,
        lastY: height - bottomZone / 2,
        stuckTime: 0,
        safeZoneCooldown: 0
    };

    const player = {
        x: width / 2,
        y: height - bottomZone / 2,
        w: 28,
        h: 28,
        speed: 240,
        hasPassenger: false
    };

    const lanes = [];
    const cars = [];

    const passenger = {
        x: width / 2,
        y: topZone / 2,
        r: 10,
        active: true
    };

    const formatMoney = (value) => {
        const rounded = Math.round(value * 100) / 100;
        return `$${rounded.toLocaleString('en-US', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
    };

    const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

    const getBaseStatus = () => {
        if (state.running) return 'Running';
        if (state.timeLeft <= 0) return 'Run complete';
        return 'Ready to launch';
    };

    const setStatus = (text) => {
        if (!ui.status) return;
        const label = modeLabels[state.mode] || 'Human';
        ui.status.textContent = `${text} - ${label}`;
    };

    const syncStatus = () => setStatus(getBaseStatus());

    const createLanes = () => {
        lanes.length = 0;
        cars.length = 0;
        for (let i = 0; i < laneCount; i += 1) {
            const y = topZone + i * laneHeight;
            const direction = i % 2 === 0 ? 1 : -1;
            const speed = 80 + i * 30;
            const lane = { y, speed, direction };
            lanes.push(lane);

            const carCount = 3 + (i % 2);
            for (let j = 0; j < carCount; j += 1) {
                const gap = width / carCount;
                cars.push({
                    lane,
                    w: 46,
                    h: 24,
                    x: direction === 1 ? -j * gap : width + j * gap,
                    y: y + laneHeight / 2 - 12,
                    tint: j % 2 === 0 ? '#5eb8a8' : '#c9a962'
                });
            }
        }
    };

    const getLaneIndex = (y) => {
        if (y < topZone) return -1;
        if (y >= height - bottomZone) return laneCount;
        return Math.floor((y - topZone) / laneHeight);
    };

    const getLaneByIndex = (index) => (index >= 0 && index < laneCount ? lanes[index] : null);

    const lookAhead = 0.5;
    const autoSafetyHorizon = 0.3;
    const autoSafetyPad = 4;

    const getCarFutureX = (car, t) => {
        if (t <= 0) return car.x;
        const span = width + car.w + 120;
        let future = car.x + car.lane.speed * car.lane.direction * t;
        if (car.lane.direction === 1) {
            while (future > width + 60) future -= span;
            while (future < -car.w - 60) future += span;
        } else {
            while (future < -car.w - 60) future += span;
            while (future > width + 60) future -= span;
        }
        return future;
    };

    const isLaneSafeAtX = (laneIndex, x, buffer = 16) => {
        const lane = getLaneByIndex(laneIndex);
        if (!lane) return true;
        const xMin = x - player.w / 2 - buffer;
        const xMax = x + player.w / 2 + buffer;
        return !cars.some((car) => {
            if (car.lane !== lane) return false;
            const futureX = getCarFutureX(car, lookAhead);
            const minX = Math.min(car.x, futureX);
            const maxX = Math.max(car.x + car.w, futureX + car.w);
            return xMax > minX && xMin < maxX;
        });
    };

    const getAutoSpeed = () => (state.mode === 'auto' ? player.speed * autoSettings.speedMultiplier : player.speed);

    const updateAutoTimers = (dt) => {
        autoState.planTimer = Math.max(0, autoState.planTimer - dt);
    };

    const updateAutoStuck = (dt) => {
        const moved = Math.hypot(player.x - autoState.lastX, player.y - autoState.lastY);
        autoState.lastX = player.x;
        autoState.lastY = player.y;
        if (moved < 0.5) {
            autoState.stuckTime += dt;
        } else {
            autoState.stuckTime = 0;
        }
    };

    const getAlignedDx = (targetX) => {
        const delta = targetX - player.x;
        if (Math.abs(delta) <= autoSettings.alignDeadzone) return 0;
        return clamp(delta / 28, -1, 1);
    };

    const findSafeGapX = (laneIndex, preferredX) => {
        const lane = getLaneByIndex(laneIndex);
        const margin = player.w / 2 + 6;
        const target = clamp(preferredX, margin, width - margin);
        if (!lane) return target;

        const pad = player.w / 2 + autoSettings.laneBuffer;
        const spans = cars
            .filter((car) => car.lane === lane)
            .map((car) => {
                const futureX = getCarFutureX(car, lookAhead);
                const minX = Math.min(car.x, futureX);
                const maxX = Math.max(car.x + car.w, futureX + car.w);
                return {
                    start: minX - pad,
                    end: maxX + pad
                };
            })
            .sort((a, b) => a.start - b.start);

        if (spans.length === 0) return target;

        const gaps = [];
        let cursor = 0;
        spans.forEach((span) => {
            if (span.start > cursor) {
                gaps.push({ start: cursor, end: span.start });
            }
            cursor = Math.max(cursor, span.end);
        });
        if (cursor < width) {
            gaps.push({ start: cursor, end: width });
        }

        let bestX = null;
        let bestScore = Number.POSITIVE_INFINITY;
        gaps.forEach((gap) => {
            const size = gap.end - gap.start;
            if (size < player.w + 6) return;
            const center = clamp((gap.start + gap.end) / 2, margin, width - margin);
            const score = Math.abs(center - target);
            if (score < bestScore) {
                bestScore = score;
                bestX = center;
            }
        });

        return bestX;
    };

    const updateAutoPlan = (laneIndex, preferredX) => {
        if (laneIndex < 0 || laneIndex >= laneCount) {
            autoState.targetLane = null;
            autoState.targetX = clamp(preferredX, player.w / 2, width - player.w / 2);
            return;
        }

        if (autoState.targetLane !== laneIndex) {
            autoState.targetLane = laneIndex;
            autoState.planTimer = 0;
        }

        const targetSafe = isLaneSafeAtX(laneIndex, autoState.targetX, autoSettings.laneBuffer);
        if (autoState.planTimer > 0 && targetSafe) return;

        const candidate = findSafeGapX(laneIndex, preferredX);
        if (candidate !== null) {
            autoState.targetX = candidate;
        }
        autoState.planTimer = autoSettings.planCooldown;
    };

    const resetPlayer = () => {
        player.x = width / 2;
        player.y = height - bottomZone / 2;
        player.hasPassenger = false;
    };

    const spawnPassenger = () => {
        const padding = 60;
        passenger.x = padding + Math.random() * (width - padding * 2);
        passenger.y = topZone / 2;
        passenger.active = true;
    };

    const setMode = (mode, announce = true) => {
        if (mode !== 'human' && mode !== 'auto') return;
        state.mode = mode;
        if (ui.modeHuman) {
            ui.modeHuman.classList.toggle('active', mode === 'human');
        }
        if (ui.modeAuto) {
            ui.modeAuto.classList.toggle('active', mode === 'auto');
        }
        autoState.targetX = player.x;
        autoState.targetLane = null;
        autoState.planTimer = 0;
        autoState.lastX = player.x;
        autoState.lastY = player.y;
        autoState.stuckTime = 0;
        syncStatus();
        if (announce) {
            state.message = mode === 'auto' ? 'Autopilot engaged' : 'Human control';
            state.messageTimer = 1.0;
        }
    };

    const resetGame = (duration = 60) => {
        state.running = false;
        state.sessionDuration = duration;
        state.timeLeft = duration;
        state.trips = 0;
        state.streak = 0;
        state.totalFare = 0;
        state.totalFee = 0;
        state.totalOpex = 0;
        state.totalContrib = 0;
        state.message = '';
        state.messageTimer = 0;
        resetPlayer();
        autoState.targetX = player.x;
        autoState.targetLane = null;
        autoState.planTimer = 0;
        autoState.lastX = player.x;
        autoState.lastY = player.y;
        autoState.stuckTime = 0;
        autoState.safeZoneCooldown = 0;
        spawnPassenger();
        updateUI();
        setStatus('Ready to launch');
    };

    const startGame = (duration) => {
        resetGame(duration);
        state.running = true;
        setStatus('Running');
    };

    const rectsIntersect = (a, b) => {
        return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
        );
    };

    // Simple collision check - does this position overlap ANY car right now?
    const wouldHitCar = (x, y, buffer = 6) => {
        const rect = {
            x: x - player.w / 2 - buffer,
            y: y - player.h / 2 - buffer,
            w: player.w + buffer * 2,
            h: player.h + buffer * 2
        };
        return cars.some(car => rectsIntersect(rect, car));
    };

    // Check if a car is approaching and will hit us soon
    const isCarApproaching = (lookahead = 0.3) => {
        const buffer = 8;
        const rect = {
            x: player.x - player.w / 2 - buffer,
            y: player.y - player.h / 2 - buffer,
            w: player.w + buffer * 2,
            h: player.h + buffer * 2
        };

        return cars.some(car => {
            // Check if car is in same vertical band
            if (rect.y + rect.h < car.y || rect.y > car.y + car.h) return false;

            // Check if car will reach us within lookahead time
            const futureX = car.x + car.lane.speed * car.lane.direction * lookahead;
            const carRect = { x: futureX, y: car.y, w: car.w, h: car.h };

            return rectsIntersect(rect, carRect);
        });
    };

    const playerRectAt = (x, y) => ({
        x: x - player.w / 2,
        y: y - player.h / 2,
        w: player.w,
        h: player.h
    });

    const playerSafetyRectAt = (x, y) => ({
        x: x - player.w / 2 - autoSafetyPad,
        y: y - player.h / 2 - autoSafetyPad,
        w: player.w + autoSafetyPad * 2,
        h: player.h + autoSafetyPad * 2
    });

    const playerRect = () => playerRectAt(player.x, player.y);

    const isPositionSafe = (x, y, horizon = autoSafetyHorizon) => {
        const rect = playerSafetyRectAt(x, y);
        return !cars.some((car) => {
            const carTop = car.y;
            const carBottom = car.y + car.h;
            if (rect.y + rect.h < carTop || rect.y > carBottom) return false;
            const sampleCount = horizon > 0 ? 8 : 0;
            for (let i = 0; i <= sampleCount; i += 1) {
                const t = sampleCount === 0 ? 0 : (horizon * i) / sampleCount;
                const futureX = getCarFutureX(car, t);
                if (rectsIntersect(rect, {
                    x: futureX,
                    y: car.y,
                    w: car.w,
                    h: car.h
                })) {
                    return true;
                }
            }
            return false;
        });
    };

    const isPathSafe = (fromX, fromY, toX, toY, horizon = autoSafetyHorizon) => {
        const steps = 4;
        for (let i = 0; i <= steps; i += 1) {
            const t = i / steps;
            const x = fromX + (toX - fromX) * t;
            const y = fromY + (toY - fromY) * t;
            if (!isPositionSafe(x, y, horizon)) return false;
        }
        return true;
    };

    const updateUI = () => {
        if (!ui.timeLeft) return;
        const minutes = Math.floor(state.timeLeft / 60);
        const seconds = Math.floor(state.timeLeft % 60);
        ui.timeLeft.textContent = `${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}`;
        ui.tripCount.textContent = state.trips;
        ui.tripStreak.textContent = state.streak;
        ui.fareTotal.textContent = formatMoney(state.totalFare);
        ui.feeTotal.textContent = formatMoney(state.totalFee);
        ui.opexTotal.textContent = formatMoney(state.totalOpex);
        ui.contribTotal.textContent = formatMoney(state.totalContrib);

        const paceTrips = state.trips * (300 / state.sessionDuration);
        const runRate = (paceTrips / fares.baseTripsPerDay) * fares.baseMonthlyContribution;
        ui.paceTrips.textContent = paceTrips.toFixed(1);
        ui.runRate.textContent = formatMoney(runRate);
    };

    const drawBackground = () => {
        const gradient = ctx.createLinearGradient(0, 0, 0, height);
        gradient.addColorStop(0, '#0a0a0f');
        gradient.addColorStop(0.55, '#080810');
        gradient.addColorStop(1, '#050508');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.03)';
        ctx.lineWidth = 1;
        for (let y = 0; y <= height; y += 36) {
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.02)';
        for (let x = 0; x <= width; x += 60) {
            ctx.beginPath();
            ctx.moveTo(x, 0);
            ctx.lineTo(x, height);
            ctx.stroke();
        }
        ctx.restore();
    };

    const drawZones = () => {
        const topGradient = ctx.createLinearGradient(0, 0, 0, topZone);
        topGradient.addColorStop(0, 'rgba(94, 184, 168, 0.22)');
        topGradient.addColorStop(1, 'rgba(94, 184, 168, 0.06)');
        ctx.fillStyle = topGradient;
        ctx.fillRect(0, 0, width, topZone);

        const bottomGradient = ctx.createLinearGradient(0, height - bottomZone, 0, height);
        bottomGradient.addColorStop(0, 'rgba(201, 169, 98, 0.06)');
        bottomGradient.addColorStop(1, 'rgba(201, 169, 98, 0.22)');
        ctx.fillStyle = bottomGradient;
        ctx.fillRect(0, height - bottomZone, width, bottomZone);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topZone);
        ctx.lineTo(width, topZone);
        ctx.moveTo(0, height - bottomZone);
        ctx.lineTo(width, height - bottomZone);
        ctx.stroke();

        ctx.fillStyle = 'rgba(5, 5, 8, 0.6)';
        ctx.fillRect(12, 10, 112, 20);
        ctx.fillRect(12, height - bottomZone + 10, 112, 20);
        ctx.fillStyle = 'rgba(250, 250, 250, 0.8)';
        ctx.font = '11px "DM Sans"';
        ctx.fillText('Pickup Zone', 20, 24);
        ctx.fillText('Dropoff Zone', 20, height - bottomZone + 24);
    };

    const drawLanes = () => {
        for (let i = 0; i < laneCount; i += 1) {
            const y = topZone + i * laneHeight;
            ctx.fillStyle = i % 2 === 0 ? 'rgba(10, 10, 15, 0.6)' : 'rgba(16, 16, 20, 0.6)';
            ctx.fillRect(0, y, width, laneHeight);
        }

        ctx.save();
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([18, 14]);
        for (let i = 0; i < laneCount; i += 1) {
            const y = topZone + i * laneHeight + laneHeight / 2;
            ctx.beginPath();
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.restore();
    };

    const drawRoundedRect = (x, y, w, h, r) => {
        const radius = Math.min(r, w / 2, h / 2);
        ctx.beginPath();
        ctx.moveTo(x + radius, y);
        ctx.lineTo(x + w - radius, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + radius);
        ctx.lineTo(x + w, y + h - radius);
        ctx.quadraticCurveTo(x + w, y + h, x + w - radius, y + h);
        ctx.lineTo(x + radius, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - radius);
        ctx.lineTo(x, y + radius);
        ctx.quadraticCurveTo(x, y, x + radius, y);
        ctx.closePath();
        ctx.fill();
    };

    const drawCars = () => {
        cars.forEach((car) => {
            ctx.save();
            ctx.translate(car.x, car.y);
            ctx.fillStyle = car.tint;
            drawRoundedRect(0, 0, car.w, car.h, 6);

            ctx.fillStyle = 'rgba(255, 255, 255, 0.14)';
            drawRoundedRect(2, 2, car.w - 4, car.h / 2, 5);

            ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
            ctx.fillRect(8, 6, car.w - 16, car.h - 12);

            ctx.fillStyle = '#050508';
            ctx.fillRect(6, -2, 8, 4);
            ctx.fillRect(car.w - 14, -2, 8, 4);
            ctx.fillRect(6, car.h - 2, 8, 4);
            ctx.fillRect(car.w - 14, car.h - 2, 8, 4);

            const headX = car.lane.direction === 1 ? car.w - 3 : 0;
            const tailX = car.lane.direction === 1 ? 0 : car.w - 3;
            ctx.fillStyle = 'rgba(250, 250, 250, 0.8)';
            ctx.fillRect(headX, 4, 3, 6);
            ctx.fillStyle = 'rgba(248, 104, 104, 0.8)';
            ctx.fillRect(tailX, car.h - 10, 3, 6);
            ctx.restore();
        });
    };

    const drawPassenger = () => {
        if (!passenger.active) return;
        const pulse = (Math.sin(performance.now() / 180) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.7;
        ctx.strokeStyle = 'rgba(201, 169, 98, 0.6)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        ctx.arc(passenger.x, passenger.y, passenger.r + 6 + pulse * 4, 0, Math.PI * 2);
        ctx.stroke();
        ctx.restore();

        ctx.beginPath();
        ctx.fillStyle = '#e4d4a8';
        ctx.arc(passenger.x, passenger.y, passenger.r + pulse * 1.5, 0, Math.PI * 2);
        ctx.fill();

        ctx.beginPath();
        ctx.fillStyle = '#0a0a0f';
        ctx.arc(passenger.x, passenger.y + 6, passenger.r - 4, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawPlayer = () => {
        const color = player.hasPassenger ? '#c9a962' : '#5eb8a8';
        ctx.save();
        ctx.translate(player.x - player.w / 2, player.y - player.h / 2);
        ctx.fillStyle = color;
        drawRoundedRect(0, 0, player.w, player.h, 6);

        ctx.fillStyle = 'rgba(255, 255, 255, 0.2)';
        drawRoundedRect(2, 2, player.w - 4, player.h / 2, 5);

        ctx.fillStyle = 'rgba(5, 5, 8, 0.8)';
        ctx.fillRect(6, 7, player.w - 12, player.h - 14);

        const roofW = 14;
        const roofH = 5;
        const roofX = (player.w - roofW) / 2;
        const roofY = -6;
        ctx.fillStyle = state.mode === 'auto' ? '#fafafa' : '#c9a962';
        ctx.fillRect(roofX, roofY, roofW, roofH);
        ctx.fillStyle = 'rgba(5, 5, 8, 0.8)';
        ctx.fillRect(roofX + 2, roofY + 1, roofW - 4, roofH - 2);

        ctx.strokeStyle = 'rgba(250, 250, 250, 0.45)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(4, player.h / 2);
        ctx.lineTo(player.w - 4, player.h / 2);
        ctx.stroke();
        ctx.restore();

        if (state.mode === 'auto') {
            ctx.save();
            ctx.fillStyle = 'rgba(250, 250, 250, 0.75)';
            ctx.font = '9px "Space Grotesk"';
            ctx.textAlign = 'center';
            ctx.fillText('AUTO', player.x, player.y - player.h / 2 - 8);
            ctx.restore();
        }
    };

    const drawMessage = () => {
        if (!state.message) return;
        ctx.fillStyle = 'rgba(5, 5, 8, 0.7)';
        ctx.fillRect(width / 2 - 120, height / 2 - 20, 240, 40);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(width / 2 - 120, height / 2 - 20, 240, 40);
        ctx.fillStyle = '#fafafa';
        ctx.font = '14px "DM Sans"';
        ctx.textAlign = 'center';
        ctx.fillText(state.message, width / 2, height / 2 + 5);
        ctx.textAlign = 'left';
    };

    const updateCars = (dt) => {
        cars.forEach((car) => {
            car.x += car.lane.speed * dt * car.lane.direction;
            if (car.lane.direction === 1 && car.x > width + 60) {
                car.x = -car.w - 60;
            }
            if (car.lane.direction === -1 && car.x < -car.w - 60) {
                car.x = width + 60;
            }
        });
    };

    // Simple AI - just express intent, let movement handle safety
    const getAutoInput = () => {
        const currentLane = getLaneIndex(player.y);
        const inTopZone = currentLane === -1;
        const inBottomZone = currentLane === laneCount;

        const goingDown = player.hasPassenger;
        const verticalDir = goingDown ? 1 : -1;

        // In pickup zone without passenger - go to passenger
        if (inTopZone && !player.hasPassenger) {
            const dx = getAlignedDx(passenger.x);
            const dy = player.y > passenger.y + 3 ? -1 : 0;
            return { dx, dy };
        }

        // In dropoff zone with passenger - complete dropoff
        if (inBottomZone && player.hasPassenger) {
            return { dx: 0, dy: 1 };
        }

        // Otherwise: move toward goal while aligning with target
        const targetX = goingDown ? player.x : passenger.x;
        const dx = getAlignedDx(targetX);
        return { dx, dy: verticalDir };
    };

    const updatePlayer = (dt) => {
        let dx = 0;
        let dy = 0;

        if (state.mode === 'auto') {
            const autoInput = getAutoInput();
            dx = autoInput.dx;
            dy = autoInput.dy;
        } else {
            if (keys['ArrowUp'] || keys['w']) dy -= 1;
            if (keys['ArrowDown'] || keys['s']) dy += 1;
            if (keys['ArrowLeft'] || keys['a']) dx -= 1;
            if (keys['ArrowRight'] || keys['d']) dx += 1;
        }

        if (dx === 0 && dy === 0) return;

        const length = Math.hypot(dx, dy) || 1;
        const speed = getAutoSpeed();
        const moveX = (dx / length) * speed * dt;
        const moveY = (dy / length) * speed * dt;

        let newX = clamp(player.x + moveX, player.w / 2, width - player.w / 2);
        let newY = clamp(player.y + moveY, player.h / 2, height - player.h / 2);

        // AUTO MODE: Hard block - never overlap a car
        if (state.mode === 'auto') {
            const buffer = 4;  // Keep small gap from cars

            // Try full move
            if (!wouldHitCar(newX, newY, buffer)) {
                player.x = newX;
                player.y = newY;
                return;
            }

            // Try vertical only
            if (dy !== 0 && !wouldHitCar(player.x, newY, buffer)) {
                player.y = newY;
                return;
            }

            // Try horizontal only
            if (dx !== 0 && !wouldHitCar(newX, player.y, buffer)) {
                player.x = newX;
                return;
            }

            // Blocked! Check if we're in danger (car approaching)
            if (isCarApproaching(0.25)) {
                // RETREAT - move backwards to safety
                const retreatDir = -dy || -1;  // Opposite of intended direction, default up
                const retreatY = player.y + retreatDir * speed * dt;

                if (!wouldHitCar(player.x, retreatY, buffer)) {
                    player.y = retreatY;
                    return;
                }

                // Can't retreat vertically - try sideways escape
                const escapeLeft = player.x - speed * dt;
                const escapeRight = player.x + speed * dt;

                if (escapeLeft > player.w / 2 && !wouldHitCar(escapeLeft, player.y, buffer)) {
                    player.x = escapeLeft;
                    return;
                }
                if (escapeRight < width - player.w / 2 && !wouldHitCar(escapeRight, player.y, buffer)) {
                    player.x = escapeRight;
                    return;
                }
            }

            // Not in immediate danger - just wait for gap
            return;
        }

        // Human mode - just move
        player.x = newX;
        player.y = newY;
    };

    const handleCollision = () => {
        // Collisions enabled for all modes - let's see if self-driving is truly perfect
        const rect = playerRect();
        const hit = cars.some((car) => rectsIntersect(rect, car));
        if (hit) {
            state.timeLeft = Math.max(0, state.timeLeft - 3);
            state.streak = 0;
            const hadPassenger = player.hasPassenger;
            player.hasPassenger = false;
            resetPlayer();
            if (hadPassenger) {
                spawnPassenger();
            }
            autoState.targetLane = null;
            autoState.targetX = player.x;
            autoState.planTimer = 0;
            autoState.lastX = player.x;
            autoState.lastY = player.y;
            autoState.stuckTime = 0;
            autoState.safeZoneCooldown = 0.5;
            state.message = 'Crash! -3s';
            state.messageTimer = 1.2;
        }
    };

    const handlePickupDropoff = () => {
        const rect = playerRect();
        if (!player.hasPassenger && passenger.active) {
            const dx = rect.x + rect.w / 2 - passenger.x;
            const dy = rect.y + rect.h / 2 - passenger.y;
            if (Math.hypot(dx, dy) < 24) {
                player.hasPassenger = true;
                passenger.active = false;
                state.message = 'Passenger onboard';
                state.messageTimer = 1.0;
            }
        }

        if (player.hasPassenger && rect.y + rect.h >= height - bottomZone + 10) {
            state.trips += 1;
            state.streak += 1;
            state.totalFare += fares.fare;
            state.totalFee += perTrip.fee;
            state.totalOpex += fares.varOpex;
            state.totalContrib += perTrip.contribution;
            player.hasPassenger = false;
            // Move player fully into bottom safe zone
            player.y = height - bottomZone / 2;
            autoState.targetLane = null;
            autoState.planTimer = 0;
            spawnPassenger();
            state.message = 'Trip complete';
            state.messageTimer = 1.0;
        }
    };

    const update = (dt) => {
        if (!state.running) return;
        state.timeLeft = Math.max(0, state.timeLeft - dt);

        updatePlayer(dt);
        updateCars(dt);
        handleCollision();
        handlePickupDropoff();

        if (state.messageTimer > 0) {
            state.messageTimer -= dt;
            if (state.messageTimer <= 0) {
                state.message = '';
            }
        }

        if (state.timeLeft <= 0) {
            state.running = false;
            setStatus('Run complete');
        }
    };

    const draw = () => {
        drawBackground();
        drawZones();
        drawLanes();
        drawCars();
        drawPassenger();
        drawPlayer();
        drawMessage();
    };

    let lastTime = performance.now();
    const loop = (timestamp) => {
        const dt = Math.min((timestamp - lastTime) / 1000, 0.033);
        lastTime = timestamp;
        update(dt);
        draw();
        updateUI();
        requestAnimationFrame(loop);
    };

    const resizeCanvas = () => {
        const ratio = window.devicePixelRatio || 1;
        canvas.width = width * ratio;
        canvas.height = height * ratio;
        canvas.style.width = '100%';
        canvas.style.height = 'auto';
        ctx.setTransform(ratio, 0, 0, ratio, 0, 0);
    };

    window.addEventListener('keydown', (e) => {
        keys[e.key] = true;
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        keys[e.key] = false;
    });

    if (ui.start) {
        ui.start.addEventListener('click', () => startGame(60));
    }

    if (ui.reset) {
        ui.reset.addEventListener('click', () => resetGame(state.sessionDuration));
    }

    if (ui.modeHuman) {
        ui.modeHuman.addEventListener('click', () => setMode('human'));
    }

    if (ui.modeAuto) {
        ui.modeAuto.addEventListener('click', () => setMode('auto'));
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    createLanes();
    setMode(state.mode, false);
    resetGame(60);
    requestAnimationFrame(loop);
})();
