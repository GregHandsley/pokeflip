"use client";

import { FormEvent, useState } from "react";
import { Input, Select } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";

interface AcquisitionFormProps {
  onSubmit: (data: { sourceName: string; sourceType: string; total: string }) => Promise<void>;
}

export default function AcquisitionForm({ onSubmit }: AcquisitionFormProps) {
  const [sourceName, setSourceName] = useState("");
  const [sourceType, setSourceType] = useState("packs");
  const [total, setTotal] = useState("0.00");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const sourceTypeOptions = [
    { value: "packs", label: "Packs" },
    { value: "collection", label: "Collection" },
    { value: "singles", label: "Singles" },
    { value: "trade", label: "Trade" },
    { value: "other", label: "Other" },
  ];

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setError(null);
    setLoading(true);

    try {
      await onSubmit({ sourceName, sourceType, total });
      setSourceName("");
      setTotal("0.00");
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={handleSubmit} className="grid gap-4 max-w-xl">
      <Input
        label="Source (where you bought it)"
        value={sourceName}
        onChange={(e) => setSourceName(e.target.value)}
        required
      />

      <Select
        label="Type"
        value={sourceType}
        onChange={(e) => setSourceType(e.target.value)}
        options={sourceTypeOptions}
      />

      <Input
        label="Total paid (£)"
        type="text"
        value={total}
        onChange={(e) => setTotal(e.target.value)}
        inputMode="decimal"
      />

      {error && <Alert type="error">{error}</Alert>}

      <Button type="submit" disabled={loading}>
        {loading ? "Creating..." : "Create Purchase"}
      </Button>
    </form>
  );
}

