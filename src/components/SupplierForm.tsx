"use client";

import { useState } from "react";
import type { Supplier } from "@/types";
import { Button, Field, TextInput } from "@/components/ui";
import { useAppStore } from "@/store/useAppStore";

export function SupplierForm({ initial, onDone }: { initial: Supplier; onDone: () => void }) {
  const upsertSupplier = useAppStore((s) => s.upsertSupplier);
  const [name, setName] = useState(initial.name);
  const [contact, setContact] = useState(initial.contact ?? "");

  return (
    <div className="space-y-4">
      <div className="grid grid-cols-2 gap-3">
        <Field label="공급처명">
          <TextInput value={name} onChange={(e) => setName(e.target.value)} placeholder="예: OO농장" />
        </Field>
        <Field label="연락처·메일 (선택)">
          <TextInput value={contact} onChange={(e) => setContact(e.target.value)} placeholder="010-… / 카톡 / 메일" />
        </Field>
      </div>

      <div className="flex justify-end gap-2">
        <Button variant="secondary" onClick={onDone}>
          취소
        </Button>
        <Button
          onClick={() => {
            upsertSupplier({ id: initial.id, name: name.trim(), contact: contact.trim() || undefined });
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
