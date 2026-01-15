import PageHeader from "@/components/ui/PageHeader";
import type { Purchase } from "@/components/acquisitions/types";

type PurchaseLotsHeaderProps = {
  purchase: Purchase;
  showMenu: boolean;
  onShowMenu: (show: boolean) => void;
  onAddCard: () => void;
  onCloseClick: () => void;
  onReopenClick: () => void;
};

export function PurchaseLotsHeader({
  purchase,
  showMenu,
  onShowMenu,
  onAddCard,
  onCloseClick,
  onReopenClick,
}: PurchaseLotsHeaderProps) {
  return (
    <PageHeader
      title={`Purchase: ${purchase.source_name}`}
      action={
        <div className="flex items-center gap-3">
          <button
            onClick={onAddCard}
            className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 transition-colors"
          >
            Add New Card
          </button>
          <div className="relative">
            <button
              onClick={() => onShowMenu(!showMenu)}
              className="p-2 rounded-lg border border-gray-300 bg-white text-gray-700 hover:bg-gray-50 transition-colors"
              aria-label="More options"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                />
              </svg>
            </button>
            {showMenu && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => onShowMenu(false)} />
                <div className="absolute right-0 mt-1 w-48 bg-white rounded-lg shadow-lg border border-gray-200 z-20 py-1">
                  {purchase.status === "open" ? (
                    <button
                      onClick={onCloseClick}
                      className="w-full text-left px-4 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors"
                    >
                      Close Purchase
                    </button>
                  ) : (
                    <button
                      onClick={onReopenClick}
                      className="w-full text-left px-4 py-2 text-sm text-gray-700 hover:bg-gray-50 transition-colors"
                    >
                      Reopen Purchase
                    </button>
                  )}
                </div>
              </>
            )}
          </div>
        </div>
      }
    />
  );
}
