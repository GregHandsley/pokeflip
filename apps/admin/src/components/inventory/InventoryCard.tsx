import { penceToPounds } from "@pokeflip/shared";
import Card from "@/components/ui/Card";
import { OptimizedImage } from "@/components/ui/OptimizedImage";

interface InventoryCardProps {
  card_id: string;
  number: string;
  name: string;
  api_image_url: string | null;
  qty_active: number | null;
  qty_listed: number | null;
  qty_sold: number | null;
  max_list_price_pence: number | null;
}

export default function InventoryCard({
  card_id,
  number,
  name,
  api_image_url,
  qty_active,
  qty_listed,
  qty_sold,
  max_list_price_pence,
}: InventoryCardProps) {
  return (
    <Card>
      <div className="flex items-center gap-3">
        {api_image_url && (
          <OptimizedImage
            src={api_image_url}
            alt={`${name} card`}
            className="h-12 w-auto rounded border border-gray-200"
            quality="low"
          />
        )}
        <div className="flex-1">
          <div className="font-medium">
            <span className="text-gray-500 font-normal">#{number}</span>{" "}
            {name}
          </div>
          <div className="text-sm text-gray-600">
            active {qty_active ?? 0} • listed {qty_listed ?? 0} • sold {qty_sold ?? 0}
            {max_list_price_pence != null && ` • max £${penceToPounds(max_list_price_pence)}`}
          </div>
        </div>
      </div>
    </Card>
  );
}

