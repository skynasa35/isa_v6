import React, { useRef, useEffect } from 'react';
import { useI18n } from '../hooks/useI18n';
import { ThemeColors } from '../types';

interface WelcomeScreenProps {
  theme: ThemeColors;
}

/*
  New p5.js welcome screen
  - Dynamic seismic wave field using Perlin noise
  - Subtle technical grid and glow pulses (ripples) like shockwaves
  - Smoothly adapts to theme changes
  - Pointer-events left to the page so drag-and-drop keeps working
*/
const WelcomeScreen: React.FC<WelcomeScreenProps> = ({ theme }) => {
  const { t } = useI18n();
  const sketchRef = useRef<HTMLDivElement>(null);
  const p5InstanceRef = useRef<any>(null);

  useEffect(() => {
    if (!sketchRef.current) return;

    const sketch = (p: any) => {
      let currentTheme: ThemeColors = theme;
      let ttime = 0; // time for noise animation
      let ripples: Array<{ x: number; y: number; r: number; speed: number; alpha: number }>= [];
      let gridSpacing = 48;
      let centerX = 0;
      let centerY = 0;

      const hexToRgb = (hex: string) => {
        const m = /^#?([a-f\d]{2})([a-f\d]{2})([a-f\d]{2})$/i.exec(hex);
        return m ? { r: parseInt(m[1], 16), g: parseInt(m[2], 16), b: parseInt(m[3], 16) } : null;
      };

      const colorWithAlpha = (hex: string, a: number) => {
        const c = hexToRgb(hex);
        if (!c) return `rgba(255,255,255,${a})`;
        return `rgba(${c.r}, ${c.g}, ${c.b}, ${a})`;
      };

      const reset = () => {
        if (!sketchRef.current) return;
        p.resizeCanvas(sketchRef.current.offsetWidth, sketchRef.current.offsetHeight);
        centerX = p.width / 2;
        centerY = p.height / 2;
        ripples = [];
      };

      p.setup = () => {
        p.createCanvas(sketchRef.current!.offsetWidth, sketchRef.current!.offsetHeight);
        p.noFill();
        p.strokeJoin(p.ROUND);
        p.strokeCap(p.ROUND);
        reset();
      };

      const drawGradientBackground = () => {
        // Radial gradient: center glow using accent color to background color
        const ctx = p.drawingContext as CanvasRenderingContext2D;
        const grad = ctx.createRadialGradient(centerX, centerY, Math.min(p.width, p.height) * 0.05, centerX, centerY, Math.hypot(centerX, centerY));
        grad.addColorStop(0, colorWithAlpha(currentTheme.accent_primary, 0.10));
        grad.addColorStop(1, currentTheme.bg_secondary);
        ctx.save();
        ctx.fillStyle = grad;
        ctx.fillRect(0, 0, p.width, p.height);
        ctx.restore();
      };

      const drawGrid = () => {
        p.push();
        p.stroke(colorWithAlpha(currentTheme.border, 0.25));
        p.strokeWeight(1);
        for (let x = (p.frameCount % gridSpacing); x <= p.width; x += gridSpacing) {
          p.line(x, 0, x, p.height);
        }
        for (let y = (p.frameCount % gridSpacing); y <= p.height; y += gridSpacing) {
          p.line(0, y, p.width, y);
        }
        p.pop();
      };

      const drawSeismicWaves = () => {
        // Multiple horizontal wave bands with perlin-noise displacement
        const layers = 5;
        const bandGap = Math.max(48, p.height / 12);
        const baseY = centerY - ((layers - 1) * bandGap) / 2;
        const accent = currentTheme.accent_primary;

        for (let i = 0; i < layers; i++) {
          const yOffset = baseY + i * bandGap;
          const amp = Math.min(64, Math.max(24, p.height * 0.06));
          const noiseScaleX = 0.008 + i * 0.0015;
          const noiseScaleT = 0.006 + i * 0.0008;

          p.push();
          p.stroke(colorWithAlpha(accent, 0.65 - i * 0.08));
          p.strokeWeight(2 + Math.max(0, 2 - i * 0.3));
          p.beginShape();
          for (let x = 0; x <= p.width; x += 8) {
            const n = p.noise(x * noiseScaleX, ttime * noiseScaleT + i * 10.0);
            const y = yOffset + (n - 0.5) * 2 * amp;
            p.curveVertex(x, y);
          }
          p.endShape();

          // Soft glow under each wave
          p.stroke(colorWithAlpha(accent, 0.10));
          p.strokeWeight(16);
          p.beginShape();
          for (let x = 0; x <= p.width; x += 12) {
            const n = p.noise(x * noiseScaleX, ttime * noiseScaleT + i * 10.0);
            const y = yOffset + (n - 0.5) * 2 * amp;
            p.curveVertex(x, y);
          }
          p.endShape();
          p.pop();
        }
      };

      const spawnRipple = (x: number, y: number) => {
        ripples.push({ x, y, r: 1, speed: 2 + p.random(0.5, 1.5), alpha: 0.35 });
      };

      const drawRipples = () => {
        const accent = currentTheme.accent_primary;
        p.push();
        for (let i = ripples.length - 1; i >= 0; i--) {
          const rp = ripples[i];
          rp.r += rp.speed;
          rp.alpha *= 0.985;
          p.stroke(colorWithAlpha(accent, rp.alpha));
          p.strokeWeight(2);
          p.noFill();
          p.ellipse(rp.x, rp.y, rp.r * 2, rp.r * 2);
          if (rp.alpha < 0.02 || rp.r > Math.max(p.width, p.height) * 1.2) {
            ripples.splice(i, 1);
          }
        }
        p.pop();
      };

      p.draw = () => {
        // Clear with base color first
        p.background(currentTheme.bg_secondary);

        // Layered rendering
        drawGradientBackground();
        drawGrid();
        drawSeismicWaves();
        drawRipples();

        // Occasionally spawn pulses
        if (p.random() < 0.02) {
          // Random epicenter
          spawnRipple(p.random(p.width), p.random(p.height));
        }
        if (p.frameCount % 180 === 0) {
          // Central heartbeat pulse
          spawnRipple(centerX + p.random(-40, 40), centerY + p.random(-20, 20));
        }

        // time advance
        ttime += 0.008;
      };

      p.windowResized = () => {
        reset();
      };

      // Allow external theme updates
      p.updateWithTheme = (newTheme: ThemeColors) => {
        currentTheme = newTheme;
      };

      // Optional: interactively trigger ripples on pointer move for a reactive feel
      p.mouseMoved = () => {
        if (p.mouseX >= 0 && p.mouseX <= p.width && p.mouseY >= 0 && p.mouseY <= p.height) {
          if (p.random() < 0.15) spawnRipple(p.mouseX, p.mouseY);
        }
      };
    };

    // @ts-ignore - p5 is loaded globally via index.html
    p5InstanceRef.current = new window.p5(sketch, sketchRef.current);

    return () => {
      p5InstanceRef.current?.remove?.();
    };
  }, []);

  // React to theme changes without remounting the sketch
  useEffect(() => {
    if (p5InstanceRef.current?.updateWithTheme) {
      p5InstanceRef.current.updateWithTheme(theme);
    }
  }, [theme]);

  return (
    <div className="relative w-full h-full overflow-hidden bg-bg-secondary flex justify-center items-center">
      <div ref={sketchRef} className="absolute inset-0 z-0" />

      <div className="relative z-10 flex flex-col justify-center items-center h-full text-center p-4 bg-transparent pointer-events-none select-none">
        <h2
          className="text-4xl md:text-5xl font-extrabold text-text-primary drop-shadow-lg tracking-tight animate-fade-in-scale"
          style={{ animationDelay: '0.15s' }}
        >
          {t('readyToAnalyze')}
        </h2>
        <p
          className="text-lg md:text-xl text-text-secondary mt-3 drop-shadow animate-fade-in-scale"
          style={{ animationDelay: '0.35s' }}
        >
          {t('dropFilesHint')}
        </p>
      </div>

      <style>{`
        @keyframes fade-in-scale {
          from { opacity: 0; transform: translateY(8px) scale(0.98); }
          to { opacity: 1; transform: translateY(0) scale(1); }
        }
        .animate-fade-in-scale {
          opacity: 0;
          animation: fade-in-scale 620ms cubic-bezier(.23,1,.32,1) forwards;
        }
      `}</style>
    </div>
  );
};

export default WelcomeScreen;
