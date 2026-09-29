(() => {
    const batteryTool = document.getElementById('battery-model');
    const batteryHoverCard = document.getElementById('batteryHoverCard');
    const capHoverCard = document.getElementById('capHoverCard');
    const batteryCheckModal = document.getElementById('batteryCheckModal');
    const batteryElectrolyteModal = document.getElementById('batteryElectrolyteModal');
    const batteryStatusEl = document.getElementById('batteryStatus');
    const btnCheckBattery = document.getElementById('btnCheckBattery');
    const btnRemoveBattery = document.getElementById('btnRemoveBattery');
    const btnReplaceBattery = document.getElementById('btnReplaceBattery');

    let hoverCapIndex = null;
    let batteryInfo = null;
    let isCardLocked = false;
    let isBatteryCardLocked = false;
    let negativeCapRemoved = false;
    let positiveCapRemoved = false;
    let currentBatteryElectrolyteData = null;
    let removedItems = new Map();

    function requireInspectionOrWarn() {
        if (typeof currentStepIndex !== 'undefined' && currentStepIndex === 0) {
            showSequenceWarning('Complete the inspection checklist before using the battery tools.');
            return false;
        }
        return true;
    }

    function areBothCapsRemoved() {
        return negativeCapRemoved && positiveCapRemoved;
    }

    function syncBatteryButtons(removed) {
        if (batteryStatusEl) batteryStatusEl.textContent = removed ? 'Removed' : 'In Position';
        if (btnCheckBattery) btnCheckBattery.style.display = removed ? 'none' : 'flex';
        if (btnRemoveBattery) btnRemoveBattery.style.display = removed ? 'none' : 'flex';
        if (btnReplaceBattery) btnReplaceBattery.style.display = removed ? 'flex' : 'none';
        const label = document.getElementById('btnCheckBatteryLabel');
        if (label) label.textContent = (typeof currentStepIndex !== 'undefined' && currentStepIndex === 1) ? 'CLEAN BATTERY' : 'CHECK BATTERY';
    }

    function unlockAndHideCapCard() {
        isCardLocked = false;
        if (!capHoverCard) return;
        capHoverCard.style.opacity = '0';
        setTimeout(() => {
            if (!isCardLocked) {
                capHoverCard.style.display = 'none';
                hoverCapIndex = null;
            }
        }, 200);
    }

    function unlockAndHideBatteryCard() {
        isBatteryCardLocked = false;
        if (!batteryHoverCard) return;
        batteryHoverCard.style.opacity = '0';
        setTimeout(() => {
            if (!isBatteryCardLocked) batteryHoverCard.style.display = 'none';
        }, 200);
    }

    window.onBatteryCapHover = function (capInfo, screenX, screenY) {
        if (!requireInspectionOrWarn() || !capHoverCard) return;
        if (isCardLocked) return;
        hoverCapIndex = capInfo.index;
        const isPositive = capInfo.type === 'positive';
        document.getElementById('hoverTitle').textContent = isPositive ? 'Positive (+)' : 'Negative (-)';
        document.getElementById('hoverStatus').textContent = capInfo.removed ? 'Cap Removed' : 'Cap On';
        document.getElementById('hoverIconBg').style.background = isPositive ? '#dc2626' : '#374151';
        document.getElementById('btnHoverRemove').style.display = capInfo.removed ? 'none' : 'flex';
        document.getElementById('btnHoverReplace').style.display = capInfo.removed ? 'flex' : 'none';
        capHoverCard.style.display = 'block';
        capHoverCard.style.opacity = '1';
        capHoverCard.style.left = (screenX - 110) + 'px';
        capHoverCard.style.top = (screenY - 80) + 'px';
    };

    window.onBatteryCapClicked = function (capInfo, screenX, screenY) {
        if (!requireInspectionOrWarn() || !capHoverCard) return;
        isCardLocked = true;
        hoverCapIndex = capInfo.index;
        capHoverCard.style.display = 'block';
        capHoverCard.style.opacity = '1';
        capHoverCard.style.left = (screenX - 110) + 'px';
        capHoverCard.style.top = (screenY - 80) + 'px';
    };

    window.onBatteryCapHoverEnd = function () {
        if (isCardLocked) return;
        unlockAndHideCapCard();
    };

    window.hoverCapAction = function (action) {
        if (!requireInspectionOrWarn() || hoverCapIndex === null) return;
        const capInfo = window.checkBatteryCap ? window.checkBatteryCap(hoverCapIndex) : null;
        if (!capInfo) return;
        isCardLocked = true;
        if (action === 'remove') {
            if (capInfo.type === 'positive' && !negativeCapRemoved) {
                showSequenceWarning('Remove the negative (-) cap first.');
                return;
            }
            if (window.toggleBatteryCap) window.toggleBatteryCap(hoverCapIndex);
            document.getElementById('hoverStatus').textContent = 'Cap Removed';
            document.getElementById('btnHoverRemove').style.display = 'none';
            document.getElementById('btnHoverReplace').style.display = 'flex';
            if (capInfo.type === 'negative') negativeCapRemoved = true;
            syncBatteryButtons(true);
            try { addRemovedItemDOM('battery', 'Battery', 'battery'); } catch (e) { }
            showSequenceWarning('Cap removed successfully.');
            return;
        }
        if (action === 'replace') {
            if (capInfo.type === 'negative' && positiveCapRemoved) {
                showSequenceWarning('Replace the positive (+) cap first.');
                return;
            }
            if (window.toggleBatteryCap) window.toggleBatteryCap(hoverCapIndex);
            document.getElementById('hoverStatus').textContent = 'Cap On';
            document.getElementById('btnHoverRemove').style.display = 'flex';
            document.getElementById('btnHoverReplace').style.display = 'none';
            if (capInfo.type === 'negative') negativeCapRemoved = false;
            if (capInfo.type === 'positive') positiveCapRemoved = false;
            syncBatteryButtons(window.checkBattery && window.checkBattery().removed);
            showSequenceWarning('Cap replaced successfully.');
        }
    };

    window.onBatteryHover = function (info, screenX, screenY) {
        if (!requireInspectionOrWarn() || !batteryHoverCard) return;
        if (!areBothCapsRemoved()) {
            showSequenceWarning('Remove both caps first!');
            return;
        }
        batteryInfo = info;
        document.getElementById('batteryTitle').textContent = 'Battery';
        document.getElementById('batteryStatus').textContent = info.removed ? 'Removed' : 'In Position';
        document.getElementById('btnRemoveBattery').style.display = info.removed ? 'none' : 'flex';
        document.getElementById('btnReplaceBattery').style.display = info.removed ? 'flex' : 'none';
        batteryHoverCard.style.display = 'block';
        batteryHoverCard.style.opacity = '1';
        batteryHoverCard.style.left = (screenX - 110) + 'px';
        batteryHoverCard.style.top = (screenY - 120) + 'px';
    };

    window.onBatteryHoverEnd = function () {
        if (isBatteryCardLocked) return;
        if (!batteryHoverCard) return;
        batteryHoverCard.style.opacity = '0';
        setTimeout(() => {
            if (batteryHoverCard.style.opacity === '0') batteryHoverCard.style.display = 'none';
        }, 200);
    };

    window.onBatteryClicked = function () {
        isBatteryCardLocked = true;
    };

    window.hoverBatteryAction = function (action) {
        if (!requireInspectionOrWarn()) return;
        if (!batteryInfo) batteryInfo = window.checkBattery ? window.checkBattery() : { removed: false };
        isBatteryCardLocked = true;
        if (action === 'check') {
            if (typeof currentStepIndex !== 'undefined' && currentStepIndex === 1) openBatteryCheckModal();
            else openBatteryElectrolyteModal('battery_' + Date.now());
            return;
        }
        if (action === 'remove') {
            if (!areBothCapsRemoved()) {
                showSequenceWarning('Remove both caps first before removing the battery!');
                return;
            }
            if (window.toggleBattery) window.toggleBattery();
            syncBatteryButtons(true);
            showSequenceWarning('Battery removed successfully!');
            return;
        }
        if (action === 'replace') {
            if (!areBothCapsRemoved()) {
                showSequenceWarning('Position the battery only after both caps are removed.');
                return;
            }
            if (window.installBattery) window.installBattery();
            else if (window.toggleBattery) window.toggleBattery();
            syncBatteryButtons(false);
            showSequenceWarning('Battery installed successfully!');
        }
    };

    window.showBatteryUseCard = function () {
        let existingCard = document.getElementById('batteryUseCard');
        if (existingCard) existingCard.remove();
        const card = document.createElement('div');
        card.id = 'batteryUseCard';
        card.style.cssText = 'position:fixed;top:50%;left:50%;transform:translate(-50%,-50%);z-index:100000;background:#fff;border-radius:16px;padding:24px;box-shadow:0 20px 60px rgba(0,0,0,0.4);font-family:Nunito,sans-serif;min-width:280px;text-align:center;';
        card.innerHTML = `<div style="margin-bottom:16px;"><div style="width:48px;height:48px;border-radius:50%;background:#dbeafe;display:flex;align-items:center;justify-content:center;margin:0 auto 12px;"><svg width="24" height="24" viewBox="0 0 24 24" fill="none" stroke="#2563eb" stroke-width="2"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg></div><h3 style="font-family:Rajdhani,sans-serif;font-size:1.2rem;font-weight:700;color:#1a1a2e;margin:0;">Use Battery?</h3><p style="font-size:0.8rem;color:#6b7280;margin:8px 0 0;">Install battery in the engine bay?</p></div><div style="display:flex;gap:12px;"><button onclick="useBatteryTool()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border:none;border-radius:10px;background:#16a34a;color:#fff;cursor:pointer;font-family:Nunito,sans-serif;font-size:0.8rem;font-weight:700;">Use</button><button onclick="cancelBatteryTool()" style="flex:1;display:flex;align-items:center;justify-content:center;gap:6px;padding:12px;border:2px solid #e5e7eb;border-radius:10px;background:#fff;color:#374151;cursor:pointer;font-family:Nunito,sans-serif;font-size:0.8rem;font-weight:700;">Cancel</button></div>`;
        document.body.appendChild(card);
    };

    window.useBatteryTool = function () {
        const card = document.getElementById('batteryUseCard');
        if (card) card.remove();
        if (!areBothCapsRemoved()) {
            showSequenceWarning('Remove both caps first before installing battery!');
            return;
        }
        const status = window.checkBattery ? window.checkBattery() : null;
        if (status && !status.removed) {
            return;
        }
        if (window.installBattery) window.installBattery();
        else if (window.toggleBattery) window.toggleBattery();
        syncBatteryButtons(false);
        // remove battery from removedItems map if present
        try { removedItems.delete('battery'); updateRemovedItemsContainer(); } catch (e) { }
        showSequenceWarning('Battery installed successfully!');
    };

    window.cancelBatteryTool = function () {
        const card = document.getElementById('batteryUseCard');
        if (card) card.remove();
    };

    window.openBatteryCheckModal = function () {
        if (!batteryCheckModal) return;
        batteryCheckModal.style.display = 'block';
        setTimeout(() => initBattery3DView('battery3DViewer'), 100);
    };

    window.closeBatteryCheckModal = function () {
        if (batteryCheckModal) batteryCheckModal.style.display = 'none';
    };

    window.batteryCheckAction = function (action) {
        if (action === 'clean') {
            showSequenceWarning('Battery cleaned successfully!');
            window.closeBatteryCheckModal();
            return;
        }
        if (action === 'throw') {
            showSequenceWarning('Battery marked for disposal');
            window.closeBatteryCheckModal();
            if (window.checkBattery && !window.checkBattery().removed && window.toggleBattery) {
                window.toggleBattery();
                syncBatteryButtons(true);
                try { addRemovedItemDOM('battery', 'Battery', 'battery'); } catch (e) { }
            }
        }
    };

    async function initBattery3DView(viewerId) {
        try {
            const { initBatteryViewer } = await import('./BatteryViewer.js');
            initBatteryViewer(viewerId, { enableDrag: false, enableRotate: true, enableSelection: true });
        } catch (err) {
            console.error('Failed to load battery viewer:', err);
        }
    }

    function generateElectrolyteLevels(batteryId) {
        const seed = batteryId.split('').reduce((a, b) => a + b.charCodeAt(0), 0);
        const random = (min, max) => Math.floor((Math.sin(seed + Date.now()) + 1) / 2 * (max - min) + min);
        const cells = [
            { level: random(60, 95), name: 'Cell 1' },
            { level: random(40, 90), name: 'Cell 2' },
            { level: random(30, 85), name: 'Cell 3' },
            { level: random(55, 98), name: 'Cell 4' }
        ];
        const avgLevel = cells.reduce((a, b) => a + b.level, 0) / cells.length;
        let overallStatus = 'GOOD';
        let overallColor = '#22c55e';
        if (avgLevel < 50) { overallStatus = 'CRITICAL'; overallColor = '#dc2626'; }
        else if (avgLevel < 70) { overallStatus = 'ACCEPTABLE'; overallColor = '#eab308'; }
        return { cells, overallStatus, overallColor };
    }

    function updateElectrolyteDisplay(data) {
        data.cells.forEach((cell, index) => {
            const n = index + 1;
            const levelEl = document.getElementById(`cell${n}Level`);
            const statusEl = document.getElementById(`cell${n}Status`);
            const percentEl = document.getElementById(`cell${n}Percent`);
            if (levelEl) levelEl.style.width = cell.level + '%';
            if (percentEl) percentEl.textContent = cell.level + '%';
            if (statusEl && levelEl) {
                if (cell.level >= 70) { statusEl.textContent = 'GOOD'; statusEl.style.color = '#22c55e'; levelEl.style.background = 'linear-gradient(90deg,#22c55e,#16a34a)'; }
                else if (cell.level >= 50) { statusEl.textContent = 'OK'; statusEl.style.color = '#eab308'; levelEl.style.background = 'linear-gradient(90deg,#eab308,#ca8a04)'; }
                else { statusEl.textContent = 'LOW'; statusEl.style.color = '#dc2626'; levelEl.style.background = 'linear-gradient(90deg,#dc2626,#b91c1c)'; }
            }
        });
        const overallEl = document.getElementById('electrolyteOverallStatus');
        if (overallEl) {
            const statusTextEl = overallEl.querySelector('div:last-child');
            if (statusTextEl) { statusTextEl.textContent = data.overallStatus; statusTextEl.style.color = data.overallColor; }
        }
    }

    window.openBatteryElectrolyteModal = function (batteryId) {
        if (!batteryElectrolyteModal) return;
        currentBatteryElectrolyteData = generateElectrolyteLevels(batteryId);
        updateElectrolyteDisplay(currentBatteryElectrolyteData);
        batteryElectrolyteModal.style.display = 'block';
        setTimeout(() => initBattery3DView('batteryElectrolyteViewer'), 100);
    };

    window.closeBatteryElectrolyteModal = function () {
        if (batteryElectrolyteModal) batteryElectrolyteModal.style.display = 'none';
    };

    window.electrolyteAction = function (action) {
        if (action === 'refill') {
            if (currentBatteryElectrolyteData) {
                currentBatteryElectrolyteData.cells.forEach(cell => cell.level = 100);
                currentBatteryElectrolyteData.overallStatus = 'GOOD';
                currentBatteryElectrolyteData.overallColor = '#22c55e';
                updateElectrolyteDisplay(currentBatteryElectrolyteData);
            }
            showSequenceWarning('Electrolyte refilled! All cells at 100%');
            return;
        }
        if (action === 'replace') {
            window.closeBatteryElectrolyteModal();
            if (window.toggleBattery) window.toggleBattery();
            syncBatteryButtons(true);
            showSequenceWarning('Battery removed for replacement!');
            return;
        }
        if (action === 'accept') {
            window.closeBatteryElectrolyteModal();
            showSequenceWarning('Battery accepted and installed!');
        }
    };

    batteryTool?.addEventListener('click', (e) => {
        e.stopPropagation();
        if (typeof currentStepIndex !== 'undefined' && [0, 3, 4].includes(currentStepIndex)) {
            showSequenceWarning('Battery tool is not available during this step.');
            return;
        }
        window.showBatteryUseCard();
    });

    window.addEventListener('batteryCapClicked', (event) => {
        const capInfo = event.detail;
        if (capInfo) {
            hoverCapIndex = capInfo.index;
            isCardLocked = true;
        }
    });
    // Simple DOM-based removed-items helpers (practice-style appearance)
    window.addRemovedItemDOM = function (type, label, index) {
        // store in removedItems map and rebuild UI like practicearea
        try {
            const key = index === 'battery' ? 'battery' : Number(index);
            const itemType = (index === 'battery') ? 'battery' : (type.includes('positive') ? 'positive' : 'negative');
            removedItems.set(key, { type: itemType, name: label, removed: true });
            updateRemovedItemsContainer();
        } catch (e) { console.warn('Failed to add removed item', e); }
    }

    // Removed-items UI builder (copied from practicearea.html)
    function updateRemovedItemsContainer() {
        const container = document.getElementById('removedItemsList');
        const noMessage = document.getElementById('noItemsMessage');

        if (!container || !noMessage) return;

        if (removedItems.size === 0) {
            container.innerHTML = '';
            noMessage.style.display = 'block';
        } else {
            noMessage.style.display = 'none';
            container.innerHTML = Array.from(removedItems.entries()).map(([index, item]) => {
                if (item.type === 'battery') {
                    return `
                        <div onclick="replaceItemFromContainer('battery')" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border-radius:8px;border:1.5px solid #bfdbfe;box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';">
                            <div style="width:16px;height:16px;border-radius:4px;background:#2563eb;display:flex;align-items:center;justify-content:center;flex-shrink:0;">
                                <svg width="10" height="10" viewBox="0 0 24 24" fill="none" stroke="#fff" stroke-width="2.5"><rect x="3" y="11" width="18" height="11" rx="2"/><path d="M7 11V7a5 5 0 0 1 10 0v4"/></svg>
                            </div>
                            <span style="font-size:0.7rem;font-weight:600;color:#374151;">Battery</span>
                            <span style="font-size:0.6rem;color:#9ca3af;margin-left:auto;">Click to replace</span>
                        </div>
                    `;
                }
                const cap = item;
                return `
                    <div onclick="replaceItemFromContainer(${index})" style="display:flex;align-items:center;gap:6px;padding:6px 10px;background:#fff;border-radius:8px;border:1.5px solid ${cap.type === 'positive' ? '#fecaca' : '#e5e7eb'};box-shadow:0 1px 3px rgba(0,0,0,0.1);cursor:pointer;transition:all 0.2s;" onmouseover="this.style.transform='translateY(-2px)';this.style.boxShadow='0 4px 8px rgba(0,0,0,0.15)';" onmouseout="this.style.transform='';this.style.boxShadow='0 1px 3px rgba(0,0,0,0.1)';">
                        <div style="width:16px;height:16px;border-radius:50%;background:${cap.type === 'positive' ? '#dc2626' : '#374151'};flex-shrink:0;"></div>
                        <span style="font-size:0.7rem;font-weight:600;color:#374151;">${cap.type === 'positive' ? 'Pos (+)' : 'Neg (-)'}</span>
                        <span style="font-size:0.6rem;color:#9ca3af;margin-left:auto;">Click to replace</span>
                    </div>
                `;
            }).join('');
        }
    }

    // Replace item from container - puts it back (copied from practicearea.html)
    function replaceItemFromContainer(itemKey) {
        const findRemovedCapIndex = (type) => {
            for (const [k, v] of removedItems.entries()) {
                if (v && v.type === type) return k;
            }
            return null;
        };

        if (itemKey === 'battery') {
            const batteryStatus = (window.checkBattery && typeof window.checkBattery === 'function') ? window.checkBattery() : null;
            if (!batteryStatus || !batteryStatus.removed) return;
            if (window.installBattery) window.installBattery();
            else if (window.toggleBattery) window.toggleBattery();
            removedItems.delete('battery');
            updateRemovedItemsContainer();
            const batteryStatusEl = document.getElementById('batteryStatus');
            if (batteryStatusEl) batteryStatusEl.textContent = 'In Position';
            const btnCheckEl = document.getElementById('btnCheckBattery');
            const btnRemoveEl = document.getElementById('btnRemoveBattery');
            const btnReplaceEl = document.getElementById('btnReplaceBattery');
            if (btnCheckEl) btnCheckEl.style.display = 'flex';
            if (btnRemoveEl) btnRemoveEl.style.display = 'flex';
            if (btnReplaceEl) btnReplaceEl.style.display = 'none';

            updateRemovedItemsContainer();
            try {
                const batteryInPosition = !removedItems.has('battery');
                if (!negativeCapRemoved && !positiveCapRemoved && batteryInPosition) {
                    markInstructionDone(currentStepIndex, 4);
                }
            } catch (err) { console.warn('Failed to update instruction 5 after battery replace', err); }
            return;
        }

        const capIndex = itemKey;
        const capInfo = (window.checkBatteryCap && typeof window.checkBatteryCap === 'function') ? window.checkBatteryCap(capIndex) : null;
        if (!capInfo || !capInfo.removed) return;

        if (capInfo.type === 'negative') {
            if (positiveCapRemoved) {
                showSequenceWarning('Replace the positive (+) cap before replacing the negative (-) cap.');
                return;
            }
            window.toggleBatteryCap(capIndex);
            removedItems.delete(capIndex);
            negativeCapRemoved = false;
            updateRemovedItemsContainer();
            try {
                const batteryInPosition = !removedItems.has('battery');
                if (!negativeCapRemoved && !positiveCapRemoved && batteryInPosition) {
                    markInstructionDone(currentStepIndex, 4);
                }
            } catch (err) { console.warn('Failed to update instruction 5 after negative replace (container)', err); }
            return;
        }

        if (capInfo.type === 'positive') {
            const bStatus = (window.checkBattery && typeof window.checkBattery === 'function') ? window.checkBattery() : null;
            if (bStatus && bStatus.removed) {
                showSequenceWarning('Position the battery first before replacing the positive (+) cap.');
                return;
            }
            window.toggleBatteryCap(capIndex);
            removedItems.delete(capIndex);
            positiveCapRemoved = false;
            updateRemovedItemsContainer();
            try {
                const batteryInPosition = !removedItems.has('battery');
                if (!negativeCapRemoved && !positiveCapRemoved && batteryInPosition) {
                    markInstructionDone(currentStepIndex, 4);
                }
            } catch (err) { console.warn('Failed to update instruction 5 after positive replace', err); }
            return;
        }
    }

    document.addEventListener('click', (e) => {
        if (isCardLocked && capHoverCard && !capHoverCard.contains(e.target)) unlockAndHideCapCard();
        if (isBatteryCardLocked && batteryHoverCard && !batteryHoverCard.contains(e.target)) unlockAndHideBatteryCard();
    });

    syncBatteryButtons(false);
})();
