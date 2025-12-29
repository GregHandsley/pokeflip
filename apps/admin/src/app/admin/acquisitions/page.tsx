"use client";

import { useEffect, useState } from "react";
import { supabaseBrowser } from "@/lib/supabase/browser";
import { poundsToPence } from "@pokeflip/shared";
import PageHeader from "@/components/ui/PageHeader";
import AcquisitionForm from "@/components/acquisitions/AcquisitionForm";
import AcquisitionList from "@/components/acquisitions/AcquisitionList";

type Acquisition = {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  status: "open" | "closed";
};

export default function AcquisitionsPage() {
  const supabase = supabaseBrowser();
  const [rows, setRows] = useState<Acquisition[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    const { data, error } = await supabase
      .from("acquisitions")
      .select("id, source_name, source_type, purchase_total_pence, purchased_at, status")
      .order("created_at", { ascending: false });

    if (error) {
      console.error("Error loading acquisitions:", error);
    } else {
      setRows((data ?? []) as Acquisition[]);
    }
    setLoading(false);
  };

  useEffect(() => {
    void load();
  }, []);

  const handleCreate = async (data: { sourceName: string; sourceType: string; total: string }) => {
    const { error } = await supabase.from("acquisitions").insert({
      source_name: data.sourceName,
      source_type: data.sourceType,
      purchase_total_pence: poundsToPence(data.total),
      status: "open",
    } as any);

    if (error) {
      throw new Error(error.message);
    }

    await load();
  };

  return (
    <div>
      <PageHeader
        title="Acquisitions"
        description="Create an acquisition, then add intake lines and commit."
      />

      <div className="mb-8">
        <AcquisitionForm onSubmit={handleCreate} />
      </div>

      <section>
        <h2 className="text-lg font-semibold mb-3">Recent</h2>
        {loading ? (
          <p className="text-sm text-gray-600">Loading...</p>
        ) : (
          <AcquisitionList acquisitions={rows} />
        )}
      </section>
    </div>
  );
}
