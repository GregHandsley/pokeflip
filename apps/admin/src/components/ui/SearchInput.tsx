import { InputHTMLAttributes } from "react";

interface SearchInputProps extends Omit<InputHTMLAttributes<HTMLInputElement>, "type"> {
  placeholder?: string;
}

export default function SearchInput({ placeholder = "Search...", className = "", ...props }: SearchInputProps) {
  return (
    <input
      type="search"
      placeholder={placeholder}
      className={`w-full max-w-xl rounded-lg border border-gray-300 px-3 py-2 outline-none focus:ring-2 focus:ring-black/80 focus:border-black ${className}`}
      {...props}
    />
  );
}

