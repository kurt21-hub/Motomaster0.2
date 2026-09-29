(function (window) {
    const WARNING_TEXT = 'Developer tools are not allowed while using MotoMaster.';
    const LOCK_CLASS = 'motomaster-security-lock';
    const OVERLAY_ID = 'motomaster-security-overlay';
    let overlayShown = false;

    function ensureStyles() {
        if (document.getElementById('motomaster-security-style')) return;

        const style = document.createElement('style');
        style.id = 'motomaster-security-style';
        style.textContent = `
            .${LOCK_CLASS} {
                overflow: hidden !important;
            }
            .${LOCK_CLASS} body > :not(#${OVERLAY_ID}) {
                filter: blur(10px) !important;
                pointer-events: none !important;
                user-select: none !important;
            }
            #${OVERLAY_ID} {
                position: fixed;
                inset: 0;
                z-index: 2147483647;
                display: flex;
                align-items: center;
                justify-content: center;
                background: rgba(9, 12, 24, 0.92);
                color: #fff;
                font-family: Arial, Helvetica, sans-serif;
                text-align: center;
                padding: 24px;
            }
            #${OVERLAY_ID} .mm-box {
                max-width: 520px;
                width: 100%;
                padding: 28px 24px;
                border-radius: 18px;
                background: rgba(17, 24, 39, 0.96);
                border: 1px solid rgba(255, 255, 255, 0.1);
                box-shadow: 0 30px 80px rgba(0, 0, 0, 0.45);
            }
            #${OVERLAY_ID} h1 {
                margin: 0 0 12px;
                font-size: 1.45rem;
                line-height: 1.2;
            }
            #${OVERLAY_ID} p {
                margin: 0;
                font-size: 1rem;
                line-height: 1.55;
                opacity: 0.9;
            }
        `;
        document.head.appendChild(style);
    }

    function showOverlay() {
        if (overlayShown) return;
        overlayShown = true;
        ensureStyles();

        document.documentElement.classList.add(LOCK_CLASS);

        let overlay = document.getElementById(OVERLAY_ID);
        if (!overlay) {
            overlay = document.createElement('div');
            overlay.id = OVERLAY_ID;
            overlay.innerHTML = `
                <div class="mm-box" role="alert" aria-live="assertive">
                    <h1>Access blocked</h1>
                    <p>${WARNING_TEXT}</p>
                </div>
            `;
            document.body.appendChild(overlay);
        }
    }

    function isDevToolsOpen() {
        const threshold = 160;
        return (
            window.outerWidth - window.innerWidth > threshold ||
            window.outerHeight - window.innerHeight > threshold
        );
    }

    function handleKeydown(event) {
        const key = String(event.key || '').toLowerCase();
        const ctrl = event.ctrlKey || event.metaKey;
        const shift = event.shiftKey;

        const blocked =
            key === 'f12' ||
            (ctrl && shift && ['i', 'j', 'c'].includes(key)) ||
            (ctrl && key === 'u');

        if (blocked) {
            event.preventDefault();
            event.stopPropagation();
            showOverlay();
        }
    }

    function handleContextMenu(event) {
        event.preventDefault();
    }

    function monitorDevTools() {
        if (isDevToolsOpen()) {
            showOverlay();
        }
    }

    function init() {
        if (window.__MotoMasterSecurityGuardInitialized) return;
        window.__MotoMasterSecurityGuardInitialized = true;

        document.addEventListener('keydown', handleKeydown, true);
        document.addEventListener('contextmenu', handleContextMenu, true);
        window.addEventListener('resize', monitorDevTools, { passive: true });
        window.addEventListener('blur', monitorDevTools, { passive: true });
        setInterval(monitorDevTools, 1000);
    }

    window.MotoMasterSecurityGuard = {
        init,
        showOverlay,
    };

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init, { once: true });
    } else {
        init();
    }
})(window);