import { useState, useRef, useEffect } from 'react';

interface Props {
  onDelete: () => void;
  children: React.ReactNode;
  suppressRef?: React.MutableRefObject<boolean>;
  borderRadius?: number;
}

export function SwipeToDelete({ onDelete, children, suppressRef, borderRadius = 16 }: Props) {
  const [offset, setOffset] = useState(0);
  const [dragging, setDragging] = useState(false);

  const containerRef = useRef<HTMLDivElement>(null);
  const startX = useRef(0);
  const startY = useRef(0);
  const dir = useRef<'h' | 'v' | null>(null);
  const offsetRef = useRef(0);
  const onDeleteRef = useRef(onDelete);

  // Keep onDeleteRef current without re-attaching native listeners
  useEffect(() => { onDeleteRef.current = onDelete; });

  useEffect(() => {
    const el = containerRef.current;
    if (!el) return;

    const onStart = (e: TouchEvent) => {
      startX.current = e.touches[0].clientX;
      startY.current = e.touches[0].clientY;
      dir.current = null;
    };

    const onMove = (e: TouchEvent) => {
      const dx = e.touches[0].clientX - startX.current;
      const dy = e.touches[0].clientY - startY.current;

      if (dir.current === null && (Math.abs(dx) > 8 || Math.abs(dy) > 8)) {
        dir.current = Math.abs(dx) > Math.abs(dy) ? 'h' : 'v';
        if (dir.current === 'h') setDragging(true);
      }

      if (dir.current === 'h' && dx < 0) {
        // Stop event from reaching parent carousel before it can react
        e.stopPropagation();
        if (suppressRef) suppressRef.current = true;
        const next = Math.max(dx, -100);
        offsetRef.current = next;
        setOffset(next);
      }
    };

    const onEnd = () => {
      setDragging(false);
      dir.current = null;
      if (suppressRef) setTimeout(() => { suppressRef.current = false; }, 100);
      if (offsetRef.current < -60) {
        onDeleteRef.current();
      } else {
        offsetRef.current = 0;
        setOffset(0);
      }
    };

    el.addEventListener('touchstart', onStart, { passive: true });
    el.addEventListener('touchmove', onMove, { passive: true });
    el.addEventListener('touchend', onEnd, { passive: true });

    return () => {
      el.removeEventListener('touchstart', onStart);
      el.removeEventListener('touchmove', onMove);
      el.removeEventListener('touchend', onEnd);
    };
  }, []); // containerRef не меняется — пустые deps корректны

  const swiping = offset < 0;

  return (
    <div
      ref={containerRef}
      data-swiping={swiping ? 'true' : undefined}
      style={{
        position: 'relative',
        borderRadius,
        overflow: 'hidden',
        touchAction: 'pan-y',
        background: swiping ? 'var(--danger)' : undefined,
      }}
    >
      {swiping && (
        <span style={{
          position: 'absolute',
          right: 20,
          top: '50%',
          transform: 'translateY(-50%)',
          color: '#fff',
          fontSize: 12,
          fontWeight: 700,
          pointerEvents: 'none',
        }}>
          Удалить
        </span>
      )}
      <div style={{
        transform: `translateX(${offset}px)`,
        transition: dragging ? 'none' : 'transform 0.25s ease',
      }}>
        {children}
      </div>
    </div>
  );
}
