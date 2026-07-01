/**
 * UIManager - Handles all UI interactions and updates
 */
class UIManager {
    constructor(game) {
        this.game = game;
        this.elements = {};
        this.resultsVisible = false;
        this.resultsWin = false;
        this.modalBlocking = false;
        this.pendingMenuAction = null;
        this.startScreenShownAt = 0; // Timestamp when start screen was shown
    }
    
    init() {
        this.elements = {
            spaceScore: document.getElementById('space-score'),
            spaceVolume: document.getElementById('space-volume'),
            currentLevel: document.getElementById('current-level'),
            queueItems: document.getElementById('queue-items'),
            btnMenu: document.getElementById('btn-menu'),
            btnMusic: document.getElementById('btn-music'),
            btnStart: document.getElementById('btn-start'),
            resultsModal: document.getElementById('results-modal'),
            resultsTitle: document.querySelector('.results-title'),
            menuModal: document.getElementById('menu-modal'),
            resultEfficiency: document.getElementById('result-efficiency'),
            btnNextLevel: document.getElementById('btn-next-level'),
            btnRetry: document.getElementById('btn-retry'),
            menuResume: document.getElementById('menu-resume'),
            menuRestart: document.getElementById('menu-restart'),
            menuQuit: document.getElementById('menu-quit'),
            menuPhysics: document.getElementById('menu-physics'),
            physicsStatus: document.getElementById('physics-status'),
            uiOverlay: document.getElementById('ui-overlay'),
            startScreen: document.getElementById('start-screen'),
            loadingScreen: document.getElementById('loading-screen'),
            pickupItemPanel: document.getElementById('pickup-item-panel'),
            heldItemIndicator: null,
            heldItemName: null,
            minimapCanvas: document.getElementById('minimap-canvas'),
            minimapPins: document.getElementById('minimap-pins'),
            minimapDistance: document.getElementById('minimap-distance')
        };
        
        // Setup minimap
        this.setupMinimap();
        
        this.bindEvents();
    }
    
    setupMinimap() {
        this.minimapCtx = this.elements.minimapCanvas?.getContext('2d');
        this.minimapPinsCtx = this.elements.minimapPins?.getContext('2d');
        this.minimapScale = 0.5; // Slightly zoomed in
        this.minimapSize = 200; // canvas size
        this.minimapMapSize = 160; // actual map area size
        if (this.elements.minimapCanvas) {
            this.elements.minimapCanvas.width = this.minimapSize;
            this.elements.minimapCanvas.height = this.minimapSize;
        }
        if (this.elements.minimapPins) {
            this.elements.minimapPins.width = this.minimapSize;
            this.elements.minimapPins.height = this.minimapSize;
        }
    }
    
    bindEvents() {
        this.elements.btnStart?.addEventListener('click', () => {
            this.startSelectedLevel();
        });
        this.elements.btnMenu?.addEventListener('click', () => this.showMenu());
        this.elements.btnMusic?.addEventListener('click', () => this.toggleMusic());
        // Note: btnNextLevel and btnRetry handlers are set dynamically in showResults()
        this.elements.menuResume?.addEventListener('click', () => { this.hideMenu(); this.game.resume(); });
        this.elements.menuRestart?.addEventListener('click', () => { this.hideMenu(); this.game.restartLevel(); });
        this.elements.menuQuit?.addEventListener('click', () => { this.hideMenu(); this.game.quit(); });
        this.elements.menuPhysics?.addEventListener('click', () => { this.togglePhysicsMode(); });
        this.elements.menuModal?.addEventListener('click', (e) => {
            if (e.target !== this.elements.menuModal) return;
            this.hideMenu();
            this.game.resume();
        });
        
        // Keyboard shortcut: M to toggle music
        window.addEventListener('keydown', (e) => {
            if (e.key.toLowerCase() === 'm') {
                this.toggleMusic();
            }
            if (e.key === 'Enter') {
                const startVisible = this.elements.startScreen && !this.elements.startScreen.classList.contains('hidden');
                // Ignore Enter for 200ms after start screen is shown (prevents accidental restart after quit)
                const timeSinceShown = Date.now() - this.startScreenShownAt;
                if (startVisible && timeSinceShown > 200) {
                    this.startSelectedLevel();
                } else if (this.resultsVisible && this.resultsWin) {
                    this.hideResults();
                    this.game.nextLevel();
                }
            }
        });
    }

