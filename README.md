# BudgetTracker

A modern budget tracking web app for managing your personal finances. Import transactions from your bank's CSV export or add them manually.

## Features

- **Manual Accounts**: Create and manage multiple accounts with custom balances
- **CSV Import**: Import transactions from bank CSV exports
- **Smart Categorization**: Rule-based automatic categorization with Polish merchant recognition
- **Dashboard**: Visual overview of balances, income, expenses, and spending by category
- **Transaction Management**: Search, filter, and manually categorize transactions
- **Budgets**: Set monthly budgets per category and track your spending
- **Recurring Expenses**: Track and monitor recurring payments

## Tech Stack

- **Frontend/Backend**: Next.js 15 with App Router
- **Database**: Supabase (PostgreSQL)
- **Authentication**: Supabase Auth
- **Styling**: Tailwind CSS

## Getting Started

### Prerequisites

- Node.js 18+ 
- npm or yarn
- Supabase account

### 1. Clone and Install

```bash
git clone <repository-url>
cd budget
npm install
```

### 2. Set Up Supabase

1. Create a new project at [supabase.com](https://supabase.com)
2. Go to SQL Editor and run the schema from `supabase/schema.sql`
3. Copy your project URL and anon key from Settings > API

### 3. Configure Environment Variables

Create a `.env.local` file in the root directory:

```env
# Supabase
NEXT_PUBLIC_SUPABASE_URL=https://your-project.supabase.co
NEXT_PUBLIC_SUPABASE_ANON_KEY=your-anon-key

# App URL
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

### 4. Run the Development Server

```bash
npm run dev
```

Open [http://localhost:3000](http://localhost:3000) in your browser.

## Project Structure

```
src/
├── app/                    # Next.js App Router pages
│   ├── api/               # API routes
│   │   ├── accounts/      # Account management
│   │   ├── categories/    # Category management
│   │   ├── dashboard/     # Dashboard data
│   │   └── transactions/  # Transaction endpoints
│   ├── auth/              # Auth callback
│   ├── accounts/          # Accounts page
│   ├── budgets/           # Budget management
│   ├── dashboard/         # Main dashboard
│   ├── import/            # CSV import
│   ├── login/             # Login page
│   ├── signup/            # Signup page
│   └── transactions/      # Transactions list
├── lib/                   # Utility libraries
│   ├── supabase/          # Supabase clients
│   └── mt940-parser.ts    # Bank statement parser
└── types/                 # TypeScript types
    └── database.ts        # Database schema types
```

## Deployment

### Deploy to Vercel

1. Push your code to GitHub
2. Import the project to [Vercel](https://vercel.com)
3. Add environment variables in Vercel's project settings
4. Deploy!

Remember to update `NEXT_PUBLIC_APP_URL` to your production URL.

## Database Schema

The app uses the following main tables:

- **accounts**: User accounts with balances
- **transactions**: Transaction records with categorization
- **categories**: Expense/income categories (system + custom)
- **categorization_rules**: Keywords for auto-categorization
- **budgets**: Budget goals per category
- **recurring_expenses**: Recurring payment tracking

## Security

- All data is protected with Row Level Security (RLS) in Supabase
- Sessions are managed securely via Supabase Auth

## License

MIT
