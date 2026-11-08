// Applied product decisions (plan/04-open-questions.md, 04-answers-form.md, APPLIED-DECISIONS.md).
// Configurable values belong in game_config/env; do not hardcode secrets in source.

export const DECISIONS = {
  badgePayload: "SA1|<6digits>|<name>|<roleLetter>",
  auth: {
    mode: "aurak_email_plus_pin" as const,
    emailDomain: "aurak.ac.ae",
    pinLength: 6,
    storeCharacterDataInMainApp: false,
    mainAppPii: "minimal_email_id_for_management_only",
    deleteAllDataImmediatelyAfterEvent: true,
  },
  intake: {
    source: "microsoft_forms",
    separateRoleBuilder: true,
    roleBuilderPath: "../role-builder",
    roleAssignment: "random_with_template_customization",
    bioAffectsEvent: false,
  },
  patrons: {
    areStudents: true,
    competeOnSameBoard: true,
    // A4: reduced (computed default). Cross-faction patron scan: 3 (init) + 2 (cross) + 1 (patron) = 6 base.
    // Patron Touch (B8 adjusted): first 3 patron scans/week = +3 bonus each; next 3 = +1; then 0.
    scanPatronBaseBonus: 1, // was +2 in source plan
    patronTouch: { tier1Uses: 3, tier1Bonus: 3, tier2Uses: 3, tier2Bonus: 1 },
  },
  dates: {
    timezone: "Asia/Dubai",
    startDate: "2026-11-16", // A5
    closingDate: "2026-11-23", // Monday, closing session (A5)
    weekendTrackStart: "2026-11-21", // configurable assumption (weekend before Monday)
    lockAt: null, // set when known
    configurable: true,
  },
  connectivity: { venue: "university_wifi_reliable", aggressiveOffline: false, keepIdempotency: true },
  commercial: { freeEvent: true, nonWebsiteBudget: true },
  admin: {
    gameWardensPortal: true,
    // A8 (recommended): unguessable secret path/token via env + admin login required.
    hiddenPortalLink: true,
    hiddenAccessMode: "env_secret_path_plus_admin_login" as const,
    adminLoginRequired: true,
    bootstrapUserCanAddUsers: true,
    allFieldsManageable: true,
  },
  badgePrinting: { feasible: true, detailsPending: true },
  prizes: { cashTbd: true },
  retention: { deleteImmediatelyAfterEvent: true, exportBeforeDelete: true },
  rules: {
    patronCrossFactionStacks: true, // B1
    patronScanBonus: 1, // A4 reduced
    dayEndsAt: "00:00", // B2 override
  },
  ops: { accountOwner: "author_main_admin", presentationDualDeviceControl: true },
} as const;
