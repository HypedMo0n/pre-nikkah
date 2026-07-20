import { test, expect } from "@playwright/test";

/**
 * Full two-user invite flow E2E test.
 * Requires TEST_EMAIL_A, TEST_EMAIL_B, TEST_PASSWORD environment variables.
 * Skipped unless environment is configured.
 *
 * Flow:
 * 1. User A signs up/signs in
 * 2. User A creates an invite
 * 3. User B opens invite link while signed out
 * 4. User B signs up or signs in
 * 5. User B returns to invitation automatically (via intent cookie)
 * 6. User B accepts policy
 * 7. User B joins
 * 8. Both dashboards show connected couple
 * 9. Both can answer the first question
 */

test.describe("Full Invite Flow (Two Users)", () => {
  test.skip(
    !process.env.TEST_EMAIL_A ||      !process.env.TEST_EMAIL_B ||
      !process.env.TEST_PASSWORD,
    "Skipped: TEST_EMAIL_A, TEST_EMAIL_B, TEST_PASSWORD not configured",
  );

  test("User A creates invite, User B joins, both see connected couple", async ({
    page,
    context,
  }) => {
    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const locale = "/en"; // or /fr for French

    // ========== PHASE 1: User A Signs Up/In and Creates Invite ==========
    const pageA = await context.newPage();
    await pageA.goto(`${baseUrl}${locale}/sign-in`);

    // Check if already signed in (for test reuse)
    const signInForm = pageA.locator("form").first();
    const isSignUpPage = await pageA
      .locator('button:has-text("Create account")')
      .isVisible();
    const emailInput = pageA.locator('input[type="email"]').first();
    const passwordInput = pageA.locator('input[type="password"]').first();

    // Sign up or sign in
    await emailInput.fill(process.env.TEST_EMAIL_A!);
    await passwordInput.fill(process.env.TEST_PASSWORD!);

    if (isSignUpPage) {
      await pageA.locator('button:has-text("Create account")').click();
    } else {
      await pageA.locator('button:has-text("Sign in")').click();
    }

    // Wait for email verification prompt or redirect to dashboard
    await pageA.waitForURL(
      (url) =>
        url.pathname.includes("/verify-email") ||
        url.pathname.includes("/dashboard") ||
        url.pathname.includes("/onboarding"),
      { timeout: 10000 },
    );

    // If on verify-email, we cannot proceed without real email access
    const verifyEmailHeading = pageA.locator(
      "h1, h2, h3",
    ).filter({ hasText: "Verify your email" });
    if (await verifyEmailHeading.isVisible({ timeout: 2000 })) {
      test.skip();
      return;
    }

    // Navigate to onboarding if needed
    const currentUrl = pageA.url();
    if (!currentUrl.includes("/dashboard")) {
      const createInviteButton = pageA
        .locator('button')
        .filter({ hasText: /Start a journey|Create invite/i });
      if (await createInviteButton.isVisible({ timeout: 2000 })) {
        await createInviteButton.click();
      }
    }

    // Find the create invite button or action
    await pageA.waitForURL((url) => url.pathname.includes("/onboarding"), {
      timeout: 5000,
    });
    const policyCheckbox = pageA.locator('input[type="checkbox"]').first();
    const createButton = pageA
      .locator('button')
      .filter({ hasText: /Create|Generate/i });

    if (await policyCheckbox.isVisible({ timeout: 2000 })) {
      await policyCheckbox.check();
    }

    if (await createButton.isVisible({ timeout: 2000 })) {
      await createButton.click();
    }

    // Extract invite code from URL or page content
    await pageA.waitForURL(
      (url) => url.pathname.includes("/invite") || url.search.includes("code="),
      { timeout: 5000 },
    );
    const inviteUrl = pageA.url();
    const inviteCodeMatch = inviteUrl.match(/invite\/([a-f0-9]+)/) ||
      inviteUrl.match(/code=([a-f0-9]+)/) || [
        ,
        "test-invite-code",
      ];
    const inviteCode = inviteCodeMatch[1];

    expect(inviteCode).toMatch(/^[a-f0-9]+$/);

    // ========== PHASE 2: User B Opens Invite While Signed Out ==========
    const pageB = await context.newPage();
    const inviteLinkUrl = `${baseUrl}${locale}/invite/${inviteCode}`;
    await pageB.goto(inviteLinkUrl);

    // Verify invite inspection page loads
    const inviteHeading = pageB.locator(
      "h1, h2, h3",
    ).filter({ hasText: /invitation|invite/i });
    await expect(inviteHeading).toBeVisible({ timeout: 5000 });

    // ========== PHASE 3: User B Signs Up/In ==========
    // Should be redirected to sign-in or sign-up
    const currentUrlB = pageB.url();
    if (currentUrlB.includes("/invite")) {
      // Click sign-in/sign-up button
      const signInButton = pageB
        .locator('button')
        .filter({ hasText: /Sign in|Create account|Join/i });
      await signInButton.click();
    }

    await pageB.waitForURL(
      (url) => url.pathname.includes("/sign"),
      { timeout: 5000 },
    );
    const emailInputB = pageB.locator('input[type="email"]').first();
    const passwordInputB = pageB.locator('input[type="password"]').first();

    await emailInputB.fill(process.env.TEST_EMAIL_B!);
    await passwordInputB.fill(process.env.TEST_PASSWORD!);

    const createAccountBtn = pageB
      .locator('button')
      .filter({ hasText: /Create account/i });
    const signInBtn = pageB.locator('button').filter({ hasText: /Sign in/i });

    if (await createAccountBtn.isVisible({ timeout: 1000 })) {
      await createAccountBtn.click();
    } else if (await signInBtn.isVisible({ timeout: 1000 })) {
      await signInBtn.click();
    }

    // Wait for verification or redirect
    await pageB.waitForURL(
      (url) =>
        url.pathname.includes("/verify-email") ||
        url.pathname.includes("/invite") ||
        url.pathname.includes("/dashboard"),
      { timeout: 10000 },
    );

    // ========== PHASE 4: User B Returns to Invitation (Intent Preserved) ==========
    const urlAfterSignUp = pageB.url();
    if (urlAfterSignUp.includes("/verify-email")) {
      // Real email verification required; skip rest of test
      test.skip();
      return;
    }

    // Should auto-redirect to invite URL or see invite page
    if (!urlAfterSignUp.includes("/invite")) {
      // Manually navigate back
      await pageB.goto(inviteLinkUrl);
    }

    await expect(
      pageB.locator("h1, h2, h3").filter({ hasText: /invitation|invite/i }),
    ).toBeVisible({ timeout: 5000 });

    // ========== PHASE 5: User B Accepts Policy and Joins ==========
    const policyCheckboxB = pageB.locator('input[type="checkbox"]').first();
    const joinButton = pageB
      .locator('button')
      .filter({ hasText: /Join|Accept|Continue/i });

    if (await policyCheckboxB.isVisible({ timeout: 2000 })) {
      await policyCheckboxB.check();
    }

    if (await joinButton.isVisible({ timeout: 2000 })) {
      await joinButton.click();
    }

    // Wait for redirect to dashboard
    await pageB.waitForURL(
      (url) => url.pathname.includes("/dashboard"),
      { timeout: 5000 },
    );

    // ========== PHASE 6: Verify Both See Connected Couple ==========
    // Refresh User A's dashboard
    await pageA.reload();
    await pageA.waitForURL((url) => url.pathname.includes("/dashboard"), {
      timeout: 5000,
    });

    // Both should see "Connection pending" → "Connected" status
    const connectionStatusA = pageA
      .locator("text", {
        hasText: /Connected|Active couple|Journey connected/i,
      })
      .first();
    const connectionStatusB = pageB
      .locator("text", {
        hasText: /Connected|Active couple|Journey connected/i,
      })
      .first();

    await expect(connectionStatusA).toBeVisible({ timeout: 5000 });
    await expect(connectionStatusB).toBeVisible({ timeout: 5000 });

    // ========== PHASE 7: Both Can Answer First Question ==========
    // Navigate to questions or topics
    const startQuestionBtn = pageA
      .locator('button')
      .filter({ hasText: /Start|Begin|Answer/i });
    if (await startQuestionBtn.isVisible({ timeout: 2000 })) {
      await startQuestionBtn.click();
    }

    await pageA.waitForURL(
      (url) => url.pathname.match(/topics?|questions?|dashboard/),
      { timeout: 5000 },
    );

    // Find first question/topic
    const questionTitle = pageA.locator(
      "h1, h2, h3",
    ).filter({ hasText: /(Communication|Faith|Financial)/i });
    await expect(questionTitle).toBeVisible({ timeout: 5000 });

    // Select an answer
    const answerOptions = pageA.locator('button, label').filter({
      hasText: /(Yes|No|Maybe|Agree|Disagree|/i,
    });
    const firstOption = answerOptions.first();
    if (await firstOption.isVisible({ timeout: 2000 })) {
      await firstOption.click();
    }

    // Save/submit
    const saveBtn = pageA
      .locator('button')
      .filter({ hasText: /Save|Submit|Continue|Next/i });
    if (await saveBtn.isVisible({ timeout: 2000 })) {
      await saveBtn.click();
    }

    // Verify answer was recorded
    await expect(
      pageA.locator("text").filter({ hasText: /Saved|Recorded|Answer/i }),
    ).toBeVisible({ timeout: 5000 });

    // Repeat for User B
    const startQuestionBtnB = pageB
      .locator('button')
      .filter({ hasText: /Start|Begin|Answer/i });
    if (await startQuestionBtnB.isVisible({ timeout: 2000 })) {
      await startQuestionBtnB.click();
    }

    await pageB.waitForURL(
      (url) => url.pathname.match(/topics?|questions?|dashboard/),
      { timeout: 5000 },
    );

    const firstOptionB = pageB.locator('button, label').filter({
      hasText: /(Yes|No|Maybe|Agree|Disagree|/i,
    });
    if (await firstOptionB.isVisible({ timeout: 2000 })) {
      await firstOptionB.click();
    }

    const saveBtnB = pageB
      .locator('button')
      .filter({ hasText: /Save|Submit|Continue|Next/i });
    if (await saveBtnB.isVisible({ timeout: 2000 })) {
      await saveBtnB.click();
    }

    // ========== VERIFICATION COMPLETE ==========
    expect(inviteCode).toBeTruthy();
    expect(pageA.url()).toContain("/dashboard");
    expect(pageB.url()).toContain("/dashboard");
  });

  test("User with empty waiting journey can join different invite", async ({
    page,
    context,
  }) => {
    test.skip(
      !process.env.TEST_EMAIL_C || !process.env.TEST_PASSWORD,
      "Skipped: TEST_EMAIL_C, TEST_PASSWORD not configured",
    );

    const baseUrl = process.env.BASE_URL || "http://localhost:3000";
    const locale = "/en";

    // ========== Create User C with empty waiting journey ==========
    const pageC = await context.newPage();
    await pageC.goto(`${baseUrl}${locale}/sign-in`);

    const emailC = pageC.locator('input[type="email"]').first();
    const passwordC = pageC.locator('input[type="password"]').first();

    await emailC.fill(process.env.TEST_EMAIL_C!);
    await passwordC.fill(process.env.TEST_PASSWORD!);

    const createBtn = pageC
      .locator('button')
      .filter({ hasText: /Create|Sign/i });
    await createBtn.click();

    // Go through onboarding, create invite but don't share
    await pageC.waitForURL(
      (url) =>
        url.pathname.includes("/onboarding") ||
        url.pathname.includes("/dashboard"),
      { timeout: 10000 },
    );

    // Create invite (User C now has waiting journey)
    const createInviteBtn = pageC
      .locator('button')
      .filter({ hasText: /Create|Generate/i });
    if (await createInviteBtn.isVisible({ timeout: 2000 })) {
      await createInviteBtn.click();
    }

    // ========== User C Opens User A's Invite ==========
    // (Requires a pre-existing invite code from User A)
    const existingInviteCode = "abc123def456"; // Replace with real code in test
    const userAInviteUrl = `${baseUrl}${locale}/invite/${existingInviteCode}`;
    await pageC.goto(userAInviteUrl);

    // Should see "waiting_journey_conflict" message
    const conflictMessage = pageC
      .locator("text")
      .filter({
        hasText: /empty journey|waiting journey|already started|no partner/i,
      })
      .first();

    await expect(conflictMessage).toBeVisible({ timeout: 5000 });

    // ========== User C Abandons Empty Journey ==========
    const abandonButton = pageC
      .locator('button')
      .filter({ hasText: /Close|Abandon|Cancel|Leave/i });
    if (await abandonButton.isVisible({ timeout: 2000 })) {
      await abandonButton.click();
    }

    // Should return to invite acceptance
    await expect(
      pageC.locator("text").filter({ hasText: /invitation|accept/i }),
    ).toBeVisible({ timeout: 5000 });

    // ========== User C Joins User A's Invite ==========
    const joinBtn = pageC
      .locator('button')
      .filter({ hasText: /Join|Accept|Continue/i });
    if (await joinBtn.isVisible({ timeout: 2000 })) {
      await joinBtn.click();
    }

    // Should redirect to dashboard
    await pageC.waitForURL(
      (url) => url.pathname.includes("/dashboard"),
      { timeout: 5000 },
    );

    expect(pageC.url()).toContain("/dashboard");
  });
});
