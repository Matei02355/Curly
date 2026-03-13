import { generateSecret, generateURI, verify } from "otplib";
import QRCode from "qrcode";

import { env } from "@/lib/env";

export function generateTotpSecret(username: string) {
  const secret = generateSecret();
  const otpauth = generateURI({
    secret,
    issuer: env.APP_NAME,
    label: username,
    algorithm: "sha1",
    digits: 6,
    period: 30,
  });
  return { secret, otpauth };
}

export function verifyTotpToken(secret: string, token: string) {
  return verify({
    secret,
    token,
  });
}

export async function createTotpQrDataUrl(otpauth: string) {
  return QRCode.toDataURL(otpauth, {
    errorCorrectionLevel: "M",
    margin: 1,
    width: 280,
  });
}
