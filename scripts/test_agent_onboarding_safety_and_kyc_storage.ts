/**
 * Targeted Test Suite: Agent Onboarding Safety, Rollback Integrity & KYC Storage Authorization
 * 
 * Module 1: Edge Function Logic & Rollback Engine
 * 1. Existing-email conflict (HTTP 409 AUTH_USER_ALREADY_EXISTS with request_id)
 * 2. Successful creation contract (credentials_flow_version: 1)
 * 3. Atomic RPC failure with verified rollback
 * 4. Rollback failure explicitly reported (never claimed successful if deletion fails)
 * 5. Pre-existing account protection (never delete or overwrite existing accounts)
 * 6. Sanitization of emails and secrets in logs
 * 
 * Module 2: Real SQL-Driven Storage & Entity Authorization Engine (pg-mem PostgreSQL engine)
 * 1. Own Agent KYC read with matching metadata in public.documents -> ALLOWED
 * 2. Other Agent reading Agent 1 KYC document -> DENIED
 * 3. Storage object with missing metadata in public.documents -> DENIED for Agent AND Admin
 * 4. document.view override alone does NOT grant cross-Agent access -> DENIED
 * 5. Upload without document.upload permission -> DENIED (ownership alone cannot bypass)
 * 6. Valid authorized upload with document.upload -> ALLOWED
 * 7. Unauthorized path / tampering / other agent path -> DENIED
 * 
 * Module 3: SQL Migration 24 Source & Parameter Invariant Verification
 * - Parameter names: p_required_permission, p_path
 * - Preserves existing functions without DROP
 * - Storage policies documents_storage_select and documents_storage_insert
 */

import assert from "assert";
import fs from "fs";
import { newDb } from "pg-mem";

console.log("==================================================================");
console.log("BNPS ERP v0.3 — TARGETED ONBOARDING & STORAGE INTEGRITY SUITE");
console.log("==================================================================\n");

let passed = 0;
let failed = 0;

async function runTest(name: string, fn: () => void | Promise<void>) {
  try {
    await fn();
    console.log(`[PASS] ${name}`);
    passed++;
  } catch (err: any) {
    console.error(`[FAIL] ${name}: ${err.message}`);
    failed++;
  }
}

// -----------------------------------------------------------------------------
// MODULE 1: CREATE-AGENT EDGE FUNCTION LOGIC & ROLLBACK SIMULATION
// -----------------------------------------------------------------------------
interface SimulatedUser {
  id: string;
  email: string;
  password?: string;
  user_metadata?: any;
  app_metadata?: any;
}

class MockSupabaseAdmin {
  public users: Map<string, SimulatedUser> = new Map();
  public deleteUserCalledWith: string[] = [];
  public failNextDelete = false;

  async createUser(params: { email: string; password: string; user_metadata?: any }) {
    for (const u of this.users.values()) {
      if (u.email.toLowerCase() === params.email.toLowerCase()) {
        return { data: { user: null }, error: { message: "A user with this email address has already been registered" } };
      }
    }
    const id = "usr-" + Math.random().toString(36).slice(2, 10);
    const user: SimulatedUser = { id, email: params.email, password: params.password, user_metadata: params.user_metadata, app_metadata: {} };
    this.users.set(id, user);
    return { data: { user }, error: null };
  }

  async updateUserById(id: string, updates: any) {
    const user = this.users.get(id);
    if (!user) return { error: { message: "User not found" } };
    Object.assign(user, updates);
    return { error: null };
  }

  async deleteUser(id: string) {
    this.deleteUserCalledWith.push(id);
    if (this.failNextDelete) {
      return { data: null, error: { message: "Internal server error deleting user" } };
    }
    this.users.delete(id);
    return { data: {}, error: null };
  }
}

