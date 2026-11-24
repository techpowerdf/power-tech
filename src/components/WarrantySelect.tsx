import React, { useState, useEffect } from 'react';
import { WARRANTY_PRESET_OPTIONS, WARRANTY_PRESET_VALUES } from '../utils/warrantyHelpers';

interface WarrantySelectProps {
  id?: string;
  name?: string;
  value: number;
  onChange: (days: number) => void;
  className?: string;
  title?: string;
}

export const WarrantySelect: React.FC<WarrantySelectProps> = ({
  id,
  name,
  value,
  onChange,
  className = '',
  title
}) => {
  const safeVal = Number.isNaN(Number(value)) ? 90 : Math.max(0, Math.round(Number(value)));
  const isPreset = WARRANTY_PRESET_VALUES.has(safeVal);
  const [customMode, setCustomMode] = useState<boolean>(!isPreset);

  useEffect(() => {
    if (!WARRANTY_PRESET_VALUES.has(safeVal)) {
      setCustomMode(true);
    } else {
      setCustomMode(false);
    }
  }, [safeVal]);

  const handleSelectChange = (raw: string) => {
    if (raw === 'custom') {
      setCustomMode(true);
      if (isPreset) {
        onChange(safeVal === 90 ? 45 : safeVal);
      }
    } else {
      setCustomMode(false);
      onChange(Math.max(0, Number(raw) || 0));
    }
  };

  return (
    <div className="flex items-center gap-1.5">
      <select
        id={id}
        name={name}
        value={customMode ? 'custom' : safeVal}
        onChange={(e) => handleSelectChange(e.target.value)}
        title={title}
        className={`w-full bg-slate-900 border rounded-lg px-2.5 py-2 text-xs font-semibold focus:outline-none focus:border-blue-500 cursor-pointer ${
          safeVal === 0
            ? 'border-amber-500/50 text-amber-300'
            : 'border-slate-700 text-white'
        } ${className}`}
      >
        {WARRANTY_PRESET_OPTIONS.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
        <option value="custom">Outro prazo (dias)...</option>
      </select>

      {customMode && (
        <div className="flex items-center gap-1 shrink-0">
          <input
            type="number"
            min="0"
            max="3650"
            value={safeVal}
            onChange={(e) => onChange(Math.max(0, parseInt(e.target.value, 10) || 0))}
            className="w-16 bg-slate-950 border border-blue-500/60 rounded-lg px-2 py-2 text-xs text-white font-bold text-center focus:outline-none"
            title="Informe a quantidade de dias de garantia"
          />
          <span className="text-[10px] text-slate-400 font-semibold">d</span>
        </div>
      )}
    </div>
  );
};
