import os, sys, time
import redis
from rq import Worker, Queue, Connection

REDIS_URL = os.getenv("REDIS_URL", "redis://redis:6379/0")
QUEUES = ["default"]

def main():
    # tolerate Redis coming up slowly
    for _ in range(30):
        try:
            r = redis.from_url(REDIS_URL)
            r.ping()
            break
        except Exception:
            time.sleep(1)
    with Connection(r):
        Worker(QUEUES).work(with_scheduler=True)

if __name__ == "__main__":
    main()