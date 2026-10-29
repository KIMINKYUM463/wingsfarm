"use client";

import { useState } from "react";
import { PageHeader, Tabs } from "@/components/ui";
import { ListingChecker } from "@/components/listing/ListingChecker";
import { NoticeBuilder } from "@/components/listing/NoticeBuilder";

const TABS = [
  { id: "check", label: "🛡️ 표현 검수" },
  { id: "notice", label: "📋 고시·원산지 만들기" },
] as const;

type Tab = (typeof TABS)[number]["id"];

/** 상품명 화면 등에서 ?title= 로 넘겨받는다 (레이아웃이 ClientOnly라 window 사용 가능) */
const initialTitle = () => new URLSearchParams(window.location.search).get("title")?.slice(0, 200) ?? "";

export default function ListingCheckPage() {
  const [tab, setTab] = useState<Tab>("check");
  const [title] = useState(initialTitle);
  return (
    <>
      <PageHeader
        title="등록 전 검수"
        description={
          tab === "check"
            ? "상품 올리기 전에 효능·과장·원산지·마켓 금지 문구를 잡아냅니다. 과태료·판매정지·검색 제한을 미리 막으세요."
            : "원산지 표기, 크기·당도 한 줄, 상품정보제공고시를 칸만 채우면 만들어 드려요."
        }
      />
      <Tabs tabs={TABS} value={tab} onChange={setTab} className="mb-5" />
      <div hidden={tab !== "check"}>
        <ListingChecker initialTitle={title} />
      </div>
      <div hidden={tab !== "notice"}>
        <NoticeBuilder />
      </div>
    </>
  );
}
