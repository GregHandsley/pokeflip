import time
import os

def main():
    print("Worker booted. (Stub for Sprint 1)")
    print("DATABASE_URL:", os.getenv("DATABASE_URL"))
    print("REDIS_URL:", os.getenv("REDIS_URL"))
    while True:
        time.sleep(10)
        print("Worker heartbeat...")

if __name__ == "__main__":
    main()
