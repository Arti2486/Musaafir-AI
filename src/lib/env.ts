/**
 * Environment diagnostics for Musaafir AI.
 * Missing values are reported loudly but never crash the server on import.
 */

export const DEV_JWT_SECRET_FALLBACK = "musaafir-secret-key-12345";

let warnedSecret = false;

export function getJwtSecret(): string {
  const secret = process.env.JWT_SECRET?.trim();
  if (secret && secret.length > 0) return secret;

  if (!warnedSecret) {
    warnedSecret = true;
    console.error(
      "[AUTH] JWT_SECRET is missing from .env - tokens are being signed with an insecure development fallback.\n" +
        "[AUTH] Fix it with: JWT_SECRET=musaafir-secret-key-12345",
    );
  }
  return DEV_JWT_SECRET_FALLBACK;
}

export function getJwtExpiresIn(): string {
  const value = process.env.JWT_EXPIRES_IN?.trim();
  return value && value.length > 0 ? value : "7d";
}

export type EnvStatus = {
  ok: boolean;
  jwtSecretConfigured: boolean;
  jwtSecretSource: "env" | "fallback";
  jwtExpiresIn: string;
  databaseUrlConfigured: boolean;
  issues: string[];
};

export function getEnvStatus(): EnvStatus {
  const issues: string[] = [];
  const jwtConfigured = Boolean(process.env.JWT_SECRET?.trim());
  const dbConfigured = Boolean(process.env.DATABASE_URL?.trim());

  if (!jwtConfigured) {
    issues.push("JWT_SECRET is not set - copy .env.example to .env and add JWT_SECRET=musaafir-secret-key-12345");
  }
  if (!dbConfigured) {
    issues.push(
      "DATABASE_URL is not set - PostgreSQL not connected. Expected: postgresql://postgres:password@localhost:5432/myapp",
    );
  }

  return {
    ok: issues.length === 0,
    jwtSecretConfigured: jwtConfigured,
    jwtSecretSource: jwtConfigured ? "env" : "fallback",
    jwtExpiresIn: getJwtExpiresIn(),
    databaseUrlConfigured: dbConfigured,
    issues,
  };
}
