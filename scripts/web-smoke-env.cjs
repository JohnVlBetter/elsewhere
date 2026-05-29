function configureWebSmokeEnvironment(env = process.env) {
  env.NODE_ENV = "production";
  env.AIGAME_DB_PATH = ":memory:";
  env.AIGAME_MODEL_PROVIDER ??= "fake";
  env.NEXT_PRIVATE_START_TIME = Date.now().toString();
}

module.exports = {
  configureWebSmokeEnvironment
};
