// canvas
const canvas = document.getElementById('canvas');
const ctx = canvas.getContext('2d');

// =========================
// RESPONSIVIDADE TOTAL
// =========================

const BASE_WIDTH = 1280;
const BASE_HEIGHT = 720;

function resizeCanvas() {
    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;
}

resizeCanvas();

window.addEventListener('resize', resizeCanvas);

function scaleX(x) {
    return (x / BASE_WIDTH) * canvas.width;
}

function scaleY(y) {
    return (y / BASE_HEIGHT) * canvas.height;
}

// =========================
// TOUCH MOBILE
// =========================

let touchStartX = 0;
let touchStartY = 0;

canvas.addEventListener('touchstart', (e) => {
    touchStartX = e.touches[0].clientX;
    touchStartY = e.touches[0].clientY;
}, { passive: true });

canvas.addEventListener('touchend', (e) => {
    const touchEndX = e.changedTouches[0].clientX;
    const touchEndY = e.changedTouches[0].clientY;

    const dx = touchEndX - touchStartX;
    const dy = touchEndY - touchStartY;

    // swipe horizontal
    if (Math.abs(dx) > Math.abs(dy)) {

        if (cameraIsOpen) {

            if (dx > 50) {
                currentCamIndex =
                    (currentCamIndex + 1) % cameraRooms.length;

                AudioManager.play('change_camera');
            }

            if (dx < -50) {
                currentCamIndex =
                    (currentCamIndex - 1 + cameraRooms.length) %
                    cameraRooms.length;

                AudioManager.play('change_camera');
            }

        } else {

            mouseX += dx * 2;

            if (mouseX < 0) mouseX = 0;
            if (mouseX > canvas.width) mouseX = canvas.width;
        }
    }

}, { passive: true });

// =========================
// OFFICE BACKGROUND
// =========================

