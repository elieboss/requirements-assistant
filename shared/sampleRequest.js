// FICTIONAL sample request. "Quillbrook Investments" and all people named here are invented.
// The body is deliberately a little vague so the analysis has real gaps to find.

export const sampleRequest = {
  id: "REQ-DOC-001",
  title: "Alert customers when their linked bank account changes",
  from: "Dana Whitfield, Client Services Operations Manager",
  organization: "Quillbrook Investments (fictional)",
  body:
    "Over the last few months, several customers have called us upset because someone changed the bank account linked to their brokerage account without their knowledge. " +
    "We want customers to get an alert right away whenever the linked bank account is added, changed, or removed. " +
    "The alert should go out by email or text. " +
    "It should work the same way as the address change alert we already send. " +
    "If the customer says they did not make the change, they should be able to report it easily and reach our fraud team. " +
    "We also think large withdrawals to a newly added bank account should be held for a few days. " +
    "Compliance will want a record of every alert we send. " +
    "We would like this live before the end of the quarter.",
};
