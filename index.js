// ============================================================
//  BDF Lab 3 – REST API, Query Parameters, Validation & Debugging
//  Student : MANGALI SAI KIRAN  |  Reg: 252U1R5076  |  CSE (AIDE)-2A
// ============================================================

const express = require("express");
const sqlite3 = require("sqlite3").verbose();
const path = require("path");

const app = express();
app.use(express.json());

// ─────────────────────────────────────────────────────────────
//  DATABASE CONNECTION
//  Opens (or creates) books.db in the project root.
// ─────────────────────────────────────────────────────────────
const DB_PATH = path.join(__dirname, "books.db");
const db = new sqlite3.Database(DB_PATH, (err) => {
  if (err) {
    console.error("❌ Could not connect to SQLite database:", err.message);
    process.exit(1);
  }
  console.log("✅ Connected to SQLite database: books.db");
});

// ─────────────────────────────────────────────────────────────
//  TABLE BOOTSTRAP
//  Creates the `book` table and seeds 10 sample records if the
//  table is empty.  Uses parameterised queries throughout.
// ─────────────────────────────────────────────────────────────
db.serialize(() => {
  db.run(
    `CREATE TABLE IF NOT EXISTS book (
       id     INTEGER PRIMARY KEY AUTOINCREMENT,
       title  TEXT    NOT NULL,
       author TEXT    NOT NULL,
       price  INTEGER NOT NULL,
       pages  INTEGER NOT NULL
     )`,
    (err) => {
      if (err) {
        console.error("❌ Could not create table:", err.message);
        return;
      }
      console.log("✅ Table `book` is ready.");

      // Seed only when the table is empty
      db.get("SELECT COUNT(*) AS cnt FROM book", (err, row) => {
        if (err || row.cnt > 0) return;

        const books = [
          ["Harry Potter and the Philosopher's Stone", "J.K. Rowling",       399, 309],
          ["Harry Potter and the Chamber of Secrets",  "J.K. Rowling",       449, 341],
          ["The Alchemist",                             "Paulo Coelho",       299, 197],
          ["To Kill a Mockingbird",                    "Harper Lee",         349, 281],
          ["1984",                                     "George Orwell",      250, 328],
          ["The Great Gatsby",                         "F. Scott Fitzgerald",199, 180],
          ["Clean Code",                               "Robert C. Martin",   799, 464],
          ["The Pragmatic Programmer",                 "David Thomas",       899, 352],
          ["JavaScript: The Good Parts",               "Douglas Crockford",  499, 176],
          ["You Don't Know JS",                        "Kyle Simpson",       350, 278],
        ];

        const stmt = db.prepare(
          "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)"
        );
        books.forEach(([title, author, price, pages]) =>
          stmt.run(title, author, price, pages)
        );
        stmt.finalize();
        console.log("✅ Seeded 10 sample books into `book` table.");
      });
    }
  );
});

// ─────────────────────────────────────────────────────────────
//  HELPER – promise wrapper for db.all / db.get / db.run
// ─────────────────────────────────────────────────────────────
const dbAll = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.all(sql, params, (err, rows) => (err ? reject(err) : resolve(rows)));
  });

const dbGet = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.get(sql, params, (err, row) => (err ? reject(err) : resolve(row)));
  });

const dbRun = (sql, params = []) =>
  new Promise((resolve, reject) => {
    db.run(sql, params, function (err) {
      err ? reject(err) : resolve(this);
    });
  });

// ─────────────────────────────────────────────────────────────
//  ALLOWED VALUES for validation
// ─────────────────────────────────────────────────────────────
const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER    = ["ASC", "DESC"];

