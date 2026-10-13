const { query } = require("../db");
const { buildPasswordFields } = require("../userPassword");

const EMPLOYEE_NAMES = [
  "Анна Смирнова",
  "Пётр Иванов",
  "Мария Козлова",
  "Алексей Новиков",
  "Елена Морозова",
  "Дмитрий Волков",
  "Ольга Соколова",
  "Сергей Лебедев",
  "Наталья Кузнецова",
  "Андрей Попов",
  "Татьяна Васильева",
  "Игорь Павлов",
  "Юлия Семёнова",
  "Николай Голубев",
  "Екатерина Виноградова",
  "Максим Борисов",
  "Ирина Фёдорова",
  "Владимир Михайлов",
  "Светлана Алексеева",
  "Роман Ефимов",
  "Дарья Григорьева",
  "Артём Степанов",
  "Виктория Орлова",
  "Кирилл Андреев",
  "Полина Макарова",
  "Глеб Николаев",
  "Алина Захарова",
  "Тимур Белов",
  "Валерия Медведева",
  "Станислав Крылов",
  "Марина Тихонова",
  "Денис Комаров",
  "Ксения Овчинникова",
  "Павел Гусев",
  "Вероника Лазарева",
  "Олег Тарасов",
  "Людмила Беляева",
  "Илья Жуков",
  "Анастасия Савельева",
  "Евгений Романов",
];

async function seedResponsibleUser() {
  const responsibleFields = await buildPasswordFields("admin1234");

  await query(
    `
      INSERT INTO users (full_name, email, password_hash, password_encrypted, role)
      VALUES ('Иван Петров', $1, $2, $3, 'responsible')
      ON CONFLICT (email) DO NOTHING
    `,
    [
      "responsible@bakor.local",
      responsibleFields.passwordHash,
      responsibleFields.passwordEncrypted,
    ]
  );
}

async function seedDemoEmployees() {
  const employeeFields = await buildPasswordFields("user1234");

  for (let index = 0; index < EMPLOYEE_NAMES.length; index += 1) {
    const fullName = EMPLOYEE_NAMES[index];
    const email =
      index === 0 ? "employee@bakor.local" : `employee${index + 1}@bakor.local`;

    await query(
      `
        INSERT INTO users (full_name, email, password_hash, password_encrypted, role)
        VALUES ($1, $2, $3, $4, 'employee')
        ON CONFLICT (email) DO NOTHING
      `,
      [
        fullName,
        email,
        employeeFields.passwordHash,
        employeeFields.passwordEncrypted,
      ]
    );
  }
}

/** При старте сервера — только ответственный по умолчанию. */
async function seedDefaultUsers() {
  await seedResponsibleUser();
}

/** Полный демо-набор: `npm run seed`. */
async function seedAllDemoUsers() {
  await seedResponsibleUser();
  await seedDemoEmployees();
}

module.exports = {
  seedDefaultUsers,
  seedAllDemoUsers,
  seedResponsibleUser,
  seedDemoEmployees,
  EMPLOYEE_NAMES,
};
