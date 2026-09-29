/**
 * Practice Progress Manager
 * Handles loading and saving practice simulation progress per user account
 */

const PracticeProgress = {
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

    // Configuration
    config: {
        saveEndpoint: 'save_practice_simulation.php',
        loadEndpoint: 'get_practice_progress.php',
        defaultTitle: 'Battery Maintenance'
    },

    /**
     * Get logged in student info from localStorage or session
     */
    getStudentInfo() {
        this.ensureGuardLoaded();
        const motomaster =
            localStorage.getItem('motomasterStudent') ||
            sessionStorage.getItem('motomasterStudent');
        if (motomaster) {
            try {
                return JSON.parse(motomaster);
            } catch (e) {
                console.warn('Failed to parse motomasterStudent');
            }
        }

        const student = localStorage.getItem('loggedInStudent');
        if (student) {
            try {
                return JSON.parse(student);
            } catch (e) {
                console.warn('Failed to parse student from localStorage');
            }
        }

        // Try alternative keys
        const user = localStorage.getItem('user');
        if (user) {
            try {
                const parsed = JSON.parse(user);
                return {
                    student_id: parsed.student_id || parsed.id,
                    email: parsed.email,
                    name: parsed.name || parsed.full_name
                };
            } catch (e) {
                console.warn('Failed to parse user from localStorage');
            }
        }

        // Check for email only
        const email = localStorage.getItem('studentEmail') || localStorage.getItem('userEmail');
        if (email) {
            return { email: email };
        }

        return null;
    },

    /**
     * Load saved progress from database
     */
    async loadProgress(title = this.config.defaultTitle) {
        const params = new URLSearchParams({ title: title });

        try {
            const response = await fetch(`${this.config.loadEndpoint}?${params}`);
            const data = await response.json();

            if (data.success) {
                console.log('PracticeProgress: Loaded progress', data);
                return data;
            } else {
                console.warn('PracticeProgress: Failed to load progress', data.message);
                return null;
            }
        } catch (error) {
            console.error('PracticeProgress: Error loading progress', error);
            return null;
        }
    },

    /**
     * Save progress to database
     */
    async saveProgress(progressData) {
        const payload = {
            title: progressData.title || this.config.defaultTitle,
            score: progressData.score || 0,
            completion_status: progressData.completion_status || 'In Progress',
            time_elapsed_seconds: progressData.time_elapsed_seconds || 0,
            steps: progressData.steps || []
        };

        try {
            const response = await fetch(this.config.saveEndpoint, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify(payload)
            });

            const data = await response.json();

            if (data.success) {
                console.log('PracticeProgress: Saved progress', data);
            } else {
                console.warn('PracticeProgress: Failed to save progress', data.message);
            }

            return data;
        } catch (error) {
            console.error('PracticeProgress: Error saving progress', error);
            return { success: false, message: error.message };
        }
    },

    /**
     * Transform simulation tracker data to steps payload
     */
    transformTrackerData(simulationTracker, stepTitles) {
        return simulationTracker.steps.map((step, index) => ({
            step_index: index,
            title: step.title || stepTitles[index] || `Step ${index + 1}`,
            correct_actions: step.correct || [],
            mistake_actions: step.mistakes || [],
            correct_count: (step.correct || []).length,
            mistake_count: (step.mistakes || []).length,
            score: this.calculateStepScore(step)
        }));
    },

    /**
     * Calculate score for a step
     */
    calculateStepScore(step) {
        const correct = (step.correct || []).length;
        const mistakes = (step.mistakes || []).length;
        const total = correct + mistakes;

        if (total === 0) return 0;
        return Math.round((correct / total) * 100);
    },

    /**
     * Calculate overall score from steps
     */
    calculateOverallScore(steps) {
        if (!steps || steps.length === 0) return 0;

        const totalScore = steps.reduce((sum, step) => {
            return sum + this.calculateStepScore(step);
        }, 0);

        return Math.round(totalScore / steps.length);
    },

    /**
     * Record an action (correct or mistake) to the tracker
     */
    recordAction(tracker, stepIndex, type, message) {
        if (!tracker || !tracker.steps || stepIndex < 0 || stepIndex >= tracker.steps.length) {
            console.warn('PracticeProgress: Invalid tracker or step index');
            return false;
        }

        const step = tracker.steps[stepIndex];
        const timestamp = new Date().toISOString();
        const entry = {
            message: message,
            timestamp: timestamp,
            action_id: `${type}_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`
        };

        if (type === 'correct') {
            step.correct.push(entry);
        } else if (type === 'mistake') {
            step.mistakes.push(entry);
        }

        return true;
    },

    /**
     * Restore progress from saved data into the simulation tracker
     */
    restoreProgress(savedData, tracker) {
        if (!savedData || !savedData.steps || !tracker || !tracker.steps) {
            console.warn('PracticeProgress: Cannot restore - missing data');
            return false;
        }

        savedData.steps.forEach((savedStep, index) => {
            if (index < tracker.steps.length) {
                tracker.steps[index].correct = savedStep.correct_actions || savedStep.correct || [];
                tracker.steps[index].mistakes = savedStep.mistake_actions || savedStep.mistakes || [];
            }
        });

        console.log('PracticeProgress: Restored progress to tracker', tracker);
        return true;
    },

    /**
     * Get progress summary for display
     */
    getSummary(tracker) {
        if (!tracker || !tracker.steps) return null;

        const steps = tracker.steps.map((step, index) => ({
            step_index: index,
            title: step.title,
            correct_count: (step.correct || []).length,
            mistake_count: (step.mistakes || []).length,
            score: this.calculateStepScore(step)
        }));

        const overallScore = this.calculateOverallScore(tracker.steps);
        const totalCorrect = steps.reduce((sum, s) => sum + s.correct_count, 0);
        const totalMistakes = steps.reduce((sum, s) => sum + s.mistake_count, 0);

        return {
            overall_score: overallScore,
            total_steps: steps.length,
            total_correct: totalCorrect,
            total_mistakes: totalMistakes,
            steps: steps,
            status: overallScore >= 90 ? 'Excellent' :
                overallScore >= 75 ? 'Good' :
                    overallScore >= 60 ? 'Needs Work' : 'Review Again'
        };
    }
};

// Export for module usage
if (typeof module !== 'undefined' && module.exports) {
    module.exports = PracticeProgress;
}
