import { z } from 'zod';

const emailSchema = z.string().email('올바른 이메일 형식이 아닙니다');

const passwordSchema = z.string().min(6, '비밀번호는 6자 이상이어야 합니다');

const passwordCheckSchema = z.string().min(1, '비밀번호 확인을 입력해주세요');

export const signupSchema = z
  .object({
    email: emailSchema,
    password: passwordSchema,
    passwordCheck: passwordCheckSchema,
  })
  .refine((data) => data.password === data.passwordCheck, {
    path: ['passwordCheck'],
    message: '비밀번호가 일치하지 않습니다',
  });
