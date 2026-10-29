import request from './request';
import type { HttpClient } from '@/shared/types/api';

const httpClient: HttpClient = {
  get: (endpoint, options) => request({ method: 'GET', endpoint, options }),
  post: (endpoint, data = {}, options) => request({ method: 'POST', endpoint, data, options }),
  put: (endpoint, data, options) => request({ method: 'PUT', endpoint, data, options }),
  patch: (endpoint, data, options) => request({ method: 'PATCH', endpoint, data, options }),
  delete: (endpoint, options) => request({ method: 'DELETE', endpoint, options }),
};
export default httpClient;
