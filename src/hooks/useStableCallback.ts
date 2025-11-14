import { useCallback, useRef } from 'react';

/**
 * A hook that returns a stable callback function that always calls the latest version
 * of the provided function, without causing re-renders when the function changes.
 */
export function useStableCallback<T extends (...args: any[]) => any>(callback: T): T {
  const callbackRef = useRef(callback);
  callbackRef.current = callback;

  return useCallback((...args: any[]) => {
    return callbackRef.current(...args);
  }, []) as T;
}

/**
 * A hook that returns a stable version of an object by deep comparison.
 * Useful for preventing unnecessary re-renders when passing objects as props.
 */
export function useStableObject<T extends object>(obj: T): T {
  const objRef = useRef(obj);
  const stringified = JSON.stringify(obj);

  if (JSON.stringify(objRef.current) !== stringified) {
    objRef.current = obj;
  }

  return objRef.current;
}

/**
 * A hook that returns a stable version of an array by deep comparison.
 */
export function useStableArray<T>(array: T[]): T[] {
  const arrayRef = useRef(array);
  const stringified = JSON.stringify(array);

  if (JSON.stringify(arrayRef.current) !== stringified) {
    arrayRef.current = array;
  }

  return arrayRef.current;
}

/**
 * A hook that memoizes a value and only updates when the value changes based on a custom equality function.
 */
export function useMemoizedValue<T>(
  value: T,
  isEqual: (a: T, b: T) => boolean = (a, b) => a === b
): T {
  const valueRef = useRef(value);

  if (!isEqual(valueRef.current, value)) {
    valueRef.current = value;
  }

  return valueRef.current;
}

/**
 * A hook that creates a stable event handler that doesn't change between renders.
 * This is useful for event handlers that need to be passed to child components.
 */
export function useStableEventHandler<T extends (...args: any[]) => void>(
  handler: T
): T {
  const handlerRef = useRef(handler);
  handlerRef.current = handler;

  return useCallback((...args: any[]) => {
    return handlerRef.current(...args);
  }, []) as T;
}