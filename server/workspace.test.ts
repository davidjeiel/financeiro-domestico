import { describe, it, expect, beforeEach } from "vitest";
import {
  createWorkspace,
  getWorkspacesByUser,
  getWorkspaceById,
  updateWorkspace,
  addWorkspaceMember,
  getWorkspaceMembers,
  createWorkspaceInvite,
  getWorkspaceInviteByToken,
  getPendingInvitesByEmail,
  acceptWorkspaceInvite,
  createSharedAccount,
  getSharedAccountsByWorkspace,
  addTransactionResponsibility,
  getTransactionResponsibilities,
  removeTransactionResponsibility,
  logAuditAction,
  getAuditLogByWorkspace,
} from "./db";

const testUserId = 1;
const testEmail = "test@example.com";

describe("Workspace Collaboration Features", () => {
  describe("Workspace Management", () => {
    let workspaceId: number;

    beforeEach(async () => {
      const workspace = await createWorkspace({
        ownerId: testUserId,
        name: "Test Workspace",
        description: "A workspace for testing",
        type: "family",
        isActive: 1,
      });
      workspaceId = workspace.id;
    });

    it("should create a workspace", async () => {
      expect(workspaceId).toBeGreaterThan(0);
    });

    it("should retrieve workspaces by user", async () => {
      const workspaces = await getWorkspacesByUser(testUserId);
      expect(Array.isArray(workspaces)).toBe(true);
      expect(workspaces.length).toBeGreaterThan(0);
    });
  });

  describe("Workspace Updates", () => {
    let workspaceId: number;

    beforeEach(async () => {
      const workspace = await createWorkspace({
        ownerId: testUserId,
        name: "Workspace to Update",
        description: "Original description",
        type: "business",
        isActive: 1,
      });
      workspaceId = workspace.id;
    });

    it("should update workspace", async () => {
      await updateWorkspace(workspaceId, {
        name: "Updated Workspace",
        description: "Updated description",
      });
      const workspace = await getWorkspaceById(workspaceId);
      expect(workspace?.name).toBe("Updated Workspace");
      expect(workspace?.description).toBe("Updated description");
    });
  });

  describe("Workspace Members & Invites", () => {
    let workspaceId: number;

    beforeEach(async () => {
      const workspace = await createWorkspace({
        ownerId: testUserId,
        name: "Test Workspace for Invites",
        description: "Testing invites",
        type: "family",
        isActive: 1,
      });
      workspaceId = workspace.id;
    });

    it("should create workspace invite", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const uniqueToken = `test-token-${Date.now()}-${Math.random()}`;
      const invite = await createWorkspaceInvite({
        workspaceId,
        email: testEmail,
        token: uniqueToken,
        role: "editor",
        invitedBy: testUserId,
        expiresAt,
        status: "pending",
      });
      expect(invite.id).toBeGreaterThan(0);
    });

    it("should get pending invites by email", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const uniqueToken = `test-token-${Date.now()}-${Math.random()}`;
      await createWorkspaceInvite({
        workspaceId,
        email: testEmail,
        token: uniqueToken,
        role: "viewer",
        invitedBy: testUserId,
        expiresAt,
        status: "pending",
      });

      const invites = await getPendingInvitesByEmail(testEmail);
      expect(Array.isArray(invites)).toBe(true);
      expect(invites.length).toBeGreaterThan(0);
    });

    it("should get workspace invite by token", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const uniqueToken = `unique-token-${Date.now()}-${Math.random()}`;
      const newInvite = await createWorkspaceInvite({
        workspaceId,
        email: "another@example.com",
        token: uniqueToken,
        role: "editor",
        invitedBy: testUserId,
        expiresAt,
        status: "pending",
      });

      const retrieved = await getWorkspaceInviteByToken(newInvite.token);
      expect(retrieved).toBeDefined();
      expect(retrieved?.email).toBe("another@example.com");
    });

    it("should accept workspace invite", async () => {
      const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000);
      const uniqueToken = `accept-token-${Date.now()}-${Math.random()}`;
      const invite = await createWorkspaceInvite({
        workspaceId,
        email: testEmail,
        token: uniqueToken,
        role: "editor",
        invitedBy: testUserId,
        expiresAt,
        status: "pending",
      });

      const accepted = await acceptWorkspaceInvite(invite.id, testUserId);
      expect(accepted).toBeDefined();
    });

    it("should list workspace members", async () => {
      const members = await getWorkspaceMembers(workspaceId);
      expect(Array.isArray(members)).toBe(true);
    });
  });

  describe("Shared Accounts", () => {
    let workspaceId: number;

    beforeEach(async () => {
      const workspace = await createWorkspace({
        ownerId: testUserId,
        name: "Test Workspace for Shared Accounts",
        description: "Testing shared accounts",
        type: "family",
        isActive: 1,
      });
      workspaceId = workspace.id;
    });

    it("should create shared account", async () => {
      const shared = await createSharedAccount({
        accountId: 1,
        workspaceId,
        shareType: "joint",
      });
      expect(shared.id).toBeGreaterThan(0);
    });

    it("should list shared accounts by workspace", async () => {
      await createSharedAccount({
        accountId: 1,
        workspaceId,
        shareType: "shared",
      });

      const shared = await getSharedAccountsByWorkspace(workspaceId);
      expect(Array.isArray(shared)).toBe(true);
    });
  });

  describe("Transaction Responsibilities", () => {
    it("should add transaction responsibility", async () => {
      const responsibility = await addTransactionResponsibility({
        transactionId: 1,
        userId: testUserId,
        percentage: 50,
        notes: "Half of the expense",
      });
      expect(responsibility.id).toBeGreaterThan(0);
    });

    it("should list transaction responsibilities", async () => {
      await addTransactionResponsibility({
        transactionId: 1,
        userId: testUserId,
        percentage: 100,
        notes: "Full responsibility",
      });

      const responsibilities = await getTransactionResponsibilities(1);
      expect(Array.isArray(responsibilities)).toBe(true);
    });

    it("should remove transaction responsibility", async () => {
      const responsibility = await addTransactionResponsibility({
        transactionId: 1,
        userId: testUserId,
        percentage: 50,
        notes: "Test responsibility",
      });

      const result = await removeTransactionResponsibility(responsibility.id);
      expect(result).toBeDefined();
    });
  });

  describe("Audit Logging", () => {
    let workspaceId: number;

    beforeEach(async () => {
      const workspace = await createWorkspace({
        ownerId: testUserId,
        name: "Test Workspace for Audit",
        description: "Testing audit log",
        type: "family",
        isActive: 1,
      });
      workspaceId = workspace.id;
    });

    it("should log audit action", async () => {
      const log = await logAuditAction({
        workspaceId,
        userId: testUserId,
        action: "create_workspace",
        entityType: "workspace",
        entityId: workspaceId,
        changes: JSON.stringify({ name: "Test Workspace" }),
      });
      expect(log.id).toBeGreaterThan(0);
    });

    it("should retrieve audit log by workspace", async () => {
      await logAuditAction({
        workspaceId,
        userId: testUserId,
        action: "invite_member",
        entityType: "member",
        entityId: 1,
        changes: JSON.stringify({ email: testEmail }),
      });

      const logs = await getAuditLogByWorkspace(workspaceId, 10);
      expect(Array.isArray(logs)).toBe(true);
    });
  });
});
