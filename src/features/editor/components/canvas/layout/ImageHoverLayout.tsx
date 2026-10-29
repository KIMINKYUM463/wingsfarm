/**
 * ImageControlOverlay
 *
 * name: '_image'인 요소에 hover 시 오버레이 + 컨트롤 버튼을 표시하는 컴포넌트
 *
 * ## 최적화
 * - useCallback으로 이벤트 핸들러 메모이제이션
 * - useMemo로 계산값 메모이제이션
 * - IconButton 컴포넌트 분리 및 memo로 불필요한 리렌더링 방지
 * - Konva 네이티브 요소로 shimmer/spinner 구현 (캔버스 스케일 자동 적용)
 */

'use client';

import { useState, useMemo, useEffect, useRef, useCallback, memo, type ReactNode, type RefObject } from 'react';
import { Group, Rect, Path, Text } from 'react-konva';
import { Html } from 'react-konva-utils';
import type Konva from 'konva';
import { isImageElement } from '@/features/editor/lib/element-finder';
import { useImageGenerationStore } from '@/features/editor/store/useImageGenerationStore';
import { useCanvasDataStore } from '@/features/editor/store/useCanvasDataStore';
import { useToolPanelStore } from '@/features/editor/store/useToolPanelStore';
import {
  useSelectionStore,
  useIsDragging,
  useSetIsDragging,
  useSelectedItems,
} from '@/features/editor/store/useSelectionStore';
import { useElementStore } from '@/features/editor/store/useElementStore';
import { useIsDropTarget } from '@/features/editor/store/useImageDropTargetStore';
import { useAssetUpload, type UploadedAssetInfo } from '@/features/editor/hooks/useAssetUpload';
import { TOGGLE_STATES } from '@/shared/constants/ui/toggles';
import { findDropTarget } from '@/features/editor/utils/dragUtils';
import { getSelectionType } from '@/features/editor/lib/selection-type';
import { useSnapStore } from '@/features/editor/store/useSnapStore';

