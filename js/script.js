// --- 1. CONFIGURAÇÃO DO CANVAS PARA QUALQUER RESOLUÇÃO/CELULAR ---
const canvas = document.querySelector("canvas"); // Certifique-se de que o canvas está selecionado

if (canvas) {
    // Função unificada para pegar a coordenada exata em qualquer tela
    const getCanvasCoordinates = (e) => {
        const rect = canvas.getBoundingClientRect();
        
        // Fator de escala: proporção entre o tamanho interno e o tamanho na tela (CSS)
        const scaleX = canvas.width / rect.width;
        const scaleY = canvas.height / rect.height;

        // Verifica se é um evento de toque (mobile) ou mouse (PC)
        const clientX = e.touches ? e.touches[0].clientX : e.clientX;
        const clientY = e.touches ? e.touches[0].clientY : e.clientY;

        // Calcula a posição exata ajustada para a resolução do jogo
        const x = (clientX - rect.left) * scaleX;
        const y = (clientY - rect.top) * scaleY;

        return { x, y };
    };

    // Evento de clique para Mouse (Desktop)
    canvas.addEventListener("click", (e) => {
        const coords = getCanvasCoordinates(e);
        console.log("MOUSE CLICK CANVAS:", coords.x, coords.y);
        // Coloque sua lógica de jogo aqui usando coords.x e coords.y
    });

    // Evento de toque para Celulares (Mobile)
    canvas.addEventListener("touchstart", (e) => {
        // e.preventDefault(); // Descomente se a tela do celular estiver rolando quando você toca no jogo
        const coords = getCanvasCoordinates(e);
        console.log("TOUCH CANVAS:", coords.x, coords.y);
        // Coloque sua lógica de jogo aqui usando coords.x e coords.y
    }, { passive: true });
}

// --- 2. ANIMAÇÕES FADE-IN ---
const fadeElements = document.querySelectorAll(".fade-in");

if ("IntersectionObserver" in window) {
    const observer = new IntersectionObserver((entries) => {
        entries.forEach((entry) => {
            if (entry.isIntersecting) {
                entry.target.classList.add("show");
                observer.unobserve(entry.target);
            }
        });
    }, { threshold: 0.1 });

    fadeElements.forEach((element) => observer.observe(element));
} else {
    fadeElements.forEach((element) => element.classList.add("show"));
}

// --- 3. NAVEGAÇÃO ATIVA ---
const currentPage = document.body.dataset.page;
const navLinks = document.querySelectorAll("nav a[data-page]");

if (currentPage) {
    const updateActiveNavigation = () => {
        const activePage = currentPage === "ia" && window.location.hash === "#ia-programacao"
            ? "ia-programacao"
            : currentPage;

        navLinks.forEach((link) => {
            link.classList.remove("is-active");
            link.removeAttribute("aria-current");

            if (link.dataset.page !== activePage) {
                return;
            }

            link.classList.add("is-active");
            link.setAttribute("aria-current", "page");
        });
    };

    updateActiveNavigation();
    window.addEventListener("hashchange", updateActiveNavigation);
}

// --- 4. SERVICE WORKER (PWA) ---
if ("serviceWorker" in navigator && ["http:", "https:"].includes(window.location.protocol)) {
    window.addEventListener("load", () => {
        navigator.serviceWorker.register("./service-worker.js").catch(() => {
            // O site continua funcionando normalmente se o navegador bloquear o PWA.
        });
    });
}
