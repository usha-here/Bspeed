# Bitespeed Identity System

This is a backend identity reconciliation service built using Next.js and Prisma (backed by Neon PostgreSQL). It processes customer contact information (email and phone number) from checkout events and links them together, identifying a primary account and associating secondary contacts.

DEploy Link: https://bspeed.vercel.app/

## Tech Stack

- **Framework:** Next.js (App Router API Routes)
- **Database ORM:** Prisma
- **Database:** Neon PostgreSQL
- **Language:** TypeScript

## Setup & Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Database Configuration:**
   Ensure you have a `.env` file in the root directory with your Neon Database URL:
   ```env
   DATABASE_URL="postgresql://<user>:<password>@<endpoint>.neon.tech/neondb?sslmode=require"
   ```

3. **Generate Prisma Client & Push Schema:**
   ```bash
   npx prisma generate
   npx prisma db push
   ```

4. **Run the Development Server:**
   ```bash
   npm run dev
   ```

## API Endpoint

### `POST /api/identify`

Consolidates contact information based on the provided email and phone number.

**Request Body:**
```json
{
  "email": "mcfly@hillvalley.edu",
  "phoneNumber": "123456"
}
```

**Successful Response Example:**
```json
{
  "contact": {
    "primaryContatctId": 1,
    "emails": ["mcfly@hillvalley.edu", "lorraine@hillvalley.edu"],
    "phoneNumbers": ["123456", "789101"],
    "secondaryContactIds": [2, 3]
  }
}
```

## Testing

A test script is provided in `testcases.ts` to simulate various edge cases such as:
- Initial contact creation
- Creating secondary contacts that match on phone or email
- Ensuring duplicate submissions do not create duplicate records
- Creating independent primaries
- Merging two existing independent primary contacts

To run the test cases, ensure `ts-node` is installed and execute:
```bash
npx ts-node testcases.ts
```
