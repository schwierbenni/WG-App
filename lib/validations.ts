import { z } from 'zod'

export const registerSchema = z.object({
  name: z.string().min(2, 'Name muss mindestens 2 Zeichen haben').max(100),
  email: z.email('Ungültige E-Mail-Adresse'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
  inviteToken: z.string().optional(),
})

export const loginSchema = z.object({
  email: z.email('Ungültige E-Mail-Adresse'),
  password: z.string().min(1, 'Passwort ist erforderlich'),
})

export const passwordResetRequestSchema = z.object({
  email: z.email('Ungültige E-Mail-Adresse'),
})

export const passwordResetSchema = z.object({
  token: z.string().min(1, 'Token ist erforderlich'),
  password: z.string().min(8, 'Passwort muss mindestens 8 Zeichen haben').max(100),
})

export const dutySchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(100),
  description: z.string().max(500).optional(),
  emoji: z.string().max(10).optional(),
  color: z.string().regex(/^#[0-9a-fA-F]{6}$/, 'Ungültige Farbe').optional().default('#6366f1'),
  rotationInterval: z.enum(['DAILY', 'WEEKLY', 'BIWEEKLY', 'MONTHLY', 'MANUAL']).default('WEEKLY'),
  rotationOrder: z.array(z.string()).default([]),
  checklistItems: z.array(z.string()).default([]),
})

export const updateDutySchema = dutySchema.partial().extend({
  isActive: z.boolean().optional(),
  isPaused: z.boolean().optional(),
})

export const assignmentSchema = z.object({
  dutyId: z.string().min(1),
  userId: z.string().min(1),
  dueDate: z.string().datetime({ message: 'Ungültiges Datum' }),
})

export const swapRequestSchema = z.object({
  toUserId: z.string().min(1),
  assignmentId: z.string().min(1),
})

export const announcementSchema = z.object({
  content: z.string().min(1, 'Inhalt ist erforderlich').max(2000),
})

export const reactionSchema = z.object({
  emoji: z.string().min(1).max(10),
})

export const shoppingItemSchema = z.object({
  name: z.string().min(1, 'Name ist erforderlich').max(200),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'SONSTIGES']).default('LEBENSMITTEL'),
  note: z.string().max(500).optional(),
})

export const expenseSchema = z.object({
  amount: z.number().positive('Betrag muss positiv sein'),
  description: z.string().min(1, 'Beschreibung ist erforderlich').max(500),
  category: z.enum(['LEBENSMITTEL', 'HAUSHALT', 'MIETE_NEBENKOSTEN', 'SONSTIGES']).default('SONSTIGES'),
  paidBy: z.string().min(1),
  splitWith: z.array(z.string()).min(1),
  date: z.string().datetime({ message: 'Ungültiges Datum' }).optional(),
})

export const updateProfileSchema = z.object({
  name: z.string().min(2).max(100).optional(),
  avatarUrl: z.string().url('Ungültige URL').optional().or(z.literal('')),
  emailNotifications: z.boolean().optional(),
})

export const changePasswordSchema = z.object({
  currentPassword: z.string().min(1),
  newPassword: z.string().min(8).max(100),
  confirmPassword: z.string().min(1),
}).refine((d) => d.newPassword === d.confirmPassword, {
  message: 'Passwörter stimmen nicht überein',
  path: ['confirmPassword'],
})

export type RegisterInput = z.infer<typeof registerSchema>
export type LoginInput = z.infer<typeof loginSchema>
export type DutyInput = z.infer<typeof dutySchema>
export type UpdateDutyInput = z.infer<typeof updateDutySchema>
export type AssignmentInput = z.infer<typeof assignmentSchema>
export type SwapRequestInput = z.infer<typeof swapRequestSchema>
export type AnnouncementInput = z.infer<typeof announcementSchema>
export type ShoppingItemInput = z.infer<typeof shoppingItemSchema>
export type ExpenseInput = z.infer<typeof expenseSchema>
export type UpdateProfileInput = z.infer<typeof updateProfileSchema>
export type ChangePasswordInput = z.infer<typeof changePasswordSchema>
