type ToastProps = {
  message: string | null;
};

export function Toast({ message }: ToastProps) {
  if (!message) return null;

  return (
    <div
      className={`mb-6 rounded-lg px-4 py-2.5 text-sm font-medium ${
        message.includes("Error")
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-green-50 text-green-700 border border-green-200"
      }`}
    >
      {message}
    </div>
  );
}
