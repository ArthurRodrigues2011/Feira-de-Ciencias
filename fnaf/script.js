// ======================================================
// FNAF WEB GAME - FIXED CORE
// ======================================================

// canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// remove favicon error
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.href = 'data:,';
document.head.appendChild(favicon);

// ======================================================
// SCREEN
// ======================================================

canvas.width = 1280;
canvas.height = 720;

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

// ======================================================
// GLOBAL VARIABLES
// ======================================================

let gameRunning = false;
let powerOut = false;

let lastFrameTime = Date.now();

let mouseX = canvas.width / 2;
let bgOffsetX = 0;

// office
let leftDoor = false;
let rightDoor = false;

let leftLight = false;
let rightLight = false;

// door animation
let leftDoorFrame = 0;
let rightDoorFrame = 0;

let leftDoorClosing = false;
let leftDoorOpening = false;

let rightDoorClosing = false;
let rightDoorOpening = false;

let doorDelayCounter = 0;
const doorFrameDelay = 2;

// camera
let cameraIsOpen = false;
let cameraOpening = false;
let cameraClosing = false;

let cameraAnimationFinished = false;

let cameraFrame = 0;
let cameraDelayCounter = 0;
const cameraFrameDelay = 2;

let currentCamIndex = 0;

// power out
let freddyActive = false;
let freddyImageToggle = false;
let freddyTimer = 0;
let freddyStartDelay = 5000;
let freddyTriggered = false;

let moved = false;
let roomDark = false;
let roomDarkDelay = 0;
let powerOutTriggered = false;

// night system
let nightStartTime = null;
let currentHour = 12;
let hourCount = 0;
let nightEnded = false;
let nightNumber = 1;

// ======================================================
// AUDIO SYSTEM
// ======================================================

const AudioManager = {

    sounds: {},

    load(name, src, options = {}) {

        const audio = new Audio(src);

        audio.volume = options.volume ?? 1;
        audio.loop = options.loop ?? false;

        this.sounds[name] = audio;
    },

    play(name, restart = true) {

        const sound = this.sounds[name];

        if (!sound) return;

        if (restart) {
            sound.currentTime = 0;
        }

        sound.play().catch(() => {});
    },

    stop(name) {

        const sound = this.sounds[name];

        if (!sound) return;

        sound.pause();
        sound.currentTime = 0;
    }
};

function loadSounds() {

    AudioManager.load('door_open_close', './SFX/door_open_close.wav');

    AudioManager.load('camera_open', './SFX/camera_open.wav');

    AudioManager.load('camera_close', './SFX/camera_close.wav');

    AudioManager.load('change_camera', './SFX/change_camera.wav');

    AudioManager.load('error', './SFX/error.wav');

    AudioManager.load('powerdown', './SFX/powerdown.wav');

    AudioManager.load('office_ambience', './SFX/office_ambience.wav', {
        loop: true,
        volume: 0.3
    });

    AudioManager.load('mid_game_ambience', './SFX/mid_game_ambience.wav', {
        loop: true,
        volume: 0.4
    });

    AudioManager.load('freddy_is_here', './SFX/freddy_is_here.wav');
}

loadSounds();

function startAmbience() {

    AudioManager.play('office_ambience');

    setTimeout(() => {

        if (!gameRunning) return;

        AudioManager.stop('office_ambience');

        AudioManager.play('mid_game_ambience');

    }, 12000);
}

// ======================================================
// IMAGES
// ======================================================

const officeBg = new Image();
officeBg.src = './Sprites/room_office/office_place_fix.png';

const officePowerOutBg = new Image();
officePowerOutBg.src = './Sprites/room_office/game_over.png';

const officeFreddyIsHereBg = new Image();
officeFreddyIsHereBg.src = './Sprites/room_office/freddy_is_here.png';

const doorImage = new Image();
doorImage.src = './Sprites/room_office/office_doors.png';

const cameraBar = new Image();
cameraBar.src = './Sprites/office_ui/camera_bar.png';

const cameraLiftImage = new Image();
cameraLiftImage.src = './Sprites/camera_ui/camera_lift.png';

// ======================================================
// SIMPLE CAMERA LIFT
// ======================================================

const cameraLiftFrames = [
    { x: 2, y: 2 },
    { x: 1284, y: 2 },
    { x: 2566, y: 2 },
    { x: 3848, y: 2 },
    { x: 2, y: 724 },
    { x: 1284, y: 724 },
    { x: 2566, y: 724 },
    { x: 3848, y: 724 },
    { x: 2, y: 1446 },
    { x: 1284, y: 1446 },
    { x: 2566, y: 1446 }
];

const cameraLiftFrameWidth = 1280;
const cameraLiftFrameHeight = 720;

// ======================================================
// DOOR FRAMES
// ======================================================

const leftDoorFrames = [
    { x: 0, y: 78 },
    { x: 253, y: 78 },
    { x: 502, y: 78 },
    { x: 751, y: 78 }
];

