module.exports = async function globalTeardown() {
  // Intentionally left as a no-op: the test database is dropped and
  // recreated at the START of the next run (see globalSetup.js), so a
  // failed run's data is left in place for debugging instead of being
  // wiped here. Per-test-file DB pools are closed in testLifecycle.js.
};
