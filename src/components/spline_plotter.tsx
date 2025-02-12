import React, { useState, useEffect, useRef } from "react";

const computeSpline = (points: { x: number; y: number }[]) => {
  if (points.length < 2) return points;
  
  const n = points.length;
  const xs = points.map(p => p.x);
  const ys = points.map(p => p.y);
  
  let a = [...ys];
  let b = Array(n - 1).fill(0);
  let d = Array(n - 1).fill(0);
  let h = Array(n - 1).fill(0);
  let alpha = Array(n - 1).fill(0);
  
  for (let i = 0; i < n - 1; i++) {
    h[i] = xs[i + 1] - xs[i];
  }
  
  let c = Array(n).fill(0);
  let l = Array(n).fill(1);
  let mu = Array(n).fill(0);
  let z = Array(n).fill(0);
  
  for (let i = 1; i < n - 1; i++) {
    alpha[i] = (3 / h[i]) * (a[i + 1] - a[i]) - (3 / h[i - 1]) * (a[i] - a[i - 1]);
  }
  
  for (let i = 1; i < n - 1; i++) {
    l[i] = 2 * (xs[i + 1] - xs[i - 1]) - h[i - 1] * mu[i - 1];
    mu[i] = h[i] / l[i];
    z[i] = (alpha[i] - h[i - 1] * z[i - 1]) / l[i];
  }
  
  for (let j = n - 2; j >= 0; j--) {
    c[j] = z[j] - mu[j] * c[j + 1];
    b[j] = (a[j + 1] - a[j]) / h[j] - (h[j] * (c[j + 1] + 2 * c[j])) / 3;
    d[j] = (c[j + 1] - c[j]) / (3 * h[j]);
  }
  
  let interpolatedPoints = [];
  for (let i = 0; i < n - 1; i++) {
    for (let x = xs[i]; x <= xs[i + 1]; x += 5) {
      let dx = x - xs[i];
      let y = a[i] + b[i] * dx + c[i] * dx ** 2 + d[i] * dx ** 3;
      interpolatedPoints.push({ x, y });
    }
  }
  return interpolatedPoints;
};

type Point = { x: number; y: number };

export default function PointPlotter() {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [points, setPoints] = useState<Point[]>([]);
  const [splinePoints, setSplinePoints] = useState<Point[]>([]);
  const [selectedPoint, setSelectedPoint] = useState<number | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  
  useEffect(() => {
    draw();
  }, [points, splinePoints]);

  const draw = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw points
    ctx.fillStyle = 'green';
    points.forEach(({ x, y }) => {
      ctx.beginPath();
      ctx.arc(x, y, 5, 0, Math.PI * 2);
      ctx.fill();
    });

    // Draw spline
    if (splinePoints.length > 1) {
      ctx.strokeStyle = 'green';
      ctx.lineWidth = 3;
      ctx.beginPath();
      ctx.moveTo(splinePoints[0].x, splinePoints[0].y);
      splinePoints.forEach(({ x, y }) => ctx.lineTo(x, y));
      ctx.stroke();
    }
  };

  const addPoint = (e: React.MouseEvent) => {
    const rect = canvasRef.current?.getBoundingClientRect();
    if (!rect) return;
    const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    setPoints([...points, newPoint]);
    updateSpline([...points, newPoint]);
  };

  const updateSpline = (newPoints: Point[]) => {
    if (newPoints.length < 2) return;
    const interpolated = computeSpline(newPoints);
    setSplinePoints(interpolated);
  };

  return (
    <canvas
    ref={canvasRef}
    className="flex w-full h-full border border-gray-300"
    onClick={addPoint}
    />
  );
}