import { OPENAI_IMAGE_MODEL, OPENAI_MODEL } from "@/lib/server/openai";

export type HealthResponse = {
  openai: boolean;
  naverDatalab: boolean;
  naverAd: boolean;
  kamis: boolean;
  farmMap: boolean;
  passwordLock: boolean;
  textModel: string;
  imageModel: string;
};

/** 키 값은 절대 내보내지 않고, 설정 여부만 알려준다 */
export function GET() {
  const has = (...keys: string[]) => keys.every((k) => Boolean(process.env[k]?.trim()));
  const body: HealthResponse = {
    openai: has("OPENAI_API_KEY"),
    naverDatalab: has("NAVER_CLIENT_ID", "NAVER_CLIENT_SECRET"),
    naverAd: has("NAVER_AD_API_KEY", "NAVER_AD_SECRET_KEY", "NAVER_AD_CUSTOMER_ID"),
    kamis: has("KAMIS_CERT_KEY", "KAMIS_CERT_ID"),
    farmMap: has("DATA_GO_KR_KEY"),
    passwordLock: has("APP_PASSWORD"),
    textModel: OPENAI_MODEL,
    imageModel: OPENAI_IMAGE_MODEL,
  };
  return Response.json(body);
}