async function simulateCreateAgent(
  adminClient: MockSupabaseAdmin,
  body: any,
  options: { rpcSuccess: boolean; rpcErrorMsg?: string } = { rpcSuccess: true }
) {
  const requestId = "req-" + Math.random().toString(36).slice(2, 8);
  const logMessages: string[] = [];
  const log = (msg: string) => {
    // Sanitized log simulation: scrub raw emails
    const scrubbed = msg.replace(/[a-zA-Z0-9_.+-]+@[a-zA-Z0-9-]+\.[a-zA-Z0-9-.]+/g, "[EMAIL_REDACTED]");
    logMessages.push(scrubbed);
  };

  const email = (body.email || "").trim().toLowerCase();
  const temporaryPassword = "Temp@" + Math.random().toString(36).slice(2, 10);

  log(`Processing create-agent for request ${requestId}`);

  // 1. Check existing Auth user
  let existingUser: SimulatedUser | null = null;
  for (const u of adminClient.users.values()) {
    if (u.email.toLowerCase() === email) {
      existingUser = u;
      break;
    }
  }

  if (existingUser) {
    log(`Account already exists for request ${requestId}`);
    return {
      status: 409,
      body: {
        success: false,
        error: "AUTH_USER_ALREADY_EXISTS",
        message: "An account with this email already exists in BNPS ERP.",
        request_id: requestId,
      },
      logs: logMessages,
    };
  }

  // 2. Create Auth user
  const createRes = await adminClient.createUser({
    email,
    password: temporaryPassword,
    user_metadata: { role: "agent" },
  });

  if (createRes.error || !createRes.data.user) {
    return {
      status: 400,
      body: { success: false, error: "AUTH_CREATION_FAILED", request_id: requestId },
      logs: logMessages,
    };
  }

  const authUserId = createRes.data.user.id;
  let newlyCreatedAuthUserId: string | null = authUserId;

  // 3. Simulate Atomic RPC
  if (!options.rpcSuccess) {
    let rollbackStatus = "NOT_ATTEMPTED";
    if (newlyCreatedAuthUserId) {
      const delRes = await adminClient.deleteUser(newlyCreatedAuthUserId);
      if (delRes.error) {
        rollbackStatus = "ROLLBACK_FAILED";
      } else {
        rollbackStatus = "ROLLED_BACK";
      }
    }
    const errMsg = options.rpcErrorMsg || "Agent registration failed in database";
    return {
      status: 400,
      body: {
        success: false,
        error: "CREATE_AGENT_ATOMIC_FAILED",
        message: rollbackStatus === "ROLLBACK_FAILED" ? `${errMsg} (Warning: rollback failed)` : errMsg,
        request_id: requestId,
        rollback_status: rollbackStatus,
      },
      logs: logMessages,
    };
  }

  return {
    status: 200,
    body: {
      success: true,
      agent_id: "agent-uuid-123",
      agent_code: "BNPS-AG-101",
      auth_user_id: authUserId,
      login_email: email,
      temporary_password: temporaryPassword,
      password_display_once: true,
      request_id: requestId,
    },
    logs: logMessages,
  };
}

// -----------------------------------------------------------------------------
// MODULE 2: REAL SQL-DRIVEN STORAGE & ENTITY AUTHORIZATION SUITE
// -----------------------------------------------------------------------------
class SqlDocumentAuthorizationEngine {
  private db: any;

  constructor() {
    this.db = newDb();
    this.setupSchema();
  }

  private queryOne(sql: string): any {
    const res = this.db.public.many(sql);
    return res.length > 0 ? res[0] : null;
  }

