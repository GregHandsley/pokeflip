"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import { supabaseBrowser } from "@/lib/supabase/browser";
import PageHeader from "@/components/ui/PageHeader";
import IntakeLineForm from "@/components/acquisitions/IntakeLineForm";
import IntakeLineList from "@/components/acquisitions/IntakeLineList";
import Button from "@/components/ui/Button";
import Alert from "@/components/ui/Alert";
import Card from "@/components/ui/Card";

type IntakeRow = {
  id: string;
  condition: string;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  cards: { name: string; number: string; api_image_url: string | null } | null;
};

export default function AcquisitionEditorPage() {
  const { id } = useParams<{ id: string }>();
  const supabase = supabaseBrowser();
  const [draftLines, setDraftLines] = useState<IntakeRow[]>([]);
  const [msg, setMsg] = useState<string | null>(null);
  const [committing, setCommitting] = useState(false);

  const loadDraftLines = async () => {
    const { data, error } = await supabase
      .from("intake_lines")
      .select("id, condition, quantity, for_sale, list_price_pence, cards(name, number, api_image_url)")
      .eq("acquisition_id", id)
      .eq("status", "draft")
      .order("created_at", { ascending: true });

    if (error) {
      setMsg(error.message);
    } else {
      const mapped = (data ?? []).map((row: any) => ({
        ...row,
        cards: Array.isArray(row.cards) ? row.cards[0] : row.cards,
      }));
      setDraftLines(mapped as IntakeRow[]);
    }
  };

  useEffect(() => {
    void loadDraftLines();
  }, [id]);

  const handleCommit = async () => {
    setMsg(null);
    setCommitting(true);
    const { data, error } = await supabase.rpc("commit_acquisition", {
      p_acquisition_id: id,
    } as any);

    if (error) {
      setMsg(error.message);
    } else {
      const result = data as any;
      setMsg(result?.message ?? "Committed");
      await loadDraftLines();
    }
    setCommitting(false);
  };

  return (
    <div>
      <PageHeader
        title="Acquisition Intake"
        action={
          <a
            href="/admin/acquisitions"
            className="text-sm text-blue-600 hover:underline"
          >
            ← Back
          </a>
        }
      />

      <Card className="mb-6">
        <IntakeLineForm acquisitionId={id} onLineAdded={loadDraftLines} />
        <div className="mt-4 flex items-center justify-between pt-4 border-t border-gray-200">
          <Button
            variant="primary"
            onClick={handleCommit}
            disabled={committing || draftLines.length === 0}
          >
            {committing ? "Committing..." : "Commit to inventory"}
          </Button>
          <span className="text-sm text-gray-600">
            Draft lines: {draftLines.length}
          </span>
        </div>
        {msg && (
          <div className="mt-4">
            <Alert type={msg.includes("Error") ? "error" : "success"}>
              {msg}
            </Alert>
          </div>
        )}
      </Card>

      <section>
        <h2 className="text-lg font-semibold mb-3">Draft intake lines</h2>
        <IntakeLineList lines={draftLines} />
      </section>
    </div>
  );
}
