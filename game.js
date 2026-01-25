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
        quick: document.getElementById('quickGame'),
        reset: document.getElementById('resetGame')
    };

    const state = {
        running: false,
        timeLeft: 300,
        sessionDuration: 300,
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
                    tint: j % 2 === 0 ? '#7ad3c4' : '#d8b46b'
                });
            }
        }
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

    const resetGame = (duration = 300) => {
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
        spawnPassenger();
        updateUI();
        setStatus('Ready to launch');
    };

    const startGame = (duration) => {
        resetGame(duration);
        state.running = true;
        setStatus('Running');
    };

    const setStatus = (text) => {
        if (ui.status) {
            ui.status.textContent = text;
        }
    };

    const rectsIntersect = (a, b) => {
        return (
            a.x < b.x + b.w &&
            a.x + a.w > b.x &&
            a.y < b.y + b.h &&
            a.y + a.h > b.y
        );
    };

    const playerRect = () => ({
        x: player.x - player.w / 2,
        y: player.y - player.h / 2,
        w: player.w,
        h: player.h
    });

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
        gradient.addColorStop(0, '#0b1220');
        gradient.addColorStop(0.6, '#0a101c');
        gradient.addColorStop(1, '#070b14');
        ctx.fillStyle = gradient;
        ctx.fillRect(0, 0, width, height);
    };

    const drawZones = () => {
        ctx.fillStyle = 'rgba(122, 211, 196, 0.12)';
        ctx.fillRect(0, 0, width, topZone);
        ctx.fillStyle = 'rgba(216, 180, 107, 0.12)';
        ctx.fillRect(0, height - bottomZone, width, bottomZone);

        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        ctx.lineWidth = 1;
        ctx.beginPath();
        ctx.moveTo(0, topZone);
        ctx.lineTo(width, topZone);
        ctx.moveTo(0, height - bottomZone);
        ctx.lineTo(width, height - bottomZone);
        ctx.stroke();

        ctx.fillStyle = 'rgba(248, 245, 240, 0.7)';
        ctx.font = '12px "DM Sans"';
        ctx.fillText('Pickup Zone', 16, 24);
        ctx.fillText('Dropoff Zone', 16, height - bottomZone + 24);
    };

    const drawLanes = () => {
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.08)';
        for (let i = 1; i < laneCount; i += 1) {
            const y = topZone + i * laneHeight;
            ctx.beginPath();
            ctx.setLineDash([12, 10]);
            ctx.moveTo(0, y);
            ctx.lineTo(width, y);
            ctx.stroke();
        }
        ctx.setLineDash([]);
    };

    const drawCars = () => {
        cars.forEach((car) => {
            ctx.fillStyle = car.tint;
            ctx.fillRect(car.x, car.y, car.w, car.h);
            ctx.fillStyle = 'rgba(7, 11, 20, 0.7)';
            ctx.fillRect(car.x + 6, car.y + 6, car.w - 12, car.h - 12);
        });
    };

    const drawPassenger = () => {
        if (!passenger.active) return;
        ctx.beginPath();
        ctx.fillStyle = '#f0d8a6';
        ctx.arc(passenger.x, passenger.y, passenger.r, 0, Math.PI * 2);
        ctx.fill();
        ctx.beginPath();
        ctx.fillStyle = '#0b1220';
        ctx.arc(passenger.x, passenger.y + 6, passenger.r - 4, 0, Math.PI * 2);
        ctx.fill();
    };

    const drawPlayer = () => {
        const color = player.hasPassenger ? '#d8b46b' : '#7ad3c4';
        ctx.fillStyle = color;
        ctx.fillRect(player.x - player.w / 2, player.y - player.h / 2, player.w, player.h);
        ctx.fillStyle = 'rgba(7, 11, 20, 0.8)';
        ctx.fillRect(player.x - player.w / 4, player.y - player.h / 4, player.w / 2, player.h / 2);
    };

    const drawMessage = () => {
        if (!state.message) return;
        ctx.fillStyle = 'rgba(7, 11, 20, 0.7)';
        ctx.fillRect(width / 2 - 120, height / 2 - 20, 240, 40);
        ctx.strokeStyle = 'rgba(255, 255, 255, 0.1)';
        ctx.strokeRect(width / 2 - 120, height / 2 - 20, 240, 40);
        ctx.fillStyle = '#f8f5f0';
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

    const updatePlayer = (dt) => {
        let dx = 0;
        let dy = 0;
        if (keys['ArrowUp'] || keys['w']) dy -= 1;
        if (keys['ArrowDown'] || keys['s']) dy += 1;
        if (keys['ArrowLeft'] || keys['a']) dx -= 1;
        if (keys['ArrowRight'] || keys['d']) dx += 1;

        const length = Math.hypot(dx, dy) || 1;
        player.x += (dx / length) * player.speed * dt;
        player.y += (dy / length) * player.speed * dt;

        player.x = clamp(player.x, player.w / 2, width - player.w / 2);
        player.y = clamp(player.y, player.h / 2, height - player.h / 2);
    };

    const handleCollision = () => {
        const rect = playerRect();
        const hit = cars.some((car) => rectsIntersect(rect, car));
        if (hit) {
            state.timeLeft = Math.max(0, state.timeLeft - 3);
            state.streak = 0;
            player.hasPassenger = false;
            resetPlayer();
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
        ui.start.addEventListener('click', () => startGame(300));
    }

    if (ui.quick) {
        ui.quick.addEventListener('click', () => startGame(60));
    }

    if (ui.reset) {
        ui.reset.addEventListener('click', () => resetGame(state.sessionDuration));
    }

    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    createLanes();
    resetGame(300);
    requestAnimationFrame(loop);
})();