    async startSelectedLevel() {
        const highScores = this.game.highScoreManager;
        if (!highScores.playerId) {
            const input = highScores.elements?.usernameInput;
            const newPlayerRow = highScores.elements?.newPlayerRow;
            const isCreatingPlayer = newPlayerRow && !newPlayerRow.classList.contains('hidden');
            const username = input?.value.trim();

            if (isCreatingPlayer && username) {
                await highScores.savePlayerFromInput();
            }
        }

        if (!highScores.playerId) {
            highScores.updateHint('Enter a name to play', false);
            highScores.elements?.usernameInput?.focus();
            return;
        }

        const level = highScores.getSelectedLevel();
        this.game.startAtLevel(level);
    }
    
    toggleMusic() {
        const isPlaying = this.game.audioManager.toggleSoundtrack();
        // Update button appearance
        if (this.elements.btnMusic) {
            this.elements.btnMusic.classList.toggle('music-playing', isPlaying);
            this.elements.btnMusic.classList.toggle('music-off', !isPlaying);
        }
    }
    
    update() {
        if (this.elements.spaceScore) {
            const pct = this.game.score.spaceEfficiency || 0;
            const placedCount = this.game.itemManager?.placedItems?.length || 0;
            if (placedCount === 0 || pct === 0) {
                this.elements.spaceScore.textContent = 'Empty';
            } else if (placedCount === 1) {
                this.elements.spaceScore.textContent = 'Single Item';
            } else {
                this.elements.spaceScore.textContent = `${pct}%`;
            }
        }
        if (this.elements.spaceVolume) {
            const usedYd = this.game.score.usedCubicYards || 0;
            const fraction = Math.max(0, usedYd) / 25;
            const placedCount = this.game.itemManager?.placedItems?.length || 0;
            if (placedCount === 0 || placedCount === 1 || fraction === 0) {
                this.elements.spaceVolume.textContent = '';
            } else {
                let label = '1/32th';
                const pct = fraction * 100;
                if (fraction >= 1 || pct >= 95) label = 'Full';
                else if (fraction >= 0.75 || pct >= 70) label = '3/4';
                else if (fraction >= 0.5 || pct >= 45) label = '1/2';
                else if (fraction >= 0.25 || pct >= 20) label = '1/4';
                else if (fraction >= 0.125 || pct >= 10) label = '1/8th';
                else if (fraction >= 0.0625) label = '1/16th';
                this.elements.spaceVolume.textContent = label;
            }
        }
        
        // Held item indicator
        const holdingItem = this.game.itemManager?.previewItemDef;
        const holdingId = holdingItem?.id;
        const items = this.elements.queueItems?.querySelectorAll('.queue-item') || [];
        items.forEach(item => {
            const isHolding = holdingId && item.dataset.itemId === holdingId;
            item.classList.toggle('holding', !!isHolding);
        });
        this.updateLevel(this.game.currentLevel);
        
        // Update minimap
        this.updateMinimap();
    }
    
    updateLevel(level) {
        if (this.elements.currentLevel) {
            this.elements.currentLevel.textContent = level;
        }
    }
    
