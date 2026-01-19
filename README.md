# ASPIRA - Learning Management System (Final Build)

## Quick start
1. Make sure MongoDB is running locally (default: mongodb://localhost:27017)
2. Copy `.env.example` to `.env` and adjust values if needed
3. Install dependencies:

   ```bash
   npm install
   ```

4. Seed sample data:

   ```bash
   npm run seed
   ```

5. Start the server:

   ```bash
   npm start
   ```

6. Open http://localhost:3000

## Seeded accounts
- Admin: admin@aspira.edu / AdminPass123
- Teacher: prof.jane@aspira.edu / TeacherPass123
- Students: student1@aspira.edu / Student123, student2@aspira.edu / Student123

## Notes
- Student registration is available via the Register page. Admin must promote users to teacher via the Admin dashboard or terminal.
- Files uploaded are stored in the `uploads/` directory.
