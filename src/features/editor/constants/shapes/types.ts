import { KonvaElement } from '@/shared/types/konva';

/**
 * Shape 정의 입력 타입 (preview 자동 생성용)
 */
export interface ShapeDefinitionInput {
  /** 고유 ID */
  id: string;
  /** 표시 이름 */
  name: string;
  /** 카테고리 (도형 또는 선) */
  category: 'shape' | 'line';
  /** Konva 요소 생성 시 기본 속성 */
  defaultProps: Partial<KonvaElement> & { type: string };
}

/**
 * Shape 정의 타입
 * ShapeTool에서 사용하는 도형/선 아이템 정의
 */
export interface ShapeDefinition extends ShapeDefinitionInput {
  /** 프리뷰 컴포넌트 (ShapePreview로 자동 생성) */
  preview: React.ReactNode;
}

/**
 * Shape 카테고리 타입
 */
export interface ShapeCategory {
  id: string;
  title: string;
  items: ShapeDefinition[];
}
