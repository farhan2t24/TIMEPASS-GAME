// DEMONIC SERPENT — THE POSSESSED HUNT
// Controls: Arrow Keys / WASD = Move | Space = Pause/Resume | R = Restart
// Mechanics: Eat soul orbs to grow and spawn demonic entities that follow your old paths.
// Each demon chases your past movement trail. Collide = Game Over.
// High score saved under localStorage key "demonicSerpent_highscore".
// Boss AI predicts next player move near the 10th orb eaten.
// Built for GitHub Pages — all assets under /assets/.

// Constants & Parameters
const GRID_COLS = 30;
const GRID_ROWS = 30;
const CELL_SIZE = 20;
const PLAYER_TPS_BASE = 8;
const DEMON_SPEED_FACTOR = 0.7;
const TRAIL_HISTORY_CAP = 500;
const TRAIL_SPAWN_LENGTH = 100;
const SCORE_PER_ORB = 10;
const LOCALSTORAGE_KEY_HIGHSCORE = "demonicSerpent_highscore";
const LOCALSTORAGE_KEY_SOUND = "demonicSerpent_sound_on";
const PARTICLES = { pickupCount: 18, lifetime: 500, speedMin: 0.5, speedMax: 2.5 };

// Texture Loading
const snakeTexture = new Image();
snakeTexture.src = "assets/images/snake.png";
const demonTexture = new Image();
demonTexture.src = "assets/images/demon_entity.png";
const orbTexture = new Image();
orbTexture.src = "assets/images/orb.png";
const bossTexture = new Image();
bossTexture.src = "assets/images/boss_demon.png";

// Canvas Setup & Resize
const canvas = document.getElementById('game-canvas');
const ctx = canvas.getContext('2d');
let canvasWidth = GRID_COLS * CELL_SIZE;
let canvasHeight = GRID_ROWS * CELL_SIZE;
canvas.width = canvasWidth;
canvas.height = canvasHeight;

function resizeCanvas() {
    const maxWidth = window.innerWidth * 0.9;
    const maxHeight = window.innerHeight * 0.9;
    const scale = Math.min(maxWidth / canvasWidth, maxHeight / canvasHeight);
    canvas.style.width = `${canvasWidth * scale}px`;
    canvas.style.height = `${canvasHeight * scale}px`;
}
window.addEventListener('resize', resizeCanvas);
resizeCanvas();

// Game State Management
let gameState = {
    running: false,
    paused: false,
    gameOver: false,
    score: 0,
    highScore: 0,
    player: { segments: [{ x: 15, y: 15 }, { x: 14, y: 15 }, { x: 13, y: 15 }], direction: { x: 1, y: 0 } },
    trailHistory: [],
    demons: [],
    boss: null,
    orb: { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) },
    particles: [],
    embers: [],
    lastTick: 0,
    tickAccumulator: 0,
    playerTPS: PLAYER_TPS_BASE,
    soundOn: true
};

function initGame() {
    gameState.running = true;
    gameState.paused = false;
    gameState.gameOver = false;
    gameState.score = 0;
    gameState.player.segments = [{ x: 15, y: 15 }, { x: 14, y: 15 }, { x: 13, y: 15 }];
    gameState.player.direction = { x: 1, y: 0 };
    gameState.trailHistory = [];
    gameState.demons = [];
    gameState.boss = null;
    gameState.orb = { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) };
    gameState.particles = [];
    gameState.embers = [];
    gameState.lastTick = performance.now();
    gameState.tickAccumulator = 0;
    gameState.playerTPS = PLAYER_TPS_BASE;
    updateUI();
    spawnEmbers();
    playAmbient();
}

function updateUI() {
    document.getElementById('score-display').textContent = `Score: ${gameState.score}`;
    document.getElementById('highscore-display').textContent = `High Score: ${gameState.highScore}`;
    document.getElementById('sound-toggle').textContent = gameState.soundOn ? '🔊' : '🔇';
}

// Input Handling
let keys = {};
document.addEventListener('keydown', (e) => {
    keys[e.key] = true;
    if (e.key === 'p' || e.key === 'P') {
        e.preventDefault();
        togglePause();
    } else if (e.key === 'r' || e.key === 'R') {
        if (gameState.gameOver) restartGame();
    }
});
document.addEventListener('keyup', (e) => {
    keys[e.key] = false;
});

