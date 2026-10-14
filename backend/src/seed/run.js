const { initializeDatabase } = require("../db");
const { seedAllDemoUsers } = require("./users");

async function seed() {
  await initializeDatabase();
  await seedAllDemoUsers();

  console.log("Database schema ready.");
  console.log("Сотрудников в seed нет — создайте их в панели администратора (/moderator).");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