    updateMinimap() {
        if (!this.minimapCtx || !this.game.truck || !this.game.destination) return;
        
        const ctx = this.minimapCtx;
        const canvasSize = this.minimapSize;
        const mapSize = this.minimapMapSize || 160;
        const mapHalf = mapSize / 2;
        const center = canvasSize / 2;
        
        const truckX = this.game.truck.position.x;
        const truckZ = this.game.truck.position.z;
        const truckRot = this.game.truck.rotation;
        const destX = this.game.destination.x;
        const destZ = this.game.destination.z;
        
        // Calculate distance
        const dx = destX - truckX;
        const dz = destZ - truckZ;
        const distance = Math.sqrt(dx * dx + dz * dz);
        
        // Update distance display
        if (this.elements.minimapDistance) {
            if (distance >= 1000) {
                this.elements.minimapDistance.textContent = `${(distance / 1000).toFixed(1)}km`;
            } else {
                this.elements.minimapDistance.textContent = `${Math.round(distance)}m`;
            }
        }
        
        // Clear canvas
        ctx.clearRect(0, 0, canvasSize, canvasSize);
        
        // Draw fixed map area background (no grid lines)
        ctx.fillStyle = 'rgba(26, 26, 30, 0.7)';
        ctx.fillRect(center - mapHalf, center - mapHalf, mapSize, mapSize);
        
        // Clip to the map square so rotated content doesn't spill outside
        ctx.save();
        ctx.beginPath();
        ctx.rect(center - mapHalf, center - mapHalf, mapSize, mapSize);
        ctx.clip();
        
        // Rotate the view (keep square canvas fixed)
        ctx.translate(center, center);
        ctx.rotate(-truckRot);
        
        // Offset grid based on truck position (used for roads + markers)
        const gridSize = 50 * this.minimapScale;
        const gridOffsetX = (truckX * this.minimapScale) % gridSize;
        const gridOffsetZ = (truckZ * this.minimapScale) % gridSize;
        
        // Draw roads (thicker lines) - extend beyond mapHalf to fill corners when rotated
        const roadExtent = mapHalf * 1.5;
        ctx.strokeStyle = '#3a3a40';
        ctx.lineWidth = 3;
        for (let i = -14; i <= 14; i++) {
            const x = -(i * gridSize) + gridOffsetX;
            const y = (i * gridSize) - gridOffsetZ;
            ctx.beginPath();
            ctx.moveTo(x, -roadExtent);
            ctx.lineTo(x, roadExtent);
            ctx.stroke();
            
            ctx.beginPath();
            ctx.moveTo(-roadExtent, y);
            ctx.lineTo(roadExtent, y);
            ctx.stroke();
        }
        
        // Calculate destination position on minimap (relative to truck, in rotated space)
        const relDestX = (destX - truckX) * this.minimapScale;
        const relDestZ = (destZ - truckZ) * this.minimapScale;
        let destMapX = -relDestX;
        let destMapY = relDestZ;
        
        // Draw direction line to destination (inside clipped area), snapped to roads
        const snapToRoad = (v) => Math.round(v / 50) * 50;
        const snappedTruckX = snapToRoad(truckX);
        const snappedTruckZ = snapToRoad(truckZ);
        const snappedDestX = snapToRoad(destX);
        const snappedDestZ = snapToRoad(destZ);

        const routePoints = [
            { x: truckX, z: truckZ }, // start at truck
            { x: snappedTruckX, z: snappedTruckZ }, // snap to nearest road
            { x: snappedDestX, z: snappedTruckZ }, // follow road grid
            { x: snappedDestX, z: snappedDestZ } // destination road
        ];

        ctx.strokeStyle = 'rgba(34, 197, 94, 0.5)';
        ctx.lineWidth = 2;
        ctx.beginPath();
        routePoints.forEach((p, idx) => {
            const relX = (p.x - truckX) * this.minimapScale;
            const relZ = (p.z - truckZ) * this.minimapScale;
            const mapX = -relX;
            const mapY = relZ;
            if (idx === 0) {
                ctx.moveTo(mapX, mapY);
            } else {
                ctx.lineTo(mapX, mapY);
            }
        });
        ctx.stroke();
        
        // Calculate pickup position (in rotated space)
        let pickMapX = 0, pickMapY = 0;
        let hasPickup = false;
        if (this.game.pickup) {
            hasPickup = true;
            const pickX = this.game.pickup.x;
            const pickZ = this.game.pickup.z;
            const relPickX = (pickX - truckX) * this.minimapScale;
            const relPickZ = (pickZ - truckZ) * this.minimapScale;
            pickMapX = -relPickX;
            pickMapY = relPickZ;
            
            // Direction line to pickup (inside clipped area), snapped to roads
            const snappedPickX = snapToRoad(pickX);
            const snappedPickZ = snapToRoad(pickZ);
            const pickupRoute = [
                { x: truckX, z: truckZ },
                { x: snappedTruckX, z: snappedTruckZ },
                { x: snappedPickX, z: snappedTruckZ },
                { x: snappedPickX, z: snappedPickZ }
            ];

            ctx.strokeStyle = 'rgba(255, 153, 51, 0.5)';
            ctx.lineWidth = 2;
            ctx.beginPath();
            pickupRoute.forEach((p, idx) => {
                const relX = (p.x - truckX) * this.minimapScale;
                const relZ = (p.z - truckZ) * this.minimapScale;
                const mapX = -relX;
                const mapY = relZ;
                if (idx === 0) {
                    ctx.moveTo(mapX, mapY);
                } else {
                    ctx.lineTo(mapX, mapY);
                }
            });
            ctx.stroke();
        }
        
        ctx.restore();
        
        // Now draw pins on the PINS canvas (not tilted)
        const pinsCtx = this.minimapPinsCtx;
        if (!pinsCtx) return;
        
        pinsCtx.clearRect(0, 0, canvasSize, canvasSize);
        
        // Transform rotated coordinates to screen coordinates
        const cosRot = Math.cos(-truckRot);
        const sinRot = Math.sin(-truckRot);
        const maxDist = mapHalf + 1; // For perimeter clamping (leave room for marker radius)
        
        // Helper to clamp position to square bounds (natural movement, no snapping)
        const clampToPerimeter = (dx, dy) => {
            return {
                x: Math.max(-maxDist, Math.min(maxDist, dx)),
                y: Math.max(-maxDist, Math.min(maxDist, dy))
            };
        };
        
        // Transform destination to screen coords (rotated)
        let destDx = destMapX * cosRot - destMapY * sinRot;
        let destDy = destMapX * sinRot + destMapY * cosRot;
        const clampedDest = clampToPerimeter(destDx, destDy);
        const destScreenX = center + clampedDest.x;
        const destScreenY = center + clampedDest.y;
        
        // Pulse effect for markers
        const pulse = (Math.sin(Date.now() / 300) + 1) / 2;
        
        // Draw destination marker (green)
        pinsCtx.beginPath();
        pinsCtx.arc(destScreenX, destScreenY, 8, 0, Math.PI * 2);
        pinsCtx.fillStyle = 'rgba(34, 197, 94, 0.3)';
        pinsCtx.fill();
        pinsCtx.beginPath();
        pinsCtx.arc(destScreenX, destScreenY, 5, 0, Math.PI * 2);
        pinsCtx.fillStyle = '#22c55e';
        pinsCtx.fill();
        pinsCtx.beginPath();
        pinsCtx.arc(destScreenX, destScreenY, 8 + pulse * 4, 0, Math.PI * 2);
        pinsCtx.strokeStyle = `rgba(34, 197, 94, ${0.5 - pulse * 0.3})`;
        pinsCtx.lineWidth = 2;
        pinsCtx.stroke();
        
        // Draw pickup marker (orange)
        if (hasPickup) {
            let pickDx = pickMapX * cosRot - pickMapY * sinRot;
            let pickDy = pickMapX * sinRot + pickMapY * cosRot;
            const clampedPick = clampToPerimeter(pickDx, pickDy);
            const pickScreenX = center + clampedPick.x;
            const pickScreenY = center + clampedPick.y;
            
            pinsCtx.beginPath();
            pinsCtx.arc(pickScreenX, pickScreenY, 8, 0, Math.PI * 2);
            pinsCtx.fillStyle = 'rgba(255, 153, 51, 0.3)';
            pinsCtx.fill();
            pinsCtx.beginPath();
            pinsCtx.arc(pickScreenX, pickScreenY, 5, 0, Math.PI * 2);
            pinsCtx.fillStyle = '#ff9933';
            pinsCtx.fill();
            pinsCtx.beginPath();
            pinsCtx.arc(pickScreenX, pickScreenY, 8 + pulse * 4, 0, Math.PI * 2);
            pinsCtx.strokeStyle = `rgba(255, 153, 51, ${0.5 - pulse * 0.3})`;
            pinsCtx.lineWidth = 2;
            pinsCtx.stroke();
        }
        
        // Draw truck (always facing up)
        pinsCtx.save();
        pinsCtx.translate(center, center);
        pinsCtx.fillStyle = '#3b82f6';
        pinsCtx.beginPath();
        pinsCtx.moveTo(0, -8);  // Front point (up)
        pinsCtx.lineTo(5, 6);   // Back right
        pinsCtx.lineTo(-5, 6);  // Back left
        pinsCtx.closePath();
        pinsCtx.fill();
        pinsCtx.strokeStyle = '#fff';
        pinsCtx.lineWidth = 1.5;
        pinsCtx.stroke();
        pinsCtx.restore();
        
        // Draw compass indicator (fixed to perimeter, never rotates)
        const compassRadius = maxDist;
        const compassAngle = -truckRot; // keep N tied to world north
        // Map direction to square perimeter instead of circle
        let compassDx = Math.sin(compassAngle);
        let compassDy = -Math.cos(compassAngle);
        const maxAxis = Math.max(Math.abs(compassDx), Math.abs(compassDy)) || 1;
        compassDx = (compassDx / maxAxis) * compassRadius;
        compassDy = (compassDy / maxAxis) * compassRadius;
        const compassX = center + compassDx;
        const compassY = center + compassDy;
        pinsCtx.beginPath();
        pinsCtx.arc(compassX, compassY, 10, 0, Math.PI * 2);
        pinsCtx.fillStyle = '#000';
        pinsCtx.fill();
        pinsCtx.fillStyle = '#fff';
        pinsCtx.font = '10px sans-serif';
        pinsCtx.textAlign = 'center';
        pinsCtx.textBaseline = 'middle';
        pinsCtx.fillText('N', compassX, compassY);
    }
    
