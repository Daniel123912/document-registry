const crypto = require("crypto");
const { passwordVaultKey } = require("./config");

const ALGORITHM = "aes-256-gcm";
const IV_LENGTH = 12;
const TAG_LENGTH = 16;
const KEY_SALT = "bakor-password-vault-v1";

function getVaultKey() {
  const raw = passwordVaultKey;
  if (!raw) {
    return null;
  }
  if (/^[0-9a-fA-F]{64}$/.test(raw)) {
    return Buffer.from(raw, "hex");
  }
  return crypto.scryptSync(raw, KEY_SALT, 32);
}

function encryptPassword(plainPassword) {
  const key = getVaultKey();
  if (!key || plainPassword == null || plainPassword === "") {
    return null;
  }

  const iv = crypto.randomBytes(IV_LENGTH);
  const cipher = crypto.createCipheriv(ALGORITHM, key, iv);
  const ciphertext = Buffer.concat([
    cipher.update(String(plainPassword), "utf8"),
    cipher.final(),
  ]);
  const tag = cipher.getAuthTag();
  return Buffer.concat([iv, tag, ciphertext]).toString("base64");
}

function decryptPassword(encryptedPayload) {
  const key = getVaultKey();
  if (!key || !encryptedPayload) {
    return null;
  }

  try {
    const data = Buffer.from(encryptedPayload, "base64");
    if (data.length < IV_LENGTH + TAG_LENGTH + 1) {
      return null;
    }
    const iv = data.subarray(0, IV_LENGTH);
    const tag = data.subarray(IV_LENGTH, IV_LENGTH + TAG_LENGTH);
    const ciphertext = data.subarray(IV_LENGTH + TAG_LENGTH);
    const decipher = crypto.createDecipheriv(ALGORITHM, key, iv);
    decipher.setAuthTag(tag);
    return Buffer.concat([
      decipher.update(ciphertext),
      decipher.final(),
    ]).toString("utf8");
  } catch {
    return null;
  }
}

module.exports = {
  encryptPassword,
  decryptPassword,
};
