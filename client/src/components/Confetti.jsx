import { useEffect, useRef } from 'react';

const COLORS = ['#4aaa4a', '#74bb74', '#a8d6a8', '#5dc55d', '#ffffff', '#d4ecd4'];

export default function Confetti({ onDone }) {
  const canvasRef = useRef(null);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');

    canvas.width = window.innerWidth;
    canvas.height = window.innerHeight;

    const particles = Array.from({ length: 90 }, () => ({
      x: Math.random() * canvas.width,
      y: Math.random() * canvas.height * 0.3 - 50,
      vx: (Math.random() - 0.5) * 4,
      vy: Math.random() * 3 + 2,
      r: Math.random() * 5 + 3,
      color: COLORS[Math.floor(Math.random() * COLORS.length)],
      angle: Math.random() * Math.PI * 2,
      spin: (Math.random() - 0.5) * 0.15,
      shape: Math.random() > 0.5 ? 'rect' : 'circle',
    }));

    let frame;
    let elapsed = 0;

    const animate = () => {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      elapsed += 16;

      particles.forEach(p => {
        p.x += p.vx;
        p.y += p.vy;
        p.vy += 0.06;
        p.angle += p.spin;

        ctx.save();
        ctx.translate(p.x, p.y);
        ctx.rotate(p.angle);
        ctx.globalAlpha = Math.max(0, 1 - elapsed / 3000);
        ctx.fillStyle = p.color;

        if (p.shape === 'rect') {
          ctx.fillRect(-p.r / 2, -p.r / 2, p.r, p.r * 0.5);
        } else {
          ctx.beginPath();
          ctx.arc(0, 0, p.r / 2, 0, Math.PI * 2);
          ctx.fill();
        }
        ctx.restore();
      });

      if (elapsed < 3500) {
        frame = requestAnimationFrame(animate);
      } else {
        onDone?.();
      }
    };

    frame = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(frame);
  }, [onDone]);

  return (
    <canvas
      ref={canvasRef}
      className="fixed inset-0 pointer-events-none z-[9980]"
    />
  );
}
