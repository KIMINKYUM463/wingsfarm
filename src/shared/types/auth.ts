import { signupSchema } from '@/validation/auth.schema';
import { z } from 'zod';

export type SignupFormType = z.infer<typeof signupSchema>;

export type SignupPayload = Pick<SignupFormType, 'email' | 'password'>;
