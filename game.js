const canvas = document.getElementById('gameCanvas');
const ctx = canvas.getContext('2d');

// UI Elements
const hud = document.getElementById('hud');
const pitstopsCountEl = document.getElementById('pitstops-count');
const speedIndicatorEl = document.getElementById('speed-indicator');
const distanceIndicatorEl = document.getElementById('distance-indicator');
const shieldStatusEl = document.getElementById('shield-status');
const shieldTimeEl = document.getElementById('shield-time');

const startScreen = document.getElementById('start-screen');
const startBtn = document.getElementById('start-btn');
const howtoBtn = document.getElementById('howto-btn');
const howtoplayScreen = document.getElementById('howtoplay-screen');
const closeHowtoBtn = document.getElementById('close-howto-btn');

const pitstopScreen = document.getElementById('pitstop-screen');
const questionTextEl = document.getElementById('question-text');
const optionsContainer = document.getElementById('options-container');

const gameoverScreen = document.getElementById('gameover-screen');
const gameoverReasonEl = document.getElementById('gameover-reason');
const restartBtn = document.getElementById('restart-btn');

const victoryScreen = document.getElementById('victory-screen');
const victoryRestartBtn = document.getElementById('victory-restart-btn');

// Game State
let state = 'MENU'; // MENU, PLAYING, PITSTOP, GAMEOVER, VICTORY
let animationId;
let gameSpeed = 5;
let totalDistanceUnits = 0;
let metersDriven = 0;
let nextPitstopMeter = 200;
let pitstopCount = 0;
const MAX_PITSTOPS = 10;
let keys = {};
let availableQuestions = [];

let items = [];
let shieldEndTime = 0;

// Game Objects
const carWidth = 40;
const carHeight = 70;
let player = {
    x: canvas.width / 2 - 20,
    y: canvas.height - 100,
    width: carWidth,
    height: carHeight,
    speed: 5,
    color: '#00f0ff'
};

let obstacles = [];
const lanes = [60, 160, 260, 360]; // Approximate lane centers (0-100, 100-200, 200-300, 300-400)

let roadOffset = 0;

// Input listeners
window.addEventListener('keydown', (e) => keys[e.code] = true);
window.addEventListener('keyup', (e) => keys[e.code] = false);

// Touch/Mouse support for mobile/desktop
let isDragging = false;
canvas.addEventListener('mousedown', (e) => startDrag(e));
canvas.addEventListener('mousemove', (e) => drag(e));
canvas.addEventListener('mouseup', () => isDragging = false);
canvas.addEventListener('mouseleave', () => isDragging = false);

canvas.addEventListener('touchstart', (e) => startDrag(e.touches[0]));
canvas.addEventListener('touchmove', (e) => { e.preventDefault(); drag(e.touches[0]); }, { passive: false });
canvas.addEventListener('touchend', () => isDragging = false);