function togglePause() {
    if (gameState.gameOver) return;
    gameState.paused = !gameState.paused;
}

function handleInput() {
    let newDir = { ...gameState.player.direction };
    let keyPressed = false;
    if (keys['ArrowUp'] || keys['w'] || keys['W']) {
        newDir = { x: 0, y: -1 };
        keyPressed = true;
    } else if (keys['ArrowDown'] || keys['s'] || keys['S']) {
        newDir = { x: 0, y: 1 };
        keyPressed = true;
    } else if (keys['ArrowLeft'] || keys['a'] || keys['A']) {
        newDir = { x: -1, y: 0 };
        keyPressed = true;
    } else if (keys['ArrowRight'] || keys['d'] || keys['D']) {
        newDir = { x: 1, y: 0 };
        keyPressed = true;
    }
    // Normal anti-reverse logic
    if (keyPressed && (newDir.x !== -gameState.player.direction.x || newDir.y !== -gameState.player.direction.y)) {
        gameState.player.direction = newDir;
    }
}

// Utility Functions
function random(min, max) {
    return Math.random() * (max - min) + min;
}

function distance(a, b) {
    return Math.sqrt((a.x - b.x) ** 2 + (a.y - b.y) ** 2);
}

function spawnEmbers() {
    gameState.embers = [];
    for (let i = 0; i < 18; i++) {
        gameState.embers.push({
            x: random(0, canvasWidth),
            y: random(0, canvasHeight),
            vx: random(-0.5, 0.5),
            vy: random(-0.5, 0.5),
            life: random(1000, 2000)
        });
    }
}

function updateEmbers(deltaTime) {
    gameState.embers.forEach(ember => {
        ember.x += ember.vx * deltaTime;
        ember.y += ember.vy * deltaTime;
        ember.life -= deltaTime;
        if (ember.life <= 0) {
            ember.x = random(0, canvasWidth);
            ember.y = random(0, canvasHeight);
            ember.life = random(1000, 2000);
        }
    });
}

// Trail & Demon Logic
function updateTrail() {
    const head = gameState.player.segments[0];
    gameState.trailHistory.unshift({ x: head.x, y: head.y });
    if (gameState.trailHistory.length > TRAIL_HISTORY_CAP) {
        gameState.trailHistory.pop();
    }
}

function spawnDemon() {
    const trail = gameState.trailHistory.slice(0, TRAIL_SPAWN_LENGTH);
    gameState.demons.push({
        trail: trail,
        index: 0,
        tickAccumulator: 0,
        speedFactor: DEMON_SPEED_FACTOR
    });
    // Spawn particles for flash and smoke
    spawnParticles(gameState.player.segments[0].x * CELL_SIZE + CELL_SIZE / 2, gameState.player.segments[0].y * CELL_SIZE + CELL_SIZE / 2);
    if (gameState.soundOn) new Audio("assets/sounds/growl.mp3").play();
}

function updateDemons(deltaTime) {
    gameState.demons.forEach(demon => {
        demon.tickAccumulator += deltaTime * gameState.playerTPS * demon.speedFactor;
        while (demon.tickAccumulator >= 1000 / gameState.playerTPS) {
            demon.tickAccumulator -= 1000 / gameState.playerTPS;
            demon.index = (demon.index + 1) % demon.trail.length;
        }
    });
}

// Boss AI Prediction
function spawnBoss() {
    gameState.boss = {
        x: Math.floor(Math.random() * GRID_COLS),
        y: Math.floor(Math.random() * GRID_ROWS),
        direction: { x: 0, y: 0 },
        tickAccumulator: 0,
        speedFactor: DEMON_SPEED_FACTOR
    };
    if (gameState.soundOn) new Audio("assets/sounds/boss_predict.mp3").play();
}

