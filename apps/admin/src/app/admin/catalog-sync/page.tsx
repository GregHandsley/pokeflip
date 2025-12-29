"use client";

import { useState } from "react";
import PageHeader from "@/components/ui/PageHeader";
import Card from "@/components/ui/Card";
import Alert from "@/components/ui/Alert";

export default function CatalogSyncPage() {
  const [msg, setMsg] = useState<string | null>(null);
  const [msgType, setMsgType] = useState<"success" | "error" | "info">("info");

  return (
    <div>
      <PageHeader
        title="Catalog Information"
        description="Sets and cards are now loaded directly from TCGdx API - no syncing required!"
      />

      <Card className="mb-6">
        <h2 className="text-lg font-semibold mb-4">TCGdx API Integration</h2>
        <div className="space-y-3 text-sm text-gray-700">
          <p>
            <strong>✅ Fast & Direct:</strong> Sets and cards are fetched directly from TCGdx API 
            (<code className="bg-gray-100 px-1 rounded">https://api.tcgdex.net/v2</code>) 
            - no database caching needed.
          </p>
          <p>
            <strong>✅ Multilingual Support:</strong> TCGdx supports multiple languages including 
            English, Japanese, Chinese, and more. Use the <code className="bg-gray-100 px-1 rounded">locale</code> 
            parameter to switch languages.
          </p>
          <p>
            <strong>✅ Always Up-to-Date:</strong> Data is always fresh from the API source.
          </p>
        </div>
      </Card>

      <Card>
        <h2 className="text-lg font-semibold mb-4">API Endpoints</h2>
        <div className="space-y-2 text-sm">
          <div>
            <strong>Get All Sets:</strong>
            <code className="block bg-gray-100 p-2 rounded mt-1">
              GET /api/catalog/sets?locale=en
            </code>
          </div>
          <div>
            <strong>Get Cards for a Set:</strong>
            <code className="block bg-gray-100 p-2 rounded mt-1">
              GET /api/catalog/cards?setId={"{setId}"}&locale=en
            </code>
          </div>
        </div>
      </Card>
    </div>
  );
}

