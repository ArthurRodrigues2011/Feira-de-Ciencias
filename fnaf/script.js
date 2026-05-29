// =========================
// GAME CORE VARIABLES
// =========================

let gameRunning = false;
let powerOut = false;

let mouseX = window.innerWidth / 2;
let bgOffsetX = 0;

let currentCamIndex = 0;

let cameraIsOpen = false;
let cameraOpening = false;
let cameraClosing = false;

let cameraAnimationFinished = false;

let leftDoor = false;
let rightDoor = false;

let leftLight = false;
let rightLight = false;

let freddyTriggered = false;
let freddyActive = false;
let freddyImageToggle = false;

let freddyTimer = 0;
let freddyStartDelay = 0;

let roomDark = false;
let roomDarkDelay = 0;

let lastFrameTime = performance.now();

// =========================
// RESPONSIVE CANVAS
// =========================

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

function resizeCanvas() {

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

}

resizeCanvas();

window.addEventListener(
    'resize',
    resizeCanvas
);

function scaleX(x) {

    return (x / BASE_WIDTH) * canvas.width;

}

function scaleY(y) {

    return (y / BASE_HEIGHT) * canvas.height;

}

// =========================
// DELTA TIME
// =========================

function getDeltaTime() {

    const now = performance.now();

    const delta = now - lastFrameTime;

    lastFrameTime = now;

    return delta;

}

// =========================
// MOUSE OFFICE MOVEMENT
// =========================

canvas.addEventListener('mousemove', (e) => {

    mouseX = e.clientX;

});

// =========================
// TOUCH SYSTEM MOBILE
// =========================

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {

    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;

}, { passive: true });

canvas.addEventListener('touchmove', (e) => {

    const currentX = e.touches[0].clientX;

    const dx = currentX - touchStartX;

    if (!cameraIsOpen) {

        mouseX -= dx * 2;

        if (mouseX < 0) mouseX = 0;

        if (mouseX > canvas.width)
            mouseX = canvas.width;
    }

    touchStartX = currentX;

}, { passive: true });

canvas.addEventListener('touchend', (e) => {

    const endX = e.changedTouches[0].clientX;

    const diff = endX - touchStartX;

    if (cameraIsOpen) {

        if (diff > 60) {

            currentCamIndex--;

            if (currentCamIndex < 0)
                currentCamIndex =
                    cameraRooms.length - 1;

            AudioManager.play('change_camera');
        }

        if (diff < -60) {

            currentCamIndex++;

            if (currentCamIndex >= cameraRooms.length)
                currentCamIndex = 0;

            AudioManager.play('change_camera');
        }
    }

}, { passive: true });

// =========================
// DRAW OFFICE
// =========================

function drawOfficeBg() {

    let bgImage;

    if (powerOut) {

        const now = Date.now();

        if (
            !freddyTriggered &&
            now >= freddyStartDelay
        ) {

            freddyTriggered = true;

            freddyActive = true;

            freddyTimer = now;

            roomDarkDelay =
                now +
                Math.random() * 5000 +
                10000;

            AudioManager.play('freddy_is_here');
        }

        if (freddyActive) {

            if (now - freddyTimer > 500) {

                freddyImageToggle =
                    !freddyImageToggle;

                freddyTimer = now;
            }

            if (
                freddyTriggered &&
                !roomDark &&
                now >= roomDarkDelay
            ) {

                roomDark = true;

                AudioManager.stop(
                    'freddy_is_here'
                );
            }

            bgImage =
                freddyImageToggle
                    ? officeFreddyIsHereBg
                    : officePowerOutBg;

        } else {

            bgImage = officePowerOutBg;
        }

    } else {

        bgImage = officeBg;
    }

    if (!bgImage.complete) return;

    const aspect =
        bgImage.width / bgImage.height;

    const drawWidth =
        canvas.height * aspect;

    const maxOffset =
        Math.max(
            0,
            drawWidth - canvas.width
        );

    const percent =
        mouseX / canvas.width;

    bgOffsetX =
        percent * maxOffset;

    ctx.drawImage(

        bgImage,

        0,
        0,

        bgImage.width,
        bgImage.height,

        -bgOffsetX,
        0,

        drawWidth,
        canvas.height

    );
}

// =========================
// CAMERA ROOM DRAW
// =========================

