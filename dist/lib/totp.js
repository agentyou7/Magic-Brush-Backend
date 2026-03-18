"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.generateTotpSecret = generateTotpSecret;
exports.verifyTotpCode = verifyTotpCode;
exports.buildOtpAuthUrl = buildOtpAuthUrl;
const crypto_1 = __importDefault(require("crypto"));
const BASE32_ALPHABET = "ABCDEFGHIJKLMNOPQRSTUVWXYZ234567";
const TIME_STEP_SECONDS = 30;
const TOTP_DIGITS = 6;
function base32Encode(buffer) {
    let bits = 0;
    let value = 0;
    let output = "";
    for (const byte of buffer) {
        value = (value << 8) | byte;
        bits += 8;
        while (bits >= 5) {
            output += BASE32_ALPHABET[(value >>> (bits - 5)) & 31];
            bits -= 5;
        }
    }
    if (bits > 0) {
        output += BASE32_ALPHABET[(value << (5 - bits)) & 31];
    }
    return output;
}
function base32Decode(input) {
    const normalized = input.toUpperCase().replace(/=+$/g, "");
    let bits = 0;
    let value = 0;
    const output = [];
    for (const char of normalized) {
        const index = BASE32_ALPHABET.indexOf(char);
        if (index === -1) {
            continue;
        }
        value = (value << 5) | index;
        bits += 5;
        if (bits >= 8) {
            output.push((value >>> (bits - 8)) & 255);
            bits -= 8;
        }
    }
    return Buffer.from(output);
}
function generateHotp(secret, counter) {
    const buffer = Buffer.alloc(8);
    buffer.writeUInt32BE(Math.floor(counter / 0x100000000), 0);
    buffer.writeUInt32BE(counter >>> 0, 4);
    const hmac = crypto_1.default
        .createHmac("sha1", base32Decode(secret))
        .update(buffer)
        .digest();
    const offset = hmac[hmac.length - 1] & 0x0f;
    const code = ((hmac[offset] & 0x7f) << 24) |
        ((hmac[offset + 1] & 0xff) << 16) |
        ((hmac[offset + 2] & 0xff) << 8) |
        (hmac[offset + 3] & 0xff);
    return String(code % 10 ** TOTP_DIGITS).padStart(TOTP_DIGITS, "0");
}
function generateTotpSecret(length = 20) {
    return base32Encode(crypto_1.default.randomBytes(length));
}
function verifyTotpCode(secret, code, window = 1) {
    const normalizedCode = code.trim();
    if (!/^\d{6}$/.test(normalizedCode)) {
        return false;
    }
    const currentCounter = Math.floor(Date.now() / 1000 / TIME_STEP_SECONDS);
    for (let offset = -window; offset <= window; offset += 1) {
        if (generateHotp(secret, currentCounter + offset) === normalizedCode) {
            return true;
        }
    }
    return false;
}
function buildOtpAuthUrl(params) {
    const label = encodeURIComponent(`${params.issuer}:${params.accountName}`);
    const issuer = encodeURIComponent(params.issuer);
    const secret = encodeURIComponent(params.secret);
    return `otpauth://totp/${label}?secret=${secret}&issuer=${issuer}&algorithm=SHA1&digits=${TOTP_DIGITS}&period=${TIME_STEP_SECONDS}`;
}