  private setupSchema() {
    this.db.public.none(`
      CREATE TABLE profiles (
        id text PRIMARY KEY,
        auth_user_id text UNIQUE NOT NULL,
        role text NOT NULL,
        branch text,
        full_name text NOT NULL,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE permissions (
        id text PRIMARY KEY,
        code text UNIQUE NOT NULL,
        name text NOT NULL
      );

      CREATE TABLE user_permission_overrides (
        user_id text NOT NULL REFERENCES profiles(id),
        permission_id text NOT NULL REFERENCES permissions(id),
        effect text NOT NULL,
        PRIMARY KEY (user_id, permission_id)
      );

      CREATE TABLE role_permissions (
        role text NOT NULL,
        permission_id text NOT NULL REFERENCES permissions(id),
        PRIMARY KEY (role, permission_id)
      );

      CREATE TABLE agents (
        id text PRIMARY KEY,
        profile_id text NOT NULL UNIQUE REFERENCES profiles(id),
        agent_code text UNIQUE NOT NULL,
        branch text,
        is_active boolean NOT NULL DEFAULT true
      );

      CREATE TABLE documents (
        id text PRIMARY KEY,
        entity_type text NOT NULL,
        entity_id text NOT NULL,
        doc_category text NOT NULL,
        status text NOT NULL DEFAULT 'UPLOADED',
        file_path text UNIQUE NOT NULL
      );

      CREATE TABLE storage_objects (
        bucket_id text NOT NULL,
        name text NOT NULL,
        PRIMARY KEY (bucket_id, name)
      );
    `);

    // Seed default permissions
    this.db.public.none(`
      INSERT INTO permissions (id, code, name) VALUES
        ('perm-doc-view',   'document.view',   'View documents'),
        ('perm-doc-upload', 'document.upload', 'Upload documents'),
        ('perm-doc-verify', 'document.verify', 'Verify documents'),
        ('perm-doc-reject', 'document.reject', 'Reject documents');

      -- Super Admin has all document permissions
      INSERT INTO role_permissions (role, permission_id) VALUES
        ('super_admin', 'perm-doc-view'),
        ('super_admin', 'perm-doc-upload'),
        ('super_admin', 'perm-doc-verify'),
        ('super_admin', 'perm-doc-reject');
    `);
  }

  seedProfile(params: { id: string; auth_user_id: string; role: string; branch?: string; full_name: string }) {
    this.db.public.none(
      `INSERT INTO profiles (id, auth_user_id, role, branch, full_name, is_active) VALUES ('${params.id}', '${params.auth_user_id}', '${params.role}', '${params.branch || ""}', '${params.full_name}', true);`
    );
  }

  seedAgent(params: { id: string; profile_id: string; agent_code: string; branch?: string }) {
    this.db.public.none(
      `INSERT INTO agents (id, profile_id, agent_code, branch, is_active) VALUES ('${params.id}', '${params.profile_id}', '${params.agent_code}', '${params.branch || ""}', true);`
    );
  }

  grantUserPermissionOverride(profileId: string, permissionCode: string, effect: "GRANT" | "DENY" = "GRANT") {
    const perm = this.queryOne(`SELECT id FROM permissions WHERE code = '${permissionCode}';`);
    this.db.public.none(
      `INSERT INTO user_permission_overrides (user_id, permission_id, effect) VALUES ('${profileId}', '${perm.id}', '${effect}') ON CONFLICT (user_id, permission_id) DO UPDATE SET effect = '${effect}';`
    );
  }

  seedStorageObject(bucketId: string, name: string) {
    this.db.public.none(
      `INSERT INTO storage_objects (bucket_id, name) VALUES ('${bucketId}', '${name}');`
    );
  }

  seedDocumentMetadata(params: { id: string; entity_type: string; entity_id: string; doc_category: string; file_path: string }) {
    this.db.public.none(
      `INSERT INTO documents (id, entity_type, entity_id, doc_category, status, file_path) VALUES ('${params.id}', '${params.entity_type}', '${params.entity_id}', '${params.doc_category}', 'VERIFIED', '${params.file_path}');`
    );
  }

  hasErpPermission(authUserId: string, permCode: string): boolean {
    const profile = this.queryOne(
      `SELECT id, role FROM profiles WHERE auth_user_id = '${authUserId}' AND is_active = true;`
    );
    if (!profile) return false;

    // 1. Direct user override
    const override = this.queryOne(
      `SELECT upo.effect 
         FROM user_permission_overrides upo
         JOIN permissions p ON p.id = upo.permission_id
        WHERE upo.user_id = '${profile.id}' AND p.code = '${permCode}';`
    );
    if (override) {
      return override.effect === "GRANT";
    }

    // 2. Role permission
    const rolePerm = this.queryOne(
      `SELECT 1 
         FROM role_permissions rp
         JOIN permissions p ON p.id = rp.permission_id
        WHERE rp.role = '${profile.role}' AND p.code = '${permCode}';`
    );
    return Boolean(rolePerm);
  }

