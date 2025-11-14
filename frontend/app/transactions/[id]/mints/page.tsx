"use client";
import React, { useEffect, useState } from "react";

type MintRecord = {
  id: string;
  transaction_id: string;
  user_address: string;
  capy_amount: string;
  tx_hash?: string;
  minted_at?: string;
  error?: string;
};

const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:3001";

export default function TransactionMintsPage({ params }: { params: { id: string } }) {
  const { id } = params;
  const [mints, setMints] = useState<MintRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const fetchMints = async () => {
      setLoading(true);
      setError(null);
      try {
        const res = await fetch(`${BACKEND_URL}/api/payments/transaction/${id}/mints`);
        const json = await res.json();
        if (!json.success) throw new Error(json.error || "Failed to load mints");
        setMints(json.data || []);
      } catch (e: any) {
        setError(e.message);
      } finally {
        setLoading(false);
      }
    };
    fetchMints();
  }, [id]);

  return (
    <div className="p-6 max-w-3xl mx-auto">
      <h1 className="text-2xl font-semibold mb-4">CAPY Mints for Transaction</h1>
      <p className="text-sm text-gray-600 mb-6">Transaction ID: {id}</p>
      {loading && <p>Loading mint records...</p>}
      {error && <p className="text-red-600">{error}</p>}
      {!loading && !error && mints.length === 0 && (
        <p className="text-gray-600">No mint records found for this transaction.</p>
      )}
      {!loading && !error && mints.length > 0 && (
        <div className="space-y-4">
          {mints.map((m) => (
            <div key={m.id} className="border rounded p-4">
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-medium">User:</span> {m.user_address}
              </div>
              <div className="text-sm text-gray-700 mb-2">
                <span className="font-medium">CAPY Amount:</span> {m.capy_amount}
              </div>
              {m.tx_hash && (
                <div className="text-sm text-gray-700 mb-2">
                  <span className="font-medium">Tx Hash:</span> {m.tx_hash}
                </div>
              )}
              <div className="text-sm text-gray-700">
                <span className="font-medium">Minted At:</span> {m.minted_at ? new Date(m.minted_at).toLocaleString() : "-"}
              </div>
              {m.error && (
                <div className="text-sm text-red-600 mt-2">
                  <span className="font-medium">Error:</span> {m.error}
                </div>
              )}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}