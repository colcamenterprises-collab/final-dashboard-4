interface DishPreview3DProps {
  className?: string;
}

export function DishPreview3D({ className }: DishPreview3DProps) {
  return (
    <div className={`flex items-center justify-center bg-slate-100 text-slate-400 text-xs ${className || ''}`}>
      3D Preview Coming Soon
    </div>
  );
}
