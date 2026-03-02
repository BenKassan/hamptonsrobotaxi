(() => {
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    const W = 900, H = 540;

    const mapImg = new Image();
    mapImg.src = 'hamptons_map.png';
    let mapReady = false;
    mapImg.onload = () => { mapReady = true; };

    // === ROAD NETWORK ===
    // Road graph re-traced to match the current Hamptons map render at 900x540.
    const N = [
        // Main highway (0-13): Southampton -> Montauk
        [0, 430], [90, 429], [180, 428], [270, 428], [333, 426], [365, 410],
        [407, 385], [472, 352], [542, 320], [607, 290], [670, 261], [731, 234],
        [780, 212], [818, 196],
        // Sag Harbor branch (14-20): from highway junction north to Sag Harbor
        [360, 385], [375, 350], [386, 309], [391, 262], [390, 213], [385, 165], [370, 104],
        // Reserved nodes (21-27): intentionally unused in active graph
        [320, 140], [286, 170], [252, 205], [216, 236], [184, 260], [186, 305], [194, 372],
        // Ditch Plains spur (28-31): east of Montauk
        [832, 206], [848, 214], [869, 196], [886, 165]
    ];

    const townMap = {
        1:'Southampton', 5:'Bridgehampton', 8:'East Hampton',
        11:'Amagansett', 13:'Montauk', 30:'Ditch Plains', 20:'Sag Harbor'
    };
    const townNodes = [1, 5, 8, 11, 13, 30, 20];

    // Build edges
    const E = [];
    for (let i = 0; i < 13; i++) E.push([i, i + 1]);        // highway (13 edges)
    E.push([5, 14]);                                         // junction to Sag Harbor road
    for (let i = 14; i < 20; i++) E.push([i, i + 1]);       // Sag Harbor (6 edges)
    E.push([13, 28]);                                        // Montauk to Ditch Plains
    for (let i = 28; i < 31; i++) E.push([i, i + 1]);       // Ditch Plains (3 edges)

    // Adjacency
    const adj = N.map(() => []);
    E.forEach((e, i) => {
        adj[e[0]].push({ edge: i, nb: e[1] });
        adj[e[1]].push({ edge: i, nb: e[0] });
    });

    function eLen(i) {
        const a = N[E[i][0]], b = N[E[i][1]];
        return Math.hypot(b[0] - a[0], b[1] - a[1]);
    }
    function ePos(i, t) {
        const a = N[E[i][0]], b = N[E[i][1]];
        return [a[0] + (b[0] - a[0]) * t, a[1] + (b[1] - a[1]) * t];
    }
    function eAngle(i) {
        const a = N[E[i][0]], b = N[E[i][1]];
        return Math.atan2(b[1] - a[1], b[0] - a[0]);
    }

    // Two-lane offset
    const LANE_W = 3;
    function lanePos(edgeIdx, t, lane) {
        const [cx, cy] = ePos(edgeIdx, t);
        const ang = eAngle(edgeIdx);
        return [cx - Math.sin(ang) * lane * LANE_W, cy + Math.cos(ang) * lane * LANE_W];
    }

    const INF = 1e9;

    function pathLen(path) {
        if (!path) return INF;
        let d = 0;
        for (const s of path) d += eLen(s.edge);
        return d;
    }

    // Dijkstra on the road graph; returns [{edge,node}, ...] from start->end.
    function shortestPath(start, end, edgePenaltyFn) {
        if (start === end) return [];
        const dist = N.map(() => INF);
        const used = N.map(() => false);
        const prev = N.map(() => null);
        dist[start] = 0;
        for (let iter = 0; iter < N.length; iter++) {
            let u = -1;
            let best = INF;
            for (let i = 0; i < N.length; i++) {
                if (!used[i] && dist[i] < best) {
                    best = dist[i];
                    u = i;
                }
            }
            if (u < 0 || u === end) break;
            used[u] = true;
            for (const { edge, nb } of adj[u]) {
                if (used[nb]) continue;
                const penalty = edgePenaltyFn ? edgePenaltyFn(edge, u, nb) : 0;
                const nd = dist[u] + eLen(edge) + penalty;
                if (nd < dist[nb]) {
                    dist[nb] = nd;
                    prev[nb] = { node: u, edge };
                }
            }
        }
        if (!Number.isFinite(dist[end]) || dist[end] >= INF) return null;
        const out = [];
        let cur = end;
        while (cur !== start) {
            const p = prev[cur];
            if (!p) return null;
            out.push({ edge: p.edge, node: cur });
            cur = p.node;
        }
        out.reverse();
        return out;
    }

    function chooseRouteFromEdge(edgeIdx, t, target, edgePenaltyFn) {
        if (target < 0) return null;
        const e = E[edgeIdx];
        const toStart = shortestPath(e[0], target, edgePenaltyFn);
        const toEnd = shortestPath(e[1], target, edgePenaltyFn);
        const dStart = t * eLen(edgeIdx) + pathLen(toStart);
        const dEnd = (1 - t) * eLen(edgeIdx) + pathLen(toEnd);
        if (!toStart && !toEnd) return null;
        if (!toEnd || dStart <= dEnd) return { dir: -1, path: toStart || [], dist: dStart };
        return { dir: 1, path: toEnd || [], dist: dEnd };
    }

    // === ECONOMICS ===
    const FARE = 30, FEE_RATE = 0.275, VAR_OPEX = 16.59;
    const PER_FEE = FARE * FEE_RATE;
    const PER_CONTRIB = FARE - PER_FEE - VAR_OPEX;
    const BASE_TPD = 13.5, BASE_MC = 2091;

    // === UI ===
    const $ = id => document.getElementById(id);
    const ui = {
        time: $('timeLeft'), trips: $('tripCount'), streak: $('tripStreak'),
        fare: $('fareTotal'), fee: $('feeTotal'), opex: $('opexTotal'),
        contrib: $('contribTotal'), pace: $('paceTrips'), rate: $('runRate'),
        status: $('gameStatus'), start: $('startGame'), reset: $('resetGame'),
        mHuman: $('modeHuman'), mAuto: $('modeAuto')
    };

    // === STATE ===
    const st = {
        on: false, mode: 'human', tLeft: 60, dur: 60,
        trips: 0, streak: 0, tFare: 0, tFee: 0, tOpex: 0, tContrib: 0,
        msg: '', msgT: 0
    };
    const keys = {};

    // === PLAYER ===
    const pl = {
        edge: 2, t: 0.5, dir: 1, spd: 150,
        hasPax: false, x: 0, y: 0, angle: 0, invincible: 0
    };
    function syncPl() {
        const p = lanePos(pl.edge, pl.t, 1);
        pl.x = p[0]; pl.y = p[1];
        pl.angle = eAngle(pl.edge) + (pl.dir === -1 ? Math.PI : 0);
    }

    // === TRAFFIC ===
    const traffic = [];
    const TRAF_N = 1;
    const TCOL = ['#8b7355','#6b7b8d','#a0522d','#556b2f'];

    function spawnTraffic() {
        traffic.length = 0;
        for (let i = 0; i < TRAF_N; i++) {
            let ei;
            do { ei = Math.floor(Math.random() * E.length); } while (ei < 4);
            const c = {
                edge: ei, t: Math.random(),
                dir: Math.random() < 0.5 ? 1 : -1,
                lane: -1, spd: 40 + Math.random() * 35,
                color: TCOL[i % TCOL.length],
                x: 0, y: 0, angle: 0
            };
            syncCar(c); traffic.push(c);
        }
    }
    function syncCar(c) {
        const p = lanePos(c.edge, c.t, c.lane);
        c.x = p[0]; c.y = p[1];
        c.angle = eAngle(c.edge) + (c.dir === -1 ? Math.PI : 0);
    }

    // === PASSENGER ===
    const pax = { ni: -1, x: 0, y: 0, on: false };
    let pName = '', dName = '', dNode = -1;

    function spawnPax() {
        const avail = townNodes.filter(i => i !== dNode);
        const pi = avail[Math.floor(Math.random() * avail.length)];
        pax.ni = pi; pax.x = N[pi][0]; pax.y = N[pi][1]; pax.on = true;
        pName = townMap[pi];
        const dOpts = townNodes.filter(i => i !== pi);
        dNode = dOpts[Math.floor(Math.random() * dOpts.length)];
        dName = townMap[dNode];
    }

    // === TRAFFIC DETECTION ===
    function edgeGapMeters(edgeIdx, tA, tB) {
        return Math.abs(tA - tB) * eLen(edgeIdx);
    }

    function trafficConflict(edgeIdx, myT, myDir, frontRange, oncomingRange) {
        for (const c of traffic) {
            if (c.edge !== edgeIdx) continue;
            const gap = edgeGapMeters(edgeIdx, myT, c.t);
            if (gap < 8) return true;
            if (c.dir === myDir) {
                const ahead = (c.t - myT) * myDir;
                if (ahead > 0 && gap < frontRange) return true;
            } else if (gap < oncomingRange) {
                return true;
            }
        }
        return false;
    }

    function playerConflict(car, frontRange, oncomingRange) {
        if (pl.edge !== car.edge) return false;
        const gap = edgeGapMeters(car.edge, pl.t, car.t);
        if (pl.dir === car.dir) {
            const ahead = (pl.t - car.t) * car.dir;
            return ahead > 0 && gap < frontRange;
        }
        return gap < oncomingRange;
    }

    // === AUTO-PILOT ===
    function autoEdgePenalty(edgeIdx) {
        let p = 0;
        for (const c of traffic) {
            if (c.edge !== edgeIdx) continue;
            p += c.dir === pl.dir ? 45 : 90;
        }
        return p;
    }

    function getAutoDir() {
        const target = pl.hasPax ? dNode : pax.ni;
        if (target < 0) return pl.dir;
        const route = chooseRouteFromEdge(pl.edge, pl.t, target, (edgeIdx) => autoEdgePenalty(edgeIdx));
        if (!route) return 0;
        const wantDir = route.dir;
        if (trafficConflict(pl.edge, pl.t, wantDir, 90, 65)) {
            const e = E[pl.edge];
            const backDist = wantDir === 1 ? pl.t * eLen(pl.edge) : (1 - pl.t) * eLen(pl.edge);
            const backNode = wantDir === 1 ? e[0] : e[1];
            if (backDist < 80 && adj[backNode].length > 1) return -wantDir;
            return 0;
        }
        return wantDir;
    }

    function autoPickEdge(curEdge, jNode) {
        const target = pl.hasPax ? dNode : pax.ni;
        const conns = adj[jNode].filter(c => c.edge !== curEdge);
        if (conns.length <= 1) return conns[0] || null;
        if (target < 0) return conns[0];
        let best = conns[0], bestScore = INF;
        for (const c of conns) {
            if (c.nb === target) return c;
            const p = shortestPath(c.nb, target, (edgeIdx) => autoEdgePenalty(edgeIdx));
            let score = pathLen(p) + eLen(c.edge);
            if (traffic.some(t => t.edge === c.edge)) score += 70;
            if (score < bestScore) { bestScore = score; best = c; }
        }
        return best;
    }

    // === MOVEMENT ===
    function movePlayer(dt) {
        if (st.mode === 'auto') {
            const dir = getAutoDir();
            if (dir !== 0) advance(pl, dt, dir, true);
        } else {
            let dx = 0, dy = 0;
            if (keys['ArrowUp'] || keys['w'] || keys['W']) dy -= 1;
            if (keys['ArrowDown'] || keys['s'] || keys['S']) dy += 1;
            if (keys['ArrowLeft'] || keys['a'] || keys['A']) dx -= 1;
            if (keys['ArrowRight'] || keys['d'] || keys['D']) dx += 1;
            if (!dx && !dy) return;
            const len = Math.hypot(dx, dy);
            const inVec = { dx: dx / len, dy: dy / len };
            const ang = eAngle(pl.edge);
            const dot = inVec.dx * Math.cos(ang) + inVec.dy * Math.sin(ang);
            const dir = dot > 0.05 ? 1 : dot < -0.05 ? -1 : 0;
            if (!dir) return;
            advance(pl, dt, dir, false, inVec);
        }
        syncPl();
    }

    function advance(ent, dt, dir, isAuto, inVec) {
        const len = eLen(ent.edge);
        if (len < 1) return;
        ent.dir = dir;
        let nt = ent.t + dir * (ent.spd / len) * dt;
        if (nt > 1) {
            const over = (nt - 1) * len;
            const jn = E[ent.edge][1];
            const next = isAuto ? autoPickEdge(ent.edge, jn) : humanPickEdge(ent.edge, jn, inVec);
            if (next) enterEdge(ent, next.edge, jn, over); else ent.t = 1;
        } else if (nt < 0) {
            const over = -nt * len;
            const jn = E[ent.edge][0];
            const next = isAuto ? autoPickEdge(ent.edge, jn) : humanPickEdge(ent.edge, jn, inVec);
            if (next) enterEdge(ent, next.edge, jn, over); else ent.t = 0;
        } else { ent.t = nt; }
    }

    function enterEdge(ent, edgeIdx, fromNode, overshoot) {
        ent.edge = edgeIdx;
        const nl = eLen(edgeIdx);
        if (E[edgeIdx][0] === fromNode) {
            ent.t = Math.min(overshoot / nl, 0.99); ent.dir = 1;
        } else {
            ent.t = Math.max(1 - overshoot / nl, 0.01); ent.dir = -1;
        }
    }

    function humanPickEdge(curEdge, jNode, inVec) {
        const conns = adj[jNode].filter(c => c.edge !== curEdge);
        if (conns.length <= 1) return conns[0] || null;
        if (!inVec) return conns[0];
        let best = null, bestDot = -Infinity;
        for (const c of conns) {
            const dx = N[c.nb][0] - N[jNode][0], dy = N[c.nb][1] - N[jNode][1];
            const l = Math.hypot(dx, dy) || 1;
            const d = inVec.dx * dx / l + inVec.dy * dy / l;
            if (d > bestDot) { bestDot = d; best = c; }
        }
        return best || conns[0];
    }

    // === TRAFFIC UPDATE ===
    function updateTraffic(dt) {
        for (const c of traffic) {
            const len = eLen(c.edge);
            if (len < 1) continue;
            let spd = c.spd;
            if (playerConflict(c, 35, 48)) spd = 0;
            else if (playerConflict(c, 65, 80)) spd *= 0.35;
            c.t += c.dir * (spd / len) * dt;
            if (c.t > 1 || c.t < 0) {
                const atEnd = c.t > 1;
                const jn = E[c.edge][atEnd ? 1 : 0];
                const conns = adj[jn].filter(cn => cn.edge !== c.edge);
                if (!conns.length) { c.dir = -c.dir; c.t = atEnd ? 1 : 0; }
                else {
                    const safe = conns.filter(cn => cn.edge !== pl.edge && !trafficConflict(cn.edge, 0.5, 1, 40, 40));
                    const pick = (safe.length ? safe : conns)[Math.floor(Math.random() * (safe.length || conns.length))];
                    c.edge = pick.edge;
                    if (E[pick.edge][0] === jn) { c.t = 0.01; c.dir = 1; }
                    else { c.t = 0.99; c.dir = -1; }
                }
            }
            syncCar(c);
        }
    }

    // === COLLISION ===
    function checkCollision() {
        if (pl.invincible > 0) return;
        for (const c of traffic) {
            const dist = Math.hypot(pl.x - c.x, pl.y - c.y);
            const sameEdgeOpposing = c.edge === pl.edge && c.dir !== pl.dir;
            const hitRadius = sameEdgeOpposing ? 5 : 7;
            if (dist < hitRadius) {
                st.tLeft = Math.max(0, st.tLeft - 3);
                st.streak = 0;
                const had = pl.hasPax;
                pl.hasPax = false;
                pl.edge = 2; pl.t = 0.5; pl.dir = 1;
                pl.invincible = 2.0;
                syncPl();
                if (had) spawnPax();
                st.msg = 'Crash! -3s'; st.msgT = 1.2;
                return;
            }
        }
    }

    function checkPaxPickup() {
        if (!pl.hasPax && pax.on && Math.hypot(pl.x - pax.x, pl.y - pax.y) < 30) {
            pl.hasPax = true; pax.on = false;
            st.msg = 'Pickup: ' + pName; st.msgT = 1.0;
        }
        if (pl.hasPax && dNode >= 0) {
            if (Math.hypot(pl.x - N[dNode][0], pl.y - N[dNode][1]) < 30) {
                st.trips++; st.streak++;
                st.tFare += FARE; st.tFee += PER_FEE;
                st.tOpex += VAR_OPEX; st.tContrib += PER_CONTRIB;
                pl.hasPax = false;
                st.msg = 'Dropoff: ' + dName + ' +$30'; st.msgT = 1.0;
                spawnPax();
            }
        }
    }

    // === DRAWING ===
    function rr(x, y, w, h, r) {
        ctx.beginPath();
        ctx.moveTo(x + r, y); ctx.lineTo(x + w - r, y);
        ctx.quadraticCurveTo(x + w, y, x + w, y + r);
        ctx.lineTo(x + w, y + h - r);
        ctx.quadraticCurveTo(x + w, y + h, x + w - r, y + h);
        ctx.lineTo(x + r, y + h);
        ctx.quadraticCurveTo(x, y + h, x, y + h - r);
        ctx.lineTo(x, y + r);
        ctx.quadraticCurveTo(x, y, x + r, y);
        ctx.closePath();
    }

    function drawCar(x, y, angle, w, h, color, isP) {
        ctx.save();
        ctx.translate(x, y); ctx.rotate(angle);
        ctx.fillStyle = 'rgba(0,0,0,0.25)';
        ctx.beginPath(); ctx.ellipse(0, 1, w / 2 + 1, h / 2 + 1, 0, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = color; rr(-w / 2, -h / 2, w, h, 2); ctx.fill();
        ctx.fillStyle = 'rgba(255,255,255,0.15)'; rr(-w / 2 + 1, -h / 2 + 1, w - 2, h / 2, 1); ctx.fill();
        ctx.fillStyle = 'rgba(5,5,8,0.4)'; ctx.fillRect(-w / 2 + 2, -h / 2 + 1, w - 4, h - 2);
        ctx.fillStyle = 'rgba(255,240,200,0.8)'; ctx.fillRect(w / 2 - 1, -1, 1, 2);
        ctx.fillStyle = 'rgba(248,104,104,0.8)'; ctx.fillRect(-w / 2, -1, 1, 2);
        if (isP) {
            const bc = st.mode === 'auto' ? '#5eb8a8' : '#c9a962';
            ctx.fillStyle = bc; ctx.fillRect(-4, -h / 2 - 2, 8, 1);
            if (st.mode === 'auto') {
                ctx.shadowColor = '#5eb8a8'; ctx.shadowBlur = 4;
                ctx.fillRect(-4, -h / 2 - 2, 8, 1); ctx.shadowBlur = 0;
            }
        }
        ctx.restore();
        if (isP) {
            ctx.save(); ctx.textAlign = 'center';
            if (st.mode === 'auto') {
                ctx.fillStyle = 'rgba(94,184,168,0.8)'; ctx.font = '6px "Space Grotesk"';
                ctx.fillText('CYBERCAB', x, y - 10);
            }
            if (pl.hasPax) {
                ctx.fillStyle = 'rgba(201,169,98,0.9)'; ctx.font = '6px "Space Grotesk"';
                ctx.fillText('PASSENGER', x, y + 12);
            }
            ctx.restore();
        }
    }

    // Subtle road overlay
    function drawRoads() {
        ctx.save();
        ctx.lineCap = 'round'; ctx.lineJoin = 'round';
        // Thin road glow
        ctx.strokeStyle = 'rgba(201, 169, 98, 0.06)';
        ctx.lineWidth = 10;
        E.forEach(e => {
            ctx.beginPath(); ctx.moveTo(N[e[0]][0], N[e[0]][1]);
            ctx.lineTo(N[e[1]][0], N[e[1]][1]); ctx.stroke();
        });
        // Center lane divider (dashed)
        ctx.strokeStyle = 'rgba(201, 169, 98, 0.12)';
        ctx.lineWidth = 1;
        ctx.setLineDash([4, 8]);
        E.forEach(e => {
            ctx.beginPath(); ctx.moveTo(N[e[0]][0], N[e[0]][1]);
            ctx.lineTo(N[e[1]][0], N[e[1]][1]); ctx.stroke();
        });
        ctx.setLineDash([]);
        // Town dots
        ctx.fillStyle = 'rgba(201, 169, 98, 0.12)';
        townNodes.forEach(ni => {
            ctx.beginPath(); ctx.arc(N[ni][0], N[ni][1], 3, 0, Math.PI * 2); ctx.fill();
        });
        ctx.restore();
    }

    function drawRoute() {
        if (!st.on) return;
        const target = pl.hasPax ? dNode : (pax.on ? pax.ni : -1);
        if (target < 0) return;
        const route = chooseRouteFromEdge(pl.edge, pl.t, target);
        if (!route) return;
        ctx.save(); ctx.setLineDash([4, 6]);
        ctx.strokeStyle = 'rgba(201,169,98,0.28)'; ctx.lineWidth = 1.5;
        ctx.beginPath();
        ctx.moveTo(pl.x, pl.y);
        const edgeExit = route.dir === 1 ? 1 : 0;
        const exitPos = lanePos(pl.edge, edgeExit, 1);
        ctx.lineTo(exitPos[0], exitPos[1]);
        for (const step of route.path) {
            const p = N[step.node];
            ctx.lineTo(p[0], p[1]);
        }
        ctx.stroke();
        ctx.restore();
    }

    function drawPax() {
        if (!pax.on) return;
        const p = (Math.sin(performance.now() / 180) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.4; ctx.strokeStyle = 'rgba(201,169,98,0.5)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(pax.x, pax.y, 10 + p * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1;
        ctx.fillStyle = '#e4d4a8';
        ctx.beginPath(); ctx.arc(pax.x, pax.y, 6, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#0a1628';
        ctx.beginPath(); ctx.arc(pax.x, pax.y + 2, 3, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(201,169,98,0.9)'; ctx.font = '9px "Space Grotesk"';
        ctx.textAlign = 'center';
        ctx.fillText('PICKUP: ' + pName.toUpperCase(), pax.x, pax.y - 14);
        ctx.restore();
    }

    function drawDropoff() {
        if (!pl.hasPax || dNode < 0) return;
        const nx = N[dNode][0], ny = N[dNode][1];
        const p = (Math.sin(performance.now() / 220) + 1) / 2;
        ctx.save();
        ctx.globalAlpha = 0.5; ctx.strokeStyle = 'rgba(94,184,168,0.6)'; ctx.lineWidth = 2;
        ctx.beginPath(); ctx.arc(nx, ny, 10 + p * 5, 0, Math.PI * 2); ctx.stroke();
        ctx.globalAlpha = 1; ctx.fillStyle = '#5eb8a8';
        ctx.beginPath(); ctx.arc(nx, ny, 5, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = 'rgba(94,184,168,0.9)'; ctx.font = '9px "Space Grotesk"';
        ctx.textAlign = 'center';
        ctx.fillText('DROPOFF: ' + dName.toUpperCase(), nx, ny - 14);
        ctx.restore();
    }

    function drawMsg() {
        if (!st.msg) return;
        ctx.save(); ctx.font = '13px "DM Sans"';
        const mw = Math.max(220, ctx.measureText(st.msg).width + 36);
        ctx.fillStyle = 'rgba(5,5,8,0.75)'; rr(W / 2 - mw / 2, H / 2 - 18, mw, 36, 8); ctx.fill();
        ctx.strokeStyle = 'rgba(201,169,98,0.2)'; ctx.lineWidth = 1; ctx.stroke();
        ctx.fillStyle = '#fafafa'; ctx.textAlign = 'center';
        ctx.fillText(st.msg, W / 2, H / 2 + 4);
        ctx.restore();
    }

    function drawOverlay() {
        if (st.on || st.tLeft <= 0) return;
        ctx.save(); ctx.fillStyle = 'rgba(5,5,8,0.4)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#fafafa'; ctx.font = '18px "Space Grotesk"'; ctx.textAlign = 'center';
        ctx.fillText('Press Start to begin', W / 2, H / 2 - 10);
        ctx.fillStyle = 'rgba(201,169,98,0.7)'; ctx.font = '12px "DM Sans"';
        ctx.fillText('Use WASD or arrow keys to drive along the roads', W / 2, H / 2 + 15);
        ctx.restore();
    }

    function drawGameOver() {
        if (st.on || st.tLeft > 0) return;
        ctx.save(); ctx.fillStyle = 'rgba(5,5,8,0.6)'; ctx.fillRect(0, 0, W, H);
        ctx.fillStyle = '#c9a962'; ctx.font = '22px "Space Grotesk"'; ctx.textAlign = 'center';
        ctx.fillText('Run Complete', W / 2, H / 2 - 20);
        ctx.fillStyle = '#fafafa'; ctx.font = '14px "DM Sans"';
        ctx.fillText(st.trips + ' trips  |  ' + fmtM(st.tContrib) + ' contribution', W / 2, H / 2 + 10);
        ctx.fillStyle = 'rgba(255,255,255,0.5)'; ctx.font = '11px "DM Sans"';
        ctx.fillText('Press Reset to try again', W / 2, H / 2 + 35);
        ctx.restore();
    }

    // === HELPERS ===
    const fmtM = v => '$' + (Math.round(v * 100) / 100).toLocaleString('en-US', {
        minimumFractionDigits: 0, maximumFractionDigits: 2
    });

    function setStatus(t) {
        if (ui.status) ui.status.textContent = t + ' - ' + (st.mode === 'auto' ? 'Self-Driving' : 'Human');
    }

    function updateUI() {
        if (!ui.time) return;
        const m = Math.floor(st.tLeft / 60), s = Math.floor(st.tLeft % 60);
        ui.time.textContent = String(m).padStart(2, '0') + ':' + String(s).padStart(2, '0');
        ui.trips.textContent = st.trips;
        ui.streak.textContent = st.streak;
        ui.fare.textContent = fmtM(st.tFare);
        ui.fee.textContent = fmtM(st.tFee);
        ui.opex.textContent = fmtM(st.tOpex);
        ui.contrib.textContent = fmtM(st.tContrib);
        const pace = st.trips * (300 / st.dur);
        ui.pace.textContent = pace.toFixed(1);
        ui.rate.textContent = fmtM((pace / BASE_TPD) * BASE_MC);
    }

    function setMode(mode, silent) {
        st.mode = mode;
        if (ui.mHuman) ui.mHuman.classList.toggle('active', mode === 'human');
        if (ui.mAuto) ui.mAuto.classList.toggle('active', mode === 'auto');
        setStatus(st.on ? 'Running' : 'Ready to launch');
        if (!silent) { st.msg = mode === 'auto' ? 'Autopilot engaged' : 'Human control'; st.msgT = 1.0; }
    }

    function resetGame(dur) {
        dur = dur || 60;
        st.on = false; st.dur = dur; st.tLeft = dur;
        st.trips = 0; st.streak = 0;
        st.tFare = 0; st.tFee = 0; st.tOpex = 0; st.tContrib = 0;
        st.msg = ''; st.msgT = 0;
        pl.edge = 2; pl.t = 0.5; pl.dir = 1; pl.hasPax = false; pl.invincible = 0;
        syncPl(); spawnTraffic(); spawnPax(); updateUI();
        setStatus('Ready to launch');
    }

    function startGame(dur) { resetGame(dur); st.on = true; setStatus('Running'); }

    // === MAIN LOOP ===
    function update(dt) {
        if (!st.on) return;
        st.tLeft = Math.max(0, st.tLeft - dt);
        if (pl.invincible > 0) pl.invincible = Math.max(0, pl.invincible - dt);
        movePlayer(dt); updateTraffic(dt);
        checkCollision(); checkPaxPickup();
        if (st.msgT > 0) { st.msgT -= dt; if (st.msgT <= 0) st.msg = ''; }
        if (st.tLeft <= 0) { st.on = false; setStatus('Run complete'); }
    }

    function draw() {
        if (mapReady) ctx.drawImage(mapImg, 0, 0, W, H);
        else { ctx.fillStyle = '#0a1218'; ctx.fillRect(0, 0, W, H); }
        drawRoads();
        drawRoute();
        traffic.forEach(c => drawCar(c.x, c.y, c.angle, 12, 6, c.color, false));
        drawPax(); drawDropoff();
        const show = pl.invincible <= 0 || Math.floor(pl.invincible * 8) % 2 === 0;
        if (show) drawCar(pl.x, pl.y, pl.angle, 14, 7, pl.hasPax ? '#c9a962' : '#e0e0e0', true);
        drawMsg(); drawOverlay(); drawGameOver();
    }

    let lastT = performance.now();
    function loop(ts) {
        const dt = Math.min((ts - lastT) / 1000, 0.033);
        lastT = ts;
        update(dt); draw(); updateUI();
        requestAnimationFrame(loop);
    }

    // === INIT ===
    function resize() {
        const r = window.devicePixelRatio || 1;
        canvas.width = W * r; canvas.height = H * r;
        canvas.style.width = '100%'; canvas.style.height = 'auto';
        ctx.setTransform(r, 0, 0, r, 0, 0);
    }

    window.addEventListener('keydown', e => {
        keys[e.key] = true;
        if (e.key.startsWith('Arrow')) e.preventDefault();
    });
    window.addEventListener('keyup', e => { keys[e.key] = false; });

    if (ui.start) ui.start.addEventListener('click', () => startGame(60));
    if (ui.reset) ui.reset.addEventListener('click', () => resetGame(st.dur));
    if (ui.mHuman) ui.mHuman.addEventListener('click', () => setMode('human'));
    if (ui.mAuto) ui.mAuto.addEventListener('click', () => setMode('auto'));

    resize();
    window.addEventListener('resize', resize);
    setMode('human', true);
    resetGame(60);
    requestAnimationFrame(loop);
})();