// ─────────────────────────────────────────────────────────────
//  VALIDATION HELPER for POST / PUT body
// ─────────────────────────────────────────────────────────────
function validateBookBody(body) {
  const { title, author, price, pages } = body;

  if (!title || title.toString().trim() === "") {
    return "Title is required.";
  }
  if (!author || author.toString().trim() === "") {
    return "Author is required.";
  }
  if (price === undefined || price === null || price === "") {
    return "Price is required.";
  }
  if (isNaN(Number(price)) || !Number.isInteger(Number(price))) {
    return "Price must be a valid integer.";
  }
  if (Number(price) < 0) {
    return "Price must be a non-negative integer.";
  }
  if (pages !== undefined && pages !== null && pages !== "") {
    if (isNaN(Number(pages)) || !Number.isInteger(Number(pages))) {
      return "Pages must be a valid integer.";
    }
    if (Number(pages) <= 0) {
      return "Pages must be a positive integer.";
    }
  }
  return null; // no error
}

// ═════════════════════════════════════════════════════════════
//  ROUTES
// ═════════════════════════════════════════════════════════════

// ─────────────────────────────────────────────────────────────
//  GET /books
//  Supports: search_q, order_by, order, limit, offset,
//            min_price, max_price  (all combinable)
// ─────────────────────────────────────────────────────────────
app.get("/books", async (req, res) => {
  try {
    let {
      search_q,
      order_by  = "id",
      order     = "ASC",
      limit     = "10",
      offset    = "0",
      min_price,
      max_price,
    } = req.query;

    // ── Validate order_by ──────────────────────────────────
    if (!ALLOWED_ORDER_BY.includes(order_by)) {
      return res.status(400).json({
        message: `Invalid order_by value. Allowed columns: ${ALLOWED_ORDER_BY.join(", ")}`,
      });
    }

    // ── Validate order ─────────────────────────────────────
    order = order.toUpperCase();
    if (!ALLOWED_ORDER.includes(order)) {
      return res.status(400).json({
        message: "Invalid order value. Use ASC or DESC.",
      });
    }

    // ── Validate pagination ────────────────────────────────
    const limitNum  = parseInt(limit, 10);
    const offsetNum = parseInt(offset, 10);
    if (isNaN(limitNum) || limitNum <= 0) {
      return res.status(400).json({ message: "limit must be a positive integer." });
    }
    if (isNaN(offsetNum) || offsetNum < 0) {
      return res.status(400).json({ message: "offset must be a non-negative integer." });
    }

    // ── Validate price filters ─────────────────────────────
    if (min_price !== undefined && (isNaN(Number(min_price)) || Number(min_price) < 0)) {
      return res.status(400).json({ message: "min_price must be a non-negative number." });
    }
    if (max_price !== undefined && (isNaN(Number(max_price)) || Number(max_price) < 0)) {
      return res.status(400).json({ message: "max_price must be a non-negative number." });
    }
    if (
      min_price !== undefined &&
      max_price !== undefined &&
      Number(min_price) > Number(max_price)
    ) {
      return res.status(400).json({
        message: "min_price cannot be greater than max_price.",
      });
    }

    // ── Build dynamic SQL ──────────────────────────────────
    //  We use parameterised placeholders (?) for every user-
    //  supplied value.  order_by and order direction are
    //  whitelisted above, so string interpolation is safe.
    const conditions = [];
    const params     = [];

    if (search_q) {
      conditions.push("title LIKE ?");
      params.push(`%${search_q}%`);
    }
    if (min_price !== undefined) {
      conditions.push("price >= ?");
      params.push(Number(min_price));
    }
    if (max_price !== undefined) {
      conditions.push("price <= ?");
      params.push(Number(max_price));
    }

    const whereClause =
      conditions.length > 0 ? `WHERE ${conditions.join(" AND ")}` : "";

    const sql = `
      SELECT *
        FROM book
      ${whereClause}
      ORDER BY ${order_by} ${order}
      LIMIT  ?
      OFFSET ?
    `;
    params.push(limitNum, offsetNum);

    const books = await dbAll(sql, params);
    return res.status(200).json(books);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  GET /books/:bookId  – Get a single book by ID
// ─────────────────────────────────────────────────────────────
app.get("/books/:bookId", async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ message: "bookId must be a valid integer." });
    }

    const book = await dbGet("SELECT * FROM book WHERE id = ?", [bookId]);
    if (!book) {
      return res.status(404).json({ message: "Book not found." });
    }
    return res.status(200).json(book);
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  POST /books  – Create a new book
// ─────────────────────────────────────────────────────────────
app.post("/books", async (req, res) => {
  try {
    const validationError = validateBookBody(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { title, author, price, pages } = req.body;
    const result = await dbRun(
      "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
      [title.trim(), author.trim(), Number(price), Number(pages) || 0]
    );

    return res.status(201).json({
      message: "Book created successfully.",
      bookId: result.lastID,
    });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  PUT /books/:bookId  – Update a book by ID
// ─────────────────────────────────────────────────────────────
app.put("/books/:bookId", async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ message: "bookId must be a valid integer." });
    }

    // Check existence first
    const existing = await dbGet("SELECT * FROM book WHERE id = ?", [bookId]);
    if (!existing) {
      return res.status(404).json({ message: "Book not found." });
    }

    const validationError = validateBookBody(req.body);
    if (validationError) {
      return res.status(400).json({ message: validationError });
    }

    const { title, author, price, pages } = req.body;
    await dbRun(
      "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
      [title.trim(), author.trim(), Number(price), Number(pages) || 0, bookId]
    );

    return res.status(200).json({ message: "Book updated successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  DELETE /books/:bookId  – Delete a book by ID
// ─────────────────────────────────────────────────────────────
app.delete("/books/:bookId", async (req, res) => {
  try {
    const bookId = parseInt(req.params.bookId, 10);
    if (isNaN(bookId)) {
      return res.status(400).json({ message: "bookId must be a valid integer." });
    }

    const existing = await dbGet("SELECT * FROM book WHERE id = ?", [bookId]);
    if (!existing) {
      return res.status(404).json({ message: "Book not found." });
    }

    await dbRun("DELETE FROM book WHERE id = ?", [bookId]);
    return res.status(200).json({ message: "Book deleted successfully." });
  } catch (error) {
    console.error(error);
    return res.status(500).json({ message: "Internal server error." });
  }
});

// ─────────────────────────────────────────────────────────────
//  404 catch-all for undefined routes
// ─────────────────────────────────────────────────────────────
app.use((req, res) => {
  res.status(404).json({ message: "Route not found." });
});

// ═════════════════════════════════════════════════════════════
//  SERVER START
// ═════════════════════════════════════════════════════════════
const PORT = 3000;
app.listen(PORT, () => {
  console.log(`🚀 Server is running on http://localhost:${PORT}`);
  console.log("   Press Ctrl+C to stop.\n");
});

// ─────────────────────────────────────────────────────────────
//  DEBUGGING EXERCISES (explained in README.md)
//
//  Exercise 1 – EADDRINUSE (Port Conflict)
//    BROKEN:  app.listen(3000, ...) called while port 3000 is
//             already in use by another process.
//    FIX:     Kill the other process (`npx kill-port 3000`) or
//             change PORT to an unused value (e.g. 3001).
//
//  Exercise 2 – Wrong import path
//    BROKEN:  const db = require("./database/db");
//             → Error: Cannot find module './database/db'
//    FIX:     Use the correct relative path: require("./db")
//             or the absolute path.resolve() equivalent.
//
//  Exercise 3 – SQLite table-name typo
//    BROKEN:  db.all("SELECT * FROM books", ...)
//             → Error: no such table: books
//    FIX:     Use the exact table name: "book"  (not "books")
//
//  Exercise 4 – Missing await in async operation
//    BROKEN:  const book = dbGet("SELECT * FROM book WHERE id=?", [id]);
//             → book is a Promise object, not the row data.
//    FIX:     Add await: const book = await dbGet(...)
// ─────────────────────────────────────────────────────────────

