(function () {
    const DOOM_BUNDLE_URL = "./doom.jsdos";
    const KEYS = {
        left: 37,
        up: 38,
        right: 39,
        down: 40
    };

    const dosElement = document.getElementById("dos");
    const statusElement = document.getElementById("doomStatus");
    const startOverlay = document.getElementById("doomStart");
    const startButton = document.getElementById("doomStartButton");
    const backButton = document.getElementById("doomBack");
    const moveStick = document.getElementById("doomMoveStick");
    const stickThumb = moveStick.querySelector(".doom-stick-thumb");
    const actionButtons = document.querySelectorAll(".doom-action[data-key]");

    let commandInterface = null;
    let dosPlayer = null;
    let movePointerId = null;
    let immersiveRequested = false;
    const heldKeys = new Set();

    const isTouchDevice = window.matchMedia("(pointer: coarse)").matches;

    function setStatus(message, hide) {
        statusElement.textContent = message;
        statusElement.classList.toggle("is-hidden", Boolean(hide));
    }

    function setKey(keyCode, pressed) {
        if (!commandInterface || typeof commandInterface.sendKeyEvent !== "function") {
            return;
        }

        if (pressed && heldKeys.has(keyCode)) {
            return;
        }

        if (!pressed && !heldKeys.has(keyCode)) {
            return;
        }

        commandInterface.sendKeyEvent(keyCode, pressed);

        if (pressed) {
            heldKeys.add(keyCode);
        } else {
            heldKeys.delete(keyCode);
        }
    }

    function releaseKeys(keys) {
        keys.forEach((keyCode) => setKey(keyCode, false));
    }

    function releaseAllKeys() {
        Array.from(heldKeys).forEach((keyCode) => {
            commandInterface && commandInterface.sendKeyEvent(keyCode, false);
            heldKeys.delete(keyCode);
        });
    }

    async function enterImmersiveMode() {
        if (immersiveRequested) {
            return;
        }

async function enterImmersiveMode() {
    if (immersiveRequested) {
        return;
    }

    immersiveRequested = true;

    try {
        if (
            !document.fullscreenElement &&
            document.documentElement.requestFullscreen
        ) {
            await document.documentElement.requestFullscreen();
        }
    } catch (error) {
        console.warn("Fullscreen bloqueado:", error);
    }

    try {
        if (
            screen.orientation &&
            typeof screen.orientation.lock === "function"
        ) {
            await screen.orientation.lock("landscape");
        }
    } catch (error) {
        console.warn("Orientation lock bloqueado:", error);
    }
}

    function setupBackButton() {
        backButton.addEventListener("click", () => {
            releaseAllKeys();

            if (dosPlayer && typeof dosPlayer.stop === "function") {
                dosPlayer.stop();
            }

            if (document.referrer && document.referrer !== window.location.href) {
                history.back();
                return;
            }

            window.location.href = "index.html";
        });
    }

    function setupStartOverlay() {
        if (!isTouchDevice) {
            return;
        }

        startOverlay.hidden = false;
        startButton.addEventListener("click", async () => {
            await enterImmersiveMode();
            startOverlay.hidden = true;
            dosElement.focus();
        });
    }

    function updateJoystick(clientX, clientY) {
        const rect = moveStick.getBoundingClientRect();
        const centerX = rect.left + rect.width / 2;
        const centerY = rect.top + rect.height / 2;
        const limit = rect.width * 0.34;
        const deltaX = clientX - centerX;
        const deltaY = clientY - centerY;
        const distance = Math.min(Math.hypot(deltaX, deltaY), limit);
        const angle = Math.atan2(deltaY, deltaX);
        const x = Math.cos(angle) * distance;
        const y = Math.sin(angle) * distance;
        const threshold = limit * 0.32;

        stickThumb.style.transform = `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`;

        setKey(KEYS.left, x < -threshold);
        setKey(KEYS.right, x > threshold);
        setKey(KEYS.up, y < -threshold);
        setKey(KEYS.down, y > threshold);
    }

    function resetJoystick() {
        stickThumb.style.transform = "translate(-50%, -50%)";
        releaseKeys([KEYS.left, KEYS.right, KEYS.up, KEYS.down]);
        movePointerId = null;
    }

    function setupTouchControls() {
        moveStick.addEventListener("pointerdown", async (event) => {
            event.preventDefault();
            await enterImmersiveMode();
            movePointerId = event.pointerId;
            moveStick.setPointerCapture(event.pointerId);
            updateJoystick(event.clientX, event.clientY);
        });

        moveStick.addEventListener("pointermove", (event) => {
            if (event.pointerId !== movePointerId) {
                return;
            }

            event.preventDefault();
            updateJoystick(event.clientX, event.clientY);
        });

        ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
            moveStick.addEventListener(eventName, resetJoystick);
        });

        actionButtons.forEach((button) => {
            const keyCode = Number(button.dataset.key);

            button.addEventListener("pointerdown", async (event) => {
                event.preventDefault();
                await enterImmersiveMode();
                button.setPointerCapture(event.pointerId);
                button.classList.add("is-active");
                setKey(keyCode, true);
            });

            ["pointerup", "pointercancel", "lostpointercapture"].forEach((eventName) => {
                button.addEventListener(eventName, () => {
                    button.classList.remove("is-active");
                    setKey(keyCode, false);
                });
            });
        });
    }

    function startDoom() {
        if (!window.Dos) {
            setStatus("Falha ao carregar js-dos", false);
            return;
        }

        dosElement.tabIndex = 0;

        dosPlayer = window.Dos(dosElement, {
            url: DOOM_BUNDLE_URL,
            autoStart: true,
            autoSave: true,
            countDownStart: 0,
            kiosk: true,
            noCloud: true,
            noNetworking: true,
            renderAspect: "Fit",
            renderBackend: "canvas",
            imageRendering: "pixelated",
            theme: "black",
            softFullscreen: true,
            fullScreen: false,
            onEvent: (event, arg) => {
                if (event === "ci-ready") {
                    commandInterface = arg;
                    setStatus("", true);
                    dosElement.focus();
                    return;
                }

                if (event === "emu-ready") {
                    setStatus("Iniciando DOOM...", false);
                }
            }
        });
    }

    window.addEventListener("pagehide", releaseAllKeys);
    window.addEventListener("blur", releaseAllKeys);

    setupBackButton();
    setupStartOverlay();
    setupTouchControls();
    startDoom();
}());
