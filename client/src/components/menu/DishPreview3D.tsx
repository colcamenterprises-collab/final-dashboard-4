import { useEffect, useRef, useState } from "react";

interface DishPreview3DProps {
  modelUrl?: string;
  className?: string;
}

export default function DishPreview3D({ modelUrl, className }: DishPreview3DProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [rotation, setRotation] = useState(0);
  const [isLoading, setIsLoading] = useState(true);

  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext("2d");
    if (!ctx) return;

    let animationId: number;
    let angle = 0;

    const draw = () => {
      const width = canvas.width;
      const height = canvas.height;
      ctx.clearRect(0, 0, width, height);

      ctx.fillStyle = "#f8fafc";
      ctx.fillRect(0, 0, width, height);

      const centerX = width / 2;
      const centerY = height / 2;
      const radius = Math.min(width, height) * 0.3;

      ctx.save();
      ctx.translate(centerX, centerY);

      const scaleX = Math.cos(angle) * 0.3 + 0.7;
      ctx.scale(scaleX, 1);

      const gradient = ctx.createRadialGradient(0, 0, 0, 0, 0, radius);
      gradient.addColorStop(0, "#d97706");
      gradient.addColorStop(0.5, "#b45309");
      gradient.addColorStop(1, "#92400e");

      ctx.beginPath();
      ctx.arc(0, -radius * 0.1, radius, 0, Math.PI, true);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.beginPath();
      ctx.arc(0, radius * 0.1, radius, 0, Math.PI, false);
      ctx.fillStyle = gradient;
      ctx.fill();

      ctx.fillStyle = "#22c55e";
      ctx.fillRect(-radius * 0.8, -radius * 0.05, radius * 1.6, radius * 0.1);

      ctx.fillStyle = "#7c2d12";
      ctx.fillRect(-radius * 0.75, 0, radius * 1.5, radius * 0.15);

      ctx.fillStyle = "#fcd34d";
      ctx.fillRect(-radius * 0.7, -radius * 0.15, radius * 1.4, radius * 0.08);

      ctx.restore();

      angle += 0.02;
      setRotation(angle);
      animationId = requestAnimationFrame(draw);
    };

    setIsLoading(false);
    draw();

    return () => {
      if (animationId) cancelAnimationFrame(animationId);
    };
  }, [modelUrl]);

  return (
    <div className={`relative rounded-lg overflow-hidden bg-slate-100 min-h-[180px] ${className || ""}`}>
      {isLoading && (
        <div className="absolute inset-0 flex items-center justify-center bg-slate-100">
          <div className="text-sm text-slate-500">Loading 3D...</div>
        </div>
      )}
      <canvas
        ref={canvasRef}
        width={300}
        height={200}
        className="w-full h-full min-h-[180px] block"
        style={{ display: 'block' }}
      />
      <div className="absolute bottom-2 left-2 text-xs text-slate-500 bg-white/80 px-2 py-1 rounded">
        {modelUrl ? `Model: ${modelUrl}` : "Default burger preview"}
      </div>
    </div>
  );
}
