
import CryptoJS from 'crypto-js';

// WARNING: In a real-world application, this key should be managed securely
// and not hardcoded. For this prototype, it's stored here, but for production,
// it should come from a secure environment variable management system.
const SECRET_KEY = process.env.LOCAL_STORAGE_ENCRYPTION_KEY || 'default-prototype-secret-key-that-is-long-enough';

/**
 * Encrypts data (object, string, number) for storing in localStorage.
 * @param data The data to encrypt.
 * @returns An encrypted string.
 */
export function encryptData(data: string): string {
  try {
    return CryptoJS.AES.encrypt(data, SECRET_KEY).toString();
  } catch (error) {
    console.error("Encryption failed:", error);
    // Return an empty string or handle the error as appropriate
    return ''; 
  }
}

/**
 * Decrypts data from localStorage.
 * @param ciphertext The encrypted string to decrypt.
 * @returns The original data (object, string, number).
 */
export function decryptData(ciphertext: string): any {
  if (!ciphertext) {
    return null;
  }
  try {
    const bytes = CryptoJS.AES.decrypt(ciphertext, SECRET_KEY);
    const decryptedString = bytes.toString(CryptoJS.enc.Utf8);

    if (!decryptedString) {
        throw new Error("Decryption resulted in an empty string.");
    }
    
    // The data was originally stringified, so we parse it back.
    return JSON.parse(decryptedString);
  } catch (error) {
    console.error("Decryption failed:", error);
    // This will cause the calling function to handle the error,
    // typically by clearing the corrupted storage item.
    throw error;
  }
}
