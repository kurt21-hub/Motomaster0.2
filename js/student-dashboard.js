/**
 * js/student-dashboard.js
 * Controls student dashboard metrics, sidebar widgets, activity timelines, and modal overlays.
 */
(function (global) {
    const MODULES = [
        { key: 'mod_progress_enginemodule', href: 'enginemodule.html', title: 'Engine Oil Change', icon: '⚙️' },
        { key: 'mod_progress_brakemodule', href: 'brakemodule.html', title: 'Brake Pad Replacement', icon: '🔧' },
        { key: 'mod_progress_airmodule', href: 'airmodule.html', title: 'Air Filter Replacement', icon: '💨' },
        { key: 'mod_progress_fuelmodule', href: 'fuelmodule.html', title: 'Fuel Filter Replacement', icon: '🔩' },
        { key: 'mod_progress_batterymodule', href: 'batterymodule.html', title: 'Battery Maintenance', icon: '🔋' },
        { key: 'mod_progress_sparkmodule', href: 'sparkmodule.html', title: 'Spark Plug Replacement', icon: '⚡' }
    ];

    const RING_RADIUS = 34;
    const RING_CIRC = 2 * Math.PI * RING_RADIUS; // 213.628

    const SVG_ICONS = {
        module: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><path d="M4 19.5A2.5 2.5 0 0 1 6.5 17H20" /><path d="M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2z" /></svg>`,
        practice: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><circle cx="12" cy="12" r="10" /><polygon points="10 8 16 12 10 16 10 8" /></svg>`,
        assessment: `<svg viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2.5"><polyline points="20 6 9 17 4 12" /></svg>`
    };

    // Inject orange dot styles dynamically
    function injectOrangeStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .act-dot.orange { background: #fff7ed; }
            .act-dot.orange svg { color: #ea580c; }
        `;
        document.head.appendChild(style);
    }

    // Retrieve student info from storage
    function applyStudentProfile() {
        try {
            const stored = global.localStorage.getItem('motomasterStudent') || global.sessionStorage.getItem('motomasterStudent');
            if (!stored) return;
            const student = JSON.parse(stored);
            const fullName = [student.first_name, student.last_name].filter(Boolean).join(' ').trim();
            if (fullName) {
                const nameEl = document.getElementById('studentFullName');
                if (nameEl) nameEl.textContent = fullName;
            }
        } catch (err) {
            console.warn('Could not parse student profile from storage', err);
        }
    }

    // Helper: format timestamps to human friendly relative times
    function formatActivityTime(dateStr) {
        if (!dateStr) return '—';
        const date = new Date(dateStr.replace(/-/g, '/')); // Handle SQL timestamp compatibility
        if (isNaN(date.getTime())) return dateStr;

        const now = new Date();
        const diffMs = now - date;
        const diffMins = Math.floor(diffMs / 60000);
        const diffHours = Math.floor(diffMins / 60);

        if (diffMins < 1) return 'Just now';
        if (diffMins < 60) return diffMins + 'm ago';
        if (diffHours < 24) {
            if (date.getDate() === now.getDate()) {
                return diffHours + 'h ago';
            }
        }

        const yesterday = new Date(now);
        yesterday.setDate(yesterday.getDate() - 1);
        if (date.getDate() === yesterday.getDate() && date.getMonth() === yesterday.getMonth() && date.getFullYear() === yesterday.getFullYear()) {
            return 'Yesterday';
        }

        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric', year: 'numeric' });
    }

    // Setup modal show/hide triggers
    function initModals() {
        const triggers = [
            { btnId: 'viewProgressBtn', modalId: 'progressModal' },
            { btnId: 'viewAllActivityLink', modalId: 'activityModal' }
        ];

        triggers.forEach(({ btnId, modalId }) => {
            const btn = document.getElementById(btnId);
            const modal = document.getElementById(modalId);
            if (!btn || !modal) return;

            // Open modal
            btn.addEventListener('click', (e) => {
                e.preventDefault();
                modal.classList.add('active');
                document.body.style.overflow = 'hidden';
            });

            // Close modal via close button
            const closeBtn = modal.querySelector('.modal-close');
            if (closeBtn) {
                closeBtn.addEventListener('click', () => {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                });
            }

            // Close modal via backdrop click
            modal.addEventListener('click', (e) => {
                if (e.target === modal) {
                    modal.classList.remove('active');
                    document.body.style.overflow = '';
                }
            });
        });
    }

    // Main fetch & rendering controller
    async function loadDashboardData() {
        try {
            // Concurrent fetches
            const [progRes, pracRes, assessRes] = await Promise.all([
                fetch('student_progress.php').then(r => r.json()),
                fetch('get_practice_progress.php?title=all').then(r => r.json()),
                fetch('get_assessment_progress.php?title=all').then(r => r.json())
            ]);

            const progress = progRes.success ? (progRes.progress || {}) : {};
            const progressDetails = progRes.success ? (progRes.progress_details || []) : [];
            const practices = pracRes.success ? (pracRes.progress || []) : [];
            const assessments = assessRes.success ? (assessRes.progress || []) : [];

            // 1. Calculations
            // Modules progress
            const totalModulesCount = MODULES.length;
            let completedModulesCount = 0;
            let totalModuleProgressSum = 0;

            MODULES.forEach(m => {
                const pct = progress[m.key] || 0;
                totalModuleProgressSum += pct;
                if (pct >= 100) {
                    completedModulesCount++;
                }
            });
            const avgModulesPct = totalModulesCount ? (totalModuleProgressSum / totalModulesCount) : 0;

            // Practice progress
            const totalPracticesCount = 6;
            let completedPracticesCount = 0;
            practices.forEach(p => {
                if (p.completion_status === 'Completed') {
                    completedPracticesCount++;
                }
            });
            const avgPracticePct = totalPracticesCount ? (completedPracticesCount / totalPracticesCount * 100) : 0;

            // Assessment progress
            const totalAssessmentsCount = 6;
            let completedAssessmentsCount = 0;
            let totalAssessmentScore = 0;
            assessments.forEach(a => {
                if (a.completion_status === 'Completed') {
                    completedAssessmentsCount++;
                    totalAssessmentScore += parseFloat(a.score) || 0;
                }
            });
            const avgAssessmentsPct = totalAssessmentsCount ? (completedAssessmentsCount / totalAssessmentsCount * 100) : 0;

            // Combined overall progress
            const overallProgressPercentage = Math.round((avgModulesPct + avgPracticePct + avgAssessmentsPct) / 3);

            // Average score of completed assessments
            const averageAssessmentScore = completedAssessmentsCount ? Math.round(totalAssessmentScore / completedAssessmentsCount) : 0;

            // 2. Update Stats Footer
            const elTotal = document.getElementById('footerTotalModules');
            const elCompleted = document.getElementById('footerCompletedModules');
            const elAssessments = document.getElementById('footerAssessments');
            const elAvgScore = document.getElementById('footerAverageScore');

            if (elTotal) elTotal.textContent = totalModulesCount;
            if (elCompleted) elCompleted.textContent = completedModulesCount;
            if (elAssessments) elAssessments.textContent = completedAssessmentsCount;
            if (elAvgScore) elAvgScore.textContent = averageAssessmentScore + '%';

            // 3. Update Sidebar Overall Progress Widget
            const elRingFill = document.getElementById('overallProgressRingFill');
            const elPctText = document.getElementById('overallProgressPct');
            const elCaption = document.getElementById('overallProgressCaption');

            if (elRingFill) {
                const offset = RING_CIRC - (RING_CIRC * overallProgressPercentage / 100);
                elRingFill.style.strokeDasharray = String(RING_CIRC);
                elRingFill.style.strokeDashoffset = String(offset);
            }
            if (elPctText) {
                elPctText.innerHTML = `<strong>${overallProgressPercentage}%</strong><small>Completed</small>`;
            }
            if (elCaption) {
                elCaption.innerHTML = `<strong>${completedModulesCount}/6</strong> Mod | <strong>${completedPracticesCount}/6</strong> Prac | <strong>${completedAssessmentsCount}/6</strong> Assess`;
            }

            // 4. Construct Chronological Activity Log
            const activities = [];

            // Module reads activity mapping
            progressDetails.forEach(detail => {
                if (detail.progress_percent > 0) {
                    const match = MODULES.find(m => m.key === detail.module_key);
                    const title = match ? match.title : detail.module_key;
                    activities.push({
                        type: 'module',
                        title: title + ' Module',
                        status: detail.progress_percent === 100 ? 'Completed' : 'In Progress',
                        statusText: detail.progress_percent === 100 ? 'Completed' : `In Progress (${detail.progress_percent}%)`,
                        timeStr: formatActivityTime(detail.date_updated),
                        dateObj: new Date(detail.date_updated.replace(/-/g, '/'))
                    });
                }
            });

            // Practice simulation attempts mapping
            practices.forEach(p => {
                activities.push({
                    type: 'practice',
                    title: p.title + ' Simulation',
                    status: p.completion_status || 'Attempted',
                    statusText: p.score !== null ? `Score: ${Math.round(p.score)}%` : 'Completed',
                    timeStr: formatActivityTime(p.date_attempted),
                    dateObj: new Date(p.date_attempted.replace(/-/g, '/'))
                });
            });

            // Assessment attempts mapping
            assessments.forEach(a => {
                activities.push({
                    type: 'assessment',
                    title: a.title,
                    status: a.remarks || 'Passed',
                    statusText: a.score !== null ? `Score: ${Math.round(a.score)}%` : 'Passed',
                    timeStr: formatActivityTime(a.date_taken),
                    dateObj: new Date(a.date_taken.replace(/-/g, '/'))
                });
            });

            // Sort activities newest first
            activities.sort((a, b) => b.dateObj - a.dateObj);

            // 5. Update Sidebar Recent Activity (Max 3 items)
            const elRecentList = document.getElementById('recentActivityList');
            if (elRecentList) {
                if (activities.length === 0) {
                    elRecentList.innerHTML = `<div style="font-size:0.75rem;color:#9ca3af;text-align:center;padding:12px 0;">No module activity yet.</div>`;
                } else {
                    const recent = activities.slice(0, 10);
                    elRecentList.innerHTML = recent.map(act => {
                        const dotClass = act.type === 'module' ? 'blue' : (act.type === 'practice' ? 'orange' : '');
                        return `
                            <div class="activity-item">
                                <div class="act-dot ${dotClass}">
                                    ${SVG_ICONS[act.type] || SVG_ICONS.module}
                                </div>
                                <div class="act-info">
                                    <div class="act-name">${act.title}</div>
                                    <div class="act-status ${act.type === 'module' ? 'blue' : ''}">&#9679; ${act.status}</div>
                                </div>
                                <div class="act-time">${act.timeStr}</div>
                            </div>
                        `;
                    }).join('');
                }
            }

            // 6. Populate Activity Modal List (All logs)
            const elActivityModalList = document.getElementById('activityModalList');
            if (elActivityModalList) {
                if (activities.length === 0) {
                    elActivityModalList.innerHTML = `<div style="font-size:0.85rem;color:#94a3b8;text-align:center;padding:24px 0;">No activities registered in your profile yet.</div>`;
                } else {
                    elActivityModalList.innerHTML = activities.map(act => `
                        <div class="act-modal-item">
                            <div class="act-modal-icon-wrap ${act.type}">
                                ${SVG_ICONS[act.type] || SVG_ICONS.module}
                            </div>
                            <div class="act-modal-content">
                                <div class="act-modal-title">${act.title}</div>
                                <div class="act-modal-meta">
                                    <span class="act-modal-status-badge">${act.statusText}</span>
                                    <span>&bull;</span>
                                    <span>${act.status}</span>
                                </div>
                            </div>
                            <div class="act-modal-time">${act.timeStr}</div>
                        </div>
                    `).join('');
                }
            }

            // 7. Populate Progress Modal List (Modules breakdown)
            const elProgressModalList = document.getElementById('progressModalList');
            if (elProgressModalList) {
                elProgressModalList.innerHTML = MODULES.map(m => {
                    const moduleProgressPct = progress[m.key] || 0;
                    
                    // Match Practice
                    const practice = practices.find(p => p.title.toLowerCase() === m.title.toLowerCase());
                    const practiceText = practice ? `${Math.round(practice.score)}% Score` : 'Not Started';
                    const practiceClass = practice ? (practice.completion_status === 'Completed' ? 'completed' : 'in-progress') : 'not-started';

                    // Match Assessment
                    const assessment = assessments.find(a => a.title.toLowerCase().indexOf(m.title.toLowerCase()) !== -1);
                    const assessmentText = assessment ? `${Math.round(assessment.score)}% Score` : (moduleProgressPct >= 100 ? 'Unlocked' : 'Locked');
                    const assessmentClass = assessment ? 'completed' : (moduleProgressPct >= 100 ? 'in-progress' : 'not-started');

                    let statusClass = 'not-started';
                    let statusLabel = 'Not Started';
                    if (moduleProgressPct >= 100) {
                        statusClass = 'completed';
                        statusLabel = 'Completed';
                    } else if (moduleProgressPct > 0) {
                        statusClass = 'in-progress';
                        statusLabel = 'In Progress';
                    }

                    return `
                        <div class="prog-module-card">
                            <div class="prog-module-header">
                                <div class="prog-module-title-wrap">
                                    <span class="prog-module-icon">${m.icon}</span>
                                    <span class="prog-module-title">${m.title}</span>
                                </div>
                                <span class="prog-status-badge ${statusClass}">${statusLabel}</span>
                            </div>
                            
                            <div class="prog-bar-container">
                                <div class="prog-bar-label-row">
                                    <span>Reading Progress</span>
                                    <strong>${moduleProgressPct}%</strong>
                                </div>
                                <div class="prog-bar-bg">
                                    <div class="prog-bar-fill" style="width: ${moduleProgressPct}%"></div>
                                </div>
                            </div>
                            
                            <div class="prog-activities-row">
                                <div class="prog-activity-subitem">
                                    <span>Practice Simulation</span>
                                    <strong class="prog-status-badge ${practiceClass}" style="padding:2px 6px; width:fit-content; border-radius:4px; font-size:0.65rem;">${practiceText}</strong>
                                </div>
                                <div class="prog-activity-subitem">
                                    <span>Assessment Quiz</span>
                                    <strong class="prog-status-badge ${assessmentClass}" style="padding:2px 6px; width:fit-content; border-radius:4px; font-size:0.65rem;">${assessmentText}</strong>
                                </div>
                            </div>
                        </div>
                    `;
                }).join('');
            }

        } catch (err) {
            console.error('Failed to load dashboard statistics', err);
        }
    }

    // Initialize scripts
    function init() {
        injectOrangeStyles();
        applyStudentProfile();
        initModals();
        loadDashboardData();
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
