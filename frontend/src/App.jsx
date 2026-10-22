import { useCallback, useEffect, useState } from "react";
import {
  ResponsiveContainer,
  BarChart,
  Bar,
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  PieChart,
  Pie,
  Cell,
} from "recharts";
import AuthPage from "./AuthPage";
import { authFetch, clearToken, getToken, readError } from "./Api";
import "./auth.css";
import "./charts.css";

const PIE_COLORS = [
  "#2563eb",
  "#16a34a",
  "#dc2626",
  "#9333ea",
  "#ea580c",
  "#0891b2",
  "#ca8a04",
  "#db2777",
  "#64748b",
];

const rupees = (value) => `₹${Number(value).toLocaleString("en-IN")}`;

function monthLabel(item, locale) {
  const month = Number(item.month);
  const year = Number(item.year);
  if (!Number.isInteger(month) || month < 1 || month > 12 || !Number.isInteger(year)) {
    return "Unknown month";
  }
  return new Date(year, month - 1).toLocaleString(locale, {
    month: "short",
    year: "numeric",
  });
}

/* ======================= App: login gate ======================= */

function App() {
  const [user, setUser] = useState(null);
  // If a token is saved, we first check it with the server
  const [checking, setChecking] = useState(Boolean(getToken()));

  useEffect(() => {
    if (!getToken()) return;

    authFetch("/auth/me")
      .then((response) => (response.ok ? response.json() : null))
      .then((data) => setUser(data))
      .catch(() => setUser(null))
      .finally(() => setChecking(false));
  }, []);

  // authFetch fires this when the server says the token is no good
  useEffect(() => {
    const onLogout = () => setUser(null);
    window.addEventListener("auth:logout", onLogout);
    return () => window.removeEventListener("auth:logout", onLogout);
  }, []);

  function handleLogout() {
    clearToken();
    setUser(null);
  }

  if (checking) {
    return <div className="auth-loading">Loading...</div>;
  }

  if (!user) {
    return <AuthPage onAuthenticated={setUser} />;
  }

  return <Dashboard user={user} onLogout={handleLogout} />;
}

/* ======================= Dashboard ======================= */

