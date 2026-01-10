import { InputHTMLAttributes, LabelHTMLAttributes } from "react";

interface InputProps extends InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  error?: string;
}

export function Input({ label, error, className = "", id, ...props }: InputProps) {
  const inputId = id || `input-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${inputId}-error` : undefined;

  return (
    <div>
      {label && (
        <label 
          htmlFor={inputId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {props.required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
      )}
      <input
        id={inputId}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black transition-colors ${
          error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        {...props}
      />
      {error && (
        <p 
          id={errorId}
          className="mt-1 text-sm text-red-600" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export function Select({ label, error, options, className = "", id, ...props }: SelectProps) {
  const selectId = id || `select-${Math.random().toString(36).substr(2, 9)}`;
  const errorId = error ? `${selectId}-error` : undefined;

  return (
    <div>
      {label && (
        <label 
          htmlFor={selectId}
          className="block text-sm font-medium text-gray-700 mb-1"
        >
          {label}
          {props.required && <span className="text-red-600 ml-1" aria-label="required">*</span>}
        </label>
      )}
      <select
        id={selectId}
        className={`w-full rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black transition-colors ${
          error ? "border-red-500 focus:ring-red-500 focus:border-red-500" : ""
        } ${className}`}
        aria-invalid={error ? "true" : undefined}
        aria-describedby={errorId}
        {...props}
      >
        {options.map((opt) => (
          <option key={opt.value} value={opt.value}>
            {opt.label}
          </option>
        ))}
      </select>
      {error && (
        <p 
          id={errorId}
          className="mt-1 text-sm text-red-600" 
          role="alert"
          aria-live="polite"
        >
          {error}
        </p>
      )}
    </div>
  );
}

