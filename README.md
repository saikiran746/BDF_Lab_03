# BDF Lab 3 – REST API, Query Parameters, Validation and Debugging

---

## Student Details

| Field | Value |
|---|---|
| **Name** | MANGALI SAI KIRAN |
| **Registration Number** | 252U1R5076 |
| **Class** | CSE (AIDE)-2A |
| **Lab** | Lab 3 |

---

## Project Description

This project demonstrates building a fully functional **RESTful API** using **Node.js** and **Express.js** backed by an **SQLite** database. It covers all five CRUD operations, advanced query parameters (search, sort, paginate, price-filter), robust input validation, meaningful HTTP status codes, and four debugging exercises.

---

## Technologies Used

| Technology | Purpose |
|---|---|
| Node.js v24+ | JavaScript runtime |
| Express.js | HTTP server / routing |
| SQLite3 | Embedded SQL database |
| sqlite3 (npm) | Node.js SQLite driver |
| Nodemon | Auto-restart during development |
| Postman | API testing |

---

## Project Structure

```text
BDF_Lab_03/
│
├── screenshots/          ← Postman test screenshots
├── index.js              ← Main application (server + routes)
├── test_runner.js        ← Automated unit + DB tests
├── package.json
├── package-lock.json
├── books.db              ← SQLite database (auto-created)
├── README.md
└── .gitignore
```

---

## Database Structure

**Database file:** `books.db`  
**Table name:** `book`

```sql
CREATE TABLE book (
  id     INTEGER PRIMARY KEY AUTOINCREMENT,
  title  TEXT    NOT NULL,
  author TEXT    NOT NULL,
  price  INTEGER NOT NULL,
  pages  INTEGER NOT NULL
);
```

### Sample Records (10 books seeded automatically)

| id | title | author | price | pages |
|---|---|---|---|---|
| 1 | Harry Potter and the Philosopher's Stone | J.K. Rowling | 399 | 309 |
| 2 | Harry Potter and the Chamber of Secrets | J.K. Rowling | 449 | 341 |
| 3 | The Alchemist | Paulo Coelho | 299 | 197 |
| 4 | To Kill a Mockingbird | Harper Lee | 349 | 281 |
| 5 | 1984 | George Orwell | 250 | 328 |
| 6 | The Great Gatsby | F. Scott Fitzgerald | 199 | 180 |
| 7 | Clean Code | Robert C. Martin | 799 | 464 |
| 8 | The Pragmatic Programmer | David Thomas | 899 | 352 |
| 9 | JavaScript: The Good Parts | Douglas Crockford | 499 | 176 |
| 10 | You Don't Know JS | Kyle Simpson | 350 | 278 |

> Parameterised `INSERT INTO book (title, author, price, pages) VALUES (?, ?, ?, ?)` statements are used for every write, preventing SQL injection.

---

## API Endpoints

Base URL: `http://localhost:3000`

| Method | Endpoint | Purpose | Status Code |
|---|---|---|---|
| GET | `/books` | Get all books (supports filters) | 200 |
| GET | `/books/:bookId` | Get a single book by ID | 200 / 404 |
| POST | `/books` | Create a new book | 201 |
| PUT | `/books/:bookId` | Update a book by ID | 200 / 404 |
| DELETE | `/books/:bookId` | Delete a book by ID | 200 / 404 |

---

## Query Parameters — `GET /books`

All parameters are **optional** and can be **combined**.

### 1. Search (`search_q`)

Performs a **partial, case-insensitive title match** using SQL `LIKE`.

```
GET /books?search_q=harry
```

SQL generated:
```sql
SELECT * FROM book WHERE title LIKE '%harry%' ORDER BY id ASC LIMIT 10 OFFSET 0
```

---

### 2. Sorting (`order_by`, `order`)

| Parameter | Allowed Values | Default |
|---|---|---|
| `order_by` | `id`, `title`, `author`, `price`, `pages` | `id` |
| `order` | `ASC`, `DESC` | `ASC` |

```
GET /books?order_by=price&order=ASC
GET /books?order_by=price&order=DESC
```

> Invalid `order_by` or `order` values return **HTTP 400**.

---

### 3. Pagination (`limit`, `offset`)

| Parameter | Type | Default | Rule |
|---|---|---|---|
| `limit` | positive integer | 10 | must be > 0 |
| `offset` | non-negative integer | 0 | must be >= 0 |

```
GET /books?limit=5&offset=0
GET /books?limit=5&offset=5
```

---

### 4. Price Filtering (`min_price`, `max_price`)

Parameterised SQL conditions are used (no string concatenation).

```
GET /books?min_price=200&max_price=500
```

SQL generated:
```sql
SELECT * FROM book WHERE price >= 200 AND price <= 500 ORDER BY id ASC LIMIT 10 OFFSET 0
```

