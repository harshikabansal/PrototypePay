
import { z } from 'zod';

export const LoginSchema = z.object({
  email: z.string().email({ message: "Invalid email address." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
});
export type LoginFormData = z.infer<typeof LoginSchema>;

export const RegisterSchema = z.object({
  fullName: z.string().min(2, { message: "Full name must be at least 2 characters." }),
  email: z.string().email({ message: "Invalid email address." }),
  phoneNumber: z.string().min(10, { message: "Phone number must be at least 10 digits." }).regex(/^\+?[1-9]\d{1,14}$/, { message: "Invalid phone number format." }),
  password: z.string().min(6, { message: "Password must be at least 6 characters." }),
  confirmPassword: z.string().min(6, { message: "Password must be at least 6 characters." }),
  pin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 numeric digits." }),
  confirmPin: z.string().length(4, { message: "PIN must be 4 digits." }),
}).refine(data => data.password === data.confirmPassword, {
  message: "Passwords do not match.",
  path: ["confirmPassword"],
}).refine(data => data.pin === data.confirmPin, {
  message: "PINs do not match.",
  path: ["confirmPin"],
});
export type RegisterFormData = z.infer<typeof RegisterSchema>;

export const TransferToBankSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  pin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 numeric digits." }),
});
export type TransferToBankFormData = z.infer<typeof TransferToBankSchema>;

export const SendCoinSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }),
  recipientUpiId: z.string().min(3, { message: "Recipient UPI ID is required." }),
});
export type SendCoinFormData = z.infer<typeof SendCoinSchema>;

// VerifyOtpSchema is no longer needed as input is via QR scan.
// export const VerifyOtpSchema = z.object({
//   otp: z.string().length(6, { message: "OTP must be 6 digits." }),
//   transactionId: z.string().length(6, { message: "Transaction ID must be 6 characters." }),
//   amount: z.coerce.number().positive({ message: "Amount must be a positive number." }),
// });
// export type VerifyOtpFormData = z.infer<typeof VerifyOtpSchema>;

export const AddFundsSchema = z.object({
  amount: z.coerce.number().positive({ message: "Amount must be positive." }).max(1000, { message: "Transaction limit is 1000 coins."}),
  pin: z.string().length(4, { message: "PIN must be 4 digits." }).regex(/^\d{4}$/, { message: "PIN must be 4 numeric digits." }),
});
export type AddFundsFormData = z.infer<typeof AddFundsSchema>;
