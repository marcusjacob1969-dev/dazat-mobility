import type { FastifyRequest } from 'fastify';

const MAXIMUM_BEARER_TOKEN_LENGTH = 512;
const bearerPattern = /^Bearer[ \t]+([^\s,]+)[ \t]*$/i;

export function bearerTokenFromAuthorization(authorization: string | undefined): string | null {
  if (!authorization || authorization.length > MAXIMUM_BEARER_TOKEN_LENGTH) return null;
  const match = bearerPattern.exec(authorization);
  if (!match) return null;
  return match[1] ?? null;
}

export function bearerTokenFromRequest(request: FastifyRequest): string | null {
  return bearerTokenFromAuthorization(request.headers.authorization);
}