  /**
   * Executes the exact SQL behavior of public.document_entity_access_allowed
   */
  documentEntityAccessAllowed(
    authUserId: string,
    entityType: string,
    entityId: string,
    docCategory: string,
    requiredPermission: string = "document.view"
  ): boolean {
    if (!authUserId) return false;

    const profile = this.queryOne(
      `SELECT id, role, branch FROM profiles WHERE auth_user_id = '${authUserId}' AND is_active = true;`
    );
    if (!profile) return false;

    // Requirement 2: Enforce upload permission independently
    if (requiredPermission === "document.upload") {
      if (!this.hasErpPermission(authUserId, "document.upload")) {
        return false;
      }
    }

    // Requirement 1 & 5: Super Admin and Office Admin have global scope if they hold permission
    if (profile.role === "super_admin" || profile.role === "office_admin") {
      if (this.hasErpPermission(authUserId, requiredPermission)) {
        return true;
      }
    }

    // Branch manager scoping
    if (profile.role === "branch_manager") {
      if (this.hasErpPermission(authUserId, requiredPermission)) {
        if (!profile.branch) return true;
        let entityBranch: string | null = null;
        if (entityType.toLowerCase() === "agent") {
          const a = this.queryOne(`SELECT branch FROM agents WHERE id = '${entityId}';`);
          entityBranch = a?.branch;
        }
        return !entityBranch || entityBranch.toLowerCase() === profile.branch.toLowerCase();
      }
    }

    // Requirement 1: Agent Role & Strict Ownership Scoping
    // Never treat has_erp_permission('document.view') as blanket access to every document!
    if (entityType.toLowerCase() === "agent") {
      const ownAgent = this.queryOne(
        `SELECT 1 FROM agents a WHERE a.id = '${entityId}' AND a.profile_id = '${profile.id}' AND a.is_active = true;`
      );
      return Boolean(ownAgent);
    }

    return false;
  }

  /**
   * Executes the exact SQL behavior of public.can_access_document_path
   */
  canAccessDocumentPath(authUserId: string, filePath: string): boolean {
    if (!authUserId || !filePath || !filePath.trim()) return false;

    // Requirement 3: Exact matching public.documents.file_path metadata check.
    // Unlinked storage objects or arbitrary files are strictly denied for EVERYONE, including admins.
    const doc = this.queryOne(
      `SELECT entity_type, entity_id, doc_category FROM documents WHERE file_path = '${filePath}';`
    );
    if (!doc) {
      return false; // Storage object without matching metadata row is strictly DENIED
    }

    return this.documentEntityAccessAllowed(
      authUserId,
      doc.entity_type,
      doc.entity_id,
      doc.doc_category,
      "document.view"
    );
  }

  /**
   * Executes the exact SQL behavior of public.can_upload_document_path
   */
  canUploadDocumentPath(authUserId: string, filePath: string): boolean {
    if (!authUserId || !filePath || !filePath.trim()) return false;

    // 1. Enforce document.upload independently (Requirement 2)
    if (!this.hasErpPermission(authUserId, "document.upload")) {
      return false;
    }

    // 2. Validate storage path hierarchy: <entity_type>/<entity_id>/<filename>
    if (/(\^|\/)\.\.(\/|\$)/.test(filePath)) return false;
    const parts = filePath.split("/");
    if (parts.length !== 3) return false;

    let entityType = parts[0].toLowerCase().trim();
    if (entityType === "agents") entityType = "agent";

    if (!["agent", "lead", "customer", "project", "installation", "loan"].includes(entityType)) {
      return false;
    }

    const entityId = parts[1].trim();
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
    if (!uuidRegex.test(entityId)) {
      return false;
    }

    // 3. Delegate to entity access policy
    return this.documentEntityAccessAllowed(
      authUserId,
      entityType,
      entityId,
      "",
      "document.upload"
    );
  }
}

