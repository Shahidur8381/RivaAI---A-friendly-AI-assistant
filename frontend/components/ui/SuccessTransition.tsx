"use client";

import { useEffect, useState } from "react";

interface SuccessTransitionProps {
  show: boolean;
  onComplete: () => void;
}

export default function SuccessTransition({ show, onComplete }: SuccessTransitionProps) {
  const [render, setRender] = useState(false);

  useEffect(() => {
    if (show) {
      setRender(true);
      const t = setTimeout(() => {
        onComplete();
      }, 750); // Matches the 0.75s animation duration
      return () => clearTimeout(t);
    } else {
      setRender(false);
    }
  }, [show, onComplete]);

  if (!render) return null;

  return (
    <div className="ripple-overlay">
      <div className="ripple-circle" />
    </div>
  );
}
