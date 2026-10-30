import { createShapeDefinitions, groupInOrder } from './utils';
import type { ShapeCategory } from './types';

/** scripts/build-element-assets.mjs가 만든 아이콘 한 개 (Phosphor Icons, MIT) */
interface IconAsset {
  id: string;
  name: string;
  group: string;
  keywords: string;
  data: string;
}

const ICON_FILL = '#2B2B2E';

let iconCategories: Promise<ShapeCategory[]> | null = null;

/** 아이콘 데이터(~100KB)는 요소 패널을 처음 열 때 한 번만 따로 받는다 */
export const loadIconCategories = () =>
  (iconCategories ??= import('./icons.generated.json').then(({ default: icons }) =>
    groupInOrder(icons as IconAsset[], (icon) => icon.group).map(({ key, items }, index) => ({
      id: `icons-${index}`,
      title: `아이콘 · ${key}`,
      items: createShapeDefinitions(
        items.map(({ id, name, keywords, data }) => ({
          id,
          name,
          keywords: `${keywords} 아이콘`,
          category: 'shape' as const,
          defaultProps: { type: 'path', name, data, fill: ICON_FILL },
        })),
      ),
    })),
  ).catch((error: unknown) => {
    iconCategories = null;
    throw error;
  }));
