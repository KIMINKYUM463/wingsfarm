import { z } from 'zod';

/**
 * 상품 정보 폼 Validation 스키마
 *
 * POST /projects/{projectId}/generate API 명세 기반 (Swagger 스키마 준수)
 * - productName, categoryId는 초안 프로젝트에서 자동으로 가져옴
 */

// 키워드 그룹 스키마
const keywordGroupSchema = z.object({
  name: z.string(),
  keywords: z.array(z.string()),
});

// AI 키워드 선택 방식 데이터
const keywordSelectionSchema = z
  .object({
    keywordData: z
      .object({
        groups: z.array(keywordGroupSchema).min(1, 'AI 키워드를 최소 1개 이상 선택해주세요'),
      })
      .optional(),
    customFeatures: z.string().max(1000, '특징은 1000자 이내로 입력해주세요').optional(),
  })
  .refine(
    (data) => {
      // keywordData.groups에 키워드가 있거나, customFeatures가 비어있지 않으면 통과
      const hasKeywords =
        data.keywordData?.groups?.some((group) => group.keywords.length > 0) ?? false;
      const hasCustomFeatures = data.customFeatures && data.customFeatures.trim().length > 0;
      return hasKeywords || hasCustomFeatures;
    },
    {
      message: '키워드를 선택하거나 상품의 특별한 특징을 입력해주세요',
      // Note: refine은 현재 스키마 레벨에서 동작하므로 path는 현재 객체 내 경로
      // React Hook Form에서 generationData.keywordSelection으로 trigger하면 올바르게 연결됨
      path: ['keywordData'],
    },
  );

// 이미지 업로드 방식 데이터
const imageUploadSchema = z.object({
  detailPageUrls: z.array(z.string()).min(1, '참고 이미지를 최소 1개 이상 업로드해주세요'),
});

// 공통 필드 (Base Schema)
const baseRequestSchema = z.object({
  companyName: z
    .string()
    .min(1, '업체명을 입력해주세요')
    .max(100, '회사명은 100자 이내로 입력해주세요'),
  // default()를 쓰면 input 타입이 optional이 되어 RHF UseFormReturn과 어긋난다
  productImageUrls: z.array(z.string()).max(10, '상품 이미지는 최대 10개까지 업로드 가능합니다'),
});

// keyword_selection 방식 스키마
const keywordSelectionRequestSchema = baseRequestSchema.extend({
  generationMethod: z.literal('keyword_selection'),
  generationData: z.object({
    keywordSelection: keywordSelectionSchema,
  }),
});

// image_upload 방식 스키마
const imageUploadRequestSchema = baseRequestSchema.extend({
  generationMethod: z.literal('image_upload'),
  generationData: z.object({
    imageUpload: imageUploadSchema,
  }),
});

// 메인 폼 스키마 (discriminated union)
export const productInfoFormSchema = z.discriminatedUnion('generationMethod', [
  keywordSelectionRequestSchema,
  imageUploadRequestSchema,
]);

// 타입 export
export type ProductInfoFormData = z.infer<typeof productInfoFormSchema>;

// 키워드 그룹 타입 (재사용용)
export type KeywordGroup = z.infer<typeof keywordGroupSchema>;
