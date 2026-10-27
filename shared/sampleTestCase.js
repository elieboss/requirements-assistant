// Hand-written draft test case for sample criterion AC-1. FICTIONAL test data only.
// Used when the AI is not available, so the optional test case step still works in a demo.

export const sampleTestCase = {
  title: "Email alert sent when a new bank account is added",
  objective:
    "Verify that adding a new linked bank account sends an email alert to the verified address on file within the agreed time, showing only the last 4 digits of the new account.",
  preconditions: [
    "A test customer account exists with a verified email address on file.",
    "The customer has alerts turned on with default preferences.",
    "The tester can see the test email inbox and the alert record.",
    "The agreed alert time is known (currently [TBD per Q-1] minutes).",
  ],
  testData: [
    "Customer: Test Customer A (fictional), brokerage account ending 4821",
    "Email on file: test.customer.a@example.com",
    "New bank account to add: test routing number 000000000, account ending 7310",
  ],
  steps: [
    { action: "Sign in as Test Customer A and open the linked bank accounts page.",
      expected: "Existing linked accounts are listed. No bank account alert has been sent yet." },
    { action: "Add the new bank account ending 7310 and save.",
      expected: "A confirmation is shown, and the time of the change is recorded." },
    { action: "Check the inbox for test.customer.a@example.com.",
      expected: "One alert email arrives within [TBD per Q-1] minutes of the change." },
    { action: "Open the alert email and read its content.",
      expected: "It says a bank account was added, shows only the last 4 digits (7310), and gives the date and time. The full account number does not appear." },
  ],
  edgeCases: [
    { scenario: "The customer adds two bank accounts within one minute.",
      why: "Confirms whether each change gets its own alert or alerts are combined." },
    { scenario: "The customer's email address was changed earlier the same day.",
      why: "A fraudster may change the email first; ties to Q-9 about alerting the previous address." },
    { scenario: "A phone representative adds the bank account for the customer.",
      why: "Staff-initiated changes must also alert the customer; ties to Q-8." },
    { scenario: "The alert email bounces.",
      why: "Defines whether the system retries or falls back to a text message." },
  ],
  coverageGaps: [
    "Text message delivery is not tested here; it needs its own criterion once Q-2 is answered.",
    "Changing an existing bank account (as opposed to adding or removing one) has no criterion yet.",
    "No criterion checks that the alert includes the \"I did not make this change\" option from REQ-4.",
  ],
  assumptions: ["The time limit stays [TBD per Q-1] until Client Services answers Q-1."],
};
