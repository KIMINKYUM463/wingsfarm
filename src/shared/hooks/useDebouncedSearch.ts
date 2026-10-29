import { useState } from 'react';
import { useDebounce } from './useDebounce';

/**
 * 디바운스된 검색 상태 관리 훅
 *
 * @param delay - 디바운스 지연 시간 (ms), 기본값: 300
 * @returns query, setQuery, searchParam
 *
 * @example
 * const { query, setQuery, searchParam } = useDebouncedSearch();
 * useAssets({ search: searchParam });
 * <IconInputField value={query} onChange={(e) => setQuery(e.target.value)} />
 */
export const useDebouncedSearch = (delay = 300) => {
  const [query, setQuery] = useState('');
  const debouncedQuery = useDebounce(query, delay);

  return {
    /** 현재 입력값 (UI 바인딩용) */
    query,
    /** 입력값 변경 함수 */
    setQuery,
    /** API 요청용 검색 파라미터 (빈 문자열은 undefined로 변환) */
    searchParam: debouncedQuery || undefined,
  };
};
