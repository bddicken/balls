class NetworkLatencyVisualizer {
    constructor() {
        this.requests = new Map();
        this.speedMultiplier = 0.01; // Default to 0.01x speed
        
        // Define color palettes
        this.palettes = {
            'vibrant': ['#ff6b6b', '#4ecdc4', '#45b7d1', '#96ceb4', '#feca57', '#ff9ff3', '#54a0ff', '#5f27cd'],
            'pastel': ['#FFD6E8', '#FFE5B4', '#E8D5FF', '#C8E7FF', '#D4F1D4', '#FFDAB9', '#E0BBE4', '#B5E7D3'],
            'saturated': ['#FF0040', '#00FF41', '#0080FF', '#FFD700', '#FF00FF', '#00FFFF', '#FF4500', '#9400D3'],
            'monochrome': ['#2C3E50', '#34495E', '#7F8C8D', '#95A5A6', '#BDC3C7', '#ECF0F1', '#ABB2B9', '#566573']
        };
        
        this.currentPalette = 'vibrant';
        this.colors = this.palettes[this.currentPalette];
        this.colorIndex = 0;
        this.isMonitoring = false;
        this.tabId = null;
        
        this.init();
    }
    
    init() {
        this.setupPaletteSelector();
        this.setupSpeedControl();
        this.setupClearButton();
        this.setupRestartButton();
        this.setupResizeHandler();
        this.attachToCurrentTab();
    }
    
    setupPaletteSelector() {
        const paletteButtons = document.querySelectorAll('.palette-btn');
        paletteButtons.forEach(button => {
            button.addEventListener('click', (e) => {
                // Remove active class from all buttons
                paletteButtons.forEach(btn => btn.classList.remove('active'));
                // Add active class to clicked button
                e.target.classList.add('active');
                
                // Switch palette
                const paletteName = e.target.dataset.palette;
                this.switchPalette(paletteName);
            });
        });
    }
    
    switchPalette(paletteName) {
        if (this.palettes[paletteName]) {
            this.currentPalette = paletteName;
            this.colors = this.palettes[paletteName];
            this.colorIndex = 0; // Reset color index when switching palettes
            
            // Update existing balls with new colors
            this.updateBallColors();
        }
    }
    
    updateBallColors() {
        const balls = document.querySelectorAll('.ball');
        balls.forEach((ball, index) => {
            const color = this.colors[index % this.colors.length];
            ball.style.backgroundColor = color;
            ball.style.borderColor = this.darkenColor(color, 20);
        });
    }
    
    setupSpeedControl() {
        const speedSlider = document.getElementById('speedSlider');
        const speedValue = document.getElementById('speedValue');
        
        speedSlider.addEventListener('input', (e) => {
            this.speedMultiplier = parseFloat(e.target.value);
            speedValue.textContent = this.speedMultiplier.toFixed(3) + 'x';
            this.updateAllAnimationSpeeds();
        });
        
        // Initialize the display value
        speedValue.textContent = this.speedMultiplier.toFixed(3) + 'x';
    }
    
    setupClearButton() {
        const clearButton = document.getElementById('clearButton');
        clearButton.addEventListener('click', () => {
            this.clearAllRequests();
        });
    }
    
    setupRestartButton() {
        const restartButton = document.getElementById('restartButton');
        restartButton.addEventListener('click', () => {
            this.restartAllBalls();
        });
    }
    
    setupResizeHandler() {
        let resizeTimeout;
        window.addEventListener('resize', () => {
            clearTimeout(resizeTimeout);
            resizeTimeout = setTimeout(() => {
                this.updateAllBallBounds();
            }, 100);
        });
    }
    
    clearAllRequests() {
        // Stop all animations
        const balls = document.querySelectorAll('.ball');
        balls.forEach(ball => {
            if (ball.animationFrame) {
                cancelAnimationFrame(ball.animationFrame);
            }
        });
        
        this.requests.clear();
        this.colorIndex = 0;
        const container = document.getElementById('requests-container');
        container.innerHTML = '<div class="empty-state">Navigate to a webpage to start monitoring network requests</div>';
    }
    
    restartAllBalls() {
        // Reset all balls to starting position
        const balls = document.querySelectorAll('.ball');
        balls.forEach(ball => {
            if (ball.animationData) {
                // Reset cycle progress to 0 (starting position)
                ball.animationData.cycleProgress = 0;
                ball.animationData.currentX = ball.animationData.startX;
                ball.style.left = ball.animationData.startX + 'px';
            }
        });
    }
    
    attachToCurrentTab() {
        // Add a small delay to ensure DevTools is fully initialized
        setTimeout(() => {
            chrome.devtools.inspectedWindow.eval(
                "location.href",
                (result, isException) => {
                    if (!isException && result) {
                        // Check if it's a special Chrome page
                        if (result.startsWith('chrome://') || result === 'about:blank' || result.startsWith('chrome-extension://')) {
                            this.updateMonitoringStatus(false, "Cannot monitor Chrome internal pages");
                            // Update the empty state message
                            const container = document.getElementById('requests-container');
                            container.innerHTML = '<div class="empty-state">Navigate to a regular webpage (http/https) to start monitoring network requests.<br><br>Note: Extensions cannot monitor Chrome internal pages like chrome://, about:blank, or extension pages.</div>';
                        } else {
                            this.tabId = chrome.devtools.inspectedWindow.tabId;
                            this.startNetworkMonitoring();
                        }
                    } else {
                        this.updateMonitoringStatus(false, "Waiting for valid page");
                    }
                }
            );
        }, 100); // Small delay to ensure DevTools is ready
    }
    
    startNetworkMonitoring() {
        if (this.isMonitoring) return;
        
        // Use chrome.devtools.network API instead of debugger to avoid the debugging banner
        this.isMonitoring = true;
        this.updateMonitoringStatus(true);
        
        // Listen to network requests using DevTools Network API
        chrome.devtools.network.onRequestFinished.addListener((request) => {
            this.handleNetworkRequest(request);
        });
    }
    
    handleNetworkRequest(request) {
        // Extract relevant information from the HAR-format request
        const requestData = {
            id: request.request.url + '_' + Date.now(), // Generate unique ID
            url: request.request.url,
            method: request.request.method,
            type: this.getResourceType(request),
            status: request.response.status,
            size: request.response.content.size || request.response.bodySize || 0,
            latency: Math.round(request.time), // Time in milliseconds
            mimeType: request.response.content.mimeType || ''
        };
        
        // Only add if latency is valid
        if (requestData.latency > 0) {
            this.requests.set(requestData.id, requestData);
            this.addRequestVisualization(requestData);
        }
    }
    
    getResourceType(request) {
        // Get resource type from the request
        const mimeType = request.response.content.mimeType || '';
        const url = request.request.url.toLowerCase();
        
        if (mimeType.includes('javascript') || url.endsWith('.js')) return 'script';
        if (mimeType.includes('css') || url.endsWith('.css')) return 'stylesheet';
        if (mimeType.includes('image') || /\.(jpg|jpeg|png|gif|svg|webp|ico)/.test(url)) return 'image';
        if (mimeType.includes('font') || /\.(woff|woff2|ttf|eot)/.test(url)) return 'font';
        if (mimeType.includes('json')) return 'json';
        if (mimeType.includes('html')) return 'document';
        
        return 'other';
    }
    
    
    addRequestVisualization(request) {
        const container = document.getElementById('requests-container');
        
        if (container.querySelector('.empty-state')) {
            container.innerHTML = '';
        }
        
        const requestElement = this.createRequestElement(request);
        
        const existingRows = Array.from(container.querySelectorAll('.request-row'));
        const insertIndex = existingRows.findIndex(row => {
            const rowLatency = parseInt(row.dataset.latency);
            return request.latency < rowLatency;
        });
        
        if (insertIndex === -1) {
            container.appendChild(requestElement);
        } else {
            container.insertBefore(requestElement, existingRows[insertIndex]);
        }
    }
    
    createRequestElement(request) {
        const row = document.createElement('div');
        row.className = 'request-row';
        row.dataset.latency = request.latency;
        
        const url = new URL(request.url);
        const filename = url.pathname.split('/').pop() || url.hostname;
        
        row.innerHTML = `
            <div class="request-label">
                <div class="request-name" title="${request.url}">${filename}</div>
                <div class="request-info">
                    <span>${request.type}</span>
                    <span>${this.formatSize(request.size)}</span>
                    <span>${request.latency}ms</span>
                </div>
            </div>
        `;
        
        const ball = document.createElement('div');
        ball.className = 'ball';
        
        const color = this.colors[this.colorIndex % this.colors.length];
        this.colorIndex++;
        
        ball.style.backgroundColor = color;
        ball.style.borderColor = this.darkenColor(color, 20);
        ball.style.left = '270px'; // Adjusted for wider label (250px + 20px padding)
        
        row.appendChild(ball);
        
        this.animateBall(ball, request.latency);
        
        return row;
    }
    
    animateBall(ball, latency) {
        // Wait for element to be rendered before starting animation
        setTimeout(() => {
            const container = ball.parentElement;
            const startX = 270; // Adjusted for wider label (250px + 20px padding)
            
            // Calculate the distance and time for animation
            // At 0.1x speed: latency ms in real world = latency ms animation time
            // At 0.01x speed: latency ms in real world = latency * 10 ms animation time  
            // At 0.001x speed: latency ms in real world = latency * 100 ms animation time
            
            let lastFrameTime = performance.now();
            let cycleProgress = 0; // Track progress through the bounce cycle (0 to 1)
            
            // Store animation parameters on the ball element for resize updates
            ball.animationData = {
                startX,
                currentX: startX,
                latency,
                cycleProgress
            };
            
            const animate = (currentTime) => {
                if (!ball.parentElement) return; // Stop if element is removed
                
                const containerWidth = container.offsetWidth || 800;
                const endX = containerWidth - 80; // padding for larger ball (48px + margins)
                
                if (endX <= startX) return;
                
                ball.animationData.endX = endX;
                const distance = endX - startX;
                
                // Calculate time delta since last frame
                const deltaTime = currentTime - lastFrameTime;
                lastFrameTime = currentTime;
                
                // At speedMultiplier = 0.1: animation takes exactly latency ms for round trip
                // At speedMultiplier = 0.01: animation takes latency * 10 ms for round trip
                // At speedMultiplier = 0.001: animation takes latency * 100 ms for round trip
                const animationDuration = ball.animationData.latency / this.speedMultiplier;
                
                // Update cycle progress based on time delta
                const progressIncrement = deltaTime / animationDuration;
                ball.animationData.cycleProgress = (ball.animationData.cycleProgress + progressIncrement) % 1;
                
                // Convert cycle position to actual position
                // 0 to 0.5: moving right (start to end)
                // 0.5 to 1: moving left (end to start)
                if (ball.animationData.cycleProgress <= 0.5) {
                    // Moving right
                    const progress = ball.animationData.cycleProgress * 2; // 0 to 1
                    ball.animationData.currentX = startX + (distance * progress);
                } else {
                    // Moving left
                    const progress = (ball.animationData.cycleProgress - 0.5) * 2; // 0 to 1
                    ball.animationData.currentX = endX - (distance * progress);
                }
                
                ball.style.left = ball.animationData.currentX + 'px';
                ball.animationFrame = requestAnimationFrame(animate);
            };
            
            // Store animation reference for cleanup
            ball.animationFrame = requestAnimationFrame(animate);
        }, 100); // Small delay to ensure DOM is ready
    }
    
    updateAllAnimationSpeeds() {
        // Animation speed is handled in the animate function by checking this.speedMultiplier
        // No need to restart animations, they will automatically use the new speed
    }
    
    updateAllBallBounds() {
        const balls = document.querySelectorAll('.ball');
        balls.forEach(ball => {
            if (ball.animationData && ball.parentElement) {
                const container = ball.parentElement;
                const containerWidth = container.offsetWidth || 800;
                const newEndX = containerWidth - 80; // padding for larger ball (48px + margins)
                
                // Update endX in the animation data
                ball.animationData.endX = newEndX;
                
                // If the ball is beyond the new bounds, adjust its cycle progress
                if (ball.animationData.currentX > newEndX) {
                    // Ball is outside bounds, put it at the end position moving back
                    ball.animationData.cycleProgress = 0.5; // Start moving back
                    ball.animationData.currentX = newEndX;
                }
            }
        });
    }
    
    formatSize(bytes) {
        if (bytes === 0) return '0 B';
        const k = 1024;
        const sizes = ['B', 'KB', 'MB', 'GB'];
        const i = Math.floor(Math.log(bytes) / Math.log(k));
        return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
    }
    
    darkenColor(hex, percent) {
        const num = parseInt(hex.replace('#', ''), 16);
        const amt = Math.round(2.55 * percent);
        const R = (num >> 16) - amt;
        const G = (num >> 8 & 0x00FF) - amt;
        const B = (num & 0x0000FF) - amt;
        return '#' + (0x1000000 + (R < 255 ? R < 1 ? 0 : R : 255) * 0x10000
            + (G < 255 ? G < 1 ? 0 : G : 255) * 0x100
            + (B < 255 ? B < 1 ? 0 : B : 255)).toString(16).slice(1);
    }
    
    updateMonitoringStatus(active, message = '') {
        // Status indicator has been removed from UI
        // Monitoring status is handled internally
    }
}

// Initialize the visualizer when the panel loads
document.addEventListener('DOMContentLoaded', () => {
    new NetworkLatencyVisualizer();
});

// Also try to initialize immediately if DOM is already loaded
if (document.readyState !== 'loading') {
    new NetworkLatencyVisualizer();
}