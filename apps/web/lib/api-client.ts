const API_URL = process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Shapes match the FastAPI backend's actual Pydantic schemas
// (apps/api/app/schemas/auth.py) — kept in sync manually until an OpenAPI-generated
// client replaces this (tracked as a follow-up, not done here).

export interface UserResponse {
  id: string;
  email: string;
  full_name: string | null;
  role: string;
  is_email_verified: boolean;
}

export interface TokenResponse {
  access_token: string;
  refresh_token: string;
  token_type: string;
}

export interface ApiError {
  detail: string;
}

class ApiClientError extends Error {
  detail: string;
  status: number;
  constructor(status: number, detail: string) {
    super(detail);
    this.status = status;
    this.detail = detail;
  }
}

async function handle<T>(res: Response): Promise<T> {
  const body = await res.json().catch(() => ({}));
  if (!res.ok) {
    // FastAPI validation errors (422) return {detail: [...]} as an array, not a string
    const detail = Array.isArray(body.detail)
      ? body.detail.map((e: any) => e.msg).join('; ')
      : body.detail || 'Request failed';
    throw new ApiClientError(res.status, detail);
  }
  return body as T;
}

export const apiClient = {
  async health() {
    const res = await fetch(`${API_URL}/health`);
    if (!res.ok) throw new Error('Health check failed');
    return res.json();
  },

  async register(email: string, password: string, fullName?: string): Promise<UserResponse> {
    const res = await fetch(`${API_URL}/api/v1/auth/register`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password, full_name: fullName }),
    });
    return handle<UserResponse>(res);
  },

  async login(email: string, password: string): Promise<TokenResponse> {
    const res = await fetch(`${API_URL}/api/v1/auth/login`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email, password }),
    });
    return handle<TokenResponse>(res);
  },

  async me(accessToken: string): Promise<UserResponse> {
    const res = await fetch(`${API_URL}/api/v1/auth/me`, {
      headers: { Authorization: `Bearer ${accessToken}` },
    });
    return handle<UserResponse>(res);
  },

  async logout(refreshToken: string): Promise<void> {
    // Backend expects the refresh token in the body, not an Authorization header.
    const res = await fetch(`${API_URL}/api/v1/auth/logout`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    if (!res.ok && res.status !== 204) {
      await handle(res);
    }
  },

  async refreshToken(refreshToken: string): Promise<TokenResponse> {
    // Backend expects the refresh token in the body, not an Authorization header.
    const res = await fetch(`${API_URL}/api/v1/auth/refresh`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ refresh_token: refreshToken }),
    });
    return handle<TokenResponse>(res);
  },

  async passwordResetRequest(email: string): Promise<{ detail: string }> {
    const res = await fetch(`${API_URL}/api/v1/auth/password-reset/request`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ email }),
    });
    return handle(res);
  },

  async passwordResetConfirm(token: string, newPassword: string): Promise<void> {
    // Backend field name is `token`, not `reset_token`; and there is no `email` field.
    const res = await fetch(`${API_URL}/api/v1/auth/password-reset/confirm`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ token, new_password: newPassword }),
    });
    if (!res.ok && res.status !== 204) {
      await handle(res);
    }
  },
};

export { ApiClientError };
