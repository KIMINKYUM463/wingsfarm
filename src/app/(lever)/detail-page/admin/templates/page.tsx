'use client';

import { Suspense, useState, useEffect, useMemo, useCallback, useRef } from 'react';
import Link from 'next/link';
import { useSearchParams, useRouter } from 'next/navigation';
import { ROUTES } from '@/shared/constants/routes';
import HomeButton from '@/shared/ui/Button/HomeButton';
import Icon from '@/shared/ui/Icon';
import { getTemplates, getCategories, updateTemplateCategories } from './utils/api';
import type { TemplateListItem, Category } from './utils/types';
import FigmaSyncPanel from './_components/FigmaSyncPanel';

const LOAD_SIZE = 30;
const DEBOUNCE_MS = 1000;

export default function Admin2Page() {
  return (
    <Suspense fallback={<div className="flex h-screen items-center justify-center bg-gray-50"><div className="text-sm text-gray-500">로딩 중...</div></div>}>
      <Admin2Content />
    </Suspense>
  );
}

function Admin2Content() {
  const searchParams = useSearchParams();
  const router = useRouter();

  // 데이터 상태
  const [templates, setTemplates] = useState<TemplateListItem[]>([]);
  const [categories, setCategories] = useState<Category[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // URL에서 필터 상태 읽기
  const selectedPart1 = searchParams.get('part1');
  const selectedPart2 = searchParams.get('part2');
  const categoryFilterId = searchParams.get('cat');
  const categoryFilterMode = searchParams.get('catMode') as 'checked' | 'unchecked' | null;

  const categoryFilter = categoryFilterId && categoryFilterMode
    ? { categoryId: categoryFilterId, mode: categoryFilterMode }
    : null;

  // URL 업데이트 함수
  const updateQueryParams = useCallback((updates: Record<string, string | null>) => {
    const params = new URLSearchParams(searchParams.toString());
    Object.entries(updates).forEach(([key, value]) => {
      if (value === null) {
        params.delete(key);
      } else {
        params.set(key, value);
      }
    });
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [searchParams, router]);

  // 무한 스크롤
  const [visibleCount, setVisibleCount] = useState(LOAD_SIZE);
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);

  // 확대/축소 (0.5 ~ 5.0) - localStorage에서 복원
  const [scale, setScale] = useState(() => {
    if (typeof window !== 'undefined') {
      const saved = localStorage.getItem('admin2_scale');
      return saved ? Number(saved) : 1;
    }
    return 1;
  });

  // 이미지 비율 저장 (templateId -> aspectRatio)
  const [imageRatios, setImageRatios] = useState<Map<string, number>>(new Map());

  // 스크롤 위치 상태
  const [canScrollLeft, setCanScrollLeft] = useState(false);
  const [canScrollRight, setCanScrollRight] = useState(true);

  // 키보드 네비게이션: 현재 포커스된 셀 (col = 템플릿 인덱스, row = 카테고리 인덱스)
  const [focusedCell, setFocusedCell] = useState<{ col: number; row: number } | null>(null);
  // 범위 선택: 선택 시작점 (Shift + 방향키로 범위 선택 시 사용)
  const [selectionAnchor, setSelectionAnchor] = useState<{ col: number; row: number } | null>(null);

  // Debounce를 위한 상태
  const [pendingTemplates, setPendingTemplates] = useState<Set<string>>(new Set());
  const [savingTemplates, setSavingTemplates] = useState<Set<string>>(new Set());
  const debounceTimers = useRef<Map<string, NodeJS.Timeout>>(new Map());

  // 데이터 로드 (최초 + Figma 동기화 후)
  const loadData = useCallback(
    () =>
      Promise.all([getTemplates({ pageSize: 1000 }), getCategories()])
        .then(([templatesRes, categoriesRes]) => {
          // 이름순 정렬
          const sorted = templatesRes.templates.sort((a, b) =>
            a.name.localeCompare(b.name, undefined, { numeric: true })
          );
          setTemplates(sorted);
          setCategories(categoriesRes.categories.sort((a, b) => a.order - b.order));
          setError(null);
        })
        .catch((err) => setError(err instanceof Error ? err.message : '데이터 로드 실패'))
        .finally(() => setLoading(false)),
    []
  );

  useEffect(() => {
    loadData();
  }, [loadData]);

  // Part1 목록 추출
  const part1List = useMemo(() => {
    const set = new Set(templates.map((t) => t.part1));
    return Array.from(set).sort();
  }, [templates]);

  // Part2 목록 추출 (Part1 필터 적용)
  const part2List = useMemo(() => {
    const filtered = selectedPart1
      ? templates.filter((t) => t.part1 === selectedPart1)
      : templates;
    const set = new Set(filtered.map((t) => t.part2));
    return Array.from(set).sort();
  }, [templates, selectedPart1]);

  // 필터링된 템플릿
  const filteredTemplates = useMemo(() => {
    return templates.filter((t) => {
      if (selectedPart1 && t.part1 !== selectedPart1) return false;
      if (selectedPart2 && t.part2 !== selectedPart2) return false;

      // 카테고리 필터
      if (categoryFilter) {
        const isExcluded = t.excludedCategoryIds?.includes(categoryFilter.categoryId) ?? false;
        const isChecked = !isExcluded;
        if (categoryFilter.mode === 'checked' && !isChecked) return false;
        if (categoryFilter.mode === 'unchecked' && isChecked) return false;
      }

      return true;
    });
  }, [templates, selectedPart1, selectedPart2, categoryFilter]);

  // 무한 스크롤 적용
  const visibleTemplates = useMemo(() => {
    return filteredTemplates.slice(0, visibleCount);
  }, [filteredTemplates, visibleCount]);

  const hasMore = visibleCount < filteredTemplates.length;

  // IntersectionObserver로 무한 스크롤
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;

    const observer = new IntersectionObserver(
      (entries) => {
        if (entries[0].isIntersecting && hasMore) {
          setVisibleCount((prev) => prev + LOAD_SIZE);
        }
      },
      { rootMargin: '200px' }
    );

    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [hasMore]);

  // Part1 변경 시 Part2 초기화 + 스크롤 리셋
  const handlePart1Change = (part1: string | null) => {
    updateQueryParams({ part1, part2: null });
    setVisibleCount(LOAD_SIZE);
  };

  // Part2 변경 + 스크롤 리셋
  const handlePart2Change = (part2: string | null) => {
    updateQueryParams({ part2 });
    setVisibleCount(LOAD_SIZE);
  };

  // 카테고리 필터 토글: null → checked → unchecked → null
  const handleCategoryFilterToggle = (categoryId: string) => {
    if (!categoryFilter || categoryFilter.categoryId !== categoryId) {
      // 다른 카테고리거나 필터 없음 → checked 모드로
      updateQueryParams({ cat: categoryId, catMode: 'checked' });
    } else if (categoryFilter.mode === 'checked') {
      // checked → unchecked
      updateQueryParams({ cat: categoryId, catMode: 'unchecked' });
    } else {
      // unchecked → null (필터 해제)
      updateQueryParams({ cat: null, catMode: null });
    }
    setVisibleCount(LOAD_SIZE);
  };

  // 카테고리 필터 해제
  const clearCategoryFilter = () => {
    updateQueryParams({ cat: null, catMode: null });
  };

  // Debounced API 저장
  const saveTemplateCategories = useCallback(
    async (templateId: string, excludedCategoryIds: string[]) => {
      setSavingTemplates((prev) => new Set(prev).add(templateId));
      setPendingTemplates((prev) => {
        const next = new Set(prev);
        next.delete(templateId);
        return next;
      });

      try {
        await updateTemplateCategories(templateId, excludedCategoryIds);
      } catch (err) {
        setError(err instanceof Error ? err.message : '카테고리 수정 실패');
      } finally {
        setSavingTemplates((prev) => {
          const next = new Set(prev);
          next.delete(templateId);
          return next;
        });
      }
    },
    []
  );

  // 카테고리 토글 (Debounced)
  const handleToggleCategory = useCallback(
    (templateId: string, categoryId: string, currentlyExcluded: boolean) => {
      // 1. 즉시 UI 업데이트
      setTemplates((prev) =>
        prev.map((t) => {
          if (t.id !== templateId) return t;
          const newExcluded = currentlyExcluded
            ? t.excludedCategoryIds.filter((id) => id !== categoryId)
            : [...t.excludedCategoryIds, categoryId];
          return { ...t, excludedCategoryIds: newExcluded };
        })
      );

      // 2. Pending 상태 표시
      setPendingTemplates((prev) => new Set(prev).add(templateId));

      // 3. 기존 타이머 취소
      const existingTimer = debounceTimers.current.get(templateId);
      if (existingTimer) {
        clearTimeout(existingTimer);
      }

      // 4. 새 타이머 설정 (1초 후 저장)
      const timer = setTimeout(() => {
        // 최신 상태에서 excludedCategoryIds 가져오기
        setTemplates((currentTemplates) => {
          const template = currentTemplates.find((t) => t.id === templateId);
          if (template) {
            saveTemplateCategories(templateId, template.excludedCategoryIds);
          }
          return currentTemplates;
        });
        debounceTimers.current.delete(templateId);
      }, DEBOUNCE_MS);

      debounceTimers.current.set(templateId, timer);
    },
    [saveTemplateCategories]
  );

  // 컴포넌트 언마운트 시 타이머 정리
  useEffect(() => {
    return () => {
      debounceTimers.current.forEach((timer) => clearTimeout(timer));
    };
  }, []);


  // scale을 localStorage에 저장
  useEffect(() => {
    localStorage.setItem('admin2_scale', String(scale));
  }, [scale]);

  // 이미지 비율 저장 (캐시된 이미지도 처리)
  const handleImageRef = useCallback((templateId: string, img: HTMLImageElement | null) => {
    if (!img) return;

    const updateRatio = () => {
      if (img.naturalWidth > 0 && img.naturalHeight > 0) {
        const ratio = img.naturalHeight / img.naturalWidth;
        setImageRatios((prev) => {
          if (prev.get(templateId) === ratio) return prev; // 변경 없으면 스킵
          const next = new Map(prev);
          next.set(templateId, ratio);
          return next;
        });
      }
    };

    // 이미 로드된 이미지 (캐시)
    if (img.complete && img.naturalWidth > 0) {
      updateRatio();
    }
    // 로드 이벤트 리스너
    img.onload = updateRatio;
  }, []);

  // 현재 보이는 템플릿 중 가장 큰 이미지 높이 계산
  const maxThumbnailHeight = useMemo(() => {
    const columnWidth = 96 * scale - 8; // p-1 패딩 제외
    let maxHeight = columnWidth * (4 / 3); // 기본 3:4 비율

    visibleTemplates.forEach((t) => {
      const ratio = imageRatios.get(t.id);
      if (ratio) {
        const height = columnWidth * ratio;
        if (height > maxHeight) maxHeight = height;
      }
    });

    return maxHeight;
  }, [visibleTemplates, imageRatios, scale]);

  // 스크롤 위치 업데이트
  const updateScrollState = useCallback(() => {
    const container = scrollContainerRef.current;
    if (!container) return;
    setCanScrollLeft(container.scrollLeft > 0);
    setCanScrollRight(container.scrollLeft + container.clientWidth < container.scrollWidth - 1);
  }, []);

  // 좌우 스크롤
  const scrollBy = useCallback((direction: 'left' | 'right') => {
    const container = scrollContainerRef.current;
    if (!container) return;
    const columnWidth = 96 * scale;
    const categoryColumnWidth = columnWidth; // 카테고리 열 너비
    const visibleWidth = container.clientWidth - categoryColumnWidth;
    const scrollAmount = Math.floor(visibleWidth / columnWidth) * columnWidth; // 보이는 열 수만큼 이동
    container.scrollBy({
      left: direction === 'right' ? scrollAmount : -scrollAmount,
      behavior: 'smooth',
    });
  }, [scale]);

  // 처음/끝으로 스크롤
  const scrollToEdge = useCallback((edge: 'start' | 'end') => {
    const container = scrollContainerRef.current;
    if (!container) return;

    if (edge === 'end') {
      // 끝으로 이동 시 모든 템플릿 로드
      setVisibleCount(filteredTemplates.length);
      // 다음 렌더 사이클에서 스크롤
      requestAnimationFrame(() => {
        container.scrollTo({
          left: container.scrollWidth,
          behavior: 'smooth',
        });
      });
    } else {
      container.scrollTo({
        left: 0,
        behavior: 'smooth',
      });
    }
  }, [filteredTemplates.length]);

  // 스크롤 이벤트 리스너
  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    updateScrollState();
    container.addEventListener('scroll', updateScrollState);
    window.addEventListener('resize', updateScrollState);

    return () => {
      container.removeEventListener('scroll', updateScrollState);
      window.removeEventListener('resize', updateScrollState);
    };
  }, [updateScrollState, visibleTemplates.length, scale]);

  // 범위 선택 내 셀인지 확인
  const isCellInSelection = useCallback((col: number, row: number) => {
    if (!focusedCell) return false;
    if (!selectionAnchor) return focusedCell.col === col && focusedCell.row === row;

    const minCol = Math.min(selectionAnchor.col, focusedCell.col);
    const maxCol = Math.max(selectionAnchor.col, focusedCell.col);
    const minRow = Math.min(selectionAnchor.row, focusedCell.row);
    const maxRow = Math.max(selectionAnchor.row, focusedCell.row);

    return col >= minCol && col <= maxCol && row >= minRow && row <= maxRow;
  }, [focusedCell, selectionAnchor]);

  // 키보드 네비게이션
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      // 포커스된 셀이 없으면 첫 번째 셀로 시작
      if (!focusedCell) {
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key)) {
          e.preventDefault();
          setFocusedCell({ col: 0, row: 0 });
          setSelectionAnchor(null);
        }
        return;
      }

      const { col, row } = focusedCell;
      const maxCol = visibleTemplates.length - 1;
      const maxRow = categories.length - 1;

      // 선택 범위 내 모든 셀 토글
      const toggleSelectedCells = () => {
        const anchor = selectionAnchor || focusedCell;
        const minCol = Math.min(anchor.col, focusedCell.col);
        const maxColRange = Math.max(anchor.col, focusedCell.col);
        const minRow = Math.min(anchor.row, focusedCell.row);
        const maxRowRange = Math.max(anchor.row, focusedCell.row);

        for (let c = minCol; c <= maxColRange; c++) {
          for (let r = minRow; r <= maxRowRange; r++) {
            const template = visibleTemplates[c];
            const category = categories[r];
            if (template && category) {
              const isExcluded = template.excludedCategoryIds?.includes(category.id) ?? false;
              handleToggleCategory(template.id, category.id, isExcluded);
            }
          }
        }
      };

      switch (e.key) {
        case 'ArrowUp':
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            // Cmd/Ctrl + Up: 맨 위로
            setFocusedCell({ col, row: 0 });
            setSelectionAnchor(null);
          } else if (e.shiftKey) {
            // Shift + Up: 범위 선택 확장
            if (!selectionAnchor) setSelectionAnchor({ col, row });
            if (row > 0) setFocusedCell({ col, row: row - 1 });
          } else {
            setSelectionAnchor(null);
            if (row > 0) setFocusedCell({ col, row: row - 1 });
          }
          break;
        case 'ArrowDown':
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            // Cmd/Ctrl + Down: 맨 아래로
            setFocusedCell({ col, row: maxRow });
            setSelectionAnchor(null);
          } else if (e.shiftKey) {
            // Shift + Down: 범위 선택 확장
            if (!selectionAnchor) setSelectionAnchor({ col, row });
            if (row < maxRow) setFocusedCell({ col, row: row + 1 });
          } else {
            setSelectionAnchor(null);
            if (row < maxRow) setFocusedCell({ col, row: row + 1 });
          }
          break;
        case 'ArrowLeft':
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            // Cmd/Ctrl + Left: 맨 왼쪽으로
            setFocusedCell({ col: 0, row });
            setSelectionAnchor(null);
          } else if (e.shiftKey) {
            // Shift + Left: 범위 선택 확장
            if (!selectionAnchor) setSelectionAnchor({ col, row });
            if (col > 0) setFocusedCell({ col: col - 1, row });
          } else {
            setSelectionAnchor(null);
            if (col > 0) setFocusedCell({ col: col - 1, row });
          }
          break;
        case 'ArrowRight':
          e.preventDefault();
          if (e.metaKey || e.ctrlKey) {
            // Cmd/Ctrl + Right: 맨 오른쪽으로 (전체 로드)
            setVisibleCount(filteredTemplates.length);
            setSelectionAnchor(null);
            requestAnimationFrame(() => {
              setFocusedCell({ col: filteredTemplates.length - 1, row });
            });
          } else if (e.shiftKey) {
            // Shift + Right: 범위 선택 확장
            if (!selectionAnchor) setSelectionAnchor({ col, row });
            if (col < maxCol) {
              setFocusedCell({ col: col + 1, row });
              if (col >= visibleTemplates.length - 5 && hasMore) {
                setVisibleCount((prev) => prev + LOAD_SIZE);
              }
            }
          } else {
            setSelectionAnchor(null);
            if (col < maxCol) {
              setFocusedCell({ col: col + 1, row });
              if (col >= visibleTemplates.length - 5 && hasMore) {
                setVisibleCount((prev) => prev + LOAD_SIZE);
              }
            }
          }
          break;
        case ' ':
          e.preventDefault();
          toggleSelectedCells();
          break;
        case 'Escape':
          if (selectionAnchor) {
            // 먼저 범위 선택만 해제
            setSelectionAnchor(null);
          } else {
            // 범위가 없으면 포커스 해제
            setFocusedCell(null);
          }
          break;
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [focusedCell, selectionAnchor, visibleTemplates, categories, hasMore, handleToggleCategory, filteredTemplates.length]);

  // 포커스된 셀이 보이도록 스크롤
  useEffect(() => {
    if (!focusedCell || !scrollContainerRef.current) return;

    const container = scrollContainerRef.current;
    const columnWidth = 96 * scale;
    const categoryColumnWidth = columnWidth;

    // 가로 스크롤 조정
    const cellLeft = categoryColumnWidth + focusedCell.col * columnWidth;
    const cellRight = cellLeft + columnWidth;
    const viewLeft = container.scrollLeft + categoryColumnWidth;
    const viewRight = container.scrollLeft + container.clientWidth;

    if (cellLeft < viewLeft) {
      container.scrollTo({ left: cellLeft - categoryColumnWidth, behavior: 'smooth' });
    } else if (cellRight > viewRight) {
      container.scrollTo({ left: cellRight - container.clientWidth + columnWidth, behavior: 'smooth' });
    }
  }, [focusedCell, scale]);

  if (loading) {
    return (
      <div className="flex h-screen items-center justify-center bg-gray-50">
        <div className="text-sm text-gray-500">로딩 중...</div>
      </div>
    );
  }

  return (
    <div className="flex h-screen flex-col bg-gray-50">
      {/* 헤더 */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-3">
        <div className="flex items-center gap-4">
          <h1 className="text-lg font-bold text-gray-800">템플릿 카테고리 관리</h1>
          <div className="flex items-center gap-1 rounded-md bg-gray-100 px-3 py-1 text-xs text-gray-600">
            <span className="opacity-60">↑↓←→</span> 이동
            <span className="mx-1 text-gray-300">·</span>
            <span className="opacity-60">⌘+방향키</span> 끝으로
            <span className="mx-1 text-gray-300">·</span>
            <span className="opacity-60">⇧+방향키</span> 범위선택
            <span className="mx-1 text-gray-300">·</span>
            <span className="opacity-60">Space</span> 토글
            <span className="mx-1 text-gray-300">·</span>
            <span className="opacity-60">Esc</span> 해제
            {selectionAnchor && focusedCell && (
              <span className="ml-2 font-medium text-purple-600">
                ({Math.abs(selectionAnchor.col - focusedCell.col) + 1}×{Math.abs(selectionAnchor.row - focusedCell.row) + 1} 선택)
              </span>
            )}
          </div>
        </div>
        <div className="flex items-center gap-3">
          {(pendingTemplates.size > 0 || savingTemplates.size > 0) && (
            <div className="flex items-center gap-2 text-xs text-gray-500">
              {savingTemplates.size > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 animate-pulse rounded-full bg-blue-500" />
                  저장 중 {savingTemplates.size}개
                </span>
              )}
              {pendingTemplates.size > 0 && (
                <span className="flex items-center gap-1">
                  <span className="h-2 w-2 rounded-full bg-yellow-400" />
                  대기 중 {pendingTemplates.size}개
                </span>
              )}
            </div>
          )}
          <Link href={ROUTES.PROJECTS} className="btn-outline flex items-center gap-1">
            <Icon name="arrow_back" width={20} />
            <span className="p whitespace-nowrap">내 프로젝트</span>
          </Link>
          <HomeButton />
        </div>
      </div>

      <FigmaSyncPanel onSynced={loadData} />

      {/* 에러 메시지 */}
      {error && (
        <div className="bg-red-50 px-4 py-2 text-sm text-red-600">
          {error}
          <button onClick={() => setError(null)} className="ml-2 underline">
            닫기
          </button>
        </div>
      )}

      {/* 필터 영역 */}
      <div className="border-b bg-white px-4 py-3">
        {/* Part1 필터 */}
        <div className="mb-2 flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-12">Part1:</span>
          <button
            onClick={() => handlePart1Change(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedPart1 === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {part1List.map((part1) => (
            <button
              key={part1}
              onClick={() => handlePart1Change(part1)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedPart1 === part1
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {part1}
            </button>
          ))}
        </div>

        {/* Part2 필터 */}
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-xs font-medium text-gray-500 w-12">Part2:</span>
          <button
            onClick={() => handlePart2Change(null)}
            className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
              selectedPart2 === null
                ? 'bg-blue-500 text-white'
                : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
            }`}
          >
            전체
          </button>
          {part2List.map((part2) => (
            <button
              key={part2}
              onClick={() => handlePart2Change(part2)}
              className={`rounded-full px-3 py-1 text-xs font-medium transition-colors ${
                selectedPart2 === part2
                  ? 'bg-blue-500 text-white'
                  : 'bg-gray-100 text-gray-600 hover:bg-gray-200'
              }`}
            >
              {part2}
            </button>
          ))}
        </div>
      </div>

      {/* 결과 요약 + 확대/축소 */}
      <div className="flex items-center justify-between border-b bg-white px-4 py-2">
        <div className="flex items-center gap-3">
          <span className="text-xs text-gray-500">
            필터 결과: {filteredTemplates.length}개 {hasMore && `(${visibleTemplates.length}개 표시 중)`}
          </span>
          {categoryFilter && (
            <button
              onClick={clearCategoryFilter}
              className={`flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-medium ${
                categoryFilter.mode === 'checked'
                  ? 'bg-blue-100 text-blue-700'
                  : 'bg-orange-100 text-orange-700'
              }`}
            >
              <span>
                {categories.find((c) => c.id === categoryFilter.categoryId)?.name}:{' '}
                {categoryFilter.mode === 'checked' ? '체크됨' : '체크안됨'}
              </span>
              <span className="ml-1">×</span>
            </button>
          )}
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => setScale((s) => Math.max(0.5, s - 0.25))}
            disabled={scale <= 0.5}
            className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100"
          >
            −
          </button>
          <input
            type="range"
            min="0.5"
            max="5"
            step="0.25"
            value={scale}
            onChange={(e) => setScale(Number(e.target.value))}
            className="h-1 w-24 cursor-pointer appearance-none rounded-full bg-gray-200 accent-blue-500"
          />
          <button
            type="button"
            onClick={() => setScale((s) => Math.min(5, s + 0.25))}
            disabled={scale >= 5}
            className="flex h-6 w-6 items-center justify-center rounded bg-gray-100 text-sm font-bold text-gray-600 hover:bg-gray-200 disabled:opacity-30 disabled:hover:bg-gray-100"
          >
            +
          </button>
          <span className="ml-1 w-12 text-center text-xs font-medium text-gray-600">{Math.round(scale * 100)}%</span>
        </div>
      </div>

      {/* 매트릭스 그리드 */}
      <div className="relative flex-1">
        {/* 좌우 스크롤 버튼 */}
        {canScrollLeft && (
          <div className="absolute left-0 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1" style={{ marginLeft: 96 * scale }}>
            <button
              type="button"
              onClick={() => scrollToEdge('start')}
              className="rounded-r-lg bg-white px-2 py-2 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95"
              title="처음으로"
            >
              <span className="text-sm text-gray-700">◀◀</span>
            </button>
            <button
              type="button"
              onClick={() => scrollBy('left')}
              className="rounded-r-lg bg-white px-2 py-4 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95"
              title="이전"
            >
              <span className="text-xl text-gray-700">◀</span>
            </button>
          </div>
        )}
        {canScrollRight && (
          <div className="absolute right-0 top-1/2 z-20 flex -translate-y-1/2 flex-col gap-1">
            <button
              type="button"
              onClick={() => scrollToEdge('end')}
              className="rounded-l-lg bg-white px-2 py-2 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95"
              title="끝으로"
            >
              <span className="text-sm text-gray-700">▶▶</span>
            </button>
            <button
              type="button"
              onClick={() => scrollBy('right')}
              className="rounded-l-lg bg-white px-2 py-4 shadow-lg ring-1 ring-gray-200 transition-all hover:bg-blue-50 hover:shadow-xl active:scale-95"
              title="다음"
            >
              <span className="text-xl text-gray-700">▶</span>
            </button>
          </div>
        )}

        <div ref={scrollContainerRef} className="h-full overflow-auto overscroll-x-contain">
        <div className="inline-flex min-w-full pb-16">
          {/* 고정 카테고리 열 */}
          <div className="sticky left-0 z-10 border-r-2 border-gray-300 bg-gray-50 shadow-sm" style={{ width: 96 * scale }}>
            {/* 빈 셀 (템플릿 헤더와 동일한 높이) */}
            <div className="flex flex-col border-b-2 border-gray-300 bg-gray-100 p-1">
              <div className="rounded bg-gray-200" style={{ height: maxThumbnailHeight }} />
              <div
                className="mt-auto truncate pt-1 text-center font-bold text-gray-500"
                style={{ fontSize: Math.max(10, 10 * scale) }}
              >
                카테고리
              </div>
            </div>
            {/* 카테고리 라벨 (클릭으로 필터) */}
            {categories.map((cat, index) => {
              const isFiltered = categoryFilter?.categoryId === cat.id;
              const filterMode = isFiltered ? categoryFilter.mode : null;
              const isEven = index % 2 === 0;

              return (
                <button
                  key={cat.id}
                  type="button"
                  onClick={() => handleCategoryFilterToggle(cat.id)}
                  className={`flex h-10 w-full items-center justify-between border-b border-gray-200 px-3 text-sm font-semibold transition-colors ${
                    isFiltered
                      ? filterMode === 'checked'
                        ? 'bg-blue-100 text-blue-700 hover:bg-blue-200'
                        : 'bg-orange-100 text-orange-700 hover:bg-orange-200'
                      : isEven
                        ? 'bg-gray-50 text-gray-700 hover:bg-gray-100'
                        : 'bg-white text-gray-700 hover:bg-gray-100'
                  }`}
                  title={
                    isFiltered
                      ? filterMode === 'checked'
                        ? '체크된 템플릿만 표시 중 (클릭: 체크 안된 것만)'
                        : '체크 안된 템플릿만 표시 중 (클릭: 필터 해제)'
                      : '클릭하여 필터링'
                  }
                >
                  <span>{cat.name}</span>
                  {isFiltered && (
                    <span className="rounded-full bg-white/50 px-1.5 py-0.5 text-[10px]">
                      {filterMode === 'checked' ? '✓' : '✗'}
                    </span>
                  )}
                </button>
              );
            })}
          </div>

          {/* 스크롤 가능한 템플릿 열들 */}
          <div className="flex">
            {visibleTemplates.map((template, colIndex) => {
              const isPending = pendingTemplates.has(template.id);
              const isSaving = savingTemplates.has(template.id);
              const isColEven = colIndex % 2 === 0;

              return (
              <div
                key={template.id}
                className={`shrink-0 border-r border-gray-200 ${isColEven ? 'bg-white' : 'bg-gray-50/50'}`}
                style={{ width: 96 * scale }}
              >
                {/* 썸네일 + 이름 */}
                <div className="relative flex flex-col border-b-2 border-gray-300 p-1">
                  {/* 저장 상태 인디케이터 */}
                  {(isPending || isSaving) && (
                    <div className="absolute right-1 top-1 z-10">
                      {isSaving ? (
                        <div className="h-3 w-3 animate-pulse rounded-full bg-blue-500 shadow" title="저장 중..." />
                      ) : (
                        <div className="h-3 w-3 rounded-full bg-yellow-400 shadow" title="저장 대기 중" />
                      )}
                    </div>
                  )}
                  <div
                    className="flex items-center justify-center overflow-hidden rounded-lg bg-gray-100 shadow-sm"
                    style={{ height: maxThumbnailHeight }}
                  >
                    {template.thumbnailUrl ? (
                      <img
                        src={template.thumbnailUrl}
                        alt={template.name}
                        className="h-auto w-full object-contain"
                        ref={(img) => handleImageRef(template.id, img)}
                      />
                    ) : (
                      <div className="text-[10px] text-gray-400">No Image</div>
                    )}
                  </div>
                  <div
                    className="mt-auto truncate pt-1 text-center font-semibold text-gray-800"
                    style={{ fontSize: Math.max(10, 10 * scale) }}
                    title={template.name}
                  >
                    {template.name}
                  </div>
                </div>

                {/* 카테고리 토글 셀들 */}
                {categories.map((cat, rowIndex) => {
                  const isExcluded = template.excludedCategoryIds?.includes(cat.id) ?? false;
                  const isChecked = !isExcluded;
                  const isRowEven = rowIndex % 2 === 0;
                  const isFocused = focusedCell?.col === colIndex && focusedCell?.row === rowIndex;
                  const isSelected = isCellInSelection(colIndex, rowIndex);
                  const isInSelectionRange = isSelected && !isFocused;

                  return (
                    <button
                      key={cat.id}
                      type="button"
                      onClick={() => {
                        handleToggleCategory(template.id, cat.id, isExcluded);
                        setFocusedCell({ col: colIndex, row: rowIndex });
                        setSelectionAnchor(null);
                      }}
                      className={`flex h-10 w-full items-center justify-center border-b border-gray-200 text-lg font-bold transition-all ${
                        isFocused
                          ? 'ring-2 ring-inset ring-purple-500 bg-purple-100'
                          : isInSelectionRange
                            ? 'bg-purple-50 ring-1 ring-inset ring-purple-300'
                            : isChecked
                              ? 'bg-blue-100 text-blue-600 hover:bg-blue-200'
                              : isRowEven
                                ? 'bg-gray-50 text-gray-300 hover:bg-gray-100'
                                : 'bg-white text-gray-300 hover:bg-gray-100'
                      } ${isChecked && (isFocused || isInSelectionRange) ? 'text-blue-600' : ''} ${!isChecked && (isFocused || isInSelectionRange) ? 'text-gray-400' : ''}`}
                    >
                      {isChecked ? '✓' : '−'}
                    </button>
                  );
                })}
              </div>
            );
            })}

            {/* 무한 스크롤 센티넬 */}
            {hasMore && (
              <div ref={sentinelRef} className="flex shrink-0 items-center justify-center" style={{ width: 96 * scale }}>
                <div className="text-xs text-gray-400">로딩...</div>
              </div>
            )}

            {/* 빈 상태 */}
            {visibleTemplates.length === 0 && (
              <div className="flex h-64 w-full items-center justify-center text-sm text-gray-400">
                템플릿이 없습니다
              </div>
            )}
          </div>
        </div>
        </div>

      </div>
    </div>
  );
}
