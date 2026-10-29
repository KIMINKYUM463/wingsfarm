import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

/**
 * 레버페이지에서 그대로 가져온 코드 (상세페이지 제작)
 * 원본 저장소는 `next/core-web-vitals` 만 썼으므로, 원본 코드를 고치지 않고 유지하기 위해
 * 이후 추가된 React Compiler 규칙과 TypeScript 엄격 규칙은 이 범위에서만 경고로 낮춘다.
 */
const LEVERPAGE_ORIGINAL = [
  "src/features/**",
  "src/shared/**",
  "src/utils/**",
  "src/validation/**",
  "src/server/figma-to-konva/**",
];

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  {
    rules: {
      // `_` 로 시작하는 이름은 "일부러 안 쓰는 값" 표시
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { argsIgnorePattern: "^_", varsIgnorePattern: "^_", ignoreRestSiblings: true },
      ],
    },
  },
  {
    files: LEVERPAGE_ORIGINAL,
    rules: {
      "react-hooks/refs": "warn",
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/preserve-manual-memoization": "warn",
      "react-hooks/immutability": "warn",
      "react-hooks/purity": "warn",
      "@typescript-eslint/no-explicit-any": "warn",
      "@typescript-eslint/no-empty-object-type": "warn",
      "prefer-const": "warn",
    },
  },
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
  ]),
]);

export default eslintConfig;