// ============================================
// 타입 정의
// ============================================
interface ImageControlOverlayProps {
  element: {
    id: string;
    type: string;
    name?: string;
    x: number;
    y: number;
    width?: number;
    height?: number;
    cornerRadius?: number | number[];
    rotation?: number;
    offsetX?: number;
    offsetY?: number;
    assetId?: string;
    rootId?: string;
  };
  elementRef?: RefObject<Konva.Node | null>;
  children: ReactNode;
  onDragStart?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
  onDragMove?: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

interface IconButtonProps {
  x: number;
  y: number;
  iconPath: string;
  cornerRadius: number | number[];
  tooltip: string;
  onClick: (e: Konva.KonvaEventObject<MouseEvent>) => void;
}

// ============================================
// 상수
// ============================================
const BUTTON_SIZE = 42;
const BUTTON_HALF = 21;
const HOVER_RECT_SIZE = 34;
const HOVER_RECT_OFFSET = 4;
const ICON_OFFSET = 9;

const ICON_PATHS = {
  backup:
    'M6.5 19.5C5.118 19.5 3.93917 19.0206 2.9635 18.0617C1.98783 17.1029 1.5 15.9311 1.5 14.5463C1.5 13.3039 1.89967 12.2113 2.699 11.2683C3.49833 10.3253 4.48967 9.76658 5.673 9.59225C5.9935 8.09742 6.74517 6.875 7.928 5.925C9.11067 4.975 10.468 4.5 12 4.5C13.8107 4.5 15.3467 5.13067 16.608 6.392C17.8693 7.65333 18.5 9.18933 18.5 11V11.5H18.8078C19.8616 11.582 20.7404 12.0058 21.4443 12.7713C22.1481 13.5366 22.5 14.4462 22.5 15.5C22.5 16.6153 22.1154 17.5608 21.3463 18.3365C20.5769 19.1122 19.6346 19.5 18.5193 19.5H13.0577C12.5526 19.5 12.125 19.325 11.775 18.975C11.425 18.625 11.25 18.1974 11.25 17.6923V12.2152L9.4 14.0345L8.34625 12.9905L12 9.3365L15.6538 12.9905L14.6 14.0345L12.75 12.2152V17.6923C12.75 17.7692 12.7821 17.8398 12.8462 17.9038C12.9102 17.9679 12.9808 18 13.0577 18H18.5C19.2 18 19.7917 17.7583 20.275 17.275C20.7583 16.7917 21 16.2 21 15.5C21 14.8 20.7583 14.2083 20.275 13.725C19.7917 13.2417 19.2 13 18.5 13H17V11C17 9.61667 16.5125 8.4375 15.5375 7.4625C14.5625 6.4875 13.3833 6 12 6C10.6167 6 9.4375 6.4875 8.4625 7.4625C7.4875 8.4375 7 9.61667 7 11H6.48075C5.53325 11 4.71625 11.3417 4.02975 12.025C3.34325 12.7083 3 13.5333 3 14.5C3 15.4667 3.34167 16.2917 4.025 16.975C4.70833 17.6583 5.53333 18 6.5 18H9V19.5H6.5Z',
  upload:
    'M11.25 15.7885V7.3885L8.78475 9.85375L7.73075 8.76925L12 4.5L16.2693 8.76925L15.2153 9.85375L12.75 7.3885V15.7885H11.25ZM6.30775 19.5C5.80258 19.5 5.375 19.325 5.025 18.975C4.675 18.625 4.5 18.1974 4.5 17.6923V14.9808H6V17.6923C6 17.7692 6.03208 17.8398 6.09625 17.9038C6.16025 17.9679 6.23075 18 6.30775 18H17.6923C17.7692 18 17.8398 17.9679 17.9038 17.9038C17.9679 17.8398 18 17.7692 18 17.6923V14.9808H19.5V17.6923C19.5 18.1974 19.325 18.625 18.975 18.975C18.625 19.325 18.1974 19.5 17.6923 19.5H6.30775Z',
  spinner:
    'M7.07107 7.07107C10.9763 3.16583 17.308 3.16582 21.2132 7.07107L19.0919 9.19239C16.3582 6.45872 11.9261 6.45872 9.19239 9.19239C6.45872 11.9261 6.45872 16.3582 9.19239 19.0919L7.07107 21.2132C3.16582 17.308 3.16582 10.9763 7.07107 7.07107Z',
  // 이미지 교체 아이콘 (36x36, 피그마 디자인 - image_change.svg)
  replace:
    // 왼쪽 위 이미지 프레임
    'M5.28303 18C4.86145 18 4.50055 17.8531 4.20033 17.5594C3.90011 17.2656 3.75 16.9125 3.75 16.5V6C3.75 5.5875 3.90011 5.23438 4.20033 4.94063C4.50055 4.64688 4.86145 4.5 5.28303 4.5H16.0142C16.4358 4.5 16.7967 4.64688 17.0969 4.94063C17.3972 5.23438 17.5473 5.5875 17.5473 6V16.5C17.5473 16.9125 17.3972 17.2656 17.0969 17.5594C16.7967 17.8531 16.4358 18 16.0142 18H5.28303ZM5.28303 16.5H16.0142V6H5.28303V16.5ZM6.04954 15H15.2477L12.3733 11.25L10.0737 14.25L8.34909 12L6.04954 15Z' +
    // 오른쪽 위 → 왼쪽 아래 화살표
    'M28.8007 16.3021L25.3513 12.9271L26.5586 11.7458L27.9383 13.0958V12.9481C27.9383 11.5419 27.4317 10.3466 26.4185 9.36221C25.4052 8.37784 24.1728 7.88565 22.7212 7.88565C22.3476 7.88565 21.9811 7.92784 21.6218 8.01221C21.2625 8.09659 20.9103 8.22315 20.5654 8.3919L19.2719 7.12627C19.8181 6.8169 20.3786 6.58487 20.9535 6.43018C21.5284 6.27549 22.1176 6.19815 22.7212 6.19815C24.6471 6.19815 26.2855 6.85205 27.6365 8.15987C28.9875 9.46768 29.663 11.0638 29.663 12.9481V13.0958L31.0427 11.7458L32.25 12.9271L28.8007 16.3021Z' +
    // 왼쪽 아래 → 오른쪽 위 화살표
    'M7.19934 19.6979L10.6487 23.0729L9.4414 24.2542L8.06167 22.9042V23.0518C8.06167 24.4581 8.56829 25.6534 9.58153 26.6378C10.5948 27.6222 11.8272 28.1144 13.2788 28.1144C13.6524 28.1144 14.0189 28.0722 14.3782 27.9878C14.7375 27.9034 15.0897 27.7769 15.4346 27.6081L16.7281 28.8737C16.1819 29.1831 15.6214 29.4151 15.0465 29.5698C14.4717 29.7245 13.8824 29.8019 13.2788 29.8019C11.3529 29.8019 9.71447 29.1479 8.36349 27.8401C7.01251 26.5323 6.33701 24.9362 6.33701 23.0518V22.9042L4.95729 24.2542L3.75003 23.0729L7.19934 19.6979Z' +
    // 오른쪽 아래 이미지 프레임
    'M19.9858 31.5C19.5642 31.5 19.2033 31.3531 18.9031 31.0594C18.6028 30.7656 18.4527 30.4125 18.4527 30V19.5C18.4527 19.0875 18.6028 18.7344 18.9031 18.4406C19.2033 18.1469 19.5642 18 19.9858 18H30.717C31.1386 18 31.4995 18.1469 31.7997 18.4406C32.0999 18.7344 32.25 19.0875 32.25 19.5V30C32.25 30.4125 32.0999 30.7656 31.7997 31.0594C31.4995 31.3531 31.1386 31.5 30.717 31.5H19.9858ZM19.9858 30H30.717V19.5H19.9858V30ZM20.7523 28.5H29.9505L27.076 24.75L24.7765 27.75L23.0518 25.5L20.7523 28.5Z',
} as const;

// ============================================
// Konva 툴팁 컴포넌트 (ActionTooltip 스타일과 정확히 동일)
// ActionTooltip: bg-gray-900, px-2.5(10px), py-1.5(6px), rounded-md(6px), text-xs(12px), font-weight-500
// ============================================
const TOOLTIP_PADDING_X = 10; // px-2.5
const TOOLTIP_PADDING_Y = 6;  // py-1.5
const TOOLTIP_FONT_SIZE = 12; // text-xs
const TOOLTIP_GAP = 8;        // 버튼과 툴팁 사이 간격

const KonvaTooltip = memo(function KonvaTooltip({ text, anchorX }: { text: string; anchorX: number }) {
  // Text 크기 측정 후 Rect와 Group 위치를 직접 설정
  const groupRef = useRef<Konva.Group>(null);
  const textRef = useRef<Konva.Text>(null);

  useEffect(() => {
    const group = groupRef.current;
    const textNode = textRef.current;
    if (!group || !textNode) return;

    // getTextWidth()로 실제 렌더링된 텍스트 너비 측정
    const textWidth = textNode.getTextWidth();
    const textHeight = textNode.height();
    const boxWidth = textWidth + TOOLTIP_PADDING_X * 2;
    const boxHeight = textHeight + TOOLTIP_PADDING_Y * 2;

    // Group offset 설정: 하단 중앙이 기준점 (ActionTooltip direction="top"과 동일)
    group.offsetX(boxWidth / 2);
    group.offsetY(boxHeight);

    // Rect 크기 업데이트
    const rect = group.findOne('Rect') as Konva.Rect;
    if (rect) {
      rect.width(boxWidth);
      rect.height(boxHeight);
    }
  }, [text]);

  return (
    <Group ref={groupRef} x={anchorX} y={-TOOLTIP_GAP} listening={false}>
      <Rect fill="#111827" cornerRadius={6} />
      <Text
        ref={textRef}
        x={TOOLTIP_PADDING_X}
        y={TOOLTIP_PADDING_Y}
        text={text}
        fill="#ffffff"
        fontSize={TOOLTIP_FONT_SIZE}
        fontFamily="Pretendard"
        fontStyle="500"
        lineHeight={1.3}
      />
    </Group>
  );
});

// ============================================
// 아이콘 버튼 컴포넌트
// ============================================
const IconButton = memo(function IconButton({ x, y, iconPath, cornerRadius, tooltip, onClick }: IconButtonProps) {
  const [isHovered, setIsHovered] = useState(false);
  const [isActive, setIsActive] = useState(false);

  const handleMouseEnter = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(true);
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'pointer';
  }, []);

