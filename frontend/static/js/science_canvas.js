document.addEventListener('DOMContentLoaded', () => {
    const canvas = document.getElementById('spaceCanvas');
    const ctx = canvas.getContext('2d');
    const TWO_PI = Math.PI * 2;
    const rand = (min, max) => min + Math.random() * (max - min);

    // UI Elements
    const gravityRange = document.getElementById('gravityRange');
    const gravityVal = document.getElementById('gravityVal');
    const speedRange = document.getElementById('speedRange');
    const speedVal = document.getElementById('speedVal');
    const addPlanetBtn = document.getElementById('addPlanetBtn');
    const addCometBtn = document.getElementById('addCometBtn');
    const pauseBtn = document.getElementById('pauseBtn');
    const resetBtn = document.getElementById('resetBtn');

    // Parámetros de Simulación
    let G = parseFloat(gravityRange.value);
    let timeStep = parseFloat(speedRange.value);
    let isPaused = false;
    let animationFrameId = null;

    // Estrella Central (Sol)
    const sun = {
        x: canvas.width / 2,
        y: canvas.height / 2,
        mass: 5000,
        radius: 28
    };

    let bodies = [];

    // ---------------------------------------------------------
    // CATÁLOGO DE PLANETAS
    // rocky = superficie con continentes/cráteres | gas = bandas
    // atmosphere = color RGB del halo atmosférico (null = sin atmósfera)
    // ---------------------------------------------------------
    const PLANET_TYPES = [
        { name: 'Tierra', kind: 'rocky', base: '#2a6fdb', atmosphere: '100,170,255', spotCount: 18,
          spots: ['#2f9e44', '#3d8b37', '#5a9b45', 'rgba(255,255,255,0.6)'] },
        { name: 'Marte', kind: 'rocky', base: '#c1440e', atmosphere: '255,150,110', spotCount: 14,
          spots: ['#8c2f0a', '#e07a4a', 'rgba(255,255,255,0.5)'] },
        { name: 'Venus', kind: 'rocky', base: '#e8c07a', atmosphere: '255,220,150', spotCount: 14,
          spots: ['#f3d9a4', '#c99a4e'] },
        { name: 'Mercurio', kind: 'rocky', base: '#9a9a9a', atmosphere: null, spotCount: 20,
          spots: ['#6e6e6e', '#bdbdbd', '#5a5a5a'] },
        { name: 'Júpiter', kind: 'gas', atmosphere: '230,190,140',
          bands: ['#c99b6d', '#e8d0a8', '#a9744f', '#dcc29a', '#b5835a'] },
        { name: 'Saturno', kind: 'gas', ring: true, atmosphere: '240,215,160',
          bands: ['#e3cf9f', '#d1b57e', '#efe0b8', '#c9ab72'] },
        { name: 'Neptuno', kind: 'gas', atmosphere: '90,130,255',
          bands: ['#2b4fd8', '#3f6bff', '#2440b8', '#4d7bff'] }
    ];

    const getType = (name) => PLANET_TYPES.find(p => p.name === name);

    // Genera "manchas" con longitud/latitud para simular rotación
    function makeSpots(colors, count) {
        return Array.from({ length: count }, () => ({
            lon: rand(0, TWO_PI),
            lat: rand(-1.1, 1.1),
            size: rand(0.1, 0.32),
            color: colors[Math.floor(Math.random() * colors.length)]
        }));
    }

    function createBody(type, x, y, vx, vy, radius, mass) {
        return {
            ...type,
            x, y, vx, vy, radius, mass,
            trail: [],
            trailColor: `rgb(${type.atmosphere || '190,190,190'})`,
            spin: rand(0, TWO_PI),
            spinSpeed: rand(0.3, 1),
            tilt: rand(-0.4, 0.4),
            surface: type.kind === 'rocky' ? makeSpots(type.spots, type.spotCount) : null
        };
    }

    function createComet() {
        return {
            kind: 'comet', name: 'Cometa',
            x: 30, y: 30, vx: 4.2, vy: 1.5,
            mass: 2, radius: 4,
            trail: [], trailColor: 'rgb(190,225,255)',
            spin: 0, spinSpeed: 0
        };
    }

    function initDefaultBodies() {
        bodies = [
            createBody(getType('Tierra'), sun.x, sun.y - 120, 3.8, 0, 8, 10),
            createBody(getType('Saturno'), sun.x, sun.y - 200, 2.9, 0, 13, 25)
        ];
    }

    // ---------------------------------------------------------
    // FONDO ESTELAR
    // ---------------------------------------------------------
    const stars = Array.from({ length: 220 }, () => ({
        x: rand(0, canvas.width),
        y: rand(0, canvas.height),
        size: rand(0.3, 1.7),
        phase: rand(0, TWO_PI),
        speed: rand(0.5, 2.5)
    }));

    function drawBackground(t) {
        const bg = ctx.createRadialGradient(
            canvas.width / 2, canvas.height / 2, 50,
            canvas.width / 2, canvas.height / 2, canvas.width * 0.7
        );
        bg.addColorStop(0, '#0b1030');
        bg.addColorStop(1, '#02030a');
        ctx.fillStyle = bg;
        ctx.fillRect(0, 0, canvas.width, canvas.height);

        ctx.fillStyle = '#ffffff';
        stars.forEach(s => {
            ctx.globalAlpha = 0.35 + 0.65 * Math.abs(Math.sin(t * s.speed + s.phase));
            ctx.beginPath();
            ctx.arc(s.x, s.y, s.size, 0, TWO_PI);
            ctx.fill();
        });
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------
    // SUPERFICIE: manchas proyectadas sobre una esfera que rota
    // ---------------------------------------------------------
    function drawSpots(x, y, r, spots, spin) {
        spots.forEach(s => {
            const lon = s.lon + spin;
            const depth = Math.cos(lon);          // > 0 = cara visible
            if (depth <= 0) return;

            const px = x + r * Math.cos(s.lat) * Math.sin(lon);
            const py = y + r * Math.sin(s.lat);

            ctx.beginPath();
            ctx.ellipse(px, py, s.size * r * depth, s.size * r, 0, 0, TWO_PI);
            ctx.fillStyle = s.color;
            ctx.fill();
        });
    }

    // ---------------------------------------------------------
    // SOL: corona pulsante + disco con oscurecimiento en el borde
    // ---------------------------------------------------------
    const sunSpots = Array.from({ length: 16 }, () => ({
        lon: rand(0, TWO_PI),
        lat: rand(-1, 1),
        size: rand(0.06, 0.16),
        color: Math.random() > 0.5 ? 'rgba(255,255,230,0.4)' : 'rgba(190,60,0,0.35)'
    }));

    function drawSun(t) {
        const { x, y, radius: r } = sun;

        // Corona (brillo exterior)
        const pulse = 1 + 0.06 * Math.sin(t * 2);
        ctx.save();
        ctx.globalCompositeOperation = 'lighter';
        const corona = ctx.createRadialGradient(x, y, r * 0.8, x, y, r * 4 * pulse);
        corona.addColorStop(0, 'rgba(255,200,80,0.55)');
        corona.addColorStop(0.35, 'rgba(255,140,30,0.18)');
        corona.addColorStop(1, 'rgba(255,100,0,0)');
        ctx.fillStyle = corona;
        ctx.beginPath();
        ctx.arc(x, y, r * 4 * pulse, 0, TWO_PI);
        ctx.fill();
        ctx.restore();

        // Disco solar
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TWO_PI);
        ctx.clip();

        const disc = ctx.createRadialGradient(x - r * 0.25, y - r * 0.25, r * 0.1, x, y, r);
        disc.addColorStop(0, '#fffbe0');
        disc.addColorStop(0.45, '#ffd23f');
        disc.addColorStop(0.85, '#ff9a1f');
        disc.addColorStop(1, '#e8590c');
        ctx.fillStyle = disc;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        // Manchas y granulación en rotación lenta
        drawSpots(x, y, r, sunSpots, t * 0.15);
        ctx.restore();
    }

    // ---------------------------------------------------------
    // ANILLOS (mitad trasera antes del planeta, delantera después)
    // ---------------------------------------------------------
    function drawRing(b, back) {
        const start = back ? Math.PI : 0;
        const end = back ? TWO_PI : Math.PI;
        const rings = [
            { k: 1.9, color: 'rgba(225,205,160,0.6)', w: b.radius * 0.3 },
            { k: 2.35, color: 'rgba(170,150,120,0.4)', w: b.radius * 0.22 }
        ];
        rings.forEach(ring => {
            ctx.beginPath();
            ctx.ellipse(b.x, b.y, b.radius * ring.k, b.radius * ring.k * 0.32, b.tilt, start, end);
            ctx.strokeStyle = ring.color;
            ctx.lineWidth = ring.w;
            ctx.stroke();
        });
    }

    // ---------------------------------------------------------
    // PLANETA: esfera + atmósfera + sombra según la posición del Sol
    // ---------------------------------------------------------
    function drawPlanet(b) {
        const { x, y, radius: r } = b;
        const toSun = Math.atan2(sun.y - y, sun.x - x);

        if (b.ring) drawRing(b, true);

        // Halo atmosférico
        if (b.atmosphere) {
            const atm = ctx.createRadialGradient(x, y, r * 0.9, x, y, r * 1.5);
            atm.addColorStop(0, `rgba(${b.atmosphere},0.45)`);
            atm.addColorStop(1, `rgba(${b.atmosphere},0)`);
            ctx.fillStyle = atm;
            ctx.beginPath();
            ctx.arc(x, y, r * 1.5, 0, TWO_PI);
            ctx.fill();
        }

        // Todo lo siguiente se recorta al círculo del planeta
        ctx.save();
        ctx.beginPath();
        ctx.arc(x, y, r, 0, TWO_PI);
        ctx.clip();

        ctx.fillStyle = b.base || b.bands[0];
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        if (b.kind === 'gas') {
            ctx.save();
            ctx.translate(x, y);
            ctx.rotate(b.tilt);
            const stripes = 11;
            const h = (r * 2) / stripes;
            for (let i = 0; i < stripes; i++) {
                ctx.fillStyle = b.bands[i % b.bands.length];
                ctx.fillRect(-r * 1.2, -r + i * h, r * 2.4, h + 1);
            }
            ctx.restore();
        } else {
            drawSpots(x, y, r, b.surface, b.spin);
        }

        // Sombra: el lado opuesto al Sol se oscurece
        const sx = x + Math.cos(toSun) * r * 0.45;
        const sy = y + Math.sin(toSun) * r * 0.45;
        const shade = ctx.createRadialGradient(sx, sy, r * 0.15, sx, sy, r * 1.55);
        shade.addColorStop(0, 'rgba(0,0,0,0)');
        shade.addColorStop(0.55, 'rgba(0,0,0,0.15)');
        shade.addColorStop(1, 'rgba(0,0,10,0.92)');
        ctx.fillStyle = shade;
        ctx.fillRect(x - r, y - r, r * 2, r * 2);

        ctx.restore();

        if (b.ring) drawRing(b, false);
    }

    // ---------------------------------------------------------
    // COMETA: la cola siempre apunta lejos del Sol
    // ---------------------------------------------------------
    function drawComet(b) {
        const { x, y, radius: r } = b;
        const away = Math.atan2(y - sun.y, x - sun.x);
        const dist = Math.hypot(x - sun.x, y - sun.y);
        const len = Math.max(20, Math.min(120, 14000 / dist)); // más cerca = cola más larga

        const ex = x + Math.cos(away) * len;
        const ey = y + Math.sin(away) * len;
        const nx = -Math.sin(away) * r * 1.8;
        const ny = Math.cos(away) * r * 1.8;

        const tail = ctx.createLinearGradient(x, y, ex, ey);
        tail.addColorStop(0, 'rgba(190,225,255,0.75)');
        tail.addColorStop(1, 'rgba(190,225,255,0)');
        ctx.fillStyle = tail;
        ctx.beginPath();
        ctx.moveTo(x + nx, y + ny);
        ctx.lineTo(ex, ey);
        ctx.lineTo(x - nx, y - ny);
        ctx.closePath();
        ctx.fill();

        // Coma (halo alrededor del núcleo)
        const coma = ctx.createRadialGradient(x, y, 0, x, y, r * 3);
        coma.addColorStop(0, 'rgba(220,240,255,0.9)');
        coma.addColorStop(1, 'rgba(220,240,255,0)');
        ctx.fillStyle = coma;
        ctx.beginPath();
        ctx.arc(x, y, r * 3, 0, TWO_PI);
        ctx.fill();

        // Núcleo
        ctx.fillStyle = '#d9d9d9';
        ctx.beginPath();
        ctx.arc(x, y, r * 0.7, 0, TWO_PI);
        ctx.fill();
    }

    // Estela orbital con desvanecimiento progresivo
    function drawTrail(b) {
        const t = b.trail;
        if (t.length < 2) return;
        ctx.lineWidth = 2;
        ctx.lineCap = 'round';
        ctx.strokeStyle = b.trailColor;
        for (let i = 1; i < t.length; i++) {
            ctx.globalAlpha = (i / t.length) * 0.5;
            ctx.beginPath();
            ctx.moveTo(t[i - 1].x, t[i - 1].y);
            ctx.lineTo(t[i].x, t[i].y);
            ctx.stroke();
        }
        ctx.globalAlpha = 1;
    }

    // ---------------------------------------------------------
    // FÍSICA
    // ---------------------------------------------------------
    function updatePhysics() {
        bodies = bodies.filter(body => {
            const dx = sun.x - body.x;
            const dy = sun.y - body.y;
            const distance = Math.sqrt(dx * dx + dy * dy);

            // El Sol absorbe los cuerpos que caen en él
            if (distance <= sun.radius) return false;

            // a = G * M / r^2
            const force = (G * sun.mass) / (distance * distance);
            body.vx += force * (dx / distance) * timeStep;
            body.vy += force * (dy / distance) * timeStep;
            body.x += body.vx * timeStep;
            body.y += body.vy * timeStep;

            body.spin += body.spinSpeed * 0.02 * timeStep;

            body.trail.push({ x: body.x, y: body.y });
            if (body.trail.length > 120) body.trail.shift();

            return true;
        });
    }

    // ---------------------------------------------------------
    // RENDER Y BUCLE
    // ---------------------------------------------------------
    function render(t) {
        drawBackground(t);
        bodies.forEach(b => drawTrail(b));
        drawSun(t);
        bodies.forEach(b => (b.kind === 'comet' ? drawComet(b) : drawPlanet(b)));
    }

    function loop(now) {
        if (!isPaused) updatePhysics();
        render(now / 1000);
        animationFrameId = requestAnimationFrame(loop);
    }

    // ---------------------------------------------------------
    // EVENTOS
    // ---------------------------------------------------------
    gravityRange.addEventListener('input', (e) => {
        G = parseFloat(e.target.value);
        gravityVal.textContent = G.toFixed(1);
    });

    speedRange.addEventListener('input', (e) => {
        timeStep = parseFloat(e.target.value);
        speedVal.textContent = `${timeStep.toFixed(1)}x`;
    });

    addPlanetBtn.addEventListener('click', () => {
        const type = PLANET_TYPES[Math.floor(Math.random() * PLANET_TYPES.length)];
        const distance = rand(80, 240);
        const angle = rand(0, TWO_PI);
        const speed = Math.sqrt((G * sun.mass) / distance); // órbita circular teórica
        const radius = type.kind === 'gas' ? rand(10, 15) : rand(6, 10);

        bodies.push(createBody(
            type,
            sun.x + Math.cos(angle) * distance,
            sun.y + Math.sin(angle) * distance,
            -Math.sin(angle) * speed,
            Math.cos(angle) * speed,
            radius,
            rand(8, 25)
        ));
    });

    addCometBtn.addEventListener('click', () => {
        bodies.push(createComet());
    });

    pauseBtn.addEventListener('click', () => {
        isPaused = !isPaused;
        pauseBtn.textContent = isPaused ? '▶️ Reanudar' : '⏸️ Pausar';
    });

    resetBtn.addEventListener('click', () => {
        initDefaultBodies();
    });

    // Iniciar Simulación
    initDefaultBodies();
    animationFrameId = requestAnimationFrame(loop);
});