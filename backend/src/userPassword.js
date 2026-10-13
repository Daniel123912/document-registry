const { hashPassword } = require("./auth");
const { encryptPassword } = require("./passwordVault");

async function buildPasswordFields(plainPassword) {
  return {
    passwordHash: await hashPassword(plainPassword),
    passwordEncrypted: encryptPassword(plainPassword),
  };
}

module.exports = {
  buildPasswordFields,
};