---

### 5. Combined Query

All filters work together:

```
GET /books?search_q=harry&order_by=price&order=ASC&limit=5&offset=0&min_price=100&max_price=1000
```

---

## Request & Response Examples

### GET /books

**Request:**
```
GET http://localhost:3000/books
```

**Response (200):**
```json
[
  { "id": 1, "title": "Harry Potter and the Philosopher's Stone", "author": "J.K. Rowling", "price": 399, "pages": 309 },
  { "id": 2, "title": "Harry Potter and the Chamber of Secrets",  "author": "J.K. Rowling", "price": 449, "pages": 341 }
]
```

---

### GET /books/:bookId

**Request:**
```
GET http://localhost:3000/books/1
```

**Response (200):**
```json
{ "id": 1, "title": "Harry Potter and the Philosopher's Stone", "author": "J.K. Rowling", "price": 399, "pages": 309 }
```

**Response (404):**
```json
{ "message": "Book not found." }
```

**Response (400 — invalid ID):**
```json
{ "message": "bookId must be a valid integer." }
```

---

### POST /books

**Request:**
```
POST http://localhost:3000/books
Content-Type: application/json

{
  "title": "Atomic Habits",
  "author": "James Clear",
  "price": 499,
  "pages": 320
}
```

**Response (201):**
```json
{ "message": "Book created successfully.", "bookId": 11 }
```

---

### PUT /books/:bookId

**Request:**
```
PUT http://localhost:3000/books/11
Content-Type: application/json

{
  "title": "Atomic Habits (Revised)",
  "author": "James Clear",
  "price": 549,
  "pages": 325
}
```

**Response (200):**
```json
{ "message": "Book updated successfully." }
```

---

### DELETE /books/:bookId

**Request:**
```
DELETE http://localhost:3000/books/11
```

**Response (200):**
```json
{ "message": "Book deleted successfully." }
```

---

## Validation Rules

Applied to both **POST** and **PUT** requests:

| Rule | Error Message |
|---|---|
| `title` is missing or empty | `"Title is required."` |
| `author` is missing or empty | `"Author is required."` |
| `price` is missing | `"Price is required."` |
| `price` is not a valid integer | `"Price must be a valid integer."` |
| `price` is negative | `"Price must be a non-negative integer."` |
| `pages` present but not integer | `"Pages must be a valid integer."` |
| `pages` present but not positive | `"Pages must be a positive integer."` |

All validation errors return **HTTP 400** with a JSON body:
```json
{ "message": "<error description>" }
```

---

## HTTP Status Codes

| Code | Meaning | When Used |
|---|---|---|
| 200 | OK | Successful GET, PUT, DELETE |
| 201 | Created | Successful POST |
| 400 | Bad Request | Invalid input / query params |
| 404 | Not Found | Book ID does not exist in DB |
| 500 | Internal Server Error | Unexpected server-side errors |

---

## Debugging Exercises

### Exercise 1 — Port Conflict (`EADDRINUSE`)

**Cause:** Two processes try to bind to the same port (e.g. 3000).

```
Error: listen EADDRINUSE: address already in use :::3000
```

**How to reproduce:**
1. Start the server (`node index.js`).
2. Without stopping it, run `node index.js` again.

**Fix:**
```bash
# Option A: find and kill the process using port 3000
npx kill-port 3000

# Option B: change PORT in index.js
const PORT = 3001;
```

---

### Exercise 2 — Wrong Import Path

**Cause:** A `require()` call references a path that does not exist.

```js
// BROKEN
const db = require("./database/db");
// Error: Cannot find module './database/db'
```

**Fix:** Use the correct relative path.
```js
// FIXED
const sqlite3 = require("sqlite3").verbose();
```

---

### Exercise 3 — SQLite Table-Name Typo (`no such table`)

**Cause:** The SQL query references `books` instead of the actual table name `book`.

```js
// BROKEN
db.all("SELECT * FROM books", ...);
// Error: SQLITE_ERROR: no such table: books
```

**Fix:** Use the exact table name as declared in `CREATE TABLE`.
```js
// FIXED
db.all("SELECT * FROM book", ...);
```

---

### Exercise 4 — Missing `await` on Async Operation

**Cause:** An `async` helper returns a Promise, but `await` is omitted, so the variable holds a `Promise` object instead of the resolved data.

```js
// BROKEN – book is a Promise object, not a row
const book = dbGet("SELECT * FROM book WHERE id = ?", [id]);
if (!book) return res.status(404).json({ message: "Book not found." });
// This check never triggers – a Promise is always truthy!
```

**Fix:** Always `await` async calls inside `async` functions.
```js
// FIXED
const book = await dbGet("SELECT * FROM book WHERE id = ?", [id]);
if (!book) return res.status(404).json({ message: "Book not found." });
```

