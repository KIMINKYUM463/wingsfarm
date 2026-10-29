import httpClient from '@/shared/lib/httpClient';
import { ENDPOINTS } from '@/shared/constants/endpoints';
import { CustomError } from '@/shared/lib/CustomError';
import type {
  GetAssetsParams,
  GetAssetsData,
  AssetsApiResponse,
  BulkDeleteAssetsRequest,
  BulkDeleteAssetsResponse,
} from './types';

/**
 * 자산 목록 조회
 *
 * @param params - 조회 파라미터 (status, limit, cursor)
 * @returns 자산 목록 및 페이지네이션 정보
 *
 * @example
 * // 기본 조회
 * const { assets, nextCursor } = await getAssets();
 *
 * // 상태 필터링
 * const { assets } = await getAssets({ status: 'ready' });
 *
 * // 페이지네이션
 * const { assets, nextCursor } = await getAssets({ cursor: prevCursor, limit: 20 });
 */
export const getAssets = async (params: GetAssetsParams = {}): Promise<GetAssetsData> => {
  const response = await httpClient.get<AssetsApiResponse>(ENDPOINTS.ASSETS.LIST, {
    withAuth: true,
    queryParams: {
      ...(params.status && { status: params.status }),
      ...(params.limit && { limit: params.limit }),
      ...(params.cursor && { cursor: params.cursor }),
      ...(params.search && { search: params.search }),
    },
  });

  return response.data;
};

/**
 * 자산 벌크 삭제 (soft delete - archived 상태로 변경)
 *
 * @param assetIds - 삭제할 자산 ID 배열 (최대 100개)
 * @returns 삭제된 자산 개수
 *
 * @example
 * const deletedCount = await bulkDeleteAssets(['asset-uuid-1', 'asset-uuid-2']);
 * console.log(`${deletedCount}개 삭제됨`);
 */
export const bulkDeleteAssets = async (assetIds: string[]): Promise<number> => {
  if (assetIds.length === 0) {
    throw new CustomError(400, '삭제할 자산을 선택해주세요');
  }

  if (assetIds.length > 100) {
    throw new CustomError(400, '최대 100개까지 한 번에 삭제할 수 있습니다');
  }

  const requestBody: BulkDeleteAssetsRequest = { assetIds };

  const response = await httpClient.post<BulkDeleteAssetsResponse>(
    ENDPOINTS.ASSETS.BULK_DELETE,
    requestBody,
    {
      withAuth: true,
    },
  );

  return response.data.deletedCount;
};
