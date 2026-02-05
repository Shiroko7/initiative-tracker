import React, { useEffect, useRef } from "react";

function useHeightMonitor(setHeight: (height: number) => void) {
  const heightReferenceDivRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!heightReferenceDivRef.current) return;
    const resizeObserver = new ResizeObserver((entries) => {
      if (entries.length > 0) {
        const height = entries[0].borderBoxSize[0].blockSize;
        setHeight(height);
      }
    });
    resizeObserver.observe(heightReferenceDivRef.current);
    return () => {
      resizeObserver.disconnect();
    };
  }, [heightReferenceDivRef, setHeight]);

  return heightReferenceDivRef;
}

export default function HeightMonitor({
  children,
  onChange,
}: {
  children: React.ReactNode;
  onChange: (height: number) => void;
}) {
  const heightReferenceDivRef = useHeightMonitor(onChange);

  return <div ref={heightReferenceDivRef}>{children}</div>;
}