    populateItemQueue(items) {
        if (!this.elements.queueItems) return;
        
        this.elements.queueItems.innerHTML = '';
        
        // Group items by name and count them
        const grouped = {};
        items.forEach(item => {
            if (!grouped[item.name]) {
                grouped[item.name] = { ...item, count: 1, ids: [item.id], placedCount: 0 };
            } else {
                grouped[item.name].count++;
                grouped[item.name].ids.push(item.id);
            }
        });
        
        const capacityM3 = 25 * 0.764555;
        const formatPercent = (value) => {
            const fixed = value.toFixed(1);
            return fixed.endsWith('.0') ? fixed.slice(0, -2) : fixed;
        };
        
        // Create UI elements for grouped items
        Object.values(grouped).forEach(item => {
            const el = document.createElement('div');
            el.className = 'queue-item';
            el.dataset.itemId = item.ids[0]; // Use first id for selection
            el.dataset.itemIds = JSON.stringify(item.ids); // Store all ids
            el.dataset.totalCount = item.count;
            el.dataset.placedCount = 0;
            
            const countText = item.count > 1 ? ` <span class="item-count">(x${item.count})</span>` : '';
            const totalVolume = (item.volumeM3 || 0) * item.count;
            const percent = capacityM3 > 0 ? (totalVolume / capacityM3) * 100 : 0;
            el.innerHTML = `
                <div class="queue-item-icon">${item.icon}</div>
                <span class="queue-item-name">${item.name}${countText}</span>
                <span class="queue-item-percent">${formatPercent(percent)}%</span>
            `;
            el.addEventListener('click', () => this.pickupQueueItem(el));
            this.elements.queueItems.appendChild(el);
        });
    }

