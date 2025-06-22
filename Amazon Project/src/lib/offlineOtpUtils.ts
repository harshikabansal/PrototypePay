
// src/lib/offlineOtpUtils.ts

/**
 * Generates a unique 6-character alphanumeric transaction ID.
 * The OTP part is no longer explicitly used for QR flow but the function structure is kept.
 */
export function generateOfflineTransactionDetails(): { otp: string; transactionId: string } {
  // OTP is not the primary mechanism for QR, but we can generate one for legacy structure.
  // The transactionId is the key for QR.
  const otp = Math.floor(100000 + Math.random() * 900000).toString(); 
  
  const characters = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
  let transactionId = '';
  for (let i = 0; i < 6; i++) {
    transactionId += characters.charAt(Math.floor(Math.random() * characters.length));
  }
  
  // For QR flow, the transactionId is the critical piece.
  // The 'otp' can be this transactionId or a random number, 
  // but server side will primarily use transactionId from QR.
  return { otp: transactionId, transactionId }; // Make otp and transactionId same for simplicity if otp field is still used
}
