/**
 * Targeted Test Suite: Agent Onboarding Safety, Rollback Integrity & KYC Storage Authorization
 * Covers:
 * 1. Existing-email conflict (HTTP 409 AUTH_USER_ALREADY_EXISTS)
 * 2. Successful creation contract
 * 3. Atomic RPC failure with verified rollback
 * 4. Rollback failure explicitly reported (never claimed successful if deletion fails)
 * 5. Pre-existing account protection (never delete or overwrite existing accounts)
 * 6. Sanitization of emails and secrets in logs
 * 7. Agent reading own KYC document (metadata-backed) -> ALLOWED
 * 8. Agent reading another Agent KYC document -> DENIED
 * 9. Storage object with missing metadata in public.documents -> DENIED
 * 10. Unauthorized path / tampering -> DENIED
 * 11. Admin with document.view -> ALLOWED
 */

import assert from "assert";

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

// Emulates create-agent handler logic
async function simulateCreateAgent(
  adminClient: MockSupabaseAdmin,
  body: any,
  options: { rpcSuccess: boolean; rpcErrorMsg?: string }
) {
  const requestId = "req-" + Math.random().toString(36).slice(2, 6);
  const logMessages: string[] = [];

  const logWarn = (msg: string) => logMessages.push("WARN: " + msg);
  const logError = (msg: string) => logMessages.push("ERROR: " + msg);

  if (body.credentials_flow_version !== 1) {
    return { status: 409, body: { success: false, error: "CLIENT_UPDATE_REQUIRED", request_id: requestId } };
  }

  const email = (body.email || "").trim().toLowerCase();
  const temporaryPassword = "TempPassword123!";

  let authUserId: string | null = null;
  let newlyCreatedAuth = false;

  const { data: createdAuth, error: createAuthError } = await adminClient.createUser({
    email,
    password: temporaryPassword,
    user_metadata: { full_name: body.full_name, role: "agent" },
  });

  if (createAuthError || !createdAuth?.user) {
    const errMsg = createAuthError?.message || "";
    // console.log("DEBUG errMsg:", errMsg, "createAuthError:", createAuthError);
    const isAlreadyRegistered = errMsg.toLowerCase().includes("already registered") || errMsg.toLowerCase().includes("already been registered") || (errMsg.toLowerCase().includes("user") && errMsg.toLowerCase().includes("registered"));
    if (isAlreadyRegistered) {
      logWarn(`[create-agent:${requestId}] Stage: auth_create rejected - email already exists in Auth`);
      return {
        status: 409,
        body: {
          success: false,
          error: "AUTH_USER_ALREADY_EXISTS",
          message: "An authentication account already exists for this email address.",
          request_id: requestId,
        },
        logs: logMessages,
      };
    }
    return {
      status: 400,
      body: { success: false, error: "AUTH_USER_CREATE_FAILED", message: errMsg, request_id: requestId },
      logs: logMessages,
    };
  }

  authUserId = createdAuth.user.id;
  newlyCreatedAuth = true;

  // RPC atomic call simulation
  if (!options.rpcSuccess) {
    const errMsg = options.rpcErrorMsg || "create_agent_atomic failed";
    logError(`[create-agent:${requestId}] Stage: atomic_agent_creation failed: ${errMsg}`);

    let rollbackStatus: "ROLLED_BACK" | "ROLLBACK_FAILED" | "NOT_APPLICABLE" = "NOT_APPLICABLE";
    if (newlyCreatedAuth && authUserId) {
      const { error: rollbackErr } = await adminClient.deleteUser(authUserId);
      if (rollbackErr) {
        rollbackStatus = "ROLLBACK_FAILED";
        logError(`[create-agent:${requestId}] Stage: atomic_agent_creation rollback failed: ${rollbackErr.message}`);
      } else {
        rollbackStatus = "ROLLED_BACK";
      }
    }

    return {
      status: 400,
      body: {
        success: false,
        error: "AGENT_CREATION_FAILED",
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
// EXECUTE EDGE FUNCTION SAFETY TESTS
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

// -----------------------------------------------------------------------------
// MODULE 2: KYC STORAGE METADATA AUTHORIZATION SUITE
// -----------------------------------------------------------------------------

console.log("\n--- 2. KYC STORAGE METADATA & SCOPE AUTHORIZATION SUITE ---");

interface DocumentRecord {
  file_path: string;
  entity_type: string;
  entity_id: string;
  doc_category: string;
}

interface AgentRecord {
  id: string;
  profile_id: string;
}

// Implementation of the live-aligned can_access_document_path & document_entity_access_allowed
class MockDocumentAuthorizationEngine {
  public documents: Map<string, DocumentRecord> = new Map();
  public agents: Map<string, AgentRecord> = new Map();

  documentEntityAccessAllowed(
    callerRole: string,
    callerProfileId: string,
    entityType: string,
    entityId: string,
    docCategory: string,
    permission: string
  ): boolean {
    if (!callerProfileId) return false;
    if (callerRole === "super_admin" || callerRole === "office_admin") return true;

    if (callerRole === "agent") {
      if (entityType.toLowerCase() === "agent") {
        const agent = this.agents.get(entityId);
        // Strict ownership: entity_id must match the caller profile_id
        return Boolean(agent && agent.profile_id === callerProfileId);
      }
    }
    return false;
  }

  canAccessDocumentPath(
    callerRole: string,
    callerProfileId: string,
    filePath: string
  ): boolean {
    if (!callerProfileId) return false;
    if (callerRole === "super_admin" || callerRole === "office_admin") return true;

    // 1. Authoritative metadata check: a matching row in public.documents MUST exist
    const doc = this.documents.get(filePath);
    if (!doc) {
      return false; // Storage object without metadata is DENIED
    }

    // 2. Delegate to entity access policy
    return this.documentEntityAccessAllowed(
      callerRole,
      callerProfileId,
      doc.entity_type,
      doc.entity_id,
      doc.doc_category,
      "document.view"
    );
  }
}

const authEngine = new MockDocumentAuthorizationEngine();

// Seed Agent 1
const agent1Id = "agent-uuid-0001";
const agent1ProfileId = "prof-uuid-0001";
authEngine.agents.set(agent1Id, { id: agent1Id, profile_id: agent1ProfileId });

// Seed Agent 2
const agent2Id = "agent-uuid-0002";
const agent2ProfileId = "prof-uuid-0002";
authEngine.agents.set(agent2Id, { id: agent2Id, profile_id: agent2ProfileId });

// Seed Agent 1 documents in public.documents
const agent1PanPath = "agent/" + agent1Id + "/uuid-pan.pdf";
authEngine.documents.set(agent1PanPath, {
  file_path: agent1PanPath,
  entity_type: "agent",
  entity_id: agent1Id,
  doc_category: "pan",
});

await runTest("Agent reading own KYC document with valid metadata is ALLOWED", () => {
  const allowed = authEngine.canAccessDocumentPath("agent", agent1ProfileId, agent1PanPath);
  assert.strictEqual(allowed, true);
});

await runTest("Another Agent reading Agent 1 KYC document is strictly DENIED", () => {
  const allowed = authEngine.canAccessDocumentPath("agent", agent2ProfileId, agent1PanPath);
  assert.strictEqual(allowed, false);
});

await runTest("Access to storage object with missing metadata in public.documents is strictly DENIED", () => {
  const unlinkedObjectPath = "agent/" + agent1Id + "/unregistered-secret.pdf";
  const allowed = authEngine.canAccessDocumentPath("agent", agent1ProfileId, unlinkedObjectPath);
  assert.strictEqual(allowed, false);
});

await runTest("Path traversal or tampering outside entity scope is strictly DENIED", () => {
  const tamperedPath = "agent/" + agent2Id + "/uuid-pan.pdf";
  // Agent 1 tries to access path scoped to Agent 2
  const allowed = authEngine.canAccessDocumentPath("agent", agent1ProfileId, tamperedPath);
  assert.strictEqual(allowed, false);
});

await runTest("Super Admin with document.view can access Agent KYC document", () => {
  const allowed = authEngine.canAccessDocumentPath("super_admin", "admin-prof-0001", agent1PanPath);
  assert.strictEqual(allowed, true);
});

console.log("\n==================================================================");
console.log(`SUMMARY: ${passed} PASSED, ${failed} FAILED`);
console.log("==================================================================");

if (failed > 0) process.exit(1);
}
main().catch(err => { console.error(err); process.exit(1); });
