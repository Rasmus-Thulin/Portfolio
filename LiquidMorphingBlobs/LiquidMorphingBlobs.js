/**
 * Pixla Liquid Morphing Blobs - Ograf Compliant Metaball Liquid Simulation
 * Advanced metaball-based fluid effect with sticky morphing physics
 */

class PixlaLiquidMorphingBlobs extends HTMLElement {
    constructor() {
        super();
        this.internalData = {
            backgroundColor: '#050510',
            primaryColor: '#00d9ff',
            secondaryColor: '#8338ec',
            accentColor: '#ff006e',
            speed: 1.5,
            blobCount: 10,
            threshold: 0.8
        };
        this.currentStep = 0;
        this.isLoaded = false;
        this.animationActive = false;
        this.animationFrameId = null;
        this.blobs = [];
        this.width = 1920;
        this.height = 1080;
    }

    connectedCallback() {
        if (!this.shadowRoot) {
            this.attachShadow({ mode: 'open' });
            this.render();
        }
    }

    render() {
        this.shadowRoot.innerHTML = `
            <style>
                * {
                    margin: 0;
                    padding: 0;
                    box-sizing: border-box;
                }

                :host {
                    width: 1920px;
                    height: 1080px;
                    display: block;
                    position: relative;
                    overflow: hidden;
                }

                #canvas {
                    position: absolute;
                    top: 0;
                    left: 0;
                    width: 1920px;
                    height: 1080px;
                    opacity: 0;
                    transition: opacity 1s ease-in;
                }

                #canvas.animate-in {
                    opacity: 1;
                }

                #canvas.animate-out {
                    opacity: 0;
                    transition: opacity 1s ease-out;
                }
            </style>

            <canvas id="canvas" width="1920" height="1080"></canvas>
        `;

        this.canvas = this.shadowRoot.getElementById('canvas');
        this.ctx = this.canvas.getContext('2d', { willReadFrequently: true });
        
        // Create temporary canvas at half resolution for better performance
        this.tempCanvas = document.createElement('canvas');
        this.tempCanvas.width = 960;  // 1920 / 2
        this.tempCanvas.height = 540;  // 1080 / 2
        this.tempCtx = this.tempCanvas.getContext('2d');
        
        this.initBlobs();
    }

    initBlobs() {
        this.blobs = [];
        const count = this.internalData.blobCount || 6;
        
        const colors = [
            this.internalData.primaryColor,
            this.internalData.secondaryColor,
            this.internalData.accentColor,
            '#ff00b4',
            '#00ffff',
            '#ffd60a'
        ];

        for (let i = 0; i < count; i++) {
            this.blobs.push({
                x: Math.random() * this.width,
                y: Math.random() * this.height,
                vx: (Math.random() - 0.5) * (this.internalData.speed || 1.5),
                vy: (Math.random() - 0.5) * (this.internalData.speed || 1.5),
                radius: 30 + Math.random() * 50,
                color: colors[i % colors.length]
            });
        }
    }

    hexToRgb(hex) {
        const result = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return result ? {
            r: parseInt(result[1], 16),
            g: parseInt(result[2], 16),
            b: parseInt(result[3], 16)
        } : { r: 0, g: 0, b: 0 };
    }

    updateBlobs() {
        for (let blob of this.blobs) {
            blob.x += blob.vx;
            blob.y += blob.vy;

            // Bounce on edges with soft reflection
            if (blob.x < blob.radius || blob.x > this.width - blob.radius) {
                blob.vx *= -1;
                blob.x = Math.max(blob.radius, Math.min(this.width - blob.radius, blob.x));
            }

            if (blob.y < blob.radius || blob.y > this.height - blob.radius) {
                blob.vy *= -1;
                blob.y = Math.max(blob.radius, Math.min(this.height - blob.radius, blob.y));
            }
        }
    }

