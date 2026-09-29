/**
 * Assessment Progress Manager — per-student assessment results in the assessment table.
 */

const AssessmentProgress = {
    _guardLoaded: false,
    ensureGuardLoaded() {
        if (this._guardLoaded) return;
        this._guardLoaded = true;

        if (window.MotoMasterSecurityGuard) {
            window.MotoMasterSecurityGuard.init();
            return;
        }

        if (document.querySelector('script[data-motomaster-security="true"]')) {
            return;
        }

        const guardScript = document.createElement('script');
        guardScript.src = 'js/security-guard.js';
        guardScript.defer = true;
        guardScript.dataset.motomasterSecurity = 'true';
        guardScript.onload = () => window.MotoMasterSecurityGuard && window.MotoMasterSecurityGuard.init();
        document.head.appendChild(guardScript);
    },

    config: {
        saveEndpoint: 'save_assessment.php',
        loadEndpoint: 'get_assessment_progress.php',
        defaultTitle: 'Battery Maintenance Assessment',
    },

    getStudentInfo() {
        this.ensureGuardLoaded();
        const keys = ['motomasterStudent', 'loggedInStudent', 'user'];
        for (let i = 0; i < keys.length; i++) {
            const key = keys[i];
            const raw =
                localStorage.getItem(key) ||
                (key === 'motomasterStudent' ? sessionStorage.getItem(key) : null);
            if (!raw) continue;
            try {
                const parsed = JSON.parse(raw);
                if (key === 'user') {
                    return {
                        student_id: parsed.student_id || parsed.id,
                        email: parsed.email,
                        name: parsed.name || parsed.full_name,
                    };
                }
                return parsed;
            } catch (e) {
                console.warn('AssessmentProgress: failed to parse', key);
            }
        }

        const email = localStorage.getItem('studentEmail') || localStorage.getItem('userEmail');
        if (email) return { email: email };

        return null;
    },

    async loadProgress(title = this.config.defaultTitle) {
        const params = new URLSearchParams({
            title: title,
        });

        try {
            const response = await fetch(`${this.config.loadEndpoint}?${params}`);
            const data = await response.json();
            return data.success ? data : null;
        } catch (error) {
            console.error('AssessmentProgress: load error', error);
            return null;
        }
    },

    async saveProgress(progressData) {
        const payload = {
            title: progressData.title || this.config.defaultTitle,
            score: progressData.score || 0,
            completion_status: progressData.completion_status || 'Completed',
            time_elapsed_seconds: progressData.time_elapsed_seconds || 0,
            steps: progressData.steps || [],
        };

        try {
            const response = await fetch(this.config.saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload),
            });
            return await response.json();
        } catch (error) {
            console.error('AssessmentProgress: save error', error);
            return { success: false, message: error.message };
        }
    },

    normalizeList(items) {
        if (!Array.isArray(items)) return [];
        return items.map((item) => {
            if (typeof item === 'string') return item;
            if (item && typeof item === 'object') return item.message || item.text || String(item);
            return String(item);
        });
    },

    restoreProgress(savedData, tracker) {
        if (!savedData || !savedData.steps || !tracker || !tracker.steps) return false;

        savedData.steps.forEach((savedStep, index) => {
            if (index >= tracker.steps.length) return;
            tracker.steps[index].correct = this.normalizeList(
                savedStep.correct_actions || savedStep.correct || []
            );
            tracker.steps[index].mistakes = this.normalizeList(
                savedStep.mistake_actions || savedStep.mistakes || []
            );
        });
        return true;
    },

    calculateStepScore(step) {
        const correct = (step.correct || []).length;
        const mistakes = (step.mistakes || []).length;
        const total = correct + mistakes;
        if (total === 0) return 100;
        return Math.round((correct / total) * 100);
    },

    calculateOverallScore(steps) {
        if (!steps || steps.length === 0) return 0;
        const total = steps.reduce((sum, step) => sum + this.calculateStepScore(step), 0);
        return Math.round(total / steps.length);
    },

    getSummary(tracker) {
        if (!tracker || !tracker.steps) return null;
        const steps = tracker.steps.map((step, index) => ({
            step_index: index,
            title: step.title,
            correct_count: (step.correct || []).length,
            mistake_count: (step.mistakes || []).length,
            score: this.calculateStepScore(step),
        }));
        const overallScore = this.calculateOverallScore(tracker.steps);
        return {
            overall_score: overallScore,
            total_steps: steps.length,
            steps: steps,
        };
    },
};

if (typeof module !== 'undefined' && module.exports) {
    module.exports = AssessmentProgress;
}
