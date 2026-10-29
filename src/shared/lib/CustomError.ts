import { ERROR_MESSAGES, DEFAULT_ERROR_MESSAGE } from '@/shared/constants/messages';

export class CustomError extends Error {
  status: number;
  rawMessage?: string;

  constructor(status: number, rawMessage?: string) {
    super(ERROR_MESSAGES[status] || DEFAULT_ERROR_MESSAGE);
    this.status = status;
    this.rawMessage = rawMessage;
    this.name = 'CustomError';

    Object.setPrototypeOf(this, new.target.prototype);
    // Object.setPrototypeOf(this, new.target.prototype)는
    // CustomError가 진짜 Error처럼 작동하도록 prototype 체인을 수동으로 연결해주는 코드입니다.
  }
}
