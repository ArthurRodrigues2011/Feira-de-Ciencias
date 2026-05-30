const canvas = document.getElementById("game");
const ctx = canvas.getContext("2d");

function resize() {
    canvas.width = innerWidth;
    canvas.height = innerHeight;
}
resize();
addEventListener("resize", resize);

const menu = document.getElementById("menu");
const levels = document.getElementById("levels");
const hud = document.getElementById("hud");
const scoreEl = document.getElementById("score");

let mode = "bot";
let level = 1;
let running = false;

const paddleW = 12;
const paddleH = 120;
const MARGEM = 30;

const left = {
    x: 20,
    y: 200
};

const right = {
    x: 0,
    y: 200
};

const ball = {
    x: 0,
    y: 0,
    vx: 6,
    vy: 4,
    r: 10
};

let scoreL = 0;
let scoreR = 0;

function resetBall() {
    ball.x = canvas.width / 2;
    ball.y = canvas.height / 2;

    ball.vx =
        (Math.random() > 0.5 ? 1 : -1) *
        (5 + level);

    ball.vy = Math.random() * 6 - 3;
}

function limitarRaquetes() {

    if (left.y < MARGEM)
        left.y = MARGEM;

    if (left.y > canvas.height - paddleH - MARGEM)
        left.y = canvas.height - paddleH - MARGEM;

    if (right.y < MARGEM)
        right.y = MARGEM;

    if (right.y > canvas.height - paddleH - MARGEM)
        right.y = canvas.height - paddleH - MARGEM;
}

function startGame(gameMode, difficulty = 1) {

    mode = gameMode;
    level = difficulty;

    scoreL = 0;
    scoreR = 0;

    menu.classList.add("hidden");
    hud.classList.remove("hidden");

    running = true;

    left.y = canvas.height / 2 - paddleH / 2;

    right.x = canvas.width - 32;
    right.y = left.y;

    resetBall();
}

document.getElementById("singleBtn").onclick = () => {
    levels.classList.remove("hidden");
};

document.querySelectorAll(".lvl").forEach(btn => {

    btn.onclick = () => {

        startGame(
            "bot",
            Number(btn.dataset.level)
        );

    };

});

document.getElementById("multiBtn").onclick = () => {
    startGame("multi", 1);
};

document.getElementById("backBtn").onclick = () => {

    running = false;

    hud.classList.add("hidden");
    menu.classList.remove("hidden");

};

canvas.addEventListener(
    "touchmove",
    e => {

        e.preventDefault();

        for (const touch of e.touches) {

            if (mode === "multi") {

                if (touch.clientX < innerWidth / 2) {

                    left.y = Math.max(
                        MARGEM,
                        Math.min(
                            touch.clientY - paddleH / 2,
                            canvas.height - paddleH - MARGEM
                        )
                    );

                } else {

                    right.y = Math.max(
                        MARGEM,
                        Math.min(
                            touch.clientY - paddleH / 2,
                            canvas.height - paddleH - MARGEM
                        )
                    );

                }

            } else {

                left.y = Math.max(
                    MARGEM,
                    Math.min(
                        touch.clientY - paddleH / 2,
                        canvas.height - paddleH - MARGEM
                    )
                );

            }

        }

    },
    { passive: false }
);

function ai() {

    const speeds = [2, 3, 5, 7, 10];

    const speed =
        speeds[level - 1] || 5;

    const center =
        right.y + paddleH / 2;

    if (ball.y > center)
        right.y += speed;

    if (ball.y < center)
        right.y -= speed;
}

function update() {

    if (!running) return;

    ball.x += ball.vx;
    ball.y += ball.vy;

    if (
        ball.y < ball.r + MARGEM ||
        ball.y > canvas.height - ball.r - MARGEM
    ) {
        ball.vy *= -1;
    }

    if (
        ball.x - ball.r <
            left.x + paddleW &&
        ball.y > left.y &&
        ball.y < left.y + paddleH
    ) {
        ball.vx =
            Math.abs(ball.vx) + 0.2;
    }

    if (
        ball.x + ball.r > right.x &&
        ball.y > right.y &&
        ball.y < right.y + paddleH
    ) {
        ball.vx =
            -Math.abs(ball.vx) - 0.2;
    }

    if (ball.x < 0) {

        scoreR++;
        resetBall();

    }

    if (ball.x > canvas.width) {

        scoreL++;
        resetBall();

    }

    if (mode === "bot") {
        ai();
    }

    limitarRaquetes();

    scoreEl.textContent =
        `${scoreL} x ${scoreR}`;
}

function draw() {

    ctx.clearRect(
        0,
        0,
        canvas.width,
        canvas.height
    );

    ctx.strokeStyle = "#00f7ff";

    ctx.setLineDash([10, 10]);

    ctx.beginPath();
    ctx.moveTo(canvas.width / 2, 0);
    ctx.lineTo(
        canvas.width / 2,
        canvas.height
    );
    ctx.stroke();

    ctx.setLineDash([]);

    ctx.shadowBlur = 20;
    ctx.shadowColor = "#00f7ff";

    ctx.fillStyle = "#00f7ff";

    ctx.fillRect(
        left.x,
        left.y,
        paddleW,
        paddleH
    );

    ctx.fillRect(
        right.x,
        right.y,
        paddleW,
        paddleH
    );

    ctx.beginPath();

    ctx.arc(
        ball.x,
        ball.y,
        ball.r,
        0,
        Math.PI * 2
    );

    ctx.fill();
}

function loop() {

    update();
    draw();

    requestAnimationFrame(loop);
}

loop();
