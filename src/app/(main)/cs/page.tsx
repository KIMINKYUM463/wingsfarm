"use client";

import { useState } from "react";
import { PageHeader } from "@/components/ui";
import { CsChat } from "@/components/cs/CsChat";
import { DelayNotice } from "@/components/cs/DelayNotice";
import { CS_BOT_NAME } from "@/lib/brand";

const TABS = [
  { id: "chat", label: "💬 AI 답변" },
  { id: "delay", label: "🚚 출고 지연 안내" },
] as const;

type Tab = (typeof TABS)[number]["id"];

export default function CsPage() {
  const [tab, setTab] = useState<Tab>("chat");
  return (
    <>
      <PageHeader
        title="CS 도우미"
        description={
          tab === "chat"
            ? `고객 문의 캡처나 글을 보내면 ${CS_BOT_NAME}가 답변을 만들어 드립니다. 대화로 수정도 할 수 있어요.`
            : "출고가 늦어질 것 같으면 고객이 묻기 전에 먼저 알리세요. 사유·날짜만 고르면 채널별 문구가 바로 나옵니다."
        }
      />
      <div className="mb-5 inline-flex rounded-xl border border-stone-200 bg-white p-1">
        {TABS.map((t) => (
          <button
            key={t.id}
            type="button"
            onClick={() => setTab(t.id)}
            className={`rounded-lg px-4 py-2 text-sm font-medium transition ${tab === t.id ? "bg-emerald-600 text-white shadow-sm" : "text-stone-600 hover:bg-stone-50"}`}
          >
            {t.label}
          </button>
        ))}
      </div>
      {/* 탭을 바꿔도 대화가 사라지지 않도록 둘 다 마운트해 두고 숨김만 전환 */}
      <div hidden={tab !== "chat"}>
        <CsChat />
      </div>
      <div hidden={tab !== "delay"}>
        <DelayNotice />
      </div>
    </>
  );
}
