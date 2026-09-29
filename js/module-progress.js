/**
 * Learning-module progress per student: local cache + database (student_module_progress).
 */
(function (global) {
    function loadMotoMasterSecurityGuard() {
        if (global.MotoMasterSecurityGuard) {
            global.MotoMasterSecurityGuard.init();
            return;
        }

        if (document.querySelector('script[data-motomaster-security="true"]')) {
            return;
        }

        const guardScript = document.createElement('script');
        guardScript.src = 'js/security-guard.js';
        guardScript.defer = true;
        guardScript.dataset.motomasterSecurity = 'true';
        guardScript.onload = () => global.MotoMasterSecurityGuard && global.MotoMasterSecurityGuard.init();
        document.head.appendChild(guardScript);
    }

    loadMotoMasterSecurityGuard();

    const BOTTOM_THRESHOLD_PX = 48;
    const progressCache = {};
    let loadPromise = null;
    let saveTimers = {};

    function clampPct(value) {
        const n = parseInt(value, 10);
        if (isNaN(n)) return 0;
        return Math.max(0, Math.min(100, n));
    }

    function getLoggedInStudent() {
        try {
            const raw = global.localStorage.getItem('motomasterStudent') ||
                global.sessionStorage.getItem('motomasterStudent');
            return raw ? JSON.parse(raw) : null;
        } catch (e) {
            return null;
        }
    }

    function getStudentId() {
        const student = getLoggedInStudent();
        if (!student) return null;
        const id = parseInt(student.student_id, 10);
        return isNaN(id) ? null : id;
    }

    function scopedStorageKey(storageKey) {
        const studentId = getStudentId();
        if (studentId === null) return storageKey;
        return storageKey + '_s' + studentId;
    }

    function readStored(storageKey) {
        if (progressCache[storageKey] !== undefined) {
            return clampPct(progressCache[storageKey]);
        }
        const scoped = scopedStorageKey(storageKey);
        const fromScoped = global.localStorage.getItem(scoped);
        if (fromScoped !== null) {
            return clampPct(fromScoped);
        }
        const legacy = global.localStorage.getItem(storageKey);
        return clampPct(legacy);
    }

    function writeLocal(storageKey, pct) {
        const value = String(clampPct(pct));
        progressCache[storageKey] = clampPct(pct);
        global.localStorage.setItem(scopedStorageKey(storageKey), value);
    }

    function ensureLoaded() {
        if (loadPromise) return loadPromise;

        loadPromise = (async () => {
            try {
                const res = await fetch('student_progress.php');
                const data = await res.json();
                if (!res.ok || !data.success || !data.progress) return;

                const sid = data.student_id || getStudentId();
                Object.keys(data.progress).forEach((key) => {
                    const pct = clampPct(data.progress[key]);
                    progressCache[key] = pct;
                    if (sid !== null) {
                        global.localStorage.setItem(key + '_s' + sid, String(pct));
                    }
                });

                if (data.student_id && student.student_id !== data.student_id) {
                    student.student_id = data.student_id;
                    const serialized = JSON.stringify(student);
                    global.localStorage.setItem('motomasterStudent', serialized);
                    global.sessionStorage.setItem('motomasterStudent', serialized);
                }
            } catch (e) {
                console.warn('Could not load progress from server', e);
            }
        })();

        return loadPromise;
    }

    function scheduleSave(storageKey, pct) {
        if (saveTimers[storageKey]) {
            clearTimeout(saveTimers[storageKey]);
        }

        saveTimers[storageKey] = setTimeout(async () => {
            try {
                await fetch('student_progress.php', {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        module_key: storageKey,
                        progress_percent: clampPct(pct)
                    })
                });
            } catch (e) {
                console.warn('Could not save progress to server', e);
            }
        }, 450);
    }

    function isAtBottom(lessonArea) {
        if (!lessonArea) return false;
        const remaining = lessonArea.scrollHeight - lessonArea.scrollTop - lessonArea.clientHeight;
        return remaining <= BOTTOM_THRESHOLD_PX;
    }

    function pctForIndex(activeIdx, total, atBottom) {
        if (total <= 0) return 0;
        if (atBottom) return 100;
        return Math.round((activeIdx / total) * 100);
    }

    function init(options) {
        return ensureLoaded().then(() => {
            const {
                storageKey,
                lessonArea,
                total,
                getActiveIndex,
                render
            } = options;

            let maxPct = readStored(storageKey);

            function apply(pct, activeIdx) {
                maxPct = Math.max(maxPct, clampPct(pct));
                writeLocal(storageKey, maxPct);
                scheduleSave(storageKey, maxPct);
                if (typeof render === 'function') {
                    render(maxPct, activeIdx);
                }
                try {
                    global.dispatchEvent(new CustomEvent('motomaster-module-progress', {
                        detail: { key: storageKey, pct: maxPct }
                    }));
                } catch (e) { /* ignore */ }
            }

            function update(activeIdx, forceComplete) {
                const idx = typeof activeIdx === 'number' ? activeIdx : 0;
                const atBottom = forceComplete || isAtBottom(lessonArea);
                const pct = pctForIndex(idx, total, atBottom);
                apply(pct, idx);
            }

            function onScroll() {
                update(getActiveIndex());
            }

            function complete() {
                apply(100, total > 0 ? total - 1 : 0);
            }

            return {
                update,
                onScroll,
                complete,
                getMaxPct() {
                    return maxPct;
                },
                restoreUI() {
                    const idx = getActiveIndex();
                    if (typeof render === 'function') {
                        render(maxPct, idx);
                    }
                }
            };
        });
    }

    function readStoredAsync(storageKey) {
        return ensureLoaded().then(() => readStored(storageKey));
    }

    global.ModuleProgress = {
        init,
        readStored,
        readStoredAsync,
        clampPct,
        ensureLoaded,
        getLoggedInStudent,
        getStudentId,
        _progressCache: progressCache,
        resetLoaded() {
            loadPromise = null;
        }
    };
})(window);
