import { ButtonHTMLAttributes, ReactNode } from "react";

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  children: ReactNode;
  "aria-label"?: string;
}

export default function Button({
  variant = "primary",
  size = "md",
  className = "",
  children,
  ...props
}: ButtonProps) {
  // Minimum touch target size for laptop/desktop interaction (44x44px recommended)
  // Buttons should be at least 32px height for comfortable clicking
  const baseClasses =
    "rounded-lg font-medium transition-colors disabled:opacity-50 focus:outline-none focus:ring-2 focus:ring-offset-2 min-h-[32px]";
  const sizeClasses = {
    sm: "px-3 py-1.5 text-sm min-h-[32px]",
    md: "px-4 py-2 min-h-[36px]",
    lg: "px-6 py-3 text-lg min-h-[44px]",
  };
  const variants = {
    primary: "bg-black text-white hover:bg-gray-800 focus:ring-black",
    secondary: "bg-gray-200 text-gray-900 hover:bg-gray-300 focus:ring-gray-400",
    danger: "bg-red-600 text-white hover:bg-red-700 focus:ring-red-500",
  };

  return (
    <button
      className={`${baseClasses} ${sizeClasses[size]} ${variants[variant]} ${className}`}
      {...props}
    >
      {children}
    </button>
  );
}
