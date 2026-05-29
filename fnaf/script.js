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