function startDrag(e) {
    if (state !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    player.x = x - player.width / 2;
    isDragging = true;
}

function drag(e) {
    if (!isDragging || state !== 'PLAYING') return;
    const rect = canvas.getBoundingClientRect();
    const scaleX = canvas.width / rect.width;
    const x = (e.clientX - rect.left) * scaleX;
    player.x = x - player.width / 2;
}


// Event Listeners for UI
startBtn.addEventListener('click', startGame);
restartBtn.addEventListener('click', startGame);
victoryRestartBtn.addEventListener('click', startGame);

howtoBtn.addEventListener('click', () => {
    howtoplayScreen.classList.remove('hidden');
});

closeHowtoBtn.addEventListener('click', () => {
    howtoplayScreen.classList.add('hidden');
});

function resetGame() {
    player.x = canvas.width / 2 - carWidth / 2;
    obstacles = [];
    items = [];
    shieldEndTime = 0;
    shieldStatusEl.classList.add('hidden');
    totalDistanceUnits = 0;
    metersDriven = 0;
    nextPitstopMeter = 200;
    pitstopCount = 0;
    gameSpeed = 5;
    player.speed = 6;
    pitstopsCountEl.textContent = pitstopCount;
    speedIndicatorEl.textContent = (gameSpeed * 20).toFixed(0);
    distanceIndicatorEl.textContent = "0";

    // Shuffle questions
    availableQuestions = [...trafficQuestions];
    for (let i = availableQuestions.length - 1; i > 0; i--) {
        const j = Math.floor(Math.random() * (i + 1));
        [availableQuestions[i], availableQuestions[j]] = [availableQuestions[j], availableQuestions[i]];
    }
}

function startGame() {
    resetGame();
    state = 'PLAYING';
    
    startScreen.classList.add('hidden');
    gameoverScreen.classList.add('hidden');
    victoryScreen.classList.add('hidden');
    pitstopScreen.classList.add('hidden');
    hud.classList.remove('hidden');
    
    if (animationId) cancelAnimationFrame(animationId);
    gameLoop();
}

function showGameOver(reason) {
    state = 'GAMEOVER';
    gameoverReasonEl.textContent = reason;
    gameoverScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

function showVictory() {
    state = 'VICTORY';
    victoryScreen.classList.remove('hidden');
    hud.classList.add('hidden');
}

// Draw Functions
function drawRoad() {
    // Road background
    ctx.fillStyle = '#2a2a35';
    ctx.fillRect(0, 0, canvas.width, canvas.height);
    
    // Lane lines
    ctx.strokeStyle = 'rgba(255, 255, 255, 0.5)';
    ctx.lineWidth = 5;
    ctx.setLineDash([20, 20]);
    
    const numLanes = 3;
    for (let i = 1; i <= numLanes; i++) {
        const xOffset = (canvas.width / 4) * i;
        ctx.beginPath();
        ctx.moveTo(xOffset, -20 + roadOffset);
        ctx.lineTo(xOffset, canvas.height);
        ctx.stroke();
    }
    
    // Move road
    if (state === 'PLAYING') {
        roadOffset += gameSpeed;
        if (roadOffset > 40) roadOffset = 0;
    }
}

function drawPlayer() {
    // Shield glow if active
    if (Date.now() < shieldEndTime) {
        ctx.strokeStyle = '#0f0';
        ctx.lineWidth = 4;
        ctx.beginPath();
        ctx.arc(player.x + player.width/2, player.y + player.height/2, Math.max(player.width, player.height)/2 + 10, 0, Math.PI * 2);
        ctx.stroke();
    }

    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.5)';
    ctx.beginPath();
    ctx.roundRect(player.x - 5, player.y + 5, player.width, player.height, 8);
    ctx.fill();

    // Car Body
    ctx.fillStyle = player.color;
    ctx.beginPath();
    ctx.roundRect(player.x, player.y, player.width, player.height, 8);
    ctx.fill();
    
    // Windshield
    ctx.fillStyle = '#0f0c29';
    ctx.fillRect(player.x + 5, player.y + 15, player.width - 10, 15);
    
    // Headlights
    ctx.fillStyle = '#fff';
    ctx.fillRect(player.x + 5, player.y, 8, 5);
    ctx.fillRect(player.x + player.width - 13, player.y, 8, 5);
    // Neon glow
    ctx.shadowColor = player.color;
    ctx.shadowBlur = 10;
    ctx.stroke();
    ctx.shadowBlur = 0; // reset
}

function spawnItem() {
    if ((nextPitstopMeter - metersDriven) < 15) return;

    if (Math.random() < 0.0005 && items.length === 0) { // Reduced spawn chance
        let lane = Math.floor(Math.random() * 4);
        let itemWidth = 30;
        let xPos = (canvas.width / 4) * lane + ((canvas.width / 4) - itemWidth) / 2;
        
        items.push({
            x: xPos,
            y: -50,
            width: itemWidth,
            height: 30,
            color: '#0f0',
            type: 'shield'
        });
    }
}

function updateAndDrawItems() {
    for (let i = 0; i < items.length; i++) {
        let item = items[i];
        
        if (state === 'PLAYING') {
            item.y += gameSpeed;
        }

        // Draw actual Shield shape
        let cx = item.x + item.width / 2;
        let y = item.y;
        
        ctx.fillStyle = item.color; // #0f0
        ctx.beginPath();
        // Top left
        ctx.moveTo(item.x, y + 5);
        // Small curve to top right
        ctx.quadraticCurveTo(cx, y - 2, item.x + item.width, y + 5);
        // Straight down right side
        ctx.lineTo(item.x + item.width, y + 15);
        // Curve to bottom point
        ctx.quadraticCurveTo(item.x + item.width, y + 30, cx, y + 35);
        // Curve up left side
        ctx.quadraticCurveTo(item.x, y + 30, item.x, y + 15);
        ctx.closePath();
        
        ctx.shadowColor = item.color;
        ctx.shadowBlur = 10;
        ctx.fill();
        ctx.shadowBlur = 0;
        
        ctx.strokeStyle = '#fff';
        ctx.lineWidth = 2;
        ctx.stroke();
        
        // Add a medical/protection cross inside
        ctx.fillStyle = '#fff';
        ctx.fillRect(cx - 2, y + 10, 4, 12);
        ctx.fillRect(cx - 6, y + 14, 12, 4);
        
        if (state === 'PLAYING') {
            if (
                player.x < item.x + item.width &&
                player.x + player.width > item.x &&
                player.y < item.y + item.height &&
                player.height + player.y > item.y
            ) {
                shieldEndTime = Date.now() + 10000;
                item.y = canvas.height + 100;
            }
        }
    }
    if (state === 'PLAYING') {
        items = items.filter(item => item.y < canvas.height + 100);
    }
}

function spawnObstacle() {
    // Ensure we don't spawn right before a pitstop
    if ((nextPitstopMeter - metersDriven) < 15) return;

    if (Math.random() < 0.03) {
        let lane = Math.floor(Math.random() * 4);
        
        // Prevent blocking all 4 lanes
        const newY = -100;
        const safeDistance = 400; // Increased to 400 to prevent diagonal unbroken walls
        let occupiedLanes = new Set();
        occupiedLanes.add(lane);
        
        for (let obs of obstacles) {
            if (Math.abs(obs.y - newY) < safeDistance) {
                let obsLane = Math.floor((obs.x + obs.width / 2) / (canvas.width / 4));
                occupiedLanes.add(obsLane);
            }
        }
        
        // If spawning this obstacle would block the 4th lane, abort
        if (occupiedLanes.size >= 3) { // Changed to >=3 to keep at least 2 lanes open or 1 wide lane open if things get clustered
            return;
        }

        let obsWidth = 65; // Increased width so player can't squeeze between two cars
        let xPos = (canvas.width / 4) * lane + ((canvas.width / 4) - obsWidth) / 2;
        
        obstacles.push({
            x: xPos,
            y: newY,
            width: obsWidth,
            height: 110, // Increased height proportionally
            speed: Math.random() * 2 + 2,
            color: '#ff0055'
        });
    }
}

function updateAndDrawObstacles() {
    for (let i = 0; i < obstacles.length; i++) {
        let obs = obstacles[i];
        
        if (state === 'PLAYING') {
            obs.y += gameSpeed - 1; // Move relative to player speed
        }

        // Draw obstacle
        ctx.fillStyle = obs.color;
        ctx.beginPath();
        ctx.roundRect(obs.x, obs.y, obs.width, obs.height, 5);
        ctx.fill();
        // Rear window
        ctx.fillStyle = '#111';
        ctx.fillRect(obs.x + 5, obs.y + 40, obs.width - 10, 15);
        // Taillights
        ctx.fillStyle = 'red';
        ctx.fillRect(obs.x + 5, obs.y + obs.height - 5, 8, 5);
        ctx.fillRect(obs.x + obs.width - 13, obs.y + obs.height - 5, 8, 5);
        
        // Collision
        if (state === 'PLAYING') {
            if (
                player.x < obs.x + obs.width &&
                player.x + player.width > obs.x &&
                player.y < obs.y + obs.height &&
                player.height + player.y > obs.y
            ) {
                if (Date.now() < shieldEndTime) {
                    obs.y = canvas.height + 100;
                } else {
                    // Collapse
                    showGameOver('คุณชนสิ่งกีดขวาง!');
                }
            }
        }
    }
    
    // Clean up
    if (state === 'PLAYING') {
        obstacles = obstacles.filter(obs => obs.y < canvas.height + 100);
    }
}

function handleInput() {
    if (keys['ArrowLeft'] || keys['KeyA']) {
        player.x -= player.speed;
    }
    if (keys['ArrowRight'] || keys['KeyD']) {
        player.x += player.speed;
    }

    // Boundaries
    if (player.x < 0) player.x = 0;
    if (player.x + player.width > canvas.width) player.x = canvas.width - player.width;
}

function triggerPitstop() {
    state = 'PITSTOP';
    
    // Pick the next random question from the shuffled pool without replacement
    if (availableQuestions.length === 0) {
        availableQuestions = [...trafficQuestions];
    }
    const qObj = availableQuestions.pop();
    
    questionTextEl.textContent = qObj.question;
    optionsContainer.innerHTML = '';
    
    qObj.options.forEach((optText, index) => {
        const btn = document.createElement('button');
        btn.classList.add('option-btn');
        btn.textContent = optText;
        btn.onclick = () => handleAnswer(index, qObj.answer);
        optionsContainer.appendChild(btn);
    });

    pitstopScreen.classList.remove('hidden');
}

function handleAnswer(selectedIndex, correctIndex) {
    pitstopScreen.classList.add('hidden');
    
    if (selectedIndex === correctIndex) {
        // Correct answer
        pitstopCount++;
        pitstopsCountEl.textContent = pitstopCount;
        
        if (pitstopCount >= MAX_PITSTOPS) {
            showVictory();
        } else {
            // Give a speed boost temporarily or just increase difficulty slightly
            gameSpeed += 0.5;
            speedIndicatorEl.textContent = (gameSpeed * 20).toFixed(0);
            
            // Clear obstacles near player
            obstacles = [];
            nextPitstopMeter += 200;
            state = 'PLAYING';
        }
    } else {
        // Wrong answer
        showGameOver("แพ้รถของคุณเกิดปัญหาเครื่องยนต์พัง");
    }
}


function gameLoop() {
    if (state !== 'MENU') {
        ctx.clearRect(0, 0, canvas.width, canvas.height);
        
        drawRoad();
        
        if (state === 'PLAYING') {
            handleInput();
            totalDistanceUnits += gameSpeed;
            metersDriven = Math.floor(totalDistanceUnits / 20);
            distanceIndicatorEl.textContent = metersDriven;
            
            if (metersDriven >= nextPitstopMeter) {
                triggerPitstop();
            } else {
                spawnObstacle();
                spawnItem();
            }
            
            const now = Date.now();
            if (now < shieldEndTime) {
                shieldStatusEl.classList.remove('hidden');
                shieldTimeEl.textContent = Math.ceil((shieldEndTime - now) / 1000);
            } else {
                shieldStatusEl.classList.add('hidden');
            }
        }
        
        updateAndDrawItems();
        updateAndDrawObstacles();
        drawPlayer();
    }
    
    animationId = requestAnimationFrame(gameLoop);
}

// Initial Draw for Menu Background
drawRoad();
drawPlayer();
