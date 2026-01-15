type ImportStatusProps = {
  message: string | null;
};

export function ImportStatus({ message }: ImportStatusProps) {
  if (!message) return null;

  return (
    <div
      className={`p-4 rounded-lg ${
        message.includes("Error")
          ? "bg-red-50 text-red-700 border border-red-200"
          : "bg-green-50 text-green-700 border border-green-200"
      }`}
    >
      {message}
    </div>
  );
}
