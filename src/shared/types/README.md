# Types Directory

프로젝트 전역에서 사용되는 타입 정의들을 관리하는 디렉토리입니다.

## 📁 구조

```
types/
├── index.ts                 # 모든 타입 통합 export
├── auth.types.ts           # 인증 관련 타입
├── user.types.ts           # 사용자 관련 타입
├── detail-page.types.ts    # 상세 페이지 관련 타입
├── api.types.ts            # API 공통 타입
└── ui.ts                   # UI 관련 타입 (기존)
```

## 🎯 사용법

### 방법 1: 개별 import (권장 ✅)

```typescript
import type { User, UserProfile } from '@/types';
import type { OAuthProvider, UserSession } from '@/types';
import type { DetailPage, DetailPageStatus } from '@/types';
```

### 방법 2: 네임스페이스 import

```typescript
import * as Types from '@/types';

const user: Types.User = { ... };
const provider: Types.OAuthProvider = 'google';
```

### 방법 3: 특정 파일에서 직접 import

```typescript
import type { User } from '@/types/user.types';
import type { OAuthProvider } from '@/types/auth.types';
```

## 📋 타입 카테고리

### Auth Types (`auth.types.ts`)

**인증 및 OAuth 관련 타입**
- `OAuthProvider` - OAuth 제공자 ('google' | 'github' | ...)
- `OAuthSignInOptions` - OAuth 로그인 옵션
- `UserSession` - 사용자 세션 정보
- `SignOutOptions` - 로그아웃 옵션
- `AuthError` - 인증 에러

**사용 예시:**
```typescript
import type { OAuthProvider, UserSession } from '@/types';

const provider: OAuthProvider = 'google';
const session: UserSession = {
  userId: '123',
  email: 'user@example.com'
};
```

### User Types (`user.types.ts`)

**사용자 정보 및 프로필 관련 타입**
- `User` - 사용자 기본 정보
- `UserProfile` - 사용자 프로필 (확장)
- `UserAddress` - 사용자 주소
- `UpdateUserProfileRequest` - 프로필 업데이트 요청
- `UserSettings` - 사용자 설정

**사용 예시:**
```typescript
import type { User, UserProfile, UpdateUserProfileRequest } from '@/types';

const user: User = {
  id: '123',
  email: 'user@example.com',
  createdAt: '2024-01-01'
};

const updateData: UpdateUserProfileRequest = {
  name: '홍길동',
  bio: '안녕하세요'
};
```

### Detail Page Types (`detail-page.types.ts`)

**상세 페이지 관련 타입**
- `DetailPage` - 상세 페이지 정보
- `DetailPageStatus` - 페이지 상태
- `CreateDetailPageRequest` - 페이지 생성 요청
- `UpdateDetailPageRequest` - 페이지 업데이트 요청
- `GetDetailPagesOptions` - 목록 조회 옵션
- `GetDetailPagesResponse` - 목록 조회 응답

**사용 예시:**
```typescript
import type {
  DetailPage,
  DetailPageStatus,
  CreateDetailPageRequest
} from '@/types';

const page: DetailPage = {
  id: '1',
  title: '상품 상세',
  status: 'published',
  ownerId: '123',
  createdAt: '2024-01-01'
};

const createData: CreateDetailPageRequest = {
  title: '새 상세 페이지',
  description: '설명'
};
```

### API Types (`api.types.ts`)

**API 공통 타입**
- `ApiResponse<T>` - API 응답 구조
- `ApiError` - API 에러 응답
- `PaginationParams` - 페이지네이션 파라미터
- `PaginationMeta` - 페이지네이션 메타데이터
- `PaginatedResponse<T>` - 페이지네이션 응답
- `HttpMethod` - HTTP 메서드
- `ApiRequestOptions` - API 요청 옵션
- `FilterOptions` - 필터 옵션

**사용 예시:**
```typescript
import type {
  ApiResponse,
  PaginatedResponse,
  PaginationParams
} from '@/types';

// API 응답
const response: ApiResponse<User> = {
  data: { id: '1', email: 'user@example.com', createdAt: '2024-01-01' },
  success: true
};

// 페이지네이션
const params: PaginationParams = {
  page: 1,
  pageSize: 20,
  sortBy: 'createdAt',
  sortOrder: 'desc'
};

const paginatedData: PaginatedResponse<User> = {
  items: [/* users */],
  meta: {
    currentPage: 1,
    pageSize: 20,
    totalItems: 100,
    totalPages: 5,
    hasNext: true,
    hasPrevious: false
  }
};
```

## ✅ 타입 정의 규칙

### 1. 명확한 네이밍
```typescript
// ✅ Good
export interface UpdateUserProfileRequest { ... }
export type DetailPageStatus = 'draft' | 'published';

// ❌ Bad
export interface UpdateProfile { ... }
export type Status = 'draft' | 'published';
```

### 2. JSDoc 주석 추가
```typescript
/**
 * 사용자 프로필 정보
 *
 * @property {string} id - 사용자 ID
 * @property {string} email - 이메일 주소
 */
export interface UserProfile {
  id: string;
  email: string;
}
```

### 3. Optional vs Required 명확히
```typescript
export interface User {
  id: string;           // Required
  email: string;        // Required
  name?: string;        // Optional
  avatarUrl?: string;   // Optional
}
```

### 4. Union Type 활용
```typescript
export type OAuthProvider = 'google' | 'github' | 'facebook';
export type Theme = 'light' | 'dark' | 'system';
```

### 5. Generic 타입 활용
```typescript
export interface ApiResponse<T> {
  data: T;
  success: boolean;
}

// 사용
const response: ApiResponse<User> = { ... };
```

## 🔄 타입 업데이트 가이드

### 새로운 타입 추가

1. 적절한 파일에 타입 정의 추가
2. JSDoc 주석 작성
3. `index.ts`에 export 추가 (자동으로 됨)

### 기존 타입 수정

1. Breaking Change가 있다면 팀에 알리기
2. 사용하는 곳 모두 확인 후 수정
3. 필요시 마이그레이션 가이드 작성

## 📚 참고

- TypeScript 공식 문서: https://www.typescriptlang.org/docs/
- Utility Types: https://www.typescriptlang.org/docs/handbook/utility-types.html