  const handleMouseLeave = useCallback((e: Konva.KonvaEventObject<MouseEvent>) => {
    setIsHovered(false);
    setIsActive(false);
    const stage = e.target.getStage();
    if (stage) stage.container().style.cursor = 'default';
  }, []);

  const handleMouseDown = useCallback(() => setIsActive(true), []);
  const handleMouseUp = useCallback(() => setIsActive(false), []);

  const showHoverEffect = isHovered || isActive;

  return (
    <Group
      x={x}
      y={y}
      onClick={onClick}
      onMouseEnter={handleMouseEnter}
      onMouseLeave={handleMouseLeave}
      onMouseDown={handleMouseDown}
      onMouseUp={handleMouseUp}
    >
      <Rect width={BUTTON_SIZE} height={BUTTON_SIZE} fill="#ffffff" cornerRadius={cornerRadius} />
      {showHoverEffect && (
        <Rect
          x={HOVER_RECT_OFFSET}
          y={HOVER_RECT_OFFSET}
          width={HOVER_RECT_SIZE}
          height={HOVER_RECT_SIZE}
          fill={isActive ? '#E5E7EB' : '#F8F8F9'}
          cornerRadius={8}
          listening={false}
        />
      )}
      <Path x={ICON_OFFSET} y={ICON_OFFSET} data={iconPath} fill="#2B2B2E" listening={false} />
      {/* 툴팁 - ActionTooltip과 동일한 스타일 */}
      {isHovered && <KonvaTooltip text={tooltip} anchorX={BUTTON_HALF} />}
    </Group>
  );
});

