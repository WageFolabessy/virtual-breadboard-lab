"use client";

import React from "react";

interface ColorSwatchButtonProps {
  color: string;
  name: string;
  isSelected: boolean;
  onClick: () => void;
}

/**
 * A reusable color swatch button for picking colors.
 * Used for wires, LEDs, and any future colorable components.
 */
export const ColorSwatchButton: React.FC<ColorSwatchButtonProps> = ({
  color,
  name,
  isSelected,
  onClick,
}) => {
  return (
    <button
      onClick={onClick}
      title={name}
      className={`
        w-8 h-8 rounded-full border-2 transition-all duration-150
        ${isSelected ? "border-gray-800 scale-110 ring-2 ring-offset-2 ring-gray-400" : "border-gray-300 hover:scale-105"}
      `}
      style={{ backgroundColor: color }}
    />
  );
};