function updateBoss(deltaTime) {
    if (!gameState.boss) return;
    gameState.boss.tickAccumulator += deltaTime * gameState.playerTPS * gameState.boss.speedFactor;
    while (gameState.boss.tickAccumulator >= 1000 / gameState.playerTPS) {
        gameState.boss.tickAccumulator -= 1000 / gameState.playerTPS;
        // Predict next move: average of last 3 directions
        const recentDirs = gameState.trailHistory.slice(0, 3).map((pos, i, arr) => {
            if (i === 0) return { x: 0, y: 0 };
            return { x: pos.x - arr[i-1].x, y: pos.y - arr[i-1].y };
        });
        const avgDir = recentDirs.reduce((acc, dir) => ({ x: acc.x + dir.x, y: acc.y + dir.y }), { x: 0, y: 0 });
        avgDir.x /= recentDirs.length;
        avgDir.y /= recentDirs.length;
        // Occasionally intercept
        if (Math.random() < 0.3) {
            const head = gameState.player.segments[0];
            const dx = head.x - gameState.boss.x;
            const dy = head.y - gameState.boss.y;
            gameState.boss.direction = { x: Math.sign(dx), y: Math.sign(dy) };
        } else {
            gameState.boss.direction = { x: Math.sign(avgDir.x), y: Math.sign(avgDir.y) };
        }
        gameState.boss.x += gameState.boss.direction.x;
        gameState.boss.y += gameState.boss.direction.y;
        // Wrap or clamp
        if (gameState.boss.x < 0) gameState.boss.x = GRID_COLS - 1;
        if (gameState.boss.x >= GRID_COLS) gameState.boss.x = 0;
        if (gameState.boss.y < 0) gameState.boss.y = GRID_ROWS - 1;
        if (gameState.boss.y >= GRID_ROWS) gameState.boss.y = 0;
    }
}

// Collision Detection
function checkCollisions() {
    const head = gameState.player.segments[0];
    // Wall
    if (head.x < 0 || head.x >= GRID_COLS || head.y < 0 || head.y >= GRID_ROWS) {
        gameOver();
        return;
    }
    // Self
    for (let i = 1; i < gameState.player.segments.length; i++) {
        if (head.x === gameState.player.segments[i].x && head.y === gameState.player.segments[i].y) {
            gameOver();
            return;
        }
    }
    // Demons
    gameState.demons.forEach(demon => {
        const pos = demon.trail[demon.index];
        if (pos && head.x === pos.x && head.y === pos.y) {
            gameOver();
            return;
        }
    });
    // Boss
    if (gameState.boss && head.x === gameState.boss.x && head.y === gameState.boss.y) {
        gameOver();
        return;
    }
    // Orb
    if (head.x === gameState.orb.x && head.y === gameState.orb.y) {
        eatOrb();
    }
}

function eatOrb() {
    gameState.score += SCORE_PER_ORB;
    gameState.player.segments.push({ ...gameState.player.segments[gameState.player.segments.length - 1] });
    spawnDemon();
    if (gameState.score / SCORE_PER_ORB >= 10 && !gameState.boss) {
        spawnBoss();
    }
    if ((gameState.score / SCORE_PER_ORB) % 5 === 0) {
        gameState.playerTPS += 0.5;
    }
    gameState.orb = { x: Math.floor(Math.random() * GRID_COLS), y: Math.floor(Math.random() * GRID_ROWS) };
    spawnParticles(gameState.orb.x * CELL_SIZE + CELL_SIZE / 2, gameState.orb.y * CELL_SIZE + CELL_SIZE / 2);
    if (gameState.soundOn) new Audio("assets/sounds/pickup.mp3").play();
    updateUI();
}

function spawnParticles(x, y) {
    for (let i = 0; i < PARTICLES.pickupCount; i++) {
        gameState.particles.push({
            x: x,
            y: y,
            vx: random(-PARTICLES.speedMax, PARTICLES.speedMax),
            vy: random(-PARTICLES.speedMax, PARTICLES.speedMax),
            life: PARTICLES.lifetime
        });
    }
}

function updateParticles(deltaTime) {
    gameState.particles = gameState.particles.filter(p => {
        p.x += p.vx * deltaTime;
        p.y += p.vy * deltaTime;
        p.life -= deltaTime;
        return p.life > 0;
    });
}