const rightDoorFrames = [
    { x: 0, y: 78 },
    { x: 253, y: 78 },
    { x: 502, y: 78 },
    { x: 751, y: 78 }
];

const doorFrameWidth = 224;
const doorFrameHeight = 720;

// ======================================================
// POWER SYSTEM
// ======================================================

const powerSystem = {

    totalPower: 100,

    usageLevel: 0,

    lastUpdate: Date.now(),

    drainRates: [
        0.1,
        0.25,
        0.35,
        0.5,
        0.75
    ]
};

function updatePowerUsage() {

    if (!gameRunning) return;

    let usage = 0;

    if (leftDoor) usage++;
    if (rightDoor) usage++;
    if (leftLight) usage++;
    if (rightLight) usage++;
    if (cameraIsOpen) usage++;

    powerSystem.usageLevel = Math.min(usage, 4);
}

function updatePowerSystem() {

    if (!gameRunning) return;

    const now = Date.now();

    const dt = (now - powerSystem.lastUpdate) / 1000;

    powerSystem.lastUpdate = now;

    const drain = powerSystem.drainRates[powerSystem.usageLevel];

    powerSystem.totalPower = Math.max(
        0,
        powerSystem.totalPower - drain * dt
    );

    if (powerSystem.totalPower <= 0) {
        handlePowerOut();
    }
}

// ======================================================
// NIGHT SYSTEM
// ======================================================

function startNight(night) {

    nightNumber = night;

    nightStartTime = Date.now();

    currentHour = 12;

    hourCount = 0;

    nightEnded = false;
}

function updateNightProgress() {

    if (nightEnded || nightStartTime === null) return;

    const now = Date.now();

    const elapsed = now - nightStartTime;

    const newHourCount = Math.floor(elapsed / 60000);

    if (newHourCount !== hourCount && newHourCount <= 6) {

        hourCount = newHourCount;

        currentHour = hourCount === 0 ? 12 : hourCount;
    }

    if (hourCount >= 6) {

        nightEnded = true;

        alert('6 AM');
    }
}

// ======================================================
// POWER OUT
// ======================================================

function handlePowerOut() {

    if (powerOutTriggered) return;

    powerOutTriggered = true;

    AudioManager.stop('office_ambience');

    AudioManager.stop('mid_game_ambience');

    powerOut = true;

    leftDoor = false;
    rightDoor = false;

    leftLight = false;
    rightLight = false;

    cameraIsOpen = false;
}

// ======================================================
// ANIMATIONS
// ======================================================

function updateDoorAnimations() {

    if (++doorDelayCounter >= doorFrameDelay) {

        doorDelayCounter = 0;

        if (leftDoorClosing && leftDoorFrame < leftDoorFrames.length - 1) {

            leftDoorFrame++;

            if (leftDoorFrame === leftDoorFrames.length - 1) {
                leftDoorClosing = false;
            }
        }

        else if (leftDoorOpening && leftDoorFrame > 0) {

            leftDoorFrame--;

            if (leftDoorFrame === 0) {
                leftDoorOpening = false;
            }
        }

        if (rightDoorClosing && rightDoorFrame < rightDoorFrames.length - 1) {

            rightDoorFrame++;

            if (rightDoorFrame === rightDoorFrames.length - 1) {
                rightDoorClosing = false;
            }
        }

        else if (rightDoorOpening && rightDoorFrame > 0) {

            rightDoorFrame--;

            if (rightDoorFrame === 0) {
                rightDoorOpening = false;
            }
        }
    }
}

function updateCameraAnimations() {

    if (++cameraDelayCounter >= cameraFrameDelay) {

        cameraDelayCounter = 0;

        if (cameraOpening && cameraFrame < cameraLiftFrames.length - 1) {

            cameraFrame++;

            if (cameraFrame === cameraLiftFrames.length - 1) {

                cameraOpening = false;

                cameraIsOpen = true;

                cameraAnimationFinished = true;
            }
        }

        else if (cameraClosing && cameraFrame > 0) {

            cameraFrame--;

            if (cameraFrame === 0) {

                cameraClosing = false;

                cameraIsOpen = false;

                cameraAnimationFinished = false;
            }
        }
    }
}

// ======================================================
// DRAW
// ======================================================

function drawOfficeBg() {

    let bgImage = officeBg;

    if (powerOut) {

        bgImage = officePowerOutBg;
    }

    if (!bgImage.complete) return;

    const maxOffset = bgImage.width - canvas.width;

    const percent = mouseX / canvas.width;

    bgOffsetX = percent * maxOffset;

    ctx.drawImage(
        bgImage,
        bgOffsetX,
        0,
        canvas.width,
        canvas.height,
        0,
        0,
        canvas.width,
        canvas.height
    );
}

