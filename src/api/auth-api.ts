import type {
  AuthenticationRequestDto,
  AuthenticationResponseDto,
  RegistrationRequestDto,
} from '@api/model';

const LOGIN_PATH = '/auth/login';
const REGISTER_PATH = '/auth/register';

export class AuthRequestError extends Error {
  readonly status: number;

  constructor(message: string, status: number) {
    super(message);
    this.name = 'AuthRequestError';
    this.status = status;
  }
}

async function readErrorMessage(res: Response): Promise<string> {
  const text = await res.text();
  if (!text) return res.statusText || 'Požadavek selhal';
  try {
    const j = JSON.parse(text) as { message?: string; error?: string; errors?: Record<string, string> };
    if (typeof j.message === 'string') return j.message;
    if (typeof j.error === 'string') return j.error;
    if (j.errors && typeof j.errors === 'object') {
      const first = Object.values(j.errors)[0];
      if (typeof first === 'string') return first;
    }
  } catch {
    /* plain text */
  }
  return text.slice(0, 200);
}

/**
 * Contract: POST `/auth/login` → JSON `{ token: string }` (see `AuthenticationResponseDto`).
 */
export async function authLoginRequest(dto: AuthenticationRequestDto): Promise<string> {
  const res = await fetch(LOGIN_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw new AuthRequestError(await readErrorMessage(res), res.status);
  }

  const text = await res.text();
  if (!text) {
    throw new AuthRequestError('Prázdná odpověď serveru', res.status);
  }

  const data = JSON.parse(text) as AuthenticationResponseDto;
  if (!data.token?.trim()) {
    throw new AuthRequestError('Server nevrátil přihlašovací token', res.status);
  }
  return data.token.trim();
}

/**
 * Contract: POST `/auth/register` with `RegistrationRequestDto`.
 */
export async function authRegisterRequest(dto: RegistrationRequestDto): Promise<void> {
  const res = await fetch(REGISTER_PATH, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(dto),
  });

  if (!res.ok) {
    throw new AuthRequestError(await readErrorMessage(res), res.status);
  }
}
