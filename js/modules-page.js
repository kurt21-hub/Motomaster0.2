/**
 * modules.html — sync cards, tabs, search, overall progress, and activity from mod_progress_* keys.
 */
(function () {
    const MODULES = [
        { key: 'mod_progress_enginemodule', href: 'enginemodule.html', title: 'Engine Oil Change' },
        { key: 'mod_progress_brakemodule', href: 'brakemodule.html', title: 'Brake Pad Replacement' },
        { key: 'mod_progress_airmodule', href: 'airmodule.html', title: 'Air Filter Replacement' },
        { key: 'mod_progress_fuelmodule', href: 'fuelmodule.html', title: 'Fuel Filter Replacement' },
        { key: 'mod_progress_batterymodule', href: 'batterymodule.html', title: 'Battery Maintenance' },
        { key: 'mod_progress_sparkmodule', href: 'sparkmodule.html', title: 'Spark Plug Replacement' }
    ];

    const RING_RADIUS = 39;
    const RING_CIRC = 2 * Math.PI * RING_RADIUS;
    let activeFilter = 'all';

    function getStatusInfo(pct) {
        if (pct >= 100) return { cls: 'completed', label: 'Completed' };
        if (pct > 0) return { cls: 'in-progress', label: 'In Progress' };
        return { cls: 'not-started', label: 'Not Started' };
    }

    function getModulePct(key) {
        if (!window.ModuleProgress) return 0;
        return ModuleProgress.readStored(key);
    }

    function collectModuleProgress() {
        return MODULES.map((meta) => ({
            ...meta,
            pct: getModulePct(meta.key)
        }));
    }

    function computeOverall(pcts) {
        const total = MODULES.length;
        const completed = pcts.filter((p) => p >= 100).length;
        const avg = total
            ? Math.round(pcts.reduce((sum, v) => sum + v, 0) / total)
            : 0;
        return { avg, completed, total };
    }

    function applyCardProgress(card, pct) {
        const fill = card.querySelector('.mod-progress-fill');
        const pctEl = card.querySelector('.mod-progress-pct');
        const statusEl = card.querySelector('.mod-status');
        const finalPct = window.ModuleProgress ? ModuleProgress.clampPct(pct) : Math.max(0, Math.min(100, pct | 0));

        card.dataset.progressPct = String(finalPct);

        if (statusEl) {
            const { cls, label } = getStatusInfo(finalPct);
            statusEl.className = 'mod-status ' + cls;
            statusEl.textContent = label;
        }

        if (pctEl) pctEl.textContent = finalPct + '% complete';

        if (fill) {
            fill.style.transition = 'none';
            fill.style.width = '0%';
            requestAnimationFrame(() => {
                requestAnimationFrame(() => {
                    fill.style.transition = 'width 0.9s cubic-bezier(0.4,0,0.2,1)';
                    fill.style.width = finalPct + '%';
                });
            });
        }

        return finalPct;
    }

    function countByStatus(pcts) {
        let completed = 0;
        let inProgress = 0;
        let notStarted = 0;
        pcts.forEach((pct) => {
            if (pct >= 100) completed += 1;
            else if (pct > 0) inProgress += 1;
            else notStarted += 1;
        });
        return { completed, inProgress, notStarted };
    }

    function updateTabLabels(counts) {
        const tabs = document.querySelectorAll('.tabs-row .tab');
        const labels = [
            'All Modules (' + MODULES.length + ')',
            'In Progress (' + counts.inProgress + ')',
            'Completed (' + counts.completed + ')',
            'Not Started (' + counts.notStarted + ')'
        ];
        tabs.forEach((tab, i) => {
            if (labels[i]) tab.textContent = labels[i];
        });
    }

    function updateHeroStats(overall) {
        const completedEl = document.getElementById('heroCompletedCount');
        if (completedEl) completedEl.textContent = String(overall.completed);
    }

    function updateOverallRing(overall) {
        const ringFill = document.getElementById('overallProgressRingFill');
        const ringPct = document.getElementById('overallProgressPct');
        const captionEl = document.getElementById('overallProgressCaption');

        const avg = overall.avg;
        const offset = RING_CIRC - (RING_CIRC * avg / 100);

        if (ringFill) {
            ringFill.style.strokeDasharray = String(RING_CIRC);
            ringFill.style.strokeDashoffset = String(offset);
        }
        if (ringPct) ringPct.textContent = avg + '%';
        if (captionEl) {
            captionEl.innerHTML =
                '<strong>' + overall.completed + ' of ' + overall.total + '</strong> modules completed';
        }
    }

    function activitySubText(pct) {
        if (pct >= 100) return 'Module completed';
        if (pct > 0) return 'In progress — ' + pct + '%';
        return 'Not started';
    }

    function activityDotClass(pct) {
        if (pct >= 100) return 'green';
        if (pct > 0) return 'orange';
        return 'blue';
    }

    function activityIcon(pct) {
        if (pct >= 100) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12"/></svg>';
        }
        if (pct > 0) {
            return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><circle cx="12" cy="12" r="9"/><polyline points="12 7 12 12 15 15"/></svg>';
        }
        return '<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2"><polyline points="9 18 15 12 9 6"/></svg>';
    }

    function updateRecentActivity(rows) {
        const list = document.getElementById('recentActivityList');
        if (!list) return;

        const sorted = rows
            .slice()
            .sort((a, b) => {
                if (b.pct !== a.pct) return b.pct - a.pct;
                return a.title.localeCompare(b.title);
            })
            .slice(0, 4);

        if (!sorted.length) {
            list.innerHTML = '<div style="font-size:0.72rem;color:#9ca3af;padding:8px 0;">No module activity yet.</div>';
            return;
        }

        list.innerHTML = sorted.map((row) => `
            <div class="activity-item">
                <div class="activity-dot ${activityDotClass(row.pct)}">${activityIcon(row.pct)}</div>
                <div class="activity-info">
                    <div class="activity-name">${row.title}</div>
                    <div class="activity-sub">${activitySubText(row.pct)}</div>
                </div>
            </div>
        `).join('');
    }

    function cardMatchesFilter(pct, filter) {
        if (filter === 'all') return true;
        if (filter === 'completed') return pct >= 100;
        if (filter === 'in-progress') return pct > 0 && pct < 100;
        if (filter === 'not-started') return pct === 0;
        return true;
    }

    function applyFilters() {
        const cards = document.querySelectorAll('.mod-card');
        const query = (document.querySelector('.search-wrap input')?.value || '').trim().toLowerCase();

        cards.forEach((card) => {
            const pct = parseInt(card.dataset.progressPct || '0', 10);
            const title = (card.querySelector('.mod-card-title')?.textContent || '').toLowerCase();
            const matchesTab = cardMatchesFilter(pct, activeFilter);
            const matchesSearch = !query || title.includes(query);
            card.style.display = matchesTab && matchesSearch ? '' : 'none';
        });
    }

    function refreshModulesPage() {
        if (!window.ModuleProgress) return;

        const cards = document.querySelectorAll('.mod-card');
        const rows = collectModuleProgress();
        const pcts = [];

        cards.forEach((card, i) => {
            const meta = rows[i];
            if (!meta) return;
            pcts.push(applyCardProgress(card, meta.pct));

            const btn = card.querySelector('.mod-btn');
            if (btn && meta.href) btn.setAttribute('href', meta.href);
        });

        const counts = countByStatus(pcts);
        const overall = computeOverall(pcts);

        updateTabLabels(counts);
        updateHeroStats(overall);
        updateOverallRing(overall);
        updateRecentActivity(rows);
        applyFilters();
    }

    function initTabs() {
        const tabs = document.querySelectorAll('.tabs-row .tab');
        const filters = ['all', 'in-progress', 'completed', 'not-started'];

        tabs.forEach((tab, i) => {
            tab.addEventListener('click', () => {
                tabs.forEach((t) => t.classList.remove('active'));
                tab.classList.add('active');
                activeFilter = filters[i] || 'all';
                applyFilters();
            });
        });
    }

    function initSearch() {
        const input = document.querySelector('.search-wrap input');
        if (!input) return;
        input.addEventListener('input', applyFilters);
    }

    function initViewProgressBtn() {
        const btn = document.getElementById('viewProgressBtn');
        const grid = document.querySelector('.mod-grid');
        if (!btn || !grid) return;
        btn.addEventListener('click', () => {
            grid.scrollIntoView({ behavior: 'smooth', block: 'start' });
        });
    }

    function initStorageSync() {
        window.addEventListener('storage', (e) => {
            if (e.key && e.key.indexOf('mod_progress_') === 0) {
                refreshModulesPage();
            }
        });
        window.addEventListener('motomaster-module-progress', refreshModulesPage);
        document.addEventListener('visibilitychange', () => {
            if (!document.hidden) refreshModulesPage();
        });
    }

    async function init() {
        if (!window.ModuleProgress) {
            console.warn('module-progress.js must load before modules-page.js');
            return;
        }
        initTabs();
        initSearch();
        initViewProgressBtn();
        initStorageSync();
        await ModuleProgress.ensureLoaded();
        refreshModulesPage();
    }

    function reloadFromServer() {
        if (!window.ModuleProgress) return Promise.resolve();
        ModuleProgress.resetLoaded();
        return ModuleProgress.ensureLoaded().then(refreshModulesPage);
    }

    window.refreshModulesPage = refreshModulesPage;
    window.reloadModulesProgress = reloadFromServer;

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', () => { init(); });
    } else {
        init();
    }
    window.addEventListener('pageshow', () => { reloadFromServer(); });
    window.addEventListener('focus', () => { reloadFromServer(); });
})();
