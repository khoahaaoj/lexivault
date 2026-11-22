import { z } from "zod";

const emailField = z
  .string()
  .trim()
  .toLowerCase()
  .pipe(z.email({ error: "Please enter a valid email address." }));

export const signInSchema = z.object({
  email: emailField,
  password: z
    .string()
    .min(1, { error: "Password is required." })
    .max(128, { error: "Password is too long." }),
});

export const signUpSchema = z
  .object({
    email: emailField,
    password: z
      .string()
      .min(8, { error: "Password must be at least 8 characters." })
      .max(128, { error: "Password is too long." }),
    confirmPassword: z
      .string()
      .min(1, { error: "Please confirm your password." }),
  })
  .refine((data) => data.password === data.confirmPassword, {
    path: ["confirmPassword"],
    error: "Passwords do not match.",
  });

export type SignInInput = z.infer<typeof signInSchema>;
export type SignUpInput = z.infer<typeof signUpSchema>;