    pickupQueueItem(el) {
        if (!el || el.classList.contains('placed')) return;

        if (!this.game.isAtPickup) {
            const pickupHint = document.getElementById('pickup-hint');
            if (pickupHint) pickupHint.style.display = 'flex';
            return;
        }

        const ids = JSON.parse(el.dataset.itemIds || '[]');
        const itemManager = this.game.itemManager;
        const placedIds = new Set(itemManager.placedItems.map(item => item.id));
        const itemId = ids.find(id => !placedIds.has(id)) || el.dataset.itemId;
        const groundItem = itemManager.groundItems.find(item => item.id === itemId);

        if (!groundItem || itemManager.heldGroundItem) return;

        this.elements.queueItems.querySelectorAll('.queue-item').forEach(item => {
            item.classList.toggle('active', item === el);
        });
        itemManager.pickupGroundItem(groundItem);
    }
    
    selectQueueItem(itemId) {
        const items = this.elements.queueItems.querySelectorAll('.queue-item');
        items.forEach(item => {
            item.classList.toggle('active', item.dataset.itemId === itemId);
        });
        this.game.itemManager.selectItem(itemId);
    }
    
    markItemPlaced(itemId) {
        const items = this.elements.queueItems.querySelectorAll('.queue-item');
        items.forEach(item => {
            // Check if this item group contains the placed item
            const itemIds = JSON.parse(item.dataset.itemIds || '[]');
            if (itemIds.includes(itemId)) {
                // Increment placed count
                const totalCount = parseInt(item.dataset.totalCount) || 1;
                let placedCount = parseInt(item.dataset.placedCount) || 0;
                placedCount++;
                item.dataset.placedCount = placedCount;
                
                // Update the count display
                const countSpan = item.querySelector('.item-count');
                if (totalCount > 1) {
                    if (placedCount >= totalCount) {
                        // All items placed - show crossed off and dimmed
                        item.classList.remove('partial');
                        item.classList.add('placed');
                        if (countSpan) countSpan.textContent = `(x${totalCount})`;
                    } else {
                        // Partial - show remaining count
                        item.classList.add('partial');
                        if (countSpan) countSpan.textContent = `(${placedCount}/${totalCount})`;
                    }
                } else {
                    // Single item - just mark as placed (dimmed + crossed out)
                    item.classList.add('placed');
                }
                
                item.classList.remove('active');
            }
        });
    }
    
