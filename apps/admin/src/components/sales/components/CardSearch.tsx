import { Input } from "@/components/ui/Input";
import Button from "@/components/ui/Button";
import { penceToPounds } from "@pokeflip/shared";
import type { ListedLot, SaleItem } from "../types";

interface Props {
  listedLots: ListedLot[];
  loadingLots: boolean;
  searchQuery: string;
  onSearchChange: (query: string) => void;
  saleItems: SaleItem[];
  onAddCard: (lot: ListedLot) => void;
}

export default function CardSearch({
  listedLots,
  loadingLots,
  searchQuery,
  onSearchChange,
  saleItems,
  onAddCard,
}: Props) {
  const filteredLots = listedLots.filter((lot) => {
    if (!searchQuery.trim()) return true;
    const query = searchQuery.toLowerCase();
    return (
      lot.card?.name?.toLowerCase().includes(query) ||
      lot.card?.number?.toLowerCase().includes(query) ||
      lot.card?.set?.name?.toLowerCase().includes(query)
    );
  });

  return (
    <div className="border border-gray-200 rounded-lg p-4">
      <h3 className="font-semibold text-sm mb-3">Add Cards to Sale</h3>
      <div className="mb-3">
        <Input
          type="text"
          placeholder="Search by card name, number, or set..."
          value={searchQuery}
          onChange={(e) => onSearchChange(e.target.value)}
          className="w-full"
        />
      </div>
      {loadingLots ? (
        <div className="text-sm text-gray-500 py-4">Loading listed cards...</div>
      ) : filteredLots.length === 0 ? (
        <div className="text-sm text-gray-500 py-4">No listed cards available</div>
      ) : (
        <div className="max-h-64 overflow-y-auto space-y-2">
          {filteredLots.map((lot) => (
            <div
              key={lot.id}
              className="flex items-center justify-between p-2 border border-gray-200 rounded hover:bg-gray-50"
            >
              <div className="flex-1">
                <div className="font-medium text-sm">
                  {lot.card ? `#${lot.card.number} ${lot.card.name}` : "Unknown card"}
                </div>
                <div className="text-xs text-gray-600">
                  {lot.card?.set?.name} • {lot.condition} • Available: {lot.available_qty}
                  {lot.list_price_pence && ` • List: £${penceToPounds(lot.list_price_pence)}`}
                </div>
              </div>
              <Button
                variant="secondary"
                size="sm"
                onClick={() => onAddCard(lot)}
                disabled={saleItems.some((item) => item.lotId === lot.id)}
              >
                {saleItems.some((item) => item.lotId === lot.id) ? "Added" : "Add"}
              </Button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
