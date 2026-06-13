# ThreatPilot — Architecture

> **Autonomous Agentic SOC on Splunk** · Security Track · Splunk Agentic Ops Hackathon 2025

---

## System Overview

```mermaid
flowchart TD
    A1([App Logs]) --> SP
    A2([Auth Events]) --> SP
    A3([Network Traffic]) --> SP
    A4([Endpoint Data]) --> SP

    SP[Splunk SIEM\nMCP Server · SPL · HEC]

    SP -->|Splunk MCP queries| CM

    CM[Commander Agent\nDetect · Enrich · Verdict]

    CG[(Campaign Graph\nNeo4j · Attack Memory)]
    SAI[Splunk Hosted AI\nThreat Reasoning]

    CM <-->|checkIPInGraph| CG
    CM <-->|compressed context| SAI

    CM --> IM[Immediator Agent\nNormalize · Dispatch]

    IM --> IDA[Identity Agent\nLock Accounts · Revoke Tokens]
    IM --> NWA[Network Agent\nBlock IPs · WAF · Rate Limit]
    IM --> IFA[Infra Agent\nEscalate · Monitor]

    IDA --> OUT[Incident Report + Audit Log]
    NWA --> OUT
    IFA --> OUT

    OUT --> AP[SOC Analyst Approval\nArjun · 30 seconds]
    AP -->|confirmed nodes added| CG
```

## Agent Pipeline — Detailed Flow

```mermaid
sequenceDiagram
    autonumber
    participant SP as Splunk SIEM<br/>(MCP Server)
    participant CM as Commander Agent
    participant CG as Campaign Graph<br/>(Neo4j)
    participant AI as Splunk Hosted AI
    participant IM as Immediator Agent
    participant DA as Domain Agents ×3
    participant UI as SOC Dashboard

    Note over SP: 847 auth failure events indexed
    CM->>SP: SPL query via MCP<br/>stats count by src_ip, where count > 15
    SP-->>CM: 6 suspicious IPs, 848 total alerts

    loop For each suspicious IP
        CM->>CG: checkIPInGraph(ip)
        CG-->>CM: MATCH — "Phishing wave June 11"
    end

    Note over CM: Graph match found → escalate to CRITICAL
    CM->>AI: 300-token compressed context
    AI-->>CM: "CRITICAL: 6 IPs from known campaign..."

    CM->>CG: addThreatToGraph(incident)
    CM->>IM: Structured findings JSON

    par Parallel dispatch
        IM->>DA: Identity Agent → lock 12 accounts
        IM->>DA: Network Agent → block 6 IPs + WAF
        IM->>DA: Infra Agent → escalate monitoring
    end

    DA-->>IM: 22 actions complete (~90s)
    IM-->>UI: Full incident report
    UI-->>UI: SOC Analyst reviews
    UI->>SP: Approval logged to Splunk audit trail
```

---

## Campaign Knowledge Graph — Schema

```mermaid
graph LR
    classDef ip       fill:#FF3B5C,stroke:#DC2626,color:#fff
    classDef campaign fill:#FFB800,stroke:#D97706,color:#000
    classDef account  fill:#8B5CF6,stroke:#7C3AED,color:#fff
    classDef event    fill:#00D4FF,stroke:#0284C7,color:#000

    IP1["IP: 203.0.113.10"]:::ip
    IP2["IP: 203.0.113.11"]:::ip
    IP3["IP: 203.0.113.12"]:::ip
    IP4["IP: 203.0.113.13"]:::ip
    IP5["IP: 203.0.113.14"]:::ip
    IP6["IP: 203.0.113.15"]:::ip

    C1["Campaign
    Phishing wave
    June 11, 2024
    confirmed: true"]:::campaign

    C2["Campaign
    Credential stuffing
    June 14, 2026
    confirmed: false"]:::campaign

    A1["Account: arjun.sharma"]:::account
    A2["Account: priya.patel"]:::account
    A3["Account: vikram.mehta"]:::account

    IP1 -->|USED_IN| C1
    IP2 -->|USED_IN| C1
    IP3 -->|USED_IN| C1
    IP4 -->|USED_IN| C1
    IP5 -->|USED_IN| C1
    IP6 -->|USED_IN| C1

    IP1 -->|USED_IN| C2
    IP2 -->|USED_IN| C2
    IP3 -->|USED_IN| C2
    IP4 -->|USED_IN| C2
    IP5 -->|USED_IN| C2
    IP6 -->|USED_IN| C2

    A1 -->|TARGETED_IN| C2
    A2 -->|TARGETED_IN| C2
    A3 -->|TARGETED_IN| C2
```

> **This is the key innovation.** When IP `203.0.113.10` appears in tonight's attack, ThreatPilot traces the edge back to `Campaign: Phishing wave June 11`. This is a known attacker — second strike. Severity escalates to CRITICAL instantly.

