const express = require("express");
const mysql = require("mysql2/promise");
const bodyParser = require("body-parser");
require("dotenv").config();

const app = express();
const port = process.env.PORT || 3000;

app.use(bodyParser.json());

const dbConfig = {
  host: process.env.DB_HOST,
  port: process.env.DB_PORT,
  user: process.env.DB_USER,
  password: process.env.DB_PASSWORD,
  database: process.env.DB_NAME,
};

function validateUserInput({ full_name, role, efficiency }) {
  const errors = [];
  if (
    !full_name ||
    typeof full_name !== "string" ||
    full_name.trim().length === 0 ||
    full_name.length > 255
  ) {
    errors.push("Invalid or missing full_name");
  }
  if (
    !role ||
    typeof role !== "string" ||
    role.trim().length === 0 ||
    role.length > 255
  ) {
    errors.push("Invalid or missing role");
  }
  if (
    efficiency === undefined ||
    typeof efficiency !== "number" ||
    !Number.isInteger(efficiency) ||
    efficiency < 0
  ) {
    errors.push("Invalid or missing efficiency");
  }
  return errors;
}

// CREATE
app.post("/create", async (req, res) => {
  const { full_name, role, efficiency } = req.body;
  const errors = validateUserInput({ full_name, role, efficiency });
  if (errors.length > 0) {
    return res
      .status(400)
      .json({ success: false, result: { error: errors.join(", ") } });
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [result] = await conn.execute(
      "INSERT INTO users (full_name, role, efficiency) VALUES (?, ?, ?)",
      [full_name.trim(), role.trim(), efficiency]
    );
    conn.end();
    res.status(201).json({ success: true, result: { id: result.insertId } });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

// READ by ID
app.get("/get/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(Number(id))) {
    return res
      .status(400)
      .json({ success: false, result: { error: "Invalid user ID" } });
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute("SELECT * FROM users WHERE id = ?", [id]);
    conn.end();
    res.json({ success: true, result: { users: rows } });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

// READ all or by role
app.get("/get", async (req, res) => {
  const { role } = req.query;
  let query = "SELECT * FROM users";
  const values = [];

  if (role) {
    query += " WHERE role = ?";
    values.push(role);
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute(query, values);
    conn.end();
    res.json({ success: true, result: { users: rows } });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

// UPDATE
app.patch("/update/:id", async (req, res) => {
  const { id } = req.params;
  if (isNaN(Number(id))) {
    return res
      .status(400)
      .json({ success: false, result: { error: "Invalid user ID" } });
  }

  const updates = req.body;
  if (Object.keys(updates).length === 0) {
    return res
      .status(400)
      .json({ success: false, result: { error: "No update fields provided" } });
  }

  const validFields = ["full_name", "role", "efficiency"];
  const setString = [];
  const values = [];

  for (let key of validFields) {
    if (updates[key] !== undefined) {
      if (
        key === "efficiency" &&
        (!Number.isInteger(updates[key]) || updates[key] < 0)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            result: { error: "Invalid efficiency value" },
          });
      }
      if (
        (key === "full_name" || key === "role") &&
        (typeof updates[key] !== "string" ||
          updates[key].trim().length === 0 ||
          updates[key].length > 255)
      ) {
        return res
          .status(400)
          .json({
            success: false,
            result: { error: `Invalid value for ${key}` },
          });
      }
      setString.push(`${key} = ?`);
      values.push(updates[key]);
    }
  }

  values.push(id);

  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute(
      `UPDATE users SET ${setString.join(", ")} WHERE id = ?`,
      values
    );
    const [rows] = await conn.execute("SELECT * FROM users WHERE id = ?", [id]);
    conn.end();
    if (rows.length === 0) {
      return res
        .status(404)
        .json({ success: false, result: { error: "User not found" } });
    }
    res.json({ success: true, result: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

// DELETE
// Удаление конкретного пользователя по ID
app.delete("/delete/:id", async (req, res) => {
  const { id } = req.params;

  if (isNaN(Number(id))) {
    return res
      .status(400)
      .json({ success: false, result: { error: "Invalid user ID" } });
  }

  try {
    const conn = await mysql.createConnection(dbConfig);
    const [rows] = await conn.execute("SELECT * FROM users WHERE id = ?", [id]);

    if (rows.length === 0) {
      conn.end();
      return res
        .status(404)
        .json({ success: false, result: { error: "User not found" } });
    }

    await conn.execute("DELETE FROM users WHERE id = ?", [id]);
    conn.end();
    res.json({ success: true, result: rows[0] });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

// Удаление всех пользователей
app.delete("/delete", async (req, res) => {
  try {
    const conn = await mysql.createConnection(dbConfig);
    await conn.execute("DELETE FROM users");
    conn.end();
    res.json({ success: true });
  } catch (error) {
    res.status(500).json({ success: false, result: { error: error.message } });
  }
});

app.get("/", (req, res) => {
  res.send("🎉 Тестовое задание работает! Используй Postman или curl для API.");
});

app.listen(port, () => {
  console.log(`Server running on port ${port}`);
});