function drawCameraRoom(index) {

    const room = cameraRooms[index];

    if (!room.image.complete) return;

    const aspect =
        room.frameWidth / room.frameHeight;

    const drawWidth =
        canvas.height * aspect;

    let panX = 0;

    if (drawWidth > canvas.width) {

        const maxPan =
            drawWidth - canvas.width;

        if (!room.panX)
            room.panX = 0;

        if (!room.panDir)
            room.panDir = 1;

        room.panX += room.panDir * 0.8;

        if (room.panX >= maxPan)
            room.panDir = -1;

        if (room.panX <= 0)
            room.panDir = 1;

        panX = room.panX;
    }

    ctx.drawImage(

        room.image,

        room.currentFrame *
        room.frameWidth,

        0,

        room.frameWidth,
        room.frameHeight,

        -panX,
        0,

        drawWidth,
        canvas.height
    );
}

// =========================
// DRAW CAMERA UI
// =========================

function drawCameraUI() {

    if (
        !cameraIsOpen &&
        !cameraOpening &&
        !cameraClosing
    ) return;

    ctx.drawImage(
        cameraSprites.border,
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.drawImage(
        cameraSprites.cams,

        scaleX(800),
        scaleY(300),

        scaleX(400),
        scaleY(300)
    );

    ctx.drawImage(
        cameraSprites.redDot,

        scaleX(40),
        scaleY(40),

        scaleX(25),
        scaleY(25)
    );

    ctx.fillStyle = "white";

    ctx.font =
        `${Math.max(18, canvas.width * 0.018)}px Consolas`;

    ctx.fillText(
        cameraRooms[currentCamIndex].name,
        scaleX(900),
        scaleY(250)
    );
}

// =========================
// GAME LOOP
// =========================

function gameLoop() {

    if (!gameRunning) return;

    getDeltaTime();

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    // office

    drawOfficeBg();

    drawLitRoom();

    drawDoors();

    drawOfficeButtons();

    drawCameraBar();

    updateDoorAnimations();

    drawDarkerOffice();

    // camera

    updateCameraAnimations();

    if (
        cameraIsOpen ||
        cameraOpening ||
        cameraClosing
    ) {

        drawCameraLift();

        if (cameraAnimationFinished) {

            drawCameraRoom(
                currentCamIndex
            );

            drawCameraStatic();

            drawCameraUI();
        }

        drawCameraBar();
    }

    // systems

    updatePowerUsage();

    updatePowerSystem();

    drawPowerUI();

    updateNightProgress();

    drawClockUI();

    requestAnimationFrame(gameLoop);
}
// =========================
// POWER SYSTEM
// =========================

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

    powerSystem.usageLevel =
        Math.min(usage, 4);
}

function updatePowerSystem() {

    if (!gameRunning) return;

    const now = Date.now();

    const dt =
        (now - powerSystem.lastUpdate) / 1000;

    powerSystem.lastUpdate = now;

    const drain =
        powerSystem.drainRates[
            powerSystem.usageLevel
        ];

    powerSystem.totalPower =
        Math.max(
            0,
            powerSystem.totalPower -
            drain * dt
        );

    if (powerSystem.totalPower <= 0) {

        handlePowerOut();
    }
}
// =========================
// NIGHT SYSTEM
// =========================

let nightStartTime = null;

let currentHour = 12;

let hourCount = 0;

let nightEnded = false;

let nightNumber = 1;

function startNight(night) {

    nightNumber = night;

    nightStartTime = Date.now();

    currentHour = 12;

    hourCount = 0;

    nightEnded = false;
}

function updateNightProgress() {

    if (
        nightEnded ||
        nightStartTime === null
    ) return;

    const now = Date.now();

    const elapsed =
        now - nightStartTime;

    // 60 segundos = 1 hora ingame
    const newHourCount =
        Math.floor(elapsed / 60000);

    if (
        newHourCount !== hourCount &&
        newHourCount <= 6
    ) {

        hourCount = newHourCount;

        currentHour =
            hourCount === 0
                ? 12
                : hourCount;
    }

    if (hourCount >= 6) {

        nightEnded = true;

        alert("6 AM");
    }
}
// =========================
// GAME START
// =========================

function gameStart(nightCounter = 1) {

    powerSystem.lastUpdate =
        Date.now();

    gameRunning = true;

    powerOut = false;

    startNight(nightCounter);

    startAmbience();

    requestAnimationFrame(gameLoop);
}
