import { ReactNode } from "react";

interface AlertProps {
  type?: "success" | "error" | "info";
  children: ReactNode;
  className?: string;
}

export default function Alert({ type = "info", children, className = "" }: AlertProps) {
  const styles = {
    success: "bg-green-50 text-green-800 border-green-200",
    error: "bg-red-50 text-red-800 border-red-200",
    info: "bg-blue-50 text-blue-800 border-blue-200",
  };

  return (
    <div
      className={`rounded-lg border p-3 text-sm ${styles[type]} ${className}`}
    >
      {children}
    </div>
  );
}

