export type Role = 'ADMIN' | 'MEMBER'
export type RotationInterval = 'DAILY' | 'WEEKLY' | 'BIWEEKLY' | 'MONTHLY' | 'MANUAL'
export type SwapStatus = 'PENDING' | 'ACCEPTED' | 'REJECTED'
export type ShoppingCategory = 'LEBENSMITTEL' | 'HAUSHALT' | 'SONSTIGES'
export type ExpenseCategory = 'LEBENSMITTEL' | 'HAUSHALT' | 'MIETE_NEBENKOSTEN' | 'SONSTIGES'
export type NotificationType = 'ASSIGNMENT' | 'SWAP_REQUEST' | 'REMINDER' | 'ANNOUNCEMENT'

export interface User {
  id: string; name: string; email: string; passwordHash: string
  avatarUrl: string | null; role: Role; emailNotifications: boolean
  createdAt: Date; updatedAt: Date
}
export type PublicUser = Omit<User, 'passwordHash'>

export interface Duty {
  id: string; name: string; description: string | null; emoji: string | null
  color: string; rotationInterval: RotationInterval; isActive: boolean
  isPaused: boolean; rotationOrder: string[]; checklistItems: string[]
  createdAt: Date; updatedAt: Date
}

export interface DutyAssignment {
  id: string; dutyId: string; userId: string; dueDate: Date
  completedAt: Date | null; completedBy: string | null; createdAt: Date
}

export interface SwapRequest {
  id: string; fromUserId: string; toUserId: string; assignmentId: string
  status: SwapStatus; createdAt: Date; updatedAt: Date
}

export interface Announcement {
  id: string; authorId: string; content: string; createdAt: Date
}

export interface ShoppingItem {
  id: string; name: string; category: ShoppingCategory; note: string | null
  addedBy: string; boughtAt: Date | null; createdAt: Date
}

export interface Expense {
  id: string; amount: number; description: string; category: ExpenseCategory
  paidBy: string; splitWith: string[]; date: Date; settledAt: Date | null; createdAt: Date
}

export interface Notification {
  id: string; userId: string; type: NotificationType
  message: string; readAt: Date | null; createdAt: Date
}

export type DutyAssignmentWithRelations = DutyAssignment & { duty: Duty; user: PublicUser }
export type SwapRequestWithRelations = SwapRequest & { fromUser: PublicUser; toUser: PublicUser; assignment: DutyAssignmentWithRelations }
export type AnnouncementWithRelations = Announcement & { author: PublicUser; reactions: { emoji: string; userId: string }[] }
export type ExpenseWithUser = Expense & { paidByUser: PublicUser }

declare module 'next-auth' {
  interface Session {
    user: { id: string; name?: string | null; email?: string | null; image?: string | null; role: string }
  }
}
