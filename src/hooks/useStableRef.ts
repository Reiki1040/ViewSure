import { useRef } from 'react';

export const useStableRef = <T,>(value: T) => {
  const ref = useRef(value);
  ref.current = value;
  return ref;
};

