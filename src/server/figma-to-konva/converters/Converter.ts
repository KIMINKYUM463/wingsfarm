import type * as Types from '../types';
import { StyleMapper } from '../mappers/StyleMapper';
import { AbsolutePosition } from '../utils/coordinate-utils';
import { ShapeConverter } from './interfaces/ShapeConverter';
import { ContainerConverter } from './interfaces/ContainerConverter';

// 개별 변환기들
import { TextConverter } from './shapes/TextConverter';
import { RectangleConverter } from './shapes/RectangleConverter';
import { EllipseConverter } from './shapes/EllipseConverter';
import { VectorConverter } from './shapes/VectorConverter';
import { ImageConverter } from './shapes/ImageConverter';
import { CanvasConverter } from './containers/CanvasConverter';
import { FrameConverter } from './containers/FrameConverter';
import { GroupConverter } from './containers/GroupConverter';

import { findImageRef } from './shapes/ImageConverter';
// 타입 가드 함수들
import { isCanvasNode } from './utils/type-guards';

/** 이미지 채우기가 들어갈 수 있는 도형 노드 */
const SHAPE_TYPES = new Set(['RECTANGLE', 'ELLIPSE', 'VECTOR', 'REGULAR_POLYGON', 'STAR']);

/** 변환을 지원하는 노드 (통계·실패 수집 기준) */
const SUPPORTED_TYPES = [
  'TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'LINE', 'STAR', 'REGULAR_POLYGON', 'BOOLEAN_OPERATION',
  'FRAME', 'GROUP', 'COMPONENT', 'COMPONENT_SET', 'INSTANCE', 'SECTION', 'CANVAS', 'DOCUMENT',
];

export class Converter {
  private styleMapper: StyleMapper;

  // Shape 변환기들
  private textConverter: ShapeConverter;
  private rectangleConverter: ShapeConverter;
  private ellipseConverter: ShapeConverter;
  private vectorConverter: ShapeConverter;
  private imageConverter: ShapeConverter;

  // Container 변환기들
  private canvasConverter: CanvasConverter;
  private frameConverter: ContainerConverter;
  private groupConverter: ContainerConverter;

  constructor() {
    this.styleMapper = new StyleMapper();

    // 변환기들 초기화
    this.textConverter = new TextConverter(this.styleMapper);
    this.rectangleConverter = new RectangleConverter(this.styleMapper);
    this.ellipseConverter = new EllipseConverter(this.styleMapper);
    this.vectorConverter = new VectorConverter(this.styleMapper);
    this.imageConverter = new ImageConverter(this.styleMapper);
    this.canvasConverter = new CanvasConverter(this.styleMapper);
    this.frameConverter = new FrameConverter(this.styleMapper);
    this.groupConverter = new GroupConverter(this.styleMapper);
  }

  /**
   * Figma 파일을 Konva 템플릿으로 변환
   */
  convert(figmaData: any): Types.ConversionResult {
    const startTime = performance.now();

    try {
      if (!figmaData.document) {
        return {
          success: false,
          error: 'Document not found in Figma data',
          data: null,
          originalData: figmaData,
          stats: {
            totalNodes: 0,
            convertedNodes: 0,
            skippedNodes: 0,
            processingTime: 0,
          },
          errors: [],
          warnings: [],
          failedNodes: [],
        };
      }

      const layers = this.convertDocument(figmaData.document);
      const endTime = performance.now();
      const processingTime = endTime - startTime;

      // 통계 계산
      const stats = this.calculateStats(figmaData.document);

      // 실패한 노드 정보 수집
      const failedNodes = this.collectFailedNodes(figmaData.document);

      const konvaStage: Types.KonvaStage = {
        name: figmaData.name || 'Untitled Design',
        layers,
        totalElements: stats.convertedNodes,
        layerCount: layers.length,
        version: '1.0.0',
        createdAt: new Date().toISOString(),
        updatedAt: new Date().toISOString(),
      };

      return {
        success: true,
        data: konvaStage,
        originalData: figmaData,
        errors: [],
        warnings: [],
        stats: {
          ...stats,
          processingTime,
        },
        failedNodes,
      };
    } catch (error) {
      const endTime = performance.now();
      return {
        success: false,
        error: error instanceof Error ? error.message : 'Unknown error',
        data: null,
        originalData: figmaData,
        stats: {
          totalNodes: 0,
          convertedNodes: 0,
          skippedNodes: 0,
          processingTime: endTime - startTime,
        },
        errors: [],
        warnings: [],
        failedNodes: [],
      };
    }
  }

  /** 최상위 Frame 노드 하나를 변환 (템플릿 동기화용, 좌표는 (0, 0) 기준) */
  convertTopLevelFrame(frame: any): Types.KonvaFrameElement {
    return this.convertFrame(frame) as Types.KonvaFrameElement;
  }

  /**
   * Document 노드를 Konva 레이어 배열로 변환
   */
  private convertDocument(document: Types.DocumentNode): Types.KonvaLayer[] {
    if (!document.children) {
      return [];
    }

    return document.children.filter(isCanvasNode).map((canvas) => this.convertCanvas(canvas));
  }

  /**
   * Canvas 노드를 Konva 레이어로 변환
   */
  private convertCanvas(canvas: any): Types.KonvaLayer {
    const elements = this.convertChildren(canvas.children || []);
    return this.canvasConverter.convert(canvas, elements);
  }

