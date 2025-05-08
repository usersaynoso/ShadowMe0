import React, { useState } from "react";
import { Input } from "./input";
import { Clock } from "lucide-react";

interface TimePickerProps {
  value: string;
  onChange: (value: string) => void;
  disabled?: boolean;
}

export function TimePicker({ value, onChange, disabled = false }: TimePickerProps) {
  // Time validation and formatting helper
  const formatTime = (timeStr: string): string => {
    // Extract hours and minutes if the format is valid
    const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
    const match = timeStr.match(timePattern);
    
    if (match) {
      const [_, hours, minutes] = match;
      // Ensure hours are 2 digits
      const formattedHours = hours.padStart(2, '0');
      return `${formattedHours}:${minutes}`;
    }
    
    // Return original string if invalid
    return timeStr;
  };
  
  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    onChange(formatTime(newValue));
  };
  
  const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
    const newValue = e.target.value;
    if (newValue.length > 0) {
      // Apply stricter validation on blur
      const timePattern = /^([01]?[0-9]|2[0-3]):([0-5][0-9])$/;
      if (!timePattern.test(newValue)) {
        // Fall back to default time if invalid
        onChange("12:00");
      } else {
        onChange(formatTime(newValue));
      }
    } else {
      // Fall back to default time if empty
      onChange("12:00");
    }
  };
  
  return (
    <div className="relative">
      <Clock className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-gray-500" />
      <Input
        type="text"
        value={value}
        onChange={handleChange}
        onBlur={handleBlur}
        placeholder="00:00"
        className="pl-9"
        pattern="[0-9]{1,2}:[0-9]{2}"
        disabled={disabled}
        aria-label="Time"
      />
    </div>
  );
} 