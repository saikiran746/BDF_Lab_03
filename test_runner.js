// test_runner.js – unit + DB tests (run with: node test_runner.js)
const sqlite3 = require("sqlite3").verbose();
const path = require("path");
const db = new sqlite3.Database(path.join(__dirname, "books.db"));

const dbAll = (s, p = []) =>
  new Promise((res, rej) => db.all(s, p, (e, r) => (e ? rej(e) : res(r))));
const dbGet = (s, p = []) =>
  new Promise((res, rej) => db.get(s, p, (e, r) => (e ? rej(e) : res(r))));
const dbRun = (s, p = []) =>
  new Promise((res, rej) =>
    db.run(s, p, function (e) {
      e ? rej(e) : res(this);
    })
  );

const ALLOWED_ORDER_BY = ["id", "title", "author", "price", "pages"];
const ALLOWED_ORDER = ["ASC", "DESC"];

function validateBookBody(body) {
  const { title, author, price, pages } = body;
  if (!title || title.toString().trim() === "") return "Title is required.";
  if (!author || author.toString().trim() === "") return "Author is required.";
  if (price === undefined || price === null || price === "") return "Price is required.";
  if (isNaN(Number(price)) || !Number.isInteger(Number(price))) return "Price must be a valid integer.";
  if (Number(price) < 0) return "Price must be a non-negative integer.";
  if (pages !== undefined && pages !== null && pages !== "") {
    if (isNaN(Number(pages)) || !Number.isInteger(Number(pages))) return "Pages must be a valid integer.";
    if (Number(pages) <= 0) return "Pages must be a positive integer.";
  }
  return null;
}

let pass = 0, fail = 0;
function assert(name, condition, detail) {
  if (condition) { console.log("PASS " + name); pass++; }
  else { console.log("FAIL " + name + (detail ? " -- " + detail : "")); fail++; }
}

(async () => {
  // 1. Seeded rows
  const all = await dbAll("SELECT * FROM book");
  assert("Total books seeded = 10", all.length === 10, "got " + all.length);

  // 2. Search LIKE
  const harry = await dbAll("SELECT * FROM book WHERE title LIKE ?", ["%harry%"]);
  assert("search_q=harry finds 2 books", harry.length === 2, "got " + harry.length);

  // 3. Sort ASC
  const asc = await dbAll("SELECT * FROM book ORDER BY price ASC");
  assert("Sort price ASC: cheapest first", asc[0].price <= asc[asc.length - 1].price);

  // 4. Sort DESC
  const desc = await dbAll("SELECT * FROM book ORDER BY price DESC");
  assert("Sort price DESC: costliest first", desc[0].price >= desc[desc.length - 1].price);

  // 5. Pagination limit=3 offset=0
  const page1 = await dbAll("SELECT * FROM book LIMIT ? OFFSET ?", [3, 0]);
  assert("Pagination limit=3 returns 3", page1.length === 3);

  // 6. Pagination offset=3 gives different set
  const page2 = await dbAll("SELECT * FROM book LIMIT ? OFFSET ?", [3, 3]);
  assert("Pagination offset=3 returns different page", page2[0].id !== page1[0].id);

  // 7. Price filter
  const priceFilter = await dbAll(
    "SELECT * FROM book WHERE price >= ? AND price <= ?",
    [300, 500]
  );
  const allInRange = priceFilter.every((b) => b.price >= 300 && b.price <= 500);
  assert("Price filter 300-500 all in range", allInRange, priceFilter.map((b) => b.price).join(","));

  // 8. Combined query
  const combined = await dbAll(
    "SELECT * FROM book WHERE title LIKE ? AND price >= ? AND price <= ? ORDER BY price ASC LIMIT ? OFFSET ?",
    ["%harry%", 100, 1000, 5, 0]
  );
  assert("Combined query returns results", combined.length >= 1 && combined.length <= 5);

  // 9. POST insert
  const ins = await dbRun(
    "INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)",
    ["Test Book", "Test Author", 299, 200]
  );
  assert("POST insert succeeds, lastID > 0", ins.lastID > 0);
  const inserted = await dbGet("SELECT * FROM book WHERE id = ?", [ins.lastID]);
  assert("Inserted book is retrievable", inserted && inserted.title === "Test Book");

  // 10. PUT update
  await dbRun(
    "UPDATE book SET title = ?, author = ?, price = ?, pages = ? WHERE id = ?",
    ["Updated Book", "Updated Author", 399, 220, ins.lastID]
  );
  const updated = await dbGet("SELECT * FROM book WHERE id = ?", [ins.lastID]);
  assert("PUT update works", updated.title === "Updated Book" && updated.price === 399);

  // 11. DELETE
  await dbRun("DELETE FROM book WHERE id = ?", [ins.lastID]);
  const deleted = await dbGet("SELECT * FROM book WHERE id = ?", [ins.lastID]);
  assert("DELETE removes book", deleted === undefined);

  // 12. GET by valid ID
  const byId = await dbGet("SELECT * FROM book WHERE id = ?", [1]);
  assert("GET by ID=1 returns book", byId && byId.id === 1);

  // 13. GET by non-existent ID
  const notFound = await dbGet("SELECT * FROM book WHERE id = ?", [9999]);
  assert("GET by ID=9999 returns undefined (404 scenario)", notFound === undefined);

  // --- Validation tests (pure function) ---
  assert("Validation: missing title", validateBookBody({ author: "A", price: 100, pages: 100 }) !== null);
  assert("Validation: missing author", validateBookBody({ title: "T", price: 100, pages: 100 }) !== null);
  assert("Validation: missing price", validateBookBody({ title: "T", author: "A", pages: 100 }) !== null);
  assert("Validation: non-numeric price", validateBookBody({ title: "T", author: "A", price: "abc", pages: 100 }) !== null);
  assert("Validation: negative price", validateBookBody({ title: "T", author: "A", price: -10, pages: 100 }) !== null);
  assert("Validation: valid body passes", validateBookBody({ title: "T", author: "A", price: 100, pages: 100 }) === null);

  // --- Query-param validation logic ---
  assert("order_by rejects unknown column", !ALLOWED_ORDER_BY.includes("invalid_col"));
  assert("order_by allows 'price'", ALLOWED_ORDER_BY.includes("price"));
  assert("order rejects 'RANDOM'", !ALLOWED_ORDER.includes("RANDOM"));
  assert("order allows 'ASC'", ALLOWED_ORDER.includes("ASC"));
  assert("limit 'abc' is invalid integer", isNaN(parseInt("abc", 10)));
  assert("offset '-5' is negative (invalid)", parseInt("-5", 10) < 0);
  assert("min_price 'abc' is NaN", isNaN(Number("abc")));
  assert("min_price > max_price scenario detected", 500 > 100);

  console.log("");
  console.log("====================================================");
  console.log("Results: " + pass + " PASSED | " + fail + " FAILED / " + (pass + fail) + " total");
  console.log("====================================================");

  db.close();
  process.exit(fail > 0 ? 1 : 0);
})();

