import { relations } from 'drizzle-orm';
import { integer, sqliteTable, text } from 'drizzle-orm/sqlite-core';

export const users = sqliteTable('users', {
  id: text('id').primaryKey(),
  email: text('email').notNull().unique(),
  displayName: text('display_name').notNull(),
  passwordHash: text('password_hash').notNull(),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const sessions = sqliteTable('sessions', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  tokenHash: text('token_hash').notNull().unique(),
  expiresAt: integer('expires_at').notNull(),
  lastSeenAt: integer('last_seen_at').notNull(),
  createdAt: integer('created_at').notNull(),
});

export const projects = sqliteTable('projects', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  name: text('name').notNull(),
  brandName: text('brand_name').notNull(),
  language: text('language').notNull(),
  market: text('market').notNull(),
  homepageUrl: text('homepage_url').notNull(),
  aboutUrl: text('about_url').notNull(),
  sitemapUrl: text('sitemap_url').notNull(),
  competitorUrls: text('competitor_urls'),
  notes: text('notes'),
  createdAt: integer('created_at').notNull(),
  updatedAt: integer('updated_at').notNull(),
});

export const uploadedFiles = sqliteTable('uploaded_files', {
  id: text('id').primaryKey(),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  runId: text('run_id'),
  originalName: text('original_name').notNull(),
  storedPath: text('stored_path').notNull(),
  mimeType: text('mime_type').notNull(),
  sizeBytes: integer('size_bytes').notNull(),
  summary: text('summary'),
  createdAt: integer('created_at').notNull(),
});

export const researchRuns = sqliteTable('research_runs', {
  id: text('id').primaryKey(),
  projectId: text('project_id').notNull().references(() => projects.id, { onDelete: 'cascade' }),
  userId: text('user_id').notNull().references(() => users.id, { onDelete: 'cascade' }),
  mode: text('mode').notNull(),
  status: text('status').notNull(),
  step: text('step'),
  targetRows: integer('target_rows').notNull(),
  inputSnapshot: text('input_snapshot').notNull(),
  siteSnapshot: text('site_snapshot'),
  competitorSnapshot: text('competitor_snapshot'),
  uploadedFileId: text('uploaded_file_id').references(() => uploadedFiles.id, { onDelete: 'set null' }),
  resultRows: text('result_rows'),
  resultSummary: text('result_summary'),
  workbookPath: text('workbook_path'),
  workbookName: text('workbook_name'),
  workbookMime: text('workbook_mime'),
  errorMessage: text('error_message'),
  workerId: text('worker_id'),
  lockAcquiredAt: integer('lock_acquired_at'),
  queuedAt: integer('queued_at').notNull(),
  startedAt: integer('started_at'),
  completedAt: integer('completed_at'),
  updatedAt: integer('updated_at').notNull(),
});

export const researchLogs = sqliteTable('research_logs', {
  id: text('id').primaryKey(),
  runId: text('run_id').notNull().references(() => researchRuns.id, { onDelete: 'cascade' }),
  stage: text('stage').notNull(),
  level: text('level').notNull(),
  message: text('message').notNull(),
  metadata: text('metadata'),
  createdAt: integer('created_at').notNull(),
});

export const userRelations = relations(users, ({ many }) => ({
  sessions: many(sessions),
  projects: many(projects),
  runs: many(researchRuns),
  uploadedFiles: many(uploadedFiles),
}));

export const sessionRelations = relations(sessions, ({ one }) => ({
  user: one(users, {
    fields: [sessions.userId],
    references: [users.id],
  }),
}));

export const projectRelations = relations(projects, ({ one, many }) => ({
  user: one(users, {
    fields: [projects.userId],
    references: [users.id],
  }),
  runs: many(researchRuns),
}));

export const uploadedFileRelations = relations(uploadedFiles, ({ one }) => ({
  user: one(users, {
    fields: [uploadedFiles.userId],
    references: [users.id],
  }),
}));

export const researchRunRelations = relations(researchRuns, ({ one, many }) => ({
  project: one(projects, {
    fields: [researchRuns.projectId],
    references: [projects.id],
  }),
  user: one(users, {
    fields: [researchRuns.userId],
    references: [users.id],
  }),
  uploadedFile: one(uploadedFiles, {
    fields: [researchRuns.uploadedFileId],
    references: [uploadedFiles.id],
  }),
  logs: many(researchLogs),
}));

export const researchLogRelations = relations(researchLogs, ({ one }) => ({
  run: one(researchRuns, {
    fields: [researchLogs.runId],
    references: [researchRuns.id],
  }),
}));
