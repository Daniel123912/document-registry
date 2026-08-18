const { initializeDatabase } = require("./db");
const { seedDefaultUsers } = require("./seedData");

async function seed() {
  await initializeDatabase();
  await seedDefaultUsers();

  console.log("Seed completed.");
  console.log("Responsible: responsible@bakor.local / admin1234");
  console.log("Employee: employee@bakor.local / user1234");
  process.exit(0);
}

seed().catch((error) => {
  console.error("Seed failed", error);
  process.exit(1);
});
