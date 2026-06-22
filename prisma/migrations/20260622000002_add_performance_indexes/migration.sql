-- Performance indexes for foreign keys and common filter fields

-- User: frequent wgId lookups
CREATE INDEX "User_wgId_idx" ON "User"("wgId");

-- Duty: all active/paused duty queries per WG
CREATE INDEX "Duty_wgId_idx" ON "Duty"("wgId");
CREATE INDEX "Duty_wgId_isActive_isPaused_idx" ON "Duty"("wgId", "isActive", "isPaused");

-- DutyAssignment: completion statistics, upcoming duty queries, per-user/duty lookups
CREATE INDEX "DutyAssignment_wgId_idx" ON "DutyAssignment"("wgId");
CREATE INDEX "DutyAssignment_wgId_completedAt_idx" ON "DutyAssignment"("wgId", "completedAt");
CREATE INDEX "DutyAssignment_wgId_dueDate_idx" ON "DutyAssignment"("wgId", "dueDate");
CREATE INDEX "DutyAssignment_userId_idx" ON "DutyAssignment"("userId");
CREATE INDEX "DutyAssignment_dutyId_idx" ON "DutyAssignment"("dutyId");

-- DutySwapIOU: per-WG and per-user IOU lookups
CREATE INDEX "DutySwapIOU_wgId_idx" ON "DutySwapIOU"("wgId");
CREATE INDEX "DutySwapIOU_debitorId_idx" ON "DutySwapIOU"("debitorId");
CREATE INDEX "DutySwapIOU_creditorId_idx" ON "DutySwapIOU"("creditorId");

-- SwapRequest: status-filtered WG queries, per-user lookups
CREATE INDEX "SwapRequest_wgId_status_idx" ON "SwapRequest"("wgId", "status");
CREATE INDEX "SwapRequest_fromUserId_idx" ON "SwapRequest"("fromUserId");
CREATE INDEX "SwapRequest_toUserId_idx" ON "SwapRequest"("toUserId");
CREATE INDEX "SwapRequest_assignmentId_idx" ON "SwapRequest"("assignmentId");

-- Announcement: chronological WG feed, per-author lookups
CREATE INDEX "Announcement_wgId_createdAt_idx" ON "Announcement"("wgId", "createdAt");
CREATE INDEX "Announcement_authorId_idx" ON "Announcement"("authorId");

-- AnnouncementReaction: per-user reaction lookups
-- (announcementId is covered by existing @@unique([announcementId, userId, emoji]))
CREATE INDEX "AnnouncementReaction_userId_idx" ON "AnnouncementReaction"("userId");

-- ShoppingItem: unbought-first ordering, per-user lookups
CREATE INDEX "ShoppingItem_wgId_boughtAt_idx" ON "ShoppingItem"("wgId", "boughtAt");
CREATE INDEX "ShoppingItem_addedBy_idx" ON "ShoppingItem"("addedBy");

-- Expense: date-ordered WG queries, settlement filtering, per-payer lookups
CREATE INDEX "Expense_wgId_date_idx" ON "Expense"("wgId", "date");
CREATE INDEX "Expense_wgId_settledAt_idx" ON "Expense"("wgId", "settledAt");
CREATE INDEX "Expense_paidBy_idx" ON "Expense"("paidBy");

-- Settlement: per-WG and per-user settlement queries
CREATE INDEX "Settlement_wgId_idx" ON "Settlement"("wgId");
CREATE INDEX "Settlement_fromUserId_idx" ON "Settlement"("fromUserId");
CREATE INDEX "Settlement_toUserId_idx" ON "Settlement"("toUserId");

-- Notification: per-user/WG unread notification queries
CREATE INDEX "Notification_wgId_userId_idx" ON "Notification"("wgId", "userId");
CREATE INDEX "Notification_userId_readAt_idx" ON "Notification"("userId", "readAt");

-- PushSubscription: per-user push target lookups
CREATE INDEX "PushSubscription_userId_idx" ON "PushSubscription"("userId");

-- SpotifyPlaylist: per-WG and per-user playlist queries
CREATE INDEX "SpotifyPlaylist_wgId_idx" ON "SpotifyPlaylist"("wgId");
CREATE INDEX "SpotifyPlaylist_userId_idx" ON "SpotifyPlaylist"("userId");

-- ICalCalendar: per-WG calendar lookups
CREATE INDEX "ICalCalendar_wgId_idx" ON "ICalCalendar"("wgId");

-- ICalEvent: per-WG event queries, date-range calendar queries
CREATE INDEX "ICalEvent_wgId_idx" ON "ICalEvent"("wgId");
CREATE INDEX "ICalEvent_calendarId_startDate_idx" ON "ICalEvent"("calendarId", "startDate");

-- GameSession: chronological WG game history, per-creator lookups
CREATE INDEX "GameSession_wgId_playedAt_idx" ON "GameSession"("wgId", "playedAt");
CREATE INDEX "GameSession_createdBy_idx" ON "GameSession"("createdBy");

-- GameResult: per-session and per-user score lookups
CREATE INDEX "GameResult_gameSessionId_idx" ON "GameResult"("gameSessionId");
CREATE INDEX "GameResult_userId_idx" ON "GameResult"("userId");

-- WGEvent: date-ordered WG calendar queries, per-creator lookups
CREATE INDEX "WGEvent_wgId_startDate_idx" ON "WGEvent"("wgId", "startDate");
CREATE INDEX "WGEvent_createdBy_idx" ON "WGEvent"("createdBy");
