# Warehouse Backend

Express + MySQL API for the warehouse frontend (check-ins / орлого).

## Setup

1. **Install dependencies**
   ```bash
   npm install
   ```

2. **Database**
   - Create MySQL database and tables:
     ```bash
     mysql -u root -p < schema.sql
     ```
   - Or run the contents of `schema.sql` in your MySQL client.

3. **Environment**
   - Copy `.env.example` to `.env` and set your MySQL credentials:
     ```bash
     cp .env.example .env
     ```
   - Edit `.env`: `DB_HOST`, `DB_USER`, `DB_PASSWORD`, `DB_NAME`.

## Run

```bash
npm run dev
```

Server: **http://localhost:3000**

## API

| Method | Path | Description |
|--------|------|-------------|
| GET | `/api/checkins` | List check-ins (query: `search`, `status`, `page`, `limit`) |
| GET | `/api/checkins/:id` | Get one check-in with items |
| POST | `/api/checkins` | Create check-in (body: code, date, status, contact, warehouse, user, details, items[]) |
| PUT | `/api/checkins/:id` | Update check-in |
| DELETE | `/api/checkins/:id` | Delete check-in and its items |

Response list shape: `{ total, page, limit, data: Checkin[] }`.  
Check-in shape: `id`, `code`, `date`, `status`, `contact`, `warehouse`, `user`, `details`, `items[]`.
