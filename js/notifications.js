/**
 * js/notifications.js
 * Manages global student notifications, instructor message replies, and auto-saving module notes.
 * Categorized by Messages, Updates, and Alerts with client-side filter tabs in the dropdown.
 */
(function (global) {
    // State cache
    let cachedMessages = [];
    let currentFilter = 'all';

    // 1. Inject Styles for dropdown, notes, and filter tabs dynamically
    function injectNotificationStyles() {
        const style = document.createElement('style');
        style.textContent = `
            .bell-dropdown {
                position: absolute;
                top: 100%;
                right: 0;
                width: 320px;
                background: #ffffff;
                border: 1px solid #cbd5e1;
                border-radius: 12px;
                box-shadow: 0 10px 25px -5px rgba(0, 0, 0, 0.1), 0 8px 10px -6px rgba(0, 0, 0, 0.05);
                padding: 14px;
                z-index: 10000;
                margin-top: 10px;
                display: none;
                flex-direction: column;
                max-height: 400px;
                overflow-y: auto;
                cursor: default;
                text-align: left;
                font-family: 'Nunito', sans-serif;
            }
            .bell-dropdown.active {
                display: flex;
            }
            .bell-dropdown-header {
                font-family: 'Rajdhani', sans-serif;
                font-size: 0.95rem;
                font-weight: 800;
                color: #1e293b;
                padding-bottom: 8px;
                border-bottom: 1px solid #e2e8f0;
                margin-bottom: 8px;
                display: flex;
                justify-content: space-between;
                align-items: center;
                letter-spacing: 0.5px;
            }
            .bell-mark-read-btn {
                background: none;
                border: none;
                color: #2563eb;
                font-size: 0.68rem;
                font-weight: 700;
                cursor: pointer;
                padding: 2px 6px;
                border-radius: 4px;
            }
            .bell-mark-read-btn:hover {
                background: #eff6ff;
                text-decoration: underline;
            }
            
            /* FILTER TABS */
            .bell-dropdown-filters {
                display: flex;
                gap: 4px;
                margin-bottom: 10px;
                border-bottom: 1px solid #f1f5f9;
                padding-bottom: 8px;
            }
            .bell-filter-btn {
                font-family: inherit;
                font-size: 0.65rem;
                font-weight: 700;
                cursor: pointer;
                border: none;
                background: none;
                color: #64748b;
                padding: 3px 8px;
                border-radius: 4px;
                transition: background 0.15s, color 0.15s;
            }
            .bell-filter-btn:hover {
                background: #f1f5f9;
                color: #1e293b;
            }
            .bell-filter-btn.active {
                background: #eff6ff;
                color: #2563eb;
                font-weight: 800;
            }

            /* MESSAGES CONTAINER */
            .bell-messages-container {
                display: flex;
                flex-direction: column;
                gap: 8px;
            }
            .bell-message-item {
                padding: 10px;
                border-radius: 8px;
                background: #f8fafc;
                border: 1px solid #e2e8f0;
                display: flex;
                flex-direction: column;
                gap: 5px;
                transition: all 0.2s;
            }
            .bell-message-item.unread {
                background: #f0fdf4;
                border-color: #bbf7d0;
            }
            .bell-message-item.cat-message {
                border-left: 3px solid #3b82f6;
            }
            .bell-message-item.cat-update {
                border-left: 3px solid #06b6d4;
            }
            .bell-message-item.cat-alert {
                border-left: 3px solid #ef4444;
            }
            
            .bell-msg-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
            }
            .bell-msg-sender {
                font-size: 0.75rem;
                font-weight: 800;
                color: #1e293b;
                display: flex;
                align-items: center;
                gap: 4px;
            }
            .bell-message-item.cat-message .bell-msg-sender::before {
                content: '💬';
            }
            .bell-message-item.cat-update .bell-msg-sender::before {
                content: '📢';
            }
            .bell-message-item.cat-alert .bell-msg-sender::before {
                content: '🚨';
            }
            
            .bell-msg-time {
                font-size: 0.62rem;
                color: #94a3b8;
            }
            .bell-msg-text {
                font-size: 0.72rem;
                color: #334155;
                line-height: 1.4;
            }
            
            /* REPLY STYLES */
            .bell-reply-toggle-btn {
                align-self: flex-end;
                background: none;
                border: 1px solid #cbd5e1;
                color: #475569;
                font-family: inherit;
                font-size: 0.65rem;
                font-weight: 700;
                padding: 2px 8px;
                border-radius: 4px;
                cursor: pointer;
                transition: background 0.15s, color 0.15s;
                margin-top: 2px;
            }
            .bell-reply-toggle-btn:hover {
                background: #f1f5f9;
                color: #1e293b;
            }
            .bell-reply-box {
                display: flex;
                flex-direction: column;
                gap: 6px;
                margin-top: 4px;
                border-top: 1px dashed #e2e8f0;
                padding-top: 8px;
            }
            .bell-reply-input {
                width: 100%;
                height: 48px;
                border: 1px solid #cbd5e1;
                border-radius: 6px;
                padding: 6px;
                font-family: inherit;
                font-size: 0.7rem;
                resize: none;
                outline: none;
            }
            .bell-reply-input:focus {
                border-color: #2563eb;
            }
            .bell-reply-actions {
                display: flex;
                justify-content: flex-end;
                gap: 6px;
            }
            .bell-reply-submit-btn {
                padding: 3px 8px;
                background: #2563eb;
                color: #ffffff;
                border: none;
                border-radius: 4px;
                font-family: inherit;
                font-size: 0.65rem;
                font-weight: 700;
                cursor: pointer;
            }
            .bell-reply-submit-btn:hover {
                background: #1d4ed8;
            }
            .bell-reply-cancel-btn {
                padding: 3px 8px;
                background: #e2e8f0;
                color: #475569;
                border: none;
                border-radius: 4px;
                font-family: inherit;
                font-size: 0.65rem;
                font-weight: 700;
                cursor: pointer;
            }
            .bell-reply-cancel-btn:hover {
                background: #cbd5e1;
            }
            .bell-reply-text-box {
                background: #f1f5f9;
                border-left: 3px solid #64748b;
                padding: 6px 8px;
                border-radius: 4px;
                font-size: 0.68rem;
                color: #334155;
                margin-top: 4px;
            }
            .bell-reply-text-box strong {
                display: block;
                font-size: 0.6rem;
                color: #64748b;
                margin-bottom: 2px;
                text-transform: uppercase;
                letter-spacing: 0.5px;
            }
        `;
        document.head.appendChild(style);
    }

    // 2. Load notifications from API and manage dropdown states
    async function loadNotifications() {
        const bellBtn = document.querySelector('.nav-bell');
        if (!bellBtn) return;

        bellBtn.style.position = 'relative';

        // Add badge container if not exists
        let badge = bellBtn.querySelector('.bell-badge');
        if (!badge) {
            badge = document.createElement('span');
            badge.className = 'bell-badge';
            badge.style.cssText = `
                position: absolute;
                top: 2px;
                right: 2px;
                width: 8px;
                height: 8px;
                background: #ef4444;
                border-radius: 50%;
                border: 1px solid #fff;
                display: none;
            `;
            bellBtn.appendChild(badge);
        }

        // Add dropdown if not exists
        let dropdown = bellBtn.querySelector('.bell-dropdown');
        if (!dropdown) {
            dropdown = document.createElement('div');
            dropdown.className = 'bell-dropdown';
            bellBtn.appendChild(dropdown);

            // Prevent dropdown closure when clicking inside it
            dropdown.addEventListener('click', (e) => {
                e.stopPropagation();
            });
        }

        try {
            const res = await fetch('student_messages.php');
            const data = await res.json();
            if (!res.ok || !data.success) return;

            cachedMessages = data.messages || [];
            const unreadCount = cachedMessages.filter(m => m.is_read === 0).length;

            badge.style.display = unreadCount > 0 ? 'block' : 'none';

            // Build layout inside the dropdown
            renderDropdown(dropdown, unreadCount);

        } catch (err) {
            console.error('Failed to load notifications', err);
        }
    }

    // Render the dropdown structure and items based on filter state
    function renderDropdown(dropdown, unreadCount) {
        // Render headers and category tabs
        dropdown.innerHTML = `
            <div class="bell-dropdown-header">
                <span>Messages</span>
                ${unreadCount > 0 ? `<button class="bell-mark-read-btn">Mark all read</button>` : ''}
            </div>

            <div style="display:flex;justify-content:space-between;align-items:center;margin-bottom:8px;gap:8px;">
                <span style="font-size:0.68rem;color:#64748b;font-weight:700;">Shared inbox</span>
                <a href="messages.html" style="font-size:0.68rem;color:#2563eb;font-weight:800;text-decoration:none;">Open full inbox</a>
            </div>
            
            <div class="bell-dropdown-filters">
                <button class="bell-filter-btn ${currentFilter === 'all' ? 'active' : ''}" data-filter="all">All</button>
                <button class="bell-filter-btn ${currentFilter === 'incoming' ? 'active' : ''}" data-filter="incoming">Incoming</button>
                <button class="bell-filter-btn ${currentFilter === 'outgoing' ? 'active' : ''}" data-filter="outgoing">Outgoing</button>
                <button class="bell-filter-btn ${currentFilter === 'unread' ? 'active' : ''}" data-filter="unread">Unread</button>
            </div>
            
            <div class="bell-messages-container"></div>
        `;

        // Render filtered items
        renderFilteredMessages(dropdown);

        // Bind tab click triggers
        dropdown.querySelectorAll('.bell-filter-btn').forEach(btn => {
            btn.addEventListener('click', (e) => {
                e.stopPropagation();
                currentFilter = btn.dataset.filter;

                // Toggle active class on tabs
                dropdown.querySelectorAll('.bell-filter-btn').forEach(b => b.classList.remove('active'));
                btn.classList.add('active');

                // Re-render filtered list
                renderFilteredMessages(dropdown);
            });
        });

        // Wire "Mark all read" trigger
        const markReadBtn = dropdown.querySelector('.bell-mark-read-btn');
        if (markReadBtn) {
            markReadBtn.addEventListener('click', async (e) => {
                e.stopPropagation();
                await fetch('student_messages.php?mark_read=1');
                loadNotifications();
            });
        }
    }

    // Populate actual items list inside the container
    function renderFilteredMessages(dropdown) {
        const container = dropdown.querySelector('.bell-messages-container');
        if (!container) return;

        const filtered = cachedMessages.filter(m => {
            if (currentFilter === 'incoming') return m.direction === 'incoming';
            if (currentFilter === 'outgoing') return m.direction === 'outgoing';
            if (currentFilter === 'unread') return m.direction === 'incoming' && Number(m.is_read) === 0;
            return true;
        });

        if (filtered.length === 0) {
            container.innerHTML = `
                <div style="font-size:0.75rem;color:#94a3b8;text-align:center;padding:24px 0;">
                    No messages found.
                </div>
            `;
            return;
        }

        container.innerHTML = filtered.map(msg => {
            const isUnread = msg.is_read === 0;
            const directionText = msg.direction === 'outgoing' ? 'To ' + (msg.recipient_name || msg.recipient_role || 'recipient') : 'From ' + (msg.sender_name || msg.sender_role || 'sender');
            const subject = msg.subject || 'No subject';

            return `
                <div class="bell-message-item ${isUnread ? 'unread' : ''}" data-id="${msg.message_id}">
                    <div class="bell-msg-header">
                        <span class="bell-msg-sender">${directionText}</span>
                        <span class="bell-msg-time">${formatTime(msg.created_at)}</span>
                    </div>
                    <div class="bell-msg-text"><strong>${escapeHtml(subject)}</strong><br>${escapeHtml(msg.message_text)}</div>
                    <div style="display:flex;justify-content:space-between;align-items:center;font-size:0.62rem;color:#94a3b8;">
                        <span>${escapeHtml(msg.sender_role)} → ${escapeHtml(msg.recipient_role)}</span>
                        <span>${isUnread ? 'Unread' : 'Read'}</span>
                    </div>
                </div>
            `;
        }).join('');
    }

    // Toggle dropdown visibility
    function setupBellClick() {
        const bellBtn = document.querySelector('.nav-bell');
        if (!bellBtn) return;

        bellBtn.addEventListener('click', (e) => {
            e.stopPropagation();
            const dropdown = bellBtn.querySelector('.bell-dropdown');
            if (dropdown) {
                const isActive = dropdown.classList.toggle('active');
                if (isActive) {
                    // Mark notifications as read when opening
                    fetch('student_messages.php?mark_read=1').then(() => {
                        const badge = bellBtn.querySelector('.bell-badge');
                        if (badge) badge.style.display = 'none';
                    });
                }
            }
        });

        // Close dropdown when clicking outside
        document.addEventListener('click', () => {
            const dropdown = bellBtn.querySelector('.bell-dropdown');
            if (dropdown) dropdown.classList.remove('active');
        });
    }

    // 3. Module Notes System
    async function loadModuleNotes() {
        const notesBox = document.querySelector('.notes-box');
        const notesHint = document.querySelector('.notes-hint');
        if (!notesBox) return;

        // Get module key from page filename (e.g. sparkmodule.html -> mod_progress_sparkmodule)
        const filename = window.location.pathname.split('/').pop().replace('.html', '');
        const moduleKey = 'mod_progress_' + filename;

        // Fetch existing notes
        try {
            const res = await fetch(`student_notes.php?module_key=${moduleKey}`);
            const data = await res.json();
            if (res.ok && data.success) {
                notesBox.value = data.note_text || '';
            }
        } catch (err) {
            console.warn('Could not load module notes', err);
        }

        // Auto-save notes on input (debounced)
        let saveTimer = null;
        notesBox.addEventListener('input', () => {
            if (notesHint) notesHint.textContent = 'Saving...';
            if (saveTimer) clearTimeout(saveTimer);

            saveTimer = setTimeout(async () => {
                try {
                    const postRes = await fetch('student_notes.php', {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            module_key: moduleKey,
                            note_text: notesBox.value
                        })
                    });
                    const postData = await postRes.json();
                    if (postRes.ok && postData.success) {
                        if (notesHint) notesHint.textContent = 'Notes saved automatically';
                    } else {
                        if (notesHint) notesHint.textContent = 'Failed to save notes';
                    }
                } catch (err) {
                    if (notesHint) notesHint.textContent = 'Failed to save notes (network error)';
                }
            }, 600);
        });
    }

    // Helper functions
    function formatTime(dateStr) {
        if (!dateStr) return '';
        const date = new Date(dateStr.replace(/-/g, '/'));
        if (isNaN(date.getTime())) return dateStr;
        return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' }) + ' ' +
            date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit', hour12: true });
    }

    function escapeHtml(text) {
        if (!text) return '';
        return text
            .replace(/&/g, "&amp;")
            .replace(/</g, "&lt;")
            .replace(/>/g, "&gt;")
            .replace(/"/g, "&quot;")
            .replace(/'/g, "&#039;");
    }

    // Initialize notification features
    function init() {
        injectNotificationStyles();
        loadNotifications();
        setupBellClick();
        loadModuleNotes();
        // Refresh notifications every 30 seconds
        setInterval(loadNotifications, 30000);
    }

    if (document.readyState === 'loading') {
        document.addEventListener('DOMContentLoaded', init);
    } else {
        init();
    }
})(window);
