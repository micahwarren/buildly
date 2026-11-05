# Purchase recovery and checkout latency

The authenticated billing sync endpoint independently verifies this customer's owned Apple consumables with RevenueCat, maps only the existing 1/2/4-token products, and applies missing transactions through the same atomic receipt ledger as webhooks. Client-provided quantities, prices and account IDs never authorize credits. Refund tombstones, receipt ownership and duplicate delivery remain protected. The regular balance endpoint reads the credit balance and receipt count concurrently.

A private operator-only build diagnostic can verify the deployed RevenueCat customer-read credential against two existing accounts without modifying balances. It is opt-in and never runs on normal builds.

The mobile checkout uses a separate progress screen, durable pending transactions and matching receipt verification. Completion requires a new server receipt and spendable balance, followed by a token animation. Existing balances cannot complete a new purchase. Slow, interrupted and deferred purchases remain pending and can resume; they never automatically start another payment. Support email synchronization no longer blocks store work.

The reported new tester's RevenueCat profile was found with no completed purchase at investigation time. That establishes no receipt is available there; it does not establish the precise Apple/StoreKit failure or the bank's payment status. A real second-phone purchase remains an acceptance requirement.