    showMenu() {
        this.modalBlocking = true;
        this.elements.menuModal?.classList.remove('hidden');
        this.updatePhysicsStatus(); // Refresh physics toggle display
    }
    
    hideMenu() {
        this.elements.menuModal?.classList.add('hidden');
        this.modalBlocking = false;
        this.clearPendingAction();
    }
    
    isMenuVisible() {
        return this.elements.menuModal && !this.elements.menuModal.classList.contains('hidden');
    }
    
    toggleMenu() {
        if (this.isMenuVisible()) {
            this.hideMenu();
            this.clearPendingAction();
            this.game.resume();
        } else if (this.game.isRunning) {
            this.showMenu();
        }
    }

    togglePhysicsMode() {
        const enabled = this.game.togglePhysics();
        this.updatePhysicsStatus();
    }

    updatePhysicsStatus() {
        if (this.elements.physicsStatus) {
            this.elements.physicsStatus.textContent = this.game.physicsEnabled ? 'ON' : 'OFF';
        }
    }

    showPendingAction(action, message) {
        this.pendingMenuAction = action;
        
        // Create or update confirmation hint element
        let hint = document.getElementById('menu-confirm-hint');
        if (!hint) {
            hint = document.createElement('p');
            hint.id = 'menu-confirm-hint';
            hint.className = 'menu-confirm-hint';
            const menuNav = this.elements.menuModal?.querySelector('.menu-nav');
            if (menuNav) {
                menuNav.after(hint);
            }
        }
        hint.textContent = message;
        hint.style.display = 'block';
        
        // Highlight the relevant button
        if (action === 'restart') {
            this.elements.menuRestart?.classList.add('pending');
        } else if (action === 'quit') {
            this.elements.menuQuit?.classList.add('pending');
        }
    }
    
    clearPendingAction() {
        this.pendingMenuAction = null;
        
        const hint = document.getElementById('menu-confirm-hint');
        if (hint) {
            hint.style.display = 'none';
        }
        
        // Remove highlights
        this.elements.menuRestart?.classList.remove('pending');
        this.elements.menuQuit?.classList.remove('pending');
    }
    