// Rendering (Snake, Demons, Particles)
function render() {
    ctx.clearRect(0, 0, canvasWidth, canvasHeight);
    // Background flicker
    ctx.globalCompositeOperation = 'source-over';
    ctx.fillStyle = `rgba(255, 0, 0, ${0.1 + 0.05 * Math.sin(performance.now() / 1000)})`;
    ctx.fillRect(0, 0, canvasWidth, canvasHeight);
    // Embers
    ctx.globalCompositeOperation = 'lighter';
    gameState.embers.forEach(ember => {
        ctx.shadowBlur = 5;
        ctx.shadowColor = '#ff8a33';
        ctx.fillStyle = '#ff8a33';
        ctx.beginPath();
        ctx.arc(ember.x, ember.y, 2, 0, Math.PI * 2);
        ctx.fill();
    });
    ctx.shadowBlur = 0;
    // Particles
    gameState.particles.forEach(p => {
        ctx.shadowBlur = 10;
        ctx.shadowColor = '#fff7d6';
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath();
        ctx.arc(p.x, p.y, 3, 0, Math.PI * 2);
        ctx.fill();
    });
    // Orb
    const orbX = gameState.orb.x * CELL_SIZE;
    const orbY = gameState.orb.y * CELL_SIZE;
    if (orbTexture.complete && orbTexture.naturalWidth > 0) {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffcb45';
        ctx.drawImage(orbTexture, orbX, orbY, CELL_SIZE, CELL_SIZE);
    } else {
        ctx.shadowBlur = 20;
        ctx.shadowColor = '#ffcb45';
        ctx.fillStyle = '#fff7d6';
        ctx.beginPath();
        ctx.arc(orbX + CELL_SIZE / 2, orbY + CELL_SIZE / 2, CELL_SIZE / 2 - 2, 0, Math.PI * 2);
        ctx.fill();
        ctx.fillStyle = '#ffcb45';
        ctx.beginPath();
        ctx.arc(orbX + CELL_SIZE / 2, orbY + CELL_SIZE / 2, CELL_SIZE / 4, 0, Math.PI * 2);
        ctx.fill();
    }
    // Player (glowing serpent with interpolation)
    ctx.shadowBlur = 20;
    ctx.shadowColor = 'rgba(28, 227, 168, 0.9)';
    gameState.player.segments.forEach((seg, i) => {
        const x = seg.x * CELL_SIZE;
        const y = seg.y * CELL_SIZE;
        if (snakeTexture.complete && snakeTexture.naturalWidth > 0) {
            const taper = 1 - (i / gameState.player.segments.length) * 0.5; // Taper toward tail
            const shimmer = 0.8 + 0.2 * Math.sin(performance.now() / 300 + i * 0.5); // Shimmer
            const size = CELL_SIZE * taper * shimmer;
            ctx.drawImage(snakeTexture, x, y, size, size);
        } else {
            const taper = 1 - (i / gameState.player.segments.length) * 0.5; // Taper toward tail
            const shimmer = 0.8 + 0.2 * Math.sin(performance.now() / 300 + i * 0.5); // Shimmer
            const size = CELL_SIZE * taper * shimmer;
            const grad = ctx.createRadialGradient(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 0, x + CELL_SIZE / 2, y + CELL_SIZE / 2, size / 2);
            grad.addColorStop(0, '#1ce3a8');
            grad.addColorStop(1, '#00d4ff');
            ctx.fillStyle = grad;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, size / 2 - 1, 0, Math.PI * 2);
            ctx.fill();
        }
    });
    // Demons (animated specters)
    ctx.shadowColor = 'rgba(255, 40, 77, 0.9)';
    gameState.demons.forEach(demon => {
        const pos = demon.trail[demon.index];
        if (pos) {
            const flicker = 0.7 + 0.3 * Math.sin(performance.now() / 100 + demon.index);
            const hover = 2 * Math.sin(performance.now() / 500 + demon.index);
            const x = pos.x * CELL_SIZE;
            const y = pos.y * CELL_SIZE + hover;
            if (demonTexture.complete && demonTexture.naturalWidth > 0) {
                ctx.globalAlpha = flicker;
                ctx.drawImage(demonTexture, x, y, CELL_SIZE, CELL_SIZE);
                ctx.globalAlpha = 1;
            } else {
                const grad = ctx.createRadialGradient(x + CELL_SIZE / 2, y + CELL_SIZE / 2, 0, x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2);
                grad.addColorStop(0, '#ff284d');
                grad.addColorStop(1, '#9b2cff');
                ctx.fillStyle = grad;
                ctx.globalAlpha = flicker;
                ctx.beginPath();
                ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE / 2 - 1, 0, Math.PI * 2);
                ctx.fill();
                ctx.globalAlpha = 1;
            }
        }
    });
    // Boss (larger animated specter)
    if (gameState.boss) {
        ctx.shadowBlur = 30;
        ctx.shadowColor = '#ff0066';
        const pulse = 0.5 + 0.5 * Math.sin(performance.now() / 200);
        const flicker = 0.8 + 0.2 * Math.sin(performance.now() / 150);
        const x = gameState.boss.x * CELL_SIZE;
        const y = gameState.boss.y * CELL_SIZE;
        if (bossTexture.complete && bossTexture.naturalWidth > 0) {
            ctx.globalAlpha = pulse * flicker;
            ctx.drawImage(bossTexture, x, y, CELL_SIZE * 2, CELL_SIZE * 2);
            ctx.globalAlpha = 1;
        } else {
            ctx.fillStyle = `rgba(255, 0, 102, ${pulse * flicker})`;
            ctx.beginPath();
            ctx.arc(x + CELL_SIZE / 2, y + CELL_SIZE / 2, CELL_SIZE - 2, 0, Math.PI * 2);
            ctx.fill();
        }
    }
    ctx.shadowBlur = 0;
    ctx.globalCompositeOperation = 'source-over';
}

