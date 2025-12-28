import { useState, useCallback } from 'react';

export interface DamageNumberData {
  id: string;
  value: number;
  isCritical: boolean;
  isHealing: boolean;
  x: number;
  y: number;
}

export function useDamageNumbers() {
  const [damageNumbers, setDamageNumbers] = useState<DamageNumberData[]>([]);

  const addDamageNumber = useCallback((data: Omit<DamageNumberData, 'id'>) => {
    const id = `damage-${Date.now()}-${Math.random()}`;
    setDamageNumbers((prev) => [...prev, { ...data, id }]);
  }, []);

  const removeDamageNumber = useCallback((id: string) => {
    setDamageNumbers((prev) => prev.filter((d) => d.id !== id));
  }, []);

  return {
    damageNumbers,
    addDamageNumber,
    removeDamageNumber,
  };
}

