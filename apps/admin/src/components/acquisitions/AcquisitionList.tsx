import { penceToPounds } from "@pokeflip/shared";
import Card from "@/components/ui/Card";

interface Acquisition {
  id: string;
  source_name: string;
  source_type: string;
  purchase_total_pence: number;
  purchased_at: string;
  status: "open" | "closed";
}

interface AcquisitionListProps {
  acquisitions: Acquisition[];
}

export default function AcquisitionList({ acquisitions }: AcquisitionListProps) {
  if (acquisitions.length === 0) {
    return <p className="text-sm text-gray-600">No acquisitions yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {acquisitions.map((acquisition) => (
        <Card key={acquisition.id}>
          <div className="flex items-center justify-between">
            <div>
              <div className="font-medium">{acquisition.source_name}</div>
              <div className="text-sm text-gray-600">
                {acquisition.source_type} • £{penceToPounds(acquisition.purchase_total_pence)} • {acquisition.status}
              </div>
            </div>
            <a
              href={`/admin/acquisitions/${acquisition.id}`}
              className="text-sm text-blue-600 hover:underline"
            >
              Open →
            </a>
          </div>
        </Card>
      ))}
    </div>
  );
}

