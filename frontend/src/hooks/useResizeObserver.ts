// src/hooks/useResizeObserver.ts
import { useEffect, useState, useRef } from 'react';

/**
 * A hook that provides a resize observer for a given element.
 * 
 * @param callback Optional callback to be called when the observed element resizes
 * @returns An object containing a ref to attach to the element to be observed
 */
function useResizeObserver<T extends HTMLElement>(
  callback?: (entry: ResizeObserverEntry) => void
) {
  const [width, setWidth] = useState<number>(0);
  const [height, setHeight] = useState<number>(0);
  const resizeObserver = useRef<ResizeObserver | null>(null);
  const elementRef = useRef<T | null>(null);

  useEffect(() => {
    // Skip if not in browser environment
    if (typeof window === 'undefined' || !window.ResizeObserver) return;

    // Clean up previous observer
    if (resizeObserver.current && elementRef.current) {
      resizeObserver.current.unobserve(elementRef.current);
      resizeObserver.current.disconnect();
    }

    // Create new observer
    resizeObserver.current = new ResizeObserver((entries) => {
      if (entries && entries[0]) {
        const { width: newWidth, height: newHeight } = entries[0].contentRect;
        setWidth(newWidth);
        setHeight(newHeight);

        if (callback) {
          callback(entries[0]);
        }
      }
    });

    // Start observing if we have an element
    if (elementRef.current) {
      resizeObserver.current.observe(elementRef.current);
    }

    // Clean up on unmount
    return () => {
      if (resizeObserver.current) {
        resizeObserver.current.disconnect();
      }
    };
  }, [callback]);

  // Function to set the element to observe
  const setElement = (element: T | null) => {
    if (element !== elementRef.current) {
      if (resizeObserver.current && elementRef.current) {
        resizeObserver.current.unobserve(elementRef.current);
      }

      elementRef.current = element;

      if (resizeObserver.current && element) {
        resizeObserver.current.observe(element);
      }
    }
  };

  return { 
    ref: setElement, 
    width, 
    height 
  };
}

export default useResizeObserver;