// Game Loop & Timing
function gameLoop(timestamp) {
    if (!gameState.running) return;
    const deltaTime = timestamp - gameState.lastTick;
    gameState.lastTick = timestamp;
    handleInput();  // Process input every frame
    if (!gameState.paused && !gameState.gameOver) {
        gameState.tickAccumulator += deltaTime;
        while (gameState.tickAccumulator >= 1000 / gameState.playerTPS) {
            gameState.tickAccumulator -= 1000 / gameState.playerTPS;
            updateTrail();
            updateDemons(deltaTime);
            updateBoss(deltaTime);
            // Move player
            const head = { ...gameState.player.segments[0] };
            head.x += gameState.player.direction.x;
            head.y += gameState.player.direction.y;
            gameState.player.segments.unshift(head);
            gameState.player.segments.pop();
            checkCollisions();
        }
        updateParticles(deltaTime);
        updateEmbers(deltaTime);
    }
    render();
    requestAnimationFrame(gameLoop);
}

// Storage (localStorage helpers)
function loadHighScore() {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY_HIGHSCORE);
    gameState.highScore = stored ? parseInt(stored) : 0;
}

function saveHighScore() {
    if (gameState.score > gameState.highScore) {
        gameState.highScore = gameState.score;
        localStorage.setItem(LOCALSTORAGE_KEY_HIGHSCORE, gameState.highScore);
    }
}

function loadSoundSetting() {
    const stored = localStorage.getItem(LOCALSTORAGE_KEY_SOUND);
    gameState.soundOn = stored !== null ? JSON.parse(stored) : true;
}

function saveSoundSetting() {
    localStorage.setItem(LOCALSTORAGE_KEY_SOUND, gameState.soundOn);
}

// Audio Management
function playAmbient() {
    if (gameState.soundOn) {
        const audio = new Audio("assets/sounds/ambient_loop.mp3");
        audio.loop = true;
        audio.play();
    }
}

document.getElementById('sound-toggle').addEventListener('click', () => {
    gameState.soundOn = !gameState.soundOn;
    saveSoundSetting();
    updateUI();
});



// Restart & GameOver
function gameOver() {
    gameState.gameOver = true;
    saveHighScore();
    if (gameState.soundOn) new Audio("assets/sounds/death_bass.mp3").play();
    document.getElementById('game-over-overlay').style.display = 'flex';
    document.getElementById('final-score').textContent = `Score: ${gameState.score}`;
    document.getElementById('final-highscore').textContent = `High Score: ${gameState.highScore}`;
}

function restartGame() {
    document.getElementById('game-over-overlay').style.display = 'none';
    initGame();
}

// Initialize
loadHighScore();
loadSoundSetting();
initGame();
requestAnimationFrame(gameLoop);