  /**
   * Frame 노드를 Konva 프레임으로 변환
   */
  private convertFrame(frame: any, parentAbsolutePosition?: AbsolutePosition): Types.KonvaElement {
    const children = this.convertChildren(frame.children || [], frame.absoluteBoundingBox);
    // 프레임 배경이 이미지면 맨 뒤에 같은 크기의 이미지 rect를 깐다
    if (findImageRef(frame)) {
      const background = this.imageConverter.convert(
        { ...frame, id: `${frame.id}-bg`, name: `${frame.name} 배경` },
        frame.absoluteBoundingBox,
      );
      children.unshift(background);
    }
    return this.frameConverter.convert(frame, children, parentAbsolutePosition);
  }

  /**
   * Group 노드를 Konva 그룹으로 변환
   */
  private convertGroup(group: any, parentAbsolutePosition?: AbsolutePosition): Types.KonvaElement {
    const children = this.convertChildren(group.children || [], group.absoluteBoundingBox);
    return this.groupConverter.convert(group, children, parentAbsolutePosition);
  }

  /**
   * 자식 노드들을 Konva 요소로 변환
   */
  private convertChildren(
    children: any[],
    parentAbsolutePosition?: AbsolutePosition,
  ): Types.KonvaElement[] {
    return children
      .map((child) => this.convertNode(child, parentAbsolutePosition))
      .filter((element): element is Types.KonvaElement => element !== null);
  }

  /**
   * 개별 노드를 적절한 변환기로 라우팅
   */
  private convertNode(
    node: any,
    parentAbsolutePosition?: AbsolutePosition,
  ): Types.KonvaElement | null {
    // 이미지 채우기를 가진 도형은 이미지 rect로 (상품 사진 자리 `_image`, 장식 이미지 모두)
    if (SHAPE_TYPES.has(node.type) && findImageRef(node)) {
      return this.imageConverter.convert(node, parentAbsolutePosition);
    }

    switch (node.type) {
      case 'FRAME':
      case 'COMPONENT':
      case 'COMPONENT_SET':
      case 'INSTANCE':
        return this.convertFrame(node, parentAbsolutePosition);
      case 'GROUP':
        return this.convertGroup(node, parentAbsolutePosition);
      case 'TEXT':
        return this.textConverter.convert(node, parentAbsolutePosition);
      case 'RECTANGLE':
        return this.rectangleConverter.convert(node, parentAbsolutePosition);
      case 'ELLIPSE':
      case 'VECTOR':
      case 'LINE':
      case 'STAR':
      case 'REGULAR_POLYGON':
      case 'BOOLEAN_OPERATION':
        return this.vectorConverter.convert(node, parentAbsolutePosition);
      default:
        console.warn(`지원하지 않는 노드 타입: ${node.type}`);
        return null;
    }
  }

  private calculateStats(document: any): {
    totalNodes: number;
    convertedNodes: number;
    skippedNodes: number;
  } {
    let totalNodes = 0;
    let convertedNodes = 0;
    let skippedNodes = 0;

    const traverse = (node: any) => {
      totalNodes++;

      // 실제 Konva 요소로 변환되는 노드들만 카운트
      if (['TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE', 'LINE'].includes(node.type)) {
        convertedNodes++;
      } else if (['FRAME', 'GROUP', 'CANVAS', 'DOCUMENT'].includes(node.type)) {
        // 구조적 노드는 변환되지만 실제 그래픽 요소가 아님
        // 이들은 컨테이너 역할을 하므로 별도로 카운트하지 않음
      } else {
        // 지원하지 않는 노드 타입은 스킵으로 카운트
        skippedNodes++;
      }

      if (node.children) {
        node.children.forEach(traverse);
      }
    };

    traverse(document);
    return { totalNodes, convertedNodes, skippedNodes };
  }

  private collectFailedNodes(document: any): Types.FailedNode[] {
    const failedNodes: Types.FailedNode[] = [];

    const traverse = (node: any, path: string = '') => {
      const currentPath = path ? `${path} > ${node.name}` : node.name;

      // 지원하지 않는 노드 타입 수집
      if (!SUPPORTED_TYPES.includes(node.type)) {
        failedNodes.push({
          id: node.id,
          name: node.name,
          type: node.type,
          path: currentPath,
          reason: `지원하지 않는 노드 타입: ${node.type}`,
          properties: this.extractNodeProperties(node),
        });
      }

      // 필수 속성이 없는 노드 수집
      if (['TEXT', 'RECTANGLE', 'ELLIPSE', 'VECTOR', 'IMAGE', 'LINE'].includes(node.type)) {
        if (!node.absoluteBoundingBox) {
          failedNodes.push({
            id: node.id,
            name: node.name,
            type: node.type,
            path: currentPath,
            reason: 'absoluteBoundingBox 속성이 없음',
            properties: this.extractNodeProperties(node),
          });
        }
      }

      if (node.children) {
        node.children.forEach((child: any) => traverse(child, currentPath));
      }
    };

    traverse(document);
    return failedNodes;
  }

  private extractNodeProperties(node: any): any {
    const properties: any = {};

    // 주요 속성들 추출
    if (node.absoluteBoundingBox) {
      properties.absoluteBoundingBox = node.absoluteBoundingBox;
    }
    if (node.fills) {
      properties.fills = node.fills;
    }
    if (node.strokes) {
      properties.strokes = node.strokes;
    }
    if (node.characters) {
      properties.characters = node.characters;
    }
    if (node.style) {
      properties.style = node.style;
    }
    if (node.vectorPaths) {
      properties.vectorPaths = node.vectorPaths;
    }
    if (node.imageRef) {
      properties.imageRef = node.imageRef;
    }
    if (node.visible !== undefined) {
      properties.visible = node.visible;
    }
    if (node.opacity !== undefined) {
      properties.opacity = node.opacity;
    }
    if (node.cornerRadius !== undefined) {
      properties.cornerRadius = node.cornerRadius;
    }

    return properties;
  }
}