    drawMetaballs() {
        // Use lower resolution for performance, then scale up with blur
        const scale = 2; // Render at half resolution
        const renderWidth = Math.floor(this.width / scale);
        const renderHeight = Math.floor(this.height / scale);
        
        const imageData = this.tempCtx.createImageData(renderWidth, renderHeight);
        const data = imageData.data;
        const threshold = this.internalData.threshold || 0.8;

        // Sample at lower resolution
        for (let y = 0; y < renderHeight; y++) {
            for (let x = 0; x < renderWidth; x++) {
                let sum = 0;
                let colorR = 0, colorG = 0, colorB = 0;
                let totalInfluence = 0;

                // Calculate metaball field (scale coordinates back)
                const worldX = x * scale;
                const worldY = y * scale;

                for (let blob of this.blobs) {
                    const dx = worldX - blob.x;
                    const dy = worldY - blob.y;
                    const distSq = dx * dx + dy * dy;

                    if (distSq > 0) {
                        const influence = (blob.radius * blob.radius) / distSq;
                        sum += influence;

                        // Weight color by influence
                        if (influence > 0.1) {
                            const rgb = this.hexToRgb(blob.color);
                            colorR += rgb.r * influence;
                            colorG += rgb.g * influence;
                            colorB += rgb.b * influence;
                            totalInfluence += influence;
                        }
                    }
                }

                // Draw if above threshold
                if (sum > threshold) {
                    const index = (y * renderWidth + x) * 4;

                    // Normalize colors based on total influence
                    if (totalInfluence > 0) {
                        const glow = Math.min(sum * 60, 1);
                        data[index] = Math.min(255, (colorR / totalInfluence) * glow);
                        data[index + 1] = Math.min(255, (colorG / totalInfluence) * glow);
                        data[index + 2] = Math.min(255, (colorB / totalInfluence) * glow);
                        data[index + 3] = 255;
                    }
                }
            }
        }

        this.tempCtx.putImageData(imageData, 0, 0);
        
        // Scale up with blur for smooth edges
        this.ctx.imageSmoothingEnabled = true;
        this.ctx.imageSmoothingQuality = 'high';
        this.ctx.filter = 'blur(14px)';
        this.ctx.drawImage(this.tempCanvas, 0, 0, renderWidth, renderHeight, 0, 0, this.width, this.height);
        this.ctx.filter = 'none';
    }

    animate() {
        if (!this.animationActive) return;

        // Clear with background color
        const bgColor = this.hexToRgb(this.internalData.backgroundColor);
        this.ctx.fillStyle = this.internalData.backgroundColor;
        this.ctx.fillRect(0, 0, this.width, this.height);

        this.updateBlobs();
        this.drawMetaballs();

        this.animationFrameId = requestAnimationFrame(() => this.animate());
    }

    async load(params) {
        try {
            if (!this.canvas || !this.ctx) {
                return {
                    statusCode: 500,
                    statusMessage: 'Canvas not initialized'
                };
            }

            if (params?.data) {
                this.internalData = {
                    ...this.internalData,
                    ...params.data
                };
                this.initBlobs();
            }

            this.isLoaded = true;

            return {
                statusCode: 200,
                statusMessage: 'Graphic loaded successfully'
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async dispose() {
        try {
            this.stopAnimation();
            this.isLoaded = false;
            this.currentStep = 0;
            this.blobs = [];

            return {
                statusCode: 200,
                statusMessage: 'Graphic disposed successfully'
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async playAction() {
        try {
            const canvas = this.shadowRoot.getElementById('canvas');
            if (!canvas) {
                throw new Error('Canvas element not found');
            }

            canvas.classList.remove('animate-out');
            void canvas.offsetWidth;
            canvas.classList.add('animate-in');

            this.currentStep = 1;
            this.animationActive = true;
            this.startAnimation();

            return {
                statusCode: 200,
                statusMessage: 'Play action started',
                result: { currentStep: this.currentStep }
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async stopAction() {
        try {
            const canvas = this.shadowRoot.getElementById('canvas');
            if (canvas) {
                canvas.classList.remove('animate-in');
                void canvas.offsetWidth;
                canvas.classList.add('animate-out');
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            this.stopAnimation();
            this.currentStep = 0;

            return {
                statusCode: 200,
                statusMessage: 'Stop action completed',
                result: { currentStep: this.currentStep }
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async updateAction(params) {
        try {
            if (params?.data) {
                const oldData = { ...this.internalData };
                this.internalData = {
                    ...this.internalData,
                    ...params.data
                };

                // Reinitialize if blob count changed
                if (oldData.blobCount !== this.internalData.blobCount) {
                    this.initBlobs();
                }
            }

            return {
                statusCode: 200,
                statusMessage: 'Update action completed'
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async animateIn() {
        try {
            if (this.canvas) {
                this.canvas.classList.add('animate-in');
                this.startAnimation();
                await new Promise(resolve => setTimeout(resolve, 1000));
            }

            return {
                statusCode: 200,
                statusMessage: 'Animate in completed'
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    async animateOut() {
        try {
            if (this.canvas) {
                this.canvas.classList.remove('animate-in');
                this.canvas.classList.add('animate-out');
                await new Promise(resolve => setTimeout(resolve, 1000));
                this.stopAnimation();
            }

            return {
                statusCode: 200,
                statusMessage: 'Animate out completed'
            };
        } catch (error) {
            return {
                statusCode: 500,
                statusMessage: error.message
            };
        }
    }

    startAnimation() {
        if (!this.animationActive) {
            this.animationActive = true;
        }
        this.animate();
    }

    stopAnimation() {
        this.animationActive = false;
        if (this.animationFrameId) {
            cancelAnimationFrame(this.animationFrameId);
            this.animationFrameId = null;
        }
    }
}

if (!customElements.get('pixla-liquidmorphingblobs')) {
    customElements.define('pixla-liquidmorphingblobs', PixlaLiquidMorphingBlobs);
}

if (typeof module !== 'undefined') {
    module.exports = PixlaLiquidMorphingBlobs;
}