---

## Installation and Execution

### Prerequisites

- Node.js v18 or higher
- SQLite3 installed (verify: `sqlite3 --version`)

### Steps

```bash
# 1. Clone or download the project
cd BDF_Lab_03

# 2. Install dependencies
npm install

# 3. Start the server (production)
npm start

# 4. Start with auto-restart (development)
npm run dev

# 5. Run automated tests
node test_runner.js
```

The server starts at: **http://localhost:3000**

The database (`books.db`) is **created and seeded automatically** on first run.

### Verify Database (SQLite CLI)

```bash
sqlite3 books.db

# Inside the SQLite shell:
.tables
.schema book
SELECT * FROM book;
.quit
```

---

## Postman Testing

### Setup

1. Open **Postman**.
2. Set the base URL to `http://localhost:3000`.
3. For POST and PUT requests, set **Body → raw → JSON**.

### Test Cases

| # | Method | URL | Body / Notes | Expected Status |
|---|---|---|---|---|
| 1 | GET | `/books` | — | 200 |
| 2 | GET | `/books/1` | — | 200 |
| 3 | GET | `/books?search_q=harry` | — | 200 (2 results) |
| 4 | GET | `/books?order_by=price&order=ASC` | — | 200 |
| 5 | GET | `/books?order_by=price&order=DESC` | — | 200 |
| 6 | GET | `/books?limit=3&offset=0` | — | 200 (3 results) |
| 7 | GET | `/books?min_price=300&max_price=500` | — | 200 |
| 8 | GET | `/books?search_q=harry&order_by=price&order=ASC&limit=5&offset=0&min_price=100&max_price=1000` | Combined | 200 |
| 9 | POST | `/books` | `{"title":"Atomic Habits","author":"James Clear","price":499,"pages":320}` | 201 |
| 10 | PUT | `/books/11` | `{"title":"Atomic Habits (Revised)","author":"James Clear","price":549,"pages":325}` | 200 |
| 11 | DELETE | `/books/11` | — | 200 |
| 12 | POST | `/books` | Missing `title` | 400 |
| 13 | POST | `/books` | Missing `author` | 400 |
| 14 | POST | `/books` | Missing `price` | 400 |
| 15 | POST | `/books` | `"price": "abc"` (non-numeric) | 400 |
| 16 | GET | `/books/9999` | Non-existent ID | 404 |
| 17 | GET | `/books/abc` | Invalid ID format | 400 |
| 18 | GET | `/books?order_by=invalid_col` | Invalid column | 400 |
| 19 | GET | `/books?order=RANDOM` | Invalid direction | 400 |
| 20 | GET | `/books?limit=abc` | Non-numeric limit | 400 |
| 21 | GET | `/books?offset=-5` | Negative offset | 400 |
| 22 | GET | `/books?min_price=500&max_price=100` | min > max | 400 |
| 23 | DELETE | `/books/9999` | Non-existent ID | 404 |
| 24 | PUT | `/books/9999` | Non-existent ID | 404 |

### Screenshots

After testing in Postman, save screenshots to the `screenshots/` folder:

| File | Test |
|---|---|
| `screenshots/01_get_all_books.png` | GET /books |
| `screenshots/02_get_book_by_id.png` | GET /books/1 |
| `screenshots/03_search_harry.png` | GET ?search_q=harry |
| `screenshots/04_sort_price_asc.png` | GET ?order_by=price&order=ASC |
| `screenshots/05_sort_price_desc.png` | GET ?order_by=price&order=DESC |
| `screenshots/06_pagination.png` | GET ?limit=3&offset=0 |
| `screenshots/07_price_filter.png` | GET ?min_price=300&max_price=500 |
| `screenshots/08_combined_query.png` | Combined query |
| `screenshots/09_post_create.png` | POST /books |
| `screenshots/10_put_update.png` | PUT /books/:id |
| `screenshots/11_delete.png` | DELETE /books/:id |
| `screenshots/12_missing_title.png` | POST missing title (400) |
| `screenshots/13_non_numeric_price.png` | POST price=abc (400) |
| `screenshots/14_not_found_404.png` | GET /books/9999 (404) |
| `screenshots/15_invalid_order_by.png` | GET ?order_by=invalid (400) |

---

## Notes

- `books.db` is **auto-created** at startup — no manual DB setup needed.
- All SQL queries use **parameterised placeholders (`?`)** — no raw string concatenation.
- The `order_by` column is **whitelisted** before being interpolated into SQL.
- Lab 2 was **not modified** — this is a completely separate project.

---

*BDF Lab 3 — MANGALI SAI KIRAN (252U1R5076) — CSE (AIDE)-2A*