function Dashboard({ user, onLogout }) {
  const [title, setTitle] = useState("");
  const [amount, setAmount] = useState("");
  const [type, setType] = useState("income");
  const [category, setCategory] = useState("Salary");
  const [date, setDate] = useState("");

  const [message, setMessage] = useState("");
  const [loading, setLoading] = useState(false);
  const [editingId, setEditingId] = useState(null);

  const [summary, setSummary] = useState({
    total_income: 0,
    total_expenses: 0,
    balance: 0,
  });

  const [transactions, setTransactions] = useState([]);
  const [monthlyData, setMonthlyData] = useState([]);
  const [categoryData, setCategoryData] = useState([]);
  const [savingsData, setSavingsData] = useState([]);

  const loadSummary = useCallback(async () => {
    const response = await authFetch("/summary");
    if (!response.ok) throw new Error("Failed to load summary");

    const data = await response.json();
    setSummary({
      total_income: Number(data.total_income ?? 0),
      total_expenses: Number(data.total_expenses ?? 0),
      balance: Number(data.balance ?? 0),
    });
  }, []);

  const loadCategoryData = useCallback(async () => {
    const response = await authFetch("/analytics/categories");
    if (!response.ok) throw new Error("Failed to fetch category analytics");

    const data = await response.json();
    setCategoryData(data.map((item) => ({ ...item, total: Number(item.total) })));
  }, []);

  const loadSavingsData = useCallback(async () => {
    const response = await authFetch("/analytics/savings");
    if (!response.ok) throw new Error("Failed to fetch savings data");

    const data = await response.json();
    setSavingsData(
      data.map((item) => ({
        ...item,
        income: Number(item.income),
        expenses: Number(item.expenses),
        savings: Number(item.savings),
        monthLabel: monthLabel(item, "en-IN"),
      }))
    );
  }, []);

  const loadTransactions = useCallback(async () => {
    const response = await authFetch("/transactions");
    if (!response.ok) throw new Error("Failed to load transactions");

    setTransactions(await response.json());
  }, []);

  const loadMonthlyData = useCallback(async () => {
    const response = await authFetch("/analytics/monthly");
    if (!response.ok) throw new Error("Failed to fetch monthly analytics");

    const result = await response.json();
    const data = Array.isArray(result) ? result : [result];

    setMonthlyData(
      data.map((item) => ({
        ...item,
        income: Number(item.income),
        expense: Number(item.expense),
        balance: Number(item.balance),
        monthLabel: monthLabel(item, "en"),
      }))
    );
  }, []);

  const refreshDashboard = useCallback(async () => {
    await Promise.all([
      loadSummary(),
      loadTransactions(),
      loadMonthlyData(),
      loadCategoryData(),
      loadSavingsData(),
    ]);
  }, [loadSummary, loadTransactions, loadMonthlyData, loadCategoryData, loadSavingsData]);

  useEffect(() => {
    refreshDashboard().catch((error) => {
      setMessage(`Could not load dashboard: ${error.message}`);
    });
  }, [refreshDashboard]);

  function resetForm() {
    setTitle("");
    setAmount("");
    setType("income");
    setCategory("Salary");
    setDate("");
    setEditingId(null);
  }

  function editTransaction(transaction) {
    setEditingId(transaction.id);
    setTitle(transaction.title);
    setAmount(String(transaction.amount));
    setType(transaction.type);
    setCategory(transaction.category);
    setDate(String(transaction.date).slice(0, 10));
    setMessage("Editing transaction...");

    window.scrollTo({ top: 0, behavior: "smooth" });
  }

  function cancelEdit() {
    resetForm();
    setMessage("");
  }

  async function handleSubmit(event) {
    event.preventDefault();

    if (!title.trim() || !amount || !date) {
      alert("Please fill in the title, amount, and date.");
      return;
    }
    if (Number(amount) <= 0) {
      alert("Amount must be greater than zero.");
      return;
    }

    setMessage("");
    setLoading(true);

    const wasEditing = editingId !== null;
    const transaction = {
      title: title.trim(),
      amount: Number(amount),
      type,
      category,
      date,
    };

    try {
      const response = await authFetch(
        wasEditing ? `/transactions/${editingId}` : "/transactions",
        {
          method: wasEditing ? "PUT" : "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify(transaction),
        }
      );

      if (!response.ok) {
        throw new Error(await readError(response, "Failed to save transaction"));
      }

      await refreshDashboard();
      resetForm();
      setMessage(
        wasEditing
          ? "Transaction updated successfully!"
          : "Transaction saved successfully!"
      );
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    } finally {
      setLoading(false);
    }
  }

  async function deleteTransaction(id) {
    if (!window.confirm("Are you sure you want to delete this transaction?")) return;

    setMessage("");

    try {
      const response = await authFetch(`/transactions/${id}`, { method: "DELETE" });

      if (!response.ok) {
        throw new Error(await readError(response, "Failed to delete transaction"));
      }

      if (editingId === id) resetForm();

      await refreshDashboard();
      setMessage("Transaction deleted successfully!");
    } catch (error) {
      setMessage(`Error: ${error.message}`);
    }
  }

  return (
    <main className="dashboard">
      <header className="page-header">
        <div>
          <h1>SpendWise</h1>
          <p className="subtitle">Manage your income and expenses</p>
        </div>

        <div className="user-box">
          <span className="user-name" title={user.email}>
            {user.name}
          </span>
          <button type="button" className="logout-button" onClick={onLogout}>
            Log out
          </button>
        </div>
      </header>

      {/* Summary Cards */}
      <section className="summary-container" aria-label="Financial summary">
        <div className="summary-card">
          <h3>Total Income</h3>
          <p className="income">{rupees(summary.total_income)}</p>
        </div>

        <div className="summary-card">
          <h3>Total Expenses</h3>
          <p className="expense">{rupees(summary.total_expenses)}</p>
        </div>

        <div className="summary-card">
          <h3>Balance</h3>
          <p className="balance">{rupees(summary.balance)}</p>
        </div>
      </section>

      <section className="chart-section">
        <h2>Monthly Income vs Expenses</h2>
        {monthlyData.length === 0 ? (
          <p className="chart-empty">Add a transaction to see this chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis tickFormatter={rupees} />
              <Tooltip formatter={(value, name) => [rupees(value), name]} />
              <Legend />
              <Bar dataKey="income" fill="#16a34a" name="Income" />
              <Bar dataKey="expense" fill="#dc2626" name="Expenses" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="chart-section">
        <h2>Monthly Balance</h2>
        {monthlyData.length === 0 ? (
          <p className="chart-empty">Add a transaction to see this chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <LineChart data={monthlyData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis tickFormatter={rupees} />
              <Tooltip formatter={(value) => [rupees(value), "Balance"]} />
              <Line
                type="monotone"
                dataKey="balance"
                stroke="#2563eb"
                strokeWidth={3}
                name="Balance"
              />
            </LineChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="chart-section">
        <h2>Expenses by Category</h2>
        {categoryData.length === 0 ? (
          <p className="chart-empty">No expenses yet.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <PieChart>
              <Pie
                data={categoryData}
                dataKey="total"
                nameKey="category"
                cx="50%"
                cy="50%"
                outerRadius={100}
                label
              >
                {categoryData.map((item, index) => (
                  <Cell
                    key={item.category}
                    fill={PIE_COLORS[index % PIE_COLORS.length]}
                  />
                ))}
              </Pie>
              <Tooltip formatter={(value) => rupees(value)} />
              <Legend />
            </PieChart>
          </ResponsiveContainer>
        )}
      </section>

      <section className="chart-section">
        <h2>Monthly Savings</h2>
        {savingsData.length === 0 ? (
          <p className="chart-empty">Add a transaction to see this chart.</p>
        ) : (
          <ResponsiveContainer width="100%" height={300}>
            <BarChart data={savingsData}>
              <CartesianGrid strokeDasharray="3 3" />
              <XAxis dataKey="monthLabel" />
              <YAxis tickFormatter={rupees} />
              <Tooltip formatter={(value) => [rupees(value), "Savings"]} />
              <Bar dataKey="savings" fill="#2563eb" name="Savings" />
            </BarChart>
          </ResponsiveContainer>
        )}
      </section>

      {/* Add or Edit Transaction Form */}
      <form className="transaction-form" onSubmit={handleSubmit}>
        <h2>{editingId !== null ? "Edit Transaction" : "Add Transaction"}</h2>

        <label htmlFor="title">Title</label>
        <input
          id="title"
          type="text"
          value={title}
          onChange={(event) => setTitle(event.target.value)}
          placeholder="e.g. Monthly salary"
          maxLength={100}
          required
        />

        <label htmlFor="amount">Amount (₹)</label>
        <input
          id="amount"
          type="number"
          min="0.01"
          step="0.01"
          value={amount}
          onChange={(event) => setAmount(event.target.value)}
          placeholder="Enter amount"
          required
        />

        <label htmlFor="type">Type</label>
        <select
          id="type"
          value={type}
          onChange={(event) => {
            const newType = event.target.value;
            setType(newType);
            setCategory(newType === "income" ? "Salary" : "Food");
          }}
        >
          <option value="income">Income</option>
          <option value="expense">Expense</option>
        </select>

        <label htmlFor="category">Category</label>
        <select
          id="category"
          value={category}
          onChange={(event) => setCategory(event.target.value)}
        >
          {type === "income" ? (
            <>
              <option value="Salary">Salary</option>
              <option value="Freelance">Freelance</option>
              <option value="Investment">Investment</option>
              <option value="Other income">Other income</option>
            </>
          ) : (
            <>
              <option value="Food">Food</option>
              <option value="Transport">Transport</option>
              <option value="Shopping">Shopping</option>
              <option value="Bills">Bills</option>
              <option value="Education">Education</option>
              <option value="Other expense">Other expense</option>
            </>
          )}
        </select>

        <label htmlFor="date">Date</label>
        <input
          id="date"
          type="date"
          value={date}
          onChange={(event) => setDate(event.target.value)}
          required
        />

        <div className="form-actions">
          <button type="submit" disabled={loading}>
            {loading
              ? "Saving..."
              : editingId !== null
                ? "Update Transaction"
                : "Save Transaction"}
          </button>

          {editingId !== null && (
            <button
              type="button"
              className="secondary-button"
              onClick={cancelEdit}
              disabled={loading}
            >
              Cancel Edit
            </button>
          )}
        </div>

        {message && (
          <p className="status-message" role="status">
            {message}
          </p>
        )}
      </form>

      {/* Transaction History */}
      <section className="transaction-history">
        <h2>Transaction History</h2>

        {transactions.length === 0 ? (
          <p className="empty-state">
            No transactions yet. Add your first transaction!
          </p>
        ) : (
          <div className="transaction-list">
            {transactions.map((transaction) => (
              <article className="transaction-item" key={transaction.id}>
                <div className="transaction-details">
                  <h3>{transaction.title}</h3>
                  <p>
                    {transaction.category} ·{" "}
                    {String(transaction.date).slice(0, 10)}
                  </p>
                </div>

                <strong className={transaction.type}>
                  {transaction.type === "income" ? "+" : "-"}
                  {rupees(transaction.amount)}
                </strong>

                <div className="transaction-actions">
                  <button
                    type="button"
                    className="edit-button"
                    onClick={() => editTransaction(transaction)}
                  >
                    Edit
                  </button>

                  <button
                    type="button"
                    className="delete-button"
                    onClick={() => deleteTransaction(transaction.id)}
                  >
                    Delete
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}

export default App;