import asyncio
import asyncpg
import logging
from dotenv import load_dotenv

load_dotenv()

from auth import get_password_hash
from database import DATABASE_URL

async def main():
    if not DATABASE_URL:
        print("DATABASE_URL is not set.")
        return

    conn = await asyncpg.connect(DATABASE_URL)
    try:
        username = "admin8381"
        password_hash = get_password_hash("#admin8381.com")
        
        await conn.execute("""
            INSERT INTO users (username, password_hash, is_admin) 
            VALUES ($1, $2, TRUE)
            ON CONFLICT (username) DO UPDATE 
            SET password_hash = EXCLUDED.password_hash, is_admin = TRUE
        """, username, password_hash)
        
        print(f"Admin user '{username}' created/updated successfully.")
    except Exception as e:
        print(f"Error creating admin: {e}")
    finally:
        await conn.close()

if __name__ == "__main__":
    asyncio.run(main())