---

## Data Flow

```mermaid
flowchart LR
    classDef data   fill:#1a1d27,stroke:#00D4FF,color:#00D4FF
    classDef proc   fill:#1a1d27,stroke:#8B5CF6,color:#8B5CF6
    classDef store  fill:#1a1d27,stroke:#FFB800,color:#FFB800
    classDef out    fill:#1a1d27,stroke:#00FF88,color:#00FF88

    RAW["Raw logs\n847 events\nJSON via HEC"]:::data
    IDX["Splunk Index\nmain · auth_events\nSPL searchable"]:::store
    SPL["SPL Query\nstats count by src_ip\nwhere count > 15"]:::proc
    CLU["6 clusters\n166/152/144/137\n128/121 failures"]:::data
    GQ["Graph Query\ncheckIPInGraph\nCypher MATCH"]:::proc
    GM["Graph Match\nCAMP-2024-001\nPhishing wave"]:::store
    CTX["Compressed context\n~300 tokens\nNot 30k raw logs"]:::data
    VD["AI Verdict\nCRITICAL severity\nPlain English"]:::proc
    ACT["22 Actions\n12 locked · 6 blocked\n+ escalation"]:::out
    RPT["Incident Report\n1 document\nreplaces 847 alerts"]:::out

    RAW --> IDX --> SPL --> CLU --> GQ --> GM
    GM --> CTX --> VD --> ACT --> RPT
```

---

## Component Responsibilities

| Component | File | Responsibility |
|-----------|------|---------------|
| **Commander Agent** | `src/agents/commander.js` | Queries Splunk via MCP every cycle, cross-references IPs with Campaign Graph, calls Splunk AI for verdict |
| **Immediator Agent** | `src/agents/immediator.js` | Receives Commander findings, normalises severity, dispatches to all three domain agents in parallel |
| **Identity Agent** | `src/agents/identity-agent.js` | Locks all targeted accounts, revokes active sessions and tokens |
| **Network Agent** | `src/agents/network-agent.js` | Blocks malicious IPs via WAF rules, applies rate limiting to auth service |
| **Infra Agent** | `src/agents/infra-agent.js` | Escalates monitoring level, increases log verbosity across all services |
| **Splunk MCP Interface** | `src/splunk/mcp.js` | Wraps Splunk REST API for agent queries — SPL search job creation, polling, result extraction |
| **Campaign Graph** | `src/graph/queries.js` | Neo4j queries — checkIPInGraph(), addThreatToGraph(), getCampaignContext() |
| **API Server** | `src/api/server.js` | Express endpoints — run-detection, get incident, approve, health check |
| **SOC Dashboard** | `frontend/src/App.jsx` | React dashboard — live polling, Cytoscape graph, approval workflow |

---

## Splunk Integration Points

```
┌─────────────────────────────────────────────────────────┐
│                    SPLUNK ENTERPRISE                     │
│                                                         │
│  ┌──────────┐  ┌──────────┐  ┌──────────────────────┐  │
│  │   HEC    │  │ REST API │  │   MCP Server         │  │
│  │ :8088    │  │  :8089   │  │   Agent interface    │  │
│  └────┬─────┘  └────┬─────┘  └──────────┬───────────┘  │
│       │              │                   │              │
│       ▼              ▼                   ▼              │
│  [Log ingestion] [Search jobs]    [Agent queries]       │
│  generate-logs   /services/       Commander Agent       │
│  .py → 847       search/jobs      asks questions,       │
│  events          SPL execution    Splunk answers        │
│                                                         │
│  ┌──────────────────────────────────────────────────┐   │
│  │              Splunk AI Assistant                 │   │
│  │  SOC analyst asks: "What did these IPs do       │   │
│  │  in the last 30 days?" → natural language        │   │
│  │  answer powered by Splunk hosted AI              │   │
│  └──────────────────────────────────────────────────┘   │
└─────────────────────────────────────────────────────────┘
```

---

## Why ThreatPilot Wins on Splunk

| Capability | How ThreatPilot Uses It |
|-----------|------------------------|
| **Splunk MCP Server** | Commander Agent's primary query interface — agents speak to Splunk via MCP protocol |
| **Splunk Hosted AI** | Threat reasoning engine — receives compressed graph context, returns structured verdict |
| **Splunk AI Assistant** | SOC analyst chat interface — natural language queries over incident data |
| **Splunk HEC** | Log ingestion pipeline — all attack events pushed to Splunk in real-time |
| **Splunk SPL** | Pattern detection — `stats count by src_ip | where count > 15 | eval severity` |
| **Splunk Audit Trail** | Every agent action logged back to Splunk for compliance and review |

---

<div align="center">

*Every other SOC tool answers: "What is this alert?"*

*ThreatPilot answers: "Have we seen this attacker before — and what are they really doing?"*

</div>