function drawOfficeBg() {

    let bgImage;

    if (powerOut) {

        const now = Date.now();

        if (!freddyTriggered && now >= freddyStartDelay) {

            freddyTriggered = true;
            freddyActive = true;
            freddyTimer = now;

            roomDarkDelay =
                now + Math.random() * 5000 + 10000;

            AudioManager.play('freddy_is_here');
        }

        if (freddyActive) {

            if (now - freddyTimer > 500) {
                freddyImageToggle = !freddyImageToggle;
                freddyTimer = now;
            }

            if (
                freddyTriggered &&
                !roomDark &&
                now >= roomDarkDelay
            ) {
                roomDark = true;
                AudioManager.stop('freddy_is_here');
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

    const drawWidth =
        canvas.height *
        (bgImage.width / bgImage.height);

    const maxOffset =
        Math.max(0, drawWidth - canvas.width);

    const percent = mouseX / canvas.width;

    bgOffsetX = percent * maxOffset;

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
// OFFICE BUTTONS
// =========================

function drawOfficeButtons() {

    let leftImg;

    if (leftDoor && leftLight)
        leftImg = buttonSprites.left.bothOn;

    else if (leftDoor)
        leftImg = buttonSprites.left.doorOn;

    else if (leftLight)
        leftImg = buttonSprites.left.lightOn;

    else
        leftImg = buttonSprites.left.default;

    let rightImg;

    if (rightDoor && rightLight)
        rightImg = buttonSprites.right.bothOn;

    else if (rightDoor)
        rightImg = buttonSprites.right.doorOn;

    else if (rightLight)
        rightImg = buttonSprites.right.lightOn;

    else
        rightImg = buttonSprites.right.default;

    const buttonScale = canvas.height / BASE_HEIGHT;

    const btnWidth = 90 * buttonScale;
    const btnHeight = 220 * buttonScale;

    ctx.drawImage(
        leftImg,
        scaleX(0) - bgOffsetX,
        scaleY(250),
        btnWidth,
        btnHeight
    );

    ctx.drawImage(
        rightImg,
        scaleX(1180) - bgOffsetX,
        scaleY(250),
        btnWidth,
        btnHeight
    );
}

// =========================
// CAMERA ROOM
// =========================

function drawCameraRoom(index) {

    const room = cameraRooms[index];

    const frameX =
        room.currentFrame * room.frameWidth;

    const aspect =
        room.frameWidth / room.frameHeight;

    const drawWidth =
        canvas.height * aspect;

    const maxPan =
        Math.max(0, drawWidth - canvas.width);

    if (!room.pan) {
        room.pan = {
            x: 0,
            direction: 1
        };
    }

    room.pan.x += room.pan.direction * 0.8;

    if (room.pan.x >= maxPan) {
        room.pan.direction = -1;
    }

    if (room.pan.x <= 0) {
        room.pan.direction = 1;
    }

    ctx.drawImage(
        room.image,
        frameX,
        0,
        room.frameWidth,
        room.frameHeight,
        -room.pan.x,
        0,
        drawWidth,
        canvas.height
    );
}

// =========================
// CAMERA UI
// =========================

function drawCameraUI() {

    if (
        !cameraIsOpen &&
        !cameraOpening &&
        !cameraClosing
    ) return;

    ctx.fillStyle = "white";

    ctx.font =
        `${Math.max(18, canvas.width * 0.018)}px Consolas`;

    ctx.fillText(
        cameraRooms[currentCamIndex].name,
        scaleX(900),
        scaleY(250)
    );

    ctx.drawImage(
        cameraSprites.redDot,
        scaleX(40),
        scaleY(40),
        scaleX(25),
        scaleY(25)
    );

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
        scaleX(420),
        scaleY(320)
    );
}

// =========================
// POWER UI
// =========================

function drawPowerUI() {

    if (powerOut) return;

    const uiScale = canvas.width / BASE_WIDTH;

    ctx.fillStyle = "white";

    ctx.font =
        `${Math.max(18, 28 * uiScale)}px Consolas`;

    ctx.fillText(
        `Power left: ${Math.floor(powerSystem.totalPower)}%`,
        scaleX(50),
        scaleY(650)
    );

    ctx.fillText(
        `Usage: ${powerSystem.usageLevel}`,
        scaleX(50),
        scaleY(690)
    );
}

// =========================
// CLOCK UI
// =========================

function drawClockUI() {

    if (powerOut) return;

    ctx.fillStyle = "white";

    ctx.textAlign = "right";

    ctx.font =
        `${Math.max(24, canvas.width * 0.03)}px Consolas`;

    ctx.fillText(
        `${currentHour} AM`,
        canvas.width - scaleX(40),
        scaleY(50)
    );

    ctx.font =
        `${Math.max(18, canvas.width * 0.018)}px Consolas`;

    ctx.fillText(
        `Night ${nightNumber}`,
        canvas.width - scaleX(40),
        scaleY(90)
    );

    ctx.textAlign = "left";
}

// =========================
// CLICK DETECTION RESPONSIVO
// =========================

canvas.addEventListener('click', (e) => {

    const rect = canvas.getBoundingClientRect();

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    // LEFT DOOR
    if (
        mx >= scaleX(0) &&
        mx <= scaleX(80) &&
        my >= scaleY(300) &&
        my <= scaleY(350)
    ) {

        leftDoor = !leftDoor;

        AudioManager.play('door_open_close');
    }

    // LEFT LIGHT
    if (
        mx >= scaleX(0) &&
        mx <= scaleX(80) &&
        my >= scaleY(385) &&
        my <= scaleY(435)
    ) {

        leftLight = !leftLight;
    }

    // RIGHT DOOR
    if (
        mx >= scaleX(1180) &&
        mx <= scaleX(1260) &&
        my >= scaleY(300) &&
        my <= scaleY(350)
    ) {

        rightDoor = !rightDoor;

        AudioManager.play('door_open_close');
    }

    // RIGHT LIGHT
    if (
        mx >= scaleX(1180) &&
        mx <= scaleX(1260) &&
        my >= scaleY(385) &&
        my <= scaleY(435)
    ) {

        rightLight = !rightLight;
    }
});

// =========================
// CAMERA OPEN/CLOSE
// =========================

canvas.addEventListener('click', (e) => {

    if (powerOut) return;

    const rect = canvas.getBoundingClientRect();

    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;

    if (
        mx >= scaleX(350) &&
        mx <= scaleX(950) &&
        my >= scaleY(640) &&
        my <= scaleY(720)
    ) {

        if (
            cameraIsOpen &&
            !cameraClosing &&
            !cameraOpening
        ) {

            cameraClosing = true;
            cameraOpening = false;

            AudioManager.play('camera_close');

        } else if (
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