// ============================================
// 메인 컴포넌트
// ============================================
export function ImageControlOverlay({ element, elementRef, children, onDragStart, onDragMove }: ImageControlOverlayProps) {
  const [isImageHovered, setIsImageHovered] = useState(false);
  const [isOverlayDragging, setIsOverlayDragging] = useState(false);

  const shimmerRef = useRef<Konva.Rect>(null);
  const spinnerRef = useRef<Konva.Path>(null);

  // ============================================
  // 메모이제이션된 계산값
  // ============================================
  const isImage = useMemo(() => isImageElement(element), [element.name]);

  // 외부 드래그 드롭 타겟 여부 (이미지 교체용)
  const isDropTarget = useIsDropTarget(element.id);

  // Konva Shape(Path 등)의 중앙 좌표 (로컬 좌표계 기준)
  const relativeCenter = useMemo(
    () => ({
      x: (element.width || 0) / 2,
      y: (element.height || 0) / 2,
    }),
    [element.width, element.height],
  );

  const cornerRadius = useMemo(() => {
    if (typeof element.cornerRadius === 'number') return element.cornerRadius;
    if (Array.isArray(element.cornerRadius) && element.cornerRadius.length > 0) {
      return element.cornerRadius[0];
    }
    return 0;
  }, [element.cornerRadius]);

  // ============================================
  // Store & Hooks
  // ============================================
  const setSelectedAsset = useImageGenerationStore((s) => s.setSelectedAsset);
  const setAssetUrl = useCanvasDataStore((s) => s.setAssetUrl);
  const updateElement = useCanvasDataStore((s) => s.updateElement);
  const getAssetUrl = useCanvasDataStore((s) => s.getAssetUrl);
  const setSelectedTool = useToolPanelStore((s) => s.setSelectedTool);
  const setSelectedItems = useSelectionStore((s) => s.setSelectedItems);
  const selectedItems = useSelectedItems();
  const isDragging = useIsDragging();
  const setIsDragging = useSetIsDragging();
  const moveElementToFrame = useElementStore((s) => s.moveElementToFrame);
  const getElement = useElementStore((s) => s.getElement);
  const clearGuides = useSnapStore((s) => s.clearGuides);

  const isAIGeneratingFromStore = useImageGenerationStore(
    (s) => s.imageLoadingStates.get(element.id) ?? false,
  );
  const isAIGenerating = isImage && isAIGeneratingFromStore;

  const {
    inputRef,
    openFilePicker,
    handleFileChange,
    isPending: isUploadingImage,
  } = useAssetUpload({ single: true });

  // ============================================
  // 애니메이션 Effects
  // ============================================
  useEffect(() => {
    if (!isAIGenerating || !shimmerRef.current || !element.width) return;

    const shimmer = shimmerRef.current;
    const width = element.width;
    const duration = 1500;
    let animationId: number;

    const animate = () => {
      const progress = (Date.now() % duration) / duration;
      shimmer.x(-width + progress * width * 2);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isAIGenerating, element.width]);

  useEffect(() => {
    if (!isUploadingImage || !spinnerRef.current) return;

    const spinner = spinnerRef.current;
    let animationId: number;

    const animate = () => {
      spinner.rotation((spinner.rotation() + 6) % 360);
      animationId = requestAnimationFrame(animate);
    };

    animationId = requestAnimationFrame(animate);
    return () => cancelAnimationFrame(animationId);
  }, [isUploadingImage]);

  // ============================================
  // 이벤트 핸들러 (메모이제이션)
  // ============================================
  const thisItem = useMemo(
    () => ({ id: element.id, type: element.type, rootId: element.rootId || '' }),
    [element.id, element.type, element.rootId],
  );

  const updateSelectionWithTool = useCallback(
    (items: typeof selectedItems) => {
      setSelectedItems(items);
      const toolType = getSelectionType(items, getElement);
      if (toolType !== null) setSelectedTool(toolType);
    },
    [setSelectedItems, setSelectedTool, getElement],
  );

  const selectElement = useCallback(
    () => updateSelectionWithTool([thisItem]),
    [updateSelectionWithTool, thisItem],
  );

  const onUploadSuccess = useCallback(
    ([asset]: UploadedAssetInfo[]) => {
      if (!asset) return;
      setAssetUrl(asset.assetId, asset.signedUrl);
      updateElement(element.id, { assetId: asset.assetId });
    },
    [setAssetUrl, updateElement, element.id],
  );

  const handleBackupClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      selectElement();
      setSelectedTool(TOGGLE_STATES.FILE);
    },
    [selectElement, setSelectedTool],
  );

  const handleUploadClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;
      selectElement();
      openFilePicker();
    },
    [selectElement, openFilePicker],
  );

  const handleOverlayClick = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      e.cancelBubble = true;

      const metaPressed = e.evt.shiftKey || e.evt.ctrlKey || e.evt.metaKey;
      if (metaPressed) {
        const isSelected = selectedItems.some((item) => item.id === element.id);
        const newItems = isSelected
          ? selectedItems.filter((item) => item.id !== element.id)
          : [...selectedItems, thisItem];
        updateSelectionWithTool(newItems);
        return;
      }

      selectElement();
      setSelectedTool(TOGGLE_STATES.IMAGE);

      const imageUrl = element.assetId ? getAssetUrl(element.assetId) : null;
      if (imageUrl) {
        setSelectedAsset({ id: element.assetId!, thumbnailUrl: imageUrl });
      }
    },
    [element.id, element.assetId, selectedItems, thisItem, selectElement, setSelectedTool, getAssetUrl, setSelectedAsset, updateSelectionWithTool],
  );

  const handleOverlayDragStart = useCallback(
    (e: Konva.KonvaEventObject<MouseEvent>) => {
      setIsOverlayDragging(true);
      setIsDragging(true);
      // 드래그 시작 전 요소 선택 보장 (Transformer.nodes() 등록 필요)
      selectElement();
      onDragStart?.(e);
    },
    [onDragStart, setIsDragging, selectElement],
  );

  const handleOverlayDragMove = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const overlayGroup = e.target;
      const node = elementRef?.current;
      if (!node) return;

      // 실제 요소(Rect/Path)도 오버레이와 함께 이동시켜 Transformer 동기화
      node.x(overlayGroup.x());
      node.y(overlayGroup.y());

      // 스냅 로직 실행 (useKonvaDrag.handleDragMove)
      // 스냅이 적용되면 node 위치가 조정됨
      onDragMove?.(e as Konva.KonvaEventObject<MouseEvent>);

      // 스냅 적용 후 오버레이 Group도 동기화
      overlayGroup.x(node.x());
      overlayGroup.y(node.y());
    },
    [elementRef, onDragMove],
  );

  const handleOverlayDragEnd = useCallback(
    (e: Konva.KonvaEventObject<DragEvent>) => {
      const group = e.target;
      const newX = group.x();
      const newY = group.y();

      setIsOverlayDragging(false);
      setIsDragging(false);
      clearGuides();

      const nativeEvent = e.evt;
      if (!nativeEvent) {
        updateElement(element.id, { x: newX, y: newY });
        selectElement();
        return;
      }

      const dropTarget = findDropTarget(nativeEvent.clientX, nativeEvent.clientY);
      const currentFrameId = element.rootId;

      if (dropTarget && currentFrameId && dropTarget.frameId !== currentFrameId) {
        const finalX = dropTarget.localX - (element.width || 0) / 2;
        const finalY = dropTarget.localY - (element.height || 0) / 2;

        moveElementToFrame(element.id, dropTarget.frameId, { x: finalX, y: finalY });

        const items = [{ id: element.id, type: element.type, rootId: dropTarget.frameId }];
        setSelectedItems(items);
        const toolType = getSelectionType(items, getElement);
        if (toolType !== null) setSelectedTool(toolType);
        return;
      }

      updateElement(element.id, { x: newX, y: newY });
      selectElement();
    },
    [element.id, element.type, element.rootId, element.width, element.height, setIsDragging, updateElement, selectElement, moveElementToFrame, setSelectedItems, setSelectedTool, getElement, clearGuides],
  );

  const handleMouseEnter = useCallback(() => setIsImageHovered(true), []);
  const handleMouseLeave = useCallback(() => setIsImageHovered(false), []);

  // ============================================
  // 렌더링 조건
  // ============================================
  const canShowOverlay =
    isImage &&
    (isImageHovered || isOverlayDragging) &&
    !isAIGenerating &&
    (!isDragging || isOverlayDragging) &&
    element.width !== undefined &&
    element.height !== undefined;

  const isInsideContainer = Boolean(
    elementRef?.current?.findAncestor('.data-group') ||
    elementRef?.current?.findAncestor('.data-frame')
  );
  const hasAssetId = Boolean(element.assetId);

  // 클리핑 함수 메모이제이션
  const clipFunc = useMemo(() => {
    if (!element.width || !element.height) return undefined;
    return (ctx: Konva.Context) => {
      ctx.beginPath();
      ctx.roundRect(0, 0, element.width!, element.height!, cornerRadius);
      ctx.closePath();
    };
  }, [element.width, element.height, cornerRadius]);

  // ============================================
  // 렌더링
  // ============================================
  return (
    <>
      {isImage && (
        <Html>
          <input
            ref={inputRef}
            type="file"
            accept="image/*"
            style={{ display: 'none' }}
            onChange={(e) => handleFileChange(e, { onSuccess: onUploadSuccess })}
          />
        </Html>
      )}

      <Group
        onMouseEnter={isImage ? handleMouseEnter : undefined}
        onMouseLeave={isImage ? handleMouseLeave : undefined}
      >
        {children}

        {/* AI 생성 로딩 오버레이 (shimmer) */}
        {isAIGenerating && element.width && element.height && (
          <Group
            x={element.x}
            y={element.y}
            rotation={element.rotation}
            offsetX={element.offsetX}
            offsetY={element.offsetY}
            clipFunc={clipFunc}
            listening={false}
          >
            <Rect width={element.width} height={element.height} fill="#E5E7EB" />
            <Rect
              ref={shimmerRef}
              x={-element.width}
              width={element.width}
              height={element.height}
              fillLinearGradientStartPoint={{ x: 0, y: 0 }}
              fillLinearGradientEndPoint={{ x: element.width, y: 0 }}
              fillLinearGradientColorStops={[
                0, 'rgba(255, 255, 255, 0)',
                0.2, 'rgba(255, 255, 255, 0.2)',
                0.5, 'rgba(255, 255, 255, 0.5)',
                0.8, 'rgba(255, 255, 255, 0.2)',
                1, 'rgba(255, 255, 255, 0)',
              ]}
            />
          </Group>
        )}

        {/* 이미지 업로드 로딩 오버레이 (spinner) */}
        {isUploadingImage && element.width && element.height && (
          <Group
            x={element.x}
            y={element.y}
            rotation={element.rotation}
            offsetX={element.offsetX}
            offsetY={element.offsetY}
            clipFunc={clipFunc}
            listening={false}
          >
            <Rect width={element.width} height={element.height} fill="rgba(0, 0, 0, 0.5)" />
            <Path
              ref={spinnerRef}
              data={ICON_PATHS.spinner}
              fill="#FFFFFF"
              scaleX={32 / 29}
              scaleY={32 / 29}
              offsetX={14.1421}
              offsetY={14.1421}
              x={element.width / 2}
              y={element.height / 2}
            />
          </Group>
        )}

        {/* 외부 드래그 드롭 타겟 오버레이 (이미지 교체용) */}
        {isImage && isDropTarget && element.width && element.height && (
          <Group
            x={element.x}
            y={element.y}
            rotation={element.rotation}
            offsetX={element.offsetX}
            offsetY={element.offsetY}
            listening={false}
          >
            <Rect
              width={element.width}
              height={element.height}
              fill="rgba(0, 0, 0, 0.6)"
              cornerRadius={cornerRadius}
            />
            {/* 교체 아이콘 - 중앙 배치, 역회전으로 항상 수평 유지 */}
            {/* 36x36 viewBox, 콘텐츠 28.5x27px (중심 18,18), 1.4배로 시각적 강조 */}
            <Group
              x={relativeCenter.x}
              y={relativeCenter.y}
              rotation={-(element.rotation || 0)}
              scaleX={1.4}
              scaleY={1.4}
            >
              <Path
                data={ICON_PATHS.replace}
                fill="#FFFFFF"
                x={-18}
                y={-18}
              />
            </Group>
          </Group>
        )}

        {/* hover 오버레이 */}
        {canShowOverlay && !isDropTarget && (
          <Group
            x={element.x}
            y={element.y}
            rotation={element.rotation}
            offsetX={element.offsetX}
            offsetY={element.offsetY}
            draggable={!isInsideContainer}
            onDragStart={isInsideContainer ? undefined : handleOverlayDragStart}
            onDragMove={isInsideContainer ? undefined : handleOverlayDragMove}
            onDragEnd={isInsideContainer ? undefined : handleOverlayDragEnd}
          >
            <Rect
              name="_hover-overlay"
              width={element.width!}
              height={element.height!}
              fill="rgba(0, 0, 0, 0.6)"
              onClick={handleOverlayClick}
            />

            {/* 버튼 그룹 - Konva 네이티브 요소, 역회전으로 항상 수평 유지 */}
            <Group
              x={relativeCenter.x}
              y={relativeCenter.y}
              rotation={-(element.rotation || 0)}
            >
              {hasAssetId && (
                <IconButton
                  x={-BUTTON_SIZE}
                  y={-BUTTON_HALF}
                  iconPath={ICON_PATHS.backup}
                  cornerRadius={[4, 0, 0, 4]}
                  tooltip="업로드에서 이미지 선택"
                  onClick={handleBackupClick}
                />
              )}
              <IconButton
                x={hasAssetId ? 0 : -BUTTON_HALF}
                y={-BUTTON_HALF}
                iconPath={ICON_PATHS.upload}
                cornerRadius={hasAssetId ? [0, 4, 4, 0] : 4}
                tooltip="내 컴퓨터에서 이미지 선택"
                onClick={handleUploadClick}
              />
            </Group>
          </Group>
        )}
      </Group>
    </>
  );
}
