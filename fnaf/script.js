// ===============================
// GAME LOOP
// ===============================

let lastFrameTime = Date.now();
let gameRunning = false;
let powerOut = false;

function getDeltaTime() {
    const now = Date.now();
    const delta = now - lastFrameTime;
    lastFrameTime = now;
    return delta;
}

function gameLoop() {
    if (!gameRunning) return;

    const deltaTime = getDeltaTime();

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // ===============================
    // OFFICE
    // ===============================

    drawOfficeBg();
    drawLitRoom();
    drawDoors();
    drawOfficeButtons();
    drawCameraBar();
    updateDoorAnimations();
    drawDarkerOffice();

    // ===============================
    // CAMERA SYSTEM
    // ===============================

    updateCameraAnimations();

    if (cameraIsOpen || cameraOpening || cameraClosing) {

        // câmera levantando/abaixando
        drawCameraLift();

        // câmera aberta totalmente
        if (cameraAnimationFinished) {

            const room = cameraRooms[currentCamIndex];

            updateCameraPan(room, deltaTime);

            drawCameraRoom(currentCamIndex);

            drawCameraStatic();

            drawCameraUI();
        }

        drawCameraBar();
    }

    // ===============================
    // POWER SYSTEM
    // ===============================

    updatePowerUsage();

    updatePowerSystem();

    drawPowerUI();

    // ===============================
    // NIGHT SYSTEM
    // ===============================

    updateNightProgress();

    drawClockUI();

    requestAnimationFrame(gameLoop);
}

// ===============================
// POWER SYSTEM
// ===============================
let gameRunning = false;
let powerOut = false;

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
// ===============================
// GAME START
// ===============================

function resetGameState() {

    // doors
    leftDoor = false;
    rightDoor = false;

    // lights
    leftLight = false;
    rightLight = false;

    // power
    powerOut = false;
    powerOutTriggered = false;

    powerSystem.totalPower = 100;
    powerSystem.usageLevel = 0;
    powerSystem.lastUpdate = Date.now();

    // freddy power out
    freddyActive = false;
    freddyImageToggle = false;
    freddyTriggered = false;
    moved = false;
    roomDark = false;

    // camera
    cameraIsOpen = false;
    cameraOpening = false;
    cameraClosing = false;
    cameraAnimationFinished = false;
    cameraFrame = 0;

    // doors animation
    leftDoorFrame = 0;
    rightDoorFrame = 0;

    leftDoorClosing = false;
    leftDoorOpening = false;

    rightDoorClosing = false;
    rightDoorOpening = false;

    // office position
    bgOffsetX = 0;

    // time
    lastFrameTime = Date.now();
}

function gameStart(nightCounter = 1) {

    resetGameState();

    gameRunning = true;

    startNight(nightCounter);

    startAmbience();

    gameLoop();

    console.log("GAME STARTED");
}

// ===============================
// DEBUG AUTO START
// ===============================

// REMOVA ISSO SE O MENU JÁ CHAMA gameStart()

// gameStart(1);
