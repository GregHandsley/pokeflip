import { penceToPounds } from "@pokeflip/shared";
import Card from "@/components/ui/Card";

interface IntakeLine {
  id: string;
  condition: string;
  quantity: number;
  for_sale: boolean;
  list_price_pence: number | null;
  cards: { name: string; number: string; api_image_url: string | null } | null;
}

interface IntakeLineListProps {
  lines: IntakeLine[];
}

export default function IntakeLineList({ lines }: IntakeLineListProps) {
  if (lines.length === 0) {
    return <p className="text-sm text-gray-600">No draft lines yet.</p>;
  }

  return (
    <div className="grid gap-3">
      {lines.map((line) => (
        <Card key={line.id}>
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-3">
              {line.cards?.api_image_url && (
                <img
                  src={`${line.cards.api_image_url}/low.webp`}
                  alt=""
                  className="h-12 w-auto rounded border border-gray-200"
                />
              )}
              <div>
                <div className="font-medium">
                  <span className="text-gray-500 font-normal">#{line.cards?.number}</span>{" "}
                  {line.cards?.name}
                </div>
                <div className="text-sm text-gray-600">
                  {line.condition} • qty {line.quantity} •{" "}
                  {line.for_sale
                    ? `£${penceToPounds(line.list_price_pence)}`
                    : "not for sale"}
                </div>
              </div>
            </div>
            <span className="text-xs text-gray-500">draft</span>
          </div>
        </Card>
      ))}
    </div>
  );
}

