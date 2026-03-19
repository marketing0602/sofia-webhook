# Sofia Webhook

Webhook server that receives **Vapi** voice AI end-of-call reports and updates the corresponding lead in **HubSpot CRM**.

## Quick Start

```bash
# 1. Install dependencies
npm install

# 2. Configure environment
cp .env.example .env
# Edit .env and add your real HUBSPOT_TOKEN

# 3. Run the server
npm start
```

The server starts on **http://localhost:3000** by default.

## API

| Method | Path             | Description                                    |
|--------|------------------|------------------------------------------------|
| POST   | `/vapi-webhook`  | Receives Vapi end-of-call reports              |
| POST   | `/trigger-call`  | Receives HubSpot workflow → triggers Vapi call |
| GET    | `/`              | Health check                                   |

## Deploy to Railway

1. Push this repo to GitHub.
2. Go to [railway.app](https://railway.app) → **New Project** → **Deploy from GitHub repo**.
3. Select your repository.
4. In the Railway dashboard, go to **Variables** and add:
   - `HUBSPOT_TOKEN` — your HubSpot private app token
   - `VAPI_API_KEY` — your Vapi private key
   - `VAPI_ASSISTANT_ID` — your Sofia assistant ID from Vapi
   - `VAPI_PHONE_NUMBER_ID` — your Vapi phone number ID
   - `PORT` — Railway sets this automatically; you can omit it.
5. Click **Deploy**. Railway will run `npm install` and `npm start` automatically.
6. Copy the generated Railway URL (e.g. `https://sofia-webhook-production.up.railway.app`).

### Connect to Vapi

1. Open the [Vapi dashboard](https://dashboard.vapi.ai).
2. Go to **Assistants** → **Sofia**.
3. Paste your Railway URL into the **Server URL** field:
   ```
   https://sofia-webhook-production.up.railway.app/vapi-webhook
   ```
4. Save. Vapi will now send end-of-call reports to your server.

### Connect to HubSpot Workflow

1. In HubSpot, create or edit a workflow.
2. Add a **Webhook** action with method **POST** and URL:
   ```
   https://sofia-webhook-production.up.railway.app/trigger-call
   ```
3. Set the request body to include: `phone`, `lead_first_name`, `lead_last_name`, `lead_company`, `lead_country`, `lead_email`, `lead_trigger`, `sofia_call_count`, `sofia_last_call_outcome`, `sofia_last_call_summary`, `sofia_call_picked_up`, `sofia_demo_booked`.
4. Map each field to the corresponding HubSpot contact property.

## Environment Variables

| Variable              | Description                          |
|-----------------------|--------------------------------------|
| `HUBSPOT_TOKEN`       | HubSpot private app API token        |
| `VAPI_API_KEY`        | Vapi private API key                 |
| `VAPI_ASSISTANT_ID`   | Sofia assistant ID in Vapi           |
| `VAPI_PHONE_NUMBER_ID`| Vapi phone number ID                 |
| `PORT`                | Server port (default `3000`)         |
