import os
import asyncpg
import logging
from dotenv import load_dotenv

load_dotenv()

log = logging.getLogger("riva")

DATABASE_URL = os.getenv("DATABASE_URL")


async def get_db_pool():
    if not DATABASE_URL:
        raise ValueError("DATABASE_URL is not set.")
    return await asyncpg.create_pool(DATABASE_URL, min_size=1, max_size=5)


async def init_db():
    if not DATABASE_URL:
        log.warning("No DATABASE_URL found. Skipping DB init.")
        return

    log.info("Initializing database schema...")
    conn = await asyncpg.connect(DATABASE_URL)
    try:
        await conn.execute("""
            CREATE TABLE IF NOT EXISTS users (
                id SERIAL PRIMARY KEY,
                username VARCHAR(50) UNIQUE NOT NULL,
                password_hash VARCHAR(255) NOT NULL,
                is_admin BOOLEAN DEFAULT FALSE,
                disabled BOOLEAN DEFAULT FALSE,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS chats (
                id SERIAL PRIMARY KEY,
                user_id INTEGER REFERENCES users(id) ON DELETE CASCADE,
                title VARCHAR(255) NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS messages (
                id SERIAL PRIMARY KEY,
                chat_id INTEGER REFERENCES chats(id) ON DELETE CASCADE,
                role VARCHAR(20) NOT NULL,
                content TEXT NOT NULL,
                created_at TIMESTAMP WITH TIME ZONE DEFAULT CURRENT_TIMESTAMP
            );

            CREATE TABLE IF NOT EXISTS settings (
                key VARCHAR(100) PRIMARY KEY,
                value TEXT NOT NULL DEFAULT ''
            );

            -- Indexes
            CREATE INDEX IF NOT EXISTS idx_chats_user_id ON chats(user_id);
            CREATE INDEX IF NOT EXISTS idx_messages_chat_id ON messages(chat_id);

            -- Ensure maintenance_mode key exists
            INSERT INTO settings (key, value) VALUES ('maintenance_mode', 'false')
            ON CONFLICT (key) DO NOTHING;
        """)

        # Add columns if they don't exist (for existing databases)
        for col, default in [("is_admin", "FALSE"), ("disabled", "FALSE")]:
            try:
                await conn.execute(f"ALTER TABLE users ADD COLUMN {col} BOOLEAN DEFAULT {default}")
                log.info(f"Added column users.{col}")
            except asyncpg.DuplicateColumnError:
                pass

        log.info("Database schema initialized successfully.")
    except Exception as e:
        # Avoid logging raw DSN credentials if present in exception string
        err_msg = str(e)
        if "@" in err_msg:
            err_msg = "Database connection or authentication error."
        log.error(f"Failed to initialize database: {err_msg}")
    finally:
        await conn.close()


if __name__ == "__main__":
    import asyncio
    logging.basicConfig(level=logging.INFO)
    asyncio.run(init_db())
