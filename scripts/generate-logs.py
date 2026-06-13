import requests
import json
import random
from datetime import datetime, timedelta
import urllib3
urllib3.disable_warnings()

SPLUNK_HEC = "https://localhost:8088/services/collector/event"
TOKEN = "5da85537-5596-4efb-81bb-e2884fc8bfd9"

ATTACK_IPS = [f"203.0.113.{i}" for i in range(10, 16)]
TARGET_USERS = [
    "arjun.sharma", "priya.patel", "vikram.mehta", "sunita.rao",
    "amit.gupta", "deepa.nair", "rahul.joshi", "kavya.reddy",
    "sanjay.iyer", "anita.kumar", "rohit.singh", "meera.pillai"
]

events = []
base_time = datetime.now()

for i in range(847):
    ip = random.choice(ATTACK_IPS)
    user = random.choice(TARGET_USERS)
    t = base_time + timedelta(seconds=random.randint(0, 300))
    events.append({
        "time": t.timestamp(),
        "sourcetype": "auth_events",
        "index": "main",
        "event": {
            "src_ip": ip,
            "username": user,
            "action": "login_attempt",
            "status": "FAILURE",
            "service": "auth-service",
            "timestamp": t.isoformat()
        }
    })

for i in range(0, len(events), 50):
    batch = "\n".join(json.dumps(e) for e in events[i:i+50])
    r = requests.post(
        SPLUNK_HEC,
        headers={"Authorization": f"Splunk {TOKEN}"},
        data=batch,
        verify=False
    )
    print(f"Batch {i//50 + 1}/17 sent ✓")

print("\nDone — 847 attack events in Splunk!")