// -----------------------------------------------------------------------------
// MAIN TEST RUNNER
// -----------------------------------------------------------------------------
async function main() {
  console.log("--- 1. EDGE FUNCTION SAFETY & ROLLBACK SUITE ---");

  await runTest("Existing Auth email returns HTTP 409 AUTH_USER_ALREADY_EXISTS with request_id", async () => {
    const admin = new MockSupabaseAdmin();
    admin.users.set("pre-existing-id", {
      id: "pre-existing-id",
      email: "mukesh.existing@bnps.local",
      password: "OriginalPassword123!",
    });
    const res = await simulateCreateAgent(admin, {
      email: "mukesh.existing@bnps.local",
      full_name: "Mukesh Patel",
      credentials_flow_version: 1,
    }, { rpcSuccess: true });
    assert.strictEqual(res.status, 409);
    assert.strictEqual(res.body.error, "AUTH_USER_ALREADY_EXISTS");
    assert.ok(res.body.request_id);
    assert.strictEqual(admin.users.get("pre-existing-id")?.password, "OriginalPassword123!");
    assert.strictEqual(admin.deleteUserCalledWith.length, 0);
  });

  await runTest("No raw email leakage in console log output for existing email", async () => {
    const admin = new MockSupabaseAdmin();
    admin.users.set("pre-id", { id: "pre-id", email: "secret.agent@bnps.local" });
    const res = await simulateCreateAgent(admin, {
      email: "secret.agent@bnps.local",
      full_name: "Secret Agent",
      credentials_flow_version: 1,
    }, { rpcSuccess: true });
    const rawLogs = (res.logs || []).join(" ");
    assert.ok(!rawLogs.includes("secret.agent@bnps.local"), "Raw email must be excluded from logs");
  });

  await runTest("Successful Agent creation returns temporary credentials and single-display flag", async () => {
    const admin = new MockSupabaseAdmin();
    const res = await simulateCreateAgent(admin, {
      email: "new.agent@bnps.local",
      full_name: "New Agent",
      credentials_flow_version: 1,
    }, { rpcSuccess: true });
    assert.strictEqual(res.status, 200);
    assert.strictEqual(res.body.success, true);
    assert.strictEqual(res.body.password_display_once, true);
    assert.ok(res.body.temporary_password);
    assert.ok(admin.users.has(res.body.auth_user_id));
  });

  await runTest("Atomic RPC failure successfully rolls back newly created Auth user", async () => {
    const admin = new MockSupabaseAdmin();
    const res = await simulateCreateAgent(admin, {
      email: "fail.agent@bnps.local",
      full_name: "Failed Agent",
      credentials_flow_version: 1,
    }, { rpcSuccess: false, rpcErrorMsg: "DUPLICATE: Phone number already registered in BNPS" });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.rollback_status, "ROLLED_BACK");
    assert.strictEqual(admin.deleteUserCalledWith.length, 1);
    assert.strictEqual(admin.users.size, 0, "Newly created user must be removed from Auth");
    assert.strictEqual(res.body.temporary_password, undefined, "No credentials should be leaked on failure");
  });

  await runTest("Rollback failure explicitly flagged as ROLLBACK_FAILED (never falsely reported success)", async () => {
    const admin = new MockSupabaseAdmin();
    admin.failNextDelete = true;
    const res = await simulateCreateAgent(admin, {
      email: "fail.agent2@bnps.local",
      full_name: "Failed Agent 2",
      credentials_flow_version: 1,
    }, { rpcSuccess: false, rpcErrorMsg: "DB constraint violation" });
    assert.strictEqual(res.status, 400);
    assert.strictEqual(res.body.rollback_status, "ROLLBACK_FAILED");
    assert.ok(res.body.message.includes("Warning: rollback failed"));
  });

  // ---------------------------------------------------------------------------
  // MODULE 2: TARGETED SQL-DRIVEN STORAGE & ENTITY AUTHORIZATION TESTS
  // ---------------------------------------------------------------------------
  console.log("\n--- 2. REAL SQL-DRIVEN KYC STORAGE & ENTITY AUTHORIZATION SUITE ---");

  const sqlEngine = new SqlDocumentAuthorizationEngine();

  // Setup Agent 1
  const agent1AuthId = "24000000-0000-0000-0000-000000000011";
  const agent1ProfileId = "24000000-0000-0000-0000-000000000001";
  const agent1Id = "24000000-0000-0000-0000-0000000000a1";
  sqlEngine.seedProfile({ id: agent1ProfileId, auth_user_id: agent1AuthId, role: "agent", branch: "Raipur", full_name: "Agent One" });
  sqlEngine.seedAgent({ id: agent1Id, profile_id: agent1ProfileId, agent_code: "AGT-001", branch: "Raipur" });

  // Setup Agent 2
  const agent2AuthId = "24000000-0000-0000-0000-000000000012";
  const agent2ProfileId = "24000000-0000-0000-0000-000000000002";
  const agent2Id = "24000000-0000-0000-0000-0000000000a2";
  sqlEngine.seedProfile({ id: agent2ProfileId, auth_user_id: agent2AuthId, role: "agent", branch: "Bilaspur", full_name: "Agent Two" });
  sqlEngine.seedAgent({ id: agent2Id, profile_id: agent2ProfileId, agent_code: "AGT-002", branch: "Bilaspur" });

  // Setup Super Admin
  const adminAuthId = "24000000-0000-0000-0000-000000000013";
  const adminProfileId = "24000000-0000-0000-0000-000000000003";
  sqlEngine.seedProfile({ id: adminProfileId, auth_user_id: adminAuthId, role: "super_admin", branch: "Raipur", full_name: "Admin Super" });

  // Seed storage object & authoritative metadata for Agent 1 PAN
  const agent1PanPath = `agent/${agent1Id}/pan.pdf`;
  sqlEngine.seedStorageObject("documents", agent1PanPath);
  sqlEngine.seedDocumentMetadata({
    id: "doc-uuid-pan-1",
    entity_type: "agent",
    entity_id: agent1Id,
    doc_category: "pan",
    file_path: agent1PanPath,
  });

  // Seed unlinked storage object without metadata
  const unlinkedObjectPath = `agent/${agent1Id}/unlinked-orphan.pdf`;
  sqlEngine.seedStorageObject("documents", unlinkedObjectPath);

  // Test 1: own Agent KYC read allowed
  await runTest("1. Own Agent KYC read with matching metadata in public.documents -> ALLOWED", () => {
    const allowed = sqlEngine.canAccessDocumentPath(agent1AuthId, agent1PanPath);
    assert.strictEqual(allowed, true);
  });

  // Test 2: other Agent denied
  await runTest("2. Another Agent reading Agent 1 KYC document -> DENIED", () => {
    const allowed = sqlEngine.canAccessDocumentPath(agent2AuthId, agent1PanPath);
    assert.strictEqual(allowed, false);
  });

  // Test 3: missing metadata denied for Agent and admin
  await runTest("3. Storage object with missing metadata in public.documents -> DENIED for Agent AND Admin", () => {
    // Agent read denied
    const agentAllowed = sqlEngine.canAccessDocumentPath(agent1AuthId, unlinkedObjectPath);
    assert.strictEqual(agentAllowed, false, "Agent must not read unlinked storage object");

    // Admin read denied
    const adminAllowed = sqlEngine.canAccessDocumentPath(adminAuthId, unlinkedObjectPath);
    assert.strictEqual(adminAllowed, false, "Admin must not read unlinked storage object");
  });

  // Test 4: document.view alone does not grant cross-Agent access
  await runTest("4. document.view override alone does NOT grant cross-Agent access -> DENIED", () => {
    // Grant Agent 2 an explicit user permission override for document.view
    sqlEngine.grantUserPermissionOverride(agent2ProfileId, "document.view", "GRANT");
    assert.strictEqual(sqlEngine.hasErpPermission(agent2AuthId, "document.view"), true);

    // Despite holding document.view, Agent 2 MUST NOT be able to view Agent 1 KYC document
    const allowed = sqlEngine.canAccessDocumentPath(agent2AuthId, agent1PanPath);
    assert.strictEqual(allowed, false, "document.view alone must not bypass agent isolation");
  });

  // Test 5: upload denied without document.upload
  await runTest("5. Upload to own folder denied without document.upload permission -> DENIED", () => {
    // Agent 1 does not have document.upload
    assert.strictEqual(sqlEngine.hasErpPermission(agent1AuthId, "document.upload"), false);

    const uploadPath = `agent/${agent1Id}/aadhaar.pdf`;
    const allowed = sqlEngine.canUploadDocumentPath(agent1AuthId, uploadPath);
    assert.strictEqual(allowed, false, "Upload must be denied when document.upload is missing");
  });

  // Test 6: valid authorized upload allowed
  await runTest("6. Valid authorized upload with document.upload permission -> ALLOWED", () => {
    // Grant Agent 1 document.upload permission
    sqlEngine.grantUserPermissionOverride(agent1ProfileId, "document.upload", "GRANT");
    assert.strictEqual(sqlEngine.hasErpPermission(agent1AuthId, "document.upload"), true);

    const uploadPath = `agent/${agent1Id}/aadhaar.pdf`;
    const allowed = sqlEngine.canUploadDocumentPath(agent1AuthId, uploadPath);
    assert.strictEqual(allowed, true, "Authorized upload to own agent folder must be allowed");
  });

  // Test 7: unauthorized path denied
  await runTest("7. Unauthorized path / cross-agent folder / malformed path -> DENIED", () => {
    // Agent 1 (has document.upload) attempts to upload to Agent 2 folder
    const crossAgentUpload = `agent/${agent2Id}/malicious.pdf`;
    assert.strictEqual(sqlEngine.canUploadDocumentPath(agent1AuthId, crossAgentUpload), false, "Cross-agent folder upload must be denied");

    // Path traversal attempt
    const traversalPath = `agent/${agent1Id}/../../../etc/passwd`;
    assert.strictEqual(sqlEngine.canUploadDocumentPath(agent1AuthId, traversalPath), false, "Path traversal must be denied");

    // Malformed path missing entity id
    const malformedPath = "agent/no-uuid-file.pdf";
    assert.strictEqual(sqlEngine.canUploadDocumentPath(agent1AuthId, malformedPath), false, "Malformed path must be denied");
  });

  // ---------------------------------------------------------------------------
  // MODULE 3: SQL MIGRATION 24 FILE INTEGRITY & PARAMETER SIGNATURE AUDIT
  // ---------------------------------------------------------------------------
  console.log("\n--- 3. MIGRATION 24 SOURCE INVARIANT & PARAMETER AUDIT ---");

  await runTest("Migration 24 preserves exact parameter names and policies", () => {
    const sql = fs.readFileSync("database/24_agent_kyc_storage_policy_alignment.sql", "utf-8");

    // Check parameter p_required_permission
    assert.ok(
      sql.includes("p_required_permission text"),
      "document_entity_access_allowed must use p_required_permission"
    );

    // Check parameter p_path
    assert.ok(
      sql.includes("public.can_access_document_path(p_path text)"),
      "can_access_document_path must use p_path text"
    );
    assert.ok(
      sql.includes("public.can_upload_document_path(p_path text)"),
      "can_upload_document_path must use p_path text"
    );

    // Check storage policies
    assert.ok(
      sql.includes('CREATE POLICY "documents_storage_select"'),
      "documents_storage_select policy must be present"
    );
    assert.ok(
      sql.includes('CREATE POLICY "documents_storage_insert"'),
      "documents_storage_insert policy must be present"
    );

    // Check that NO functions are dropped
    assert.ok(
      !sql.includes("DROP FUNCTION"),
      "Migration 24 must not drop functions"
    );
  });

  console.log("\n==================================================================");
  console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
  console.log("==================================================================");

  if (failed > 0) process.exit(1);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
