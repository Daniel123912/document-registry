const { query } = require("../db");
const { hashPassword } = require("../auth");

async function seedDefaultUsers() {
  const existingUsers = await query("SELECT COUNT(*)::int AS count FROM users");
  if (existingUsers.rows[0].count > 0) {
    return;
  }

  const responsiblePassword = await hashPassword("admin1234");
  const employeePassword = await hashPassword("user1234");

  await query(
    `
      INSERT INTO users (full_name, email, password_hash, role)
      VALUES
        ('Иван Петров', $1, $2, 'responsible'),
        ('Анна Смирнова', $3, $4, 'employee')
    `,
    [
      "responsible@bakor.local",
      responsiblePassword,
      "employee@bakor.local",
      employeePassword,
    ]
  );
}

module.exports = {
  seedDefaultUsers,
};
