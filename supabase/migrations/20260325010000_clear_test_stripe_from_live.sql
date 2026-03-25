-- Clear any test Stripe account IDs that leaked into the live column
-- Test accounts start with 'acct_' but were created with test keys
UPDATE venues SET stripe_account_id = NULL
WHERE stripe_account_id IS NOT NULL
  AND stripe_test_account_id IS NOT NULL
  AND stripe_account_id = stripe_test_account_id;