function drawDoors() {

    const left = leftDoorFrames[leftDoorFrame];

    const right = rightDoorFrames[rightDoorFrame];

    ctx.save();

    ctx.scale(-1, 1);

    const flippedX = -(0 - bgOffsetX + 300);

    ctx.drawImage(
        doorImage,
        left.x,
        left.y,
        doorFrameWidth,
        doorFrameHeight,
        flippedX,
        0,
        doorFrameWidth,
        doorFrameHeight
    );

    ctx.restore();

    ctx.drawImage(
        doorImage,
        right.x,
        right.y,
        doorFrameWidth,
        doorFrameHeight,
        1300 - bgOffsetX,
        0,
        doorFrameWidth,
        doorFrameHeight
    );
}

function drawCameraBar() {

    if (!cameraBar.complete || powerOut) return;

    ctx.drawImage(cameraBar, 350, 640);
}

function drawCameraLift() {

    const frame = cameraLiftFrames[cameraFrame];

    ctx.drawImage(
        cameraLiftImage,
        frame.x,
        frame.y,
        cameraLiftFrameWidth,
        cameraLiftFrameHeight,
        0,
        0,
        canvas.width,
        canvas.height
    );
}

function drawPowerUI() {

    if (powerOut) return;

    ctx.fillStyle = 'white';

    ctx.font = '28px Arial';

    ctx.fillText(
        `POWER: ${Math.floor(powerSystem.totalPower)}%`,
        40,
        680
    );

    ctx.fillText(
        `USAGE: ${powerSystem.usageLevel}`,
        40,
        640
    );
}

// ======================================================
// EVENTS
// ======================================================

canvas.addEventListener('mousemove', (e) => {

    const rect = canvas.getBoundingClientRect();

    mouseX = e.clientX - rect.left;
});

canvas.addEventListener('click', (e) => {

    const rect = canvas.getBoundingClientRect();

    const mx = e.clientX - rect.left + bgOffsetX;

    const my = e.clientY - rect.top;

    // left door
    if (mx >= 1 && mx <= 76 && my >= 300 && my <= 350) {

        if (!powerOut) {

            leftDoor = !leftDoor;

            AudioManager.play('door_open_close');

            if (leftDoor) {
                leftDoorClosing = true;
                leftDoorOpening = false;
            } else {
                leftDoorClosing = false;
                leftDoorOpening = true;
            }
        }
    }

    // right door
    if (mx >= 1480 && mx <= 1555 && my >= 300 && my <= 350) {

        if (!powerOut) {

            rightDoor = !rightDoor;

            AudioManager.play('door_open_close');

            if (rightDoor) {
                rightDoorClosing = true;
                rightDoorOpening = false;
            } else {
                rightDoorClosing = false;
                rightDoorOpening = true;
            }
        }
    }

    // camera button
    if (mx >= 350 && mx <= 950 && my >= 640 && my <= 720) {

        if (powerOut) return;

        if (
            cameraIsOpen &&
            !cameraClosing &&
            !cameraOpening
        ) {

            cameraClosing = true;

            cameraOpening = false;

            AudioManager.play('camera_close');
        }

        else if (
            !cameraIsOpen &&
            !cameraOpening &&
            !cameraClosing
        ) {

            cameraOpening = true;

            cameraClosing = false;

            AudioManager.play('camera_open');
        }
    }
});

// ======================================================
// GAME LOOP
// ======================================================

function getDeltaTime() {

    const now = Date.now();

    const delta = now - lastFrameTime;

    lastFrameTime = now;

    return delta;
}

function gameLoop() {

    if (!gameRunning) return;

    getDeltaTime();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    drawOfficeBg();

    drawDoors();

    drawCameraBar();

    updateDoorAnimations();

    updateCameraAnimations();

    if (
        cameraIsOpen ||
        cameraOpening ||
        cameraClosing
    ) {

        drawCameraLift();

        drawCameraBar();
    }

    updatePowerUsage();

    updatePowerSystem();

    drawPowerUI();

    updateNightProgress();

    requestAnimationFrame(gameLoop);
}

// ======================================================
// RESET
// ======================================================

function resetGameState() {

    leftDoor = false;
    rightDoor = false;

    leftLight = false;
    rightLight = false;

    leftDoorFrame = 0;
    rightDoorFrame = 0;

    leftDoorClosing = false;
    leftDoorOpening = false;

    rightDoorClosing = false;
    rightDoorOpening = false;

    cameraIsOpen = false;
    cameraOpening = false;
    cameraClosing = false;

    cameraAnimationFinished = false;

    cameraFrame = 0;

    powerOut = false;
    powerOutTriggered = false;

    powerSystem.totalPower = 100;
    powerSystem.usageLevel = 0;
    powerSystem.lastUpdate = Date.now();

    currentCamIndex = 0;
}

// ======================================================
// GAME START
// ======================================================

function gameStart(nightCounter = 1) {

    resetGameState();

    gameRunning = true;

    startNight(nightCounter);

    startAmbience();

    requestAnimationFrame(gameLoop);

    console.log('GAME STARTED');
}

// GLOBAL
window.gameStart = gameStart;