    showResults(score, isWin = true, customTitle = null) {
        if (this.elements.resultsModal) {
            this.resultsVisible = true;
            this.resultsWin = isWin;
            this.modalBlocking = true;
            // Update title based on win/lose
            if (this.elements.resultsTitle) {
                let title = isWin ? 'Load Complete!' : 'Load Incomplete';
                if (customTitle) title = customTitle;
                this.elements.resultsTitle.textContent = title;
                this.elements.resultsTitle.style.color = isWin ? '' : 'var(--color-error)';
            }
            
            const efficiency = typeof score.spaceEfficiency === 'number' ? score.spaceEfficiency : 0;
            const efficiencyText = Number.isInteger(efficiency)
                ? efficiency.toString()
                : efficiency.toFixed(2);
            this.elements.resultEfficiency.textContent = `${efficiencyText}%`;
            
            // Show/hide next level button based on win
            if (this.elements.btnNextLevel) {
                this.elements.btnNextLevel.textContent = isWin ? 'Next Load' : 'Try Again';
                this.elements.btnNextLevel.onclick = () => {
                    this.hideResults();
                    if (isWin) {
                        this.game.nextLevel();
                    } else {
                        this.game.restartLevel();
                    }
                };
            }
            
            // Hide retry on loss (redundant with try again)
            if (this.elements.btnRetry) {
                this.elements.btnRetry.classList.toggle('hidden', !isWin);
            }
            
            this.elements.resultsModal.classList.remove('hidden');
        }
    }
    
    hideResults() {
        this.elements.resultsModal?.classList.add('hidden');
        this.resultsVisible = false;
        this.resultsWin = false;
        this.modalBlocking = false;
    }
    
    showStartScreen() {
        this.startScreenShownAt = Date.now();
        this.elements.startScreen?.classList.remove('hidden');
        this.elements.uiOverlay?.classList.add('hidden');
    }
    
    hideStartScreen() {
        this.elements.startScreen?.classList.add('hidden');
        this.elements.uiOverlay?.classList.remove('hidden');
    }
    
    hideLoadingScreen() {
        if (this.elements.loadingScreen) {
            this.elements.loadingScreen.classList.add('fade-out');
            setTimeout(() => {
                this.elements.loadingScreen.style.display = 'none';
            }, 500);
        }
    }
    
    updateLoadingProgress(percent, text) {
        const bar = document.getElementById('loading-bar');
        const txt = document.getElementById('loading-text');
        if (bar) bar.style.width = `${percent}%`;
        if (txt) txt.textContent = text;
    }
    
    reset() {
        const items = this.elements.queueItems?.querySelectorAll('.queue-item');
        items?.forEach(item => {
            item.classList.remove('placed', 'active', 'partial');
            // Reset placed count
            item.dataset.placedCount = 0;
            // Reset count display to original
            const totalCount = parseInt(item.dataset.totalCount) || 1;
            const countSpan = item.querySelector('.item-count');
            if (countSpan && totalCount > 1) {
                countSpan.textContent = `(x${totalCount})`;
            }
        });
        // Reset pickup mode
        this.setPickupMode(true);
    }
    
    setPickupMode(isAtPickup, allItemsLoaded = false) {
        const pickupHint = document.getElementById('pickup-hint');
        const pickupPanel = this.elements.pickupItemPanel;
        
        if (pickupHint) {
            // Only show "drive to orange beacon" if there are required items to pick up
            const hasItemsToPickup = this.game.itemManager.hasRequiredGroundItems();
            pickupHint.style.display = 'none';
        }
        
        if (pickupPanel) {
            const hidePickupPanel = !!this.game.hasArrivedAtDestination;
            pickupPanel.style.display = hidePickupPanel ? 'none' : 'block';
            pickupPanel.classList.toggle('at-pickup', isAtPickup);
            pickupPanel.classList.toggle('away-from-pickup', !isAtPickup);
        }

        const actionHints = document.getElementById('action-hints');
        if (actionHints) {
            const hasItemsToPickup = this.game.itemManager.hasRequiredGroundItems();
            actionHints.style.display = (!isAtPickup && hasItemsToPickup && !allItemsLoaded) ? 'block' : 'none';
        }
    }
}
