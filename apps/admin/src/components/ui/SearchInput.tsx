import { InputHTMLAttributes } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  placeholder?: string;
  "aria-label"?: string;
}

export default function SearchInput({ 
  placeholder = "Search...", 
  className = "", 
  "aria-label": ariaLabel,
  ...props 
}: SearchInputProps) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      aria-label={ariaLabel || placeholder}
      className={`w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2.5 outline-none focus:ring-2 focus:ring-black/80 focus:border-black transition-colors min-h-[36px] ${className}`}
      {...props}
    />
  );
}

