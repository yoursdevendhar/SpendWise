# SpendWise

A full-stack personal finance tracker. Create an account, log your income and expenses, and see where your money goes through monthly charts, category breakdowns and savings trends.

## Features

- **Secure accounts**: sign up and log in with email and password (bcrypt-hashed passwords, JWT authentication)
- **Private data**: every user sees only their own transactions
- **Transactions**: add, edit and delete income and expense entries
- **Dashboard summary**: total income, total expenses and balance
- **Analytics charts**:
  - Monthly income vs expenses
  - Monthly balance trend
  - Expenses by category
  - Monthly savings
- **Responsive UI** with a clean login page and dashboard
- Amounts displayed in Indian Rupees (₹)

## Tech Stack

| Layer    | Technology                                        |
| -------- | ------------------------------------------------- |
| Frontend | React (Vite), Recharts, plain CSS                 |
| Backend  | FastAPI, SQLAlchemy, Pydantic                     |
| Database | PostgreSQL (psycopg)                              |
| Auth     | JWT (PyJWT) with bcrypt password hashing          |

## Project Structure

```
SpendWise/
├── backend/
│   ├── main.py        # API routes
│   ├── auth.py        # password hashing, JWT, current-user dependency
│   ├── models.py      # SQLAlchemy models (User, Transaction)
│   ├── schemas.py     # Pydantic request/response models
│   ├── database.py    # engine and session
│   └── .env           # secrets (not committed)
└── frontend/
    └── src/
        ├── App.jsx        # login gate + dashboard
        ├── AuthPage.jsx   # login / sign-up page
        ├── api.js         # API helper (attaches the token)
        ├── styles.css     # base styles and dashboard
        ├── auth.css       # login page styles
        └── charts.css     # header and chart card styles
```

## Getting Started

### Prerequisites

- Python 3.10+
- Node.js 18+
- PostgreSQL with an empty database created for the app

### 1. Backend

```bash
cd backend
python -m venv venv

# Windows
venv\Scripts\activate
# macOS / Linux
source venv/bin/activate

pip install fastapi uvicorn sqlalchemy "psycopg[binary]" python-dotenv bcrypt pyjwt
```

Create `backend/.env`:

```env
DATABASE_URL=postgresql+psycopg://USER:PASSWORD@localhost:5432/spendwise
SECRET_KEY=your_long_random_string
ACCESS_TOKEN_EXPIRE_MINUTES=1440
```

Generate a secret key with:

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Start the server (tables are created automatically on first run):

```bash
uvicorn main:app --reload
```

The API runs at `http://127.0.0.1:8000`. Interactive docs are at `http://127.0.0.1:8000/docs`.

### 2. Frontend

```bash
cd frontend
npm install
npm install recharts
npm run dev
```

Open the URL Vite prints (usually `http://localhost:5173`). If your backend runs on a different address, change `API_URL` in `src/api.js`.

## API Overview

All routes except `/` and the `/auth/register` and `/auth/login` routes need the header `Authorization: Bearer <token>`.

| Method | Endpoint                | Description                         |
| ------ | ----------------------- | ----------------------------------- |
| POST   | `/auth/register`        | Create an account, returns a token  |
| POST   | `/auth/login`           | Log in, returns a token             |
| GET    | `/auth/me`              | Current user                        |
| GET    | `/transactions`         | List your transactions              |
| POST   | `/transactions`         | Create a transaction                |
| GET    | `/transactions/{id}`    | Get one transaction                 |
| PUT    | `/transactions/{id}`    | Update a transaction                |
| DELETE | `/transactions/{id}`    | Delete a transaction                |
| GET    | `/summary`              | Total income, expenses, balance     |
| GET    | `/analytics/monthly`    | Income, expense, balance per month  |
| GET    | `/analytics/categories` | Expense totals per category         |
| GET    | `/analytics/savings`    | Savings per month                   |

## Notes

- Passwords must be 8 to 72 bytes long (a bcrypt limit).
- If you upgraded from a version without login, your old `transactions` table lacks the `user_id` column. Add it with a migration or drop the table so it is recreated.
- Never commit your `.env` file. Add it to `.gitignore`.
- Before deploying, replace `allow_origins=["*"]` in `main.py` with your real frontend URL.

## Possible Future Improvements

- Date range filters and search
- Budget limits per category
- CSV export
- Password reset flow
- Database migrations with Alembic

## License

MIT
