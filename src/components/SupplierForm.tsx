"use client";

import { useState } from "react";
import type { Supplier } from "@/types";
import { Button, Field, TextInput } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export function SupplierForm({ initial, onDone }: { initial: Supplier; onDone: () => void }) {
  const upsertSupplier = useAppStore((s) => s.upsertSupplier);
  const [name, setName] = useState(initial.name);

  return (
    <div className="space-y-4">
      <Field label="공급처명">
        <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: OO농장" />
      </Field>
      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button
          onClick={() => {
            upsertSupplier({ ...initial, name: name.trim() });
            onDone();
          }}
          disabled={!name.trim()}
        >
          저장
        </Button>
      </div>
    </div>
  );
}
