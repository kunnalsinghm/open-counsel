"use client";

import { useEffect, useRef, useState } from "react";
import { animate, useReducedMotion } from "framer-motion";

/** Counts from 0 to `value` once. Shows the final number straight away if the user prefers reduced motion. */
export default function CountUp({ value }: { value: number }) {
  const reduce = useReducedMotion();
  const [shown, setShown] = useState(reduce ? value : 0);
  const done = useRef(false);

  useEffect(() => {
    if (reduce) {
      setShown(value);
      return;
    }
    const controls = animate(done.current ? shown : 0, value, {
      duration: 0.8,
      ease: "easeOut",
      onUpdate: (v) => setShown(Math.round(v)),
    });
    done.current = true;
    return () => controls.stop();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [value, reduce]);

  return <>{shown}</>;
}
