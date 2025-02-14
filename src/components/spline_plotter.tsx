import React, { useState, useEffect } from "react";

type Point = { x: number; y: number };

const getCurvePoints = (pts: number[], tension = 0.5, isClosed = false, numOfSegments = 16) => {
  let _pts = pts.slice(0);
  let res = [], x, y, t1x, t2x, t1y, t2y, c1, c2, c3, c4, st, t;

  if (isClosed) {
    _pts.unshift(pts[pts.length - 2], pts[pts.length - 1]);
    _pts.push(pts[0], pts[1]);
  } else {
    _pts.unshift(2 * pts[0] - pts[2], 2 * pts[1] - pts[3]); // Add mirrored point at start
    _pts.push(2 * pts[pts.length - 2] - pts[pts.length - 4], 2 * pts[pts.length - 1] - pts[pts.length - 3]); // Add mirrored point at end
  }

  for (let i = 2; i < (_pts.length - 4); i += 2) {
    for (t = 0; t <= numOfSegments; t++) {
      t1x = (_pts[i + 2] - _pts[i - 2]) * tension;
      t2x = (_pts[i + 4] - _pts[i]) * tension;
      t1y = (_pts[i + 3] - _pts[i - 1]) * tension;
      t2y = (_pts[i + 5] - _pts[i + 1]) * tension;
      st = t / numOfSegments;
      c1 = 2 * st ** 3 - 3 * st ** 2 + 1;
      c2 = -2 * st ** 3 + 3 * st ** 2;
      c3 = st ** 3 - 2 * st ** 2 + st;
      c4 = st ** 3 - st ** 2;
      x = c1 * _pts[i] + c2 * _pts[i + 2] + c3 * t1x + c4 * t2x;
      y = c1 * _pts[i + 1] + c2 * _pts[i + 3] + c3 * t1y + c4 * t2y;
      res.push({ x, y });
    }
  }
  return res;
};


export default function PointPlotter() {
  const [points, setPoints] = useState<Point[]>([]);
  const [history, setHistory] = useState<Point[][]>([[]]);
  const [currentIndex, setCurrentIndex] = useState(0);

  const addPoint = (e: React.MouseEvent) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const newPoint = { x: e.clientX - rect.left, y: e.clientY - rect.top };
    const newPoints = [...points, newPoint];
    setPoints(newPoints);
    setHistory(history.slice(0, currentIndex + 1).concat([newPoints]));
    setCurrentIndex(currentIndex + 1);
  };

  const handleKeyDown = (e: KeyboardEvent) => {
    if (e.ctrlKey && e.key === 'z' && currentIndex > 0) {
      setCurrentIndex(currentIndex - 1);
      setPoints(history[currentIndex - 1]);
    } else if (e.ctrlKey && e.key === 'y' && currentIndex < history.length - 1) {
      setCurrentIndex(currentIndex + 1);
      setPoints(history[currentIndex + 1]);
    }
  };

  useEffect(() => {
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [points, history, currentIndex]);

  const flatPoints = points.flatMap(p => [p.x, p.y]);
  const splinePoints = getCurvePoints(flatPoints);

  return (
    <div className="w-full h-full relative" onClick={addPoint}>
      {points.map((p, idx) => (
        <div
          key={idx}
          className="absolute bg-green-500 w-2 h-2 rounded-full"
          style={{ left: `${p.x}px`, top: `${p.y}px` }}
        />
      ))}
      {splinePoints.map((p, idx) => (
        <div
          key={idx}
          className="absolute bg-green-400 w-1 h-1 rounded-full"
          style={{ left: `${p.x}px`, top: `${p.y}px` }}
        />
      ))}
    </div>
  );
}
